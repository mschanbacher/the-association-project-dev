// ═══════════════════════════════════════════════════════════════════════════════
// FinanceController.js — Finance dashboard, owner mode, and financial management
// UI rendered by React FinanceDashboardModal, OwnerModeModal, FinancialTransitionModal.
// This controller provides data assembly and handles business logic mutations.
// ═══════════════════════════════════════════════════════════════════════════════

export class FinanceController {
    constructor(ctx) {
        this.ctx = ctx;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Finance Dashboard (read-only during season)
    // ═══════════════════════════════════════════════════════════════════

    openFinanceDashboard() {
        const { gameState, helpers, engines } = this.ctx;
        const team = helpers.getUserTeam();
        if (!team) return;

        engines.FinanceEngine.ensureFinances(team);
        const summary = engines.FinanceEngine.getFinancialSummary(team);
        const r = summary.revenue;
        const totalRev = summary.totalRevenue;

        const stabilityColors = { stable: '#34a853', caution: '#fbbc04', danger: '#ea4335' };
 const stabilityLabels = { stable: 'Stable', caution: 'Caution', danger: 'At Risk' };
        const stabilityColor = stabilityColors[summary.stability] || '#34a853';
 const stabilityLabel = stabilityLabels[summary.stability] || 'Stable';

        const barPct = (val) => Math.max(3, (val / totalRev) * 100);

        const isHardCap = summary.isHardCap;
        const capLabel = isHardCap ? 'Salary Cap (League-wide)' : 'Spending Limit (Revenue-based)';
        const capExplain = isHardCap
            ? 'Tier 1 uses a shared TV revenue model with a fixed salary cap — all teams operate under the same limit.'
            : `Your spending limit is ${Math.round(summary.spendingRatio * 100)}% of your total revenue. Unlike Tier 1\'s fixed cap, your budget reflects your club\'s actual financial profile.`;

        const history = summary.revenueHistory;
        let trendHtml = '';
        if (history.length > 1) {
            const prevRev = history[history.length - 2].totalRevenue;
            const change = totalRev - prevRev;
            const changePct = ((change / prevRev) * 100).toFixed(1);
 const arrow = change > 0 ? '' : change < 0 ? '' : '️';
            const color = change > 0 ? '#34a853' : change < 0 ? '#ea4335' : '#aaa';
            trendHtml = `<span style="color: ${color}; margin-left: 10px;">${arrow} ${change > 0 ? '+' : ''}${changePct}% vs last season</span>`;
        }

        const fanTierBaseline = engines.FinanceEngine.FANBASE_BASELINES[team.tier] || 15000;
        const fanMultiple = (summary.fanbase / fanTierBaseline).toFixed(1);
 const fanLabel = parseFloat(fanMultiple) > 1.5 ? 'Well above average'
 : parseFloat(fanMultiple) > 1.0 ? 'Above average'
 : parseFloat(fanMultiple) > 0.7 ? 'Average'
 : 'Below average';

        const lp = summary.legacyProfile;

        const allTeams = team.tier === 1 ? gameState.tier1Teams : team.tier === 2 ? gameState.tier2Teams : gameState.tier3Teams;
        let tierAvgRevenue = 0, tierAvgFanbase = 0, teamsWithFinances = 0;
        allTeams.forEach(t => {
            engines.FinanceEngine.ensureFinances(t);
            tierAvgRevenue += engines.FinanceEngine.getTotalRevenue(t);
            tierAvgFanbase += t.finances.fanbase;
            teamsWithFinances++;
        });
        tierAvgRevenue = teamsWithFinances > 0 ? Math.round(tierAvgRevenue / teamsWithFinances) : totalRev;
        tierAvgFanbase = teamsWithFinances > 0 ? Math.round(tierAvgFanbase / teamsWithFinances) : summary.fanbase;

        const revVsAvg = ((totalRev / tierAvgRevenue - 1) * 100).toFixed(0);
        const revVsAvgLabel = parseInt(revVsAvg) > 0 ? `+${revVsAvg}% above` : `${revVsAvg}% below`;
        const revVsAvgColor = parseInt(revVsAvg) >= 0 ? '#34a853' : '#ea4335';

        if (window._reactShowFinanceDashboard) {
            window._reactShowFinanceDashboard({
                formatCurrency: helpers.formatCurrency, totalRev, trendHtml, capLabel,
                spendingLimit: summary.spendingLimit, capSpace: summary.capSpace,
                stabilityColor, stabilityLabel, usagePct: summary.usagePct,
                currentSalary: summary.currentSalary, salaryFloor: summary.salaryFloor,
                capExplain, rev: r, barPct, tier: team.tier,
                fanbase: summary.fanbase, fanLabel, fanMultiple, tierAvgFanbase,
                revVsAvgColor, revVsAvgLabel, tierAvgRevenue,
                marketLabel: summary.marketSize >= 1.2 ? '\u{1F3D9}\uFE0F Major' : summary.marketSize >= 1.0 ? '\u{1F3D8}\uFE0F Mid-size' : summary.marketSize >= 0.8 ? '\u{1F3E1} Small' : '\u{1F3DA}\uFE0F Tiny',
                marketSize: summary.marketSize,
                metroPopStr: summary.metroPopulation ? ` \u00B7 ${summary.metroPopulation >= 1 ? summary.metroPopulation.toFixed(1) + 'M' : Math.round(summary.metroPopulation * 1000) + 'K'} metro pop.` : '',
                isHardCap, spendingRatio: summary.spendingRatio, spendingRatioPct: Math.round(summary.spendingRatio * 100),
                ratioWarning: summary.spendingRatio >= 0.85 ? '\u26A0\uFE0F High risk' : summary.spendingRatio >= 0.80 ? '\u26A1 Aggressive' : '',
                lp, seasonsInCurrentTier: team.finances.seasonsInCurrentTier || 0,
                ownerMode: team.finances.ownerMode,
                arenaCapacity: team.finances.arena.capacity, arenaCondition: team.finances.arena.condition,
                sponsorCount: team.finances.sponsorships.length,
                sponsorRevenue: team.finances.sponsorships.reduce((s, d) => s + d.annualValue, 0),
                ticketPct: Math.round((team.finances.ticketPriceMultiplier || 1.0) * 100),
                marketingBudget: team.finances.marketingBudget,
            });
        }
    }

    updateSpendingRatio(value) {
        const { helpers, engines } = this.ctx;
        const team = helpers.getUserTeam();
        if (!team || !team.finances) return;

        const ratio = parseInt(value) / 100;
        team.finances.spendingRatio = ratio;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Owner Mode Modal (offseason management)
    // ═══════════════════════════════════════════════════════════════════

    showOwnerModeModal(team) {
        const { helpers, engines } = this.ctx;
        const f = team.finances;
        const summary = engines.FinanceEngine.getFinancialSummary(team);
        const arena = f.arena;
        const tier = team.tier;
        const isT1 = tier === 1;

        const expansionCost = Math.round(arena.capacity * (tier === 1 ? 1500 : tier === 2 ? 800 : 300));
        const renovationCost = Math.round(arena.capacity * (tier === 1 ? 500 : tier === 2 ? 200 : 80));
        const expansionSeats = Math.round(arena.capacity * 0.20);

        // [LEGACY REMOVED] sponsorHtml and activeSponsorsHtml generation

        const revFor1Pct = Math.round(summary.totalRevenue * 0.01);
        const revFor3Pct = Math.round(summary.totalRevenue * 0.03);
        const revFor5Pct = Math.round(summary.totalRevenue * 0.05);

        // [LEGACY REMOVED] ownerModeModal HTML generation

        // Route to React owner mode modal
        if (window._reactShowOwnerMode) {
            window._ownerModeConfirmCallback = () => {
                delete window._ownerModeConfirmCallback;
                // Call the offseason controller's confirm
                if (window._offseasonController) {
                    window._offseasonController.confirmOffseasonDecisions();
                }
            };
            window._reactShowOwnerMode({
                team,
                finances: f,
                summary,
                arena,
                tier,
                isT1,
                expansionCost,
                renovationCost,
                expansionSeats,
                sponsorships: [...f.sponsorships],
                pendingSponsorOffers: [...f.pendingSponsorOffers],
                revFor1Pct,
                revFor3Pct,
                revFor5Pct,
                formatCurrency: helpers.formatCurrency,
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Owner Mode Interaction Handlers
    // ═══════════════════════════════════════════════════════════════════

    acceptSponsor(index) {
        const { helpers } = this.ctx;
        const team = helpers.getUserTeam();
        if (!team || !team.finances) return;
        const offers = team.finances.pendingSponsorOffers;
        if (index < 0 || index >= offers.length) return;

        const offer = offers[index];
        team.finances.sponsorships.push({
            name: offer.name, annualValue: offer.annualValue,
            yearsRemaining: offer.years, condition: offer.condition,
            conditionLabel: offer.conditionLabel || ''
        });
        offers.splice(index, 1);
        console.log(`✅ Accepted sponsor: ${offer.name} (${helpers.formatCurrency(offer.annualValue)}/yr × ${offer.years}yr)`);
        helpers.saveGameState();
        // Notify React to refresh (don't open modal)
        if (window._notifyReact) window._notifyReact();
    }

    upgradeArena(type) {
        const { helpers } = this.ctx;
        const team = helpers.getUserTeam();
        if (!team || !team.finances) return;
        const arena = team.finances.arena;
        const tier = team.tier;

        if (arena.upgradeYearsLeft > 0) { alert('You already have an upgrade in progress!'); return; }

        if (type === 'expand') {
            const addSeats = Math.round(arena.capacity * 0.20);
            const cost = Math.round(arena.capacity * (tier === 1 ? 1500 : tier === 2 ? 800 : 300));
            arena.capacity += addSeats;
            arena.upgradeCost = Math.round(cost / 3);
            arena.upgradeYearsLeft = 3;
            console.log(`🏟️ Arena expansion: +${addSeats} seats (${helpers.formatCurrency(cost)} over 3yr)`);
        } else if (type === 'renovate') {
            const cost = Math.round(arena.capacity * (tier === 1 ? 500 : tier === 2 ? 200 : 80));
            arena.condition = Math.min(100, arena.condition + 25);
            arena.upgradeCost = Math.round(cost / 2);
            arena.upgradeYearsLeft = 2;
            console.log(`🔧 Arena renovation: +25 condition (${helpers.formatCurrency(cost)} over 2yr)`);
        }
        helpers.saveGameState();
        // Notify React to refresh (don't open modal)
        if (window._notifyReact) window._notifyReact();
    }

    updateTicketPrice(value) {
        const team = this.ctx.helpers.getUserTeam();
        if (!team || !team.finances) return;
        team.finances.ticketPriceMultiplier = parseInt(value) / 100;
    }

    setMarketingBudget(amount) {
        const { helpers } = this.ctx;
        const team = helpers.getUserTeam();
        if (!team || !team.finances) return;
        team.finances.marketingBudget = amount;
        console.log(`📢 Marketing budget set to: ${helpers.formatCurrency(amount)}/season`);
        // Don't open modal or update legacy DOM - React handles its own state
    }

    updateOwnerSpendingRatio(value) {
        const { helpers, engines } = this.ctx;
        const team = helpers.getUserTeam();
        if (!team || !team.finances) return;
        team.finances.spendingRatio = parseInt(value) / 100;

        const newLimit = engines.FinanceEngine.getSpendingLimit(team);

        // Push to React if available
        if (window._ownerSpendingLimitUpdate) {
            window._ownerSpendingLimitUpdate(newLimit);
        }
    }

    toggleOwnerMode() {
        const { helpers } = this.ctx;
        const team = helpers.getUserTeam();
        if (!team || !team.finances) return;
        team.finances.ownerMode = !team.finances.ownerMode;
        helpers.saveGameState();
        this.openFinanceDashboard();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Financial Transition (after promotion/relegation)
    // ═══════════════════════════════════════════════════════════════════

    updateTransitionSpending(value) {
        // Legacy — React FinancialTransitionModal handles spending slider via onSpendingChange
        const { helpers, engines } = this.ctx;
        const team = helpers.getUserTeam();
        if (!team || !team.finances) return;
        team.finances.spendingRatio = parseInt(value) / 100;
    }

    dismissTransitionBriefing() {
        const { helpers } = this.ctx;
        helpers.saveGameState();
        console.log('Proceeding to draft/development after transition briefing...');
        helpers.proceedToDraftOrDevelopment();
    }
}
