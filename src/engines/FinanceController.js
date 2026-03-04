// ═══════════════════════════════════════════════════════════════════════════════
// FinanceController.js — Finance dashboard, owner mode, and financial management
// ═══════════════════════════════════════════════════════════════════════════════

import { UIRenderer } from './UIRenderer.js';

export class FinanceController {
    constructor(ctx) {
        this.ctx = ctx;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Finance Dashboard (read-only during season)
    // ═══════════════════════════════════════════════════════════════════

    openFinanceDashboard() {
        const { gameState, helpers, engines } = this.ctx;
        const modal = document.getElementById('financeDashboardModal');
        const content = document.getElementById('financeDashboardContent');
        const team = helpers.getUserTeam();
        if (!team) return;

        engines.FinanceEngine.ensureFinances(team);
        const summary = engines.FinanceEngine.getFinancialSummary(team);
        const r = summary.revenue;
        const totalRev = summary.totalRevenue;

        const stabilityColors = { stable: '#34a853', caution: '#fbbc04', danger: '#ea4335' };
        const stabilityLabels = { stable: '✅ Stable', caution: '⚠️ Caution', danger: '🔴 At Risk' };
        const stabilityColor = stabilityColors[summary.stability] || '#34a853';
        const stabilityLabel = stabilityLabels[summary.stability] || '✅ Stable';

        const barPct = (val) => Math.max(3, (val / totalRev) * 100);

        const ratioWarning = summary.spendingRatio >= 0.85
            ? '<span style="color: #ea4335; font-size: 0.85em;"> ⚠️ High risk — limited financial cushion</span>'
            : summary.spendingRatio >= 0.80
                ? '<span style="color: #fbbc04; font-size: 0.85em;"> ⚡ Aggressive spending</span>'
                : '';

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
            const arrow = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
            const color = change > 0 ? '#34a853' : change < 0 ? '#ea4335' : '#aaa';
            trendHtml = `<span style="color: ${color}; margin-left: 10px;">${arrow} ${change > 0 ? '+' : ''}${changePct}% vs last season</span>`;
        }

        const fanTierBaseline = engines.FinanceEngine.FANBASE_BASELINES[team.tier] || 15000;
        const fanMultiple = (summary.fanbase / fanTierBaseline).toFixed(1);
        const fanLabel = parseFloat(fanMultiple) > 1.5 ? '🌟 Well above average'
                       : parseFloat(fanMultiple) > 1.0 ? '👍 Above average'
                       : parseFloat(fanMultiple) > 0.7 ? '📊 Average'
                       : '⚠️ Below average';

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
            return;
        }

        content.innerHTML = UIRenderer.financeDashboard({
            formatCurrency: helpers.formatCurrency, totalRev, trendHtml, capLabel,
            spendingLimit: summary.spendingLimit, capSpace: summary.capSpace,
            stabilityColor, stabilityLabel, usagePct: summary.usagePct,
            currentSalary: summary.currentSalary, salaryFloor: summary.salaryFloor,
            capExplain, rev: r, barPct, tier: team.tier,
            fanbase: summary.fanbase, fanLabel, fanMultiple, tierAvgFanbase,
            revVsAvgColor, revVsAvgLabel, tierAvgRevenue,
            marketLabel: summary.marketSize >= 1.2 ? '🏙️ Major' : summary.marketSize >= 1.0 ? '🏘️ Mid-size' : summary.marketSize >= 0.8 ? '🏡 Small' : '🏚️ Tiny',
            marketSize: summary.marketSize,
            metroPopStr: summary.metroPopulation ? ` · ${summary.metroPopulation >= 1 ? summary.metroPopulation.toFixed(1) + 'M' : Math.round(summary.metroPopulation * 1000) + 'K'} metro pop.` : '',
            isHardCap, spendingRatio: summary.spendingRatio, ratioWarning,
            lp, seasonsInCurrentTier: team.finances.seasonsInCurrentTier || 0,
            ownerMode: team.finances.ownerMode,
            arenaCapacity: team.finances.arena.capacity, arenaCondition: team.finances.arena.condition,
            sponsorCount: team.finances.sponsorships.length,
            sponsorRevenue: team.finances.sponsorships.reduce((s, d) => s + d.annualValue, 0),
            ticketPct: Math.round((team.finances.ticketPriceMultiplier || 1.0) * 100),
            marketingBudget: team.finances.marketingBudget
        });

        modal.classList.remove('hidden');
        const closeBtn = document.getElementById('financeDashboardCloseBtn');
        if (closeBtn) closeBtn.style.display = '';
    }

    updateSpendingRatio(value) {
        const { helpers, engines } = this.ctx;
        const team = helpers.getUserTeam();
        if (!team || !team.finances) return;

        const ratio = parseInt(value) / 100;
        team.finances.spendingRatio = ratio;

        const newLimit = engines.FinanceEngine.getSpendingLimit(team);
        document.getElementById('spendingRatioDisplay').textContent = value + '%';
        document.getElementById('spendingLimitDisplay').textContent = helpers.formatCurrency(newLimit);

        const display = document.getElementById('spendingRatioDisplay');
        if (ratio >= 0.85) display.style.color = '#ea4335';
        else if (ratio >= 0.80) display.style.color = '#fbbc04';
        else display.style.color = '#34a853';
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
            return;
        }

        // Legacy fallback
        const content = document.getElementById('financeDashboardContent');
        content.innerHTML = html;

        document.getElementById('financeDashboardModal').classList.remove('hidden');
        const closeBtn = document.getElementById('financeDashboardCloseBtn');
        if (closeBtn) closeBtn.style.display = 'none';

        updateTicketPriceEffect(Math.round((f.ticketPriceMultiplier || 1.0) * 100));
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
        this.showOwnerModeModal(team);
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
        this.showOwnerModeModal(team);
    }

    updateTicketPrice(value) {
        const team = this.ctx.helpers.getUserTeam();
        if (!team || !team.finances) return;
        team.finances.ticketPriceMultiplier = parseInt(value) / 100;
        // Legacy DOM updates
        const dispEl = document.getElementById('ticketPriceDisplay');
        if (dispEl) dispEl.textContent = value + '%';
        if (typeof updateTicketPriceEffect === 'function') updateTicketPriceEffect(parseInt(value));
    }

    setMarketingBudget(amount) {
        const { helpers } = this.ctx;
        const team = helpers.getUserTeam();
        if (!team || !team.finances) return;
        team.finances.marketingBudget = amount;

        // In React mode, the component manages its own state — no re-render needed
        if (window._wgRefs || window._reactShowOwnerMode) return;

        const effectEl = document.getElementById('marketingEffect');
        if (effectEl) {
            effectEl.textContent = amount > 0
                ? `Investing ${helpers.formatCurrency(amount)}/season in marketing — this reduces your available spending limit.`
                : 'No marketing spend — fanbase growth relies on winning alone.';
        }
        this.showOwnerModeModal(team);
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

        // Legacy DOM updates
        const dispEl = document.getElementById('ownerSpendingDisplay');
        if (dispEl) dispEl.textContent = value + '%';
        const limEl = document.getElementById('ownerLimitDisplay');
        if (limEl) limEl.textContent = helpers.formatCurrency(newLimit);
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
        const { helpers, engines } = this.ctx;
        const team = helpers.getUserTeam();
        if (!team || !team.finances) return;

        const ratio = parseInt(value) / 100;
        team.finances.spendingRatio = ratio;

        const newLimit = engines.FinanceEngine.getSpendingLimit(team);
        const totalSalary = helpers.calculateTeamSalary(team);
        const newCapSpace = newLimit - totalSalary;

        document.getElementById('transitionSpendingPct').textContent = value + '%';
        document.getElementById('transitionSpendingLimit').textContent = helpers.formatCurrency(newLimit);

        const capEl = document.getElementById('transitionCapSpace');
        capEl.textContent = helpers.formatCurrency(newCapSpace);
        capEl.style.color = newCapSpace >= 0 ? '#34a853' : '#ea4335';
    }

    dismissTransitionBriefing() {
        const { helpers } = this.ctx;
        document.getElementById('financialTransitionModal').classList.add('hidden');
        helpers.saveGameState();
        console.log('Proceeding to draft/development after transition briefing...');
        helpers.proceedToDraftOrDevelopment();
    }
}

// Module-level helper (called from within the class without `this`)
function updateTicketPriceEffect(pct) {
    const el = document.getElementById('ticketPriceEffect');
    if (!el) return;
    // [LEGACY REMOVED] el.innerHTML = UIRenderer.ticketPriceEffect({ pct });
}
