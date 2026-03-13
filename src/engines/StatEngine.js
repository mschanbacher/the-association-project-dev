// ═══════════════════════════════════════════════════════════════════
// StatEngine — Statistics, awards, All-Star selection, player analytics
// ═══════════════════════════════════════════════════════════════════
//
// Pure logic: no DOM access, no gameState references.
// Game simulation has moved to GamePipeline.js
//

import {
    POSITION_ARCHETYPES,
    emptyStatLine
} from './BasketballMath.js';
import { GameEngine } from './GameEngine.js';

export const StatEngine = {

    // Re-export for backward compatibility (consumers that read StatEngine.POSITION_ARCHETYPES)
    POSITION_ARCHETYPES,

    // ─────────────────────────────────────────────────────────────────────────
    // SEASON STATS MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    initializeSeasonStats(player) {
        player.seasonStats = {
            gamesPlayed: 0, gamesStarted: 0, minutesPlayed: 0,
            points: 0, rebounds: 0, offensiveRebounds: 0, defensiveRebounds: 0,
            assists: 0, steals: 0, blocks: 0,
            turnovers: 0, fouls: 0,
            fieldGoalsMade: 0, fieldGoalsAttempted: 0,
            threePointersMade: 0, threePointersAttempted: 0,
            freeThrowsMade: 0, freeThrowsAttempted: 0,
            plusMinus: 0,
        };
        player.gameLog = [];
    },

    accumulateStats(player, gameStatLine) {
        if (!player.seasonStats) this.initializeSeasonStats(player);
        const s = player.seasonStats;
        const g = gameStatLine;
        s.gamesPlayed += g.gamesPlayed;
        s.gamesStarted += g.gamesStarted;
        s.minutesPlayed += g.minutesPlayed;
        s.points += g.points;
        s.rebounds += g.rebounds;
        s.offensiveRebounds = (s.offensiveRebounds || 0) + (g.offensiveRebounds || 0);
        s.defensiveRebounds = (s.defensiveRebounds || 0) + (g.defensiveRebounds || 0);
        s.assists += g.assists;
        s.steals += g.steals;
        s.blocks += g.blocks;
        s.turnovers += g.turnovers;
        s.fouls += g.fouls;
        s.fieldGoalsMade += g.fieldGoalsMade;
        s.fieldGoalsAttempted += g.fieldGoalsAttempted;
        s.threePointersMade += g.threePointersMade;
        s.threePointersAttempted += g.threePointersAttempted;
        s.freeThrowsMade += g.freeThrowsMade;
        s.freeThrowsAttempted += g.freeThrowsAttempted;
        s.plusMinus = (s.plusMinus || 0) + (g.plusMinus || 0);

        // ── Per-game log for sparklines ────────────────────────────────────
        if (!player.gameLog) player.gameLog = [];
        if (player.gameLog.length < 100 && g.gamesPlayed > 0) {
            const fgm = g.fieldGoalsMade || 0;
            const fga = g.fieldGoalsAttempted || 0;
            const ftm = g.freeThrowsMade || 0;
            const fta = g.freeThrowsAttempted || 0;
            const orb = g.offensiveRebounds || 0;
            const drb = g.defensiveRebounds || 0;
            // Hollinger GameScore:
            // GmSc = PTS + 0.4×FGM − 0.7×FGA − 0.4×(FTA−FTM) + 0.7×ORB + 0.3×DRB
            //        + STL + 0.7×AST + 0.7×BLK − 0.4×PF − TOV
            const gs = +(
                (g.points    || 0)
                + 0.4  * fgm
                - 0.7  * fga
                - 0.4  * (fta - ftm)
                + 0.7  * orb
                + 0.3  * drb
                + (g.steals    || 0)
                + 0.7  * (g.assists   || 0)
                + 0.7  * (g.blocks    || 0)
                - 0.4  * (g.fouls     || 0)
                - (g.turnovers || 0)
            ).toFixed(1);
            player.gameLog.push({
                g:    s.gamesPlayed,
                pts:  g.points       || 0,
                reb:  g.rebounds     || 0,
                ast:  g.assists      || 0,
                fgPct: fga > 0 ? +(fgm / fga).toFixed(3) : 0,
                pm:   g.plusMinus    || 0,
                gs:   parseFloat(gs),
            });
        }
    },

    getSeasonAverages(player) {
        const s = player.seasonStats;
        if (!s || s.gamesPlayed === 0) return null;
        const gp = s.gamesPlayed;
        const mpg = s.minutesPlayed / gp;

        const fgPct    = s.fieldGoalsAttempted > 0 ? +(s.fieldGoalsMade / s.fieldGoalsAttempted).toFixed(3) : 0;
        const threePct = s.threePointersAttempted > 0 ? +(s.threePointersMade / s.threePointersAttempted).toFixed(3) : 0;
        const ftPct    = s.freeThrowsAttempted > 0 ? +(s.freeThrowsMade / s.freeThrowsAttempted).toFixed(3) : 0;

        // True Shooting %: points / (2 × (FGA + 0.44 × FTA))
        const tsDenom = 2 * (s.fieldGoalsAttempted + 0.44 * s.freeThrowsAttempted);
        const tsPct   = tsDenom > 0 ? +(s.points / tsDenom).toFixed(3) : 0;

        // Per-36 normalised (most useful for bench players with low minutes)
        const totalMin = s.minutesPlayed || 1;
        const per36 = {
            points:    +((s.points    / totalMin) * 36).toFixed(1),
            rebounds:  +((s.rebounds  / totalMin) * 36).toFixed(1),
            assists:   +((s.assists   / totalMin) * 36).toFixed(1),
            steals:    +((s.steals    / totalMin) * 36).toFixed(1),
            blocks:    +((s.blocks    / totalMin) * 36).toFixed(1),
            turnovers: +((s.turnovers / totalMin) * 36).toFixed(1),
        };

        return {
            gamesPlayed:      gp,
            gamesStarted:     s.gamesStarted,
            minutesPerGame:   +mpg.toFixed(1),
            pointsPerGame:    +(s.points    / gp).toFixed(1),
            reboundsPerGame:  +(s.rebounds  / gp).toFixed(1),
            offensiveReboundsPerGame: +((s.offensiveRebounds || 0) / gp).toFixed(1),
            defensiveReboundsPerGame: +((s.defensiveRebounds || 0) / gp).toFixed(1),
            assistsPerGame:   +(s.assists   / gp).toFixed(1),
            stealsPerGame:    +(s.steals    / gp).toFixed(1),
            blocksPerGame:    +(s.blocks    / gp).toFixed(1),
            turnoversPerGame: +(s.turnovers / gp).toFixed(1),
            foulsPerGame:     +(s.fouls     / gp).toFixed(1),
            fieldGoalPct:     fgPct,
            threePointPct:    threePct,
            freeThrowPct:     ftPct,
            trueShootingPct:  tsPct,
            plusMinus:        s.plusMinus || 0,
            plusMinusPerGame: gp > 0 ? +((s.plusMinus || 0) / gp).toFixed(1) : 0,
            // Season totals (for leaderboards / awards)
            totalPoints:   s.points,
            totalRebounds: s.rebounds,
            totalOffensiveRebounds: s.offensiveRebounds || 0,
            totalDefensiveRebounds: s.defensiveRebounds || 0,
            totalAssists:  s.assists,
            totalSteals:   s.steals,
            totalBlocks:   s.blocks,
            totalPlusMinus: s.plusMinus || 0,
            // Shooting volume (useful context for pct evaluation)
            fgaPerGame:  +(s.fieldGoalsAttempted  / gp).toFixed(1),
            tpaPerGame:  +(s.threePointersAttempted / gp).toFixed(1),
            ftaPerGame:  +(s.freeThrowsAttempted   / gp).toFixed(1),
            // Per-36
            per36,
        };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // PLAYER ANALYTICS
    // ─────────────────────────────────────────────────────────────────────────
    // Single entry point for the roster screen and any evaluation UI.
    // Returns everything needed to assess a player's current-season value,
    // contract fit, and role suitability — all derived on demand from raw
    // season stats so no save migration is ever needed.
    //
    // @param {Object} player - Player object with seasonStats
    // @param {Object} team   - Team object (for salary cap context), optional
    // @returns {Object|null} Analytics object, or null if no games played
    //
    getPlayerAnalytics(player, team = null) {
        const avgs = this.getSeasonAverages(player);
        if (!avgs) return null;

        const s = player.seasonStats;
        const gp = avgs.gamesPlayed;

        // ── Value score (0-100) ──────────────────────────────────────────────
        // A rough composite that surfaces whether the player is producing
        // relative to their role. Not a real PER — just a useful sorting key.
        // Weights: scoring(30) + efficiency(20) + playmaking(15) +
        //          defense(15) + rebounding(10) + +/-(10)
        const scoringVal  = Math.min(30, avgs.pointsPerGame * 1.0);
        const effVal      = avgs.trueShootingPct > 0 ? Math.min(20, (avgs.trueShootingPct - 0.45) * 200) : 10;
        const makeVal     = Math.min(15, (avgs.assistsPerGame * 1.2) - (avgs.turnoversPerGame * 0.8));
        const defVal      = Math.min(15, (avgs.stealsPerGame * 3) + (avgs.blocksPerGame * 2.5));
        const rebVal      = Math.min(10, avgs.reboundsPerGame * 0.8);
        const pmVal       = Math.min(10, Math.max(-10, avgs.plusMinusPerGame * 0.8));
        const valueScore  = Math.max(0, Math.round(scoringVal + effVal + makeVal + defVal + rebVal + pmVal));

        // ── Role fit ────────────────────────────────────────────────────────
        // What role does this player's production suggest?
        const mpg = avgs.minutesPerGame;
        const role = mpg >= 30 ? (avgs.pointsPerGame >= 18 ? 'Star' : 'Starter')
                   : mpg >= 18 ? 'Rotation'
                   : mpg >= 8  ? 'Bench'
                   : 'End of Bench';

        // ── Contract value ───────────────────────────────────────────────────
        // Tier-aware: compare the player's actual salary against what the
        // *current team tier* would normally pay for their rating.
        // This correctly handles promotion/relegation — a relegated T1 player
        // earning a T1 salary while playing in T2 is flagged overpaid, and a
        // promoted T3 player on a T3 salary in T2 is flagged a great deal.
        //
        // currentTier comes from the team object (updated on promo/relegation).
        // Falls back to player.tier if no team context is provided.
        const salary = player.salary || 0;
        const currentTier = team?.tier || player.tier || 2;

        // Inline tier-appropriate market value for player.rating at currentTier.
        // Uses midpoints of TeamFactory.generateSalary ranges (deterministic).
        const r = player.rating || 60;
        let marketValue;
        if (currentTier === 1) {
            marketValue = r >= 95 ? 21_500_000
                        : r >= 90 ? 15_000_000
                        : r >= 85 ? 10_000_000
                        : r >= 80 ?  6_500_000
                        : r >= 75 ?  4_000_000
                        : r >= 70 ?  2_250_000
                        :            1_000_000;
        } else if (currentTier === 2) {
            marketValue = r >= 85 ? 1_500_000
                        : r >= 80 ? 1_000_000
                        : r >= 75 ?   650_000
                        : r >= 70 ?   400_000
                        : r >= 65 ?   250_000
                        : r >= 60 ?   160_000
                        :            100_000;
        } else {
            marketValue = r >= 75 ? 150_000
                        : r >= 70 ? 105_000
                        : r >= 65 ?  80_000
                        : r >= 60 ?  60_000
                        : r >= 55 ?  42_000
                        :            30_000;
        }

        // salaryRatio: 1.0 = exactly market rate for this tier
        //   < 0.65 → great deal (well below market)
        //   < 1.10 → good value (at or slightly below market)
        //   < 1.60 → fair (somewhat above market, acceptable)
        //   ≥ 1.60 → overpaid (significantly above market for this tier)
        let contractVerdict = null;
        if (salary > 0 && marketValue > 0) {
            const salaryRatio = salary / marketValue;
            contractVerdict = salaryRatio < 0.65 ? 'great_deal'
                            : salaryRatio < 1.10 ? 'good_value'
                            : salaryRatio < 1.60 ? 'fair'
                            : 'overpaid';
        }

        // ── Shooting breakdown ───────────────────────────────────────────────
        const shootingProfile = {
            fgPct:        avgs.fieldGoalPct,
            threePct:     avgs.threePointPct,
            ftPct:        avgs.freeThrowPct,
            tsPct:        avgs.trueShootingPct,
            threeRate:    s.fieldGoalsAttempted > 0
                            ? +(s.threePointersAttempted / s.fieldGoalsAttempted).toFixed(3)
                            : 0,
            ftRate:       s.fieldGoalsAttempted > 0
                            ? +(s.freeThrowsAttempted / s.fieldGoalsAttempted).toFixed(3)
                            : 0,
            fgaPerGame:   avgs.fgaPerGame,
            tpaPerGame:   avgs.tpaPerGame,
        };

        // ── Trend signals ────────────────────────────────────────────────────
        // Simple flags the UI can use to surface concerns without needing
        // game-by-game history.
        const flags = [];
        if (avgs.turnoversPerGame > avgs.assistsPerGame * 0.6)
            flags.push({ type: 'warning', label: 'High TO rate' });
        if (avgs.fgaPerGame >= 8 && avgs.fieldGoalPct < 0.40)
            flags.push({ type: 'warning', label: 'Poor FG%' });
        if (avgs.plusMinusPerGame < -4)
            flags.push({ type: 'warning', label: 'Negative impact' });
        if (avgs.trueShootingPct > 0.60 && avgs.pointsPerGame >= 10)
            flags.push({ type: 'positive', label: 'Efficient scorer' });
        if (avgs.plusMinusPerGame > 5)
            flags.push({ type: 'positive', label: 'High +/-' });
        if (avgs.stealsPerGame >= 1.5 || avgs.blocksPerGame >= 1.5)
            flags.push({ type: 'positive', label: 'Defensive impact' });
        if (player.contractYears === 1)
            flags.push({ type: 'info', label: 'Expiring contract' });
        if ((player.fatigue || 0) >= 60)
            flags.push({ type: 'warning', label: 'Fatigued' });

        return {
            avgs,
            per36:           avgs.per36,
            valueScore,
            role,
            contractVerdict,
            salaryRatio:     salary > 0 && marketValue > 0 ? +(salary / marketValue).toFixed(2) : null,
            shootingProfile,
            flags,
            // Convenience pass-throughs for the UI
            plusMinus:       avgs.plusMinus,
            plusMinusPerGame: avgs.plusMinusPerGame,
            gamesPlayed:     gp,
        };
    },

    archiveSeasonStats(player) {
        if (player.seasonStats && player.seasonStats.gamesPlayed > 0) {
            player.previousSeasonStats = { ...player.seasonStats };
            player.previousSeasonAverages = this.getSeasonAverages(player);
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // AWARDS CALCULATION ENGINE
    // ─────────────────────────────────────────────────────────────────────────
    // Calculates end-of-season awards for a given set of teams.
    // Call once per tier at season end.
    //
    // Awards: MVP, DPOY, ROY, Sixth Man, Most Improved, All-League (1st/2nd)
    //
    // @param {Array} teams - Array of team objects with rosters
    // @param {number} minGamesPlayed - Minimum games to qualify (default: 50% of season)
    // @param {number} tier - Tier level (for display purposes)
    // @returns {Object} Award winners
    // ─────────────────────────────────────────────────────────────────────────

    calculateAwards(teams, minGamesPlayed = 0, tier = 1) {
        // Gather all eligible players with season averages
        const allPlayers = [];
        teams.forEach(team => {
            if (!team.roster) return;
            team.roster.forEach(player => {
                if (!player.seasonStats || player.seasonStats.gamesPlayed < minGamesPlayed) return;
                const avgs = this.getSeasonAverages(player);
                if (!avgs) return;
                allPlayers.push({
                    player: player,
                    team: team,
                    avgs: avgs,
                });
            });
        });

        if (allPlayers.length === 0) {
            return { mvp: null, dpoy: null, roy: null, sixthMan: null, mostImproved: null, allLeagueFirst: [], allLeagueSecond: [] };
        }

        // ── MVP ──
        // Weighted composite: scoring, assists, rebounds, efficiency, team success
        const maxTeamWins = Math.max(...teams.map(t => t.wins || 0));
        const mvpScores = allPlayers
            .filter(p => p.avgs.gamesStarted >= p.avgs.gamesPlayed * 0.6) // Must be a starter
            .map(p => {
                const a = p.avgs;
                const teamWinPct = (p.team.wins || 0) / Math.max(1, (p.team.wins || 0) + (p.team.losses || 0));
                // Scoring: up to 30 points
                const scoringScore = Math.min(30, a.pointsPerGame * 1.0);
                // Assists: up to 15 points
                const assistScore = Math.min(15, a.assistsPerGame * 1.5);
                // Rebounds: up to 15 points
                const reboundScore = Math.min(15, a.reboundsPerGame * 1.2);
                // Efficiency (FG%): up to 10 points
                const efficiencyScore = a.fieldGoalPct * 20;
                // Team success: up to 30 points (heavily weighted — MVP must be on a good team)
                const teamScore = teamWinPct * 30;
                // Offensive talent: offRating component (up to ~7 pts for elite scorer)
                const offR = p.player.offRating || p.player.rating || 50;
                const offTalentScore = (offR - 60) * 0.18;
                // Penalty for turnovers
                const toPenalty = a.turnoversPerGame * 0.5;
                
                return {
                    ...p,
                    mvpScore: scoringScore + assistScore + reboundScore + efficiencyScore + teamScore + offTalentScore - toPenalty
                };
            })
            .sort((a, b) => b.mvpScore - a.mvpScore);

        // ── DPOY ──
        // Hybrid: defensive rating (ability) + defensive stats (production) + team defense context
        // defRating provides the core ability assessment, stats validate production,
        // team defense ensures the player contributes to actual defensive success.

        // Pre-calculate team defensive rankings for DPOY team context bonus
        const teamDefRankings = [...teams]
            .map(t => {
                if (!t.roster || t.roster.length === 0) return { team: t, avgDef: 50 };
                const avgDef = t.roster.reduce((sum, p) => sum + (p.defRating || p.rating || 50), 0) / t.roster.length;
                return { team: t, avgDef };
            })
            .sort((a, b) => b.avgDef - a.avgDef);
        const teamDefRankMap = {};
        teamDefRankings.forEach((entry, idx) => { teamDefRankMap[entry.team.id] = idx + 1; });
        const totalTeams = teams.length || 1;

        const dpoyScores = allPlayers
            .filter(p => p.avgs.gamesStarted >= p.avgs.gamesPlayed * 0.5)
            .map(p => {
                const a = p.avgs;
                const defR = p.player.defRating || p.player.rating || 50;

                // Defensive Rating component (35% weight) — the core ability
                // Scale: defRating 85 → 29.75, defRating 70 → 24.5, defRating 60 → 21.0
                const defRatingScore = defR * 0.35;

                // Defensive stats component (50% weight) — production validation
                // Blocks: up to ~22 pts for elite blocker (1.5 BPG)
                const blockScore = a.blocksPerGame * 12;
                // Steals: up to ~18 pts for elite stealer (1.5 SPG)
                const stealScore = a.stealsPerGame * 12;
                // Rebounds: up to ~12 pts for elite rebounder
                const reboundScore = a.reboundsPerGame * 0.8;

                // Team defense context (15% weight) — best defender on a top defense
                // Top-5 team → +5, bottom-5 → 0
                const teamRank = teamDefRankMap[p.team.id] || totalTeams;
                const teamDefBonus = Math.max(0, 5 * (1 - (teamRank - 1) / Math.max(1, totalTeams - 1)));

                // Minutes: must actually play significant minutes
                const minutesBonus = Math.min(3, a.minutesPerGame * 0.10);

                return {
                    ...p,
                    dpoyScore: defRatingScore + blockScore + stealScore + reboundScore + teamDefBonus + minutesBonus
                };
            })
            .sort((a, b) => b.dpoyScore - a.dpoyScore);

        // ── ROY (Rookie of the Year) ──
        // Best first-year player. In this game, "rookie" = age 19-20 in their first season
        // Since we don't track draft year yet, use age <= 21 as proxy
        const rookies = allPlayers
            .filter(p => p.player.age <= 21)
            .map(p => {
                const a = p.avgs;
                const royScore = (a.pointsPerGame * 1.0) + (a.assistsPerGame * 1.2) + 
                                 (a.reboundsPerGame * 0.8) + (a.stealsPerGame * 2) + (a.blocksPerGame * 2) +
                                 (a.minutesPerGame * 0.1);
                return { ...p, royScore };
            })
            .sort((a, b) => b.royScore - a.royScore);

        // ── Sixth Man of the Year ──
        // Best bench player (started < 40% of games played)
        const sixthManCandidates = allPlayers
            .filter(p => p.avgs.gamesStarted < p.avgs.gamesPlayed * 0.4 && p.avgs.gamesPlayed >= minGamesPlayed * 0.7)
            .map(p => {
                const a = p.avgs;
                const sixthScore = (a.pointsPerGame * 1.2) + (a.assistsPerGame * 1.5) + 
                                   (a.reboundsPerGame * 0.8) + (a.stealsPerGame * 2) + (a.blocksPerGame * 2);
                return { ...p, sixthScore };
            })
            .sort((a, b) => b.sixthScore - a.sixthScore);

        // ── Most Improved Player ──
        // Largest positive delta in composite stat score vs previous season
        const mipCandidates = allPlayers
            .filter(p => p.player.previousSeasonAverages && p.player.previousSeasonAverages.gamesPlayed >= 20)
            .map(p => {
                const curr = p.avgs;
                const prev = p.player.previousSeasonAverages;
                // Composite improvement
                const currComposite = curr.pointsPerGame + curr.assistsPerGame + curr.reboundsPerGame + 
                                      (curr.stealsPerGame * 2) + (curr.blocksPerGame * 2);
                const prevComposite = prev.pointsPerGame + prev.assistsPerGame + prev.reboundsPerGame + 
                                      (prev.stealsPerGame * 2) + (prev.blocksPerGame * 2);
                const improvement = currComposite - prevComposite;
                return { ...p, improvement, prevAvgs: prev };
            })
            .filter(p => p.improvement > 0)
            .sort((a, b) => b.improvement - a.improvement);

        // ── All-League Teams ──
        // Best 5 players by position: 2 guards (PG/SG), 2 forwards (SF/PF), 1 center (C)
        // First team: top at each position. Second team: next best.
        const allLeagueScores = allPlayers
            .filter(p => p.avgs.gamesStarted >= p.avgs.gamesPlayed * 0.5)
            .map(p => {
                const a = p.avgs;
                // Offensive production
                const offProd = (a.pointsPerGame * 1.0) + (a.assistsPerGame * 1.3) + 
                                       (a.reboundsPerGame * 1.0) + (a.stealsPerGame * 2.5) + 
                                       (a.blocksPerGame * 2.5) + (a.fieldGoalPct * 10) -
                                       (a.turnoversPerGame * 0.8);
                // Defensive talent bonus: two-way players edge out one-way scorers
                const defR = p.player.defRating || p.player.rating || 50;
                const defBonus = (defR - 60) * 0.10;
                const allLeagueScore = offProd + defBonus;
                return { ...p, allLeagueScore };
            })
            .sort((a, b) => b.allLeagueScore - a.allLeagueScore);

        const buildAllLeagueTeam = (candidates, excludeIds = new Set()) => {
            const team = { G1: null, G2: null, F1: null, F2: null, C: null };
            const used = new Set(excludeIds);
            
            const guards = candidates.filter(p => (p.player.position === 'PG' || p.player.position === 'SG') && !used.has(p.player.id));
            const forwards = candidates.filter(p => (p.player.position === 'SF' || p.player.position === 'PF') && !used.has(p.player.id));
            const centers = candidates.filter(p => p.player.position === 'C' && !used.has(p.player.id));
            
            if (guards.length >= 1) { team.G1 = guards[0]; used.add(guards[0].player.id); }
            if (guards.length >= 2) { team.G2 = guards[1]; used.add(guards[1].player.id); }
            if (forwards.length >= 1) { team.F1 = forwards[0]; used.add(forwards[0].player.id); }
            if (forwards.length >= 2) { team.F2 = forwards[1]; used.add(forwards[1].player.id); }
            if (centers.length >= 1) { team.C = centers[0]; used.add(centers[0].player.id); }
            
            return { team, usedIds: used };
        };

        const firstTeamResult = buildAllLeagueTeam(allLeagueScores);
        const secondTeamResult = buildAllLeagueTeam(allLeagueScores, firstTeamResult.usedIds);

        // ── Stat Leaders ──
        const statLeaders = {
            scoring: [...allPlayers].sort((a, b) => b.avgs.pointsPerGame - a.avgs.pointsPerGame).slice(0, 3),
            rebounds: [...allPlayers].sort((a, b) => b.avgs.reboundsPerGame - a.avgs.reboundsPerGame).slice(0, 3),
            assists: [...allPlayers].sort((a, b) => b.avgs.assistsPerGame - a.avgs.assistsPerGame).slice(0, 3),
            steals: [...allPlayers].sort((a, b) => b.avgs.stealsPerGame - a.avgs.stealsPerGame).slice(0, 3),
            blocks: [...allPlayers].sort((a, b) => b.avgs.blocksPerGame - a.avgs.blocksPerGame).slice(0, 3),
        };

        return {
            mvp: mvpScores.length > 0 ? mvpScores[0] : null,
            dpoy: dpoyScores.length > 0 ? dpoyScores[0] : null,
            roy: rookies.length > 0 ? rookies[0] : null,
            sixthMan: sixthManCandidates.length > 0 ? sixthManCandidates[0] : null,
            mostImproved: mipCandidates.length > 0 ? mipCandidates[0] : null,
            allLeagueFirst: firstTeamResult.team,
            allLeagueSecond: secondTeamResult.team,
            statLeaders: statLeaders,
        };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ALL-STAR SELECTION & GAME
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Select All-Star rosters for a tier
     * Picks 12 per conference: 2 PG, 2 SG, 2 SF, 2 PF, 2 C, 2 wildcards
     * @param {Array} teams - All teams in the tier
     * @param {number} minGames - Minimum games played to qualify
     * @param {Object} conferenceMap - { teamId: 'East'|'West' }
     * @returns {Object} { east: [...players], west: [...players], mvpFavorites: {east, west} }
     */
    selectAllStars(teams, minGames, conferenceMap) {
        const allPlayers = [];
        teams.forEach(team => {
            if (!team.roster) return;
            team.roster.forEach(player => {
                if (!player.seasonStats || player.seasonStats.gamesPlayed < minGames) return;
                const avgs = this.getSeasonAverages(player);
                if (!avgs) return;
                
                // All-Star score: balanced scoring, assists, rebounds, efficiency
                const score = (avgs.pointsPerGame * 1.0) + (avgs.assistsPerGame * 1.3) + 
                              (avgs.reboundsPerGame * 1.0) + (avgs.stealsPerGame * 2.0) + 
                              (avgs.blocksPerGame * 2.0) + (avgs.fieldGoalPct * 8) -
                              (avgs.turnoversPerGame * 0.5);
                
                const conf = conferenceMap[team.id] || 'East';
                allPlayers.push({ player, team, avgs, score, conference: conf });
            });
        });
        
        const buildRoster = (candidates, count = 12) => {
            const roster = [];
            const used = new Set();
            
            // Position slots: 2 per position
            const positionSlots = { PG: 2, SG: 2, SF: 2, PF: 2, C: 2 };
            const sorted = [...candidates].sort((a, b) => b.score - a.score);
            
            // Fill position slots first
            for (const p of sorted) {
                if (roster.length >= count - 2) break; // Leave 2 wildcard slots
                const pos = p.player.position;
                if (positionSlots[pos] > 0 && !used.has(p.player.id)) {
                    roster.push(p);
                    used.add(p.player.id);
                    positionSlots[pos]--;
                }
            }
            
            // Fill remaining with wildcards (best remaining regardless of position)
            for (const p of sorted) {
                if (roster.length >= count) break;
                if (!used.has(p.player.id)) {
                    roster.push(p);
                    used.add(p.player.id);
                }
            }
            
            return roster;
        };
        
        const eastCandidates = allPlayers.filter(p => p.conference === 'East');
        const westCandidates = allPlayers.filter(p => p.conference === 'West');
        
        const east = buildRoster(eastCandidates, 12);
        const west = buildRoster(westCandidates, 12);
        
        return {
            east: east,
            west: west,
            eastMVPFavorite: east.length > 0 ? east[0] : null,
            westMVPFavorite: west.length > 0 ? west[0] : null
        };
    },
    
    /**
     * Simulate an All-Star game between two rosters
     * Creates temporary team objects and runs through GameEngine
     * @returns {Object} Game result with box score highlights
     */
    simulateAllStarGame(eastRoster, westRoster, tierLabel) {
        // Build temporary team objects for the game engine
        const buildTeam = (roster, name, id) => {
            const players = roster.map((p, idx) => {
                // Clone player with boosted ratings for All-Star showcase
                // Clear injury/fatigue/resting so All-Star players are always available
                return {
                    ...p.player,
                    id: `allstar_${id}_${idx}`,
                    _realId: p.player.id,
                    _realTeam: p.team.name,
                    injuryStatus: 'healthy',
                    injury: null,
                    resting: false,
                    fatigue: 0
                };
            });
            
            // Calculate average rating from the roster
            const avgRating = Math.round(players.reduce((sum, p) => sum + (p.rating || 75), 0) / players.length);
            
            return {
                id: `allstar_${id}`,
                name: name,
                city: name,
                abbrev: id.toUpperCase(),
                tier: 1,
                rating: Math.min(95, avgRating + 5), // Slight boost since these are all-stars
                roster: players,
                wins: 0,
                losses: 0,
                pointDiff: 0,
                salaryCap: 100000000,
                totalSalary: 0,
                chemistry: 50
            };
        };
        
        const eastTeam = buildTeam(eastRoster, `${tierLabel} East All-Stars`, 'east');
        const westTeam = buildTeam(westRoster, `${tierLabel} West All-Stars`, 'west');
        
        // Simulate the game (All-Star games tend to be high-scoring)
        const result = GameEngine.calculateGameOutcome(eastTeam, westTeam, false);
        
        // Boost scores to feel more like an All-Star game (typically higher scoring)
        const scoreBoost = Math.floor(Math.random() * 15) + 10;
        result.homeScore += scoreBoost;
        result.awayScore += scoreBoost;
        
        // Pick game MVP (highest scorer from winning team)
        const winnerRoster = result.winner.id === eastTeam.id ? eastRoster : westRoster;
        const gameMVP = winnerRoster.length > 0 ? winnerRoster[Math.floor(Math.random() * Math.min(3, winnerRoster.length))] : null;
        
        return {
            eastScore: result.homeScore,
            westScore: result.awayScore,
            winner: result.homeScore > result.awayScore ? 'East' : 'West',
            gameMVP: gameMVP,
            eastTeam,
            westTeam
        };
    },
};

