import React from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card, CardHeader } from './Card.jsx';
import { Badge, RatingBadge } from './Badge.jsx';

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
    </Card>
  );
}

function WinProbArc({ probability, size = 140 }) {
  const pct = Math.round(probability * 100);
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2 + 10;

  const startAngle = Math.PI;
  const endAngle = 0;
  const sweepAngle = startAngle - (startAngle - endAngle) * probability;

  const x1 = cx + radius * Math.cos(startAngle);
  const y1 = cy - radius * Math.sin(startAngle);
  const x2 = cx + radius * Math.cos(sweepAngle);
  const y2 = cy - radius * Math.sin(sweepAngle);
  const bgX2 = cx + radius * Math.cos(endAngle);
  const bgY2 = cy - radius * Math.sin(endAngle);

  const arcColor = pct >= 60 ? 'var(--color-accent)' : pct >= 45 ? 'var(--color-text-secondary)' : 'var(--color-loss)';

  return (
    <div style={{ position: 'relative', width: size, height: size / 2 + 24, margin: '0 auto' }}>
      <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
        <defs>
          <pattern id="winProbHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={arcColor} strokeWidth="3" strokeOpacity="0.5" />
          </pattern>
        </defs>
        {/* Hatched background arc */}
        <path
          d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${bgX2} ${bgY2}`}
          fill="none" stroke="url(#winProbHatch)" strokeWidth={strokeWidth} strokeLinecap="butt"
        />
        {/* Solid fill arc */}
        {pct > 0 && (
          <path
            d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${probability > 0.5 ? 1 : 0} 1 ${x2} ${y2}`}
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
  const { gameState } = useGame();
  if (!gameState?.userTeam) return null;
  const roster = [...(gameState.userTeam.roster || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  return (
    <Card padding="none" interactive onClick={() => window._reactNavigate?.('roster')}>
      <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <CardLabel style={{ marginBottom: 0 }}>Roster</CardLabel>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 'var(--weight-medium)' }}>
          Manage →
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <TH left pl>Player</TH>
            <TH left>Pos</TH>
            <TH>OVR</TH>
            <TH>OFF</TH>
            <TH>DEF</TH>
            <TH pr right>Salary</TH>
          </tr>
        </thead>
        <tbody>
          {roster.map((p, i) => (
            <tr key={p.id || i} style={{
              borderBottom: i < roster.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <td style={{ padding: '6px 12px 6px 16px', fontWeight: 'var(--weight-medium)' }}>
                {p.name}
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 6 }}>{p.age}</span>
              </td>
              <td style={{ padding: '6px 8px', color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>{p.position}</td>
              <TD mono bold style={{ color: ratingColor(p.rating) }}>{p.rating}</TD>
              <TD mono style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>{p.offRating}</TD>
              <TD mono style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>{p.defRating}</TD>
              <TD pr mono right style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>{fmtShort(p.salary)}</TD>
            </tr>
          ))}
        </tbody>
      </table>
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

function ratingColor(r) {
  if (r >= 80) return 'var(--color-rating-elite)';
  if (r >= 70) return 'var(--color-rating-good)';
  if (r >= 60) return 'var(--color-rating-avg)';
  return 'var(--color-rating-poor)';
}

function fmtShort(amount) {
  if (amount >= 1e6) return '$' + (amount / 1e6).toFixed(1) + 'M';
  if (amount >= 1e3) return '$' + (amount / 1e3).toFixed(0) + 'K';
  return '$' + amount;
}
