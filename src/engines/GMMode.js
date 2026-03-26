// ═══════════════════════════════════════════════════════════════════
// GMMode — Regular season simulation loop and event routing
// ═══════════════════════════════════════════════════════════════════
// Manages:
//   - Game simulation controls (next game, day, week, finish season)
//   - Calendar-driven simulation with All-Star break detection
//   - Injury/fatigue/trade proposal checks between games
//   - AI-to-AI trade processing during sim
//
// Dependencies passed via constructor deps object:
//   updateNextGames, showSeasonEnd, openRosterManagement,
//   openTradeScreen, saveGameState, checkForAiTradeProposals,
//   checkForInjuries, updateInjuries, processFatigueAfterGame,
//   formatCurrency, getUserTeam, runAllStarWeekend,
//   eventBus, GameEvents, CalendarEngine
// ═══════════════════════════════════════════════════════════════════

export class GMMode {
    constructor(gameState, simulationController, deps = {}) {
        this.gameState = gameState;
        this.sim = simulationController;
        this.deps = deps;
    }
    
    // ============================================
    // SIMULATION CONTROLS
    // ============================================
    
    /**
     * Simulate the user team's next game — advances calendar to that date
     * and simulates ALL games on that date across all tiers
     */
    simulateNextGame() {
        const currentDate = this.gameState.currentDate;
        if (!currentDate) {
            console.error('No current date set!');
            return;
        }
        
        // Check if All-Star break would be crossed
        const seasonDates = this.gameState.seasonDates;
        const allStarStart = this.deps.CalendarEngine.toDateString(seasonDates.allStarStart);
        if (!this.gameState._allStarCompleted && currentDate <= allStarStart) {
            const nextUserDate = this.deps.CalendarEngine.getNextUserGameDate(currentDate, this.gameState);
            if (nextUserDate && nextUserDate > allStarStart) {
                // Catch up to All-Star break first
                let simDate = this.deps.CalendarEngine.addDays(currentDate, 1);
                while (simDate < allStarStart) {
                    this._simulateAllGamesOnDate(simDate, true);
                    simDate = this.deps.CalendarEngine.addDays(simDate, 1);
                }
                this.gameState.currentDate = allStarStart;
                this.deps.saveGameState();
                this.deps.updateUI();
                this.deps.runAllStarWeekend();
                // Advance past break
                const allStarEnd = this.deps.CalendarEngine.toDateString(seasonDates.allStarEnd);
                this.gameState.currentDate = this.deps.CalendarEngine.addDays(allStarEnd, 1);
                this.deps.saveGameState();
                this.deps.updateUI();
                return;
            }
        }
        
        // Find the next date the user team plays
        const nextUserDate = this.deps.CalendarEngine.getNextUserGameDate(currentDate, this.gameState);
        
        if (!nextUserDate) {
            // No more user games — season might be complete
            if (this.gameState.isSeasonComplete()) {
                this.deps.showSeasonEnd();
            } else {
                const nextAnyDate = this.deps.CalendarEngine.getNextGameDate(currentDate, this.gameState);
                if (nextAnyDate) {
                    this.gameState.currentDate = nextAnyDate;
                    this._simulateAllGamesOnDate(nextAnyDate);
                } else {
                    this.deps.showSeasonEnd();
                }
            }
            return;
        }
        
        // Simulate all dates between current and user's next game date
        let simDate = this.deps.CalendarEngine.addDays(currentDate, 1);
        while (simDate < nextUserDate) {
            this._simulateAllGamesOnDate(simDate, true);
            simDate = this.deps.CalendarEngine.addDays(simDate, 1);
        }
        
        // Now simulate the user's game date
        this.gameState.currentDate = nextUserDate;
        this._simulateAllGamesOnDate(nextUserDate, false);
        
        // Show post-game summary for user's game
        this._showPostGameIfUserPlayed(nextUserDate);
        
        this.deps.saveGameState();
        this.deps.updateUI();
        
        if (this.gameState.isSeasonComplete()) {
            this.deps.showSeasonEnd();
        }
    }
    
    /**
     * Simulate all games on the current date, then advance to next day
     */
    simulateDay() {
        const currentDate = this.gameState.currentDate;
        if (!currentDate) return;
        
        this.deps.eventBus.emit(this.deps.GameEvents.SEASON_DAY_SIMULATED, {
            date: currentDate,
            season: this.gameState.season
        });
        
        // Check for All-Star Weekend trigger
        const seasonDates = this.gameState.seasonDates;
        const allStarStart = this.deps.CalendarEngine.toDateString(seasonDates.allStarStart);
        if (currentDate === allStarStart && !this.gameState._allStarCompleted) {
            // Trigger All-Star Weekend event
            this.deps.runAllStarWeekend();
            // Advance past the break
            const allStarEnd = this.deps.CalendarEngine.toDateString(seasonDates.allStarEnd);
            this.gameState.currentDate = this.deps.CalendarEngine.addDays(allStarEnd, 1);
            this.deps.saveGameState();
            this.deps.updateUI();
            return;
        }
        
        // Get games for today
        const todaysGames = this.deps.CalendarEngine.getGamesForDate(currentDate, this.gameState);
        const unplayedToday = todaysGames.tier1.filter(g => !g.played).length +
                             todaysGames.tier2.filter(g => !g.played).length +
                             todaysGames.tier3.filter(g => !g.played).length;
        
        if (unplayedToday > 0) {
            // Simulate today's games
            this._simulateAllGamesOnDate(currentDate, false);

            // Check for pending AI-to-user trade proposal
            if (this.gameState.pendingTradeProposal) {
                this.deps.saveGameState();
                this.deps.updateUI();
                this.deps.showAiTradeProposal();
                return; // User deals with proposal before continuing
            }

            // Process AI-AI trades
            const notable = this.processAiToAiTrades(currentDate);
            if (notable) {
                this.showBreakingNews(notable).then(() => {
                    this._showPostGameIfUserPlayed(currentDate);
                    this.deps.saveGameState();
                    this.deps.updateUI();
                });
                return;
            }

            this._showPostGameIfUserPlayed(currentDate);
            this.deps.saveGameState();
            this.deps.updateUI();
        } else {
            // No games today — check for calendar event or just show off day
            const calEvent = this.deps.CalendarEngine.getCalendarEvent(currentDate, seasonDates);
            
            // Advance to next day
            const nextDate = this.deps.CalendarEngine.addDays(currentDate, 1);
            const seasonEnd = this.deps.CalendarEngine.toDateString(seasonDates.seasonEnd);
            
            if (nextDate > seasonEnd && this.gameState.isSeasonComplete()) {
                this.deps.showSeasonEnd();
                return;
            }
            
            this.gameState.currentDate = nextDate;
            this.deps.saveGameState();
            this.deps.updateUI();
            
            // Show appropriate message
            if (calEvent) {
                this._showDayMessage(calEvent, currentDate);
            } else {
 this._showDayMessage('No games today', currentDate);
            }
        }
        
        if (this.gameState.isSeasonComplete()) {
            this.deps.showSeasonEnd();
        }
    }
    
    /**
     * Simulate a full week (7 calendar days)
     */
    simulateWeek() {
        const startDate = this.gameState.currentDate;
        if (!startDate) return;
        
        // Check if All-Star break falls within this week
        const seasonDates = this.gameState.seasonDates;
        const allStarStart = this.deps.CalendarEngine.toDateString(seasonDates.allStarStart);
        const endDate = this.deps.CalendarEngine.addDays(startDate, 7);
        
        if (!this.gameState._allStarCompleted && startDate <= allStarStart && endDate > allStarStart) {
            // Simulate up to All-Star break, then trigger it
            let simDate = startDate;
            while (simDate < allStarStart) {
                const games = this.deps.CalendarEngine.getGamesForDate(simDate, this.gameState);
                const unplayed = games.tier1.filter(g => !g.played).length +
                               games.tier2.filter(g => !g.played).length +
                               games.tier3.filter(g => !g.played).length;
                if (unplayed > 0) this._simulateAllGamesOnDate(simDate, true);
                simDate = this.deps.CalendarEngine.addDays(simDate, 1);
            }
            this.gameState.currentDate = allStarStart;
            this.deps.saveGameState();
            this.deps.updateUI();
            this.deps.runAllStarWeekend();
            // Advance past break
            const allStarEnd = this.deps.CalendarEngine.toDateString(seasonDates.allStarEnd);
            this.gameState.currentDate = this.deps.CalendarEngine.addDays(allStarEnd, 1);
            this.deps.saveGameState();
            this.deps.updateUI();
            return;
        }
        
        let simDate = startDate;
        
        while (simDate < endDate) {
            if (this.gameState.isSeasonComplete()) {
                this.deps.showSeasonEnd();
                break;
            }
            
            const games = this.deps.CalendarEngine.getGamesForDate(simDate, this.gameState);
            const unplayed = games.tier1.filter(g => !g.played).length +
                           games.tier2.filter(g => !g.played).length +
                           games.tier3.filter(g => !g.played).length;
            
            if (unplayed > 0) {
                this._simulateAllGamesOnDate(simDate, true); // silent for batch
            }

            // Check if we need to interrupt for a user injury decision
            if (this.gameState.pendingInjuries && this.gameState.pendingInjuries.length > 0) {
                this.gameState.currentDate = this.deps.CalendarEngine.addDays(simDate, 1);
                this.deps.saveGameState();
                this.deps.updateUI();
                window._resumeAfterInjuries = () => {
                    delete window._resumeAfterInjuries;
                    this._resumeSimWeek(this.gameState.currentDate, endDate);
                };
                this.deps.showNextInjuryModal();
                return;
            }

            // Process AI-AI trades
            const notable = this.processAiToAiTrades(simDate);

            // Check if we need to interrupt for a user trade proposal or breaking news
            if (this.gameState.pendingTradeProposal) {
                if (window._gameSettings?.autoDeclineTrades) {
                    // Auto-decline: clear proposal and continue sim
                    this.gameState.pendingTradeProposal = null;
                } else {
                    // AI wants to trade with user — pause sim and show proposal
                    this.gameState.currentDate = this.deps.CalendarEngine.addDays(simDate, 1);
                    this.deps.saveGameState();
                    this.deps.updateUI();
                    window._resumeAfterAiTrade = () => {
                        delete window._resumeAfterAiTrade;
                        this._resumeSimWeek(this.gameState.currentDate, endDate);
                    };
                    this.deps.showAiTradeProposal();
                    return;
                }
            }

            if (notable) {
                // Notable AI-AI trade — pause for Breaking News, then resume
                this.gameState.currentDate = this.deps.CalendarEngine.addDays(simDate, 1);
                this.deps.saveGameState();
                this.deps.updateUI();
                this.showBreakingNews(notable).then(() => {
                    // Resume simming the remaining days
                    this._resumeSimWeek(this.gameState.currentDate, endDate);
                });
                return;
            }
            
            simDate = this.deps.CalendarEngine.addDays(simDate, 1);
        }
        
        this.gameState.currentDate = endDate;
        this.deps.saveGameState();
        this.deps.updateUI();
        
        if (this.gameState.isSeasonComplete()) {
            this.deps.showSeasonEnd();
        }
    }

    /**
     * Resume a Sim Week after a Breaking News interruption.
     * @param {string} fromDate - Current date to resume from
     * @param {string} endDate - Original end date of the week
     */
    _resumeSimWeek(fromDate, endDate) {
        let simDate = fromDate;
        while (simDate < endDate) {
            if (this.gameState.isSeasonComplete()) { this.deps.showSeasonEnd(); return; }

            const games = this.deps.CalendarEngine.getGamesForDate(simDate, this.gameState);
            const unplayed = games.tier1.filter(g => !g.played).length +
                           games.tier2.filter(g => !g.played).length +
                           games.tier3.filter(g => !g.played).length;
            if (unplayed > 0) this._simulateAllGamesOnDate(simDate, true);

            // Interrupt for user injury
            if (this.gameState.pendingInjuries && this.gameState.pendingInjuries.length > 0) {
                this.gameState.currentDate = this.deps.CalendarEngine.addDays(simDate, 1);
                this.deps.saveGameState(); this.deps.updateUI();
                window._resumeAfterInjuries = () => {
                    delete window._resumeAfterInjuries;
                    this._resumeSimWeek(this.gameState.currentDate, endDate);
                };
                this.deps.showNextInjuryModal();
                return;
            }

            const notable = this.processAiToAiTrades(simDate);

            if (this.gameState.pendingTradeProposal) {
                if (window._gameSettings?.autoDeclineTrades) {
                    this.gameState.pendingTradeProposal = null;
                } else {
                    this.gameState.currentDate = this.deps.CalendarEngine.addDays(simDate, 1);
                    this.deps.saveGameState(); this.deps.updateUI();
                    window._resumeAfterAiTrade = () => {
                        delete window._resumeAfterAiTrade;
                        this._resumeSimWeek(this.gameState.currentDate, endDate);
                    };
                    this.deps.showAiTradeProposal();
                    return;
                }
            }
            if (notable) {
                this.gameState.currentDate = this.deps.CalendarEngine.addDays(simDate, 1);
                this.deps.saveGameState(); this.deps.updateUI();
                this.showBreakingNews(notable).then(() => this._resumeSimWeek(this.gameState.currentDate, endDate));
                return;
            }

            simDate = this.deps.CalendarEngine.addDays(simDate, 1);
        }
        this.gameState.currentDate = endDate;
        this.deps.saveGameState(); this.deps.updateUI();
        if (this.gameState.isSeasonComplete()) this.deps.showSeasonEnd();
    }
    
    /**
     * Show a brief day message (off day, calendar event, etc.)
     * Currently a no-op — the legacy nextGamesContainer div was removed.
     * TODO: Replace with React toast/notification system.
     */
    _showDayMessage(message, dateStr) {
        // No-op: legacy DOM target removed. Callers preserved for future toast system.
    }
    
    /**
     * Core: Simulate ALL games on a specific date across all tiers
     * @param {string} dateStr - YYYY-MM-DD
     * @param {boolean} silent - If true, skip injury modals (for batch sims)
     */
    _simulateAllGamesOnDate(dateStr, silent = false) {
        const todaysGames = this.deps.CalendarEngine.getGamesForDate(dateStr, this.gameState);
        const userTeam = this.deps.getUserTeam();
        const userTeamId = userTeam ? userTeam.id : null;
        let userTeamPlayedToday = false;
        
        // Helper to sim a list of games for a tier
        const simTierGames = (games, teams, isSilent) => {
            for (const game of games) {
                if (game.played) continue;
                
                const homeTeam = teams.find(t => t.id === game.homeTeamId);
                const awayTeam = teams.find(t => t.id === game.awayTeamId);
                
                if (!homeTeam || !awayTeam) {
                    console.warn(`Teams not found for game on ${dateStr}:`, game);
                    game.played = true;
                    continue;
                }
                
                // Check if this is a user team game
                const isUserGame = (game.homeTeamId === userTeamId || game.awayTeamId === userTeamId);
                if (isUserGame) userTeamPlayedToday = true;
                
                // Apply fatigue auto-rest
                this.deps.applyFatigueAutoRest(homeTeam, false);
                this.deps.applyFatigueAutoRest(awayTeam, false);
                
                // Simulate - only track win probability for user games to save memory
                // Use lightweight mode for non-user games (skips events and detailed stats)
                const gameResult = this.sim.simulateFullGame(homeTeam, awayTeam, false, isUserGame, !isUserGame);
                game.played = true;
                game.homeScore = gameResult.homeScore;
                game.awayScore = gameResult.awayScore;
                game.winnerId = gameResult.winner.id;
                
                // Store detailed box score for user team games only (storage efficient)
                if (isUserGame && gameResult.homePlayerStats && gameResult.awayPlayerStats) {
                    game.boxScore = {
                        home: {
                            teamId: homeTeam.id,
                            teamName: homeTeam.name,
                            city: homeTeam.city || '',
                            score: gameResult.homeScore,
                            players: gameResult.homePlayerStats
                                .filter(p => p.minutesPlayed > 0)
                                .sort((a, b) => b.minutesPlayed - a.minutesPlayed)
                                .map(p => ({
                                    name: p.playerName, pos: p.position, 
                                    min: p.minutesPlayed, pts: p.points, 
                                    reb: p.rebounds, ast: p.assists, 
                                    stl: p.steals, blk: p.blocks,
                                    to: p.turnovers, pf: p.fouls,
                                    fgm: p.fieldGoalsMade, fga: p.fieldGoalsAttempted,
                                    tpm: p.threePointersMade, tpa: p.threePointersAttempted,
                                    ftm: p.freeThrowsMade, fta: p.freeThrowsAttempted,
                                    starter: p.gamesStarted > 0, pm: p.plusMinus || 0
                                }))
                        },
                        away: {
                            teamId: awayTeam.id,
                            teamName: awayTeam.name,
                            city: awayTeam.city || '',
                            score: gameResult.awayScore,
                            players: gameResult.awayPlayerStats
                                .filter(p => p.minutesPlayed > 0)
                                .sort((a, b) => b.minutesPlayed - a.minutesPlayed)
                                .map(p => ({
                                    name: p.playerName, pos: p.position, 
                                    min: p.minutesPlayed, pts: p.points, 
                                    reb: p.rebounds, ast: p.assists, 
                                    stl: p.steals, blk: p.blocks,
                                    to: p.turnovers, pf: p.fouls,
                                    fgm: p.fieldGoalsMade, fga: p.fieldGoalsAttempted,
                                    tpm: p.threePointersMade, tpa: p.threePointersAttempted,
                                    ftm: p.freeThrowsMade, fta: p.freeThrowsAttempted,
                                    starter: p.gamesStarted > 0, pm: p.plusMinus || 0
                                }))
                        },
                        quarterScores: gameResult.quarterScores || null,
                        winProbHistory: gameResult.winProbHistory || null,
                        preGameProb: gameResult.preGameProb || null
                    };
                }
                
                // Emit game completed event
                this.deps.eventBus.emit(this.deps.GameEvents.SEASON_GAME_COMPLETED, {
                    date: dateStr,
                    homeTeamId: homeTeam.id,
                    awayTeamId: awayTeam.id,
                    homeScore: gameResult.homeScore,
                    awayScore: gameResult.awayScore,
                    isUserGame: isUserGame,
                    homeWins: homeTeam.wins,
                    homeLosses: homeTeam.losses,
                    awayWins: awayTeam.wins,
                    awayLosses: awayTeam.losses
                });
                
                // Process fatigue
                this.deps.processFatigueAfterGame(homeTeam, awayTeam, false);
                
                // Update injuries
                this.deps.updateInjuries(homeTeam);
                this.deps.updateInjuries(awayTeam);
                
                // Check injuries
                if (isUserGame) {
                    const userGamesPlayed = userTeam ? (userTeam.wins + userTeam.losses) : 0;
                    const injuries = this.deps.checkForInjuries(homeTeam, awayTeam, userGamesPlayed, false);
                    
                    const userTeamInjuries = injuries.filter(inj => inj.team.id === userTeamId);
                    const aiTeamInjuries = injuries.filter(inj => inj.team.id !== userTeamId);
                    
                    aiTeamInjuries.forEach(({team, player, injury}) => {
                        const aiDecision = injury.canPlayThrough && Math.random() < 0.3 ? 'playThrough' : 'rest';
                        this.deps.applyInjury(player, injury, aiDecision);
                    });
                    
                    if (userTeamInjuries.length > 0) {
                        // Store pending injuries — caller decides when to show modal
                        this.gameState.pendingInjuries = userTeamInjuries;
                        if (!isSilent) {
                            // In single-day sim, show immediately
                            this.deps.saveGameState();
                            this.deps.updateUI();
                            this.deps.showNextInjuryModal();
                        }
                        return; // Exit this tier's game loop
                    }
                } else {
                    // Silent mode or AI game — auto-handle injuries
                    const userGamesPlayed = userTeam ? (userTeam.wins + userTeam.losses) : 0;
                    const injuries = this.deps.checkForInjuries(homeTeam, awayTeam, userGamesPlayed, false);
                    injuries.forEach(({team, player, injury}) => {
                        const aiDecision = injury.canPlayThrough && Math.random() < 0.3 ? 'playThrough' : 'rest';
                        this.deps.applyInjury(player, injury, aiDecision);
                    });
                }
            }
        };
        
        // Simulate each tier's games for today
        simTierGames(todaysGames.tier1, this.gameState.tier1Teams, silent || !todaysGames.tier1.some(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId));
        simTierGames(todaysGames.tier2, this.gameState.tier2Teams, silent || !todaysGames.tier2.some(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId));
        simTierGames(todaysGames.tier3, this.gameState.tier3Teams, silent || !todaysGames.tier3.some(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId));
        
        // Check for AI-to-user trade proposals (runs during all sim modes)
        if (userTeamPlayedToday && this.deps.checkForAiTradeProposals) {
            this.deps.checkForAiTradeProposals();
        }
    }
    
    /**
     * Show post-game summary popup if the user's team played on this date
     */
    _showPostGameIfUserPlayed(dateStr) {
        const userTeam = this.deps.getUserTeam();
        if (!userTeam) return;
        
        const todaysGames = this.deps.CalendarEngine.getGamesForDate(dateStr, this.gameState);
        const allGames = [...(todaysGames.tier1 || []), ...(todaysGames.tier2 || []), ...(todaysGames.tier3 || [])];
        
        const userGame = allGames.find(g => 
            g.played && (g.homeTeamId === userTeam.id || g.awayTeamId === userTeam.id) && g.boxScore
        );
        
        if (!userGame) return;
        
        const isHome = userGame.homeTeamId === userTeam.id;
        const userWon = userGame.winnerId === userTeam.id;
        const userBox = isHome ? userGame.boxScore.home : userGame.boxScore.away;
        const oppBox = isHome ? userGame.boxScore.away : userGame.boxScore.home;
        
        // Find top performer on user team
        const topPlayer = userBox.players.length > 0 
            ? userBox.players.reduce((best, p) => p.pts > best.pts ? p : best, userBox.players[0])
            : null;

        const postGamePayload = {
            userTeam: userBox,
            opponent: oppBox,
            isHome,
            userWon,
            topPlayer,
            date: dateStr,
            userRecord: { wins: userTeam.wins, losses: userTeam.losses },
            quarterScores: userGame.boxScore.quarterScores || null,
        };

        // Dispatch to React modal
        if (window._reactShowPostGame) {
            window._reactShowPostGame(postGamePayload);
        }
    }
    
    /**
     * Finish the rest of the season
     */
    finishSeason() {
        // If we're in the offseason, resume from current phase instead of simulating
        if (this.gameState.offseasonPhase && this.gameState.offseasonPhase !== 'none') {
            console.log('📅 Finish Season clicked during offseason — resuming offseason flow');
            this.deps.resumeOffseason();
            return;
        }
        
        // If All-Star hasn't happened yet, run it silently
        if (!this.gameState._allStarCompleted) {
            const seasonDates = this.gameState.seasonDates;
            const allStarStart = this.deps.CalendarEngine.toDateString(seasonDates.allStarStart);
            if (this.gameState.currentDate <= allStarStart) {
                console.log('⭐ Running All-Star selection silently for Finish Season...');
                const tierConfigs = [
                    { teams: this.gameState.tier1Teams, tier: 1, label: 'Tier 1', minPct: 0.4 },
                    { teams: this.gameState.tier2Teams, tier: 2, label: 'Tier 2', minPct: 0.35 },
                    { teams: this.gameState.tier3Teams, tier: 3, label: 'Tier 3', minPct: 0.3 }
                ];
                const results = [];
                for (const config of tierConfigs) {
                    console.log(`  ⭐ Processing ${config.label}...`);
                    const gamesPerTeam = config.tier === 1 ? 82 : config.tier === 2 ? 60 : 40;
                    const minGames = Math.floor(gamesPerTeam * config.minPct);
                    console.log(`    - minGames: ${minGames}, teams: ${config.teams?.length || 0}`);
                    const confMap = this.deps.buildConferenceMap(config.teams, config.tier);
                    console.log(`    - confMap built`);
                    const selections = StatEngine.selectAllStars(config.teams, minGames, confMap);
                    console.log(`    - selections: east=${selections.east?.length || 0}, west=${selections.west?.length || 0}`);
                    const gameResult = StatEngine.simulateAllStarGame(selections.east, selections.west, config.label);
                    console.log(`    - game simulated: ${gameResult.eastScore}-${gameResult.westScore}`);
                    results.push({ ...config, selections, gameResult });
                }
                console.log('⭐ All-Star selection complete');
                this.gameState._allStarCompleted = true;
                this.gameState._allStarResults = results;
            }
        }
        console.log('🏁 Calling finishSeasonBatch...');
        this.finishSeasonBatch();
    }
    
    /**
     * Finish season in batches to prevent freezing
     */
    finishSeasonBatch() {
        const batchSize = 50;
        let gamesSimulated = 0;
        
        console.log('🎯 GMMode.finishSeasonBatch() - calendar-aware batch sim');
        
        // Early exit if already complete
        if (this.gameState.isSeasonComplete()) {
            console.log('✅ Season already complete — showing end screen');
            this.deps.saveGameState();
            this.deps.updateUI();
            this.deps.showSeasonEnd();
            return;
        }
        
        let safetyCounter = 0;
        const maxDays = 250;
        
        while (!this.gameState.isSeasonComplete() && safetyCounter < maxDays) {
            safetyCounter++;
            const currentDate = this.gameState.currentDate;
            
            // Diagnostic: log every 10 iterations
            if (safetyCounter % 10 === 0) {
                console.log(`🔄 finishSeasonBatch iteration ${safetyCounter}, date: ${currentDate}, games simulated: ${gamesSimulated}`);
            }
            
            // Check for All-Star Weekend
            const seasonDates = this.gameState.seasonDates;
            if (seasonDates && !this.gameState._allStarCompleted) {
                const allStarStart = this.deps.CalendarEngine.toDateString(seasonDates.allStarStart);
                if (currentDate === allStarStart) {
                    console.log('⭐ finishSeasonBatch: Triggering All-Star Weekend');
                    this.deps.saveGameState();
                    this.deps.updateUI();
                    // Run All-Star and set callback to resume
                    window._allStarContinueCallback = () => {
                        delete window._allStarContinueCallback;
                        // Skip past All-Star weekend
                        const allStarEnd = this.deps.CalendarEngine.toDateString(seasonDates.allStarEnd);
                        this.gameState.currentDate = this.deps.CalendarEngine.addDays(allStarEnd, 1);
                        this.finishSeasonBatch();
                    };
                    this.deps.runAllStarWeekend();
                    return;
                }
            }
            
            const todaysGames = this.deps.CalendarEngine.getGamesForDate(currentDate, this.gameState);
            const unplayed = todaysGames.tier1.filter(g => !g.played).length +
                           todaysGames.tier2.filter(g => !g.played).length +
                           todaysGames.tier3.filter(g => !g.played).length;
            
            // Diagnostic: log if simulating games
            if (unplayed > 0 && safetyCounter <= 3) {
                console.log(`📅 Day ${safetyCounter} (${currentDate}): simulating ${unplayed} games`);
            }
            
            if (unplayed > 0) {
                this._simulateAllGamesOnDate(currentDate, true);
                gamesSimulated += unplayed;
            }

            // Interrupt for user injury decision
            if (this.gameState.pendingInjuries && this.gameState.pendingInjuries.length > 0) {
                this.gameState.currentDate = this.deps.CalendarEngine.addDays(currentDate, 1);
                this.deps.saveGameState();
                this.deps.updateUI();
                // Set resume callback so finishSeasonBatch resumes after all injuries are handled
                window._resumeAfterInjuries = () => {
                    delete window._resumeAfterInjuries;
                    this.finishSeasonBatch();
                };
                this.deps.showNextInjuryModal();
                return;
            }

            // Process AI-AI trades
            const notable = this.processAiToAiTrades(currentDate);
            
            // Advance to next day
            this.gameState.currentDate = this.deps.CalendarEngine.addDays(currentDate, 1);

            // Interrupt for AI-to-user trade proposal
            if (this.gameState.pendingTradeProposal) {
                if (window._gameSettings?.autoDeclineTrades) {
                    this.gameState.pendingTradeProposal = null;
                } else {
                    this.deps.saveGameState();
                    this.deps.updateUI();
                    window._resumeAfterAiTrade = () => {
                        delete window._resumeAfterAiTrade;
                        this.finishSeasonBatch();
                    };
                    this.deps.showAiTradeProposal();
                    return;
                }
            }

            // Interrupt for notable AI-AI trade (Breaking News)
            if (notable) {
                this.deps.saveGameState();
                this.deps.updateUI();
                this.showBreakingNews(notable).then(() => {
                    // Resume finishing season
                    this.finishSeasonBatch();
                });
                return;
            }
            
            // Break for UI update every batch
            if (gamesSimulated >= batchSize) {
                this.deps.saveGameState();
                this.deps.updateUI();
                
                if (this.gameState.isSeasonComplete()) {
                    this.deps.showSeasonEnd();
                } else {
                    setTimeout(() => this.finishSeasonBatch(), 10);
                }
                return;
            }
        }
        
        // If we exhausted the date range but games remain, sim them directly
        // This catches orphaned games whose dates were skipped
        if (!this.gameState.isSeasonComplete()) {
            console.log('🔧 Cleaning up orphaned unplayed games...');
            const tierConfigs = [
                { schedule: this.gameState._tier1Schedule, teams: this.gameState.tier1Teams, tier: 1 },
                { schedule: this.gameState._tier2Schedule, teams: this.gameState.tier2Teams, tier: 2 },
                { schedule: this.gameState._tier3Schedule, teams: this.gameState.tier3Teams, tier: 3 }
            ];
            for (const { schedule, teams, tier } of tierConfigs) {
                if (!schedule || !teams) continue;
                const unplayed = schedule.filter(g => !g.played);
                if (unplayed.length > 0) {
                    console.log(`  Tier ${tier}: ${unplayed.length} orphaned games`);
                }
                for (const game of unplayed) {
                    const home = teams.find(t => t.id === game.homeTeamId);
                    const away = teams.find(t => t.id === game.awayTeamId);
                    if (!home || !away) { game.played = true; continue; }
                    
                    // No win probability tracking for orphan games (memory optimization)
                    // Use lightweight mode (skips events and detailed stats)
                    const result = this.sim.simulateFullGame(home, away, false, false, true);
                    game.played = true;
                    game.homeScore = result.homeScore;
                    game.awayScore = result.awayScore;
                    game.winnerId = result.winner.id;
                    this.deps.processFatigueAfterGame(home, away, false);
                    this.deps.updateInjuries(home);
                    this.deps.updateInjuries(away);
                    const userGamesPlayed = this.deps.getUserTeam() ? (this.deps.getUserTeam().wins + this.deps.getUserTeam().losses) : 0;
                    const injuries = this.deps.checkForInjuries(home, away, userGamesPlayed, false);
                    injuries.forEach(({team, player, injury}) => {
                        const aiDecision = injury.canPlayThrough && Math.random() < 0.3 ? 'playThrough' : 'rest';
                        this.deps.applyInjury(player, injury, aiDecision);
                    });
                }
            }
        }
        
        // Final save and season end
        this.deps.saveGameState();
        this.deps.updateUI();
        
        console.log(`finishSeasonBatch done: ${gamesSimulated} games, seasonComplete=${this.gameState.isSeasonComplete()}, safety=${safetyCounter}`);
        
        if (this.gameState.isSeasonComplete()) {
            this.deps.showSeasonEnd();
        }
    }
    
    /**
    // ============================================
    // UI UPDATES
    // ============================================
    
    /**
     * Refresh UI after simulation. Legacy DOM code removed — React handles all rendering.
     * Still called by GameSimController and others to signal state changes.
     */
    updateUI() {
        if (this.deps.updateNextGames) this.deps.updateNextGames();
    }
    
    /**
     * Show season end modal
     */
    showSeasonEnd() {
        if (this.deps.showSeasonEnd) {
            this.deps.showSeasonEnd();
        } else {
            console.error('showSeasonEnd function not found!');
        }
    }
    
    // ============================================
    // TEAM MANAGEMENT
    // ============================================
    
    /**
     * Open roster management screen
     */
    openRosterManagement() {
        // Calls Hub function to set proper context
        if (this.deps.openRosterManagementHub) {
            this.deps.openRosterManagementHub();
        } else if (this.deps.openRosterManagement) {
            // Fallback for backward compatibility
            this.deps.openRosterManagement();
        }
    }
    
    /**
     * Open trade screen
     */
    openTradeScreen() {
        // Calls existing function (backward compatibility)
        if (this.deps.openTradeScreen) {
            this.deps.openTradeScreen();
        }
    }
    
    /**
     * Check for AI trade proposals (to user)
     */
    checkForAiTradeProposals() {
        if (this.deps.checkForAiTradeProposals) {
            this.deps.checkForAiTradeProposals();
        }
    }

    /**
     * Process AI-to-AI trades for the current date.
     * Called from all sim paths (simulateDay, simulateWeek, finishSeason).
     * 
     * Trade frequency targets (50-100% of team count per season):
     *   T1: 15-30 trades across ~180 game days → ~0.12/day avg
     *   T2: 43-86 trades across ~140 game days → ~0.46/day avg
     *   T3: 72-144 trades across ~100 game days → ~1.08/day avg
     * 
     * @param {string} currentDate - Today's date string
     * @returns {Object|null} Notable trade for Breaking News, or null
     */
    processAiToAiTrades(currentDate) {
        const gs = this.gameState;

        // Skip if same date already processed
        if (gs.lastAiToAiTradeDate === currentDate) return null;
        gs.lastAiToAiTradeDate = currentDate;

        // Trade deadline: 75% of season
        const seasonDates = gs.seasonDates;
        if (!seasonDates) return null;
        const deadlineDate = this.deps.CalendarEngine.toDateString(seasonDates.tradeDeadline);
        if (!deadlineDate || currentDate > deadlineDate) return null;

        // Deadline proximity multiplier: trades ramp up in the 2 weeks before deadline
        let urgencyMultiplier = 1.0;
        const daysUntilDeadline = this.deps.CalendarEngine.daysBetween(currentDate, deadlineDate);
        if (daysUntilDeadline <= 7) urgencyMultiplier = 3.0;
        else if (daysUntilDeadline <= 14) urgencyMultiplier = 2.0;

        const helpers = this.deps;
        const TradeEngine = this.deps.engines?.TradeEngine || this.deps.TradeEngine;
        if (!TradeEngine) return null;

        let notableTrade = null;

        // Process each tier
        const tierConfigs = [
            { teams: gs.tier1Teams, tier: 1, dailyRate: 0.12, label: 'Tier 1' },
            { teams: gs.tier2Teams, tier: 2, dailyRate: 0.46, label: 'Tier 2' },
            { teams: gs.tier3Teams, tier: 3, dailyRate: 1.08, label: 'Tier 3' }
        ];

        for (const config of tierConfigs) {
            if (!config.teams || config.teams.length === 0) continue;

            // Determine how many trades to attempt today
            const adjustedRate = config.dailyRate * urgencyMultiplier;
            let tradesToAttempt = 0;
            // Guaranteed trades + fractional chance
            tradesToAttempt = Math.floor(adjustedRate);
            if (Math.random() < (adjustedRate - tradesToAttempt)) tradesToAttempt++;

            for (let i = 0; i < tradesToAttempt; i++) {
                const proposal = TradeEngine.generateAiToAiTrade({
                    teams: config.teams,
                    userTeamId: gs.userTeamId,
                    calculatePickValue: helpers.calculatePickValue || (() => 0),
                    getEffectiveCap: helpers.getEffectiveCap,
                    calculateTeamSalary: helpers.calculateTeamSalary,
                    formatCurrency: helpers.formatCurrency || (v => `$${v}`)
                });

                if (!proposal) continue;

                // Execute the trade
                const result = TradeEngine.executeTrade({
                    team1: proposal.team1,
                    team2: proposal.team2,
                    team1GivesPlayerIds: proposal.team1Gives.map(p => p.id),
                    team2GivesPlayerIds: proposal.team2Gives.map(p => p.id),
                    team1GivesPicks: proposal.team1GivesPicks || [],
                    team2GivesPicks: proposal.team2GivesPicks || [],
                    applyTradePenalty: helpers.applyTradePenalty || (() => {}),
                    initializePlayerChemistry: helpers.initializePlayerChemistry || ((p) => { p.chemistry = 50; p.gamesWithTeam = 0; }),
                    tradeDraftPick: helpers.tradeDraftPick || (() => {})
                });

                // Log to trade history
                const tradeRecord = {
                    season: gs.currentSeason,
                    date: currentDate,
                    tier: config.tier,
                    team1: { id: proposal.team1.id, name: proposal.team1.name },
                    team2: { id: proposal.team2.id, name: proposal.team2.name },
                    team1Gave: proposal.team1Gives.map(p => ({ id: p.id, name: p.name, position: p.position, rating: p.rating })),
                    team2Gave: proposal.team2Gives.map(p => ({ id: p.id, name: p.name, position: p.position, rating: p.rating })),
                    type: 'ai-ai'
                };
                gs.tradeHistory.push(tradeRecord);

                console.log(`🔄 ${config.label} Trade: ${proposal.team1.name} sends ${proposal.team1Gives.map(p => p.name).join(', ')} to ${proposal.team2.name} for ${proposal.team2Gives.map(p => p.name).join(', ')}`);

                // Check if notable (for Breaking News)
                if (!notableTrade && TradeEngine.isNotableTrade(proposal)) {
                    notableTrade = tradeRecord;
                }
            }
        }

        return notableTrade;
    }

    /**
     * Show Breaking News modal for a notable AI-AI trade.
     * Returns a Promise that resolves when the user dismisses it.
     */
    showBreakingNews(trade) {
        // Settings: skip Breaking News modal if disabled
        if (window._gameSettings?.showBreakingNews === false) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const t1Gave = trade.team1Gave.map(p => `${p.name} (${p.position}, ${p.rating} OVR)`).join(', ');
            const t2Gave = trade.team2Gave.map(p => `${p.name} (${p.position}, ${p.rating} OVR)`).join(', ');
            const tierLabel = trade.tier === 1 ? 'NAPL' : trade.tier === 2 ? 'NARBL' : 'MBL';

            if (window._reactShowBreakingNews) {
                window._reactShowBreakingNews({
                    team1Name: trade.team1.name,
                    team2Name: trade.team2.name,
                    t1Gave,
                    t2Gave,
                    tierLabel,
                }, resolve);
                return;
            }

            const overlay = document.createElement('div');
            overlay.id = 'breakingNewsOverlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85); z-index: 10001;
                display: flex; align-items: center; justify-content: center;
                animation: fadeIn 0.3s ease;
            `;
            overlay.innerHTML = `
                <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border: 2px solid #ea4335;
                            border-radius: 16px; padding: 30px 40px; max-width: 550px; width: 90%;
                            box-shadow: 0 0 40px rgba(234,67,53,0.3); text-align: center;">
                    <div style="color: #ea4335; font-size: 0.85em; font-weight: bold; letter-spacing: 3px; margin-bottom: 8px;">
 BREAKING NEWS 
                    </div>
                    <div style="font-size: 1.4em; font-weight: bold; margin-bottom: 20px; line-height: 1.3;">
                        ${tierLabel} Trade Alert
                    </div>
                    <div style="display: flex; gap: 20px; align-items: stretch; margin-bottom: 20px;">
                        <div style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px;">
                            <div style="font-weight: bold; color: #fbbc04; margin-bottom: 8px;">${trade.team1.name}</div>
                            <div style="font-size: 0.85em; opacity: 0.7; margin-bottom: 6px;">Sends:</div>
                            <div style="font-size: 0.95em;">${t1Gave}</div>
                        </div>
 <div style="display: flex; align-items: center; font-size: 1.5em; opacity: 0.5;"></div>
                        <div style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px;">
                            <div style="font-weight: bold; color: #fbbc04; margin-bottom: 8px;">${trade.team2.name}</div>
                            <div style="font-size: 0.85em; opacity: 0.7; margin-bottom: 6px;">Sends:</div>
                            <div style="font-size: 0.95em;">${t2Gave}</div>
                        </div>
                    </div>
                    <button id="breakingNewsDismiss" class="primary" style="padding: 10px 30px; font-size: 1em;">
                        Continue
                    </button>
                </div>
            `;
            document.body.appendChild(overlay);
            document.getElementById('breakingNewsDismiss').onclick = () => {
                overlay.remove();
                resolve();
            };
        });
    }
    
    // ============================================
    // SAVE / LOAD
    // ============================================
    
    /**
     * Save game state
     */
    saveGameState() {
        StorageEngine.save(this.gameState).catch(err => {
            console.error('Save failed:', err.message);
        });
    }
    
}
