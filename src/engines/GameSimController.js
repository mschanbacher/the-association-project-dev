// ═══════════════════════════════════════════════════════════════════════════════
// GameSimController.js — Game simulation, watch game, season end, playoffs
// ═══════════════════════════════════════════════════════════════════════════════

import { UIRenderer } from './UIRenderer.js';
import { LeagueManager } from './LeagueManager.js';
import { PlayoffSimController } from './PlayoffSimController.js';

export class GameSimController {
    constructor(ctx) {
        this.ctx = ctx;
        // Watch game state
        this._watchGame = null;
        this._watchTimer = null;
        this._watchSpeed = 1;
        this._watchPaused = false;
        this._watchHomeName = '';
        this._watchAwayName = '';
        this._watchHomeTeam = null;
        this._watchAwayTeam = null;
        this._watchDate = null;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Watch Next Game (live play-by-play)
    // ═══════════════════════════════════════════════════════════════════

    watchNextGame() {
        const { gameState, helpers, engines } = this.ctx;
        if (!gameState || !gameState.currentDate) return;

        const currentDate = gameState.currentDate;
        const { CalendarEngine, GamePipeline } = engines;
        const gmMode = helpers.getGmMode();

        // All-Star break check
        const seasonDates = gameState.seasonDates;
        const allStarStart = CalendarEngine.toDateString(seasonDates.allStarStart);
        if (!gameState._allStarCompleted && currentDate <= allStarStart) {
            const nextUD = CalendarEngine.getNextUserGameDate(currentDate, gameState);
            if (nextUD && nextUD > allStarStart) {
                let sd = CalendarEngine.addDays(currentDate, 1);
                while (sd < allStarStart) {
                    gmMode._simulateAllGamesOnDate(sd, true);
                    sd = CalendarEngine.addDays(sd, 1);
                }
                gameState.currentDate = allStarStart;
                gmMode.saveGameState();
                gmMode.updateUI();
                helpers.runAllStarWeekend();
                const allStarEnd = CalendarEngine.toDateString(seasonDates.allStarEnd);
                gameState.currentDate = CalendarEngine.addDays(allStarEnd, 1);
                gmMode.saveGameState();
                gmMode.updateUI();
                return;
            }
        }

        const nextUserDate = CalendarEngine.getNextUserGameDate(currentDate, gameState);
        if (!nextUserDate) { alert('No upcoming games found.'); return; }

        // Sim all games on current date and intervening days
        gmMode._simulateAllGamesOnDate(currentDate, true);
        let simDate = CalendarEngine.addDays(currentDate, 1);
        while (simDate < nextUserDate) {
            gmMode._simulateAllGamesOnDate(simDate, true);
            simDate = CalendarEngine.addDays(simDate, 1);
        }
        gameState.currentDate = nextUserDate;

        // Sim non-user games on this date
        const todaysGames = CalendarEngine.getGamesForDate(nextUserDate, gameState);
        const userTeamId = gameState.userTeamId;
        const tierSchedules = [
            { schedule: todaysGames.tier1, teams: gameState.tier1Teams },
            { schedule: todaysGames.tier2, teams: gameState.tier2Teams },
            { schedule: todaysGames.tier3, teams: gameState.tier3Teams }
        ];

        let userGame = null, homeTeam = null, awayTeam = null;

        for (const { schedule, teams } of tierSchedules) {
            if (!schedule) continue;
            for (const game of schedule) {
                if (game.played) continue;
                const home = teams.find(t => t.id === game.homeTeamId);
                const away = teams.find(t => t.id === game.awayTeamId);
                if (!home || !away) continue;

                if (game.homeTeamId === userTeamId || game.awayTeamId === userTeamId) {
                    userGame = game;
                    homeTeam = home;
                    awayTeam = away;
                } else {
                    helpers.applyFatigueAutoRest(home, false);
                    helpers.applyFatigueAutoRest(away, false);
                    // No win probability tracking for non-user games
                    // Use lightweight mode (skips events and detailed stats)
                    const result = helpers.getSimulationController().simulateFullGame(home, away, false, false, true);
                    game.played = true;
                    game.homeScore = result.homeScore;
                    game.awayScore = result.awayScore;
                    game.winnerId = result.winner.id;
                    helpers.processFatigueAfterGame(home, away, false);
                    helpers.updateInjuries(home);
                    helpers.updateInjuries(away);
                    const userGamesPlayed = helpers.getUserTeam() ? (helpers.getUserTeam().wins + helpers.getUserTeam().losses) : 0;
                    const injuries = helpers.checkForInjuries(home, away, userGamesPlayed, false);
                    injuries.forEach(({team, player, injury}) => {
                        const aiDecision = injury.canPlayThrough && Math.random() < 0.3 ? 'playThrough' : 'rest';
                        helpers.applyInjury(player, injury, aiDecision);
                    });
                }
            }
        }

        if (!userGame || !homeTeam || !awayTeam) { alert('Could not find user game.'); return; }

        this._watchDate = nextUserDate;
        this._watchHomeTeam = homeTeam;
        this._watchAwayTeam = awayTeam;
        this._watchHomeName = homeTeam.name;
        this._watchAwayName = awayTeam.name;

        helpers.applyFatigueAutoRest(homeTeam, false);
        helpers.applyFatigueAutoRest(awayTeam, false);

        this._watchGame = GamePipeline.create(homeTeam, awayTeam, {
            isPlayoffs: false,
            tier: gameState.currentTier
        });

        // [LEGACY REMOVED] const layoutHtml = UIRenderer.watchGameLayout({
            // homeName: this._watchHomeName, awayName: this._watchAwayName
        // });
        const userIsHome = homeTeam.id === gameState.userTeamId;
        this._watchUserIsHome = userIsHome;

        // Compute pre-game win probability from roster ratings
        // Used as the t=0 starting point for the chart
        const preGameProb = GameSimController._calcPreGameWinProb(
            userIsHome ? homeTeam : awayTeam,
            userIsHome ? awayTeam : homeTeam,
            userIsHome
        );
        this._watchPreGameProb = preGameProb;

        if (window._reactShowWatchGame) {
            window._reactShowWatchGame({
                homeName: this._watchHomeName,
                awayName: this._watchAwayName,
                homeTeamFullName: this._watchHomeTeam?.name,
                awayTeamFullName: this._watchAwayTeam?.name,
                userIsHome,
            });
        }

        this._watchPaused = false;
        this._watchSpeed = 1;
        this.watchGameSetSpeed(1);

        // Seed chart with pre-game probability once modal refs are ready
        // Short delay allows React to mount _wgRefs before we call in
        setTimeout(() => {
            if (window._wgRefs?.setPreGameWinProb) {
                window._wgRefs.setPreGameWinProb(preGameProb);
            }
        }, 50);

        this._startWatchTimer();
    }

    _startWatchTimer() {
        if (this._watchTimer) clearInterval(this._watchTimer);
        if (!this._watchGame || this._watchGame.isComplete) return;

        const delays = { 1: 800, 3: 250, 10: 60, 999: 1 };
        const delay = delays[this._watchSpeed] || 800;

        this._watchTimer = setInterval(() => {
            if (this._watchPaused || !this._watchGame) return;

            if (this._watchSpeed === 999) {
                for (let i = 0; i < 20 && !this._watchGame.isComplete; i++) {
                    const events = this._watchGame.step();
                    const keyEvents = events.filter(e =>
                        ['made_shot', 'and_one', 'run', 'quarter_end', 'overtime', 'game_end', 'foul_shooting'].includes(e.type)
                    );
                    this._renderWatchEvents(keyEvents);
                }
            } else {
                const events = this._watchGame.step();
                this._renderWatchEvents(events);
            }

            this._updateWatchScoreboard();

            if (this._watchGame.isComplete) {
                clearInterval(this._watchTimer);
                this._watchTimer = null;
                this._onWatchGameEnd();
            }
        }, delay);
    }

    _renderWatchEvents(events) {
        const container = window._wgRefs?.plays;
        if (!container) return;
        for (const event of events) {
            const html = UIRenderer.watchGamePlayEntry(event);
            if (html) {
                const div = document.createElement('div');
                div.innerHTML = html;
                container.prepend(div.firstElementChild || div);
            }
        }
        while (container.children.length > 200) {
            container.removeChild(container.lastChild);
        }
    }

    _updateWatchScoreboard() {
        if (!this._watchGame) return;
        const state = this._watchGame.getState();
        const refs = window._wgRefs;

        const homeEl = refs?.homeScore;
        const awayEl = refs?.awayScore;
        if (homeEl) homeEl.textContent = state.homeScore;
        if (awayEl) awayEl.textContent = state.awayScore;

        const clockEl = refs?.clock;
        if (clockEl) clockEl.textContent = state.clock.display;

        const qEl = refs?.quarterScores;
        if (qEl && state.quarterScores) {
            const qs = state.quarterScores;
            let qText = '';
            for (let i = 0; i < qs.home.length; i++) {
                const label = i < 4 ? `Q${i+1}` : `OT${i-3}`;
                qText += `${label}: ${qs.away[i]}-${qs.home[i]}  `;
            }
            qEl.textContent = qText.trim();
        }

        const mEl = refs?.momentum;
        if (mEl) {
            const normalized = state.momentum / 10;
            if (normalized >= 0) {
                mEl.style.left = '50%';
                mEl.style.width = `${normalized * 50}%`;
                mEl.style.background = '#4ecdc4';
            } else {
                const width = Math.abs(normalized) * 50;
                mEl.style.left = `${50 - width}%`;
                mEl.style.width = `${width}%`;
                mEl.style.background = '#ff6b6b';
            }
        }

        const leadersEl = refs?.leaders;
        if (leadersEl && (this._watchSpeed <= 3 || Math.random() < 0.1)) {
            const result = this._watchGame.getResult();
            leadersEl.innerHTML = UIRenderer.watchGameLeaders(
                result.homePlayerStats, result.awayPlayerStats,
                this._watchHomeName, this._watchAwayName
            );
        }

        // Push win probability data point to chart
        if (refs?.pushWinProb) {
            const q = state.quarter;
            // getState() exposes clock.minutesLeft (not secondsLeft)
            const secsLeft = (state.clock?.minutesLeft ?? 0) * 60;
            const elapsedSeconds = q <= 4
                ? (q - 1) * 720 + (720 - secsLeft)
                : 2880 + (q - 5) * 300 + (300 - secsLeft);

            const prob = GameSimController._calcLiveWinProb(
                state.margin,
                elapsedSeconds,
                this._watchUserIsHome,
                this._watchPreGameProb ?? 0.5
            );
            refs.pushWinProb(elapsedSeconds, prob, {
                homeScore: state.homeScore,
                awayScore: state.awayScore,
                homeRun: state.homeRun,
                awayRun: state.awayRun,
                clockDisplay: state.clock?.display ?? '',
            });
        }
    }

    _onWatchGameEnd() {
        const { helpers } = this.ctx;
        const result = this._watchGame.getResult();
        const userTeam = helpers.getUserTeam();
        const userWon = result.winner.id === userTeam.id;

        // Push final 100%/0% win probability point
        if (window._wgRefs?.pushWinProb) {
            const finalProb = userWon ? 1.0 : 0.0;
            // Use 2880 seconds (end of regulation) or estimate OT end
            const finalSeconds = result.isOvertime ? 2880 + 300 : 2880;
            window._wgRefs.pushWinProb(finalSeconds, finalProb, {
                homeScore: result.homeScore,
                awayScore: result.awayScore,
                homeRun: 0,
                awayRun: 0,
                clockDisplay: 'Final',
            });
        }

        if (window._wgRefs?.setGameOver) {
            window._wgRefs.setGameOver({
                won: userWon,
                color: userWon ? 'var(--color-win, #4ecdc4)' : 'var(--color-loss, #ff6b6b)',
                isOvertime: result.isOvertime,
                awayScore: result.awayScore,
                homeScore: result.homeScore,
            });
        }
    }

    watchGameSetSpeed(speed) {
        this._watchSpeed = speed;

        if (window._wgRefs?.setSpeed) {
            window._wgRefs.setSpeed(speed);
        }

        if (!this._watchPaused && this._watchGame && !this._watchGame.isComplete) {
            this._startWatchTimer();
        }
    }

    watchGameTogglePause() {
        this._watchPaused = !this._watchPaused;

        if (window._wgRefs?.setPaused) {
            window._wgRefs.setPaused(this._watchPaused);
        }

        if (!this._watchPaused && this._watchGame && !this._watchGame.isComplete) {
            this._startWatchTimer();
        }
    }

    watchGameSkip() {
        if (!this._watchGame) return;
        if (this._watchTimer) clearInterval(this._watchTimer);
        const result = this._watchGame.finish();
        this._renderWatchEvents(result.events.slice(-20));
        this._updateWatchScoreboard();
        this._onWatchGameEnd();
    }

    watchGameClose() {
        // If we're in a playoff series watch, route to the playoff handler
        if (this._isPlayoffWatch) {
            this.watchPlayoffGameClose();
            return;
        }

        // If we're watching a preseason game, record result without W/L impact
        if (this._isPreseasonWatch) {
            const { helpers } = this.ctx;
            if (this._watchTimer) clearInterval(this._watchTimer);
            this._watchTimer = null;
            this._isPreseasonWatch = false;
            // Let OffseasonController record the result
            window._offseasonController?.recordPreseasonWatchResult?.();
            return;
        }

        const { gameState, helpers, engines } = this.ctx;
        if (this._watchTimer) clearInterval(this._watchTimer);
        this._watchTimer = null;
        if (!this._watchGame) return;

        const result = this._watchGame.getResult();
        const simCtrl = helpers.getSimulationController();
        const gmMode = helpers.getGmMode();
        const userTeamId = gameState.userTeamId;

        // Update team records
        if (result.homeWon) {
            this._watchHomeTeam.wins++; this._watchAwayTeam.losses++;
            if (this._watchHomeTeam.coach) this._watchHomeTeam.coach.seasonWins++;
            if (this._watchAwayTeam.coach) this._watchAwayTeam.coach.seasonLosses++;
        } else {
            this._watchAwayTeam.wins++; this._watchHomeTeam.losses++;
            if (this._watchAwayTeam.coach) this._watchAwayTeam.coach.seasonWins++;
            if (this._watchHomeTeam.coach) this._watchHomeTeam.coach.seasonLosses++;
        }

        this._watchHomeTeam.pointDiff += result.pointDiff;
        this._watchAwayTeam.pointDiff -= result.pointDiff;

        simCtrl.applyChemistryChanges(this._watchHomeTeam, result.homeWon);
        simCtrl.applyChemistryChanges(this._watchAwayTeam, !result.homeWon);
        simCtrl.accumulatePlayerStats(this._watchHomeTeam, result.homePlayerStats);
        simCtrl.accumulatePlayerStats(this._watchAwayTeam, result.awayPlayerStats);

        // Mark game played in schedule
        const todaysGames = engines.CalendarEngine.getGamesForDate(this._watchDate, gameState);
        const allSchedule = [...(todaysGames.tier1 || []), ...(todaysGames.tier2 || []), ...(todaysGames.tier3 || [])];
        const schedGame = allSchedule.find(g =>
            g.homeTeamId === this._watchHomeTeam.id && g.awayTeamId === this._watchAwayTeam.id && !g.played
        );
        if (schedGame) {
            schedGame.played = true;
            schedGame.homeScore = result.homeScore;
            schedGame.awayScore = result.awayScore;
            schedGame.winnerId = result.winner.id;
            schedGame.boxScore = {
                home: {
                    teamId: this._watchHomeTeam.id, teamName: this._watchHomeTeam.name,
                    city: this._watchHomeTeam.city || '', score: result.homeScore,
                    players: result.homePlayerStats.filter(p => p.minutesPlayed > 0)
                        .sort((a, b) => b.minutesPlayed - a.minutesPlayed)
                        .map(p => ({ name: p.playerName, pos: p.position, min: p.minutesPlayed, pts: p.points, reb: p.rebounds, ast: p.assists, stl: p.steals, blk: p.blocks, to: p.turnovers, pf: p.fouls, fgm: p.fieldGoalsMade, fga: p.fieldGoalsAttempted, tpm: p.threePointersMade, tpa: p.threePointersAttempted, ftm: p.freeThrowsMade, fta: p.freeThrowsAttempted, starter: p.gamesStarted > 0, pm: p.plusMinus || 0 }))
                },
                away: {
                    teamId: this._watchAwayTeam.id, teamName: this._watchAwayTeam.name,
                    city: this._watchAwayTeam.city || '', score: result.awayScore,
                    players: result.awayPlayerStats.filter(p => p.minutesPlayed > 0)
                        .sort((a, b) => b.minutesPlayed - a.minutesPlayed)
                        .map(p => ({ name: p.playerName, pos: p.position, min: p.minutesPlayed, pts: p.points, reb: p.rebounds, ast: p.assists, stl: p.steals, blk: p.blocks, to: p.turnovers, pf: p.fouls, fgm: p.fieldGoalsMade, fga: p.fieldGoalsAttempted, tpm: p.threePointersMade, tpa: p.threePointersAttempted, ftm: p.freeThrowsMade, fta: p.freeThrowsAttempted, starter: p.gamesStarted > 0, pm: p.plusMinus || 0 }))
                },
                quarterScores: result.quarterScores,
                winProbHistory: window._wgWinProbHistory || null,
                preGameProb: this._watchPreGameProb || null,
                events: result.events.filter(e => ['made_shot', 'run', 'quarter_end'].includes(e.type)).slice(-30)
            };
            // Clear the temporary storage
            window._wgWinProbHistory = null;
        }

        // Fatigue and injuries
        helpers.processFatigueAfterGame(this._watchHomeTeam, this._watchAwayTeam, false);
        helpers.updateInjuries(this._watchHomeTeam);
        helpers.updateInjuries(this._watchAwayTeam);
        const userGamesPlayed = helpers.getUserTeam() ? (helpers.getUserTeam().wins + helpers.getUserTeam().losses) : 0;
        const injuries = helpers.checkForInjuries(this._watchHomeTeam, this._watchAwayTeam, userGamesPlayed, false);
        const userTeamInjuries = injuries.filter(inj => inj.team.id === userTeamId);
        const aiTeamInjuries = injuries.filter(inj => inj.team.id !== userTeamId);
        aiTeamInjuries.forEach(({team, player, injury}) => {
            const aiDecision = injury.canPlayThrough && Math.random() < 0.3 ? 'playThrough' : 'rest';
            helpers.applyInjury(player, injury, aiDecision);
        });

        gameState.currentDate = engines.CalendarEngine.addDays(this._watchDate, 1);

        if (window._reactCloseWatchGame) window._reactCloseWatchGame();
        this._watchGame = null;

        gmMode._showPostGameIfUserPlayed(this._watchDate);
        gmMode.saveGameState();
        gmMode.updateUI();

        if (userTeamInjuries.length > 0) {
            gameState.pendingInjuries = userTeamInjuries;
            gmMode.saveGameState();
            helpers.showNextInjuryModal();
        }

        if (gameState.isSeasonComplete()) {
            gmMode.showSeasonEnd();
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Bracket Viewer
    // ═══════════════════════════════════════════════════════════════════

    openBracketViewer() {
        const { gameState, helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();

        if (window._reactShowBracket) {
            let bracketData = null;
            if (gameState.currentTier === 1 && gameState.championshipPlayoffData) {
                bracketData = { tier: 1, playoffData: gameState.championshipPlayoffData };
            } else if (gameState.currentTier === 2 && gameState.t2PlayoffData) {
                bracketData = { tier: 2, playoffData: gameState.t2PlayoffData };
            } else if (gameState.currentTier === 3 && gameState.t3PlayoffData) {
                bracketData = { tier: 3, playoffData: gameState.t3PlayoffData };
            }
            window._reactShowBracket({
                bracketData,
                userTeamId: userTeam?.id,
                playoffWatch: this._playoffWatch ? {
                    higherId: this._playoffWatch.higherSeed?.id,
                    lowerId: this._playoffWatch.lowerSeed?.id,
                    higherName: this._playoffWatch.higherSeed?.name,
                    lowerName: this._playoffWatch.lowerSeed?.name,
                    higherWins: this._playoffWatch.higherWins,
                    lowerWins: this._playoffWatch.lowerWins,
                } : null,
            });
            return;
        }

        // Legacy fallback
        let html = '';
        if (gameState.currentTier === 1 && gameState.championshipPlayoffData) {
            // [LEGACY REMOVED] html = UIRenderer.t1BracketViewer({ playoffData: gameState.championshipPlayoffData, userTeam, playoffWatch: this._playoffWatch });
        } else if (gameState.currentTier === 2 && gameState.t2PlayoffData) {
            // [LEGACY REMOVED] html = UIRenderer.t2BracketViewer({ playoffData: gameState.t2PlayoffData, userTeam, playoffWatch: this._playoffWatch });
        } else if (gameState.currentTier === 3 && gameState.t3PlayoffData) {
            // [LEGACY REMOVED] html = UIRenderer.t3BracketViewer({ playoffData: gameState.t3PlayoffData, userTeam, playoffWatch: this._playoffWatch });
        } else {
            html = '<div style="padding:40px;text-align:center;opacity:0.7;">No active playoff bracket</div>';
        }
    }

    /**
     * Show a box score for a playoff game.
     * @param {string} seriesKey - Key to locate the series in playoff data
     * @param {number} gameIdx - 0-based index into the series games array
     */
    showPlayoffBoxScore(seriesKey, gameIdx) {
        const { gameState, helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();

        // Find the series result by key
        let seriesResult = null;
        if (seriesKey.startsWith('t1-')) {
            const pd = gameState.championshipPlayoffData;
            if (pd && pd.roundResults) {
                const [, roundStr, idxStr] = seriesKey.split('-');
                const round = parseInt(roundStr);
                const idx = parseInt(idxStr);
                if (pd.roundResults[round] && pd.roundResults[round][idx]) {
                    seriesResult = pd.roundResults[round][idx].result;
                }
            }
        } else if (seriesKey.startsWith('t2-div-')) {
            const pd = gameState.t2PlayoffData;
            if (pd) {
                const field = seriesKey.replace('t2-div-', '');
                seriesResult = pd.interactiveResults[field];
            }
        } else if (seriesKey.startsWith('t2-nat-')) {
            const pd = gameState.t2PlayoffData;
            if (pd) {
                const [, , roundStr, idxStr] = seriesKey.split('-');
                const round = parseInt(roundStr);
                const idx = parseInt(idxStr);
                if (pd.interactiveResults.nationalRounds[round] && pd.interactiveResults.nationalRounds[round][idx]) {
                    seriesResult = pd.interactiveResults.nationalRounds[round][idx].result;
                }
            }
        } else if (seriesKey.startsWith('t3-')) {
            const pd = gameState.t3PlayoffData;
            if (pd) {
                const field = seriesKey.replace('t3-', '');
                if (field === 'metroFinal') {
                    seriesResult = pd.interactiveResults.metroFinal;
                } else if (field.startsWith('nat-')) {
                    const [, stage, idxStr] = field.split('-');
                    const idx = parseInt(idxStr);
                    const stageData = pd.interactiveResults[stage];
                    if (stage === 'championship' && stageData) {
                        // Championship stored as single result, not array
                        seriesResult = stageData.result;
                    } else if (stageData && stageData[idx]) {
                        seriesResult = stageData[idx].result;
                    }
                } else if (field.startsWith('regional-')) {
                    const idx = parseInt(field.replace('regional-', ''));
                    if (pd.interactiveResults.regionalRound && pd.interactiveResults.regionalRound[idx]) {
                        seriesResult = pd.interactiveResults.regionalRound[idx].result;
                    }
                }
            }
        }

        if (!seriesResult || !seriesResult.games || !seriesResult.games[gameIdx]) {
            console.warn('Could not find playoff game:', seriesKey, gameIdx);
            return;
        }

        const game = seriesResult.games[gameIdx];
        let boxPayload;
        if (!game.boxScore) {
            boxPayload = {
                home: { city: game.homeTeam.city || '', name: game.homeTeam.name, score: game.homeScore, players: [] },
                away: { city: game.awayTeam.city || '', name: game.awayTeam.name, score: game.awayScore, players: [] },
                date: `Playoff Game ${game.gameNumber}`,
                hasDetailedStats: false
            };
        } else {
            boxPayload = {
                home: game.boxScore.home,
                away: game.boxScore.away,
                date: `Playoff Game ${game.gameNumber}`,
                hasDetailedStats: true,
                quarterScores: game.boxScore.quarterScores
            };
        }
        if (window._reactShowBoxScore) {
            window._reactShowBoxScore(boxPayload);
        }
        // Legacy boxScore fallback removed — React path handles rendering
    }

    // ═══════════════════════════════════════════════════════════════════
    // Playoff Series Watch System
    // ═══════════════════════════════════════════════════════════════════
    //
    // Allows the user to watch individual games in a playoff series.
    // Flow: Series Intro → Watch Game 1 → Series Update → Watch Game 2 → ... → Series Complete
    // The user can "Sim Rest" at any point to auto-finish the series.
    //
    // State stored in this._playoffWatch:
    //   { higherSeed, lowerSeed, bestOf, gamesToWin, homePattern,
    //     higherWins, lowerWins, games[], gameNum, onComplete(result) }

    /**
     * Start watching a playoff series game-by-game.
     * @param {Object} higherSeed - Higher seeded team
     * @param {Object} lowerSeed - Lower seeded team
     * @param {number} bestOf - 3, 5, or 7
     * @param {Function} onComplete - Called with the series result when finished
     */
    startPlayoffSeriesWatch(higherSeed, lowerSeed, bestOf, onComplete) {
        const homePattern = bestOf === 7
            ? [true, true, false, false, true, false, true]
            : bestOf === 3
                ? [true, false, true]
                : [true, true, false, false, true];

        this._playoffWatch = {
            higherSeed, lowerSeed, bestOf,
            gamesToWin: Math.ceil(bestOf / 2),
            homePattern,
            higherWins: 0, lowerWins: 0,
            games: [],
            gameNum: 0,
            onComplete
        };

        this._showPlayoffSeriesStatus();
    }

    _showPlayoffSeriesStatus() {
        const pw = this._playoffWatch;
        if (!pw) return;

        const { helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const seriesOver = pw.higherWins >= pw.gamesToWin || pw.lowerWins >= pw.gamesToWin;

        if (seriesOver) {
            this._completePlayoffSeries();
            return;
        }

        // Hub mode: sidebar reads _playoffWatch reactively — just refresh, no modal
        if (window._reactPlayoffHubRefresh) {
            window._reactPlayoffHubRefresh();
            return;
        }
    }

    // NOTE: watchPlayoffGame v1 (modal-era) removed — was unreachable.
    // The hub-era chain uses startPlayoffSeriesWatch which renders buttons
    // calling window.watchPlayoffGame, now pointing to watchCalendarPlayoffGame.

    /**
     * Close the watch game modal after a playoff game.
     * Instead of updating calendar/standings, records the game result
     * and returns to the series flow.
     */
    watchPlayoffGameClose() {
        const { gameState, helpers, engines } = this.ctx;
        if (this._watchTimer) clearInterval(this._watchTimer);
        this._watchTimer = null;
        
        // Route to calendar-based handler if we have _watchPlayoffGame
        if (this._watchPlayoffGame) {
            this._closeCalendarPlayoffWatch();
            return;
        }
        
        // Legacy handler for old _playoffWatch system
        if (!this._watchGame || !this._playoffWatch) return;

        const result = this._watchGame.getResult();
        const pw = this._playoffWatch;

        const isHigherHome = pw.homePattern[pw.gameNum];
        const homeTeam = isHigherHome ? pw.higherSeed : pw.lowerSeed;
        const awayTeam = isHigherHome ? pw.lowerSeed : pw.higherSeed;

        // Determine winner
        const higherSeedWon = (result.homeWon && isHigherHome) || (!result.homeWon && !isHigherHome);
        if (higherSeedWon) {
            pw.higherWins++;
        } else {
            pw.lowerWins++;
        }

        // Build box score data matching regular season format
        const boxScore = {
            home: { city: homeTeam.city || '', name: homeTeam.name, score: result.homeScore, players: PlayoffSimController.mapStats(result.homePlayerStats) },
            away: { city: awayTeam.city || '', name: awayTeam.name, score: result.awayScore, players: PlayoffSimController.mapStats(result.awayPlayerStats) },
            quarterScores: result.quarterScores || null
        };

        pw.games.push({
            gameNumber: pw.gameNum + 1,
            homeTeam, awayTeam,
            homeScore: result.homeScore,
            awayScore: result.awayScore,
            winner: higherSeedWon ? pw.higherSeed : pw.lowerSeed,
            boxScore
        });
        pw.gameNum++;

        if (window._reactCloseWatchGame) window._reactCloseWatchGame();
        this._watchGame = null;
        this._isPlayoffWatch = false;

        // Return to series status
        this._showPlayoffSeriesStatus();
    }

    /**
     * Close handler for calendar-based playoff watch games.
     * Records the result in playoffSchedule and refreshes PlayoffHub.
     */
    _closeCalendarPlayoffWatch() {
        const { gameState, helpers, engines } = this.ctx;
        const game = this._watchPlayoffGame;
        
        if (!this._watchGame || !game) return;
        
        const result = this._watchGame.getResult();
        
        // Record result in the scheduled game
        game.played = true;
        game.result = {
            homeScore: result.homeScore,
            awayScore: result.awayScore,
            winner: result.winner,
            loser: result.loser,
            overtime: result.overtime || false
        };
        
        // Store box score for this game
        game.boxScore = {
            home: { city: this._watchHomeTeam.city || '', name: this._watchHomeTeam.name, score: result.homeScore, players: PlayoffSimController.mapStats(result.homePlayerStats) },
            away: { city: this._watchAwayTeam.city || '', name: this._watchAwayTeam.name, score: result.awayScore, players: PlayoffSimController.mapStats(result.awayPlayerStats) },
            quarterScores: result.quarterScores || null,
            // Capture win probability history from the watch game component
            winProbHistory: window._wgWinProbHistory || null,
            preGameProb: this._watchPreGameProb || null
        };
        
        // Clear the temporary storage
        window._wgWinProbHistory = null;
        
        console.log(`✅ Playoff game complete: ${this._watchHomeTeam.name} ${result.homeScore} - ${result.awayScore} ${this._watchAwayTeam.name}`);
        
        // Accumulate player stats
        const simCtrl = helpers.getSimulationController();
        simCtrl.accumulatePlayerStats(this._watchHomeTeam, result.homePlayerStats);
        simCtrl.accumulatePlayerStats(this._watchAwayTeam, result.awayPlayerStats);
        
        // Update brackets if series complete — delegate to PlayoffSimController
        const psc = this._playoffSimController;
        if (psc) {
            psc._updateBracketsAfterGames();
            psc._updateUserSeriesForNextRound();
        }
        
        // Close watch game modal
        if (window._reactCloseWatchGame) window._reactCloseWatchGame();
        
        // Clean up state
        this._watchGame = null;
        this._watchPlayoffGame = null;
        this._isPlayoffWatch = false;
        
        // Save and refresh PlayoffHub
        helpers.saveGameState();
        if (window._reactPlayoffHubRefresh) window._reactPlayoffHubRefresh();
        
        // Check if playoffs complete — delegate to PlayoffSimController
        if (psc) {
            psc._checkPlayoffsComplete();
        }
    }

    /**
     * Auto-sim remaining games in the current playoff series.
     */
    simRestOfPlayoffSeries() {
        const { helpers } = this.ctx;
        const pw = this._playoffWatch;
        if (!pw) return;

        const userTeam = helpers.getUserTeam();
        const userInSeries = (pw.higherSeed.id === userTeam.id || pw.lowerSeed.id === userTeam.id);

        while (pw.higherWins < pw.gamesToWin && pw.lowerWins < pw.gamesToWin) {
            const isHigherHome = pw.homePattern[pw.gameNum];
            const homeTeam = isHigherHome ? pw.higherSeed : pw.lowerSeed;
            const awayTeam = isHigherHome ? pw.lowerSeed : pw.higherSeed;

            const gameResult = helpers.getSimulationController().simulatePlayoffGame(homeTeam, awayTeam);
            const higherSeedWon = (gameResult.winner.id === pw.higherSeed.id);

            if (higherSeedWon) pw.higherWins++;
            else pw.lowerWins++;

            const gameEntry = {
                gameNumber: pw.gameNum + 1,
                homeTeam, awayTeam,
                homeScore: gameResult.homeScore,
                awayScore: gameResult.awayScore,
                winner: higherSeedWon ? pw.higherSeed : pw.lowerSeed
            };

            // Store box score for user's series
            if (userInSeries && gameResult.homePlayerStats && gameResult.awayPlayerStats) {
                gameEntry.boxScore = {
                    home: { city: homeTeam.city || '', name: homeTeam.name, score: gameResult.homeScore, players: PlayoffSimController.mapStats(gameResult.homePlayerStats) },
                    away: { city: awayTeam.city || '', name: awayTeam.name, score: gameResult.awayScore, players: PlayoffSimController.mapStats(gameResult.awayPlayerStats) },
                    quarterScores: gameResult.quarterScores || null
                };
            }

            pw.games.push(gameEntry);
            pw.gameNum++;
        }

        this._completePlayoffSeries();
    }

    /**
     * Sim exactly one game in the current _playoffWatch series.
     * Called by window.simOnePlayoffGame (hub Game button).
     */
    simOnePlayoffGame() {
        const { helpers } = this.ctx;
        const pw = this._playoffWatch;
        if (!pw) return;
        if (pw.higherWins >= pw.gamesToWin || pw.lowerWins >= pw.gamesToWin) {
            this._completePlayoffSeries();
            return;
        }

        const isHigherHome = pw.homePattern[pw.gameNum];
        const homeTeam = isHigherHome ? pw.higherSeed : pw.lowerSeed;
        const awayTeam = isHigherHome ? pw.lowerSeed : pw.higherSeed;

        const gameResult = helpers.getSimulationController().simulatePlayoffGame(homeTeam, awayTeam);
        const higherSeedWon = (gameResult.winner.id === pw.higherSeed.id);
        if (higherSeedWon) pw.higherWins++;
        else pw.lowerWins++;

        const userTeam = helpers.getUserTeam();
        const userInSeries = (pw.higherSeed.id === userTeam.id || pw.lowerSeed.id === userTeam.id);
        const gameEntry = {
            gameNumber: pw.gameNum + 1,
            homeTeam, awayTeam,
            homeScore: gameResult.homeScore,
            awayScore: gameResult.awayScore,
            winner: higherSeedWon ? pw.higherSeed : pw.lowerSeed
        };

        if (userInSeries && gameResult.homePlayerStats && gameResult.awayPlayerStats) {
            gameEntry.boxScore = {
                home: { city: homeTeam.city || '', name: homeTeam.name, score: gameResult.homeScore, players: PlayoffSimController.mapStats(gameResult.homePlayerStats) },
                away: { city: awayTeam.city || '', name: awayTeam.name, score: gameResult.awayScore, players: PlayoffSimController.mapStats(gameResult.awayPlayerStats) },
                quarterScores: gameResult.quarterScores || null
            };
        }

        pw.games.push(gameEntry);
        pw.gameNum++;

        this._showPlayoffSeriesStatus();
    }

    _completePlayoffSeries() {
        const pw = this._playoffWatch;
        if (!pw) return;

        const result = {
            higherSeed: pw.higherSeed,
            lowerSeed: pw.lowerSeed,
            winner: pw.higherWins >= pw.gamesToWin ? pw.higherSeed : pw.lowerSeed,
            loser: pw.higherWins >= pw.gamesToWin ? pw.lowerSeed : pw.higherSeed,
            higherWins: pw.higherWins,
            lowerWins: pw.lowerWins,
            higherSeedWins: pw.higherWins,
            lowerSeedWins: pw.lowerWins,
            games: pw.games,
            seriesScore: `${pw.higherWins}-${pw.lowerWins}`
        };

        const callback = pw.onComplete;
        this._playoffWatch = null;

        if (callback) callback(result);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Season End
    // ═══════════════════════════════════════════════════════════════════

    showSeasonEnd() {
        const { gameState, helpers, engines } = this.ctx;

        // Mark offseason phase
        gameState.offseasonPhase = 'season_ended';

        const userTeam = helpers.getUserTeam();
        if (!userTeam) {
            console.error('🚨 showSeasonEnd: userTeam not found anywhere!');
            alert('Error: Could not find your team. Please report this bug.');
            return;
        }

        if (userTeam.tier !== gameState.currentTier) {
            console.warn('⚠️ showSeasonEnd: currentTier was', gameState.currentTier, 'but user team is in tier', userTeam.tier, '— correcting.');
            gameState.currentTier = userTeam.tier;
        }

        const teams = helpers.getCurrentTeams();
        const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
        const sortedTeams = helpers.sortTeamsWithTiebreakers(teams, allTeams, {
            useDivisionDominance: gameState.currentTier === 3
        });

        const rankIdx = sortedTeams.findIndex(t => t.id === gameState.userTeamId);
        const rank = rankIdx === -1 ? teams.length : rankIdx + 1;
        const totalTeams = teams.length;

        const seasonLabel = `${gameState.currentSeason}-${(gameState.currentSeason + 1) % 100}`;
        const alreadyRecorded = gameState.seasonHistory.some(h => h.season === seasonLabel && h.tier === gameState.currentTier);
        if (!alreadyRecorded) {
            gameState.seasonHistory.push({
                season: seasonLabel, tier: gameState.currentTier,
                wins: userTeam.wins, losses: userTeam.losses, rank, pointDiff: userTeam.pointDiff
            });
        }

        let status, statusColor, nextAction;

        if (gameState.currentTier === 1) {
 if (rank === totalTeams) { status = 'AUTO-RELEGATED TO TIER 2'; statusColor = 'var(--color-loss)'; nextAction = 'relegate'; }
 else if (rank >= totalTeams - 2 && rank <= totalTeams - 1) { status = 'RELEGATION PLAYOFF'; statusColor = 'var(--color-warning)'; nextAction = 'relegation-playoff'; }
            else {
                // Check if user is in the top 8 of their conference (championship playoff eligible)
                const t1Sorted = helpers.sortTeamsByStandings(gameState.tier1Teams, gameState.tier1Schedule);
                const eastTeams = t1Sorted.filter(t =>
                    t.division === 'Atlantic' || t.division === 'Central' || t.division === 'Southeast'
                );
                const westTeams = t1Sorted.filter(t =>
                    t.division === 'Northwest' || t.division === 'Pacific' || t.division === 'Southwest'
                );
                const inEastPlayoffs = eastTeams.slice(0, 8).some(t => t.id === userTeam.id);
                const inWestPlayoffs = westTeams.slice(0, 8).some(t => t.id === userTeam.id);
                if (inEastPlayoffs || inWestPlayoffs) {
                    const conf = inEastPlayoffs ? 'Eastern' : 'Western';
                    const confTeams = inEastPlayoffs ? eastTeams.slice(0, 8) : westTeams.slice(0, 8);
                    const seed = confTeams.findIndex(t => t.id === userTeam.id) + 1;
 status = `#${seed} SEED — ${conf} Conference Playoffs!`;
                    statusColor = 'var(--color-tier1)'; nextAction = 'championship';
                } else {
 status = 'Safe in Tier 1'; statusColor = 'var(--color-win)'; nextAction = 'stay';
                }
            }
        } else if (gameState.currentTier === 2) {
            // Check if user is in top 4 of their division (division playoff eligible)
            const divTeams = teams.filter(t => t.division === userTeam.division);
            const divSorted = helpers.sortTeamsByStandings(divTeams, gameState.schedule);
            const divRank = divSorted.findIndex(t => t.id === userTeam.id) + 1;

 if (rank === totalTeams) { status = 'AUTO-RELEGATED TO TIER 3'; statusColor = 'var(--color-loss)'; nextAction = 'relegate'; }
 else if (rank >= totalTeams - 2 && rank <= totalTeams - 1) { status = 'RELEGATION PLAYOFF'; statusColor = 'var(--color-warning)'; nextAction = 'relegation-playoff'; }
            else if (divRank <= 4) {
 status = `#${divRank} SEED — ${userTeam.division} Division Playoffs!`;
                statusColor = 'var(--color-tier1)'; nextAction = 't2-championship';
            }
            else { status = 'Season Over — Staying in Tier 2'; statusColor = 'var(--color-text-secondary)'; nextAction = 'stay'; }
        } else {
            const divisionTeams = teams.filter(t => t.division === userTeam.division);
            const divisionSorted = helpers.sortTeamsByStandings(divisionTeams, gameState.schedule);
            const divisionRank = divisionSorted.findIndex(t => t.id === userTeam.id) + 1;

            if (divisionRank <= 2) {
 status = divisionRank === 1 ? '#1 SEED — Metro League Playoffs!' : '#2 SEED — Metro League Playoffs!';
                statusColor = 'var(--color-tier3)'; nextAction = 't3-championship';
            } else { status = 'Season Over — Staying in Tier 3'; statusColor = 'var(--color-text-secondary)'; nextAction = 'stay'; }
        }

        const tier1Sorted = helpers.sortTeamsByStandings(gameState.tier1Teams, gameState.tier1Schedule);
        const tier2Sorted = helpers.sortTeamsByStandings(gameState.tier2Teams, gameState.tier2Schedule);
        const tier3Sorted = helpers.sortTeamsByStandings(gameState.tier3Teams, gameState.tier3Schedule);

        const t1TopTeam = tier1Sorted[0];
        const t1Relegated = [tier1Sorted[tier1Sorted.length - 1], tier1Sorted[tier1Sorted.length - 2], tier1Sorted[tier1Sorted.length - 3], tier1Sorted[tier1Sorted.length - 4]];
        const t2Champion = tier2Sorted[0];
        const t2Promoted = [tier2Sorted[0], tier2Sorted[1], tier2Sorted[2], tier2Sorted[3]];
        const t3Champion = tier3Sorted[0];
        const t3Promoted = [tier3Sorted[0], tier3Sorted[1], tier3Sorted[2], tier3Sorted[3]];

        const tier1Awards = engines.StatEngine.calculateAwards(gameState.tier1Teams, Math.floor(82 * 0.5), 1);
        const tier2Awards = engines.StatEngine.calculateAwards(gameState.tier2Teams, Math.floor(60 * 0.5), 2);
        const tier3Awards = engines.StatEngine.calculateAwards(gameState.tier3Teams, Math.floor(40 * 0.5), 3);

        gameState._seasonEndData = {
            season: gameState.currentSeason,
            seasonLabel: `${gameState.currentSeason}-${String((gameState.currentSeason + 1) % 100).padStart(2, '0')}`,
            userTeamId: gameState.userTeamId, userTier: gameState.currentTier,
            standings: {
                tier1: tier1Sorted.map((t, i) => ({ rank: i + 1, id: t.id, name: t.name, city: t.city, wins: t.wins, losses: t.losses, pointDiff: t.pointDiff, rating: Math.round(t.rating) })),
                tier2: tier2Sorted.map((t, i) => ({ rank: i + 1, id: t.id, name: t.name, city: t.city, wins: t.wins, losses: t.losses, pointDiff: t.pointDiff, rating: Math.round(t.rating) })),
                tier3: tier3Sorted.map((t, i) => ({ rank: i + 1, id: t.id, name: t.name, city: t.city, wins: t.wins, losses: t.losses, pointDiff: t.pointDiff, rating: Math.round(t.rating) }))
            },
            awards: {
                tier1: engines.StorageEngine._compactAwards(tier1Awards),
                tier2: engines.StorageEngine._compactAwards(tier2Awards),
                tier3: engines.StorageEngine._compactAwards(tier3Awards)
            }
        };

        const seasonEndPayload = {
            userTeam, rank, tier: gameState.currentTier, status, statusColor, nextAction,
            seasonLabel: `${gameState.currentSeason}-${(gameState.currentSeason + 1) % 100}`,
            awards: [
                { tierLabel: 'Tier 1 — Premier League', data: tier1Awards },
                { tierLabel: 'Tier 2 — Regional League', data: tier2Awards },
                { tierLabel: 'Tier 3 — Metro League', data: tier3Awards },
            ],
            t1TopTeam, t2Champion, t3Champion,
            t2Promoted, t1Relegated, t3Promoted, tier2Sorted,
            getRankSuffix: helpers.getRankSuffix
        };

        if (window._reactShowSeasonEnd) {
            const self = this;
            window._seasonEndAdvanceCallback = (action) => {
                console.log('═══════════════════════════════════════════════════════════');
                console.log('🎯 [DIAG] _seasonEndAdvanceCallback CALLED');
                console.log('🎯 [DIAG] action:', action);
                console.log('🎯 [DIAG] Calling advanceToNextSeason...');
                console.log('═══════════════════════════════════════════════════════════');
                helpers.getOffseasonController().advanceToNextSeason(action);
            };
            window._seasonEndManageRosterCallback = () => {
                window.openRosterManagement && window.openRosterManagement();
            };
            window._seasonEndStayCallback = () => {
                self.closeSeasonEnd();
                // Trigger React refresh so TopBar shows offseason controls
                if (window._notifyReact) {
                    window._reactGameState = gameState;
                    window._notifyReact();
                }
            };
            console.log('🎯 [DIAG] Showing SeasonEndModal with payload:', { nextAction, status, rank, tier: gameState.currentTier });
            window._reactShowSeasonEnd(seasonEndPayload);
            return;
        }

        // Legacy fallback removed — React SeasonEndModal handles rendering
    }

    closeSeasonEnd() {
        // React SeasonEndModal handles its own close via _reactCloseSeasonEnd.
        // Sim buttons are managed by React SimControls component.
        // This method is kept as a no-op for the _seasonEndStayCallback path.
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // CALENDAR-BASED PLAYOFF SIMULATION — EXTRACTED to PlayoffSimController.js
    //
    // Methods moved: simPlayoffDay, simUserPlayoffSeries, simPlayoffRound,
    //   simToChampionship, watchPlayoffGame (v2), _simOneScheduledGame,
    //   _updateBracketsAfterGames, _checkT2NationalTournamentSeeding,
    //   _checkT3TournamentSeeding, _checkThirdPlaceGames, _populateSeriesWithTeams,
    //   _populateSeriesWithTeam, _getNextSeriesId, _isHigherSeedAdvancement,
    //   _finalizeSeriesMatchup, _getCurrentPlayoffRoundForTier,
    //   _isRoundCompleteForTier, _updateUserSeriesForNextRound,
    //   _checkPlayoffsComplete, _isTierPlayoffsComplete, _buildPostseasonResults
    //
    // These are now wired via window.* globals in game-init.js pointing at
    // PlayoffSimController. watchPlayoffGame (v2) stays here since it needs
    // watch infrastructure. _closeCalendarPlayoffWatch stays here since it
    // reads _watchGame state.
    // ═══════════════════════════════════════════════════════════════════════════════

    // NOTE: watchPlayoffGame v2 (calendar-based) is kept here because it sets up
    // _watchGame, _watchTimer, and other watch state that lives on this controller.
    // It delegates _simOneScheduledGame to PlayoffSimController for other games on the date.

    /**
     * Watch user's next playoff game with live play-by-play.
     * Calendar-based version that works with gameState.playoffSchedule.
     * Delegates other-game sim to PlayoffSimController, but owns the watch
     * infrastructure (_watchGame, _watchTimer, etc.).
     */
    watchCalendarPlayoffGame() {
        const { gameState, helpers, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        const userSeriesId = gameState.userSeriesId;
        
        if (!schedule || !userSeriesId) {
            console.error('❌ watchPlayoffGame: No schedule or user series');
            return;
        }
        
        // Find user's next unplayed game
        const seriesGames = schedule.bySeries[userSeriesId] || [];
        const nextGame = seriesGames.find(g => !g.played);
        
        if (!nextGame) {
            console.log('No more games in user series');
            return;
        }
        
        // Get team objects
        const allTeams = [
            ...(gameState.tier1Teams || []),
            ...(gameState.tier2Teams || []),
            ...(gameState.tier3Teams || [])
        ];
        const homeTeam = allTeams.find(t => t.id === nextGame.homeTeamId);
        const awayTeam = allTeams.find(t => t.id === nextGame.awayTeamId);
        
        if (!homeTeam || !awayTeam) {
            console.error('❌ watchPlayoffGame: Could not find teams');
            return;
        }
        
        // Sim other games on this date first — delegate to PlayoffSimController
        const psc = this._playoffSimController;
        if (psc) {
            const otherGames = engines.PlayoffEngine.getPlayoffGamesOnDate(schedule, nextGame.date)
                .filter(g => g.id !== nextGame.id);
            for (const g of otherGames) {
                psc._simOneScheduledGame(g);
            }
        }
        
        // Set up watch game state (all on this controller)
        this._watchDate = nextGame.date;
        this._watchHomeTeam = homeTeam;
        this._watchAwayTeam = awayTeam;
        this._watchHomeName = homeTeam.name;
        this._watchAwayName = awayTeam.name;
        this._watchPlayoffGame = nextGame; // Track which playoff game this is
        this._isPlayoffWatch = true; // Flag so watchGameClose routes correctly
        
        const userIsHome = homeTeam.id === gameState.userTeamId;
        this._watchUserIsHome = userIsHome;
        
        // Apply fatigue/rest
        helpers.applyFatigueAutoRest?.(homeTeam, true);
        helpers.applyFatigueAutoRest?.(awayTeam, true);
        
        // Create game pipeline
        const { GamePipeline } = engines;
        this._watchGame = GamePipeline.create(homeTeam, awayTeam, {
            isPlayoffs: true,
            tier: nextGame.tier
        });
        
        const preGameProb = GameSimController._calcPreGameWinProb(
            userIsHome ? homeTeam : awayTeam,
            userIsHome ? awayTeam : homeTeam,
            userIsHome
        );
        this._watchPreGameProb = preGameProb;
        
        // Show watch game UI
        if (window._reactShowWatchGame) {
            window._reactShowWatchGame({
                homeName: this._watchHomeName,
                awayName: this._watchAwayName,
                homeTeamFullName: homeTeam.name,
                awayTeamFullName: awayTeam.name,
                userIsHome,
                isPlayoffs: true,
                seriesInfo: {
                    round: nextGame.round,
                    gameNumber: nextGame.gameNumber,
                    bestOf: nextGame.bestOf
                }
            });
        }
        
        this._watchPaused = false;
        this._watchSpeed = 1;
        this.watchGameSetSpeed(1);
        
        setTimeout(() => {
            if (window._wgRefs?.setPreGameWinProb) {
                window._wgRefs.setPreGameWinProb(preGameProb);
            }
        }, 50);
        
        this._startWatchTimer();
    }

    // ── Win Probability Helpers ─────────────────────────────────────────────────

    /**
     * Pre-game win probability from roster rating differential.
     * Uses top-8 rotation average of offRating and defRating.
     * A ~5 rating point edge ≈ 60% pre-game win probability.
     *
     * @param {object} userTeam
     * @param {object} oppTeam
     * @returns {number} 0–1 win probability for user
     */
    static _calcPreGameWinProb(userTeam, oppTeam, userIsHome = true) {
        // Use unified LeagueManager function for consistency across all UI
        return LeagueManager.calcPreGameWinProb(userTeam, oppTeam, userIsHome);
    }

    /**
     * Live in-game win probability using score margin + time remaining.
     * Approximates the ESPN/KenPom logistic model.
     *
     * Convention: returns probability that the USER'S team wins.
     *
     * @param {number} margin         - home score minus away score (GamePipeline convention)
     * @param {number} elapsedSeconds - seconds elapsed in the game (0–2880)
     * @param {boolean} userIsHome    - is the user's team the home team?
     * @param {number} preGameProb    - pre-game win probability for user (0–1)
     * @returns {number} 0–1 win probability for user
     */
    static _calcLiveWinProb(margin, elapsedSeconds, userIsHome, preGameProb) {
        const TOTAL = 2880;
        const timeRemaining = Math.max(1, TOTAL - elapsedSeconds);
        const timeRemainingFrac = timeRemaining / TOTAL;

        // Convert margin to user's perspective
        const userMargin = userIsHome ? margin : -margin;

        // Convert preGameProb to logit
        const preGameLogit = Math.log(Math.max(0.001, preGameProb) / Math.max(0.001, 1 - preGameProb));
        
        // Margin coefficient grows as time runs out
        const marginCoef = 0.035 * Math.sqrt(1 / timeRemainingFrac);
        
        // Pre-game advantage fades linearly
        const logit = (preGameLogit * timeRemainingFrac) + (marginCoef * userMargin);
        
        const prob = 1 / (1 + Math.exp(-logit));
        
        return Math.min(0.99, Math.max(0.01, prob));
    }
}
