/**
 * CoachManagementController.js
 * Handles coach hiring, firing, poaching, and the coaching market.
 * 
 * UI rendered by React CoachModal.jsx — this controller provides data
 * and handles business logic (hire/fire/poach mutations, events, save).
 */
export class CoachManagementController {
    constructor({ gameState, engines, helpers }) {
        this.gameState = gameState;
        this.CoachEngine = engines.CoachEngine;
        this.SalaryCapEngine = engines.SalaryCapEngine;
        this.getUserTeam = helpers.getUserTeam;
        this.formatCurrency = helpers.formatCurrency;
        this.saveGameState = helpers.saveGameState;
        this.getDashboardController = helpers.getDashboardController;
        this.eventBus = helpers.eventBus;
        this.GameEvents = helpers.GameEvents;

        // State: free agent coach pool (generated lazily per session)
        this.marketPool = [];
    }

    /** Open the coach management modal */
    open() {
        const userTeam = this.getUserTeam();
        if (!userTeam) return;
        const coach = userTeam.coach;
        const synergy = coach ? this.CoachEngine.calculateSynergy(coach, userTeam.roster) : null;

        if (window._reactShowCoach) {
            if (this.marketPool.length === 0) {
                this.marketPool = this.CoachEngine.generateCoachPool(10, userTeam.tier);
            }
            const tierTeams = this.gameState.getTeamsByTier(userTeam.tier);
            const poachable = tierTeams
                .filter(t => t.id !== userTeam.id && t.coach)
                .map(t => {
                    const syn = this.CoachEngine.calculateSynergy(t.coach, userTeam.roster);
                    const buyout = this.CoachEngine.calculateBuyoutCost(t.coach);
                    const topTraits = Object.entries(t.coach.traits)
                        .sort(([,a],[,b]) => b - a).slice(0, 3)
                        .map(([key, val]) => this.CoachEngine.TRAITS[key].icon + ' ' + this.CoachEngine.TRAITS[key].name + ': ' + val)
                        .join(' \u00b7 ');
                    return { ...t.coach, _fromTeam: t.name, _fromTeamId: t.id,
                        _synergyGrade: syn.grade, _synergyScore: syn.score,
                        _buyout: buyout, _topTraits: topTraits };
                })
                .sort((a, b) => b.overall - a.overall).slice(0, 8);
            const freeAgents = this.marketPool.map(c => {
                const syn = this.CoachEngine.calculateSynergy(c, userTeam.roster);
                const topTraits = Object.entries(c.traits)
                    .sort(([,a],[,b]) => b - a).slice(0, 3)
                    .map(([key, val]) => this.CoachEngine.TRAITS[key].icon + ' ' + this.CoachEngine.TRAITS[key].name + ': ' + val)
                    .join(' \u00b7 ');
                return { ...c, _synergyGrade: syn.grade, _synergyScore: syn.score, _topTraits: topTraits };
            });
            window._reactShowCoach({
                coach, synergy,
                traits: this.CoachEngine.TRAITS,
                freeAgents, poachable,
                formatCurrency: this.formatCurrency,
                getOverallColor: (v) => this.CoachEngine.getOverallColor(v),
                getTraitColor: (v) => this.CoachEngine.getTraitColor(v),
                getTraitLabel: (k, v) => this.CoachEngine.getTraitLabel(k, v),
            });
        }
    }

    /** Close the coach management modal */
    close() {
        // Legacy — React CoachModal handles close via onClose prop
    }

    /** Show the coaching market (free agents + poachable) */
    showMarket() {
        // Legacy — React CoachModal handles market display via MarketSection
    }

    /** Switch between free agent and poach tabs */
    showTab(tab) {
        // Legacy — React CoachModal manages tab state via useState
    }

    /** Hire a coach (from free agent pool or poached from another team) */
    hire(coachId, isPoach) {
        const userTeam = this.getUserTeam();
        if (!userTeam) return;

        let newCoach = null;

        if (isPoach) {
            const tierTeams = this.gameState.getTeamsByTier(userTeam.tier);
            const sourceTeam = tierTeams.find(t => t.coach && t.coach.id === coachId);
            if (!sourceTeam) { alert('Coach no longer available.'); return; }

            const buyout = this.CoachEngine.calculateBuyoutCost(sourceTeam.coach);
            if (!confirm(`Poach ${sourceTeam.coach.name} from ${sourceTeam.name}?\n\nBuyout cost: ${this.SalaryCapEngine.formatCurrency(buyout)}\nSalary: ${this.SalaryCapEngine.formatCurrency(sourceTeam.coach.salary)}/yr\n\nThis will remove their coach and may affect their performance.`)) return;

            newCoach = sourceTeam.coach;
            // Give the source team a replacement coach (lower quality)
            sourceTeam.coach = this.CoachEngine.generateCoach(sourceTeam.tier);
            sourceTeam.coach.overall = Math.max(35, sourceTeam.coach.overall - 10);
            sourceTeam.coach.teamId = sourceTeam.id;
            sourceTeam.coach.archetype = 'Interim ' + sourceTeam.coach.archetype;
            console.log(`🔄 ${sourceTeam.name} assigned interim coach: ${sourceTeam.coach.name}`);
        } else {
            newCoach = this.marketPool.find(c => c.id === coachId);
            if (!newCoach) { alert('Coach no longer available.'); return; }

            if (!confirm(`Hire ${newCoach.name}?\n\nOverall: ${newCoach.overall}\nSalary: ${this.SalaryCapEngine.formatCurrency(newCoach.salary)}/yr × ${newCoach.contractYears} years\nStyle: ${newCoach.archetype}`)) return;

            // Remove from pool
            this.marketPool = this.marketPool.filter(c => c.id !== coachId);
        }

        // If team already has a coach, release them
        if (userTeam.coach) {
            console.log(`🚪 Released coach: ${userTeam.coach.name}`);
            userTeam.coach.teamId = null;
        }

        // Assign new coach
        newCoach.teamId = userTeam.id;
        newCoach.tier = userTeam.tier;
        userTeam.coach = newCoach;

        console.log(`✅ Hired coach: ${newCoach.name} (${newCoach.overall} OVR) for ${userTeam.name}`);

        this.eventBus.emit(this.GameEvents.TEAM_COACH_HIRED, {
            teamId: userTeam.id,
            teamName: userTeam.name,
            coachName: newCoach.name,
            coachOverall: newCoach.overall,
            archetype: newCoach.archetype,
            isPoach: isPoach
        });

        this.saveGameState();
        this.getDashboardController().refresh();
        this.open(); // Refresh the modal
    }

    /** Fire the current coach */
    fire() {
        const userTeam = this.getUserTeam();
        if (!userTeam || !userTeam.coach) return;

        const coach = userTeam.coach;
        const severance = Math.round(coach.salary * Math.max(1, coach.contractYears) * 0.5);

        if (!confirm(`Fire ${coach.name}?\n\nSeverance cost: ${this.SalaryCapEngine.formatCurrency(severance)}\nRemaining contract: ${coach.contractYears} year(s)\n\nYour team will operate without a head coach until you hire a replacement, which will negatively affect performance.`)) return;

        console.log(`🚪 Fired coach: ${coach.name}`);

        this.eventBus.emit(this.GameEvents.TEAM_COACH_FIRED, {
            teamId: userTeam.id,
            teamName: userTeam.name,
            coachName: coach.name,
            coachOverall: coach.overall,
            severance: severance
        });

        coach.teamId = null;
        userTeam.coach = null;

        this.saveGameState();
        this.getDashboardController().refresh();
        this.open(); // Refresh the modal
    }

}
