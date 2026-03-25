// ═══════════════════════════════════════════════════════════════════════════════
// TradeController.js — Trade system orchestration
// Manages user-initiated trades and AI trade proposals
// ═══════════════════════════════════════════════════════════════════════════════

export class TradeController {
    /**
     * @param {Object} ctx - Context with all dependencies
     * @param {Object} ctx.gameState
     * @param {Object} ctx.eventBus
     * @param {Object} ctx.GameEvents
     * @param {Object} ctx.engines - { TradeEngine, DraftEngine, ChemistryEngine }
     * @param {Object} ctx.helpers - { getUserTeam, getTeamById, getCurrentTeams, formatCurrency, getRatingColor, getEffectiveCap, calculateTeamSalary, ensureRosterExists, initializePlayerChemistry, initializeDraftPickOwnership, getPickOwner, violatesStepienRule, calculatePickValue, tradeDraftPick, applyTradePenalty, generatePositionBreakdownHTML, updateUI }
     * @param {Object} ctx.simulationController - reference to simulationController for showSeasonEnd
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.currentTrade = {
            aiTeamId: null,
            userGives: [],
            userReceives: [],
            userGivesPicks: [],
            userReceivesPicks: []
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // Trade Screen UI
    // ═══════════════════════════════════════════════════════════════════

    openTradeScreen() {
        const { gameState, helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();

        const maxGames = gameState.currentTier === 1 ? 82 : gameState.currentTier === 2 ? 60 : 40;
        const tradeDeadline = Math.floor(maxGames * 0.75);
        const seasonComplete = gameState.schedule && gameState.schedule.every(g => g.played);
        const userGamesPlayed = userTeam ? (userTeam.wins + userTeam.losses) : 0;

        if (userGamesPlayed >= tradeDeadline && !seasonComplete) {
            // React TradeScreen shows its own "past deadline" state
            // but guard here in case called from legacy path
            return;
        }

        this.currentTrade = {
            aiTeamId: null,
            userGives: [],
            userReceives: [],
            userGivesPicks: [],
            userReceivesPicks: []
        };

        if (window._reactOpenTrade) {
            window._reactOpenTrade();
        }
    }

    closeTradeScreen() {
        if (window._reactCloseTrade) window._reactCloseTrade();
    }

    loadTradePartner() {
        // Legacy — React TradeScreen manages partner selection via local state
    }

    // ═══════════════════════════════════════════════════════════════════
    // Roster & Pick Display
    // ═══════════════════════════════════════════════════════════════════

    displayTradeRosters() {
        // Legacy — React TradeScreen RosterColumn handles roster display
    }

    displayTradePicks() {
        // Legacy — React TradeScreen PicksColumn handles pick display
    }


    toggleUserTradePlayer(playerId) {
        // Legacy — React TradeScreen manages player selection via local state
    }

    toggleAiTradePlayer(playerId) {
        // Legacy — React TradeScreen manages player selection via local state
    }

    // ═══════════════════════════════════════════════════════════════════
    // Trade Summary & Evaluation
    // ═══════════════════════════════════════════════════════════════════

    updateTradeSummary() {
        // Legacy — React TradeScreen TradeSummary component handles value display
    }

    evaluateTrade() {
        const { engines, helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const aiTeam = helpers.getTeamById(this.currentTrade.aiTeamId);

        const userGivesPlayers = [];
        this.currentTrade.userGives.forEach(playerId => {
            const player = userTeam.roster.find(p => p.id === playerId);
            if (player) userGivesPlayers.push(player);
        });

        const aiGivesPlayers = [];
        this.currentTrade.userReceives.forEach(playerId => {
            const player = aiTeam.roster.find(p => p.id === playerId);
            if (player) aiGivesPlayers.push(player);
        });

        return engines.TradeEngine.evaluateTrade({
            userGivesPlayers, aiGivesPlayers,
            userGivesPicks: this.currentTrade.userGivesPicks,
            userReceivesPicks: this.currentTrade.userReceivesPicks,
            aiTeam,
            calculatePickValue: helpers.calculatePickValue,
            getEffectiveCap: helpers.getEffectiveCap,
            calculateTeamSalary: helpers.calculateTeamSalary,
            formatCurrency: helpers.formatCurrency
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Propose & Execute
    // ═══════════════════════════════════════════════════════════════════

    proposeTrade() {
        // Legacy — React TradeScreen handles trade proposal, evaluation,
        // and result display directly via handlePropose()
    }

    executeTrade() {
        const { gameState, eventBus, GameEvents, engines, helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const aiTeam = helpers.getTeamById(this.currentTrade.aiTeamId);

        console.log(`📊 Executing trade with ${aiTeam.name}...`);

        const result = engines.TradeEngine.executeTrade({
            team1: userTeam,
            team2: aiTeam,
            team1GivesPlayerIds: this.currentTrade.userGives,
            team2GivesPlayerIds: this.currentTrade.userReceives,
            team1GivesPicks: this.currentTrade.userGivesPicks,
            team2GivesPicks: this.currentTrade.userReceivesPicks,
            applyTradePenalty: helpers.applyTradePenalty,
            initializePlayerChemistry: helpers.initializePlayerChemistry,
            tradeDraftPick: helpers.tradeDraftPick
        });

        console.log(`✅ Trade complete!`);
        console.log(`  ${userTeam.name} roster: ${userTeam.roster.length} players`);
        console.log(`  ${aiTeam.name} roster: ${aiTeam.roster.length} players`);

        eventBus.emit(GameEvents.TRADE_ACCEPTED, {
            userTeamId: userTeam.id, aiTeamId: aiTeam.id, aiTeamName: aiTeam.name,
            userGave: result.playersToTeam2.map(p => p.name),
            userReceived: result.playersToTeam1.map(p => p.name),
            source: 'user_proposed'
        });

        // Log to trade history
        if (gameState.tradeHistory) {
            gameState.tradeHistory.push({
                season: gameState.currentSeason,
                date: gameState.currentDate,
                tier: gameState.currentTier,
                team1: { id: userTeam.id, name: userTeam.name },
                team2: { id: aiTeam.id, name: aiTeam.name },
                team1Gave: result.playersToTeam2.map(p => ({ id: p.id, name: p.name, position: p.position, rating: p.rating })),
                team2Gave: result.playersToTeam1.map(p => ({ id: p.id, name: p.name, position: p.position, rating: p.rating })),
                type: 'user-proposed'
            });
        }

        helpers.updateUI();
    }

    // ═══════════════════════════════════════════════════════════════════
    // AI Trade Proposals
    // ═══════════════════════════════════════════════════════════════════

    checkForAiTradeProposals() {
        const { gameState, eventBus, GameEvents, helpers } = this.ctx;

        if (gameState.pendingTradeProposal) return;

        const userTeam = helpers.getUserTeam();
        const userGamesPlayed = userTeam ? (userTeam.wins + userTeam.losses) : 0;

        if (userGamesPlayed - (gameState.lastAiTradeCheck || 0) < 5) return;

        const maxGames = gameState.currentTier === 1 ? 82 : gameState.currentTier === 2 ? 60 : 40;
        const tradeDeadline = Math.floor(maxGames * 0.75);

        if (userGamesPlayed >= tradeDeadline) return;

        if (Math.random() > 0.2) {
            gameState.lastAiTradeCheck = userGamesPlayed;
            return;
        }

        console.log('🤖 AI checking for trade opportunities...');

        const proposal = this.generateAiTradeProposal();

        if (proposal) {
            gameState.pendingTradeProposal = proposal;
            gameState.lastAiTradeCheck = userGamesPlayed;
            eventBus.emit(GameEvents.TRADE_AI_PROPOSAL, {
                aiTeamName: proposal.aiTeamName,
                aiTeamId: proposal.aiTeamId
            });
            // Don't auto-show — caller (sim loop) decides when to display
        } else {
            gameState.lastAiTradeCheck = userGamesPlayed;
        }
    }

    generateAiTradeProposal() {
        const { gameState, engines, helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const aiTeams = helpers.getCurrentTeams().filter(t => t.id !== gameState.userTeamId);

        return engines.TradeEngine.generateAiTradeProposal({
            userTeam, aiTeams,
            draftContext: gameState.currentTier === 1 ? {
                ownership: gameState.draftPickOwnership,
                currentSeason: gameState.currentSeason,
                tier: gameState.currentTier,
                getPickOwner: (teamId, year, round) => helpers.getPickOwner(teamId, year, round),
                violatesStepienRule: (teamId, year, round) => helpers.violatesStepienRule(teamId, year, round),
                calculatePickValue: (year, round) => helpers.calculatePickValue(year, round)
            } : null
        });
    }

    showAiTradeProposal() {
        const { gameState } = this.ctx;
        const proposal = gameState.pendingTradeProposal;
        if (!proposal) return;

        if (window._reactOpenAiTrade) {
            window._reactOpenAiTrade();
        }
    }

    acceptAiTradeProposal() {
        const { gameState, eventBus, GameEvents, helpers } = this.ctx;
        const proposal = gameState.pendingTradeProposal;
        if (!proposal) return;

        const userTeam = helpers.getUserTeam();
        const aiTeam = helpers.getTeamById(proposal.aiTeamId);

        console.log(`✅ User accepted trade with ${proposal.aiTeamName}`);

        // Execute the trade
        proposal.userGives.forEach(player => {
            const index = userTeam.roster.findIndex(p => p.id === player.id);
            if (index !== -1) userTeam.roster.splice(index, 1);
        });

        proposal.aiGives.forEach(player => {
            const index = aiTeam.roster.findIndex(p => p.id === player.id);
            if (index !== -1) aiTeam.roster.splice(index, 1);
        });

        proposal.aiGives.forEach(player => userTeam.roster.push(player));
        proposal.userGives.forEach(player => aiTeam.roster.push(player));

        if (proposal.aiGivesPicks && proposal.aiGivesPicks.length > 0) {
            proposal.aiGivesPicks.forEach(pick => {
                helpers.tradeDraftPick(aiTeam.id, userTeam.id, pick.originalTeamId, pick.year, pick.round);
                console.log(`  ← Received ${pick.year} Round ${pick.round} pick from ${aiTeam.name}`);
            });
        }

        gameState.pendingTradeProposal = null;

        eventBus.emit(GameEvents.TRADE_ACCEPTED, {
            userTeamId: userTeam.id, aiTeamId: aiTeam.id, aiTeamName: proposal.aiTeamName,
            userGave: proposal.userGives.map(p => p.name),
            userReceived: proposal.aiGives.map(p => p.name),
            source: 'ai_proposal'
        });

        // Log to trade history
        if (gameState.tradeHistory) {
            gameState.tradeHistory.push({
                season: gameState.currentSeason,
                date: gameState.currentDate,
                tier: gameState.currentTier,
                team1: { id: aiTeam.id, name: proposal.aiTeamName },
                team2: { id: userTeam.id, name: userTeam.name },
                team1Gave: proposal.aiGives.map(p => ({ id: p.id, name: p.name, position: p.position, rating: p.rating })),
                team2Gave: proposal.userGives.map(p => ({ id: p.id, name: p.name, position: p.position, rating: p.rating })),
                type: 'ai-proposal-accepted'
            });
        }

        if (window._reactCloseAiTrade) window._reactCloseAiTrade();
        helpers.updateUI();

        // Resume whatever sim mode was running when the proposal interrupted
        if (window._resumeAfterAiTrade) {
            setTimeout(window._resumeAfterAiTrade, 50);
            return;
        }

        // Fallback: check if season is complete
        const seasonComplete = gameState.schedule && gameState.schedule.every(g => g.played);
        if (seasonComplete) {
            console.log('Season complete after accepting trade, showing season end...');
            setTimeout(() => { this.ctx.simulationController.showSeasonEnd(); }, 100);
        }
    }

    rejectAiTradeProposal() {
        const { gameState, eventBus, GameEvents } = this.ctx;
        const proposal = gameState.pendingTradeProposal;
        if (proposal) {
            console.log(`❌ User rejected trade from ${proposal.aiTeamName}`);
            eventBus.emit(GameEvents.TRADE_REJECTED, {
                aiTeamName: proposal.aiTeamName,
                aiTeamId: proposal.aiTeamId
            });
        }

        gameState.pendingTradeProposal = null;
        if (window._reactCloseAiTrade) window._reactCloseAiTrade();

        // Resume whatever sim mode was running when the proposal interrupted
        if (window._resumeAfterAiTrade) {
            setTimeout(window._resumeAfterAiTrade, 50);
            return;
        }

        // Fallback: check if season is complete
        const seasonComplete = gameState.schedule && gameState.schedule.every(g => g.played);
        if (seasonComplete) {
            console.log('Season complete after rejecting trade, showing season end...');
            setTimeout(() => { this.ctx.simulationController.showSeasonEnd(); }, 100);
        }
    }
}
