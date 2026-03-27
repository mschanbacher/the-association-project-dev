import React, { useState, useMemo } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card, CardHeader } from '../components/Card.jsx';
import { Badge, RatingBadge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';
import { Sparkline, SparklineGrid } from '../visualizations/SparklineComponents.jsx';
import {
  HEX_AXES, hexComponentsFromAnalytics, hexComponentsFromProfile,
  hexNorm, hexPerfColor, HexChart, HexAxisTooltip, HexBreakdown,
  SectionLabel, Tooltip, ratingColor,
  PERCENTILE_STATS, MIN_GAMES_PERCENTILE, computePercentile, pctBarColor,
  LeaguePercentileSection, PlayerStatGrid, AttrBars,
} from '../visualizations/PlayerVisuals.jsx';
export function RosterScreen({ complianceData }) {
  const { gameState, engines, isReady, refresh } = useGame();
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

  // ── Team Scoring Flow ──────────────────────────────────────────────────────
  const [showScoringAst, setShowScoringAst] = useState(false);

  const scoringRoster = useMemo(() => {
    return (userTeam.roster || [])
      .filter(p => p.seasonStats?.gamesPlayed > 0 && p.seasonStats?.points > 0)
      .sort((a, b) => (b.seasonStats?.points || 0) - (a.seasonStats?.points || 0));
  }, [roster]);

  const teamTotalPts  = scoringRoster.reduce((s, p) => s + (p.seasonStats?.points  || 0), 0);
  const teamTotalAst  = scoringRoster.reduce((s, p) => s + (p.seasonStats?.assists || 0), 0);
  const hasScoringData = scoringRoster.length >= 2 && teamTotalPts > 0;
  const teamTwoPts    = scoringRoster.reduce((s, p) => s + ((p.seasonStats?.fieldGoalsMade || 0) - (p.seasonStats?.threePointersMade || 0)) * 2, 0);
  const teamThreePts  = scoringRoster.reduce((s, p) => s + (p.seasonStats?.threePointersMade || 0) * 3, 0);
  const teamFTPts     = scoringRoster.reduce((s, p) => s + (p.seasonStats?.freeThrowsMade || 0), 0);
  const topScorer     = scoringRoster[0];
  const topScorerShare = topScorer ? (topScorer.seasonStats.points / teamTotalPts) : 0;
  const loadLabel  = topScorerShare >= 0.28 ? 'Star-Heavy' : topScorerShare >= 0.20 ? 'Moderate' : 'Balanced';
  const loadColor  = topScorerShare >= 0.28 ? 'var(--color-loss)' : topScorerShare >= 0.20 ? 'var(--color-warning)' : 'var(--color-win)';

  return (
    <div style={{
      maxWidth: 'var(--content-max)',
      margin: '0 auto',
      padding: 'var(--space-6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)',
    }}>
      {/* Compliance Warning Banner */}
      {complianceData && (complianceData.isOverCap || complianceData.isUnderMinimum || complianceData.isOverMaximum) && (
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--color-loss-bg, rgba(220, 38, 38, 0.1))',
          border: '1px solid var(--color-loss)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}>
          <div style={{
            fontWeight: 'var(--weight-semi)',
            color: 'var(--color-loss)',
            fontSize: 'var(--text-base)',
          }}>
            Roster Compliance Required
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}>
            {complianceData.isOverCap && (
              <div>Your payroll ({complianceData.formatCurrency?.(complianceData.totalSalary) || `$${(complianceData.totalSalary/1e6).toFixed(1)}M`}) exceeds the {complianceData.tier === 1 ? 'salary cap' : 'spending limit'} ({complianceData.formatCurrency?.(complianceData.salaryCap) || `$${(complianceData.salaryCap/1e6).toFixed(1)}M`}). Release players to get under the cap.</div>
            )}
            {complianceData.isUnderMinimum && (
              <div>Your roster has only {complianceData.rosterSize} players. You need at least 12 to start the season. Sign free agents to fill your roster.</div>
            )}
            {complianceData.isOverMaximum && (
              <div>Your roster has {complianceData.rosterSize} players. The maximum is 15. Release players to comply.</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button variant="secondary" size="sm" onClick={() => window._reactOpenFreeAgentBrowse?.()}>
              Browse Free Agents
            </Button>
            <Button variant="primary" size="sm" onClick={() => {
              // Re-check compliance
              window._offseasonController?.checkRosterComplianceAndContinue?.();
            }}>
              Check Compliance
            </Button>
          </div>
        </div>
      )}
      
      {/* Compliance Success Banner - show when compliant and in compliance check mode */}
      {complianceData && !complianceData.isOverCap && !complianceData.isUnderMinimum && !complianceData.isOverMaximum && (
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--color-win-bg, rgba(34, 197, 94, 0.1))',
          border: '1px solid var(--color-win)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontWeight: 'var(--weight-semi)',
              color: 'var(--color-win)',
              fontSize: 'var(--text-base)',
            }}>
              Roster Compliant
            </div>
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)',
            }}>
              Your roster meets all requirements. Ready to start the season.
            </div>
          </div>
          <Button variant="primary" onClick={() => {
            window._offseasonController?.continueToSeasonSetup?.();
          }}>
            Start Season
          </Button>
        </div>
      )}

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
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="secondary" size="sm"
            onClick={() => window._reactOpenFreeAgentBrowse?.()}>
            Free Agents
          </Button>
          <Button variant="secondary" size="sm"
            onClick={() => window._reactOpenTradeBrowse?.()}>
            Trade
          </Button>
        </div>
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

      {/* Team Scoring Flow */}
      {hasScoringData && (
        <Card padding="none">
          {/* Card header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid var(--color-border-subtle)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
                color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Scoring Flow
              </span>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { label: '3PT', color: 'var(--color-zone-three)' },
                  { label: '2PT', color: 'var(--color-zone-rim)'   },
                  { label: 'FT',  color: 'var(--color-zone-mid)'   },
                  ...(showScoringAst ? [{ label: 'AST', color: 'var(--color-warning)' }] : []),
                ].map(({ label, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 7, height: 7, background: color, opacity: 0.8 }} />
                    <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{label}</span>
                  </div>
                ))}
              </div>
              {/* Load balance badge */}
              <span style={{
                fontSize: 9, fontWeight: 700, color: loadColor,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                border: `1px solid ${loadColor}`, padding: '1px 5px', opacity: 0.85,
              }}>
                {loadLabel}
              </span>
            </div>
            {/* Assists toggle */}
            <button
              onClick={() => setShowScoringAst(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 8px',
                border: `1px solid ${showScoringAst ? 'var(--color-warning)' : 'var(--color-border)'}`,
                background: showScoringAst ? 'var(--color-warning-bg)' : 'transparent',
                cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
            >
              <div style={{ width: 5, height: 5, background: showScoringAst ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }} />
              <span style={{
                fontSize: 9, fontWeight: 600,
                color: showScoringAst ? 'var(--color-warning)' : 'var(--color-text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                Assists
              </span>
            </button>
          </div>

          <div style={{ padding: '10px 16px 14px' }}>
            {/* Team summary bar */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
                Team mix · {teamTotalPts} pts this season
              </div>
              <div style={{ display: 'flex', height: 14, overflow: 'hidden', gap: 1 }}>
                {[
                  { color: 'var(--color-zone-three)', pts: teamThreePts },
                  { color: 'var(--color-zone-rim)',   pts: teamTwoPts   },
                  { color: 'var(--color-zone-mid)',   pts: teamFTPts    },
                ].map(({ color, pts }, i) => (
                  <div key={i} style={{
                    height: '100%',
                    width: `${(pts / teamTotalPts * 100).toFixed(1)}%`,
                    background: color, opacity: 0.75,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)',
                  }}>
                    {(pts / teamTotalPts * 100) >= 12 ? `${(pts / teamTotalPts * 100).toFixed(0)}%` : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Per-player rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '120px 1fr 44px 44px',
                gap: 0, marginBottom: 3,
                fontSize: 9, color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                <div>Player</div>
                <div style={{ paddingLeft: 6 }}>Scoring composition  <span style={{ opacity: 0.5 }}>← bar width = share of team pts</span></div>
                <div style={{ textAlign: 'right' }}>PPG</div>
                <div style={{ textAlign: 'right' }}>Share</div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                {scoringRoster.map((p, i) => {
                  const ss       = p.seasonStats;
                  const gp       = ss.gamesPlayed;
                  const twoMade  = (ss.fieldGoalsMade || 0) - (ss.threePointersMade || 0);
                  const twoPts   = twoMade * 2;
                  const threePts = (ss.threePointersMade || 0) * 3;
                  const ftPts    = ss.freeThrowsMade || 0;
                  const ptsShare = ss.points / teamTotalPts;
                  const astShare = teamTotalAst > 0 ? (ss.assists || 0) / teamTotalAst : 0;
                  const ppg      = (ss.points / gp).toFixed(1);
                  const shareColor = ptsShare >= 0.20 ? 'var(--color-accent)'
                    : ptsShare >= 0.12 ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)';

                  return (
                    <div key={p.id || i} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <div style={{
                        display: 'grid', gridTemplateColumns: '120px 1fr 44px 44px',
                        gap: 0, alignItems: 'center', padding: '6px 0',
                      }}>
                        {/* Name + pos */}
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>
                            {p.position} · {gp}G
                          </div>
                        </div>

                        {/* Stacked scoring bar */}
                        <div style={{ paddingLeft: 6, paddingRight: 8 }}>
                          {/* Scoring bar — width = ptsShare of max player's share */}
                          <div style={{
                            position: 'relative', height: 18,
                            width: `${(ptsShare / topScorerShare * 100).toFixed(1)}%`,
                            display: 'flex', overflow: 'hidden',
                          }}>
                            {[
                              { color: 'var(--color-zone-three)', pts: threePts },
                              { color: 'var(--color-zone-rim)',   pts: twoPts   },
                              { color: 'var(--color-zone-mid)',   pts: ftPts    },
                            ].map(({ color, pts }, j) => (
                              <div key={j} style={{
                                height: '100%',
                                width: `${(pts / ss.points * 100).toFixed(1)}%`,
                                background: color, opacity: 0.8, flexShrink: 0,
                              }} />
                            ))}
                          </div>
                          {/* Assists underbar */}
                          {showScoringAst && teamTotalAst > 0 && (
                            <div style={{
                              marginTop: 2, height: 4,
                              width: `${(astShare / (scoringRoster[0] ? scoringRoster.reduce((m, q) => Math.max(m, (q.seasonStats?.assists||0)/teamTotalAst), 0) : 1) * ptsShare / topScorerShare * 100).toFixed(1)}%`,
                              background: 'var(--color-warning)', opacity: 0.7,
                            }} />
                          )}
                        </div>

                        {/* PPG */}
                        <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700,
                          fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                          {ppg}
                        </div>

                        {/* Share */}
                        <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 600,
                          fontFamily: 'var(--font-mono)', color: shareColor }}>
                          {(ptsShare * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

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
                <PlayerRow key={player.id || i} player={player} engines={engines} team={userTeam}
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
function PlayerRow({ player, engines, expanded, onToggle, team }) {
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
          {player.onLoan && (
            <Badge variant="info">LOAN</Badge>
          )}
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
          {!hasInjury && fatigue < 60 && !player.onLoan && (
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
    {expanded && <PlayerDetailRow player={player} engines={engines} team={team} />}
    </>
  );
}

function PlayerDetailRow({ player, engines, team }) {
  const { PlayerAttributes: PA, StatEngine } = engines;
  const { gameState } = useGame();
  const m = player.measurables;
  const attrs = player.attributes || {};
  const [hoveredAxis, setHoveredAxis] = useState(null);
  const [pctFilterPos, setPctFilterPos] = useState(false);

  const measStr = m && PA?.formatHeight
    ? `${PA.formatHeight(m.height)} · ${m.weight}lbs · ${PA.formatWingspan ? PA.formatWingspan(m.wingspan) : m.wingspan + '"'} WS`
    : '';

  // Pass team context so contractVerdict uses current tier (not birth tier)
  const analytics = StatEngine?.getPlayerAnalytics?.(player, team || null) || null;
  const avgs = analytics?.avgs || null;
  const hasStats = avgs && avgs.gamesPlayed > 0;

  // ── Percentile pool — all eligible players in the user's current tier ──
  const { tierPool, tierPoolByPos } = useMemo(() => {
    const tierKey = `tier${gameState?.currentTier || 1}Teams`;
    const tierTeams = gameState?.[tierKey] || [];
    const pool = [];
    tierTeams.forEach(t => {
      (t.roster || []).forEach(p => {
        if (!p.seasonStats || p.seasonStats.gamesPlayed < MIN_GAMES_PERCENTILE) return;
        const a = StatEngine?.getSeasonAverages?.(p);
        if (a) pool.push({ pos: p.position || p.pos, avgs: a });
      });
    });
    const byPos = {};
    pool.forEach(p => {
      if (!byPos[p.pos]) byPos[p.pos] = [];
      byPos[p.pos].push(p);
    });
    return { tierPool: pool, tierPoolByPos: byPos };
  }, [gameState, StatEngine]);

  const pmColor = (v) =>
    v > 0 ? 'var(--color-win)' : v < 0 ? 'var(--color-loss)' : 'var(--color-text-tertiary)';

  const pct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—';
  const stat = (v, decimals = 1) => v != null ? v.toFixed(decimals) : '—';
  const pm = (v) => v == null ? '—' : v > 0 ? `+${v}` : `${v}`;

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

                {/* Shot Zone Efficiency */}
                {(() => {
                  const ss = player.seasonStats;
                  const hasGames = ss && ss.gamesPlayed > 0 && ss.fieldGoalsAttempted > 0;

                  // League-average FG% benchmarks per zone
                  const LEAGUE_AVG = { rim: 0.58, mid: 0.42, three: 0.36 };

                  // Zone color tokens — defined in design-system.css
                  const ZONE_COLOR = {
                    rim:   'var(--color-zone-rim)',
                    mid:   'var(--color-zone-mid)',
                    three: 'var(--color-zone-three)',
                  };

                  // Efficiency tier → color
                  const tierColor = (pct, zone) => {
                    const d = pct - LEAGUE_AVG[zone];
                    if (d >=  0.07) return 'var(--color-rating-elite)';
                    if (d >=  0.02) return 'var(--color-win)';
                    if (d >= -0.03) return 'var(--color-text-secondary)';
                    return 'var(--color-loss)';
                  };
                  const tierLabel = (pct, zone) => {
                    const d = pct - LEAGUE_AVG[zone];
                    if (d >=  0.07) return 'Elite';
                    if (d >=  0.02) return 'Good';
                    if (d >= -0.03) return 'Avg';
                    return 'Poor';
                  };

                  // Derive per-zone data from seasonStats + profile shape
                  let zones = null;
                  if (hasGames) {
                    const { fieldGoalsAttempted: fga, fieldGoalsMade: fgm,
                            threePointersAttempted: threePA, threePointersMade: threePM } = ss;
                    const twoPA = fga - threePA;
                    const twoPM = fgm - threePM;
                    // Split 2PA into rim/mid using profile proportions
                    const twoTotal = (shape.rim || 0) + (shape.midrange || 0);
                    const rimShare = twoTotal > 0 ? (shape.rim || 0) / twoTotal : 0.6;
                    const rimPA = Math.round(twoPA * rimShare);
                    const midPA = twoPA - rimPA;
                    // Estimate zone FG%: overall 2pt% ±offset by zone tendency
                    const twoPct = twoPA > 0 ? twoPM / twoPA : 0;
                    const rimPct2 = Math.min(0.72, twoPct + 0.06);
                    const rimPM2 = Math.round(rimPA * rimPct2);
                    const midPM2 = twoPM - rimPM2;
                    const midPct2 = midPA > 0 ? midPM2 / midPA : 0;
                    const threePct2 = threePA > 0 ? threePM / threePA : 0;
                    zones = {
                      rim:   { pa: rimPA,   pct: rimPct2,  share: rimPA  / fga, profileShare: shape.rim      || 0 },
                      mid:   { pa: midPA,   pct: midPct2,  share: midPA  / fga, profileShare: shape.midrange || 0 },
                      three: { pa: threePA, pct: threePct2, share: threePA / fga, profileShare: shape.three   || 0 },
                      fga,
                    };
                  }

                  // Profile-only shares (pre-season fallback)
                  const profileShares = {
                    rim:   shape.rim      || 0,
                    mid:   shape.midrange || 0,
                    three: shape.three    || 0,
                  };

                  const ZONE_DEFS = [
                    { key: 'rim',   label: 'At Rim',   leagueAvgShare: 0.30 },
                    { key: 'mid',   label: 'Midrange',  leagueAvgShare: 0.22 },
                    { key: 'three', label: '3-Point',   leagueAvgShare: 0.32 },
                  ];

                  return (
                    <div>
                      {/* Column headers */}
                      <div style={{ display: 'grid', gridTemplateColumns: '62px 1fr 38px 46px 38px', gap: 0, marginBottom: 4 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Shot Zones
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', paddingLeft: 8 }}>
                          {hasGames ? 'actual share  ░ = target' : 'profile target'}
                        </div>
                        {hasGames && <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Att</div>}
                        {hasGames && <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>FG%</div>}
                        {hasGames && <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tier</div>}
                      </div>

                      <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                        {ZONE_DEFS.map(({ key, label, leagueAvgShare }, idx) => {
                          const color = ZONE_COLOR[key];
                          const profShare = profileShares[key];
                          const z = zones?.[key];
                          const actualShare = z?.share ?? 0;

                          return (
                            <div key={key}>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: hasGames ? '62px 1fr 38px 46px 38px' : '62px 1fr',
                                gap: 0, alignItems: 'center', padding: '7px 0',
                              }}>
                                {/* Zone label */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <div style={{ width: 7, height: 7, background: color, flexShrink: 0 }} />
                                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.02em' }}>
                                    {label}
                                  </span>
                                </div>

                                {/* Bar — ghost (profile target) behind actual */}
                                <div style={{ position: 'relative', height: 18, marginLeft: 8, marginRight: 6 }}>
                                  {/* Profile ghost */}
                                  <div style={{
                                    position: 'absolute', top: 0, left: 0, height: '100%',
                                    width: `${(profShare * 100).toFixed(1)}%`,
                                    background: color, opacity: 0.18,
                                  }} />
                                  {/* Actual bar (only if has games) */}
                                  {hasGames && (
                                    <div style={{
                                      position: 'absolute', top: 2, left: 0, height: 'calc(100% - 4px)',
                                      width: `${(actualShare * 100).toFixed(1)}%`,
                                      background: color, opacity: 0.75,
                                    }} />
                                  )}
                                  {/* League avg share tick */}
                                  <div style={{
                                    position: 'absolute', top: 0, left: `${leagueAvgShare * 100}%`,
                                    width: 1, height: '100%', background: 'var(--color-border)',
                                  }} />
                                  {/* Share label */}
                                  <div style={{
                                    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                                    left: `calc(${((hasGames ? actualShare : profShare) * 100).toFixed(1)}% + 4px)`,
                                    fontSize: 9, fontFamily: 'var(--font-mono)',
                                    color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap',
                                  }}>
                                    {((hasGames ? actualShare : profShare) * 100).toFixed(0)}%
                                  </div>
                                </div>

                                {/* Attempts */}
                                {hasGames && (
                                  <div style={{ textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
                                    {z?.pa ?? 0}
                                  </div>
                                )}

                                {/* FG% */}
                                {hasGames && (
                                  <div style={{ textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: tierColor(z?.pct ?? 0, key) }}>
                                    {((z?.pct ?? 0) * 100).toFixed(1)}%
                                  </div>
                                )}

                                {/* Tier label */}
                                {hasGames && (
                                  <div style={{ textAlign: 'right', fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)', color: tierColor(z?.pct ?? 0, key) }}>
                                    {tierLabel(z?.pct ?? 0, key)}
                                  </div>
                                )}
                              </div>
                              {idx < 2 && <div style={{ height: 1, background: 'var(--color-border-subtle)' }} />}
                            </div>
                          );
                        })}
                      </div>

                      {/* Pre-season note / eFG summary */}
                      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {!hasGames ? (
                          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                            Profile target — live FG% updates once games are played
                          </span>
                        ) : (
                          <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>
                            ░ = profile target  ·  <span style={{ opacity: 0.7 }}>│</span> = league avg share
                          </span>
                        )}
                        {hasGames && (() => {
                          const { fieldGoalsAttempted: fga, fieldGoalsMade: fgm, threePointersMade: tpm } = ss;
                          const efg = fga > 0 ? (fgm + 0.5 * tpm) / fga : 0;
                          const efgColor = efg >= 0.56 ? 'var(--color-rating-elite)' : efg >= 0.52 ? 'var(--color-win)' : efg >= 0.48 ? 'var(--color-text-secondary)' : 'var(--color-loss)';
                          return (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                              <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>eFG%</span>
                              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: efgColor }}>
                                {(efg * 100).toFixed(1)}%
              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ── Player Profile Hexagon ── */}
          {(() => {
            const avgs = analytics?.avgs || null;
            const components = hexComponentsFromAnalytics(analytics, avgs)
              ?? hexComponentsFromProfile(player);
            if (!components) return null;
            const isProjection = components.isProjection;
            const total = Math.max(0,
              HEX_AXES.reduce((sum, ax) => sum + Math.max(0, components[ax.key] || 0), 0));
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <SectionLabel style={{ marginBottom: 0 }}>Player Profile</SectionLabel>
                  {isProjection && (
                    <span style={{
                      fontSize: 9, fontWeight: 600, color: 'var(--color-warning)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      border: '1px solid var(--color-warning)',
                      padding: '1px 5px',
                    }}>
                      Pre-Season Projection
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Hex + tooltip */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <HexChart
                      components={components}
                      size={180}
                      hoveredAxis={hoveredAxis}
                      onHoverAxis={setHoveredAxis}
                    />
                    {/* Tooltip — anchored to right of chart */}
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 188,
                      opacity: hoveredAxis !== null ? 1 : 0,
                      pointerEvents: 'none',
                      zIndex: 10,
                      transition: 'opacity 100ms',
                    }}>
                      <HexAxisTooltip
                        axis={hoveredAxis !== null ? HEX_AXES[hoveredAxis] : null}
                        components={components}
                      />
                    </div>
                  </div>
                  {/* Breakdown bars */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <HexBreakdown
                      components={components}
                      hoveredAxis={hoveredAxis}
                      onHoverAxis={setHoveredAxis}
                    />
                    {/* Value score callout */}
                    <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{
                        fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        color: total >= 60 ? 'var(--color-rating-elite)'
                          : total >= 40 ? 'var(--color-rating-good)'
                          : total >= 25 ? 'var(--color-rating-avg)'
                          : 'var(--color-rating-poor)',
                        lineHeight: 1,
                      }}>{total}</span>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)',
                          textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Value Score
                        </div>
                        {analytics?.role && (
                          <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                            {analytics.role}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── League Percentiles ── */}
          {hasStats && tierPool.length >= 5 && (() => {
            const playerPos  = player.position || player.pos || '';
            const activePool = pctFilterPos ? (tierPoolByPos[playerPos] || tierPool) : tierPool;
            const n          = activePool.length;

            return (
              <div>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <SectionLabel style={{ marginBottom: 0 }}>League Percentiles</SectionLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>
                      vs {n} {pctFilterPos ? `${playerPos}s` : 'players'} · T{gameState?.currentTier} · min {MIN_GAMES_PERCENTILE}GP
                    </span>
                    {/* Position filter toggle */}
                    <button
                      onClick={() => setPctFilterPos(f => !f)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 7px',
                        border: `1px solid ${pctFilterPos ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        background: pctFilterPos ? 'var(--color-accent-bg)' : 'transparent',
                        cursor: 'pointer', fontFamily: 'var(--font-body)',
                      }}
                    >
                      <div style={{
                        width: 5, height: 5,
                        background: pctFilterPos ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                      }} />
                      <span style={{
                        fontSize: 9, fontWeight: 600,
                        color: pctFilterPos ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {playerPos} only
                      </span>
                    </button>
                  </div>
                </div>

                {/* Column labels */}
                <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 48px 62px', gap: 0, marginBottom: 2 }}>
                  <div />
                  <div style={{ position: 'relative', height: 12, marginLeft: 6, marginRight: 8 }}>
                    <span style={{
                      position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                      fontSize: 8, color: 'var(--color-text-tertiary)',
                    }}>50th</span>
                    <span style={{
                      position: 'absolute', left: '75%', transform: 'translateX(-50%)',
                      fontSize: 8, color: 'var(--color-text-tertiary)', opacity: 0.6,
                    }}>75th</span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stat</div>
                  <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rank</div>
                </div>

                {/* Stat rows */}
                <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  {PERCENTILE_STATS.map((stat, i) => {
                    const playerVal = avgs[stat.key];
                    if (playerVal == null) return null;
                    const poolVals = activePool.map(p => p.avgs[stat.key]).filter(v => v != null);
                    if (poolVals.length === 0) return null;
                    const pct  = computePercentile(playerVal, poolVals);
                    const rank = Math.round((1 - pct) * n) + 1;
                    const color = pctBarColor(pct);
                    return (
                      <div key={stat.key}>
                        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 48px 62px', gap: 0, alignItems: 'center', padding: '6px 0' }}>
                          {/* Label */}
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {stat.label}
                          </div>
                          {/* Bar */}
                          <div style={{ position: 'relative', height: 14, marginLeft: 6, marginRight: 8, background: 'var(--color-bg-sunken)', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${(pct * 100).toFixed(1)}%`, background: color, opacity: 0.75 }} />
                            {/* 50th tick */}
                            <div style={{ position: 'absolute', top: 0, left: '50%', width: 1, height: '100%', background: 'var(--color-border)' }} />
                            {/* 75th tick */}
                            <div style={{ position: 'absolute', top: 0, left: '75%', width: 1, height: '100%', background: 'var(--color-border)', opacity: 0.5 }} />
                          </div>
                          {/* Value */}
                          <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>
                            {stat.fmt(playerVal)}
                          </div>
                          {/* Rank */}
                          <div style={{ textAlign: 'right', fontSize: 9, fontFamily: 'var(--font-mono)' }}>
                            <span style={{ fontWeight: 600, color }}>#{rank}</span>
                            <span style={{ color: 'var(--color-text-tertiary)' }}> / {n}</span>
                          </div>
                        </div>
                        {i < PERCENTILE_STATS.length - 1 && (
                          <div style={{ height: 1, background: 'var(--color-border-subtle)' }} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                  {[
                    { color: 'var(--color-rating-elite)', label: 'Top 10%'     },
                    { color: 'var(--color-rating-good)',  label: 'Top 25%'     },
                    { color: 'var(--color-rating-avg)',   label: 'Middle 50%'  },
                    { color: 'var(--color-rating-poor)',  label: 'Bottom 25%'  },
                  ].map(({ color, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 7, height: 7, background: color, opacity: 0.75 }} />
                      <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Season Arc Sparklines ── */}
          {player.gameLog && player.gameLog.length >= 3 && (
            <div>
              <SectionLabel>Season Arc</SectionLabel>
              <SparklineGrid gameLog={player.gameLog} />
            </div>
          )}

          {/* ── Attributes ── */}
          <AttrBars attributes={player.attributes} />

          {/* ── Release Player Action ── */}
          {team && (() => {
            const rosterSize = team.roster?.length || 0;
            const totalSalary = team.roster?.reduce((sum, p) => sum + (p.salary || 0), 0) || 0;
            const salaryCap = window.SalaryCapEngine?.getEffectiveCap?.(team) || 0;
            const isOverCap = totalSalary > salaryCap;
            const canRelease = rosterSize > 12 || isOverCap;
            
            return (
              <div style={{ 
                marginTop: 20, 
                paddingTop: 16, 
                borderTop: '1px solid var(--color-border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!canRelease) return;
                    if (window.confirm(`Release ${player.name} from roster?`)) {
                      window.dropPlayer?.(player.id);
                    }
                  }}
                  disabled={!canRelease}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: `1px solid ${canRelease ? 'var(--color-loss)' : 'var(--color-border)'}`,
                    color: canRelease ? 'var(--color-loss)' : 'var(--color-text-tertiary)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 'var(--weight-semi)',
                    cursor: canRelease ? 'pointer' : 'not-allowed',
                    opacity: canRelease ? 1 : 0.5,
                  }}
                >
                  Release Player
                </button>
              </div>
            );
          })()}

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

function formatCurrency(amount) {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return '$' + Math.round(amount / 1000) + 'K';
  return '$' + amount;
}
