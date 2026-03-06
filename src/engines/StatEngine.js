// ═══════════════════════════════════════════════════════════════════
// StatEngine — Statistics, awards, All-Star selection, box scores
// ═══════════════════════════════════════════════════════════════════
//
// Pure logic: no DOM access, no gameState references.
// Returns HTML strings for awards display but does not manipulate DOM.
//

import {
    POSITION_ARCHETYPES,
    getFatiguePenalty,
    buildRotation,
    calculateUsageShares,
    getChemistryModifier,
    emptyStatLine
} from './BasketballMath.js';
import { CoachEngine } from './CoachEngine.js';

export const StatEngine = {

    // Re-export for backward compatibility (consumers that read StatEngine.POSITION_ARCHETYPES)
    POSITION_ARCHETYPES,

    TIER_PACE: {
        1: { targetPoints: 100, variance: 8 },  // NBA: strength bonus adds ~3-5, landing ~105-112
        2: { targetPoints: 82,  variance: 9 },   // G-League: with bonus lands ~86-92
        3: { targetPoints: 68,  variance: 10 },   // Low college: with bonus lands ~70-78
    },

    // ─────────────────────────────────────────────────────────────────────────
    // MAIN ENTRY POINT
    // ─────────────────────────────────────────────────────────────────────────

    generateGame(homeTeam, awayTeam, options = {}) {
        const isPlayoffs = options.isPlayoffs || false;
        const tier = options.tier || homeTeam.tier || 1;
        const homeCourtBonus = options.homeCourtBonus !== undefined ? options.homeCourtBonus : 3;
        const getFatiguePenaltyFn = options.getFatiguePenalty || getFatiguePenalty;

        const homeRotation = buildRotation(homeTeam, getFatiguePenaltyFn, isPlayoffs, CoachEngine);
        const awayRotation = buildRotation(awayTeam, getFatiguePenaltyFn, isPlayoffs, CoachEngine);

        calculateUsageShares(homeRotation);
        calculateUsageShares(awayRotation);

        const homeChemistry = getChemistryModifier(homeTeam, isPlayoffs);
        const awayChemistry = getChemistryModifier(awayTeam, isPlayoffs);

        const homeBoost = homeCourtBonus;

        // === COACH MODIFIERS ===
        const homeCoachMods = CoachEngine.getGameModifiers(homeTeam);
        const awayCoachMods = CoachEngine.getGameModifiers(awayTeam);

        // === TEAM DEFENSE MODIFIERS ===
        // Opponent's average defensive rating suppresses your shooting percentages.
        // Centered on 75 (neutral). A team with avg defRating 82 = elite D = negative modifier.
        const homeTeamDefMod = this._calcTeamDefenseModifier(homeRotation, isPlayoffs);
        const awayTeamDefMod = this._calcTeamDefenseModifier(awayRotation, isPlayoffs);

        // === MATCHUP MODIFIERS ===
        // Compare starters head-to-head using measurables, attributes, and off vs def ratings
        const homeMatchups = this._calculateMatchupModifiers(homeRotation, awayRotation);
        const awayMatchups = this._calculateMatchupModifiers(awayRotation, homeRotation);

        // When generating home stats, opponent (away) defense suppresses home shooting
        const homeRawStats = homeRotation.map((entry, idx) =>
            this._generatePlayerGameStats(entry, tier, homeChemistry, homeBoost, isPlayoffs, homeCoachMods, awayCoachMods, homeMatchups[idx] || 0, awayTeamDefMod)
        );
        // When generating away stats, opponent (home) defense suppresses away shooting
        const awayRawStats = awayRotation.map((entry, idx) =>
            this._generatePlayerGameStats(entry, tier, awayChemistry, 0, isPlayoffs, awayCoachMods, homeCoachMods, awayMatchups[idx] || 0, homeTeamDefMod)
        );

        const pace = this.TIER_PACE[tier] || this.TIER_PACE[1];
        // Coach pace modifiers adjust target points
        const homePaceAdj = homeCoachMods.paceModifier + awayCoachMods.paceModifier * 0.3; // Opponent pace has 30% influence
        const awayPaceAdj = awayCoachMods.paceModifier + homeCoachMods.paceModifier * 0.3;
        const homePace = { targetPoints: pace.targetPoints + 3 + homePaceAdj + homeCoachMods.overallBonus + homeCoachMods.adaptabilityBonus, variance: pace.variance };
        const awayPace = { targetPoints: pace.targetPoints - 1 + awayPaceAdj + awayCoachMods.overallBonus + awayCoachMods.adaptabilityBonus, variance: pace.variance };

        const homeStats = this._normalizeTeamStats(homeRawStats, homePace, homeTeam, tier);
        const awayStats = this._normalizeTeamStats(awayRawStats, awayPace, awayTeam, tier);

        this._reconcileAssists(homeStats);
        this._reconcileAssists(awayStats);

        let homeScore = homeStats.reduce((sum, s) => sum + s.points, 0);
        let awayScore = awayStats.reduce((sum, s) => sum + s.points, 0);

        if (homeScore === awayScore) {
            const otTeam = Math.random() < 0.55 ? homeStats : awayStats;
            const starter = otTeam.find(s => s.gamesStarted > 0) || otTeam[0];
            if (starter) {
                const otPoints = 2 + Math.floor(Math.random() * 4);
                starter.points += otPoints;
                starter.fieldGoalsMade += 1;
                starter.fieldGoalsAttempted += 2;
                homeScore = homeStats.reduce((sum, s) => sum + s.points, 0);
                awayScore = awayStats.reduce((sum, s) => sum + s.points, 0);
            }
            if (homeScore === awayScore) {
                if (homeStats.length > 0) {
                    homeStats[0].points += 1;
                    homeStats[0].freeThrowsMade += 1;
                    homeStats[0].freeThrowsAttempted += 1;
                    homeScore += 1;
                } else {
                    homeScore += 1; // Force tiebreak even if stats empty
                }
            }
        }

        const homeWon = homeScore > awayScore;
        const diff = homeScore - awayScore;

        this._distributePlusMinus(homeStats, awayStats, diff);

        return {
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            homeScore: homeScore,
            awayScore: awayScore,
            winner: homeWon ? homeTeam : awayTeam,
            loser: homeWon ? awayTeam : homeTeam,
            homeWon: homeWon,
            pointDiff: diff,
            homePlayerStats: homeStats,
            awayPlayerStats: awayStats
        };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // MATCHUP MODIFIER CALCULATOR (Phase 2)
    // ─────────────────────────────────────────────────────────────────────────
    // Compares starters head-to-head using physical measurables and attributes.
    // Returns an array of modifiers (one per rotation slot, 0 for bench).
    // Starters get ±0 to ±4 based on matchup advantages.
    // Bench players get a diluted average of the team's matchup edge.

    _calculateMatchupModifiers(myRotation, theirRotation) {
        const mods = new Array(myRotation.length).fill(0);
        if (myRotation.length === 0 || theirRotation.length === 0) return mods;

        // Get starters (first 5) from each rotation
        const myStarters = myRotation.slice(0, Math.min(5, myRotation.length));
        const theirStarters = theirRotation.slice(0, Math.min(5, theirRotation.length));

        let totalStarterEdge = 0;

        for (let i = 0; i < myStarters.length; i++) {
            const me = myStarters[i];
            const them = theirStarters[i];
            if (!them) continue;

            let matchupEdge = 0;

            // --- Offense vs Defense rating comparison ---
            // My offensive ability vs their defensive ability (±2 max)
            const myOff = me.effectiveOffRating || me.effectiveRating;
            const theirDef = them.effectiveDefRating || them.effectiveRating;
            const offDefEdge = (myOff - theirDef) * 0.08;
            matchupEdge += Math.max(-2, Math.min(2, offDefEdge));

            // --- Physical measurables comparison ---
            const myM = me.player.measurables || {};
            const theirM = them.player.measurables || {};

            // Height advantage: ±1.5 max (0.12 per inch diff — slightly reduced since off/def covers more)
            const heightDiff = (myM.height || 78) - (theirM.height || 78);
            matchupEdge += Math.max(-1.5, Math.min(1.5, heightDiff * 0.12));

            // Wingspan advantage: ±1 max (0.08 per inch diff)
            const wingDiff = (myM.wingspan || 82) - (theirM.wingspan || 82);
            matchupEdge += Math.max(-1, Math.min(1, wingDiff * 0.08));

            // --- Physical attribute comparison ---
            const myA = me.player.attributes || {};
            const theirA = them.player.attributes || {};

            // Speed advantage: ±1 max (faster player gets offensive edge)
            const speedDiff = (myA.speed || 50) - (theirA.speed || 50);
            matchupEdge += Math.max(-1, Math.min(1, speedDiff * 0.015));

            // Strength advantage: ±1 max (stronger player wins boards/post)
            const strDiff = (myA.strength || 50) - (theirA.strength || 50);
            matchupEdge += Math.max(-1, Math.min(1, strDiff * 0.012));

            // Cap total per-matchup to ±5 (slightly wider than before due to off/def component)
            matchupEdge = Math.max(-5, Math.min(5, matchupEdge));

            mods[i] = matchupEdge;
            totalStarterEdge += matchupEdge;
        }

        // Bench players get a diluted version of the team's average matchup edge
        // (bench matchups are more fluid and less predictable)
        const avgEdge = myStarters.length > 0 ? (totalStarterEdge / myStarters.length) * 0.3 : 0;
        for (let i = 5; i < mods.length; i++) {
            mods[i] = avgEdge;
        }

        return mods;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // TEAM DEFENSE MODIFIER
    // ─────────────────────────────────────────────────────────────────────────
    // Calculates how a team's defensive roster quality suppresses opponent shooting.
    // Uses minutes-weighted average of effectiveDefRating across the rotation.
    // Returns a negative modifier (good defense hurts opponent FG%).
    //
    // Scale: avg defRating 75 → 0.0 (neutral)
    //        avg defRating 82 → ~-0.014 (elite D, ~1.4% FG% reduction)
    //        avg defRating 68 → ~+0.014 (poor D, 1.4% FG% boost to opponent)
    // Playoffs amplify by 1.5x (defense tightens in postseason).

    _calcTeamDefenseModifier(rotation, isPlayoffs) {
        const active = rotation.filter(e => e.minutes > 0);
        if (active.length === 0) return 0;

        const totalMinutes = active.reduce((sum, e) => sum + e.minutes, 0);
        const weightedDefRating = active.reduce((sum, e) =>
            sum + (e.effectiveDefRating || e.effectiveRating) * e.minutes, 0) / totalMinutes;

        // Center on 75 (league average), scale to shooting % impact
        // 0.002 per defRating point → ±0.014 at 7 points from average
        let modifier = (weightedDefRating - 75) * -0.002;

        // Playoffs: defense tightens
        if (isPlayoffs) modifier *= 1.5;

        return modifier;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ROTATION BUILDER — delegates to BasketballMath
    // ─────────────────────────────────────────────────────────────────────────

    _buildRotation(team, getFatiguePenaltyFn, isPlayoffs) {
        return buildRotation(team, getFatiguePenaltyFn, isPlayoffs, CoachEngine);
    },

    _calculateUsageShares(rotation) {
        return calculateUsageShares(rotation);
    },

    _getChemistryModifier(team, isPlayoffs) {
        return getChemistryModifier(team, isPlayoffs);
    },

    // ─────────────────────────────────────────────────────────────────────────
    // PER-PLAYER STAT GENERATION
    // ─────────────────────────────────────────────────────────────────────────

    _generatePlayerGameStats(entry, tier, chemModifier, homeBoost, isPlayoffs, teamCoachMods, opponentCoachMods, matchupModifier, oppTeamDefMod) {
        const { player, effectiveRating, effectiveOffRating, effectiveDefRating, minutes, isStarter, usageShare } = entry;

        if (minutes === 0) return emptyStatLine(player, isStarter);

        const position = player.position || 'SF';
        const archetype = POSITION_ARCHETYPES[position] || POSITION_ARCHETYPES['SF'];

        // === MATCHUP MODIFIER (Phase 2) ===
        // Positive = advantage against opponent, negative = disadvantage
        const matchupMod = matchupModifier || 0;

        // === CLUTCH MODIFIER (Phase 2) ===
        // In playoffs, high-clutch players get a boost, low-clutch players get penalized
        let clutchMod = 0;
        if (isPlayoffs && player.attributes) {
            const clutch = player.attributes.clutch || 50;
            // 50 = neutral, 90 = +2.0, 20 = -1.5
            clutchMod = (clutch - 50) * 0.05;
        }

        // === COACHABILITY MODIFIER (Phase 2) ===
        // Scales how much coach modifiers apply to this specific player
        // High coachability = full coach effect, low = diminished
        let coachEffectScale = 1.0;
        if (player.attributes) {
            const coachability = player.attributes.coachability || 50;
            // 50 = 1.0x (neutral), 90 = 1.3x, 20 = 0.7x
            coachEffectScale = 0.7 + (coachability / 100) * 0.6;
        }

        // Use offensive rating for scoring/shooting calculations
        const offRating = (effectiveOffRating || effectiveRating) + homeBoost + matchupMod + clutchMod;
        const offRatingDelta = offRating - 75;
        const primaryScale = 1.0 + (offRatingDelta * 0.020);
        const secondaryScale = 1.0 + (offRatingDelta * 0.008);
        const minutesFactor = minutes / 36;
        const usageMod = usageShare || 1.0;
        const chemMod = chemModifier || 1.0;

        // Coach-driven trait modifiers — scaled by individual coachability
        const cm = teamCoachMods || CoachEngine._defaultModifiers();
        const opp = opponentCoachMods || CoachEngine._defaultModifiers();
        const scaledAssistMult = 1.0 + (cm.assistMultiplier - 1.0) * coachEffectScale;
        const scaledStealBlockMult = 1.0 + (cm.stealBlockMultiplier - 1.0) * coachEffectScale;
        const scaledTOMod = 1.0 + (cm.turnoverModifier - 1.0) * coachEffectScale;
        const scaledFoulMod = 1.0 + (cm.foulModifier - 1.0) * coachEffectScale;
        const scaledThreePtMod = cm.threePtRateModifier * coachEffectScale;
        const scaledDefMod = opp.defenseModifier * coachEffectScale;

        const traitMods = {
            points: 1.0,
            rebounds: 1.0,
            assists: scaledAssistMult,
            steals: scaledStealBlockMult,
            blocks: scaledStealBlockMult
        };

        const statLine = {
            playerId: player.id,
            playerName: player.name,
            position: position,
            team: null,
            gamesPlayed: 1,
            gamesStarted: isStarter ? 1 : 0,
            minutesPlayed: minutes,
            points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0,
            turnovers: 0, fouls: 0,
            fieldGoalsMade: 0, fieldGoalsAttempted: 0,
            threePointersMade: 0, threePointersAttempted: 0,
            freeThrowsMade: 0, freeThrowsAttempted: 0,
        };

        const generateStat = (archetypeStat, traitMod) => {
            const scale = archetypeStat.primary ? primaryScale : secondaryScale;
            const base = archetypeStat.base * scale * minutesFactor * chemMod * traitMod;
            const usageEffect = archetypeStat.primary ? usageMod : (1.0 + (usageMod - 1.0) * 0.3);
            const expected = base * usageEffect;
            const variance = this._normalRandom() * 0.40;
            return Math.max(0, expected * (1 + variance));
        };

        statLine.rebounds  = Math.round(generateStat(archetype.rebounds, traitMods.rebounds));
        statLine.assists   = Math.round(generateStat(archetype.assists, traitMods.assists));
        statLine.steals    = Math.round(generateStat(archetype.steals, traitMods.steals));
        statLine.blocks    = Math.round(generateStat(archetype.blocks, traitMods.blocks));
        statLine.turnovers = Math.round(generateStat(archetype.turnovers, scaledTOMod));
        statLine.fouls     = Math.max(0, Math.min(6, Math.round(generateStat(archetype.fouls, scaledFoulMod))));

        // === DEFENSIVE RATING-BASED STAT SCALING ===
        // defRating drives blocks, steals, and defensive rebounds.
        // Attribute bonuses provide additional differentiation on top.
        const defRating = (effectiveDefRating || effectiveRating);
        const defDelta = defRating - 75;
        const defScale = 1.0 + (defDelta * 0.012); // ±1.2% per defRating point

        // Scale defensive stats by defRating
        statLine.steals = Math.max(0, Math.round(statLine.steals * defScale));
        statLine.blocks = Math.max(0, Math.round(statLine.blocks * defScale));
        // Rebounds partially defensive (contested boards) — half scaling
        statLine.rebounds = Math.max(0, Math.round(statLine.rebounds * (1.0 + defDelta * 0.006)));

        // === ATTRIBUTE BONUSES (on top of defRating scaling) ===
        if (player.attributes) {
            const a = player.attributes;
            // Verticality + Strength boost rebounds (max ±2)
            const reboundBoost = ((a.verticality || 50) - 50 + (a.strength || 50) - 50) * 0.012 * minutesFactor;
            statLine.rebounds = Math.max(0, Math.round(statLine.rebounds + reboundBoost));
            // Basketball IQ boosts assists and reduces turnovers
            const iqMod = ((a.basketballIQ || 50) - 50) * 0.01 * minutesFactor;
            statLine.assists = Math.max(0, Math.round(statLine.assists + iqMod * 1.5));
            statLine.turnovers = Math.max(0, Math.round(statLine.turnovers - iqMod * 0.8));
            // Verticality boosts blocks (additional on top of defRating scaling)
            const vertBlockBoost = ((a.verticality || 50) - 50) * 0.006 * minutesFactor;
            statLine.blocks = Math.max(0, Math.round(statLine.blocks + vertBlockBoost));
            // Speed boosts steals (additional on top of defRating scaling)
            const speedStealBoost = ((a.speed || 50) - 50) * 0.004 * minutesFactor;
            statLine.steals = Math.max(0, Math.round(statLine.steals + speedStealBoost));
        }

        // ── SHOOTING ─────────────────────────────────────────────────────────
        // If the player has a scoringProfile (all newly generated players do),
        // use it to drive shot volume, shot shape, and game-to-game variance.
        // Falls back to position-archetype behavior for old saves without a profile.
        //
        // Coach modifiers still apply — they shift tendencies on top of the profile.
        // Defense modifiers still apply — opponent D still suppresses shooting pcts.
        // Normalization (_normalizeTeamStats) is unchanged and remains the
        // calibration guardian — whatever raw totals we produce here get rescaled
        // to the TIER_PACE targets, so these changes cannot break score calibration.

        const profile = player.scoringProfile || null;

        // --- FGA volume ---
        // Profile-driven: usageTendency replaces rating-based usageMod for shot volume.
        // Variance envelope is per-player (streaky scorers swing wider).
        // Fallback: archetype fgaPer36 × old usageMod (pre-Phase2 behavior).
        const usageForShots = profile ? profile.usageTendency : usageMod;
        const varianceScale = profile ? profile.variance : 0.25;
        const fgaBase = archetype.fgaPer36 * minutesFactor * usageForShots;
        const fgaVariance = 1 + this._normalRandom() * varianceScale;
        const fga = Math.max(1, Math.round(fgaBase * fgaVariance));

        // --- Shot shape: three-point rate ---
        // Profile shotShape.three drives the split; coach 3PT modifier still shifts it.
        // Fallback: archetype.threePtRate + coach modifier.
        const baseThreePtRate = profile ? profile.shotShape.three : archetype.threePtRate;
        const adjustedThreePtRate = Math.max(0.05, Math.min(0.72, baseThreePtRate + scaledThreePtMod));
        const threePA = Math.round(fga * adjustedThreePtRate);
        const twoPA = fga - threePA;

        // --- Shooting percentages ---
        // Profile efficiency scalar applied on top of base archetype pcts.
        // Rim-heavy shot shapes improve 2PT pct; three-heavy shapes use 3P base.
        // All existing defense modifiers (coach + roster) still apply.
        const efficiencyMod = profile ? (profile.efficiency - 1.0) : 0;
        const fgPctBonus    = offRatingDelta * 0.003 + efficiencyMod * 0.5;
        const threePctBonus = offRatingDelta * 0.0015 + efficiencyMod * 0.3;
        const ftPctBonus    = offRatingDelta * 0.002  + efficiencyMod * 0.2;
        const shootingHeat  = this._normalRandom() * 0.06;

        // Opponent defense: coaching scheme + roster defensive talent (unchanged)
        const oppCoachDefPenalty  = scaledDefMod;
        const oppRosterDefPenalty = oppTeamDefMod || 0;
        const totalDefPenalty     = oppCoachDefPenalty + oppRosterDefPenalty;

        // Rim-heavy shot shapes improve 2PT efficiency (closer shots = higher FG%)
        // Three-heavy shapes don't get this bonus (long distance stays hard)
        const rimBonus = profile ? (profile.shotShape.rim - 0.30) * 0.06 : 0;

        const twoPtPct  = Math.max(0.30, Math.min(0.66, (archetype.baseFgPct + 0.04) + fgPctBonus + shootingHeat + totalDefPenalty + rimBonus));
        const threePtPct = Math.max(0.15, Math.min(0.48, archetype.baseThreePct + threePctBonus + shootingHeat + totalDefPenalty * 0.8));
        const ftPct     = Math.max(0.40, Math.min(0.95, archetype.baseFtPct + ftPctBonus + (this._normalRandom() * 0.05)));

        const twoPM   = this._binomialRoll(twoPA,   twoPtPct);
        const threePM = this._binomialRoll(threePA,  threePtPct);

        statLine.fieldGoalsMade       = twoPM + threePM;
        statLine.fieldGoalsAttempted  = fga;
        statLine.threePointersMade    = threePM;
        statLine.threePointersAttempted = threePA;

        // --- Free throws ---
        // Rim-heavy and slasher profiles draw more fouls → higher FT rate.
        // Profile derives a ftRateModifier from shotShape.rim; archetype base still anchors it.
        const ftRateMod = profile ? (profile.shotShape.rim - 0.30) * 0.20 : 0;
        const ftaBase = fga * (archetype.ftRate + ftRateMod);
        const fta = Math.max(0, Math.round(ftaBase * (1 + this._normalRandom() * 0.4)));
        const ftm = this._binomialRoll(fta, ftPct);
        statLine.freeThrowsMade       = ftm;
        statLine.freeThrowsAttempted  = fta;

        statLine.points = (twoPM * 2) + (threePM * 3) + ftm;
        return statLine;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // PLUS/MINUS DISTRIBUTION
    // ─────────────────────────────────────────────────────────────────────────
    // Assigns per-player +/- values that satisfy the hard constraint:
    //   sum(team +/-) = 5 × margin  (5 players on court at all times)
    //
    // Approach: weight each player by minutes × relative performance, distribute
    // the team's share of the margin proportionally, add calibrated noise, then
    // integer-round while enforcing the sum constraint exactly.
    //
    _distributePlusMinus(homeStats, awayStats, margin) {
        // Performance proxy: points + 0.7*ast + 0.5*reb per minute played
        // Represents the player's impact while on court relative to teammates
        const perfScore = (s) => {
            if (!s.minutesPlayed || s.minutesPlayed === 0) return 0;
            return (s.points + s.assists * 0.7 + s.rebounds * 0.5) / s.minutesPlayed;
        };

        const distribute = (stats, teamMargin) => {
            const active = stats.filter(s => s.minutesPlayed > 0);
            if (active.length === 0) return;

            // Total team-minutes is always 240 (5 players × 48 min)
            // Each player's "court share" = their minutes / 48
            // Their expected margin contribution = courtShare × teamMargin
            const avgPerf = active.reduce((sum, s) => sum + perfScore(s), 0) / active.length;

            // Raw float +/- for each active player
            const raw = active.map(s => {
                const courtShare = s.minutesPlayed / 48;
                const perfDelta = avgPerf > 0 ? (perfScore(s) - avgPerf) / avgPerf : 0;
                // Skill deviation: good players trend positive relative to team margin,
                // poor performers trend negative. Cap at ±8 to prevent outliers.
                const skillBias = Math.max(-8, Math.min(8, perfDelta * Math.abs(teamMargin) * 0.4));
                // Noise: ~±3 points, scaled by minutes (benchwarmers noisier)
                const noise = (Math.random() - 0.5) * 6 * (1 - s.minutesPlayed / 48);
                return courtShare * teamMargin + skillBias + noise;
            });

            // Integer-round while enforcing sum = 5 × teamMargin exactly
            const target = Math.round(teamMargin) * 5;
            const rounded = raw.map(v => Math.round(v));
            let remainder = target - rounded.reduce((a, b) => a + b, 0);

            // Distribute remainder by largest fractional parts (standard rounding fix)
            const fracs = raw.map((v, i) => ({ i, frac: v - Math.floor(v) }))
                .sort((a, b) => remainder > 0 ? b.frac - a.frac : a.frac - b.frac);
            for (let j = 0; j < Math.abs(remainder); j++) {
                rounded[fracs[j % fracs.length].i] += remainder > 0 ? 1 : -1;
            }

            active.forEach((s, i) => { s.plusMinus = rounded[i]; });
        };

        distribute(homeStats,  margin);   // home margin is positive when home wins
        distribute(awayStats, -margin);   // away margin is the inverse
    },

    _normalizeTeamStats(playerStats, pace, team, tier) {
        // ── Phase 3: Profile-aware FGA budget enforcement ────────────────────
        //
        // Previously each player's FGA was generated independently, causing
        // multi-star rosters to inflate total possessions. Phase 3 establishes
        // a fixed team FGA budget and redistributes shots proportionally by
        // each player's usageTendency × minute share — so the pie is shared.
        //
        // Score calibration is unchanged: the target score and strength bonus
        // math is preserved. What changes is *how* we get to that score —
        // through realistic individual FGA rather than a uniform scale factor.
        //
        // FGA budget targets (per game, pre-strength-bonus):
        //   T1: 88-92  (NBA ~88)
        //   T2: 80-86  (G-League ~82)
        //   T3: 70-76  (college ~72)
        // ─────────────────────────────────────────────────────────────────────

        const rawTotal = playerStats.reduce((sum, s) => sum + s.points, 0);
        if (rawTotal === 0) return playerStats;

        const activePlayers = playerStats.filter(s => s.minutesPlayed > 0);
        if (activePlayers.length === 0) return playerStats;

        // ── 1. Compute target score (unchanged calibration logic) ─────────────
        const teamStrength = this._quickTeamStrength(playerStats);
        const strengthDelta = teamStrength - 75;
        const strengthMult = tier === 1 ? 0.3 : tier === 2 ? 0.5 : 0.7;
        const strengthBonus = strengthDelta * strengthMult;
        const targetBase = pace.targetPoints + strengthBonus;
        const targetScore = targetBase + (Math.random() - 0.5) * pace.variance * 2;

        // ── 2. Establish team FGA budget ──────────────────────────────────────
        // Derive FGA budget from the calibrated targetScore and the team's
        // actual pts/FGA ratio from raw stats. This keeps score calibration
        // exact (same as before Phase 3) while letting Phase 3 control *how*
        // those FGA are distributed across players.
        //
        // Fallback: if raw stats are degenerate, use tier-based FGA baseline.
        const rawFGATotal = activePlayers.reduce((s, p) => s + p.fieldGoalsAttempted, 0);
        const rawPtsTotal = activePlayers.reduce((s, p) => s + p.points, 0);
        const rawFTATotal = activePlayers.reduce((s, p) => s + p.freeThrowsAttempted, 0);
        const rawFTMTotal = activePlayers.reduce((s, p) => s + p.freeThrowsMade, 0);

        // pts = FGA × ptsPerFGA (2PM×2 + 3PM×3 + FTM) / FGA
        // We want pts to equal targetScore, so: FGA = targetScore / ptsPerFGA
        const ptsPerFGA = rawFGATotal > 0 ? rawPtsTotal / rawFGATotal : 1.20;

        // Tier FGA caps: prevent runaway scores even if ptsPerFGA is low
        const fgaCap = tier === 1 ? 96 : tier === 2 ? 90 : 80;
        const fgaFloor = tier === 1 ? 78 : tier === 2 ? 72 : 62;
        const derivedFGA = ptsPerFGA > 0 ? targetScore / ptsPerFGA : 88;
        const teamFGABudget = Math.round(Math.max(fgaFloor, Math.min(fgaCap, derivedFGA)));

        // ── 3. Compute each player's usage weight ─────────────────────────────
        const totalMinutes = activePlayers.reduce((s, p) => s + p.minutesPlayed, 0);

        const weights = activePlayers.map(stat => {
            // Try to get scoringProfile from the player object if attached
            // (Stats don't carry profiles directly — use raw FGA as proxy for old saves)
            const minShare = stat.minutesPlayed / totalMinutes;
            // We use raw FGA as the usage signal because it was already shaped by
            // the profile in Phase 2 (_generatePlayerGameStats). This means
            // a floor_spacer who generated 4 raw FGA still gets a proportionally
            // small slice, and a volume_scorer who generated 18 gets a large slice.
            return { stat, weight: stat.fieldGoalsAttempted / Math.max(1, rawFGATotal), minShare };
        });

        // ── 4. Distribute FGA budget proportionally ───────────────────────────
        // Apply a minimum of 2 FGA for players with 10+ minutes (realistic floor)
        // and clamp the star's share to prevent >32% of team FGA
        const MIN_FGA_THRESHOLD_MIN = 10;
        const MIN_FGA = 2;
        const MAX_STAR_SHARE = 0.32;

        // First pass: raw proportional allocation
        let allocations = weights.map(({ stat, weight }) => ({
            stat,
            fga: teamFGABudget * weight,
        }));

        // Clamp star share
        allocations = allocations.map(a => ({
            ...a,
            fga: Math.min(a.fga, teamFGABudget * MAX_STAR_SHARE),
        }));

        // Apply minute-based minimum floor
        allocations = allocations.map(a => ({
            ...a,
            fga: a.stat.minutesPlayed >= MIN_FGA_THRESHOLD_MIN
                ? Math.max(MIN_FGA, a.fga)
                : Math.max(1, a.fga),
        }));

        // Re-normalise to hit the budget exactly after clamping/floor adjustments
        const allocSum = allocations.reduce((s, a) => s + a.fga, 0);
        const budgetScale = teamFGABudget / allocSum;
        allocations = allocations.map(a => ({
            ...a,
            fga: Math.max(1, Math.round(a.fga * budgetScale)),
        }));

        // Fix rounding drift (budget may be off by 1-2 FGA)
        let fgaDrift = teamFGABudget - allocations.reduce((s, a) => s + a.fga, 0);
        const sortedByFGA = [...allocations].sort((a, b) => b.fga - a.fga);
        let driftIdx = 0;
        while (Math.abs(fgaDrift) > 0 && driftIdx < sortedByFGA.length) {
            const target = sortedByFGA[driftIdx % sortedByFGA.length];
            const alloc = allocations.find(a => a.stat === target.stat);
            if (alloc) {
                alloc.fga += fgaDrift > 0 ? 1 : -1;
                fgaDrift += fgaDrift > 0 ? -1 : 1;
            }
            driftIdx++;
        }

        // Build a lookup map for fast access
        const fgaMap = new Map(allocations.map(a => [a.stat.playerId, a.fga]));

        // ── 5. Apply new FGA and re-roll outcomes to hit target score ─────────
        // Three-point rate and shooting pcts are preserved from raw stats.
        // We scale FTA proportionally with FGA to keep FT volume realistic.
        return playerStats.map(stat => {
            if (stat.minutesPlayed === 0) return stat;
            const scaled = { ...stat };

            const newFGA = fgaMap.get(stat.playerId) ?? Math.max(1, Math.round(stat.fieldGoalsAttempted));
            const fgaRatio = newFGA / Math.max(1, stat.fieldGoalsAttempted);

            // Preserve shot shape ratios from Phase 2 (three-point rate)
            const rawThreeRate = stat.fieldGoalsAttempted > 0
                ? stat.threePointersAttempted / stat.fieldGoalsAttempted
                : 0.35;
            const newThreePA = Math.max(0, Math.round(newFGA * rawThreeRate));
            const newTwoPA = newFGA - newThreePA;

            // FTA scales proportionally with FGA change (more/fewer possessions = more/fewer FT opps)
            const newFTA = Math.max(0, Math.round(stat.freeThrowsAttempted * fgaRatio));

            // Recover shooting pcts from raw stats
            const twoPtPctEff = (stat.fieldGoalsAttempted - stat.threePointersAttempted) > 0
                ? (stat.fieldGoalsMade - stat.threePointersMade) / (stat.fieldGoalsAttempted - stat.threePointersAttempted)
                : 0.48;
            const threePct = stat.threePointersAttempted > 0
                ? stat.threePointersMade / stat.threePointersAttempted
                : 0.33;
            const ftPct = stat.freeThrowsAttempted > 0
                ? stat.freeThrowsMade / stat.freeThrowsAttempted
                : 0.75;

            const newTwoPM   = this._binomialRoll(newTwoPA,   twoPtPctEff);
            const newThreePM = this._binomialRoll(newThreePA,  threePct);
            const newFTM     = this._binomialRoll(newFTA,      ftPct);

            scaled.fieldGoalsAttempted    = newFGA;
            scaled.threePointersAttempted = newThreePA;
            scaled.freeThrowsAttempted    = newFTA;
            scaled.fieldGoalsMade         = newTwoPM + newThreePM;
            scaled.threePointersMade      = newThreePM;
            scaled.freeThrowsMade         = newFTM;
            scaled.points = (newTwoPM * 2) + (newThreePM * 3) + newFTM;
            return scaled;
        });
    },

    _reconcileAssists(teamStats) {
        const totalFGM = teamStats.reduce((sum, s) => sum + s.fieldGoalsMade, 0);
        const totalAssists = teamStats.reduce((sum, s) => sum + s.assists, 0);
        const maxAssists = Math.floor(totalFGM * 0.65);
        if (totalAssists > maxAssists && totalAssists > 0) {
            const scaleFactor = maxAssists / totalAssists;
            teamStats.forEach(stat => {
                stat.assists = Math.max(0, Math.round(stat.assists * scaleFactor));
            });
        }
    },

    _emptyStatLine(player, isStarter) {
        return emptyStatLine(player, isStarter);
    },

    _quickTeamStrength(playerStats) {
        const activePlayers = playerStats.filter(s => s.minutesPlayed > 0);
        if (activePlayers.length === 0) return 75;
        const totalPoints = activePlayers.reduce((sum, s) => sum + s.points, 0);
        const totalMinutes = activePlayers.reduce((sum, s) => sum + s.minutesPlayed, 0);
        const ppm = totalPoints / Math.max(1, totalMinutes);
        return 50 + ppm * 80;
    },

    _normalRandom() {
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(Math.max(0.0001, u1))) * Math.cos(2 * Math.PI * u2);
        return Math.max(-2.5, Math.min(2.5, z));
    },

    _binomialRoll(attempts, probability) {
        if (attempts <= 0) return 0;
        probability = Math.max(0, Math.min(1, probability));
        if (attempts <= 20) {
            let successes = 0;
            for (let i = 0; i < attempts; i++) {
                if (Math.random() < probability) successes++;
            }
            return successes;
        } else {
            const mean = attempts * probability;
            const stddev = Math.sqrt(attempts * probability * (1 - probability));
            const result = mean + this._normalRandom() * stddev;
            return Math.max(0, Math.min(attempts, Math.round(result)));
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SEASON STATS MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    initializeSeasonStats(player) {
        player.seasonStats = {
            gamesPlayed: 0, gamesStarted: 0, minutesPlayed: 0,
            points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0,
            turnovers: 0, fouls: 0,
            fieldGoalsMade: 0, fieldGoalsAttempted: 0,
            threePointersMade: 0, threePointersAttempted: 0,
            freeThrowsMade: 0, freeThrowsAttempted: 0,
            plusMinus: 0,
        };
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

