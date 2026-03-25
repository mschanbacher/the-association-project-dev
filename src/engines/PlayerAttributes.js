// ═══════════════════════════════════════════════════════════════════
// PlayerAttributes — Player generation, attributes, development
// ═══════════════════════════════════════════════════════════════════

export class PlayerAttributes {

    // ─────────────────────────────────────────────────────────────────────────
    // PHYSICAL MEASURABLES — realistic ranges by position
    // ─────────────────────────────────────────────────────────────────────────

    static MEASURABLE_RANGES = {
        PG: { height: [72, 77], weight: [175, 200], wingspanBonus: [1, 6] },
        SG: { height: [74, 79], weight: [185, 215], wingspanBonus: [1, 6] },
        SF: { height: [77, 82], weight: [210, 240], wingspanBonus: [1, 7] },
        PF: { height: [79, 84], weight: [225, 255], wingspanBonus: [2, 7] },
        C:  { height: [81, 88], weight: [240, 280], wingspanBonus: [2, 8] }
    };

    // Position-average height for measurable bonus calculation
    static POSITION_AVG_HEIGHT = { PG: 74.5, SG: 76.5, SF: 79.5, PF: 81.5, C: 84.5 };
    static POSITION_AVG_WINGSPAN = { PG: 78, SG: 80.5, SF: 84, PF: 86.5, C: 90 };

    // ─────────────────────────────────────────────────────────────────────────
    // OFFENSIVE RATING WEIGHTS BY POSITION
    // ─────────────────────────────────────────────────────────────────────────
    // Clutch weighs heavily (scoring under pressure). IQ drives playmaking.
    // Speed enables transition offense. Strength/vert for interior scoring.
    // Intangibles (workEthic, coachability, collaboration) excluded — they
    // act as standalone modifiers in other systems, not raw basketball ability.

    static OFF_RATING_WEIGHTS = {
        PG: { speed: 0.25, basketballIQ: 0.30, endurance: 0.08, verticality: 0.05, strength: 0.05, clutch: 0.27 },
        SG: { speed: 0.20, basketballIQ: 0.15, endurance: 0.08, verticality: 0.12, strength: 0.08, clutch: 0.37 },
        SF: { speed: 0.15, basketballIQ: 0.18, endurance: 0.08, verticality: 0.16, strength: 0.15, clutch: 0.28 },
        PF: { speed: 0.08, basketballIQ: 0.15, endurance: 0.10, verticality: 0.22, strength: 0.22, clutch: 0.23 },
        C:  { speed: 0.04, basketballIQ: 0.12, endurance: 0.10, verticality: 0.24, strength: 0.30, clutch: 0.20 },
    };

    // ─────────────────────────────────────────────────────────────────────────
    // DEFENSIVE RATING WEIGHTS BY POSITION
    // ─────────────────────────────────────────────────────────────────────────
    // Strength/vert dominate for bigs (rim protection). Speed/IQ dominate for
    // guards (lateral quickness, anticipation). Endurance reflects sustained
    // defensive effort. Clutch has minimal defensive value (2%).

    static DEF_RATING_WEIGHTS = {
        PG: { speed: 0.32, basketballIQ: 0.28, endurance: 0.22, verticality: 0.04, strength: 0.12, clutch: 0.02 },
        SG: { speed: 0.28, basketballIQ: 0.22, endurance: 0.18, verticality: 0.12, strength: 0.18, clutch: 0.02 },
        SF: { speed: 0.18, basketballIQ: 0.18, endurance: 0.16, verticality: 0.20, strength: 0.26, clutch: 0.02 },
        PF: { speed: 0.08, basketballIQ: 0.14, endurance: 0.16, verticality: 0.28, strength: 0.32, clutch: 0.02 },
        C:  { speed: 0.04, basketballIQ: 0.12, endurance: 0.14, verticality: 0.34, strength: 0.34, clutch: 0.02 },
    };

    // Composite rating blend: offense is slightly more valuable for overall impact
    static OFF_DEF_BLEND = { off: 0.55, def: 0.45 };

    // ─────────────────────────────────────────────────────────────────────────
    // ATTRIBUTE DEFINITIONS (for display)
    // ─────────────────────────────────────────────────────────────────────────

    static PHYSICAL_ATTRS = {
        speed:       { name: 'Speed',       icon: null, desc: 'Fast break, transition, blow-by scoring' },
        strength:    { name: 'Strength',    icon: null, desc: 'Post play, rebounding, finishing through contact' },
        verticality: { name: 'Verticality', icon: null, desc: 'Blocks, dunks, shot contest, rebounding' },
        endurance:   { name: 'Endurance',   icon: null, desc: 'Fatigue resistance, minutes capacity' }
    };

    static MENTAL_ATTRS = {
        basketballIQ:  { name: 'Basketball IQ',  icon: null, desc: 'Decision-making, assists, turnovers, positioning' },
        clutch:        { name: 'Clutch',          icon: null, desc: 'Playoff performance, close game composure' },
        workEthic:     { name: 'Work Ethic',      icon: null, desc: 'Offseason development rate' },
        coachability:  { name: 'Coachability',    icon: null, desc: 'System absorption, coach modifier effectiveness' },
        collaboration: { name: 'Collaboration',   icon: null, desc: 'Locker room impact, team chemistry effect' }
    };

    static ALL_ATTR_KEYS = ['speed', 'strength', 'verticality', 'endurance', 'basketballIQ', 'clutch', 'workEthic', 'coachability', 'collaboration'];

    // Position-specific attribute biases (which attrs are naturally higher)
    // Values are additive bonuses to the base generation
    static POSITION_ATTR_BIASES = {
        PG: { speed: 10, basketballIQ: 8, collaboration: 3, strength: -8, verticality: -5 },
        SG: { speed: 5, clutch: 5, verticality: 2, strength: -3 },
        SF: { verticality: 3, speed: 2, strength: 2 },
        PF: { strength: 8, verticality: 5, speed: -5, basketballIQ: -2 },
        C:  { strength: 10, verticality: 6, speed: -10, basketballIQ: -3 }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // GENERATE ATTRIBUTES FOR A NEW PLAYER
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generate full attributes for a player
     * @param {string} position - Player position
     * @param {number} tier - Tier level (affects base attribute ranges)
     * @param {number} age - Player age (young players may have higher physical ceilings)
     * @returns {Object} { measurables: {...}, attributes: {...}, rating: number }
     */
    static generate(position, tier, age) {
        const measurables = this._generateMeasurables(position);
        const attributes = this._generateSkillAttributes(position, tier, age);
        const offRating = this.calculateOffRating(position, attributes, measurables);
        const defRating = this.calculateDefRating(position, attributes, measurables);
        const rating = this.calculateRating(position, attributes, measurables);
        return { measurables, attributes, rating, offRating, defRating };
    }

    /**
     * Generate physical measurables
     */
    static _generateMeasurables(position) {
        const ranges = this.MEASURABLE_RANGES[position] || this.MEASURABLE_RANGES['SF'];

        // Height: normal distribution centered in range, with rare outliers
        let height = this._gaussianInRange(ranges.height[0], ranges.height[1]);
        // 3% chance of outlier (±2-3 inches beyond range)
        if (Math.random() < 0.03) {
            height += (Math.random() < 0.5 ? -1 : 1) * (2 + Math.floor(Math.random() * 2));
        }
        height = Math.max(ranges.height[0] - 3, Math.min(ranges.height[1] + 4, Math.round(height)));

        // Weight: correlated with height
        const heightPct = (height - ranges.height[0]) / Math.max(1, ranges.height[1] - ranges.height[0]);
        const baseWeight = ranges.weight[0] + heightPct * (ranges.weight[1] - ranges.weight[0]);
        const weight = Math.round(baseWeight + (Math.random() - 0.5) * 20);

        // Wingspan: height + bonus, with variance
        const [minBonus, maxBonus] = ranges.wingspanBonus;
        const wingspanBonus = minBonus + Math.random() * (maxBonus - minBonus);
        // 5% chance of exceptional wingspan (+2-3 extra)
        const exceptional = Math.random() < 0.05 ? 2 + Math.random() * 1.5 : 0;
        const wingspan = Math.round(height + wingspanBonus + exceptional);

        return { height, weight, wingspan };
    }

    /**
     * Generate the 9 skill attributes (1-100 scale)
     */
    static _generateSkillAttributes(position, tier, age) {
        // Base attribute range by tier
        const tierRanges = {
            1: { min: 55, max: 95, center: 75 },
            2: { min: 40, max: 82, center: 63 },
            3: { min: 30, max: 72, center: 52 }
        };
        const range = tierRanges[tier] || tierRanges[2];
        const biases = this.POSITION_ATTR_BIASES[position] || {};

        const attrs = {};
        for (const key of this.ALL_ATTR_KEYS) {
            // Start with a base centered on tier range
            let base = range.center + (Math.random() - 0.5) * (range.max - range.min) * 0.7;

            // Apply position bias
            base += (biases[key] || 0);

            // Young players: slightly higher physical ceiling, lower mental floor
            if (age <= 22) {
                if (['speed', 'verticality', 'endurance'].includes(key)) base += Math.random() * 4;
                if (['basketballIQ', 'clutch'].includes(key)) base -= Math.random() * 5;
            }
            // Veterans: higher mental, declining physical
            if (age >= 32) {
                if (['speed', 'verticality', 'endurance'].includes(key)) base -= (age - 31) * 1.5;
                if (['basketballIQ', 'clutch', 'collaboration'].includes(key)) base += Math.random() * 6;
            }

            attrs[key] = Math.max(15, Math.min(99, Math.round(base)));
        }

        // Add internal variance — not all attributes should be the same level
        // Pick 1-2 to be notably higher, 1-2 notably lower
        const keys = [...this.ALL_ATTR_KEYS];
        const spike1 = keys[Math.floor(Math.random() * keys.length)];
        const spike2 = keys[Math.floor(Math.random() * keys.length)];
        attrs[spike1] = Math.min(99, attrs[spike1] + 5 + Math.floor(Math.random() * 8));
        attrs[spike2] = Math.min(99, attrs[spike2] + 3 + Math.floor(Math.random() * 6));
        const dip1 = keys[Math.floor(Math.random() * keys.length)];
        attrs[dip1] = Math.max(15, attrs[dip1] - 5 - Math.floor(Math.random() * 8));

        return attrs;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CALCULATE RATINGS FROM ATTRIBUTES
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Calculate offensive rating from attributes + measurables.
     * Reflects scoring ability, playmaking, and clutch performance.
     */
    static calculateOffRating(position, attributes, measurables) {
        return this._calcWeightedRating(
            this.OFF_RATING_WEIGHTS[position] || this.OFF_RATING_WEIGHTS['SF'],
            attributes, measurables, position,
            { heightScale: 0.25, wingspanScale: 0.15 } // Measurables less important for offense
        );
    }

    /**
     * Calculate defensive rating from attributes + measurables.
     * Reflects rim protection, on-ball defense, and effort.
     */
    static calculateDefRating(position, attributes, measurables) {
        return this._calcWeightedRating(
            this.DEF_RATING_WEIGHTS[position] || this.DEF_RATING_WEIGHTS['SF'],
            attributes, measurables, position,
            { heightScale: 0.35, wingspanScale: 0.30 } // Measurables matter more for defense
        );
    }

    /**
     * Composite rating: weighted blend of offensive and defensive ratings.
     * This is the number used for trades, free agency, draft, and general display.
     */
    static calculateRating(position, attributes, measurables) {
        const off = this.calculateOffRating(position, attributes, measurables);
        const def = this.calculateDefRating(position, attributes, measurables);
        return Math.max(40, Math.min(99, Math.round(
            off * this.OFF_DEF_BLEND.off + def * this.OFF_DEF_BLEND.def
        )));
    }

    /**
     * Internal: weighted sum of attributes with measurables bonus.
     */
    static _calcWeightedRating(weights, attributes, measurables, position, measScales) {
        let weightedSum = 0;
        let totalWeight = 0;
        for (const [attr, weight] of Object.entries(weights)) {
            weightedSum += (attributes[attr] || 50) * weight;
            totalWeight += weight;
        }
        let rating = weightedSum / totalWeight;

        // Measurables bonus: height and wingspan above position average
        if (measurables) {
            const avgH = this.POSITION_AVG_HEIGHT[position] || 79;
            const avgW = this.POSITION_AVG_WINGSPAN[position] || 84;
            rating += (measurables.height - avgH) * measScales.heightScale;
            rating += (measurables.wingspan - avgW) * measScales.wingspanScale;
        }

        return Math.max(40, Math.min(99, Math.round(rating)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REVERSE-ENGINEER ATTRIBUTES FROM EXISTING RATING (migration)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * For existing players with only a rating, generate plausible attributes
     * that would produce approximately that rating.
     */
    static generateFromRating(position, targetRating, tier, age) {
        // Generate measurables normally
        const measurables = this._generateMeasurables(position);

        // Start with attributes centered around the target rating
        const biases = this.POSITION_ATTR_BIASES[position] || {};
        const attrs = {};

        for (const key of this.ALL_ATTR_KEYS) {
            let base = targetRating + (biases[key] || 0);
            // Add variance for differentiation
            base += (Math.random() - 0.5) * 20;
            // Age adjustments
            if (age <= 22 && ['speed', 'verticality', 'endurance'].includes(key)) base += Math.random() * 3;
            if (age >= 32 && ['speed', 'verticality'].includes(key)) base -= (age - 31) * 1.2;
            if (age >= 32 && ['basketballIQ', 'clutch', 'collaboration'].includes(key)) base += Math.random() * 4;
            attrs[key] = Math.max(15, Math.min(99, Math.round(base)));
        }

        // Add spike/dip variance
        const keys = [...this.ALL_ATTR_KEYS];
        const spike = keys[Math.floor(Math.random() * keys.length)];
        attrs[spike] = Math.min(99, attrs[spike] + 5 + Math.floor(Math.random() * 6));
        const dip = keys[Math.floor(Math.random() * keys.length)];
        attrs[dip] = Math.max(15, attrs[dip] - 5 - Math.floor(Math.random() * 6));

        // Now iteratively adjust to hit target rating
        let currentRating = this.calculateRating(position, attrs, measurables);
        // Use offensive weights for iteration — they dominate the composite (55%)
        const iterWeights = this.OFF_RATING_WEIGHTS[position] || this.OFF_RATING_WEIGHTS['SF'];
        let iterations = 0;
        while (Math.abs(currentRating - targetRating) > 1 && iterations < 20) {
            const diff = targetRating - currentRating;
            // Spread the adjustment across the heaviest-weighted attributes
            const sortedAttrs = Object.entries(iterWeights).sort((a, b) => b[1] - a[1]);
            for (let i = 0; i < Math.min(4, sortedAttrs.length); i++) {
                const [attrKey] = sortedAttrs[i];
                attrs[attrKey] = Math.max(15, Math.min(99, Math.round(attrs[attrKey] + diff * 0.5)));
            }
            currentRating = this.calculateRating(position, attrs, measurables);
            iterations++;
        }

        const finalOffRating = this.calculateOffRating(position, attrs, measurables);
        const finalDefRating = this.calculateDefRating(position, attrs, measurables);
        return { measurables, attributes: attrs, rating: currentRating, offRating: finalOffRating, defRating: finalDefRating };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DEVELOPMENT — attribute-level growth
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Apply offseason development at the attribute level.
     * Physical attrs decline with age, mental attrs can grow.
     * Work Ethic and coach bonus affect growth rate.
     * Returns the new derived rating.
     */
    static applyDevelopment(player, coachDevBonus = 0) {
        if (!player.attributes) return player.rating;

        const age = player.age;
        const workEthic = player.attributes.workEthic || 50;
        // Work ethic modifier: 0.5x to 1.5x
        const weMod = 0.5 + (workEthic / 100);
        // Coach development bonus (from CoachEngine.getDevelopmentBonus, already age-scaled)
        const coachMod = coachDevBonus;

        for (const key of this.ALL_ATTR_KEYS) {
            let change = 0;
            const isPhysical = ['speed', 'strength', 'verticality', 'endurance'].includes(key);
            const isMental = ['basketballIQ', 'clutch', 'coachability', 'collaboration'].includes(key);
            const isWorkEthicAttr = key === 'workEthic';

            if (age <= 21) {
                // Young: physical grow fast, mental grow moderate
                change = isPhysical ? (1.5 + Math.random() * 2.5) : isMental ? (0.5 + Math.random() * 2) : 0;
            } else if (age <= 24) {
                change = isPhysical ? (0.5 + Math.random() * 1.5) : isMental ? (0.5 + Math.random() * 1.5) : 0;
            } else if (age <= 27) {
                change = isPhysical ? (Math.random() * 1) : isMental ? (Math.random() * 1.5) : 0;
            } else if (age <= 29) {
                change = isPhysical ? (-0.5 + Math.random() * 0.5) : isMental ? (Math.random() * 1) : 0;
            } else if (age <= 32) {
                change = isPhysical ? (-1.5 + Math.random() * 0.5) : isMental ? (-0.5 + Math.random() * 1) : 0;
            } else if (age <= 35) {
                change = isPhysical ? (-2.5 + Math.random() * 0.5) : isMental ? (-0.5 + Math.random() * 0.5) : 0;
            } else {
                change = isPhysical ? (-3.5 + Math.random() * 0.5) : isMental ? (-1 + Math.random() * 0.5) : 0;
            }

            // Work ethic amplifies positive growth, reduces decline
            if (change > 0) {
                change *= weMod;
                change += coachMod * 0.3; // Coach bonus spread across attributes
            } else {
                change *= (2 - weMod); // High work ethic reduces decline
            }

            // Work ethic itself changes very slowly
            if (isWorkEthicAttr) change *= 0.2;

            player.attributes[key] = Math.max(15, Math.min(99, Math.round(player.attributes[key] + change)));
        }

        // Recalculate derived ratings
        player.offRating = this.calculateOffRating(player.position, player.attributes, player.measurables);
        player.defRating = this.calculateDefRating(player.position, player.attributes, player.measurables);
        const newRating = this.calculateRating(player.position, player.attributes, player.measurables);
        return newRating;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DISPLAY HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Format height in feet-inches
     */
    static formatHeight(inches) {
        const feet = Math.floor(inches / 12);
        const remainInches = inches % 12;
        return `${feet}'${remainInches}"`;
    }

    /**
     * Format wingspan in feet-inches
     */
    static formatWingspan(inches) {
        return this.formatHeight(inches);
    }

    /**
     * Get attribute color for UI
     */
    static getAttrColor(value) {
        if (value >= 85) return 'var(--color-rating-elite)';
        if (value >= 75) return 'var(--color-rating-good)';
        if (value >= 65) return 'var(--color-rating-avg)';
        if (value >= 55) return 'var(--color-warning)';
        if (value >= 45) return 'var(--color-rating-below)';
        return 'var(--color-rating-poor)';
    }

    /**
     * Gaussian random within a range (centered)
     */
    static _gaussianInRange(min, max) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(Math.max(0.0001, u1))) * Math.cos(2 * Math.PI * u2);
        const center = (min + max) / 2;
        const spread = (max - min) / 4; // ~95% within range
        return center + z * spread;
    }

    /**
     * Ensure a player has attributes (backward compatibility)
     * If they don't, generate from their existing rating.
     */
    static ensureAttributes(player) {
        const needsMigration = !player.attributes || !player.measurables;
        if (needsMigration) {
            const pos = player.position || 'SF';
            const tier = player.tier || 1;
            const age = player.age || 25;
            const targetRating = player.rating || 70;
            const generated = this.generateFromRating(pos, targetRating, tier, age);
            player.measurables = generated.measurables;
            player.attributes = generated.attributes;
            // Keep original rating if it exists; don't overwrite on migration
            if (!player.rating) player.rating = generated.rating;
        }
        // Always ensure offRating/defRating are present (derived from attributes)
        if (player.offRating === undefined || player.defRating === undefined) {
            const pos = player.position || 'SF';
            player.offRating = this.calculateOffRating(pos, player.attributes, player.measurables);
            player.defRating = this.calculateDefRating(pos, player.attributes, player.measurables);
        }
        // Consistency check: if off/def don't produce the stored overall within ±3,
        // the stored values are stale. Recalculate to restore consistency.
        if (player.attributes && player.measurables && player.rating) {
            const pos = player.position || 'SF';
            const expectedOverall = this.calculateRating(pos, player.attributes, player.measurables);
            if (Math.abs(expectedOverall - player.rating) > 3) {
                // Overall has drifted from what the attributes would produce —
                // recalculate all three from attributes to restore consistency.
                player.offRating = this.calculateOffRating(pos, player.attributes, player.measurables);
                player.defRating = this.calculateDefRating(pos, player.attributes, player.measurables);
                player.rating    = expectedOverall;
            }
        }
        return needsMigration;
    }
}
