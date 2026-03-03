import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

/* ═══════════════════════════════════════════════════════════════
   FinancialTransitionModal — Promotion/Relegation Financial Briefing

   Shows the financial impact of tier changes: revenue shifts,
   salary restructuring, spending strategy adjustments.

   Props:
   - isOpen: boolean
   - data: { team, isRelegation, isPromotion, previousTier, currentTier,
             summary, totalSalary, spendingLimit, capSpace,
             locked, expiring, lockedSalary, expiringSalary,
             releasedPlayers, rosterBySalary, oldTierBaseline, newTotalBaseline,
             formatCurrency, getRatingColor, spendingRatio, currentSeason }
   - onContinue: () => void
   - onSpendingChange: (pct) => void
   ═══════════════════════════════════════════════════════════════ */

export function FinancialTransitionModal({ isOpen, data, onContinue, onSpendingChange }) {
  const [spendingPct, setSpendingPct] = useState(null);

  if (!isOpen || !data) return null;

  const {
    team, isRelegation, isPromotion, previousTier, currentTier,
    summary, totalSalary, spendingLimit, capSpace,
    locked, expiring, lockedSalary, expiringSalary,
    releasedPlayers, rosterBySalary, oldTierBaseline, newTotalBaseline,
    formatCurrency, getRatingColor, spendingRatio
  } = data;

  const fc = formatCurrency || ((v) => '$' + (v / 1e6).toFixed(1) + 'M');
  const rc = getRatingColor || (() => 'var(--color-text)');
  const f = team.finances;
  const r = summary.revenue;

  const pct = spendingPct !== null ? spendingPct : Math.round(spendingRatio * 100);
  const adjLimit = Math.round(summary.totalRevenue * (pct / 100));
  const adjCap = adjLimit - totalSalary;

  const accent = isRelegation ? 'var(--color-loss)' : 'var(--color-win)';
  const accentBg = isRelegation ? 'var(--color-loss-bg)' : 'var(--color-win-bg)';

  const handleSlider = (val) => {
    setSpendingPct(parseInt(val));
    onSpendingChange?.(parseInt(val));
  };

  return (
    <Modal isOpen={isOpen} onClose={onContinue} maxWidth={720} zIndex={1300}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-5) var(--space-6)',
        background: accentBg,
        borderBottom: '1px solid ' + accent + '20',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '28px', marginBottom: 'var(--space-2)' }}>
          {isRelegation ? '📉' : '📈'}
        </div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: accent }}>
          {isRelegation ? 'Relegation' : 'Promotion'} Financial Briefing
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {team.name} · Tier {previousTier} → Tier {currentTier}
        </div>
      </div>

      <ModalBody style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        {/* Financial overview cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <FinCard label="Total Revenue" value={fc(summary.totalRevenue)} color="var(--color-win)"
            sub={isRelegation
              ? '↓ from tier avg'
              : '↑ from tier avg'} />
          <FinCard label={currentTier === 1 ? 'Salary Cap' : 'Spending Limit'} value={fc(spendingPct !== null ? adjLimit : spendingLimit)} color="var(--color-info)"
            sub={`${pct}% of revenue`} />
          <FinCard label="Cap Space" value={fc(spendingPct !== null ? adjCap : capSpace)}
            color={(spendingPct !== null ? adjCap : capSpace) >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}
            sub={(spendingPct !== null ? adjCap : capSpace) >= 0 ? 'Available' : 'Over limit!'} />
        </div>

        {/* What changed */}
        <Section title="What Changed" icon={isRelegation ? '📋' : '📋'} color={accent} bg={accentBg}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {isRelegation ? (
              <>
                <BulletItem color="var(--color-loss)">
                  <strong>TV Revenue dropped</strong> — League deal: {fc(r.league)} (was ~{fc(oldTierBaseline.league + oldTierBaseline.matchday + oldTierBaseline.commercial + oldTierBaseline.legacy)} tier avg)
                </BulletItem>
                <BulletItem color="var(--color-warning)">
                  <strong>Matchday & Commercial retained</strong> — {fc(r.matchday + r.commercial)}, but decays ~30%/season without promotion
                </BulletItem>
                <BulletItem color="var(--color-win)">
                  <strong>Contracts restructured</strong> — Relegation wage clauses activated
                </BulletItem>
                {releasedPlayers.length > 0 && (
                  <BulletItem color="var(--color-accent)">
                    <strong>{releasedPlayers.length} release clause{releasedPlayers.length > 1 ? 's' : ''} activated</strong> — {releasedPlayers.map(p => p.name + ' (' + p.rating + ')').join(', ')}
                  </BulletItem>
                )}
                <BulletItem color="var(--color-info)">
                  <strong>Fanbase took 12% hit</strong> — Now {f.fanbase.toLocaleString()} fans
                </BulletItem>
              </>
            ) : (
              <>
                <BulletItem color="var(--color-win)">
                  <strong>TV Revenue jumped</strong> — League deal increased to {fc(r.league)}
                </BulletItem>
                <BulletItem color="var(--color-warning)">
                  <strong>Matchday & Commercial growing</strong> — 20% promotion boost, grows over 2-3 seasons
                </BulletItem>
                <BulletItem color="var(--color-info)">
                  <strong>Fanbase boosted 15%</strong> — Now {f.fanbase.toLocaleString()} fans
                </BulletItem>
              </>
            )}
          </div>
        </Section>

        {/* Salary breakdown */}
        <Section title="Roster Salary Breakdown" icon="💰">
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }}>
            {isRelegation
              ? `Contracts restructured for Tier ${currentTier}. Expiring contracts re-sign at new rates.`
              : `Roster priced for Tier ${currentTier}. May need upgrades to compete.`}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <MiniCard label={`Locked (${locked.length})`} icon="🔒" value={fc(lockedSalary)} sub="Until expiry" />
            <MiniCard label={`Expiring (${expiring.length})`} icon="📝" value={fc(expiringSalary)} sub={`Re-sign at T${currentTier} rates`} />
          </div>

          {/* Salary bar */}
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 2,
            }}>
              <span>Payroll: {fc(totalSalary)}</span>
              <span>{currentTier === 1 ? 'Cap' : 'Limit'}: {fc(spendingPct !== null ? adjLimit : spendingLimit)}</span>
            </div>
            <div style={{
              background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-full)', height: 8,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 'var(--radius-full)',
                width: Math.min(100, (totalSalary / (spendingPct !== null ? adjLimit : spendingLimit)) * 100) + '%',
                background: (spendingPct !== null ? adjCap : capSpace) >= 0 ? 'var(--color-win)' : 'var(--color-loss)',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          {/* Top players table */}
          <div style={{ fontSize: 'var(--text-xs)', maxHeight: 180, overflowY: 'auto' }}>
            {rosterBySalary.slice(0, 8).map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 'var(--space-1) var(--space-2)',
                borderBottom: '1px solid var(--color-border-subtle)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ fontWeight: 'var(--weight-semi)' }}>{p.name}</span>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>{p.position}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ color: rc(p.rating), fontWeight: 'var(--weight-semi)' }}>{p.rating}</span>
                  <span style={{ fontWeight: 'var(--weight-semi)', minWidth: 60, textAlign: 'right' }}>{fc(p.salary)}</span>
                  <span style={{ color: p.contractYears <= 1 ? 'var(--color-warning)' : 'var(--color-text-tertiary)', minWidth: 55, textAlign: 'right' }}>
                    {p.contractYears <= 1 ? 'Expiring' : p.contractYears + 'yr'}
                  </span>
                  {isRelegation && p.preRelegationSalary && (
                    <span style={{ color: 'var(--color-text-tertiary)', textDecoration: 'line-through', minWidth: 55, textAlign: 'right' }}>
                      {fc(p.preRelegationSalary)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {rosterBySalary.length > 8 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-2)', color: 'var(--color-text-tertiary)' }}>
                + {rosterBySalary.length - 8} more players
              </div>
            )}
          </div>
        </Section>

        {/* Spending strategy slider (non-T1 only) */}
        {currentTier !== 1 && (
          <Section title="Spending Strategy" icon="⚙️" color="var(--color-info)" bg="var(--color-info-bg)">
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }}>
              {isRelegation
                ? 'Higher spending keeps talent but leaves less cushion if revenue drops.'
                : 'Start conservative and increase as revenue grows.'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>60%</span>
              <input type="range" min="60" max="90" value={pct}
                onChange={(e) => handleSlider(e.target.value)}
                style={{ flex: 1, accentColor: 'var(--color-info)' }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>90%</span>
            </div>
            <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)' }}>
              <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-info)' }}>{pct}%</span>
              <span style={{ color: 'var(--color-text-tertiary)' }}> → </span>
              <span style={{ fontWeight: 'var(--weight-bold)' }}>{fc(adjLimit)}</span>
              <span style={{ color: 'var(--color-text-tertiary)' }}> limit → </span>
              <span style={{ fontWeight: 'var(--weight-bold)', color: adjCap >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                {fc(adjCap)}
              </span>
              <span style={{ color: 'var(--color-text-tertiary)' }}> space</span>
            </div>
          </Section>
        )}

        {/* Planning advice */}
        <Section title="Planning Ahead" icon="💡">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
            {isRelegation ? (
              <>
                <div><strong>{expiring.length} expiring</strong> — re-sign at T{currentTier} salaries (cheaper). Keep your best.</div>
                <div><strong>Revenue advantage</strong> — your {fc(spendingPct !== null ? adjLimit : spendingLimit)} limit exceeds native T{currentTier} teams. Dominate now.</div>
                <div><strong>Revenue decays ~30%/year</strong> — Year 1 is your best shot to bounce back.</div>
              </>
            ) : (
              <>
                <div><strong>Budget growing</strong> — 2-3 seasons to reach full T{currentTier} revenue. Spend carefully.</div>
                <div><strong>Tougher competition</strong> — roster may need upgrades for T{currentTier}.</div>
                <div><strong>{expiring.length} expiring</strong> — re-signing at T{currentTier} rates costs more.</div>
              </>
            )}
          </div>
        </Section>
      </ModalBody>

      <ModalFooter>
        <Button variant="primary" onClick={onContinue} style={{ minWidth: 200 }}>
          Continue to {currentTier === 1 ? 'Draft' : 'Player Development'} →
        </Button>
      </ModalFooter>
    </Modal>
  );
}


/* ── Sub-components ── */

function FinCard({ label, value, color, sub }) {
  return (
    <div style={{
      textAlign: 'center', padding: 'var(--space-3)',
      background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{sub}</div>
    </div>
  );
}

function MiniCard({ label, icon, value, sub }) {
  return (
    <div style={{
      padding: 'var(--space-3)', background: 'var(--color-bg-sunken)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{icon} {label}</div>
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{sub}</div>
    </div>
  );
}

function Section({ title, icon, color, bg, children }) {
  return (
    <div style={{
      marginBottom: 'var(--space-4)', padding: 'var(--space-4)',
      background: bg || 'var(--color-bg-sunken)',
      borderRadius: 'var(--radius-md)',
      border: color ? '1px solid ' + color + '20' : 'none',
    }}>
      <div style={{
        fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)',
        marginBottom: 'var(--space-3)', color: color || 'var(--color-text)',
      }}>
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function BulletItem({ color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
      <span style={{ color, marginTop: 2, flexShrink: 0 }}>●</span>
      <span>{children}</span>
    </div>
  );
}
