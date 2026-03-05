import React, { useState, useMemo, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

const POSITIONS = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];

/* ── Design-system color functions (override any engine colors) ── */
const ratingColor = (r) =>
  r >= 85 ? 'var(--color-rating-elite)' : r >= 78 ? 'var(--color-rating-good)'
  : r >= 70 ? 'var(--color-rating-avg)' : r >= 60 ? 'var(--color-rating-below)'
  : 'var(--color-rating-poor)';

const attrColor = (v) =>
  v >= 75 ? 'var(--color-rating-elite)' : v >= 60 ? 'var(--color-rating-good)'
  : v >= 45 ? 'var(--color-rating-avg)' : 'var(--color-rating-poor)';

const posColor = (n) =>
  n >= 2 ? 'var(--color-win)' : n === 1 ? 'var(--color-warning)' : 'var(--color-loss)';

const fatigueColor = (f) =>
  f >= 60 ? 'var(--color-loss)' : f >= 35 ? 'var(--color-warning)' : 'var(--color-win)';

export function RosterModal({ isOpen, data, onClose }) {
  const [posFilter, setPosFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('rating');
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  const roster = data?.roster || [];
  const freeAgents = data?.freeAgents || [];
  const capInfo = data?.capInfo || {};
  const posBreakdown = data?.posBreakdown || {};
  const formatCurrency = data?.formatCurrency || (v => `$${(v / 1e6).toFixed(1)}M`);
  const attrDefs = data?.attrDefs || {};
  const physicalAttrs = data?.physicalAttrs || {};
  const mentalAttrs = data?.mentalAttrs || {};

  const filteredFAs = useMemo(() => {
    let filtered = [...freeAgents];
    if (posFilter !== 'ALL') filtered = filtered.filter(p => p.position === posFilter);
    if (sortBy === 'rating') filtered.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'age') filtered.sort((a, b) => a.age - b.age);
    return filtered.slice(0, 50);
  }, [freeAgents, posFilter, sortBy]);

  if (!isOpen || !data) return null;

  const fc = formatCurrency;
  const rosterFull = roster.length >= 15;

  const handleDrop = (playerId) => {
    if (window.dropPlayer) window.dropPlayer(playerId);
    if (data.onRefresh) data.onRefresh();
  };

  const handleSign = (playerId) => {
    if (window.signPlayer) window.signPlayer(playerId);
    if (data.onRefresh) data.onRefresh();
  };

  const handleOpenTrade = () => {
    if (window.openTradeScreenFromRoster) window.openTradeScreenFromRoster();
    onClose();
  };

  const {
    totalSalary = 0, salaryCap = 0, salaryFloor = 0, remainingCap = 0,
    isOverCap, isUnderFloor, isRevenueBasedCap,
    hasCapBoost, boostLabel, boostAmount = 0,
    teamChemistry = 50, chemistryColor: _ignore, chemistryDesc = '',
  } = capInfo;

  // Chemistry color from our system, not engine
  const chemColor = teamChemistry >= 70 ? 'var(--color-win)' : teamChemistry >= 40 ? 'var(--color-warning)' : 'var(--color-loss)';
  const capLabel = isRevenueBasedCap ? 'Spending Limit' : 'Salary Cap';
  const usagePct = salaryCap > 0 ? Math.min(100, (totalSalary / salaryCap) * 100) : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={1500} zIndex={1300}>
      <ModalHeader onClose={onClose}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 16 }}>
          <span>Roster Management</span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Button variant="secondary" size="sm" onClick={handleOpenTrade}>Open Trade Screen</Button>
            <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
          </div>
        </div>
      </ModalHeader>

      <ModalBody style={{ maxHeight: '78vh', overflowY: 'auto' }}>
        {/* ═══ STATUS BAR ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gap)', marginBottom: 12 }}>
          <StatusBox label="Payroll" value={fc(totalSalary)} />
          <StatusBox label={capLabel} value={fc(salaryCap)}
            sub={hasCapBoost ? boostLabel : (isRevenueBasedCap ? '(revenue-based)' : '')} />
          <StatusBox label="Cap Space" value={fc(remainingCap)}
            color={isOverCap ? 'var(--color-loss)' : remainingCap > 0 ? 'var(--color-win)' : 'var(--color-text)'} />
          <StatusBox label="Chemistry" value={`${Math.round(teamChemistry)}%`}
            color={chemColor} sub={chemistryDesc} />
        </div>

        {/* ═══ POSITION COUNTS + PAYROLL BAR ═══ */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '10px 14px', background: 'var(--color-bg-sunken)',
          border: '1px solid var(--color-border-subtle)', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', gap: 12, flex: '0 0 auto' }}>
            {['PG', 'SG', 'SF', 'PF', 'C'].map(pos => {
              const count = posBreakdown[pos] || 0;
              return (
                <div key={pos} style={{ textAlign: 'center', minWidth: 32 }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{pos}</div>
                  <div style={{
                    fontSize: 'var(--text-base)', fontWeight: 700, fontFamily: 'var(--font-mono)',
                    color: posColor(count),
                  }}>{count}</div>
                </div>
              );
            })}
          </div>
          <div style={{ width: 1, height: 28, background: 'var(--color-border)' }} />
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 3,
            }}>
              <span>{roster.length}/15 roster spots</span>
              <span>{fc(totalSalary)} of {fc(salaryCap)}</span>
            </div>
            <div style={{
              height: 6, background: 'var(--color-bg-raised)', overflow: 'hidden',
              border: '1px solid var(--color-border-subtle)',
            }}>
              <div style={{
                height: '100%', width: `${usagePct}%`,
                background: isOverCap ? 'var(--color-loss)' : usagePct > 85 ? 'var(--color-warning)' : 'var(--color-win)',
                opacity: 0.6,
              }} />
            </div>
          </div>
        </div>

        {/* Warnings */}
        {isOverCap && (
          <CapWarning color="var(--color-loss)" title={`OVER ${isRevenueBasedCap ? 'SPENDING LIMIT' : 'CAP'}`}
            text="You must drop players before advancing." />
        )}
        {isUnderFloor && (
          <CapWarning color="var(--color-warning)" title="UNDER SALARY FLOOR"
            text={`Must spend at least ${fc(salaryFloor)}.`} />
        )}
        {hasCapBoost && (
          <CapWarning color="var(--color-accent)" title={boostLabel}
            text={`+${fc(boostAmount)} temporary cap boost.`} />
        )}

        {/* ═══ TWO COLUMNS ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)', alignItems: 'start' }}>
          {/* LEFT: Your Roster */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
            }}>Your Roster ({roster.length}/15)</div>

            <div style={{
              maxHeight: 440, overflowY: 'auto',
              background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg-raised)', zIndex: 1 }}>
                    <th style={{ ...th, textAlign: 'left' }}>Player</th>
                    <th style={th}>Pos</th>
                    <th style={th}>Age</th>
                    <th style={th}>OVR</th>
                    <th style={th}>OFF</th>
                    <th style={th}>DEF</th>
                    <th style={{ ...th, textAlign: 'right' }}>Salary</th>
                    <th style={th}>Ctr</th>
                    <th style={{ ...th, width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {roster.sort((a, b) => (b.rating || 0) - (a.rating || 0)).map(player => {
                    const isExpanded = expandedPlayer === player.id;
                    const canDrop = roster.length > 12 || isOverCap;
                    const contractYears = player.contractYears || 1;
                    return (
                      <React.Fragment key={player.id}>
                        <tr
                          onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
                          style={{
                            borderBottom: '1px solid var(--color-border-subtle)',
                            cursor: 'pointer', background: 'var(--color-bg-raised)',
                            transition: 'background 100ms',
                          }}
                          onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--color-accent-bg)'; }}
                          onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--color-bg-raised)'; }}
                        >
                          <td style={{ padding: '6px 8px', fontWeight: 500 }}>
                            {player.name}
                            {player.injuryStatus === 'out' && (
                              <span style={{ color: 'var(--color-loss)', marginLeft: 6, fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                                OUT ({player.injury?.gamesRemaining || '?'}g)
                              </span>
                            )}
                            {player.injuryStatus === 'day-to-day' && (
                              <span style={{ color: 'var(--color-warning)', marginLeft: 6, fontSize: 'var(--text-xs)', fontWeight: 600 }}>DTD</span>
                            )}
                          </td>
                          <td style={{ ...tdc, fontWeight: 500 }}>{player.position}</td>
                          <td style={{ ...tdc, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{player.age}</td>
                          <td style={{ ...tdc, fontFamily: 'var(--font-mono)', fontWeight: 700, color: ratingColor(player.rating) }}>{player.rating}</td>
                          <td style={{ ...tdc, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{player.offRating || '—'}</td>
                          <td style={{ ...tdc, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{player.defRating || '—'}</td>
                          <td style={{ ...tdc, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{fc(player.salary)}</td>
                          <td style={{
                            ...tdc, fontSize: 'var(--text-xs)',
                            color: contractYears <= 1 ? 'var(--color-warning)' : 'var(--color-text-tertiary)',
                          }}>{contractYears <= 1 ? 'Exp' : `${contractYears}yr`}</td>
                          <td style={tdc}>
                            <button onClick={e => { e.stopPropagation(); handleDrop(player.id); }}
                              disabled={!canDrop} style={{
                                border: 'none', background: 'transparent',
                                color: canDrop ? 'var(--color-loss)' : 'var(--color-text-tertiary)',
                                cursor: canDrop ? 'pointer' : 'not-allowed',
                                fontSize: 'var(--text-xs)', fontFamily: 'var(--font-body)',
                                opacity: canDrop ? 0.7 : 0.3,
                              }}>Drop</button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr><td colSpan={9} style={{ padding: 0 }}>
                            <ExpandedDetail player={player} attrDefs={attrDefs}
                              physicalAttrs={physicalAttrs} mentalAttrs={mentalAttrs} fc={fc} />
                          </td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: Free Agents */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>Free Agents</div>
              <div style={{ display: 'flex', gap: 3 }}>
                {POSITIONS.map(pos => (
                  <button key={pos} onClick={() => setPosFilter(pos)} style={{
                    padding: '2px 8px', fontSize: 10, border: 'none',
                    background: posFilter === pos ? 'var(--color-accent)' : 'transparent',
                    color: posFilter === pos ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)',
                    fontWeight: posFilter === pos ? 600 : 400,
                    fontFamily: 'var(--font-body)', cursor: 'pointer',
                  }}>{pos === 'ALL' ? 'All' : pos}</button>
                ))}
              </div>
            </div>

            <div style={{
              maxHeight: 440, overflowY: 'auto',
              background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)',
            }}>
              {filteredFAs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                  No free agents match filters
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg-raised)', zIndex: 1 }}>
                      <th style={{ ...th, textAlign: 'left' }}>Player</th>
                      <th style={th}>Pos</th>
                      <th style={th}>Age</th>
                      <th style={th}>OVR</th>
                      <th style={{ ...th, textAlign: 'right' }}>Salary</th>
                      <th style={{ ...th, width: 44 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFAs.map(player => {
                      const canAfford = player.salary <= remainingCap;
                      const canSign = !rosterFull && canAfford;
                      return (
                        <tr key={player.id} style={{
                          borderBottom: '1px solid var(--color-border-subtle)',
                          background: 'var(--color-bg-raised)',
                        }}>
                          <td style={{ padding: '6px 8px', fontWeight: 500 }}>{player.name}</td>
                          <td style={{ ...tdc, fontWeight: 500 }}>{player.position}</td>
                          <td style={{ ...tdc, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{player.age}</td>
                          <td style={{ ...tdc, fontFamily: 'var(--font-mono)', fontWeight: 700, color: ratingColor(player.rating) }}>{player.rating}</td>
                          <td style={{ ...tdc, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{fc(player.salary)}/yr</td>
                          <td style={tdc}>
                            <button onClick={() => handleSign(player.id)} disabled={!canSign}
                              title={!canAfford ? 'Not enough cap space' : rosterFull ? 'Roster full' : 'Sign player'}
                              style={{
                                border: 'none', padding: '3px 10px',
                                background: canSign ? 'var(--color-win)' : 'var(--color-bg-sunken)',
                                color: canSign ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)',
                                cursor: canSign ? 'pointer' : 'not-allowed',
                                fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-body)',
                                opacity: canSign ? 1 : 0.4,
                              }}>Sign</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

/* ── Expanded Player Detail ── */
function ExpandedDetail({ player, attrDefs, physicalAttrs, mentalAttrs, fc }) {
  const p = player;
  const m = p.measurables;
  const a = p.attributes || {};
  const fatigue = p.fatigue || 0;

  const fmtH = (inches) => {
    if (!inches) return "—";
    const ft = Math.floor(inches / 12);
    return `${ft}'${inches % 12}"`;
  };

  // Build attribute list from definitions
  const allDefs = { ...physicalAttrs, ...mentalAttrs, ...attrDefs };
  const attrList = Object.entries(a)
    .map(([key, val]) => {
      const def = allDefs[key];
      return def ? { key, name: def.name || key, val } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.val - a.val);

  return (
    <div style={{
      padding: '12px 16px', background: 'var(--color-accent-bg)',
      borderBottom: '1px solid var(--color-border)',
    }}>
      {/* Summary line */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 'var(--text-xs)', flexWrap: 'wrap' }}>
        <span>OFF: <strong style={{ fontFamily: 'var(--font-mono)', color: ratingColor(p.offRating || 0) }}>{p.offRating || '—'}</strong></span>
        <span>DEF: <strong style={{ fontFamily: 'var(--font-mono)', color: ratingColor(p.defRating || 0) }}>{p.defRating || '—'}</strong></span>
        <span>Fatigue: <strong style={{ fontFamily: 'var(--font-mono)', color: fatigueColor(fatigue) }}>{Math.round(fatigue)}%</strong></span>
        {m && (
          <span style={{ color: 'var(--color-text-tertiary)' }}>
            {fmtH(m.height)} · {m.weight}lbs · {fmtH(m.wingspan)} WS
          </span>
        )}
        {p.salary && <span style={{ color: 'var(--color-text-tertiary)' }}>{fc(p.salary)}/yr</span>}
        {p.relegationRelease && (
          <span style={{ color: 'var(--color-warning)' }}>Relegation clause</span>
        )}
      </div>

      {/* Attribute bars in 3 columns */}
      {attrList.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 16px' }}>
          {attrList.map(attr => (
            <div key={attr.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', flex: '0 0 80px' }}>{attr.name}</span>
              <div style={{
                flex: 1, height: 4, background: 'var(--color-bg-raised)',
                overflow: 'hidden', border: '1px solid var(--color-border-subtle)',
              }}>
                <div style={{ height: '100%', width: `${attr.val}%`, background: attrColor(attr.val), opacity: 0.7 }} />
              </div>
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: attrColor(attr.val), width: 20, textAlign: 'right',
              }}>{attr.val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Cap Warning ── */
function CapWarning({ color, title, text }) {
  return (
    <div style={{
      padding: '6px 10px', marginBottom: 8,
      background: `${color}15`, borderLeft: `3px solid ${color}`,
      fontSize: 'var(--text-xs)',
    }}>
      <strong style={{ color }}>{title}</strong>
      <span style={{ marginLeft: 6 }}>{text}</span>
    </div>
  );
}

/* ── Status Box ── */
function StatusBox({ label, value, color, sub }) {
  return (
    <div style={{
      padding: '10px 12px', background: 'var(--color-bg-sunken)',
      border: '1px solid var(--color-border-subtle)', textAlign: 'center',
    }}>
      <div style={{
        fontSize: 10, color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3,
      }}>{label}</div>
      <div style={{
        fontSize: 'var(--text-md)', fontWeight: 700, fontFamily: 'var(--font-mono)',
        color: color || 'var(--color-text)',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

const th = {
  padding: '6px 8px', fontSize: 10, fontWeight: 600,
  color: 'var(--color-text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center',
};

const tdc = { padding: '6px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' };
