import React, { useState, useMemo, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

const POSITIONS = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];
const TIER_FILTERS = [
  { value: 'ALL', label: 'All Tiers' },
  { value: '1', label: 'Tier 1 (70-95)' },
  { value: '2', label: 'Tier 2 (60-85)' },
  { value: '3', label: 'Tier 3 (50-75)' },
];

export function RosterModal({ isOpen, data, onClose }) {
  const [posFilter, setPosFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('rating');
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  // Safely extract data before early return
  const roster = data?.roster || [];
  const freeAgents = data?.freeAgents || [];
  const capInfo = data?.capInfo || {};
  const posBreakdown = data?.posBreakdown || {};
  const formatCurrency = data?.formatCurrency || (v => `$${(v / 1e6).toFixed(1)}M`);
  const getRatingColor = data?.getRatingColor || (() => 'var(--color-accent)');
  const getAttrColor = data?.getAttrColor || (() => 'var(--color-accent)');
  const attrDefs = data?.attrDefs || {};
  const physicalAttrs = data?.physicalAttrs || {};
  const mentalAttrs = data?.mentalAttrs || {};
  const returnContext = data?.returnContext || 'game';

  // Filter & sort free agents
  const filteredFAs = useMemo(() => {
    let filtered = [...freeAgents];
    if (posFilter !== 'ALL') filtered = filtered.filter(p => p.position === posFilter);
    if (tierFilter !== 'ALL') {
      const t = parseInt(tierFilter);
      if (t === 1) filtered = filtered.filter(p => p.rating >= 70 && p.rating <= 95);
      else if (t === 2) filtered = filtered.filter(p => p.rating >= 60 && p.rating <= 85);
      else if (t === 3) filtered = filtered.filter(p => p.rating >= 50 && p.rating <= 75);
    }
    if (sortBy === 'rating') filtered.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'age') filtered.sort((a, b) => a.age - b.age);
    return filtered.slice(0, 50);
  }, [freeAgents, posFilter, tierFilter, sortBy]);

  if (!isOpen || !data) return null;

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={1500} zIndex={1300}>
      <ModalHeader onClose={onClose}>
        Roster Management
      </ModalHeader>

      <ModalBody style={{ maxHeight: '78vh', overflowY: 'auto' }}>
        {/* Position Breakdown */}
        <PositionBreakdown posBreakdown={posBreakdown} />

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
          {/* Left: Your Roster */}
          <div>
            <div style={{
              fontWeight: 'var(--weight-semi)', fontSize: 'var(--text-base)',
              marginBottom: 'var(--space-3)',
            }}>
              Your Roster ({roster.length}/15)
            </div>

            <CapStatus capInfo={capInfo} formatCurrency={formatCurrency} />

            <div style={{ maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {roster.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 'var(--space-5)' }}>No players on roster</div>
              ) : roster.map(player => (
                <RosterPlayerCard key={player.id} player={player}
                  canDrop={roster.length > 12 || capInfo.isOverCap}
                  formatCurrency={formatCurrency} getRatingColor={getRatingColor}
                  getAttrColor={getAttrColor} attrDefs={attrDefs}
                  physicalAttrs={physicalAttrs} mentalAttrs={mentalAttrs}
                  expanded={expandedPlayer === player.id}
                  onToggleExpand={() => setExpandedPlayer(expandedPlayer === player.id ? null : player.id)}
                  onDrop={() => handleDrop(player.id)}
                />
              ))}
            </div>
          </div>

          {/* Right: Free Agents */}
          <div>
            <div style={{
              fontWeight: 'var(--weight-semi)', fontSize: 'var(--text-base)',
              marginBottom: 'var(--space-3)',
            }}>
              Free Agents
            </div>

            {/* Filter Controls */}
            <div style={{
              display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap',
              marginBottom: 'var(--space-3)',
            }}>
              <FilterSelect value={posFilter} onChange={setPosFilter}
                options={POSITIONS.map(p => ({ value: p, label: p === 'ALL' ? 'All Positions' : p }))} />
              <FilterSelect value={tierFilter} onChange={setTierFilter} options={TIER_FILTERS} />
              <SortButton active={sortBy === 'rating'} onClick={() => setSortBy('rating')} label="Sort by Rating" />
              <SortButton active={sortBy === 'age'} onClick={() => setSortBy('age')} label="Sort by Age" />
            </div>

            <div style={{ maxHeight: 450, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {filteredFAs.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 'var(--space-5)' }}>No free agents match filters</div>
              ) : filteredFAs.map(player => (
                <FreeAgentCard key={player.id} player={player}
                  rosterFull={rosterFull} remainingCap={capInfo.remainingCap || 0}
                  formatCurrency={formatCurrency} getRatingColor={getRatingColor}
                  onSign={() => handleSign(player.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div style={{
          display: 'flex', gap: 'var(--space-3)', justifyContent: 'center',
          marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--color-border-subtle)',
        }}>
          <Button variant="secondary" onClick={handleOpenTrade}>
            Open Trade Screen
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done Managing Roster
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
}

/* ── Position Breakdown ── */
function PositionBreakdown({ posBreakdown }) {
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  const total = Object.values(posBreakdown).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  return (
    <div style={{
      display: 'flex', gap: 'var(--space-3)', justifyContent: 'center',
      marginBottom: 'var(--space-4)', flexWrap: 'wrap',
    }}>
      {positions.map(pos => {
        const count = posBreakdown[pos] || 0;
        const ideal = pos === 'PG' || pos === 'SG' || pos === 'SF' ? 3 : 3;
        const color = count === 0 ? 'var(--color-loss)' : count <= 1 ? 'var(--color-warning)' : 'var(--color-win)';
        return (
          <div key={pos} style={{
            background: 'var(--color-bg-sunken)', 
            padding: 'var(--space-2) var(--space-3)', textAlign: 'center',
            border: '1px solid var(--color-border-subtle)', minWidth: 60,
          }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{pos}</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color }}>{count}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Cap Status ── */
function CapStatus({ capInfo, formatCurrency }) {
  const {
    totalSalary, salaryCap, salaryFloor, remainingCap, isOverCap, isUnderFloor,
    isRevenueBasedCap, hasCapBoost, boostLabel, boostAmount,
    teamChemistry, chemistryColor, chemistryDesc,
  } = capInfo;

  const fc = formatCurrency;
  const capLabel = isRevenueBasedCap ? 'Spending Limit' : 'Salary Cap';

  return (
    <div style={{
      background: 'var(--color-bg-sunken)', 
      padding: 'var(--space-3)', marginBottom: 'var(--space-3)',
      border: '1px solid var(--color-border-subtle)',
      fontSize: 'var(--text-sm)',
    }}>
      <CapRow label="Total Salary" value={fc(totalSalary)}
        valueColor={isOverCap ? 'var(--color-loss)' : isUnderFloor ? 'var(--color-warning)' : 'var(--color-win)'} bold />
      <CapRow label={capLabel} value={fc(salaryCap)}
        suffix={hasCapBoost ? boostLabel : (isRevenueBasedCap ? '(revenue-based)' : '')} />
      <CapRow label="Salary Floor" value={fc(salaryFloor)} />
      <CapRow label="Cap Space" value={fc(remainingCap)}
        valueColor={isOverCap ? 'var(--color-loss)' : 'var(--color-win)'} bold />

      {/* Chemistry bar */}
      <div style={{
        borderTop: '1px solid var(--color-border-subtle)', marginTop: 'var(--space-3)',
        paddingTop: 'var(--space-3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <span style={{ fontWeight: 'var(--weight-semi)' }}>Team Chemistry</span>
          <span style={{ color: chemistryColor, fontWeight: 'var(--weight-semi)' }}>{teamChemistry} - {chemistryDesc}</span>
        </div>
        <div style={{ height: 8, background: 'var(--color-bg-active)',  overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${teamChemistry || 0}%`, background: chemistryColor,  transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Warnings */}
      {isOverCap && (
        <CapWarning color="var(--color-loss)" 
          title={`OVER ${isRevenueBasedCap ? 'SPENDING LIMIT' : 'CAP'}!`}
          text="You must drop players before advancing to next season." />
      )}
      {isUnderFloor && (
        <CapWarning color="var(--color-warning)" 
          title="UNDER SALARY FLOOR!"
          text={`You need to spend at least ${fc(salaryFloor)} on player salaries.`} />
      )}
      {hasCapBoost && (
        <CapWarning color="var(--color-rating-elite)" 
          title={boostLabel} text={`+${fc(boostAmount)} temporary cap boost to help transition your roster.`} />
      )}
    </div>
  );
}

function CapRow({ label, value, valueColor, bold, suffix }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
      <span style={{ fontWeight: 'var(--weight-semi)' }}>{label}:</span>
      <span>
        <span style={{ color: valueColor, fontWeight: bold ? 'var(--weight-bold)' : 'var(--weight-normal)' }}>{value}</span>
        {suffix && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-1)' }}>{suffix}</span>}
      </span>
    </div>
  );
}

function CapWarning({ color, title, text }) {
  return (
    <div style={{
      marginTop: 8, padding: '6px 10px',
      background: `${color}15`, borderLeft: `3px solid ${color}`,
      fontSize: 'var(--text-xs)',
    }}>
      <strong style={{ color }}>{title}</strong>
      <span style={{ marginLeft: 6 }}>{text}</span>
    </div>
  );
}

/* ── Compact Rating ── */
function CompactRating({ player, getRatingColor }) {
  const rc = getRatingColor || ((r) => r >= 85 ? 'var(--color-rating-elite)' : r >= 78 ? 'var(--color-rating-good)' : r >= 70 ? '#96ceb4' : r >= 60 ? 'var(--color-warning)' : 'var(--color-loss)');
  const off = player.offRating;
  const def = player.defRating;
  const offColor = off >= 80 ? 'var(--color-rating-elite)' : off >= 70 ? 'var(--color-rating-good)' : off >= 60 ? 'var(--color-warning)' : 'var(--color-loss)';
  const defColor = def >= 80 ? 'var(--color-rating-elite)' : def >= 70 ? 'var(--color-rating-good)' : def >= 60 ? 'var(--color-warning)' : 'var(--color-loss)';

  return (
    <span>
      <span style={{ color: rc(player.rating), fontWeight: 'var(--weight-bold)' }}>{player.rating}</span>
      {off !== undefined && def !== undefined && (
        <span style={{ opacity: 0.75, marginLeft: 6, fontSize: '0.88em' }}>
          (<span style={{ color: offColor }} title="Offensive Rating">{off}</span>
          {' / '}
          <span style={{ color: defColor }} title="Defensive Rating">{def}</span>)
        </span>
      )}
    </span>
  );
}

/* ── Roster Player Card ── */
function RosterPlayerCard({
  player, canDrop, formatCurrency, getRatingColor, getAttrColor,
  attrDefs, physicalAttrs, mentalAttrs, expanded, onToggleExpand, onDrop,
}) {
  const contractYears = player.contractYears || 1;
  const contractColor = contractYears === 1 ? 'var(--color-warning)' : 'var(--color-win)';

  let injuryBadge = null;
  if (player.injuryStatus === 'out') {
    const gamesOut = player.injury?.gamesRemaining || '?';
    injuryBadge = <span style={{ color: 'var(--color-loss)', marginLeft: 8, fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-xs)' }}>OUT ({gamesOut} games)</span>;
  } else if (player.injuryStatus === 'day-to-day') {
    injuryBadge = <span style={{ color: 'var(--color-warning)', marginLeft: 8, fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-xs)' }}>Day-to-Day</span>;
  }

  const fatigue = player.fatigue || 0;
  const fatigueColor = data_getFatigueColor(fatigue);
  const fatigueDesc = data_getFatigueDesc(fatigue);

  const m = player.measurables;
  const measStr = m ? `${formatHeight(m.height)} \u00b7 ${m.weight}lbs` : '';

  const collab = player.attributes?.collaboration || 50;
  const collabIcon = null; // collaboration shown in attributes panel

  // Top 3 attributes preview
  const attrPreview = useMemo(() => {
    if (!player.attributes) return [];
    return Object.entries(player.attributes)
      .sort(([, a], [, b]) => b - a).slice(0, 3)
      .map(([key, val]) => {
        const def = attrDefs[key];
        return def ? { val, color: getAttrColor(val), name: def.name } : null;
      }).filter(Boolean);
  }, [player.attributes, attrDefs, getAttrColor]);

  return (
    <div style={{
      background: 'var(--color-bg-sunken)', padding: 'var(--space-3)',
       border: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>
            <strong>{player.name}</strong>
            
            <span style={{ color: 'var(--color-text-tertiary)' }}>{player.position}</span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>Age {player.age}</span>
            {measStr && <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>{measStr}</span>}
            <span style={{ color: contractColor, fontWeight: 'var(--weight-bold)' }}>{contractYears}yr{contractYears > 1 ? 's' : ''}</span>
            {player.relegationRelease && (
              <span style={{ color: '#e67e22', fontSize: 'var(--text-xs)' }} title="Relegation release clause">Rel. clause</span>
            )}
            {injuryBadge}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)', marginTop: 2, fontSize: 'var(--text-sm)' }}>
            <CompactRating player={player} getRatingColor={getRatingColor} />
            <span style={{ color: 'var(--color-text-tertiary)' }}>{formatCurrency(player.salary)}</span>
            <span style={{ color: fatigueColor, fontWeight: 'var(--weight-semi)', fontSize: 'var(--text-xs)' }}>{Math.round(fatigue)}% ({fatigueDesc})</span>
            {attrPreview.map((a, i) => (
              <span key={i} style={{ color: a.color, fontSize: 'var(--text-xs)' }} title={`${a.name}: ${a.val}`}>{a.val}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center', marginLeft: 'var(--space-2)' }}>
          <button onClick={onToggleExpand} style={{
            padding: '6px 10px', fontSize: 'var(--text-xs)', background: 'var(--color-bg-active)',
            border: '1px solid var(--color-border-subtle)', 
            color: 'var(--color-text)', cursor: 'pointer',
          }}>'⋯'</button>
          <button onClick={onDrop} disabled={!canDrop} style={{
            padding: '6px 12px', fontSize: 'var(--text-xs)',
            background: canDrop ? 'var(--color-loss)20' : 'var(--color-bg-active)',
            border: `1px solid ${canDrop ? 'var(--color-loss)40' : 'var(--color-border-subtle)'}`,
             color: canDrop ? 'var(--color-loss)' : 'var(--color-text-tertiary)',
            cursor: canDrop ? 'pointer' : 'not-allowed', opacity: canDrop ? 1 : 0.4,
          }}>Drop</button>
        </div>
      </div>

      {/* Expandable Attributes Panel */}
      {expanded && (
        <PlayerAttributesPanel player={player} attrDefs={attrDefs}
          physicalAttrs={physicalAttrs} mentalAttrs={mentalAttrs}
          getAttrColor={getAttrColor} getRatingColor={getRatingColor} />
      )}
    </div>
  );
}

/* ── Player Attributes Panel ── */
function PlayerAttributesPanel({ player, attrDefs, physicalAttrs, mentalAttrs, getAttrColor, getRatingColor }) {
  const m = player.measurables || {};
  const a = player.attributes || {};

  const attrBar = (key) => {
    const def = attrDefs[key];
    if (!def) return null;
    const val = a[key] || 50;
    const color = getAttrColor(val);
    return (
      <div key={key} style={{ marginBottom: 'var(--space-1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 1 }}>
          <span>{def.name}</span>
          <span style={{ color, fontWeight: 'var(--weight-bold)' }}>{val}</span>
        </div>
        <div style={{ height: 5, background: 'var(--color-bg-active)',  overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${val}%`, background: color, borderRadius: 'var(--radius-full)' }} />
        </div>
      </div>
    );
  };

  const offKeys = ['clutch', 'basketballIQ', 'speed'];
  const defKeys = ['strength', 'verticality', 'endurance'];
  const intKeys = ['workEthic', 'coachability', 'collaboration'];

  return (
    <div style={{
      marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)',
      borderTop: '1px solid var(--color-border-subtle)',
    }}>
      {/* Rating header */}
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <CompactRating player={player} getRatingColor={getRatingColor} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--space-3)', fontSize: '0.88em' }}>
        {/* Measurables */}
        <div>
          <div style={{ fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>MEASURABLES</div>
          <div style={{ marginBottom: 3 }}>Height: <strong>{formatHeight(m.height || 78)}</strong></div>
          <div style={{ marginBottom: 3 }}>Weight: <strong>{m.weight || 210} lbs</strong></div>
          <div style={{ marginBottom: 3 }}>Wingspan: <strong>{formatWingspan(m.wingspan || 82)}</strong></div>
        </div>
        {/* Offense */}
        <div>
          <div style={{ fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)', color: 'var(--color-rating-elite)' }}>OFFENSE</div>
          {offKeys.map(k => attrBar(k))}
        </div>
        {/* Defense */}
        <div>
          <div style={{ fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)', color: 'var(--color-rating-good)' }}>DEFENSE</div>
          {defKeys.map(k => attrBar(k))}
        </div>
        {/* Intangibles */}
        <div>
          <div style={{ fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)', color: '#96ceb4' }}>INTANGIBLES</div>
          {intKeys.map(k => attrBar(k))}
        </div>
      </div>
    </div>
  );
}

/* ── Free Agent Card ── */
function FreeAgentCard({ player, rosterFull, remainingCap, formatCurrency, getRatingColor, onSign }) {
  const canAfford = player.salary <= remainingCap;
  const canSign = !rosterFull && canAfford;
  const contractYears = player.contractYears || 1;
  const contractColor = contractYears === 1 ? 'var(--color-warning)' : 'var(--color-win)';

  return (
    <div style={{
      background: 'var(--color-bg-sunken)', padding: 'var(--space-3)',
       border: '1px solid var(--color-border-subtle)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>
          <strong>{player.name}</strong>
          <span style={{ color: 'var(--color-text-tertiary)' }}>{player.position}</span>
          <span style={{ color: 'var(--color-text-tertiary)' }}>Age {player.age}</span>
          <span style={{ color: contractColor, fontWeight: 'var(--weight-bold)' }}>{contractYears}yr{contractYears > 1 ? 's' : ''}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)', marginTop: 2, fontSize: 'var(--text-sm)' }}>
          <CompactRating player={player} getRatingColor={getRatingColor} />
          <span style={{ color: 'var(--color-text-tertiary)' }}>{formatCurrency(player.salary)}/yr</span>
          {!canAfford && !rosterFull && (
            <span style={{ color: 'var(--color-loss)', fontSize: 'var(--text-xs)' }}>Can't afford</span>
          )}
        </div>
      </div>
      <button onClick={onSign} disabled={!canSign}
        title={!canAfford ? 'Not enough cap space' : rosterFull ? 'Roster full' : 'Sign player'}
        style={{
          padding: '6px 14px', fontSize: 'var(--text-xs)', marginLeft: 'var(--space-2)',
          background: canSign ? 'var(--color-win)20' : 'var(--color-bg-active)',
          border: `1px solid ${canSign ? 'var(--color-win)40' : 'var(--color-border-subtle)'}`,
           color: canSign ? 'var(--color-win)' : 'var(--color-text-tertiary)',
          cursor: canSign ? 'pointer' : 'not-allowed', opacity: canSign ? 1 : 0.4,
          whiteSpace: 'nowrap',
        }}>Sign</button>
    </div>
  );
}

/* ── Filter/Sort Controls ── */
function FilterSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      padding: '6px 10px',
      background: 'var(--color-bg-raised)', color: 'var(--color-text)',
      border: '1px solid var(--color-border-subtle)', fontSize: 'var(--text-xs)',
      fontFamily: 'var(--font-body)',
    }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SortButton({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', fontSize: 'var(--text-xs)', cursor: 'pointer',
      border: 'none', fontFamily: 'var(--font-body)',
      background: active ? 'var(--color-accent)' : 'transparent',
      color: active ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
      fontWeight: active ? 600 : 400,
    }}>{label}</button>
  );
}

/* ── Utility functions ── */
function formatHeight(inches) {
  if (!inches) return "6'6\"";
  const ft = Math.floor(inches / 12);
  const rem = inches % 12;
  return `${ft}'${rem}"`;
}

function formatWingspan(inches) {
  if (!inches) return "6'10\"";
  const ft = Math.floor(inches / 12);
  const rem = inches % 12;
  return `${ft}'${rem}"`;
}

function data_getFatigueColor(f) {
  if (f >= 80) return 'var(--color-loss)';
  if (f >= 60) return 'var(--color-warning)';
  if (f >= 40) return 'var(--color-rating-avg)';
  return 'var(--color-win)';
}

function data_getFatigueDesc(f) {
  if (f >= 80) return 'Exhausted';
  if (f >= 60) return 'Tired';
  if (f >= 40) return 'Moderate';
  if (f >= 20) return 'Fresh';
  return 'Rested';
}
