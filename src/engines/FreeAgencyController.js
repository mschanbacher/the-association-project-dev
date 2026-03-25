// ═══════════════════════════════════════════════════════════════════
// FreeAgencyController — Orchestrates Free Agency
// ═══════════════════════════════════════════════════════════════════
// Session E migration: 27 → 0 getElementById calls. All UI via React
// (FreeAgencyModal.jsx, OffseasonHub.jsx).
// Business logic preserved: enrichment, AI offers, signings, results.
// ═══════════════════════════════════════════════════════════════════

export class FreeAgencyController {
    constructor(ctx) {
        this.ctx = ctx;

        // ── Offseason modal state ──
        this.selectedIds = new Set();       // player IDs user has checked
        this.formerPlayers = [];            // cached: ex-team players
        this.otherPlayers = [];             // cached: everyone else (capped)
        this.hiddenCount = 0;              // how many low-rated players hidden
    }

    // ═══════════════════════════════════════════════════════════════
    //  Offseason Free Agency — Show (enrichment + React handoff)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Open the offseason free agency modal.
     * Called from OffseasonController when FA phase begins.
     */
    show() {
        const { gameState, engines, helpers } = this.ctx;
        const { SalaryCapEngine, TeamFactory, ScoutingEngine } = engines;
        const { formatCurrency } = helpers;
        const userTeam = helpers.getUserTeam();

        // Reset selection state
        this.selectedIds = new Set();

        // Cap info
        const capSpace = SalaryCapEngine.getRemainingCap(userTeam);

        // Split free agents into former players and others
        const formerPlayers = gameState.freeAgents
            .filter(p => p.previousTeamId && p.previousTeamId === userTeam.id)
            .sort((a, b) => b.rating - a.rating);

        const otherPlayers = gameState.freeAgents
            .filter(p => !p.previousTeamId || p.previousTeamId !== userTeam.id)
            .sort((a, b) => b.rating - a.rating);

        // Pre-select former players
        formerPlayers.forEach(p => this.selectedIds.add(String(p.id)));

        // Cap visible list for performance
        const MAX_OTHER = 150;
        this.formerPlayers = formerPlayers;
        this.otherPlayers = otherPlayers.slice(0, MAX_OTHER);
        this.hiddenCount = otherPlayers.length - this.otherPlayers.length;

        // Pre-compute player data for React
        const enrichPlayer = (p, isFormer) => {
            const fit = ScoutingEngine.calculateTeamFit(p, userTeam, userTeam.coach);
            const marketValue = TeamFactory.getMarketValue(p, userTeam.tier);
            const natTier = TeamFactory.getPlayerNaturalTier(p);
            const minOffer = Math.round(marketValue * 0.8);
            const maxOffer = Math.round(marketValue * 1.2);
            const suggestedYears = TeamFactory.determineContractLength(p.age, p.rating);
            const previousTeam = p.previousTeamId ? helpers.getTeamById(p.previousTeamId) : null;

            p._fitGrade = fit.grade;
            p._fitColor = ScoutingEngine.gradeColor(fit.grade);
            p._marketValue = marketValue;
            p._minOffer = minOffer;
            p._maxOffer = maxOffer;
            p._suggestedYears = suggestedYears;
            p._naturalTier = natTier;
            p._isAboveTier = natTier < userTeam.tier;
            p._isFormer = isFormer;
            p._isWatched = this._isOnWatchList(p.id);
            // Structured market data for React rendering
            const TF = window.TeamFactory;
            const tierValue = TF ? TF.getMarketValue(p, userTeam.tier) : (p.salary || 0);
            const natTierColors = { 1: '#ff6b6b', 2: '#4ecdc4', 3: '#95afc0' };
            p._marketData = {
                value: formatCurrency(tierValue),
                natTier: natTier,
                badgeColor: natTierColors[natTier] || '#95afc0',
                crossTierValue: (natTier < userTeam.tier && TF) ? formatCurrency(TF.getNaturalMarketValue(p)) : null,
            };
            p._fromTeamName = isFormer ? userTeam.name : (previousTeam ? previousTeam.name : (p.isCollegeGrad ? '' + p.college : 'N/A'));
            return p;
        };

        const enrichedFormer = formerPlayers.map(p => enrichPlayer(p, true));
        const enrichedOther = this.otherPlayers.map(p => enrichPlayer(p, false));

        // Submit callback — React calls this with offer data
        window._faSubmitOffers = (offerData) => {
            gameState.userFreeAgencyOffers = offerData.map(o => ({
                teamId: userTeam.id,
                playerId: o.playerId,
                salary: o.salary,
                years: o.years,
                tier: userTeam.tier,
                teamRating: userTeam.rating,
                teamSuccess: userTeam.wins / (userTeam.wins + userTeam.losses || 1)
            }));
            this._processAndShowReactResults();
        };

        if (window._reactShowFA) {
            window._reactShowFA({
                phase: 'select',
                formerPlayers: enrichedFormer,
                otherPlayers: enrichedOther,
                hiddenCount: this.hiddenCount,
                roster: [...(userTeam.roster || [])].sort((a, b) => b.rating - a.rating),
                capSpace,
                formatCurrency,
                getTeamById: (id) => helpers.getTeamById(id),
            });
        }
    }

    /**
     * Helper: check watch list via RosterController
     */
    _isOnWatchList(playerId) {
        const { helpers } = this.ctx;
        return helpers.getRosterController()._isOnWatchList(playerId);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Skip
    // ═══════════════════════════════════════════════════════════════

    /**
     * Skip free agency entirely.
     */
    skip() {
        if (confirm('Are you sure you want to skip free agency? You won\'t be able to sign any free agents this off-season.')) {
            console.log('User skipped free agency');
            if (window._reactCloseFA) window._reactCloseFA();
            this.ctx.helpers.getOffseasonController().runAISigningAndContinue();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Processing pipeline
    // ═══════════════════════════════════════════════════════════════

    /**
     * Process offers and show results in React modal.
     */
    _processAndShowReactResults() {
        const { gameState, engines, helpers } = this.ctx;
        const { FreeAgencyEngine, SalaryCapEngine, TeamFactory } = engines;
        const { formatCurrency } = helpers;
        const userTeam = helpers.getUserTeam();

        // Generate AI offers
        const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
        const aiTeams = allTeams.filter(t => t.id !== userTeam.id);
        gameState.aiFreeAgencyOffers = FreeAgencyEngine.generateAIOffers(
            { freeAgents: gameState.freeAgents, aiTeams },
            { TeamFactory, SalaryCapEngine }
        );

        // Process decisions
        const results = FreeAgencyEngine.processDecisions(
            {
                freeAgents: gameState.freeAgents,
                userOffers: gameState.userFreeAgencyOffers,
                aiOffers: gameState.aiFreeAgencyOffers,
                userTeamId: userTeam.id
            },
            { SalaryCapEngine }
        );

        // Execute signings
        FreeAgencyEngine.executeSignings({
            results,
            freeAgentPool: gameState.freeAgents,
            getTeamById: helpers.getTeamById
        });

        // Show results in React
        if (window._reactShowFA) {
            window._reactShowFA({
                phase: 'results',
                results,
                formatCurrency,
                getTeamById: (id) => helpers.getTeamById(id),
                userOffers: gameState.userFreeAgencyOffers,
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Continue after FA
    // ═══════════════════════════════════════════════════════════════

    /**
     * Continue after viewing FA results.
     * Triggers AI signing phase and returns to hub (or proceeds in legacy flow).
     */
    continue() {
        const { gameState, helpers } = this.ctx;

        // Mark FA as complete so it doesn't re-trigger
        gameState._freeAgencyComplete = true;

        // Let AI teams fill remaining needs from leftover free agents
        console.log('AI teams filling remaining roster needs...');
        helpers.aiSigningPhase();
        
        helpers.saveGameState();

        // In hub mode (OffseasonHub is active), just return - the React callback handles navigation
        if (gameState.offseasonPhase) {
            console.log('[FA] Complete - hub mode detected, returning control to React');
            return;
        }
        
        // Legacy flow: proceed to roster compliance check
        helpers.getOffseasonController().checkRosterComplianceAndContinue();
    }
}
