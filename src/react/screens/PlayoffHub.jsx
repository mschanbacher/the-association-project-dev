// ═══════════════════════════════════════════════════════════════════
// PlayoffHub — Full-screen postseason hub, replaces Dashboard during playoffs
//
// Activated when gameState._usePlayoffHub === true and postseason begins.
// Receives props from OffseasonController via window._reactShowPlayoffHub:
//   { action, postseasonResults, userTier, userTeamId, onComplete }
//
// Layout mirrors the dashboard: left sidebar (series card + game log +
// other series) + main bracket area with T1/T2/T3 tabs.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';

// ─── Design tokens (mirrors design-system.css) ───────────────────────────────
const S = {
  // Layout
  sidebar: {
    width: 210,
    background: 'var(--color-bg-raised)',
    borderRight: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
  // Typography helpers
  label: {
    fontSize: 'var(--text-2xs)',
    fontWeight: 'var(--weight-bold)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--color-text-tertiary)',
    marginBottom: 8,
  },
};

// ─── Win Prob Arc (identical math to WinProbArc in Widgets.jsx) ───────────────
function WinProbArc({ probability, size = 150, label = 'Win Prob.' }) {
  const pct = Math.round(probability * 100);
  const strokeWidth = 15;
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
          <pattern id="phArcHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={arcColor} strokeWidth="3" strokeOpacity="0.25" />
          </pattern>
        </defs>
        <path
          d={`M ${leftX} ${leftY} A ${radius} ${radius} 0 0 1 ${topX} ${topY} A ${radius} ${radius} 0 0 1 ${rightX} ${rightY}`}
          fill="none" stroke="url(#phArcHatch)" strokeWidth={strokeWidth} strokeLinecap="butt"
        />
        {pct > 0 && (
          <path d={fillPath} fill="none" stroke={arcColor} strokeWidth={strokeWidth} strokeLinecap="butt" />
        )}
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 6, textAlign: 'center' }}>
        <div style={{
          fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: arcColor, lineHeight: 1,
        }}>{pct}%</div>
        <div style={{
          fontSize: 9, color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2,
        }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Small button component ───────────────────────────────────────────────────
function Btn({ children, variant = 'ghost', onClick, disabled, style }) {
  const base = {
    padding: '6px 10px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-medium)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    whiteSpace: 'nowrap',
    lineHeight: 1,
  };
  const variants = {
    primary: {
      background: 'var(--color-accent)',
      color: 'var(--color-text-inverse)',
      fontWeight: 'var(--weight-bold)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--color-text-secondary)',
      border: '1px solid var(--color-border)',
    },
    warn: {
      background: 'var(--color-warning-bg)',
      color: 'var(--color-warning)',
      border: '1px solid rgba(196,138,24,0.3)',
    },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

// ─── Matchup card ─────────────────────────────────────────────────────────────
function MatchupCard({ higher, lower, higherWins, lowerWins, isUserSeries, future, done }) {
  const higherWon = done && higherWins > lowerWins;
  const lowerWon = done && lowerWins > higherWins;

  const teamRow = (team, wins, isWinner, isElim, isUser) => (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '6px 8px', gap: 6,
      borderBottom: '1px solid var(--color-border-subtle)',
    }}>
      {isUser && (
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--color-warning)', flexShrink: 0,
        }} />
      )}
      <span style={{
        flex: 1, fontSize: 'var(--text-sm)',
        color: future ? 'var(--color-text-tertiary)' :
               isWinner ? 'var(--color-accent)' :
               isElim ? 'var(--color-text-tertiary)' :
               'var(--color-text)',
        fontWeight: isWinner ? 'var(--weight-semibold)' : 'var(--weight-medium)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {team?.name || '—'}
      </span>
      <span style={{
        fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
        fontFamily: 'var(--font-mono)', width: 14, textAlign: 'center',
        color: isWinner ? 'var(--color-accent)' :
               isElim ? 'var(--color-text-tertiary)' :
               future ? 'var(--color-text-tertiary)' :
               'var(--color-text)',
      }}>
        {future ? '—' : wins}
      </span>
    </div>
  );

  return (
    <div style={{
      background: isUserSeries
        ? 'rgba(196,138,24,0.04)'
        : 'var(--color-bg-raised)',
      border: isUserSeries
        ? '1px solid rgba(196,138,24,0.35)'
        : '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      width: 190,
      margin: '0 10px 6px',
      opacity: future ? 0.45 : done ? 0.78 : 1,
    }}>
      {teamRow(higher, higherWins, higherWon, lowerWon, false)}
      <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        {teamRow(lower, lowerWins, lowerWon, higherWon, false)}
      </div>
    </div>
  );
}

// ─── T1 Bracket (16-team, East/West conf) ────────────────────────────────────
function T1Bracket({ playoffData, userTeamId }) {
  if (!playoffData) return (
    <div style={{ padding: 32, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
      Championship bracket data not available.
    </div>
  );

  const { eastTeams = [], westTeams = [], roundResults = [], currentRound = 1 } = playoffData;

  // Build bracket state per round
  const getRoundSeries = (round) => {
    if (round > roundResults.length) return null;
    return roundResults[round - 1];
  };

  // Round 1 matchups
  const r1East = eastTeams.length >= 8 ? [
    { higher: eastTeams[0], lower: eastTeams[7], conf: 'East' },
    { higher: eastTeams[1], lower: eastTeams[6], conf: 'East' },
    { higher: eastTeams[2], lower: eastTeams[5], conf: 'East' },
    { higher: eastTeams[3], lower: eastTeams[4], conf: 'East' },
  ] : [];
  const r1West = westTeams.length >= 8 ? [
    { higher: westTeams[0], lower: westTeams[7], conf: 'West' },
    { higher: westTeams[1], lower: westTeams[6], conf: 'West' },
    { higher: westTeams[2], lower: westTeams[5], conf: 'West' },
    { higher: westTeams[3], lower: westTeams[4], conf: 'West' },
  ] : [];

  const r1Results = getRoundSeries(1) || [];
  const r2Results = getRoundSeries(2) || [];
  const r3Results = getRoundSeries(3) || [];
  const r4Results = getRoundSeries(4) || [];

  const isUserSeries = (higher, lower) =>
    higher?.id === userTeamId || lower?.id === userTeamId;

  const seriesRecord = (results, conf, idx) => {
    const s = results.filter(r => r && r.conf === conf)[idx];
    if (!s) return { higherWins: 0, lowerWins: 0, done: false };
    return {
      higherWins: s.result?.higherSeedWins ?? s.result?.higherWins ?? 0,
      lowerWins: s.result?.lowerSeedWins ?? s.result?.lowerWins ?? 0,
      done: true,
    };
  };

  // Live series (user is currently playing — _pendingRoundResults may have nulls)
  const liveSeriesRecord = (roundIdx, higher, lower) => {
    const pw = playoffData._pendingRoundResults;
    if (!pw) return null;
    // Check if this is the pending user series (null slot means user's series)
    const pendingRound = playoffData._pendingRound;
    if (pendingRound !== roundIdx + 1) return null;
    return null; // Live series scores come from _playoffWatch on GameSimController
  };

  const Arrow = ({ dir = '›' }) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 16, color: 'var(--color-border)', fontSize: 14, flexShrink: 0,
    }}>{dir}</div>
  );

  const RoundCol = ({ label, children, paddingTop = 0 }) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ ...S.label, padding: '0 10px', marginBottom: 10 }}>{label}</div>
      <div style={{ paddingTop }}>{children}</div>
    </div>
  );

  const Spacer = ({ h }) => <div style={{ height: h }} />;

  // Round 1 West
  const r1WestCards = r1West.map((m, i) => {
    const rec = r1Results.length > 0
      ? seriesRecord(r1Results, 'West', i)
      : { higherWins: 0, lowerWins: 0, done: false };
    return (
      <React.Fragment key={i}>
        <MatchupCard
          higher={m.higher} lower={m.lower}
          higherWins={rec.higherWins} lowerWins={rec.lowerWins}
          isUserSeries={isUserSeries(m.higher, m.lower)}
          future={r1Results.length === 0 && currentRound > 1}
          done={rec.done}
        />
        {i < r1West.length - 1 && <Spacer h={4} />}
      </React.Fragment>
    );
  });

  // Round 1 East
  const r1EastCards = r1East.map((m, i) => {
    const rec = r1Results.length > 0
      ? seriesRecord(r1Results, 'East', i)
      : { higherWins: 0, lowerWins: 0, done: false };
    return (
      <React.Fragment key={i}>
        <MatchupCard
          higher={m.higher} lower={m.lower}
          higherWins={rec.higherWins} lowerWins={rec.lowerWins}
          isUserSeries={isUserSeries(m.higher, m.lower)}
          future={r1Results.length === 0 && currentRound > 1}
          done={rec.done}
        />
        {i < r1East.length - 1 && <Spacer h={4} />}
      </React.Fragment>
    );
  });

  // Build R2+ from results
  const getWinnersFromRound = (results, conf) => {
    if (!results.length) return [null, null];
    return results
      .filter(r => r && r.conf === conf)
      .map(r => r.result?.winner || null);
  };

  const r2WestWinners = getWinnersFromRound(r2Results, 'West');
  const r2EastWinners = getWinnersFromRound(r2Results, 'East');
  const r3WestWinners = getWinnersFromRound(r3Results, 'West');
  const r3EastWinners = getWinnersFromRound(r3Results, 'East');
  const r1WestWinners = getWinnersFromRound(r1Results, 'West');
  const r1EastWinners = getWinnersFromRound(r1Results, 'East');

  // Semis West
  const semiWestMatchups = r1WestWinners[0] ? [
    { higher: r1WestWinners[0], lower: r1WestWinners[3] || r1WestWinners[1], conf: 'West' },
    { higher: r1WestWinners[1] || r1WestWinners[2], lower: r1WestWinners[2] || r1WestWinners[3], conf: 'West' },
  ] : [null, null];

  const semiEastMatchups = r1EastWinners[0] ? [
    { higher: r1EastWinners[0], lower: r1EastWinners[3] || r1EastWinners[1], conf: 'East' },
    { higher: r1EastWinners[1] || r1EastWinners[2], lower: r1EastWinners[2] || r1EastWinners[3], conf: 'East' },
  ] : [null, null];

  const finalsWest = r2WestWinners[0] || null;
  const finalsEast = r2EastWinners[0] || null;
  const champion = r4Results[0]?.result?.winner || null;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, minWidth: 860 }}>

      {/* R1 West */}
      <RoundCol label="Round 1 · West">
        {r1WestCards}
      </RoundCol>

      {/* Arrows R1→Semis West */}
      <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 26, alignItems: 'center', width: 16 }}>
        {[0,1,2,3].map(i => (
          <React.Fragment key={i}>
            <Arrow />
            {i < 3 && <Spacer h={62} />}
          </React.Fragment>
        ))}
      </div>

      {/* Conf Semis West */}
      <RoundCol label="Conf. Semis · West">
        <Spacer h={28} />
        {semiWestMatchups.map((m, i) => (
          <React.Fragment key={i}>
            <MatchupCard
              higher={m?.higher || null} lower={m?.lower || null}
              higherWins={m ? seriesRecord(r2Results, 'West', i).higherWins : 0}
              lowerWins={m ? seriesRecord(r2Results, 'West', i).lowerWins : 0}
              isUserSeries={m ? isUserSeries(m.higher, m.lower) : false}
              future={!m || r2Results.length === 0}
              done={m ? seriesRecord(r2Results, 'West', i).done : false}
            />
            {i < 1 && <Spacer h={62} />}
          </React.Fragment>
        ))}
      </RoundCol>

      {/* Arrows Semis→Conf Finals West */}
      <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 66, alignItems: 'center', width: 16 }}>
        <Arrow /><Spacer h={96} /><Arrow />
      </div>

      {/* Conf Finals West */}
      <RoundCol label="Conf. Finals · West">
        <Spacer h={96} />
        <MatchupCard
          higher={finalsWest || r2WestWinners[0] || null}
          lower={r2WestWinners[1] || null}
          higherWins={seriesRecord(r3Results, 'West', 0).higherWins}
          lowerWins={seriesRecord(r3Results, 'West', 0).lowerWins}
          isUserSeries={finalsWest ? isUserSeries(finalsWest, r2WestWinners[1]) : false}
          future={!finalsWest}
          done={seriesRecord(r3Results, 'West', 0).done}
        />
      </RoundCol>

      {/* Finals center */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '0 10px', paddingTop: 198, gap: 6,
      }}>
        <Arrow />
        <div style={{
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--color-tier1)',
          background: 'var(--color-tier1-bg)', padding: '3px 10px', borderRadius: 2,
        }}>
          {champion ? `${champion.name}` : 'Finals'}
        </div>
        <Arrow dir="‹" />
      </div>

      {/* Conf Finals East */}
      <RoundCol label="Conf. Finals · East">
        <Spacer h={96} />
        <MatchupCard
          higher={finalsEast || r2EastWinners[0] || null}
          lower={r2EastWinners[1] || null}
          higherWins={seriesRecord(r3Results, 'East', 0).higherWins}
          lowerWins={seriesRecord(r3Results, 'East', 0).lowerWins}
          isUserSeries={finalsEast ? isUserSeries(finalsEast, r2EastWinners[1]) : false}
          future={!finalsEast}
          done={seriesRecord(r3Results, 'East', 0).done}
        />
      </RoundCol>

      {/* Arrows Conf Finals East→Semis */}
      <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 66, alignItems: 'center', width: 16 }}>
        <Arrow dir="‹" /><Spacer h={96} /><Arrow dir="‹" />
      </div>

      {/* Conf Semis East */}
      <RoundCol label="Conf. Semis · East">
        <Spacer h={28} />
        {semiEastMatchups.map((m, i) => (
          <React.Fragment key={i}>
            <MatchupCard
              higher={m?.higher || null} lower={m?.lower || null}
              higherWins={m ? seriesRecord(r2Results, 'East', i).higherWins : 0}
              lowerWins={m ? seriesRecord(r2Results, 'East', i).lowerWins : 0}
              isUserSeries={m ? isUserSeries(m.higher, m.lower) : false}
              future={!m || r2Results.length === 0}
              done={m ? seriesRecord(r2Results, 'East', i).done : false}
            />
            {i < 1 && <Spacer h={62} />}
          </React.Fragment>
        ))}
      </RoundCol>

      {/* Arrows Semis→R1 East */}
      <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 26, alignItems: 'center', width: 16 }}>
        {[0,1,2,3].map(i => (
          <React.Fragment key={i}>
            <Arrow dir="‹" />
            {i < 3 && <Spacer h={62} />}
          </React.Fragment>
        ))}
      </div>

      {/* R1 East */}
      <RoundCol label="Round 1 · East">
        {r1EastCards}
      </RoundCol>

    </div>
  );
}

// ─── Simple bracket for T2/T3 (4-team division view, spectator) ──────────────
function SimpleBracket({ label, rounds, userTeamId }) {
  if (!rounds || rounds.length === 0) {
    return (
      <div style={{ padding: 32, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
        {label} bracket data not available.
      </div>
    );
  }

  return (
    <div style={{ padding: 4 }}>
      {rounds.map((round, ri) => (
        <div key={ri} style={{ marginBottom: 24 }}>
          <div style={{ ...S.label, marginBottom: 8 }}>{round.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(round.series || []).map((s, si) => {
              const higher = s.higher || s.higherSeed;
              const lower = s.lower || s.lowerSeed;
              const res = s.result;
              const isUser = higher?.id === userTeamId || lower?.id === userTeamId;
              return (
                <MatchupCard
                  key={si}
                  higher={higher} lower={lower}
                  higherWins={res?.higherSeedWins ?? res?.higherWins ?? 0}
                  lowerWins={res?.lowerSeedWins ?? res?.lowerWins ?? 0}
                  isUserSeries={isUser}
                  future={!res}
                  done={!!res}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sidebar: Series card + game log + other series ──────────────────────────
function PlayoffSidebar({ hubData, onSimGame, onWatch, onSimSeries, onSimToChampionship }) {
  const { gameState } = useGame();
  const { userTeamId } = hubData;

  // Read _playoffWatch from window via the GameSimController bridge
  const ctrl = window._getGameSimController?.();
  const pw = ctrl?._playoffWatch;
  const cpd = gameState?._raw?.championshipPlayoffData || gameState?.championshipPlayoffData;

  const userTeam = gameState?.userTeam;
  const isUserInSeries = pw && (pw.higherSeed?.id === userTeamId || pw.lowerSeed?.id === userTeamId);

  const higher = pw?.higherSeed;
  const lower = pw?.lowerSeed;
  const higherWins = pw?.higherWins ?? 0;
  const lowerWins = pw?.lowerWins ?? 0;
  const bestOf = pw?.bestOf ?? 7;
  const games = pw?.games ?? [];
  const gamesToWin = pw?.gamesToWin ?? 4;
  const seriesOver = higherWins >= gamesToWin || lowerWins >= gamesToWin;

  // Determine user's team and opponent in the series
  const userIsHigher = higher?.id === userTeamId;
  const opponent = userIsHigher ? lower : higher;
  const userWins = userIsHigher ? higherWins : lowerWins;
  const oppWins = userIsHigher ? lowerWins : higherWins;

  // Series win probability (reuse pre-game calc as series probability proxy)
  const seriesProb = useMemo(() => {
    if (!userTeam || !opponent) return 0.5;
    const avgRating = (team) => {
      const roster = (team.roster || []).slice(0, 8);
      if (!roster.length) return 75;
      return roster.reduce((sum, p) => {
        const off = p.offRating || p.rating || 75;
        const def = p.defRating || p.rating || 75;
        return sum + (off + def) / 2;
      }, 0) / roster.length;
    };
    const delta = avgRating(userTeam) - avgRating(opponent);
    // Adjust for series state: up in series → higher prob
    const seriesAdj = (userWins - oppWins) * 0.05;
    return Math.max(0.05, Math.min(0.95, 1 / (1 + Math.exp(-0.15 * delta)) + seriesAdj));
  }, [userTeam, opponent, userWins, oppWins]);

  // Round name
  const roundName = cpd?._pendingRoundName || (cpd?.currentRound ? `Round ${cpd.currentRound}` : 'Playoffs');
  const nextGameNum = (pw?.gameNum ?? 0) + 1;

  // Other series summary from roundResults
  const otherSeriesList = useMemo(() => {
    if (!cpd?.roundResults) return [];
    const currentRoundResults = cpd.roundResults[cpd.currentRound - 1] || [];
    return currentRoundResults
      .filter(s => s && s.result)
      .filter(s => {
        const h = s.result?.higherSeed;
        const l = s.result?.lowerSeed;
        return h?.id !== userTeamId && l?.id !== userTeamId;
      })
      .map(s => ({
        name: `${s.result?.higherSeed?.name || '?'} vs ${s.result?.lowerSeed?.name || '?'}`,
        higherWins: s.result?.higherSeedWins ?? s.result?.higherWins ?? 0,
        lowerWins: s.result?.lowerSeedWins ?? s.result?.lowerWins ?? 0,
        winner: s.result?.winner,
        conf: s.conf,
      }));
  }, [cpd, userTeamId]);

  const div = { height: 1, background: 'var(--color-border)', margin: '0' };

  return (
    <div style={S.sidebar}>

      {/* Series card */}
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={S.label}>
          {isUserInSeries && !seriesOver ? 'Your Series' : 'Playoffs'}
        </div>

        {isUserInSeries ? (
          <>
            {/* Matchup title */}
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, lineHeight: 1.25, marginBottom: 2 }}>
              {userTeam?.name} vs {opponent?.name}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 10 }}>
              {roundName} · Best of {bestOf}
            </div>

            {/* Score */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, marginBottom: 4,
            }}>
              <span style={{
                fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)',
                flex: 1, textAlign: 'right', fontWeight: 600,
              }}>
                {userTeam?.city?.slice(0, 3)?.toUpperCase() || userTeam?.name?.slice(0, 3)?.toUpperCase()}
              </span>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: 'var(--color-text)', lineHeight: 1,
                }}>
                  {userWins} – {oppWins}
                </div>
                <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', marginTop: 1 }}>SERIES</div>
              </div>
              <span style={{
                fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)',
                flex: 1, textAlign: 'left', fontWeight: 600,
              }}>
                {opponent?.city?.slice(0, 3)?.toUpperCase() || opponent?.name?.slice(0, 3)?.toUpperCase()}
              </span>
            </div>

            {/* Arc gauge */}
            {!seriesOver && (
              <WinProbArc probability={seriesProb} size={150} label="Series Win Prob." />
            )}
            {seriesOver && (
              <div style={{
                textAlign: 'center', padding: '10px 0 6px',
                fontSize: 'var(--text-sm)', fontWeight: 700,
                color: userWins > oppWins ? 'var(--color-win)' : 'var(--color-loss)',
              }}>
                {userWins > oppWins ? 'Series Won' : 'Series Lost'} · {userWins}–{oppWins}
              </div>
            )}

            {/* Sim controls */}
            {!seriesOver && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Btn variant="primary" onClick={onSimGame} style={{ flex: 1 }}>
                    Game {nextGameNum > games.length + 1 ? '' : `${nextGameNum}`} ›
                  </Btn>
                  <Btn variant="ghost" onClick={onWatch} style={{ flex: 1 }}>Watch</Btn>
                  <Btn variant="ghost" onClick={onSimSeries} style={{ flex: 1 }}>Series</Btn>
                </div>
                <Btn variant="warn" onClick={onSimToChampionship} style={{ width: '100%' }}>
                  Sim to Championship
                </Btn>
              </div>
            )}
            {seriesOver && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                <Btn variant="warn" onClick={onSimToChampionship} style={{ width: '100%' }}>
                  Sim to Championship
                </Btn>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{
              fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
              marginBottom: 12, lineHeight: 1.5,
            }}>
              Your team is not in the playoffs this season.
            </div>
            <Btn variant="warn" onClick={onSimToChampionship} style={{ width: '100%' }}>
              Sim to Championship
            </Btn>
          </>
        )}
      </div>

      {/* Game log */}
      {isUserInSeries && games.length > 0 && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={S.label}>Game Log</div>
          {games.map((g, i) => {
            const userWon = g.winner?.id === userTeamId;
            const homeIsUser = g.homeTeam?.id === userTeamId;
            const userScore = homeIsUser ? g.homeScore : g.awayScore;
            const oppScore = homeIsUser ? g.awayScore : g.homeScore;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 0',
                borderBottom: i < games.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', width: 38 }}>
                  Gm {g.gameNumber}
                </span>
                <span style={{
                  flex: 1, fontSize: 11, fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {userScore} – {oppScore}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, width: 14, textAlign: 'center',
                  color: userWon ? 'var(--color-win)' : 'var(--color-loss)',
                }}>
                  {userWon ? 'W' : 'L'}
                </span>
              </div>
            );
          })}
          {/* Next game row */}
          {!seriesOver && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 6px', margin: '2px -6px 0',
              background: 'rgba(196,138,24,0.06)',
              borderRadius: 2,
            }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', width: 38 }}>
                Gm {nextGameNum}
              </span>
              <span style={{ flex: 1, fontSize: 11, color: 'var(--color-warning)', fontWeight: 600 }}>
                Next · {pw?.homePattern?.[pw?.gameNum] === (userTeamId === higher?.id)
                  ? 'Home' : 'Away'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-warning)' }}>›</span>
            </div>
          )}
        </div>
      )}

      {/* Other series */}
      {otherSeriesList.length > 0 && (
        <div style={{ padding: '10px 14px', flex: 1, overflowY: 'auto' }}>
          <div style={S.label}>Other Series</div>
          {otherSeriesList.map((s, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '3px 0',
            }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{s.name}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: s.winner ? 'var(--color-win)' : 'var(--color-text)',
              }}>
                {s.higherWins}–{s.lowerWins}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab pill ─────────────────────────────────────────────────────────────────
const TIER_LABELS = { 1: ['T1', 'Championship'], 2: ['T2', 'Division'], 3: ['T3', 'Metro'] };
const BADGE_COLORS = {
  1: { bg: 'var(--color-tier1-bg)', color: 'var(--color-tier1)' },
  2: { bg: 'var(--color-tier2-bg)', color: 'var(--color-tier2)' },
  3: { bg: 'var(--color-tier3-bg)', color: 'var(--color-tier3)' },
};

function TierTab({ tier, active, onClick }) {
  const [badge, label] = TIER_LABELS[tier];
  const bc = BADGE_COLORS[tier];
  return (
    <button
      onClick={onClick}
      style={{
        height: 44,
        padding: '0 16px',
        border: 'none',
        borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
        background: 'transparent',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
        fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-medium)',
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
      }}
    >
      <span style={{
        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 2,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        background: bc.bg, color: bc.color,
      }}>{badge}</span>
      {label}
    </button>
  );
}

// ─── Status bar ───────────────────────────────────────────────────────────────
function StatusBar({ cpd }) {
  if (!cpd) return null;
  const currentRound = cpd.currentRound || 1;
  const roundResults = cpd.roundResults || [];
  const seriesDone = roundResults.reduce((sum, r) => sum + (r ? r.filter(Boolean).length : 0), 0);
  const totalSeries = 15; // 8+4+2+1 for T1

  const roundNames = ['Round 1', 'Conference Semifinals', 'Conference Finals', 'Finals'];
  const roundName = roundNames[currentRound - 1] || `Round ${currentRound}`;

  return (
    <div style={{
      background: 'var(--color-bg-raised)',
      borderBottom: '1px solid var(--color-border)',
      padding: '0 20px',
      height: 36,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0,
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: '50%',
        background: 'var(--color-tier1)', flexShrink: 0,
      }} />
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>
        {roundName} in progress
      </span>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>
        Season {cpd.eastTeams?.[0]?.wins !== undefined ? '' : ''}
        {seriesDone} of {totalSeries} series complete
      </span>
    </div>
  );
}

// ─── Main PlayoffHub component ────────────────────────────────────────────────
export function PlayoffHub({ data, onClose }) {
  const { gameState, refresh } = useGame();
  const [activeTab, setActiveTab] = useState(data?.userTier || 1);

  const { userTeamId, onComplete, postseasonResults } = data || {};

  // Get live data from gameState
  const cpd = gameState?._raw?.championshipPlayoffData || gameState?.championshipPlayoffData;

  // Default to user's tier tab
  useEffect(() => {
    if (data?.userTier) setActiveTab(data.userTier);
  }, [data?.userTier]);

  // Sim one game in the user's series — advance the series by one game
  const handleSimGame = useCallback(() => {
    // simOnePlayoffGame if available, else sim rest (will stop after one internally)
    if (window.simOnePlayoffGame) {
      window.simOnePlayoffGame();
    } else if (window.simRestOfPlayoffSeries) {
      // Fallback: series sim (ChampionshipPlayoffModal uses this pattern)
      window.simRestOfPlayoffSeries();
    }
    refresh?.();
  }, [refresh]);

  // Watch next game
  const handleWatch = useCallback(() => {
    window.watchPlayoffGame?.();
    // WatchGameModal opens via existing _reactShowWatchGame hook
  }, []);

  // Sim entire series
  const handleSimSeries = useCallback(() => {
    window.simRestOfPlayoffSeries?.();
    refresh?.();
  }, [refresh]);

  // Sim to championship (sim all remaining rounds)
  const handleSimToChampionship = useCallback(() => {
    // Ensure bracket data is initialized — required before any sim call.
    // This covers the case where the hub opens before runTier1ChampionshipPlayoffs runs.
    const gs = window._reactGameState;
    if (gs && !gs.championshipPlayoffData?.eastTeams?.length) {
      // Call initBracketForHub via the exposed window method
      window.initBracketForHub?.(data?.action || 'championship');
    }
    // Finish current series if one is actively in progress
    if (window._reactGameState?.championshipPlayoffData?._pendingRoundResults) {
      window.simRestOfPlayoffSeries?.();
    }
    window.simAllChampionshipRounds?.();
    refresh?.();
  }, [refresh, data]);

  // T2/T3 bracket data from postseasonResults
  const t2Rounds = useMemo(() => {
    const t2 = postseasonResults?.t2;
    if (!t2?.rounds) return [];
    return t2.rounds.map((round, i) => ({
      name: `Round ${i + 1}`,
      series: round.map(s => ({
        higher: s.higher || s.higherSeed,
        lower: s.lower || s.lowerSeed,
        result: s.result || s,
      })),
    }));
  }, [postseasonResults]);

  const t3Rounds = useMemo(() => {
    const t3 = postseasonResults?.t3;
    if (!t3?.rounds) return [];
    return t3.rounds.map((round, i) => ({
      name: `Round ${i + 1}`,
      series: round.map(s => ({
        higher: s.higher || s.higherSeed,
        lower: s.lower || s.lowerSeed,
        result: s.result || s,
      })),
    }));
  }, [postseasonResults]);

  if (!data) return null;

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      overflow: 'hidden',
      minHeight: 0,
    }}>
      {/* ── Sidebar ── */}
      <PlayoffSidebar
        hubData={data}
        onSimGame={handleSimGame}
        onWatch={handleWatch}
        onSimSeries={handleSimSeries}
        onSimToChampionship={handleSimToChampionship}
      />

      {/* ── Main content ── */}
      <div style={S.content}>

        {/* Hub header with tabs */}
        <div style={{
          background: 'var(--color-bg-raised)',
          borderBottom: '1px solid var(--color-border)',
          padding: '0 20px',
          height: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
            marginRight: 16, paddingRight: 16,
            borderRight: '1px solid var(--color-border)',
          }}>
            Playoffs
          </span>
          <TierTab tier={1} active={activeTab === 1} onClick={() => setActiveTab(1)} />
          <TierTab tier={2} active={activeTab === 2} onClick={() => setActiveTab(2)} />
          <TierTab tier={3} active={activeTab === 3} onClick={() => setActiveTab(3)} />
        </div>

        {/* Status bar */}
        {activeTab === 1 && <StatusBar cpd={cpd} />}

        {/* Bracket area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {activeTab === 1 && (
            <T1Bracket playoffData={cpd} userTeamId={userTeamId} />
          )}
          {activeTab === 2 && (
            <SimpleBracket
              label="Division"
              rounds={t2Rounds}
              userTeamId={userTeamId}
            />
          )}
          {activeTab === 3 && (
            <SimpleBracket
              label="Metro"
              rounds={t3Rounds}
              userTeamId={userTeamId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
