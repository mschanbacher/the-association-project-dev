import React, { useState, useMemo } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card, CardHeader } from '../components/Card.jsx';
import { Badge, RatingBadge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';

export function RosterScreen() {
  const { gameState, engines, isReady } = useGame();
  const [sortBy, setSortBy] = useState('rating');
  const [sortDir, setSortDir] = useState('desc');

  if (!isReady || !gameState?.userTeam) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', color: 'var(--color-text-tertiary)',
      }}>
        Loading roster…
      </div>
    );
  }

  const { userTeam, currentTier } = gameState;
  const { SalaryCapEngine, FinanceEngine, ChemistryEngine, LeagueManager, PlayerAttributes } = engines;
  const roster = userTeam.roster || [];

  // Salary data
  const totalSalary = roster.reduce((sum, p) => sum + (p.salary || 0), 0);
  FinanceEngine?.ensureFinances?.(userTeam);
  const effCap = SalaryCapEngine?.getEffectiveCap?.(userTeam) || 0;
  const remainingCap = SalaryCapEngine?.getRemainingCap?.(userTeam) || 0;
  const isOverCap = totalSalary > effCap;

  // Chemistry
  const chemistry = ChemistryEngine?.calculateTeamChemistry
    ? ChemistryEngine.calculateTeamChemistry(userTeam) : 50;

  // Sorted roster
  const sortedRoster = useMemo(() => {
    const sorted = [...roster].sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'rating': aVal = a.rating || 0; bVal = b.rating || 0; break;
        case 'offRating': aVal = a.offRating || 0; bVal = b.offRating || 0; break;
        case 'defRating': aVal = a.defRating || 0; bVal = b.defRating || 0; break;
        case 'salary': aVal = a.salary || 0; bVal = b.salary || 0; break;
        case 'age': aVal = a.age || 0; bVal = b.age || 0; break;
        case 'name': return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        case 'position': return sortDir === 'asc' ? (a.position||'').localeCompare(b.position||'') : (b.position||'').localeCompare(a.position||'');
        default: aVal = a.rating || 0; bVal = b.rating || 0;
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [roster, sortBy, sortDir]);

  // Position counts
  const posCounts = useMemo(() => {
    const counts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    roster.forEach(p => { if (counts[p.position] !== undefined) counts[p.position]++; });
    return counts;
  }, [roster]);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const capLabel = currentTier === 1 ? 'cap' : 'limit';

  return (
    <div style={{
      maxWidth: 'var(--content-max)',
      margin: '0 auto',
      padding: 'var(--space-6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
      }}>
        <h2 style={{
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--weight-bold)',
          margin: 0,
        }}>
          Roster
        </h2>
        <Button variant="secondary" size="sm"
          onClick={() => window.openRosterManagementHub?.()}>
          Open Full Manager →
        </Button>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 'var(--space-3)',
      }}>
        <SummaryCard label="Players" value={roster.length} sub="12 min / 15 max" />
        <SummaryCard label="Cap Space"
          value={formatCurrency(remainingCap)}
          sub={`of ${formatCurrency(effCap)} ${capLabel}`}
          valueColor={remainingCap > 0 ? 'var(--color-win)' : 'var(--color-loss)'} />
        <SummaryCard label="Payroll" value={formatCurrency(totalSalary)}
          valueColor={isOverCap ? 'var(--color-loss)' : 'var(--color-text)'} />
        <SummaryCard label="Chemistry" value={`${Math.round(chemistry)}%`}
          valueColor={chemistry >= 70 ? 'var(--color-win)' : chemistry >= 40 ? 'var(--color-warning)' : 'var(--color-loss)'} />
        <SummaryCard label="Positions"
          value={<PositionBar counts={posCounts} />}
          sub="" />
      </div>

      {/* Roster Table */}
      <Card padding="none" className="animate-fade-in">
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--text-base)',
          }}>
            <thead>
              <tr style={{
                borderBottom: '2px solid var(--color-border)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                <SortTh label="Player" col="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="left" />
                <SortTh label="Pos" col="position" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} width={50} />
                <SortTh label="Age" col="age" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} width={50} />
                <SortTh label="OVR" col="rating" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} width={80} />
                <SortTh label="OFF" col="offRating" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} width={56} />
                <SortTh label="DEF" col="defRating" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} width={56} />
                <SortTh label="Salary" col="salary" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} width={90} />
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, width: 56 }}>Yrs</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, width: 100 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedRoster.map((player, i) => (
                <PlayerRow key={player.id || i} player={player} engines={engines} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Player Row
   ═══════════════════════════════════════════════════════════════ */
function PlayerRow({ player, engines }) {
  const { PlayerAttributes: PA } = engines;

  const contractYears = player.contractYears || 1;
  const hasInjury = player.injuryStatus === 'out' || player.injuryStatus === 'day-to-day';
  const fatigue = player.fatigue || 0;

  // Measurables
  const m = player.measurables;
  const measStr = m && PA?.formatHeight
    ? `${PA.formatHeight(m.height)} · ${m.weight}lbs`
    : '';

  return (
    <tr style={{
      borderBottom: '1px solid var(--color-border-subtle)',
      transition: 'background var(--duration-fast) ease',
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 'var(--weight-semi)' }}>
            {player.name}
          </span>
          {measStr && (
            <span style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-tertiary)',
            }}>
              {measStr}
            </span>
          )}
        </div>
      </td>
      <td style={{
        padding: '10px 12px',
        textAlign: 'center',
        fontWeight: 'var(--weight-semi)',
        fontSize: 'var(--text-sm)',
      }}>
        {player.position || '—'}
      </td>
      <td style={{
        padding: '10px 12px',
        textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 'var(--text-sm)',
      }}>
        {player.age || '—'}
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
        <RatingBadge
          rating={player.rating}
          offRating={player.offRating}
          defRating={player.defRating}
        />
      </td>
      <td style={{
        padding: '10px 12px',
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-sm)',
        color: ratingColor(player.offRating),
      }}>
        {player.offRating ? Math.round(player.offRating) : '—'}
      </td>
      <td style={{
        padding: '10px 12px',
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-sm)',
        color: ratingColor(player.defRating),
      }}>
        {player.defRating ? Math.round(player.defRating) : '—'}
      </td>
      <td style={{
        padding: '10px 12px',
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-sm)',
      }}>
        {formatCurrency(player.salary || 0)}
      </td>
      <td style={{
        padding: '10px 12px',
        textAlign: 'center',
        fontSize: 'var(--text-sm)',
      }}>
        <span style={{
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-semi)',
          background: contractYears === 1 ? 'var(--color-warning-bg)' : 'var(--color-win-bg)',
          color: contractYears === 1 ? 'var(--color-warning)' : 'var(--color-win)',
        }}>
          {contractYears}yr{contractYears > 1 ? 's' : ''}
        </span>
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'center', flexWrap: 'wrap' }}>
          {player.injuryStatus === 'out' && (
            <Badge variant="loss">
              OUT {player.injury?.gamesRemaining ? `(${player.injury.gamesRemaining}g)` : ''}
            </Badge>
          )}
          {player.injuryStatus === 'day-to-day' && (
            <Badge variant="warning">DTD</Badge>
          )}
          {fatigue >= 60 && !hasInjury && (
            <Badge variant="warning">{Math.round(fatigue)}% fatigue</Badge>
          )}
          {!hasInjury && fatigue < 60 && (
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
              Healthy
            </span>
          )}
          {player.relegationRelease && (
            <Badge variant="info">Release</Badge>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Summary Card
   ═══════════════════════════════════════════════════════════════ */
function SummaryCard({ label, value, sub, valueColor }) {
  return (
    <Card padding="sm">
      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)',
        fontWeight: 'var(--weight-medium)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: 'var(--space-1)',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: typeof value === 'string' ? 'var(--text-lg)' : undefined,
        fontWeight: 'var(--weight-bold)',
        color: valueColor || 'var(--color-text)',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 'var(--leading-tight)',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)',
          marginTop: 2,
        }}>
          {sub}
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Position Bar
   ═══════════════════════════════════════════════════════════════ */
function PositionBar({ counts }) {
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      {positions.map(pos => (
        <div key={pos} style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-tertiary)',
            marginBottom: 1,
          }}>
            {pos}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-bold)',
            color: (counts[pos] || 0) === 0 ? 'var(--color-loss)' :
                   (counts[pos] || 0) >= 3 ? 'var(--color-win)' :
                   'var(--color-text)',
          }}>
            {counts[pos] || 0}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sortable Table Header
   ═══════════════════════════════════════════════════════════════ */
function SortTh({ label, col, sortBy, sortDir, onSort, width, align = 'center' }) {
  const isActive = sortBy === col;
  const arrow = isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: '10px 12px',
        textAlign: align,
        fontWeight: 600,
        width,
        cursor: 'pointer',
        userSelect: 'none',
        color: isActive ? 'var(--color-accent)' : undefined,
        transition: 'color var(--duration-fast) ease',
      }}
    >
      {label}{arrow}
    </th>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
function ratingColor(r) {
  if (!r) return 'var(--color-text-tertiary)';
  if (r >= 85) return 'var(--color-rating-elite)';
  if (r >= 78) return 'var(--color-rating-good)';
  if (r >= 70) return 'var(--color-rating-avg)';
  if (r >= 60) return 'var(--color-rating-below)';
  return 'var(--color-rating-poor)';
}

function formatCurrency(amount) {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return '$' + Math.round(amount / 1000) + 'K';
  return '$' + amount;
}
