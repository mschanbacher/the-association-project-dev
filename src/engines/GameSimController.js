// ═══════════════════════════════════════════════════════════════════════════════
// GameSimController.js — Game simulation, watch game, season end, playoffs
// ═══════════════════════════════════════════════════════════════════════════════

import { UIRenderer } from './UIRenderer.js';

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
                    const result = helpers.getSimulationController().simulateFullGame(home, away);
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
            userIsHome ? awayTeam : homeTeam
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
        } else {
            // [LEGACY DOM] document.getElementById('watchGameContent').innerHTML = layoutHtml;
            // [LEGACY DOM] document.getElementById('watchGameModal').classList.remove('hidden');
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
        const container = window._wgRefs?.plays || document.getElementById('wg-plays');
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

        const homeEl = refs?.homeScore || document.getElementById('wg-home-score');
        const awayEl = refs?.awayScore || document.getElementById('wg-away-score');
        if (homeEl) homeEl.textContent = state.homeScore;
        if (awayEl) awayEl.textContent = state.awayScore;

        const clockEl = refs?.clock || document.getElementById('wg-clock');
        if (clockEl) clockEl.textContent = state.clock.display;

        const qEl = refs?.quarterScores || document.getElementById('wg-quarter-scores');
        if (qEl && state.quarterScores) {
            const qs = state.quarterScores;
            let qText = '';
            for (let i = 0; i < qs.home.length; i++) {
                const label = i < 4 ? `Q${i+1}` : `OT${i-3}`;
                qText += `${label}: ${qs.away[i]}-${qs.home[i]}  `;
            }
            qEl.textContent = qText.trim();
        }

        const mEl = refs?.momentum || document.getElementById('wg-momentum');
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

        const leadersEl = refs?.leaders || document.getElementById('wg-leaders');
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

        if (window._wgRefs?.setGameOver) {
            window._wgRefs.setGameOver({
                won: userWon,
                color: userWon ? 'var(--color-win, #4ecdc4)' : 'var(--color-loss, #ff6b6b)',
                isOvertime: result.isOvertime,
                awayScore: result.awayScore,
                homeScore: result.homeScore,
            });
        } else {
 const text = `<span style="color: ${userWon ? '#4ecdc4' : '#ff6b6b'};">${userWon ? 'VICTORY' : 'DEFEAT'}</span> — FINAL${result.isOvertime ? ' (OT)' : ''}: ${result.awayScore} - ${result.homeScore}`;
            const finalEl = document.getElementById('wg-final-text');
            if (finalEl) finalEl.innerHTML = text;
            const goEl = document.getElementById('wg-gameover');
            if (goEl) goEl.style.display = 'block';
        }
    }

    watchGameSetSpeed(speed) {
        this._watchSpeed = speed;

        if (window._wgRefs?.setSpeed) {
            window._wgRefs.setSpeed(speed);
        } else {
            ['1', '3', '10', 'max'].forEach(s => {
                const btn = document.getElementById(`wg-speed-${s}`);
                if (btn) btn.style.background = 'rgba(255,255,255,0.1)';
            });
            const key = speed === 999 ? 'max' : String(speed);
            const activeBtn = document.getElementById(`wg-speed-${key}`);
            if (activeBtn) activeBtn.style.background = 'rgba(102,126,234,0.6)';
        }

        if (!this._watchPaused && this._watchGame && !this._watchGame.isComplete) {
            this._startWatchTimer();
        }
    }

    watchGameTogglePause() {
        this._watchPaused = !this._watchPaused;

        if (window._wgRefs?.setPaused) {
            window._wgRefs.setPaused(this._watchPaused);
        } else {
            const btn = document.getElementById('wg-pause');
            if (btn) {
                btn.textContent = this._watchPaused ? '▶ Play' : '⏸ Pause';
                btn.style.background = this._watchPaused ? 'rgba(78,205,196,0.3)' : 'rgba(255,255,255,0.1)';
            }
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
        // [LEGACY DOM] document.getElementById('watchGameModal').classList.add('hidden');
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
        // [LEGACY DOM] document.getElementById('bracketViewerContent').innerHTML = html;
        // [LEGACY DOM] document.getElementById('bracketViewerModal').classList.remove('hidden');
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

        if (window._reactShowChampionship) {
            window._reactShowChampionship({
                mode: 'series',
                higherSeed: pw.higherSeed,
                lowerSeed: pw.lowerSeed,
                higherWins: pw.higherWins,
                lowerWins: pw.lowerWins,
                bestOf: pw.bestOf,
                nextGameNum: pw.gameNum + 1,
                games: pw.games,
                userTeamId: userTeam.id,
                isHigherHome: pw.homePattern[pw.gameNum],
            });
            return;
        }

        // Legacy fallback
        // [LEGACY REMOVED] const html = UIRenderer.playoffSeriesWatchPage({
            // higherSeed: pw.higherSeed, lowerSeed: pw.lowerSeed,
            // higherWins: pw.higherWins, lowerWins: pw.lowerWins,
            // bestOf: pw.bestOf, nextGameNum: pw.gameNum + 1,
            // games: pw.games, userTeam, isHigherHome: pw.homePattern[pw.gameNum]
        // });
        // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML = html;
        // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.remove('hidden');
    }

    watchPlayoffGame() {
        const { gameState, helpers, engines } = this.ctx;
        const pw = this._playoffWatch;
        if (!pw) return;

        const { GamePipeline } = engines;
        const isHigherHome = pw.homePattern[pw.gameNum];
        const homeTeam = isHigherHome ? pw.higherSeed : pw.lowerSeed;
        const awayTeam = isHigherHome ? pw.lowerSeed : pw.higherSeed;

        // Hide the playoff modal while watching
        if (window._reactCloseChampionship) window._reactCloseChampionship();
        // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.add('hidden');

        this._watchHomeTeam = homeTeam;
        this._watchAwayTeam = awayTeam;
        this._watchHomeName = homeTeam.name;
        this._watchAwayName = awayTeam.name;
        this._watchDate = null; // No calendar date for playoffs
        this._isPlayoffWatch = true;

        this._watchGame = GamePipeline.create(homeTeam, awayTeam, {
            isPlayoffs: true,
            tier: gameState.currentTier
        });

        // [LEGACY REMOVED] const playoffLayoutHtml = UIRenderer.watchGameLayout({
            // homeName: this._watchHomeName, awayName: this._watchAwayName,
            // playoffContext: `Game ${pw.gameNum + 1} — Series ${pw.higherWins}-${pw.lowerWins}`
        // });
        if (window._reactShowWatchGame) {
            window._reactShowWatchGame({
                homeName: this._watchHomeName,
                awayName: this._watchAwayName,
                homeTeamFullName: this._watchHomeTeam?.name,
                awayTeamFullName: this._watchAwayTeam?.name,
                playoffContext: `Game ${pw.gameNum + 1} — Series ${pw.higherWins}-${pw.lowerWins}`,
            });
        } else {
            // [LEGACY DOM] document.getElementById('watchGameContent').innerHTML = playoffLayoutHtml;
            // [LEGACY DOM] document.getElementById('watchGameModal').classList.remove('hidden');
        }

        this._watchPaused = false;
        this._watchSpeed = 1;
        this.watchGameSetSpeed(1);
        this._startWatchTimer();
    }

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
        const mapStats = (stats) => (stats || [])
            .filter(p => p.minutesPlayed > 0)
            .sort((a, b) => b.minutesPlayed - a.minutesPlayed)
            .map(p => ({
                name: p.playerName || p.name || 'Unknown', pos: p.position || '',
                min: p.minutesPlayed || 0, pts: p.points || 0,
                reb: p.rebounds || 0, ast: p.assists || 0,
                stl: p.steals || 0, blk: p.blocks || 0, to: p.turnovers || 0,
                pf: p.fouls || 0, starter: p.gamesStarted > 0,
                fgm: p.fieldGoalsMade || 0, fga: p.fieldGoalsAttempted || 0,
                tpm: p.threePointersMade || 0, tpa: p.threePointersAttempted || 0,
                ftm: p.freeThrowsMade || 0, fta: p.freeThrowsAttempted || 0, pm: p.plusMinus || 0
            }));

        const boxScore = {
            home: { city: homeTeam.city || '', name: homeTeam.name, score: result.homeScore, players: mapStats(result.homePlayerStats) },
            away: { city: awayTeam.city || '', name: awayTeam.name, score: result.awayScore, players: mapStats(result.awayPlayerStats) },
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
        // [LEGACY DOM] document.getElementById('watchGameModal').classList.add('hidden');
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
        const mapStats = (stats) => (stats || [])
            .filter(p => p.minutesPlayed > 0)
            .sort((a, b) => b.minutesPlayed - a.minutesPlayed)
            .map(p => ({
                name: p.playerName || p.name || 'Unknown', pos: p.position || '',
                min: p.minutesPlayed || 0, pts: p.points || 0,
                reb: p.rebounds || 0, ast: p.assists || 0,
                stl: p.steals || 0, blk: p.blocks || 0, to: p.turnovers || 0,
                pf: p.fouls || 0, starter: p.gamesStarted > 0,
                fgm: p.fieldGoalsMade || 0, fga: p.fieldGoalsAttempted || 0,
                tpm: p.threePointersMade || 0, tpa: p.threePointersAttempted || 0,
                ftm: p.freeThrowsMade || 0, fta: p.freeThrowsAttempted || 0, pm: p.plusMinus || 0
            }));
        game.boxScore = {
            home: { city: this._watchHomeTeam.city || '', name: this._watchHomeTeam.name, score: result.homeScore, players: mapStats(result.homePlayerStats) },
            away: { city: this._watchAwayTeam.city || '', name: this._watchAwayTeam.name, score: result.awayScore, players: mapStats(result.awayPlayerStats) },
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
        
        // Update brackets if series complete
        this._updateBracketsAfterGames();
        this._updateUserSeriesForNextRound();
        
        // Close watch game modal
        if (window._reactCloseWatchGame) window._reactCloseWatchGame();
        
        // Clean up state
        this._watchGame = null;
        this._watchPlayoffGame = null;
        this._isPlayoffWatch = false;
        
        // Save and refresh PlayoffHub
        helpers.saveGameState();
        if (window._reactPlayoffHubRefresh) window._reactPlayoffHubRefresh();
        
        // Check if playoffs complete
        this._checkPlayoffsComplete();
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
                const mapStats = (stats) => (stats || [])
                    .filter(p => p.minutesPlayed > 0)
                    .sort((a, b) => b.minutesPlayed - a.minutesPlayed)
                    .map(p => ({
                        name: p.playerName || p.name || 'Unknown', pos: p.position || '',
                        min: p.minutesPlayed || 0, pts: p.points || 0,
                        reb: p.rebounds || 0, ast: p.assists || 0,
                        stl: p.steals || 0, blk: p.blocks || 0, to: p.turnovers || 0,
                        pf: p.fouls || 0, starter: p.gamesStarted > 0,
                        fgm: p.fieldGoalsMade || 0, fga: p.fieldGoalsAttempted || 0,
                        tpm: p.threePointersMade || 0, tpa: p.threePointersAttempted || 0,
                        ftm: p.freeThrowsMade || 0, fta: p.freeThrowsAttempted || 0, pm: p.plusMinus || 0
                    }));
                gameEntry.boxScore = {
                    home: { city: homeTeam.city || '', name: homeTeam.name, score: gameResult.homeScore, players: mapStats(gameResult.homePlayerStats) },
                    away: { city: awayTeam.city || '', name: awayTeam.name, score: gameResult.awayScore, players: mapStats(gameResult.awayPlayerStats) },
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
            const mapStats = (stats) => (stats || [])
                .filter(p => p.minutesPlayed > 0)
                .sort((a, b) => b.minutesPlayed - a.minutesPlayed)
                .map(p => ({
                    name: p.playerName || p.name || 'Unknown', pos: p.position || '',
                    min: p.minutesPlayed || 0, pts: p.points || 0,
                    reb: p.rebounds || 0, ast: p.assists || 0,
                    stl: p.steals || 0, blk: p.blocks || 0, to: p.turnovers || 0,
                    pf: p.fouls || 0, starter: p.gamesStarted > 0,
                    fgm: p.fieldGoalsMade || 0, fga: p.fieldGoalsAttempted || 0,
                    tpm: p.threePointersMade || 0, tpa: p.threePointersAttempted || 0,
                    ftm: p.freeThrowsMade || 0, fta: p.freeThrowsAttempted || 0, pm: p.plusMinus || 0
                }));
            gameEntry.boxScore = {
                home: { city: homeTeam.city || '', name: homeTeam.name, score: gameResult.homeScore, players: mapStats(gameResult.homePlayerStats) },
                away: { city: awayTeam.city || '', name: awayTeam.name, score: gameResult.awayScore, players: mapStats(gameResult.awayPlayerStats) },
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

        // Disable sim buttons (legacy DOM — may not exist when React UI is active)
        const simNextBtn = document.getElementById('simNextBtn');
        const simDayBtn = document.getElementById('simDayBtn');
        const simWeekBtn = document.getElementById('simWeekBtn');
        const finishBtn = document.getElementById('finishBtn');
        if (simNextBtn) simNextBtn.disabled = true;
        if (simDayBtn) simDayBtn.disabled = true;
        if (simWeekBtn) simWeekBtn.disabled = true;
        if (finishBtn) finishBtn.disabled = true;

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
        const el = document.getElementById('seasonEndModal');
        if (el) el.classList.add('hidden');
        // Keep sim buttons disabled - season is over (legacy DOM may not exist)
        const s = id => document.getElementById(id);
        if (s('simNextBtn')) s('simNextBtn').disabled = true;
        if (s('simDayBtn')) s('simDayBtn').disabled = true;
        if (s('simWeekBtn')) s('simWeekBtn').disabled = true;
        if (s('finishBtn')) s('finishBtn').disabled = false;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Promotion/Relegation Playoffs (startPlayoffs flow)
    // ═══════════════════════════════════════════════════════════════════

    startPlayoffs(type) {
        const { gameState, helpers } = this.ctx;
        console.log('🎮 startPlayoffs called with type:', type);
        // [LEGACY DOM] document.getElementById('seasonEndModal').classList.add('hidden');

        const teams = helpers.getCurrentTeams();
        const sortedTeams = helpers.sortTeamsByStandings(teams, gameState.schedule);

        let playoffTeams, isPromotion, isDivisionPlayoff = false;

        if (type === 'division-playoff') {
            const userTeam = teams.find(t => t.id === gameState.userTeamId);
            const divisionTeams = teams.filter(t => t.division === userTeam.division);
            const divisionSorted = helpers.sortTeamsByStandings(divisionTeams, gameState.schedule);
            playoffTeams = divisionSorted.slice(0, 4);
            isPromotion = false;
            isDivisionPlayoff = true;
        } else if (type === 'promotion-playoff') {
            playoffTeams = sortedTeams.slice(1, 4);
            isPromotion = true;
        } else {
            playoffTeams = sortedTeams.slice(-3);
            isPromotion = false;
        }

        const results = this.simulatePlayoffBracket(playoffTeams, isPromotion, isDivisionPlayoff);
        this.showPlayoffResults(results, isPromotion, isDivisionPlayoff);
    }

    simulatePlayoffBracket(teams, isPromotion, isDivisionPlayoff = false) {
        if (teams.length === 4) {
            const [seed1, seed2, seed3, seed4] = teams;
            const semi1Winner = this.simulatePlayoffGameSimple(seed1, seed4);
            const semi1Loser = semi1Winner.id === seed1.id ? seed4 : seed1;
            const semi2Winner = this.simulatePlayoffGameSimple(seed2, seed3);
            const semi2Loser = semi2Winner.id === seed2.id ? seed3 : seed2;
            const finalWinner = this.simulatePlayoffGameSimple(semi1Winner, semi2Winner);
            const finalLoser = finalWinner.id === semi1Winner.id ? semi2Winner : semi1Winner;
            return {
                semi1: { team1: seed1, team2: seed4, winner: semi1Winner, loser: semi1Loser },
                semi2: { team1: seed2, team2: seed3, winner: semi2Winner, loser: semi2Loser },
                final: { team1: semi1Winner, team2: semi2Winner, winner: finalWinner, loser: finalLoser },
                seed1, seed2, seed3, seed4, isFourTeam: true, isDivisionPlayoff
            };
        } else {
            const [seed1, seed2, seed3] = teams;
            const playInWinner = this.simulatePlayoffGameSimple(seed2, seed3);
            const playInLoser = playInWinner.id === seed2.id ? seed3 : seed2;
            const finalWinner = this.simulatePlayoffGameSimple(seed1, playInWinner);
            const finalLoser = finalWinner.id === seed1.id ? playInWinner : seed1;
            return {
                playIn: { team1: seed2, team2: seed3, winner: playInWinner, loser: playInLoser },
                final: { team1: seed1, team2: playInWinner, winner: finalWinner, loser: finalLoser },
                seed1, seed2, seed3, isFourTeam: false, isDivisionPlayoff: false
            };
        }
    }

    simulatePlayoffGameSimple(team1, team2) {
        const score1 = Math.round(team1.rating + (Math.random() - 0.5) * 20);
        const score2 = Math.round(team2.rating + (Math.random() - 0.5) * 20);
        return score1 > score2 ? team1 : team2;
    }

    showPlayoffResults(results, isPromotion, isDivisionPlayoff = false) {
        const { gameState, helpers } = this.ctx;
        const userTeam = helpers.getCurrentTeams().find(t => t.id === gameState.userTeamId);

        let userInvolved = false;
        if (results.isFourTeam) {
            userInvolved = [results.seed1, results.seed2, results.seed3, results.seed4].some(s => s.id === userTeam.id);
        } else {
            userInvolved = [results.seed1, results.seed2, results.seed3].some(s => s.id === userTeam.id);
        }

        let userResult;
        if (results.isFourTeam) {
            if (results.semi1.loser.id === userTeam.id || results.semi2.loser.id === userTeam.id) {
                userResult = isDivisionPlayoff ? 'eliminated-division' : 'eliminated-promotion';
            } else if (results.final.loser.id === userTeam.id) {
                userResult = isDivisionPlayoff ? 'runner-up-division' : (isPromotion ? 'promoted' : 'relegated');
            } else if (results.final.winner.id === userTeam.id) {
                userResult = isDivisionPlayoff ? 'division-champion' : (isPromotion ? 'promoted' : 'survived');
            }
        } else {
            if (results.playIn.loser.id === userTeam.id) {
                userResult = isPromotion ? 'eliminated-promotion' : 'relegated';
            } else if (results.final.loser.id === userTeam.id) {
                userResult = isPromotion ? 'promoted' : 'relegated';
            } else if (results.final.winner.id === userTeam.id) {
                userResult = isPromotion ? 'promoted' : 'survived';
            }
        }

        const resultMessages = {
 'promoted': { text: 'PROMOTED TO TIER 1!', color: '#34a853' },
 'survived': { text: 'SURVIVED - STAYING IN TIER 1', color: '#34a853' },
 'relegated': { text: 'RELEGATED TO TIER 2', color: '#ea4335' },
            'eliminated-promotion': { text: 'Eliminated - Staying in Tier 2', color: '#667eea' },
 'division-champion': { text: 'DIVISION CHAMPION!', color: '#ffa500' },
 'runner-up-division': { text: 'Division Runner-Up', color: '#c0c0c0' },
            'eliminated-division': { text: 'Eliminated from Division Playoffs', color: '#667eea' }
        };

        const msg = resultMessages[userResult];

        if (window._reactShowPlayoff) {
            window._reactShowPlayoff({
                results, isPromotion, isDivisionPlayoff, msg, userResult, userInvolved
            });
            return;
        }

        // [LEGACY REMOVED] document.getElementById('playoffContent').innerHTML = UIRenderer.playoffResults({
            // results, isPromotion, isDivisionPlayoff, msg, userResult, userInvolved
        // });
        // [LEGACY DOM] document.getElementById('playoffModal').classList.remove('hidden');
    }

    viewPromRelPlayoffResults() {
        const { results, isPromotion, isDivisionPlayoff } = window.currentPromRelResults;
 const playoffTitle = isDivisionPlayoff ? 'Division Playoffs' :
 (isPromotion ? 'Promotion Playoffs' : 'Relegation Playoffs');
        if (window._reactShowPlayoff) {
            window._reactShowPlayoff({
                results, isPromotion, isDivisionPlayoff,
                msg: null, userResult: 'not-involved', userInvolved: false
            });
            return;
        }
        // [LEGACY REMOVED] document.getElementById('playoffContent').innerHTML = UIRenderer.promRelPlayoffResults({
            // results, isPromotion, isDivisionPlayoff, playoffTitle
        // });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Tier 1 Championship Playoffs (4-round NBA-style)
    // ═══════════════════════════════════════════════════════════════════

    runTier1ChampionshipPlayoffs() {
        const { gameState, helpers } = this.ctx;
        console.log('🏆 Starting Tier 1 Championship Playoffs...');

        const tier1Sorted = helpers.sortTeamsByStandings(gameState.tier1Teams, gameState.tier1Schedule);

        const eastTeams = tier1Sorted.filter(t =>
            t.division === 'Atlantic' || t.division === 'Central' || t.division === 'Southeast'
        );
        const westTeams = tier1Sorted.filter(t =>
            t.division === 'Northwest' || t.division === 'Pacific' || t.division === 'Southwest'
        );

        const eastPlayoffTeams = eastTeams.slice(0, 8);
        const westPlayoffTeams = westTeams.slice(0, 8);

        console.log('East playoff teams:', eastPlayoffTeams.map(t => t.name));
        console.log('West playoff teams:', westPlayoffTeams.map(t => t.name));

        const userTeam = helpers.getUserTeam();
        const userInPlayoffs = [...eastPlayoffTeams, ...westPlayoffTeams].some(t => t.id === userTeam.id);

        if (!userInPlayoffs) {
            console.log('User team did not make championship playoffs');
            gameState.championshipPlayoffData = {
                eastTeams: eastPlayoffTeams, westTeams: westPlayoffTeams,
                currentRound: 1, roundResults: [], userInvolved: false
            };
            if (window._reactShowChampionship) {
                window._reactShowChampionship({ mode: 'missed' });
                return;
            }
            // [LEGACY REMOVED] document.getElementById('championshipPlayoffContent').innerHTML = UIRenderer.championshipPlayoffMissed();
            // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.remove('hidden');
            return;
        }

        gameState.championshipPlayoffData = {
            eastTeams: eastPlayoffTeams, westTeams: westPlayoffTeams,
            currentRound: 1, roundResults: [], userInvolved: true
        };
        this.simulateChampionshipRound(1);
    }

    /**
     * Initialize championship bracket data for the PlayoffHub without triggering
     * any UI. Called by OffseasonController before showing the hub so that
     * simAllChampionshipRounds / startPlayoffSeriesWatch have data to work with.
     * Safe to call multiple times — skips if already initialized this round.
     * @param {string} action - 'championship' | 't2-championship' | 't3-championship' | 'stay'
     */
    initBracketForHub(action) {
        const { gameState, helpers } = this.ctx;

        if (action === 'championship') {
            // Skip if already initialized (e.g. save/resume)
            if (gameState.championshipPlayoffData?.eastTeams?.length) return;

            const tier1Sorted = helpers.sortTeamsByStandings(gameState.tier1Teams, gameState.tier1Schedule);
            const eastTeams = tier1Sorted.filter(t =>
                t.division === 'Atlantic' || t.division === 'Central' || t.division === 'Southeast'
            ).slice(0, 8);
            const westTeams = tier1Sorted.filter(t =>
                t.division === 'Northwest' || t.division === 'Pacific' || t.division === 'Southwest'
            ).slice(0, 8);
            const userTeam = helpers.getUserTeam();
            const userInvolved = [...eastTeams, ...westTeams].some(t => t.id === userTeam.id);

            gameState.championshipPlayoffData = {
                eastTeams, westTeams,
                currentRound: 1, roundResults: [],
                userInvolved,
            };

            if (userInvolved) {
                // Pre-sim all non-user R1 series so bracket shows live scores
                this._initChampionshipRound1NonUserSeries();
            }

        } else if (action === 't2-championship') {
            if (gameState.t2PlayoffData?.userDivBracket) {
                // Already initialized — if _playoffWatch is null, restart the series watch
                if (!this._playoffWatch) {
                    this._startT2HubSeriesWatch();
                }
                return;
            }
            const userTeam = helpers.getUserTeam();
            const t2Bracket = gameState.postseasonResults?.t2;
            if (!t2Bracket) return;
            const userDivBracket = t2Bracket.divisionBrackets?.find(db =>
                db.teams?.some(t => t.id === userTeam.id)
            );
            if (!userDivBracket) return;
            gameState.t2PlayoffData = {
                userDivBracket,
                userDivision: userDivBracket.division,
                stage: 'division-semis',
                userTeamId: userTeam.id,
                interactiveResults: { divSemi1: null, divSemi2: null, divFinal: null, nationalRounds: [] }
            };
            // Start the interactive series watch so sidebar shows Game/Watch/Series controls
            this._startT2HubSeriesWatch();

        } else if (action === 't3-championship') {
            if (gameState.t3PlayoffData?.userBracket) return;
            // T3 bracket init is handled by runTier3MetroPlayoffs — just set a placeholder
            // so the hub can render; user will trigger full init via "Game" button
            if (!gameState.t3PlayoffData) {
                gameState.t3PlayoffData = { stage: 'metro', userTeamId: helpers.getUserTeam()?.id };
            }
        }
        // 'stay' = user missed playoffs, nothing to initialize
    }

    /**
     * Start the interactive series watch for T2 hub mode.
     * Mirrors _showT2DivisionSemis but without opening any modal overlay.
     * Hub sidebar reads _playoffWatch reactively for Game/Watch/Series controls.
     */
    _startT2HubSeriesWatch() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t2PlayoffData;
        if (!pd?.userDivBracket) return;

        const db = pd.userDivBracket;
        const userTeam = helpers.getUserTeam();

        const userInSemi1 = (db.seed1?.id === userTeam.id || db.seed4?.id === userTeam.id);
        const userInSemi2 = (db.seed2?.id === userTeam.id || db.seed3?.id === userTeam.id);

        if (userInSemi1) {
            if (!pd.interactiveResults.divSemi2)
                pd.interactiveResults.divSemi2 = helpers.simulatePlayoffSeries(db.seed2, db.seed3, 3);
            this.startPlayoffSeriesWatch(db.seed1, db.seed4, 3, (result) => {
                pd.interactiveResults.divSemi1 = result;
                pd.stage = 'division-semis-done';
                this._advanceT2HubAfterSemi();
            });
        } else if (userInSemi2) {
            if (!pd.interactiveResults.divSemi1)
                pd.interactiveResults.divSemi1 = helpers.simulatePlayoffSeries(db.seed1, db.seed4, 3);
            this.startPlayoffSeriesWatch(db.seed2, db.seed3, 3, (result) => {
                pd.interactiveResults.divSemi2 = result;
                pd.stage = 'division-semis-done';
                this._advanceT2HubAfterSemi();
            });
        } else {
            if (!pd.interactiveResults.divSemi1)
                pd.interactiveResults.divSemi1 = helpers.simulatePlayoffSeries(db.seed1, db.seed4, 3);
            if (!pd.interactiveResults.divSemi2)
                pd.interactiveResults.divSemi2 = helpers.simulatePlayoffSeries(db.seed2, db.seed3, 3);
            pd.stage = 'division-semis-done';
            this._advanceT2HubAfterSemi();
        }
    }

    _advanceT2HubAfterSemi() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t2PlayoffData;
        const userTeam = helpers.getUserTeam();
        const semi1 = pd.interactiveResults.divSemi1;
        const semi2 = pd.interactiveResults.divSemi2;
        if (!semi1 || !semi2) return;

        const userEliminated = (semi1.loser?.id === userTeam.id || semi2.loser?.id === userTeam.id);
        if (userEliminated) {
            pd.stage = 'eliminated';
            window._reactPlayoffHubRefresh?.();
            return;
        }

        pd.stage = 'division-final';
        const higher = semi1.winner;
        const lower = semi2.winner;
        const userInFinal = (higher?.id === userTeam.id || lower?.id === userTeam.id);

        if (userInFinal) {
            this.startPlayoffSeriesWatch(higher, lower, 3, (result) => {
                pd.interactiveResults.divFinal = result;
                pd.stage = 'division-final-done';
                this._advanceT2HubAfterFinal();
            });
        } else {
            pd.interactiveResults.divFinal = helpers.simulatePlayoffSeries(higher, lower, 3);
            pd.stage = 'division-final-done';
            this._advanceT2HubAfterFinal();
        }
    }

    _advanceT2HubAfterFinal() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t2PlayoffData;
        const userTeam = helpers.getUserTeam();
        const divFinal = pd.interactiveResults.divFinal;

        if (divFinal.loser?.id === userTeam.id) {
            pd.stage = 'eliminated';
            window._reactPlayoffHubRefresh?.();
            return;
        }

        pd.stage = 'national';
        window._reactPlayoffHubRefresh?.();
    }

    /**
     * Pre-sim all non-user Round 1 series so the bracket shows partial results
     * when the hub opens. User's own series stays at 0-0 ready to play.
     * @private
     */
    _initChampionshipRound1NonUserSeries() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.championshipPlayoffData;
        const userTeam = helpers.getUserTeam();

        const r1East = [
            { higher: pd.eastTeams[0], lower: pd.eastTeams[7], conf: 'East' },
            { higher: pd.eastTeams[1], lower: pd.eastTeams[6], conf: 'East' },
            { higher: pd.eastTeams[2], lower: pd.eastTeams[5], conf: 'East' },
            { higher: pd.eastTeams[3], lower: pd.eastTeams[4], conf: 'East' },
        ];
        const r1West = [
            { higher: pd.westTeams[0], lower: pd.westTeams[7], conf: 'West' },
            { higher: pd.westTeams[1], lower: pd.westTeams[6], conf: 'West' },
            { higher: pd.westTeams[2], lower: pd.westTeams[5], conf: 'West' },
            { higher: pd.westTeams[3], lower: pd.westTeams[4], conf: 'West' },
        ];
        const allSeries = [...r1East, ...r1West];

        // Pre-sim non-user series, leave user's slot as null placeholder
        const roundResults = allSeries.map(m => {
            const isUserSeries = m.higher.id === userTeam.id || m.lower.id === userTeam.id;
            if (isUserSeries) return null; // user plays this interactively
            const result = helpers.simulatePlayoffSeries(m.higher, m.lower, 5);
            return { conf: m.conf, result };
        });

        // Store as pending round so simulateChampionshipRound can pick up from here
        pd._pendingRound = 1;
        pd._pendingRoundName = 'First Round';
        pd._pendingBestOf = 5;
        pd._pendingRoundResults = roundResults;

        // Start the user's series watch state
        const userMatchup = allSeries.find(m =>
            m.higher.id === userTeam.id || m.lower.id === userTeam.id
        );
        if (userMatchup) {
            this.startPlayoffSeriesWatch(
                userMatchup.higher, userMatchup.lower, 5,
                (result) => {
                    pd._pendingRoundResults[allSeries.indexOf(userMatchup)] = {
                        conf: userMatchup.conf, result
                    };
                    this._showChampionshipRoundAfterWatch();
                }
            );
        }
    }

    simAllChampionshipRounds() {
        const { gameState, helpers } = this.ctx;
        console.log('⏩ Simulating all championship rounds...');

        // Guard: ensure bracket is initialized before simming
        if (!gameState.championshipPlayoffData) {
            console.warn('⚠️ simAllChampionshipRounds: championshipPlayoffData not initialized, initializing now');
            this.initBracketForHub('championship');
            if (!gameState.championshipPlayoffData) {
                console.error('❌ simAllChampionshipRounds: failed to initialize bracket data');
                return;
            }
        }

        const pd = gameState.championshipPlayoffData;

        // If R1 was partially initialized by initBracketForHub (user's series in progress),
        // sim the user's series too before running all rounds
        if (pd._pendingRound === 1 && pd._pendingRoundResults) {
            const pw = this._playoffWatch;
            if (pw) {
                // Auto-finish user's series
                while (pw.higherWins < pw.gamesToWin && pw.lowerWins < pw.gamesToWin) {
                    const isHigherHome = pw.homePattern[pw.gameNum];
                    const homeTeam = isHigherHome ? pw.higherSeed : pw.lowerSeed;
                    const awayTeam = isHigherHome ? pw.lowerSeed : pw.higherSeed;
                    const gameResult = helpers.getSimulationController().simulatePlayoffGame(homeTeam, awayTeam);
                    if (gameResult.winner.id === pw.higherSeed.id) pw.higherWins++;
                    else pw.lowerWins++;
                    pw.games.push({ gameNumber: pw.gameNum + 1, homeTeam, awayTeam, homeScore: gameResult.homeScore, awayScore: gameResult.awayScore, winner: gameResult.winner });
                    pw.gameNum++;
                }
                const userSeriesIdx = pd._pendingRoundResults.findIndex(r => r === null);
                if (userSeriesIdx >= 0) {
                    const winner = pw.higherWins >= pw.gamesToWin ? pw.higherSeed : pw.lowerSeed;
                    const loser = pw.higherWins >= pw.gamesToWin ? pw.lowerSeed : pw.higherSeed;
                    const allSeries = [
                        ...[0,1,2,3].map(i => ({ conf: 'East' })),
                        ...[0,1,2,3].map(i => ({ conf: 'West' })),
                    ];
                    pd._pendingRoundResults[userSeriesIdx] = {
                        conf: userSeriesIdx < 4 ? 'East' : 'West',
                        result: { winner, loser, higherSeed: pw.higherSeed, lowerSeed: pw.lowerSeed, higherWins: pw.higherWins, lowerWins: pw.lowerWins, higherSeedWins: pw.higherWins, lowerSeedWins: pw.lowerWins, games: pw.games }
                    };
                }
                this._playoffWatch = null;
            }
            // Commit R1 results
            pd.roundResults.push(pd._pendingRoundResults.filter(Boolean));
            pd.currentRound = 1;
            pd._pendingRound = null;
            pd._pendingRoundResults = null;
        }

        // Now sim remaining rounds (2, 3, 4) silently
        const startRound = (pd.roundResults?.length || 0) + 1;
        for (let round = startRound; round <= 4; round++) {
            pd.currentRound = round;
            this.simulateChampionshipRound(round, true);
        }

        const finalRound = pd.roundResults[3];
        if (!finalRound?.[0]) {
            console.error('❌ simAllChampionshipRounds: finals data missing');
            return;
        }
        const champion = finalRound[0].result.winner;
        helpers.applyChampionshipBonus(champion);
        if (window._reactShowChampionship) {
            window._reactShowChampionship({ mode: 'complete', championName: champion.name });
            return;
        }
        // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML =
            // [LEGACY REMOVED] UIRenderer.championshipCompleteQuick({ championName: champion.name });
    }

    skipChampionshipPlayoffs() {
        const { gameState, helpers } = this.ctx;
        if (window._reactShowChampionship) {
            window._reactCloseChampionship?.();
        }
        if (window._reactCloseChampionship) window._reactCloseChampionship();
        // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.add('hidden');
        // Update T1 champion from interactive results if available
        const playoffData = gameState.championshipPlayoffData;
        if (playoffData && playoffData.roundResults && playoffData.roundResults[3]) {
            const finalRound = playoffData.roundResults[3];
            if (finalRound[0] && gameState.postseasonResults && gameState.postseasonResults.t1) {
                gameState.postseasonResults.t1.champion = finalRound[0].result.winner;
            }
        }
        console.log('⬆️⬇️ Routing through continueAfterPostseason for proper history/promo-releg...');
        const offseasonCtrl = helpers.getOffseasonController ? helpers.getOffseasonController() : null;
        if (offseasonCtrl) {
            offseasonCtrl.continueAfterPostseason();
        } else {
            helpers.executePromotionRelegationFromResults();
            helpers.proceedToDraftOrDevelopment();
        }
    }

    simulateChampionshipRound(roundNumber, silent = false) {
        const { gameState, helpers } = this.ctx;
        const playoffData = gameState.championshipPlayoffData;
        let series = [];
        let roundName = '';
        let bestOf = 5;

        if (roundNumber === 1) {
            roundName = 'First Round';
            bestOf = 5;
            const eastR1 = [
                { higher: playoffData.eastTeams[0], lower: playoffData.eastTeams[7], conf: 'East' },
                { higher: playoffData.eastTeams[1], lower: playoffData.eastTeams[6], conf: 'East' },
                { higher: playoffData.eastTeams[2], lower: playoffData.eastTeams[5], conf: 'East' },
                { higher: playoffData.eastTeams[3], lower: playoffData.eastTeams[4], conf: 'East' }
            ];
            const westR1 = [
                { higher: playoffData.westTeams[0], lower: playoffData.westTeams[7], conf: 'West' },
                { higher: playoffData.westTeams[1], lower: playoffData.westTeams[6], conf: 'West' },
                { higher: playoffData.westTeams[2], lower: playoffData.westTeams[5], conf: 'West' },
                { higher: playoffData.westTeams[3], lower: playoffData.westTeams[4], conf: 'West' }
            ];
            series = [...eastR1, ...westR1];
        } else if (roundNumber === 2) {
            roundName = 'Conference Semifinals';
            bestOf = 5;
            const prevRound = playoffData.roundResults[0];
            const eastWinners = prevRound.filter(s => s.conf === 'East').map(s => s.result.winner);
            const westWinners = prevRound.filter(s => s.conf === 'West').map(s => s.result.winner);
            eastWinners.sort((a, b) => playoffData.eastTeams.findIndex(t => t.id === a.id) - playoffData.eastTeams.findIndex(t => t.id === b.id));
            westWinners.sort((a, b) => playoffData.westTeams.findIndex(t => t.id === a.id) - playoffData.westTeams.findIndex(t => t.id === b.id));
            series = [
                { higher: eastWinners[0], lower: eastWinners[3], conf: 'East' },
                { higher: eastWinners[1], lower: eastWinners[2], conf: 'East' },
                { higher: westWinners[0], lower: westWinners[3], conf: 'West' },
                { higher: westWinners[1], lower: westWinners[2], conf: 'West' }
            ];
        } else if (roundNumber === 3) {
            roundName = 'Conference Finals';
            bestOf = 5;
            const prevRound = playoffData.roundResults[1];
            const eastWinners = prevRound.filter(s => s.conf === 'East').map(s => s.result.winner);
            const westWinners = prevRound.filter(s => s.conf === 'West').map(s => s.result.winner);
            eastWinners.sort((a, b) => playoffData.eastTeams.findIndex(t => t.id === a.id) - playoffData.eastTeams.findIndex(t => t.id === b.id));
            westWinners.sort((a, b) => playoffData.westTeams.findIndex(t => t.id === a.id) - playoffData.westTeams.findIndex(t => t.id === b.id));
            series = [
                { higher: eastWinners[0], lower: eastWinners[1], conf: 'East' },
                { higher: westWinners[0], lower: westWinners[1], conf: 'West' }
            ];
        } else if (roundNumber === 4) {
            roundName = 'NBA Finals';
            bestOf = 7;
            const prevRound = playoffData.roundResults[2];
            const eastChamp = prevRound.find(s => s.conf === 'East').result.winner;
            const westChamp = prevRound.find(s => s.conf === 'West').result.winner;
            const eastSeed = playoffData.eastTeams.findIndex(t => t.id === eastChamp.id);
            const westSeed = playoffData.westTeams.findIndex(t => t.id === westChamp.id);
            const higher = eastSeed < westSeed ? eastChamp : westChamp;
            const lower = eastSeed < westSeed ? westChamp : eastChamp;
            series = [{ higher, lower, conf: 'Finals' }];
        }

        // In silent mode (simAllChampionshipRounds), auto-sim everything
        if (silent) {
            const roundResults = series.map(matchup => {
                const result = helpers.simulatePlayoffSeries(matchup.higher, matchup.lower, bestOf);
                return { conf: matchup.conf, result };
            });
            playoffData.roundResults.push(roundResults);
            playoffData.currentRound = roundNumber;
            return;
        }

        // Interactive mode: find user's series, watch it, auto-sim the rest
        const userTeam = helpers.getUserTeam();
        const userMatchupIdx = series.findIndex(m =>
            m.higher.id === userTeam.id || m.lower.id === userTeam.id
        );

        // Store round context for callback
        playoffData._pendingRound = roundNumber;
        playoffData._pendingRoundName = roundName;
        playoffData._pendingBestOf = bestOf;

        // Auto-sim non-user series
        const roundResults = series.map((matchup, i) => {
            if (i === userMatchupIdx) return null; // placeholder
            const result = helpers.simulatePlayoffSeries(matchup.higher, matchup.lower, bestOf);
            return { conf: matchup.conf, result };
        });
        playoffData._pendingRoundResults = roundResults;

        if (userMatchupIdx >= 0) {
            const m = series[userMatchupIdx];
            this.startPlayoffSeriesWatch(m.higher, m.lower, bestOf, (result) => {
                playoffData._pendingRoundResults[userMatchupIdx] = { conf: series[userMatchupIdx].conf, result };
                this._showChampionshipRoundAfterWatch();
            });
        } else {
            // User was eliminated in a prior round — show all results
            playoffData.roundResults.push(roundResults);
            playoffData.currentRound = roundNumber;
            this.showChampionshipRoundResults(roundNumber, roundName, roundResults);
        }
    }

    _showChampionshipRoundAfterWatch() {
        const { gameState, helpers } = this.ctx;
        const playoffData = gameState.championshipPlayoffData;
        const roundNumber = playoffData._pendingRound;
        const roundName = playoffData._pendingRoundName;
        const roundResults = playoffData._pendingRoundResults;

        playoffData.roundResults.push(roundResults);
        playoffData.currentRound = roundNumber;

        this.showChampionshipRoundResults(roundNumber, roundName, roundResults);
    }

    showChampionshipRoundResults(roundNumber, roundName, roundResults) {
        const { helpers } = this.ctx;
        console.log(`📺 Showing championship round ${roundNumber}: ${roundName}`);

        const userTeam = helpers.getUserTeam();
        const eastSeries = roundResults.filter(s => s.conf === 'East');
        const westSeries = roundResults.filter(s => s.conf === 'West');
        const finalsSeries = roundResults.filter(s => s.conf === 'Finals');

        if (finalsSeries.length > 0) {
            helpers.applyChampionshipBonus(finalsSeries[0].result.winner);
        }

        if (window._reactShowChampionship) {
            window._reactShowChampionship({
                mode: 'round', roundName, roundNumber,
                eastSeries, westSeries, finalsSeries,
                userTeamId: userTeam.id,
            });
            return;
        }
        // Legacy fallback
        // [LEGACY REMOVED] const html = UIRenderer.championshipRoundPage({
            // roundName, roundNumber, eastSeries, westSeries, finalsSeries,
            // userTeam, roundResults
        // });
        // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML = html;
        // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.remove('hidden');
    }

    continueAfterChampionshipRound() {
        const { gameState, helpers } = this.ctx;
        const playoffData = gameState.championshipPlayoffData;
        if (window._reactShowChampionship) {
            window._reactCloseChampionship?.();
        }
        if (window._reactCloseChampionship) window._reactCloseChampionship();
        // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.add('hidden');

        if (!playoffData) {
            console.warn('⚠️ continueAfterChampionshipRound: no playoffData, routing to postseason continuation');
            const offseasonCtrl = helpers.getOffseasonController?.();
            if (offseasonCtrl) offseasonCtrl.continueAfterPostseason();
            return;
        }

        if (playoffData.currentRound < 4) {
            this.simulateChampionshipRound(playoffData.currentRound + 1);
        } else {
            console.log('🏆 Championship playoffs complete!');
            // Update T1 champion in postseasonResults from the interactive results
            const finalRound = playoffData.roundResults[3];
            if (finalRound && finalRound[0] && gameState.postseasonResults?.t1) {
                gameState.postseasonResults.t1.champion = finalRound[0].result.winner;
            }
            // Route through the standard postseason continuation (handles history snapshot, promo/releg, tier changes)
            const offseasonCtrl = helpers.getOffseasonController
                ? helpers.getOffseasonController()
                : null;
            if (offseasonCtrl) {
                offseasonCtrl.continueAfterPostseason();
            } else {
                // Fallback: direct execution
                helpers.executePromotionRelegationFromResults();
                helpers.proceedToDraftOrDevelopment();
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Tier 2 Division Playoffs + National Tournament
    // ═══════════════════════════════════════════════════════════════════

    runTier2DivisionPlayoffs() {
        const { gameState, helpers } = this.ctx;
        console.log('🏆 Starting Tier 2 Division Playoffs...');

        const userTeam = helpers.getUserTeam();
        const postseason = gameState.postseasonResults;
        const t2Bracket = postseason.t2;

        // Find user's division bracket
        const userDivBracket = t2Bracket.divisionBrackets.find(db =>
            db.teams.some(t => t.id === userTeam.id)
        );

        if (!userDivBracket) {
            console.warn('User team not found in any division bracket');
            this._showT2PostseasonSummary();
            return;
        }

        // Store T2 playoff state
        gameState.t2PlayoffData = {
            userDivBracket,
            userDivision: userDivBracket.division,
            stage: 'division-semis', // division-semis → division-final → national
            userTeamId: userTeam.id,
            interactiveResults: {
                divSemi1: null,
                divSemi2: null,
                divFinal: null,
                // National tournament results will be re-simulated interactively
                nationalRounds: []
            }
        };

        // Show division semifinals
        this._showT2DivisionSemis();
    }

    _showT2DivisionSemis() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t2PlayoffData;
        const db = pd.userDivBracket;
        const userTeam = helpers.getUserTeam();

        // Determine which semi the user is in
        const userInSemi1 = (db.seed1.id === userTeam.id || db.seed4.id === userTeam.id);
        const userInSemi2 = (db.seed2.id === userTeam.id || db.seed3.id === userTeam.id);

        // Auto-sim the non-user semi immediately
        if (userInSemi1) {
            pd.interactiveResults.divSemi2 = helpers.simulatePlayoffSeries(db.seed2, db.seed3, 3);
            // Launch watch for user's semi
            this.startPlayoffSeriesWatch(db.seed1, db.seed4, 3, (result) => {
                pd.interactiveResults.divSemi1 = result;
                this._showT2DivisionSemisResults();
            });
        } else if (userInSemi2) {
            pd.interactiveResults.divSemi1 = helpers.simulatePlayoffSeries(db.seed1, db.seed4, 3);
            this.startPlayoffSeriesWatch(db.seed2, db.seed3, 3, (result) => {
                pd.interactiveResults.divSemi2 = result;
                this._showT2DivisionSemisResults();
            });
        } else {
            // User not in either semi (shouldn't happen but handle gracefully)
            pd.interactiveResults.divSemi1 = helpers.simulatePlayoffSeries(db.seed1, db.seed4, 3);
            pd.interactiveResults.divSemi2 = helpers.simulatePlayoffSeries(db.seed2, db.seed3, 3);
            this._showT2DivisionSemisResults();
        }
    }

    _showT2DivisionSemisResults() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t2PlayoffData;
        const userTeam = helpers.getUserTeam();

        if (window._reactShowChampionship) {
            window._reactShowChampionship({
                mode: 't2-div-semis',
                division: pd.userDivBracket.division,
                semi1: pd.interactiveResults.divSemi1,
                semi2: pd.interactiveResults.divSemi2,
                userTeam,
            });
            return;
        }
        // [LEGACY REMOVED] const html = UIRenderer.t2DivisionSemisPage({
            // division: pd.userDivBracket.division,
            // semi1: pd.interactiveResults.divSemi1,
            // semi2: pd.interactiveResults.divSemi2,
            // userTeam,
            // formatSeriesResult: (sr, ut) => {
                // const isUser = sr.higherSeed.id === ut.id || sr.lowerSeed.id === ut.id;
                // const key = sr === pd.interactiveResults.divSemi1 ? 't2-div-divSemi1' : 't2-div-divSemi2';
                // [LEGACY REMOVED] return UIRenderer.seriesResultCard({ seriesResult: sr, isUserInvolved: isUser, isFinals: false, seriesKey: isUser ? key : undefined });
            // }
        // });
        // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML = html;
        // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.remove('hidden');
    }

    continueT2AfterDivisionSemis() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t2PlayoffData;
        const semi1 = pd.interactiveResults.divSemi1;
        const semi2 = pd.interactiveResults.divSemi2;

        // Check if user was eliminated
        const userTeam = helpers.getUserTeam();
        const userEliminated = (semi1.loser.id === userTeam.id || semi2.loser.id === userTeam.id);

        if (userEliminated) {
            this._showT2EliminationAndSummary('division semifinals');
            return;
        }

        // Division final — check if user is in it
        pd.stage = 'division-final';
        const higher = semi1.winner;
        const lower = semi2.winner;
        const userInFinal = (higher.id === userTeam.id || lower.id === userTeam.id);

        if (userInFinal) {
            this.startPlayoffSeriesWatch(higher, lower, 3, (result) => {
                pd.interactiveResults.divFinal = result;
                this._showT2DivisionFinalResults();
            });
        } else {
            pd.interactiveResults.divFinal = helpers.simulatePlayoffSeries(higher, lower, 3);
            this._showT2DivisionFinalResults();
        }
    }

    _showT2DivisionFinalResults() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t2PlayoffData;
        const userTeam = helpers.getUserTeam();
        const divFinal = pd.interactiveResults.divFinal;

        if (window._reactShowChampionship) {
            window._reactShowChampionship({
                mode: 't2-div-final',
                division: pd.userDivision,
                divFinal, userTeam,
            });
            return;
        }
        // [LEGACY REMOVED] const html = UIRenderer.t2DivisionFinalPage({
            // division: pd.userDivision,
            // divFinal, userTeam,
            // formatSeriesResult: (sr, ut) => {
                // const isUser = sr.higherSeed.id === ut.id || sr.lowerSeed.id === ut.id;
                // [LEGACY REMOVED] return UIRenderer.seriesResultCard({ seriesResult: sr, isUserInvolved: isUser, isFinals: true, seriesKey: isUser ? 't2-div-divFinal' : undefined });
            // }
        // });
        // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML = html;
        // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.remove('hidden');
    }

    continueT2AfterDivisionFinal() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t2PlayoffData;
        const userTeam = helpers.getUserTeam();
        const divFinal = pd.interactiveResults.divFinal;

        // User is either division champion or runner-up
        const isChampion = divFinal.winner.id === userTeam.id;

        // Check if user qualifies for national tournament
        // Champions always qualify. Runner-ups qualify if they're in top 5 runners-up by record.
        const postseason = gameState.postseasonResults;
        const t2Bracket = postseason.t2;

        // Get all runners-up sorted by record
        const allRunnersUp = t2Bracket.divisionBrackets
            .filter(db => db.runnerUp)
            .map(db => db.runnerUp)
            .sort((a, b) => (b.wins !== a.wins) ? b.wins - a.wins : b.pointDiff - a.pointDiff);
        const qualifyingRunnersUp = allRunnersUp.slice(0, 5);
        const userQualifiesAsRunnerUp = qualifyingRunnersUp.some(t => t.id === userTeam.id);

        if (!isChampion && !userQualifiesAsRunnerUp) {
            this._showT2EliminationAndSummary('division final (did not qualify for National Tournament)');
            return;
        }

        // User qualifies for national tournament — show the field and start rounds
        pd.stage = 'national';
        this._showT2NationalRound(1);
    }

    _showT2NationalRound(roundNumber) {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t2PlayoffData;
        const postseason = gameState.postseasonResults;
        const nat = postseason.t2.nationalBracket;
        const userTeam = helpers.getUserTeam();

        const sortByRecord = (a, b) => (b.wins !== a.wins) ? b.wins - a.wins : b.pointDiff - a.pointDiff;

        let seriesMatchups = [];
        let roundName = '';
        let bestOf = 5;

        if (roundNumber === 1) {
            roundName = 'National Tournament — Round of 16';
            const teams16 = nat.teams;
            for (let i = 0; i < 8; i++) {
                seriesMatchups.push({ higher: teams16[i], lower: teams16[15 - i] });
            }
        } else if (roundNumber === 2) {
            roundName = 'National Tournament — Quarterfinals';
            const prevWinners = pd.interactiveResults.nationalRounds[0].map(s => s.result.winner);
            prevWinners.sort(sortByRecord);
            for (let i = 0; i < 4; i++) {
                seriesMatchups.push({ higher: prevWinners[i], lower: prevWinners[7 - i] });
            }
        } else if (roundNumber === 3) {
            roundName = 'National Tournament — Semifinals';
            const prevWinners = pd.interactiveResults.nationalRounds[1].map(s => s.result.winner);
            prevWinners.sort(sortByRecord);
            seriesMatchups.push({ higher: prevWinners[0], lower: prevWinners[3] });
            seriesMatchups.push({ higher: prevWinners[1], lower: prevWinners[2] });
        } else if (roundNumber === 4) {
 roundName = 'NARBL Championship';
            bestOf = 5;
            const prevResults = pd.interactiveResults.nationalRounds[2];
            seriesMatchups.push({ higher: prevResults[0].result.winner, lower: prevResults[1].result.winner });
        }

        // Store current round context for callback
        pd._currentNationalRound = roundNumber;
        pd._currentNationalRoundName = roundName;
        pd._currentNationalBestOf = bestOf;

        // Find the user's series (if any)
        const userMatchupIdx = seriesMatchups.findIndex(m =>
            m.higher.id === userTeam.id || m.lower.id === userTeam.id
        );

        // Auto-sim all non-user series
        const roundResults = [];
        for (let i = 0; i < seriesMatchups.length; i++) {
            if (i === userMatchupIdx) {
                roundResults.push(null); // placeholder for user's series
            } else {
                roundResults.push({
                    result: helpers.simulatePlayoffSeries(seriesMatchups[i].higher, seriesMatchups[i].lower, bestOf)
                });
            }
        }
        pd._pendingNationalRoundResults = roundResults;

        if (userMatchupIdx >= 0) {
            // Launch watch for user's series
            const m = seriesMatchups[userMatchupIdx];
            this.startPlayoffSeriesWatch(m.higher, m.lower, bestOf, (result) => {
                pd._pendingNationalRoundResults[userMatchupIdx] = { result };
                this._showT2NationalRoundResults();
            });
        } else {
            // User not in this round (already eliminated) — show all results
            pd.interactiveResults.nationalRounds.push(roundResults);
            this._showT2NationalRoundResults();
        }
    }

    _showT2NationalRoundResults() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t2PlayoffData;
        const postseason = gameState.postseasonResults;
        const userTeam = helpers.getUserTeam();

        const roundNumber = pd._currentNationalRound;
        const roundName = pd._currentNationalRoundName;
        const roundResults = pd._pendingNationalRoundResults;

        // Store completed round results if not already stored
        if (pd.interactiveResults.nationalRounds.length < roundNumber) {
            pd.interactiveResults.nationalRounds.push(roundResults);
        }

        // For the finals, handle championship bonus
        if (roundNumber === 4) {
            const champion = roundResults[0].result.winner;
            helpers.applyChampionshipBonus(champion);
            postseason.t2.champion = champion;
            postseason.t2.runnerUp = roundResults[0].result.loser;
        }

        if (window._reactShowChampionship) {
            window._reactShowChampionship({
                mode: 't2-national-result',
                roundName, roundNumber, roundResults, userTeam,
                isChampionshipRound: roundNumber === 4,
                champion: roundNumber === 4 ? roundResults[0].result.winner : null,
            });
            return;
        }
        const roundIdx = pd.interactiveResults.nationalRounds.length - 1;
        // [LEGACY REMOVED] const html = UIRenderer.t2NationalRoundPage({
            // roundName, roundNumber, roundResults, userTeam,
            // isChampionshipRound: roundNumber === 4,
            // champion: roundNumber === 4 ? roundResults[0].result.winner : null,
            // formatSeriesResult: (sr, ut, isF) => {
                // const isUser = sr.higherSeed.id === ut.id || sr.lowerSeed.id === ut.id;
                // const idx = roundResults.findIndex(r => r && r.result === sr);
                // const key = isUser && idx >= 0 ? `t2-nat-${roundIdx}-${idx}` : undefined;
                // [LEGACY REMOVED] return UIRenderer.seriesResultCard({ seriesResult: sr, isUserInvolved: isUser, isFinals: isF, seriesKey: key });
            // }
        // });
        // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML = html;
        // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.remove('hidden');
    }

    continueT2AfterNationalRound() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t2PlayoffData;
        const currentRound = pd.interactiveResults.nationalRounds.length;
        const userTeam = helpers.getUserTeam();

        // Check if user was eliminated in the last round
        const lastRound = pd.interactiveResults.nationalRounds[currentRound - 1];
        const userEliminated = lastRound.some(s => s.result.loser.id === userTeam.id);

        if (userEliminated && currentRound < 4) {
            this._showT2EliminationAndSummary(`National Tournament Round ${currentRound}`);
            return;
        }

        if (currentRound >= 4) {
            // Championship is done — continue to postseason wrap-up
            this._finishT2Playoffs();
            return;
        }

        // Advance to next national round
        this._showT2NationalRound(currentRound + 1);
    }

    simAllT2Rounds() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t2PlayoffData;
        const postseason = gameState.postseasonResults;

        // Copy background sim's national bracket rounds into interactive results
        // so the bracket viewer can display them
        if (postseason.t2?.nationalBracket?.rounds) {
            pd.interactiveResults.nationalRounds = postseason.t2.nationalBracket.rounds;
        }
        pd._pendingNationalRoundResults = null;

        if (window._reactShowChampionship) {
            window._reactShowChampionship({ mode: 't2-complete', champion: postseason.t2.champion });
            return;
        }
        // [LEGACY REMOVED] const t2CompleteHtml = UIRenderer.t2PlayoffCompleteQuick({ champion: postseason.t2.champion });
        // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML = t2CompleteHtml;
    }

    _showT2EliminationAndSummary(eliminatedIn) {
        const { gameState, helpers } = this.ctx;
        const postseason = gameState.postseasonResults;
        const userTeam = helpers.getUserTeam();

        if (window._reactShowChampionship) {
            window._reactShowChampionship({
                mode: 't2-elimination',
                userTeam,
                eliminatedIn,
                champion: postseason.t2.champion,
            });
            return;
        }
        // [LEGACY REMOVED] const html = UIRenderer.t2EliminationPage({
            // userTeam,
            // eliminatedIn,
            // champion: postseason.t2.champion
        // });
        // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML = html;
    }

    _finishT2Playoffs() {
        const { gameState, helpers } = this.ctx;
        if (window._reactCloseChampionship) window._reactCloseChampionship();
        // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.add('hidden');

        const offseasonCtrl = helpers.getOffseasonController ? helpers.getOffseasonController() : null;
        if (offseasonCtrl) {
            offseasonCtrl.continueAfterPostseason();
        } else {
            helpers.executePromotionRelegationFromResults();
            helpers.proceedToDraftOrDevelopment();
        }
    }

    skipT2Playoffs() {
        this._finishT2Playoffs();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Tier 3 Metro Playoffs + National Tournament (6 stages)
    // ═══════════════════════════════════════════════════════════════════
    //
    // Stage 1: Metro Finals (Bo3) — #1 vs #2 in each of 24 metros
    // Stage 2: Regional Round (Bo3) — top 8 metro champs get byes, 9-24 play in
    // Stage 3: Sweet 16 (Bo5)
    // Stage 4: Quarterfinals (Bo5)
    // Stage 5: Semifinals (Bo5)
    // Stage 6: Championship (Bo5)

    runTier3MetroPlayoffs() {
        const { gameState, helpers } = this.ctx;
        console.log('🏆 Starting Tier 3 Metro Playoffs...');

        const userTeam = helpers.getUserTeam();
        const postseason = gameState.postseasonResults;
        const t3Bracket = postseason.t3;

        // Find user's metro matchup
        const userMetro = t3Bracket.metroMatchups.find(m =>
            m.seed1.id === userTeam.id || m.seed2.id === userTeam.id
        );

        if (!userMetro) {
            console.warn('User team not found in any metro matchup');
            this._showT3PostseasonSummary();
            return;
        }

        gameState.t3PlayoffData = {
            userMetroDivision: userMetro.division,
            stage: 'metro-final',
            userTeamId: userTeam.id,
            interactiveResults: {
                metroFinal: null,
                regionalRound: null,  // array of play-in results (or null if user had bye)
                userHadBye: false,
                sweet16: null,        // array of 8 series
                quarterfinals: null,  // array of 4 series
                semifinals: null,     // array of 2 series
                championship: null    // single series
            },
            // Track all metro champions + seedings for later rounds
            metroChampions: null,
            sweet16Teams: null
        };

        // Stage 1: Metro Final — watch user's, auto-sim the rest
        this._runT3MetroFinals();
    }

    _runT3MetroFinals() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t3PlayoffData;
        const t3Bracket = gameState.postseasonResults.t3;
        const userTeam = helpers.getUserTeam();

        // Find user's metro matchup
        const userMetro = t3Bracket.metroMatchups.find(m =>
            m.seed1.id === userTeam.id || m.seed2.id === userTeam.id
        );

        // Launch watch for user's metro final
        this.startPlayoffSeriesWatch(userMetro.seed1, userMetro.seed2, 3, (result) => {
            pd.interactiveResults.metroFinal = result;
            this._showT3MetroFinalResult();
        });
    }

    _showT3MetroFinalResult() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t3PlayoffData;
        const userTeam = helpers.getUserTeam();
        const result = pd.interactiveResults.metroFinal;

        const userWon = result.winner.id === userTeam.id;

        if (!userWon) {
            this._showT3EliminationAndSummary('Metro Finals');
            return;
        }

        // User won metro final — determine seeding among all metro champs
        // The background simulation already has all results, use those for seedings
        const t3Bracket = gameState.postseasonResults.t3;
        const sortByRecord = (a, b) => (b.wins !== a.wins) ? b.wins - a.wins : b.pointDiff - a.pointDiff;

        // Build metro champions list: use background results for all others, user's interactive result for theirs
        const metroChampions = t3Bracket.metroMatchups.map(m => {
            if (m.seed1.id === userTeam.id || m.seed2.id === userTeam.id) {
                return { division: m.division, team: result.winner };
            }
            // Use background result
            const bgChamp = t3Bracket.metroChampions.find(mc => mc.division === m.division);
            return bgChamp ? { division: bgChamp.division, team: bgChamp.team } : null;
        }).filter(Boolean);

        const champsSorted = [...metroChampions].sort((a, b) => sortByRecord(a.team, b.team));
        pd.metroChampions = champsSorted;

        const userSeed = champsSorted.findIndex(c => c.team.id === userTeam.id) + 1;
        pd.interactiveResults.userHadBye = userSeed <= 8;

        if (window._reactShowChampionship) {
            window._reactShowChampionship({
                mode: 't3-metro-result',
                result, userTeam, userSeed,
                hasBye: userSeed <= 8,
                totalMetroChamps: champsSorted.length,
            });
            return;
        }
        // [LEGACY REMOVED] const html = UIRenderer.t3MetroFinalResultPage({
            // result, userTeam, userSeed,
            // hasBye: userSeed <= 8,
            // totalMetroChamps: champsSorted.length,
            // [LEGACY REMOVED] formatSeriesResult: (sr) => UIRenderer.seriesResultCard({ seriesResult: sr, isUserInvolved: true, isFinals: true, seriesKey: 't3-metroFinal' })
        // });
        {
            // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML = html;
            // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.remove('hidden');
        }
    }

    continueT3AfterMetroFinal() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t3PlayoffData;

        if (pd.interactiveResults.userHadBye) {
            // Skip regional round, go straight to Sweet 16
            this._runT3RegionalRoundSimOnly();
            this._runT3NationalRound('sweet16');
        } else {
            // User plays in regional round
            pd.stage = 'regional';
            this._runT3RegionalRound();
        }
    }

    _runT3RegionalRound() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t3PlayoffData;
        const userTeam = helpers.getUserTeam();
        const sortByRecord = (a, b) => (b.wins !== a.wins) ? b.wins - a.wins : b.pointDiff - a.pointDiff;

        // Play-in teams are seeds 9-24
        const playInChamps = pd.metroChampions.slice(8);
        const playInMatchups = [];
        for (let i = 0; i < playInChamps.length / 2; i++) {
            playInMatchups.push({
                higher: playInChamps[i].team,
                lower: playInChamps[playInChamps.length - 1 - i].team
            });
        }

        // Find user's matchup
        const userIdx = playInMatchups.findIndex(m =>
            m.higher.id === userTeam.id || m.lower.id === userTeam.id
        );

        // Auto-sim non-user play-in games
        const playInResults = playInMatchups.map((m, i) => {
            if (i === userIdx) return null;
            return { result: helpers.simulatePlayoffSeries(m.higher, m.lower, 3) };
        });
        pd._pendingRegionalResults = playInResults;

        if (userIdx >= 0) {
            const m = playInMatchups[userIdx];
            this.startPlayoffSeriesWatch(m.higher, m.lower, 3, (result) => {
                pd._pendingRegionalResults[userIdx] = { result };
                this._showT3RegionalRoundResult();
            });
        } else {
            // Shouldn't happen if user is seed 9-24
            this._showT3RegionalRoundResult();
        }
    }

    _runT3RegionalRoundSimOnly() {
        // Auto-sim the entire regional round (user had bye)
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t3PlayoffData;
        const sortByRecord = (a, b) => (b.wins !== a.wins) ? b.wins - a.wins : b.pointDiff - a.pointDiff;

        const playInChamps = pd.metroChampions.slice(8);
        const playInResults = [];
        for (let i = 0; i < playInChamps.length / 2; i++) {
            const result = helpers.simulatePlayoffSeries(
                playInChamps[i].team,
                playInChamps[playInChamps.length - 1 - i].team,
                3
            );
            playInResults.push({ result });
        }
        pd.interactiveResults.regionalRound = playInResults;

        // Build Sweet 16 field
        const byeTeams = pd.metroChampions.slice(0, 8).map(c => c.team);
        const playInWinners = playInResults.map(r => r.result.winner);
        pd.sweet16Teams = [...byeTeams, ...playInWinners].sort(sortByRecord);
    }

    _showT3RegionalRoundResult() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t3PlayoffData;
        const userTeam = helpers.getUserTeam();
        const sortByRecord = (a, b) => (b.wins !== a.wins) ? b.wins - a.wins : b.pointDiff - a.pointDiff;

        pd.interactiveResults.regionalRound = pd._pendingRegionalResults;

        // Check if user was eliminated
        const userEliminated = pd._pendingRegionalResults.some(r =>
            r && r.result.loser.id === userTeam.id
        );

        if (userEliminated) {
            this._showT3EliminationAndSummary('Regional Round');
            return;
        }

        // Build Sweet 16 field
        const byeTeams = pd.metroChampions.slice(0, 8).map(c => c.team);
        const playInWinners = pd._pendingRegionalResults.map(r => r.result.winner);
        pd.sweet16Teams = [...byeTeams, ...playInWinners].sort(sortByRecord);

        const userSeed16 = pd.sweet16Teams.findIndex(t => t.id === userTeam.id) + 1;

        const userRegIdx = pd._pendingRegionalResults.findIndex(r =>
            r && (r.result.winner.id === userTeam.id || r.result.loser.id === userTeam.id)
        );

        if (window._reactShowChampionship) {
            window._reactShowChampionship({
                mode: 't3-regional-result',
                userTeam, userSeed16,
                userResult: userRegIdx >= 0 ? pd._pendingRegionalResults[userRegIdx].result : null,
            });
            return;
        }
        // [LEGACY REMOVED] const html = UIRenderer.t3RegionalRoundResultPage({
            // userTeam, userSeed16,
            // userResult: userRegIdx >= 0 ? pd._pendingRegionalResults[userRegIdx].result : null,
            // [LEGACY REMOVED] formatSeriesResult: (sr) => UIRenderer.seriesResultCard({ seriesResult: sr, isUserInvolved: true, isFinals: false, seriesKey: userRegIdx >= 0 ? `t3-regional-${userRegIdx}` : undefined })
        // });
        {
            // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML = html;
            // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.remove('hidden');
        }
    }

    continueT3AfterRegionalRound() {
        this._runT3NationalRound('sweet16');
    }

    _runT3NationalRound(stage) {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t3PlayoffData;
        const postseason = gameState.postseasonResults;
        const userTeam = helpers.getUserTeam();
        const sortByRecord = (a, b) => (b.wins !== a.wins) ? b.wins - a.wins : b.pointDiff - a.pointDiff;

        let matchups = [];
        let roundName = '';
        let bestOf = 5;

        if (stage === 'sweet16') {
            roundName = 'Sweet 16';
            pd.stage = 'sweet16';
            const teams = pd.sweet16Teams;
            for (let i = 0; i < 8; i++) {
                matchups.push({ higher: teams[i], lower: teams[15 - i] });
            }
        } else if (stage === 'quarterfinals') {
            roundName = 'Quarterfinals';
            pd.stage = 'quarterfinals';
            const prevWinners = pd.interactiveResults.sweet16.map(s => s.result.winner);
            prevWinners.sort(sortByRecord);
            for (let i = 0; i < 4; i++) {
                matchups.push({ higher: prevWinners[i], lower: prevWinners[7 - i] });
            }
        } else if (stage === 'semifinals') {
            roundName = 'Semifinals';
            pd.stage = 'semifinals';
            const prevWinners = pd.interactiveResults.quarterfinals.map(s => s.result.winner);
            prevWinners.sort(sortByRecord);
            matchups.push({ higher: prevWinners[0], lower: prevWinners[3] });
            matchups.push({ higher: prevWinners[1], lower: prevWinners[2] });
        } else if (stage === 'championship') {
 roundName = 'Metro League Championship';
            pd.stage = 'championship';
            const sfResults = pd.interactiveResults.semifinals;
            matchups.push({ higher: sfResults[0].result.winner, lower: sfResults[1].result.winner });
        }

        // Find user's matchup
        const userIdx = matchups.findIndex(m =>
            m.higher.id === userTeam.id || m.lower.id === userTeam.id
        );

        // Auto-sim non-user series
        const roundResults = matchups.map((m, i) => {
            if (i === userIdx) return null;
            return { result: helpers.simulatePlayoffSeries(m.higher, m.lower, bestOf) };
        });

        pd._pendingNationalStage = stage;
        pd._pendingNationalRoundName = roundName;
        pd._pendingNationalResults = roundResults;

        if (userIdx >= 0) {
            const m = matchups[userIdx];
            this.startPlayoffSeriesWatch(m.higher, m.lower, bestOf, (result) => {
                pd._pendingNationalResults[userIdx] = { result };
                this._showT3NationalRoundResult();
            });
        } else {
            // User already eliminated — just show results
            this._storeT3NationalResults(roundResults, stage);
            this._showT3NationalRoundResult();
        }
    }

    _storeT3NationalResults(results, stage) {
        const { gameState } = this.ctx;
        const pd = gameState.t3PlayoffData;
        if (stage === 'sweet16') pd.interactiveResults.sweet16 = results;
        else if (stage === 'quarterfinals') pd.interactiveResults.quarterfinals = results;
        else if (stage === 'semifinals') pd.interactiveResults.semifinals = results;
        else if (stage === 'championship') pd.interactiveResults.championship = results[0];
    }

    _showT3NationalRoundResult() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t3PlayoffData;
        const postseason = gameState.postseasonResults;
        const userTeam = helpers.getUserTeam();
        const stage = pd._pendingNationalStage;
        const roundName = pd._pendingNationalRoundName;
        const roundResults = pd._pendingNationalResults;

        // Store results
        this._storeT3NationalResults(roundResults, stage);

        // Check user elimination
        const userEliminated = roundResults.some(r =>
            r && r.result.loser.id === userTeam.id
        );

        const isChampionship = stage === 'championship';

        // Handle championship
        if (isChampionship && roundResults[0]) {
            const champion = roundResults[0].result.winner;
            helpers.applyChampionshipBonus(champion);
            postseason.t3.champion = champion;
            postseason.t3.runnerUp = roundResults[0].result.loser;
        }

        if (window._reactShowChampionship) {
            window._reactShowChampionship({
                mode: 't3-national-result',
                roundName, stage, roundResults, userTeam,
                isChampionship,
                champion: isChampionship ? roundResults[0]?.result.winner : null,
            });
            return;
        }
        // [LEGACY REMOVED] const html = UIRenderer.t3NationalRoundPage({
            // roundName, stage, roundResults, userTeam,
            // isChampionship,
            // champion: isChampionship ? roundResults[0]?.result.winner : null,
            // formatSeriesResult: (sr, ut, isF) => {
                // const isUser = sr.higherSeed.id === ut.id || sr.lowerSeed.id === ut.id;
                // const idx = roundResults.findIndex(r => r && r.result === sr);
                // const key = isUser && idx >= 0 ? `t3-nat-${stage}-${idx}` : undefined;
                // [LEGACY REMOVED] return UIRenderer.seriesResultCard({ seriesResult: sr, isUserInvolved: isUser, isFinals: isF, seriesKey: key });
            // }
        // });
        {
            // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML = html;
            // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.remove('hidden');
        }
    }

    continueT3AfterNationalRound() {
        const { gameState, helpers } = this.ctx;
        const pd = gameState.t3PlayoffData;
        const userTeam = helpers.getUserTeam();
        const stage = pd._pendingNationalStage;

        // Check if user was eliminated
        const lastResults = pd._pendingNationalResults;
        const userEliminated = lastResults.some(r =>
            r && r.result.loser.id === userTeam.id
        );

        if (userEliminated && stage !== 'championship') {
            this._showT3EliminationAndSummary(pd._pendingNationalRoundName);
            return;
        }

        if (stage === 'championship') {
            this._finishT3Playoffs();
            return;
        }

        // Advance to next stage
        const nextStage = {
            'sweet16': 'quarterfinals',
            'quarterfinals': 'semifinals',
            'semifinals': 'championship'
        }[stage];

        if (nextStage) {
            this._runT3NationalRound(nextStage);
        }
    }

    simAllT3Rounds() {
        const { gameState } = this.ctx;
        const postseason = gameState.postseasonResults;
        if (window._reactShowChampionship) {
            window._reactShowChampionship({ mode: 't3-complete', champion: postseason.t3.champion });
            return;
        }
        // [LEGACY REMOVED] const t3CompleteHtml = UIRenderer.t3PlayoffCompleteQuick({ champion: postseason.t3.champion });
        // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML = t3CompleteHtml;
    }

    _showT3EliminationAndSummary(eliminatedIn) {
        const { gameState, helpers } = this.ctx;
        const postseason = gameState.postseasonResults;
        const userTeam = helpers.getUserTeam();

        if (window._reactShowChampionship) {
            window._reactShowChampionship({
                mode: 't3-elimination',
                userTeam,
                eliminatedIn,
                champion: postseason.t3.champion,
            });
            return;
        }
        // [LEGACY REMOVED] const html = UIRenderer.t3EliminationPage({
            // userTeam,
            // eliminatedIn,
            // champion: postseason.t3.champion
        // });
        {
            // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML = html;
            // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.remove('hidden');
        }
    }

    _showT3PostseasonSummary() {
        const { gameState } = this.ctx;
        const postseason = gameState.postseasonResults;
        if (window._reactShowChampionship) {
            window._reactShowChampionship({ mode: 't3-complete', champion: postseason.t3.champion });
            return;
        }
        // [LEGACY REMOVED] const t3SummaryHtml = UIRenderer.t3PlayoffCompleteQuick({ champion: postseason.t3.champion });
        // [LEGACY DOM] document.getElementById('championshipPlayoffContent').innerHTML = t3SummaryHtml;
        // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.remove('hidden');
    }

    _finishT3Playoffs() {
        const { gameState, helpers } = this.ctx;
        if (window._reactCloseChampionship) window._reactCloseChampionship();
        // [LEGACY DOM] document.getElementById('championshipPlayoffModal').classList.add('hidden');

        const offseasonCtrl = helpers.getOffseasonController ? helpers.getOffseasonController() : null;
        if (offseasonCtrl) {
            offseasonCtrl.continueAfterPostseason();
        } else {
            helpers.executePromotionRelegationFromResults();
            helpers.proceedToDraftOrDevelopment();
        }
    }

    skipT3Playoffs() {
        this._finishT3Playoffs();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Simulate Other Tiers to Completion
    // ═══════════════════════════════════════════════════════════════════

    simulateOtherTiersToCompletion() {
        const { gameState, helpers } = this.ctx;

        if (gameState.currentTier !== 1) {
            console.log('Simulating Tier 1 to completion...');
            gameState.tier1Teams.forEach(t => { t.wins = 0; t.losses = 0; t.pointDiff = 0; });
            const tier1Schedule = helpers.generateSchedule(gameState.tier1Teams, 82);
            tier1Schedule.forEach(game => {
                const h = gameState.tier1Teams.find(t => t.id === game.homeTeamId);
                const a = gameState.tier1Teams.find(t => t.id === game.awayTeamId);
                if (h && a) helpers.simulateGame(h, a);
            });
        }
        if (gameState.currentTier !== 2) {
            console.log('Simulating Tier 2 to completion...');
            gameState.tier2Teams.forEach(t => { t.wins = 0; t.losses = 0; t.pointDiff = 0; });
            const tier2Schedule = helpers.generateSchedule(gameState.tier2Teams, 60);
            tier2Schedule.forEach(game => {
                const h = gameState.tier2Teams.find(t => t.id === game.homeTeamId);
                const a = gameState.tier2Teams.find(t => t.id === game.awayTeamId);
                if (h && a) helpers.simulateGame(h, a);
            });
        }
        if (gameState.currentTier !== 3) {
            console.log('Simulating Tier 3 to completion...');
            gameState.tier3Teams.forEach(t => { t.wins = 0; t.losses = 0; t.pointDiff = 0; });
            const tier3Schedule = helpers.generateSchedule(gameState.tier3Teams, 40);
            tier3Schedule.forEach(game => {
                const h = gameState.tier3Teams.find(t => t.id === game.homeTeamId);
                const a = gameState.tier3Teams.find(t => t.id === game.awayTeamId);
                if (h && a) helpers.simulateGame(h, a);
            });
        }
        console.log('✅ All other tiers simulated to completion');
    }

    simulateOtherTier() {
        const { gameState, helpers } = this.ctx;

        if (gameState.currentTier !== 1) {
            gameState.tier1Teams.forEach(t => { t.wins = 0; t.losses = 0; t.pointDiff = 0; });
            const s = helpers.generateSchedule(gameState.tier1Teams, 82);
            s.forEach(g => { const h = gameState.tier1Teams.find(t => t.id === g.homeTeamId); const a = gameState.tier1Teams.find(t => t.id === g.awayTeamId); helpers.simulateGame(h, a); });
        }
        if (gameState.currentTier !== 2) {
            gameState.tier2Teams.forEach(t => { t.wins = 0; t.losses = 0; t.pointDiff = 0; });
            const s = helpers.generateSchedule(gameState.tier2Teams, 60);
            s.forEach(g => { const h = gameState.tier2Teams.find(t => t.id === g.homeTeamId); const a = gameState.tier2Teams.find(t => t.id === g.awayTeamId); helpers.simulateGame(h, a); });
        }
        if (gameState.currentTier !== 3) {
            gameState.tier3Teams.forEach(t => { t.wins = 0; t.losses = 0; t.pointDiff = 0; });
            const s = helpers.generateSchedule(gameState.tier3Teams, 40);
            s.forEach(g => { const h = gameState.tier3Teams.find(t => t.id === g.homeTeamId); const a = gameState.tier3Teams.find(t => t.id === g.awayTeamId); helpers.simulateGame(h, a); });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // CALENDAR-BASED PLAYOFF SIMULATION
    // These methods work with playoffSchedule (generated by PlayoffEngine.generatePlayoffSchedule)
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * Simulate all playoff games scheduled for the next game day.
     * This is the primary "Sim Game" action when user is in playoffs.
     */
    simPlayoffDay() {
        const { gameState, helpers, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        
        if (!schedule) {
            console.error('❌ simPlayoffDay: No playoff schedule found');
            return;
        }
        
        console.log('🏀 simPlayoffDay called, currentDate:', gameState.currentDate);
        
        // Find the next date with games to play (on or after current date)
        // Pass a date one day before current to include current date in search
        const searchFrom = engines.PlayoffEngine._addDays(gameState.currentDate, -1);
        const nextDate = engines.PlayoffEngine.getNextPlayoffGameDate(schedule, searchFrom);
        
        console.log('🏀 Next playoff game date:', nextDate);
        
        if (!nextDate) {
            console.log('✅ All playoff games complete');
            this._checkPlayoffsComplete();
            return;
        }
        
        // Get all necessary games on this date
        const gamesToday = engines.PlayoffEngine.getPlayoffGamesOnDate(schedule, nextDate);
        console.log(`🏀 Found ${gamesToday.length} games on ${nextDate}:`, gamesToday.map(g => g.id));
        
        if (gamesToday.length === 0) {
            console.log('⚠️ No necessary games found on', nextDate);
            // Try advancing to find next date with actual games
            gameState.currentDate = engines.PlayoffEngine._addDays(nextDate, 1);
            helpers.saveGameState();
            if (window._reactPlayoffHubRefresh) window._reactPlayoffHubRefresh();
            return;
        }
        
        for (const game of gamesToday) {
            this._simOneScheduledGame(game);
        }
        
        // Advance date
        gameState.currentDate = nextDate;
        
        // Populate next round matchups if any series completed
        this._updateBracketsAfterGames();
        
        helpers.saveGameState();
        
        // Refresh UI
        if (window._reactPlayoffHubRefresh) window._reactPlayoffHubRefresh();
        
        // Check if all playoffs are complete
        this._checkPlayoffsComplete();
    }

    /**
     * Simulate user's entire current series to completion.
     */
    simUserPlayoffSeries() {
        const { gameState, helpers, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        const userSeriesId = gameState.userSeriesId;
        
        if (!schedule || !userSeriesId) {
            console.error('❌ simUserPlayoffSeries: No schedule or user series');
            return;
        }
        
        const seriesGames = schedule.bySeries[userSeriesId] || [];
        const bestOf = seriesGames[0]?.bestOf || 7;
        const winsNeeded = Math.ceil(bestOf / 2);
        
        // Sim until series is decided
        let iterations = 0;
        while (iterations < 10) { // Safety limit
            iterations++;
            
            const state = engines.PlayoffEngine.getSeriesState(schedule, userSeriesId);
            if (state.complete) {
                console.log(`✅ User series complete: ${state.higherSeedWins}-${state.lowerSeedWins}`);
                break;
            }
            
            // Find next unplayed game in this series
            const nextGame = seriesGames.find(g => !g.played);
            if (!nextGame) break;
            
            this._simOneScheduledGame(nextGame);
            
            // Also sim other games on the same date
            const otherGames = engines.PlayoffEngine.getPlayoffGamesOnDate(schedule, nextGame.date)
                .filter(g => g.id !== nextGame.id);
            for (const g of otherGames) {
                this._simOneScheduledGame(g);
            }
            
            gameState.currentDate = nextGame.date;
        }
        
        this._updateBracketsAfterGames();
        
        // Update user's series ID for next round if they won
        this._updateUserSeriesForNextRound();
        
        helpers.saveGameState();
        if (window._reactPlayoffHubRefresh) window._reactPlayoffHubRefresh();
        this._checkPlayoffsComplete();
    }

    /**
     * Simulate all games in the current playoff round until it completes.
     */
    simPlayoffRound() {
        const { gameState, helpers, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        
        if (!schedule) {
            console.error('❌ simPlayoffRound: No playoff schedule found');
            return;
        }
        
        // Get user's tier
        const userTier = gameState.userTier || gameState.currentTier || 1;
        const tierPrefix = `t${userTier}-`;
        
        // Determine current round for USER'S TIER from earliest incomplete series
        const currentRound = this._getCurrentPlayoffRoundForTier(userTier);
        if (!currentRound) {
            console.log(`✅ All T${userTier} rounds complete`);
            this._checkPlayoffsComplete();
            return;
        }
        
        console.log(`🏀 Simulating T${userTier} playoff round: ${currentRound}`);
        
        // Find the latest date needed to complete this round
        const roundGames = schedule.games.filter(g => 
            g.seriesId?.startsWith(tierPrefix) && g.round === currentRound && !g.played
        );
        
        if (roundGames.length === 0) {
            console.log(`✅ Round ${currentRound} already complete`);
            this._updateBracketsAfterGames();
            this._updateUserSeriesForNextRound();
            helpers.saveGameState();
            if (window._reactPlayoffHubRefresh) window._reactPlayoffHubRefresh();
            return;
        }
        
        // Find the last date of games in this round
        const roundDates = [...new Set(roundGames.map(g => g.date))].sort();
        const lastRoundDate = roundDates[roundDates.length - 1];
        
        console.log(`📅 Simulating all games through ${lastRoundDate} to complete round`);
        
        // Sim ALL games (all tiers) up through that date
        let iterations = 0;
        let gamesSimmed = 0;
        while (iterations < 500) { // Safety limit
            iterations++;
            
            // Find next unplayed game date across all tiers
            const nextDate = engines.PlayoffEngine.getNextPlayoffGameDate(schedule, null);
            if (!nextDate) break;
            
            // Stop if we've passed the round's end date
            if (nextDate > lastRoundDate) {
                // But first check if the user's round is actually complete
                if (this._isRoundCompleteForTier(currentRound, userTier)) {
                    break;
                }
                // Round not complete but no more games on expected dates - might need more games
                // This can happen in Bo7 series that go to game 7
                const stillNeeded = schedule.games.filter(g => 
                    g.seriesId?.startsWith(tierPrefix) && g.round === currentRound && !g.played
                );
                if (stillNeeded.length === 0) break;
                // Update lastRoundDate to include newly necessary games
            }
            
            // Get all games on this date (all tiers)
            const gamesToday = engines.PlayoffEngine.getPlayoffGamesOnDate(schedule, nextDate)
                .filter(g => !g.played && !g.skipped);
            
            if (gamesToday.length === 0) {
                gameState.currentDate = nextDate;
                continue;
            }
            
            for (const game of gamesToday) {
                if (!game.played && !game.skipped) {
                    this._simOneScheduledGame(game);
                    gamesSimmed++;
                }
            }
            
            gameState.currentDate = nextDate;
            
            // Check if user's tier round is now complete
            if (this._isRoundCompleteForTier(currentRound, userTier)) {
                console.log(`✅ T${userTier} round ${currentRound} complete after ${gamesSimmed} games`);
                break;
            }
        }
        
        this._updateBracketsAfterGames();
        this._updateUserSeriesForNextRound();
        
        helpers.saveGameState();
        if (window._reactPlayoffHubRefresh) window._reactPlayoffHubRefresh();
        this._checkPlayoffsComplete();
    }

    /**
     * Fast-forward through all remaining playoff games.
     */
    simToChampionship() {
        const { gameState, helpers, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        
        if (!schedule) {
            console.error('❌ simToChampionship: No playoff schedule found');
            // Fallback to legacy path
            if (this.simAllChampionshipRounds) {
                this.simAllChampionshipRounds();
            }
            return;
        }
        
        console.log('🏆 Simulating all remaining playoff games...');
        
        let iterations = 0;
        let gamesSimmed = 0;
        while (iterations < 1000) { // Safety limit
            iterations++;
            
            const nextDate = engines.PlayoffEngine.getNextPlayoffGameDate(schedule, null);
            if (!nextDate) {
                console.log(`✅ All playoff games complete after ${gamesSimmed} games`);
                break;
            }
            
            const gamesToday = engines.PlayoffEngine.getPlayoffGamesOnDate(schedule, nextDate);
            if (gamesToday.length === 0) {
                // No necessary games on this date, skip it
                gameState.currentDate = engines.PlayoffEngine._addDays(nextDate, 1);
                continue;
            }
            
            for (const game of gamesToday) {
                this._simOneScheduledGame(game);
                gamesSimmed++;
            }
            
            gameState.currentDate = nextDate;
            this._updateBracketsAfterGames();
        }
        
        // Mark playoffs as complete
        if (gameState.playoffData) {
            gameState.playoffData.completed = true;
        }
        
        // Build postseasonResults for offseason flow compatibility
        this._buildPostseasonResults();
        
        // Mark playoffs as completed
        gameState.playoffData.completed = true;
        
        helpers.saveGameState();
        if (window._reactPlayoffHubRefresh) window._reactPlayoffHubRefresh();
        
        // Don't immediately trigger offseason - let user view results first
        // The PlayoffHub will show "View Results" button which opens PlayoffEndModal
        // When user clicks "Begin Offseason" in that modal, it will trigger offseason
        console.log('🏁 Playoffs complete - View Results button will appear in PlayoffHub');
    }

    /**
     * Watch user's next playoff game with live play-by-play.
     */
    watchPlayoffGame() {
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
        
        // Sim other games on this date first
        const otherGames = engines.PlayoffEngine.getPlayoffGamesOnDate(schedule, nextGame.date)
            .filter(g => g.id !== nextGame.id);
        for (const g of otherGames) {
            this._simOneScheduledGame(g);
        }
        
        // Set up watch game state
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
            userIsHome ? awayTeam : homeTeam
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

    // ─── Helper: Simulate one scheduled playoff game ─────────────────────────────

    _simOneScheduledGame(game) {
        const { gameState, helpers, engines } = this.ctx;
        
        if (game.played) return; // Already played
        if (game.placeholder && !game.homeTeamId) return; // Teams not determined
        
        // Check if game is still necessary (series not decided)
        if (!engines.PlayoffEngine.isGameNecessary(gameState.playoffSchedule, game.id)) {
            game.played = true; // Mark as skipped
            game.skipped = true;
            return;
        }
        
        // Get team objects
        const allTeams = [
            ...(gameState.tier1Teams || []),
            ...(gameState.tier2Teams || []),
            ...(gameState.tier3Teams || [])
        ];
        const homeTeam = allTeams.find(t => t.id === game.homeTeamId);
        const awayTeam = allTeams.find(t => t.id === game.awayTeamId);
        
        if (!homeTeam || !awayTeam) {
            console.warn(`⚠️ Could not find teams for game ${game.id}`);
            return;
        }
        
        // Simulate the game
        const result = helpers.getSimulationController().simulatePlayoffGame(homeTeam, awayTeam);
        
        // Record result
        game.played = true;
        game.result = {
            homeScore: result.homeScore,
            awayScore: result.awayScore,
            winner: result.winner,
            loser: result.loser,
            overtime: result.overtime || false
        };
        
        // Store box score if this is a user's series game
        const userTeamId = gameState.userTeamId;
        const isUserGame = game.homeTeamId === userTeamId || game.awayTeamId === userTeamId;
        if (isUserGame && result.homePlayerStats && result.awayPlayerStats) {
            const mapStats = (stats) => (stats || [])
                .filter(p => p.minutesPlayed > 0)
                .sort((a, b) => b.minutesPlayed - a.minutesPlayed)
                .map(p => ({
                    name: p.playerName || p.name || 'Unknown', pos: p.position || '',
                    min: p.minutesPlayed || 0, pts: p.points || 0,
                    reb: p.rebounds || 0, ast: p.assists || 0,
                    stl: p.steals || 0, blk: p.blocks || 0, to: p.turnovers || 0,
                    pf: p.fouls || 0, starter: p.gamesStarted > 0,
                    fgm: p.fieldGoalsMade || 0, fga: p.fieldGoalsAttempted || 0,
                    tpm: p.threePointersMade || 0, tpa: p.threePointersAttempted || 0,
                    ftm: p.freeThrowsMade || 0, fta: p.freeThrowsAttempted || 0, pm: p.plusMinus || 0
                }));
            game.boxScore = {
                home: { city: homeTeam.city || '', name: homeTeam.name, score: result.homeScore, players: mapStats(result.homePlayerStats) },
                away: { city: awayTeam.city || '', name: awayTeam.name, score: result.awayScore, players: mapStats(result.awayPlayerStats) },
                quarterScores: result.quarterScores || null,
                winProbHistory: result.winProbHistory || null,
                preGameProb: result.preGameProb || null
            };
        }
        
        console.log(`  ${game.round} G${game.gameNumber}: ${homeTeam.name} ${result.homeScore} - ${result.awayScore} ${awayTeam.name}`);
    }

    // ─── Helper: Update brackets after games complete ────────────────────────────

    _updateBracketsAfterGames() {
        const { gameState, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        const playoffData = gameState.playoffData;
        
        if (!schedule || !playoffData) return;
        
        // Check each series for completion and populate next round
        for (const [seriesId, games] of Object.entries(schedule.bySeries)) {
            const state = engines.PlayoffEngine.getSeriesState(schedule, seriesId);
            
            if (state.complete && state.winner) {
                // Find the next series this winner advances to
                const nextSeriesId = this._getNextSeriesId(seriesId);
                if (nextSeriesId && schedule.bySeries[nextSeriesId]) {
                    this._populateSeriesWithTeam(nextSeriesId, state.winner, seriesId);
                }
            }
        }
        
        // Handle T2 division → national tournament transition
        this._checkT2NationalTournamentSeeding();
        
        // Handle T3 metro → regional → sweet16 transitions
        this._checkT3TournamentSeeding();
        
        // Handle 3rd place games (losers of semis)
        this._checkThirdPlaceGames();
    }
    
    /**
     * Check if all T2 division finals are complete and seed national tournament.
     */
    _checkT2NationalTournamentSeeding() {
        const { gameState, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        
        // Find all division final series
        const divFinalSeries = Object.keys(schedule.bySeries).filter(id => 
            id.startsWith('t2-div-') && id.endsWith('-final')
        );
        
        console.log(`📊 T2 Division Finals check: ${divFinalSeries.length} series`);
        
        // Check if all are complete
        const divWinners = [];
        const divRunnersUp = [];
        for (const seriesId of divFinalSeries) {
            const state = engines.PlayoffEngine.getSeriesState(schedule, seriesId);
            if (!state.complete) {
                console.log(`   ${seriesId}: incomplete`);
                return; // Not all complete yet
            }
            if (state.winner) divWinners.push(state.winner);
            if (state.loser) divRunnersUp.push(state.loser);
        }
        
        console.log(`📊 T2 Division Finals complete: ${divWinners.length} winners`);
        
        // Check if national tournament is already seeded
        const natR1Series = Object.keys(schedule.bySeries).filter(id => 
            id.startsWith('t2-nat-r1-')
        ).sort();
        
        if (natR1Series.length > 0) {
            const firstNatGame = schedule.bySeries[natR1Series[0]]?.[0];
            if (firstNatGame?.homeTeamId) {
                console.log('📊 T2 National already seeded');
                return; // Already seeded
            }
        }
        
        // All division finals complete - seed national tournament round 1
        // With 11 divisions, we have 11 winners. Take top 8 by regular season record
        // (or we could include some runners-up for a 16-team field)
        
        // For now: top 11 division winners, sorted by record, fill 8 series (16 spots)
        // Add top 5 runners-up to make 16 teams
        const allQualifiers = [...divWinners];
        
        // Sort by regular season record
        allQualifiers.sort((a, b) => (b.wins - a.wins) || (b.pointDiff - a.pointDiff));
        
        // If we have fewer than 16 teams, add runners-up
        if (allQualifiers.length < 16 && divRunnersUp.length > 0) {
            divRunnersUp.sort((a, b) => (b.wins - a.wins) || (b.pointDiff - a.pointDiff));
            const needed = 16 - allQualifiers.length;
            allQualifiers.push(...divRunnersUp.slice(0, needed));
            allQualifiers.sort((a, b) => (b.wins - a.wins) || (b.pointDiff - a.pointDiff));
        }
        
        console.log(`📊 T2 National qualifiers: ${allQualifiers.length} teams`);
        
        // Seed 1v16, 2v15, 3v14, etc.
        for (let i = 0; i < Math.min(8, natR1Series.length); i++) {
            const highSeedIdx = i;
            const lowSeedIdx = allQualifiers.length - 1 - i;
            
            if (highSeedIdx < allQualifiers.length && lowSeedIdx >= 0 && lowSeedIdx < allQualifiers.length && highSeedIdx !== lowSeedIdx) {
                const highSeed = allQualifiers[highSeedIdx];
                const lowSeed = allQualifiers[lowSeedIdx];
                if (highSeed && lowSeed) {
                    this._populateSeriesWithTeams(natR1Series[i], highSeed, lowSeed);
                }
            }
        }
        
        // Update user's series ID if they're in the national tournament
        const userTeamId = gameState.userTeamId;
        if (userTeamId) {
            for (let i = 0; i < natR1Series.length; i++) {
                const games = schedule.bySeries[natR1Series[i]];
                if (games?.[0] && (games[0].homeTeamId === userTeamId || games[0].awayTeamId === userTeamId)) {
                    gameState.userSeriesId = natR1Series[i];
                    console.log(`🎯 User seeded in T2 National R1: ${natR1Series[i]}`);
                    break;
                }
            }
        }
    }
    
    /**
     * Check T3 tournament seeding (metro → regional → sweet16 → qf → sf → finals).
     */
    _checkT3TournamentSeeding() {
        const { gameState, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        
        if (!schedule?.bySeries) return;
        
        // T3 Structure:
        // Stage 1: Metro Finals (24 series) - t3-metro-{divId}
        // Stage 2: Regional (8 series) - lower-ranked metro winners play in
        // Stage 3: Sweet 16 (8 series) - top 8 metro winners + regional winners
        // Stage 4: QF, SF, Finals
        
        // Check all metro finals for completion
        const metroSeries = Object.keys(schedule.bySeries).filter(id => 
            id.startsWith('t3-metro-')
        );
        
        const metroResults = [];
        for (const seriesId of metroSeries) {
            const state = engines.PlayoffEngine.getSeriesState(schedule, seriesId);
            if (state.complete && state.winner) {
                metroResults.push({ winner: state.winner, loser: state.loser, seriesId });
            }
        }
        
        // Check if regional round is seeded
        const regionalSeries = Object.keys(schedule.bySeries).filter(id => 
            id.startsWith('t3-regional-')
        ).sort();
        
        const firstRegional = schedule.bySeries[regionalSeries[0]]?.[0];
        const regionalSeeded = firstRegional?.homeTeamId != null;
        
        // Seed regional round once all metro finals are complete
        if (metroResults.length === metroSeries.length && metroSeries.length > 0 && !regionalSeeded) {
            console.log(`📊 T3 Metro Finals complete: ${metroResults.length} winners`);
            
            // Sort metro winners by regular season record
            metroResults.sort((a, b) => (b.winner.wins - a.winner.wins) || (b.winner.pointDiff - a.winner.pointDiff));
            
            // Top 8 get byes to Sweet 16, teams 9-24 go to Regional round
            // Regional: 9v24, 10v23, 11v22, 12v21, 13v20, 14v19, 15v18, 16v17
            const byeTeams = metroResults.slice(0, 8).map(r => r.winner);
            const regionalTeams = metroResults.slice(8).map(r => r.winner);
            
            // Seed regional round (8 series)
            for (let i = 0; i < Math.min(8, regionalSeries.length, Math.floor(regionalTeams.length / 2)); i++) {
                const highSeed = regionalTeams[i];
                const lowSeed = regionalTeams[regionalTeams.length - 1 - i];
                if (highSeed && lowSeed && highSeed.id !== lowSeed.id) {
                    this._populateSeriesWithTeams(regionalSeries[i], highSeed, lowSeed);
                }
            }
            
            // Store bye teams for Sweet 16 seeding
            gameState._t3ByeTeams = byeTeams;
            
            // Update user's series ID if they're in the regional round or have a bye
            const userTeamId = gameState.userTeamId;
            if (userTeamId) {
                // Check if user has a bye (top 8)
                const userByeIdx = byeTeams.findIndex(t => t.id === userTeamId);
                if (userByeIdx >= 0) {
                    // User has a bye - they'll be seeded in Sweet 16 later
                    gameState._userHasT3Bye = true;
                    console.log(`🎯 User has T3 bye (seed ${userByeIdx + 1}), waiting for Sweet 16 seeding`);
                } else {
                    // Check if user is in regional round
                    for (let i = 0; i < regionalSeries.length; i++) {
                        const games = schedule.bySeries[regionalSeries[i]];
                        if (games?.[0] && (games[0].homeTeamId === userTeamId || games[0].awayTeamId === userTeamId)) {
                            gameState.userSeriesId = regionalSeries[i];
                            console.log(`🎯 User seeded in Regional: ${regionalSeries[i]}`);
                            break;
                        }
                    }
                }
            }
        }
        
        // Check if Sweet 16 needs seeding
        const sweet16Series = Object.keys(schedule.bySeries).filter(id => 
            id.startsWith('t3-sweet16-')
        ).sort();
        
        const firstSweet16 = schedule.bySeries[sweet16Series[0]]?.[0];
        const sweet16Seeded = firstSweet16?.homeTeamId != null;
        
        // Check regional completion
        const regionalResults = [];
        for (const seriesId of regionalSeries) {
            const state = engines.PlayoffEngine.getSeriesState(schedule, seriesId);
            if (state.complete && state.winner) {
                regionalResults.push(state.winner);
            }
        }
        
        // Seed Sweet 16 once all regionals complete
        if (regionalResults.length === regionalSeries.length && regionalSeries.length > 0 && !sweet16Seeded) {
            console.log(`📊 T3 Regional complete: ${regionalResults.length} winners`);
            
            const byeTeams = gameState._t3ByeTeams || [];
            // Sort regional winners by record
            regionalResults.sort((a, b) => (b.wins - a.wins) || (b.pointDiff - a.pointDiff));
            
            // Sweet 16: Bye team 1 vs Regional winner 8, etc.
            for (let i = 0; i < Math.min(8, sweet16Series.length); i++) {
                const byeTeam = byeTeams[i];
                const regionalWinner = regionalResults[regionalResults.length - 1 - i];
                if (byeTeam && regionalWinner) {
                    this._populateSeriesWithTeams(sweet16Series[i], byeTeam, regionalWinner);
                }
            }
            
            // Update user's series ID if they're in Sweet 16
            const userTeamId = gameState.userTeamId;
            if (userTeamId) {
                for (let i = 0; i < sweet16Series.length; i++) {
                    const games = schedule.bySeries[sweet16Series[i]];
                    if (games?.[0] && (games[0].homeTeamId === userTeamId || games[0].awayTeamId === userTeamId)) {
                        gameState.userSeriesId = sweet16Series[i];
                        gameState._userHasT3Bye = false;
                        console.log(`🎯 User seeded in Sweet 16: ${sweet16Series[i]}`);
                        break;
                    }
                }
            }
        }
        
        // Sweet 16 → QF advancement (handled by _getNextSeriesId)
        // QF → SF advancement (handled by _getNextSeriesId)
        // SF → Finals advancement (handled by _getNextSeriesId)
    }
    
    /**
     * Check if semi-final losers need to go to 3rd place game.
     */
    _checkThirdPlaceGames() {
        const { gameState, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        
        // T2 3rd place
        const t2Sf1 = engines.PlayoffEngine.getSeriesState(schedule, 't2-nat-sf-1');
        const t2Sf2 = engines.PlayoffEngine.getSeriesState(schedule, 't2-nat-sf-2');
        if (t2Sf1.complete && t2Sf2.complete && t2Sf1.loser && t2Sf2.loser) {
            const thirdPlace = schedule.bySeries['t2-3rd-place'];
            if (thirdPlace && thirdPlace[0] && !thirdPlace[0].homeTeamId) {
                this._populateSeriesWithTeams('t2-3rd-place', t2Sf1.loser, t2Sf2.loser);
            }
        }
        
        // T3 3rd place
        const t3Sf1 = engines.PlayoffEngine.getSeriesState(schedule, 't3-sf-1');
        const t3Sf2 = engines.PlayoffEngine.getSeriesState(schedule, 't3-sf-2');
        if (t3Sf1.complete && t3Sf2.complete && t3Sf1.loser && t3Sf2.loser) {
            const thirdPlace = schedule.bySeries['t3-3rd-place'];
            if (thirdPlace && thirdPlace[0] && !thirdPlace[0].homeTeamId) {
                this._populateSeriesWithTeams('t3-3rd-place', t3Sf1.loser, t3Sf2.loser);
            }
        }
    }
    
    /**
     * Populate a series with both teams (for known matchups).
     */
    _populateSeriesWithTeams(seriesId, higherSeed, lowerSeed) {
        const { gameState } = this.ctx;
        const schedule = gameState.playoffSchedule;
        const games = schedule.bySeries[seriesId];
        
        if (!games || !games.length) return;
        
        // Determine home court pattern based on bestOf
        const bestOf = games[0].bestOf || 7;
        const homePattern = bestOf === 7
            ? [higherSeed, higherSeed, lowerSeed, lowerSeed, higherSeed, lowerSeed, higherSeed]
            : bestOf === 5
            ? [higherSeed, higherSeed, lowerSeed, lowerSeed, higherSeed]
            : [higherSeed, lowerSeed, higherSeed];
        
        for (let i = 0; i < games.length; i++) {
            const game = games[i];
            const home = homePattern[i] || higherSeed;
            const away = home.id === higherSeed.id ? lowerSeed : higherSeed;
            
            game.higherSeedId = higherSeed.id;
            game.lowerSeedId = lowerSeed.id;
            game.homeTeamId = home.id;
            game.awayTeamId = away.id;
            game.homeTeam = home;
            game.awayTeam = away;
            game.placeholder = false;
        }
        
        console.log(`📋 Populated ${seriesId}: ${higherSeed.name} vs ${lowerSeed.name}`);
    }

    /**
     * Determine which series the winner advances to based on bracket logic.
     */
    _getNextSeriesId(completedSeriesId) {
        // Parse the series ID to understand the bracket position
        // Format: t{tier}-{round}-{conf}-{matchup} or t{tier}-{stage}-{matchup}
        const parts = completedSeriesId.split('-');
        const tier = parts[0]; // t1, t2, t3
        
        if (tier === 't1') {
            // T1: R1 → R2 → CF → Finals
            if (parts[1] === 'r1') {
                const conf = parts[2]; // east or west
                const matchup = parts[3]; // e.g., "1v8"
                // R1 winners: 1v8 & 4v5 → R2-1, 2v7 & 3v6 → R2-2
                const matchupNum = parseInt(matchup.split('v')[0]);
                const r2Num = (matchupNum === 1 || matchupNum === 4) ? 1 : 2;
                return `t1-r2-${conf}-${r2Num}`;
            }
            if (parts[1] === 'r2') {
                const conf = parts[2];
                return `t1-cf-${conf}`;
            }
            if (parts[1] === 'cf') {
                return 't1-finals';
            }
        }
        
        if (tier === 't2') {
            // T2: DivSemi → DivFinal → NatRound1 → NatQuarter → NatSemi → Finals
            // Series IDs: t2-div-{division-with-hyphens}-s1/s2/final
            // e.g., t2-div-great-lakes-s1 → parts = ['t2', 'div', 'great', 'lakes', 's1']
            
            if (parts[1] === 'div') {
                const suffix = parts[parts.length - 1]; // Last element: s1, s2, or final
                const divIdParts = parts.slice(2, -1); // Everything between 'div' and suffix
                const divId = divIdParts.join('-');
                
                if (suffix === 's1' || suffix === 's2') {
                    return `t2-div-${divId}-final`;
                }
                if (suffix === 'final') {
                    // Division final winners go to national tournament
                    // This is handled specially in _checkT2NationalTournamentSeeding
                    return null;
                }
            }
            
            // National tournament progression
            // t2-nat-r1-{n} → t2-nat-qf-{n/2}
            if (parts[1] === 'nat' && parts[2] === 'r1') {
                const matchNum = parseInt(parts[3]);
                const qfNum = Math.ceil(matchNum / 2);
                return `t2-nat-qf-${qfNum}`;
            }
            // t2-nat-qf-{n} → t2-nat-sf-{n/2}
            if (parts[1] === 'nat' && parts[2] === 'qf') {
                const matchNum = parseInt(parts[3]);
                const sfNum = Math.ceil(matchNum / 2);
                return `t2-nat-sf-${sfNum}`;
            }
            // t2-nat-sf-{n} → t2-finals
            if (parts[1] === 'nat' && parts[2] === 'sf') {
                return 't2-finals';
            }
        }
        
        if (tier === 't3') {
            // T3: MetroFinal → Regional → Sweet16 → Quarters → Semis → Finals
            // t3-metro-{metro}-final → t3-regional-{region}-{slot}
            if (parts[1] === 'metro') {
                // Metro finals winners go to regional, but we handle seeding specially
                return null;
            }
            // t3-regional-{region}-{n} → t3-sweet16-{n}
            if (parts[1] === 'regional') {
                // Regional winners advance to Sweet 16
                return null; // Handle seeding specially
            }
            // t3-sweet16-{n} → t3-qf-{n/2}
            if (parts[1] === 'sweet16') {
                const matchNum = parseInt(parts[2]);
                const qfNum = Math.ceil(matchNum / 2);
                return `t3-qf-${qfNum}`;
            }
            // t3-qf-{n} → t3-sf-{n/2}
            if (parts[1] === 'qf') {
                const matchNum = parseInt(parts[2]);
                const sfNum = Math.ceil(matchNum / 2);
                return `t3-sf-${sfNum}`;
            }
            // t3-sf-{n} → t3-finals (losers go to 3rd place)
            if (parts[1] === 'sf') {
                return 't3-finals';
            }
        }
        
        return null;
    }

    /**
     * Populate a placeholder series with a team from a completed series.
     */
    _populateSeriesWithTeam(seriesId, team, fromSeriesId) {
        const { gameState } = this.ctx;
        const schedule = gameState.playoffSchedule;
        const games = schedule.bySeries[seriesId];
        
        if (!games || !games.length) return;
        if (!team) return;
        
        // Determine seeding position based on fromSeriesId
        // In T1: 1v8 winner is higher seed than 4v5 winner in R2
        // In T2: s1 winner (1v4) is higher seed than s2 winner (2v3) in final
        const isHigherSeed = this._isHigherSeedAdvancement(fromSeriesId, seriesId);
        
        for (const game of games) {
            // Check if this team is already in the series
            if (game.higherSeedId === team.id || game.lowerSeedId === team.id) {
                return; // Already populated
            }
            
            if (isHigherSeed && !game.higherSeedId) {
                game.higherSeedId = team.id;
                // Don't set home/away yet - wait until both teams are known
            } else if (!isHigherSeed && !game.lowerSeedId) {
                game.lowerSeedId = team.id;
            } else if (!game.higherSeedId) {
                // Fallback: fill whichever slot is empty
                game.higherSeedId = team.id;
            } else if (!game.lowerSeedId) {
                game.lowerSeedId = team.id;
            }
            
            // If both teams are now set, finalize the home/away pattern
            if (game.higherSeedId && game.lowerSeedId) {
                this._finalizeSeriesMatchup(seriesId);
                return;
            }
        }
    }
    
    /**
     * Determine if a team advancing from a series should be the higher seed in the next round.
     */
    _isHigherSeedAdvancement(fromSeriesId, toSeriesId) {
        if (!fromSeriesId) return true; // Default to higher
        
        const parts = fromSeriesId.split('-');
        const tier = parts[0];
        
        if (tier === 't1') {
            // T1 R1: 1v8 and 2v7 winners are higher seeds in R2
            if (parts[1] === 'r1') {
                const matchup = parts[3];
                const seedNum = parseInt(matchup.split('v')[0]);
                return seedNum <= 2; // 1-seed or 2-seed winner is higher
            }
            // T1 R2: Series 1 winner is higher seed in CF
            if (parts[1] === 'r2') {
                return parts[3] === '1';
            }
            // T1 CF: East winner is higher seed in Finals (by convention)
            if (parts[1] === 'cf') {
                return parts[2] === 'east';
            }
        }
        
        if (tier === 't2') {
            // T2 Division: s1 (1v4) winner is higher seed than s2 (2v3) winner
            // Handle multi-word division names: t2-div-great-lakes-s1
            if (parts[1] === 'div') {
                const suffix = parts[parts.length - 1];
                if (suffix === 's1') return true;
                if (suffix === 's2') return false;
            }
            // T2 National: lower numbered series winner is higher seed
            if (parts[1] === 'nat') {
                const matchNum = parseInt(parts[3]);
                return matchNum % 2 === 1; // Odd series (1,3,5,7) winners are higher seeds
            }
        }
        
        if (tier === 't3') {
            // T3: lower numbered series winner is higher seed
            if (parts[1] === 'sweet16' || parts[1] === 'qf' || parts[1] === 'sf') {
                const matchNum = parseInt(parts[2]);
                return matchNum % 2 === 1; // Odd series winners are higher seeds
            }
        }
        
        return true; // Default
    }
    
    /**
     * Finalize a series matchup once both teams are known.
     */
    _finalizeSeriesMatchup(seriesId) {
        const { gameState } = this.ctx;
        const schedule = gameState.playoffSchedule;
        const games = schedule.bySeries[seriesId];
        
        if (!games || !games.length) return;
        
        const firstGame = games[0];
        if (!firstGame.higherSeedId || !firstGame.lowerSeedId) return;
        
        // Find team objects
        const allTeams = [
            ...(gameState.tier1Teams || []),
            ...(gameState.tier2Teams || []),
            ...(gameState.tier3Teams || [])
        ];
        const higherSeed = allTeams.find(t => t.id === firstGame.higherSeedId);
        const lowerSeed = allTeams.find(t => t.id === firstGame.lowerSeedId);
        
        if (!higherSeed || !lowerSeed) return;
        
        // Set home court pattern based on bestOf
        const bestOf = firstGame.bestOf || 7;
        const homePattern = bestOf === 7
            ? [higherSeed, higherSeed, lowerSeed, lowerSeed, higherSeed, lowerSeed, higherSeed]
            : bestOf === 5
            ? [higherSeed, higherSeed, lowerSeed, lowerSeed, higherSeed]
            : [higherSeed, lowerSeed, higherSeed];
        
        for (let i = 0; i < games.length; i++) {
            const game = games[i];
            const home = homePattern[i] || higherSeed;
            const away = home.id === higherSeed.id ? lowerSeed : higherSeed;
            
            game.homeTeamId = home.id;
            game.awayTeamId = away.id;
            game.homeTeam = home;
            game.awayTeam = away;
            game.placeholder = false;
        }
        
        console.log(`📋 Finalized ${seriesId}: ${higherSeed.name} vs ${lowerSeed.name}`);
    }

    // ─── Helper: Get current playoff round ───────────────────────────────────────

    _getCurrentPlayoffRound() {
        const { gameState, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        
        if (!schedule) return null;
        
        // Find earliest round with incomplete series
        const roundOrder = [
            'Round1', 'DivSemi', 'DivFinal', 'MetroFinal',
            'Regional', 'NatRound1', 'Sweet16',
            'Round2', 'NatQuarter', 'Quarter',
            'ConfFinals', 'NatSemi', 'Semi',
            'ThirdPlace', 'Finals'
        ];
        
        for (const round of roundOrder) {
            const roundGames = schedule.games.filter(g => g.round === round);
            if (roundGames.length === 0) continue;
            
            // Check if any series in this round is incomplete
            const seriesIds = [...new Set(roundGames.map(g => g.seriesId))];
            for (const seriesId of seriesIds) {
                const state = engines.PlayoffEngine.getSeriesState(schedule, seriesId);
                if (!state.complete && state.gamesPlayed >= 0) {
                    return round;
                }
            }
        }
        
        return null;
    }

    /**
     * Get current playoff round for a specific tier.
     */
    _getCurrentPlayoffRoundForTier(tier) {
        const { gameState, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        
        if (!schedule) return null;
        
        const tierPrefix = `t${tier}-`;
        
        // Round order varies by tier
        const roundOrders = {
            1: ['Round1', 'Round2', 'ConfFinals', 'Finals'],
            2: ['DivSemi', 'DivFinal', 'NatRound1', 'NatQuarter', 'NatSemi', 'ThirdPlace', 'Finals'],
            3: ['MetroFinal', 'Regional', 'Sweet16', 'Quarter', 'Semi', 'ThirdPlace', 'Finals']
        };
        
        const roundOrder = roundOrders[tier] || roundOrders[1];
        
        for (const round of roundOrder) {
            // Get games for this tier and round
            const roundGames = schedule.games.filter(g => 
                g.seriesId?.startsWith(tierPrefix) && g.round === round
            );
            if (roundGames.length === 0) continue;
            
            // Check if any series in this round is incomplete
            const seriesIds = [...new Set(roundGames.map(g => g.seriesId))];
            for (const seriesId of seriesIds) {
                const state = engines.PlayoffEngine.getSeriesState(schedule, seriesId);
                if (!state.complete) {
                    return round;
                }
            }
        }
        
        return null;
    }

    /**
     * Check if a specific round is complete (all series decided).
     */
    _isRoundComplete(round) {
        const { gameState, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        
        if (!schedule) return true;
        
        const roundGames = schedule.games.filter(g => g.round === round);
        const seriesIds = [...new Set(roundGames.map(g => g.seriesId))];
        
        for (const seriesId of seriesIds) {
            const state = engines.PlayoffEngine.getSeriesState(schedule, seriesId);
            if (!state.complete) return false;
        }
        
        return true;
    }

    /**
     * Check if a specific round is complete for a specific tier.
     */
    _isRoundCompleteForTier(round, tier) {
        const { gameState, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        
        if (!schedule) return true;
        
        const tierPrefix = `t${tier}-`;
        const roundGames = schedule.games.filter(g => 
            g.seriesId?.startsWith(tierPrefix) && g.round === round
        );
        
        if (roundGames.length === 0) return true;
        
        const seriesIds = [...new Set(roundGames.map(g => g.seriesId))];
        
        for (const seriesId of seriesIds) {
            const state = engines.PlayoffEngine.getSeriesState(schedule, seriesId);
            if (!state.complete) return false;
        }
        
        return true;
    }

    // ─── Helper: Update user's series for next round ─────────────────────────────

    _updateUserSeriesForNextRound() {
        const { gameState, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        const userSeriesId = gameState.userSeriesId;
        
        if (!schedule || !userSeriesId) return;
        
        const state = engines.PlayoffEngine.getSeriesState(schedule, userSeriesId);
        
        if (state.complete) {
            if (state.winner?.id === gameState.userTeamId) {
                // User won - find their next series
                const nextSeriesId = this._getNextSeriesId(userSeriesId);
                if (nextSeriesId) {
                    gameState.userSeriesId = nextSeriesId;
                    console.log(`🎯 User advances to series: ${nextSeriesId}`);
                }
            } else {
                // User eliminated
                gameState.userSeriesId = null;
                gameState.userInPlayoffs = false;
                console.log('❌ User eliminated from playoffs');
            }
        }
    }

    // ─── Helper: Check if all playoffs are complete ──────────────────────────────

    _checkPlayoffsComplete() {
        const { gameState, helpers } = this.ctx;
        const playoffData = gameState.playoffData;
        
        if (!playoffData) return;
        
        // Check if all three tier brackets are complete
        const t1Complete = this._isTierPlayoffsComplete(1);
        const t2Complete = this._isTierPlayoffsComplete(2);
        const t3Complete = this._isTierPlayoffsComplete(3);
        
        if (t1Complete && t2Complete && t3Complete) {
            console.log('🏆 All playoffs complete!');
            playoffData.completed = true;
            
            // Build postseason results for offseason flow
            this._buildPostseasonResults();
            
            helpers.saveGameState();
            
            // The PlayoffHub's onComplete callback will be triggered by user action
        }
    }

    _isTierPlayoffsComplete(tier) {
        const { gameState, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        
        if (!schedule) return false;
        
        // Find the finals series for this tier
        const finalsId = `t${tier}-finals`;
        const finalsGames = schedule.bySeries[finalsId];
        
        if (!finalsGames || finalsGames.length === 0) {
            // No finals series yet - check if we have any games at all for this tier
            const tierGames = schedule.games.filter(g => g.tier === tier);
            if (tierGames.length === 0) return true; // No games = complete (shouldn't happen)
            return false;
        }
        
        const state = engines.PlayoffEngine.getSeriesState(schedule, finalsId);
        return state.complete;
    }

    // ─── Helper: Build postseasonResults for offseason compatibility ─────────────

    _buildPostseasonResults() {
        const { gameState, engines } = this.ctx;
        const schedule = gameState.playoffSchedule;
        const playoffData = gameState.playoffData;
        
        if (!schedule || !playoffData) return;
        
        // Get champions from finals series
        const getChampion = (tier) => {
            const finalsId = `t${tier}-finals`;
            const state = engines.PlayoffEngine.getSeriesState(schedule, finalsId);
            return state.complete ? state.winner : null;
        };
        
        const getRunnerUp = (tier) => {
            const finalsId = `t${tier}-finals`;
            const state = engines.PlayoffEngine.getSeriesState(schedule, finalsId);
            return state.complete ? state.loser : null;
        };
        
        const getThirdPlace = (tier) => {
            const thirdId = `t${tier}-3rd-place`;
            const state = engines.PlayoffEngine.getSeriesState(schedule, thirdId);
            return state.complete ? state.winner : null;
        };
        
        const getThirdPlaceLoser = (tier) => {
            const thirdId = `t${tier}-3rd-place`;
            const state = engines.PlayoffEngine.getSeriesState(schedule, thirdId);
            return state.complete ? state.loser : null;
        };
        
        const t1Champion = getChampion(1);
        const t2Champion = getChampion(2);
        const t3Champion = getChampion(3);
        
        // Build basic results structure
        const results = {
            t1: {
                champion: t1Champion,
                runnerUp: getRunnerUp(1),
                completed: !!t1Champion
            },
            t2: {
                champion: t2Champion,
                runnerUp: getRunnerUp(2),
                thirdPlaceWinner: getThirdPlace(2),
                thirdPlaceLoser: getThirdPlaceLoser(2),
                completed: !!t2Champion
            },
            t3: {
                champion: t3Champion,
                runnerUp: getRunnerUp(3),
                thirdPlaceWinner: getThirdPlace(3),
                thirdPlaceLoser: getThirdPlaceLoser(3),
                completed: !!t3Champion
            },
            promoted: { toT1: [], toT2: [] },
            relegated: { fromT1: [], fromT2: [] }
        };
        
        // Calculate promotion (T2 → T1)
        // T2 promotion: champion, runner-up, 3rd place winner (or best record if not in top 3)
        if (t2Champion) {
            const t2Sorted = [...gameState.tier2Teams].sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.pointDiff - a.pointDiff;
            });
            const bestRecord = t2Sorted[0];
            
            const promoted = [];
            // Best regular season record always promoted
            promoted.push(bestRecord);
            
            // Champion if different from best record
            if (t2Champion.id !== bestRecord.id) {
                promoted.push(t2Champion);
            }
            
            // Fill remaining from playoff finishers
            const finishOrder = [
                t2Champion,
                results.t2.runnerUp,
                results.t2.thirdPlaceWinner,
                results.t2.thirdPlaceLoser
            ].filter(t => t != null);
            
            for (const team of finishOrder) {
                if (promoted.length >= 3) break;
                if (!promoted.find(p => p.id === team.id)) {
                    promoted.push(team);
                }
            }
            
            // Fallback to regular season if needed
            while (promoted.length < 3) {
                for (const team of t2Sorted) {
                    if (!promoted.find(p => p.id === team.id)) {
                        promoted.push(team);
                        break;
                    }
                }
            }
            
            results.promoted.toT1 = promoted;
        }
        
        // Calculate promotion (T3 → T2)
        // T3 promotion: champion, runner-up, 3rd place winner
        if (t3Champion) {
            const promoted = [];
            if (t3Champion) promoted.push(t3Champion);
            if (results.t3.runnerUp) promoted.push(results.t3.runnerUp);
            if (results.t3.thirdPlaceWinner) promoted.push(results.t3.thirdPlaceWinner);
            results.promoted.toT2 = promoted;
        }
        
        // Calculate relegation (T1 → T2)
        // Bottom 3 teams by regular season record
        if (gameState.tier1Teams) {
            const t1Sorted = [...gameState.tier1Teams].sort((a, b) => {
                if (a.wins !== b.wins) return a.wins - b.wins; // Worst first
                return a.pointDiff - b.pointDiff;
            });
            results.relegated.fromT1 = t1Sorted.slice(0, 3);
        }
        
        // Calculate relegation (T2 → T3)
        // Bottom 3 teams by regular season record
        if (gameState.tier2Teams) {
            const t2Sorted = [...gameState.tier2Teams].sort((a, b) => {
                if (a.wins !== b.wins) return a.wins - b.wins; // Worst first
                return a.pointDiff - b.pointDiff;
            });
            results.relegated.fromT2 = t2Sorted.slice(0, 3);
        }
        
        gameState.postseasonResults = results;
        
        console.log('📊 Built postseasonResults:', {
            t1Champion: t1Champion?.name,
            t2Champion: t2Champion?.name,
            t3Champion: t3Champion?.name,
            promotedToT1: results.promoted.toT1.map(t => t.name),
            promotedToT2: results.promoted.toT2.map(t => t.name),
            relegatedFromT1: results.relegated.fromT1.map(t => t.name),
            relegatedFromT2: results.relegated.fromT2.map(t => t.name)
        });
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
    static _calcPreGameWinProb(userTeam, oppTeam) {
        const avgRating = (team) => {
            const roster = (team.roster || []).slice(0, 8);
            if (!roster.length) return 75;
            return roster.reduce((sum, p) => {
                const off = p.offRating || p.rating || 75;
                const def = p.defRating || p.rating || 75;
                return sum + (off + def) / 2;
            }, 0) / roster.length;
        };

        const userRating = avgRating(userTeam);
        const oppRating  = avgRating(oppTeam);
        const delta = userRating - oppRating;

        // Logistic: k=0.15 → 5pt edge ≈ 69%, 10pt edge ≈ 82%
        // Home court is handled by GamePipeline internally; here we just do ratings
        return 1 / (1 + Math.exp(-0.15 * delta));
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
        const remaining = Math.max(0, TOTAL - elapsedSeconds);

        // Convert margin to user's perspective
        // margin > 0 means home is ahead; flip if user is away
        const userMargin = userIsHome ? margin : -margin;

        // Pre-game advantage adjustment: shift from 0.5 baseline
        // e.g. preGameProb=0.60 → pregameAdj=+1.6 points
        const preGameAdj = (preGameProb - 0.5) * 8;

        // Adjusted margin includes pre-game expectation
        const adjustedMargin = userMargin + preGameAdj;

        // Time pressure: sqrt(remaining) gives gentle early weighting,
        // dramatic convergence in final minutes. k tuned so:
        //   +10 pts at 2 min remaining → ~93%
        //   +10 pts at Q3 start (18 min remaining) → ~79%
        //   +10 pts at tip-off (48 min remaining) → ~68%
        const timePressure = 1 / (Math.sqrt(remaining / 60 + 0.5));
        const k = 0.42;

        const raw = 1 / (1 + Math.exp(-k * adjustedMargin * timePressure));

        // Clamp to [0.02, 0.98] — never show 0% or 100% until game ends
        return Math.min(0.98, Math.max(0.02, raw));
    }
}
