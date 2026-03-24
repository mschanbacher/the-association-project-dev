// ═══════════════════════════════════════════════════════════════════
// TeamFactory — Player generation, salaries, contracts, rosters, schedules
// ═══════════════════════════════════════════════════════════════════
//
// Pure logic: no DOM, no gameState.
// All functions take the data they need as parameters.
//
// Dependencies (passed as needed):
//   - PlayerAttributes (for generate/generateFromRating)
//   - SalaryCapEngine (for cap/floor lookups)
//

export class TeamFactory {

    // ─────────────────────────────────────────────────────────────
    // NAME POOLS
    // ─────────────────────────────────────────────────────────────

    static FIRST_NAMES = [
        'James', 'Michael', 'Kevin', 'Chris', 'Anthony', 'Marcus', 'DeAndre', 'Brandon',
        'Jordan', 'Tyler', 'Justin', 'Isaiah', 'Xavier', 'Malik', 'Darius', 'Jaylen',
        'Trey', 'Jamal', 'Andre', 'Derrick', 'Kyle', 'Kobe', 'LeBron', 'Stephen',
        'Damian', 'Russell', 'Kawhi', 'Paul', 'Devin', 'Donovan', 'Zach', 'DeMar',
        'Jimmy', 'Kemba', 'John', 'Bradley', 'Tobias', 'Khris', 'CJ', 'Victor',
        'Kristaps', 'Nikola', 'Luka', 'Giannis', 'Joel', 'Karl-Anthony', 'Ben',
        'Trae', 'Ja', 'Zion', 'RJ', 'Cam', 'Collin', 'Shai', 'Bam', 'Pascal'
    ];

    static LAST_NAMES = [
        'Williams', 'Johnson', 'Brown', 'Jones', 'Davis', 'Wilson', 'Moore',
        'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson',
        'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker',
        'Hall', 'Allen', 'Young', 'King', 'Wright', 'Lopez', 'Hill', 'Scott', 'Green',
        'Adams', 'Baker', 'Nelson', 'Carter', 'Mitchell', 'Perez', 'Roberts', 'Turner',
        'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart',
        'Morris', 'Rogers', 'Reed', 'Cook', 'Morgan', 'Bell', 'Murphy', 'Bailey'
    ];

    static POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

    static COLLEGE_NAMES = [
        'Duke', 'Kentucky', 'North Carolina', 'Kansas', 'UCLA', 'Michigan State', 'Villanova',
        'Gonzaga', 'Virginia', 'Arizona', 'Ohio State', 'Louisville', 'Syracuse', 'Indiana',
        'Texas', 'Florida', 'Michigan', 'Georgetown', 'UConn', 'Tennessee', 'Baylor',
        'Creighton', 'Auburn', 'Purdue', 'Houston', 'Alabama', 'Illinois', 'Iowa State',
        'Memphis', 'San Diego State', 'Oregon', 'Maryland', 'Wisconsin', 'Arkansas',
        'Providence', 'Marquette', 'Xavier', 'Butler', 'VCU', 'Wichita State',
        'Rutgers', 'Nebraska', 'USC', 'Stanford', 'Wake Forest', 'Clemson', 'NC State',
        'Murray State', 'Saint Louis', 'Davidson', 'Dayton', 'Loyola Chicago'
    ];

    // ─────────────────────────────────────────────────────────────
    // SCORING PROFILES
    // ─────────────────────────────────────────────────────────────
    //
    // Every player gets a scoringProfile at birth that describes HOW
    // they score, not just how much. This is permanent — a relegated
    // T1 player keeps their T1 profile in T2, which is intentional
    // and realistic (better players play differently).
    //
    // Structure:
    //   archetype      — named type for display and downstream logic
    //   usageTendency  — 0.4–1.8, replaces rating-only usageShare
    //   shotShape      — { rim, midrange, three } summing to 1.0
    //   variance       — 0.0–0.5, game-to-game streakiness
    //   efficiency     — scalar on base shooting pcts (0.88–1.12)
    //
    // Tier gradient: position-less archetypes (versatile_scorer,
    // three_point_shooter, floor_spacer) skew toward T1. Traditional
    // archetypes (post_scorer, rim_runner) dominate T3. T1 is still
    // mostly conventional — roughly 20-25% of T1 players get a
    // "modern" archetype. The rest span the realistic range.
    // ─────────────────────────────────────────────────────────────

    // Base archetype definitions — shot shapes and usage ranges.
    // usageRange: [min, max] randomised at generation.
    // varianceRange: [min, max] randomised, then age-adjusted.
    // efficiency: [min, max] randomised.
    static SCORING_ARCHETYPES = {
        rim_runner: {
            label: 'Rim Runner',
            shotShape: { rim: 0.74, midrange: 0.10, three: 0.16 },
            usageRange:    [0.70, 1.10],
            varianceRange: [0.12, 0.28],
            efficiencyRange: [1.00, 1.10],  // high FG% at rim
        },
        post_scorer: {
            label: 'Post Scorer',
            shotShape: { rim: 0.52, midrange: 0.38, three: 0.10 },
            usageRange:    [0.85, 1.30],
            varianceRange: [0.15, 0.32],
            efficiencyRange: [0.95, 1.06],
        },
        midrange_artist: {
            label: 'Midrange Artist',
            shotShape: { rim: 0.20, midrange: 0.54, three: 0.26 },
            usageRange:    [0.80, 1.25],
            varianceRange: [0.18, 0.38],  // midrange is streaky
            efficiencyRange: [0.92, 1.04],
        },
        three_point_shooter: {
            label: 'Three-Point Shooter',
            shotShape: { rim: 0.14, midrange: 0.14, three: 0.72 },
            usageRange:    [0.55, 0.90],
            varianceRange: [0.20, 0.42],  // hot/cold nights
            efficiencyRange: [0.96, 1.08],
        },
        volume_scorer: {
            label: 'Volume Scorer',
            shotShape: { rim: 0.34, midrange: 0.24, three: 0.42 },
            usageRange:    [1.15, 1.70],
            varianceRange: [0.20, 0.40],
            efficiencyRange: [0.88, 1.00],  // high volume, not always efficient
        },
        slasher: {
            label: 'Slasher',
            shotShape: { rim: 0.60, midrange: 0.14, three: 0.26 },
            usageRange:    [0.80, 1.20],
            varianceRange: [0.14, 0.30],
            efficiencyRange: [0.98, 1.08],  // gets to line
        },
        versatile_scorer: {
            label: 'Versatile Scorer',
            shotShape: { rim: 0.28, midrange: 0.20, three: 0.52 },
            usageRange:    [1.10, 1.65],
            varianceRange: [0.16, 0.34],
            efficiencyRange: [0.96, 1.08],  // the position-less archetype
        },
        facilitator: {
            label: 'Facilitator',
            shotShape: { rim: 0.26, midrange: 0.20, three: 0.54 },
            usageRange:    [0.45, 0.75],
            varianceRange: [0.10, 0.24],  // low usage = consistent
            efficiencyRange: [0.94, 1.04],
        },
        floor_spacer: {
            label: 'Floor Spacer',
            shotShape: { rim: 0.08, midrange: 0.10, three: 0.82 },
            usageRange:    [0.40, 0.65],
            varianceRange: [0.22, 0.46],  // binary: hot or not
            efficiencyRange: [0.96, 1.10],
        },
    };

    // Probability weights for each archetype by position and tier.
    // Format: [T1_weight, T2_weight, T3_weight]
    // Higher = more likely to be selected. Weights are relative (normalised).
    //
    // Design intent:
    //  - post_scorer fades from T1 to T3 (extinct at top, common at bottom)
    //  - three_point_shooter / floor_spacer skew T1 (modern game)
    //  - versatile_scorer is the rarest but exists in T1
    //  - rim_runner and slasher are evergreen across all tiers
    //  - facilitator is consistent (every tier has passers who don't shoot much)
    static ARCHETYPE_WEIGHTS = {
        PG: {
            rim_runner:          [4,  5,  5],
            post_scorer:         [0,  1,  3],
            midrange_artist:     [4,  7,  9],
            three_point_shooter: [12, 10,  7],
            volume_scorer:       [10,  9,  8],
            slasher:             [10,  9,  8],
            versatile_scorer:    [12,  6,  2],
            facilitator:         [20, 20, 22],
            floor_spacer:        [4,  3,  1],
        },
        SG: {
            rim_runner:          [5,  6,  7],
            post_scorer:         [1,  3,  6],
            midrange_artist:     [6,  9, 12],
            three_point_shooter: [16, 13, 10],
            volume_scorer:       [14, 13, 12],
            slasher:             [12, 11, 10],
            versatile_scorer:    [12,  6,  2],
            facilitator:         [8,  9, 10],
            floor_spacer:        [8,  6,  3],
        },
        SF: {
            rim_runner:          [8,  9, 10],
            post_scorer:         [3,  6, 10],
            midrange_artist:     [7, 10, 13],
            three_point_shooter: [12, 10,  7],
            volume_scorer:       [12, 11, 10],
            slasher:             [12, 11, 10],
            versatile_scorer:    [14,  7,  2],
            facilitator:         [10, 10, 11],
            floor_spacer:        [6,  4,  2],
        },
        PF: {
            rim_runner:          [14, 14, 14],
            post_scorer:         [8, 14, 22],
            midrange_artist:     [8, 10, 12],
            three_point_shooter: [10,  7,  4],
            volume_scorer:       [10,  9,  8],
            slasher:             [12, 11, 10],
            versatile_scorer:    [12,  5,  1],
            facilitator:         [12, 12, 12],
            floor_spacer:        [6,  4,  2],
        },
        C: {
            rim_runner:          [22, 22, 20],
            post_scorer:         [14, 20, 28],
            midrange_artist:     [5,  8, 10],
            three_point_shooter: [6,  4,  2],
            volume_scorer:       [8,  8,  8],
            slasher:             [10, 10, 10],
            versatile_scorer:    [8,  3,  1],
            facilitator:         [14, 14, 14],
            floor_spacer:        [2,  1,  0],
        },
    };

    /**
     * Generate a scoring profile for a player.
     *
     * @param {string} position  - PG / SG / SF / PF / C
     * @param {number} tier      - 1 / 2 / 3 (birth tier, not current)
     * @param {number} age       - affects variance (young = streakier)
     * @param {number} rating    - affects efficiency range and usage ceiling
     * @returns {Object} scoringProfile
     */
    static generateScoringProfile(position, tier, age, rating) {
        const pos = position || 'SF';
        const tierIdx = Math.min(2, Math.max(0, (tier || 3) - 1));  // 0=T1, 1=T2, 2=T3

        // --- Select archetype via weighted random ---
        const weights = TeamFactory.ARCHETYPE_WEIGHTS[pos] ||
                        TeamFactory.ARCHETYPE_WEIGHTS['SF'];
        const total = Object.values(weights).reduce((s, w) => s + w[tierIdx], 0);
        let roll = Math.random() * total;
        let archetype = 'volume_scorer';
        for (const [key, w] of Object.entries(weights)) {
            roll -= w[tierIdx];
            if (roll <= 0) { archetype = key; break; }
        }

        const def = TeamFactory.SCORING_ARCHETYPES[archetype];

        // --- Shot shape: small random perturbation so no two players
        //     are identical even with the same archetype ---
        const jitter = () => (Math.random() - 0.5) * 0.08;
        const rimRaw      = Math.max(0.04, def.shotShape.rim      + jitter());
        const midrangeRaw = Math.max(0.04, def.shotShape.midrange + jitter());
        const threeRaw    = Math.max(0.04, def.shotShape.three    + jitter());
        const total3 = rimRaw + midrangeRaw + threeRaw;
        const shotShape = {
            rim:      +( rimRaw      / total3).toFixed(3),
            midrange: +( midrangeRaw / total3).toFixed(3),
            three:    +( threeRaw    / total3).toFixed(3),
        };
        // Force exactly 1.0 to avoid floating-point drift
        shotShape.three = +(1 - shotShape.rim - shotShape.midrange).toFixed(3);

        // --- Usage tendency ---
        const [uMin, uMax] = def.usageRange;
        // High-rated players trend toward the upper half of their range
        const ratingBias = Math.max(0, Math.min(1, (rating - 60) / 35));
        const usageBase = uMin + (uMax - uMin) * (0.3 + ratingBias * 0.5 + Math.random() * 0.2);
        const usageTendency = +Math.max(0.40, Math.min(1.80, usageBase)).toFixed(3);

        // --- Variance: young players are streakier ---
        const [vMin, vMax] = def.varianceRange;
        const ageVarianceMod = age <= 22 ? 0.06 : age >= 32 ? -0.04 : 0;
        const variance = +Math.max(0.08, Math.min(0.50,
            vMin + Math.random() * (vMax - vMin) + ageVarianceMod
        )).toFixed(3);

        // --- Efficiency: high-rated players skew toward upper range ---
        const [eMin, eMax] = def.efficiencyRange;
        const efficiencyBias = Math.max(0, Math.min(1, (rating - 60) / 35));
        const efficiency = +( eMin + (eMax - eMin) * (0.2 + efficiencyBias * 0.6 + Math.random() * 0.2)).toFixed(3);

        return {
            archetype,
            label: def.label,
            usageTendency,
            shotShape,
            variance,
            efficiency,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // EMPTY SEASON STATS
    // ─────────────────────────────────────────────────────────────

    static emptySeasonStats() {
        return {
            gamesPlayed: 0, gamesStarted: 0, minutesPlayed: 0,
            points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0,
            turnovers: 0, fouls: 0,
            fieldGoalsMade: 0, fieldGoalsAttempted: 0,
            threePointersMade: 0, threePointersAttempted: 0,
            freeThrowsMade: 0, freeThrowsAttempted: 0,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // RANDOM HELPERS
    // ─────────────────────────────────────────────────────────────

    static randomFirst() {
        return TeamFactory.FIRST_NAMES[Math.floor(Math.random() * TeamFactory.FIRST_NAMES.length)];
    }

    static randomLast() {
        return TeamFactory.LAST_NAMES[Math.floor(Math.random() * TeamFactory.LAST_NAMES.length)];
    }

    static randomPosition() {
        return TeamFactory.POSITIONS[Math.floor(Math.random() * TeamFactory.POSITIONS.length)];
    }

    static randomCollege() {
        return TeamFactory.COLLEGE_NAMES[Math.floor(Math.random() * TeamFactory.COLLEGE_NAMES.length)];
    }

    // ─────────────────────────────────────────────────────────────
    // CONTRACT LENGTH
    // ─────────────────────────────────────────────────────────────

    /**
     * Determine contract length based on player age and rating.
     * @param {number} age
     * @param {number} rating
     * @returns {number}
     */
    static determineContractLength(age, rating) {
        if (age <= 25 && rating >= 75)
            return Math.floor(3 + Math.random() * 2); // 3-4
        if (age <= 29 && rating >= 70)
            return Math.floor(2 + Math.random() * 3); // 2-4
        if (age >= 30)
            return Math.floor(1 + Math.random() * 2); // 1-2
        if (rating >= 60)
            return Math.floor(2 + Math.random() * 2); // 2-3
        return Math.floor(1 + Math.random() * 2);     // 1-2
    }

    // ─────────────────────────────────────────────────────────────
    // SALARY GENERATION
    // ─────────────────────────────────────────────────────────────

    /**
     * Generate salary based on player rating and tier.
     * @param {number} rating
     * @param {number} tier - 1, 2, or 3
     * @returns {number}
     */
    static generateSalary(rating, tier = 2) {
        if (tier === 1) {
            if (rating >= 95) return Math.floor(18000000 + Math.random() * 7000000);
            if (rating >= 90) return Math.floor(12000000 + Math.random() * 6000000);
            if (rating >= 85) return Math.floor(8000000 + Math.random() * 4000000);
            if (rating >= 80) return Math.floor(5000000 + Math.random() * 3000000);
            if (rating >= 75) return Math.floor(3000000 + Math.random() * 2000000);
            if (rating >= 70) return Math.floor(1500000 + Math.random() * 1500000);
            return Math.floor(500000 + Math.random() * 1000000);
        }

        if (tier === 2) {
            if (rating >= 85) return Math.floor(1200000 + Math.random() * 600000);
            if (rating >= 80) return Math.floor(800000 + Math.random() * 400000);
            if (rating >= 75) return Math.floor(500000 + Math.random() * 300000);
            if (rating >= 70) return Math.floor(300000 + Math.random() * 200000);
            if (rating >= 65) return Math.floor(200000 + Math.random() * 100000);
            if (rating >= 60) return Math.floor(120000 + Math.random() * 80000);
            return Math.floor(80000 + Math.random() * 40000);
        }

        // Tier 3
        if (rating >= 75) return Math.floor(120000 + Math.random() * 60000);
        if (rating >= 70) return Math.floor(90000 + Math.random() * 30000);
        if (rating >= 65) return Math.floor(70000 + Math.random() * 20000);
        if (rating >= 60) return Math.floor(50000 + Math.random() * 20000);
        if (rating >= 55) return Math.floor(35000 + Math.random() * 15000);
        return Math.floor(25000 + Math.random() * 10000);
    }

    // ─────────────────────────────────────────────────────────────
    // NATURAL TIER & MARKET VALUE
    // ─────────────────────────────────────────────────────────────

    /** Highest tier a player is qualified for. */
    static getPlayerNaturalTier(player) {
        if (player.rating >= 70) return 1;
        if (player.rating >= 60) return 2;
        return 3;
    }

    /**
     * Get market value for a player at a specific tier's pay scale.
     * Caches result on the player object for consistency within a session.
     */
    static getMarketValue(player, tier) {
        if (!player._marketValueCache) player._marketValueCache = {};
        if (player._marketValueCache[tier] !== undefined) {
            return player._marketValueCache[tier];
        }
        const value = TeamFactory.generateSalary(player.rating, tier);
        player._marketValueCache[tier] = value;
        return value;
    }

    /** Get market value at the player's natural (highest) tier. */
    static getNaturalMarketValue(player) {
        return TeamFactory.getMarketValue(player, TeamFactory.getPlayerNaturalTier(player));
    }

    /** Clear cached market values (call at start of each FA window). */
    static clearMarketValueCache(players) {
        if (!players) return;
        players.forEach(p => { delete p._marketValueCache; });
    }

    // ─────────────────────────────────────────────────────────────
    // PLAYER GENERATION
    // ─────────────────────────────────────────────────────────────

    /**
     * Generate a random player.
     * @param {number} tier
     * @param {number} playerId
     * @param {Object} deps - { PlayerAttributes }
     * @returns {Object} Player object
     */
    static generatePlayer(tier, playerId, deps) {
        const { PlayerAttributes: PA } = deps;
        const firstName = TeamFactory.randomFirst();
        const lastName = TeamFactory.randomLast();
        const position = TeamFactory.randomPosition();
        const age = Math.floor(19 + Math.random() * 16);

        const { measurables, attributes, rating, offRating, defRating } = PA.generate(position, tier, age);
        const salary = TeamFactory.generateSalary(rating, tier);
        const contractYears = TeamFactory.determineContractLength(age, rating);
        const enduranceThreshold = Math.max(60, Math.min(90, 65 + Math.round((attributes.endurance - 50) * 0.4)));
        const scoringProfile = TeamFactory.generateScoringProfile(position, tier, age, rating);

        return {
            id: playerId,
            name: `${firstName} ${lastName}`,
            position, rating, offRating, defRating, age, tier, salary,
            contractYears,
            originalContractLength: contractYears,
            measurables, attributes,
            scoringProfile,
            chemistry: 75, gamesWithTeam: 0,
            injuryStatus: 'healthy', injury: null,
            fatigue: 0, fatigueThreshold: enduranceThreshold, gamesRested: 0,
            minutesThisGame: 0,
            relegationRelease: (tier === 1 && rating >= 85 && Math.random() < 0.10) ||
                               (tier === 1 && rating >= 80 && rating < 85 && Math.random() < 0.05),
            seasonStats: TeamFactory.emptySeasonStats()
        };
    }

    /**
     * Generate a college graduate prospect.
     * @param {number} targetTier
     * @param {number} playerId
     * @param {Object} deps - { PlayerAttributes }
     * @returns {Object}
     */
    static generateCollegeGraduate(targetTier, playerId, deps) {
        const { PlayerAttributes: PA } = deps;
        const firstName = TeamFactory.randomFirst();
        const lastName = TeamFactory.randomLast();
        const position = TeamFactory.randomPosition();
        const college = TeamFactory.randomCollege();
        const age = Math.random() < 0.7 ? 21 : 22;

        const { measurables, attributes, rating, offRating, defRating } = PA.generate(position, targetTier, age);
        const clampedRating = Math.max(48, Math.min(78, rating));
        const salary = TeamFactory.generateSalary(clampedRating, targetTier);
        const contractYears = TeamFactory.determineContractLength(age, clampedRating);
        const enduranceThreshold = Math.max(60, Math.min(90, 65 + Math.round((attributes.endurance - 50) * 0.4)));
        const potentialBoost = Math.floor(3 + Math.random() * 12);
        const projectedCeiling = Math.min(92, clampedRating + potentialBoost);
        // College graduates enter at their draft tier but with a slightly
        // wider variance — they're unproven. Efficiency skews toward lower end.
        const scoringProfile = TeamFactory.generateScoringProfile(position, targetTier, age, clampedRating);
        scoringProfile.variance = Math.min(0.50, scoringProfile.variance + 0.04);

        return {
            id: playerId,
            name: `${firstName} ${lastName}`,
            position, rating: clampedRating, offRating, defRating, age, tier: targetTier,
            salary, contractYears,
            originalContractLength: contractYears,
            measurables, attributes,
            scoringProfile,
            chemistry: 75, gamesWithTeam: 0,
            injuryStatus: 'healthy', injury: null,
            fatigue: 0, fatigueThreshold: enduranceThreshold, gamesRested: 0,
            minutesThisGame: 0,
            relegationRelease: false,
            isCollegeGrad: true, college,
            projectedCeiling,
            previousTeamId: null,
            seasonStats: TeamFactory.emptySeasonStats()
        };
    }

    /**
     * Generate a college graduate class.
     * @param {number} startId
     * @param {Object} deps - { PlayerAttributes }
     * @returns {Array}
     */
    static generateCollegeGraduateClass(startId, deps) {
        const graduates = [];
        const classSize = 90 + Math.floor(Math.random() * 31);
        let id = startId;

        for (let i = 0; i < classSize; i++) {
            // 10% T1-caliber (the rare undrafted gems), 25% T2, 65% T3
            const roll = Math.random();
            const targetTier = roll < 0.10 ? 1 : roll < 0.35 ? 2 : 3;
            graduates.push(TeamFactory.generateCollegeGraduate(targetTier, id++, deps));
        }

        graduates.sort((a, b) => b.rating - a.rating);
        return graduates;
    }

    // ─────────────────────────────────────────────────────────────
    // ROSTER GENERATION
    // ─────────────────────────────────────────────────────────────

    /** Rating ranges by tier for structured roster building. */
    static ROSTER_RATING_RANGES = {
        1: { star: [88, 95], starter: [78, 87], depth: [70, 77] },
        2: { star: [78, 85], starter: [68, 77], depth: [60, 67] },
        3: { star: [68, 75], starter: [58, 67], depth: [50, 57] }
    };

    /**
     * Generate a cap-compliant roster with realistic salary distribution.
     * @param {number} tier
     * @param {number} teamId
     * @param {Object} deps - { PlayerAttributes, SalaryCapEngine }
     * @returns {Array}
     */
    static generateRoster(tier, teamId, deps) {
        const { PlayerAttributes: PA, SalaryCapEngine: SC } = deps;
        const cap = SC.getSalaryCap(tier);
        const floor = SC.getSalaryFloor(tier);
        const targetPlayers = 12 + Math.floor(Math.random() * 4);
        const positions = TeamFactory.POSITIONS;
        const ranges = TeamFactory.ROSTER_RATING_RANGES[tier] || TeamFactory.ROSTER_RATING_RANGES[3];

        const roster = [];
        let playerId = teamId * 1000;
        let totalSalary = 0;

        function genInRange(ratingRange, posOverride) {
            const player = TeamFactory.generatePlayer(tier, playerId++, { PlayerAttributes: PA });
            if (posOverride) player.position = posOverride;
            const [minR, maxR] = ratingRange;
            const targetRating = Math.floor(minR + Math.random() * (maxR - minR + 1));
            const regen = PA.generateFromRating(player.position, targetRating, tier, player.age);
            player.measurables = regen.measurables;
            player.attributes = regen.attributes;
            player.rating = regen.rating;
            player.offRating = regen.offRating;
            player.defRating = regen.defRating;
            player.salary = TeamFactory.generateSalary(player.rating, tier);
            player.fatigueThreshold = Math.max(60, Math.min(90, 65 + Math.round((player.attributes.endurance - 50) * 0.4)));
            // Regenerate profile now that position and rating are finalised
            player.scoringProfile = TeamFactory.generateScoringProfile(player.position, tier, player.age, player.rating);
            return player;
        }

        // Phase 1: Stars
        const numStars = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numStars && i < positions.length; i++) {
            const star = genInRange(ranges.star, positions[i]);
            roster.push(star);
            totalSalary += star.salary;
        }

        // Phase 2: Starters
        const numStarters = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numStarters; i++) {
            const posIdx = (numStars + i) % positions.length;
            const starter = genInRange(ranges.starter, positions[posIdx]);
            if (totalSalary + starter.salary <= cap) {
                roster.push(starter);
                totalSalary += starter.salary;
            }
        }

        // Phase 3: Fill positions
        for (let i = 0; i < positions.length; i++) {
            if (!roster.find(p => p.position === positions[i])) {
                const filler = genInRange(ranges.depth, positions[i]);
                if (totalSalary + filler.salary <= cap) {
                    roster.push(filler);
                    totalSalary += filler.salary;
                }
            }
        }

        // Phase 4: Depth
        let attempts = 0;
        while (roster.length < targetPlayers && attempts < 200) {
            attempts++;
            const player = genInRange(ranges.depth);
            if (totalSalary + player.salary <= cap) {
                roster.push(player);
                totalSalary += player.salary;
            } else if (roster.length >= 12) {
                break;
            } else {
                const tierMins = { 1: 65, 2: 55, 3: 45 };
                const cheapPlayer = TeamFactory.generatePlayer(tier, playerId++, { PlayerAttributes: PA });
                const regen = PA.generateFromRating(cheapPlayer.position, tierMins[tier] || 50, tier, cheapPlayer.age);
                cheapPlayer.measurables = regen.measurables;
                cheapPlayer.attributes = regen.attributes;
                cheapPlayer.rating = regen.rating;
                cheapPlayer.offRating = regen.offRating;
                cheapPlayer.defRating = regen.defRating;
                cheapPlayer.salary = TeamFactory.generateSalary(cheapPlayer.rating, tier);
                if (totalSalary + cheapPlayer.salary <= cap) {
                    roster.push(cheapPlayer);
                    totalSalary += cheapPlayer.salary;
                }
            }
        }

        // Phase 5: Floor enforcement
        if (totalSalary < floor && roster.length > 0) {
            const multiplier = floor / totalSalary;
            roster.forEach(p => { p.salary = Math.round(p.salary * multiplier); });
            totalSalary = roster.reduce((sum, p) => sum + p.salary, 0);
        }

        return roster;
    }

    /**
     * Generate lean free agent pool.
     * @param {number} startId
     * @param {Object} deps - { PlayerAttributes }
     * @returns {Array}
     */
    static generateFreeAgentPool(startId, deps) {
        const freeAgents = [];
        let playerId = startId;

        // 3-5 T1, 5-8 T2, 7-10 T3
        for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++)
            freeAgents.push(TeamFactory.generatePlayer(1, playerId++, deps));
        for (let i = 0; i < 5 + Math.floor(Math.random() * 4); i++)
            freeAgents.push(TeamFactory.generatePlayer(2, playerId++, deps));
        for (let i = 0; i < 7 + Math.floor(Math.random() * 4); i++)
            freeAgents.push(TeamFactory.generatePlayer(3, playerId++, deps));

        return freeAgents;
    }

    // ─────────────────────────────────────────────────────────────
    // SCHEDULE GENERATION
    // ─────────────────────────────────────────────────────────────

    /**
     * Generate a round-robin-ish schedule for N teams.
     * @param {Array} teams
     * @param {number} numGames - Games per team
     * @returns {Array} Schedule of { homeTeamId, awayTeamId, played }
     */
    static generateSchedule(teams, numGames = 82) {
        const schedule = [];
        const teamGameCounts = {};
        teams.forEach(t => { teamGameCounts[t.id] = 0; });

        let attempts = 0;
        const maxAttempts = numGames * teams.length * 2;

        while (attempts < maxAttempts) {
            attempts++;
            const allFull = teams.every(t => teamGameCounts[t.id] >= numGames);
            if (allFull) break;

            const available = teams.filter(t => teamGameCounts[t.id] < numGames);
            if (available.length < 2) break;

            const t1 = available[Math.floor(Math.random() * available.length)];
            const others = available.filter(t => t.id !== t1.id);
            if (others.length === 0) break;
            const t2 = others[Math.floor(Math.random() * others.length)];

            if (Math.random() > 0.5) {
                schedule.push({ homeTeamId: t1.id, awayTeamId: t2.id, played: false });
            } else {
                schedule.push({ homeTeamId: t2.id, awayTeamId: t1.id, played: false });
            }
            teamGameCounts[t1.id]++;
            teamGameCounts[t2.id]++;
        }

        return schedule.sort(() => Math.random() - 0.5);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Team Initialization Data & Factory (Phase 3F)
    // ═══════════════════════════════════════════════════════════════════

    static TIER1_DIVISIONS = {
        'Atlantic': ['Boston Celtics', 'Brooklyn Nets', 'New York Knicks', 'Philadelphia 76ers', 'Toronto Raptors'],
        'Central': ['Chicago Bulls', 'Cleveland Cavaliers', 'Detroit Pistons', 'Indiana Pacers', 'Milwaukee Bucks'],
        'Southeast': ['Atlanta Hawks', 'Charlotte Hornets', 'Miami Heat', 'Orlando Magic', 'Washington Wizards'],
        'Northwest': ['Denver Nuggets', 'Minnesota Timberwolves', 'Oklahoma City Thunder', 'Portland Trail Blazers', 'Utah Jazz'],
        'Pacific': ['Golden State Warriors', 'LA Clippers', 'LA Lakers', 'Phoenix Suns', 'Sacramento Kings'],
        'Southwest': ['Dallas Mavericks', 'Houston Rockets', 'Memphis Grizzlies', 'New Orleans Pelicans', 'San Antonio Spurs']
    };

    static TIER2_DIVISIONS = {
        'Pacific Northwest': ['Seattle Grinders', 'Tacoma Narrows', 'Spokane Falls', 'Salem Bines', 'Eugene Sole', 'Vancouver Fog', 'Victoria Crowns', 'Boise Rimrock'],
        'California': ['San Diego Conquistadors', 'Anaheim Groves', 'Riverside Navals', 'Ontario Chaparral', 'Tijuana Frontera', 'Oakland Oaks', 'San Jose Quicksilver', 'Fresno Tule'],
        'Southwest': ['Las Vegas Neons', 'Reno Dustwalkers', 'Albuquerque Atoms', 'Las Cruces Wayfarers', 'Tucson Thorns', 'Hermosillo Forjadores', 'Ciudad Juárez Gemelos', 'Colorado Springs Fourteeners'],
        'Great Plains': ['Omaha Oracles', 'Lincoln Salters', 'Wichita Pilots', 'Kansas City Pitmasters', 'Des Moines Actuaries', 'Sioux Falls Quartzite', 'Tulsa Wildcatters', 'St. Louis Spirits'],
        'Great Lakes': ['Pittsburgh Condors', 'Columbus Brauhausers', 'Cincinnati Roustabouts', 'Grand Rapids Cabinetmakers', 'Madison Capitols', 'Fort Wayne Machinists', 'Toledo Glaziers', 'Buffalo Squalls'],
        'South': ['Louisville Distillers', 'Nashville Sidemen', 'Birmingham Vulcans', 'Greenville Millhands', 'Little Rock Nines', 'Chattanooga Roundhouse', 'Knoxville Quarrymen', 'Mobile Mystics'],
        'Southeast': ['Columbia Sandlappers', 'Raleigh Acorns', 'Richmond Rollers', 'Norfolk Ironclads', 'Greensboro Sitters', 'Charleston Sweetgrass', 'Savannah Squares'],
        'Northeast': ['Montreal Canotiers', 'Quebec City Ramparts', 'Ottawa Envoys', 'Hartford Whalers', 'Providence Seekers', 'Albany Locktenders', 'Rochester Developers', 'Worcester Arrows', 'Portland Lobstermen'],
        'Texas': ['Austin Disruptors', 'Corpus Christi Trawlers', 'Lubbock Crickets', 'Amarillo Helium', 'Waco Peppers', 'Laredo Cargadores', 'Monterrey Regios', 'Saltillo Sarapes'],
        'Prairie/Mountain Canada': ['Calgary Chinook', 'Edmonton Midnighters', 'Saskatoon Métis', 'Regina Mounties', 'Winnipeg Whiteout', 'Lethbridge Coulees', 'Missoula Rifflers'],
        'Central Mexico': ['Mexico City Chinampas', 'Guadalajara Jimadores', 'Puebla Cincos', 'León Zapateros', 'Querétaro Arcos', 'Aguascalientes Vapores', 'Toluca Alteños']
    };

    static TIER3_DIVISIONS = {
        'Greater Los Angeles MBL': ['Glendale Immortals', 'Pasadena Rosebuds', 'Long Beach Hydraulics', 'Torrance Shokunin', 'Irvine Blueprints', 'Santa Clarita Stuntmen'],
        'Bay Area MBL': ['Fremont Voltaires', 'Hayward Rumblers', 'Richmond Riveters', 'Daly City Manongs', 'San Mateo Venture', 'Concord Diablos'],
        'Inland Empire MBL': ['San Bernardino Arrowheads', 'Moreno Valley Haulers', 'Fontana Throttles', 'Corona Ovals', 'Rancho Cucamonga Crush', 'Redlands Gables'],
        'Central Valley MBL': ['Bakersfield Buckaroos', 'Modesto Graffiti', 'Stockton Levees', 'Visalia Sequoias', 'Merced Refugees', 'Turlock Azoreans'],
        'Greater Chicago MBL': ['Aurora Kilowatts', 'Naperville Bellringers', 'Joliet Jailbreakers', 'Rockford Bolts', 'Elgin Mainspring', 'Peoria Crawlers'],
        'Greater Houston MBL': ['Sugar Land Refiners', 'The Woodlands Canopy', 'Pearland Orchards', 'League City Orbit', 'Pasadena Flares', 'Beaumont Spindletop'],
        'Dallas-Fort Worth MBL': ['Arlington Tailgaters', 'Plano Legacy', 'Irving Gondoliers', 'Garland Transistors', 'Frisco Caddies', 'Denton Holdouts'],
        'Phoenix Metro MBL': ['Mesa Rotors', 'Chandler Wafers', 'Scottsdale Usonians', 'Gilbert Haymakers', 'Peoria Snowbirds', 'Flagstaff Ponderosas'],
        'Atlanta Metro MBL': ['Marietta Skunks', 'Roswell Hooch', 'Macon Ramblers', 'Columbus Fizz', 'Athens Murmurs', 'Warner Robins Wiregrass'],
        'Greater Detroit MBL': ['Warren Technicians', 'Ann Arbor Victors', 'Lansing Stampers', 'Dearborn Rouge', 'Rochester Hills Calibrators', 'Flint Strikers'],
        'Twin Cities MBL': ['St. Paul Saints', 'Rochester Physicians', 'Duluth Freewheelers', 'St. Cloud Stonecutters', 'Mankato Dakota', 'Bloomington Groundskeepers'],
        'Greater Seattle MBL': ['Bellevue Compilers', 'Kent Fabricators', 'Everett Wide Bodies', 'Bellingham Fallers', 'Yakima Winesaps', 'Kennewick Half-Life'],
        'South Florida MBL': ['Fort Lauderdale Skippers', 'Pembroke Pines Cachapas', 'Boca Raton Cursors', 'West Palm Beach Nighthawks', 'Fort Myers Beachcombers', 'Port St. Lucie Manatees'],
        'New England MBL': ['Lowell Drifters', 'Springfield Peach Baskets', 'Bridgeport Ringmasters', 'New Haven Apizza', 'Amherst Dashes', 'Burlington Independents'],
        'Greater Philadelphia MBL': ['Reading Conductors', 'Allentown Steelworkers', 'Bethlehem Girders', 'Trenton Continentals', 'Wilmington Wyeths', 'Lancaster Elders'],
        'Pacific NW Small Cities MBL': ['Vancouver Outlanders', 'Wenatchee Rootstock', 'Bend Cinders', 'Medford Smokejumpers', 'Idaho Falls Geysers', 'Pocatello Hoggers'],
        'Upstate New York MBL': ['Binghamton Twilighters', 'Utica Greens', 'Ithaca Gorges', 'Elmira Thermals', 'Glens Falls Adirondacks', 'Plattsburgh Flotilla'],
        'North Carolina Triangle MBL': ['Durham Brightleafs', 'Fayetteville Riggers', 'Wilmington Gaffers', 'Asheville Flatfoots', 'High Point Joiners', 'Winston-Salem Fryers'],
        'Ohio Valley MBL': ['Akron Blimps', 'Dayton Wrights', 'Canton Enshrined', 'Youngstown Puddlers', 'Huntington Yardmen', 'Charleston Agitators'],
        'Midwest College Towns MBL': ['Muncie Typicals', 'South Bend Studebakers', 'Champaign Mosaics', 'Ames Peloton', 'Iowa City Scribblers', 'Kalamazoo Pulp'],
        'Mountain West MBL': ['Provo Missionaries', 'Ogden Golden Spikes', 'Fort Collins Pedalers', 'Boulder Flatirons', 'Billings Absaroka', 'Casper Overlanders'],
        'Tennessee Valley MBL': ['Murfreesboro Stones', 'Huntsville Saturn', 'Tuscaloosa Houndstooth', 'Auburn Redclay', 'Montgomery Equalizers', 'Jackson Pearls'],
        'Gulf Coast MBL': ['Baton Rouge Rougarou', 'Shreveport Hayride', 'Lafayette Mudbugs', 'Lake Charles Tankers', 'Pensacola Mullet', 'Fayetteville Greeters'],
        'Border Cities MBL': ['McAllen Mariposas', 'Brownsville Resacas', 'Yuma Irrigators', 'Nuevo Laredo Corridos', 'Reynosa Maquileros', 'Mexicali Hornos']
    };

    static TIER_CONFIG = {
        1: { idOffset: 1, ratingBase: 75, ratingRange: 20, divisions: 'TIER1_DIVISIONS' },
        2: { idOffset: 1000, ratingBase: 65, ratingRange: 15, divisions: 'TIER2_DIVISIONS' },
        3: { idOffset: 2000, ratingBase: 55, ratingRange: 15, divisions: 'TIER3_DIVISIONS' }
    };

    /**
     * Initialize all teams for a given tier
     * @param {number} tier - 1, 2, or 3
     * @param {Function} generateRoster - Roster generation function
     * @returns {Array} Array of team objects
     */
    static initializeTierTeams(tier, generateRoster) {
        const config = TeamFactory.TIER_CONFIG[tier];
        const divisions = TeamFactory[config.divisions];

        let id = config.idOffset;
        const teams = [];
        for (const [division, teamNames] of Object.entries(divisions)) {
            for (const name of teamNames) {
                const team = {
                    id: id++,
                    name: name,
                    division: division,
                    tier: tier,
                    wins: 0,
                    losses: 0,
                    pointDiff: 0,
                    rating: config.ratingBase + Math.random() * config.ratingRange,
                    roster: []
                };
                team.roster = generateRoster(tier, team.id);
                team.coach = CoachEngine.generateCoach(tier);
                team.coach.teamId = team.id;
                FinanceEngine.initializeTeamFinances(team);
                teams.push(team);
            }
        }
        console.log(`Initialized ${teams.length} Tier ${tier} teams with rosters`);
        return teams;
    }
}
