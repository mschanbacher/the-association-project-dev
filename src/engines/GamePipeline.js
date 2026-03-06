/**
 * GamePipeline — Possession-by-possession basketball simulation
 * 
 * Clock-based: each possession consumes variable game time (8-24 sec).
 * Quarter ends when 12:00 of game clock expire, not after fixed possession count.
 * 
 * Context-aware pace:
 *   - Early quarters: normal half-court pace (14-18 sec/possession)
 *   - Fast breaks after turnovers/steals: 6-10 sec
 *   - Close game late Q4: intentional fouls → rapid possessions (4-8 sec)
 *   - Blowout Q4: winning team milks clock (20-24 sec)
 *   - End of quarter: quick shots to beat buzzer (2-5 sec)
 * 
 * Produces the same output format as StatEngine.generateGame().
 */

import { CoachEngine } from './CoachEngine.js';
import {
    POSITION_ARCHETYPES,
    getFatiguePenalty,
    buildRotation,
    calculateUsageShares,
    getChemistryModifier,
    emptyStatLine
} from './BasketballMath.js';

// ═══════════════════════════════════════════════════════════════
// GAME STATE — Clock-based
// ═══════════════════════════════════════════════════════════════

class GameClock {
    constructor(tier) {
        this.tier = tier;
        this.quarter = 1;
        this.secondsLeft = 720; // 12:00 per quarter
        this.isOvertime = false;
        this.otPeriod = 0;
    }

    get minutesLeft() { return this.secondsLeft / 60; }

    get display() {
        const min = Math.floor(this.secondsLeft / 60);
        const sec = Math.floor(this.secondsLeft % 60);
        const qLabel = this.quarter <= 4 ? `Q${this.quarter}` : `OT${this.quarter - 4}`;
        return `${qLabel} ${min}:${String(sec).padStart(2, '0')}`;
    }

    consume(seconds) {
        this.secondsLeft = Math.max(0, this.secondsLeft - seconds);
    }

    get isQuarterOver() { return this.secondsLeft <= 0; }

    startNextQuarter() {
        this.quarter++;
        this.secondsLeft = 720; // 12 min
    }

    startOvertime() {
        this.isOvertime = true;
        this.otPeriod++;
        this.quarter = 4 + this.otPeriod;
        this.secondsLeft = 300; // 5 min OT
    }
}

class PipelineGameState {
    constructor(homeTeam, awayTeam, options = {}) {
        this.homeTeam = homeTeam;
        this.awayTeam = awayTeam;
        this.isPlayoffs = options.isPlayoffs || false;
        this.tier = options.tier || homeTeam.tier || 1;

        // Score
        this.homeScore = 0;
        this.awayScore = 0;
        this.quarterScores = { home: [0, 0, 0, 0], away: [0, 0, 0, 0] };

        // Clock
        this.clock = new GameClock(this.tier);
        this.possession = 0;

        // Possession tracking
        this.offenseIsHome = Math.random() < 0.5;
        this.lastPossessionWasFastBreak = false;
        this.events = [];
        this.isComplete = false;

        // Momentum (-10 to +10, positive = home advantage)
        this.momentum = 0;
        this.homeRun = 0;
        this.awayRun = 0;

        // Player stats (accumulated per possession)
        this.homePlayerStats = {};
        this.awayPlayerStats = {};

        // Timeouts remaining
        this.homeTimeouts = 7;
        this.awayTimeouts = 7;
    }

    /** Get the score margin from home's perspective */
    get margin() { return this.homeScore - this.awayScore; }

    /** Is this a close game? (within 6 points) */
    get isClose() { return Math.abs(this.margin) <= 6; }

    /** Is this a blowout? (15+ points) */
    get isBlowout() { return Math.abs(this.margin) >= 15; }

    /** Are we in the clutch? (Q4 or OT, under 3 min, close game) */
    get isClutch() {
        return this.clock.quarter >= 4 && this.clock.secondsLeft <= 180 && this.isClose;
    }

    /** Is the losing team likely to intentionally foul? */
    get isFoulingTime() {
        return this.clock.quarter >= 4 && this.clock.secondsLeft <= 120 &&
               Math.abs(this.margin) >= 3 && Math.abs(this.margin) <= 10;
    }
}

// ═══════════════════════════════════════════════════════════════
// GAME PIPELINE
// ═══════════════════════════════════════════════════════════════

export class GamePipeline {

    // Pace constants: seconds consumed per possession type
    static PACE = {
        FAST_BREAK:     { min: 5, max: 9 },     // Transition after steal/TO
        NORMAL:         { min: 14, max: 18 },    // Standard half-court
        SLOW:           { min: 18, max: 24 },    // Running clock, milking shot clock
        FOUL_PLAY:      { min: 4, max: 8 },      // Intentional foul situations
        BUZZER:         { min: 1, max: 4 },       // End of quarter scramble
        // Tier adjustments: lower tiers play slightly slower half-court
        TIER_MODIFIER:  { 1: 0, 2: 1.0, 3: 2.0 } // Added seconds per possession
    };

    /**
     * Run an entire game and return result compatible with StatEngine.generateGame()
     */
    static resolve(homeTeam, awayTeam, options = {}) {
        const game = new PipelineGameState(homeTeam, awayTeam, options);
        const setup = GamePipeline._setupTeams(game);

        while (!game.isComplete) {
            GamePipeline._stepPossession(game, setup);
        }

        return GamePipeline._buildResult(game, setup);
    }

    /**
     * Create an interactive game for step-by-step simulation
     */
    static create(homeTeam, awayTeam, options = {}) {
        const game = new PipelineGameState(homeTeam, awayTeam, options);
        const setup = GamePipeline._setupTeams(game);

        return {
            step() {
                if (game.isComplete) return [];
                const eventsBefore = game.events.length;
                GamePipeline._stepPossession(game, setup);
                return game.events.slice(eventsBefore);
            },

            getState() {
                return {
                    homeScore: game.homeScore,
                    awayScore: game.awayScore,
                    quarter: game.clock.quarter,
                    clock: { quarter: game.clock.quarter, minutesLeft: game.clock.minutesLeft, display: game.clock.display },
                    quarterScores: game.quarterScores,
                    momentum: game.momentum,
                    homeRun: game.homeRun,
                    awayRun: game.awayRun,
                    isComplete: game.isComplete,
                    isOvertime: game.clock.isOvertime,
                    possession: game.possession,
                    offenseIsHome: game.offenseIsHome,
                    homeTimeouts: game.homeTimeouts,
                    awayTimeouts: game.awayTimeouts,
                    isClutch: game.isClutch,
                    isFoulingTime: game.isFoulingTime,
                    margin: game.margin
                };
            },

            callTimeout(side) {
                if (side === 'home' && game.homeTimeouts > 0) {
                    game.homeTimeouts--;
                    game.momentum = Math.max(-3, Math.min(3, game.momentum * 0.3));
                    game.events.push({ type: 'timeout', side: 'home', quarter: game.clock.quarter });
                    return true;
                } else if (side === 'away' && game.awayTimeouts > 0) {
                    game.awayTimeouts--;
                    game.momentum = Math.max(-3, Math.min(3, game.momentum * 0.3));
                    game.events.push({ type: 'timeout', side: 'away', quarter: game.clock.quarter });
                    return true;
                }
                return false;
            },

            getResult() { return GamePipeline._buildResult(game, setup); },
            get isComplete() { return game.isComplete; },

            finish() {
                while (!game.isComplete) {
                    GamePipeline._stepPossession(game, setup);
                }
                return GamePipeline._buildResult(game, setup);
            }
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // SETUP
    // ═══════════════════════════════════════════════════════════════

    static _setupTeams(game) {
        const homeRotation = buildRotation(game.homeTeam, getFatiguePenalty, game.isPlayoffs, CoachEngine)
            .map(e => ({ ...e, onCourt: e.isStarter, fatigue: 0, fouls: 0 }));
        const awayRotation = buildRotation(game.awayTeam, getFatiguePenalty, game.isPlayoffs, CoachEngine)
            .map(e => ({ ...e, onCourt: e.isStarter, fatigue: 0, fouls: 0 }));

        calculateUsageShares(homeRotation);
        calculateUsageShares(awayRotation);

        const homeChemistry = getChemistryModifier(game.homeTeam, game.isPlayoffs);
        const awayChemistry = getChemistryModifier(game.awayTeam, game.isPlayoffs);

        const homeCoachMods = CoachEngine.getGameModifiers(game.homeTeam);
        const awayCoachMods = CoachEngine.getGameModifiers(game.awayTeam);

        const homeCourtBonus = game.tier === 1 ? 3 : game.tier === 2 ? 2.5 : 2;

        // Team defense modifiers: opponent's roster defRating suppresses your shooting
        const homeTeamDefMod = GamePipeline._calcTeamDefenseModifier(homeRotation, game.isPlayoffs);
        const awayTeamDefMod = GamePipeline._calcTeamDefenseModifier(awayRotation, game.isPlayoffs);

        for (const entry of homeRotation) {
            game.homePlayerStats[entry.player.id] = GamePipeline._emptyStatLine(entry.player, entry.isStarter);
        }
        for (const entry of awayRotation) {
            game.awayPlayerStats[entry.player.id] = GamePipeline._emptyStatLine(entry.player, entry.isStarter);
        }

        // Plus/minus lookup maps: playerId → rotation entry (entry.onCourt is the live flag)
        game._homeOnCourt = Object.fromEntries(homeRotation.map(e => [e.player.id, e]));
        game._awayOnCourt = Object.fromEntries(awayRotation.map(e => [e.player.id, e]));

        return {
            homeRotation, awayRotation,
            homeChemistry, awayChemistry,
            homeCoachMods, awayCoachMods,
            homeCourtBonus,
            homeTeamDefMod, awayTeamDefMod
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // PACE — How much clock a possession consumes
    // ═══════════════════════════════════════════════════════════════

    static _getPossessionTime(game) {
        const tierMod = GamePipeline.PACE.TIER_MODIFIER[game.tier] || 0;
        let pace;

        // Buzzer-beater territory: under 5 seconds
        if (game.clock.secondsLeft <= 5) {
            return game.clock.secondsLeft; // Use whatever's left
        }

        // End of quarter, under 30 sec: quick shots
        if (game.clock.secondsLeft <= 30) {
            pace = GamePipeline.PACE.BUZZER;
            return GamePipeline._randRange(pace.min, Math.min(pace.max, game.clock.secondsLeft));
        }

        // Intentional foul time: trailing team fouls quickly
        if (game.isFoulingTime) {
            const offenseIsLeading = (game.offenseIsHome && game.margin > 0) || (!game.offenseIsHome && game.margin < 0);
            if (!offenseIsLeading) {
                pace = GamePipeline.PACE.FAST_BREAK;
            } else {
                pace = GamePipeline.PACE.FOUL_PLAY;
            }
            return GamePipeline._randRange(pace.min, pace.max);
        }

        // Blowout Q4: winning team runs clock
        if (game.clock.quarter >= 4 && game.isBlowout && game.clock.secondsLeft < 360) {
            const leadingHasBall = (game.offenseIsHome && game.margin > 0) || (!game.offenseIsHome && game.margin < 0);
            if (leadingHasBall) {
                pace = GamePipeline.PACE.SLOW;
                return GamePipeline._randRange(pace.min, pace.max) + tierMod;
            }
        }

        // Fast break after steal/turnover
        if (game.lastPossessionWasFastBreak) {
            game.lastPossessionWasFastBreak = false;
            pace = GamePipeline.PACE.FAST_BREAK;
            return GamePipeline._randRange(pace.min, pace.max) + tierMod * 0.5;
        }

        // Normal half-court
        pace = GamePipeline.PACE.NORMAL;
        return GamePipeline._randRange(pace.min, pace.max) + tierMod;
    }

    static _randRange(min, max) {
        return min + Math.random() * (max - min);
    }

    // ═══════════════════════════════════════════════════════════════
    // CORE — Resolve one possession
    // ═══════════════════════════════════════════════════════════════

    static _stepPossession(game, setup) {
        // Check if quarter is already over
        if (game.clock.isQuarterOver) {
            GamePipeline._handleQuarterEnd(game, setup);
            return;
        }

        const isHome = game.offenseIsHome;
        const rotation = isHome ? setup.homeRotation : setup.awayRotation;
        const defRotation = isHome ? setup.awayRotation : setup.homeRotation;
        const stats = isHome ? game.homePlayerStats : game.awayPlayerStats;
        const defStats = isHome ? game.awayPlayerStats : game.homePlayerStats;
        const chemistry = isHome ? setup.homeChemistry : setup.awayChemistry;
        const coachMods = isHome ? setup.homeCoachMods : setup.awayCoachMods;
        const defCoachMods = isHome ? setup.awayCoachMods : setup.homeCoachMods;
        const homeBonus = isHome ? setup.homeCourtBonus : 0;
        const momentumBoost = game.momentum * (isHome ? 0.15 : -0.15);
        // Opponent's team defense modifier (their roster defRating suppresses our shooting)
        const oppTeamDefMod = isHome ? setup.awayTeamDefMod : setup.homeTeamDefMod;

        // Consume clock
        const possTime = GamePipeline._getPossessionTime(game);
        game.clock.consume(possTime);

        // Pick the shooter
        const onCourt = rotation.filter(e => e.onCourt && e.minutes > 0);
        if (onCourt.length === 0) {
            game.offenseIsHome = !game.offenseIsHome;
            game.possession++;
            return;
        }

        const shooter = GamePipeline._pickShooter(onCourt);
        const shooterStats = stats[shooter.player.id];
        const archetype = POSITION_ARCHETYPES[shooter.player.position] || POSITION_ARCHETYPES['SF'];

        // Rating-based modifiers — use offensive rating for shooting calculations
        const offRatingDelta = (shooter.effectiveOffRating || shooter.effectiveRating) - 75 + homeBonus + momentumBoost;
        const ratingBonus2pt = offRatingDelta * 0.003;    // 2PT: ±0.3% per rating point
        const ratingBonus3pt = offRatingDelta * 0.0015;   // 3PT: ±0.15% per rating point
        const ratingBonusFt  = offRatingDelta * 0.002;    // FT: ±0.2% per rating point
        // Opponent defense: coaching scheme + roster defensive talent
        const defCoachImpact = (defCoachMods.defenseModifier || 0) * 0.5;
        const defenseImpact = defCoachImpact + (oppTeamDefMod || 0);
        const chemBonus = (chemistry - 1.0) * 0.03;

        // === INTENTIONAL FOUL CHECK ===
        if (game.isFoulingTime) {
            const offenseIsLeading = (isHome && game.margin > 0) || (!isHome && game.margin < 0);
            if (offenseIsLeading && Math.random() < 0.70) {
                const fouler = GamePipeline._pickDefender(defRotation);
                if (fouler) {
                    defStats[fouler.player.id].fouls++;
                    fouler.fouls++;
                }
                const ftPct = Math.min(0.95, archetype.baseFtPct + ratingBonusFt + chemBonus);
                let ftMade = 0;
                for (let i = 0; i < 2; i++) {
                    shooterStats.freeThrowsAttempted++;
                    if (Math.random() < ftPct) {
                        shooterStats.freeThrowsMade++;
                        shooterStats.points++;
                        ftMade++;
                    }
                }
                GamePipeline._addScore(game, isHome, ftMade);
                game.events.push({
                    type: 'foul_shooting', shooter: shooter.player.name,
                    fouler: fouler ? fouler.player.name : 'unknown',
                    ftMade, ftAttempted: 2, side: isHome ? 'home' : 'away',
                    quarter: game.clock.quarter, clock: game.clock.display,
                    context: 'intentional'
                });
                GamePipeline._endPossession(game, setup, ftMade > 0, isHome);
                return;
            }
        }

        const roll = Math.random();

        // === TURNOVER CHECK ===
        // NBA avg: ~13.5 TO/game (~14% of possessions). Turnovers don't scale
        // heavily with skill — even elite players average 3+ TO. Use flat tier rates
        // with minor defensive coaching impact only.
        const baseTORate = { 1: 0.135, 2: 0.14, 3: 0.145 };
        const toChance = (baseTORate[game.tier] || 0.14) + defenseImpact * 0.15;
        if (roll < Math.max(0.11, Math.min(0.16, toChance))) {
            shooterStats.turnovers++;
            game.events.push({
                type: 'turnover', player: shooter.player.name, side: isHome ? 'home' : 'away',
                quarter: game.clock.quarter, clock: game.clock.display
            });

            const stealer = GamePipeline._pickDefender(defRotation);
            if (stealer && Math.random() < 0.55) {
                defStats[stealer.player.id].steals++;
                game.events.push({
                    type: 'steal', player: stealer.player.name, side: isHome ? 'away' : 'home',
                    quarter: game.clock.quarter
                });
                game.lastPossessionWasFastBreak = true;
            }

            GamePipeline._endPossession(game, setup, false, isHome);
            return;
        }

        // === FOUL CHECK ===
        const foulRoll = Math.random();
        if (foulRoll < 0.18) {
            const fouler = GamePipeline._pickDefender(defRotation);
            if (fouler) {
                defStats[fouler.player.id].fouls++;
                fouler.fouls++;

                // Shooting foul (~52% of fouls) — generates free throws
                if (Math.random() < 0.52) {
                    const isThree = Math.random() < (archetype.threePtRate || 0.3);
                    const ftCount = isThree ? 3 : 2;
                    const ftPct = Math.min(0.95, archetype.baseFtPct + ratingBonusFt + chemBonus);
                    let ftMade = 0;
                    for (let i = 0; i < ftCount; i++) {
                        shooterStats.freeThrowsAttempted++;
                        if (Math.random() < ftPct) {
                            shooterStats.freeThrowsMade++;
                            shooterStats.points++;
                            ftMade++;
                        }
                    }
                    GamePipeline._addScore(game, isHome, ftMade);
                    game.events.push({
                        type: 'foul_shooting', shooter: shooter.player.name, fouler: fouler.player.name,
                        ftMade, ftAttempted: ftCount, side: isHome ? 'home' : 'away',
                        quarter: game.clock.quarter, clock: game.clock.display
                    });
                    GamePipeline._endPossession(game, setup, ftMade > 0, isHome);
                    return;
                }
                game.events.push({
                    type: 'foul', fouler: fouler.player.name, side: isHome ? 'away' : 'home',
                    quarter: game.clock.quarter
                });
            }
        }

        // === SHOT ATTEMPT ===
        const isThree = Math.random() < (archetype.threePtRate + (coachMods.threePtRateModifier || 0));
        const shotPct = isThree
            ? Math.max(0.20, Math.min(0.45, archetype.baseThreePct + ratingBonus3pt + chemBonus + defenseImpact))
            : Math.max(0.35, Math.min(0.62, archetype.baseFgPct + 0.04 + ratingBonus2pt + chemBonus + defenseImpact));

        shooterStats.fieldGoalsAttempted++;
        if (isThree) shooterStats.threePointersAttempted++;

        if (Math.random() < shotPct) {
            // === MADE SHOT ===
            const points = isThree ? 3 : 2;
            shooterStats.fieldGoalsMade++;
            if (isThree) shooterStats.threePointersMade++;
            shooterStats.points += points;
            GamePipeline._addScore(game, isHome, points);

            if (Math.random() < 0.60) {
                const passer = GamePipeline._pickAssister(onCourt, shooter);
                if (passer) stats[passer.player.id].assists++;
            }

            if (!isThree && Math.random() < 0.05) {
                const ftPct = Math.min(0.95, archetype.baseFtPct + ratingBonusFt);
                shooterStats.freeThrowsAttempted++;
                if (Math.random() < ftPct) {
                    shooterStats.freeThrowsMade++;
                    shooterStats.points++;
                    GamePipeline._addScore(game, isHome, 1);
                }
                game.events.push({
                    type: 'and_one', player: shooter.player.name, points: points,
                    side: isHome ? 'home' : 'away', quarter: game.clock.quarter, clock: game.clock.display
                });
            }

            game.events.push({
                type: 'made_shot', player: shooter.player.name, points: points,
                shotType: isThree ? '3pt' : '2pt', side: isHome ? 'home' : 'away',
                homeScore: game.homeScore, awayScore: game.awayScore,
                quarter: game.clock.quarter, clock: game.clock.display
            });

            GamePipeline._endPossession(game, setup, true, isHome);
        } else {
            // === MISSED SHOT ===
            game.events.push({
                type: 'missed_shot', player: shooter.player.name,
                shotType: isThree ? '3pt' : '2pt', side: isHome ? 'home' : 'away',
                quarter: game.clock.quarter, clock: game.clock.display
            });

            if (Math.random() < 0.25) {
                const rebounder = GamePipeline._pickRebounder(onCourt);
                if (rebounder) stats[rebounder.player.id].rebounds++;
            } else {
                const defOnCourt = defRotation.filter(e => e.onCourt);
                const rebounder = GamePipeline._pickRebounder(defOnCourt);
                if (rebounder) defStats[rebounder.player.id].rebounds++;
                if (Math.random() < 0.15) game.lastPossessionWasFastBreak = true;
            }

            GamePipeline._endPossession(game, setup, false, isHome);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // POSSESSION HELPERS
    // ═══════════════════════════════════════════════════════════════

    static _pickShooter(onCourt) {
        const totalUsage = onCourt.reduce((s, e) => s + (e.usageShare || 1), 0);
        let r = Math.random() * totalUsage;
        for (const entry of onCourt) {
            r -= (entry.usageShare || 1);
            if (r <= 0) return entry;
        }
        return onCourt[onCourt.length - 1];
    }

    static _pickDefender(rotation) {
        const onCourt = rotation.filter(e => e.onCourt);
        if (onCourt.length === 0) return null;
        // Weight by defensive rating — better defenders get more steals/blocks
        const weights = onCourt.map(e => {
            const defR = e.effectiveDefRating || e.effectiveRating || 70;
            const pos = e.player.position || 'SF';
            // Position weight: bigs contest more, guards steal more — both are "defending"
            const posWeight = pos === 'C' ? 1.3 : pos === 'PF' ? 1.2 : 1.0;
            return Math.max(0.5, (defR - 50) * 0.04) * posWeight;
        });
        const total = weights.reduce((s, w) => s + w, 0);
        let r = Math.random() * total;
        for (let i = 0; i < onCourt.length; i++) {
            r -= weights[i];
            if (r <= 0) return onCourt[i];
        }
        return onCourt[onCourt.length - 1];
    }

    static _pickAssister(onCourt, shooter) {
        const candidates = onCourt.filter(e => e.player.id !== shooter.player.id);
        if (candidates.length === 0) return null;
        const weights = candidates.map(e => {
            const pos = e.player.position || 'SF';
            return pos === 'PG' ? 3 : pos === 'SG' ? 1.5 : 1;
        });
        const total = weights.reduce((s, w) => s + w, 0);
        let r = Math.random() * total;
        for (let i = 0; i < candidates.length; i++) {
            r -= weights[i];
            if (r <= 0) return candidates[i];
        }
        return candidates[candidates.length - 1];
    }

    static _pickRebounder(onCourt) {
        if (onCourt.length === 0) return null;
        const weights = onCourt.map(e => {
            const pos = e.player.position || 'SF';
            const posWeight = pos === 'C' ? 4 : pos === 'PF' ? 3 : pos === 'SF' ? 1.5 : 1;
            // defRating boost for rebounding: defRating 85 → 1.12x, defRating 65 → 0.88x
            const defR = e.effectiveDefRating || e.effectiveRating || 75;
            const defBoost = 1.0 + (defR - 75) * 0.012;
            return posWeight * Math.max(0.5, defBoost);
        });
        const total = weights.reduce((s, w) => s + w, 0);
        let r = Math.random() * total;
        for (let i = 0; i < onCourt.length; i++) {
            r -= weights[i];
            if (r <= 0) return onCourt[i];
        }
        return onCourt[onCourt.length - 1];
    }

    static _addScore(game, isHome, points) {
        if (points === 0) return;
        if (isHome) {
            game.homeScore += points;
            game.homeRun += points;
            game.awayRun = 0;
            game.momentum = Math.min(10, game.momentum + points * 0.3);
        } else {
            game.awayScore += points;
            game.awayRun += points;
            game.homeRun = 0;
            game.momentum = Math.max(-10, game.momentum - points * 0.3);
        }

        // Plus/minus: players on court for the scoring team get +points, opponents get -points
        for (const [playerId, stat] of Object.entries(game.homePlayerStats)) {
            const entry = game._homeOnCourt && game._homeOnCourt[playerId];
            if (entry && entry.onCourt) {
                stat.plusMinus += isHome ? points : -points;
            }
        }
        for (const [playerId, stat] of Object.entries(game.awayPlayerStats)) {
            const entry = game._awayOnCourt && game._awayOnCourt[playerId];
            if (entry && entry.onCourt) {
                stat.plusMinus += isHome ? -points : points;
            }
        }

        const qi = Math.min(game.clock.quarter - 1, game.quarterScores.home.length - 1);
        if (qi >= 0) {
            if (isHome) game.quarterScores.home[qi] += points;
            else game.quarterScores.away[qi] += points;
        }

        const run = isHome ? game.homeRun : game.awayRun;
        if (run >= 8 && run % 4 === 0) {
            game.events.push({
                type: 'run', side: isHome ? 'home' : 'away', run: run,
                quarter: game.clock.quarter
            });
        }
    }

    static _endPossession(game, setup, scored, wasHome) {
        game.possession++;
        game.offenseIsHome = !game.offenseIsHome;

        const allOnCourt = [
            ...setup.homeRotation.filter(e => e.onCourt),
            ...setup.awayRotation.filter(e => e.onCourt)
        ];
        for (const entry of allOnCourt) {
            entry.fatigue += 0.4 + Math.random() * 0.2;
        }

        game.momentum *= 0.97;

        // Mid-quarter subs for fatigued players
        if (game.possession % 8 === 0) {
            GamePipeline._midQuarterSubs(setup.homeRotation);
            GamePipeline._midQuarterSubs(setup.awayRotation);
        }

        if (game.clock.isQuarterOver) {
            GamePipeline._handleQuarterEnd(game, setup);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // QUARTER / GAME FLOW
    // ═══════════════════════════════════════════════════════════════

    static _handleQuarterEnd(game, setup) {
        if (game.isComplete) return; // Already ended

        if (game.clock.quarter < 4) {
            game.events.push({
                type: 'quarter_end', quarter: game.clock.quarter,
                homeScore: game.homeScore, awayScore: game.awayScore
            });
            game.clock.startNextQuarter();
            GamePipeline._quarterBreakSubs(setup.homeRotation);
            GamePipeline._quarterBreakSubs(setup.awayRotation);
            game.momentum *= 0.5;
        } else if (game.clock.quarter === 4) {
            if (game.homeScore === game.awayScore) {
                game.events.push({
                    type: 'quarter_end', quarter: 4,
                    homeScore: game.homeScore, awayScore: game.awayScore
                });
                game.quarterScores.home.push(0);
                game.quarterScores.away.push(0);
                game.clock.startOvertime();
                game.events.push({ type: 'overtime', homeScore: game.homeScore, awayScore: game.awayScore });
                GamePipeline._quarterBreakSubs(setup.homeRotation);
                GamePipeline._quarterBreakSubs(setup.awayRotation);
            } else {
                game.isComplete = true;
                game.events.push({
                    type: 'game_end', homeScore: game.homeScore, awayScore: game.awayScore,
                    isOvertime: false
                });
            }
        } else {
            if (game.homeScore === game.awayScore) {
                game.quarterScores.home.push(0);
                game.quarterScores.away.push(0);
                game.clock.startOvertime();
                game.events.push({ type: 'overtime', period: game.clock.otPeriod });
            } else {
                game.isComplete = true;
                game.events.push({
                    type: 'game_end', homeScore: game.homeScore, awayScore: game.awayScore,
                    isOvertime: true
                });
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SUBSTITUTION LOGIC
    // ═══════════════════════════════════════════════════════════════

    static _midQuarterSubs(rotation) {
        const onCourt = rotation.filter(e => e.onCourt);
        const bench = rotation.filter(e => !e.onCourt && e.minutes > 0);

        for (const tired of onCourt) {
            if (tired.fatigue > 8 && bench.length > 0) {
                const sub = bench
                    .filter(b => !b.onCourt)
                    .sort((a, b) => a.fatigue - b.fatigue)[0];
                if (sub && sub.fatigue < tired.fatigue - 3) {
                    tired.onCourt = false;
                    sub.onCourt = true;
                    tired.fatigue = Math.max(0, tired.fatigue - 2);
                }
            }
        }

        GamePipeline._ensureFive(rotation);
    }

    static _quarterBreakSubs(rotation) {
        const onCourt = rotation.filter(e => e.onCourt);
        const bench = rotation.filter(e => !e.onCourt && e.minutes > 0);

        for (const tired of onCourt.sort((a, b) => b.fatigue - a.fatigue)) {
            if (tired.fatigue > 5 && bench.length > 0) {
                const sub = bench
                    .filter(b => !b.onCourt)
                    .sort((a, b) => a.fatigue - b.fatigue)[0];
                if (sub && sub.fatigue < tired.fatigue - 2) {
                    tired.onCourt = false;
                    sub.onCourt = true;
                    tired.fatigue = Math.max(0, tired.fatigue - 3);
                }
            }
        }

        for (const entry of rotation.filter(e => !e.onCourt)) {
            entry.fatigue = Math.max(0, entry.fatigue - 4);
        }

        GamePipeline._ensureFive(rotation);
    }

    static _ensureFive(rotation) {
        const currentOnCourt = rotation.filter(e => e.onCourt).length;
        if (currentOnCourt < 5) {
            const available = rotation.filter(e => !e.onCourt && e.minutes > 0)
                .sort((a, b) => b.effectiveRating - a.effectiveRating);
            for (let i = 0; i < Math.min(5 - currentOnCourt, available.length); i++) {
                available[i].onCourt = true;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // RESULT BUILDING — Compatible with StatEngine output
    // ═══════════════════════════════════════════════════════════════

    static _buildResult(game, setup) {
        const buildStats = (rotation, playerStats) => {
            return rotation.map(entry => {
                const s = playerStats[entry.player.id];
                if (!s) return GamePipeline._emptyStatLine(entry.player, entry.isStarter);

                const estMinutes = entry.isStarter
                    ? Math.round(30 + Math.random() * 8)
                    : Math.round(entry.minutes > 0 ? 10 + Math.random() * 14 : 0);

                return {
                    ...s,
                    minutesPlayed: Math.min(48, estMinutes),
                    gamesPlayed: 1,
                    gamesStarted: entry.isStarter ? 1 : 0
                };
            });
        };

        const homeStats = buildStats(setup.homeRotation, game.homePlayerStats);
        const awayStats = buildStats(setup.awayRotation, game.awayPlayerStats);

        GamePipeline._distributeBlocks(homeStats, setup.homeRotation);
        GamePipeline._distributeBlocks(awayStats, setup.awayRotation);

        const homeWon = game.homeScore > game.awayScore;

        return {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            winner: homeWon ? game.homeTeam : game.awayTeam,
            loser: homeWon ? game.awayTeam : game.homeTeam,
            homeWon: homeWon,
            pointDiff: game.homeScore - game.awayScore,
            homePlayerStats: homeStats,
            awayPlayerStats: awayStats,
            quarterScores: game.quarterScores,
            events: game.events,
            isOvertime: game.clock.isOvertime,
            momentum: game.momentum,
            totalPossessions: game.possession
        };
    }

    static _distributeBlocks(stats, rotation) {
        for (const entry of rotation) {
            const pos = entry.player.position || 'SF';
            const s = stats.find(st => st.playerId === entry.player.id);
            if (!s || s.minutesPlayed === 0) continue;
            const posRate = pos === 'C' ? 0.12 : pos === 'PF' ? 0.08 : 0.02;
            // Scale block rate by defensive rating: defRating 85 → 1.12x, defRating 65 → 0.88x
            const defR = entry.effectiveDefRating || entry.effectiveRating || 75;
            const defScale = 1.0 + (defR - 75) * 0.012;
            const blockRate = posRate * Math.max(0.5, defScale);
            const blocks = Math.floor(s.minutesPlayed * blockRate * (0.5 + Math.random()));
            s.blocks += blocks;
        }
    }

    static _calcTeamDefenseModifier(rotation, isPlayoffs) {
        const active = rotation.filter(e => e.minutes > 0);
        if (active.length === 0) return 0;
        const totalMinutes = active.reduce((sum, e) => sum + e.minutes, 0);
        const weightedDefRating = active.reduce((sum, e) =>
            sum + (e.effectiveDefRating || e.effectiveRating) * e.minutes, 0) / totalMinutes;
        let modifier = (weightedDefRating - 75) * -0.002;
        if (isPlayoffs) modifier *= 1.5;
        return modifier;
    }

    static _emptyStatLine(player, isStarter) {
        return emptyStatLine(player, isStarter);
    }
}
