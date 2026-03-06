import React, { useState, useMemo } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card, CardHeader } from '../components/Card.jsx';
import { Badge, RatingBadge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';

export function RosterScreen() {
  const { gameState, engines, isReady } = useGame();
  const [sortBy, setSortBy] = useState('rating');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedPlayer, setExpandedPlayer] = useState(null);

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
        case 'pts': aVal = a.seasonStats?.points / Math.max(1, a.seasonStats?.gamesPlayed) || 0; bVal = b.seasonStats?.points / Math.max(1, b.seasonStats?.gamesPlayed) || 0; break;
        case 'reb': aVal = a.seasonStats?.rebounds / Math.max(1, a.seasonStats?.gamesPlayed) || 0; bVal = b.seasonStats?.rebounds / Math.max(1, b.seasonStats?.gamesPlayed) || 0; break;
        case 'ast': aVal = a.seasonStats?.assists / Math.max(1, a.seasonStats?.gamesPlayed) || 0; bVal = b.seasonStats?.assists / Math.max(1, b.seasonStats?.gamesPlayed) || 0; break;
        case 'pm': aVal = a.seasonStats?.plusMinus || 0; bVal = b.seasonStats?.plusMinus || 0; break;
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
                <SortTh label="PTS" col="pts" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} width={52} />
                <SortTh label="REB" col="reb" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} width={52} />
                <SortTh label="AST" col="ast" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} width={52} />
                <SortTh label="+/-" col="pm" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} width={56} />
                <SortTh label="Salary" col="salary" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} width={90} />
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, width: 56 }}>Yrs</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, width: 100 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedRoster.map((player, i) => (
                <PlayerRow key={player.id || i} player={player} engines={engines}
                  expanded={expandedPlayer === (player.id || i)}
                  onToggle={() => setExpandedPlayer(expandedPlayer === (player.id || i) ? null : (player.id || i))} />
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
function PlayerRow({ player, engines, expanded, onToggle }) {
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
    <><tr onClick={onToggle} style={{
      borderBottom: expanded ? 'none' : '1px solid var(--color-border-subtle)',
      transition: 'background var(--duration-fast) ease',
      cursor: 'pointer',
      background: expanded ? 'var(--color-accent-bg)' : 'transparent',
    }}
    onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
    onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
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
      {/* Season stat columns */}
      {(() => {
        const s = player.seasonStats;
        const gp = s?.gamesPlayed || 0;
        const fmt = (v) => gp > 0 ? (v / gp).toFixed(1) : '—';
        const pmTotal = s?.plusMinus || 0;
        const pmColor = pmTotal > 0 ? 'var(--color-win)' : pmTotal < 0 ? 'var(--color-loss)' : 'var(--color-text-tertiary)';
        return (<>
          <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
            {fmt(s?.points || 0)}
          </td>
          <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
            {fmt(s?.rebounds || 0)}
          </td>
          <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
            {fmt(s?.assists || 0)}
          </td>
          <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600, color: pmColor }}>
            {gp > 0 ? (pmTotal > 0 ? `+${pmTotal}` : `${pmTotal}`) : '—'}
          </td>
        </>);
      })()}
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
    {expanded && <PlayerDetailRow player={player} engines={engines} team={userTeam} />}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Player Detail — Expanded inline panel with full attributes + season stats
   ═══════════════════════════════════════════════════════════════ */
function PlayerDetailRow({ player, engines, team }) {
  const { PlayerAttributes: PA, StatEngine } = engines;
  const m = player.measurables;
  const attrs = player.attributes || {};

  const measStr = m && PA?.formatHeight
    ? `${PA.formatHeight(m.height)} · ${m.weight}lbs · ${PA.formatWingspan ? PA.formatWingspan(m.wingspan) : m.wingspan + '"'} WS`
    : '';

  // Pass team context so contractVerdict uses current tier (not birth tier)
  const analytics = StatEngine?.getPlayerAnalytics?.(player, team || null) || null;
  const avgs = analytics?.avgs || null;
  const hasStats = avgs && avgs.gamesPlayed > 0;

  const attrColor = (v) =>
    v >= 80 ? 'var(--color-rating-elite)' :
    v >= 70 ? 'var(--color-rating-good)' :
    v >= 60 ? 'var(--color-rating-avg)' :
    'var(--color-rating-poor)';

  const pmColor = (v) =>
    v > 0 ? 'var(--color-win)' : v < 0 ? 'var(--color-loss)' : 'var(--color-text-tertiary)';

  const pct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—';
  const stat = (v, decimals = 1) => v != null ? v.toFixed(decimals) : '—';
  const pm = (v) => v == null ? '—' : v > 0 ? `+${v}` : `${v}`;

  const AttrBar = ({ label, value }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', width: 100 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: 'var(--color-bg-sunken)', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${value}%`, background: attrColor(value) }} />
      </div>
      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, width: 24, textAlign: 'right', color: attrColor(value) }}>{value}</span>
    </div>
  );

  const offKeys = [
    { key: 'clutch', label: 'Clutch' },
    { key: 'basketballIQ', label: 'Basketball IQ' },
    { key: 'speed', label: 'Speed' },
  ];
  const defKeys = [
    { key: 'strength', label: 'Strength' },
    { key: 'verticality', label: 'Verticality' },
    { key: 'endurance', label: 'Endurance' },
  ];
  const intKeys = [
    { key: 'workEthic', label: 'Work Ethic' },
    { key: 'coachability', label: 'Coachability' },
    { key: 'collaboration', label: 'Collaboration' },
  ];

  const verdictLabel = {
    great_deal: { label: 'Great Deal', color: 'var(--color-win)' },
    good_value:  { label: 'Good Value', color: 'var(--color-win)' },
    fair:        { label: 'Fair',        color: 'var(--color-text-secondary)' },
    overpaid:    { label: 'Overpaid',    color: 'var(--color-loss)' },
  };
  const flagColors = { warning: 'var(--color-warning)', positive: 'var(--color-win)', info: 'var(--color-accent)' };

  return (
    <tr>
      <td colSpan={13} style={{ padding: 0 }}>
        <div style={{
          padding: '16px 20px 20px',
          background: 'var(--color-accent-bg)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>

          {/* ── Top bar: ratings + measurables + contract ── */}
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color: ratingColor(player.rating), fontFamily: 'var(--font-mono)' }}>{player.rating}</div>
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>OVERALL</div>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{player.offRating || '—'}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>OFF</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{player.defRating || '—'}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>DEF</div>
              </div>
            </div>
            {measStr && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{measStr}</div>}
            {analytics?.role && (
              <div style={{ fontSize: 12, color: 'var(--color-accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {analytics.role}
              </div>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: 'right', fontSize: 12 }}>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                {formatCurrency(player.salary || 0)} · {player.contractYears || 1}yr
              </div>
              {analytics?.contractVerdict && verdictLabel[analytics.contractVerdict] && (
                <div style={{ marginTop: 3, fontWeight: 600, color: verdictLabel[analytics.contractVerdict].color }}>
                  {verdictLabel[analytics.contractVerdict].label}
                </div>
              )}
            </div>
          </div>

          {/* ── Season stats ── */}
          {hasStats ? (
            <div>
              <SectionLabel>This Season — {avgs.gamesPlayed}G · {avgs.minutesPerGame} MPG</SectionLabel>

              {/* Counting stats: aligned grid — per-game row + per-36 row beneath */}
              <div style={{ marginBottom: 16 }}>
                {/* Column headers */}
                {(() => {
                  const COUNTING_TIPS = {
                    PTS: 'Points per game scored.',
                    REB: 'Total rebounds per game\n(offensive + defensive).',
                    AST: 'Assists per game — passes\ndirectly leading to a basket.',
                    STL: 'Steals per game — deflections\nor take-aways on defense.',
                    BLK: 'Blocks per game — shots\nswatted at the rim.',
                    TOV: 'Turnovers per game — times\nthe ball is lost to the opponent.\nLower is better.',
                  };
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(6, 1fr)', marginBottom: 4 }}>
                      <div />
                      {Object.entries(COUNTING_TIPS).map(([col, tip]) => (
                        <div key={col} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <Tooltip text={tip}>{col}</Tooltip>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {/* Per Game row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '64px repeat(6, 1fr)',
                  padding: '6px 0', borderTop: '1px solid var(--color-border-subtle)',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600, alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Per Game</div>
                  {[
                    stat(avgs.pointsPerGame),
                    stat(avgs.reboundsPerGame),
                    stat(avgs.assistsPerGame),
                    stat(avgs.stealsPerGame),
                    stat(avgs.blocksPerGame),
                  ].map((v, i) => (
                    <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{v}</div>
                  ))}
                  <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: avgs.turnoversPerGame > 2.5 ? 'var(--color-warning)' : 'var(--color-text)' }}>
                    {stat(avgs.turnoversPerGame)}
                  </div>
                </div>
                {/* Per 36 row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '64px repeat(6, 1fr)',
                  padding: '6px 0', borderTop: '1px solid var(--color-border-subtle)',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600, alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Per 36</div>
                  {[
                    stat(analytics.per36.points),
                    stat(analytics.per36.rebounds),
                    stat(analytics.per36.assists),
                    stat(analytics.per36.steals),
                    stat(analytics.per36.blocks),
                    stat(analytics.per36.turnovers),
                  ].map((v, i) => (
                    <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{v}</div>
                  ))}
                </div>
              </div>

              {/* Shooting + +/- row */}
              <div style={{ marginBottom: 16 }}>
                {/* Column headers */}
                {(() => {
                  const SHOOTING_TIPS = {
                    'FG%': 'Field Goal % — made field goals\ndivided by attempted.\nIncludes 2s and 3s.',
                    '3P%': '3-Point % — three-pointers made\ndivided by three-pointers attempted.',
                    'FT%': 'Free Throw % — free throws made\ndivided by free throws attempted.',
                    'TS%': 'True Shooting % — overall shooting\nefficiency accounting for 2s, 3s,\nand free throws.\nFormula: PTS ÷ (2 × (FGA + 0.44×FTA))\n55%+ is good, 60%+ is elite.',
                    '+/- /G': 'Plus/Minus per game — average\npoint differential while this\nplayer is on the court.',
                    '+/- TOT': 'Plus/Minus total — cumulative\npoint differential across all\ngames this season.',
                  };
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(6, 1fr)', marginBottom: 4 }}>
                      <div />
                      {Object.entries(SHOOTING_TIPS).map(([col, tip]) => (
                        <div key={col} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <Tooltip text={tip}>{col}</Tooltip>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div style={{
                  display: 'grid', gridTemplateColumns: '64px repeat(6, 1fr)',
                  padding: '6px 0', borderTop: '1px solid var(--color-border-subtle)',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600, alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Season</div>
                  <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{pct(avgs.fieldGoalPct)}</div>
                  <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{pct(avgs.threePointPct)}</div>
                  <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{pct(avgs.freeThrowPct)}</div>
                  <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
                    color: avgs.trueShootingPct >= 0.60 ? 'var(--color-win)' : avgs.trueShootingPct < 0.48 ? 'var(--color-warning)' : 'var(--color-text)',
                  }}>{pct(avgs.trueShootingPct)}</div>
                  <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: pmColor(avgs.plusMinusPerGame) }}>{pm(avgs.plusMinusPerGame)}</div>
                  <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: pmColor(avgs.plusMinus) }}>{pm(avgs.plusMinus)}</div>
                </div>
              </div>

              {/* Flags */}
              {analytics.flags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {analytics.flags.map((f, i) => (
                    <span key={i} style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px',
                      border: `1px solid ${flagColors[f.type]}`,
                      color: flagColors[f.type],
                    }}>
                      {f.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
              No games played this season yet.
            </div>
          )}

          {/* ── Scoring Profile ── */}
          {player.scoringProfile && (() => {
            const sp = player.scoringProfile;
            const shape = sp.shotShape || {};
            const rimPct   = Math.round((shape.rim      || 0) * 100);
            const midPct   = Math.round((shape.midrange  || 0) * 100);
            const threePct = Math.round((shape.three     || 0) * 100);

            // Usage label: how shot-hungry relative to the 0.4–1.8 scale
            const usageLabel =
              sp.usageTendency >= 1.45 ? 'Very High' :
              sp.usageTendency >= 1.15 ? 'High' :
              sp.usageTendency >= 0.85 ? 'Average' :
              sp.usageTendency >= 0.60 ? 'Low' : 'Very Low';

            // Variance label: how streaky
            const varianceLabel =
              sp.variance >= 0.38 ? 'Very Streaky' :
              sp.variance >= 0.28 ? 'Streaky' :
              sp.variance >= 0.18 ? 'Consistent' : 'Very Consistent';

            // Efficiency label
            const effLabel =
              sp.efficiency >= 1.08 ? 'Elite' :
              sp.efficiency >= 1.02 ? 'Above Avg' :
              sp.efficiency >= 0.96 ? 'Average' :
              sp.efficiency >= 0.90 ? 'Below Avg' : 'Poor';

            const effColor =
              sp.efficiency >= 1.08 ? 'var(--color-rating-elite)' :
              sp.efficiency >= 1.02 ? 'var(--color-win)' :
              sp.efficiency >= 0.96 ? 'var(--color-text-secondary)' :
              sp.efficiency >= 0.90 ? 'var(--color-warning)' : 'var(--color-loss)';

            // Usage dot color
            const usageColor =
              sp.usageTendency >= 1.45 ? 'var(--color-loss)' :
              sp.usageTendency >= 1.15 ? 'var(--color-warning)' :
              sp.usageTendency >= 0.85 ? 'var(--color-text-secondary)' : 'var(--color-win)';

            return (
              <div>
                <SectionLabel>Scoring Profile</SectionLabel>

                {/* Archetype badge + meta row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                  {/* Archetype label — primary identity */}
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--color-accent)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {sp.label || sp.archetype}
                  </div>

                  {/* Usage pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usage</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: usageColor, fontFamily: 'var(--font-mono)' }}>{usageLabel}</span>
                  </div>

                  {/* Variance pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Night-to-Night</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{varianceLabel}</span>
                  </div>

                  {/* Efficiency pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Efficiency</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: effColor, fontFamily: 'var(--font-mono)' }}>{effLabel}</span>
                  </div>
                </div>

                {/* Shot shape stacked bar */}
                <div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Shot Distribution
                  </div>

                  {/* The bar */}
                  <div style={{ display: 'flex', height: 20, width: '100%', overflow: 'hidden', gap: 1 }}>
                    {rimPct > 0 && (
                      <div style={{
                        width: `${rimPct}%`, background: 'var(--color-chart-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)',
                        minWidth: rimPct < 8 ? 0 : 'auto', overflow: 'hidden',
                      }}>
                        {rimPct >= 8 ? `${rimPct}%` : ''}
                      </div>
                    )}
                    {midPct > 0 && (
                      <div style={{
                        width: `${midPct}%`, background: 'var(--color-chart-4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)',
                        minWidth: midPct < 8 ? 0 : 'auto', overflow: 'hidden',
                      }}>
                        {midPct >= 8 ? `${midPct}%` : ''}
                      </div>
                    )}
                    {threePct > 0 && (
                      <div style={{
                        flex: 1, background: 'var(--color-chart-1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)',
                      }}>
                        {threePct >= 8 ? `${threePct}%` : ''}
                      </div>
                    )}
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                    {[
                      { label: 'At Rim', pct: rimPct,   color: 'var(--color-chart-2)' },
                      { label: 'Midrange', pct: midPct,  color: 'var(--color-chart-4)' },
                      { label: 'Three',   pct: threePct, color: 'var(--color-chart-1)' },
                    ].map(({ label, pct: p, color }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 8, height: 8, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{p}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Attributes ── */}
          <div>
            <SectionLabel>Attributes</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Offense</div>
                {offKeys.map(({ key, label }) => <AttrBar key={key} label={label} value={attrs[key] || 50} />)}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Defense</div>
                {defKeys.map(({ key, label }) => <AttrBar key={key} label={label} value={attrs[key] || 50} />)}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Intangibles</div>
                {intKeys.map(({ key, label }) => <AttrBar key={key} label={label} value={attrs[key] || 50} />)}
              </div>
            </div>
          </div>

        </div>
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Stat Tooltip
   ═══════════════════════════════════════════════════════════════ */
function Tooltip({ text, children }) {
  const [visible, setVisible] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const ref = React.useRef(null);

  const show = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
    setVisible(true);
  };
  const hide = () => setVisible(false);

  return (
    <>
      <span ref={ref} onMouseEnter={show} onMouseLeave={hide} className="stat-tooltip-trigger">
        {children}
      </span>
      {visible && (
        <div className="stat-tooltip" style={{ top: pos.top, left: pos.left }}>
          {text}
        </div>
      )}
    </>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      marginBottom: 8,
    }}>
      {children}
    </div>
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
