// ═══════════════════════════════════════════════════════════════════
// CoachEngine — Coach generation, traits, game modifiers, development
// ═══════════════════════════════════════════════════════════════════

export class CoachEngine {

    // ─────────────────────────────────────────────────────────────────────────
    // COACH TRAIT DEFINITIONS
    // ─────────────────────────────────────────────────────────────────────────
    // 7 core traits, each on a 1-100 scale (50 = league average).
    
    static TRAITS = {
 pace: { name: 'Pace', description: 'Tempo of play — high pace pushes more possessions', icon: null, lowLabel: 'Slow & Methodical', highLabel: 'Run & Gun' },
 threePointTendency: { name: '3PT Tendency', description: 'Emphasis on three-point shooting', icon: null, lowLabel: 'Paint-Focused', highLabel: 'Three-Point Heavy' },
 defensiveIntensity: { name: 'Defensive Intensity', description: 'Aggressive defense creates turnovers but more fouls', icon: null, lowLabel: 'Conservative', highLabel: 'Aggressive Pressure' },
 ballMovement: { name: 'Ball Movement', description: 'Team passing vs isolation plays', icon: null, lowLabel: 'Star Isolation', highLabel: 'Motion Offense' },
        benchUsage: { name: 'Bench Usage', description: 'How deep the rotation goes', icon: '🪑', lowLabel: 'Tight 7-Man', highLabel: 'Deep 11-Man' },
 playerDevelopment: { name: 'Player Development', description: 'Ability to improve young players', icon: null, lowLabel: 'Win-Now Focus', highLabel: 'Development Guru' },
 adaptability: { name: 'Adaptability', description: 'Adjusts strategy to exploit opponent weaknesses', icon: '', lowLabel: 'Rigid System', highLabel: 'Highly Adaptive' }
    };

    static ARCHETYPES = {
        uptempo:     { name: 'Uptempo Innovator',    biases: { pace: [70,95], threePointTendency: [60,90], defensiveIntensity: [30,60], ballMovement: [55,80], benchUsage: [55,80] }, weight: 15 },
        defensive:   { name: 'Defensive Mastermind',  biases: { pace: [25,55], threePointTendency: [30,60], defensiveIntensity: [70,95], ballMovement: [45,70], benchUsage: [40,65] }, weight: 15 },
        balanced:    { name: 'Balanced Tactician',    biases: { pace: [40,65], threePointTendency: [40,65], defensiveIntensity: [45,70], ballMovement: [50,75], benchUsage: [45,65] }, weight: 20 },
        playersCoach:{ name: "Player's Coach",        biases: { pace: [45,70], threePointTendency: [40,70], defensiveIntensity: [35,60], ballMovement: [55,80], benchUsage: [60,85] }, weight: 15 },
        oldSchool:   { name: 'Old School Grinder',    biases: { pace: [20,45], threePointTendency: [15,45], defensiveIntensity: [60,85], ballMovement: [30,55], benchUsage: [30,55] }, weight: 10 },
        analytics:   { name: 'Analytics-Driven',      biases: { pace: [55,80], threePointTendency: [65,95], defensiveIntensity: [45,70], ballMovement: [60,85], benchUsage: [50,75] }, weight: 15 },
        developer:   { name: 'Youth Developer',       biases: { pace: [45,70], threePointTendency: [40,70], defensiveIntensity: [40,65], ballMovement: [50,75], benchUsage: [65,90] }, weight: 10 }
    };

    static COACH_FIRST_NAMES = [
        'Mike','Steve','Tom','Bill','Rick','Doc','Pat','Greg','Jeff','Mark',
        'Phil','Dan','Larry','Terry','George','Bob','Nate','Nick','Sam','Erik',
        'Jason','Scott','Brian','Dave','Monty','Dwane','Tyronn','Kenny','Ime',
        'Chauncey','Jamahl','Wes','Darvin','Adrian','J.B.','Will','Taylor',
        'Charles','Alvin','Byron','Keith','Frank','Stan','Chris','Joe',
        'Fred','Quin','Michael','Vinny','Jacque','Lionel','Tony','Avery',
        'Flip','Don','Kevin','Leo','Richie','Paul','Rod','Cal'
    ];

    static COACH_LAST_NAMES = [
        'Brown','Malone','Kerr','Rivers','Spoelstra','Popovich','Nurse','Williams',
        'Budenholzer','Snyder','Donovan','Carlisle','Jenkins','Bickerstaff','Lue',
        'Atkinson','Borrego','Casey','Clifford','McMillan','Nash','Stotts',
        'Thibodeau','Udoka','Unseld','Vaughn','Walton','Green','Finch',
        'Ham','Hardy','Griffin','Mosley','Rajakovic','Redick','Carlin',
        'Misaka','O\'Brien','Adelman','Sloan','Riley','Jackson','Auerbach',
        'Holzman','Wilkens','Daly','Tomjanovich','Fitch','Nelson','Harris',
        'Silas','Van Gundy','D\'Antoni','Brooks','Woodson','Vogel','Kidd',
        'Blatt','Joerger','Hoiberg','Boylen','Saunders','Mitchell'
    ];

    static _nextCoachId = 10000;

    static generateCoach(tier = 1, options = {}) {
        const id = options.id || CoachEngine._nextCoachId++;
        const firstName = this.COACH_FIRST_NAMES[Math.floor(Math.random() * this.COACH_FIRST_NAMES.length)];
        const lastName = this.COACH_LAST_NAMES[Math.floor(Math.random() * this.COACH_LAST_NAMES.length)];
        const age = Math.max(35, Math.min(72, Math.floor(42 + Math.random() * 25 + (Math.random() - 0.5) * 10)));
        const experience = Math.max(1, Math.floor((age - 30) * (0.3 + Math.random() * 0.7)));
        const archetype = this._pickArchetype();

        const overallRanges = { 1: [60,95], 2: [45,82], 3: [35,72] };
        const [minOvr, maxOvr] = overallRanges[tier] || overallRanges[2];
        const expBonus = Math.min(10, experience * 0.3);
        const overall = Math.max(minOvr, Math.min(99, Math.floor(minOvr + Math.random() * (maxOvr - minOvr) + expBonus)));

        const traits = {};
        for (const traitKey of Object.keys(this.TRAITS)) {
            if (traitKey === 'playerDevelopment' || traitKey === 'adaptability') {
                traits[traitKey] = Math.max(15, Math.min(95, Math.round(overall + (Math.random() - 0.5) * 30)));
            } else {
                const bias = archetype.biases[traitKey];
                traits[traitKey] = bias
                    ? Math.max(10, Math.min(95, Math.round(bias[0] + Math.random() * (bias[1] - bias[0]))))
                    : Math.round(35 + Math.random() * 30);
            }
        }

        const salary = this._generateCoachSalary(overall, tier);
        const contractYears = options.contractYears || this._generateContractLength(overall, age);
        const seasonsCoached = Math.min(experience, Math.floor(experience * (0.6 + Math.random() * 0.4)));
        const totalGames = seasonsCoached * 60;
        const winPct = Math.max(0.20, Math.min(0.80, 0.30 + (overall / 100) * 0.40 + (Math.random() - 0.5) * 0.10));
        const careerWins = Math.round(totalGames * winPct);
        let championships = 0;
        if (overall >= 75 && seasonsCoached >= 5) {
            for (let i = 0; i < seasonsCoached; i++) {
                if (Math.random() < (overall - 70) / 200) championships++;
            }
        }

        return {
            id, name: `${firstName} ${lastName}`, age, experience,
            archetype: archetype.name, overall, traits, salary,
            contractYears, originalContractLength: contractYears,
            careerWins, careerLosses: totalGames - careerWins, championships, seasonsCoached,
            teamId: null, tier, satisfaction: 75, seasonWins: 0, seasonLosses: 0
        };
    }

    static _pickArchetype() {
        const archetypes = Object.values(this.ARCHETYPES);
        const totalWeight = archetypes.reduce((sum, a) => sum + a.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const arch of archetypes) { roll -= arch.weight; if (roll <= 0) return arch; }
        return archetypes[0];
    }

    static _generateCoachSalary(overall, tier) {
        const ranges = { 1: { min: 2000000, max: 12000000 }, 2: { min: 200000, max: 1200000 }, 3: { min: 50000, max: 300000 } };
        const r = ranges[tier] || ranges[2];
        const pct = (overall - 30) / 70;
        const base = r.min + pct * (r.max - r.min);
        return Math.round(Math.max(r.min, base + base * 0.15 * (Math.random() - 0.5) * 2));
    }

    static _generateContractLength(overall, age) {
        if (age >= 65) return 1 + Math.floor(Math.random() * 2);
        if (overall >= 80) return 3 + Math.floor(Math.random() * 3);
        if (overall >= 65) return 2 + Math.floor(Math.random() * 3);
        return 1 + Math.floor(Math.random() * 3);
    }

    static generateCoachPool(count = 8, tier = 1) {
        const pool = [];
        for (let i = 0; i < count; i++) {
            let coachTier = tier;
            const roll = Math.random();
            if (roll < 0.2 && tier > 1) coachTier = tier - 1;
            if (roll > 0.85 && tier < 3) coachTier = tier + 1;
            pool.push(this.generateCoach(coachTier));
        }
        pool.sort((a, b) => b.overall - a.overall);
        return pool;
    }

    static calculateBuyoutCost(coach) {
        if (!coach.teamId) return 0;
        return Math.round(coach.salary * (coach.contractYears || 1) * 1.5);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GAME SIMULATION MODIFIERS — called by StatEngine.generateGame()
    // ─────────────────────────────────────────────────────────────────────────

    static getGameModifiers(team) {
        const coach = team ? team.coach : null;
        if (!coach) return this._defaultModifiers();
        const t = coach.traits;
        return {
            paceModifier: (t.pace - 50) * 0.16,
            threePtRateModifier: (t.threePointTendency - 50) * 0.0027,
            defenseModifier: (t.defensiveIntensity - 50) * -0.0005,
            stealBlockMultiplier: 1.0 + (t.defensiveIntensity - 50) * 0.0045,
            foulModifier: 1.0 + (t.defensiveIntensity - 50) * 0.003,
            assistMultiplier: 1.0 + (t.ballMovement - 50) * 0.0055,
            turnoverModifier: 1.0 + (t.ballMovement - 50) * 0.002,
            benchDepth: t.benchUsage / 100,
            adaptabilityBonus: this._rollAdaptabilityBonus(t.adaptability),
            overallBonus: (coach.overall - 50) * 0.06
        };
    }

    static _defaultModifiers() {
        return { paceModifier: 0, threePtRateModifier: 0, defenseModifier: 0, stealBlockMultiplier: 1.0, foulModifier: 1.0, assistMultiplier: 1.0, turnoverModifier: 1.0, benchDepth: 0.5, adaptabilityBonus: 0, overallBonus: 0 };
    }

    static _rollAdaptabilityBonus(adaptability) {
        const normalized = (adaptability - 50) / 50;
        return Math.max(-2, Math.min(3, (Math.random() - 0.3) * 3 * normalized));
    }

    static getMinutesDistribution(coach, isPlayoffs = false) {
        const tight  = [36,36,34,32,30,16,12,8,4,2,0,0,0];
        const normal = [34,34,32,30,28,18,15,12,8,5,3,1,0];
        const deep   = [32,31,30,28,26,20,18,16,14,12,8,5,0];
        if (!coach) return isPlayoffs ? tight : normal;
        const depth = coach.traits.benchUsage;
        if (isPlayoffs) return depth >= 70 ? normal : tight;
        if (depth >= 75) return deep;
        if (depth >= 55) return normal;
        return tight;
    }

    static getDevelopmentBonus(coach, player) {
        if (!coach) return 0;
        const devRating = coach.traits.playerDevelopment;
        const age = player.age || 25;
        let ageMult = age <= 22 ? 1.5 : age <= 25 ? 1.2 : age >= 33 ? 0.2 : age >= 30 ? 0.5 : 1.0;
        return Math.max(-0.5, Math.min(3.5, ((devRating - 40) / 60) * 3 * ageMult));
    }

    static calculateSynergy(coach, roster) {
        if (!coach || !roster || roster.length === 0) return { score: 50, grade: 'C', description: 'No coach assigned' };
        let pts = 0, factors = 0;

        // Helper: get avg attribute across roster
        const avgAttr = (key) => {
            const vals = roster.map(p => (p.attributes && p.attributes[key]) || 50);
            return vals.reduce((s, v) => s + v, 0) / vals.length;
        };

        // 1. Pace vs roster Speed + Endurance (fast teams need fast, durable players)
        const rosterSpeed = (avgAttr('speed') + avgAttr('endurance')) / 2;
        const paceMatch = 1 - Math.abs((coach.traits.pace / 100) - (rosterSpeed / 100)) * 2;
        pts += Math.max(0, Math.min(1, paceMatch)); factors++;

        // 2. Ball movement vs roster Basketball IQ (motion offense needs smart players)
        const rosterIQ = avgAttr('basketballIQ');
        const ballMatch = 1 - Math.abs((coach.traits.ballMovement / 100) - (rosterIQ / 100)) * 1.8;
        pts += Math.max(0, Math.min(1, ballMatch)); factors++;

        // 3. Defensive intensity vs roster Strength + Verticality (pressure D needs physical players)
        const rosterPhysicality = (avgAttr('strength') + avgAttr('verticality')) / 2;
        const defMatch = 1 - Math.abs((coach.traits.defensiveIntensity / 100) - (rosterPhysicality / 100)) * 1.8;
        pts += Math.max(0, Math.min(1, defMatch)); factors++;

        // 4. Player development emphasis vs roster average Coachability
        const rosterCoachability = avgAttr('coachability');
        const devMatch = 1 - Math.abs((coach.traits.playerDevelopment / 100) - (rosterCoachability / 100)) * 1.5;
        pts += Math.max(0, Math.min(1, devMatch)); factors++;

        // 5. Roster collaboration average (high collab = better fit with any coach)
        const rosterCollab = avgAttr('collaboration');
        const collabBonus = rosterCollab / 100; // 0 to 1, pure bonus
        pts += collabBonus * 0.5; factors += 0.5;

        const score = Math.round(Math.max(15, Math.min(95, (pts / factors) * 100)));
        const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';
        const descs = { A:'Excellent fit — system matches roster strengths', B:'Good fit — roster complements coaching style', C:'Average fit — some alignment, some friction', D:'Poor fit — coaching style clashes with roster', F:'Terrible fit — complete system mismatch' };
        return { score, grade, description: descs[grade] };
    }

    static getTraitLabel(traitKey, value) {
        const t = this.TRAITS[traitKey];
        if (!t) return 'Average';
        if (value >= 80) return t.highLabel;
        if (value >= 60) return `Leans ${t.highLabel}`;
        if (value <= 20) return t.lowLabel;
        if (value <= 40) return `Leans ${t.lowLabel}`;
        return 'Balanced';
    }

    static getTraitColor(value) {
        if (value >= 80) return 'var(--color-rating-elite)';
        if (value >= 60) return 'var(--color-rating-good)';
        if (value >= 40) return 'var(--color-rating-avg)';
        if (value >= 20) return 'var(--color-warning)';
        return 'var(--color-rating-poor)';
    }

    static getOverallColor(overall) {
        if (overall >= 85) return 'var(--color-rating-elite)';
        if (overall >= 75) return 'var(--color-rating-good)';
        if (overall >= 65) return 'var(--color-rating-avg)';
        if (overall >= 55) return 'var(--color-warning)';
        return 'var(--color-rating-poor)';
    }

    static serializeCoach(coach) { return coach ? { ...coach } : null; }

    static advanceCoachSeason(coach) {
        if (!coach) return 'none';
        coach.age++; coach.experience++; coach.seasonsCoached++;
        coach.contractYears = Math.max(0, coach.contractYears - 1);
        coach.careerWins += coach.seasonWins; coach.careerLosses += coach.seasonLosses;
        coach.seasonWins = 0; coach.seasonLosses = 0;
        if (coach.age >= 70 && Math.random() < 0.3) return 'retired';
        if (coach.age >= 65 && Math.random() < 0.1) return 'retired';
        return 'active';
    }
}
