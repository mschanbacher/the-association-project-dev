// ═══════════════════════════════════════════════════════════════════════════════
// OffseasonController.js — Offseason flow orchestration
// Manages the complete offseason pipeline:
//   Season End → Postseason → Promotion/Relegation → Draft → College Grad FA →
//   Player Development → Contract Decisions → Free Agency → Roster Compliance →
//   Owner Mode → Season Setup
// ═══════════════════════════════════════════════════════════════════════════════

import { UIRenderer } from './UIRenderer.js';

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
        this.contractDecisionsState = {
            expiringPlayers: [],
            developmentLog: [],
            decisions: {}
        };
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
                // If using the new hub and it's registered, resume into it.
                // Otherwise fall through to the legacy path (continueAfterPostseason).
                if (this.ctx.gameState._usePlayoffHub && window._reactShowPlayoffHub) {
                    window._reactShowPlayoffHub({
                        action: this.ctx.gameState.userPlayoffResult || 'stay',
                        postseasonResults: this.ctx.gameState.postseasonResults,
                        userTier: this.ctx.gameState.currentTier,
                        userTeamId: this.ctx.gameState.userTeamId,
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
                // Draft is interactive and one-time; if resuming, skip to college FA or development
                if (this.ctx.gameState.currentTier === 1) {
                    this.setPhase(P.COLLEGE_FA);
                    this.ctx.helpers.startCollegeGraduateFA();
                } else {
                    this.proceedToPlayerDevelopment();
                }
                break;
            case P.COLLEGE_FA:
                // College FA is one-time; if resuming, skip to development
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
        document.getElementById('seasonEndModal')?.classList.add('hidden');
        document.getElementById('playoffModal')?.classList.add('hidden');
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
            // Fallback: run old simulation path
            console.warn('⚠️ Falling back to legacy playoff simulation...');
            const postseasonResults = engines.PlayoffEngine.simulateFullPostseason(gameState);
            gameState.postseasonResults = postseasonResults;
            this._legacyPlayoffFlow(action, postseasonResults);
        }
    }

    /**
     * Legacy playoff modal chain — kept intact while PlayoffHub is built.
     * Called by advanceToNextSeason() when _usePlayoffHub is false,
     * and as a safety fallback if the hub component isn't mounted.
     * DO NOT modify this method during PlayoffHub development.
     */
    _legacyPlayoffFlow(action, postseasonResults) {
        const { gameState, engines, helpers } = this.ctx;

        // If user is in T1 championship playoffs, enter interactive round-by-round flow
        if (action === 'championship') {
            console.log('🏆 User qualifies for T1 Championship — entering interactive playoff flow...');
            const gameSim = helpers.getGameSimController();
            gameSim.runTier1ChampionshipPlayoffs();
            return;
        }

        // If user is in T2 division playoffs, enter interactive T2 playoff flow
        if (action === 't2-championship') {
            console.log('🏆 User qualifies for T2 Division Playoffs — entering interactive playoff flow...');
            const gameSim = helpers.getGameSimController();
            gameSim.runTier2DivisionPlayoffs();
            return;
        }

        // If user is in T3 metro playoffs, enter interactive T3 playoff flow
        if (action === 't3-championship') {
            console.log('🏆 User qualifies for T3 Metro Playoffs — entering interactive playoff flow...');
            const gameSim = helpers.getGameSimController();
            gameSim.runTier3MetroPlayoffs();
            return;
        }

        // Otherwise show static postseason results summary
        if (window._reactShowChampionship) {
            // Wire the continue button callback
            window.advanceFromPostseason = () => this.continueAfterPostseason();

            window._reactShowChampionship({
                mode: 'postseason',
                t1Champion: postseasonResults.t1?.champion || null,
                t2Champion: postseasonResults.t2?.champion || null,
                t3Champion: postseasonResults.t3?.champion || null,
                t1Finals: postseasonResults.t1?.rounds?.[3]?.[0] || null,
                promotedToT1: postseasonResults.promoted?.toT1 || [],
                promotedToT2: postseasonResults.promoted?.toT2 || [],
                relegatedFromT1: postseasonResults.relegated?.fromT1 || [],
                relegatedFromT2: postseasonResults.relegated?.fromT2 || [],
                t1Relegation: postseasonResults.t1Relegation || null,
                t2Relegation: postseasonResults.t2Relegation || null,
            });
        } else {
            // [LEGACY REMOVED] const html = engines.PlayoffEngine.generatePostseasonHTML(postseasonResults, gameState.userTeamId);
            // [LEGACY REMOVED] document.getElementById('championshipPlayoffContent').innerHTML = UIRenderer.postseasonContinue({ resultsHTML: html });
            // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.remove('hidden');
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 2: Continue After Postseason → Promotion/Relegation
    // ═══════════════════════════════════════════════════════════════════

    continueAfterPostseason() {
        const { gameState, eventBus, GameEvents, engines, helpers } = this.ctx;
        const P = OffseasonController.PHASES;

        if (window._reactCloseChampionship) window._reactCloseChampionship();
        // Close the PlayoffHub screen — we're now entering offseason flow
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

        // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.add('hidden');
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

        // [LEGACY REMOVED] document.getElementById('financialTransitionContent').innerHTML = UIRenderer.financialTransitionBriefing(briefingData);

        document.getElementById('financialTransitionModal').classList.remove('hidden');
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
            console.log('⏭️ Step 3: User is in Tier ' + gameState.currentTier + ', skipping draft...');
            this.setPhase(P.COLLEGE_FA);
            helpers.startCollegeGraduateFA();
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

    applyPlayerDevelopment() {
        const { gameState, helpers } = this.ctx;

        console.log('🌟 Applying player development...');

        const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
        helpers.advanceFinancialTransitions(allTeams);

        const userTeam = helpers.getUserTeam();
        let userTeamLog = [];
        let userExpiredContracts = [];

        let totalExpired = 0, totalResigned = 0, totalReleased = 0;
        let allRetirements = [];
        let userTeamRetirements = [];

        const processTier = (teams, gamesPerSeason) => {
            teams.forEach(team => {
                const result = helpers.developTeamPlayers(team, gamesPerSeason);
                if (result && team.id === userTeam.id) {
                    userTeamLog = result.developmentLog || [];
                    userExpiredContracts = result.expiredContracts || [];
                    userTeamRetirements = result.retirements || [];
                }
                if (result && result.retirements) allRetirements.push(...result.retirements);
                if (result && result.expiredContracts && team.id !== userTeam.id) {
                    totalExpired += result.expiredContracts.length;
                    const counts = helpers.handleAITeamFreeAgency(team, result.expiredContracts);
                    totalResigned += counts.resigned;
                    totalReleased += counts.released;
                }
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

        console.log('═══════════════════════════════════════════════════════');
        console.log(`📊 AI Free Agency Summary:`);
        console.log(`  Total Expired Contracts: ${totalExpired}`);
        console.log(`  Re-signed: ${totalResigned}`);
        console.log(`  Released to FA: ${totalReleased}`);
        console.log(`  User Expired: ${userExpiredContracts.length}`);
        console.log(`  Total FA Pool: ${gameState.freeAgents.length} players`);
        console.log('═══════════════════════════════════════════════════════');

        if (userTeamLog.length > 0) {
            console.log(`📊 ${userTeam.name} Player Development:`);
            userTeamLog.forEach(log => {
 const arrow = log.change > 0 ? '️' : '️';
                console.log(`  ${arrow} ${log.name} (${log.age}yo): ${log.oldRating} → ${log.newRating} (${log.change > 0 ? '+' : ''}${log.change})`);
            });
        }

        // Auto-release expired contracts to FA pool with loyalty bonus
        if (userExpiredContracts.length > 0) {
            console.log(`📝 ${userTeam.name} Expired Contracts (${userExpiredContracts.length}):`);
            userExpiredContracts.forEach(player => {
                console.log(`  🔓 ${player.name} (${player.rating} OVR) - Released to free agency with loyalty bonus`);

                const index = userTeam.roster.findIndex(p => p.id === player.id);
                if (index !== -1) userTeam.roster.splice(index, 1);

                player.previousTeamId = userTeam.id;
                player.contractYears = helpers.determineContractLength(player.age, player.rating);
                player.originalContractLength = player.contractYears;
                player.contractExpired = false;
                gameState.freeAgents.push(player);
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

        return { developmentLog: userTeamLog, expiredContracts: userExpiredContracts };
    }

    // ═══════════════════════════════════════════════════════════════════
    // Development Summary Display
    // ═══════════════════════════════════════════════════════════════════

    showDevelopmentAndFreeAgency(developmentLog, expiredContracts) {
        const { gameState, helpers } = this.ctx;
        const improvements = developmentLog.filter(log => log.change > 0);
        const declines = developmentLog.filter(log => log.change < 0);
        const userTeam = helpers.getUserTeam();

        let expiredContractsHTML = '';
        if (expiredContracts && expiredContracts.length > 0) {
            // [LEGACY REMOVED] expired contract card generation
            const cardsHTML = '';
            // [LEGACY REMOVED] expiredContractsHTML = UIRenderer.expiredContractsSection({ count: expiredContracts.length, cardsHTML });
        }

        let improvementsHTML = '';
        if (improvements.length > 0) {
            // [LEGACY REMOVED] improvementsHTML = `<div style="margin-bottom: 30px;"><h2 style="color: #34a853; margin-bottom: 15px;">⬆️ Player Improvements (${improvements.length})</h2>${improvements.map((log, i) => UIRenderer.ratingChangeRow(log, i)).join('')}</div>`;
        }
        let declinesHTML = '';
        if (declines.length > 0) {
            // [LEGACY REMOVED] declinesHTML = `<div><h2 style="color: #ea4335; margin-bottom: 15px;">⬇️ Player Declines (${declines.length})</h2>${declines.map((log, i) => UIRenderer.ratingChangeRow(log, i)).join('')}</div>`;
        }

        const hasContent = improvements.length > 0 || declines.length > 0 || (expiredContracts && expiredContracts.length > 0);

        // [LEGACY REMOVED] document.getElementById('developmentSummary').innerHTML = UIRenderer.developmentAndFreeAgencyPage({
        //     expiredContractsHTML, improvementsHTML, declinesHTML, hasContent
        // });
        // [LEGACY DOM] document.getElementById('developmentModal').classList.remove('hidden');

        if (!gameState.pendingExpiredDecisions) {
            gameState.pendingExpiredDecisions = expiredContracts ? expiredContracts.map(p => p.id) : [];
        }
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

        // [LEGACY DOM] document.getElementById('developmentSummary').innerHTML = html;
        // [LEGACY DOM] document.getElementById('developmentModal').classList.remove('hidden');
    }

    closeDevelopmentSummary() {
        // [LEGACY DOM] document.getElementById('developmentModal').classList.add('hidden');
        this.startFreeAgencyPeriod();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Expired Contract Decisions (old flow — kept for compatibility)
    // ═══════════════════════════════════════════════════════════════════

    resignExpiredPlayer(playerId) {
        const { gameState, helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const player = userTeam.roster.find(p => p.id === playerId);
        if (!player) { console.error('Player not found:', playerId); return; }

        player.contractYears = helpers.determineContractLength(player.age, player.rating);
        player.originalContractLength = player.contractYears;
        player.contractExpired = false;

        const oldSalary = player.salary;
        player.salary = helpers.generateSalary(player.rating, userTeam.tier);
        player.tier = userTeam.tier;
        delete player.preRelegationSalary;

        const salaryChange = player.salary - oldSalary;
        const changeLabel = salaryChange < 0 ? `↓ ${helpers.formatCurrency(Math.abs(salaryChange))}` : salaryChange > 0 ? `↑ ${helpers.formatCurrency(salaryChange)}` : 'unchanged';
        console.log(`✅ Re-signed ${player.name} for ${player.contractYears} year(s) at ${helpers.formatCurrency(player.salary)} (${changeLabel})`);

        this._removeExpiredDecision(playerId);

        const element = document.getElementById(`expired_${playerId}`);
        if (element) {
            element.style.opacity = '0.5';
            // [LEGACY REMOVED] element.innerHTML = UIRenderer.expiredContractDecisionResult({
                // playerName: player.name, decision: 'resign',
                // contractYears: player.contractYears, salary: player.salary, formatCurrency: helpers.formatCurrency
            // });
        }

        this._checkAllExpiredDecisionsMade();
    }

    releaseExpiredPlayer(playerId) {
        const { gameState, helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const player = userTeam.roster.find(p => p.id === playerId);
        if (!player) { console.error('Player not found:', playerId); return; }

        const index = userTeam.roster.findIndex(p => p.id === playerId);
        if (index !== -1) userTeam.roster.splice(index, 1);

        player.previousTeamId = userTeam.id;
        player.contractYears = helpers.determineContractLength(player.age, player.rating);
        player.originalContractLength = player.contractYears;
        player.contractExpired = false;
        gameState.freeAgents.push(player);

        console.log(`❌ Released ${player.name} to free agency`);

        this._removeExpiredDecision(playerId);

        const element = document.getElementById(`expired_${playerId}`);
        if (element) {
            element.style.opacity = '0.5';
            // [LEGACY REMOVED] element.innerHTML = UIRenderer.expiredContractDecisionResult({
                // playerName: player.name, decision: 'release',
                // contractYears: 0, salary: 0, formatCurrency: helpers.formatCurrency
            // });
        }

        this._checkAllExpiredDecisionsMade();
    }

    _removeExpiredDecision(playerId) {
        const { gameState } = this.ctx;
        if (gameState.pendingExpiredDecisions) {
            const index = gameState.pendingExpiredDecisions.indexOf(playerId);
            if (index !== -1) gameState.pendingExpiredDecisions.splice(index, 1);
        }
    }

    _checkAllExpiredDecisionsMade() {
        const { gameState } = this.ctx;
        if (gameState.pendingExpiredDecisions && gameState.pendingExpiredDecisions.length === 0) {
            console.log('✅ All expired contract decisions made!');
            const statusDiv = document.getElementById('expiredContractsStatus');
            if (statusDiv) {
 statusDiv.innerHTML = '<strong style="color: #34a853;">All decisions made! Close this window to continue.</strong>';
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Contract Decisions Modal (new flow)
    // ═══════════════════════════════════════════════════════════════════

    showContractDecisionsModal(expiredContracts, developmentLog) {
        const { helpers } = this.ctx;
        const state = this.contractDecisionsState;
        state.expiringPlayers = expiredContracts;
        state.developmentLog = developmentLog || [];
        state.decisions = {};

        const userTeam = helpers.getUserTeam();
        const currentSalary = helpers.calculateTeamSalary(userTeam);
        const cap = helpers.getEffectiveCap(userTeam);
        const expiredSalary = expiredContracts.reduce((sum, p) => sum + p.salary, 0);
        const remainingCap = cap - (currentSalary - expiredSalary);

        if (window._reactShowContractDecisions) {
            const self = this;
            window._contractDecisionsConfirmCallback = (decisions) => {
                state.decisions = decisions;
                self.confirmContractDecisions();
            };
            window._reactShowContractDecisions({
                players: expiredContracts,
                capSpace: remainingCap,
                rosterCount: userTeam.roster.length - expiredContracts.length,
                formatCurrency: helpers.formatCurrency,
                getRatingColor: helpers.getRatingColor,
                determineContractLength: helpers.determineContractLength
            });
            return;
        }

        // [LEGACY REMOVED] document.getElementById('contractDecisionsSummary').innerHTML = UIRenderer.contractDecisionsSummary({
            // expiredCount: expiredContracts.length,
            // availableCap: remainingCap,
            // rosterCount: { value: userTeam.roster.length - expiredContracts.length, label: 'Current Roster' },
            // formatCurrency: helpers.formatCurrency, capColor: '#34a853'
        // });

        const playersHtml = expiredContracts.map(player => {
            const canAfford = player.salary <= remainingCap;
            const newContract = helpers.determineContractLength(player.age, player.rating);
            // [LEGACY REMOVED] return UIRenderer.contractDecisionCard({
                // player, canAfford, newContractYears: newContract, ratingColor: helpers.getRatingColor(player.rating)
            // });
        }).join('');
        document.getElementById('expiringContractsList').innerHTML = playersHtml;

        document.getElementById('contractDecisionsConfirmBtn').onclick = () => this.confirmContractDecisions();
        this.updateContractDecisionsButton();
        document.getElementById('contractDecisionsModal').classList.remove('hidden');
    }

    makeContractDecision(playerId, decision) {
        const state = this.contractDecisionsState;
        state.decisions[playerId] = decision;

        const resignBtn = document.getElementById(`resign_${playerId}`);
        const releaseBtn = document.getElementById(`release_${playerId}`);
        const card = document.getElementById(`contract_${playerId}`);
        const status = document.getElementById(`decision_status_${playerId}`);

        if (decision === 'resign') {
            card.style.border = '2px solid #34a853';
            resignBtn.style.background = 'linear-gradient(135deg, #34a853 0%, #2e7d32 100%)';
            releaseBtn.style.background = '';
 status.textContent = 'Re-signing';
            status.style.color = '#34a853';
        } else {
            card.style.border = '2px solid #ea4335';
            releaseBtn.style.background = 'linear-gradient(135deg, #ea4335 0%, #c62828 100%)';
            resignBtn.style.background = '';
 status.textContent = 'Releasing';
            status.style.color = '#ea4335';
        }

        this.updateAvailableCapDisplay();
        this.updateContractDecisionsButton();
    }

    updateAvailableCapDisplay() {
        const { helpers } = this.ctx;
        const state = this.contractDecisionsState;
        const userTeam = helpers.getUserTeam();
        const currentSalary = helpers.calculateTeamSalary(userTeam);
        const cap = helpers.getEffectiveCap(userTeam);
        const expiredContracts = state.expiringPlayers;

        const expiredSalary = expiredContracts.reduce((sum, p) => sum + p.salary, 0);
        const resignedSalary = expiredContracts
            .filter(p => state.decisions[p.id] === 'resign')
            .reduce((sum, p) => sum + p.salary, 0);

        const availableCap = cap - (currentSalary - expiredSalary + resignedSalary);
        const remainingRoster = userTeam.roster.length - expiredContracts.length +
            Object.values(state.decisions).filter(d => d === 'resign').length;

        // [LEGACY REMOVED] document.getElementById('contractDecisionsSummary').innerHTML = UIRenderer.contractDecisionsSummary({
            // expiredCount: expiredContracts.length,
            // availableCap,
            // rosterCount: { value: remainingRoster, label: 'Remaining Roster' },
            // formatCurrency: helpers.formatCurrency,
            // capColor: availableCap < 0 ? '#ea4335' : '#34a853'
        // });
    }

    updateContractDecisionsButton() {
        const state = this.contractDecisionsState;
        const totalPlayers = state.expiringPlayers.length;
        const decidedPlayers = Object.keys(state.decisions).length;
        const btn = document.getElementById('contractDecisionsConfirmBtn');
        if (btn) {
            btn.disabled = decidedPlayers < totalPlayers;
            btn.textContent = decidedPlayers < totalPlayers
                ? `Decide on all players (${decidedPlayers}/${totalPlayers})`
 : 'Confirm All Decisions';
        }
    }

    confirmContractDecisions() {
        const { gameState, helpers } = this.ctx;
        const state = this.contractDecisionsState;
        const userTeam = helpers.getUserTeam();

        state.expiringPlayers.forEach(player => {
            const decision = state.decisions[player.id];
            if (decision === 'resign') {
                player.contractYears = helpers.determineContractLength(player.age, player.rating);
                player.originalContractLength = player.contractYears;
                delete player.contractExpired;
                console.log(`✅ Re-signed ${player.name} to ${player.contractYears} year contract (${helpers.formatCurrency(player.salary)}/yr)`);
            } else if (decision === 'release') {
                const index = userTeam.roster.findIndex(p => p.id === player.id);
                if (index !== -1) userTeam.roster.splice(index, 1);

                player.contractYears = helpers.determineContractLength(player.age, player.rating);
                player.originalContractLength = player.contractYears;
                delete player.contractExpired;
                gameState.freeAgents.push(player);
                console.log(`❌ Released ${player.name} to free agency (${player.rating} OVR, ${helpers.formatCurrency(player.salary)}/yr)`);
            }
        });

        document.getElementById('contractDecisionsModal').classList.add('hidden');

        if (state.developmentLog.length > 0) {
            this.showDevelopmentSummaryOnly(state.developmentLog);
        } else {
            this.runAISigningAndContinue();
        }
    }

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
            console.log('🤖 Running AI free agent signing...');
            const userTeam = helpers.getUserTeam();
            const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
            const aiTeams = allTeams.filter(t => t.id !== userTeam.id);

            const totalSigned = engines.FreeAgencyEngine.aiSigningPhase(
                { aiTeams, freeAgentPool: gameState.freeAgents },
                { TeamFactory: engines.TeamFactory, getEffectiveCap: helpers.getEffectiveCap, calculateTeamSalary: helpers.calculateTeamSalary }
            );

            console.log(`✅ AI signing phase complete: ${totalSigned} total signings across all teams`);
            console.log(`📋 Free agent pool remaining: ${gameState.freeAgents.length} players`);

            this.checkRosterComplianceAndContinue();
        } catch (err) {
            console.error('❌ Error in runAISigningAndContinue:', err);
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
            console.log(`⚠️ Roster compliance issue: overCap=${isOverCap}, underMin=${isUnderMinimum}, overMax=${isOverMaximum}`);

            // Auto-fix by releasing lowest-rated players if over max
            if (isOverMaximum) {
                console.log(`🔧 Auto-fixing: Releasing ${rosterSize - 15} lowest-rated players`);
                const sorted = [...userTeam.roster].sort((a, b) => a.rating - b.rating);
                while (userTeam.roster.length > 15) {
                    const released = sorted.shift();
                    const idx = userTeam.roster.findIndex(p => p.id === released.id);
                    if (idx !== -1) {
                        userTeam.roster.splice(idx, 1);
                        gameState.freeAgents.push(released);
                        console.log(`  Released ${released.name} (${released.rating} OVR)`);
                    }
                }
            }

            // If still non-compliant, show modal
            const stillOverCap = helpers.calculateTeamSalary(userTeam) > helpers.getEffectiveCap(userTeam);
            const stillUnderMin = userTeam.roster.length < 12;
            if (stillOverCap || stillUnderMin) {
                this.showRosterComplianceModal(stillOverCap, stillUnderMin, false,
                    helpers.calculateTeamSalary(userTeam), helpers.getEffectiveCap(userTeam), userTeam.roster.length);
                return;
            }
        }

        // Compliant — show owner mode or continue
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

        // [LEGACY REMOVED] document.getElementById('complianceModalContent').innerHTML = UIRenderer.rosterComplianceModal({
            // isOverCap, isUnderMinimum, isOverMaximum, totalSalary, salaryCap, rosterSize, tier, formatCurrency: helpers.formatCurrency
        // });
        // [LEGACY DOM] document.getElementById('complianceModal').classList.remove('hidden');
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

        // Close modal (React or legacy)
        if (window._reactCloseOwnerMode) window._reactCloseOwnerMode();
        const legacyModal = document.getElementById('financeDashboardModal');
        if (legacyModal) legacyModal.classList.add('hidden');

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

        // Re-enable sim buttons (legacy DOM may not exist when React UI is active)
        for (const id of ['simNextBtn', 'simDayBtn', 'simWeekBtn', 'finishBtn']) {
            const el = document.getElementById(id);
            if (el) el.disabled = false;
        }

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
        
        console.log(`📅 [OFFSEASON] Simmed to ${nextDate}`);
        
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
        
        console.log(`📅 [OFFSEASON] Simmed week to ${nextDate}`);
        
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
        const eventDates = [
            { date: seasonDates.draftDay, phase: 'draft', label: 'Draft Day' },
            { date: seasonDates.collegeFA, phase: 'college_fa', label: 'College FA' },
            { date: seasonDates.freeAgencyStart, phase: 'free_agency', label: 'Free Agency' },
            { date: seasonDates.playerDevelopment, phase: 'development', label: 'Development' },
            { date: seasonDates.trainingCamp, phase: 'training_camp', label: 'Training Camp' },
        ];
        
        const nextEvent = eventDates.find(e => e.date > current);
        
        if (nextEvent) {
            gameState.currentDate = engines.CalendarEngine.toDateString(nextEvent.date);
            console.log(`📅 [OFFSEASON] Simmed to ${nextEvent.label} (${gameState.currentDate})`);
            this._checkDateTriggers(gameState.currentDate);
        } else {
            // Past all events — go to training camp
            gameState.currentDate = engines.CalendarEngine.toDateString(seasonDates.trainingCamp);
            console.log(`📅 [OFFSEASON] Simmed to Training Camp`);
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
        
        gameState.currentDate = engines.CalendarEngine.toDateString(seasonDates.trainingCamp);
        console.log(`📅 [OFFSEASON] Simmed to Training Camp (${gameState.currentDate})`);
        
        // Trigger all remaining phases
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
        if (dateGTE(currentDateOnly, seasonDates.draftDay) && !gameState._draftComplete && userTier === 1) {
            console.log('🎰 [OFFSEASON] Draft day reached — triggering draft via hub');
            this.setPhase(P.DRAFT);
            
            // Generate draft class if needed
            if (!gameState.draftClass || gameState.draftClass.length === 0) {
                gameState.draftClass = engines.DraftEngine.generateDraftProspects(
                    gameState.currentSeason,
                    { PlayerAttributes: engines.PlayerAttributes, TeamFactory: engines.TeamFactory }
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
        
        // College FA (Jun 22) — trigger for T2/T3
        if (dateGTE(currentDateOnly, seasonDates.collegeFA) && !gameState._collegeFAComplete && userTier > 1) {
            console.log('🎓 [OFFSEASON] College FA reached — triggering via hub');
            this.setPhase(P.COLLEGE_FA);
            
            // Generate college grads and send to hub
            const graduates = engines.DraftEngine?.generateCollegeGraduates?.(40) || [];
            if (window._reactShowCGFA) {
                window._reactShowCGFA({
                    graduates,
                    userTeamId: helpers.getUserTeam()?.id,
                    userTier
                });
            }
            return;
        }
        
        // Free Agency (Jul 1)
        if (dateGTE(currentDateOnly, seasonDates.freeAgencyStart) && !gameState._freeAgencyComplete) {
            console.log('📝 [OFFSEASON] Free Agency reached — triggering via hub');
            this.setPhase(P.FREE_AGENCY);
            
            // Prepare FA data and send to hub
            if (window._reactShowFA) {
                const userTeam = helpers.getUserTeam();
                window._reactShowFA({
                    freeAgents: gameState.freeAgents || [],
                    userTeamId: userTeam?.id,
                    userTier: userTeam?.tier || userTier,
                    salary: helpers.calculateTeamSalary?.(userTeam) || 0,
                    cap: engines.SalaryCapEngine?.getEffectiveCap?.(userTeam, userTeam?.tier) || 100000000
                });
            }
            return;
        }
        
        // Player Development (Aug 1)
        if (dateGTE(currentDateOnly, seasonDates.playerDevelopment) && !gameState._developmentComplete) {
            console.log('📈 [OFFSEASON] Development reached — triggering via hub');
            this.setPhase(P.DEVELOPMENT);
            
            // Run development and send results to hub
            const developmentResult = this.applyPlayerDevelopment();
            if (window._reactShowDevelopment) {
                window._reactShowDevelopment({
                    developmentLog: developmentResult?.developmentLog || [],
                    retirements: gameState._userTeamRetirements || [],
                    notableRetirements: gameState._seasonRetirements?.filter(r => r.peakRating >= 80) || []
                });
            }
            gameState._developmentComplete = true;
            return;
        }
        
        // Training Camp (Aug 16) — setup new season
        if (dateGTE(currentDateOnly, seasonDates.trainingCamp) && gameState.offseasonPhase !== P.SETUP_COMPLETE) {
            console.log('⛺ [OFFSEASON] Training Camp reached — setting up new season');
            this.setPhase(P.SETUP_COMPLETE);
            this.setupNewSeason();
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
        
        if (!gameState._freeAgencyComplete) {
            console.log('📝 [OFFSEASON] Running FA silently...');
            this.runFreeAgencySilently();
        }
        
        if (!gameState._developmentComplete) {
            console.log('📈 [OFFSEASON] Running development silently...');
            this.runDevelopmentSilently();
        }
        
        // Setup new season
        this.setupNewSeason();
    }

    /**
     * Run draft without UI (for quick sim)
     * For T1: runs full draft with AI picks, user's picks go to best available
     */
    runDraftSilently() {
        const { gameState, engines, helpers } = this.ctx;
        
        // Generate draft class if needed
        if (!gameState.draftClass || gameState.draftClass.length === 0) {
            gameState.draftClass = engines.DraftEngine.generateDraftClass(60);
        }
        
        // Run lottery silently
        const lotteryTeams = gameState.tier1Teams
            .filter(t => !gameState.playoffTeams?.includes(t.id))
            .sort((a, b) => a.wins - b.wins)
            .slice(0, 14);
        
        const lotteryResults = engines.DraftEngine.runLottery(lotteryTeams);
        gameState._lotteryResults = lotteryResults;
        
        // Run full draft - AI makes all picks (user's picks go to best available)
        const draftOrder = engines.DraftEngine.generateDraftOrder(
            gameState.tier1Teams,
            lotteryResults,
            gameState.draftPickOwnership
        );
        
        const prospects = [...gameState.draftClass];
        const results = [];
        
        draftOrder.forEach((pick, idx) => {
            if (prospects.length === 0) return;
            
            // Pick best available
            prospects.sort((a, b) => b.rating - a.rating);
            const selection = prospects.shift();
            
            const team = gameState.tier1Teams.find(t => t.id === pick.teamId);
            if (team && selection) {
                // Sign rookie
                selection.salary = engines.TeamFactory?.generateRookieSalary?.(idx + 1) || 1500000;
                selection.contractYears = 4;
                selection.tier = 1;
                team.roster.push(selection);
                
                results.push({
                    pick: idx + 1,
                    round: idx < 30 ? 1 : 2,
                    teamId: team.id,
                    teamName: team.name,
                    player: selection
                });
            }
        });
        
        gameState._draftResults = results;
        gameState._draftComplete = true;
        gameState.draftClass = []; // Clear draft class
        
        console.log(`🎰 [OFFSEASON] Draft complete silently: ${results.length} picks made`);
    }

    /**
     * Run college FA without UI (for quick sim)
     * T2/T3 teams sign college graduates
     */
    runCollegeGradFASilently() {
        const { gameState, engines, helpers } = this.ctx;
        const userTier = gameState.currentTier || 1;
        
        if (userTier === 1) {
            gameState._collegeFAComplete = true;
            return; // T1 doesn't do college FA
        }
        
        // Generate college graduates
        const graduates = engines.DraftEngine?.generateCollegeGraduates?.(40) || [];
        
        // AI teams sign graduates
        const tierTeams = userTier === 2 ? gameState.tier2Teams : gameState.tier3Teams;
        const userTeam = helpers.getUserTeam();
        const aiTeams = tierTeams.filter(t => t.id !== userTeam?.id);
        
        // Each AI team signs 1-2 grads based on need
        aiTeams.forEach(team => {
            const rosterSize = team.roster?.length || 0;
            if (rosterSize >= 14 || graduates.length === 0) return;
            
            // Sign 1-2 players
            const toSign = Math.min(2, 15 - rosterSize, graduates.length);
            for (let i = 0; i < toSign; i++) {
                graduates.sort((a, b) => b.rating - a.rating);
                const grad = graduates.shift();
                if (grad) {
                    grad.tier = team.tier;
                    grad.salary = engines.TeamFactory?.generateSalary?.(grad.rating, team.tier) || 500000;
                    grad.contractYears = 2;
                    team.roster.push(grad);
                }
            }
        });
        
        // User team auto-signs top available grads to fill roster gaps
        if (userTeam) {
            const rosterSize = userTeam.roster?.length || 0;
            const spotsNeeded = Math.max(0, 10 - rosterSize);
            for (let i = 0; i < spotsNeeded && graduates.length > 0; i++) {
                graduates.sort((a, b) => b.rating - a.rating);
                const grad = graduates.shift();
                if (grad) {
                    grad.tier = userTeam.tier;
                    grad.salary = engines.TeamFactory?.generateSalary?.(grad.rating, userTeam.tier) || 500000;
                    grad.contractYears = 2;
                    userTeam.roster.push(grad);
                }
            }
        }
        
        gameState._collegeFAComplete = true;
        console.log(`🎓 [OFFSEASON] College FA complete silently`);
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
