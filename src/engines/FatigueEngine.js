// ═══════════════════════════════════════════════════════════════════
// FatigueEngine — Minutes distribution, fatigue accumulation/recovery
// ═══════════════════════════════════════════════════════════════════
//
// Pure logic: no DOM, no gameState, no UI.
// Operates on player/team objects passed as arguments.
//
// Fatigue is a per-player value (0-100) that accumulates with
// minutes played and recovers when a player sits out.
// High fatigue triggers auto-rest and rating penalties.
//

export class FatigueEngine {

    // ─────────────────────────────────────────────────────────────
    // CONSTANTS
    // ─────────────────────────────────────────────────────────────

    static BASE_FATIGUE_PER_MINUTE = 0.139; // 36 min × 0.139 ≈ 5% base fatigue
    static RECOVERY_PER_GAME = 10;          // -10% per game rested

    static DEFAULT_FATIGUE_THRESHOLD = 75;
    static PLAYOFF_THRESHOLD_BOOST = 10;
    static STAR_THRESHOLD_REDUCTION = 5;
    static STAR_RATING = 85;

    // Minutes distribution template (per rotation slot)
    static MINUTES_DISTRIBUTION = [
        { min: 32, max: 36 }, // Starter 1 (PG)
        { min: 32, max: 36 }, // Starter 2 (SG)
        { min: 30, max: 34 }, // Starter 3 (SF)
        { min: 28, max: 32 }, // Starter 4 (PF)
        { min: 26, max: 30 }, // Starter 5 (C)
        { min: 15, max: 20 }, // 6th man
        { min: 12, max: 18 }, // 7th man
        { min: 10, max: 15 }, // 8th man
        { min: 5, max: 12 },  // 9th man
        { min: 3, max: 8 },   // 10th man
        { min: 0, max: 5 },   // 11th man
        { min: 0, max: 3 },   // 12th man
        { min: 0, max: 0 },   // 13th+ (DNP)
    ];

    static TOTAL_MINUTES = 240; // 5 positions × 48 minutes


    // ─────────────────────────────────────────────────────────────
    // FATIGUE ACCUMULATION & RECOVERY
    // ─────────────────────────────────────────────────────────────

    /**
     * Accumulate fatigue based on minutes played
     * @param {Object} player
     * @param {number} minutesPlayed
     * @param {boolean} isPlayoffs
     * @param {boolean} isBackToBack
     */
    static accumulateFatigueByMinutes(player, minutesPlayed, isPlayoffs = false, isBackToBack = false) {
        if (!player.fatigue) player.fatigue = 0;

        let fatiguePerMinute = FatigueEngine.BASE_FATIGUE_PER_MINUTE;

        // Endurance modifier: 50 = neutral, 90 = 0.72x, 20 = 1.21x
        const endurance = (player.attributes && player.attributes.endurance) || 50;
        const enduranceMod = 1.0 - (endurance - 50) * 0.007;
        fatiguePerMinute *= Math.max(0.6, Math.min(1.4, enduranceMod));

        // Back-to-back: 50% more fatigue
        if (isBackToBack) fatiguePerMinute *= 1.5;

        // Playoffs: 25% more intensity
        if (isPlayoffs) fatiguePerMinute *= 1.25;

        // Playing through injury: 2x fatigue
        if (player.injuryStatus === 'day-to-day') fatiguePerMinute *= 2;

        // Age modifier
        if (player.age >= 35)      fatiguePerMinute *= 1.3;
        else if (player.age >= 33) fatiguePerMinute *= 1.2;
        else if (player.age >= 30) fatiguePerMinute *= 1.1;

        const fatigueGain = minutesPlayed * fatiguePerMinute;
        player.fatigue = Math.min(100, player.fatigue + fatigueGain);
        player.gamesRested = 0;
    }


    /**
     * Recover fatigue for a player who sat out a game
     * @param {Object} player
     */
    static recoverFatigue(player) {
        if (!player.fatigue) player.fatigue = 0;
        player.fatigue = Math.max(0, player.fatigue - FatigueEngine.RECOVERY_PER_GAME);
        player.gamesRested = (player.gamesRested || 0) + 1;
    }

    // ─────────────────────────────────────────────────────────────
    // RATING PENALTY
    // ─────────────────────────────────────────────────────────────

    /**
     * Calculate fatigue rating penalty
     * @param {number} fatigue - 0-100
     * @returns {number} Negative value (0 to -15)
     */
    static getPenalty(fatigue) {
        if (!fatigue || fatigue <= 25) return 0;
        if (fatigue <= 50) return -Math.floor((fatigue - 25) / 5);   // -2 to -5
        if (fatigue <= 75) return -5 - Math.floor((fatigue - 50) / 5); // -6 to -10
        return -10 - Math.floor((fatigue - 75) / 5);                   // -11 to -15
    }

    // ─────────────────────────────────────────────────────────────
    // AUTO-REST
    // ─────────────────────────────────────────────────────────────

    /**
     * Check if player should auto-rest due to fatigue
     * @param {Object} player
     * @param {boolean} isPlayoffs
     * @returns {boolean}
     */
    static shouldAutoRest(player, isPlayoffs = false) {
        if (!player.fatigue) return false;
        if (player.injuryStatus === 'out') return false;

        let threshold = player.fatigueThreshold || FatigueEngine.DEFAULT_FATIGUE_THRESHOLD;

        // Playoffs: raise threshold (push through more)
        if (isPlayoffs) {
            threshold = Math.min(85, threshold + FatigueEngine.PLAYOFF_THRESHOLD_BOOST);
        }

        // Stars: lower threshold (protect them)
        if (player.rating >= FatigueEngine.STAR_RATING) {
            threshold = Math.max(70, threshold - FatigueEngine.STAR_THRESHOLD_REDUCTION);
        }

        return player.fatigue >= threshold;
    }

    /**
     * Apply fatigue-based auto-rest for a team before a game
     * @param {Object} team
     * @param {boolean} isPlayoffs
     */
    static applyAutoRest(team, isPlayoffs = false) {
        if (!team.roster) return;

        let restedCount = 0;
        team.roster.forEach(player => {
            if (FatigueEngine.shouldAutoRest(player, isPlayoffs)) {
                player.resting = true;
                restedCount++;
            } else {
                player.resting = false;
            }
        });

        if (restedCount > 0) {
            console.log(`😴 ${team.name}: ${restedCount} player(s) auto-rested due to fatigue`);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // GAME-LEVEL & SEASON-LEVEL OPERATIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Process fatigue after a game for both teams
     * @param {Object} homeTeam
     * @param {Object} awayTeam
     * @param {boolean} isPlayoffs
     */
    static processAfterGame(homeTeam, awayTeam, isPlayoffs = false) {
        [homeTeam, awayTeam].forEach(team => {
            if (!team.roster) return;

            team.roster.forEach(player => {
                const minutesPlayed = player.minutesThisGame || 0;

                if (minutesPlayed > 0) {
                    FatigueEngine.accumulateFatigueByMinutes(player, minutesPlayed, isPlayoffs, false);
                } else {
                    FatigueEngine.recoverFatigue(player);
                }
            });
        });
    }

    /**
     * Reset all fatigue during off-season
     * @param {Array<Object>} teams
     */
    static resetAll(teams) {
        teams.forEach(team => {
            if (!team.roster) return;
            team.roster.forEach(player => {
                player.fatigue = 0;
                player.gamesRested = 0;
                player.resting = false;
            });
        });
    }

    // ─────────────────────────────────────────────────────────────
    // DISPLAY HELPERS
    // ─────────────────────────────────────────────────────────────

    /**
     * Get fatigue color for UI display
     * @param {number} fatigue - 0-100
     * @returns {string} CSS color
     */
    static getColor(fatigue) {
        if (!fatigue || fatigue <= 50) return '#34a853'; // Green — fresh
        if (fatigue <= 75) return '#fbbc04'; // Yellow — tired
        return '#ea4335'; // Red — exhausted
    }

    /**
     * Get fatigue description
     * @param {number} fatigue - 0-100
     * @returns {string}
     */
    static getDescription(fatigue) {
        if (!fatigue || fatigue <= 25) return 'Fresh';
        if (fatigue <= 50) return 'Tired';
        if (fatigue <= 75) return 'Fatigued';
        return 'Exhausted';
    }
}
