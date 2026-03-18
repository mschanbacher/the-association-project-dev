// ═══════════════════════════════════════════════════════════════════════════════
// TrainingCampEngine.js — Training camp logic and player development
//
// Pure logic engine (no DOM access). Manages:
//   - Focus definitions and position-based availability
//   - Focus pool allocation (25 focuses across 20-man roster)
//   - Outcome calculation (work ethic, coachability, age, current level, coach)
//   - Camp resolution (apply attribute changes, recalculate ratings)
//   - General conditioning for unfocused players
//   - AI team camp simulation
//   - Preseason game scheduling
//
// Dependencies injected via ctx: { PlayerAttributes, CoachEngine }
// Future: assistant coaches will modify coachBonus calculation
// ═══════════════════════════════════════════════════════════════════════════════

export class TrainingCampEngine {

    // ═══════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════

    /** Offseason expanded roster limit (NBA rule: 20 during offseason/camp) */
    static MAX_CAMP_ROSTER = 20;

    /** Regular season roster limit */
    static MAX_SEASON_ROSTER = 15;

    /** Total focus points available to allocate across roster */
    static BASE_FOCUS_POOL = 25;

    /** Maximum focuses assignable to a single player */
    static MAX_FOCUSES_PER_PLAYER = 2;

    /** Number of preseason exhibition games per team */
    static PRESEASON_GAMES = 4;

    /** Camp duration in days (mirrors NBA ~3 weeks) */
    static CAMP_DURATION_DAYS = 21;

    // ═══════════════════════════════════════════════════════════════════
    // FOCUS DEFINITIONS
    // ═══════════════════════════════════════════════════════════════════
    //
    // Each focus maps to 1-3 underlying PlayerAttributes.
    // `positions`: which positions can select this focus (null = all).
    // `category`: 'offense', 'defense', or 'physical' — used for coach
    //   bonus calculation (offensive coach boosts offense focuses, etc).
    // `primaryAttr`: the main attribute affected (largest change).
    // `secondaryAttrs`: additional attributes with smaller changes.
    // `difficulty`: base difficulty modifier (1.0 = normal). Higher values
    //   reduce improvement probability. Athleticism is hard to train.

    static FOCUS_DEFINITIONS = {
        perimeterShooting: {
            id: 'perimeterShooting',
            name: 'Perimeter Shooting',
            description: 'Three-point range and mid-range accuracy',
            category: 'offense',
            primaryAttr: 'clutch',      // Clutch captures scoring reliability
            secondaryAttrs: ['basketballIQ'],
            positions: null,            // All positions
            difficulty: 1.0,
        },
        finishing: {
            id: 'finishing',
            name: 'Finishing',
            description: 'Scoring at the rim, layups through contact',
            category: 'offense',
            primaryAttr: 'verticality',
            secondaryAttrs: ['strength'],
            positions: ['SG', 'SF', 'PF', 'C'],
            difficulty: 0.9,
        },
        ballHandling: {
            id: 'ballHandling',
            name: 'Ball Handling',
            description: 'Dribbling, turnover reduction, creating space',
            category: 'offense',
            primaryAttr: 'speed',
            secondaryAttrs: ['basketballIQ'],
            positions: ['PG', 'SG', 'SF'],
            difficulty: 1.0,
        },
        playmaking: {
            id: 'playmaking',
            name: 'Playmaking',
            description: 'Passing vision, assist creation, reading defenses',
            category: 'offense',
            primaryAttr: 'basketballIQ',
            secondaryAttrs: ['collaboration'],
            positions: ['PG', 'SG', 'SF'],
            difficulty: 1.1,            // Hard to teach court vision
        },
        postGame: {
            id: 'postGame',
            name: 'Post Game',
            description: 'Low-post moves, back-to-basket scoring',
            category: 'offense',
            primaryAttr: 'strength',
            secondaryAttrs: ['basketballIQ'],
            positions: ['PF', 'C'],
            difficulty: 1.0,
        },
        perimeterDefense: {
            id: 'perimeterDefense',
            name: 'Perimeter Defense',
            description: 'On-ball defense, lateral quickness, staying in front',
            category: 'defense',
            primaryAttr: 'speed',
            secondaryAttrs: ['endurance'],
            positions: ['PG', 'SG', 'SF'],
            difficulty: 0.9,
        },
        interiorDefense: {
            id: 'interiorDefense',
            name: 'Interior Defense',
            description: 'Rim protection, shot blocking, defensive rebounding',
            category: 'defense',
            primaryAttr: 'verticality',
            secondaryAttrs: ['strength'],
            positions: ['PF', 'C'],
            difficulty: 0.9,
        },
        teamDefense: {
            id: 'teamDefense',
            name: 'Team Defense',
            description: 'Help defense, rotations, communication',
            category: 'defense',
            primaryAttr: 'basketballIQ',
            secondaryAttrs: ['collaboration'],
            positions: null,            // All positions
            difficulty: 1.0,
        },
        conditioning: {
            id: 'conditioning',
            name: 'Conditioning',
            description: 'Endurance, fatigue resistance, durability',
            category: 'physical',
            primaryAttr: 'endurance',
            secondaryAttrs: [],
            positions: null,            // All positions
            difficulty: 0.7,            // Easiest to improve with effort
        },
    };

    // ═══════════════════════════════════════════════════════════════════
    // FOCUS AVAILABILITY
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Get available focuses for a specific player.
     * Filters by position and excludes focuses where the primary attribute
     * is already at 95+ (essentially capped, no meaningful improvement possible).
     *
     * @param {Object} player - Player object with position and attributes
     * @returns {Array<Object>} Available focus definitions with expected outcome data
     */
    static getAvailableFocuses(player) {
        const available = [];

        for (const focus of Object.values(this.FOCUS_DEFINITIONS)) {
            // Position filter
            if (focus.positions && !focus.positions.includes(player.position)) continue;

            // Skip if primary attribute is essentially capped
            const primaryVal = player.attributes?.[focus.primaryAttr] || 50;
            if (primaryVal >= 95) continue;

            available.push({
                ...focus,
                currentPrimaryValue: primaryVal,
            });
        }

        return available;
    }

    // ═══════════════════════════════════════════════════════════════════
    // OUTCOME PROJECTION (for UI transparency)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Calculate the expected outcome for a player-focus combination.
     * Returns a projection object the UI can display to help the user
     * make informed focus allocation decisions.
     *
     * @param {Object} player - Player object
     * @param {Object} focus - Focus definition from FOCUS_DEFINITIONS
     * @param {Object} coach - Coach object (team.coach)
     * @returns {Object} Projection with label, factors, probabilities
     */
    static projectOutcome(player, focus, coach) {
        const factors = this._calculateFactors(player, focus, coach);
        const probs = this._calculateProbabilities(factors);

        // Derive a qualitative label from the probabilities
        const improvementChance = probs.major + probs.moderate + probs.minor;
        let label, tier;
        if (improvementChance >= 0.75) {
            label = 'Strong improvement expected';
            tier = 'strong';
        } else if (improvementChance >= 0.55) {
            label = 'Good chance of improvement';
            tier = 'good';
        } else if (improvementChance >= 0.35) {
            label = 'Moderate chance';
            tier = 'moderate';
        } else if (improvementChance >= 0.20) {
            label = 'Unlikely to improve';
            tier = 'unlikely';
        } else {
            label = 'Risk of regression';
            tier = 'risky';
        }

        return {
            label,
            tier,
            factors: {
                currentLevel: player.attributes?.[focus.primaryAttr] || 50,
                workEthic: player.attributes?.workEthic || 50,
                coachability: player.attributes?.coachability || 50,
                basketballIQ: player.attributes?.basketballIQ || 50,
                age: player.age,
                coachFit: factors.coachBonus > 0.08 ? 'Strong' : factors.coachBonus > 0 ? 'Good' : factors.coachBonus > -0.05 ? 'Average' : 'Poor',
            },
            // Raw probabilities (UI can display these or just use the label)
            probabilities: probs,
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // FACTOR CALCULATION (shared by projection and resolution)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Calculate all factors that influence a focus outcome.
     * Separated so projection and resolution use identical logic.
     *
     * @param {Object} player
     * @param {Object} focus
     * @param {Object} coach
     * @returns {Object} Named factors with numeric values
     */
    static _calculateFactors(player, focus, coach) {
        const attrs = player.attributes || {};
        const age = player.age || 25;
        const currentLevel = attrs[focus.primaryAttr] || 50;
        const workEthic = attrs.workEthic || 50;
        const coachability = attrs.coachability || 50;
        const bbIQ = attrs.basketballIQ || 50;

        // 1. Work ethic factor (0.0 to 0.5 range, centered at ~0.25 for average)
        //    High work ethic = more reps, more film study, more buy-in
        const workEthicFactor = (workEthic - 30) / 140; // 30 → 0.0, 100 → 0.5

        // 2. Coachability factor (0.0 to 0.4 range)
        //    How well the player absorbs and applies coaching
        const coachabilityFactor = (coachability - 30) / 175; // 30 → 0.0, 100 → 0.4

        // 3. Age factor — young players improve much more easily
        //    19-22: +0.20 to +0.12 (prime development window)
        //    23-26: +0.08 to +0.02 (still growing)
        //    27-29: 0.00 (maintenance years)
        //    30-33: -0.05 to -0.15 (declining)
        //    34+:   -0.20 to -0.30 (steep decline)
        let ageFactor;
        if (age <= 22) {
            ageFactor = 0.20 - (age - 19) * 0.027;
        } else if (age <= 26) {
            ageFactor = 0.08 - (age - 23) * 0.02;
        } else if (age <= 29) {
            ageFactor = 0.0;
        } else if (age <= 33) {
            ageFactor = -0.05 - (age - 30) * 0.033;
        } else {
            ageFactor = -0.20 - (age - 34) * 0.05;
        }

        // 4. Current level factor — diminishing returns at high levels
        //    50-60: +0.15 (lots of room to grow)
        //    60-70: +0.10
        //    70-80: +0.03
        //    80-90: -0.05 (hard to improve elite skills)
        //    90+:   -0.15 (near-impossible ceiling)
        let levelFactor;
        if (currentLevel < 60) {
            levelFactor = 0.15;
        } else if (currentLevel < 70) {
            levelFactor = 0.10;
        } else if (currentLevel < 80) {
            levelFactor = 0.03;
        } else if (currentLevel < 90) {
            levelFactor = -0.05;
        } else {
            levelFactor = -0.15;
        }

        // 5. Coach bonus — head coach's relevant trait boosts the focus
        //    Offensive focuses use pace + threePointTendency + ballMovement average
        //    Defensive focuses use defensiveIntensity
        //    Physical focuses use playerDevelopment
        //    Future: assistant coaches will be layered on here
        const coachTraits = coach?.traits || {};
        const coachOverall = coach?.overall || 50;
        let coachRelevantRating;
        if (focus.category === 'offense') {
            const pace = coachTraits.pace || 50;
            const three = coachTraits.threePointTendency || 50;
            const ball = coachTraits.ballMovement || 50;
            coachRelevantRating = (pace + three + ball) / 3;
        } else if (focus.category === 'defense') {
            coachRelevantRating = coachTraits.defensiveIntensity || 50;
        } else {
            // Physical — player development trait is most relevant
            coachRelevantRating = coachTraits.playerDevelopment || 50;
        }
        // Blend coach overall (40%) with category-specific (60%)
        const coachBlend = coachOverall * 0.4 + coachRelevantRating * 0.6;
        // Convert to -0.10 to +0.15 range (50 is neutral)
        const coachBonus = (coachBlend - 50) / 333;

        // 6. Basketball IQ bonus — affects translation of practice to game
        //    Small but meaningful modifier
        const iqBonus = (bbIQ - 50) / 500; // -0.07 to +0.10

        // 7. Difficulty modifier from the focus itself
        const difficultyPenalty = (focus.difficulty - 1.0) * 0.10; // e.g. 1.1 → -0.01

        return {
            workEthicFactor,
            coachabilityFactor,
            ageFactor,
            levelFactor,
            coachBonus,
            iqBonus,
            difficultyPenalty,
            // Combined score — higher = better improvement odds
            composite: workEthicFactor + coachabilityFactor + ageFactor + levelFactor + coachBonus + iqBonus - difficultyPenalty,
        };
    }

    /**
     * Convert factors into probability buckets for outcomes.
     *
     * @param {Object} factors - Result of _calculateFactors
     * @returns {Object} { major, moderate, minor, noChange, regression }
     *   All values 0.0-1.0, summing to 1.0
     */
    static _calculateProbabilities(factors) {
        const c = factors.composite;

        // Sigmoid-ish mapping from composite score to improvement probability
        // composite range is roughly -0.30 (terrible) to +0.90 (ideal young player)
        // Center the curve at 0.20 (decent but not great conditions)

        // Base improvement chance: logistic curve
        let improvementBase = 1 / (1 + Math.exp(-(c - 0.15) * 6));
        improvementBase = Math.max(0.05, Math.min(0.92, improvementBase));

        // Split improvement into major / moderate / minor
        // More favorable conditions shift toward larger improvements
        const majorShare = Math.max(0.0, Math.min(0.5, (c - 0.10) * 0.6));
        const moderateShare = Math.max(0.1, Math.min(0.5, 0.35 + (c - 0.20) * 0.2));
        const minorShare = 1.0 - majorShare - moderateShare;

        const major = improvementBase * majorShare;
        const moderate = improvementBase * moderateShare;
        const minor = improvementBase * Math.max(0, minorShare);

        // Regression chance — higher when old, high current level, low coachability
        let regressionBase = Math.max(0.02, 0.12 - c * 0.15);
        if (factors.ageFactor < -0.10) regressionBase += 0.08;
        if (factors.levelFactor < -0.05) regressionBase += 0.05;
        regressionBase = Math.min(0.35, regressionBase);

        // No change is the remainder
        const noChange = Math.max(0.0, 1.0 - major - moderate - minor - regressionBase);

        return {
            major: +major.toFixed(4),
            moderate: +moderate.toFixed(4),
            minor: +minor.toFixed(4),
            noChange: +noChange.toFixed(4),
            regression: +regressionBase.toFixed(4),
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // CAMP RESOLUTION
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Resolve all focus assignments for a team's training camp.
     * Applies attribute changes, recalculates ratings, returns a results log.
     *
     * @param {Object} team - Team object with roster and coach
     * @param {Object} focusAssignments - { playerId: [focusId, focusId] }
     * @param {Object} deps - { PlayerAttributes } for rating recalculation
     * @returns {Object} { results: Array<PlayerResult>, summary }
     */
    static resolveCamp(team, focusAssignments, deps) {
        const { PlayerAttributes: PA } = deps;
        const coach = team.coach;
        const results = [];

        for (const player of (team.roster || [])) {
            const assignedFocuses = focusAssignments[player.id] || [];

            if (assignedFocuses.length > 0) {
                // Player has assigned focuses — resolve each one
                const playerResults = [];
                for (const focusId of assignedFocuses) {
                    const focus = this.FOCUS_DEFINITIONS[focusId];
                    if (!focus) continue;

                    const result = this._resolveFocus(player, focus, coach);
                    playerResults.push(result);
                }
                results.push({
                    playerId: player.id,
                    playerName: player.name,
                    position: player.position,
                    age: player.age,
                    type: 'focused',
                    focuses: playerResults,
                    ratingBefore: player.rating,
                    ratingAfter: null, // Set after recalc below
                });
            } else {
                // No assigned focus — general conditioning
                const condResult = this._resolveGeneralConditioning(player);
                results.push({
                    playerId: player.id,
                    playerName: player.name,
                    position: player.position,
                    age: player.age,
                    type: 'conditioning',
                    focuses: condResult ? [condResult] : [],
                    ratingBefore: player.rating,
                    ratingAfter: null,
                });
            }

            // Recalculate derived ratings after all attribute changes
            if (player.attributes && player.measurables) {
                player.offRating = PA.calculateOffRating(player.position, player.attributes, player.measurables);
                player.defRating = PA.calculateDefRating(player.position, player.attributes, player.measurables);
                player.rating = PA.calculateRating(player.position, player.attributes, player.measurables);
            }

            // Record final rating
            const entry = results[results.length - 1];
            entry.ratingAfter = player.rating;
            entry.ratingChange = player.rating - entry.ratingBefore;
        }

        // Build summary
        const improved = results.filter(r => r.ratingChange > 0).length;
        const declined = results.filter(r => r.ratingChange < 0).length;
        const unchanged = results.filter(r => r.ratingChange === 0).length;
        const focusedCount = results.filter(r => r.type === 'focused').length;
        const conditioningCount = results.filter(r => r.type === 'conditioning').length;

        return {
            results,
            summary: {
                totalPlayers: results.length,
                focusedPlayers: focusedCount,
                conditioningPlayers: conditioningCount,
                improved,
                declined,
                unchanged,
                focusesUsed: Object.values(focusAssignments).reduce((sum, arr) => sum + arr.length, 0),
                focusPool: this.BASE_FOCUS_POOL,
            },
        };
    }

    /**
     * Resolve a single focus for a player.
     * Rolls against probability buckets and applies attribute changes.
     *
     * @param {Object} player
     * @param {Object} focus
     * @param {Object} coach
     * @returns {Object} Result with focus name, outcome, and attribute changes
     */
    static _resolveFocus(player, focus, coach) {
        const factors = this._calculateFactors(player, focus, coach);
        const probs = this._calculateProbabilities(factors);

        // Roll for outcome
        const roll = Math.random();
        let outcome, primaryChange, secondaryChange;

        if (roll < probs.major) {
            outcome = 'major';
            primaryChange = 2 + Math.floor(Math.random() * 2); // +2 to +3
            secondaryChange = 1;
        } else if (roll < probs.major + probs.moderate) {
            outcome = 'moderate';
            primaryChange = 1 + Math.floor(Math.random() * 2); // +1 to +2
            secondaryChange = Math.random() < 0.5 ? 1 : 0;
        } else if (roll < probs.major + probs.moderate + probs.minor) {
            outcome = 'minor';
            primaryChange = 1;
            secondaryChange = 0;
        } else if (roll < probs.major + probs.moderate + probs.minor + probs.noChange) {
            outcome = 'noChange';
            primaryChange = 0;
            secondaryChange = 0;
        } else {
            outcome = 'regression';
            primaryChange = -(1 + Math.floor(Math.random() * 2)); // -1 to -2
            secondaryChange = Math.random() < 0.3 ? -1 : 0;
        }

        // Apply attribute changes
        const changes = {};
        if (primaryChange !== 0 && player.attributes) {
            const oldVal = player.attributes[focus.primaryAttr] || 50;
            const newVal = Math.max(15, Math.min(99, oldVal + primaryChange));
            player.attributes[focus.primaryAttr] = newVal;
            changes[focus.primaryAttr] = newVal - oldVal;
        }
        if (secondaryChange !== 0 && player.attributes && focus.secondaryAttrs) {
            for (const secAttr of focus.secondaryAttrs) {
                const oldVal = player.attributes[secAttr] || 50;
                const newVal = Math.max(15, Math.min(99, oldVal + secondaryChange));
                player.attributes[secAttr] = newVal;
                changes[secAttr] = newVal - oldVal;
            }
        }

        return {
            focusId: focus.id,
            focusName: focus.name,
            outcome,
            changes,
            primaryAttr: focus.primaryAttr,
            primaryChange,
        };
    }

    /**
     * Resolve general conditioning for a player without assigned focuses.
     * Small chance of random improvement, weighted by intangibles.
     *
     * @param {Object} player
     * @returns {Object|null} Result if something happened, null if no change
     */
    static _resolveGeneralConditioning(player) {
        const attrs = player.attributes || {};
        const workEthic = attrs.workEthic || 50;
        const coachability = attrs.coachability || 50;
        const bbIQ = attrs.basketballIQ || 50;
        const age = player.age || 25;

        // Base chance of something happening: 15-30% depending on intangibles
        const intangibleAvg = (workEthic + coachability + bbIQ) / 3;
        let eventChance = 0.10 + (intangibleAvg - 40) / 400; // 40 → 10%, 90 → 22.5%
        if (age <= 23) eventChance += 0.08; // Young players more likely to pop
        if (age >= 30) eventChance -= 0.05;
        eventChance = Math.max(0.05, Math.min(0.35, eventChance));

        if (Math.random() > eventChance) return null;

        // Something happened — pick a random attribute to affect
        const trainableAttrs = ['speed', 'strength', 'verticality', 'endurance', 'basketballIQ', 'clutch'];
        const attr = trainableAttrs[Math.floor(Math.random() * trainableAttrs.length)];
        const oldVal = attrs[attr] || 50;

        // Mostly positive (+1), small chance of -1 (aging/overtraining)
        let change;
        if (age >= 30 && Math.random() < 0.40) {
            change = -1; // Older players more likely to see decline even in conditioning
        } else {
            change = 1;
        }

        const newVal = Math.max(15, Math.min(99, oldVal + change));
        if (player.attributes) {
            player.attributes[attr] = newVal;
        }

        return {
            focusId: 'generalConditioning',
            focusName: 'General Conditioning',
            outcome: change > 0 ? 'minor' : 'regression',
            changes: { [attr]: newVal - oldVal },
            primaryAttr: attr,
            primaryChange: change,
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // AI CAMP SIMULATION
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Simulate training camp for an AI-controlled team.
     * Auto-assigns focuses based on roster needs and player profiles,
     * then resolves camp.
     *
     * @param {Object} team - AI team
     * @param {Object} deps - { PlayerAttributes }
     * @returns {Object} Camp results (same format as resolveCamp)
     */
    static simulateAICamp(team, deps) {
        const assignments = this._generateAIFocusAssignments(team);
        return this.resolveCamp(team, assignments, deps);
    }

    /**
     * Generate focus assignments for an AI team.
     * Strategy: prioritize young players and key starters, assign
     * focuses that target their weakest relevant attributes.
     *
     * @param {Object} team
     * @returns {Object} { playerId: [focusId, focusId] }
     */
    static _generateAIFocusAssignments(team) {
        const assignments = {};
        let focusesRemaining = this.BASE_FOCUS_POOL;
        const roster = team.roster || [];
        const coach = team.coach;

        // Sort roster: young players first, then by rating descending
        const sorted = [...roster].sort((a, b) => {
            // Young players (under 25) get priority
            const aYoung = a.age <= 24 ? 0 : 1;
            const bYoung = b.age <= 24 ? 0 : 1;
            if (aYoung !== bYoung) return aYoung - bYoung;
            return b.rating - a.rating;
        });

        for (const player of sorted) {
            if (focusesRemaining <= 0) break;

            const available = this.getAvailableFocuses(player);
            if (available.length === 0) continue;

            // Score each focus by expected improvement
            const scored = available.map(focus => {
                const proj = this.projectOutcome(player, focus, coach);
                return { focus, score: proj.probabilities.major * 3 + proj.probabilities.moderate * 2 + proj.probabilities.minor };
            });
            scored.sort((a, b) => b.score - a.score);

            // Assign top 1-2 focuses depending on remaining pool
            const numFocuses = Math.min(
                this.MAX_FOCUSES_PER_PLAYER,
                focusesRemaining,
                scored.length
            );
            assignments[player.id] = scored.slice(0, numFocuses).map(s => s.focus.id);
            focusesRemaining -= numFocuses;
        }

        return assignments;
    }

    // ═══════════════════════════════════════════════════════════════════
    // CAMP INVITE HELPERS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Get eligible camp invitees from the free agent pool.
     * Filters to players whose rating is appropriate for the team's tier.
     *
     * @param {Array} freeAgents - gameState.freeAgents
     * @param {number} tier - Team's tier (1, 2, or 3)
     * @param {number} currentRosterSize - Current roster count
     * @returns {Array} Eligible free agents, sorted by rating descending
     */
    static getCampInviteCandidates(freeAgents, tier, currentRosterSize) {
        const spotsAvailable = this.MAX_CAMP_ROSTER - currentRosterSize;
        if (spotsAvailable <= 0) return [];

        // Wider rating range than regular FA — camp is for evaluation
        const ratingRanges = {
            1: { min: 55, max: 99 },  // T1 camps can invite anyone decent
            2: { min: 48, max: 85 },
            3: { min: 40, max: 75 },
        };
        const range = ratingRanges[tier] || ratingRanges[3];

        return freeAgents
            .filter(p => p.rating >= range.min && p.rating <= range.max)
            .sort((a, b) => b.rating - a.rating);
    }

    /**
     * Sign a free agent to a camp invite contract.
     * Removes from FA pool, adds to team roster with a minimum camp contract.
     *
     * @param {Object} player - Player to sign
     * @param {Object} team - Team signing the player
     * @param {Array} freeAgentPool - gameState.freeAgents (mutated)
     * @param {Object} deps - { TeamFactory } for salary generation
     * @returns {boolean} True if signed successfully
     */
    static signCampInvite(player, team, freeAgentPool, deps) {
        const roster = team.roster || [];
        if (roster.length >= this.MAX_CAMP_ROSTER) return false;

        const { TeamFactory: TF } = deps;

        // Remove from FA pool
        const idx = freeAgentPool.findIndex(p => p.id === player.id || String(p.id) === String(player.id));
        if (idx === -1) return false;
        freeAgentPool.splice(idx, 1);

        // Set camp contract (minimum salary, 1 year — non-guaranteed)
        player.salary = TF?.generateSalary?.(player.rating, team.tier) || 500000;
        player.contractYears = 1;
        player.originalContractLength = 1;
        player.tier = team.tier;
        player.isCampInvite = true;

        // Add to roster
        roster.push(player);
        return true;
    }

    /**
     * AI teams sign camp invites to fill roster up to 18-20 players.
     * Called when a tier's camp opens for AI teams.
     *
     * @param {Array} teams - Teams in this tier
     * @param {Array} freeAgentPool - gameState.freeAgents (mutated)
     * @param {Object} deps - { TeamFactory }
     * @param {string} [skipTeamId] - User's team ID to skip
     * @returns {number} Total invites signed
     */
    static aiSignCampInvites(teams, freeAgentPool, deps, skipTeamId) {
        let totalSigned = 0;

        // Shuffle for fairness
        const shuffled = [...teams].sort(() => Math.random() - 0.5);

        shuffled.forEach(team => {
            if (team.id === skipTeamId) return;
            const rosterSize = team.roster?.length || 0;
            if (rosterSize >= 18) return; // AI teams target 18-19, not always full 20

            // Sign 1-3 invites depending on roster need
            const target = 17 + Math.floor(Math.random() * 3); // 17-19
            const toSign = Math.max(0, target - rosterSize);

            for (let i = 0; i < toSign; i++) {
                // Find best available for this tier
                const candidates = this.getCampInviteCandidates(freeAgentPool, team.tier, team.roster.length);
                if (candidates.length === 0) break;

                // Pick from top 5 randomly for variety
                const pickIdx = Math.floor(Math.random() * Math.min(5, candidates.length));
                const pick = candidates[pickIdx];

                if (this.signCampInvite(pick, team, freeAgentPool, deps)) {
                    totalSigned++;
                }
            }
        });

        return totalSigned;
    }

    // ═══════════════════════════════════════════════════════════════════
    // CUTDOWN HELPERS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Validate a proposed cutdown list.
     * The team must end up with exactly MAX_SEASON_ROSTER players.
     *
     * @param {Object} team
     * @param {Array<string>} playerIdsToCut - IDs of players to release
     * @returns {Object} { valid, errors, resultingRosterSize }
     */
    static validateCutdown(team, playerIdsToCut) {
        const roster = team.roster || [];
        const resultingSize = roster.length - playerIdsToCut.length;
        const errors = [];

        if (resultingSize > this.MAX_SEASON_ROSTER) {
            errors.push(`Must cut ${resultingSize - this.MAX_SEASON_ROSTER} more player(s). Roster would be ${resultingSize}, max is ${this.MAX_SEASON_ROSTER}.`);
        }
        if (resultingSize < 12) {
            errors.push(`Cannot cut that many. Roster would be ${resultingSize}, minimum is 12.`);
        }

        // Verify all IDs exist on roster
        for (const id of playerIdsToCut) {
            if (!roster.find(p => p.id === id || String(p.id) === String(id))) {
                errors.push(`Player ID ${id} not found on roster.`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            resultingRosterSize: resultingSize,
        };
    }

    /**
     * Execute cutdown — remove players from roster, add to FA pool.
     *
     * @param {Object} team
     * @param {Array<string>} playerIdsToCut
     * @param {Array} freeAgentPool - gameState.freeAgents (mutated)
     * @returns {Array<Object>} Cut players
     */
    static executeCutdown(team, playerIdsToCut, freeAgentPool) {
        const cutPlayers = [];

        for (const id of playerIdsToCut) {
            const idx = team.roster.findIndex(p => p.id === id || String(p.id) === String(id));
            if (idx === -1) continue;

            const player = team.roster.splice(idx, 1)[0];
            player.previousTeamId = team.id;
            freeAgentPool.push(player);
            cutPlayers.push(player);
        }

        return cutPlayers;
    }

    /**
     * Auto-generate cutdown decisions for an AI team.
     * Cuts lowest-rated players to reach MAX_SEASON_ROSTER.
     *
     * @param {Object} team
     * @param {Array} freeAgentPool
     * @returns {Array<Object>} Cut players
     */
    static aiCutdown(team, freeAgentPool) {
        const roster = team.roster || [];
        if (roster.length <= this.MAX_SEASON_ROSTER) return [];

        // Sort ascending by rating — cut worst players
        const sorted = [...roster].sort((a, b) => a.rating - b.rating);
        const numToCut = roster.length - this.MAX_SEASON_ROSTER;
        const toCut = sorted.slice(0, numToCut).map(p => p.id);

        return this.executeCutdown(team, toCut, freeAgentPool);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PRESEASON SCHEDULE
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Generate a preseason schedule for teams in a tier.
     * Each team plays PRESEASON_GAMES exhibition games.
     *
     * @param {Array} teams - Teams in this tier
     * @param {string} startDate - YYYY-MM-DD camp start date
     * @param {number} campDays - Duration of camp in days
     * @returns {Array<Object>} Schedule of { homeTeamId, awayTeamId, date, preseason: true }
     */
    static generatePreseasonSchedule(teams, startDate, campDays) {
        const schedule = [];
        if (!teams || teams.length < 2) return schedule;

        const gamesPerTeam = this.PRESEASON_GAMES;
        const teamGames = {};
        teams.forEach(t => { teamGames[t.id] = 0; });

        // Space games evenly across the middle portion of camp
        // (first few days are practice-only, last few are final cuts)
        const [year, month, day] = startDate.split('-').map(Number);
        const campStart = new Date(year, month - 1, day);
        const gameWindowStart = new Date(campStart.getTime() + 4 * 86400000); // Day 5
        const gameWindowEnd = new Date(campStart.getTime() + (campDays - 3) * 86400000); // 3 days before end
        const windowDays = Math.floor((gameWindowEnd - gameWindowStart) / 86400000);
        const daysBetweenGames = Math.max(2, Math.floor(windowDays / gamesPerTeam));

        for (let gameNum = 0; gameNum < gamesPerTeam; gameNum++) {
            const gameDate = new Date(gameWindowStart.getTime() + gameNum * daysBetweenGames * 86400000);
            const dateStr = `${gameDate.getFullYear()}-${String(gameDate.getMonth() + 1).padStart(2, '0')}-${String(gameDate.getDate()).padStart(2, '0')}`;

            // Create matchups — shuffle teams and pair them
            const shuffled = [...teams].sort(() => Math.random() - 0.5);
            for (let i = 0; i < shuffled.length - 1; i += 2) {
                if (teamGames[shuffled[i].id] >= gamesPerTeam) continue;
                if (teamGames[shuffled[i + 1].id] >= gamesPerTeam) continue;

                schedule.push({
                    homeTeamId: shuffled[i].id,
                    awayTeamId: shuffled[i + 1].id,
                    date: dateStr,
                    played: false,
                    preseason: true,
                });
                teamGames[shuffled[i].id]++;
                teamGames[shuffled[i + 1].id]++;
            }
        }

        return schedule;
    }

    // ═══════════════════════════════════════════════════════════════════
    // FOCUS POOL SIZE (future: coach-dependent)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Get the focus pool size for a team.
     * Currently flat (BASE_FOCUS_POOL). Future: scales with head coach
     * overall rating and number/quality of assistant coaches.
     *
     * @param {Object} team
     * @returns {number} Number of focuses available
     */
    static getFocusPoolSize(team) {
        // Future hook: const coach = team.coach;
        // const assistantBonus = team.assistantCoaches?.length * 1 || 0;
        // return BASE_FOCUS_POOL + Math.floor((coach.overall - 50) / 15) + assistantBonus;
        return this.BASE_FOCUS_POOL;
    }
}
