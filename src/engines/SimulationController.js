// ═══════════════════════════════════════════════════════════════════
// SimulationController — Orchestrates game simulation
// ═══════════════════════════════════════════════════════════════════

import { GameEngine } from './GameEngine.js';

export class SimulationController {
    constructor() {
        this.observers = [];
        this.isRunning = false;
        this.isPaused = false;
    }

    /**
     * Simulate a full game instantly (for GM mode)
     * Updates team records, accumulates player stats, and returns result
     * @param {Object} homeTeam - Home team object
     * @param {Object} awayTeam - Away team object
     * @param {boolean} isPlayoffs - Whether this is a playoff game
     * @param {boolean} trackWinProbability - Whether to track win probability
     * @param {boolean} lightweight - Skip events/stats for memory efficiency
     * @returns {Object} Game result
     */
    simulateFullGame(homeTeam, awayTeam, isPlayoffs = false, trackWinProbability = false, lightweight = false) {
        // Use GameEngine to calculate outcome
        // trackWinProbability should only be true for user team games to save memory
        // lightweight mode skips events and detailed player stats
        const result = GameEngine.calculateGameOutcome(homeTeam, awayTeam, isPlayoffs, trackWinProbability, lightweight);
        
        // Apply state changes
        if (result.homeWon) {
            homeTeam.wins++;
            awayTeam.losses++;
            if (homeTeam.coach) homeTeam.coach.seasonWins++;
            if (awayTeam.coach) awayTeam.coach.seasonLosses++;
        } else {
            awayTeam.wins++;
            homeTeam.losses++;
            if (awayTeam.coach) awayTeam.coach.seasonWins++;
            if (homeTeam.coach) homeTeam.coach.seasonLosses++;
        }
        
        homeTeam.pointDiff += result.pointDiff;
        awayTeam.pointDiff -= result.pointDiff;
        
        // Update chemistry
        this.applyChemistryChanges(homeTeam, result.homeWon);
        this.applyChemistryChanges(awayTeam, !result.homeWon);
        
        // Accumulate player stats from the game
        this.accumulatePlayerStats(homeTeam, result.homePlayerStats);
        this.accumulatePlayerStats(awayTeam, result.awayPlayerStats);
        
        // Notify observers
        this.notifyObservers('gameComplete', result);
        
        return result;
    }

    /**
     * Accumulate individual player stat lines onto season totals
     * Also syncs minutesThisGame for fatigue system compatibility
     * @param {Object} team - Team object
     * @param {Array} playerStats - Array of player stat lines from StatEngine
     */
    accumulatePlayerStats(team, playerStats) {
        if (!team.roster || !playerStats) return;
        
        // First reset all minutesThisGame to 0 (DNP players)
        team.roster.forEach(p => { p.minutesThisGame = 0; });
        
        playerStats.forEach(statLine => {
            const player = team.roster.find(p => p.id === statLine.playerId);
            if (player) {
                window.StatEngine.accumulateStats(player, statLine);
                
                // Sync minutesThisGame for fatigue system (processFatigueAfterGame reads this)
                player.minutesThisGame = statLine.minutesPlayed;
                
                // Also update legacy gamesPlayed field for backward compatibility
                if (statLine.gamesPlayed > 0) {
                    if (!player.gamesPlayed) player.gamesPlayed = 0;
                    player.gamesPlayed++;
                }
            }
        });
    }

    /**
     * Apply chemistry changes to a team
     * @param {Object} team - Team object
     * @param {boolean} won - Whether the team won
     */
    applyChemistryChanges(team, won) {
        const changes = GameEngine.calculateChemistryChanges(team, won);
        
        // Apply chemistry changes to players
        changes.playerChanges.forEach(change => {
            const player = team.roster.find(p => p.id === change.playerId);
            if (player) {
                player.chemistry = Math.max(0, Math.min(100, (player.chemistry || 75) + change.chemistryDelta));
            }
        });
        
        // Update team state
        if (changes.losingStreak !== undefined) {
            team.currentLosingStreak = changes.losingStreak;
        }
        if (changes.gamesSinceRosterChange !== undefined) {
            team.gamesSinceRosterChange = changes.gamesSinceRosterChange;
        }
        
        // Increment games with team for all players
        team.roster.forEach(player => {
            if (!player.gamesWithTeam) player.gamesWithTeam = 0;
            player.gamesWithTeam++;
        });
        
        // Log messages
        changes.messages.forEach(msg => console.log(msg));
    }


    /**
     * Simulate a playoff game (doesn't update team records, just returns result)
     * @param {Object} homeTeam - Home team
     * @param {Object} awayTeam - Away team
     * @returns {Object} Game result
     */
    simulatePlayoffGame(homeTeam, awayTeam) {
        // Don't track win probability for batch playoff simulations
        // Don't use lightweight mode here - we need player stats for accumulation
        const result = GameEngine.calculateGameOutcome(homeTeam, awayTeam, true, false, false);
        this.accumulatePlayerStats(homeTeam, result.homePlayerStats);
        this.accumulatePlayerStats(awayTeam, result.awayPlayerStats);
        this.notifyObservers('playoffGameComplete', result);
        return result;
    }

    /**
     * Simulate an entire playoff series
     * @param {Object} higherSeed - Higher seeded team
     * @param {Object} lowerSeed - Lower seeded team
     * @param {number} bestOf - Series length (5 or 7)
     * @returns {Object} Series result with all game details
     */
    simulatePlayoffSeries(higherSeed, lowerSeed, bestOf) {
        const gamesToWin = Math.ceil(bestOf / 2);
        let higherSeedWins = 0;
        let lowerSeedWins = 0;
        const games = [];

        const homePattern = bestOf === 7
            ? [true, true, false, false, true, false, true]
            : [true, true, false, false, true];

        let gameNum = 0;
        while (higherSeedWins < gamesToWin && lowerSeedWins < gamesToWin) {
            const isHigherSeedHome = homePattern[gameNum];
            const homeTeam = isHigherSeedHome ? higherSeed : lowerSeed;
            const awayTeam = isHigherSeedHome ? lowerSeed : higherSeed;

            const gameResult = this.simulatePlayoffGame(homeTeam, awayTeam);

            if (gameResult.winner.id === higherSeed.id) {
                higherSeedWins++;
            } else {
                lowerSeedWins++;
            }

            games.push({
                gameNumber: gameNum + 1,
                homeTeam, awayTeam,
                homeScore: gameResult.homeScore,
                awayScore: gameResult.awayScore,
                winner: gameResult.winner
            });

            gameNum++;
        }

        const result = {
            higherSeed, lowerSeed,
            winner: higherSeedWins >= gamesToWin ? higherSeed : lowerSeed,
            loser: higherSeedWins >= gamesToWin ? lowerSeed : higherSeed,
            higherSeedWins, lowerSeedWins,
            games,
            seriesScore: `${higherSeedWins}-${lowerSeedWins}`
        };

        this.notifyObservers('playoffSeriesComplete', result);
        return result;
    }

    /**
     * Add an observer to be notified of simulation events
     * @param {Function} callback - Callback function(event, data)
     */
    addObserver(callback) {
        this.observers.push(callback);
    }

    /**
     * Notify all observers of an event
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    notifyObservers(event, data) {
        this.observers.forEach(observer => {
            try {
                observer(event, data);
            } catch (error) {
                console.error('Observer error:', error);
            }
        });
    }
}
