// ═══════════════════════════════════════════════════════════════════════════════
// TradeController.js — Trade system orchestration
// Manages user-initiated trades and AI trade proposals
// ═══════════════════════════════════════════════════════════════════════════════

import { UIRenderer } from './UIRenderer.js';

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

        // Update position breakdown
        const tradeBreakdownDiv = document.getElementById('tradePositionBreakdown');
        if (tradeBreakdownDiv && userTeam) {
            tradeBreakdownDiv.innerHTML = helpers.generatePositionBreakdownHTML(userTeam.roster, "Your Current Roster");
        }

        const maxGames = gameState.currentTier === 1 ? 82 : gameState.currentTier === 2 ? 60 : 40;
        const tradeDeadline = Math.floor(maxGames * 0.75);
        const seasonComplete = gameState.schedule && gameState.schedule.every(g => g.played);
        const userGamesPlayed = userTeam ? (userTeam.wins + userTeam.losses) : 0;

        if (userGamesPlayed >= tradeDeadline && !seasonComplete) {
            alert(`Trade deadline has passed! (Game ${userGamesPlayed}/${maxGames}, deadline: ${tradeDeadline})\n\nTrades are not allowed until after the playoffs.\n\nYou can trade during the off-season!`);
            return;
        }

        this.currentTrade = {
            aiTeamId: null,
            userGives: [],
            userReceives: [],
            userGivesPicks: [],
            userReceivesPicks: []
        };

        const teams = helpers.getCurrentTeams().filter(t => t.id !== gameState.userTeamId);
        const dropdown = document.getElementById('tradePartnerSelect');
        dropdown.innerHTML = '<option value="" style="background: #1a1a1a; color: white;">-- Select Team --</option>' +
            teams.map(t => `<option value="${t.id}" style="background: #1a1a1a; color: white;">${t.name}</option>`).join('');

        document.getElementById('tradeInterface').style.display = 'none';
        document.getElementById('noTradePartner').style.display = 'block';
        if (window._reactOpenTrade) {
            window._reactOpenTrade();
        } else {
            document.getElementById('tradeModal').classList.remove('hidden');
        }
    }

    closeTradeScreen() {
        if (window._reactCloseTrade) window._reactCloseTrade();
        document.getElementById('tradeModal').classList.add('hidden');
        
        // If we came from roster management, return there
        if (window.returnToRosterManagement) {
            window.returnToRosterManagement = false;
            if (window._reactShowRoster && window._buildRosterData) {
                window._reactShowRoster(window._buildRosterData('game'));
            } else {
                document.getElementById('rosterModal').classList.remove('hidden');
            }
        }
    }

    loadTradePartner() {
        const { helpers } = this.ctx;
        const teamId = parseInt(document.getElementById('tradePartnerSelect').value);
        if (isNaN(teamId)) {
            document.getElementById('tradeInterface').style.display = 'none';
            document.getElementById('noTradePartner').style.display = 'block';
            return;
        }

        this.currentTrade.aiTeamId = teamId;
        this.currentTrade.userGives = [];
        this.currentTrade.userReceives = [];
        this.currentTrade.userGivesPicks = [];
        this.currentTrade.userReceivesPicks = [];

        document.getElementById('tradeInterface').style.display = 'block';
        document.getElementById('noTradePartner').style.display = 'none';

        this.displayTradeRosters();
        this.displayTradePicks();
        this.updateTradeSummary();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Roster & Pick Display
    // ═══════════════════════════════════════════════════════════════════

    displayTradeRosters() {
        const { helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const aiTeam = helpers.getTeamById(this.currentTrade.aiTeamId);
        helpers.ensureRosterExists(userTeam);
        helpers.ensureRosterExists(aiTeam);

        document.getElementById('yourTradeRoster').innerHTML = userTeam.roster
            .sort((a, b) => b.rating - a.rating)
            // [LEGACY REMOVED] .map(player => UIRenderer.tradeRosterRow({
                // player, isSelected: this.currentTrade.userGives.includes(player.id),
                // side: 'user', ratingColor: helpers.getRatingColor(player.rating), formatCurrency: helpers.formatCurrency
            // })).join('');

        document.getElementById('aiTradeRoster').innerHTML = aiTeam.roster
            .sort((a, b) => b.rating - a.rating)
            // [LEGACY REMOVED] .map(player => UIRenderer.tradeRosterRow({
                // player, isSelected: this.currentTrade.userReceives.includes(player.id),
                // side: 'ai', ratingColor: helpers.getRatingColor(player.rating), formatCurrency: helpers.formatCurrency
            // })).join('');
    }

    displayTradePicks() {
        const { gameState, helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const aiTeam = helpers.getTeamById(this.currentTrade.aiTeamId);

        if (userTeam.tier !== 1) {
            document.getElementById('yourTradePicksHeader').style.display = 'none';
            document.getElementById('yourTradePicks').style.display = 'none';
            document.getElementById('aiTradePicksHeader').style.display = 'none';
            document.getElementById('aiTradePicks').style.display = 'none';
            this.currentTrade.userGivesPicks = [];
            this.currentTrade.userReceivesPicks = [];
            return;
        }

        document.getElementById('yourTradePicksHeader').style.display = '';
        document.getElementById('yourTradePicks').style.display = '';
        document.getElementById('aiTradePicksHeader').style.display = '';
        document.getElementById('aiTradePicks').style.display = '';

        helpers.initializeDraftPickOwnership();
        const currentYear = gameState.currentSeason;

        const buildPickRows = (teamId, side, selectedPicks) => {
            let html = '';
            for (let year = currentYear; year <= currentYear + 5; year++) {
                [1, 2].forEach(round => {
                    const owner = helpers.getPickOwner(teamId, year, round);
                    if (owner === teamId) {
                        const isSelected = selectedPicks.some(p => p.originalTeamId === teamId && p.year === year && p.round === round);
                        const violatesRule = helpers.violatesStepienRule(teamId, year, round);
                        // [LEGACY REMOVED] html += UIRenderer.tradePickRow({
                            // teamId, year, round, isSelected, side,
                            // pickValue: helpers.calculatePickValue(year, round), violatesRule
                        // });
                    } else {
                        const ownerTeam = helpers.getTeamById(owner);
                        // [LEGACY REMOVED] html += UIRenderer.tradePickOwedRow({ year, round, ownerName: ownerTeam ? ownerTeam.name : 'Unknown' });
                    }
                });
            }
            return html || '<div style="text-align: center; opacity: 0.6; padding: 20px;">No picks available to trade</div>';
        };

        document.getElementById('yourTradePicks').innerHTML = buildPickRows(userTeam.id, 'user', this.currentTrade.userGivesPicks);
        document.getElementById('aiTradePicks').innerHTML = buildPickRows(aiTeam.id, 'ai', this.currentTrade.userReceivesPicks);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Toggle Selections
    // ═══════════════════════════════════════════════════════════════════

    toggleUserTradePick(originalTeamId, year, round) {
        originalTeamId = typeof originalTeamId === 'string' ? parseInt(originalTeamId) : originalTeamId;
        year = typeof year === 'string' ? parseInt(year) : year;
        round = typeof round === 'string' ? parseInt(round) : round;

        const index = this.currentTrade.userGivesPicks.findIndex(p =>
            p.originalTeamId === originalTeamId && p.year === year && p.round === round
        );

        if (index === -1) {
            this.currentTrade.userGivesPicks.push({ originalTeamId, year, round });
        } else {
            this.currentTrade.userGivesPicks.splice(index, 1);
        }

        this.displayTradePicks();
        this.updateTradeSummary();
    }

    toggleAiTradePick(originalTeamId, year, round) {
        originalTeamId = typeof originalTeamId === 'string' ? parseInt(originalTeamId) : originalTeamId;
        year = typeof year === 'string' ? parseInt(year) : year;
        round = typeof round === 'string' ? parseInt(round) : round;

        const index = this.currentTrade.userReceivesPicks.findIndex(p =>
            p.originalTeamId === originalTeamId && p.year === year && p.round === round
        );

        if (index === -1) {
            this.currentTrade.userReceivesPicks.push({ originalTeamId, year, round });
        } else {
            this.currentTrade.userReceivesPicks.splice(index, 1);
        }

        this.displayTradePicks();
        this.updateTradeSummary();
    }

    toggleUserTradePlayer(playerId) {
        const index = this.currentTrade.userGives.indexOf(playerId);
        if (index === -1) {
            this.currentTrade.userGives.push(playerId);
        } else {
            this.currentTrade.userGives.splice(index, 1);
        }
        this.displayTradeRosters();
        this.updateTradeSummary();
    }

    toggleAiTradePlayer(playerId) {
        const index = this.currentTrade.userReceives.indexOf(playerId);
        if (index === -1) {
            this.currentTrade.userReceives.push(playerId);
        } else {
            this.currentTrade.userReceives.splice(index, 1);
        }
        this.displayTradeRosters();
        this.updateTradeSummary();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Trade Summary & Evaluation
    // ═══════════════════════════════════════════════════════════════════

    updateTradeSummary() {
        const { helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const aiTeam = helpers.getTeamById(this.currentTrade.aiTeamId);

        // Update position breakdown with hypothetical roster
        const tradeBreakdownDiv = document.getElementById('tradePositionBreakdown');
        if (tradeBreakdownDiv && userTeam) {
            let hypotheticalRoster = [...userTeam.roster];

            if (this.currentTrade.userGives && this.currentTrade.userGives.length > 0) {
                hypotheticalRoster = hypotheticalRoster.filter(p =>
                    !this.currentTrade.userGives.includes(p.id)
                );
            }

            if (this.currentTrade.userReceives && this.currentTrade.userReceives.length > 0 && aiTeam) {
                const receivedPlayers = this.currentTrade.userReceives
                    .map(id => aiTeam.roster.find(p => p.id === id))
                    .filter(p => p);
                hypotheticalRoster = [...hypotheticalRoster, ...receivedPlayers];
            }

            tradeBreakdownDiv.innerHTML = helpers.generatePositionBreakdownHTML(hypotheticalRoster, "Roster After Trade");
        }

        // Calculate player values
        let userGivesValue = 0, userGivesSalary = 0;
        this.currentTrade.userGives.forEach(playerId => {
            const player = userTeam.roster.find(p => p.id === playerId);
            if (player) { userGivesValue += player.rating; userGivesSalary += player.salary; }
        });

        let userReceivesValue = 0, userReceivesSalary = 0;
        this.currentTrade.userReceives.forEach(playerId => {
            const player = aiTeam.roster.find(p => p.id === playerId);
            if (player) { userReceivesValue += player.rating; userReceivesSalary += player.salary; }
        });

        // Add draft pick values
        this.currentTrade.userGivesPicks.forEach(pick => {
            userGivesValue += helpers.calculatePickValue(pick.year, pick.round);
        });
        this.currentTrade.userReceivesPicks.forEach(pick => {
            userReceivesValue += helpers.calculatePickValue(pick.year, pick.round);
        });

        const netValue = userReceivesValue - userGivesValue;
        const salaryDiff = Math.abs(userReceivesSalary - userGivesSalary);
        const salaryMatch = salaryDiff <= 2000000;

        document.getElementById('tradeYourValue').textContent = Math.round(userGivesValue);
        document.getElementById('tradeAiValue').textContent = Math.round(userReceivesValue);
        document.getElementById('tradeNetValue').textContent = netValue > 0 ? `+${Math.round(netValue)}` : Math.round(netValue);
        document.getElementById('tradeNetValue').style.color = netValue > 0 ? '#34a853' : netValue < 0 ? '#ea4335' : '#fbbc04';

        const summaryDiv = document.getElementById('tradeSummary');
        const existingSalaryInfo = summaryDiv.querySelector('.salary-match-info');
        if (existingSalaryInfo) existingSalaryInfo.remove();

        if (this.currentTrade.userGives.length > 0 && this.currentTrade.userReceives.length > 0) {
            // [LEGACY REMOVED] summaryDiv.insertAdjacentHTML('beforeend', UIRenderer.tradeSalarySummary({
                // userGivesSalary, userReceivesSalary, salaryDiff, salaryMatch, formatCurrency: helpers.formatCurrency
            // }));
        }
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
        const { helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const aiTeam = helpers.getTeamById(this.currentTrade.aiTeamId);

        // Draft picks are T1-only
        if (userTeam.tier !== 1) {
            if (this.currentTrade.userGivesPicks.length > 0 || this.currentTrade.userReceivesPicks.length > 0) {
                console.warn('⚠️ Draft picks stripped from T' + userTeam.tier + ' trade — picks are T1 only.');
            }
            this.currentTrade.userGivesPicks = [];
            this.currentTrade.userReceivesPicks = [];
        }

        const userGivesAnything = this.currentTrade.userGives.length > 0 || this.currentTrade.userGivesPicks.length > 0;
        const userReceivesAnything = this.currentTrade.userReceives.length > 0 || this.currentTrade.userReceivesPicks.length > 0;

        if (!userGivesAnything || !userReceivesAnything) {
            alert('You must select at least one player or draft pick on each side of the trade.');
            return;
        }

        const userRosterAfter = userTeam.roster.length - this.currentTrade.userGives.length + this.currentTrade.userReceives.length;
        const aiRosterAfter = aiTeam.roster.length - this.currentTrade.userReceives.length + this.currentTrade.userGives.length;

        if (userRosterAfter < 12 || userRosterAfter > 15) {
            alert(`Invalid trade: Your roster would have ${userRosterAfter} players. Must be between 12-15.`);
            return;
        }

        if (aiRosterAfter < 12 || aiRosterAfter > 15) {
            alert(`Invalid trade: ${aiTeam.name} would have ${aiRosterAfter} players. Must be between 12-15.`);
            return;
        }

        const result = this.evaluateTrade();

        if (result.accepted) {
            this.executeTrade();
 alert(`Trade Accepted!\n\n${result.reason}`);
            this.closeTradeScreen();
        } else {
 alert(`Trade Declined\n\n${aiTeam.name} says: "${result.reason}"`);
        }
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
        document.getElementById('aiTradeProposalModal').classList.add('hidden');
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
        document.getElementById('aiTradeProposalModal').classList.add('hidden');

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
