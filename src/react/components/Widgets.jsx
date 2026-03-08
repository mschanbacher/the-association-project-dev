import React, { useMemo, useState, useCallback } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card, CardHeader } from './Card.jsx';
import { Badge, RatingBadge } from './Badge.jsx';
import { HEX_AXES, hexComponentsFromAnalytics, hexComponentsFromProfile, ratingColor } from '../visualizations/PlayerVisuals.jsx';
import { buildTeamLog, TeamFormSparkline } from '../visualizations/SparklineComponents.jsx';

// ── Mini hex thumbnail (dashboard only — no hover, no labels) ────────────────
function MiniHex({ components, size = 56 }) {
  const cx = size / 2, cy = size / 2;
  const maxR = size * 0.38;

  function perfColor(n) {
    if (n >= 0.80) return 'var(--color-rating-elite)';
    if (n >= 0.55) return 'var(--color-rating-good)';
    if (n >= 0.30) return 'var(--color-rating-avg)';
    return 'var(--color-rating-poor)';
  }

  function angle(i) { return (Math.PI * 2 * i) / 6 - Math.PI / 2; }
  function polar(r, i) {
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  }

  const pts = HEX_AXES.map((ax, i) => {
    const n = Math.min(1, Math.max(0, (components?.[ax.key] || 0) / ax.max));
    const [x, y] = polar(n * maxR, i);
    return { x, y, n, color: perfColor(n) };
  });

  const outerPts = HEX_AXES.map((_, i) => polar(maxR, i));

  const dataPath = pts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  ).join(' ') + ' Z';

  const gridPath = outerPts.map(([x, y], i) =>
    `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  ).join(' ') + ' Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <defs>
        {pts.map((p, i) => {
          const j = (i + 1) % 6;
          const q = pts[j];
          return (
            <linearGradient key={i} id={`mhex-${size}-${i}`}
              x1={p.x} y1={p.y} x2={q.x} y2={q.y}
              gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor={p.color} />
              <stop offset="100%" stopColor={q.color} />
            </linearGradient>
          );
        })}
      </defs>
      {/* Outer ring only */}
      <path d={gridPath} fill="none" stroke="var(--color-border-subtle)" strokeWidth={0.75} />
      {/* Data fill */}
      <path d={dataPath} fill="var(--color-accent)" fillOpacity={0.10} />
      {/* Gradient edges */}
      {pts.map((p, i) => {
        const j = (i + 1) % 6;
        const q = pts[j];
        return (
          <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y}
            stroke={`url(#mhex-${size}-${i})`} strokeWidth={1.5} />
        );
      })}
      {/* Endpoint dots */}
      {outerPts.map(([ox, oy], i) => (
        <rect key={i}
          x={ox - 1.5} y={oy - 1.5} width={3} height={3}
          fill={perfColor(pts[i].n)} />
      ))}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Team Summary Widget — metric cards in a 4-column grid
   ═══════════════════════════════════════════════════════════════ */
export function TeamSummaryWidget() {
  const { gameState, engines } = useGame();
  if (!gameState?.userTeam) return null;

  const { userTeam, currentTier, gamesPlayed, totalGames } = gameState;
  const { LeagueManager, SalaryCapEngine, FinanceEngine } = engines;

  const strength = LeagueManager?.calculateTeamStrength?.(userTeam) || 0;
  FinanceEngine?.ensureFinances?.(userTeam);
  const capSpace = SalaryCapEngine?.getRemainingCap?.(userTeam) || 0;
  const effCap = SalaryCapEngine?.getEffectiveCap?.(userTeam) || 0;
  const coach = userTeam.coach;
  const totalPlayed = userTeam.wins + userTeam.losses;
  const pctStr = totalPlayed > 0 ? ((userTeam.wins / totalPlayed) * 100).toFixed(1) : '—';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gap)' }}>
      <MetricCard label="Record"
        value={`${userTeam.wins}–${userTeam.losses}`}
        detail={`${pctStr}% · ${gamesPlayed}/${totalGames}`}
        valueColor={userTeam.wins > userTeam.losses ? 'var(--color-win)' :
                    userTeam.wins < userTeam.losses ? 'var(--color-loss)' : undefined} />
      <MetricCard label="Team Rating"
        value={Math.round(strength)}
        detail="League avg: 68" />
      <MetricCard label="Cap Space"
        value={fmtShort(capSpace)}
        detail={`of ${fmtShort(effCap)}`}
        valueColor={capSpace < 0 ? 'var(--color-loss)' : undefined} />
      <MetricCard label="Coach"
        value={coach ? coach.name.split(' ').pop() : 'None'}
        detail={coach ? `${coach.overall} OVR · ${coach.archetype}` : 'Hire →'} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Next Game Widget — stretches to match sibling height
   ═══════════════════════════════════════════════════════════════ */
export function NextGameWidget() {
  const { gameState, engines } = useGame();
  if (!gameState?.userTeam) return null;

  const { userTeam, currentTier } = gameState;
  const { LeagueManager } = engines;

  // Read tier-specific schedule (same pattern as ScheduleScreen)
  const raw = gameState._raw || gameState;
  const schedule = currentTier === 1 ? raw.tier1Schedule :
                   currentTier === 2 ? raw.tier2Schedule : raw.tier3Schedule;

  const nextGame = (schedule || []).find(g =>
    !g.played && (g.homeTeamId === userTeam.id || g.awayTeamId === userTeam.id)
  );

  if (!nextGame) {
    return (
      <Card padding="md" style={{ display: 'flex', flexDirection: 'column' }}>
        <CardLabel>Next Game</CardLabel>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}>
          Season complete
        </div>
      </Card>
    );
  }

  const isHome = nextGame.homeTeamId === userTeam.id;
  const opponentId = isHome ? nextGame.awayTeamId : nextGame.homeTeamId;
  const teams = currentTier === 1 ? gameState.tier1Teams :
                currentTier === 2 ? gameState.tier2Teams : gameState.tier3Teams;
  const opponent = teams.find(t => t.id === opponentId);

  // Calculate win probability from team strengths
  const userStrength = LeagueManager?.calculateTeamStrength?.(userTeam) || 50;
  const oppStrength = opponent ? (LeagueManager?.calculateTeamStrength?.(opponent) || 50) : 50;
  const rawProb = userStrength / (userStrength + oppStrength);
  // Apply home court advantage (~3-4% swing)
  const winProb = isHome ? Math.min(0.95, rawProb + 0.03) : Math.max(0.05, rawProb - 0.03);

  return (
    <Card padding="md" style={{ display: 'flex', flexDirection: 'column' }}>
      <CardLabel>Next Game</CardLabel>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 0' }}>
        <WinProbArc probability={winProb} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>
              {userTeam.city || userTeam.name.split(' ')[0]}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {userTeam.wins}–{userTeam.losses}
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '0 8px' }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>{isHome ? 'HOME' : 'AWAY'}</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>
              {opponent?.city || opponent?.name?.split(' ')[0] || 'TBD'}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {opponent ? `${opponent.wins}–${opponent.losses}` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Sim controls — primary action + skip group */}
      <NextGameSimControls />
    </Card>
  );
}

function NextGameSimControls() {
  const { gameState } = useGame();
  const [simming, setSimming] = useState(false);

  const { isSeasonComplete, offseasonPhase } = gameState || {};
  const inOffseason = offseasonPhase && offseasonPhase !== 'none';
  const disabled = isSeasonComplete || simming;

  const wrap = useCallback((fn) => () => {
    if (simming) return;
    setSimming(true);
    setTimeout(() => { fn?.(); setTimeout(() => setSimming(false), 200); }, 10);
  }, [simming]);

  if (inOffseason) {
    const PHASE_LABELS = {
      season_ended: 'Review Season', postseason: 'Playoffs',
      promo_rel: 'Promotion / Relegation', draft: 'Draft',
      college_fa: 'College Free Agency', development: 'Player Development',
      free_agency: 'Free Agency', roster_compliance: 'Roster Compliance',
      owner_mode: 'Owner Decisions', setup_complete: 'Start New Season',
    };
    return (
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-subtle)' }}>
        <button
          onClick={wrap(() => window.resumeOffseason?.())}
          style={{
            width: '100%', padding: '9px 0', border: 'none',
            background: 'var(--color-accent)', color: '#fff',
            fontSize: 'var(--text-sm)', fontWeight: 700,
            fontFamily: 'var(--font-body)', cursor: 'pointer', borderRadius: 3,
            opacity: simming ? 0.6 : 1,
          }}
        >
          {PHASE_LABELS[offseasonPhase] || 'Continue'} →
        </button>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: 12, paddingTop: 12,
      borderTop: '1px solid var(--color-border-subtle)',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {/* Primary: Next */}
      <SimActionBtn
        label="Next ›"
        accent
        onClick={wrap(() => window.simNextGame?.())}
        disabled={disabled}
        style={{ flex: 1 }}
      />
      {/* Watch */}
      <SimActionBtn
        label="Watch"
        onClick={wrap(() => window.watchNextGame?.())}
        disabled={disabled}
      />
      {/* Grouped skip buttons */}
      <div style={{
        display: 'flex', border: '1px solid var(--color-border)', borderRadius: 3, overflow: 'hidden',
      }}>
        <SimGroupBtn label="Day" onClick={wrap(() => window.simDay?.())} disabled={disabled} />
        <SimGroupBtn label="Week" onClick={wrap(() => window.simWeek?.())} disabled={disabled} border />
        <SimGroupBtn label="Season" onClick={wrap(() => window.finishSeason?.())} disabled={disabled} border />
      </div>
    </div>
  );
}

function SimActionBtn({ label, onClick, disabled, accent, style }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        padding: '7px 14px', border: accent ? 'none' : '1px solid var(--color-border)',
        borderRadius: 3,
        background: accent ? 'var(--color-accent)' : 'transparent',
        color: accent ? '#fff' : 'var(--color-text-secondary)',
        fontSize: 'var(--text-xs)', fontWeight: accent ? 700 : 500,
        fontFamily: 'var(--font-body)', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1, whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {label}
    </button>
  );
}

function SimGroupBtn({ label, onClick, disabled, border }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        padding: '6px 10px',
        border: 'none',
        borderLeft: border ? '1px solid var(--color-border)' : 'none',
        background: 'transparent',
        color: 'var(--color-text-secondary)',
        fontSize: 'var(--text-xs)', fontWeight: 500,
        fontFamily: 'var(--font-body)', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1, whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function WinProbArc({ probability, size = 140 }) {
  const pct = Math.round(probability * 100);
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2 + 10;

  const prob = Math.max(0.02, Math.min(0.98, probability));
  const arcColor = pct >= 60 ? 'var(--color-accent)' : pct >= 45 ? 'var(--color-text-secondary)' : 'var(--color-loss)';

  // Key points on the semicircle
  const leftX = cx - radius, leftY = cy;
  const topX = cx, topY = cy - radius;
  const rightX = cx + radius, rightY = cy;

  // Fill endpoint
  const angle = Math.PI * (1 - prob);
  const fillX = cx + radius * Math.cos(angle);
  const fillY = cy - radius * Math.sin(angle);

  // Split at the top midpoint to avoid large-arc-flag ambiguity.
  // All arcs use large-arc=0, sweep=1 (small clockwise segments).
  const fillPath = prob <= 0.5
    ? `M ${leftX} ${leftY} A ${radius} ${radius} 0 0 1 ${fillX} ${fillY}`
    : `M ${leftX} ${leftY} A ${radius} ${radius} 0 0 1 ${topX} ${topY} A ${radius} ${radius} 0 0 1 ${fillX} ${fillY}`;

  return (
    <div style={{ position: 'relative', width: size, height: size / 2 + 24, margin: '0 auto' }}>
      <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
        <defs>
          <pattern id="winProbHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={arcColor} strokeWidth="3" strokeOpacity="0.5" />
          </pattern>
        </defs>
        {/* Hatched background — two small arcs, no large-arc-flag needed */}
        <path
          d={`M ${leftX} ${leftY} A ${radius} ${radius} 0 0 1 ${topX} ${topY} A ${radius} ${radius} 0 0 1 ${rightX} ${rightY}`}
          fill="none" stroke="url(#winProbHatch)" strokeWidth={strokeWidth} strokeLinecap="butt"
        />
        {/* Solid fill arc */}
        {pct > 0 && (
          <path d={fillPath}
            fill="none" stroke={arcColor} strokeWidth={strokeWidth} strokeLinecap="butt"
          />
        )}
      </svg>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 6, textAlign: 'center',
      }}>
        <div style={{
          fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: arcColor, lineHeight: 1,
        }}>{pct}%</div>
        <div style={{
          fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
          letterSpacing: '0.06em', marginTop: 2,
        }}>Win Prob.</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Standings Widget
   ═══════════════════════════════════════════════════════════════ */
export function StandingsWidget() {
  const { gameState, engines } = useGame();
  if (!gameState?.userTeam) return null;

  const { currentTier, userTeam } = gameState;
  const { LeagueManager } = engines;
  const teams = currentTier === 1 ? gameState.tier1Teams :
                currentTier === 2 ? gameState.tier2Teams : gameState.tier3Teams;
  const divisionTeams = teams.filter(t => t.division === userTeam.division);
  const sorted = LeagueManager?.sortTeamsByStandings
    ? LeagueManager.sortTeamsByStandings([...divisionTeams], gameState.schedule)
    : [...divisionTeams].sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses));

  return (
    <Card padding="none">
      <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <CardLabel style={{ marginBottom: 0 }}>{userTeam.division} Division</CardLabel>
        <span
          onClick={() => window._reactNavigate?.('standings')}
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' }}
        >
          All Standings →
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <TH left pl>Team</TH>
            <TH>W</TH><TH>L</TH><TH>PCT</TH><TH pr>GB</TH>
          </tr>
        </thead>
        <tbody>
          {sorted.map((team, i) => {
            const isUser = team.id === userTeam.id;
            const played = team.wins + team.losses;
            const pctVal = played > 0 ? (team.wins / played).toFixed(3).slice(1) : '.000';
            const gb = i === 0 ? '—' :
              ((sorted[0].wins - team.wins + team.losses - sorted[0].losses) / 2).toFixed(1);
            return (
              <tr key={team.id} style={{
                borderBottom: i < sorted.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                background: isUser ? 'var(--color-accent-bg)' : 'transparent',
              }}>
                <td style={{
                  padding: '7px 12px 7px 16px',
                  fontWeight: isUser ? 'var(--weight-semi)' : 'var(--weight-normal)',
                  color: isUser ? 'var(--color-accent)' : 'var(--color-text)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {isUser && <div style={{ width: 6, height: 6, background: 'var(--color-accent)', flexShrink: 0 }} />}
                  {team.name}
                </td>
                <TD style={{ color: 'var(--color-win)' }}>{team.wins}</TD>
                <TD style={{ color: 'var(--color-loss)' }}>{team.losses}</TD>
                <TD>{pctVal}</TD>
                <TD pr style={{ color: 'var(--color-text-tertiary)' }}>{gb}</TD>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Roster Quick Look — table, not cards
   ═══════════════════════════════════════════════════════════════ */
export function RosterQuickWidget() {
  const { gameState, engines } = useGame();
  if (!gameState?.userTeam) return null;
  const roster = [...(gameState.userTeam.roster || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const { StatEngine } = engines;

  return (
    <Card padding="none" interactive onClick={() => window._reactNavigate?.('roster')}>
      <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <CardLabel style={{ marginBottom: 0 }}>Roster</CardLabel>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 'var(--weight-medium)' }}>
          Manage →
        </span>
      </div>

      {/* Option B — hex inline per row alongside OFF / DEF numbers */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <TH left pl>Player</TH>
            <TH left>Pos</TH>
            <TH>OVR</TH>
            <TH>OFF</TH>
            <TH>DEF</TH>
            <TH style={{ width: 52, textAlign: 'center', padding: '7px 4px', fontSize: 10, fontWeight: 'var(--weight-semi)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profile</TH>
            <TH pr right>Salary</TH>
          </tr>
        </thead>
        <tbody>
          {roster.slice(0, 8).map((p, i) => {
            const analytics = StatEngine?.getPlayerAnalytics?.(p, gameState.userTeam) || null;
            const avgs = analytics?.avgs || null;
            const components = hexComponentsFromAnalytics(analytics, avgs)
              ?? hexComponentsFromProfile(p);
            const isProjection = components?.isProjection;
            return (
              <tr key={p.id || i} style={{
                borderBottom: i < Math.min(roster.length, 8) - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                <td style={{ padding: '5px 12px 5px 16px', fontWeight: 'var(--weight-medium)' }}>
                  {p.name}
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 6 }}>{p.age}</span>
                </td>
                <td style={{ padding: '5px 8px', color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>{p.position}</td>
                <TD mono bold style={{ color: ratingColor(p.rating) }}>{p.rating}</TD>
                <TD mono style={{ color: ratingColor(p.offRating), fontSize: 'var(--text-xs)' }}>{p.offRating}</TD>
                <TD mono style={{ color: ratingColor(p.defRating), fontSize: 'var(--text-xs)' }}>{p.defRating}</TD>
                <td style={{ padding: '2px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                  {components
                    ? <div style={{ display: 'inline-block', opacity: isProjection ? 0.5 : 1 }}>
                        <MiniHex components={components} size={44} />
                      </div>
                    : <svg width={44} height={44} viewBox="0 0 44 44" style={{ display: 'inline-block', opacity: 0.2 }}>
                        <path
                          d={Array.from({ length: 6 }, (_, j) => {
                            const a = (Math.PI * 2 * j) / 6 - Math.PI / 2;
                            const r = 44 * 0.38;
                            return `${j === 0 ? 'M' : 'L'} ${(22 + r * Math.cos(a)).toFixed(1)} ${(22 + r * Math.sin(a)).toFixed(1)}`;
                          }).join(' ') + ' Z'}
                          fill="none" stroke="var(--color-border)" strokeWidth={1}
                        />
                      </svg>
                  }
                </td>
                <TD pr mono right style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>{fmtShort(p.salary)}</TD>
              </tr>
            );
          })}
        </tbody>
      </table>
      {roster.length > 8 && (
        <div style={{
          padding: '7px 16px', fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)',
          borderTop: '1px solid var(--color-border-subtle)',
        }}>
          +{roster.length - 8} more — click to view full roster
        </div>
      )}
    </Card>
  );
}



/* ═══════════════════════════════════════════════════════════════
   Recent Activity Widget
   ═══════════════════════════════════════════════════════════════ */
export function RecentActivityWidget() {
  const { gameState } = useGame();
  if (!gameState?.userTeam) return null;
  const { tradeHistory, userTeam } = gameState;
  const recentTrades = (tradeHistory || []).slice(-5).reverse();

  return (
    <Card padding="md">
      <CardLabel>Recent Transactions</CardLabel>
      {recentTrades.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
          No transactions yet this season
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          {recentTrades.map((trade, i) => {
            const t1Name = trade.team1?.name || trade.team1Name || 'Team';
            const t2Name = trade.team2?.name || trade.team2Name || 'Team';
            const t1Id = trade.team1?.id ?? trade.team1Id;
            const t2Id = trade.team2?.id ?? trade.team2Id;
            const t1Gave = trade.team1Gave || [];
            const t2Gave = trade.team2Gave || [];
            const isUser = t1Id === userTeam.id || t2Id === userTeam.id;
            return (
              <div key={i} style={{
                padding: '10px 12px',
                background: isUser ? 'var(--color-accent-bg)' : 'var(--color-bg-sunken)',
                border: `1px solid ${isUser ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)' }}>{t1Name} ↔ {t2Name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {isUser && <Badge variant="accent">Your Team</Badge>}
                    {trade.date && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{trade.date}</span>}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
                  <div>
                    {t1Gave.map((p, j) => (
                      <div key={j} style={{ color: 'var(--color-text-secondary)' }}>
                        {p.name} <span style={{ color: 'var(--color-text-tertiary)' }}>({p.position} {p.rating})</span>
                      </div>
                    ))}
                    {t1Gave.length === 0 && <div style={{ color: 'var(--color-text-tertiary)' }}>—</div>}
                  </div>
                  <div style={{ color: 'var(--color-text-tertiary)', alignSelf: 'center' }}>⇄</div>
                  <div>
                    {t2Gave.map((p, j) => (
                      <div key={j} style={{ color: 'var(--color-text-secondary)' }}>
                        {p.name} <span style={{ color: 'var(--color-text-tertiary)' }}>({p.position} {p.rating})</span>
                      </div>
                    ))}
                    {t2Gave.length === 0 && <div style={{ color: 'var(--color-text-tertiary)' }}>—</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Team Form Widget — dashboard sparkline showing team GameScore arc
   ═══════════════════════════════════════════════════════════════ */

export function TeamFormWidget() {
  const { gameState } = useGame();
  if (!gameState?.userTeam) return null;

  const roster = gameState.userTeam.roster || [];

  const teamLog = useMemo(() => buildTeamLog(roster), [roster]);

  if (teamLog.length < 3) return null;

  // Coach name for the subheader
  const coach = gameState.userTeam.coach;
  const coachName = coach ? coach.name : null;

  // Recent form label: last 5 games as W/L string if we have it, or just game count
  const gamesPlayed = teamLog.length;

  return (
    <Card padding="md">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <CardLabel>Team Form</CardLabel>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
            Avg player Game Score · {gamesPlayed}G
            {coachName && (
              <span style={{ marginLeft: 6, color: 'var(--color-text-tertiary)' }}>
                · {coachName}
              </span>
            )}
          </div>
        </div>
        {/* GameScore legend pill */}
        <div style={{
          fontSize: 9, color: 'var(--color-text-tertiary)',
          padding: '2px 7px', border: '1px solid var(--color-border)',
          lineHeight: 1.6, maxWidth: 180, textAlign: 'right',
        }}>
          Game Score: pts + ast + stl + blk − tov − missed shots
        </div>
      </div>

      <TeamFormSparkline teamLog={teamLog} height={64} />
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Shared Primitives
   ═══════════════════════════════════════════════════════════════ */

function MetricCard({ label, value, detail, valueColor }) {
  return (
    <Card padding="md">
      <div style={{
        fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semi)',
        color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)',
        color: valueColor || 'var(--color-text)',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, letterSpacing: '-0.02em',
      }}>{value}</div>
      {detail && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>{detail}</div>}
    </Card>
  );
}

function CardLabel({ children, style }) {
  return (
    <div style={{
      fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semi)',
      color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
      letterSpacing: '0.06em', marginBottom: 8, ...style,
    }}>{children}</div>
  );
}

// Table helpers
function TH({ children, left, right, pl, pr, style }) {
  return (
    <th style={{
      padding: '7px 8px',
      ...(pl ? { paddingLeft: 16 } : {}),
      ...(pr ? { paddingRight: 16 } : {}),
      fontSize: 10, fontWeight: 'var(--weight-semi)',
      color: 'var(--color-text-tertiary)',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      textAlign: left ? 'left' : right ? 'right' : 'center',
      ...style,
    }}>{children}</th>
  );
}

function TD({ children, pl, pr, left, right, mono, bold, style }) {
  return (
    <td style={{
      padding: '6px 8px',
      ...(pl ? { paddingLeft: 16 } : {}),
      ...(pr ? { paddingRight: 16 } : {}),
      textAlign: left ? 'left' : right ? 'right' : 'center',
      fontVariantNumeric: 'tabular-nums',
      ...(mono ? { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' } : {}),
      ...(bold ? { fontWeight: 'var(--weight-semi)' } : {}),
      ...style,
    }}>{children}</td>
  );
}



function fmtShort(amount) {
  if (amount >= 1e6) return '$' + (amount / 1e6).toFixed(1) + 'M';
  if (amount >= 1e3) return '$' + (amount / 1e3).toFixed(0) + 'K';
  return '$' + amount;
}
