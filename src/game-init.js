    window._initGame = function() {
        // ═══════════════════════════════════════════════════════════════════
        // Variable declarations (required for strict mode in ES modules)
        // Only gameState needs explicit declaration - others are declared later in the code
        // ═══════════════════════════════════════════════════════════════════
        let gameState;
        
        // Aliases for window globals (set by index.jsx before _initGame is called)
        const { eventBus, GameEvents, StorageEngine, GameState, TeamFactory, 
                PlayerAttributes, CoachEngine, FinanceEngine, FreeAgencyEngine,
                PlayerDevelopmentEngine, LeagueManager, SalaryCapEngine, 
                DivisionManager, CalendarEngine, StatEngine, PlayoffEngine,
                TradeEngine, DraftEngine, ChemistryEngine, InjuryEngine,
                FatigueEngine, GMMode, ScoutingEngine, OwnerEngine,
                LoanEngine,
                OffseasonController, TradeController, DraftController,
                GameSimController, PlayoffSimController, FinanceController, RosterController,
                FreeAgencyController, DashboardController, CoachManagementController,
                SaveLoadController, TrainingCampEngine, UIHelpers } = window;

        // ============================================
        // 🏀 REFACTORED ARCHITECTURE - INCREMENTAL APPROACH
        // ============================================
        // This section adds the new modular architecture while keeping
        // all existing code working. Nothing breaks!

        // ─── OffseasonController (lazy init) ───
        let _offseasonController = null;
        function getOffseasonController() {
            if (!_offseasonController) {
                _offseasonController = new window.OffseasonController({
                    gameState, eventBus, GameEvents,
                    engines: { PlayoffEngine, CalendarEngine, CoachEngine, StatEngine, FinanceEngine, FreeAgencyEngine, StorageEngine, PlayerDevelopmentEngine, PlayerAttributes, TeamFactory, LeagueManager, SalaryCapEngine, DivisionManager, DraftEngine, TrainingCampEngine },
                    helpers: {
                        getUserTeam, getTeamById, formatCurrency, getRatingColor,
                        getEffectiveCap, calculateTeamSalary, getRemainingCap, getSalaryCap,
                        generateSalary, determineContractLength, initializePlayerChemistry,
                        ensureRosterExists, assignDivision,
                        balanceTier1Divisions: () => DivisionManager.balanceTier1(gameState.tier1Teams),
                        balanceTier2Divisions: () => DivisionManager.balanceTier2(gameState.tier2Teams),
                        balanceTier3Divisions: () => DivisionManager.balanceTier3(gameState.tier3Teams),
                        sortTeamsByStandings,
                        applyParachutePayment: (...args) => SalaryCapEngine.applyParachutePayment(...args),
                        applyPromotionBonus: (...args) => SalaryCapEngine.applyPromotionBonus(...args),
                        getMarketValue,
                        getRetirementProbability: (...args) => PlayerDevelopmentEngine.getRetirementProbability(...args),
                        saveGameState, updateUI: () => getDashboardController().refresh(),
                        developTeamPlayers: (team, maxGames) => {
                            if (!gameState.retirementHistory) gameState.retirementHistory = [];
                            return PlayerDevelopmentEngine.developTeamPlayers(team, maxGames,
                                { PlayerAttributes, CoachEngine },
                                { retirementHistory: gameState.retirementHistory, currentSeason: gameState.currentSeason });
                        },
                        handleAITeamFreeAgency: (team, expiredPlayers) => {
                            return FreeAgencyEngine.handleAITeamFreeAgency(team, expiredPlayers, gameState.freeAgents, {
                                TeamFactory, getEffectiveCap, calculateTeamSalary
                            });
                        },
                        advanceFinancialTransitions,
                        healAllInjuries: (team) => InjuryEngine.healAllInjuries(team),
                        returnAllLoans: () => {
                            if (!LoanEngine || !gameState.activeLoans || gameState.activeLoans.length === 0) return [];
                            const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
                            return LoanEngine.returnAllLoans({
                                activeLoans: gameState.activeLoans,
                                allTeams,
                                currentDate: gameState.currentDate || 'season-end',
                                initializePlayerChemistry,
                            });
                        },
                        resetAllFatigue: (teams) => FatigueEngine.resetAll(teams),
                        clearMarketValueCache: (players) => TeamFactory.clearMarketValueCache(players),
                        runDraft: () => getDraftController().runDraft(),
                        startCollegeGraduateFA: () => getDraftController().startCollegeGraduateFA(),
                        getDraftController: () => getDraftController(),
                        showFreeAgencyModal: () => getFreeAgencyController().show(),
                        generateSponsorOffers: (team) => OwnerEngine.generateSponsorOffers(team),
                        applyAIFinancialDefaults: (team) => OwnerEngine.applyAIFinancialDefaults(team),
                        showOwnerModeModal: (team) => getFinanceController().showOwnerModeModal(team),
                        calculateTeamChemistry,
                        getGameSimController: () => getGameSimController()
                    }
                });
            }
            return _offseasonController;
        }
        // Expose for React modal callbacks
        Object.defineProperty(window, '_offseasonController', {
            get: () => getOffseasonController(),
            configurable: true
        });
        // Also expose draftController for hub access
        Object.defineProperty(window, '_draftController', {
            get: () => getDraftController(),
            configurable: true
        });
        // Expose financeController for owner mode in FinancesScreen
        Object.defineProperty(window, '_financeController', {
            get: () => getFinanceController(),
            configurable: true
        });

        // ─── TradeController (lazy init) ───
        let _tradeController = null;
        function getTradeController() {
            if (!_tradeController) {
                _tradeController = new window.TradeController({
                    gameState, eventBus, GameEvents,
                    engines: { TradeEngine, DraftEngine, ChemistryEngine },
                    helpers: {
                        getUserTeam, getTeamById, getCurrentTeams, formatCurrency, getRatingColor,
                        getEffectiveCap, calculateTeamSalary, ensureRosterExists,
                        initializePlayerChemistry,
                        initializeDraftPickOwnership: () => {
                            if (!gameState.draftPickOwnership) gameState.draftPickOwnership = {};
                            const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
                            DraftEngine.initializePickOwnership(gameState.draftPickOwnership, allTeams, gameState.currentSeason);
                        },
                        getPickOwner: (originalTeamId, year, round) => {
                            if (!gameState.draftPickOwnership) gameState.draftPickOwnership = {};
                            const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
                            DraftEngine.initializePickOwnership(gameState.draftPickOwnership, allTeams, gameState.currentSeason);
                            return DraftEngine.getPickOwner(gameState.draftPickOwnership, originalTeamId, year, round);
                        },
                        violatesStepienRule: (teamId, year, round) => {
                            if (!gameState.draftPickOwnership) gameState.draftPickOwnership = {};
                            const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
                            DraftEngine.initializePickOwnership(gameState.draftPickOwnership, allTeams, gameState.currentSeason);
                            return DraftEngine.violatesStepienRule(gameState.draftPickOwnership, teamId, year, round);
                        },
                        calculatePickValue: (year, round, originalTeamRecord) => {
                            return DraftEngine.calculatePickValue(year, round, gameState.currentSeason, originalTeamRecord);
                        },
                        tradeDraftPick: (fromTeamId, toTeamId, originalTeamId, year, round) => {
                            if (!gameState.draftPickOwnership) gameState.draftPickOwnership = {};
                            const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
                            DraftEngine.initializePickOwnership(gameState.draftPickOwnership, allTeams, gameState.currentSeason);
                            DraftEngine.tradePick(gameState.draftPickOwnership, originalTeamId, toTeamId, year, round);
                        },
                        applyTradePenalty: (team, tradedPlayer) => ChemistryEngine.applyTradePenalty(team, tradedPlayer),
                        generatePositionBreakdownHTML, updateUI: () => getDashboardController().refresh()
                    },
                    simulationController
                });
            }
            return _tradeController;
        }

        // ─── DraftController (lazy init) ───
        let _draftController = null;
        function getDraftController() {
            if (!_draftController) {
                _draftController = new window.DraftController({
                    gameState, eventBus, GameEvents,
                    engines: { DraftEngine, TeamFactory, PlayerAttributes, SalaryCapEngine, FreeAgencyEngine },
                    helpers: {
                        getUserTeam, getTeamById, formatCurrency, getRatingColor,
                        getEffectiveCap, calculateTeamSalary, getRemainingCap,
                        ensureRosterExists, initializePlayerChemistry,
                        getPickOwner: (originalTeamId, year, round) => {
                            if (!gameState.draftPickOwnership) gameState.draftPickOwnership = {};
                            const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
                            DraftEngine.initializePickOwnership(gameState.draftPickOwnership, allTeams, gameState.currentSeason);
                            return DraftEngine.getPickOwner(gameState.draftPickOwnership, originalTeamId, year, round);
                        },
                        determineContractLength, generateSalary,
                        saveGameState,
                        proceedToPlayerDevelopment: () => getOffseasonController().proceedToPlayerDevelopment()
                    }
                });
            }
            return _draftController;
        }

        // ─── GameSimController (lazy init) ───
        let _gameSimController = null;
        function getGameSimController() {
            if (!_gameSimController) {
                _gameSimController = new window.GameSimController({
                    gameState, eventBus, GameEvents,
                    engines: { CalendarEngine, GamePipeline, StatEngine, StorageEngine, PlayoffEngine },
                    helpers: {
                        getUserTeam, getCurrentTeams, sortTeamsByStandings,
                        sortTeamsWithTiebreakers: (...args) => LeagueManager.sortTeamsWithTiebreakers(...args),
                        getRatingColor, formatCurrency, getRankSuffix, saveGameState, updateUI: () => getDashboardController().refresh(),
                        applyFatigueAutoRest: (team, isPlayoffs) => FatigueEngine.applyAutoRest(team, isPlayoffs),
                        processFatigueAfterGame: (...args) => FatigueEngine.processAfterGame(...args),
                        updateInjuries: (team) => InjuryEngine.updateInjuries(team),
                        checkForInjuries: (...args) => InjuryEngine.checkForInjuries(...args),
                        applyInjury, showNextInjuryModal,
                        runAllStarWeekend, simulatePlayoffSeries,
                        applyChampionshipBonus: (team) => ChemistryEngine.applyChampionshipBonus(team),
                        executePromotionRelegationFromResults: () => getOffseasonController().executePromotionRelegationFromResults(gameState.postseasonResults),
                        getOffseasonController: () => getOffseasonController(),
                        proceedToDraftOrDevelopment: () => getOffseasonController().proceedToDraftOrDevelopment(),
                        generateSchedule, simulateGame,
                        getGmMode: () => gmMode,
                        getSimulationController: () => simulationController
                    }
                });
                // Wire playoff callbacks to window for React modal buttons
                const gsc = _gameSimController;

                // Series-level (user is in an active series)
                window.simPlayoffGame = () => {
                    const pw = gsc._playoffWatch;
                    if (!pw) return;
                    const isHigherHome = pw.homePattern[pw.gameNum];
                    const homeTeam = isHigherHome ? pw.higherSeed : pw.lowerSeed;
                    const awayTeam = isHigherHome ? pw.lowerSeed : pw.higherSeed;
                    const gameResult = simulationController.simulatePlayoffGame(homeTeam, awayTeam);
                    const higherSeedWon = (gameResult.winner.id === pw.higherSeed.id);
                    if (higherSeedWon) pw.higherWins++; else pw.lowerWins++;
                    const gameEntry = {
                        gameNumber: pw.gameNum + 1, homeTeam, awayTeam,
                        homeScore: gameResult.homeScore, awayScore: gameResult.awayScore,
                        winner: higherSeedWon ? pw.higherSeed : pw.lowerSeed
                    };
                    // Store box score if player stats available
                    if (gameResult.homePlayerStats && gameResult.awayPlayerStats) {
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
                                ftm: p.freeThrowsMade || 0, fta: p.freeThrowsAttempted || 0
                            }));
                        gameEntry.boxScore = {
                            home: { city: homeTeam.city || '', name: homeTeam.name, score: gameResult.homeScore, players: mapStats(gameResult.homePlayerStats) },
                            away: { city: awayTeam.city || '', name: awayTeam.name, score: gameResult.awayScore, players: mapStats(gameResult.awayPlayerStats) },
                            quarterScores: gameResult.quarterScores || null
                        };
                    }
                    pw.games.push(gameEntry);
                    pw.gameNum++;
                    gsc._showPlayoffSeriesStatus();
                };
                // NOTE: window.watchPlayoffGame is set later to the calendar-based version
                window.simPlayoffSeries = () => gsc.simRestOfPlayoffSeries();
                window.simRestOfPlayoffSeries = () => gsc.simRestOfPlayoffSeries();
                window.viewPlayoffBracket = () => gsc.openBracketViewer();
                // Hub: sim exactly one game in current series
                window.simOnePlayoffGame = () => {
                    const pw = gsc._playoffWatch;
                    if (!pw) return;
                    const gamesToWin = pw.gamesToWin;
                    if (pw.higherWins >= gamesToWin || pw.lowerWins >= gamesToWin) return;
                    gsc.simOnePlayoffGame();
                };
            }
            return _gameSimController;
        }

        // ─── PlayoffSimController (lazy init) ───
        let _playoffSimController = null;
        function getPlayoffSimController() {
            if (!_playoffSimController) {
                _playoffSimController = new window.PlayoffSimController({
                    gameState, eventBus, GameEvents,
                    engines: { PlayoffEngine, StatEngine },
                    helpers: {
                        getUserTeam, saveGameState,
                        applyFatigueAutoRest: (team, isPlayoffs) => FatigueEngine.applyAutoRest(team, isPlayoffs),
                        getSimulationController: () => simulationController
                    }
                });
                // Cross-wire with GameSimController
                const gsc = getGameSimController();
                _playoffSimController._gameSimController = gsc;
                gsc._playoffSimController = _playoffSimController;
            }
            return _playoffSimController;
        }

        // ─── FinanceController (lazy init) ───
        let _financeController = null;
        function getFinanceController() {
            if (!_financeController) {
                _financeController = new window.FinanceController({
                    gameState, eventBus, GameEvents,
                    engines: { FinanceEngine },
                    helpers: {
                        getUserTeam, formatCurrency, calculateTeamSalary, saveGameState,
                        proceedToDraftOrDevelopment: () => getOffseasonController().proceedToDraftOrDevelopment()
                    }
                });
            }
            return _financeController;
        }

        // ─── RosterController (lazy init) ───
        let _rosterController = null;
        function getRosterController() {
            if (!_rosterController) {
                _rosterController = new window.RosterController({
                    gameState, eventBus, GameEvents,
                    engines: { FinanceEngine, PlayerAttributes, TeamFactory },
                    helpers: {
                        getUserTeam, formatCurrency, calculateTeamSalary, saveGameState,
                        ensureRosterExists, generatePositionBreakdownHTML,
                        getEffectiveCap, getSalaryCap, getRemainingCap, isUnderCap,
                        calculateTeamChemistry, getChemistryColor, getChemistryDescription,
                        getFatigueColor, getFatigueDescription, getRatingColor, gradeColor,
                        applyDropPenalty, initializePlayerChemistry, generateSalary,
                        getAllLeaguePlayers, calculateTeamFit,
                        applyInjury,
                        eventBus, GameEvents
                    }
                });
            }
            return _rosterController;
        }

        let _freeAgencyController = null;
        function getFreeAgencyController() {
            if (!_freeAgencyController) {
                _freeAgencyController = new FreeAgencyController({
                    gameState,
                    engines: {
                        FreeAgencyEngine, SalaryCapEngine, TeamFactory,
                        ScoutingEngine
                    },
                    helpers: {
                        getUserTeam, getTeamById, formatCurrency,
                        aiSigningPhase, saveGameState,
                        getRosterController: () => getRosterController(),
                        getOffseasonController: () => getOffseasonController()
                    }
                });
            }
            return _freeAgencyController;
        }

        let _dashboardController = null;
        function getDashboardController() {
            if (!_dashboardController) {
                _dashboardController = new DashboardController({
                    gameState
                });
            }
            return _dashboardController;
        }
        
        let _coachMgmtController = null;
        function getCoachManagementController() {
            if (!_coachMgmtController) {
                _coachMgmtController = new CoachManagementController({
                    gameState,
                    engines: { CoachEngine, SalaryCapEngine },
                    helpers: {
                        getUserTeam, formatCurrency, saveGameState,
                        getDashboardController,
                        eventBus, GameEvents
                    }
                });
            }
            return _coachMgmtController;
        }

        let _saveLoadController = null;
        function getSaveLoadController() {
            if (!_saveLoadController) {
                _saveLoadController = new SaveLoadController({
                    gameState,
                    engines: { StorageEngine },
                    helpers: { eventBus, GameEvents }
                });
            }
            return _saveLoadController;
        }

        // saveGameState is a thin wrapper used by many controllers as a dependency
        function saveGameState() {
            getSaveLoadController().save();
        }

        // Global simulation controller instance
        const simulationController = new SimulationController();

        let gmMode = null;

        // ═══════════════════════════════════════════════════════════════════
        // FINANCE ENGINE — Revenue-Based Economics
        // ═══════════════════════════════════════════════════════════════════
        // 
        // PHILOSOPHY: Tier 1 uses a hard salary cap (American franchise model
        // with shared TV revenue and enforced parity). Tiers 2 and 3 use
        // revenue-based spending limits (European model where financial
        // diversity IS the system). Each team's budget is derived from its
        // own revenue, which varies based on tier, franchise history, 
        // fanbase size, winning record, and legacy brand value.
        //
        // Revenue has 4 layers:
        //   1. League Revenue  — TV deal, locked to current tier, changes instantly
        //   2. Matchday Revenue — Gate/concessions, decays gradually with tier change
        //   3. Commercial Revenue — Sponsors/partnerships, decays at medium rate
        //   4. Legacy/Brand Revenue — Merch/licensing/history, very slow decay
        //
        // PHASE 1: Auto-calculated finances with visible Finance dashboard.
        //          Player can see all numbers. Owner Mode (interactive levers)
        //          planned for Phase 2.
        // ═══════════════════════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════════════════════
        // METRO POPULATION DATA — drives market size for team finances
        // ═══════════════════════════════════════════════════════════════════
        // Maps city names (extracted from team names) to metro area populations
        // in millions. Used to calculate market size multiplier for fanbase,
        // matchday revenue, and commercial revenue.
        //
        // Sources: US Census Bureau MSA estimates, Statistics Canada, INEGI Mexico
        // Population in millions (metro statistical area)

        // Salary cap constants — delegated to SalaryCapEngine
        const SALARY_CAPS = SalaryCapEngine.SALARY_CAPS;
        const SALARY_FLOORS = SalaryCapEngine.SALARY_FLOORS;
        const PARACHUTE_PAYMENTS = SalaryCapEngine.PARACHUTE_PAYMENTS;
        const PROMOTION_BONUSES = SalaryCapEngine.PROMOTION_BONUSES;
        
        function advanceFinancialTransitions(allTeams) {
            SalaryCapEngine.advanceFinancialTransitions(allTeams);
        }

        // ========================================
        // TIEBREAKER SYSTEM → Delegated to LeagueManager
        // ========================================
        
        // ========================================
        // TIEBREAKER SYSTEM (cont.) → Delegated to LeagueManager
        // ========================================
        
        // ===== PLAYER DEVELOPMENT SYSTEM → Delegated to PlayerDevelopmentEngine =====
        
        // ═══════════════════════════════════════════════════════════════════
        // RETIREMENT PROBABILITY → Delegated to PlayerDevelopmentEngine
        // ═══════════════════════════════════════════════════════════════════
        // Apply development to all teams across all tiers
        // Handle AI team free agency decisions
        // ═══════════════════════════════════════════════════════════════════
        // AI Signing Phase: All AI teams sign from free agent pool (off-season only)
        // ═══════════════════════════════════════════════════════════════════
        // Runs once per off-season after player development (which handles expirations).
        // Each AI team scans the pool and signs players to fill roster gaps if they
        // can afford them under their tier's cap. Keeps the pool lean and competitive.
        function aiSigningPhase() {
            const userTeam = getUserTeam();
            const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
            const aiTeams = allTeams.filter(t => t.id !== userTeam.id);
            
            const totalSigned = FreeAgencyEngine.aiSigningPhase(
                { aiTeams, freeAgentPool: gameState.freeAgents },
                { TeamFactory, getEffectiveCap, calculateTeamSalary }
            );
            
            console.log(`✅ AI signing phase complete: ${totalSigned} total signings across all teams`);
            console.log(`📋 Free agent pool remaining: ${gameState.freeAgents.length} players`);
        }

        // Player name generators → Delegated to TeamFactory
        const FIRST_NAMES = TeamFactory.FIRST_NAMES;
        const LAST_NAMES = TeamFactory.LAST_NAMES;
        const POSITIONS = TeamFactory.POSITIONS;

        // ─── Convenience aliases for engine functions used throughout ───
        const formatCurrency = SalaryCapEngine.formatCurrency;
        const calculateTeamSalary = SalaryCapEngine.calculateTeamSalary;
        const getEffectiveCap = SalaryCapEngine.getEffectiveCap;
        const getSalaryCap = SalaryCapEngine.getSalaryCap;
        const getRemainingCap = SalaryCapEngine.getRemainingCap;
        const isUnderCap = SalaryCapEngine.isUnderCap;
        const getRatingColor = UIHelpers.getRatingColor;
        const getRankSuffix = UIHelpers.getRankSuffix;
        const generatePositionBreakdownHTML = UIHelpers.generatePositionBreakdownHTML;
        const sortTeamsByStandings = LeagueManager.sortTeamsByStandings;
        const calculateTeamStrength = LeagueManager.calculateTeamStrength;
        const calculateTeamChemistry = ChemistryEngine.calculate;
        const getChemistryColor = ChemistryEngine.getColor;
        const getChemistryDescription = ChemistryEngine.getDescription;
        const getFatigueColor = FatigueEngine.getColor;
        const getFatigueDescription = FatigueEngine.getDescription;
        const generateSalary = TeamFactory.generateSalary;
        const generateRoster = (tier, teamId) => TeamFactory.generateRoster(tier, teamId, { PlayerAttributes, SalaryCapEngine });
        const generateFreeAgentPool = () => TeamFactory.generateFreeAgentPool(999000, { PlayerAttributes });
        function ensureRosterExists(team) {
            if (!team.roster || team.roster.length === 0) {
                team.roster = generateRoster(team.tier, team.id);
                console.log(`Generated roster for ${team.name} (${team.roster.length} players)`);
            } else {
                let addedSalaries = false;
                let addedContracts = false;
                team.roster.forEach(player => {
                    if (!player.salary) {
                        player.salary = generateSalary(player.rating, team.tier);
                        addedSalaries = true;
                    }
                    if (!player.contractYears) {
                        player.contractYears = determineContractLength(player.age, player.rating);
                        player.originalContractLength = player.contractYears;
                        addedContracts = true;
                    }
                });
                if (addedSalaries) console.log(`Added salaries to ${team.name} roster`);
                if (addedContracts) console.log(`Added contracts to ${team.name} roster`);
            }
            FinanceEngine.ensureFinances(team);
            return team.roster;
        }
        const determineContractLength = TeamFactory.determineContractLength;
        const getPlayerNaturalTier = TeamFactory.getPlayerNaturalTier;
        const getMarketValue = TeamFactory.getMarketValue;
        const getNaturalMarketValue = TeamFactory.getNaturalMarketValue;
        const generateSchedule = TeamFactory.generateSchedule;
        const assignDivision = DivisionManager.assignDivision;
        const calculateTeamFit = ScoutingEngine.calculateTeamFit;
        const gradeColor = ScoutingEngine.gradeColor;
        const applyInjury = InjuryEngine.applyInjury;
        const applyDropPenalty = ChemistryEngine.applyDropPenalty;
        const initializePlayerChemistry = ChemistryEngine.initializePlayer;
        function simulateGame(homeTeam, awayTeam) {
            ensureRosterExists(homeTeam);
            ensureRosterExists(awayTeam);
            const result = simulationController.simulateFullGame(homeTeam, awayTeam, false);
            return result;
        }
        function simulatePlayoffGame(homeTeam, awayTeam, isHomeGame) {
            ensureRosterExists(homeTeam);
            ensureRosterExists(awayTeam);
            const result = GameEngine.calculateGameOutcome(homeTeam, awayTeam, true);
            simulationController.accumulatePlayerStats(homeTeam, result.homePlayerStats);
            simulationController.accumulatePlayerStats(awayTeam, result.awayPlayerStats);
            return {
                homeTeam, awayTeam,
                homeScore: result.homeScore, awayScore: result.awayScore,
                winner: result.winner, isHomeGame
            };
        }
        const simulatePlayoffSeries = (higherSeed, lowerSeed, bestOf) => simulationController.simulatePlayoffSeries(higherSeed, lowerSeed, bestOf);

        // Generate a random player → Delegated to TeamFactory
        // ===== CHEMISTRY SYSTEM → Delegated to ChemistryEngine =====
        
        // ═══════════════════════════════════════════════════════════════════
        // INJURY SYSTEM → Delegated to InjuryEngine
        // ═══════════════════════════════════════════════════════════════════
        
        // INJURY_TYPES constant now lives in InjuryEngine.INJURY_TYPES
        // Kept as local reference for any direct access patterns
        const INJURY_TYPES = InjuryEngine.INJURY_TYPES;
        
        // ═══════════════════════════════════════════════════════════════════
        // FATIGUE SYSTEM → Delegated to FatigueEngine
        // ═══════════════════════════════════════════════════════════════════
        
        // Get chemistry description
        // ===== DRAFT SYSTEM =====
        
        // Generate draft prospects
        // ===== DRAFT LOTTERY =====
        
        // Simulate draft lottery (NBA-style flattened odds)
        // Show lottery results modal
        // Generate draft order based on standings (TIER 1 ONLY) - WITH LOTTERY
        // ===== DRAFT PICK TRADING =====
        
        // Initialize draft pick ownership (each team owns their own picks by default)
        // Get who owns a team's pick for a given year/round
        // Trade a draft pick
        // Get all picks owned by a team for a given year
        // Check if trading a pick violates Ted Stepien Rule
        // Calculate draft pick value (depreciates over time)
        // Execute the draft (AI drafts for all teams, user drafts for their team)
        // Make functions globally accessible
        // Get salary for drafted player based on pick number and tier
        // Scales proportionally to each tier's salary cap so pick values
        // are meaningful relative to the team's financial constraints.
        // Base scale is designed for Tier 2 ($12M cap), then multiplied.
        // Run draft and show results
        // Determine contract length based on player age and rating
        // Generate salary based on player rating
        // ═══════════════════════════════════════════════════════════════════
        // Determine the highest tier a player is qualified to play in
        // ═══════════════════════════════════════════════════════════════════
        // Based on the same rating thresholds used for tier matching:
        //   T1: 70+ can play in Tier 1
        //   T2: 60+ can play in Tier 2 (but T1-caliber players aim for T1)
        //   T3: 50+ can play in Tier 3
        // Returns the HIGHEST tier a player would realistically target,
        // which drives their market value expectations.
        // Generate a roster for a team (cap-compliant with realistic salary distribution)
        // Ensure a team has a roster (backward compatibility)
        // Generate free agent pool
        // ═══════════════════════════════════════════════════════════════════
        // DIVISION SYSTEM → Delegated to DivisionManager
        // ═══════════════════════════════════════════════════════════════════
        const CITY_TO_DIVISIONS = window._CTD;
        const T1_NEIGHBORS = DivisionManager.T1_NEIGHBORS;
        const T2_NEIGHBORS = DivisionManager.T2_NEIGHBORS;
        const T3_NEIGHBORS = DivisionManager.T3_NEIGHBORS;
        
        // selectTier/populateTeamSelection removed — React NewGameFlow handles this

        // Select team and start game
        function selectTeam(teamId, tier) {
            gameState.userTeamId = teamId;
            gameState.currentTier = tier;
            gameState.seasonStartYear = 2025;
            gameState.currentSeason = 2025;
            
            // Get season calendar dates
            const seasonDates = CalendarEngine.getSeasonDates(gameState.seasonStartYear);
            
            // Set current date to the earliest tier start (T1 start)
            gameState.currentDate = CalendarEngine.toDateString(seasonDates.t1Start);
            
            // Generate calendar-aware schedules for ALL tiers
            const t1Start = CalendarEngine.toDateString(seasonDates.t1Start);
            const t2Start = CalendarEngine.toDateString(seasonDates.t2Start);
            const t3Start = CalendarEngine.toDateString(seasonDates.t3Start);
            const seasonEnd = CalendarEngine.toDateString(seasonDates.seasonEnd);
            
            console.log('📅 Generating calendar schedules...');
            console.log(`  T1: ${t1Start} to ${seasonEnd} (82 games)`);
            console.log(`  T2: ${t2Start} to ${seasonEnd} (60 games)`);
            console.log(`  T3: ${t3Start} to ${seasonEnd} (40 games)`);
            
            gameState.tier1Schedule = CalendarEngine.generateCalendarSchedule(
                gameState.tier1Teams, 82, t1Start, seasonEnd, seasonDates, 1
            );
            gameState.tier2Schedule = CalendarEngine.generateCalendarSchedule(
                gameState.tier2Teams, 60, t2Start, seasonEnd, seasonDates, 2
            );
            gameState.tier3Schedule = CalendarEngine.generateCalendarSchedule(
                gameState.tier3Teams, 40, t3Start, seasonEnd, seasonDates, 3
            );
            
            // Set the user's schedule reference
            if (tier === 1) gameState.schedule = gameState.tier1Schedule;
            else if (tier === 2) gameState.schedule = gameState.tier2Schedule;
            else gameState.schedule = gameState.tier3Schedule;
            
            console.log('📅 Calendar schedules generated!');
            console.log(`  T1: ${gameState.tier1Schedule.length} games`);
            console.log(`  T2: ${gameState.tier2Schedule.length} games`);
            console.log(`  T3: ${gameState.tier3Schedule.length} games`);
            
            // Ensure all teams have rosters (backward compatibility)
            [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams].forEach(team => {
                ensureRosterExists(team);
            });
            
            // Generate free agent pool if not exists
            if (!gameState.freeAgents || gameState.freeAgents.length === 0) {
                gameState.freeAgents = generateFreeAgentPool();
            }
            
            saveGameState();
            document.getElementById('teamSelectionModal').classList.add('hidden');
            document.getElementById('gameContainer').style.display = 'block';
            
            console.log('✅ Game started with team:', teamId, 'in tier:', tier);
            console.log('📅 Starting date:', gameState.currentDate);
            console.log('Initial tier counts: T1=' + gameState.tier1Teams.length + ', T2=' + gameState.tier2Teams.length + ', T3=' + gameState.tier3Teams.length);
            
            getDashboardController().refresh();
            
            // Bridge to React UI
            window._reactGameState = gameState;
            if (window._notifyReact) window._notifyReact();
        }

        function getCurrentTeams() {
            if (gameState.currentTier === 1) return gameState.tier1Teams;
            if (gameState.currentTier === 2) return gameState.tier2Teams;
            return gameState.tier3Teams;
        }

        function getUserTeam() {
            const currentTierTeams = getCurrentTeams();
            let userTeam = currentTierTeams.find(t => t.id === gameState.userTeamId);
            if (!userTeam) {
                const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
                userTeam = allTeams.find(t => t.id === gameState.userTeamId);
                if (userTeam) {
                    console.log('⚠️ User team found in tier', userTeam.tier, 'but gameState.currentTier is', gameState.currentTier);
                }
            }
            return userTeam;
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 3b: COLLEGE GRADUATE FREE AGENCY
        // ═══════════════════════════════════════════════════════════════════
        // After the T1 draft, generate a class of college graduates (21-22 yr olds)
        // who enter the market for T2/T3 teams. These represent 3-year college
        // players who weren't drafted by T1 but are young, developing talent.
        //
        // Flow: Generate graduates → T2/T3 user picks → AI teams sign → remainder
        // goes to general FA pool → continue to player development.
        
        const COLLEGE_NAMES = TeamFactory.COLLEGE_NAMES;
        
        let collegeGradIdCounter = 800000;
        
        // Step 4: Player Development
        let playerDevelopmentInProgress = false;
        
        // ============================================
        // CALENDAR VIEW
        // ============================================
        // FINANCE DASHBOARD
        // ============================================
        
        // ============================================
        // CALENDAR VIEW
        // ============================================
        
        function openCalendarView() {
            if (window._reactShowCalendar) {
                if (!gameState || !gameState.currentDate) return;
                const currentDate = gameState.currentDate;
                const startYear = gameState.seasonStartYear || 2025;
                const seasonDates = CalendarEngine.getSeasonDates(startYear);
                const months = [];
                for (let m = 9; m <= 11; m++) months.push({ year: startYear, month: m });
                for (let m = 0; m <= 3; m++) months.push({ year: startYear + 1, month: m });
                const userTeamId = gameState.userTeamId;
                const userTier = gameState.currentTier;
                const userSchedule = userTier === 1 ? gameState.tier1Schedule :
                                     userTier === 2 ? gameState.tier2Schedule : gameState.tier3Schedule;
                const allTeams = [...(gameState.tier1Teams || []), ...(gameState.tier2Teams || []), ...(gameState.tier3Teams || [])];
                const userGamesByDate = {};
                if (userSchedule) {
                    userSchedule.forEach(game => {
                        if (game.date && (game.homeTeamId === userTeamId || game.awayTeamId === userTeamId)) {
                            const isHome = game.homeTeamId === userTeamId;
                            const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
                            const opponent = allTeams.find(t => t.id === opponentId);
                            userGamesByDate[game.date] = { isHome, opponent, played: game.played, game };
                        }
                    });
                }
                const allGamesByDate = {};
                [gameState.tier1Schedule, gameState.tier2Schedule, gameState.tier3Schedule].forEach((sched, idx) => {
                    if (!sched) return;
                    sched.forEach(game => {
                        if (game.date) {
                            if (!allGamesByDate[game.date]) allGamesByDate[game.date] = { total: 0, t1: 0, t2: 0, t3: 0 };
                            allGamesByDate[game.date].total++;
                            if (idx === 0) allGamesByDate[game.date].t1++;
                            else if (idx === 1) allGamesByDate[game.date].t2++;
                            else allGamesByDate[game.date].t3++;
                        }
                    });
                });
                const calSeasonDates = {
                    allStarStart: CalendarEngine.toDateString(seasonDates.allStarStart),
                    allStarEnd: CalendarEngine.toDateString(seasonDates.allStarEnd),
                    tradeDeadline: CalendarEngine.toDateString(seasonDates.tradeDeadline),
                    tier1End: CalendarEngine.toDateString(seasonDates.tier1End)
                };
                window._reactShowCalendar({
                    months, currentDate, userGamesByDate, allGamesByDate,
                    seasonDates: calSeasonDates, startYear, allTeams, userTeamId, gameState
                });
                return;
            }
        }
        
        // showCalendarDayDetail removed — React CalendarModal handles day details
        
        function showBoxScore(dateStr, homeTeamId, awayTeamId) {
            const games = CalendarEngine.getGamesForDate(dateStr, gameState);
            const allSchedule = [...(games.tier1 || []), ...(games.tier2 || []), ...(games.tier3 || [])];
            const game = allSchedule.find(g => g.homeTeamId === homeTeamId && g.awayTeamId === awayTeamId);
            
            if (!game || !game.played) return;
            
            const allTeams = [...(gameState.tier1Teams || []), ...(gameState.tier2Teams || []), ...(gameState.tier3Teams || [])];
            const homeTeam = allTeams.find(t => t.id === homeTeamId);
            const awayTeam = allTeams.find(t => t.id === awayTeamId);

            let boxPayload;
            if (game.boxScore) {
                boxPayload = {
                    home: game.boxScore.home,
                    away: game.boxScore.away,
                    date: CalendarEngine.formatDateDisplay(dateStr),
                    hasDetailedStats: true,
                    quarterScores: game.boxScore.quarterScores || null
                };
            } else {
                boxPayload = {
                    home: { city: homeTeam ? (homeTeam.city || '') : '', name: homeTeam ? homeTeam.name : '', score: game.homeScore, players: [] },
                    away: { city: awayTeam ? (awayTeam.city || '') : '', name: awayTeam ? awayTeam.name : '', score: game.awayScore, players: [] },
                    date: CalendarEngine.formatDateDisplay(dateStr),
                    hasDetailedStats: false
                };
            }

            // Dispatch to React modal if available, otherwise fall back to legacy
            if (window._reactShowBoxScore) {
                window._reactShowBoxScore(boxPayload);
            }
        }
        // ============================================
        // WATCH GAME MODE
        // ============================================
        
        // _watch* state moved to GameSimController
        
        // _startWatchTimer moved to GameSimController
        
        // _renderWatchEvents moved to GameSimController
        
        // _updateWatchScoreboard moved to GameSimController
        
        // ============================================
        // ALL-STAR GAME
        // ============================================
        
        function buildConferenceMap(teams, tier) {
            const map = {};
            if (tier === 1) {
                const eastDivs = ['Atlantic', 'Central', 'Southeast'];
                teams.forEach(t => { map[t.id] = eastDivs.includes(t.division) ? 'East' : 'West'; });
            } else if (tier === 2) {
                const eastDivs = ['Great Lakes', 'Mid-Atlantic', 'Southeast', 'New England', 'Florida', 'Gulf Coast'];
                teams.forEach(t => { map[t.id] = eastDivs.includes(t.division) ? 'East' : 'West'; });
            } else {
                // T3: split metro leagues roughly East/West by index
                const divs = [...new Set(teams.map(t => t.division))].sort();
                const halfIdx = Math.ceil(divs.length / 2);
                const eastDivs = new Set(divs.slice(0, halfIdx));
                teams.forEach(t => { map[t.id] = eastDivs.has(t.division) ? 'East' : 'West'; });
            }
            return map;
        }
        
        function runAllStarWeekend() {
            console.log('⭐ Running All-Star Weekend...');
            eventBus.emit(GameEvents.SEASON_ALL_STAR, { season: gameState.season });
            
            const tierConfigs = [
                { teams: gameState.tier1Teams, tier: 1, label: 'Tier 1 — NAPL', minPct: 0.4, color: '#ffd700' },
                { teams: gameState.tier2Teams, tier: 2, label: 'Tier 2 — NARBL', minPct: 0.35, color: '#c0c0c0' },
                { teams: gameState.tier3Teams, tier: 3, label: 'Tier 3 — MBL', minPct: 0.3, color: '#cd7f32' }
            ];
            
            const allStarResults = [];
            
            for (const config of tierConfigs) {
                const gamesPerTeam = config.tier === 1 ? 82 : config.tier === 2 ? 60 : 40;
                const minGames = Math.floor(gamesPerTeam * config.minPct);
                const confMap = buildConferenceMap(config.teams, config.tier);
                
                const selections = StatEngine.selectAllStars(config.teams, minGames, confMap);
                const gameResult = StatEngine.simulateAllStarGame(selections.east, selections.west, config.label);
                
                allStarResults.push({
                    ...config,
                    selections,
                    gameResult
                });
                
                console.log(`  ⭐ ${config.label}: ${gameResult.winner} wins ${gameResult.eastScore}-${gameResult.westScore}`);
            }
            
            // Store results on gameState so we don't re-trigger
            gameState._allStarCompleted = true;
            gameState._allStarResults = allStarResults;
            
            showAllStarModal(allStarResults);
        }
        
        function showAllStarModal(results) {
            if (window._reactShowAllStar) {
                window._allStarContinueCallback = () => {};
                window._reactShowAllStar({ results, userTeamId: gameState.userTeamId });
            }
        }
        
        // closeAllStarModal removed — React AllStarModal handles close


        function getAllLeaguePlayers() {
            const all = [];
            [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams].forEach(team => {
                if (team.roster) {
                    team.roster.forEach(p => {
                        p._teamName = team.name;
                        p._teamTier = team.tier;
                        p._teamId = team.id;
                        all.push(p);
                    });
                }
            });
            return all;
        }

        // ===== ROSTER MANAGEMENT FUNCTIONS =====
        


        // Track where roster management was opened from
        let rosterManagementReturnContext = 'seasonEnd'; // 'seasonEnd', 'compliance', 'development'
        
        function _buildRosterData(returnContext) {
            const userTeam = getUserTeam();
            if (!userTeam) return null;
            ensureRosterExists(userTeam);

            const roster = [...(userTeam.roster || [])].sort((a, b) => b.rating - a.rating);
            const totalSalary = Math.round(calculateTeamSalary(userTeam));
            FinanceEngine.ensureFinances(userTeam);
            const salaryCap = getEffectiveCap(userTeam);
            const baseCap = getSalaryCap(userTeam.tier);
            const salaryFloor = FinanceEngine.getSalaryFloor(userTeam);
            const remainingCap = Math.round(getRemainingCap(userTeam));
            const isOverCap = totalSalary > salaryCap;
            const isUnderFloor = totalSalary < salaryFloor;
            const isRevenueBasedCap = userTeam.tier !== 1;
            const hasCapBoost = isRevenueBasedCap ? (salaryCap > baseCap) : false;
            let boostLabel = '';
            if (isRevenueBasedCap && salaryCap > baseCap * 1.2) {
                boostLabel = '📈 Revenue exceeds tier baseline';
            } else if (userTeam.finances && userTeam.finances.previousTier && userTeam.finances.previousTier < userTeam.tier) {
                boostLabel = '🏛️ Retained revenue from Tier ' + userTeam.finances.previousTier;
            }
            const teamChemistry = calculateTeamChemistry(userTeam);
            const chemistryColor = getChemistryColor(teamChemistry);
            const chemistryDesc = getChemistryDescription(teamChemistry);

            const posBreakdown = {};
            roster.forEach(p => { posBreakdown[p.position] = (posBreakdown[p.position] || 0) + 1; });

            // Ensure contract info on free agents
            const freeAgents = (gameState.freeAgents || []).map(p => {
                if (!p.contractYears) {
                    p.contractYears = TeamFactory.determineContractLength(p.age, p.rating);
                    p.originalContractLength = p.contractYears;
                }
                return p;
            });

            const allAttrDefs = { ...PlayerAttributes.PHYSICAL_ATTRS, ...PlayerAttributes.MENTAL_ATTRS };

            // Ensure attributes exist for all roster players
            roster.forEach(p => PlayerAttributes.ensureAttributes(p));

            return {
                roster, freeAgents, posBreakdown, returnContext,
                capInfo: {
                    totalSalary, salaryCap, salaryFloor, remainingCap, isOverCap, isUnderFloor,
                    isRevenueBasedCap, hasCapBoost, boostLabel, boostAmount: salaryCap - baseCap,
                    teamChemistry, chemistryColor, chemistryDesc,
                },
                formatCurrency, getRatingColor,
                getAttrColor: (v) => PlayerAttributes.getAttrColor(v),
                attrDefs: allAttrDefs,
                physicalAttrs: PlayerAttributes.PHYSICAL_ATTRS,
                mentalAttrs: PlayerAttributes.MENTAL_ATTRS,
                onRefresh: () => {
                    // Re-open with fresh data after drop/sign
                    if (window._reactShowRoster) {
                        window._reactShowRoster(_buildRosterData(returnContext));
                    }
                },
            };
        }

        function openRosterManagement() {
            console.log('📋 Opening Roster Management');
            console.log('User Team ID:', gameState.userTeamId);
            console.log('Current Tier:', gameState.currentTier);
            
            const userTeam = getUserTeam();
            console.log('User Team:', userTeam ? userTeam.name : 'NOT FOUND');
            
            if (!userTeam) {
                alert('Error: Could not find your team!');
                return;
            }
            
            ensureRosterExists(userTeam);
            console.log('User Roster Size:', userTeam.roster ? userTeam.roster.length : 0);
            console.log('Free Agents Count:', gameState.freeAgents ? gameState.freeAgents.length : 0);
            
            // Context is set explicitly by specialized callers (compliance, hub).
            // Generic path defaults to 'game'.
            rosterManagementReturnContext = 'game';

            window._rosterCloseCallback = () => closeRosterManagementDynamic();
            if (window._reactShowRoster) {
                window._reactShowRoster(_buildRosterData(rosterManagementReturnContext));
            }
        }

        function closeRosterManagement() {
            saveGameState();
            
            // If we're in the offseason flow, resume from current phase
            if (getOffseasonController().isInOffseason()) {
                console.log('Returning from roster management to offseason flow (phase:', gameState.offseasonPhase, ')');
                if (rosterManagementReturnContext === 'compliance') {
                    // Go back to compliance check specifically
                    getOffseasonController().checkRosterComplianceAndContinue();
                } else {
                    // Resume from whatever phase we're in
                    getOffseasonController().resumeOffseason();
                }
                return;
            }
            
            // Regular season contexts
            if (rosterManagementReturnContext === 'compliance') {
                console.log('Returning from roster management to compliance check...');
                getOffseasonController().checkRosterComplianceAndContinue();
            }
            // 'development' and 'seasonEnd' contexts handled by React (OffseasonHub)
        }
        
        function closeRosterManagementToGame() {
            saveGameState();
            getDashboardController().refresh();
            
            // Don't show any modal - return to game
            console.log('Closed roster management, returning to game');
        }
        
        function closeRosterManagementDynamic() {
            console.log('🔄 closeRosterManagementDynamic called, context:', rosterManagementReturnContext);
            if (rosterManagementReturnContext === 'game') {
                closeRosterManagementToGame();
            } else {
                closeRosterManagement();
            }
        }

        // Resume offseason flow — called when user closes roster management during offseason
        function openTradeScreenFromRoster() {
            // Store that we came from roster management
            window.returnToRosterManagement = true;
            
            // Open React trade screen if available, else legacy
            if (window._reactOpenTrade) {
                window._reactOpenTrade();
            } else {
                getTradeController().openTradeScreen();
            }
        }
        
        // Open Roster Management Hub (during regular season)
        function openRosterManagementHub() {
            console.log('Opening Roster Management Hub');
            
            // Set context so we return to game (not season end modal)
            rosterManagementReturnContext = 'game';

            if (window._reactShowRoster) {
                window._rosterCloseCallback = () => {
                    saveGameState();
                    getDashboardController().refresh();
                };
                window._reactShowRoster(_buildRosterData('game'));
            }
        }

        // Show modal forcing user to fix roster issues
        function openRosterManagementFromCompliance() {
            // Set return context so closeRosterManagement knows where to go back
            rosterManagementReturnContext = 'compliance';

            window._rosterCloseCallback = () => {
                saveGameState();
                getOffseasonController().checkRosterComplianceAndContinue();
            };
            if (window._reactShowRoster) {
                window._reactShowRoster(_buildRosterData('compliance'));
            }
        }
        
        function recheckRosterCompliance() {
            // User clicked "Ready to Continue" - check again
            getOffseasonController().checkRosterComplianceAndContinue();
        }
        
        // togglePlayerAttributes removed — React RosterScreen handles attribute display
        
        // ===== HELPER FUNCTIONS =====
        
        function getTeamById(teamId) {
            return [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams]
                .find(t => t.id === teamId);
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // INJURY MODAL UI
        // ═══════════════════════════════════════════════════════════════════
        
        let pendingInjuryDecision = null;
        
        // Process the next injury in the pending queue
        function showNextInjuryModal() {
            if (!gameState.pendingInjuries || gameState.pendingInjuries.length === 0) return;
            const next = gameState.pendingInjuries[0];
            
            // Find the actual team object
            const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
            const team = allTeams.find(t => t.id === next.team?.id) || next.team;
            
            // Find the actual player on the team
            const player = team.roster ? team.roster.find(p => p.id === next.player?.id) || next.player : next.player;
            
            showInjuryModal(team, player, next.injury);
        }
        
        function showInjuryModal(team, player, injury) {
            pendingInjuryDecision = { team, player, injury, decision: null };
            
            const userTeam = getUserTeam();
            const isUserTeam = team.id === userTeam.id;

            // ── Route to React InjuryModal ──
            if (window._reactShowInjury) {
                let aiDecision = null;
                let dpeEligible = false;
                let dpeAmount = 0;

                if (!isUserTeam) {
                    // AI team — auto-decide and apply immediately
                    aiDecision = injury.canPlayThrough && Math.random() < 0.3 ? 'playThrough' : 'rest';
                    InjuryEngine.applyInjury(player, injury, aiDecision);
                } else if (!injury.canPlayThrough) {
                    // Severe — no choice, apply rest immediately
                    InjuryEngine.applyInjury(player, injury, 'rest');
                    dpeEligible = injury.allowsDPE && player.salary > getDPEThreshold(team.tier);
                    dpeAmount = dpeEligible ? Math.min(player.salary * 0.5, getDPEAmount(team.tier)) : 0;
                    if (dpeEligible) grantDPE(team, player);
                    console.log(`[DPE Check] ${player.name}: allowsDPE=${injury.allowsDPE}, salary=${player.salary}, threshold=${getDPEThreshold(team.tier)}, eligible=${dpeEligible}, amount=${dpeAmount}`);
                } else if (isUserTeam && injury.canPlayThrough) {
                    // User team, playable-through — check settings for auto-handling
                    const injSetting = window._gameSettings?.injuryDecisions;
                    if (injSetting === 'always-rest' || injSetting === 'ai-decides') {
                        const autoDecision = injSetting === 'always-rest'
                            ? 'rest'
                            : (Math.random() < 0.3 ? 'playThrough' : 'rest');
                        InjuryEngine.applyInjury(player, injury, autoDecision);
                        // Advance queue without showing modal
                        if (gameState.pendingInjuries && gameState.pendingInjuries.length > 0) {
                            gameState.pendingInjuries.shift();
                        }
                        pendingInjuryDecision = null;
                        if (gameState.pendingInjuries && gameState.pendingInjuries.length > 0) {
                            showNextInjuryModal();
                        } else if (window._resumeAfterInjuries) {
                            window._resumeAfterInjuries();
                        }
                        return;
                    }
                }

                // Capture DPE state for the callback closure
                const _dpeEligible = dpeEligible;
                const _dpeAmount = dpeAmount;
                const _injuredPlayer = player;
                const _injuredTeam = team;

                // Helper: advance injury queue and resume sim
                const advanceQueue = () => {
                    if (gameState.pendingInjuries && gameState.pendingInjuries.length > 0) {
                        gameState.pendingInjuries.shift();
                    }
                    pendingInjuryDecision = null;
                    if (gameState.pendingInjuries && gameState.pendingInjuries.length > 0) {
                        showNextInjuryModal();
                    } else if (window._resumeAfterInjuries) {
                        window._resumeAfterInjuries();
                    }
                };

                // Set up callback for when React injury modal closes
                window._injuryDecisionCallback = (decision) => {
                    console.log(`[DPE Callback] decision=${decision}, _dpeEligible=${_dpeEligible}, isUserTeam=${isUserTeam}, _dpeAmount=${_dpeAmount}, hasReactShow=${!!window._reactShowDPEReplacement}, hasLoanEngine=${!!LoanEngine}`);
                    // For user playthrough injuries, apply the decision now
                    if (isUserTeam && injury.canPlayThrough && decision) {
                        InjuryEngine.applyInjury(player, injury, decision);
                    }

                    // If DPE was granted for user team, show DPE Replacement Modal
                    if (_dpeEligible && isUserTeam && _dpeAmount > 0 && window._reactShowDPEReplacement && LoanEngine) {
                        console.log(`[DPE] Opening DPE Replacement Modal for ${_injuredPlayer.name}`);
                        _showDPEReplacementModal(_injuredTeam, _injuredPlayer, _dpeAmount, advanceQueue);
                        return;
                    }

                    // No DPE — advance queue normally
                    advanceQueue();
                };

                window._reactShowInjury({
                    team, player, injury, isUserTeam,
                    aiDecision, dpeEligible, dpeAmount, formatCurrency,
                });
                return;
            }
        }

        /**
         * Show the DPE Replacement Modal after a DPE-eligible injury.
         * Chains into the sim resume flow via onCompleteCallback.
         */
        function _showDPEReplacementModal(team, injuredPlayer, dpeAmount, onCompleteCallback) {
            const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
            const borrowingTier = team.tier;

            // Determine lower-tier teams for loan candidates
            let lowerTierTeams = [];
            if (borrowingTier === 1) lowerTierTeams = gameState.tier2Teams;
            else if (borrowingTier === 2) lowerTierTeams = gameState.tier3Teams;

            // Get loan candidates
            const loanCandidates = LoanEngine.getAvailableLoanPlayers(
                borrowingTier, lowerTierTeams, gameState.activeLoans
            );

            // Get affordable free agents
            const affordableFAs = LoanEngine.getAffordableFreeAgents(
                gameState.freeAgents, dpeAmount, borrowingTier
            );

            // Calculate games remaining for the user team
            const totalGamesMap = { 1: 82, 2: 60, 3: 40 };
            const totalGames = totalGamesMap[borrowingTier] || 82;
            const gamesPlayed = (team.wins || 0) + (team.losses || 0);
            const gamesRemaining = Math.max(1, totalGames - gamesPlayed);

            // Set up the completion callback
            window._dpeReplacementCallback = (action, details) => {
                console.log(`[DPE] Replacement complete: ${action}`, details || '');
                saveGameState();
                getDashboardController().refresh();
                // Resume the injury queue / sim
                onCompleteCallback();
            };

            // Open the React modal
            window._reactShowDPEReplacement({
                injuredPlayer,
                team,
                dpeAmount,
                borrowingTier,
                loanCandidates,
                freeAgents: affordableFAs,
                activeLoans: gameState.activeLoans,
                generateSalary: TeamFactory.generateSalary,
                gamesRemaining,
                totalGames,
                currentDate: gameState.currentDate,
                // Pass engine functions for the modal to call
                calculateLoanTerms: LoanEngine.calculateLoanTerms,
                evaluateLoanOffer: LoanEngine.evaluateLoanOffer,
                executeLoan: (params) => LoanEngine.executeLoan({
                    ...params,
                    activeLoans: gameState.activeLoans,
                }),
                signFreeAgentViaDPE: LoanEngine.signFreeAgentViaDPE,
                initializePlayerChemistry: (p) => { p.chemistry = 50; p.gamesWithTeam = 0; },
                _freeAgentsRef: gameState.freeAgents, // mutable ref for FA pool modification
            });
        }

        /**
         * Show the Inbound Loan Request Modal when an AI higher-tier team
         * wants to borrow a player from the user's team.
         */
        function _showInboundLoanRequest() {
            const request = gameState.pendingLoanRequest;
            if (!request || !window._reactShowInboundLoan || !LoanEngine) {
                // Can't show modal — clear request and let AI try elsewhere
                gameState.pendingLoanRequest = null;
                if (window._resumeAfterLoanRequest) window._resumeAfterLoanRequest();
                return;
            }

            // Set up the response callback
            window._inboundLoanCallback = (response) => {
                const req = gameState.pendingLoanRequest;
                gameState.pendingLoanRequest = null;

                if (response === 'accept' && req) {
                    const userTeam = getUserTeam();
                    // Execute the loan: player moves from user team to borrowing team
                    LoanEngine.executeLoan({
                        player: req.requestedPlayer,
                        originalTeam: userTeam,
                        borrowingTeam: req.borrowingTeam,
                        injuredPlayer: req.injuredPlayer,
                        loanFee: req.offerAmount,
                        proratedSalary: req.proratedSalary,
                        currentDate: req.currentDate || gameState.currentDate,
                        activeLoans: gameState.activeLoans,
                        initializePlayerChemistry: (p) => ChemistryEngine.initializePlayer(p),
                    });
                    console.log(`[Inbound Loan] Accepted: ${req.requestedPlayer.name} loaned to ${req.borrowingTeam.city} ${req.borrowingTeam.name} for ${SalaryCapEngine.formatCurrency(req.offerAmount)}`);
                    saveGameState();
                    getDashboardController().refresh();
                } else {
                    console.log(`[Inbound Loan] Declined: ${req?.requestedPlayer?.name || 'unknown'}`);
                    // AI will try other players from non-user teams on next sim tick
                }

                // Resume sim
                if (window._resumeAfterLoanRequest) {
                    window._resumeAfterLoanRequest();
                }
            };

            // Open the React modal
            window._reactShowInboundLoan(request);
        }
        
        // selectInjuryOption removed — React InjuryModal handles option selection
        
        // DPE thresholds (roughly 50% of tier's mid-level exception equivalent)
        function getDPEThreshold(tier) {
            if (tier === 1) return 6000000;  // $6M
            if (tier === 2) return 600000;   // $600K
            return 75000;                     // $75K
        }
        
        function getDPEAmount(tier) {
            if (tier === 1) return 6000000;  // Max $6M exception
            if (tier === 2) return 600000;   // Max $600K exception
            return 75000;                     // Max $75K exception
        }
        
        function grantDPE(team, injuredPlayer) {
            const dpeAmount = Math.min(injuredPlayer.salary * 0.5, getDPEAmount(team.tier));
            
            if (!team.dpe) team.dpe = [];
            team.dpe.push({
                player: injuredPlayer.name,
                amount: dpeAmount,
                expires: gameState.currentSeason
            });
            
            console.log(`💰 DPE granted to ${team.name}: ${SalaryCapEngine.formatCurrency(dpeAmount)} (${injuredPlayer.name})`);
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // CONTRACT DECISIONS MODAL
        // ═══════════════════════════════════════════════════════════════════
        
        let contractDecisionsState = {
            expiringPlayers: [],
            developmentLog: [],
            decisions: {} // playerId -> 'resign' | 'release'
        };
        
        // ===== DRAFT RESULTS DISPLAY =====
        
        let currentDraftResults = [];
        
        // ═══════════════════════════════════════════════════════════════════
        // PHASE 2: OWNER MODE — Offseason Financial Management
        // ═══════════════════════════════════════════════════════════════════
        // Shows between roster compliance and season setup.
        // If Owner Mode is off, applies AI defaults and skips to season setup.
        // If Owner Mode is on, shows interactive management screen.
        
        // ─── HOOK INTO ADVANCE FINANCES ───
        // Override advanceFinancialTransitions to include Phase 2 processing
        const _originalAdvanceFinancialTransitions = advanceFinancialTransitions;
        advanceFinancialTransitions = function(allTeams) {
            const userTeam = getUserTeam();
            allTeams.forEach(team => {
                FinanceEngine.ensureFinances(team);
                
                // AI teams: generate and auto-accept sponsors, set marketing
                if (!userTeam || team.id !== userTeam.id) {
                    OwnerEngine.generateSponsorOffers(team);
                    OwnerEngine.applyAIFinancialDefaults(team);
                }
                
                // Phase 2: Process sponsorships, arena, and marketing BEFORE revenue decay
                OwnerEngine.processSponsorships(team);
                OwnerEngine.processArenaEffects(team);
                OwnerEngine.processMarketingEffects(team, { formatCurrency: SalaryCapEngine.formatCurrency });
                
                // Then do the standard revenue decay/growth and fanbase evolution
                FinanceEngine.advanceFinances(team, { wins: team.wins || 0, losses: team.losses || 0 });
            });
        };
        
        // ─── OWNER MODE MODAL ───
        // ─── OWNER MODE INTERACTION FUNCTIONS ───
        
        // ─── OWNER MODE TOGGLE ───
        // Step 5: Continue to Season Setup
        // Make draft functions globally accessible
        // ═══════════════════════════════════════════════════════════════════
        // WINDOW EXPOSURES — Functions called from HTML onclick handlers
        // Must be on window since game code runs inside _initGame wrapper
        // ═══════════════════════════════════════════════════════════════════
        // Note: simDay, simWeek, simNextGame, finishSeason are wired by GMMode constructor
        // via btn.onclick = () => this.simulateDay() etc. No global functions needed.
        // Initialize immediately — _initGame is called by module script after DOM is ready
        (async function() {
            try {
                console.log('🏀 The Association v4.0 - Phase 3');
                console.log('Initializing GameState class...');
                
                // Load saved game via StorageEngine (IndexedDB → localStorage fallback)
                console.log('📂 Attempting to load save via StorageEngine...');
                const savedData = await StorageEngine.load();
                console.log('📂 StorageEngine.load() returned:', savedData ? `${Math.round(savedData.length/1024)}KB of data` : 'null (no save found)');
                
                if (savedData) {
                    // Load saved game
                    try {
                        gameState = GameState.deserialize(savedData);
                        console.log('✅ Loaded existing save');
                    } catch (error) {
                        console.error('Error loading save:', error);
                        console.warn('Save file is incompatible — starting fresh. (Old pre-v4 saves are no longer supported.)');
                        gameState = new GameState();
                    }
                } else {
                    // Fresh initialization for team selection
                    gameState = new GameState();
                }
                
                // Determine if we have an existing game
                const hasExistingGame = !!(savedData && gameState.userTeamId);
                
                // Only initialize fresh teams for NEW games — loaded saves already have them
                if (!hasExistingGame) {
                    console.log('🆕 New game — generating fresh teams...');
                    gameState.tier1Teams = TeamFactory.initializeTierTeams(1, generateRoster);
                    gameState.tier2Teams = TeamFactory.initializeTierTeams(2, generateRoster);
                    gameState.tier3Teams = TeamFactory.initializeTierTeams(3, generateRoster);
                }
                
                console.log('Teams: T1=' + gameState.tier1Teams.length + 
                           ', T2=' + gameState.tier2Teams.length + 
                           ', T3=' + gameState.tier3Teams.length);
                
                // CRITICAL: Validate tier counts after loading
                if (hasExistingGame) {
                    console.log('Validating loaded tier counts...');
                    console.log('Loaded: T1=' + gameState.tier1Teams.length + ', T2=' + gameState.tier2Teams.length + ', T3=' + gameState.tier3Teams.length);
                    
                    if (gameState.tier1Teams.length !== 30 || gameState.tier2Teams.length !== 86 || gameState.tier3Teams.length !== 144) {
                        console.error('⚠️ CORRUPTED SAVE DETECTED! Tier counts are wrong.');
                        console.error('This save file has incorrect team counts and cannot be loaded.');
                        alert('Your save file has corrupted team counts. Please start a new game.\n\nT1: ' + gameState.tier1Teams.length + ' (should be 30)\nT2: ' + gameState.tier2Teams.length + ' (should be 86)\nT3: ' + gameState.tier3Teams.length + ' (should be 144)');
                        
                        // Reset to fresh state
                        localStorage.removeItem('gbslMultiTierGameState');
                        location.reload();
                        return;
                    }
                }
                
                if (hasExistingGame) {
                    document.getElementById('gameContainer').style.display = 'block';
                    document.getElementById('teamSelectionModal').classList.add('hidden');
                    getDashboardController().refresh();
                } else {
                    // Generate free agent pool for new games
                    gameState.freeAgents = generateFreeAgentPool();
                    // React handles the new game flow — keep legacy modal hidden
                    // (React's NewGameFlow will call window.selectTeam when ready)
                    document.getElementById('teamSelectionModal').classList.add('hidden');
                }
                
                
                // Initialize GM Mode (Phase 3)
                console.log('Initializing GMMode...');
                gmMode = new GMMode(gameState, simulationController, {
                    updateUI: () => getDashboardController().refresh(),
                    updateStandings: () => getDashboardController().refresh(),
                    updateNextGames: () => getDashboardController().refresh(),
                    showSeasonEnd: () => getGameSimController().showSeasonEnd(),
                    openRosterManagement, openTradeScreen: () => {
                        if (window._reactOpenTrade) window._reactOpenTrade();
                        else getTradeController().openTradeScreen();
                    }, saveGameState,
                    checkForAiTradeProposals: () => getTradeController().checkForAiTradeProposals(),
                    showAiTradeProposal: () => {
                        if (window._reactOpenAiTrade) window._reactOpenAiTrade();
                        else getTradeController().showAiTradeProposal();
                    },
                    checkForInjuries: (...args) => InjuryEngine.checkForInjuries(...args),
                    updateInjuries: (team) => InjuryEngine.updateInjuries(team),
                    processFatigueAfterGame: (...args) => FatigueEngine.processAfterGame(...args),
                    formatCurrency, getUserTeam,
                    runAllStarWeekend,
                    applyFatigueAutoRest: (team, isPlayoffs) => FatigueEngine.applyAutoRest(team, isPlayoffs),
                    applyInjury, showNextInjuryModal, buildConferenceMap,
                    openRosterManagementHub,
                    resumeOffseason: () => getOffseasonController().resumeOffseason(),
                    // Trade deps for AI-AI trades
                    engines: { TradeEngine },
                    TradeEngine,
                    getEffectiveCap,
                    calculateTeamSalary,
                    calculatePickValue: (year, round) => {
                        const yearsOut = year - gameState.currentSeason;
                        const base = round === 1 ? 30 : 15;
                        return Math.max(5, base - (yearsOut * 3));
                    },
                    applyTradePenalty: (team, tradedPlayer) => ChemistryEngine.applyTradePenalty(team, tradedPlayer),
                    initializePlayerChemistry: (player) => ChemistryEngine.initializePlayer(player),
                    checkLoanReturns: LoanEngine ? (params) => LoanEngine.checkLoanReturns(params) : null,
                    LoanEngine,
                    generateSalary,
                    showInboundLoanRequest: () => _showInboundLoanRequest(),
                    tradeDraftPick: (fromTeamId, toTeamId, originalTeamId, year, round) => {
                        if (!gameState.draftPickOwnership) return;
                        const key = `${originalTeamId}_${year}_${round}`;
                        gameState.draftPickOwnership[key] = toTeamId;
                    },
                    eventBus, GameEvents, CalendarEngine, GameEngine
                });
                console.log('✅ GMMode initialized');

                // ── Expose sim controls on window for React ──
                // These check if we're in offseason and route to appropriate controller
                window.simNextGame = () => gmMode.simulateNextGame();
                window.simDay = () => {
                    if (getOffseasonController().isInOffseason()) {
                        getOffseasonController().simOffseasonDay();
                    } else {
                        gmMode.simulateDay();
                    }
                };
                window.simWeek = () => {
                    if (getOffseasonController().isInOffseason()) {
                        getOffseasonController().simOffseasonWeek();
                    } else {
                        gmMode.simulateWeek();
                    }
                };
                window.simToNextEvent = () => {
                    if (getOffseasonController().isInOffseason()) {
                        getOffseasonController().simToNextEvent();
                    }
                };
                window.simToTrainingCamp = () => {
                    if (getOffseasonController().isInOffseason()) {
                        getOffseasonController().simToTrainingCamp();
                    }
                };
                window.finishSeason = () => gmMode.finishSeason();
                window.resumeOffseason = () => getOffseasonController().resumeOffseason();

                // ── Expose trade helpers on window for React ──
                window.getPickOwner = (teamId, year, round) => {
                    if (!gameState.draftPickOwnership) return teamId;
                    return DraftEngine.getPickOwner(gameState.draftPickOwnership, teamId, year, round);
                };
                window.calculatePickValue = (year, round) => {
                    const yearsOut = year - gameState.currentSeason;
                    const base = round === 1 ? 30 : 15;
                    return Math.max(5, base - (yearsOut * 3));
                };
                window.getEffectiveCap = (team) => SalaryCapEngine.getEffectiveCap(team, gameState.currentTier);
                window.saveGameState = saveGameState;
                window.executeTrade = (partnerId, userGiveIds, userReceiveIds, userGivesPicks, userReceivesPicks) => {
                    const userTeam = getUserTeam();
                    const aiTeam = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams].find(t => t.id === partnerId);
                    if (!userTeam || !aiTeam) return;
                    
                    TradeEngine.executeTrade({
                        team1: userTeam,
                        team2: aiTeam,
                        team1GivesPlayerIds: userGiveIds,
                        team2GivesPlayerIds: userReceiveIds,
                        team1GivesPicks: userGivesPicks || [],
                        team2GivesPicks: userReceivesPicks || [],
                        applyTradePenalty: (team, player) => ChemistryEngine.applyTradePenalty(team, player),
                        initializePlayerChemistry: (player) => ChemistryEngine.initializePlayer(player),
                        tradeDraftPick: (fromId, toId, origId, year, round) => {
                            if (!gameState.draftPickOwnership) return;
                            const key = `${origId}_${year}_${round}`;
                            gameState.draftPickOwnership[key] = toId;
                        }
                    });
                    
                    eventBus.emit(GameEvents.TRADE_ACCEPTED, {
                        userTeamId: userTeam.id, aiTeamId: aiTeam.id, aiTeamName: aiTeam.name,
                        userGave: userGiveIds.map(id => { const p = aiTeam.roster.find(pl => pl.id === id); return p ? p.name : '?'; }),
                        userReceived: userReceiveIds.map(id => { const p = userTeam.roster.find(pl => pl.id === id); return p ? p.name : '?'; }),
                        source: 'user_proposed'
                    });
                    
                    if (gameState.tradeHistory) {
                        gameState.tradeHistory.push({
                            season: gameState.currentSeason, date: gameState.currentDate,
                            tier: gameState.currentTier,
                            team1: { id: userTeam.id, name: userTeam.name },
                            team2: { id: aiTeam.id, name: aiTeam.name },
                            team1Gave: [], team2Gave: [],
                            type: 'user-proposed'
                        });
                    }
                    
                    saveGameState();
                    getDashboardController().refresh();
                    window._reactGameState = gameState;
                    if (window._notifyReact) window._notifyReact();
                };
                
                // ── Bridge gameState to React UI ──
                window._reactGameState = gameState;
                if (window._notifyReact) window._notifyReact();
                
                console.log('The Association Project loaded successfully!');
                console.log('Rosters: All teams have 12-15 players');
                console.log('Free Agents: ' + gameState.freeAgents.length + ' available');
                
                // Auto-resume offseason if we loaded mid-offseason
                if (hasExistingGame && gameState.offseasonPhase && gameState.offseasonPhase !== 'none') {
                    console.log(`📋 Resuming offseason from saved phase: ${gameState.offseasonPhase}`);
                    // Small delay to let the UI finish rendering before showing offseason modals
                    setTimeout(() => getOffseasonController().resumeOffseason(), 100);
                }
            } catch(error) {
                alert('Error loading game: ' + error.message);
                console.error('Load error:', error);
                console.error('Stack:', error.stack);
            }
        })(); // end init IIFE

        // ═══════════════════════════════════════════════════════════════════
        // GLOBAL EXPORTS — HTML onclick handlers route to controllers
        // ═══════════════════════════════════════════════════════════════════
        window.acceptAiTradeProposal = (...args) => getTradeController().acceptAiTradeProposal(...args);
        window.acceptSponsor = (...args) => getFinanceController().acceptSponsor(...args);
        window.addToWatchList = (...args) => getRosterController().addToWatchList(...args);
        window.advanceToNextSeason = (...args) => getOffseasonController().advanceToNextSeason(...args);
        window.closeCollegeGradResults = (...args) => getDraftController().closeCollegeGradResults(...args);
        window.closeDevelopmentSummary = (...args) => getOffseasonController().closeDevelopmentSummary(...args);
        window.closeDraftResults = (...args) => getDraftController().closeDraftResults(...args);
        window.closeLotteryModal = (...args) => getDraftController().closeLotteryModal(...args);
        window.closeSeasonEnd = (...args) => getGameSimController().closeSeasonEnd(...args);
        window.confirmOffseasonDecisions = (...args) => getOffseasonController().confirmOffseasonDecisions(...args);
        window.closeBracketViewer = () => { if (window._reactCloseBracket) window._reactCloseBracket(); };
        window.openBracketViewer = () => getGameSimController().openBracketViewer();
        window.showPlayoffBoxScore = (seriesKey, gameIdx) => getGameSimController().showPlayoffBoxScore(seriesKey, gameIdx);
        window.continueAfterPostseason = (...args) => getOffseasonController().continueAfterPostseason(...args);
        window.dropPlayer = (...args) => getRosterController().dropPlayer(...args);
        window.filterCollegeGrads = (...args) => getDraftController().filterCollegeGrads(...args);
        window.filterDraftProspects = (...args) => getDraftController().filterDraftProspects(...args);
        window.openFinanceDashboard = (...args) => getFinanceController().openFinanceDashboard(...args);
        window.rejectAiTradeProposal = (...args) => getTradeController().rejectAiTradeProposal(...args);
        window.removeFromWatchList = (...args) => getRosterController().removeFromWatchList(...args);
        window.selectDraftProspect = (...args) => getDraftController().selectDraftProspect(...args);
        window.setMarketingBudget = (...args) => getFinanceController().setMarketingBudget(...args);
        window.showDraftRound = (...args) => getDraftController().showDraftRound(...args);
        window.showUserDraftPicks = (...args) => getDraftController().showUserDraftPicks(...args);
        window.signPlayer = (...args) => getRosterController().signPlayer(...args);
        window.signFreeAgent = (...args) => getRosterController().signPlayer(...args);
        window.simRestOfPlayoffSeries = (...args) => getGameSimController().simRestOfPlayoffSeries(...args);
        // Calendar-based playoff sim methods — routed to PlayoffSimController
        window.simPlayoffDay = () => getPlayoffSimController().simPlayoffDay();
        window.simUserPlayoffSeries = () => getPlayoffSimController().simUserPlayoffSeries();
        window.simPlayoffRound = () => getPlayoffSimController().simPlayoffRound();
        window.simToChampionship = () => getPlayoffSimController().simToChampionship();
        window.watchPlayoffGame = () => getGameSimController().watchCalendarPlayoffGame();
        window.skipCollegeGradFA = (...args) => getDraftController().skipCollegeGradFA(...args);
        window.submitCollegeGradOffers = (...args) => getDraftController().submitCollegeGradOffers(...args);
        window.toggleCollegeGradSelection = (...args) => getDraftController().toggleCollegeGradSelection(...args);
        window.toggleOwnerMode = (...args) => getFinanceController().toggleOwnerMode(...args);
        window.updateOwnerSpendingRatio = (...args) => getFinanceController().updateOwnerSpendingRatio(...args);
        window.updateSpendingRatio = (...args) => getFinanceController().updateSpendingRatio(...args);
        window.updateTicketPrice = (...args) => getFinanceController().updateTicketPrice(...args);
        window.upgradeArena = (...args) => getFinanceController().upgradeArena(...args);
        window.watchGameClose = (...args) => getGameSimController().watchGameClose(...args);
        window.watchGameSetSpeed = (...args) => getGameSimController().watchGameSetSpeed(...args);
        window.watchGameSkip = (...args) => getGameSimController().watchGameSkip(...args);
        window.watchGameTogglePause = (...args) => getGameSimController().watchGameTogglePause(...args);
        window.watchNextGame = (...args) => getGameSimController().watchNextGame(...args);

        // ─── Local functions called from HTML ───
        window.closeRosterManagementDynamic = closeRosterManagementDynamic;
        window.continueFreeAgency = (...args) => getFreeAgencyController().continue(...args);
        window.fireCoach = () => getCoachManagementController().fire();
        window.hireCoach = (id, isPoach) => getCoachManagementController().hire(id, isPoach);
        window.isOnWatchList = (playerId) => getRosterController()._isOnWatchList(playerId);
        window.openCalendarView = openCalendarView;
        window.openCoachManagement = () => getCoachManagementController().open();
        window.formatCurrency = formatCurrency;
        window.calculateTeamSalary = calculateTeamSalary;
        window.determineContractLength = determineContractLength;
        window.generateSalary = generateSalary;
        window.openRosterManagement = openRosterManagement;
        window._buildRosterData = _buildRosterData;
        window.openRosterManagementFromCompliance = openRosterManagementFromCompliance;
        window.openRosterManagementHub = openRosterManagementHub;
        window.openTradeScreenFromRoster = openTradeScreenFromRoster;
        window.recheckRosterCompliance = recheckRosterCompliance;
        window.resetGame = () => getSaveLoadController().reset();
        window.downloadSave = () => getSaveLoadController().downloadSave();
        window.uploadSave = () => getSaveLoadController().uploadSave();
        window.openGameMenu = () => { if (window._reactOpenGameMenu) window._reactOpenGameMenu(); };
        window.closeGameMenu = () => { if (window._reactCloseGameMenu) window._reactCloseGameMenu(); };
        window.selectTeam = selectTeam;
        window.showBoxScore = showBoxScore;
        window.CalendarEngine = CalendarEngine;
        window.skipFreeAgency = (...args) => getFreeAgencyController().skip(...args);

        // Note: SimBenchmark is defined separately outside _initGame

    }; // end window._initGame
