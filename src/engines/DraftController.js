// ═══════════════════════════════════════════════════════════════════════════════
// DraftController.js — Draft & College Graduate FA orchestration
// Manages: Draft lottery, draft order generation, interactive draft execution,
//          draft results display, college graduate free agency
// ═══════════════════════════════════════════════════════════════════════════════

import { UIRenderer } from './UIRenderer.js';

export class DraftController {
    /**
     * @param {Object} ctx - Context with all dependencies
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.currentDraftResults = [];
        this.collegeGradIdCounter = 800000;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Draft Prospects & Lottery
    // ═══════════════════════════════════════════════════════════════════

    generateDraftProspects() {
        const { engines } = this.ctx;
        return engines.DraftEngine.generateDraftProspects(
            this.ctx.gameState.currentSeason,
            { PlayerAttributes: engines.PlayerAttributes, TeamFactory: engines.TeamFactory }
        );
    }

    simulateDraftLottery(tier1Teams, promotedTeamIds) {
        return this.ctx.engines.DraftEngine.simulateDraftLottery(tier1Teams, promotedTeamIds);
    }

    showLotteryResults(lotteryData) {
        const { helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();

        if (window._reactShowLottery) {
            window._reactShowLottery({
                lotteryResults: lotteryData.lotteryResults,
                userTeamId: userTeam.id,
            });
            return;
        }

        const html = UIRenderer.lotteryResults({
            lotteryResults: lotteryData.lotteryResults,
            userTeamId: userTeam.id
        });
        document.getElementById('lotteryContent').innerHTML = html;
        document.getElementById('lotteryModal').classList.remove('hidden');
    }

    closeLotteryModal() {
        if (window._reactCloseLottery) window._reactCloseLottery();
        document.getElementById('lotteryModal').classList.add('hidden');
        if (window.pendingDraftData) {
            this.startDraftAfterLottery();
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Draft Order Generation (Tier 1 only, with lottery)
    // ═══════════════════════════════════════════════════════════════════

    generateDraftOrder() {
        const { gameState, helpers } = this.ctx;

        console.log('📋 Generating draft order (Tier 1 only with lottery)...');
        console.log(`📅 Current season: ${gameState.currentSeason}`);

        const draftYear = gameState.currentSeason;
        console.log(`🎓 Draft year: ${draftYear}`);
        console.log('📋 Draft pick ownership structure:', JSON.stringify(gameState.draftPickOwnership, null, 2));

        const draftOrder = [];
        const tier1Teams = [...gameState.tier1Teams];
        const promotedTeamIds = gameState.promotedToT1 || [];

        // Run lottery
        const lotteryData = this.simulateDraftLottery(tier1Teams, promotedTeamIds);
        this.showLotteryResults(lotteryData);

        // Round 1: Lottery results (picks 1-14) + Playoff teams (picks 15-30)
        lotteryData.lotteryResults.forEach((result, index) => {
            const pickNumber = index + 1;
            const originalTeamId = result.team.id;
            const pickOwner = helpers.getPickOwner(originalTeamId, draftYear, 1);
            const ownerTeam = helpers.getTeamById(pickOwner);

            draftOrder.push({
                pick: pickNumber, round: 1,
                originalTeamId, originalTeamName: result.team.name,
                teamId: pickOwner, teamName: ownerTeam ? ownerTeam.name : result.team.name,
                tier: 1, isCompensatory: false
            });
        });

        lotteryData.playoffTeams.forEach((team, index) => {
            const pickNumber = 15 + index;
            const originalTeamId = team.id;
            const pickOwner = helpers.getPickOwner(originalTeamId, draftYear, 1);
            const ownerTeam = helpers.getTeamById(pickOwner);

            draftOrder.push({
                pick: pickNumber, round: 1,
                originalTeamId, originalTeamName: team.name,
                teamId: pickOwner, teamName: ownerTeam ? ownerTeam.name : team.name,
                tier: 1, isCompensatory: false
            });
        });

        // Compensatory picks: 31-33 (promoted teams)
        const promotedTeams = tier1Teams.filter(t => promotedTeamIds.includes(t.id));
        console.log('  Promoted teams (eligible for compensatory picks):');
        if (promotedTeams.length === 0) {
            console.log('    - None found (first season or tracking not initialized)');
        } else {
            promotedTeams.forEach(team => console.log(`    - ${team.name}`));
        }

        promotedTeams.forEach((team, index) => {
            draftOrder.push({
                pick: 30 + index + 1, round: 'Comp',
                teamId: team.id, teamName: team.name,
                tier: 1, isCompensatory: true
            });
        });

        // Round 2: Picks 34-63 (same order as Round 1)
        for (let i = 0; i < 30; i++) {
            const round1Pick = draftOrder[i];
            const pickNumber = 33 + i + 1;
            const originalTeamId = round1Pick.originalTeamId;
            const pickOwner = helpers.getPickOwner(originalTeamId, draftYear, 2);
            const ownerTeam = helpers.getTeamById(pickOwner);

            draftOrder.push({
                pick: pickNumber, round: 2,
                originalTeamId, originalTeamName: round1Pick.originalTeamName,
                teamId: pickOwner, teamName: ownerTeam ? ownerTeam.name : round1Pick.originalTeamName,
                tier: 1, isCompensatory: false
            });
        }

        console.log(`  Draft order generated: ${draftOrder.length} picks (30 teams)`);
        console.log(`  Pick #1: ${draftOrder[0].teamName} (lottery winner)`);
        console.log(`  Pick #30: ${draftOrder[29].teamName} (best playoff team)`);
        console.log(`  Compensatory picks: 31-33 (${promotedTeams.map(t => t.name).join(', ')})`);
        console.log(`  Round 2 starts at pick 34`);

        return draftOrder;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Draft Execution (interactive)
    // ═══════════════════════════════════════════════════════════════════

    runDraft() {
        console.log('🏀 STARTING DRAFT');
        const prospects = this.generateDraftProspects();
        const draftOrder = this.generateDraftOrder();

        window.pendingDraftData = { prospects, draftOrder };
        // Draft will start when user closes lottery modal
    }

    startDraftAfterLottery() {
        const data = window.pendingDraftData;
        if (!data) return;
        this.executeDraft(data.prospects, data.draftOrder);
        delete window.pendingDraftData;
    }

    executeDraft(prospects, draftOrder) {
        console.log('🎯 Executing draft...');

        const draftResults = [];
        const availableProspects = [...prospects];

        window.currentDraftState = {
            prospects: availableProspects,
            draftOrder,
            results: draftResults,
            currentPickIndex: 0
        };

        this.processDraftPick();
    }

    processDraftPick() {
        const state = window.currentDraftState;
        const { helpers } = this.ctx;

        if (state.currentPickIndex >= state.draftOrder.length || state.prospects.length === 0) {
            this.finalizeDraft();
            return;
        }

        const pick = state.draftOrder[state.currentPickIndex];
        const userTeam = helpers.getUserTeam();

        console.log(`Pick #${pick.pick}: Original=${pick.originalTeamName || pick.teamName}, Owner=${pick.teamName}, UserTeam=${userTeam.name}`);
        console.log(`  pick.teamId=${pick.teamId}, userTeam.id=${userTeam.id}, match=${pick.teamId === userTeam.id}`);

        if (pick.teamId === userTeam.id) {
            console.log(`  → USER PICK!`);
            this.showUserDraftPick(pick);
        } else {
            console.log(`  → AI PICK for ${pick.teamName}`);
            this.aiDraftPick(pick);
            state.currentPickIndex++;
            setTimeout(() => this.processDraftPick(), 10);
        }
    }

    aiDraftPick(pick) {
        const state = window.currentDraftState;
        const { helpers, engines } = this.ctx;
        const team = helpers.getTeamById(pick.teamId);
        if (!team || state.prospects.length === 0) return;

        helpers.ensureRosterExists(team);
        const result = engines.DraftEngine.aiDraftPick(pick, state.prospects, team, { SalaryCapEngine: engines.SalaryCapEngine });

        if (result) {
            state.results.push(result);
            if (pick.pick <= 10 || pick.pick === 30 || pick.pick === 31 || pick.pick === 63) {
                console.log(`  Pick ${pick.pick}: ${pick.teamName} → ${result.player.name} (${result.player.rating} OVR, ${result.player.position})`);
            }
        }
    }

    showUserDraftPick(pick) {
        const roundText = pick.round === 'Comp' ? 'Compensatory' : `Round ${pick.round}`;
        document.getElementById('userPickNumber').textContent = `Pick #${pick.pick} (${roundText})`;
        this.displayDraftProspects();
        this.displayUserRosterInDraft();
        document.getElementById('userDraftPickModal').classList.remove('hidden');
    }

    displayDraftProspects() {
        const state = window.currentDraftState;
        const { helpers, engines } = this.ctx;
        let prospects = [...state.prospects];

        const positionFilter = document.getElementById('draftPositionFilter').value;
        if (positionFilter !== 'ALL') {
            prospects = prospects.filter(p => p.position === positionFilter);
        }

        const sortBy = document.getElementById('draftSortBy').value;
        if (sortBy === 'rating') prospects.sort((a, b) => b.rating - a.rating);
        else if (sortBy === 'age') prospects.sort((a, b) => a.age - b.age);
        else if (sortBy === 'position') prospects.sort((a, b) => a.position.localeCompare(b.position));

        let html = '';
        if (prospects.length === 0) {
            html = '<p style="text-align: center; opacity: 0.7; padding: 40px;">No prospects match your filters</p>';
        } else {
            prospects.forEach(prospect => {
                html += UIRenderer.draftProspectCard({ prospect, getRatingColor: helpers.getRatingColor, PlayerAttributes: engines.PlayerAttributes });
            });
        }

        document.getElementById('draftProspectsList').innerHTML = html;
    }

    displayUserRosterInDraft() {
        const { helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        helpers.ensureRosterExists(userTeam);

        const positionCounts = { 'PG': 0, 'SG': 0, 'SF': 0, 'PF': 0, 'C': 0 };
        userTeam.roster.forEach(p => positionCounts[p.position]++);

        const topPlayers = [...userTeam.roster].sort((a, b) => b.rating - a.rating).slice(0, 10);

        document.getElementById('draftYourRoster').innerHTML = UIRenderer.draftUserRoster({
            positionCounts, topPlayers, totalRosterSize: userTeam.roster.length, getRatingColor: helpers.getRatingColor
        });
    }

    filterDraftProspects() {
        this.displayDraftProspects();
    }

    selectDraftProspect(prospectId) {
        const state = window.currentDraftState;
        const { gameState, eventBus, GameEvents, helpers } = this.ctx;
        const pick = state.draftOrder[state.currentPickIndex];
        const userTeam = helpers.getUserTeam();

        const prospectIndex = state.prospects.findIndex(p => p.id === prospectId);
        if (prospectIndex === -1) return;

        const selectedProspect = state.prospects[prospectIndex];
        state.prospects.splice(prospectIndex, 1);

        selectedProspect.salary = this.getDraftPickSalary(pick.pick, userTeam.tier);
        userTeam.roster.push(selectedProspect);

        state.results.push({
            pick: pick.pick, round: pick.round,
            teamId: pick.teamId, teamName: pick.teamName,
            tier: pick.tier, player: selectedProspect
        });

        console.log(`  Pick ${pick.pick}: ${userTeam.name} (USER) → ${selectedProspect.name} (${selectedProspect.rating} OVR, ${selectedProspect.position})`);

        eventBus.emit(GameEvents.DRAFT_PICK_MADE, {
            pickNumber: pick.pick, round: pick.round,
            teamId: pick.teamId, teamName: pick.teamName,
            playerName: selectedProspect.name, playerRating: selectedProspect.rating,
            position: selectedProspect.position, isUserPick: true
        });

        document.getElementById('userDraftPickModal').classList.add('hidden');
        state.currentPickIndex++;
        setTimeout(() => this.processDraftPick(), 100);
    }

    finalizeDraft() {
        const state = window.currentDraftState;
        const { gameState } = this.ctx;

        console.log(`✅ Draft complete: ${state.results.length} players drafted`);

        // Undrafted to FA
        console.log(`📝 Adding ${state.prospects.length} undrafted prospects to free agency`);
        state.prospects.forEach(prospect => {
            prospect.isDraftProspect = false;
            gameState.freeAgents.push(prospect);
        });

        // Post-draft roster trimming
        const MAX_ROSTER = 15;
        const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
        allTeams.forEach(team => {
            if (!team.roster || team.roster.length <= MAX_ROSTER) return;
            team.roster.sort((a, b) => a.rating - b.rating);
            const excess = team.roster.length - MAX_ROSTER;
            const cut = team.roster.splice(0, excess);
            cut.forEach(player => {
                player.contractYears = player.contractYears || 1;
                gameState.freeAgents.push(player);
            });
            console.log(`✂️  Roster cut: ${team.name} trimmed ${excess} player(s) [${cut.map(p => p.name + ' (' + p.rating + ')').join(', ')}] → now ${team.roster.length}`);
        });

        this.showDraftResults(state.results);
        delete window.currentDraftState;
    }

    getDraftPickSalary(pickNumber, tier = 2) {
        return this.ctx.engines.DraftEngine.getDraftPickSalary(pickNumber, tier, { SalaryCapEngine: this.ctx.engines.SalaryCapEngine });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Draft Results Display
    // ═══════════════════════════════════════════════════════════════════

    showDraftResults(draftResults) {
        this.currentDraftResults = draftResults;
        const { helpers } = this.ctx;

        if (window._reactShowDraftResults) {
            const self = this;
            window._draftResultsContinueCallback = () => {
                self.currentDraftResults = [];
                console.log('Draft complete, generating college graduates...');
                self.startCollegeGraduateFA();
            };
            window._reactShowDraftResults({
                results: draftResults,
                userTeamId: helpers.getUserTeam().id,
                getRatingColor: helpers.getRatingColor
            });
            return;
        }

        this.showDraftRound(1);
        document.getElementById('draftResultsModal').classList.remove('hidden');
    }

    showDraftRound(round) {
        const { helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        let roundResults, roundTitle;

        if (round === 'Comp') {
            roundResults = this.currentDraftResults.filter(r => r.round === 'Comp');
            roundTitle = 'Compensatory Round (Promoted Teams)';
        } else {
            roundResults = this.currentDraftResults.filter(r => r.round === round);
            roundTitle = `Round ${round} Results`;
        }

        document.getElementById('draftRound1Btn').style.background = round === 1 ? 'linear-gradient(135deg, #34a853 0%, #2e7d32 100%)' : '';
        document.getElementById('draftCompBtn').style.background = round === 'Comp' ? 'linear-gradient(135deg, #34a853 0%, #2e7d32 100%)' : '';
        document.getElementById('draftRound2Btn').style.background = round === 2 ? 'linear-gradient(135deg, #34a853 0%, #2e7d32 100%)' : '';
        document.getElementById('userPicksBtn').style.background = 'linear-gradient(135deg, #fbbc04 0%, #f9a825 100%)';

        document.getElementById('draftResultsContent').innerHTML = UIRenderer.draftRoundResults({
            roundResults, roundTitle, userTeamId: userTeam.id, getRatingColor: helpers.getRatingColor
        });
    }

    showUserDraftPicks() {
        const { helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const userPicks = this.currentDraftResults.filter(r => r.teamId === userTeam.id);

        document.getElementById('draftRound1Btn').style.background = '';
        document.getElementById('draftCompBtn').style.background = '';
        document.getElementById('draftRound2Btn').style.background = '';
        document.getElementById('userPicksBtn').style.background = 'linear-gradient(135deg, #667eea 0%, #5568d3 100%)';

        document.getElementById('draftResultsContent').innerHTML = UIRenderer.userDraftPicks({
            picks: userPicks, teamName: userTeam.name, getRatingColor: helpers.getRatingColor
        });
    }

    closeDraftResults() {
        document.getElementById('draftResultsModal').classList.add('hidden');
        this.currentDraftResults = [];
        console.log('Draft complete, generating college graduates...');
        this.startCollegeGraduateFA();
    }

    // ═══════════════════════════════════════════════════════════════════
    // College Graduate Free Agency
    // ═══════════════════════════════════════════════════════════════════

    generateCollegeGraduate(targetTier) {
        const { engines } = this.ctx;
        return engines.TeamFactory.generateCollegeGraduate(targetTier, this.collegeGradIdCounter++, { PlayerAttributes: engines.PlayerAttributes });
    }

    generateCollegeGraduateClass() {
        const { engines } = this.ctx;
        const result = engines.TeamFactory.generateCollegeGraduateClass(this.collegeGradIdCounter, { PlayerAttributes: engines.PlayerAttributes });
        this.collegeGradIdCounter += result.length;
        return result;
    }

    startCollegeGraduateFA() {
        const { gameState, eventBus, GameEvents, helpers } = this.ctx;

        console.log('🎓 Step 3b: College Graduate Free Agency...');
        eventBus.emit(GameEvents.COLLEGE_FA_STARTED, { season: gameState.season });

        const graduates = this.generateCollegeGraduateClass();
        gameState.collegeGraduates = graduates;

        if (gameState.currentTier === 1) {
            console.log('   User is T1, auto-processing college grad signings for AI T2/T3 teams...');
            this.aiSignCollegeGraduates(graduates);
            helpers.proceedToPlayerDevelopment();
            return;
        }

        window.cgSelectedIds = new Set();

        if (!window._cgModalOriginalHTML) {
            window._cgModalOriginalHTML = document.getElementById('collegeGradFAModal').querySelector('.modal-content').innerHTML;
        }

        this.showCollegeGradModal(graduates);
    }

    showCollegeGradModal(graduates) {
        const { gameState, helpers, engines } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const capSpace = helpers.getRemainingCap(userTeam);
        const season = gameState.currentSeason;
        const { PlayerAttributes } = engines;

        if (window._reactShowCG) {
            // Enrich graduates with measurables string
            graduates.forEach(p => {
                if (p.measurables && PlayerAttributes) {
                    p._measurables = `${PlayerAttributes.formatHeight(p.measurables.height)} \u00B7 ${p.measurables.weight}lbs \u00B7 ${PlayerAttributes.formatWingspan(p.measurables.wingspan)} WS`;
                }
            });

            // Submit callback
            window._cgSubmitOffers = (selectedIdStrings) => {
                const picks = graduates.filter(g => selectedIdStrings.includes(String(g.id)));
                this._processCollegeGradOffers(picks, graduates);
            };

            window._reactShowCG({
                phase: 'select',
                graduates: [...graduates],
                capSpace,
                rosterSize: userTeam.roster.length,
                season,
                formatCurrency: helpers.formatCurrency,
                getRatingColor: helpers.getRatingColor,
            });
            return;
        }

        const modal = document.getElementById('collegeGradFAModal');
        if (!document.getElementById('collegeGradSubtitle')) {
            modal.querySelector('.modal-content').innerHTML = window._cgModalOriginalHTML;
        }

        const info = UIRenderer.collegeGradModalInfo({ graduateCount: graduates.length, season, capSpace, rosterSize: userTeam.roster.length, formatCurrency: helpers.formatCurrency });
        document.getElementById('collegeGradSubtitle').innerHTML = info.subtitle;
        document.getElementById('collegeGradCapInfo').innerHTML = info.capInfo;

        window.cgAllGraduates = graduates;
        this.filterCollegeGrads();
        document.getElementById('collegeGradFAModal').classList.remove('hidden');
    }

    /**
     * Process college grad offers (shared by React and legacy paths).
     */
    _processCollegeGradOffers(picks, graduates) {
        const { helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();

        let signed = 0, lost = 0;
        const details = [];

        picks.forEach(player => {
            const signChance = player.rating >= 72 ? 0.75 : player.rating >= 65 ? 0.85 : 0.95;
            if (Math.random() < signChance) {
                player.contractYears = helpers.determineContractLength(player.age, player.rating);
                player.originalContractLength = player.contractYears;
                player.salary = helpers.generateSalary(player.rating, userTeam.tier);
                player.tier = userTeam.tier;
                helpers.initializePlayerChemistry(player);
                userTeam.roster.push(player);
                userTeam.gamesSinceRosterChange = 0;

                const idx = graduates.indexOf(player);
                if (idx !== -1) graduates.splice(idx, 1);

                signed++;
                details.push({ player, signed: true });
            } else {
                lost++;
                details.push({ player, signed: false });
            }
        });

        if (window._reactShowCG) {
            window._reactShowCG({
                phase: 'results',
                results: { signed, lost, details },
            });
        }
    }

    filterCollegeGrads() {
        const { helpers, engines } = this.ctx;
        const posFilter = document.getElementById('cgPositionFilter').value;
        const sortBy = document.getElementById('cgSortBy').value;
        const graduates = window.cgAllGraduates || [];
        const selected = window.cgSelectedIds || new Set();

        let filtered = graduates;
        if (posFilter !== 'ALL') {
            filtered = graduates.filter(g => g.position === posFilter);
        }

        if (sortBy === 'rating') filtered.sort((a, b) => b.rating - a.rating);
        else if (sortBy === 'age') filtered.sort((a, b) => a.age - b.age || b.rating - a.rating);
        else if (sortBy === 'salary') filtered.sort((a, b) => a.salary - b.salary);
        else if (sortBy === 'potential') filtered.sort((a, b) => b.projectedCeiling - a.projectedCeiling);

        document.getElementById('collegeGradList').innerHTML = UIRenderer.collegeGradTable({
            filtered, selected, getRatingColor: helpers.getRatingColor, formatCurrency: helpers.formatCurrency, PlayerAttributes: engines.PlayerAttributes
        });
        this.updateCollegeGradTally();
    }

    toggleCollegeGradSelection(playerId) {
        const selected = window.cgSelectedIds || new Set();
        const cb = document.getElementById(`cg_${playerId}`);
        if (cb && cb.checked) selected.add(String(playerId));
        else selected.delete(String(playerId));

        const row = cb ? cb.closest('tr') : null;
        if (row) row.style.background = cb.checked ? 'rgba(52,168,83,0.15)' : '';

        this.updateCollegeGradTally();
    }

    updateCollegeGradTally() {
        const { helpers } = this.ctx;
        const selected = window.cgSelectedIds || new Set();
        const graduates = window.cgAllGraduates || [];
        const userTeam = helpers.getUserTeam();

        const selectedPlayers = graduates.filter(g => selected.has(String(g.id)));
        const count = selectedPlayers.length;

        document.getElementById('cgSelectedCount').textContent = count;
        document.getElementById('cgSubmitBtn').disabled = count === 0;

        const tallyEl = document.getElementById('collegeGradTally');
        if (count === 0) { tallyEl.style.display = 'none'; return; }

        tallyEl.style.display = 'block';
        const estCost = selectedPlayers.reduce((sum, p) => sum + p.salary, 0);
        const capSpace = helpers.getRemainingCap(userTeam);
        const remaining = capSpace - estCost;

        document.getElementById('cgOfferCount').textContent = count;
        document.getElementById('cgOfferTotal').textContent = helpers.formatCurrency(estCost);
        const remEl = document.getElementById('cgOfferRemaining');
        remEl.textContent = helpers.formatCurrency(remaining);
        remEl.style.color = remaining >= 0 ? '#34a853' : '#ea4335';
    }

    submitCollegeGradOffers() {
        const { gameState, helpers } = this.ctx;
        const selected = window.cgSelectedIds || new Set();
        const graduates = window.cgAllGraduates || [];
        const userTeam = helpers.getUserTeam();

        const picks = graduates.filter(g => selected.has(String(g.id)));

        if (picks.length === 0) { alert('Select at least one player.'); return; }

        const totalCost = picks.reduce((sum, p) => sum + p.salary, 0);
        const capSpace = helpers.getRemainingCap(userTeam);
        if (totalCost > capSpace) {
            alert(`Your selections cost ${helpers.formatCurrency(totalCost)} but you only have ${helpers.formatCurrency(capSpace)} in cap space.\n\nRemove some picks or target cheaper players.`);
            return;
        }

        const rosterSpace = 15 - userTeam.roster.length;
        if (picks.length > rosterSpace) {
            alert(`You only have ${rosterSpace} roster spot${rosterSpace !== 1 ? 's' : ''} available.\n\nYou selected ${picks.length} players. Remove some picks.`);
            return;
        }

        let signed = 0, lost = 0;
        const results = [];

        picks.forEach(player => {
            const signChance = player.rating >= 72 ? 0.75 : player.rating >= 65 ? 0.85 : 0.95;
            if (Math.random() < signChance) {
                player.contractYears = helpers.determineContractLength(player.age, player.rating);
                player.originalContractLength = player.contractYears;
                player.salary = helpers.generateSalary(player.rating, userTeam.tier);
                player.tier = userTeam.tier;
                helpers.initializePlayerChemistry(player);
                userTeam.roster.push(player);
                userTeam.gamesSinceRosterChange = 0;

                const idx = graduates.indexOf(player);
                if (idx !== -1) graduates.splice(idx, 1);

                signed++;
                results.push({ player, signed: true });
            } else {
                lost++;
                results.push({ player, signed: false });
            }
        });

        // The .modal-content may have been moved to React overlay by OffseasonModals
        const listEl = document.getElementById('collegeGradList');
        if (listEl) listEl.innerHTML = '';
        const modalEl = document.getElementById('collegeGradFAModal');
        let contentNode = modalEl && modalEl.querySelector('.modal-content');
        if (!contentNode && listEl) {
            contentNode = listEl.closest('.modal-content');
        }
        if (contentNode) {
            contentNode.innerHTML = UIRenderer.collegeGradResults({ signed, lost, results });
        }
    }

    skipCollegeGradFA() {
        console.log('⏭️ User skipped college graduate FA');
        this.closeCollegeGradAndContinue();
    }

    closeCollegeGradResults() {
        this.closeCollegeGradAndContinue();
    }

    closeCollegeGradAndContinue() {
        const { gameState, helpers } = this.ctx;

        if (window._reactCloseCG) window._reactCloseCG();
        document.getElementById('collegeGradFAModal').classList.add('hidden');

        const remaining = gameState.collegeGraduates || [];
        console.log(`🤖 AI signing remaining ${remaining.length} college graduates...`);
        this.aiSignCollegeGraduates(remaining);

        helpers.saveGameState();
        helpers.proceedToPlayerDevelopment();
    }

    aiSignCollegeGraduates(graduates) {
        const { gameState, helpers, engines } = this.ctx;
        if (!graduates || graduates.length === 0) return;

        const allTeams = [...gameState.tier2Teams, ...gameState.tier3Teams];
        const userTeam = helpers.getUserTeam();
        const aiTeams = allTeams.filter(t => t.id !== userTeam.id);

        const totalSigned = engines.FreeAgencyEngine.aiSignCollegeGraduates(
            graduates, aiTeams,
            { TeamFactory: engines.TeamFactory, getEffectiveCap: helpers.getEffectiveCap, calculateTeamSalary: helpers.calculateTeamSalary }
        );

        const unsigned = graduates.length;
        if (unsigned > 0) {
            if (!gameState.freeAgents) gameState.freeAgents = [];
            graduates.forEach(g => { g.previousTeamId = null; gameState.freeAgents.push(g); });
        }

        console.log(`🎓 AI College Grad Results: ${totalSigned} signed by AI teams, ${unsigned} entered general FA pool`);
    }
}
