// ═══════════════════════════════════════════════════════════════════
// GameEngine — Pure basketball simulation functions (no side effects)
// ═══════════════════════════════════════════════════════════════════

import { getFatiguePenalty } from './BasketballMath.js';
import { GamePipeline } from './GamePipeline.js';

export const GameEngine = {
    /**
     * Calculate the strength of a team based on roster
     * @param {Object} team - Team object with roster
     * @returns {number} Team strength rating
     */
    calculateTeamStrength(team) {
        if (!team.roster || team.roster.length === 0) {
            console.warn(`Team ${team.name} has no roster, using base rating`);
            return team.rating;
        }
        
        // Sort players by rating (best first)
        const adjustedPlayers = [...team.roster]
            .filter(p => {
                // Filter out players who are completely unavailable
                return !p.injuryStatus || p.injuryStatus === 'healthy' || p.injuryStatus === 'day-to-day';
            })
            .filter(p => !p.resting) // Also filter out players resting due to fatigue
            .map(p => {
                let adjustedRating = p.rating;
                
                // Apply rating penalty if playing through injury
                if (p.injuryStatus === 'day-to-day' && p.injury && p.injury.ratingPenalty) {
                    adjustedRating += p.injury.ratingPenalty; // Penalty is negative
                }
                
                // Apply fatigue penalty
                const fatiguePenalty = getFatiguePenalty(p.fatigue || 0);
                adjustedRating += fatiguePenalty; // Penalty is negative
                
                return {
                    ...p,
                    rating: Math.max(50, adjustedRating) // Min rating 50
                };
            });
        
        if (adjustedPlayers.length === 0) {
            console.warn(`${team.name} has no available players!`);
            return 50; // Minimum team strength
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // Select starters by position (matches distributeMinutes logic)
        // ═══════════════════════════════════════════════════════════════════
        const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
        const starters = [];
        const usedPlayers = new Set();
        
        positions.forEach(pos => {
            const positionPlayers = adjustedPlayers
                .filter(p => p.position === pos && !usedPlayers.has(p.id))
                .sort((a, b) => b.rating - a.rating);
            
            if (positionPlayers.length > 0) {
                starters.push(positionPlayers[0]);
                usedPlayers.add(positionPlayers[0].id);
            } else {
                // No one at this position - use best remaining
                const versatile = adjustedPlayers
                    .filter(p => !usedPlayers.has(p.id))
                    .sort((a, b) => b.rating - a.rating)[0];
                
                if (versatile) {
                    starters.push(versatile);
                    usedPlayers.add(versatile.id);
                }
            }
        });
        
        // Fill bench with remaining players by rating
        const bench = adjustedPlayers
            .filter(p => !usedPlayers.has(p.id))
            .sort((a, b) => b.rating - a.rating);
        
        // Combine rotation
        const rotation = [...starters, ...bench];
        
        // Calculate weighted average based on minutes distribution (not just top 8)
        // Weight players by their expected minutes played (matches distributeMinutes logic)
        let totalWeight = 0;
        let weightedSum = 0;
        
        // Average minutes by rotation position (1-12)
        const minutesWeights = [34, 34, 32, 30, 28, 17, 15, 12, 8, 5, 2, 1];
        
        rotation.forEach((player, index) => {
            if (index >= minutesWeights.length) return; // Beyond 12-man rotation
            
            const minutes = minutesWeights[index];
            weightedSum += player.rating * minutes;
            totalWeight += minutes;
        });
        
        const rosterStrength = weightedSum / totalWeight;
        
        // Blend roster strength (70%) with team rating (30%) for stability
        const blendedStrength = (rosterStrength * 0.7) + (team.rating * 0.3);
        
        return blendedStrength;
    },


    /**
     * Calculate team chemistry from roster
     * @param {Object} team - Team object with roster
     * @returns {number} Team chemistry score
     */
    calculateTeamChemistry(team) {
        if (!team.roster || team.roster.length === 0) {
            return 75; // Neutral chemistry
        }
        
        // Average player chemistry
        const totalChemistry = team.roster.reduce((sum, player) => {
            return sum + (player.chemistry || 75);
        }, 0);
        
        return totalChemistry / team.roster.length;
    },

    /**
     * Get home court advantage
     * @param {number} tier - Tier level
     * @returns {number} Home court advantage bonus
     */
    getHomeCourtAdvantage(tier) {
        // Simple flat bonus for now - same for all teams
        // Can be enhanced later with team-specific advantages
        return 3; // Home team gets +3 rating boost
    },

    /**
     * Calculate the outcome of a single game (PURE function - no state changes)
     * Now delegates to StatEngine for bottom-up player-stats-first simulation.
     * Returns the same interface as before PLUS homePlayerStats/awayPlayerStats.
     * @param {Object} homeTeam - Home team object
     * @param {Object} awayTeam - Away team object
     * @param {boolean} isPlayoffs - Whether this is a playoff game
     * @param {boolean} trackWinProbability - Whether to track win probability history
     * @param {boolean} lightweight - Skip events and player stats (for batch sims)
     * @returns {Object} Game result with scores, winner, and player stat lines
     */
    calculateGameOutcome(homeTeam, awayTeam, isPlayoffs = false, trackWinProbability = false, lightweight = false) {
        const tier = homeTeam.tier || awayTeam.tier || 1;
        // Use GamePipeline for possession-by-possession simulation
        // trackWinProbability defaults to false to prevent memory issues during batch sims
        // lightweight mode skips events and detailed player stats
        return GamePipeline.resolve(homeTeam, awayTeam, {
            isPlayoffs: isPlayoffs,
            tier: tier,
            trackWinProbability: trackWinProbability,
            lightweight: lightweight,
        });
    },

    /**
     * Calculate chemistry changes after a game (PURE function)
     * @param {Object} team - Team object
     * @param {boolean} won - Whether the team won
     * @returns {Object} Chemistry changes to apply
     */
    calculateChemistryChanges(team, won) {
        const changes = {
            playerChanges: [],
            messages: []
        };
        
        if (!team.roster) return changes;
        
        // === COLLABORATION CHEMISTRY INFLUENCE ===
        // Each player's Collaboration attribute shifts their personal chemistry per game.
        // High collab = pulls chemistry up, Low collab = drags it down.
        team.roster.forEach(player => {
            const collab = (player.attributes && player.attributes.collaboration) || 50;
            // Scale: 50 = neutral, 90 = +1.0/game, 20 = -0.8/game
            let collabDrift = (collab - 50) * 0.025;
            // Low collaborators are more toxic in losses
            if (!won && collab < 40) {
                collabDrift *= 1.5;
            }
            if (Math.abs(collabDrift) > 0.05) {
                changes.playerChanges.push({
                    playerId: player.id,
                    chemistryDelta: collabDrift,
                    reason: 'collaboration'
                });
            }
        });
        
        // Check for losing streak (5 consecutive losses)
        const losingStreak = team.currentLosingStreak || 0;
        
        if (!won) {
            const newStreak = losingStreak + 1;
            
            if (newStreak === 5) {
                // 5-game losing streak: -3 chemistry to all players
                team.roster.forEach(player => {
                    changes.playerChanges.push({
                        playerId: player.id,
                        chemistryDelta: -3,
                        reason: 'losing_streak'
                    });
                });
 changes.messages.push(`${team.name}: 5-game losing streak! Chemistry dropped by 3.`);
            }
            
            changes.losingStreak = newStreak;
        } else {
            // Win: +2 chemistry to all players
            team.roster.forEach(player => {
                changes.playerChanges.push({
                    playerId: player.id,
                    chemistryDelta: +2,
                    reason: 'win'
                });
            });
            changes.losingStreak = 0; // Reset losing streak
        }
        
        // Check for stability bonus (10 consecutive games with no roster changes)
        const gamesSinceChange = (team.gamesSinceRosterChange || 0) + 1;
        
        if (gamesSinceChange === 10) {
            // Stability bonus: +5 chemistry to all players
            team.roster.forEach(player => {
                const existing = changes.playerChanges.find(c => c.playerId === player.id);
                if (existing) {
                    existing.chemistryDelta += 5;
                } else {
                    changes.playerChanges.push({
                        playerId: player.id,
                        chemistryDelta: +5,
                        reason: 'stability'
                    });
                }
            });
 changes.messages.push(`${team.name}: 10 games of roster stability! Chemistry +5.`);
        }
        
        changes.gamesSinceRosterChange = gamesSinceChange;
        
        return changes;
    },

};
