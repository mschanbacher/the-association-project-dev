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
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={760} zIndex={1300}>
      <ModalHeader onClose={onClose}>Club Finances</ModalHeader>

      <ModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        {/* Top metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)', marginBottom: 16 }}>
          <MetricCard label="Total Revenue" value={fc(d.totalRev)} sub={d.trendHtml} />
          <MetricCard label={d.capLabel} value={fc(d.spendingLimit)}
            sub={<>Cap Space: <span style={{ color: d.capSpace < 0 ? 'var(--color-loss)' : 'var(--color-text)', fontWeight: 600 }}>{fc(d.capSpace)}</span></>} />
          <MetricCard label="Financial Health" value={d.stabilityLabel} color={d.stabilityColor}
            sub={`Using ${Math.round(d.usagePct * 100)}% of limit`} />
        </div>

        {/* Payroll bar */}
        <div style={{
          background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)',
          padding: '12px 14px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 'var(--text-sm)' }}>
            <span><strong>Payroll:</strong> {fc(d.currentSalary)}</span>
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
              Floor: {fc(d.salaryFloor)} · Limit: {fc(d.spendingLimit)}
            </span>
          </div>
          <div style={{
            background: 'var(--color-bg-raised)', height: 16, position: 'relative', overflow: 'hidden',
            border: '1px solid var(--color-border-subtle)',
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${Math.min(100, d.usagePct * 100)}%`,
              background: d.usagePct > 0.90 ? 'var(--color-loss)' : d.usagePct > 0.80 ? 'var(--color-warning)' : 'var(--color-win)',
              opacity: 0.7, transition: 'width 0.5s',
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
        <Section label="Revenue Breakdown" sub={d.capExplain}>
          {[
            { label: 'League (TV Deal)', amount: d.rev.league, color: 'var(--color-chart-1)', desc: `Shared equally among Tier ${d.tier} teams.` },
            { label: 'Matchday (Gate)', amount: d.rev.matchday, color: 'var(--color-chart-2)', desc: 'Driven by fanbase and winning.' },
            { label: 'Commercial (Sponsors)', amount: d.rev.commercial, color: 'var(--color-chart-3)', desc: 'Based on tier and results.' },
            { label: 'Legacy (Brand)', amount: d.rev.legacy, color: 'var(--color-chart-4)', desc: 'Built from championships and history.' },
          ].map((r, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 'var(--text-sm)' }}>
                <span>{r.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fc(r.amount)}</span>
              </div>
              <div style={{
                background: 'var(--color-bg-raised)', height: 8, overflow: 'hidden',
                border: '1px solid var(--color-border-subtle)',
              }}>
                <div style={{ height: '100%', width: `${d.barPct(r.amount)}%`, background: r.color }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{r.desc}</div>
            </div>
          ))}
        </Section>

        {/* Fanbase + Standing */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)', marginBottom: 12 }}>
          <Section label="Fanbase">
            <div style={{
              fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: 2,
            }}>{d.fanbase.toLocaleString()}</div>
            <div style={{ fontSize: 'var(--text-sm)', marginBottom: 3 }}>
              {d.fanLabel} <span style={{ color: 'var(--color-text-tertiary)' }}>({d.fanMultiple}× tier avg)</span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              Tier average: {d.tierAvgFanbase.toLocaleString()}
            </div>
          </Section>
          <Section label="Financial Standing">
            <div style={{ marginBottom: 4, fontSize: 'var(--text-sm)' }}>
              vs Tier {d.tier} Average: <span style={{
                fontSize: 'var(--text-base)', fontWeight: 700,
                color: d.revVsAvgColor, marginLeft: 4,
              }}>{d.revVsAvgLabel}</span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>Tier avg revenue: {fc(d.tierAvgRevenue)}</span>
              <span>Market: {d.marketLabel} ({d.marketSize.toFixed(2)}×){d.metroPopStr}</span>
              {!d.isHardCap && <span>Spending ratio: {Math.round(d.spendingRatio * 100)}% of revenue {d.ratioWarning}</span>}
            </div>
          </Section>
        </div>

        {/* Franchise Legacy */}
        <Section label="Franchise Legacy">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {[
              ['Championships', d.lp?.championships || 0],
              ['Seasons in T1', d.lp?.seasonsInT1 || 0],
              ['Playoff Apps', d.lp?.playoffAppearances || 0],
              ['Iconic Players', d.lp?.iconicPlayers || 0],
              [`Yrs in Tier ${d.tier}`, d.seasonsInCurrentTier || 0],
            ].map(([label, val]) => (
              <div key={label} style={{
                textAlign: 'center', padding: 8,
                background: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)',
              }}>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{val}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Spending Strategy or T1 info */}
        {!d.isHardCap ? (
          <Section label="Spending Strategy">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>Conservative</span>
              <input type="range" min="60" max="90" value={spendingPct}
                onChange={e => handleSlider(e.target.value)}
                style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>Aggressive</span>
            </div>
            <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)' }}>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{spendingPct}%</span>
              <span style={{ color: 'var(--color-text-tertiary)', margin: '0 6px' }}>→</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                {fc(Math.round(d.totalRev * (spendingPct / 100)))}
              </span>
              <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 4 }}>spending limit</span>
            </div>
          </Section>
        ) : (
          <Section>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              <strong>Tier 1 — Fixed Salary Cap Model</strong><br />
              All Tier 1 teams share equally in the league's national TV contract and operate under a uniform salary cap with a salary floor.
            </div>
          </Section>
        )}

        {/* Owner Mode */}
        <div style={{
          padding: '12px 16px', background: 'var(--color-accent-bg)',
          border: '1px solid var(--color-accent-border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Owner Mode</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                {d.ownerMode
                  ? 'Active — manage arena, tickets, sponsors, marketing each offseason.'
                  : 'Inactive — finances managed automatically. Toggle on to take control.'}
              </div>
            </div>
            <button onClick={handleToggleOwner} style={{
              padding: '6px 16px', fontSize: 'var(--text-xs)', cursor: 'pointer', fontWeight: 600,
              fontFamily: 'var(--font-body)',
              background: d.ownerMode ? 'var(--color-win)' : 'var(--color-bg-sunken)',
              border: 'none', color: d.ownerMode ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            }}>{d.ownerMode ? 'ON' : 'OFF'}</button>
          </div>

          {d.ownerMode && (
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <MiniStat label="Arena" value={`${d.arenaCapacity.toLocaleString()} seats · ${d.arenaCondition}% condition`} />
              <MiniStat label="Sponsors" value={`${d.sponsorCount} deal${d.sponsorCount !== 1 ? 's' : ''}${d.sponsorCount > 0 ? ' · ' + fc(d.sponsorRevenue) + '/yr' : ''}`} />
              <MiniStat label="Ticket Pricing" value={`${d.ticketPct}% of base`} />
              <MiniStat label="Marketing" value={d.marketingBudget > 0 ? fc(d.marketingBudget) + '/season' : 'None'} />
            </div>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}

function MetricCard({ label, value, color, sub }) {
  return (
    <div style={{
      padding: 14, background: 'var(--color-bg-sunken)',
      border: '1px solid var(--color-border-subtle)', textAlign: 'center',
    }}>
      <div style={{
        fontSize: 10, color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)',
        color: color || 'var(--color-text)',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Section({ label, sub, children }) {
  return (
    <div style={{
      background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)',
      padding: '14px 16px', marginBottom: 12,
    }}>
      {label && (
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          marginBottom: sub ? 2 : 10,
        }}>{label}</div>
      )}
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>{sub}</div>}
      {children}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{
      padding: '6px 10px', background: 'var(--color-bg-raised)',
      border: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>{value}</div>
    </div>
  );
}
