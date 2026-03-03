// ═══════════════════════════════════════════════════════════════════
// DashboardController — Main Game Screen Rendering
// ═══════════════════════════════════════════════════════════════════
// Mode-agnostic controller that owns the main dashboard UI:
// info cards, standings, schedule, season history, franchise history.
//
// Any game mode (GM, Coach, Board Member) can call these methods
// to refresh the screen after state changes.
//
// All HTML generation is delegated to UIRenderer.
// Created by extracting ~378 lines from index.html.
// ═══════════════════════════════════════════════════════════════════

export class DashboardController {
    constructor(ctx) {
        this.ctx = ctx;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Master Refresh
    // ═══════════════════════════════════════════════════════════════

    /**
     * Full dashboard refresh — updates all info cards, standings,
     * schedule, and history panels. Called after every sim action.
     */
    refresh() {
        const { gameState, engines, helpers } = this.ctx;
        const { CalendarEngine, LeagueManager, SalaryCapEngine, FinanceEngine,
                CoachEngine, UIHelpers, UIRenderer } = engines;

        const teams = helpers.getCurrentTeams();
        const userTeam = teams.find(t => t.id === gameState.userTeamId);
        const numGames = gameState.currentTier === 1 ? 82 : gameState.currentTier === 2 ? 60 : 40;

        // ── Tier badge & league name ──
        const tierBadge = document.getElementById('tierBadge');
        tierBadge.textContent = `TIER ${gameState.currentTier}`;
        tierBadge.className = `tier-badge tier-${gameState.currentTier}`;

        const leagueName = gameState.currentTier === 1
            ? 'North American Premier League'
            : gameState.currentTier === 2
                ? 'North American Regional Basketball League'
                : 'Metro Basketball League';
        document.getElementById('leagueName').textContent = leagueName;

        // ── Info cards ──
        document.getElementById('currentSeason').textContent =
            `${gameState.currentSeason}-${(gameState.currentSeason + 1) % 100}`;
        document.getElementById('currentGame').textContent = userTeam.wins + userTeam.losses;
        document.getElementById('totalGames').textContent = numGames;
        document.getElementById('userTeamName').textContent = userTeam.name;
        document.getElementById('userRecord').textContent = `${userTeam.wins}-${userTeam.losses}`;

        // ── Current date ──
        const dateDisplay = document.getElementById('currentDateDisplay');
        if (dateDisplay && gameState.currentDate) {
            dateDisplay.textContent = CalendarEngine.formatDateDisplay(gameState.currentDate);
        } else if (dateDisplay) {
            dateDisplay.textContent = '-';
        }

        // ── Calendar events ──
        const calEventEl = document.getElementById('calendarEvent');
        if (calEventEl && gameState.currentDate) {
            const calEvent = CalendarEngine.getCalendarEvent(gameState.currentDate, gameState.seasonDates);
            if (calEvent) {
                calEventEl.textContent = calEvent;
                calEventEl.style.display = 'block';
            } else {
                calEventEl.style.display = 'none';
            }
        }

        // ── Roster strength ──
        const rosterStrength = LeagueManager.calculateTeamStrength(userTeam);
        const strengthDisplay = document.getElementById('rosterStrength');
        if (strengthDisplay) {
            strengthDisplay.textContent = `⭐ ${Math.round(rosterStrength)}`;
            strengthDisplay.style.color = UIHelpers.getRatingColor(Math.round(rosterStrength));
        }

        // ── Budget display ──
        const budgetDisplay = document.getElementById('budgetDisplay');
        const budgetSubDisplay = document.getElementById('budgetSubDisplay');
        if (budgetDisplay) {
            FinanceEngine.ensureFinances(userTeam);
            const capSpace = SalaryCapEngine.getRemainingCap(userTeam);
            const spLimit = SalaryCapEngine.getEffectiveCap(userTeam);
            budgetDisplay.textContent = SalaryCapEngine.formatCurrency(capSpace);
            budgetDisplay.style.color = capSpace > 0 ? '#34a853' : '#ea4335';
            budgetSubDisplay.textContent =
                `of ${SalaryCapEngine.formatCurrency(spLimit)} ${userTeam.tier === 1 ? 'cap' : 'limit'}`;
        }

        // ── Coach display ──
        const coachNameEl = document.getElementById('coachNameDisplay');
        const coachOvrEl = document.getElementById('coachOverallDisplay');
        if (coachNameEl) {
            if (userTeam.coach) {
                coachNameEl.textContent = userTeam.coach.name;
                coachOvrEl.textContent = `${userTeam.coach.overall} OVR · ${userTeam.coach.archetype}`;
                coachOvrEl.style.color = CoachEngine.getOverallColor(userTeam.coach.overall);
            } else {
                coachNameEl.textContent = '⚠️ No Coach';
                coachNameEl.style.color = '#ea4335';
                coachOvrEl.textContent = 'Click to hire';
                coachOvrEl.style.color = '#ffa07a';
            }
        }

        // ── Standings legend ──
        if (gameState.currentTier === 2) {
            document.getElementById('promotionLegend').style.display = 'flex';
            document.getElementById('playoffLegendText').textContent = 'Promotion Playoff';
            document.getElementById('autoZoneLegendText').textContent = 'Safe';
        } else {
            document.getElementById('promotionLegend').style.display = 'none';
            document.getElementById('playoffLegendText').textContent = 'Relegation Playoff';
            document.getElementById('autoZoneLegendText').textContent = 'Auto-Relegation';
        }

        // ── Sim button states ──
        const seasonComplete = gameState.isSeasonComplete();
        const inOffseason = gameState.offseasonPhase && gameState.offseasonPhase !== 'none';
        const simNextBtn = document.getElementById('simNextBtn');
        const simDayBtn = document.getElementById('simDayBtn');
        const simWeekBtn = document.getElementById('simWeekBtn');
        const finishBtn = document.getElementById('finishBtn');
        if (simNextBtn) simNextBtn.disabled = seasonComplete;
        if (simDayBtn) simDayBtn.disabled = seasonComplete;
        if (simWeekBtn) simWeekBtn.disabled = seasonComplete;
        if (finishBtn) finishBtn.disabled = seasonComplete && !inOffseason;

        // ── Sub-panels ──
        this.refreshStandings();
        this.refreshSchedule();
        this.refreshHistory();

        // ── Notify React UI ──
        if (window._notifyReact) window._notifyReact();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Standings
    // ═══════════════════════════════════════════════════════════════

    /**
     * Refresh the standings panel. Routes to the correct display
     * based on current view state (overall/division, current/other tier).
     */
    refreshStandings() {
        const { gameState, helpers } = this.ctx;

        // If viewing a specific tier, show that instead
        if (gameState.viewingTier !== null && gameState.viewingTier !== gameState.currentTier) {
            this.viewTier(gameState.viewingTier);
            return;
        }

        // Reset to show current tier
        gameState.viewingTier = null;
        document.getElementById('standingsLeagueInfo').textContent = '';

        const teams = helpers.getCurrentTeams();

        if (gameState.standingsView === 'division') {
            this._renderDivisionStandings(teams);
        } else {
            this._renderStandingsTable(teams, gameState.currentTier);
        }
    }

    /**
     * Switch standings to view a different tier.
     */
    viewTier(tier) {
        const { gameState, engines } = this.ctx;
        gameState.viewingTier = tier;

        let teams, leagueName;
        if (tier === 1) {
            teams = gameState.tier1Teams;
            leagueName = 'North American Premier League (Tier 1)';
        } else if (tier === 2) {
            teams = gameState.tier2Teams;
            leagueName = 'North American Regional Basketball League (Tier 2)';
        } else {
            teams = gameState.tier3Teams;
            leagueName = 'Metro Basketball League (Tier 3)';
        }

        document.getElementById('standingsLeagueInfo').textContent = `Viewing: ${leagueName}`;

        if (gameState.standingsView === 'division') {
            this._renderDivisionStandings(teams);
        } else {
            this._renderStandingsTable(teams, tier);
        }
    }

    /**
     * Toggle between overall and division standings views.
     */
    toggleView(view) {
        const { gameState } = this.ctx;
        gameState.standingsView = view;

        const overallBtn = document.getElementById('viewOverallBtn');
        const divisionBtn = document.getElementById('viewDivisionBtn');

        if (view === 'overall') {
            overallBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #5568d3 100%)';
            divisionBtn.style.background = '';
        } else {
            overallBtn.style.background = '';
            divisionBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #5568d3 100%)';
        }

        this.refreshStandings();
    }

    /**
     * Render overall standings table for a given tier.
     * Consolidates the old displayOverallStandings and displayTierOverallStandings
     * which were nearly identical.
     */
    _renderStandingsTable(teams, tier) {
        const { gameState, engines } = this.ctx;
        const { LeagueManager, UIRenderer } = engines;

        const sortedTeams = LeagueManager.sortTeamsByStandings(teams, gameState.schedule);

        document.getElementById('standingsBody').innerHTML =
            UIRenderer.standingsRows({ sortedTeams, tier, userTeamId: gameState.userTeamId });
    }

    /**
     * Render division-grouped standings.
     */
    _renderDivisionStandings(teams) {
        const { gameState, engines } = this.ctx;
        const { UIRenderer } = engines;

        const divisions = {};
        teams.forEach(team => {
            if (!divisions[team.division]) divisions[team.division] = [];
            divisions[team.division].push(team);
        });

        Object.keys(divisions).forEach(division => {
            divisions[division].sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.pointDiff - a.pointDiff;
            });
        });

        const sortedDivisions = Object.keys(divisions).sort();

        document.getElementById('standingsBody').innerHTML = UIRenderer.divisionStandingsRows({
            sortedDivisions, divisions, userTeamId: gameState.userTeamId
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  Schedule / Next Games
    // ═══════════════════════════════════════════════════════════════

    /**
     * Refresh the today's games and upcoming schedule panels.
     */
    refreshSchedule() {
        const { gameState, engines } = this.ctx;
        const { CalendarEngine, UIRenderer } = engines;

        const currentDate = gameState.currentDate;
        if (!currentDate) {
            const container = document.getElementById('nextGamesContainer');
            if (container) container.innerHTML = '<p style="text-align: center; opacity: 0.7;">No schedule yet</p>';
            return;
        }

        // ── Today's games panel ──
        const todaysContainer = document.getElementById('todaysGamesContainer');
        if (todaysContainer) {
            const todaysGames = CalendarEngine.getGamesForDate(currentDate, gameState);
            const unplayedToday = todaysGames.tier1.filter(g => !g.played).length +
                                  todaysGames.tier2.filter(g => !g.played).length +
                                  todaysGames.tier3.filter(g => !g.played).length;

            if (unplayedToday > 0) {
                const userTier = gameState.currentTier;
                let userTierTeams = userTier === 1 ? gameState.tier1Teams
                    : userTier === 2 ? gameState.tier2Teams : gameState.tier3Teams;

                todaysContainer.innerHTML = UIRenderer.todaysGamesPanel({
                    todaysGames, userTier, userTeams: userTierTeams,
                    userTeamId: gameState.userTeamId, currentDate, CalendarEngine
                });
            } else {
                todaysContainer.innerHTML = '';
            }
        }

        // ── Upcoming user schedule ──
        const container = document.getElementById('nextGamesContainer');
        if (!container) return;

        const userTeamId = gameState.userTeamId;
        const userTier = gameState.currentTier;
        let userSchedule, userTeams;
        if (userTier === 1) { userSchedule = gameState.tier1Schedule; userTeams = gameState.tier1Teams; }
        else if (userTier === 2) { userSchedule = gameState.tier2Schedule; userTeams = gameState.tier2Teams; }
        else { userSchedule = gameState.tier3Schedule; userTeams = gameState.tier3Teams; }

        if (!userSchedule) {
            container.innerHTML = '<p style="text-align: center; opacity: 0.7;">No schedule available</p>';
            return;
        }

        const upcomingGames = userSchedule.filter(g =>
            !g.played &&
            g.date >= currentDate &&
            (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId)
        ).slice(0, 5);

        if (upcomingGames.length === 0) {
            container.innerHTML = '<p style="text-align: center; opacity: 0.7;">Season complete!</p>';
            return;
        }

        container.innerHTML = UIRenderer.upcomingGamesPanel({
            upcomingGames, userTeams, userTeamId, CalendarEngine
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  Season / Franchise History
    // ═══════════════════════════════════════════════════════════════

    /**
     * Refresh the season history sidebar.
     */
    refreshHistory() {
        const { gameState, engines } = this.ctx;
        const { UIHelpers } = engines;

        if (gameState.seasonHistory.length === 0) {
            document.getElementById('seasonHistory').style.display = 'none';
            return;
        }

        document.getElementById('seasonHistory').style.display = 'block';

        document.getElementById('historyList').innerHTML = gameState.seasonHistory.map(season => `
            <div class="history-item">
                <span><strong>${season.season}</strong></span>
                <span>Tier ${season.tier}</span>
                <span>${season.wins}-${season.losses}</span>
                <span>${season.rank}${UIHelpers.getRankSuffix(season.rank)} place</span>
                <span>${season.pointDiff > 0 ? '+' : ''}${season.pointDiff} diff</span>
            </div>
        `).join('');
    }

    /**
     * Open the franchise history modal.
     */
    openFranchiseHistory() {
        const { gameState, engines, helpers } = this.ctx;
        const { UIRenderer } = engines;

        const history = gameState._fullSeasonHistory || gameState.fullSeasonHistory || [];

        if (window._reactShowFranchise) {
            window._reactShowFranchise({ history });
            return;
        }

        document.getElementById('franchiseHistoryContent').innerHTML = UIRenderer.franchiseHistory({
            history,
            getRankSuffix: helpers.getRankSuffix
        });
        document.getElementById('franchiseHistoryModal').classList.remove('hidden');
    }
}
