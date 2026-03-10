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

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function PlayoffSidebar({
  userTeam, opponent, userWins, oppWins, isUserInSeries, seriesOver,
  seriesProb, roundName, bestOf, games, nextGameNum, nextGameLocation,
  userTeam_abbr, opp_abbr, otherSeriesList,
  onSimGame, onWatch, onSimSeries, onSimToChampionship,
}) {
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
        <Label>{isUserInSeries ? 'Your Series' : 'Playoffs'}</Label>
        {isUserInSeries ? (
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

      {seriesOver && isUserInSeries && (
        <SbSection>
          <div style={{ textAlign: 'center', padding: '6px 0', fontSize: 12, fontWeight: 700, color: userWins > oppWins ? 'var(--color-win)' : 'var(--color-loss)' }}>
            {userWins > oppWins ? 'Series Won' : 'Series Lost'} · {userWins}–{oppWins}
          </div>
        </SbSection>
      )}

      {/* Controls */}
      <SbSection>
        {isUserInSeries && !seriesOver && (
          <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
            <Btn variant="primary" onClick={onSimGame}>Game {nextGameNum} ›</Btn>
            <Btn variant="watch" onClick={onWatch}>Watch</Btn>
            <Btn variant="ghost" onClick={onSimSeries}>Series</Btn>
          </div>
        )}
        <Btn variant="sim" onClick={onSimToChampionship} style={{ width: '100%', flex: 'none', padding: '7px 0' }}>
          Sim to Championship ›
        </Btn>
      </SbSection>

      {/* Game Log */}
      {isUserInSeries && (
        <SbSection>
          <Label>Game Log</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {games.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 4px', fontSize: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-tertiary)', minWidth: 13 }}>G{i + 1}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 500, padding: '1px 4px', background: g.winner ? 'var(--color-win-bg)' : 'var(--color-loss-bg)', color: g.winner ? 'var(--color-win)' : 'var(--color-loss)' }}>
                  {g.winner ? 'W' : 'L'}
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
          {[
            ['OVR', userTeam?.rating ?? '—'],
            ['PPG', userTeam?.ppg != null ? userTeam.ppg.toFixed(1) : '—'],
            ['OPP PPG', userTeam?.oppPpg != null ? userTeam.oppPpg.toFixed(1) : '—'],
            ['NET RTG', userTeam?.netRating != null ? (userTeam.netRating >= 0 ? '+' : '') + userTeam.netRating.toFixed(1) : '—'],
          ].map(([lbl, val]) => (
            <React.Fragment key={lbl}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', alignSelf: 'center' }}>{lbl}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, textAlign: 'right', color: lbl === 'NET RTG' && userTeam?.netRating != null ? (userTeam.netRating >= 0 ? 'var(--color-win)' : 'var(--color-loss)') : 'var(--color-text)' }}>{val}</span>
            </React.Fragment>
          ))}
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

// ─── Matchup card ─────────────────────────────────────────────────────────────
function MatchupCard({ s1, n1, fn1, w1, s2, n2, fn2, w2, isUser, isLive, isDone, gameLabel }) {
  const [tip1, setTip1] = useState(false);
  const [tip2, setTip2] = useState(false);
  const w1Leading = w1 > w2, w2Leading = w2 > w1;
  const winner1 = isDone && w1Leading, winner2 = isDone && w2Leading;
  const Tip = ({ text, show }) => show ? (
    <div style={{ position: 'absolute', left: 0, top: -24, zIndex: 9999, background: 'var(--color-text)', color: 'var(--color-text-inverse)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{text}</div>
  ) : null;
  return (
    <div style={{ width: 130, border: isUser ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border)', borderLeft: isUser ? '3px solid var(--color-accent)' : undefined, background: 'var(--color-bg-raised)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'visible', position: 'relative', opacity: isDone ? 0.62 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', gap: 4, borderBottom: '1px solid var(--color-border-subtle)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-tertiary)', minWidth: 11 }}>{s1}</span>
        <span style={{ flex: 1, fontWeight: isUser ? 700 : winner1 ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, position: 'relative', cursor: 'default', color: isUser ? 'var(--color-accent)' : winner1 ? 'var(--color-win)' : winner2 ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)', textDecoration: winner2 ? 'line-through' : 'none' }} onMouseEnter={() => fn1 && setTip1(true)} onMouseLeave={() => setTip1(false)}>
          <Tip text={fn1} show={tip1} />{n1}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, minWidth: 10, textAlign: 'right', color: winner1 ? 'var(--color-win)' : w1Leading && !isDone ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}>{w1}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', gap: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-tertiary)', minWidth: 11 }}>{s2}</span>
        <span style={{ flex: 1, fontWeight: winner2 ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, position: 'relative', cursor: 'default', color: winner2 ? 'var(--color-win)' : winner1 ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)', textDecoration: winner1 ? 'line-through' : 'none' }} onMouseEnter={() => fn2 && setTip2(true)} onMouseLeave={() => setTip2(false)}>
          <Tip text={fn2} show={tip2} />{n2}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, minWidth: 10, textAlign: 'right', color: winner2 ? 'var(--color-win)' : w2Leading && !isDone ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}>{w2}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderTop: '1px solid var(--color-border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.03em', background: isLive ? 'var(--color-win-bg)' : 'var(--color-bg-sunken)', color: isLive ? 'var(--color-win)' : 'var(--color-text-tertiary)' }}>
        {isLive && <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-win)', flexShrink: 0 }} />}
        {gameLabel}
      </div>
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

// ─── T1 Bracket ──────────────────────────────────────────────────────────────
function T1Bracket({ cpd, postseasonT1, userTeamId }) {
  const eastTeams = cpd?.eastTeams || [];
  const westTeams = cpd?.westTeams || [];
  const roundResults = cpd?.roundResults || [];
  const r1 = roundResults[0] || [];

  const getSeriesRec = (results, conf, idx) => {
    const matching = (results || []).filter(r => r && (!conf || r.conf === conf));
    const s = matching[idx];
    if (!s) return null;
    return { w1: s.result?.higherSeedWins ?? s.result?.higherWins ?? 0, w2: s.result?.lowerSeedWins ?? s.result?.lowerWins ?? 0, winner: s.result?.winner || null, done: !!(s.result?.winner) };
  };

  const isUser = (t) => t?.id === userTeamId;

  const buildCard = (higher, lower, rec, roundLabel) => {
    if (!higher && !lower) return <FutureCard key="f" label={roundLabel} />;
    const w1 = rec?.w1 ?? 0, w2 = rec?.w2 ?? 0;
    const live = !!(cpd?.currentRound) && !rec?.done;
    return (
      <MatchupCard
        s1={higher?.seed ?? '?'} n1={abbr(higher)} fn1={higher?.name} w1={w1}
        s2={lower?.seed ?? '?'} n2={abbr(lower)} fn2={lower?.name} w2={w2}
        isUser={isUser(higher) || isUser(lower)}
        isLive={live && !rec?.done} isDone={rec?.done}
        gameLabel={rec?.done ? `✓ ${w1}–${w2}` : live ? `G${w1 + w2 + 1} Tonight` : roundLabel}
      />
    );
  };

  const r1E = eastTeams.length >= 8 ? [
    { higher: eastTeams[0], lower: eastTeams[7], rec: getSeriesRec(r1, 'East', 0) },
    { higher: eastTeams[3], lower: eastTeams[4], rec: getSeriesRec(r1, 'East', 1) },
    { higher: eastTeams[1], lower: eastTeams[6], rec: getSeriesRec(r1, 'East', 2) },
    { higher: eastTeams[2], lower: eastTeams[5], rec: getSeriesRec(r1, 'East', 3) },
  ] : Array.from({ length: 4 }).map(() => ({ higher: null, lower: null, rec: null }));

  const r1W = westTeams.length >= 8 ? [
    { higher: westTeams[0], lower: westTeams[7], rec: getSeriesRec(r1, 'West', 0) },
    { higher: westTeams[3], lower: westTeams[4], rec: getSeriesRec(r1, 'West', 1) },
    { higher: westTeams[1], lower: westTeams[6], rec: getSeriesRec(r1, 'West', 2) },
    { higher: westTeams[2], lower: westTeams[5], rec: getSeriesRec(r1, 'West', 3) },
  ] : Array.from({ length: 4 }).map(() => ({ higher: null, lower: null, rec: null }));

  const allR1 = [...r1E, ...r1W];

  if (!eastTeams.length && !westTeams.length && !postseasonT1) {
    return <div style={{ padding: 32, color: 'var(--color-text-tertiary)', fontSize: 12 }}>Bracket data loading…</div>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader>Round 1</ColHeader>
        {allR1.map((m, i) => <Slot key={i} h={58}>{buildCard(m.higher, m.lower, m.rec, 'R1')}</Slot>)}
      </div>
      <ConnCol slots={8} slotH={58} />
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader>Conf. Quarters</ColHeader>
        {Array.from({ length: 4 }).map((_, i) => <Slot key={i} h={116}><FutureCard label="Round 2" /></Slot>)}
      </div>
      <ConnCol slots={4} slotH={116} />
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader>Conf. Semis</ColHeader>
        {Array.from({ length: 2 }).map((_, i) => <Slot key={i} h={232}><FutureCard label="Conf. Semis" /></Slot>)}
      </div>
      <ConnCol slots={2} slotH={232} />
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader>Conf. Finals</ColHeader>
        {Array.from({ length: 2 }).map((_, i) => <Slot key={i} h={464}><FutureCard label="Conf. Finals" /></Slot>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', width: 20, flexShrink: 0, paddingTop: 28, alignItems: 'center' }}>
        <div style={{ height: 928, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'rgba(212,168,67,0.5)', fontSize: 14, fontFamily: 'var(--font-mono)' }}>›</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader tier={1}>Championship</ColHeader>
        <Slot h={928}><ChampCard tier={1} /></Slot>
      </div>
    </div>
  );
}

// ─── T2 / T3 Single Bracket ───────────────────────────────────────────────────
function SingleBracket({ tier, data, userTeamId }) {
  const rounds = data?.rounds || [];
  const r1 = rounds[0] || [];
  const cc = tier === 2 ? { silver: true } : { bronze: true };

  const r1Cards = r1.length > 0
    ? r1.map((s, i) => {
        const higher = s.result?.higherSeed || s.higher;
        const lower = s.result?.lowerSeed || s.lower;
        const w1 = s.result?.higherSeedWins ?? s.result?.higherWins ?? 0;
        const w2 = s.result?.lowerSeedWins ?? s.result?.lowerWins ?? 0;
        const done = !!(s.result?.winner);
        return (
          <Slot key={i} h={58}>
            <MatchupCard
              s1={higher?.seed ?? '?'} n1={abbr(higher)} fn1={higher?.name} w1={w1}
              s2={lower?.seed ?? '?'} n2={abbr(lower)} fn2={lower?.name} w2={w2}
              isUser={higher?.id === userTeamId || lower?.id === userTeamId}
              isLive={!done} isDone={done}
              gameLabel={done ? `✓ ${w1}–${w2}` : `G${w1 + w2 + 1} Tonight`}
            />
          </Slot>
        );
      })
    : Array.from({ length: 8 }).map((_, i) => <Slot key={i} h={58}><FutureCard label="R1" /></Slot>);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader tier={tier}>Round 1</ColHeader>
        {r1Cards}
      </div>
      <ConnCol slots={8} slotH={58} {...cc} />
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader tier={tier}>Quarterfinals</ColHeader>
        {Array.from({ length: 4 }).map((_, i) => <Slot key={i} h={116}><FutureCard label="QF" /></Slot>)}
      </div>
      <ConnCol slots={4} slotH={116} {...cc} />
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader tier={tier}>Semifinals</ColHeader>
        {Array.from({ length: 2 }).map((_, i) => <Slot key={i} h={232}><FutureCard label="SF" /></Slot>)}
      </div>
      <ConnCol slots={2} slotH={232} {...cc} />
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader tier={tier}>Final</ColHeader>
        <Slot h={464}><FutureCard label="Final" /></Slot>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', width: 20, flexShrink: 0, paddingTop: 28, alignItems: 'center' }}>
        <div style={{ height: 464, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: TIER[tier].border, fontSize: 14, fontFamily: 'var(--font-mono)' }}>›</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ColHeader tier={tier}>Champion</ColHeader>
        <Slot h={464}><ChampCard tier={tier} /></Slot>
      </div>
    </div>
  );
}

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
  const { userTeamId, userTier } = data || {};

  // Diagnostic logging
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🏀 [DIAG-HUB] PlayoffHub RENDER');
  console.log('🏀 [DIAG-HUB] data:', data);
  console.log('🏀 [DIAG-HUB] data?.action:', data?.action);
  console.log('🏀 [DIAG-HUB] userTeamId:', userTeamId);
  console.log('🏀 [DIAG-HUB] userTier:', userTier);
  console.log('🏀 [DIAG-HUB] gameState exists:', !!gameState);
  console.log('═══════════════════════════════════════════════════════════');

  // Register refresh hook for GameSimController
  useEffect(() => {
    window._reactPlayoffHubRefresh = () => refresh?.();
    return () => { delete window._reactPlayoffHubRefresh; };
  }, [refresh]);

  useEffect(() => { if (userTier) setActiveTab(userTier); }, [userTier]);

  // Live data
  const cpd = gameState?._raw?.championshipPlayoffData || gameState?.championshipPlayoffData;
  const postseasonResults = gameState?._raw?.postseasonResults || gameState?.postseasonResults || data?.postseasonResults;
  const t2Data = postseasonResults?.t2 || null;
  const t3Data = postseasonResults?.t3 || null;

  // User's team object
  const userTeam = useMemo(() => {
    const all = [
      ...(gameState?._raw?.tier1Teams || gameState?.tier1Teams || []),
      ...(gameState?._raw?.tier2Teams || gameState?.tier2Teams || []),
      ...(gameState?._raw?.tier3Teams || gameState?.tier3Teams || []),
    ];
    return all.find(t => t.id === userTeamId) || null;
  }, [gameState, userTeamId]);

  // Current series state from cpd
  const higher = cpd?._pendingHigher || null;
  const lower = cpd?._pendingLower || null;
  const opponent = higher?.id === userTeamId ? lower : higher;
  const userWins = cpd?._pendingUserWins ?? 0;
  const oppWins = cpd?._pendingOppWins ?? 0;
  const bestOf = cpd?._pendingBestOf ?? 7;
  const winsNeeded = Math.ceil(bestOf / 2);
  const seriesOver = userWins >= winsNeeded || oppWins >= winsNeeded;
  const isUserInSeries = !!(cpd?._pendingRoundResults && (higher?.id === userTeamId || lower?.id === userTeamId));
  const nextGameNum = (cpd?._pendingGameNum ?? 0) + 1;
  const roundName = cpd?._pendingRoundName || (cpd?.currentRound ? `Round ${cpd.currentRound}` : 'Playoffs');

  // Next game location
  const nextGameLocation = useMemo(() => {
    const hp = cpd?._pendingHomePattern;
    const gi = cpd?._pendingGameNum ?? 0;
    if (!hp) return 'home';
    return (higher?.id === userTeamId ? hp[gi] : !hp[gi]) ? 'home' : 'away';
  }, [cpd, userTeamId, higher]);

  // Game log
  const games = useMemo(() => (cpd?._pendingGamesPlayed || []).map(g => {
    const homeIsUser = g.homeTeam?.id === userTeamId;
    return { winner: g.winner?.id === userTeamId, location: homeIsUser ? 'vs' : '@', userScore: homeIsUser ? (g.homeScore ?? 0) : (g.awayScore ?? 0), oppScore: homeIsUser ? (g.awayScore ?? 0) : (g.homeScore ?? 0) };
  }), [cpd, userTeamId]);

  // Other series
  const otherSeriesList = useMemo(() => {
    if (!cpd?.roundResults) return [];
    return (cpd.roundResults[(cpd.currentRound || 1) - 1] || [])
      .filter(s => s?.result && s.result.higherSeed?.id !== userTeamId && s.result.lowerSeed?.id !== userTeamId)
      .map(s => ({ name: `${abbr(s.result.higherSeed)} vs ${abbr(s.result.lowerSeed)}`, higherWins: s.result?.higherSeedWins ?? s.result?.higherWins ?? 0, lowerWins: s.result?.lowerSeedWins ?? s.result?.lowerWins ?? 0, winner: s.result?.winner || null }));
  }, [cpd, userTeamId]);

  const seriesProb = useMemo(() => calcSeriesProb(userTeam, opponent, userWins, oppWins), [userTeam, opponent, userWins, oppWins]);

  // Handlers
  const handleSimGame = useCallback(() => { window.simOnePlayoffGame?.() || window.simRestOfPlayoffSeries?.(); setTimeout(() => refresh?.(), 100); }, [refresh]);
  const handleWatch = useCallback(() => { window.watchPlayoffGame?.(); }, []);
  const handleSimSeries = useCallback(() => { window.simRestOfPlayoffSeries?.(); setTimeout(() => refresh?.(), 100); }, [refresh]);
  const handleSimToChampionship = useCallback(() => {
    const gs = window._reactGameState;
    if (gs && !gs.championshipPlayoffData?.eastTeams?.length) window.initBracketForHub?.(data?.action || 'championship');
    if (window._reactGameState?.championshipPlayoffData?._pendingRoundResults) window.simRestOfPlayoffSeries?.();
    window.simAllChampionshipRounds?.();
    setTimeout(() => refresh?.(), 100);
  }, [refresh, data]);

  if (!data) return null;

  const tierCtx = { 1: 'T1 · 30 teams · Conference format', 2: 'T2 · 86 teams · Single bracket', 3: 'T3 · 144 teams · Single bracket' };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      <PlayoffSidebar
        userTeam={userTeam} opponent={opponent}
        userWins={userWins} oppWins={oppWins}
        isUserInSeries={isUserInSeries} seriesOver={seriesOver}
        seriesProb={seriesProb} roundName={roundName} bestOf={bestOf}
        games={games} nextGameNum={nextGameNum} nextGameLocation={nextGameLocation}
        userTeam_abbr={abbr(userTeam)} opp_abbr={abbr(opponent)}
        otherSeriesList={otherSeriesList}
        onSimGame={handleSimGame} onWatch={handleWatch}
        onSimSeries={handleSimSeries} onSimToChampionship={handleSimToChampionship}
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
          <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>{tierCtx[activeTab]}</div>
        </div>
        {/* Status bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 18px', background: 'var(--color-bg-sunken)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: TIER[activeTab].bg, border: `1px solid ${TIER[activeTab].border}`, fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: TIER[activeTab].color }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: TIER[activeTab].color, flexShrink: 0 }} />
            T{activeTab} Playoffs
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Postseason in progress</div>
          <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-tertiary)' }}>Season {gameState?.season || '—'}</div>
        </div>
        {/* Bracket */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {activeTab === 1 && <T1Bracket cpd={cpd} postseasonT1={postseasonResults?.t1} userTeamId={userTeamId} />}
          {activeTab === 2 && <SingleBracket tier={2} data={t2Data} userTeamId={userTeamId} />}
          {activeTab === 3 && <SingleBracket tier={3} data={t3Data} userTeamId={userTeamId} />}
        </div>
      </div>
    </div>
  );
}
