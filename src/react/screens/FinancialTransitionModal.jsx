import React, { useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

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
  const rc = getRatingColor || ((r) =>
    r >= 80 ? 'var(--color-rating-elite)' : r >= 70 ? 'var(--color-rating-good)'
    : r >= 60 ? 'var(--color-rating-avg)' : 'var(--color-rating-poor)');
  const f = team.finances;
  const r = summary.revenue;

  const pct = spendingPct !== null ? spendingPct : Math.round(spendingRatio * 100);
  const adjLimit = Math.round(summary.totalRevenue * (pct / 100));
  const adjCap = adjLimit - totalSalary;

  const accent = isRelegation ? 'var(--color-loss)' : 'var(--color-win)';

  const handleSlider = (val) => {
    setSpendingPct(parseInt(val));
    onSpendingChange?.(parseInt(val));
  };

  return (
    <Modal isOpen={isOpen} onClose={onContinue} maxWidth={640} zIndex={1300}>
      <ModalBody style={{ padding: 0 }}>
        <div style={{ borderTop: `3px solid ${accent}` }}>
          {/* Header */}
          <div style={{ padding: '20px 24px', textAlign: 'center', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: accent,
              textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4,
            }}>{isRelegation ? 'Relegation' : 'Promotion'} Financial Briefing</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 4 }}>
              {team.name}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Tier {previousTier} → Tier {currentTier}
            </div>
          </div>

          <div style={{ padding: '16px 24px', maxHeight: '55vh', overflowY: 'auto' }}>
            {/* Financial overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)', marginBottom: 16 }}>
              <MetricBox label="Total Revenue" value={fc(summary.totalRevenue)} />
              <MetricBox label={currentTier === 1 ? 'Salary Cap' : 'Spending Limit'}
                value={fc(spendingPct !== null ? adjLimit : spendingLimit)}
                sub={currentTier !== 1 ? `${pct}% of revenue` : 'Fixed T1 cap'} />
              <MetricBox label="Cap Space"
                value={fc(spendingPct !== null ? adjCap : capSpace)}
                color={(spendingPct !== null ? adjCap : capSpace) < 0 ? 'var(--color-loss)' : undefined} />
            </div>

            {/* What Changed */}
            <Section label="What Changed">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {isRelegation ? (
                  <>
                    <Bullet color="var(--color-loss)">
                      <strong>TV Revenue dropped</strong> — League deal: {fc(r.league)}
                    </Bullet>
                    <Bullet color="var(--color-warning)">
                      <strong>Matchday & Commercial retained</strong> — {fc(r.matchday + r.commercial)}, decays ~30%/season without promotion
                    </Bullet>
                    <Bullet color="var(--color-win)">
                      <strong>Contracts restructured</strong> — Relegation wage clauses activated
                    </Bullet>
                    {releasedPlayers && releasedPlayers.length > 0 && (
                      <Bullet color="var(--color-accent)">
                        <strong>{releasedPlayers.length} release clause{releasedPlayers.length > 1 ? 's' : ''} activated</strong> — {releasedPlayers.map(p => p.name + ' (' + p.rating + ')').join(', ')}
                      </Bullet>
                    )}
                    <Bullet color="var(--color-info)">
                      <strong>Fanbase took 12% hit</strong> — Now {f.fanbase.toLocaleString()} fans
                    </Bullet>
                  </>
                ) : (
                  <>
                    <Bullet color="var(--color-win)">
                      <strong>TV Revenue jumped</strong> — League deal increased to {fc(r.league)}
                    </Bullet>
                    <Bullet color="var(--color-warning)">
                      <strong>Matchday & Commercial growing</strong> — 20% promotion boost, grows over 2-3 seasons
                    </Bullet>
                    <Bullet color="var(--color-info)">
                      <strong>Fanbase boosted 15%</strong> — Now {f.fanbase.toLocaleString()} fans
                    </Bullet>
                  </>
                )}
              </div>
            </Section>

            {/* Roster Salary */}
            <Section label="Roster Salary Breakdown"
              sub={isRelegation
                ? `Contracts restructured for Tier ${currentTier}. Expiring contracts re-sign at new rates.`
                : `Roster priced for Tier ${currentTier}. May need upgrades to compete.`}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)', marginBottom: 10 }}>
                <MiniMetric label={`Locked (${locked.length})`} value={fc(lockedSalary)} sub="Until expiry" />
                <MiniMetric label={`Expiring (${expiring.length})`} value={fc(expiringSalary)} sub={`Re-sign at T${currentTier} rates`} />
              </div>

              {/* Payroll bar */}
              <div style={{ marginBottom: 10 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 3,
                }}>
                  <span>Payroll: {fc(totalSalary)}</span>
                  <span>{currentTier === 1 ? 'Cap' : 'Limit'}: {fc(spendingPct !== null ? adjLimit : spendingLimit)}</span>
                </div>
                <div style={{
                  background: 'var(--color-bg-raised)', height: 8, overflow: 'hidden',
                  border: '1px solid var(--color-border-subtle)',
                }}>
                  <div style={{
                    height: '100%',
                    width: Math.min(100, (totalSalary / (spendingPct !== null ? adjLimit : spendingLimit)) * 100) + '%',
                    background: (spendingPct !== null ? adjCap : capSpace) >= 0 ? 'var(--color-win)' : 'var(--color-loss)',
                    opacity: 0.7, transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>

              {/* Full roster salary table */}
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {rosterBySalary.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '4px 0', fontSize: 'var(--text-xs)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <span style={{ color: 'var(--color-text-tertiary)' }}>{p.position}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: rc(p.rating) }}>{p.rating}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, minWidth: 56, textAlign: 'right' }}>{fc(p.salary)}</span>
                      <span style={{
                        color: p.contractYears <= 1 ? 'var(--color-warning)' : 'var(--color-text-tertiary)',
                        minWidth: 52, textAlign: 'right',
                      }}>
                        {p.contractYears <= 1 ? 'Expiring' : p.contractYears + 'yr'}
                      </span>
                      {isRelegation && p.preRelegationSalary && (
                        <span style={{
                          color: 'var(--color-text-tertiary)', textDecoration: 'line-through',
                          minWidth: 52, textAlign: 'right',
                        }}>{fc(p.preRelegationSalary)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Spending Strategy (non-T1) */}
            {currentTier !== 1 && (
              <Section label="Spending Strategy"
                sub={isRelegation
                  ? 'Higher spending keeps talent but leaves less cushion if revenue drops.'
                  : 'Start conservative and increase as revenue grows.'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>Conservative</span>
                  <input type="range" min="60" max="90" value={pct}
                    onChange={(e) => handleSlider(e.target.value)}
                    style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>Aggressive</span>
                </div>
                <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)' }}>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{pct}%</span>
                  <span style={{ color: 'var(--color-text-tertiary)', margin: '0 6px' }}>→</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>{fc(adjLimit)}</span>
                  <span style={{ color: 'var(--color-text-tertiary)', margin: '0 6px' }}>→</span>
                  <span style={{
                    fontWeight: 700, fontFamily: 'var(--font-mono)',
                    color: adjCap >= 0 ? 'var(--color-text)' : 'var(--color-loss)',
                  }}>{fc(adjCap)}</span>
                  <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 4 }}>space</span>
                </div>
              </Section>
            )}

            {/* Planning Ahead */}
            <Section label="Planning Ahead">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)' }}>
                {isRelegation ? (
                  <>
                    <div><strong>{expiring.length} expiring</strong> — re-sign at T{currentTier} salaries (cheaper). Keep your best.</div>
                    <div><strong>Revenue advantage</strong> — your {fc(spendingPct !== null ? adjLimit : spendingLimit)} limit exceeds native T{currentTier} teams.</div>
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
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="primary" onClick={onContinue}>
          Continue to {currentTier === 1 ? 'Draft' : 'Player Development'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function MetricBox({ label, value, color, sub }) {
  return (
    <div style={{
      padding: 10, background: 'var(--color-bg-sunken)',
      border: '1px solid var(--color-border-subtle)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: color || 'var(--color-text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function MiniMetric({ label, value, sub }) {
  return (
    <div style={{ padding: '8px 10px', background: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)' }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{sub}</div>}
    </div>
  );
}

function Section({ label, sub, children }) {
  return (
    <div style={{
      background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)',
      padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: sub ? 2 : 8,
      }}>{label}</div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>{sub}</div>}
      {children}
    </div>
  );
}

function Bullet({ color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--text-sm)' }}>
      <span style={{ color, marginTop: 5, flexShrink: 0, fontSize: 8 }}>●</span>
      <span>{children}</span>
    </div>
  );
}
