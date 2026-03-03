import React, { useState, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';

export function FinanceDashboardModal({ isOpen, data, onClose }) {
  const [spendingPct, setSpendingPct] = useState(data?.spendingRatioPct ?? 75);

  if (!isOpen || !data) return null;

  const fc = data.formatCurrency || (v => `$${(v / 1e6).toFixed(1)}M`);
  const d = data;

  const handleSlider = (val) => {
    setSpendingPct(val);
    if (window.updateSpendingRatio) window.updateSpendingRatio(val);
  };

  const handleToggleOwner = () => {
    if (window.toggleOwnerMode) window.toggleOwnerMode();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={1100} zIndex={1300}>
      <ModalHeader onClose={onClose}>
        {'\ud83d\udcb0'} Club Finances
      </ModalHeader>

      <ModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        {/* Top 3 Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <StatCard label="Total Revenue" value={fc(d.totalRev)} color="var(--color-win)" sub={d.trendHtml} />
          <StatCard label={d.capLabel} value={fc(d.spendingLimit)} color="var(--color-accent)"
            sub={<>Cap Space: <span style={{ color: d.capSpace > 0 ? 'var(--color-win)' : 'var(--color-loss)', fontWeight: 'var(--weight-bold)' }}>{fc(d.capSpace)}</span></>} />
          <StatCard label="Financial Health" value={d.stabilityLabel} color={d.stabilityColor}
            sub={`Using ${Math.round(d.usagePct * 100)}% of limit`} />
        </div>

        {/* Payroll Bar */}
        <div style={{
          background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3)', marginBottom: 'var(--space-5)',
          border: '1px solid var(--color-border-subtle)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
            <span><strong>Payroll:</strong> {fc(d.currentSalary)}</span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>Floor: {fc(d.salaryFloor)} | Limit: {fc(d.spendingLimit)}</span>
          </div>
          <div style={{ background: 'var(--color-bg-active)', borderRadius: 'var(--radius-sm)', height: 22, position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${Math.min(100, d.usagePct * 100)}%`,
              background: d.usagePct > 0.90 ? 'linear-gradient(90deg, #ea4335, #c62828)' : d.usagePct > 0.80 ? 'linear-gradient(90deg, #fbbc04, #f57f17)' : 'linear-gradient(90deg, #34a853, #2e7d32)',
              borderRadius: 'var(--radius-sm)', transition: 'width 0.5s',
            }} />
            {d.salaryFloor > 0 && (
              <div style={{
                position: 'absolute', left: `${(d.salaryFloor / d.spendingLimit) * 100}%`,
                top: 0, height: '100%', width: 2, background: 'var(--color-warning)', opacity: 0.8,
              }} />
            )}
          </div>
        </div>

        {/* Revenue Breakdown */}
        <Section title="Revenue Breakdown" subtitle={d.capExplain}>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <RevenueBar label={'\ud83d\udcfa League (TV Deal)'} amount={d.rev.league} pct={d.barPct(d.rev.league)} color="#667eea" desc={`Shared equally among Tier ${d.tier} teams.`} fc={fc} />
            <RevenueBar label={'\ud83c\udfdf\ufe0f Matchday (Gate)'} amount={d.rev.matchday} pct={d.barPct(d.rev.matchday)} color="#e67e22" desc="Driven by fanbase and winning." fc={fc} />
            <RevenueBar label={'\ud83e\udd1d Commercial (Sponsors)'} amount={d.rev.commercial} pct={d.barPct(d.rev.commercial)} color="#9b59b6" desc="Based on tier and results." fc={fc} />
            <RevenueBar label={'\ud83c\udfc6 Legacy (Brand)'} amount={d.rev.legacy} pct={d.barPct(d.rev.legacy)} color="#f1c40f" desc="Built from championships and history." fc={fc} />
          </div>
        </Section>

        {/* Fanbase + Standing */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
          <Section title={'\ud83d\udc65 Fanbase'}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-1)' }}>
              {d.fanbase.toLocaleString()} fans
            </div>
            <div style={{ fontSize: 'var(--text-sm)', marginBottom: 3 }}>
              {d.fanLabel} <span style={{ color: 'var(--color-text-tertiary)' }}>({d.fanMultiple}{'\u00d7'} tier avg)</span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Tier average: {d.tierAvgFanbase.toLocaleString()}</div>
          </Section>
          <Section title={'\ud83d\udcca Financial Standing'}>
            <div style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
              vs Tier {d.tier} Average: <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: d.revVsAvgColor, marginLeft: 'var(--space-1)' }}>{d.revVsAvgLabel}</span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span>Tier avg revenue: {fc(d.tierAvgRevenue)}</span>
              <span>Market: {d.marketLabel} ({d.marketSize.toFixed(2)}{'\u00d7'}){d.metroPopStr}</span>
              {!d.isHardCap && <span>Spending ratio: {Math.round(d.spendingRatio * 100)}% of revenue {d.ratioWarning}</span>}
            </div>
          </Section>
        </div>

        {/* Franchise Legacy */}
        <Section title={'\ud83c\udfe6 Franchise Legacy'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-3)' }}>
            {[
              ['Championships', d.lp?.championships || 0],
              ['Seasons in T1', d.lp?.seasonsInT1 || 0],
              ['Playoff Apps', d.lp?.playoffAppearances || 0],
              ['Iconic Players', d.lp?.iconicPlayers || 0],
              [`Yrs in Tier ${d.tier}`, d.seasonsInCurrentTier || 0],
            ].map(([label, val]) => (
              <div key={label} style={{
                textAlign: 'center', padding: 'var(--space-2)',
                background: 'var(--color-bg-active)', borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>{val}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{label}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Spending Strategy or T1 info */}
        {!d.isHardCap ? (
          <Section title={'\u2699\ufe0f Spending Strategy'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>Conservative (60%)</span>
              <input type="range" min="60" max="90" value={spendingPct}
                onChange={e => handleSlider(e.target.value)}
                style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
              <span style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>Aggressive (90%)</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{
                fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)',
                color: spendingPct >= 85 ? 'var(--color-loss)' : spendingPct >= 80 ? 'var(--color-warning)' : 'var(--color-win)',
              }}>{spendingPct}%</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: '0 var(--space-1)' }}>of revenue {'\u2192'}</span>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--color-accent)' }}>
                {fc(Math.round(d.totalRev * (spendingPct / 100)))}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-1)' }}>spending limit</span>
            </div>
          </Section>
        ) : (
          <Section>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              <strong>Tier 1 — Fixed Salary Cap Model</strong><br />
              All Tier 1 teams share equally in the league's national TV contract and operate under a uniform $100M salary cap with an $80M salary floor.
            </div>
          </Section>
        )}

        {/* Owner Mode */}
        <div style={{
          marginTop: 'var(--space-4)', padding: 'var(--space-3)',
          background: 'var(--color-accent)10', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-accent)30',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{'\u2699\ufe0f'} Owner Mode</strong>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                {d.ownerMode ? 'Active — you manage arena, tickets, sponsors, and marketing each offseason.' : 'Inactive — finances are managed automatically. Toggle on to take control.'}
              </div>
            </div>
            <button onClick={handleToggleOwner} style={{
              padding: '8px 20px', fontSize: 'var(--text-sm)', cursor: 'pointer',
              background: d.ownerMode ? 'linear-gradient(135deg, #2ecc71, #27ae60)' : 'var(--color-bg-active)',
              border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)',
            }}>{d.ownerMode ? '\u2705 ON' : '\u2b1c OFF'}</button>
          </div>

          {d.ownerMode && (
            <div style={{ marginTop: 'var(--space-3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <MiniStat label={'\ud83c\udfdf\ufe0f Arena'} value={`${d.arenaCapacity.toLocaleString()} seats \u00b7 ${d.arenaCondition}% condition`} />
              <MiniStat label={'\ud83e\udd1d Sponsors'} value={`${d.sponsorCount} deal${d.sponsorCount !== 1 ? 's' : ''}${d.sponsorCount > 0 ? ' \u00b7 ' + fc(d.sponsorRevenue) + '/yr' : ''}`} />
              <MiniStat label={'\ud83c\udfab Ticket Pricing'} value={`${d.ticketPct}% of base`} />
              <MiniStat label={'\ud83d\udce2 Marketing'} value={d.marketingBudget > 0 ? fc(d.marketingBudget) + '/season' : 'None'} />
            </div>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}

/* ── Sub-components ── */

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-4)', textAlign: 'center',
      border: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>{label}</div>
      <div style={{ fontSize: '1.5em', fontWeight: 'var(--weight-bold)', color }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', marginTop: 3, color: 'var(--color-text-secondary)' }}>{sub}</div>}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{
      background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-4)', marginBottom: 'var(--space-4)',
      border: '1px solid var(--color-border-subtle)',
    }}>
      {title && <div style={{ fontWeight: 'var(--weight-semi)', marginBottom: subtitle ? 3 : 'var(--space-3)' }}>{title}</div>}
      {subtitle && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function RevenueBar({ label, amount, pct, color, desc, fc }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 'var(--text-sm)' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 'var(--weight-bold)' }}>{fc(amount)}</span>
      </div>
      <div style={{ background: 'var(--color-bg-active)', borderRadius: 'var(--radius-sm)', height: 12, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 'var(--radius-sm)' }} />
      </div>
      <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{desc}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{
      padding: 'var(--space-2) var(--space-3)',
      background: 'var(--color-bg-active)', borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div style={{ fontWeight: 'var(--weight-semi)', fontSize: 'var(--text-sm)' }}>{value}</div>
    </div>
  );
}
