// ═══════════════════════════════════════════════════════════════════════════════
// OffseasonController.js — Offseason flow orchestration
// Manages the complete offseason pipeline:
//   Season End → Postseason → Promotion/Relegation → Draft → College Grad FA →
//   Player Development → Contract Decisions → Free Agency → Roster Compliance →
//   Owner Mode → Season Setup
// ═══════════════════════════════════════════════════════════════════════════════



/**
 * OffseasonController orchestrates the entire offseason flow.
 * 
 * It receives a `ctx` context object from index.html containing all needed
 * dependencies (gameState, engines, helper functions, DOM accessors).
 * This avoids tight coupling while keeping the logic centralized.
 */
export class OffseasonController {
    // Offseason phases in order — each maps to a calendar date
    static PHASES = {
        NONE: 'none',                       // Regular season
        SEASON_ENDED: 'season_ended',       // Season end modal shown
        POSTSEASON: 'postseason',           // Championship playoffs
        PROMO_REL: 'promo_rel',             // Promotion/relegation
        DRAFT: 'draft',                     // T1 Draft
        COLLEGE_FA: 'college_fa',           // College grad FA (T2/T3)
        DEVELOPMENT: 'development',         // Player development
        FREE_AGENCY: 'free_agency',         // Free agency period
        ROSTER_COMPLIANCE: 'roster_compliance', // Roster compliance check
        OWNER_MODE: 'owner_mode',           // Financial decisions
        SETUP_COMPLETE: 'setup_complete',   // New season ready
    };

    /**
     * @param {Object} ctx - Context with all dependencies
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.playerDevelopmentInProgress = false;
        this.coachMarketPool = [];
    }

    // ═══════════════════════════════════════════════════════════════════
    // Offseason Phase Management
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Set the current offseason phase and advance the calendar date.
     * Automatically saves after every phase transition so that a reload
     * always resumes from the correct phase.
     */
    setPhase(phase) {
        const { gameState, engines, helpers } = this.ctx;
        const P = OffseasonController.PHASES;
        gameState.offseasonPhase = phase;

        // Advance calendar date to match the phase
        const seasonDates = engines.CalendarEngine.getSeasonDates(gameState.seasonStartYear || gameState.currentSeason);
        const phaseToDate = {
            [P.SEASON_ENDED]:       seasonDates.seasonEnd,
            [P.POSTSEASON]:         seasonDates.playoffsStart,
            [P.PROMO_REL]:          seasonDates.seasonOfficialEnd,
            [P.DRAFT]:              seasonDates.draftDay,
            [P.COLLEGE_FA]:         seasonDates.collegeFA,
            [P.DEVELOPMENT]:        seasonDates.playerDevelopment,
            [P.FREE_AGENCY]:        seasonDates.freeAgencyStart,
            [P.ROSTER_COMPLIANCE]:  seasonDates.rosterCompliance,
            [P.OWNER_MODE]:         seasonDates.ownerDecisions,
            [P.SETUP_COMPLETE]:     seasonDates.trainingCamp,
        };

        const date = phaseToDate[phase];
        if (date) {
            gameState.currentDate = engines.CalendarEngine.toDateString(date);
        }

        console.log(`📅 Offseason phase: ${phase}${date ? ' (date: ' + gameState.currentDate + ')' : ''}`);

        // Auto-save at every phase transition so reload resumes correctly
        if (phase !== P.NONE) {
            helpers.saveGameState();
        }
    }

    /**
     * Resume the offseason from the current phase.
     * Called when user closes a modal or returns from roster management
     * during the offseason. Picks up where we left off.
     */
    resumeOffseason() {
        const { gameState } = this.ctx;
        const phase = gameState.offseasonPhase;
        const P = OffseasonController.PHASES;

        console.log(`🔄 Resuming offseason from phase: ${phase}`);

        switch (phase) {
            case P.SEASON_ENDED:
                // Re-show season end modal
                this.ctx.helpers.getGameSimController().showSeasonEnd();
                break;
            case P.POSTSEASON:
                // Resume into PlayoffHub if registered, otherwise continue to promo/rel.
                if (window._reactShowPlayoffHub) {
                    const gs = this.ctx.gameState;
                    window._reactShowPlayoffHub({
                        action: gs.userPlayoffResult || 'stay',
                        userTier: gs.currentTier,
                        userTeamId: gs.userTeamId,
                        userInPlayoffs: gs.userInPlayoffs,
                        userSeriesId: gs.userSeriesId,
                        playoffData: gs.playoffData,
                        playoffSchedule: gs.playoffSchedule,
                        currentDate: gs.currentDate,
                        postseasonResults: gs.postseasonResults,
                        onComplete: () => this.continueAfterPostseason(),
                    });
                } else {
                    // Postseason already ran; continue to promo/rel
                    this.continueAfterPostseason();
                }
                break;
            case P.PROMO_REL:
                // Promo/rel already executed; skip to draft/development
                this.proceedToDraftOrDevelopment();
                break;
            case P.DRAFT:
                // Draft is interactive and one-time; if resuming, it already ran.
                // College grads are now generated at draft finalization and added to FA pool.
                // Skip to free agency (via development if needed).
                this.proceedToPlayerDevelopment();
                break;
            case P.COLLEGE_FA:
                // Legacy phase — college grads now flow to FA at draft time.
                // If resuming from an old save that was mid-college-FA, skip forward.
                this.ctx.gameState._collegeFAComplete = true;
                this.proceedToPlayerDevelopment();
                break;
            case P.DEVELOPMENT:
                // Development is a one-time operation; if we're resuming,
                // it already ran. Skip to free agency.
                this.startFreeAgencyPeriod();
                break;
            case P.FREE_AGENCY:
                this.startFreeAgencyPeriod();
                break;
            case P.ROSTER_COMPLIANCE:
                this.checkRosterComplianceAndContinue();
                break;
            case P.OWNER_MODE:
                this.showOffseasonManagement();
                break;
            case P.SETUP_COMPLETE:
                this.continueToSeasonSetup();
                break;
            default:
                console.warn('⚠️ Unknown offseason phase:', phase, '— showing season end');
                this.ctx.helpers.getGameSimController().showSeasonEnd();
                break;
        }
    }

    /**
     * Check if we're currently in the offseason flow
     */
    isInOffseason() {
        const { gameState } = this.ctx;
        const phase = gameState.offseasonPhase;
        return phase && phase !== OffseasonController.PHASES.NONE;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 1: Season End → Postseason
    // ═══════════════════════════════════════════════════════════════════

    advanceToNextSeason(action) {
        const { gameState, eventBus, GameEvents, engines, helpers } = this.ctx;
        const P = OffseasonController.PHASES;

        console.log('═══════════════════════════════════════════════════════════');
        console.log('🎬 advanceToNextSeason called with action:', action);
        console.log('═══════════════════════════════════════════════════════════');

        this.setPhase(P.POSTSEASON);

        eventBus.emit(GameEvents.SEASON_ENDED, {
            season: gameState.season,
            userTeamId: gameState.userTeamId,
            userPlayoffResult: action
        });

        // Close any open modals
        if (window._reactCloseSeasonEnd) window._reactCloseSeasonEnd();

        gameState.userPlayoffResult = action;

        // ═══════════════════════════════════════════════════════════════════
        // INITIALIZE PLAYOFFS — Generate brackets and schedule, NO simulation
        // ═══════════════════════════════════════════════════════════════════
        
        console.log('🏀 Initializing playoff brackets...');
        
        // Generate brackets for all tiers (this just seeds teams, no games played)
        const t1Bracket = engines.PlayoffEngine.generateT1Bracket(gameState.tier1Teams);
        const t2Bracket = engines.PlayoffEngine.generateT2Bracket(gameState.tier2Teams);
        const t3Bracket = engines.PlayoffEngine.generateT3Bracket(gameState.tier3Teams);
        
        // Store brackets in gameState
        gameState.playoffData = {
            t1: t1Bracket,
            t2: t2Bracket,
            t3: t3Bracket,
            initialized: true,
            completed: false
        };
        
        console.log('📅 Generating playoff calendar...');
        
        // Generate playoff schedule with all potential games dated
        const seasonStartYear = gameState.seasonStartYear || gameState.currentSeason;
        const playoffSchedule = engines.PlayoffEngine.generatePlayoffSchedule(
            { t1: t1Bracket, t2: t2Bracket, t3: t3Bracket },
            seasonStartYear
        );
        
        // Store schedule in gameState
        gameState.playoffSchedule = playoffSchedule;
        
        console.log(`✅ Playoff calendar generated: ${playoffSchedule.games.length} potential games`);
        console.log(`   T1 games: ${playoffSchedule.games.filter(g => g.tier === 1).length}`);
        console.log(`   T2 games: ${playoffSchedule.games.filter(g => g.tier === 2).length}`);
        console.log(`   T3 games: ${playoffSchedule.games.filter(g => g.tier === 3).length}`);
        
        // Set current date to playoffs start
        const playoffDates = engines.PlayoffEngine.getPlayoffDates(seasonStartYear);
        gameState.currentDate = playoffDates.t1Round1Start;
        
        // Determine user's playoff status
        const userTeam = helpers.getUserTeam();
        const userTier = gameState.currentTier;
        let userInPlayoffs = false;
        let userSeriesId = null;
        
        if (userTier === 1) {
            // Check if user's team is in T1 bracket (top 8 in their conference)
            const inEast = t1Bracket.east?.some(t => t.id === userTeam.id);
            const inWest = t1Bracket.west?.some(t => t.id === userTeam.id);
            userInPlayoffs = inEast || inWest;
            if (userInPlayoffs) {
                // Find user's first round series
                const conf = inEast ? 'east' : 'west';
                const confTeams = inEast ? t1Bracket.east : t1Bracket.west;
                const userSeed = confTeams.findIndex(t => t.id === userTeam.id);
                // Matchups are 0v7, 1v6, 2v5, 3v4
                const matchupIdx = userSeed < 4 ? userSeed : 7 - userSeed;
                userSeriesId = `t1-r1-${conf}-${Math.min(userSeed, 7 - userSeed) + 1}v${Math.max(userSeed, 7 - userSeed) + 1}`;
            }
        } else if (userTier === 2) {
            // Check if user's team is in T2 division playoffs (top 4 in division)
            const userDiv = userTeam.division;
            const divBracket = t2Bracket.divisionBrackets?.find(db => db.division === userDiv);
            if (divBracket) {
                userInPlayoffs = [divBracket.seed1, divBracket.seed2, divBracket.seed3, divBracket.seed4]
                    .filter(Boolean)
                    .some(t => t.id === userTeam.id);
                if (userInPlayoffs) {
                    const divId = userDiv.toLowerCase().replace(/\s+/g, '-');
                    // Determine which semi the user is in
                    if (divBracket.seed1?.id === userTeam.id || divBracket.seed4?.id === userTeam.id) {
                        userSeriesId = `t2-div-${divId}-s1`;
                    } else {
                        userSeriesId = `t2-div-${divId}-s2`;
                    }
                }
            }
        } else if (userTier === 3) {
            // Check if user's team is in T3 metro playoffs (top 2 in metro)
            const userDiv = userTeam.division;
            const metroMatchup = t3Bracket.metroMatchups?.find(m => m.division === userDiv);
            if (metroMatchup) {
                userInPlayoffs = metroMatchup.seed1?.id === userTeam.id || metroMatchup.seed2?.id === userTeam.id;
                if (userInPlayoffs) {
                    const divId = userDiv.toLowerCase().replace(/\s+/g, '-');
                    userSeriesId = `t3-metro-${divId}`;
                }
            }
        }
        
        gameState.userInPlayoffs = userInPlayoffs;
        gameState.userSeriesId = userSeriesId;
        
        console.log(`👤 User playoff status: ${userInPlayoffs ? 'IN PLAYOFFS' : 'ELIMINATED'}`);
        if (userSeriesId) console.log(`   User's first series: ${userSeriesId}`);
        
        // Save state before showing hub
        helpers.saveGameState();
        
        // ═══════════════════════════════════════════════════════════════════
        // SHOW PLAYOFF HUB — User controls simulation from here
        // ═══════════════════════════════════════════════════════════════════
        
        if (window._reactShowPlayoffHub) {
            console.log('🏆 Showing PlayoffHub...');
            window._reactShowPlayoffHub({
                action,
                userTier,
                userTeamId: gameState.userTeamId,
                userInPlayoffs,
                userSeriesId,
                playoffData: gameState.playoffData,
                playoffSchedule: gameState.playoffSchedule,
                currentDate: gameState.currentDate,
                onComplete: () => this.continueAfterPostseason(),
            });
        } else {
            console.error('❌ PlayoffHub not available - window._reactShowPlayoffHub not registered');
            // No legacy fallback — skip directly to offseason
            console.warn('⚠️ Skipping playoffs, proceeding to offseason...');
            this.continueAfterPostseason();
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 2: Continue After Postseason → Promotion/Relegation
    // ═══════════════════════════════════════════════════════════════════

    continueAfterPostseason() {
        const { gameState, eventBus, GameEvents, engines, helpers } = this.ctx;
        const P = OffseasonController.PHASES;

        if (window._reactClosePlayoffHub) window._reactClosePlayoffHub();

        // Open OffseasonHub — this will stay open throughout the entire offseason
        if (window._reactShowOffseasonHub) {
            console.log('🌴 [OFFSEASON] Opening OffseasonHub...');
            window._reactShowOffseasonHub({
                userTier: gameState.currentTier,
                userTeamId: helpers.getUserTeam()?.id,
                season: gameState.season,
            });
        }

        this.setPhase(P.PROMO_REL);

        // ═══ CAPTURE SEASON HISTORY SNAPSHOT ═══
        const postseason = gameState.postseasonResults;
        if (gameState._seasonEndData && postseason) {
            const snapshot = gameState._seasonEndData;

            snapshot.champions = {
                tier1: postseason.t1 && postseason.t1.champion ? { id: postseason.t1.champion.id, name: postseason.t1.champion.name, city: postseason.t1.champion.city } : null,
                tier2: postseason.t2 && postseason.t2.champion ? { id: postseason.t2.champion.id, name: postseason.t2.champion.name, city: postseason.t2.champion.city } : null,
                tier3: postseason.t3 && postseason.t3.champion ? { id: postseason.t3.champion.id, name: postseason.t3.champion.name, city: postseason.t3.champion.city } : null
            };

            snapshot.promotions = {
                toT1: (postseason.promoted && postseason.promoted.toT1 || []).map(t => ({ id: t.id, name: t.name })),
                toT2: (postseason.promoted && postseason.promoted.toT2 || []).map(t => ({ id: t.id, name: t.name }))
            };
            snapshot.relegations = {
                fromT1: (postseason.relegated && postseason.relegated.fromT1 || []).map(t => ({ id: t.id, name: t.name })),
                fromT2: (postseason.relegated && postseason.relegated.fromT2 || []).map(t => ({ id: t.id, name: t.name }))
            };

            const userTeamSnap = helpers.getUserTeam();
            if (userTeamSnap) {
                const userTier = gameState.currentTier;
                const tierStandings = userTier === 1 ? snapshot.standings.tier1 : userTier === 2 ? snapshot.standings.tier2 : snapshot.standings.tier3;
                const userStanding = tierStandings.find(t => t.id === userTeamSnap.id);

                // Build rich topPlayer snapshot with full stat line
                let topPlayer = null;
                if (userTeamSnap.roster && userTeamSnap.roster.length > 0) {
                    const best = [...userTeamSnap.roster].sort((a, b) => b.rating - a.rating)[0];
                    const ss = best.seasonStats;
                    const gp = ss && ss.gamesPlayed > 0 ? ss.gamesPlayed : 1;
                    topPlayer = {
                        name: best.name, rating: best.rating, position: best.position,
                        gamesPlayed: ss ? ss.gamesPlayed : 0,
                        ppg: ss ? +(ss.points / gp).toFixed(1) : 0,
                        rpg: ss ? +(ss.rebounds / gp).toFixed(1) : 0,
                        apg: ss ? +(ss.assists / gp).toFixed(1) : 0,
                        spg: ss ? +(ss.steals / gp).toFixed(1) : 0,
                        bpg: ss ? +(ss.blocks / gp).toFixed(1) : 0,
                        fgPct: ss && ss.fieldGoalsAttempted > 0
                            ? +(ss.fieldGoalsMade / ss.fieldGoalsAttempted * 100).toFixed(1) : 0,
                        threePct: ss && ss.threePointersAttempted > 0
                            ? +(ss.threePointersMade / ss.threePointersAttempted * 100).toFixed(1) : 0,
                        ftPct: ss && ss.freeThrowsAttempted > 0
                            ? +(ss.freeThrowsMade / ss.freeThrowsAttempted * 100).toFixed(1) : 0,
                    };
                }

                // Determine user's playoff result for this season
                const playoffResult = (() => {
                    const action = gameState.userPlayoffResult;
                    if (!action || action === 'stay') return { result: 'missed', label: 'Missed Playoffs' };

                    if (userTier === 1) {
                        if (action !== 'championship') return { result: 'missed', label: 'Missed Playoffs' };
                        const cpd = gameState.championshipPlayoffData;
                        let seed = null, conf = null;
                        if (cpd) {
                            const eastIdx = cpd.eastTeams ? cpd.eastTeams.findIndex(t => t.id === userTeamSnap.id) : -1;
                            const westIdx = cpd.westTeams ? cpd.westTeams.findIndex(t => t.id === userTeamSnap.id) : -1;
                            if (eastIdx >= 0) { seed = eastIdx + 1; conf = 'East'; }
                            else if (westIdx >= 0) { seed = westIdx + 1; conf = 'West'; }
                        }
                        const roundNames = ['First Round', 'Conf. Semifinals', 'Conf. Finals', 'Finals'];
                        let eliminatedRound = null;
                        let isChamp = false;
                        if (cpd && cpd.roundResults) {
                            for (let r = 0; r < cpd.roundResults.length; r++) {
                                const roundSeries = cpd.roundResults[r];
                                const userSeries = roundSeries.find(s =>
                                    s.result && (s.result.loser && s.result.loser.id === userTeamSnap.id ||
                                                 s.result.winner && s.result.winner.id === userTeamSnap.id)
                                );
                                if (userSeries) {
                                    if (userSeries.result.loser && userSeries.result.loser.id === userTeamSnap.id) {
                                        eliminatedRound = roundNames[r] || ('Round ' + (r + 1));
                                        break;
                                    }
                                    if (r === 3 && userSeries.result.winner && userSeries.result.winner.id === userTeamSnap.id) {
                                        isChamp = true;
                                    }
                                }
                            }
                        }
                        if (isChamp) return { result: 'champion', label: 'Champion', seed, conf };
                        if (eliminatedRound) return { result: 'eliminated', label: 'Eliminated — ' + eliminatedRound, seed, conf };
                        return { result: 'playoffs', label: 'Playoffs', seed, conf };
                    }

                    if (userTier === 2) {
                        if (action !== 't2-championship') return { result: 'missed', label: 'Missed Playoffs' };
                        const pr = postseason.t2;
                        if (!pr) return { result: 'playoffs', label: 'Playoffs' };
                        if (pr.champion && pr.champion.id === userTeamSnap.id) return { result: 'champion', label: 'T2 Champion' };
                        let reachedFinal = false, reachedSemis = false;
                        (pr.divisions || []).forEach(d => {
                            if (!d) return;
                            if (d.finalResult && d.finalResult.loser && d.finalResult.loser.id === userTeamSnap.id) reachedFinal = true;
                            if (d.semi1Result && d.semi1Result.loser && d.semi1Result.loser.id === userTeamSnap.id) reachedSemis = true;
                            if (d.semi2Result && d.semi2Result.loser && d.semi2Result.loser.id === userTeamSnap.id) reachedSemis = true;
                        });
                        if (reachedFinal) return { result: 'eliminated', label: 'Eliminated — Division Final' };
                        if (reachedSemis) return { result: 'eliminated', label: 'Eliminated — Division Semis' };
                        return { result: 'playoffs', label: 'Playoffs' };
                    }

                    if (userTier === 3) {
                        if (action !== 't3-championship') return { result: 'missed', label: 'Missed Playoffs' };
                        const pr = postseason.t3;
                        if (!pr) return { result: 'playoffs', label: 'Playoffs' };
                        if (pr.champion && pr.champion.id === userTeamSnap.id) return { result: 'champion', label: 'T3 Champion' };
                        return { result: 'eliminated', label: 'Playoffs' };
                    }

                    return { result: 'missed', label: 'Missed Playoffs' };
                })();

                snapshot.userTeam = {
                    id: userTeamSnap.id, name: userTeamSnap.name, city: userTeamSnap.city,
                    tier: userTier, wins: userTeamSnap.wins, losses: userTeamSnap.losses,
                    rank: userStanding ? userStanding.rank : null,
                    totalTeams: tierStandings.length,
                    coachName: userTeamSnap.coach ? userTeamSnap.coach.name : 'None',
                    rosterSize: userTeamSnap.roster ? userTeamSnap.roster.length : 0,
                    topPlayer,
                    playoff: playoffResult,
                };
            }

            if (!gameState._fullSeasonHistory) gameState._fullSeasonHistory = [];
            if (!gameState._fullSeasonHistory.some(h => h.season === snapshot.season)) {
                gameState._fullSeasonHistory.push(snapshot);
                console.log(`📜 Season ${snapshot.seasonLabel} snapshot captured (${JSON.stringify(snapshot).length} bytes)`);
            }

            engines.StorageEngine.saveSeasonSnapshot(snapshot.season, snapshot);
            delete gameState._seasonEndData;
        }

        // Execute promotion/relegation
        const userTeamBefore = helpers.getUserTeam();
        const tierBefore = userTeamBefore ? userTeamBefore.tier : gameState.currentTier;

        console.log('⬆️⬇️ Executing promotion/relegation from postseason results...');
        if (!gameState.postseasonResults) {
            console.warn('⚠️ continueAfterPostseason: postseasonResults is null — running simulateFullPostseason now');
            gameState.postseasonResults = engines.PlayoffEngine.simulateFullPostseason(gameState);
        }
        this.executePromotionRelegationFromResults(gameState.postseasonResults);

        const userTeam = helpers.getUserTeam();
        const tierAfter = userTeam ? userTeam.tier : gameState.currentTier;
        const tierChanged = tierBefore !== tierAfter;

        if (tierChanged && userTeam) {
            const action = tierAfter > tierBefore ? 'relegated' : 'promoted';
            eventBus.emit(tierAfter < tierBefore ? GameEvents.TEAM_PROMOTED : GameEvents.TEAM_RELEGATED, {
                teamId: userTeam.id, teamName: userTeam.name,
                fromTier: tierBefore, toTier: tierAfter
            });
            this.showFinancialTransitionBriefing(userTeam, action);
            return;
        }

        eventBus.emit(GameEvents.PROMO_REL_COMPLETED, { season: gameState.season, tierChanged: false });
        
        // ─── HUB-BASED OFFSEASON ───────────────────────────────────────────
        // Don't auto-trigger draft/FA here. The OffseasonHub is now open and
        // the user can sim forward using the dashboard controls. Events will
        // trigger when their dates are reached via _checkDateTriggers().
        // 
        // The date is currently around Jun 1 (promo/rel). User sims to:
        //   - Jun 15: Draft (T1) or College FA (T2/T3)
        //   - Jul 1:  Free Agency
        //   - Aug 1:  Development
        //   - Aug 16: Training Camp / New Season
        console.log('🌴 [OFFSEASON] Promo/rel complete. User can now sim forward in OffseasonHub.');
        helpers.saveGameState();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Promotion / Relegation
    // ═══════════════════════════════════════════════════════════════════

    executePromotionRelegationFromResults(results) {
        const { gameState, engines } = this.ctx;

        if (!results) {
            console.error('❌ executePromotionRelegationFromResults: results is null, skipping promotion/relegation');
            return;
        }

        const result = engines.LeagueManager.executePromotionRelegation(
            {
                t1Relegated: results.relegated.fromT1,
                t2PromotedToT1: results.promoted.toT1,
                t2RelegatedToT3: results.relegated.fromT2,
                t3PromotedToT2: results.promoted.toT2,
                gameState
            },
            {
                SalaryCapEngine: engines.SalaryCapEngine,
                DivisionManager: engines.DivisionManager
            }
        );

        if (!result.success) {
            alert('Critical Error: ' + result.error + '\nCannot advance season.');
        }
    }

    showFinancialTransitionBriefing(team, action) {
        const { gameState, engines, helpers } = this.ctx;

        engines.FinanceEngine.ensureFinances(team);
        const f = team.finances;
        const isRelegation = (action === 'relegate' || action === 'relegated');
        const isPromotion = (action === 'promote' || action === 'promoted');
        const previousTier = f.previousTier || (isRelegation ? team.tier - 1 : team.tier + 1);
        const currentTier = team.tier;

        const summary = engines.FinanceEngine.getFinancialSummary(team);
        const roster = team.roster || [];
        const totalSalary = Math.round(helpers.calculateTeamSalary(team));
        const spendingLimit = summary.spendingLimit;
        const capSpace = spendingLimit - totalSalary;

        const expiring = roster.filter(p => p.contractYears <= 1);
        const locked = roster.filter(p => p.contractYears > 1);
        const lockedSalary = locked.reduce((sum, p) => sum + (p.salary || 0), 0);
        const expiringSalary = expiring.reduce((sum, p) => sum + (p.salary || 0), 0);
        const releasedPlayers = team._relegationReleased || [];
        const rosterBySalary = [...roster].sort((a, b) => (b.salary || 0) - (a.salary || 0));

        const oldTierBaseline = engines.FinanceEngine.TIER_BASELINES[previousTier];
        const newTierBaseline = engines.FinanceEngine.TIER_BASELINES[currentTier];
        const newTotalBaseline = newTierBaseline.league + newTierBaseline.matchday + newTierBaseline.commercial + newTierBaseline.legacy;

        const briefingData = {
            team, isRelegation, isPromotion, previousTier, currentTier,
            summary, totalSalary, spendingLimit, capSpace,
            locked, expiring, lockedSalary, expiringSalary,
            releasedPlayers, rosterBySalary, oldTierBaseline, newTotalBaseline,
            formatCurrency: helpers.formatCurrency, getRatingColor: helpers.getRatingColor,
            spendingRatio: f.spendingRatio, currentSeason: gameState.currentSeason
        };

        if (window._reactShowFinancialTransition) {
            const self = this;
            window._financialTransitionContinueCallback = () => {
                helpers.saveGameState();
                // Don't auto-trigger draft - hub handles it via sim controls
                console.log('🌴 [OFFSEASON] Financial transition complete. User can sim forward in OffseasonHub.');
            };
            window._financialTransitionSpendingCallback = (pct) => {
                const ratio = parseInt(pct) / 100;
                team.finances.spendingRatio = ratio;
            };
            window._reactShowFinancialTransition(briefingData);
            return;
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 3: Draft / College Grad FA
    // ═══════════════════════════════════════════════════════════════════

    proceedToDraftOrDevelopment() {
        const { gameState, eventBus, GameEvents, helpers } = this.ctx;
        const P = OffseasonController.PHASES;

        eventBus.emit(GameEvents.OFFSEASON_STARTED, { season: gameState.season });

        if (gameState.currentTier === 1) {
            console.log('🎓 Step 3: User is in Tier 1, running draft...');
            this.setPhase(P.DRAFT);
            helpers.runDraft();
        } else {
            // T2/T3: no draft, no standalone college FA (grads are in FA pool from draft time).
            // Skip directly to player development.
            console.log('⏭️ Step 3: User is in Tier ' + gameState.currentTier + ', skipping draft (college grads already in FA pool)...');
            gameState._draftComplete = true;
            gameState._collegeFAComplete = true;
            this.proceedToPlayerDevelopment();
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 4: Player Development
    // ═══════════════════════════════════════════════════════════════════

    proceedToPlayerDevelopment() {
        const { gameState, eventBus, GameEvents } = this.ctx;
        const P = OffseasonController.PHASES;

        if (this.playerDevelopmentInProgress) {
            console.warn('⚠️ Player development already in progress, skipping duplicate call');
            return;
        }
        this.setPhase(P.DEVELOPMENT);
        eventBus.emit(GameEvents.DEVELOPMENT_STARTED, { season: gameState.season });

        this.playerDevelopmentInProgress = true;
        console.log('🌟 Step 4: Applying player development...');

        const developmentResult = this.applyPlayerDevelopment();

        const hasDevChanges = developmentResult && developmentResult.developmentLog.length > 0;
        const hasRetirements = (gameState._userTeamRetirements && gameState._userTeamRetirements.length > 0) ||
                               (gameState._seasonRetirements && gameState._seasonRetirements.filter(r => r.peakRating >= 80).length > 0);

        if (hasDevChanges || hasRetirements) {
            this.showDevelopmentSummaryOnly(developmentResult ? developmentResult.developmentLog : []);
        } else {
            console.log('No significant development changes or retirements, proceeding to free agency...');
            this.startFreeAgencyPeriod();
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Contract Expiration (Jun 30) - BEFORE Free Agency
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Process contract expiration for all teams.
     * - Decrements contractYears for all players
     * - Moves players with expired contracts (contractYears <= 0) to FA pool
     * - Sets previousTeamId so former players are highlighted in FA
     * 
     * This runs BEFORE Free Agency opens so the FA pool includes all expired contracts.
     */
    runContractExpiration() {
        const { gameState, helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        
        console.log('📋 Running contract expiration for all teams...');
        
        const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
        let totalExpired = 0;
        let userExpiredCount = 0;
        
        allTeams.forEach(team => {
            const expiredPlayers = [];
            
            // Decrement contract years and identify expired contracts
            team.roster.forEach(player => {
                if (!player.contractYears) {
                    player.contractYears = 1;
                }
                player.contractYears--;
                
                if (player.contractYears <= 0) {
                    expiredPlayers.push(player);
                }
            });
            
            // Remove expired players from roster and add to FA pool
            expiredPlayers.forEach(player => {
                const index = team.roster.findIndex(p => p.id === player.id);
                if (index !== -1) {
                    team.roster.splice(index, 1);
                }
                
                // Set previousTeamId for FA highlighting
                player.previousTeamId = team.id;
                
                // Give them a new contract length for when they sign
                player.contractYears = helpers.determineContractLength(player.age, player.rating);
                player.originalContractLength = player.contractYears;
                player.contractExpired = false;
                
                gameState.freeAgents.push(player);
                totalExpired++;
                
                if (team.id === userTeam.id) {
                    userExpiredCount++;
                    console.log(`  🔓 ${player.name} (${player.rating} OVR) — contract expired, now a free agent`);
                }
            });
            
            // Log team summary if they had expirations
            if (expiredPlayers.length > 0 && team.id !== userTeam.id) {
                console.log(`  ${team.name}: ${expiredPlayers.length} contracts expired`);
            }
        });
        
        console.log(`📋 Contract Expiration Complete: ${totalExpired} players moved to FA pool`);
        if (userExpiredCount > 0) {
            console.log(`  ⭐ Your team: ${userExpiredCount} former players now in free agency`);
        }
        
        // Save after contract changes
        helpers.saveGameState();
    }

    applyPlayerDevelopment() {
        const { gameState, helpers } = this.ctx;

        console.log('🌟 Applying player development (ratings, aging, retirements)...');
        
        const userTeam = helpers.getUserTeam();
        const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
        helpers.advanceFinancialTransitions(allTeams);

        let userTeamLog = [];
        let allRetirements = [];
        let userTeamRetirements = [];

        const processTier = (teams, gamesPerSeason) => {
            teams.forEach(team => {
                const result = helpers.developTeamPlayers(team, gamesPerSeason);
                if (result && team.id === userTeam.id) {
                    userTeamLog = result.developmentLog || [];
                    userTeamRetirements = result.retirements || [];
                }
                if (result && result.retirements) allRetirements.push(...result.retirements);
            });
        };

        processTier(gameState.tier1Teams, 82);
        processTier(gameState.tier2Teams, 60);
        processTier(gameState.tier3Teams, 40);

        // Log retirement summary
        const notableRetirements = allRetirements.filter(r => r.peakRating >= 80);
        console.log('═══════════════════════════════════════════════════════');
        console.log(`👴 Retirement Summary: ${allRetirements.length} players retired`);
        if (userTeamRetirements.length > 0) {
            console.log(`   🏠 Your team: ${userTeamRetirements.map(r => `${r.name} (${r.age}yo, peak ${r.peakRating})`).join(', ')}`);
        }
        if (notableRetirements.length > 0) {
            console.log(`   ⭐ Notable retirements:`);
            notableRetirements.sort((a, b) => b.peakRating - a.peakRating).forEach(r => {
                console.log(`      ${r.name} (${r.position}) — Peak ${r.peakRating} OVR, ${r.careerLength}yr career, last with ${r.teamName}`);
            });
        }

        gameState._seasonRetirements = allRetirements;
        gameState._userTeamRetirements = userTeamRetirements;

        if (userTeamLog.length > 0) {
            console.log(`📊 ${userTeam.name} Player Development:`);
            userTeamLog.forEach(log => {
                const arrow = log.change > 0 ? '📈' : '📉';
                console.log(`  ${arrow} ${log.name} (${log.age}yo): ${log.oldRating} → ${log.newRating} (${log.change > 0 ? '+' : ''}${log.change})`);
            });
        }

        // Retire old free agents
        if (gameState.freeAgents && gameState.freeAgents.length > 0) {
            const faBefore = gameState.freeAgents.length;
            gameState.freeAgents = gameState.freeAgents.filter(player => {
                player.age = (player.age || 25) + 1;
                const retireChance = helpers.getRetirementProbability(player.age, player.rating, player.tier || 3);
                if (retireChance > 0 && Math.random() < retireChance) {
                    if (player.rating >= 75 || (player._peakRating && player._peakRating >= 80)) {
                        if (!gameState.retirementHistory) gameState.retirementHistory = [];
                        gameState.retirementHistory.push({
                            name: player.name, position: player.position, age: player.age,
                            peakRating: player._peakRating || player.rating, finalRating: player.rating,
                            careerLength: player.age - (player.isCollegeGrad ? 21 : 19),
                            lastTeam: 'Free Agent', lastTier: player.tier || 0,
                            season: gameState.currentSeason,
                            notable: (player._peakRating || player.rating) >= 88,
                            legendary: (player._peakRating || player.rating) >= 93
                        });
                    }
                    return false;
                }
                return true;
            });
            const faRetired = faBefore - gameState.freeAgents.length;
            if (faRetired > 0) console.log(`${faRetired} free agents retired`);
        }

        // Heal injuries and reset fatigue
        console.log('🏥 Healing off-season injuries...');
        [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams].forEach(team => {
            helpers.healAllInjuries(team);
        });

        console.log('😴 Resetting player fatigue for new season...');
        helpers.resetAllFatigue([...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams]);

        return { developmentLog: userTeamLog };
    }

    showDevelopmentSummaryOnly(developmentLog) {
        const { gameState } = this.ctx;
        const improvements = developmentLog.filter(log => log.change > 0);
        const declines = developmentLog.filter(log => log.change < 0);
        const userRetirements = gameState._userTeamRetirements || [];
        const allRetirements = gameState._seasonRetirements || [];
        const notableRetirements = allRetirements
            .filter(r => r.peakRating >= 80)
            .sort((a, b) => b.peakRating - a.peakRating)
            .slice(0, 10);

        // Route to React if available
        if (window._reactShowDevelopment) {
            window._developmentContinueCallback = () => {
                this.startFreeAgencyPeriod();
            };
            window._reactShowDevelopment({
                improvements, declines, userRetirements, notableRetirements,
                allRetirementsCount: allRetirements.length
            });
            return;
        }

        // Legacy fallback
        // [LEGACY REMOVED] const html = UIRenderer.developmentSummaryFull({
            // improvements, declines, userRetirements, notableRetirements,
            // allRetirementsCount: allRetirements.length
        // });

        // Development summary now rendered by React DevelopmentModal via _reactShowDevelopment
    }

    closeDevelopmentSummary() {
        this.startFreeAgencyPeriod();
    }

    // ═══════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════
    // Contract Decisions — MIGRATED Session F
    // Old interactive resign/release flow replaced by automated
    // runContractExpiration() + React ContractsScreen in OffseasonHub.
    // 9 getElementById calls removed. Business logic lives in
    // runContractExpiration() above.
    // ═══════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════
    // Free Agency Period
    // ═══════════════════════════════════════════════════════════════════

    startFreeAgencyPeriod() {
        const { gameState, eventBus, GameEvents, helpers } = this.ctx;
        const P = OffseasonController.PHASES;

        this.setPhase(P.FREE_AGENCY);
        console.log('🤝 Free Agency Period Starting...');
        eventBus.emit(GameEvents.FREE_AGENCY_STARTED, {
            season: gameState.season,
            freeAgentCount: gameState.freeAgents ? gameState.freeAgents.length : 0
        });
        console.log('  Free agents available:', gameState.freeAgents.length);

        helpers.clearMarketValueCache(gameState.freeAgents);

        if (!gameState.freeAgents || gameState.freeAgents.length === 0) {
            console.log('  No free agents available, skipping to roster check');
            this.runAISigningAndContinue();
            return;
        }

        // Fix undefined previousTeamId
        let undefinedCount = 0, validCount = 0;
        gameState.freeAgents.forEach(player => {
            if (player.previousTeamId === undefined) {
                player.previousTeamId = null;
                undefinedCount++;
            } else {
                validCount++;
            }
        });
        console.log(`📊 FA Pool previousTeamId check: ${validCount} with valid IDs, ${undefinedCount} were undefined (set to null)`);

        gameState.userFreeAgencyOffers = [];
        helpers.showFreeAgencyModal();
    }

    runAISigningAndContinue() {
        const { gameState, engines, helpers } = this.ctx;

        try {
            console.log(`[AI FA] Running AI free agent signing... Pool: ${gameState.freeAgents.length} players`);
            const userTeam = helpers.getUserTeam();
            const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
            const aiTeams = allTeams.filter(t => t.id !== userTeam.id);

            const totalSigned = engines.FreeAgencyEngine.aiSigningPhase(
                { aiTeams, freeAgentPool: gameState.freeAgents },
                { TeamFactory: engines.TeamFactory, getEffectiveCap: helpers.getEffectiveCap, calculateTeamSalary: helpers.calculateTeamSalary }
            );

            console.log(`[AI FA] Complete: ${totalSigned} veterans signed. Pool remaining: ${gameState.freeAgents.length}`);

            this.checkRosterComplianceAndContinue();
        } catch (err) {
            console.error('Error in runAISigningAndContinue:', err);
            alert('Error during AI signing phase: ' + err.message + '\n\nCheck console for details.');
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Roster Compliance Check
    // ═══════════════════════════════════════════════════════════════════

    checkRosterComplianceAndContinue() {
        const { gameState, helpers } = this.ctx;
        const P = OffseasonController.PHASES;
        this.setPhase(P.ROSTER_COMPLIANCE);
        try {
        const userTeam = helpers.getUserTeam();
        if (!userTeam) { this.showOffseasonManagement(); return; }

        helpers.ensureRosterExists(userTeam);

        const totalSalary = helpers.calculateTeamSalary(userTeam);
        const salaryCap = helpers.getEffectiveCap(userTeam);
        const rosterSize = userTeam.roster.length;
        const isOverCap = totalSalary > salaryCap;
        const isUnderMinimum = rosterSize < 12;
        const isOverMaximum = rosterSize > 15;

        if (isOverCap || isUnderMinimum || isOverMaximum) {
            console.log(`Roster compliance issue: overCap=${isOverCap}, underMin=${isUnderMinimum}, overMax=${isOverMaximum}`);

            // Show compliance banner — user decides who to release
            this.showRosterComplianceModal(isOverCap, isUnderMinimum, isOverMaximum,
                totalSalary, salaryCap, rosterSize);
            return;
        }

        // Compliant — in hub mode, show success banner; in legacy mode, continue to owner mode
        if (window._reactShowCompliance) {
            console.log('✅ Roster compliant — showing success banner');
            window._reactShowCompliance({
                isOverCap: false, 
                isUnderMinimum: false, 
                isOverMaximum: false,
                totalSalary: helpers.calculateTeamSalary(userTeam), 
                salaryCap: helpers.getEffectiveCap(userTeam), 
                rosterSize: userTeam.roster.length, 
                tier: userTeam.tier,
                formatCurrency: helpers.formatCurrency
            });
            return;
        }
        
        // Legacy flow
        this.showOffseasonManagement();
        } catch (err) {
            console.error('❌ Error in checkRosterComplianceAndContinue:', err);
            alert('Error during roster compliance check: ' + err.message + '\n\nCheck console for details.');
        }
    }

    showRosterComplianceModal(isOverCap, isUnderMinimum, isOverMaximum, totalSalary, salaryCap, rosterSize) {
        const { helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const tier = userTeam ? userTeam.tier : 1;

        if (window._reactShowCompliance) {
            window._complianceManageRosterCallback = () => {
                window.openRosterManagementFromCompliance && window.openRosterManagementFromCompliance();
            };
            window._complianceRecheckCallback = () => {
                window.recheckRosterCompliance && window.recheckRosterCompliance();
            };
            window._reactShowCompliance({
                isOverCap, isUnderMinimum, isOverMaximum,
                totalSalary, salaryCap, rosterSize, tier,
                formatCurrency: helpers.formatCurrency
            });
            return;
        }

        // Compliance modal now rendered by React ComplianceModal via _reactShowCompliance
    }

    // ═══════════════════════════════════════════════════════════════════
    // Owner Mode / Offseason Management
    // ═══════════════════════════════════════════════════════════════════

    showOffseasonManagement() {
        const P = OffseasonController.PHASES;
        this.setPhase(P.OWNER_MODE);
        try {
        const { helpers, engines } = this.ctx;
        const userTeam = helpers.getUserTeam();
        engines.FinanceEngine.ensureFinances(userTeam);

        helpers.generateSponsorOffers(userTeam);

        if (!userTeam.finances.ownerMode) {
            helpers.applyAIFinancialDefaults(userTeam);
            this.continueToSeasonSetup();
            return;
        }

        helpers.showOwnerModeModal(userTeam);
        } catch (err) {
            console.error('❌ Error in showOffseasonManagement:', err);
            alert('Error during offseason management: ' + err.message + '\n\nCheck console for details.');
        }
    }

    confirmOffseasonDecisions() {
        const { gameState, helpers, engines } = this.ctx;
        const team = helpers.getUserTeam();
        if (!team || !team.finances) return;

        console.log('═══════════════════════════════════════════════════════');
        console.log('📋 Offseason Financial Decisions Confirmed:');
        console.log(`   Sponsors: ${team.finances.sponsorships.length} active deals`);
        console.log(`   Arena: ${team.finances.arena.capacity} seats, ${team.finances.arena.condition}% condition`);
        console.log(`   Tickets: ${Math.round(team.finances.ticketPriceMultiplier * 100)}% of base`);
        console.log(`   Marketing: ${helpers.formatCurrency(team.finances.marketingBudget)}/season`);
        if (team.tier !== 1) {
            console.log(`   Spending Ratio: ${Math.round(team.finances.spendingRatio * 100)}%`);
        }
        console.log(`   Spending Limit: ${helpers.formatCurrency(engines.FinanceEngine.getSpendingLimit(team))}`);
        console.log('═══════════════════════════════════════════════════════');

        // Close modal
        if (window._reactCloseOwnerMode) window._reactCloseOwnerMode();

        helpers.saveGameState();
        this.continueToSeasonSetup();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 5: Continue to Season Setup (final step)
    // ═══════════════════════════════════════════════════════════════════

    continueToSeasonSetup() {
        const { gameState, eventBus, GameEvents, engines, helpers } = this.ctx;
        const P = OffseasonController.PHASES;

        console.log('🏁 Step 5: Final season setup...');
        this.setPhase(P.SETUP_COMPLETE);
        eventBus.emit(GameEvents.OFFSEASON_COMPLETED, { season: gameState.season });

        this.playerDevelopmentInProgress = false;
        gameState.currentGame = 0;
        gameState.viewingTier = null;

        // Increment season
        gameState.currentSeason++;
        gameState.seasonStartYear = gameState.currentSeason;
        gameState.seasonDates = null;
        gameState._allStarCompleted = false;
        gameState._allStarResults = null;
        console.log(`📅 Season incremented to: ${gameState.currentSeason}`);

        // Calendar dates
        const seasonDates = engines.CalendarEngine.getSeasonDates(gameState.seasonStartYear);
        gameState.currentDate = engines.CalendarEngine.toDateString(seasonDates.t1Start);

        // Advance coaches
        console.log('🎓 Advancing coaches...');
        [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams].forEach(team => {
            if (team.coach) {
                const status = engines.CoachEngine.advanceCoachSeason(team.coach);
                if (status === 'retired') {
                    console.log(`🎓 ${team.coach.name} retired from ${team.name}`);
                    team.coach = engines.CoachEngine.generateCoach(team.tier);
                    team.coach.teamId = team.id;
                } else if (team.coach.contractYears <= 0) {
                    if (team.id !== gameState.userTeamId) {
                        if (Math.random() < 0.6) {
                            team.coach.contractYears = engines.CoachEngine._generateContractLength(team.coach.overall, team.coach.age);
                        } else {
                            team.coach = engines.CoachEngine.generateCoach(team.tier);
                            team.coach.teamId = team.id;
                        }
                    }
                }
            }
        });
        this.coachMarketPool = [];

        // Reset teams for new season
        const resetTier = (teams, ratingMin, ratingMax) => {
            teams.forEach(team => {
                team.wins = 0;
                team.losses = 0;
                team.pointDiff = 0;
                team.rating = Math.max(ratingMin, Math.min(ratingMax, team.rating + (Math.random() - 0.5) * 5));
                if (team.roster) {
                    team.roster.forEach(player => {
                        player.gamesPlayed = 0;
                        engines.StatEngine.archiveSeasonStats(player);
                        engines.StatEngine.initializeSeasonStats(player);
                    });
                }
            });
        };

        resetTier(gameState.tier1Teams, 70, 100);
        resetTier(gameState.tier2Teams, 65, 95);
        resetTier(gameState.tier3Teams, 55, 85);

        // Generate schedules
        const calSeasonDates = engines.CalendarEngine.getSeasonDates(gameState.seasonStartYear);
        const t1Start = engines.CalendarEngine.toDateString(calSeasonDates.t1Start);
        const t2Start = engines.CalendarEngine.toDateString(calSeasonDates.t2Start);
        const t3Start = engines.CalendarEngine.toDateString(calSeasonDates.t3Start);
        const seasonEnd = engines.CalendarEngine.toDateString(calSeasonDates.seasonEnd);

        console.log('📅 Generating calendar schedules for new season...');
        gameState.tier1Schedule = engines.CalendarEngine.generateCalendarSchedule(gameState.tier1Teams, 82, t1Start, seasonEnd, calSeasonDates, 1);
        gameState.tier2Schedule = engines.CalendarEngine.generateCalendarSchedule(gameState.tier2Teams, 60, t2Start, seasonEnd, calSeasonDates, 2);
        gameState.tier3Schedule = engines.CalendarEngine.generateCalendarSchedule(gameState.tier3Teams, 40, t3Start, seasonEnd, calSeasonDates, 3);

        if (gameState.currentTier === 1) gameState.schedule = gameState.tier1Schedule;
        else if (gameState.currentTier === 2) gameState.schedule = gameState.tier2Schedule;
        else gameState.schedule = gameState.tier3Schedule;

        helpers.saveGameState();

        // Sim button states managed by React SimControls component

        console.log('✅ Step 5 complete: New season ready!');
        console.log('Current game:', gameState.currentGame);
        console.log('Season:', gameState.currentSeason);
        console.log('User tier:', gameState.currentTier);

        eventBus.emit(GameEvents.SEASON_STARTED, {
            season: gameState.currentSeason,
            userTeamId: gameState.userTeamId,
            userTier: gameState.currentTier
        });

        // Clear offseason phase — we're back in regular season
        gameState.offseasonPhase = OffseasonController.PHASES.NONE;

        // Close OffseasonHub — returning to regular dashboard
        if (window._reactCloseOffseasonHub) {
            console.log('🌴 [OFFSEASON] Closing OffseasonHub — new season starting');
            window._reactCloseOffseasonHub();
        }

        helpers.updateUI();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Offseason Sim Controls (for hub-based navigation)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Advance offseason by one day. Triggers events when dates are reached.
     */
    simOffseasonDay() {
        const { gameState, engines, helpers } = this.ctx;
        const P = OffseasonController.PHASES;
        
        if (!gameState.currentDate) return;
        
        // Advance one day
        const nextDate = engines.CalendarEngine.addDays(gameState.currentDate, 1);
        gameState.currentDate = nextDate;
        
        console.log(`[OFFSEASON] Simmed to ${nextDate}`);
        
        // Auto-sim any preseason games on this date (non-user games)
        this._autoSimPreseasonGames(nextDate);
        
        // Check for phase triggers based on new date
        this._checkDateTriggers(nextDate);
        
        helpers.saveGameState();
        if (window._notifyReact) window._notifyReact();
    }

    /**
     * Advance offseason by one week (7 days)
     */
    simOffseasonWeek() {
        const { gameState, engines, helpers } = this.ctx;
        
        if (!gameState.currentDate) return;
        
        // Advance 7 days
        const nextDate = engines.CalendarEngine.addDays(gameState.currentDate, 7);
        gameState.currentDate = nextDate;
        
        console.log(`[OFFSEASON] Simmed week to ${nextDate}`);
        
        // Auto-sim any preseason games up to this date (non-user games)
        this._autoSimPreseasonGames(nextDate);
        
        // Check for phase triggers
        this._checkDateTriggers(nextDate);
        
        helpers.saveGameState();
        if (window._notifyReact) window._notifyReact();
    }

    /**
     * Sim to the next major offseason event date
     */
    simToNextEvent() {
        const { gameState, engines, helpers } = this.ctx;
        
        if (!gameState.currentDate) return;
        
        const current = new Date(gameState.currentDate);
        const seasonYear = gameState.seasonStartYear || gameState.currentSeason;
        const seasonDates = engines.CalendarEngine.getSeasonDates(seasonYear);
        
        // Find next event date after current
        const userTier = gameState.currentTier || 1;
        const userCampOpen = userTier === 1 ? seasonDates.t1CampOpen : userTier === 2 ? seasonDates.t2CampOpen : seasonDates.t3CampOpen;
        const userCutdown = userTier === 1 ? seasonDates.t1Cutdown : userTier === 2 ? seasonDates.t2Cutdown : seasonDates.t3Cutdown;
        
        const eventDates = [
            { date: seasonDates.draftDay, label: 'Draft Day', done: !!(gameState._draftStarted || gameState._draftComplete) },
            { date: seasonDates.contractExpiration, label: 'Contract Expiration', done: !!gameState._contractExpirationComplete },
            { date: seasonDates.freeAgencyStart, label: 'Free Agency', done: !!(gameState._freeAgencyStarted || gameState._freeAgencyComplete) },
            // Development runs silently (no stop) so it's not in this list
            { date: userCampOpen, label: 'Training Camp', done: !!gameState._userCampStarted },
            { date: userCutdown, label: 'Cutdown Day', done: !!gameState._userCampComplete },
        ];
        
        // Find next event that is not yet completed and on or after current date
        const nextEvent = eventDates.find(e => !e.done && e.date >= current);
        
        if (nextEvent) {
            gameState.currentDate = engines.CalendarEngine.toDateString(nextEvent.date);
            console.log(`[OFFSEASON] Simmed to ${nextEvent.label} (${gameState.currentDate})`);
            this._autoSimPreseasonGames(gameState.currentDate);
            this._checkDateTriggers(gameState.currentDate);
        } else {
            // Past all events — go to cutdown
            gameState.currentDate = engines.CalendarEngine.toDateString(userCutdown);
            console.log(`[OFFSEASON] Simmed to Cutdown Day`);
            this._autoSimPreseasonGames(gameState.currentDate);
            this._checkDateTriggers(gameState.currentDate);
        }
        
        helpers.saveGameState();
        if (window._notifyReact) window._notifyReact();
    }

    /**
     * Sim directly to training camp / season start
     */
    simToTrainingCamp() {
        const { gameState, engines, helpers } = this.ctx;
        
        const seasonYear = gameState.seasonStartYear || gameState.currentSeason;
        const seasonDates = engines.CalendarEngine.getSeasonDates(seasonYear);
        const userTier = gameState.currentTier || 1;
        
        // Use the user's tier-specific camp open date
        const userCampOpen = userTier === 1 ? seasonDates.t1CampOpen : userTier === 2 ? seasonDates.t2CampOpen : seasonDates.t3CampOpen;
        
        gameState.currentDate = engines.CalendarEngine.toDateString(userCampOpen);
        console.log(`📅 [OFFSEASON] Simmed to T${userTier} Training Camp (${gameState.currentDate})`);
        
        // Trigger all remaining phases up to camp
        this._runRemainingOffseasonPhases();
        
        helpers.saveGameState();
        if (window._notifyReact) window._notifyReact();
    }

    /**
     * Check current date and trigger appropriate offseason events
     */
    _checkDateTriggers(dateStr) {
        const { gameState, engines, helpers } = this.ctx;
        const P = OffseasonController.PHASES;
        
        // Parse date string to get year, month, day (avoiding timezone issues)
        const [year, month, day] = dateStr.split('-').map(Number);
        const currentDateOnly = new Date(year, month - 1, day); // month is 0-indexed
        
        const seasonYear = gameState.seasonStartYear || gameState.currentSeason;
        const seasonDates = engines.CalendarEngine.getSeasonDates(seasonYear);
        const userTier = gameState.currentTier || gameState.userTeam?.tier || 1;
        
        // Helper to compare dates (ignoring time)
        const dateGTE = (d1, d2) => {
            const a = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
            const b = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
            return a >= b;
        };
        
        // Draft Day (Jun 15) — trigger lottery and draft for T1
        // Only trigger once - use _draftStarted to track if we've shown the lottery
        if (dateGTE(currentDateOnly, seasonDates.draftDay) && !gameState._draftComplete && !gameState._draftStarted && userTier === 1) {
            console.log('🎰 [OFFSEASON] Draft day reached — triggering draft via hub');
            gameState._draftStarted = true;  // Mark as started so we don't re-trigger
            this.setPhase(P.DRAFT);
            
            // Generate draft class if needed
            if (!gameState.draftClass || gameState.draftClass.length === 0) {
                const startId = gameState.getNextPlayerId(100);
                gameState.draftClass = engines.DraftEngine.generateDraftProspects(
                    gameState.currentSeason,
                    { PlayerAttributes: engines.PlayerAttributes, TeamFactory: engines.TeamFactory },
                    startId
                );
            }
            
            // Get promoted team IDs from postseason results
            const promotedTeamIds = gameState.postseasonResults?.promoted?.toT1?.map(t => t.id) || [];
            
            // Run lottery
            const lotteryData = engines.DraftEngine.simulateDraftLottery(gameState.tier1Teams, promotedTeamIds);
            gameState._lotteryResults = lotteryData.lotteryResults;
            
            // Generate draft order from lottery results
            const draftOrder = helpers.getDraftController?.()?.generateDraftOrder?.() || 
                engines.DraftEngine.generateDraftOrder?.(
                    gameState.tier1Teams,
                    lotteryData.lotteryResults,
                    gameState.draftPickOwnership
                ) || [];
            
            // Set up pending draft data so closeLotteryModal -> startDraftAfterLottery works
            window.pendingDraftData = {
                prospects: gameState.draftClass,
                draftOrder
            };
            
            // Send to React hub
            if (window._reactShowLottery) {
                window._reactShowLottery({
                    lotteryResults: lotteryData.lotteryResults,
                    userTeamId: helpers.getUserTeam()?.id,
                    prospects: gameState.draftClass
                });
            }
            return; // Only trigger one event per sim
        }
        
        // Draft Day (Jun 15) — T2/T3 users: run draft silently, show results
        if (dateGTE(currentDateOnly, seasonDates.draftDay) && !gameState._draftComplete && !gameState._draftStarted && userTier !== 1) {
            console.log('[OFFSEASON] Draft day reached (T2/T3) — running silently');
            const draftController = helpers.getDraftController?.();
            if (draftController) {
                draftController.runSilently();
            }
            return; // Stop here so user sees draft results
        }
        
        // College FA (Jun 22) — trigger for T2/T3
        // Only trigger once - use _collegeFAStarted to track if we've shown the window
        // College FA phase removed — college graduates are now generated at draft time
        // and added to the FA pool. They're available as camp invites at any tier.
        // Mark complete if we pass the old date, for save compatibility.
        if (dateGTE(currentDateOnly, seasonDates.collegeFA) && !gameState._collegeFAComplete) {
            gameState._collegeFAComplete = true;
        }
        
        // Contract Expiration (Jun 30) - runs BEFORE Free Agency opens
        // Decrements contract years and moves expired contracts to FA pool
        if (dateGTE(currentDateOnly, seasonDates.contractExpiration) && !gameState._contractExpirationComplete) {
            // For non-T1 users, run the draft silently first if it hasn't happened yet
            // (T1 users have the interactive draft which runs earlier)
            if (!gameState._draftComplete) {
                console.log('[OFFSEASON] Running draft silently before contract expiration...');
                this.runDraftSilently();
            }
            console.log('[OFFSEASON] Contract Expiration Day — processing expired contracts');
            this.runContractExpiration();
            gameState._contractExpirationComplete = true;
            // Don't return - allow FA to trigger on same sim if it's Jul 1+
        }
        
        // Free Agency (Jul 1)
        // Only trigger once - use _freeAgencyStarted to track if we've shown the FA window
        if (dateGTE(currentDateOnly, seasonDates.freeAgencyStart) && !gameState._freeAgencyComplete && !gameState._freeAgencyStarted) {
            console.log('📝 [OFFSEASON] Free Agency reached — triggering via hub');
            gameState._freeAgencyStarted = true;  // Mark as started so we don't re-trigger
            this.setPhase(P.FREE_AGENCY);
            
            // Use FreeAgencyController to properly prepare and show FA
            // This sets up enriched player data, former players, etc.
            helpers.showFreeAgencyModal();
            return;
        }
        
        // Player Development (Aug 1) - NOW only handles aging, ratings, retirements (not contracts)
        if (dateGTE(currentDateOnly, seasonDates.playerDevelopment) && !gameState._developmentComplete) {
            console.log('[OFFSEASON] Running player development silently (aging, retirements, healing, fatigue reset)');
            this.applyPlayerDevelopment();
            gameState._developmentComplete = true;
            // Don't return — allow camp triggers to fire on the same sim tick
        }
        
        // ─── STAGGERED TRAINING CAMP ─────────────────────────────────────────
        // Each tier has its own camp window. Camp opens ~21 days before season.
        // T1 camp opens first; T1 cuts flow to FA for T2 camp invites, etc.
        // The user's tier gets the interactive camp; other tiers run silently.
        // ALL tiers must process at the correct time, regardless of user tier.
        
        // Determine the user's camp dates
        const campDates = {
            1: { open: seasonDates.t1CampOpen, cutdown: seasonDates.t1Cutdown },
            2: { open: seasonDates.t2CampOpen, cutdown: seasonDates.t2Cutdown },
            3: { open: seasonDates.t3CampOpen, cutdown: seasonDates.t3Cutdown },
        };
        const userCamp = campDates[userTier] || campDates[1];
        
        // ── Run non-user tiers' camps silently at their correct dates ──
        // T1 AI camp (runs at T1 cutdown date for non-T1 users, or at T1 cutdown for T1 user via the cutdown trigger below)
        if (userTier !== 1 && dateGTE(currentDateOnly, seasonDates.t1Cutdown) && !gameState._t1CampComplete) {
            console.log('⛺ [OFFSEASON] T1 camp running silently (AI teams)...');
            this._runAICampForTier(1);
            gameState._t1CampComplete = true;
            // Don't return — check if T2/T3 also need to fire
        }
        
        // T2 AI camp (runs at T2 cutdown date for non-T2 users)
        if (userTier !== 2 && dateGTE(currentDateOnly, seasonDates.t2Cutdown) && !gameState._t2CampComplete) {
            console.log('⛺ [OFFSEASON] T2 camp running silently (AI teams)...');
            this._runAICampForTier(2);
            gameState._t2CampComplete = true;
        }
        
        // T3 AI camp (runs at T3 cutdown date for non-T3 users)
        if (userTier !== 3 && dateGTE(currentDateOnly, seasonDates.t3Cutdown) && !gameState._t3CampComplete) {
            console.log('⛺ [OFFSEASON] T3 camp running silently (AI teams)...');
            this._runAICampForTier(3);
            gameState._t3CampComplete = true;
        }
        
        // ── User's tier camp opens ──
        if (dateGTE(currentDateOnly, userCamp.open) && !gameState._userCampStarted && gameState.offseasonPhase !== P.SETUP_COMPLETE) {
            console.log(`⛺ [OFFSEASON] Training Camp opened for user (T${userTier})`);
            
            // Mark all prior phases complete (they should be by now)
            gameState._draftComplete = true;
            gameState._collegeFAComplete = true;
            gameState._freeAgencyComplete = true;
            gameState._developmentComplete = true;
            gameState._userCampStarted = true;
            
            // Calculate camp day and total days
            const campOpenDate = userCamp.open;
            const cutdownDate = userCamp.cutdown;
            const totalCampDays = Math.round((cutdownDate - campOpenDate) / 86400000);
            const campDayNum = Math.max(1, Math.round((currentDateOnly - campOpenDate) / 86400000) + 1);
            
            // Generate preseason schedule if not already generated
            const TCE = engines.TrainingCampEngine;
            if (!gameState._preseasonSchedule && TCE) {
                const tierTeams = userTier === 1 ? gameState.tier1Teams : userTier === 2 ? gameState.tier2Teams : gameState.tier3Teams;
                const campOpenStr = engines.CalendarEngine.toDateString(campOpenDate);
                gameState._preseasonSchedule = TCE.generatePreseasonSchedule(tierTeams, campOpenStr, totalCampDays);
                console.log(`[PRESEASON] Generated ${gameState._preseasonSchedule.length} preseason games`);
            }
            
            // Show training camp dashboard in hub
            if (window._reactShowTrainingCamp) {
                window._reactShowTrainingCamp({
                    tier: userTier,
                    campDay: campDayNum,
                    totalCampDays,
                    cutdownDate: engines.CalendarEngine.toDateString(cutdownDate),
                    campOpenDate: engines.CalendarEngine.toDateString(campOpenDate),
                });
            }
            return;
        }
        
        // User's tier cutdown day reached — resolve camp, show results, then cutdown
        if (gameState._userCampStarted && dateGTE(currentDateOnly, userCamp.cutdown) && !gameState._userCampComplete && gameState.offseasonPhase !== P.SETUP_COMPLETE) {
            console.log(`[OFFSEASON] Cutdown day reached for user (T${userTier}) — resolving camp`);
            
            // Resolve user's camp focuses
            const TCE = engines.TrainingCampEngine;
            const userTeam = helpers.getUserTeam();
            if (TCE && userTeam) {
                const focusAssignments = userTeam._campFocuses || {};
                const campResults = TCE.resolveCamp(userTeam, focusAssignments, { PlayerAttributes: engines.PlayerAttributes });
                gameState._campResults = campResults;
                console.log(`[CAMP RESULTS] ${campResults.summary.improved} improved, ${campResults.summary.declined} declined, ${campResults.summary.unchanged} unchanged`);
                
                // Clear the focus assignments now that they've been resolved
                delete userTeam._campFocuses;
            }
            
            gameState._userCampComplete = true;
            
            // Run AI camp for user's tier (non-user teams) — invites, focuses, resolution, cutdown
            this._runAICampForTier(userTier, true);
            
            // Mark user's tier camp as globally complete (so the silent tier check doesn't re-run it)
            if (userTier === 1) gameState._t1CampComplete = true;
            else if (userTier === 2) gameState._t2CampComplete = true;
            else if (userTier === 3) gameState._t3CampComplete = true;
            
            helpers.saveGameState();
            
            // Show results screen — user clicks "Continue to Cutdown" to proceed
            if (gameState._campResults && window._reactShowCampResults) {
                window._reactShowCampResults(gameState._campResults);
                return;
            }
            
            // Fallback if no results screen available
            this.checkRosterComplianceAndContinue();
        }
    }

    /**
     * Run training camp silently for all teams in a tier.
     * Includes AI camp invites, focus assignment, camp resolution, and cutdown.
     * @param {number} tier - Tier to process
     * @param {boolean} [skipUserTeam=false] - Skip user's team (they handle camp interactively)
     */
    _runAICampForTier(tier, skipUserTeam = false) {
        const { gameState, engines, helpers } = this.ctx;
        const TCE = engines.TrainingCampEngine;
        if (!TCE) {
            console.warn('TrainingCampEngine not available, skipping AI camp');
            return;
        }
        
        const tierTeams = tier === 1 ? gameState.tier1Teams : tier === 2 ? gameState.tier2Teams : gameState.tier3Teams;
        const userTeam = helpers.getUserTeam();
        const skipId = skipUserTeam ? userTeam?.id : null;
        
        const poolBefore = gameState.freeAgents.length;
        console.log(`[CAMP T${tier}] Pool before invites: ${poolBefore} (${gameState.freeAgents.filter(p => p.isCollegeGrad).length} college, ${gameState.freeAgents.filter(p => p.isDraftProspect).length} undrafted, ${gameState.freeAgents.filter(p => p.previousTeamId != null).length} vets)`);
        
        // AI teams sign camp invites first (expand to 17-19 players)
        const invitesSigned = TCE.aiSignCampInvites(tierTeams, gameState.freeAgents, { TeamFactory: engines.TeamFactory }, skipId);
        
        const poolAfterInvites = gameState.freeAgents.length;
        
        let totalImproved = 0;
        let totalCut = 0;
        
        tierTeams.forEach(team => {
            if (skipUserTeam && team.id === userTeam?.id) return;
            
            // Run camp (AI assigns focuses and resolves)
            const campResult = TCE.simulateAICamp(team, { PlayerAttributes: engines.PlayerAttributes });
            totalImproved += campResult.summary.improved;
            
            // Cutdown to 15
            const cutPlayers = TCE.aiCutdown(team, gameState.freeAgents);
            totalCut += cutPlayers.length;
        });
        
        console.log(`[CAMP T${tier}] ${invitesSigned} invites signed (pool ${poolBefore} -> ${poolAfterInvites}), ${totalCut} cut back to pool (now ${gameState.freeAgents.length}), ${totalImproved} players improved`);
        helpers.saveGameState();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Preseason Games
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Simulate a single preseason game (instant result, no W/L impact).
     * @param {number} gameIndex - Index in _preseasonSchedule
     * @returns {Object|null} Result with scores, or null if invalid
     */
    simPreseasonGame(gameIndex) {
        const { gameState, engines, helpers } = this.ctx;
        const schedule = gameState._preseasonSchedule;
        if (!schedule || !schedule[gameIndex] || schedule[gameIndex].played) return null;

        const game = schedule[gameIndex];
        const allTeams = [...(gameState.tier1Teams || []), ...(gameState.tier2Teams || []), ...(gameState.tier3Teams || [])];
        const home = allTeams.find(t => t.id === game.homeTeamId);
        const away = allTeams.find(t => t.id === game.awayTeamId);
        if (!home || !away) return null;

        const result = window.GamePipeline.resolve(home, away, {
            isPlayoffs: false,
            tier: home.tier || 1,
            lightweight: true,
        });

        game.played = true;
        game.homeScore = result.homeScore;
        game.awayScore = result.awayScore;
        game.winnerId = result.homeWon ? home.id : away.id;

        console.log(`[PRESEASON] ${home.name} ${result.homeScore} - ${result.awayScore} ${away.name}`);
        helpers.saveGameState();
        if (window._notifyReact) window._notifyReact();
        return result;
    }

    /**
     * Start watching a preseason game (step-by-step via WatchGameModal).
     * @param {number} gameIndex - Index in _preseasonSchedule
     */
    watchPreseasonGame(gameIndex) {
        const { gameState, engines, helpers } = this.ctx;
        const schedule = gameState._preseasonSchedule;
        if (!schedule || !schedule[gameIndex] || schedule[gameIndex].played) return;

        const game = schedule[gameIndex];
        const allTeams = [...(gameState.tier1Teams || []), ...(gameState.tier2Teams || []), ...(gameState.tier3Teams || [])];
        const home = allTeams.find(t => t.id === game.homeTeamId);
        const away = allTeams.find(t => t.id === game.awayTeamId);
        if (!home || !away) return;

        const userIsHome = home.id === gameState.userTeamId;

        // Store reference so we can record result when game completes
        this._preseasonWatchIndex = gameIndex;

        // Create step-by-step game
        const pipeline = window.GamePipeline.create(home, away, {
            isPlayoffs: false,
            tier: home.tier || 1,
        });

        // Stash on the simulation controller so WatchGameModal can drive it
        const simController = helpers.getSimulationController?.();
        if (simController) {
            simController._watchGame = pipeline;
            simController._watchHomeTeam = home;
            simController._watchAwayTeam = away;
            simController._watchHomeName = home.name;
            simController._watchAwayName = away.name;
            simController._watchDate = game.date;
            simController._watchPaused = false;
            simController._watchSpeed = window._gameSettings?.watchGameSpeed || 1;
            simController._isPreseasonWatch = true;
        }

        // Show WatchGameModal
        if (window._reactShowWatchGame) {
            window._reactShowWatchGame({
                homeName: home.name,
                awayName: away.name,
                homeTeamFullName: home.name,
                awayTeamFullName: away.name,
                userIsHome,
                isPreseason: true,
            });
        }

        // Start the watch timer
        if (simController?._startWatchTimer) {
            simController._startWatchTimer();
        }
    }

    /**
     * Record the result of a watched preseason game.
     * Called when WatchGameModal completes.
     */
    recordPreseasonWatchResult() {
        const { gameState, helpers } = this.ctx;
        const simController = helpers.getSimulationController?.();
        if (!simController?._isPreseasonWatch) return;

        const idx = this._preseasonWatchIndex;
        const schedule = gameState._preseasonSchedule;
        if (idx == null || !schedule?.[idx]) return;

        const game = schedule[idx];
        const pipeline = simController._watchGame;
        if (pipeline?.isComplete) {
            const result = pipeline.getResult();
            game.played = true;
            game.homeScore = result.homeScore;
            game.awayScore = result.awayScore;
            game.winnerId = result.homeWon ? game.homeTeamId : game.awayTeamId;
        }

        simController._isPreseasonWatch = false;
        this._preseasonWatchIndex = null;
        helpers.saveGameState();
        if (window._notifyReact) window._notifyReact();
    }

    /**
     * Auto-sim any preseason games whose date has passed.
     * Called from simOffseasonDay/simOffseasonWeek.
     */
    _autoSimPreseasonGames(currentDateStr) {
        const { gameState, engines } = this.ctx;
        const schedule = gameState._preseasonSchedule;
        if (!schedule) return;

        for (let i = 0; i < schedule.length; i++) {
            const game = schedule[i];
            if (game.played) continue;
            // Only auto-sim games from BEFORE today — today's game gets Watch/Sim buttons
            if (game.date >= currentDateStr) continue;

            this.simPreseasonGame(i);
        }
    }

    /**
     * Run all remaining offseason phases quickly (for sim-to-training-camp)
     */
    _runRemainingOffseasonPhases() {
        const { gameState } = this.ctx;
        
        // Run any incomplete phases silently
        if (!gameState._draftComplete) {
            console.log('🎰 [OFFSEASON] Running draft silently...');
            this.runDraftSilently();
        }
        
        if (!gameState._collegeFAComplete) {
            console.log('🎓 [OFFSEASON] Running college FA silently...');
            this.runCollegeGradFASilently();
        }
        
        // Contract expiration must run before FA
        if (!gameState._contractExpirationComplete) {
            console.log('📋 [OFFSEASON] Running contract expiration silently...');
            this.runContractExpiration();
            gameState._contractExpirationComplete = true;
        }
        
        if (!gameState._freeAgencyComplete) {
            console.log('📝 [OFFSEASON] Running FA silently...');
            this.runFreeAgencySilently();
        }
        
        if (!gameState._developmentComplete) {
            console.log('📈 [OFFSEASON] Running development silently...');
            this.runDevelopmentSilently();
        }
        
        // Check roster compliance and continue through owner mode to season setup
        this.checkRosterComplianceAndContinue();
    }

    /**
     * Run draft without UI (for quick sim / T2+T3 silent flow).
     * Delegates to DraftController.runSilently() which handles everything:
     * prospect generation, lottery, all picks, undrafted to FA, college grads, roster trim.
     */
    runDraftSilently() {
        const { helpers } = this.ctx;
        const draftController = helpers.getDraftController?.();
        if (draftController) {
            draftController.runSilently();
        } else {
            console.warn('[OFFSEASON] DraftController not available for silent draft');
        }
    }

    /**
     * Run college FA without UI (for quick sim).
     * College graduates are now generated at draft time and added to the FA pool.
     * This method generates them if the draft didn't already, and marks the phase complete.
     */
    runCollegeGradFASilently() {
        const { gameState, engines } = this.ctx;
        
        if (gameState._collegeFAComplete) return; // Already handled by draft
        
        // If we get here without the draft generating grads (edge case),
        // generate them now and add to FA pool
        const cgStartId = gameState.getNextPlayerId(120);
        const graduates = engines.TeamFactory?.generateCollegeGraduateClass?.(cgStartId, { PlayerAttributes: engines.PlayerAttributes }) || [];
        graduates.forEach(g => { g.previousTeamId = null; gameState.freeAgents.push(g); });
        
        gameState._collegeFAComplete = true;
        console.log(`🎓 [OFFSEASON] College grads added to FA pool: ${graduates.length} players`);
    }

    /**
     * Run FA without UI (for quick sim)
     * All FA signings happen automatically
     */
    runFreeAgencySilently() {
        const { gameState, engines, helpers } = this.ctx;
        
        if (!gameState.freeAgents || gameState.freeAgents.length === 0) {
            gameState._freeAgencyComplete = true;
            return;
        }
        
        // All teams (including user) participate in AI signing
        const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
        
        const totalSigned = engines.FreeAgencyEngine?.aiSigningPhase?.(
            { aiTeams: allTeams, freeAgentPool: gameState.freeAgents },
            {
                TeamFactory: engines.TeamFactory,
                getEffectiveCap: (team) => engines.SalaryCapEngine?.getEffectiveCap?.(team, team.tier) || 100000000,
                calculateTeamSalary: (team) => engines.SalaryCapEngine?.calculateTeamSalary?.(team) || 0
            }
        ) || 0;
        
        gameState._freeAgencyComplete = true;
        console.log(`📝 [OFFSEASON] FA complete silently: ${totalSigned} signings`);
    }

    /**
     * Run development without UI (for quick sim)
     */
    runDevelopmentSilently() {
        const { gameState, engines } = this.ctx;
        
        // Apply development to all players
        const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
        
        allTeams.forEach(team => {
            team.roster?.forEach(player => {
                // Simple development: young players improve, old players decline
                const age = player.age || 25;
                if (age < 27) {
                    player.rating = Math.min(99, player.rating + Math.floor(Math.random() * 3));
                } else if (age > 32) {
                    player.rating = Math.max(40, player.rating - Math.floor(Math.random() * 3));
                }
                player.age = age + 1;
            });
        });
        
        // Process retirements (players 38+ or low rating old players)
        allTeams.forEach(team => {
            if (!team.roster) return;
            team.roster = team.roster.filter(player => {
                const age = player.age || 25;
                const rating = player.rating || 50;
                const retireChance = age >= 40 ? 0.8 : age >= 38 ? 0.4 : age >= 35 && rating < 60 ? 0.2 : 0;
                return Math.random() > retireChance;
            });
        });
        
        gameState._developmentComplete = true;
        console.log(`📈 [OFFSEASON] Development complete silently`);
    }
}
