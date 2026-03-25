// ═══════════════════════════════════════════════════════════════════
// PlayerDevelopmentEngine — Player aging, rating changes, retirement
// ═══════════════════════════════════════════════════════════════════
//
// Handles offseason player development: attribute growth/decline,
// playing time modifiers, retirement probability, contract expiration.
//
// Dependencies: PlayerAttributes, CoachEngine (passed as needed)
// No direct gameState access — caller provides context.
//

export class PlayerDevelopmentEngine {

    // ─────────────────────────────────────────────────────────────
    // TIER RATING BOUNDS
    // ─────────────────────────────────────────────────────────────

    static TIER_BOUNDS = {
        1: { min: 65, max: 99 },
        2: { min: 55, max: 90 },
        3: { min: 45, max: 80 }
    };

    // ─────────────────────────────────────────────────────────────
    // PLAYING TIME MODIFIERS
    // ─────────────────────────────────────────────────────────────

    static PLAYING_TIME_TIERS = [
        { threshold: 0.8, modifier: 1.0 },   // Starter: full development
        { threshold: 0.5, modifier: 0.75 },   // Rotation: 75%
        { threshold: 0.2, modifier: 0.5 },    // Bench: 50%
        { threshold: 0.0, modifier: 0.25 }    // Rarely played: 25%
    ];

    // ─────────────────────────────────────────────────────────────
    // RATING CHANGE CALCULATION
    // ─────────────────────────────────────────────────────────────

    /**
     * Get playing time modifier for a given ratio
     * @param {number} playingTimeRatio - 0.0 to 1.0
     * @returns {number}
     */
    static getPlayingTimeModifier(playingTimeRatio) {
        for (const tier of PlayerDevelopmentEngine.PLAYING_TIME_TIERS) {
            if (playingTimeRatio >= tier.threshold) {
                return tier.modifier;
            }
        }
        return 0.25;
    }

    // ─────────────────────────────────────────────────────────────
    // RETIREMENT PROBABILITY
    // ─────────────────────────────────────────────────────────────

    /**
     * Returns probability (0-1) that a player retires this offseason.
     * @param {number} age
     * @param {number} rating
     * @param {number} tier
     * @returns {number}
     */
    static getRetirementProbability(age, rating, tier) {
        if (age < 33) return 0;

        // Base probability by age bracket
        let baseProb;
        if (age === 33)      baseProb = 0.02;
        else if (age === 34) baseProb = 0.05;
        else if (age === 35) baseProb = 0.12;
        else if (age === 36) baseProb = 0.25;
        else if (age === 37) baseProb = 0.45;
        else if (age === 38) baseProb = 0.65;
        else if (age === 39) baseProb = 0.80;
        else if (age === 40) baseProb = 0.92;
        else                 baseProb = 0.98;

        // Rating modifier
        let ratingMod;
        if (rating >= 90)      ratingMod = 0.35;
        else if (rating >= 85) ratingMod = 0.55;
        else if (rating >= 80) ratingMod = 0.70;
        else if (rating >= 75) ratingMod = 0.85;
        else if (rating >= 70) ratingMod = 1.0;
        else if (rating >= 65) ratingMod = 1.15;
        else                   ratingMod = 1.35;

        // Tier modifier
        const tierMod = tier === 1 ? 0.85 : tier === 2 ? 1.0 : 1.10;

        return Math.min(0.98, baseProb * ratingMod * tierMod);
    }

    // ─────────────────────────────────────────────────────────────
    // TEAM-LEVEL DEVELOPMENT
    // ─────────────────────────────────────────────────────────────

    /**
     * Develop all players on a team. Handles aging, rating changes,
     * retirement, and contract expiration.
     *
     * @param {Object} team - Team with roster, tier, coach, etc.
     * @param {number} maxGames - Max games in the tier's season
     * @param {Object} deps - Dependencies: { PlayerAttributes, CoachEngine }
     * @param {Object} [context] - Optional: { retirementHistory, currentSeason }
     *                              If provided, retirement records are pushed here.
     * @returns {{ developmentLog, expiredContracts, retirements }}
     */
    static developTeamPlayers(team, maxGames, deps, context = {}) {
        if (!team.roster || team.roster.length === 0) {
            return { developmentLog: [], expiredContracts: [], retirements: [] };
        }

        const { PlayerAttributes: PA, CoachEngine: CE } = deps;
        const developmentLog = [];
        const expiredContracts = [];
        const retirements = [];

        const coach = team.coach || null;

        // Process in reverse so we can splice retirees without index issues
        for (let i = team.roster.length - 1; i >= 0; i--) {
            const player = team.roster[i];
            const oldRating = player.rating;
            const gamesPlayed = player.gamesPlayed || 0;

            // Ensure player has attributes (migration for old saves)
            PA.ensureAttributes(player);

            // Calculate coach development bonus for this specific player
            const coachDevBonus = CE.getDevelopmentBonus(coach, player);

            // Apply attribute-level development
            const newRating = PA.applyDevelopment(player, coachDevBonus);

            // Apply playing time modifier to the rating change
            const playingTimeRatio = gamesPlayed / maxGames;
            const ptMod = PlayerDevelopmentEngine.getPlayingTimeModifier(playingTimeRatio);

            // Blend: mostly attribute-derived, with playing time as a dampener
            const rawChange = newRating - oldRating;
            const scaledChange = Math.round(rawChange * ptMod);
            const finalRating = oldRating + scaledChange;

            // Enforce tier bounds
            const bounds = PlayerDevelopmentEngine.TIER_BOUNDS[team.tier] || PlayerDevelopmentEngine.TIER_BOUNDS[3];
            const boundedRating = Math.max(bounds.min, Math.min(bounds.max, finalRating));

            player.rating = boundedRating;

            // Re-sync offRating and defRating from current attributes so all three
            // ratings stay consistent. applyDevelopment already wrote them from the
            // unclamped newRating; recalculate here so they match the bounded overall.
            // We scale off/def proportionally if the tier bound clamped the rating down.
            if (player.attributes && player.measurables) {
                const rawOff = PA.calculateOffRating(player.position, player.attributes, player.measurables);
                const rawDef = PA.calculateDefRating(player.position, player.attributes, player.measurables);
                if (boundedRating < finalRating && finalRating > 0) {
                    // Clamp occurred — scale off/def down proportionally
                    const scale = boundedRating / finalRating;
                    player.offRating = Math.max(bounds.min, Math.min(99, Math.round(rawOff * scale)));
                    player.defRating = Math.max(bounds.min, Math.min(99, Math.round(rawDef * scale)));
                } else {
                    player.offRating = rawOff;
                    player.defRating = rawDef;
                }
            }

            // Age the player
            player.age++;

            // Retirement check
            const retireChance = PlayerDevelopmentEngine.getRetirementProbability(player.age, boundedRating, team.tier);
            if (retireChance > 0 && Math.random() < retireChance) {
                const careerLength = player.age - (player.isCollegeGrad ? 21 : 19);
                const peakRating = player._peakRating || boundedRating;

                const retirementRecord = {
                    name: player.name,
                    position: player.position,
                    age: player.age,
                    rating: boundedRating,
                    peakRating: peakRating,
                    careerLength: careerLength,
                    tier: team.tier,
                    teamName: team.name,
                    college: player.college || null,
                    isCollegeGrad: player.isCollegeGrad || false
                };

                retirements.push(retirementRecord);

                // Push to history if provided
                if (context.retirementHistory) {
                    context.retirementHistory.push({
                        name: player.name,
                        position: player.position,
                        age: player.age,
                        peakRating: peakRating,
                        finalRating: boundedRating,
                        careerLength: careerLength,
                        lastTeam: team.name,
                        lastTier: team.tier,
                        season: context.currentSeason || 0,
                        notable: peakRating >= 88 || careerLength >= 15,
                        legendary: peakRating >= 93 || (peakRating >= 88 && careerLength >= 12)
                    });
                }

                // Remove from roster
                team.roster.splice(i, 1);
                continue;
            }

            // Track peak rating
            if (!player._peakRating || boundedRating > player._peakRating) {
                player._peakRating = boundedRating;
            }

            // NOTE: Contract expiration is now handled separately in OffseasonController.runContractExpiration()
            // which runs on Jun 30, BEFORE free agency opens. This method no longer touches contracts.

            // Log significant changes
            const ratingChange = boundedRating - oldRating;
            if (Math.abs(ratingChange) >= 2) {
                developmentLog.push({
                    name: player.name,
                    oldRating: oldRating,
                    newRating: boundedRating,
                    change: ratingChange,
                    age: player.age - 1
                });
            }
        }

        // expiredContracts is now always empty - kept for API compatibility
        return { developmentLog, expiredContracts, retirements };
    }
}
