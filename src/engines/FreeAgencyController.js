// ═══════════════════════════════════════════════════════════════════
// FreeAgencyController — Orchestrates Free Agency UI
// ═══════════════════════════════════════════════════════════════════
// Handles both offseason free agency (multi-player bidding with AI
// competition) and manages the modal lifecycle. All HTML generation
// is delegated to UIRenderer; all business logic to FreeAgencyEngine.
//
// Created by extracting ~450 lines from index.html.
// ═══════════════════════════════════════════════════════════════════

export class FreeAgencyController {
    constructor(ctx) {
        this.ctx = ctx;

        // ── Offseason modal state ──
        this.selectedIds = new Set();       // player IDs user has checked
        this.formerPlayers = [];            // cached: ex-team players
        this.otherPlayers = [];             // cached: everyone else (capped)
        this.hiddenCount = 0;              // how many low-rated players hidden
    }

    // ═══════════════════════════════════════════════════════════════
    //  Offseason Free Agency — Full Modal Flow
    // ═══════════════════════════════════════════════════════════════

    /**
     * Open the offseason free agency modal.
     * Called from OffseasonController when FA phase begins.
     */
    show() {
        const { gameState, engines, helpers } = this.ctx;
        const { SalaryCapEngine, TeamFactory, UIRenderer } = engines;
        const userTeam = helpers.getUserTeam();

        // Reset selection state
        this.selectedIds = new Set();

        // Cap info
        const capSpace = SalaryCapEngine.getRemainingCap(userTeam);

        // Split free agents into former players and others
        const formerPlayers = gameState.freeAgents
            .filter(p => p.previousTeamId && p.previousTeamId === userTeam.id)
            .sort((a, b) => b.rating - a.rating);

        const otherPlayers = gameState.freeAgents
            .filter(p => !p.previousTeamId || p.previousTeamId !== userTeam.id)
            .sort((a, b) => b.rating - a.rating);

        // Pre-select former players
        formerPlayers.forEach(p => this.selectedIds.add(String(p.id)));

        // Cap visible list for performance
        const MAX_OTHER = 150;
        this.formerPlayers = formerPlayers;
        this.otherPlayers = otherPlayers.slice(0, MAX_OTHER);
        this.hiddenCount = otherPlayers.length - this.otherPlayers.length;

        // React routing
        if (window._reactShowFA) {
            const { ScoutingEngine } = engines;
            const { formatCurrency } = helpers;

            // Pre-compute player data for React
            const enrichPlayer = (p, isFormer) => {
                const fit = ScoutingEngine.calculateTeamFit(p, userTeam, userTeam.coach);
                const marketValue = TeamFactory.getMarketValue(p, userTeam.tier);
                const natTier = TeamFactory.getPlayerNaturalTier(p);
                const minOffer = Math.round(marketValue * 0.8);
                const maxOffer = Math.round(marketValue * 1.2);
                const suggestedYears = TeamFactory.determineContractLength(p.age, p.rating);
                const previousTeam = p.previousTeamId ? helpers.getTeamById(p.previousTeamId) : null;

                p._fitGrade = fit.grade;
                p._fitColor = ScoutingEngine.gradeColor(fit.grade);
                p._marketValue = marketValue;
                p._minOffer = minOffer;
                p._maxOffer = maxOffer;
                p._suggestedYears = suggestedYears;
                p._naturalTier = natTier;
                p._isAboveTier = natTier < userTeam.tier;
                p._isFormer = isFormer;
                p._isWatched = this._isOnWatchList(p.id);
                p._marketDisplayHtml = UIRenderer.formatMarketDisplay(p, userTeam.tier);
                // Structured market data for React rendering
                const TF = window.TeamFactory;
                const tierValue = TF ? TF.getMarketValue(p, userTeam.tier) : (p.salary || 0);
                const natTierColors = { 1: '#ff6b6b', 2: '#4ecdc4', 3: '#95afc0' };
                p._marketData = {
                    value: UIRenderer.formatCurrency(tierValue),
                    natTier: natTier,
                    badgeColor: natTierColors[natTier] || '#95afc0',
                    crossTierValue: (natTier < userTeam.tier && TF) ? UIRenderer.formatCurrency(TF.getNaturalMarketValue(p)) : null,
                };
                p._fromTeamName = isFormer ? userTeam.name : (previousTeam ? previousTeam.name : (p.isCollegeGrad ? '🎓 ' + p.college : 'N/A'));
                return p;
            };

            const enrichedFormer = formerPlayers.map(p => enrichPlayer(p, true));
            const enrichedOther = this.otherPlayers.map(p => enrichPlayer(p, false));

            // Submit callback
            window._faSubmitOffers = (offerData) => {
                gameState.userFreeAgencyOffers = offerData.map(o => ({
                    teamId: userTeam.id,
                    playerId: o.playerId,
                    salary: o.salary,
                    years: o.years,
                    tier: userTeam.tier,
                    teamRating: userTeam.rating,
                    teamSuccess: userTeam.wins / (userTeam.wins + userTeam.losses || 1)
                }));
                this._processAndShowReactResults();
            };

            window._reactShowFA({
                phase: 'select',
                formerPlayers: enrichedFormer,
                otherPlayers: enrichedOther,
                hiddenCount: this.hiddenCount,
                roster: [...(userTeam.roster || [])].sort((a, b) => b.rating - a.rating),
                capSpace,
                formatCurrency,
                getTeamById: (id) => helpers.getTeamById(id),
            });
            return;
        }

        document.getElementById('faCapSpace').textContent = SalaryCapEngine.formatCurrency(capSpace);
        document.getElementById('faCurrentRoster').innerHTML = this._buildRosterSidebar(userTeam);

        // Empty state
        if (gameState.freeAgents.length === 0) {
            document.getElementById('freeAgencyPlayersList').innerHTML = UIRenderer.faEmptyState();
            document.getElementById('submitOffersBtn').disabled = true;
            document.getElementById('freeAgencyModal').classList.remove('hidden');
            return;
        }

        // Build initial list
        const html = this._buildPlayerList('ALL');
        document.getElementById('freeAgencyPlayersList').innerHTML = html;
        document.getElementById('freeAgencyModal').classList.remove('hidden');

        // Initial panel updates
        if (formerPlayers.length > 0) {
            this._updateOffers();
        }
        this._updateTally();
    }

    /**
     * Build the roster sidebar showing current team composition and cap.
     */
    _buildRosterSidebar(team) {
        const { SalaryCapEngine, UIRenderer } = this.ctx.engines;
        const { formatCurrency } = this.ctx.helpers;

        if (!team.roster || team.roster.length === 0) {
            return '<p style="text-align: center; opacity: 0.6; padding: 20px;">No players on roster</p>';
        }

        const sortedRoster = [...team.roster].sort((a, b) => b.rating - a.rating);
        const byPosition = {
            'PG': sortedRoster.filter(p => p.position === 'PG'),
            'SG': sortedRoster.filter(p => p.position === 'SG'),
            'SF': sortedRoster.filter(p => p.position === 'SF'),
            'PF': sortedRoster.filter(p => p.position === 'PF'),
            'C': sortedRoster.filter(p => p.position === 'C')
        };

        const teamEffCap = SalaryCapEngine.getEffectiveCap(team);
        const baseCap = SalaryCapEngine.getSalaryCap(team.tier);
        const totalSalary = SalaryCapEngine.calculateTeamSalary(team);

        return UIRenderer.currentRosterSidebar({
            roster: team.roster, byPosition, teamEffCap, baseCap,
            tier: team.tier, totalSalary, formatCurrency
        });
    }

    /**
     * Build the full free agent player list HTML.
     * Handles former players, watched players, and general FA pool.
     */
    _buildPlayerList(positionFilter) {
        const { gameState, engines, helpers } = this.ctx;
        const { ScoutingEngine, TeamFactory, UIRenderer } = engines;
        const userTeam = helpers.getUserTeam();
        const selected = this.selectedIds;

        if (gameState.freeAgents.length === 0) {
            return UIRenderer.faEmptyState();
        }

        const shownCount = this.formerPlayers.length + this.otherPlayers.length;
        let html = UIRenderer.faListHeader({
            totalCount: gameState.freeAgents.length,
            shownCount, formerCount: this.formerPlayers.length,
            hiddenCount: this.hiddenCount, positionFilter
        });

        html += UIRenderer.faTableHeader();

        // ── Former players ──
        const filteredFormer = positionFilter && positionFilter !== 'ALL'
            ? this.formerPlayers.filter(p => p.position === positionFilter)
            : this.formerPlayers;

        filteredFormer.forEach(player => {
            const fit = ScoutingEngine.calculateTeamFit(player, userTeam, userTeam.coach);
            html += UIRenderer.faFormerPlayerRow({
                player, isChecked: selected.has(String(player.id)),
                fitGrade: fit.grade, gradeColor: ScoutingEngine.gradeColor(fit.grade),
                watched: this._isOnWatchList(player.id),
                marketDisplay: UIRenderer.formatMarketDisplay(player, userTeam.tier),
                teamName: userTeam.name
            });
        });

        // ── Watched players (non-former) ──
        const watchedFAs = this.otherPlayers.filter(p => this._isOnWatchList(p.id));
        const unwatchedFAs = this.otherPlayers.filter(p => !this._isOnWatchList(p.id));

        if (watchedFAs.length > 0) {
            html += UIRenderer.faSectionDivider({
                label: '🔍 WATCHED PLAYERS', count: watchedFAs.length,
                color: '#bb86fc', borderColor: 'rgba(155,89,182,0.4)'
            });

            const filteredWatched = positionFilter && positionFilter !== 'ALL'
                ? watchedFAs.filter(p => p.position === positionFilter) : watchedFAs;

            filteredWatched.forEach(player => {
                const previousTeam = player.previousTeamId ? helpers.getTeamById(player.previousTeamId) : null;
                const previousTeamName = previousTeam ? previousTeam.name
                    : (player.isCollegeGrad ? `🎓 ${player.college}` : 'N/A');
                const fit = ScoutingEngine.calculateTeamFit(player, userTeam, userTeam.coach);
                player._marketDisplay = UIRenderer.formatMarketDisplay(player, userTeam.tier);
                html += UIRenderer.faPlayerRow({
                    player, isChecked: selected.has(String(player.id)),
                    fitGrade: fit.grade, gradeColor: ScoutingEngine.gradeColor(fit.grade),
                    previousTeamName, isWatched: true
                });
            });
        }

        // ── Unwatched players ──
        let filteredUnwatched = positionFilter && positionFilter !== 'ALL'
            ? unwatchedFAs.filter(p => p.position === positionFilter) : unwatchedFAs;

        if (filteredUnwatched.length > 0) {
            const label = positionFilter && positionFilter !== 'ALL'
                ? `OTHER AVAILABLE FREE AGENTS (${positionFilter})`
                : 'OTHER AVAILABLE FREE AGENTS';
            html += UIRenderer.faSectionDivider({
                label, count: filteredUnwatched.length,
                color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)'
            });
            if (this.hiddenCount > 0) {
                html += `<tr><td colspan="8" style="padding: 5px 15px; font-size: 0.85em; opacity: 0.6; text-align: center;">${this.hiddenCount} more lower-rated players not shown</td></tr>`;
            }
        }

        filteredUnwatched.forEach(player => {
            const previousTeam = player.previousTeamId ? helpers.getTeamById(player.previousTeamId) : null;
            const previousTeamName = previousTeam ? previousTeam.name
                : (player.isCollegeGrad ? `🎓 ${player.college}` : 'N/A');
            const fit = ScoutingEngine.calculateTeamFit(player, userTeam, userTeam.coach);
            player._marketDisplay = UIRenderer.formatMarketDisplay(player, userTeam.tier);
            html += UIRenderer.faPlayerRow({
                player, isChecked: selected.has(String(player.id)),
                fitGrade: fit.grade, gradeColor: ScoutingEngine.gradeColor(fit.grade),
                previousTeamName, isWatched: false
            });
        });

        html += '</tbody></table>';
        return html;
    }

    /**
     * Helper: check watch list via RosterController
     */
    _isOnWatchList(playerId) {
        const { helpers } = this.ctx;
        return helpers.getRosterController()._isOnWatchList(playerId);
    }

    // ── Filter / Selection handlers ──

    /**
     * Re-filter the FA list by position dropdown.
     * Preserves checkbox selections across rebuilds.
     */
    filterByPosition() {
        const { gameState } = this.ctx;
        const positionFilter = document.getElementById('faPositionFilter').value;

        // Sync visible checkboxes into persistent Set before rebuild
        gameState.freeAgents.forEach(fa => {
            const cb = document.getElementById(`fa_${fa.id}`);
            if (cb) {
                if (cb.checked) this.selectedIds.add(String(fa.id));
                else this.selectedIds.delete(String(fa.id));
            }
        });

        const html = this._buildPlayerList(positionFilter);
        document.getElementById('freeAgencyPlayersList').innerHTML = html;

        this._updateOffers();
        this._updateTally();
    }

    /**
     * Toggle a single player's selection checkbox.
     */
    toggleSelection(playerId) {
        const checkbox = document.getElementById(`fa_${playerId}`);
        const idStr = String(playerId);

        if (checkbox && checkbox.checked) {
            this.selectedIds.add(idStr);
        } else {
            this.selectedIds.delete(idStr);
        }

        this._updateOffers();
        this._updateTally();
    }

    // ── Offer panels ──

    /**
     * Update the running tally bar (count, estimated cost, remaining cap).
     */
    _updateTally() {
        const { gameState, engines, helpers } = this.ctx;
        const { SalaryCapEngine, TeamFactory } = engines;
        const userTeam = helpers.getUserTeam();
        if (!userTeam) return;

        const selectedPlayers = gameState.freeAgents.filter(fa => this.selectedIds.has(String(fa.id)));

        const tallyEl = document.getElementById('faOfferTally');
        if (!tallyEl) return;

        if (selectedPlayers.length === 0) {
            tallyEl.style.display = 'none';
            return;
        }

        tallyEl.style.display = 'block';

        const estCost = selectedPlayers.reduce((sum, p) => sum + TeamFactory.getMarketValue(p, userTeam.tier), 0);
        const capSpace = SalaryCapEngine.getRemainingCap(userTeam);
        const remaining = capSpace - estCost;

        document.getElementById('faOfferCount').textContent = selectedPlayers.length;
        document.getElementById('faOfferTotal').textContent = SalaryCapEngine.formatCurrency(estCost);

        const remEl = document.getElementById('faOfferRemaining');
        remEl.textContent = SalaryCapEngine.formatCurrency(remaining);
        remEl.style.color = remaining >= 0 ? '#34a853' : '#ea4335';
    }

    /**
     * Update the detailed offers panel (salary sliders, contract length pickers).
     */
    _updateOffers() {
        const { gameState, engines, helpers } = this.ctx;
        const { SalaryCapEngine, TeamFactory, UIRenderer } = engines;
        const { formatCurrency } = helpers;
        const userTeam = helpers.getUserTeam();

        const selectedPlayers = gameState.freeAgents.filter(fa => this.selectedIds.has(String(fa.id)));
        const offerCount = selectedPlayers.length;

        document.getElementById('offerCount').textContent = offerCount;

        if (offerCount === 0) {
            document.getElementById('selectedOffersPanel').style.display = 'none';
            document.getElementById('submitOffersBtn').disabled = true;
            return;
        }

        document.getElementById('selectedOffersPanel').style.display = 'block';
        document.getElementById('submitOffersBtn').disabled = false;

        let html = '';
        selectedPlayers.forEach(player => {
            const marketValue = TeamFactory.getMarketValue(player, userTeam.tier);
            const playerNatTier = TeamFactory.getPlayerNaturalTier(player);
            const minOffer = Math.round(marketValue * 0.8);
            const maxOffer = Math.round(marketValue * 1.2);
            const suggestedYears = TeamFactory.determineContractLength(player.age, player.rating);
            const isFormerPlayer = player.previousTeamId === userTeam.id;
            const isAboveTier = playerNatTier < userTeam.tier;

            // Cache for validation during submit
            player._faMarketValue = marketValue;
            player._faMinOffer = minOffer;
            player._faMaxOffer = maxOffer;

            html += UIRenderer.faOfferCard({
                player, marketValue, minOffer, maxOffer, suggestedYears,
                isFormerPlayer, isAboveTier, playerNatTier, userTier: userTeam.tier,
                formatCurrency,
                formatMarketDisplay: (p, t) => UIRenderer.formatMarketDisplay(p, t)
            });
        });

        document.getElementById('offersList').innerHTML = html;
    }

    // ── Submit / Skip ──

    /**
     * Validate and submit all user offers, then process the full FA round.
     */
    submitOffers() {
        const { gameState, engines, helpers } = this.ctx;
        const { SalaryCapEngine } = engines;
        const userTeam = helpers.getUserTeam();

        const selectedPlayers = gameState.freeAgents.filter(fa => this.selectedIds.has(String(fa.id)));

        if (selectedPlayers.length === 0) {
            alert('Please select at least one player to make an offer to.');
            return;
        }

        // Validate and collect offers
        gameState.userFreeAgencyOffers = [];
        let totalCommitment = 0;

        for (const player of selectedPlayers) {
            const salaryInput = document.getElementById(`offer_salary_${player.id}`);
            const yearsInput = document.getElementById(`offer_years_${player.id}`);

            const offeredSalary = parseInt(salaryInput.value);
            const offeredYears = parseInt(yearsInput.value);

            const minOffer = player._faMinOffer;
            const maxOffer = player._faMaxOffer;

            if (offeredSalary < minOffer || offeredSalary > maxOffer) {
                alert(`Your offer to ${player.name} is outside the acceptable range (${SalaryCapEngine.formatCurrency(minOffer)} - ${SalaryCapEngine.formatCurrency(maxOffer)})`);
                return;
            }

            totalCommitment += offeredSalary;

            gameState.userFreeAgencyOffers.push({
                teamId: userTeam.id,
                playerId: player.id,
                salary: offeredSalary,
                years: offeredYears,
                tier: userTeam.tier,
                teamRating: userTeam.rating,
                teamSuccess: userTeam.wins / (userTeam.wins + userTeam.losses || 1)
            });
        }

        // Check cap space
        const capSpace = SalaryCapEngine.getRemainingCap(userTeam);
        if (totalCommitment > capSpace) {
            alert(`Your offers total ${SalaryCapEngine.formatCurrency(totalCommitment)}, but you only have ${SalaryCapEngine.formatCurrency(capSpace)} in cap space.\n\nReduce your offers or target fewer players.`);
            return;
        }

        console.log(`✅ User submitted ${gameState.userFreeAgencyOffers.length} offers`);

        // Close modal and process
        document.getElementById('freeAgencyModal').classList.add('hidden');
        this._process();
    }

    /**
     * Skip free agency entirely.
     */
    skip() {
        if (confirm('Are you sure you want to skip free agency? You won\'t be able to sign any free agents this off-season.')) {
            console.log('⏭️ User skipped free agency');
            if (window._reactCloseFA) window._reactCloseFA();
            document.getElementById('freeAgencyModal').classList.add('hidden');
            this.ctx.helpers.getOffseasonController().runAISigningAndContinue();
        }
    }

    /**
     * Process offers and show results in React modal.
     */
    _processAndShowReactResults() {
        const { gameState, engines, helpers } = this.ctx;
        const { FreeAgencyEngine, SalaryCapEngine, TeamFactory } = engines;
        const { formatCurrency } = helpers;
        const userTeam = helpers.getUserTeam();

        // Generate AI offers
        const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
        const aiTeams = allTeams.filter(t => t.id !== userTeam.id);
        gameState.aiFreeAgencyOffers = FreeAgencyEngine.generateAIOffers(
            { freeAgents: gameState.freeAgents, aiTeams },
            { TeamFactory, SalaryCapEngine }
        );

        // Process decisions
        const results = FreeAgencyEngine.processDecisions(
            {
                freeAgents: gameState.freeAgents,
                userOffers: gameState.userFreeAgencyOffers,
                aiOffers: gameState.aiFreeAgencyOffers,
                userTeamId: userTeam.id
            },
            { SalaryCapEngine }
        );

        // Execute signings
        FreeAgencyEngine.executeSignings({
            results,
            freeAgentPool: gameState.freeAgents,
            getTeamById: helpers.getTeamById
        });

        // Show results in React
        window._reactShowFA({
            phase: 'results',
            results,
            formatCurrency,
            getTeamById: (id) => helpers.getTeamById(id),
            userOffers: gameState.userFreeAgencyOffers,
        });
    }

    // ── Processing pipeline ──

    /**
     * Run the full FA processing pipeline:
     * 1. Generate AI offers
     * 2. Process player decisions
     * 3. Execute signings
     * 4. Show results
     */
    _process() {
        const { gameState, engines, helpers } = this.ctx;
        const { FreeAgencyEngine, SalaryCapEngine, TeamFactory, UIRenderer } = engines;
        const userTeam = helpers.getUserTeam();

        console.log('🤖 Processing free agency...');

        // Step 1: Generate AI offers
        const allTeams = [...gameState.tier1Teams, ...gameState.tier2Teams, ...gameState.tier3Teams];
        const aiTeams = allTeams.filter(t => t.id !== userTeam.id);

        gameState.aiFreeAgencyOffers = FreeAgencyEngine.generateAIOffers(
            { freeAgents: gameState.freeAgents, aiTeams },
            { TeamFactory, SalaryCapEngine }
        );
        console.log(`  AI teams made ${gameState.aiFreeAgencyOffers.length} offers`);

        // Step 2: Process decisions
        const results = FreeAgencyEngine.processDecisions(
            {
                freeAgents: gameState.freeAgents,
                userOffers: gameState.userFreeAgencyOffers,
                aiOffers: gameState.aiFreeAgencyOffers,
                userTeamId: userTeam.id
            },
            { SalaryCapEngine }
        );

        // Step 3: Execute signings
        FreeAgencyEngine.executeSignings({
            results,
            freeAgentPool: gameState.freeAgents,
            getTeamById: helpers.getTeamById
        });

        // Step 4: Show results
        this._showResults(results);
    }

    /**
     * Display the free agency results modal.
     */
    _showResults(results) {
        const { gameState, engines, helpers } = this.ctx;
        const { UIRenderer } = engines;
        const { formatCurrency } = helpers;

        document.getElementById('freeAgencyResultsContent').innerHTML = UIRenderer.freeAgencyResults({
            results, formatCurrency, getTeamById: helpers.getTeamById,
            userOffers: gameState.userFreeAgencyOffers
        });
        document.getElementById('freeAgencyResultsModal').classList.remove('hidden');
    }

    /**
     * Continue after viewing FA results.
     * Triggers AI signing phase and proceeds to roster compliance.
     */
    continue() {
        const { helpers } = this.ctx;

        if (window._reactCloseFA) window._reactCloseFA();
        document.getElementById('freeAgencyResultsModal').classList.add('hidden');

        // Let AI teams fill remaining needs from leftover free agents
        console.log('🤖 AI teams filling remaining roster needs...');
        helpers.aiSigningPhase();

        // Proceed to roster compliance check
        helpers.getOffseasonController().checkRosterComplianceAndContinue();
    }
}
