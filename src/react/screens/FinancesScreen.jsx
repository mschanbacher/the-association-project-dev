import React, { useMemo, useState, useCallback } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card, CardHeader } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';

export function FinancesScreen({ isOffseason = false, onConfirm }) {
  const { gameState, engines, isReady, refresh } = useGame();
  
  // Local state for owner mode controls
  const [ticketPrice, setTicketPrice] = useState(null);
  const [marketingBudget, setMarketingBudget] = useState(null);
  const [spendingRatio, setSpendingRatio] = useState(null);

  if (!isReady || !gameState?.userTeam) {
    return <Loader text="Loading finances..." />;
  }

  const { userTeam, currentTier } = gameState;
  const { FinanceEngine, SalaryCapEngine } = engines;
  const finances = userTeam.finances || {};
  const ownerModeEnabled = finances.ownerMode ?? false;
  const isT1 = currentTier === 1;

  // Initialize local state from finances on first render
  if (ticketPrice === null) setTicketPrice(Math.round((finances.ticketPriceMultiplier || 1.0) * 100));
  if (marketingBudget === null) setMarketingBudget(finances.marketingBudget || 0);
  if (spendingRatio === null) setSpendingRatio(Math.round((finances.spendingRatio || 0.8) * 100));

  const summary = useMemo(() => {
    if (!FinanceEngine?.getFinancialSummary) return null;
    FinanceEngine.ensureFinances(userTeam);
    return FinanceEngine.getFinancialSummary(userTeam);
  }, [userTeam, FinanceEngine]);

  if (!summary) return <Loader text="Finance engine unavailable" />;

  const fc = formatCurrency;
  const rev = summary.revenue;
  const totalRev = summary.totalRevenue;
  const isHardCap = summary.isHardCap;
  const lp = summary.legacyProfile || {};

  // Tier comparisons
  const allTeams = currentTier === 1 ? gameState.tier1Teams :
                   currentTier === 2 ? gameState.tier2Teams : gameState.tier3Teams;

  const tierAvg = useMemo(() => {
    let totalR = 0, totalF = 0, count = 0;
    allTeams.forEach(t => {
      FinanceEngine.ensureFinances(t);
      totalR += FinanceEngine.getTotalRevenue(t);
      totalF += t.finances?.fanbase || 0;
      count++;
    });
    return {
      revenue: count > 0 ? Math.round(totalR / count) : totalRev,
      fanbase: count > 0 ? Math.round(totalF / count) : summary.fanbase };
  }, [allTeams, FinanceEngine, totalRev, summary.fanbase]);

  const revVsAvgPct = ((totalRev / tierAvg.revenue - 1) * 100).toFixed(0);

  const stabilityVariant = summary.stability === 'stable' ? 'win' :
                           summary.stability === 'caution' ? 'warning' : 'loss';
  const stabilityLabel = summary.stability === 'stable' ? 'Stable' :
                         summary.stability === 'caution' ? 'Caution' : 'At Risk';

  const usagePct = summary.usagePct || 0;

  return (
    <div style={{
      maxWidth: 'var(--content-max)',
      margin: '0 auto',
      padding: 'var(--space-6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>
          Finances
        </h2>
        <Button variant="secondary" size="sm"
          onClick={() => window.openFinanceDashboard?.()}>
          Full Dashboard →
        </Button>
      </div>

      {/* Top Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
        <StatCard label="Total Revenue" value={fc(totalRev)} valueColor="var(--color-win)"
          sub={parseInt(revVsAvgPct) >= 0
            ? `+${revVsAvgPct}% above tier avg`
            : `${revVsAvgPct}% below tier avg`}
          subColor={parseInt(revVsAvgPct) >= 0 ? 'var(--color-win)' : 'var(--color-loss)'} />
        <StatCard
          label={isHardCap ? 'Salary Cap' : 'Spending Limit'}
          value={fc(summary.spendingLimit)}
          valueColor="var(--color-info)"
          sub={`Cap space: ${fc(summary.capSpace)}`}
          subColor={summary.capSpace > 0 ? 'var(--color-win)' : 'var(--color-loss)'} />
        <StatCard label="Financial Health"
          value={<Badge variant={stabilityVariant} style={{ fontSize: 'var(--text-sm)', padding: '4px 12px' }}>{stabilityLabel}</Badge>}
          sub={`Using ${Math.round(usagePct * 100)}% of limit`} />
      </div>

      {/* Payroll Bar */}
      <Card padding="lg" className="animate-slide-up">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
          <span><strong>Payroll:</strong> {fc(summary.currentSalary)}</span>
          <span style={{ color: 'var(--color-text-tertiary)' }}>
            Floor: {fc(summary.salaryFloor)} · Limit: {fc(summary.spendingLimit)}
          </span>
        </div>
        <ProgressBar value={usagePct}
          floorPct={summary.salaryFloor > 0 ? summary.salaryFloor / summary.spendingLimit : 0} />
      </Card>

      {/* Revenue Breakdown + Standing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
        {/* Revenue */}
        <Card padding="lg" className="animate-slide-up">
          <CardHeader>Revenue Breakdown</CardHeader>
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-tertiary)',
            marginBottom: 'var(--space-4)',
            lineHeight: 'var(--leading-relaxed)' }}>
            {isHardCap
              ? 'Tier 1 uses a shared TV revenue model with a fixed salary cap.'
              : `Spending limit is ${Math.round((summary.spendingRatio || 0.8) * 100)}% of total revenue.`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <RevenueRow label="League (TV)" amount={rev.league} total={totalRev} color="var(--color-chart-1)" />
            <RevenueRow label="Matchday" amount={rev.matchday} total={totalRev} color="var(--color-chart-2)" />
            <RevenueRow label="Commercial" amount={rev.commercial} total={totalRev} color="var(--color-chart-3)" />
            <RevenueRow label="Legacy" amount={rev.legacy} total={totalRev} color="var(--color-chart-4)" />
          </div>
        </Card>

        {/* Standing + Fanbase */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <Card padding="lg" className="animate-slide-up">
            <CardHeader>Fanbase</CardHeader>
            <div style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--weight-bold)',
              marginBottom: 'var(--space-1)',
              fontVariantNumeric: 'tabular-nums' }}>
              {summary.fanbase.toLocaleString()}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
              {fanRating(summary.fanbase, tierAvg.fanbase)}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              Tier average: {tierAvg.fanbase.toLocaleString()}
            </div>
          </Card>

          <Card padding="lg" className="animate-slide-up">
            <CardHeader>Market</CardHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
              <Row label="Market size" value={`${summary.marketSize.toFixed(2)}× multiplier`} />
              <Row label="Tier avg revenue" value={fc(tierAvg.revenue)} />
              {!isHardCap && (
                <Row label="Spending ratio" value={`${Math.round((summary.spendingRatio || 0.8) * 100)}%`} />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Franchise Legacy */}
      <Card padding="lg" className="animate-slide-up">
        <CardHeader>Franchise Legacy</CardHeader>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 'var(--space-3)' }}>
          <LegacyStat label="Championships" value={lp.championships || 0} icon={null} />
          <LegacyStat label="Seasons in T1" value={lp.seasonsInT1 || 0} icon={null} />
          <LegacyStat label="Playoff Apps" value={lp.playoffAppearances || 0} icon={null} />
          <LegacyStat label="Iconic Players" value={lp.iconicPlayers || 0} icon={null} />
          <LegacyStat label={`Yrs in Tier ${currentTier}`}
            value={userTeam.finances?.seasonsInCurrentTier || 0} icon={null} />
        </div>
      </Card>

      {/* Owner Mode teaser */}
      {/* Owner Mode Section */}
      <OwnerModeSection 
        userTeam={userTeam}
        finances={finances}
        isT1={isT1}
        isOffseason={isOffseason}
        ticketPrice={ticketPrice}
        setTicketPrice={setTicketPrice}
        marketingBudget={marketingBudget}
        setMarketingBudget={setMarketingBudget}
        spendingRatio={spendingRatio}
        setSpendingRatio={setSpendingRatio}
        totalRev={totalRev}
        fc={fc}
        refresh={refresh}
        onConfirm={onConfirm}
        FinanceEngine={FinanceEngine}
      />
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Owner Mode Section
   ═══════════════════════════════════════════════════════════════ */

function OwnerModeSection({ 
  userTeam, finances, isT1, isOffseason, 
  ticketPrice, setTicketPrice, 
  marketingBudget, setMarketingBudget,
  spendingRatio, setSpendingRatio,
  totalRev, fc, refresh, onConfirm, FinanceEngine
}) {
  const ownerModeEnabled = finances.ownerMode ?? false;
  const arena = finances.arena || { capacity: 10000, condition: 80 };
  const sponsorships = finances.sponsorships || [];
  const pendingOffers = finances.pendingSponsorOffers || [];
  const tier = userTeam.tier || 1;
  
  // Toggle owner mode
  const handleToggleOwnerMode = useCallback(() => {
    userTeam.finances.ownerMode = !ownerModeEnabled;
    if (refresh) refresh();
  }, [userTeam, ownerModeEnabled, refresh]);
  
  // Accept sponsor
  const handleAcceptSponsor = useCallback((index) => {
    window._financeController?.acceptSponsor?.(index);
    if (refresh) refresh();
  }, [refresh]);
  
  // Arena upgrades
  const handleUpgradeArena = useCallback((type) => {
    window._financeController?.upgradeArena?.(type);
    if (refresh) refresh();
  }, [refresh]);
  
  // Apply slider changes
  const handleApplyTicketPrice = useCallback(() => {
    window._financeController?.updateTicketPrice?.(ticketPrice);
    if (refresh) refresh();
  }, [ticketPrice, refresh]);
  
  const handleApplyMarketing = useCallback(() => {
    window._financeController?.setMarketingBudget?.(marketingBudget);
    if (refresh) refresh();
  }, [marketingBudget, refresh]);
  
  const handleApplySpendingRatio = useCallback(() => {
    window._financeController?.updateOwnerSpendingRatio?.(spendingRatio);
    if (refresh) refresh();
  }, [spendingRatio, refresh]);
  
  // Confirm offseason decisions
  const handleConfirm = useCallback(() => {
    // Apply all current values
    window._financeController?.updateTicketPrice?.(ticketPrice);
    window._financeController?.setMarketingBudget?.(marketingBudget);
    if (!isT1) window._financeController?.updateOwnerSpendingRatio?.(spendingRatio);
    
    // Call confirm callback
    if (onConfirm) onConfirm();
    else window._offseasonController?.confirmOffseasonDecisions?.();
  }, [ticketPrice, marketingBudget, spendingRatio, isT1, onConfirm]);
  
  // Calculate costs
  const expansionCost = Math.round(arena.capacity * (tier === 1 ? 1500 : tier === 2 ? 800 : 300));
  const renovationCost = Math.round(arena.capacity * (tier === 1 ? 500 : tier === 2 ? 200 : 80));
  const expansionSeats = Math.round(arena.capacity * 0.20);
  const upgradeInProgress = arena.upgradeYearsLeft > 0;
  
  // Marketing options based on revenue
  const marketingOptions = [
    { value: 0, label: 'None' },
    { value: Math.round(totalRev * 0.01), label: `1% (${fc(Math.round(totalRev * 0.01))})` },
    { value: Math.round(totalRev * 0.03), label: `3% (${fc(Math.round(totalRev * 0.03))})` },
    { value: Math.round(totalRev * 0.05), label: `5% (${fc(Math.round(totalRev * 0.05))})` },
  ];

  return (
    <Card padding="lg" className="animate-slide-up">
      {/* Header with toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <CardHeader style={{ margin: 0 }}>Owner Mode</CardHeader>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {ownerModeEnabled ? 'Enabled' : 'Disabled'}
          </span>
          <ToggleSwitch checked={ownerModeEnabled} onChange={handleToggleOwnerMode} />
        </label>
      </div>
      
      {!ownerModeEnabled ? (
        <div style={{ 
          padding: 'var(--space-4)', 
          background: 'var(--color-bg-sunken)', 
          textAlign: 'center',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--text-sm)',
        }}>
          Enable Owner Mode to manage sponsors, arena, ticket pricing, and marketing budget.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          
          {/* Sponsor Offers */}
          {pendingOffers.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-3)' }}>
                Sponsor Offers
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {pendingOffers.map((offer, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 'var(--space-3)', background: 'var(--color-bg-sunken)',
                    border: '1px solid var(--color-border-subtle)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 'var(--weight-medium)' }}>{offer.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                        {fc(offer.annualValue)}/yr for {offer.years} years
                        {offer.conditionLabel && ` · ${offer.conditionLabel}`}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => handleAcceptSponsor(i)}>Accept</Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Active Sponsorships */}
          {sponsorships.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-3)' }}>
                Active Sponsorships
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
                {sponsorships.map((s, i) => (
                  <div key={i} style={{
                    padding: 'var(--space-3)', background: 'var(--color-bg-sunken)',
                    fontSize: 'var(--text-sm)',
                  }}>
                    <div style={{ fontWeight: 'var(--weight-medium)' }}>{s.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                      {fc(s.annualValue)}/yr · {s.yearsRemaining}yr left
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Arena Management */}
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-3)' }}>
              Arena
            </div>
            <div style={{ 
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)',
              padding: 'var(--space-3)', background: 'var(--color-bg-sunken)',
            }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Capacity</div>
                <div style={{ fontWeight: 'var(--weight-semi)' }}>{arena.capacity.toLocaleString()} seats</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Condition</div>
                <div style={{ fontWeight: 'var(--weight-semi)', color: arena.condition < 60 ? 'var(--color-loss)' : undefined }}>
                  {arena.condition}%
                </div>
              </div>
            </div>
            {upgradeInProgress ? (
              <div style={{ 
                marginTop: 'var(--space-2)', padding: 'var(--space-2)', 
                background: 'var(--color-accent-bg)', fontSize: 'var(--text-xs)',
                textAlign: 'center',
              }}>
                Upgrade in progress · {arena.upgradeYearsLeft} year{arena.upgradeYearsLeft > 1 ? 's' : ''} remaining
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <Button size="sm" variant="secondary" style={{ flex: 1 }} onClick={() => handleUpgradeArena('expand')}>
                  Expand +{expansionSeats.toLocaleString()} ({fc(expansionCost)})
                </Button>
                <Button size="sm" variant="secondary" style={{ flex: 1 }} onClick={() => handleUpgradeArena('renovate')}>
                  Renovate +25% ({fc(renovationCost)})
                </Button>
              </div>
            )}
          </div>
          
          {/* Sliders */}
          <div style={{ display: 'grid', gridTemplateColumns: isT1 ? '1fr 1fr' : '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
            {/* Ticket Pricing */}
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-2)' }}>
                Ticket Pricing
              </div>
              <input 
                type="range" 
                min="50" max="150" 
                value={ticketPrice}
                onChange={(e) => setTicketPrice(parseInt(e.target.value))}
                onMouseUp={handleApplyTicketPrice}
                onTouchEnd={handleApplyTicketPrice}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                {ticketPrice}% of base
              </div>
            </div>
            
            {/* Marketing Budget */}
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-2)' }}>
                Marketing
              </div>
              <select 
                value={marketingBudget}
                onChange={(e) => {
                  setMarketingBudget(parseInt(e.target.value));
                  window._financeController?.setMarketingBudget?.(parseInt(e.target.value));
                }}
                style={{
                  width: '100%', padding: 'var(--space-2)',
                  background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)',
                  fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)',
                }}
              >
                {marketingOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            {/* Spending Ratio (T2/T3 only) */}
            {!isT1 && (
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-2)' }}>
                  Spending Ratio
                </div>
                <input 
                  type="range" 
                  min="50" max="100" 
                  value={spendingRatio}
                  onChange={(e) => setSpendingRatio(parseInt(e.target.value))}
                  onMouseUp={handleApplySpendingRatio}
                  onTouchEnd={handleApplySpendingRatio}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                  {spendingRatio}% of revenue
                </div>
              </div>
            )}
          </div>
          
          {/* Confirm Button (during offseason) */}
          {isOffseason && (
            <Button onClick={handleConfirm} style={{ marginTop: 'var(--space-2)' }}>
              Confirm Offseason Decisions
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <div 
      onClick={onChange}
      style={{
        width: 40, height: 22, 
        background: checked ? 'var(--color-accent)' : 'var(--color-bg-sunken)',
        border: '1px solid var(--color-border-subtle)',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: 16, height: 16, 
        background: 'var(--color-bg-raised)',
        position: 'absolute', top: 2,
        left: checked ? 20 : 2,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

function StatCard({ label, value, valueColor, sub, subColor }) {
  return (
    <Card padding="lg">
      <div style={{
        fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
        fontWeight: 'var(--weight-medium)', textTransform: 'uppercase',
        letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>{label}</div>
      <div style={{
        fontSize: typeof value === 'string' ? 'var(--text-2xl)' : undefined,
        fontWeight: 'var(--weight-bold)', color: valueColor || 'var(--color-text)',
        fontVariantNumeric: 'tabular-nums', lineHeight: 'var(--leading-tight)' }}>{value}</div>
      {sub && (
        <div style={{
          fontSize: 'var(--text-sm)', color: subColor || 'var(--color-text-tertiary)',
          marginTop: 'var(--space-1)' }}>{sub}</div>
      )}
    </Card>
  );
}

function ProgressBar({ value, floorPct }) {
  const pct = Math.min(1, Math.max(0, value));
  const color = pct > 0.9 ? 'var(--color-loss)' : pct > 0.8 ? 'var(--color-warning)' : 'var(--color-win)';
  return (
    <div style={{
      background: 'var(--color-bg-sunken)',
      height: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, height: '100%',
        width: `${pct * 100}%`, background: color, transition: 'width 0.5s var(--ease-out)' }} />
      {floorPct > 0 && (
        <div style={{
          position: 'absolute', left: `${floorPct * 100}%`, top: 0,
          height: '100%', width: 2, background: 'var(--color-warning)', opacity: 0.7 }} />
      )}
    </div>
  );
}

function RevenueRow({ label, amount, total, color }) {
  const pct = total > 0 ? Math.max(3, (amount / total) * 100) : 0;
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginBottom: 4,
        fontSize: 'var(--text-sm)' }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 'var(--weight-semi)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
          {formatCurrency(amount)}
        </span>
      </div>
      <div style={{
        background: 'var(--color-bg-sunken)', height: 8, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color, transition: 'width 0.4s var(--ease-out)' }} />
      </div>
    </div>
  );
}

function LegacyStat({ label, value, icon }) {
  return (
    <div style={{
      textAlign: 'center', padding: 'var(--space-3)',
      background: 'var(--color-bg-sunken)' }}>
      <div style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>{icon}</div>
      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function MiniCard({ label, value, sub }) {
  return (
    <div style={{
      padding: 'var(--space-3)', background: 'var(--color-bg-sunken)' }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)' }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
      <span style={{ fontWeight: 'var(--weight-medium)' }}>{value}</span>
    </div>
  );
}

function Loader({ text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: 'var(--color-text-tertiary)' }}>{text}</div>
  );
}

function formatCurrency(amount) {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return '$' + Math.round(amount / 1000) + 'K';
  return '$' + amount;
}

function fanRating(fanbase, tierAvg) {
  const ratio = fanbase / tierAvg;
  if (ratio > 1.5) return 'Well above average';
  if (ratio > 1.0) return 'Above average';
  if (ratio > 0.7) return 'Average';
  return 'Below average';
}
