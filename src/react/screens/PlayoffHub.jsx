// ═══════════════════════════════════════════════════════════════════
// PlayoffHub — Full-screen postseason hub
//
// Replaces the dashboard (sidebar + main) for the entire postseason.
// Activated via window._reactShowPlayoffHub(data) from OffseasonController.
// Hands back to offseason flow via data.onComplete() when the user is done.
//
// Design: matches game design system — warm off-white, forest green
//   accent, sharp corners, DM Sans / JetBrains Mono typography.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';

// ─── Tier color tokens ────────────────────────────────────────────────────────
const TIER = {
  1: { color: 'var(--color-tier1)', bg: 'var(--color-tier1-bg)', border: 'rgba(212,168,67,0.3)' },
  2: { color: 'var(--color-tier2)', bg: 'var(--color-tier2-bg)', border: 'rgba(138,138,138,0.3)' },
  3: { color: 'var(--color-tier3)', bg: 'var(--color-tier3-bg)', border: 'rgba(179,115,64,0.3)' },
};

// ─── Win Prob Arc ─────────────────────────────────────────────────────────────
// Exact port of WinProbArc from Widgets.jsx — same math, same hatch pattern.
function WinProbArc({ probability, size = 140 }) {
  const pct = Math.round(probability * 100);
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const prob = Math.max(0.02, Math.min(0.98, probability));
  const arcColor =
    pct >= 60 ? 'var(--color-accent)' :
    pct >= 45 ? 'var(--color-text-secondary)' :
                'var(--color-loss)';
  const leftX = cx - radius, leftY = cy;
  const topX = cx, topY = cy - radius;
  const rightX = cx + radius, rightY = cy;
  const angle = Math.PI * (1 - prob);
  const fillX = cx + radius * Math.cos(angle);
  const fillY = cy - radius * Math.sin(angle);
  const fillPath = prob <= 0.5
    ? `M ${leftX} ${leftY} A ${radius} ${radius} 0 0 1 ${fillX} ${fillY}`
    : `M ${leftX} ${leftY} A ${radius} ${radius} 0 0 1 ${topX} ${topY} A ${radius} ${radius} 0 0 1 ${fillX} ${fillY}`;
  return (
    <div style={{ position: 'relative', width: size, height: size / 2 + 24, margin: '0 auto' }}>
      <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
        <defs>
          <pattern id="phHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={arcColor} strokeWidth="3" strokeOpacity="0.5" />
          </pattern>
        </defs>
        <path
          d={`M ${leftX} ${leftY} A ${radius} ${radius} 0 0 1 ${topX} ${topY} A ${radius} ${radius} 0 0 1 ${rightX} ${rightY}`}
          fill="none" stroke="url(#phHatch)" strokeWidth={strokeWidth} strokeLinecap="butt"
        />
        {pct > 0 && (
          <path d={fillPath} fill="none" stroke={arcColor} strokeWidth={strokeWidth} strokeLinecap="butt" />
        )}
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 6, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: arcColor, lineHeight: 1 }}>{pct}%</div>
        <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>WIN PROB.</div>
      </div>
    </div>
  );
}

// ─── Small button ─────────────────────────────────────────────────────────────
function Btn({ children, variant = 'ghost', onClick, style }) {
  const base = {
    flex: 1, padding: '6px 4px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-sunken)',
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
    cursor: 'pointer', textAlign: 'center', lineHeight: 1,
  };
  const variants = {
    primary: { background: 'var(--color-accent)', borderColor: 'var(--color-accent)', color: 'var(--color-text-inverse)' },
    ghost: {},
    watch: { color: 'var(--color-accent)' },
    sim: { background: 'var(--color-tier1-bg)', borderColor: 'rgba(212,168,67,0.3)', color: 'var(--color-tier1)', fontWeight: 600 },
  };
  return <button onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}

// ─── Label ────────────────────────────────────────────────────────────────────
function Label({ children, style }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 500,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'var(--color-text-tertiary)', marginBottom: 9, ...style,
    }}>{children}</div>
  );
}

// ─── Sidebar section ──────────────────────────────────────────────────────────
function SbSection({ children, style }) {
  return <div style={{ padding: '11px 13px', borderBottom: '1px solid var(--color-border)', ...style }}>{children}</div>;
}

// ─── Extract 3-letter abbreviation ───────────────────────────────────────────
function abbr(team) {
  if (!team) return '—';
  if (team.abbreviation) return team.abbreviation;
  if (team.city) return team.city.slice(0, 3).toUpperCase();
  return team.name?.slice(0, 3).toUpperCase() || '—';
}

// Reusable tooltip for team names
function TeamName({ team, complete, isWinner, isLoser, style }) {
  const [show, setShow] = useState(false);
  const name = team?.name;
  return (
    <span 
      style={{ position: 'relative', cursor: 'default', ...style }}
      onMouseEnter={() => name && setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {show && name && (
        <div style={{ 
          position: 'absolute', left: 0, top: -22, zIndex: 9999, 
          background: 'var(--color-text)', color: 'var(--color-text-inverse)', 
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 500,
          padding: '2px 6px', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {name}
        </div>
      )}
      {abbr(team)}
    </span>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function PlayoffSidebar({
  userTeam, opponent, userWins, oppWins, isUserInSeries, seriesOver,
  seriesProb, roundName, bestOf, games, nextGameNum, nextGameLocation,
  userTeam_abbr, opp_abbr, otherSeriesList,
  onSimGame, onWatch, onSimSeries, onSimToChampionship,
  // New props for eliminated users
  userInPlayoffs, userEliminated, onSimDay, onSimRound,
  // Playoffs complete
  playoffsComplete, onViewResults,
  // Box score
  onShowBoxScore,
}) {
  const showActiveControls = isUserInSeries && !seriesOver && !playoffsComplete;
  const showEliminatedControls = (!userInPlayoffs || userEliminated) && !playoffsComplete;
  
  return (
    <div style={{
      width: 210, minWidth: 210, flexShrink: 0,
      background: 'var(--color-bg-raised)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', overflowX: 'hidden',
    }}>
      {/* Your Series */}
      <SbSection>
        <Label>{isUserInSeries || seriesOver ? 'Your Series' : 'Playoffs'}</Label>
        {(isUserInSeries || seriesOver) ? (
          <>
            <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{userTeam_abbr} vs {opp_abbr}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {roundName} · Best of {bestOf}
            </div>
            {/* Score — dashboard stat style */}
            <div style={{ display: 'flex', gap: 10, margin: '10px 0 4px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 3 }}>{userTeam_abbr}</div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: userWins >= oppWins ? 'var(--color-accent)' : 'var(--color-text)' }}>{userWins}</div>
                <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', marginTop: 2 }}>Series wins</div>
              </div>
              <div style={{ fontSize: 14, color: 'var(--color-text-tertiary)', paddingTop: 20 }}>–</div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 3 }}>{opp_abbr}</div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: oppWins > userWins ? 'var(--color-accent)' : 'var(--color-text)', textAlign: 'right' }}>{oppWins}</div>
                <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', marginTop: 2, textAlign: 'right' }}>Series wins</div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            Your team did not qualify for the playoffs this season.
          </div>
        )}
      </SbSection>

      {/* Win Probability arc */}
      {isUserInSeries && !seriesOver && (
        <SbSection>
          <Label>Series Win Prob.</Label>
          <WinProbArc probability={seriesProb} size={184} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 2px 0', marginTop: 2 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{userTeam_abbr}</div>
              <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>{userWins}–{oppWins}</div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em', paddingTop: 2 }}>
              {nextGameLocation === 'home' ? 'HOME' : 'AWAY'}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{opp_abbr}</div>
              <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', textAlign: 'right' }}>{oppWins}–{userWins}</div>
            </div>
          </div>
        </SbSection>
      )}

      {seriesOver && (isUserInSeries || userEliminated) && (
        <SbSection>
          <div style={{ textAlign: 'center', padding: '6px 0', fontSize: 12, fontWeight: 700, color: userWins > oppWins ? 'var(--color-win)' : 'var(--color-loss)' }}>
            {userWins > oppWins ? 'Series Won' : 'Series Lost'} · {userWins}–{oppWins}
          </div>
        </SbSection>
      )}

      {/* Controls - Active User in Series */}
      {showActiveControls && (
        <SbSection>
          <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
            <Btn variant="primary" onClick={onSimGame}>Game {nextGameNum} ›</Btn>
            <Btn variant="watch" onClick={onWatch}>Watch</Btn>
            <Btn variant="ghost" onClick={onSimSeries}>Series</Btn>
          </div>
          <Btn variant="sim" onClick={onSimToChampionship} style={{ width: '100%', flex: 'none', padding: '7px 0' }}>
            Sim to Championship ›
          </Btn>
        </SbSection>
      )}

      {/* Controls - Eliminated User or Not in Playoffs */}
      {showEliminatedControls && (
        <SbSection>
          <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
            <Btn variant="ghost" onClick={onSimDay}>Sim Day</Btn>
            <Btn variant="ghost" onClick={onSimRound}>Sim Round</Btn>
          </div>
          <Btn variant="sim" onClick={onSimToChampionship} style={{ width: '100%', flex: 'none', padding: '7px 0' }}>
            Sim to Championship ›
          </Btn>
        </SbSection>
      )}

      {/* Controls - User won series, waiting for next round */}
      {seriesOver && userWins > oppWins && !showEliminatedControls && !playoffsComplete && (
        <SbSection>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8, textAlign: 'center' }}>
            Waiting for next round...
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
            <Btn variant="ghost" onClick={onSimDay}>Sim Day</Btn>
            <Btn variant="ghost" onClick={onSimRound}>Sim Round</Btn>
          </div>
          <Btn variant="sim" onClick={onSimToChampionship} style={{ width: '100%', flex: 'none', padding: '7px 0' }}>
            Sim to Championship ›
          </Btn>
        </SbSection>
      )}

      {/* Playoffs Complete - View Results */}
      {playoffsComplete && (
        <SbSection>
          <div style={{ textAlign: 'center', padding: '8px 0', marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
              PLAYOFFS COMPLETE
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              All series have concluded
            </div>
          </div>
          <Btn variant="primary" onClick={onViewResults} style={{ width: '100%', padding: '10px 0' }}>
            View Results →
          </Btn>
        </SbSection>
      )}

      {/* Game Log */}
      {(isUserInSeries || seriesOver) && games.length > 0 && (
        <SbSection>
          <Label>Game Log</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {games.map((g, i) => (
              <div 
                key={i} 
                onClick={() => {
                  console.log('🎯 Game log clicked:', g);
                  onShowBoxScore?.(g.gameIndex);
                }}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 5, padding: '3px 4px', fontSize: 10,
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-sunken)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-tertiary)', minWidth: 13 }}>G{i + 1}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 500, padding: '1px 4px', background: g.userWon ? 'var(--color-win-bg)' : 'var(--color-loss-bg)', color: g.userWon ? 'var(--color-win)' : 'var(--color-loss)' }}>
                  {g.userWon ? 'W' : 'L'}
                </span>
                <span style={{ flex: 1, color: 'var(--color-text-secondary)' }}>{g.location} {opp_abbr}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-secondary)' }}>{g.userScore}–{g.oppScore}</span>
              </div>
            ))}
            {!seriesOver && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 5px', fontSize: 10, background: 'var(--color-tier1-bg)', border: '1px solid rgba(212,168,67,0.2)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-tertiary)', minWidth: 13 }}>G{nextGameNum}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 500, padding: '1px 4px', background: 'var(--color-tier1-bg)', color: 'var(--color-tier1)', border: '1px solid rgba(212,168,67,0.3)' }}>TDY</span>
                <span style={{ flex: 1, color: 'var(--color-tier1)' }}>{nextGameLocation === 'home' ? 'vs' : '@'} {opp_abbr}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>—</span>
              </div>
            )}
          </div>
        </SbSection>
      )}

      {/* Head to Head — Coming Soon */}
      <SbSection>
        <Label>Head to Head</Label>
        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontStyle: 'italic', lineHeight: 1.5, padding: '4px 0' }}>
          H2H stats coming soon
        </div>
      </SbSection>

      {/* Season Stats */}
      <SbSection>
        <Label>Season Stats</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 8px' }}>
          {(() => {
            const gamesPlayed = (userTeam?.wins || 0) + (userTeam?.losses || 0);
            const winPct = gamesPlayed > 0 ? ((userTeam?.wins || 0) / gamesPlayed * 100).toFixed(0) : '—';
            const ovrRating = userTeam?.rating != null ? Math.round(userTeam.rating) : '—';
            
            const stats = [
              ['OVR', ovrRating],
              ['RECORD', gamesPlayed > 0 ? `${userTeam?.wins || 0}-${userTeam?.losses || 0}` : '—'],
              ['WIN %', gamesPlayed > 0 ? `${winPct}%` : '—'],
            ];
            
            return stats.map(([lbl, val]) => (
              <React.Fragment key={lbl}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', alignSelf: 'center' }}>{lbl}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, textAlign: 'right', color: 'var(--color-text)' }}>{val}</span>
              </React.Fragment>
            ));
          })()}
        </div>
      </SbSection>

      {/* Other Series */}
      <SbSection style={{ borderBottom: 'none', flex: 1, overflowY: 'auto' }}>
        <Label>Other Series</Label>
        {otherSeriesList.length === 0 ? (
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>No other active series</div>
        ) : otherSeriesList.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: i < otherSeriesList.length - 1 ? '1px solid var(--color-border-subtle)' : 'none', fontSize: 10 }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', flexShrink: 0, background: s.winner ? 'var(--color-text-tertiary)' : 'var(--color-accent)' }} />
            <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-secondary)' }}>{s.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: s.winner ? 'var(--color-win)' : 'var(--color-text)' }}>{s.higherWins}–{s.lowerWins}</span>
          </div>
        ))}
      </SbSection>
    </div>
  );
}

// Future slot
function FutureCard({ label = 'TBD' }) {
  const row = (
    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-tertiary)', minWidth: 11 }}>–</span>
      <span style={{ flex: 1, fontSize: 10, color: 'var(--color-text-tertiary)' }}>TBD</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>–</span>
    </div>
  );
  return (
    <div style={{ width: 130, border: '1px solid var(--color-border)', background: 'var(--color-bg-raised)', opacity: 0.38 }}>
      <div style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>{row}</div>
      <div style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>{row}</div>
      <div style={{ padding: '2px 6px', fontFamily: 'var(--font-mono)', fontSize: 8, background: 'var(--color-bg-sunken)', color: 'var(--color-text-tertiary)' }}>{label}</div>
    </div>
  );
}

// Championship destination
function ChampCard({ tier = 1 }) {
  const t = TIER[tier];
  const label = tier === 1 ? 'Finals · Best of 7' : `T${tier} Champion`;
  const rows = tier === 1
    ? [['East Champion'], ['West Champion']]
    : [['Winner'], ['Runner-Up']];
  return (
    <div style={{ width: 130, border: `1px solid ${t.border}`, background: t.bg }}>
      <div style={{ padding: '5px 9px', fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.color, borderBottom: `1px solid ${t.border}` }}>{label}</div>
      {rows.map(([name], i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px', fontSize: 10, borderBottom: i === 0 ? `1px solid ${t.border}` : 'none' }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: t.border, flexShrink: 0 }} />
          <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{name}</span>
        </div>
      ))}
    </div>
  );
}

// Column header
function ColHeader({ children, tier }) {
  const t = tier ? TIER[tier] : null;
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: t ? t.color : 'var(--color-text-tertiary)', paddingBottom: 7, borderBottom: `1px solid ${t ? t.border : 'var(--color-border)'}`, width: 130, textAlign: 'center' }}>
      {children}
    </div>
  );
}

// Connector arrows
function ConnCol({ slots, slotH, gold, silver, bronze }) {
  const color = gold ? 'rgba(212,168,67,0.5)' : silver ? 'rgba(138,138,138,0.4)' : bronze ? 'rgba(179,115,64,0.4)' : 'var(--color-border)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 20, flexShrink: 0, paddingTop: 28, alignItems: 'center' }}>
      {Array.from({ length: slots }).map((_, i) => (
        <div key={i} style={{ height: slotH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color, fontSize: gold || silver || bronze ? 14 : 12, fontFamily: 'var(--font-mono)' }}>›</span>
        </div>
      ))}
    </div>
  );
}

const Slot = ({ h, children }) => <div style={{ height: h, display: 'flex', alignItems: 'center' }}>{children}</div>;

// ─── Tier tab ─────────────────────────────────────────────────────────────────
function TierTab({ tier, active, onClick }) {
  const t = TIER[tier];
  return (
    <button onClick={onClick} style={{ padding: '5px 16px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.05em', border: '1px solid var(--color-border)', borderRight: 'none', background: active ? t.color : 'var(--color-bg-sunken)', color: active ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)', cursor: 'pointer' }}>
      T{tier}
    </button>
  );
}

// ─── Series win probability ───────────────────────────────────────────────────
function calcSeriesProb(userTeam, opponent, userWins, oppWins) {
  if (!userTeam || !opponent) return 0.5;
  const avg = (team) => {
    const roster = (team.roster || []).slice(0, 8);
    if (!roster.length) return team.rating || 75;
    return roster.reduce((s, p) => s + ((p.offRating || p.rating || 75) + (p.defRating || p.rating || 75)) / 2, 0) / roster.length;
  };
  const delta = avg(userTeam) - avg(opponent);
  const adj = (userWins - oppWins) * 0.05;
  return Math.max(0.05, Math.min(0.95, 1 / (1 + Math.exp(-0.15 * delta)) + adj));
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function PlayoffHub({ data, onClose }) {
  const { gameState, refresh } = useGame();
  const [activeTab, setActiveTab] = useState(data?.userTier || 1);
  const { userTeamId, userTier, userInPlayoffs: propsUserInPlayoffs, userSeriesId: propsUserSeriesId, playoffData, playoffSchedule, currentDate } = data || {};

  // Register refresh hook for GameSimController
  useEffect(() => {
    window._reactPlayoffHubRefresh = () => refresh?.();
    return () => { delete window._reactPlayoffHubRefresh; };
  }, [refresh]);

  useEffect(() => { if (userTier) setActiveTab(userTier); }, [userTier]);

  // Get live data from gameState (may have been updated by sim)
  const livePlayoffData = gameState?._raw?.playoffData || gameState?.playoffData || playoffData;
  const livePlayoffSchedule = gameState?._raw?.playoffSchedule || gameState?.playoffSchedule || playoffSchedule;
  const liveCurrentDate = gameState?._raw?.currentDate || gameState?.currentDate || currentDate;
  const liveUserInPlayoffs = gameState?._raw?.userInPlayoffs ?? gameState?.userInPlayoffs ?? propsUserInPlayoffs;
  const liveUserSeriesId = gameState?._raw?.userSeriesId || gameState?.userSeriesId || propsUserSeriesId;

  // Force re-render when games are played by tracking total played count
  // This is needed because the schedule object is mutated in place
  const totalPlayedGames = useMemo(() => {
    if (!livePlayoffSchedule?.games) return 0;
    return livePlayoffSchedule.games.filter(g => g.played).length;
  }, [livePlayoffSchedule, gameState]); // gameState changes on refresh

  // Debug: count played games in user's series
  const debugUserSeriesGames = livePlayoffSchedule?.bySeries?.[liveUserSeriesId] || [];
  const debugPlayedCount = debugUserSeriesGames.filter(g => g.played).length;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🏀 PlayoffHub RENDER');
  console.log('🏀 userTeamId:', userTeamId);
  console.log('🏀 userTier:', userTier);
  console.log('🏀 userInPlayoffs:', liveUserInPlayoffs);
  console.log('🏀 userSeriesId:', liveUserSeriesId);
  console.log('🏀 currentDate:', liveCurrentDate);
  console.log('🏀 playoffData:', livePlayoffData ? 'EXISTS' : 'NULL');
  console.log('🏀 playoffSchedule:', livePlayoffSchedule ? `${livePlayoffSchedule.games?.length} games` : 'NULL');
  console.log('🏀 DEBUG userSeries played games:', debugPlayedCount, '/', debugUserSeriesGames.length);
  console.log('🏀 DEBUG totalPlayedGames:', totalPlayedGames);
  console.log('🏀 DEBUG gameState source:', gameState?._raw?.playoffSchedule ? '_raw' : gameState?.playoffSchedule ? 'snapshot' : 'props');
  console.log('═══════════════════════════════════════════════════════════');

  // User's team object
  const userTeam = useMemo(() => {
    const all = [
      ...(gameState?._raw?.tier1Teams || gameState?.tier1Teams || []),
      ...(gameState?._raw?.tier2Teams || gameState?.tier2Teams || []),
      ...(gameState?._raw?.tier3Teams || gameState?.tier3Teams || []),
    ];
    return all.find(t => t.id === userTeamId) || null;
  }, [gameState, userTeamId]);

  // Get user's current series state
  const userSeriesState = useMemo(() => {
    if (!liveUserInPlayoffs || !liveUserSeriesId || !livePlayoffSchedule) {
      return { inSeries: false, wins: 0, oppWins: 0, opponent: null, bestOf: 7, games: [], complete: false };
    }
    
    const seriesGames = livePlayoffSchedule.bySeries?.[liveUserSeriesId] || [];
    if (seriesGames.length === 0) {
      return { inSeries: false, wins: 0, oppWins: 0, opponent: null, bestOf: 7, games: [], complete: false };
    }
    
    const firstGame = seriesGames[0];
    // Find opponent - user could be home or away team
    const userIsHigherSeed = firstGame.higherSeedId === userTeamId;
    const opponent = userIsHigherSeed 
      ? (firstGame.awayTeam || firstGame.lowerSeed)
      : (firstGame.homeTeam || firstGame.higherSeed);
    const bestOf = firstGame.bestOf || 7;
    const winsNeeded = Math.ceil(bestOf / 2);
    
    let userWins = 0;
    let oppWins = 0;
    const playedGames = [];
    
    for (let idx = 0; idx < seriesGames.length; idx++) {
      const game = seriesGames[idx];
      if (game.played && game.result) {
        const userIsHome = game.homeTeamId === userTeamId;
        const userScore = userIsHome ? game.result.homeScore : game.result.awayScore;
        const oppScore = userIsHome ? game.result.awayScore : game.result.homeScore;
        const userWon = game.result.winner?.id === userTeamId;
        
        if (userWon) userWins++;
        else oppWins++;
        
        playedGames.push({
          gameNumber: game.gameNumber,
          gameIndex: idx,
          userScore,
          oppScore,
          userWon,
          location: userIsHome ? 'vs' : '@',
          date: game.date,
          hasBoxScore: !!game.boxScore
        });
      }
    }
    
    const complete = userWins >= winsNeeded || oppWins >= winsNeeded;
    const nextGame = seriesGames.find(g => !g.played && !complete);
    const nextGameNum = nextGame?.gameNumber || (playedGames.length + 1);
    const nextGameIsHome = nextGame?.homeTeamId === userTeamId;
    
    return {
      inSeries: true,
      userWins,
      oppWins,
      opponent,
      bestOf,
      winsNeeded,
      games: playedGames,
      complete,
      winner: complete ? (userWins >= winsNeeded ? userTeam : opponent) : null,
      nextGameNum,
      nextGameIsHome,
      round: firstGame.round,
      conference: firstGame.conference
    };
  }, [liveUserInPlayoffs, liveUserSeriesId, livePlayoffSchedule, userTeamId, userTeam, totalPlayedGames]);

  // Other series in user's tier (for display)
  const otherSeriesList = useMemo(() => {
    if (!livePlayoffSchedule?.bySeries || !userTier) return [];
    
    const result = [];
    const seenSeries = new Set();
    
    for (const [seriesId, games] of Object.entries(livePlayoffSchedule.bySeries)) {
      if (seenSeries.has(seriesId)) continue;
      if (!games.length || games[0].tier !== userTier) continue;
      if (seriesId === liveUserSeriesId) continue;
      
      seenSeries.add(seriesId);
      
      const firstGame = games[0];
      const higher = firstGame.homeTeam || firstGame.higherSeed;
      const lower = firstGame.awayTeam || firstGame.lowerSeed;
      
      if (!higher || !lower) continue;
      
      let higherWins = 0, lowerWins = 0;
      for (const g of games) {
        if (g.played && g.result?.winner) {
          if (g.result.winner.id === higher.id) higherWins++;
          else lowerWins++;
        }
      }
      
      const bestOf = firstGame.bestOf || 7;
      const winsNeeded = Math.ceil(bestOf / 2);
      const complete = higherWins >= winsNeeded || lowerWins >= winsNeeded;
      
      result.push({
        name: `${abbr(higher)} vs ${abbr(lower)}`,
        higherWins,
        lowerWins,
        winner: complete ? (higherWins >= winsNeeded ? higher : lower) : null,
        round: firstGame.round
      });
    }
    
    return result;
  }, [livePlayoffSchedule, userTier, liveUserSeriesId, totalPlayedGames]);

  // Series win probability
  const seriesProb = useMemo(() => {
    return calcSeriesProb(userTeam, userSeriesState.opponent, userSeriesState.userWins, userSeriesState.oppWins);
  }, [userTeam, userSeriesState]);

  // Handlers - these will call methods we'll implement in Phase 3
  const handleSimGame = useCallback(() => {
    console.log('🎮 Sim Game clicked');
    window.simPlayoffDay?.() || window.simOnePlayoffGame?.();
    setTimeout(() => refresh?.(), 100);
  }, [refresh]);
  
  const handleWatch = useCallback(() => {
    console.log('👁️ Watch clicked');
    window.watchPlayoffGame?.();
  }, []);
  
  const handleSimSeries = useCallback(() => {
    console.log('🎮 Sim Series clicked');
    window.simUserPlayoffSeries?.() || window.simRestOfPlayoffSeries?.();
    setTimeout(() => refresh?.(), 100);
  }, [refresh]);
  
  const handleSimDay = useCallback(() => {
    console.log('🎮 Sim Day clicked (eliminated user)');
    window.simPlayoffDay?.();
    setTimeout(() => refresh?.(), 100);
  }, [refresh]);
  
  const handleSimRound = useCallback(() => {
    console.log('🎮 Sim Round clicked (eliminated user)');
    window.simPlayoffRound?.();
    setTimeout(() => refresh?.(), 100);
  }, [refresh]);
  
  const handleSimToChampionship = useCallback(() => {
    console.log('🎮 Sim to Championship clicked');
    window.simToChampionship?.();
    setTimeout(() => refresh?.(), 100);
  }, [refresh]);

  const handleShowBoxScore = useCallback((gameIndex) => {
    console.log('📊 Show Box Score clicked for game index:', gameIndex);
    
    if (!liveUserSeriesId || !livePlayoffSchedule?.bySeries) return;
    
    const seriesGames = livePlayoffSchedule.bySeries[liveUserSeriesId] || [];
    const game = seriesGames[gameIndex];
    
    if (!game?.boxScore) {
      console.log('No box score available for this game');
      return;
    }
    
    const boxData = {
      home: game.boxScore.home,
      away: game.boxScore.away,
      date: game.date,
      hasDetailedStats: true,
      quarterScores: game.boxScore.quarterScores || null
    };
    
    if (window._reactShowBoxScore) {
      window._reactShowBoxScore(boxData);
    }
  }, [liveUserSeriesId, livePlayoffSchedule]);

  const handleViewResults = useCallback(() => {
    console.log('📊 View Results clicked');
    
    // Build data for PlayoffEndModal
    const gs = gameState?._raw || window.gameState;
    const postseason = gs?.postseasonResults;
    
    // Get user result
    const getUserPlayoffResult = () => {
      if (!liveUserInPlayoffs) {
        return { round: 'Did not qualify', eliminated: true };
      }
      
      // Check if user won championship
      const t1Champion = postseason?.t1?.champion;
      if (t1Champion?.id === userTeamId) {
        return { isChampion: true, round: 'Finals' };
      }
      
      // Find what round user was eliminated
      const schedule = gs?.playoffSchedule;
      if (!schedule?.bySeries) return { round: 'Unknown', eliminated: true };
      
      // Find user's series and determine outcome
      for (const [seriesId, games] of Object.entries(schedule.bySeries)) {
        const firstGame = games[0];
        if (!firstGame) continue;
        
        const userInSeries = firstGame.higherSeedId === userTeamId || firstGame.lowerSeedId === userTeamId;
        if (!userInSeries) continue;
        
        // Check if series is complete and user lost
        let userWins = 0, oppWins = 0;
        for (const g of games) {
          if (g.played && g.result?.winner) {
            if (g.result.winner.id === userTeamId) userWins++;
            else oppWins++;
          }
        }
        
        const bestOf = firstGame.bestOf || 7;
        const winsNeeded = Math.ceil(bestOf / 2);
        
        if (oppWins >= winsNeeded) {
          const opponent = firstGame.higherSeedId === userTeamId 
            ? (firstGame.awayTeam || firstGame.lowerSeed)
            : (firstGame.homeTeam || firstGame.higherSeed);
          return {
            round: firstGame.round || 'Playoffs',
            eliminated: true,
            record: `${userWins}-${oppWins}`,
            opponent: opponent?.name || 'Unknown'
          };
        }
      }
      
      return { round: 'Unknown', eliminated: true };
    };
    
    // Calculate playoff records for champions
    const getPlayoffRecord = (tier) => {
      const schedule = gs?.playoffSchedule;
      const champion = postseason?.[`t${tier}`]?.champion;
      if (!schedule?.games || !champion) return null;
      
      let wins = 0, losses = 0;
      for (const game of schedule.games) {
        if (game.tier !== tier || !game.played || !game.result) continue;
        if (game.result.winner?.id === champion.id) wins++;
        else if (game.homeTeamId === champion.id || game.awayTeamId === champion.id) losses++;
      }
      return `${wins}-${losses}`;
    };
    
    // Get awards from gameState._seasonEndData (calculated at season end)
    const getAwards = (tier) => {
      const tierKey = `tier${tier}`;
      const awards = gs?._seasonEndData?.awards?.[tierKey] || {};
      
      const formatStats = (p) => {
        if (!p) return '';
        const ppg = p.ppg?.toFixed(1) || '0.0';
        const rpg = p.rpg?.toFixed(1) || '0.0';
        const apg = p.apg?.toFixed(1) || '0.0';
        return `${ppg} PPG · ${rpg} RPG · ${apg} APG`;
      };
      
      const formatDefStats = (p) => {
        if (!p) return '';
        const bpg = p.bpg?.toFixed(1) || '0.0';
        const spg = p.spg?.toFixed(1) || '0.0';
        return `${bpg} BPG · ${spg} SPG`;
      };
      
      return {
        mvp: awards.mvp ? {
          name: awards.mvp.name,
          team: awards.mvp.team || 'Unknown',
          stats: formatStats(awards.mvp)
        } : null,
        dpoy: awards.dpoy ? {
          name: awards.dpoy.name,
          team: awards.dpoy.team || 'Unknown',
          stats: formatDefStats(awards.dpoy)
        } : null,
        roy: awards.roy ? {
          name: awards.roy.name,
          team: awards.roy.team || 'Unknown',
          stats: formatStats(awards.roy)
        } : null,
        sixthMan: awards.sixthMan ? {
          name: awards.sixthMan.name,
          team: awards.sixthMan.team || 'Unknown',
          stats: formatStats(awards.sixthMan)
        } : null,
        mostImproved: awards.mostImproved ? {
          name: awards.mostImproved.name,
          team: awards.mostImproved.team || 'Unknown',
          stats: formatStats(awards.mostImproved)
        } : null,
        allLeagueFirst: (awards.allLeagueFirst || []).map(p => ({
          name: p.name,
          team: p.team?.slice(0, 3).toUpperCase() || '',
          position: p.position || '—'
        })),
        allLeagueSecond: (awards.allLeagueSecond || []).map(p => ({
          name: p.name,
          team: p.team?.slice(0, 3).toUpperCase() || '',
          position: p.position || '—'
        })),
      };
    };
    
    const modalData = {
      season: gs?.currentSeason || gs?.season || '—',
      userTeam: userTeam,
      userResult: getUserPlayoffResult(),
      champions: {
        t1: postseason?.t1?.champion ? { ...postseason.t1.champion, playoffRecord: getPlayoffRecord(1) } : null,
        t2: postseason?.t2?.champion ? { ...postseason.t2.champion, playoffRecord: getPlayoffRecord(2) } : null,
        t3: postseason?.t3?.champion ? { ...postseason.t3.champion, playoffRecord: getPlayoffRecord(3) } : null,
      },
      awards: {
        t1: getAwards(1),
        t2: getAwards(2),
        t3: getAwards(3),
      },
      promoted: {
        toT1: (postseason?.promoted?.toT1 || []).map((t, i) => ({
          name: t.name,
          reason: i === 0 ? 'T2 Champion' : i === 1 ? 'Runner-Up' : 'Best Record'
        })),
        toT2: (postseason?.promoted?.toT2 || []).map((t, i) => ({
          name: t.name,
          reason: i === 0 ? 'T3 Champion' : i === 1 ? 'Runner-Up' : '3rd Place'
        })),
      },
      relegated: {
        fromT1: (postseason?.relegated?.fromT1 || []).map(t => ({
          name: t.name,
          wins: t.wins,
          losses: t.losses
        })),
        fromT2: (postseason?.relegated?.fromT2 || []).map(t => ({
          name: t.name,
          wins: t.wins,
          losses: t.losses
        })),
      },
    };
    
    // Set up callback for when user clicks "Begin Offseason"
    window._playoffEndContinueCallback = () => {
      // Close PlayoffHub and trigger offseason
      if (window._reactClosePlayoffHub) window._reactClosePlayoffHub();
      // Use the global window function set up in game-init.js
      if (window.continueAfterPostseason) {
        window.continueAfterPostseason();
      } else {
        console.error('❌ window.continueAfterPostseason not found');
      }
    };
    
    window._reactShowPlayoffEnd?.(modalData);
  }, [gameState, userTeam, userTeamId, liveUserInPlayoffs]);

  if (!data) return null;

  const tierCtx = { 1: 'T1 · 30 teams · Conference format', 2: 'T2 · 86 teams · Single bracket', 3: 'T3 · 144 teams · Single bracket' };

  // Build bracket data from livePlayoffData
  const t1Bracket = livePlayoffData?.t1 || null;
  const t2Bracket = livePlayoffData?.t2 || null;
  const t3Bracket = livePlayoffData?.t3 || null;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      <PlayoffSidebar
        userTeam={userTeam}
        opponent={userSeriesState.opponent}
        userWins={userSeriesState.userWins}
        oppWins={userSeriesState.oppWins}
        isUserInSeries={userSeriesState.inSeries && !userSeriesState.complete}
        seriesOver={userSeriesState.complete}
        seriesProb={seriesProb}
        roundName={userSeriesState.round || 'Round 1'}
        bestOf={userSeriesState.bestOf}
        games={userSeriesState.games}
        nextGameNum={userSeriesState.nextGameNum}
        nextGameLocation={userSeriesState.nextGameIsHome ? 'home' : 'away'}
        userTeam_abbr={abbr(userTeam)}
        opp_abbr={abbr(userSeriesState.opponent)}
        otherSeriesList={otherSeriesList}
        onSimGame={handleSimGame}
        onWatch={handleWatch}
        onSimSeries={handleSimSeries}
        onSimToChampionship={handleSimToChampionship}
        // For eliminated users
        userInPlayoffs={liveUserInPlayoffs}
        userEliminated={userSeriesState.complete && userSeriesState.winner?.id !== userTeamId}
        onSimDay={handleSimDay}
        onSimRound={handleSimRound}
        // Playoffs complete
        playoffsComplete={livePlayoffData?.completed}
        onViewResults={handleViewResults}
        // Box score
        onShowBoxScore={handleShowBoxScore}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', height: 52, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-raised)', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Playoffs <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 400 }}>· {gameState?.season || '—'} Season</span>
          </span>
          <div style={{ display: 'flex' }}>
            {[1, 2, 3].map(t => <TierTab key={t} tier={t} active={activeTab === t} onClick={() => setActiveTab(t)} />)}
            <div style={{ width: 1, background: 'var(--color-border)' }} />
          </div>
          <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>
            {liveCurrentDate || '—'}
          </div>
        </div>
        {/* Status bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 18px', background: 'var(--color-bg-sunken)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: TIER[activeTab].bg, border: `1px solid ${TIER[activeTab].border}`, fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: TIER[activeTab].color }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: TIER[activeTab].color, flexShrink: 0 }} />
            T{activeTab} Playoffs
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            {livePlayoffData?.completed ? 'Playoffs Complete' : 'Postseason in progress'}
          </div>
          <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary) ' }}>{tierCtx[activeTab]}</div>
        </div>
        {/* Bracket */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {activeTab === 1 && <T1BracketNew bracket={t1Bracket} schedule={livePlayoffSchedule} userTeamId={userTeamId} />}
          {activeTab === 2 && <T2BracketNew bracket={t2Bracket} schedule={livePlayoffSchedule} userTeamId={userTeamId} />}
          {activeTab === 3 && <T3BracketNew bracket={t3Bracket} schedule={livePlayoffSchedule} userTeamId={userTeamId} />}
        </div>
      </div>
    </div>
  );
}

// ─── T1 Bracket (new data structure) ─────────────────────────────────────────
function T1BracketNew({ bracket, schedule, userTeamId }) {
  if (!bracket) {
    return <div style={{ padding: 32, color: 'var(--color-text-tertiary)', fontSize: 12 }}>Loading bracket...</div>;
  }

  const eastTeams = bracket.east || [];
  const westTeams = bracket.west || [];

  // Helper to get series record from schedule
  const getSeriesRecord = (seriesId) => {
    if (!schedule?.bySeries?.[seriesId]) return { w1: 0, w2: 0, complete: false, winner: null, higherSeed: null, lowerSeed: null };
    const games = schedule.bySeries[seriesId];
    let w1 = 0, w2 = 0;
    const firstGame = games[0];
    // Find team objects from any game in series
    let higherSeed = null, lowerSeed = null;
    for (const g of games) {
      if (!higherSeed && g.homeTeam?.id === firstGame.higherSeedId) higherSeed = g.homeTeam;
      if (!higherSeed && g.awayTeam?.id === firstGame.higherSeedId) higherSeed = g.awayTeam;
      if (!lowerSeed && g.homeTeam?.id === firstGame.lowerSeedId) lowerSeed = g.homeTeam;
      if (!lowerSeed && g.awayTeam?.id === firstGame.lowerSeedId) lowerSeed = g.awayTeam;
      if (higherSeed && lowerSeed) break;
    }
    for (const g of games) {
      if (g.played && g.result?.winner) {
        if (g.result.winner.id === firstGame.higherSeedId) w1++;
        else w2++;
      }
    }
    const bestOf = firstGame?.bestOf || 7;
    const winsNeeded = Math.ceil(bestOf / 2);
    const complete = w1 >= winsNeeded || w2 >= winsNeeded;
    const winner = complete ? (w1 >= winsNeeded ? higherSeed : lowerSeed) : null;
    return { w1, w2, complete, winner, higherSeed, lowerSeed };
  };

  // T1 Series card component with tooltips
  const T1SeriesCard = ({ higher, lower, s1, s2, w1, w2, complete, isUser, isFinals }) => {
    const width = isFinals ? 130 : 110;
    if (!higher && !lower) {
      return (
        <div style={{
          width, padding: isFinals ? '8px 10px' : '5px 8px',
          background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border)',
          fontSize: isFinals ? 12 : 10, color: 'var(--color-text-tertiary)', textAlign: 'center',
        }}>
          TBD
        </div>
      );
    }
    return (
      <div style={{
        width, padding: isFinals ? '6px 10px' : '5px 8px',
        background: isUser ? 'var(--color-tier1-bg)' : 'var(--color-bg-raised)',
        border: `1px solid ${isUser ? 'rgba(212,168,67,0.3)' : 'var(--color-border)'}`,
        overflow: 'visible',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: isFinals ? 12 : 10, marginBottom: 2, overflow: 'visible' }}>
          {s1 !== undefined && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-tertiary)', minWidth: 10 }}>{s1}</span>}
          <span style={{ flex: 1, overflow: 'visible' }}>
            <TeamName team={higher} style={{ fontWeight: complete && w1 > w2 ? 700 : 400, color: complete && w1 < w2 ? 'var(--color-text-tertiary)' : 'var(--color-text)' }} />
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: isFinals ? 11 : 9 }}>{w1}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: isFinals ? 12 : 10, overflow: 'visible' }}>
          {s2 !== undefined && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-tertiary)', minWidth: 10 }}>{s2}</span>}
          <span style={{ flex: 1, overflow: 'visible' }}>
            <TeamName team={lower} style={{ fontWeight: complete && w2 > w1 ? 700 : 400, color: complete && w2 < w1 ? 'var(--color-text-tertiary)' : 'var(--color-text)' }} />
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: isFinals ? 11 : 9 }}>{w2}</span>
        </div>
      </div>
    );
  };

  // Round 1 matchups: 1v8, 4v5, 2v7, 3v6 in each conference
  const r1Matchups = [
    { conf: 'East', pairs: [[0, 7], [3, 4], [1, 6], [2, 5]] },
    { conf: 'West', pairs: [[0, 7], [3, 4], [1, 6], [2, 5]] }
  ];

  // Build Round 1 cards and track winners for Round 2
  const allR1Cards = [];
  const r1Winners = { east: [], west: [] };
  
  for (const { conf, pairs } of r1Matchups) {
    const teams = conf === 'East' ? eastTeams : westTeams;
    const confKey = conf.toLowerCase();
    
    for (const [hi, lo] of pairs) {
      const higher = teams[hi];
      const lower = teams[lo];
      const seriesId = `t1-r1-${confKey}-${hi + 1}v${lo + 1}`;
      const rec = getSeriesRecord(seriesId);
      
      r1Winners[confKey].push(rec.winner);
      
      allR1Cards.push(
        <Slot key={seriesId} h={65}>
          <T1SeriesCard
            higher={higher} lower={lower}
            s1={hi + 1} s2={lo + 1}
            w1={rec.w1} w2={rec.w2} complete={rec.complete}
            isUser={higher?.id === userTeamId || lower?.id === userTeamId}
          />
        </Slot>
      );
    }
  }

  // Round 2 (Conf Semis) matchups
  const r2SeriesIds = [
    { conf: 'east', id: 't1-r2-east-1' },
    { conf: 'east', id: 't1-r2-east-2' },
    { conf: 'west', id: 't1-r2-west-1' },
    { conf: 'west', id: 't1-r2-west-2' }
  ];
  
  const r2Cards = [];
  const r2Winners = { east: [], west: [] };
  
  for (let i = 0; i < r2SeriesIds.length; i++) {
    const { conf, id } = r2SeriesIds[i];
    const rec = getSeriesRecord(id);
    const idx = i % 2;
    
    let higher = rec.higherSeed || r1Winners[conf][idx * 2];
    let lower = rec.lowerSeed || r1Winners[conf][idx * 2 + 1];
    
    r2Winners[conf].push(rec.winner);
    
    r2Cards.push(
      <Slot key={id} h={130}>
        <T1SeriesCard
          higher={higher} lower={lower}
          w1={rec.w1} w2={rec.w2} complete={rec.complete}
          isUser={higher?.id === userTeamId || lower?.id === userTeamId}
        />
      </Slot>
    );
  }

  // Conference Finals
  const cfSeriesIds = [
    { conf: 'east', id: 't1-cf-east' },
    { conf: 'west', id: 't1-cf-west' }
  ];
  
  const cfCards = [];
  const cfWinners = { east: null, west: null };
  
  for (const { conf, id } of cfSeriesIds) {
    const rec = getSeriesRecord(id);
    
    let higher = rec.higherSeed || r2Winners[conf][0];
    let lower = rec.lowerSeed || r2Winners[conf][1];
    
    cfWinners[conf] = rec.winner;
    
    cfCards.push(
      <Slot key={id} h={260}>
        <T1SeriesCard
          higher={higher} lower={lower}
          w1={rec.w1} w2={rec.w2} complete={rec.complete}
          isUser={higher?.id === userTeamId || lower?.id === userTeamId}
        />
      </Slot>
    );
  }

  // Finals
  const finalsRec = getSeriesRecord('t1-finals');
  const finalsHigher = finalsRec.higherSeed || cfWinners.east;
  const finalsLower = finalsRec.lowerSeed || cfWinners.west;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader>Round 1</ColHeader>
        {allR1Cards}
      </div>
      <ConnCol slots={8} slotH={65} />
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader>Conf. Semis</ColHeader>
        {r2Cards}
      </div>
      <ConnCol slots={4} slotH={130} />
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader>Conf. Finals</ColHeader>
        {cfCards}
      </div>
      <ConnCol slots={2} slotH={260} />
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader tier={1}>Finals</ColHeader>
        <Slot h={520}>
          <T1SeriesCard
            higher={finalsHigher} lower={finalsLower}
            w1={finalsRec.w1} w2={finalsRec.w2} complete={finalsRec.complete}
            isUser={finalsHigher?.id === userTeamId || finalsLower?.id === userTeamId}
            isFinals
          />
        </Slot>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', width: 20, flexShrink: 0, paddingTop: 28, alignItems: 'center' }}>
        <div style={{ height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'rgba(212,168,67,0.5)', fontSize: 14, fontFamily: 'var(--font-mono)' }}>›</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader tier={1}>Champion</ColHeader>
        <Slot h={520}>
          {finalsRec.complete && finalsRec.winner ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 12 }}>
              <div style={{ width: 12, height: 12, background: 'var(--color-tier1)', marginBottom: 8 }} />
              <div style={{ fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--color-tier1)', marginBottom: 4 }}>T1 CHAMPION</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{finalsRec.winner.name}</div>
            </div>
          ) : (
            <ChampCard tier={1} />
          )}
        </Slot>
      </div>
    </div>
  );
}

// ─── T2 Bracket (new data structure) ─────────────────────────────────────────
function T2BracketNew({ bracket, schedule, userTeamId }) {
  if (!bracket) {
    return <div style={{ padding: 32, color: 'var(--color-text-tertiary)', fontSize: 12 }}>Loading bracket...</div>;
  }

  // Helper to get series record from schedule
  const getSeriesRecord = (seriesId) => {
    if (!schedule?.bySeries?.[seriesId]) return { w1: 0, w2: 0, complete: false, winner: null, higherSeed: null, lowerSeed: null };
    const games = schedule.bySeries[seriesId];
    let w1 = 0, w2 = 0;
    const firstGame = games[0];
    // Find team objects from any game in series
    let higherSeed = null, lowerSeed = null;
    for (const g of games) {
      if (!higherSeed && g.homeTeam?.id === firstGame.higherSeedId) higherSeed = g.homeTeam;
      if (!higherSeed && g.awayTeam?.id === firstGame.higherSeedId) higherSeed = g.awayTeam;
      if (!lowerSeed && g.homeTeam?.id === firstGame.lowerSeedId) lowerSeed = g.homeTeam;
      if (!lowerSeed && g.awayTeam?.id === firstGame.lowerSeedId) lowerSeed = g.awayTeam;
      if (higherSeed && lowerSeed) break;
    }
    for (const g of games) {
      if (g.played && g.result?.winner) {
        if (g.result.winner.id === firstGame.higherSeedId) w1++;
        else w2++;
      }
    }
    const bestOf = firstGame?.bestOf || 3;
    const winsNeeded = Math.ceil(bestOf / 2);
    const complete = w1 >= winsNeeded || w2 >= winsNeeded;
    const winner = complete ? (w1 >= winsNeeded ? higherSeed : lowerSeed) : null;
    return { w1, w2, complete, winner, higherSeed, lowerSeed };
  };

  // Build division cards with series results
  const divisionCards = (bracket.divisionBrackets || []).map(div => {
    const divId = div.division.toLowerCase().replace(/\s+/g, '-');
    const s1Rec = getSeriesRecord(`t2-div-${divId}-s1`);
    const s2Rec = getSeriesRecord(`t2-div-${divId}-s2`);
    const finalRec = getSeriesRecord(`t2-div-${divId}-final`);
    
    return {
      division: div.division,
      divId,
      seed1: div.seed1, seed2: div.seed2, seed3: div.seed3, seed4: div.seed4,
      s1: s1Rec,
      s2: s2Rec,
      final: finalRec,
    };
  });

  // Build national tournament cards
  const natR1Cards = [];
  for (let i = 1; i <= 8; i++) {
    const rec = getSeriesRecord(`t2-nat-r1-${i}`);
    natR1Cards.push({ seriesId: `t2-nat-r1-${i}`, idx: i, ...rec });
  }
  
  const natQFCards = [];
  for (let i = 1; i <= 4; i++) {
    const rec = getSeriesRecord(`t2-nat-qf-${i}`);
    natQFCards.push({ seriesId: `t2-nat-qf-${i}`, idx: i, ...rec });
  }
  
  const natSFCards = [];
  for (let i = 1; i <= 2; i++) {
    const rec = getSeriesRecord(`t2-nat-sf-${i}`);
    natSFCards.push({ seriesId: `t2-nat-sf-${i}`, idx: i, ...rec });
  }
  
  const finalsRec = getSeriesRecord('t2-finals');
  const thirdPlaceRec = getSeriesRecord('t2-3rd-place');

  // Division series card (compact)
  const DivSeriesCard = ({ higher, lower, w1, w2, complete, isUser }) => {
    if (!higher && !lower) {
      return (
        <div style={{
          width: 56, padding: '4px 5px',
          background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border)',
          fontSize: 9, color: 'var(--color-text-tertiary)', textAlign: 'center',
        }}>
          TBD
        </div>
      );
    }
    return (
      <div style={{
        width: 56, padding: '4px 5px',
        background: isUser ? 'var(--color-tier2-bg)' : 'var(--color-bg-raised)',
        border: `1px solid ${isUser ? 'rgba(138,138,138,0.3)' : 'var(--color-border)'}`,
        fontSize: 9,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <TeamName team={higher} style={{ fontWeight: complete && w1 > w2 ? 600 : 400, color: complete && w1 < w2 ? 'var(--color-text-tertiary)' : 'var(--color-text)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }}>{w1}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <TeamName team={lower} style={{ fontWeight: complete && w2 > w1 ? 600 : 400, color: complete && w2 < w1 ? 'var(--color-text-tertiary)' : 'var(--color-text)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }}>{w2}</span>
        </div>
      </div>
    );
  };

  // National tournament series card (larger)
  const NatSeriesCard = ({ higher, lower, w1, w2, complete, isUser, isFinals }) => {
    const width = isFinals ? 90 : 76;
    if (!higher && !lower) {
      return (
        <div style={{
          width, padding: isFinals ? '6px 8px' : '4px 6px',
          background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border)',
          fontSize: isFinals ? 11 : 10, color: 'var(--color-text-tertiary)', textAlign: 'center',
        }}>
          TBD
        </div>
      );
    }
    return (
      <div style={{
        width, padding: isFinals ? '6px 8px' : '4px 6px',
        background: isUser ? 'var(--color-tier2-bg)' : 'var(--color-bg-raised)',
        border: `1px solid ${isUser ? 'rgba(138,138,138,0.3)' : 'var(--color-border)'}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isFinals ? 11 : 10 }}>
          <TeamName team={higher} style={{ fontWeight: complete && w1 > w2 ? 700 : 400, color: complete && w1 < w2 ? 'var(--color-text-tertiary)' : 'var(--color-text)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: isFinals ? 10 : 9 }}>{w1}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isFinals ? 11 : 10, marginTop: 1 }}>
          <TeamName team={lower} style={{ fontWeight: complete && w2 > w1 ? 700 : 400, color: complete && w2 < w1 ? 'var(--color-text-tertiary)' : 'var(--color-text)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: isFinals ? 10 : 9 }}>{w2}</span>
        </div>
      </div>
    );
  };

  // Horizontal division bracket component
  const DivisionBracket = ({ div, isUserDivision }) => (
    <div style={{
      padding: 10,
      background: isUserDivision ? 'var(--color-tier2-bg)' : 'var(--color-bg-raised)',
      border: `1px solid ${isUserDivision ? 'rgba(138,138,138,0.3)' : 'var(--color-border)'}`,
    }}>
      <div style={{ fontSize: 8, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', color: 'var(--color-text-secondary)', marginBottom: 6 }}>
        {div.division.toUpperCase()}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Semis column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <DivSeriesCard
            higher={div.seed1} lower={div.seed4}
            w1={div.s1.w1} w2={div.s1.w2} complete={div.s1.complete}
            isUser={div.seed1?.id === userTeamId || div.seed4?.id === userTeamId}
          />
          <DivSeriesCard
            higher={div.seed2} lower={div.seed3}
            w1={div.s2.w1} w2={div.s2.w2} complete={div.s2.complete}
            isUser={div.seed2?.id === userTeamId || div.seed3?.id === userTeamId}
          />
        </div>
        
        {/* Final */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <DivSeriesCard
            higher={div.final.higherSeed || div.s1.winner} 
            lower={div.final.lowerSeed || div.s2.winner}
            w1={div.final.w1} w2={div.final.w2} complete={div.final.complete}
            isUser={div.final.higherSeed?.id === userTeamId || div.final.lowerSeed?.id === userTeamId}
          />
          {div.final.winner && (
            <div style={{ fontSize: 7, fontWeight: 600, color: 'var(--color-tier2)', marginTop: 2, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
              CHAMP
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Bracket connector SVG
  const BracketConnector = ({ count, gap }) => {
    const itemHeight = 28;
    const totalHeight = count * itemHeight + (count - 1) * gap;
    const midY = totalHeight / 2;
    
    return (
      <svg width="16" height={totalHeight} style={{ flexShrink: 0 }}>
        {Array.from({ length: count / 2 }).map((_, i) => {
          const topY = i * 2 * (itemHeight + gap) + itemHeight / 2 + gap * i;
          const bottomY = topY + itemHeight + gap;
          const outY = (topY + bottomY) / 2;
          return (
            <g key={i}>
              <path d={`M 0 ${topY} H 8 V ${outY} H 16`} stroke="var(--color-border)" strokeWidth="1" fill="none" />
              <path d={`M 0 ${bottomY} H 8 V ${outY} H 16`} stroke="var(--color-border)" strokeWidth="1" fill="none" />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
      {/* Division Playoffs Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ 
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', 
          letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', 
          marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--color-border)' 
        }}>
          STAGE 1 · DIVISION PLAYOFFS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {divisionCards.map((div, i) => {
            const userInDiv = [div.seed1?.id, div.seed2?.id, div.seed3?.id, div.seed4?.id].includes(userTeamId);
            return <DivisionBracket key={i} div={div} isUserDivision={userInDiv} />;
          })}
        </div>
      </div>

      {/* National Tournament Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ 
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', 
          letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', 
          marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--color-border)' 
        }}>
          STAGE 2 · NATIONAL TOURNAMENT
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          padding: 12,
          background: 'var(--color-bg-sunken)',
          border: '1px solid var(--color-border)',
          overflowX: 'auto',
        }}>
          {/* Round 1 */}
          <div>
            <div style={{ fontSize: 8, fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 6, textAlign: 'center' }}>
              ROUND 1
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {natR1Cards.map((card, i) => (
                <NatSeriesCard key={i}
                  higher={card.higherSeed} lower={card.lowerSeed}
                  w1={card.w1} w2={card.w2} complete={card.complete}
                  isUser={card.higherSeed?.id === userTeamId || card.lowerSeed?.id === userTeamId}
                />
              ))}
            </div>
          </div>
          
          <BracketConnector count={8} gap={4} />
          
          {/* Quarterfinals */}
          <div>
            <div style={{ fontSize: 8, fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 6, textAlign: 'center' }}>
              QUARTERS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
              {natQFCards.map((card, i) => (
                <NatSeriesCard key={i}
                  higher={card.higherSeed} lower={card.lowerSeed}
                  w1={card.w1} w2={card.w2} complete={card.complete}
                  isUser={card.higherSeed?.id === userTeamId || card.lowerSeed?.id === userTeamId}
                />
              ))}
            </div>
          </div>
          
          <BracketConnector count={4} gap={36} />
          
          {/* Semifinals */}
          <div>
            <div style={{ fontSize: 8, fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 6, textAlign: 'center' }}>
              SEMIS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 100 }}>
              {natSFCards.map((card, i) => (
                <NatSeriesCard key={i}
                  higher={card.higherSeed} lower={card.lowerSeed}
                  w1={card.w1} w2={card.w2} complete={card.complete}
                  isUser={card.higherSeed?.id === userTeamId || card.lowerSeed?.id === userTeamId}
                />
              ))}
            </div>
          </div>
          
          <BracketConnector count={2} gap={100} />
          
          {/* Finals */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 8, fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
              FINALS
            </div>
            <NatSeriesCard
              higher={finalsRec.higherSeed} lower={finalsRec.lowerSeed}
              w1={finalsRec.w1} w2={finalsRec.w2} complete={finalsRec.complete}
              isUser={finalsRec.higherSeed?.id === userTeamId || finalsRec.lowerSeed?.id === userTeamId}
              isFinals
            />
            
            {/* Champion display */}
            <div style={{ 
              marginTop: 12, 
              padding: '10px 16px', 
              background: 'var(--color-tier2-bg)', 
              border: '1px solid rgba(138,138,138,0.3)',
              textAlign: 'center',
            }}>
              <div style={{ width: 10, height: 10, background: 'var(--color-tier2)', margin: '0 auto 6px' }} />
              <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--color-tier2)', marginBottom: 2 }}>
                T2 CHAMPION
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: finalsRec.winner ? 'var(--color-text)' : 'var(--color-text-tertiary)' }}>
                {finalsRec.winner?.name || 'TBD'}
              </div>
            </div>
            
            {/* 3rd Place */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 7, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', marginBottom: 4, textAlign: 'center' }}>
                3RD PLACE
              </div>
              <NatSeriesCard
                higher={thirdPlaceRec.higherSeed} lower={thirdPlaceRec.lowerSeed}
                w1={thirdPlaceRec.w1} w2={thirdPlaceRec.w2} complete={thirdPlaceRec.complete}
                isUser={thirdPlaceRec.higherSeed?.id === userTeamId || thirdPlaceRec.lowerSeed?.id === userTeamId}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Explanation Section */}
      <div style={{ 
        padding: 12, 
        background: 'var(--color-bg-sunken)', 
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ 
          fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)', 
          letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 10 
        }}>
          HOW T2 PLAYOFFS WORK
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 10, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 3 }}>Stage 1: Division Playoffs</div>
            <div>Top 4 teams from each division compete in best-of-3 series. Division champions advance to the National Tournament.</div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 3 }}>Stage 2: National Tournament</div>
            <div>11 division champions + 5 best runners-up compete in a 16-team bracket. All rounds are best-of-5. Winner earns promotion to T1.</div>
          </div>
        </div>
        
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--color-border)', display: 'flex', gap: 16, fontSize: 9, color: 'var(--color-text-tertiary)' }}>
          <div><span style={{ fontWeight: 600 }}>Division:</span> Bo3</div>
          <div><span style={{ fontWeight: 600 }}>National:</span> Bo5</div>
          <div><span style={{ fontWeight: 600 }}>Promoted:</span> Champion + Runner-up + 3rd</div>
        </div>
      </div>
    </div>
  );
}

// ─── T3 Bracket (new data structure) ─────────────────────────────────────────
function T3BracketNew({ bracket, schedule, userTeamId }) {
  if (!bracket) {
    return <div style={{ padding: 32, color: 'var(--color-text-tertiary)', fontSize: 12 }}>Loading bracket...</div>;
  }

  // Helper to get series record from schedule
  const getSeriesRecord = (seriesId) => {
    if (!schedule?.bySeries?.[seriesId]) return { w1: 0, w2: 0, complete: false, winner: null, higherSeed: null, lowerSeed: null };
    const games = schedule.bySeries[seriesId];
    let w1 = 0, w2 = 0;
    const firstGame = games[0];
    // Find team objects from any game in series
    let higherSeed = null, lowerSeed = null;
    for (const g of games) {
      if (!higherSeed && g.homeTeam?.id === firstGame.higherSeedId) higherSeed = g.homeTeam;
      if (!higherSeed && g.awayTeam?.id === firstGame.higherSeedId) higherSeed = g.awayTeam;
      if (!lowerSeed && g.homeTeam?.id === firstGame.lowerSeedId) lowerSeed = g.homeTeam;
      if (!lowerSeed && g.awayTeam?.id === firstGame.lowerSeedId) lowerSeed = g.awayTeam;
      if (higherSeed && lowerSeed) break;
    }
    for (const g of games) {
      if (g.played && g.result?.winner) {
        if (g.result.winner.id === firstGame.higherSeedId) w1++;
        else w2++;
      }
    }
    const bestOf = firstGame?.bestOf || 3;
    const winsNeeded = Math.ceil(bestOf / 2);
    const complete = w1 >= winsNeeded || w2 >= winsNeeded;
    const winner = complete ? (w1 >= winsNeeded ? higherSeed : lowerSeed) : null;
    return { w1, w2, complete, winner, higherSeed, lowerSeed };
  };

  // National tournament series card
  const NatSeriesCard = ({ higher, lower, w1, w2, complete, isUser, isFinals }) => {
    const width = isFinals ? 90 : 76;
    if (!higher && !lower) {
      return (
        <div style={{
          width, padding: isFinals ? '6px 8px' : '4px 6px',
          background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border)',
          fontSize: isFinals ? 11 : 10, color: 'var(--color-text-tertiary)', textAlign: 'center',
        }}>
          TBD
        </div>
      );
    }
    return (
      <div style={{
        width, padding: isFinals ? '6px 8px' : '4px 6px',
        background: isUser ? 'var(--color-tier3-bg)' : 'var(--color-bg-raised)',
        border: `1px solid ${isUser ? 'rgba(179,115,64,0.3)' : 'var(--color-border)'}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isFinals ? 11 : 10 }}>
          <TeamName team={higher} style={{ fontWeight: complete && w1 > w2 ? 700 : 400, color: complete && w1 < w2 ? 'var(--color-text-tertiary)' : 'var(--color-text)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: isFinals ? 10 : 9 }}>{w1}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isFinals ? 11 : 10, marginTop: 1 }}>
          <TeamName team={lower} style={{ fontWeight: complete && w2 > w1 ? 700 : 400, color: complete && w2 < w1 ? 'var(--color-text-tertiary)' : 'var(--color-text)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: isFinals ? 10 : 9 }}>{w2}</span>
        </div>
      </div>
    );
  };

  // Bracket connector SVG
  const BracketConnector = ({ count, gap }) => {
    const itemHeight = 28;
    const totalHeight = count * itemHeight + (count - 1) * gap;
    
    return (
      <svg width="16" height={totalHeight} style={{ flexShrink: 0 }}>
        {Array.from({ length: count / 2 }).map((_, i) => {
          const topY = i * 2 * (itemHeight + gap) + itemHeight / 2 + gap * i;
          const bottomY = topY + itemHeight + gap;
          const outY = (topY + bottomY) / 2;
          return (
            <g key={i}>
              <path d={`M 0 ${topY} H 8 V ${outY} H 16`} stroke="var(--color-border)" strokeWidth="1" fill="none" />
              <path d={`M 0 ${bottomY} H 8 V ${outY} H 16`} stroke="var(--color-border)" strokeWidth="1" fill="none" />
            </g>
          );
        })}
      </svg>
    );
  };

  // Build metro finals cards
  const metroCards = (bracket.metroMatchups || []).map(m => {
    const divId = m.division.toLowerCase().replace(/\s+/g, '-');
    const rec = getSeriesRecord(`t3-metro-${divId}`);
    return {
      division: m.division,
      seed1: m.seed1,
      seed2: m.seed2,
      ...rec,
    };
  });

  // Build regional cards
  const regionalCards = [];
  for (let i = 1; i <= 8; i++) {
    const rec = getSeriesRecord(`t3-regional-${i}`);
    regionalCards.push({ idx: i, ...rec });
  }

  // Build Sweet 16 cards
  const sweet16Cards = [];
  for (let i = 1; i <= 8; i++) {
    const rec = getSeriesRecord(`t3-sweet16-${i}`);
    sweet16Cards.push({ idx: i, ...rec });
  }

  // Build QF cards
  const qfCards = [];
  for (let i = 1; i <= 4; i++) {
    const rec = getSeriesRecord(`t3-qf-${i}`);
    qfCards.push({ idx: i, ...rec });
  }

  // Build SF cards
  const sfCards = [];
  for (let i = 1; i <= 2; i++) {
    const rec = getSeriesRecord(`t3-sf-${i}`);
    sfCards.push({ idx: i, ...rec });
  }

  // Finals
  const finalsRec = getSeriesRecord('t3-finals');
  const thirdPlaceRec = getSeriesRecord('t3-3rd-place');

  return (
    <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
      {/* Metro Finals Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ 
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', 
          letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', 
          marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--color-border)' 
        }}>
          STAGE 1 · METRO FINALS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
          {metroCards.map((m, i) => {
            const isUser = m.seed1?.id === userTeamId || m.seed2?.id === userTeamId;
            return (
              <div key={i} style={{
                padding: 6,
                background: isUser ? 'var(--color-tier3-bg)' : 'var(--color-bg-raised)',
                border: `1px solid ${isUser ? 'rgba(179,115,64,0.3)' : 'var(--color-border)'}`,
              }}>
                <div style={{ fontSize: 8, fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.division}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
                  <div style={{ flex: 1 }}>
                    <div><TeamName team={m.seed1} style={{ fontWeight: m.complete && m.w1 > m.w2 ? 600 : 400, color: m.complete && m.w1 < m.w2 ? 'var(--color-text-tertiary)' : 'var(--color-text)' }} /></div>
                    <div><TeamName team={m.seed2} style={{ fontWeight: m.complete && m.w2 > m.w1 ? 600 : 400, color: m.complete && m.w2 < m.w1 ? 'var(--color-text-tertiary)' : 'var(--color-text)' }} /></div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }}>
                    <div>{m.w1}</div>
                    <div>{m.w2}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* National Tournament Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ 
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', 
          letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', 
          marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--color-border)' 
        }}>
          STAGE 2 · NATIONAL TOURNAMENT
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          padding: 12,
          background: 'var(--color-bg-sunken)',
          border: '1px solid var(--color-border)',
          overflowX: 'auto',
        }}>
          {/* Regional Round */}
          <div>
            <div style={{ fontSize: 8, fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 6, textAlign: 'center' }}>
              REGIONAL
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {regionalCards.map((card, i) => (
                <NatSeriesCard key={i}
                  higher={card.higherSeed} lower={card.lowerSeed}
                  w1={card.w1} w2={card.w2} complete={card.complete}
                  isUser={card.higherSeed?.id === userTeamId || card.lowerSeed?.id === userTeamId}
                />
              ))}
            </div>
          </div>
          
          <BracketConnector count={8} gap={4} />
          
          {/* Sweet 16 */}
          <div>
            <div style={{ fontSize: 8, fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 6, textAlign: 'center' }}>
              SWEET 16
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
              {sweet16Cards.map((card, i) => (
                <NatSeriesCard key={i}
                  higher={card.higherSeed} lower={card.lowerSeed}
                  w1={card.w1} w2={card.w2} complete={card.complete}
                  isUser={card.higherSeed?.id === userTeamId || card.lowerSeed?.id === userTeamId}
                />
              ))}
            </div>
          </div>
          
          <BracketConnector count={8} gap={36} />
          
          {/* Quarterfinals */}
          <div>
            <div style={{ fontSize: 8, fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 6, textAlign: 'center' }}>
              QUARTERS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 104 }}>
              {qfCards.map((card, i) => (
                <NatSeriesCard key={i}
                  higher={card.higherSeed} lower={card.lowerSeed}
                  w1={card.w1} w2={card.w2} complete={card.complete}
                  isUser={card.higherSeed?.id === userTeamId || card.lowerSeed?.id === userTeamId}
                />
              ))}
            </div>
          </div>
          
          <BracketConnector count={4} gap={104} />
          
          {/* Semifinals */}
          <div>
            <div style={{ fontSize: 8, fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 6, textAlign: 'center' }}>
              SEMIS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 240 }}>
              {sfCards.map((card, i) => (
                <NatSeriesCard key={i}
                  higher={card.higherSeed} lower={card.lowerSeed}
                  w1={card.w1} w2={card.w2} complete={card.complete}
                  isUser={card.higherSeed?.id === userTeamId || card.lowerSeed?.id === userTeamId}
                />
              ))}
            </div>
          </div>
          
          <BracketConnector count={2} gap={240} />
          
          {/* Finals */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 8, fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
              FINALS
            </div>
            <NatSeriesCard
              higher={finalsRec.higherSeed} lower={finalsRec.lowerSeed}
              w1={finalsRec.w1} w2={finalsRec.w2} complete={finalsRec.complete}
              isUser={finalsRec.higherSeed?.id === userTeamId || finalsRec.lowerSeed?.id === userTeamId}
              isFinals
            />
            
            {/* Champion display */}
            <div style={{ 
              marginTop: 12, 
              padding: '10px 16px', 
              background: 'var(--color-tier3-bg)', 
              border: '1px solid rgba(179,115,64,0.3)',
              textAlign: 'center',
            }}>
              <div style={{ width: 10, height: 10, background: 'var(--color-tier3)', margin: '0 auto 6px' }} />
              <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--color-tier3)', marginBottom: 2 }}>
                T3 CHAMPION
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: finalsRec.winner ? 'var(--color-text)' : 'var(--color-text-tertiary)' }}>
                {finalsRec.winner?.name || 'TBD'}
              </div>
            </div>
            
            {/* 3rd Place */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 7, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', marginBottom: 4, textAlign: 'center' }}>
                3RD PLACE
              </div>
              <NatSeriesCard
                higher={thirdPlaceRec.higherSeed} lower={thirdPlaceRec.lowerSeed}
                w1={thirdPlaceRec.w1} w2={thirdPlaceRec.w2} complete={thirdPlaceRec.complete}
                isUser={thirdPlaceRec.higherSeed?.id === userTeamId || thirdPlaceRec.lowerSeed?.id === userTeamId}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Explanation Section */}
      <div style={{ 
        padding: 12, 
        background: 'var(--color-bg-sunken)', 
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ 
          fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)', 
          letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', marginBottom: 10 
        }}>
          HOW T3 PLAYOFFS WORK
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 10, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 3 }}>Stage 1: Metro Finals</div>
            <div>24 metro divisions each crown a champion in best-of-3 series. All 24 winners advance to the National Tournament.</div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 3 }}>Stage 2: National Tournament</div>
            <div>Top 8 metro winners get byes to Sweet 16. Teams 9-24 play Regional round. From Sweet 16 onward, all rounds are best-of-5. Winner earns promotion to T2.</div>
          </div>
        </div>
        
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--color-border)', display: 'flex', gap: 16, fontSize: 9, color: 'var(--color-text-tertiary)' }}>
          <div><span style={{ fontWeight: 600 }}>Metro:</span> Bo3</div>
          <div><span style={{ fontWeight: 600 }}>Regional:</span> Bo3</div>
          <div><span style={{ fontWeight: 600 }}>Sweet 16+:</span> Bo5</div>
          <div><span style={{ fontWeight: 600 }}>Promoted:</span> Champion + Runner-up + 3rd</div>
        </div>
      </div>
    </div>
  );
}
