// ═══════════════════════════════════════════════════════════════════
// BasketballMath — Shared basketball simulation primitives
// ═══════════════════════════════════════════════════════════════════
//
// Pure functions shared by StatEngine (fast batch sim) and
// GamePipeline (possession-by-possession sim). Extracted so a future
// LiveGameEngine (Coach Mode) can reuse the same math without
// duplicating logic or reaching through window globals.
//
// No side effects, no DOM access, no game state references.
//

// ─────────────────────────────────────────────────────────────────
// POSITION ARCHETYPES
// ─────────────────────────────────────────────────────────────────
// Base stats per 36 minutes for a 75-rated player at each position.
// Primary stats scale more aggressively with rating.
// Future: player.traits will modify these.
// ─────────────────────────────────────────────────────────────────

export const POSITION_ARCHETYPES = {
    PG: {
        points:    { base: 14.0, primary: true },
        rebounds:  { base: 3.0,  primary: false },
        assists:   { base: 7.0,  primary: true },
        steals:    { base: 1.5,  primary: false },
        blocks:    { base: 0.3,  primary: false },
        turnovers: { base: 2.5,  primary: false },
        fouls:     { base: 2.0,  primary: false },
        fgaPer36:     15.0,
        threePtRate:  0.40,
        baseFgPct:    0.430,
        baseThreePct: 0.345,
        ftRate:       0.25,
        baseFtPct:    0.820,
    },
    SG: {
        points:    { base: 16.0, primary: true },
        rebounds:  { base: 3.5,  primary: false },
        assists:   { base: 3.5,  primary: false },
        steals:    { base: 1.2,  primary: false },
        blocks:    { base: 0.3,  primary: false },
        turnovers: { base: 2.0,  primary: false },
        fouls:     { base: 2.2,  primary: false },
        fgaPer36:     16.0,
        threePtRate:  0.42,
        baseFgPct:    0.435,
        baseThreePct: 0.355,
        ftRate:       0.27,
        baseFtPct:    0.810,
    },
    SF: {
        points:    { base: 14.0, primary: true },
        rebounds:  { base: 5.0,  primary: false },
        assists:   { base: 3.0,  primary: false },
        steals:    { base: 1.1,  primary: false },
        blocks:    { base: 0.5,  primary: false },
        turnovers: { base: 1.8,  primary: false },
        fouls:     { base: 2.5,  primary: false },
        fgaPer36:     14.5,
        threePtRate:  0.32,
        baseFgPct:    0.445,
        baseThreePct: 0.345,
        ftRate:       0.28,
        baseFtPct:    0.790,
    },
    PF: {
        points:    { base: 13.0, primary: true },
        rebounds:  { base: 7.5,  primary: true },
        assists:   { base: 2.0,  primary: false },
        steals:    { base: 0.8,  primary: false },
        blocks:    { base: 1.0,  primary: true },
        turnovers: { base: 1.8,  primary: false },
        fouls:     { base: 2.8,  primary: false },
        fgaPer36:     13.5,
        threePtRate:  0.22,
        baseFgPct:    0.475,
        baseThreePct: 0.330,
        ftRate:       0.30,
        baseFtPct:    0.740,
    },
    C: {
        points:    { base: 12.0, primary: true },
        rebounds:  { base: 9.5,  primary: true },
        assists:   { base: 1.5,  primary: false },
        steals:    { base: 0.5,  primary: false },
        blocks:    { base: 1.5,  primary: true },
        turnovers: { base: 1.6,  primary: false },
        fouls:     { base: 3.0,  primary: false },
        fgaPer36:     12.0,
        threePtRate:  0.10,
        baseFgPct:    0.535,
        baseThreePct: 0.305,
        ftRate:       0.32,
        baseFtPct:    0.700,
    }
};

// ─────────────────────────────────────────────────────────────────
// FATIGUE PENALTY
// ─────────────────────────────────────────────────────────────────
// Rating penalty applied to players based on accumulated fatigue.
// Moved here from FatigueEngine to eliminate the window.getFatiguePenalty
// global and make it importable by all simulation engines.
// ─────────────────────────────────────────────────────────────────

export function getFatiguePenalty(fatigue) {
    if (!fatigue || fatigue <= 25) return 0;
    if (fatigue <= 50) return -Math.floor((fatigue - 25) / 5);     // -2 to -5
    if (fatigue <= 75) return -5 - Math.floor((fatigue - 50) / 5); // -6 to -10
    return -10 - Math.floor((fatigue - 75) / 5);                   // -11 to -15
}

// ─────────────────────────────────────────────────────────────────
// ROTATION BUILDING
// ─────────────────────────────────────────────────────────────────
// Selects starters by position, assigns bench depth, distributes
// minutes using coach preferences, and normalizes to 240 total
// team minutes per game.
//
// CoachEngine is passed as a parameter to avoid circular imports.
// ─────────────────────────────────────────────────────────────────

export function buildRotation(team, getFatiguePenaltyFn, isPlayoffs, CoachEngine) {
    if (!team.roster || team.roster.length === 0) return [];

    const available = team.roster
        .filter(p => {
            if (p.injuryStatus === 'out') return false;
            if (p.resting) return false;
            return true;
        })
        .map(p => {
            let effectiveRating = p.rating;
            let effectiveOffRating = p.offRating || p.rating;
            let effectiveDefRating = p.defRating || p.rating;
            if (p.injuryStatus === 'day-to-day' && p.injury && p.injury.ratingPenalty) {
                effectiveRating += p.injury.ratingPenalty;
                effectiveOffRating += p.injury.ratingPenalty;
                effectiveDefRating += p.injury.ratingPenalty;
            }
            const fatiguePen = getFatiguePenaltyFn(p.fatigue || 0);
            effectiveRating += fatiguePen;
            effectiveOffRating += fatiguePen;
            effectiveDefRating += fatiguePen;
            effectiveRating = Math.max(50, effectiveRating);
            effectiveOffRating = Math.max(50, effectiveOffRating);
            effectiveDefRating = Math.max(50, effectiveDefRating);
            return { player: p, effectiveRating, effectiveOffRating, effectiveDefRating };
        });

    if (available.length === 0) return [];

    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const starters = [];
    const usedIds = new Set();

    positions.forEach(pos => {
        const candidates = available
            .filter(e => e.player.position === pos && !usedIds.has(e.player.id))
            .sort((a, b) => b.effectiveRating - a.effectiveRating);
        if (candidates.length > 0) {
            starters.push(candidates[0]);
            usedIds.add(candidates[0].player.id);
        } else {
            const fallback = available
                .filter(e => !usedIds.has(e.player.id))
                .sort((a, b) => b.effectiveRating - a.effectiveRating)[0];
            if (fallback) {
                starters.push(fallback);
                usedIds.add(fallback.player.id);
            }
        }
    });

    const bench = available
        .filter(e => !usedIds.has(e.player.id))
        .sort((a, b) => b.effectiveRating - a.effectiveRating);

    const rotation = [...starters, ...bench];

    // Use coach-driven minutes distribution if team has a coach
    const minutesSlots = CoachEngine.getMinutesDistribution(team.coach, isPlayoffs);

    const entries = rotation.map((entry, index) => {
        if (index >= minutesSlots.length) {
            return { ...entry, minutes: 0, isStarter: false };
        }
        const baseMinutes = minutesSlots[index];
        const variance = index < 5 ? 2 : 1;
        const minutes = Math.max(0, baseMinutes + Math.floor((Math.random() - 0.5) * 2 * variance + 0.5));
        return { ...entry, minutes, isStarter: index < 5 };
    });

    // Adjust to hit exactly 240 total minutes
    const totalAfter = entries.reduce((sum, e) => sum + e.minutes, 0);
    let diff = 240 - totalAfter;
    if (diff !== 0) {
        const adjustable = entries.filter(e => e.minutes > 0).slice(0, 8);
        let idx = 0;
        while (diff !== 0 && adjustable.length > 0) {
            if (diff > 0) {
                adjustable[idx % adjustable.length].minutes += 1;
                diff--;
            } else if (adjustable[idx % adjustable.length].minutes > 1) {
                adjustable[idx % adjustable.length].minutes -= 1;
                diff++;
            }
            idx++;
            if (idx > 100) break;
        }
    }

    return entries;
}

// ─────────────────────────────────────────────────────────────────
// USAGE SHARES
// ─────────────────────────────────────────────────────────────────
// Determines how often each player gets the ball, weighted by
// effective rating relative to the team average.
// ─────────────────────────────────────────────────────────────────

export function calculateUsageShares(rotation) {
    if (rotation.length === 0) return;
    const activePlayers = rotation.filter(e => e.minutes > 0);
    if (activePlayers.length === 0) return;

    const totalMinutes = activePlayers.reduce((sum, e) => sum + e.minutes, 0);
    const weightedAvgRating = activePlayers.reduce((sum, e) =>
        sum + e.effectiveRating * e.minutes, 0) / totalMinutes;

    activePlayers.forEach(entry => {
        const ratingDelta = entry.effectiveRating - weightedAvgRating;
        const usageRaw = 1.0 + (ratingDelta / 40);
        entry.usageShare = Math.max(0.4, Math.min(1.8, usageRaw));
    });

    rotation.filter(e => e.minutes === 0).forEach(e => { e.usageShare = 0; });
}

// ─────────────────────────────────────────────────────────────────
// CHEMISTRY MODIFIER
// ─────────────────────────────────────────────────────────────────
// Converts average team chemistry (0-100 scale, 75 = neutral) into
// a multiplicative modifier for shooting percentages.
// ─────────────────────────────────────────────────────────────────

export function getChemistryModifier(team, isPlayoffs) {
    if (!team.roster || team.roster.length === 0) return 1.0;
    const totalChem = team.roster.reduce((sum, p) => sum + (p.chemistry || 75), 0);
    const avgChem = totalChem / team.roster.length;
    let modifier = (avgChem - 75) / 500;
    if (isPlayoffs) modifier *= 2;
    return 1.0 + modifier;
}

// ─────────────────────────────────────────────────────────────────
// EMPTY STAT LINE
// ─────────────────────────────────────────────────────────────────
// Template for a player stat line with all fields zeroed out.
// ─────────────────────────────────────────────────────────────────

export function emptyStatLine(player, isStarter) {
    return {
        playerId: player.id,
        playerName: player.name,
        position: player.position || 'SF',
        team: null,
        gamesPlayed: 0,
        gamesStarted: 0,
        minutesPlayed: 0,
        points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0,
        turnovers: 0, fouls: 0,
        fieldGoalsMade: 0, fieldGoalsAttempted: 0,
        threePointersMade: 0, threePointersAttempted: 0,
        freeThrowsMade: 0, freeThrowsAttempted: 0,
        plusMinus: 0,
    };
}
