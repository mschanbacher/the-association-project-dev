// ═══════════════════════════════════════════════════════════════════════════════
// DraftController.js — Draft & College Graduate FA orchestration
// Manages: Draft lottery, draft order generation, interactive draft execution,
//          draft results display, college graduate free agency
// ═══════════════════════════════════════════════════════════════════════════════


export class DraftController {
    /**
     * @param {Object} ctx - Context with all dependencies
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.currentDraftResults = [];
    }

    // ═══════════════════════════════════════════════════════════════════
    // Draft Prospects & Lottery
    // ═══════════════════════════════════════════════════════════════════

    generateDraftProspects() {
        const { engines, gameState } = this.ctx;
        // Reserve 100 IDs from global counter for draft prospects
        const startId = gameState.getNextPlayerId(100);
        return engines.DraftEngine.generateDraftProspects(
            gameState.currentSeason,
            { PlayerAttributes: engines.PlayerAttributes, TeamFactory: engines.TeamFactory },
            startId
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

        // Lottery results now rendered by React LotteryModal via _reactShowLottery
    }

    closeLotteryModal() {
        if (window._reactCloseLottery) window._reactCloseLottery();
        if (window.pendingDraftData) {
            this.startDraftAfterLottery();
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Draft Order Generation (Tier 1 only, with lottery)
    // ═══════════════════════════════════════════════════════════════════

    generateDraftOrder(silent = false) {
        const { gameState, helpers } = this.ctx;

        console.log('Generating draft order (Tier 1 only with lottery)...');

        const draftYear = gameState.currentSeason;

        const draftOrder = [];
        const tier1Teams = [...gameState.tier1Teams];
        const promotedTeamIds = gameState.promotedToT1 || [];

        // Run lottery
        const lotteryData = this.simulateDraftLottery(tier1Teams, promotedTeamIds);
        if (!silent) {
            this.showLotteryResults(lotteryData);
        }

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
        const state = window.currentDraftState;
        const { helpers, engines } = this.ctx;
        const { PlayerAttributes } = engines;
        const userTeam = helpers.getUserTeam();
        const roundText = pick.round === 'Comp' ? 'Compensatory' : `Round ${pick.round}`;

        if (window._reactShowDraftPick) {
            // Enrich prospects
            const allDefs = { ...PlayerAttributes.PHYSICAL_ATTRS, ...PlayerAttributes.MENTAL_ATTRS };
            const enriched = state.prospects.map(p => {
                const copy = { ...p };
                if (p.measurables) {
                    copy._measurables = `${PlayerAttributes.formatHeight(p.measurables.height)} \u00B7 ${p.measurables.weight}lbs \u00B7 ${PlayerAttributes.formatWingspan(p.measurables.wingspan)} WS`;
                }
                if (p.attributes) {
                    const allDefs2 = allDefs;
                    copy._topAttrs = Object.entries(p.attributes)
                        .sort(([,a],[,b]) => b - a).slice(0, 3)
                        .map(([k,v]) => { const d = allDefs2[k]; return d ? { icon: d.icon, value: v, color: PlayerAttributes.getAttrColor(v) } : null; })
                        .filter(Boolean);
                }
                return copy;
            });

            window._reactShowDraftPick({
                pickNumber: pick.pick,
                roundText,
                prospects: enriched,
                roster: [...userTeam.roster],
                getRatingColor: helpers.getRatingColor,
            });
            return;
        }
    }

    displayDraftProspects() {
        // No-op: React UserDraftPickModal handles prospect list rendering and filtering.
    }

    displayUserRosterInDraft() {
        // No-op: React UserDraftPickModal handles roster display.
    }

    filterDraftProspects() {
        // No-op: React UserDraftPickModal handles filtering.
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

        if (window._reactCloseDraftPick) window._reactCloseDraftPick();
        state.currentPickIndex++;
        setTimeout(() => this.processDraftPick(), 100);
    }

    finalizeDraft() {
        const state = window.currentDraftState;
        const { gameState, engines } = this.ctx;

        console.log(`✅ Draft complete: ${state.results.length} players drafted`);

        // Mark draft as complete so it doesn't re-trigger
        gameState._draftComplete = true;

        // Undrafted to FA
        console.log(`📝 Adding ${state.prospects.length} undrafted prospects to free agency`);
        state.prospects.forEach(prospect => {
            prospect.isDraftProspect = false;
            gameState.freeAgents.push(prospect);
        });

        // Generate college graduates and add to FA pool.
        // This replaces the standalone College Grad FA phase — graduates are now
        // available in the general FA pool for camp invites at any tier.
        const graduates = this.generateCollegeGraduateClass();
        graduates.forEach(g => { g.previousTeamId = null; gameState.freeAgents.push(g); });
        gameState._collegeFAComplete = true;
        console.log(`🎓 ${graduates.length} college graduates added to FA pool`);

        // Post-draft roster trimming — offseason limit is 20 (expanded for training camp).
        // Final cutdown to 15 happens at each tier's camp cutdown deadline.
        const MAX_OFFSEASON_ROSTER = 20;
        const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
        allTeams.forEach(team => {
            if (!team.roster || team.roster.length <= MAX_OFFSEASON_ROSTER) return;
            team.roster.sort((a, b) => a.rating - b.rating);
            const excess = team.roster.length - MAX_OFFSEASON_ROSTER;
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
    }

    showDraftRound(round) {
        // No-op: React DraftResultsModal handles round tab switching via activeTab state.
    }

    showUserDraftPicks() {
        // No-op: React DraftResultsModal handles user picks tab via activeTab state.
    }

    closeDraftResults() {
        this.currentDraftResults = [];
        console.log('Draft complete, generating college graduates...');
        this.startCollegeGraduateFA();
    }

    // ═══════════════════════════════════════════════════════════════════
    // College Graduate Free Agency
    // ═══════════════════════════════════════════════════════════════════

    generateCollegeGraduate(targetTier) {
        const { engines, gameState } = this.ctx;
        const id = gameState.getNextPlayerId(1);
        return engines.TeamFactory.generateCollegeGraduate(targetTier, id, { PlayerAttributes: engines.PlayerAttributes });
    }

    generateCollegeGraduateClass() {
        const { engines, gameState } = this.ctx;
        // TeamFactory determines class size internally (90-120 players).
        // Reserve the max possible (120) from global counter; unused IDs are just a harmless gap.
        const startId = gameState.getNextPlayerId(120);
        const result = engines.TeamFactory.generateCollegeGraduateClass(startId, { PlayerAttributes: engines.PlayerAttributes });
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
        }
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

    skipCollegeGradFA() {
        console.log('⏭️ User skipped college graduate FA');
        this.closeCollegeGradAndContinue();
    }

    closeCollegeGradResults() {
        this.closeCollegeGradAndContinue();
    }

    closeCollegeGradAndContinue() {
        const { gameState, helpers } = this.ctx;

        // Mark college FA as complete so it doesn't re-trigger
        gameState._collegeFAComplete = true;

        if (window._reactCloseCG) window._reactCloseCG();

        const remaining = gameState.collegeGraduates || [];
        console.log(`🤖 AI signing remaining ${remaining.length} college graduates...`);
        this.aiSignCollegeGraduates(remaining);

        helpers.saveGameState();
        
        // In hub-based flow, just notify React and let user sim forward
        // Don't auto-trigger proceedToPlayerDevelopment
        if (window._notifyReact) window._notifyReact();
        console.log('🎓 [COLLEGE FA] Complete. User can sim forward to next phase.');
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

        console.log(`AI College Grad Results: ${totalSigned} signed by AI teams, ${unsigned} entered general FA pool`);
    }

    /**
     * Run the entire draft silently (no UI). Used for T2/T3 users
     * and quick-sim paths. Generates prospects, runs lottery, makes
     * all picks as AI (including user's picks as best-available),
     * handles undrafted, college grads, and roster trim.
     */
    runSilently() {
        const { gameState, helpers } = this.ctx;

        // Generate prospects
        const prospects = this.generateDraftProspects();
        if (!gameState.draftClass || gameState.draftClass.length === 0) {
            gameState.draftClass = prospects;
        }

        // Generate draft order (silent = true skips lottery UI)
        const draftOrder = this.generateDraftOrder(true);

        // Set up draft state (aiDraftPick reads from this)
        window.currentDraftState = {
            prospects: [...gameState.draftClass],
            draftOrder,
            results: [],
            currentPickIndex: 0,
        };

        // Run all picks as AI
        const state = window.currentDraftState;
        while (state.currentPickIndex < state.draftOrder.length && state.prospects.length > 0) {
            this.aiDraftPick(state.draftOrder[state.currentPickIndex]);
            state.currentPickIndex++;
        }

        gameState._draftComplete = true;
        gameState._draftStarted = true;

        // Undrafted to FA
        state.prospects.forEach(prospect => {
            prospect.previousTeamId = null;
            gameState.freeAgents.push(prospect);
        });

        // College graduates to FA
        const graduates = this.generateCollegeGraduateClass();
        graduates.forEach(g => { g.previousTeamId = null; gameState.freeAgents.push(g); });
        gameState._collegeFAComplete = true;

        // Post-draft roster trim to 20
        const MAX_OFFSEASON_ROSTER = 20;
        const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
        allTeams.forEach(team => {
            if (!team.roster || team.roster.length <= MAX_OFFSEASON_ROSTER) return;
            team.roster.sort((a, b) => a.rating - b.rating);
            const excess = team.roster.length - MAX_OFFSEASON_ROSTER;
            const cut = team.roster.splice(0, excess);
            cut.forEach(player => {
                player.contractYears = player.contractYears || 1;
                gameState.freeAgents.push(player);
            });
        });

        gameState.draftClass = [];
        gameState._draftResults = state.results;
        delete window.currentDraftState;

        console.log(`[DRAFT] Complete silently: ${state.results.length} picks, ${graduates.length} college grads to FA`);

        // Show draft results to T2/T3 users so they can see who was drafted
        if (window._reactShowDraftResults) {
            window._reactShowDraftResults({
                results: gameState._draftResults,
                getRatingColor: helpers.getRatingColor,
            });
        }
    }
}
