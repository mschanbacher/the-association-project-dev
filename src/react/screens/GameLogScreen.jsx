import React, { useState, useMemo, useCallback } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card } from '../components/Card.jsx';

/**
 * GameLogScreen - Shows all regular season games with expandable box scores
 * 
 * Design standards:
 * - Zero border-radius
 * - No emoji
 * - DM Sans + JetBrains Mono
 * - 8px spacing rhythm
 */

// ─── Win Probability Chart Constants ───────────────────────────────────────────
const TOTAL_GAME_SECONDS = 2880;
const C_WIN  = '#2D7A4F';
const C_LOSS = '#B5403A';
const C_EVEN = '#C0C0BA';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function pctFmt(m, a) {
  if (!a || a === 0) return '—';
  return ((m / a) * 100).toFixed(1);
}

// Game Score (Hollinger)
const ORB_RATE = { PG: 0.06, SG: 0.08, SF: 0.12, PF: 0.22, C: 0.28 };
function calcGameScore(p) {
  const orbRate = ORB_RATE[p.pos] || 0.10;
  const orb = Math.round((p.reb || 0) * orbRate);
  const drb = (p.reb || 0) - orb;
  return (
    (p.pts || 0) * 1.0 +
    (p.fgm || 0) * 0.4 -
    (p.fga || 0) * 0.7 -
    ((p.fta || 0) - (p.ftm || 0)) * 0.4 +
    orb * 0.7 +
    drb * 0.3 +
    (p.stl || 0) * 1.0 +
    (p.ast || 0) * 0.7 +
    (p.blk || 0) * 0.7 -
    (p.pf || 0) * 0.4 -
    (p.to || 0) * 1.0
  );
}

function gmScColor(score) {
  if (score >= 25) return 'var(--color-rating-elite)';
  if (score >= 15) return 'var(--color-rating-good)';
  if (score >= 8) return 'var(--color-text-secondary)';
  if (score >= 3) return 'var(--color-text-tertiary)';
  return 'var(--color-rating-below)';
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function GameLogScreen() {
  const { gameState, isReady } = useGame();
  const [expandedGame, setExpandedGame] = useState(null);

  // Get user's games from schedule
  const games = useMemo(() => {
    if (!isReady || !gameState?.schedule || !gameState?.userTeamId) return [];
    
    const userTeamId = gameState.userTeamId;
    const allTeams = [
      ...(gameState.tier1Teams || []),
      ...(gameState.tier2Teams || []),
      ...(gameState.tier3Teams || []),
    ];
    
    // Find all played games involving user's team
    const userGames = (gameState.schedule || [])
      .filter(g => g.played && (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId))
      .map(g => {
        const isHome = g.homeTeamId === userTeamId;
        const oppTeamId = isHome ? g.awayTeamId : g.homeTeamId;
        const oppTeam = allTeams.find(t => t.id === oppTeamId);
        
        const userScore = isHome ? g.homeScore : g.awayScore;
        const oppScore = isHome ? g.awayScore : g.homeScore;
        const userWon = userScore > oppScore;
        
        return {
          id: g.id || `${g.date}-${g.homeTeamId}-${g.awayTeamId}`,
          date: g.date,
          opponent: oppTeam || { name: 'Unknown', city: '', abbreviation: '???' },
          isHome,
          userScore,
          oppScore,
          userWon,
          boxScore: g.boxScore || null,
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // Chronological order
    
    return userGames;
  }, [isReady, gameState]);

  const userTeam = useMemo(() => {
    if (!gameState?.userTeamId) return null;
    const allTeams = [
      ...(gameState.tier1Teams || []),
      ...(gameState.tier2Teams || []),
      ...(gameState.tier3Teams || []),
    ];
    return allTeams.find(t => t.id === gameState.userTeamId);
  }, [gameState]);

  if (!isReady || !gameState) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', color: 'var(--color-text-tertiary)',
      }}>
        Loading game log…
      </div>
    );
  }

  const wins = games.filter(g => g.userWon).length;
  const losses = games.filter(g => !g.userWon).length;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ 
          fontSize: 'var(--text-lg)', 
          fontWeight: 'var(--weight-bold)', 
          margin: 0,
          color: 'var(--color-text)',
        }}>
          Game Log
        </h2>
        <div style={{ 
          fontSize: 'var(--text-sm)', 
          color: 'var(--color-text-tertiary)', 
          marginTop: 4,
          fontFamily: 'var(--font-mono)',
        }}>
          {wins}–{losses} · {games.length} games played
        </div>
      </div>

      {/* Game List */}
      {games.length === 0 ? (
        <Card>
          <div style={{ 
            textAlign: 'center', 
            padding: 'var(--space-6)', 
            color: 'var(--color-text-tertiary)',
          }}>
            No games played yet
          </div>
        </Card>
      ) : (
        <Card padding="none">
          {/* Column Headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr 56px 72px',
            padding: '8px 16px',
            borderBottom: '1px solid var(--color-border)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-semi)',
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            <div>Date</div>
            <div>Opponent</div>
            <div style={{ textAlign: 'center' }}>Result</div>
            <div style={{ textAlign: 'right' }}>Score</div>
          </div>

          {/* Game Rows */}
          {games.map((game) => (
            <div key={game.id}>
              {/* Clickable Row */}
              <div
                onClick={() => setExpandedGame(expandedGame === game.id ? null : game.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr 56px 72px',
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  cursor: 'pointer',
                  background: expandedGame === game.id ? 'var(--color-bg-sunken)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (expandedGame !== game.id) e.currentTarget.style.background = 'var(--color-bg-sunken)';
                }}
                onMouseLeave={(e) => {
                  if (expandedGame !== game.id) e.currentTarget.style.background = 'transparent';
                }}
              >
                {/* Date */}
                <div style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: 'var(--text-sm)', 
                  color: 'var(--color-text-secondary)',
                }}>
                  {formatDate(game.date)}
                </div>

                {/* Opponent */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ 
                    fontSize: 'var(--text-xs)', 
                    color: 'var(--color-text-tertiary)',
                    fontFamily: 'var(--font-mono)',
                    width: 16,
                  }}>
                    {game.isHome ? 'vs' : '@'}
                  </span>
                  <span style={{ 
                    fontSize: 'var(--text-base)', 
                    fontWeight: 'var(--weight-medium)', 
                    color: 'var(--color-text)',
                  }}>
                    {game.opponent.city} {game.opponent.name}
                  </span>
                </div>

                {/* Result Badge */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-bold)',
                    fontFamily: 'var(--font-mono)',
                    background: game.userWon ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
                    color: game.userWon ? 'var(--color-win)' : 'var(--color-loss)',
                  }}>
                    {game.userWon ? 'W' : 'L'}
                  </span>
                </div>

                {/* Score */}
                <div style={{ 
                  textAlign: 'right', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--weight-semi)',
                  color: 'var(--color-text)',
                }}>
                  {game.userScore}–{game.oppScore}
                </div>
              </div>

              {/* Expanded Box Score */}
              {expandedGame === game.id && (
                <div style={{ 
                  padding: '16px', 
                  background: 'var(--color-bg-sunken)', 
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  {game.boxScore ? (
                    <BoxScoreExpanded 
                      data={game.boxScore} 
                      userTeamName={userTeam?.name}
                      userTeamCity={userTeam?.city}
                    />
                  ) : (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: 'var(--space-4)', 
                      color: 'var(--color-text-tertiary)',
                      fontSize: 'var(--text-sm)',
                    }}>
                      Box score not available for this game
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── Box Score Expanded ────────────────────────────────────────────────────────
function BoxScoreExpanded({ data, userTeamName, userTeamCity }) {
  const { home, away, quarterScores, winProbHistory } = data;
  
  // Determine which team is user's team
  const isUserHome = (home.name === userTeamName) || 
    (home.city === userTeamCity && home.name === userTeamName);
  const userTeam = isUserHome ? home : away;
  const oppTeam = isUserHome ? away : home;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Scoreboard */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: 32, 
        padding: '4px 0',
      }}>
        <ScoreBlock team={away} isWinner={away.score > home.score} />
        <div style={{ 
          fontSize: 'var(--text-sm)', 
          color: 'var(--color-text-tertiary)', 
          fontWeight: 'var(--weight-semi)',
        }}>
          FINAL
        </div>
        <ScoreBlock team={home} isWinner={home.score > away.score} />
      </div>

      {/* Quarter Scores */}
      {quarterScores && quarterScores.home && (
        <QuarterTable home={home} away={away} quarterScores={quarterScores} />
      )}
      
      {/* Win Probability Chart */}
      {winProbHistory && winProbHistory.length > 2 && (
        <WinProbabilityChart winProbHistory={winProbHistory} userIsHome={isUserHome} />
      )}

      {/* Team Box Scores - User's team first */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <TeamBoxTable team={userTeam} isUserTeam={true} />
        <TeamBoxTable team={oppTeam} isUserTeam={false} />
      </div>
    </div>
  );
}

function ScoreBlock({ team, isWinner }) {
  const teamLabel = team.city && team.name 
    ? `${team.city} ${team.name}` 
    : (team.teamName || team.name || 'Team');
  
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ 
        fontSize: 'var(--text-sm)', 
        color: 'var(--color-text-secondary)', 
        marginBottom: 2,
      }}>
        {teamLabel}
      </div>
      <div style={{
        fontSize: 32,
        fontWeight: 'var(--weight-bold)',
        fontFamily: 'var(--font-mono)',
        lineHeight: 1,
        color: isWinner ? 'var(--color-text)' : 'var(--color-text-tertiary)',
      }}>
        {team.score}
      </div>
    </div>
  );
}

function QuarterTable({ home, away, quarterScores }) {
  const periods = quarterScores.home?.length || 4;
  
  const getTeamLabel = (team) => {
    if (team.city && team.name) return `${team.city} ${team.name}`;
    return team.teamName || team.name || 'Team';
  };
  
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <table style={{ 
        borderCollapse: 'collapse', 
        fontSize: 'var(--text-xs)', 
        fontFamily: 'var(--font-mono)',
      }}>
        <thead>
          <tr style={{ color: 'var(--color-text-tertiary)' }}>
            <th style={{ padding: '3px 10px', textAlign: 'left' }}></th>
            {Array.from({ length: periods }, (_, i) => (
              <th key={i} style={{ padding: '3px 10px', textAlign: 'center' }}>
                {i < 4 ? `Q${i + 1}` : `OT${i - 3}`}
              </th>
            ))}
            <th style={{ padding: '3px 10px', textAlign: 'center', fontWeight: 'var(--weight-bold)' }}>F</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '3px 10px', color: 'var(--color-text-secondary)' }}>
              {getTeamLabel(away)}
            </td>
            {(quarterScores.away || []).map((q, i) => (
              <td key={i} style={{ padding: '3px 10px', textAlign: 'center' }}>{q}</td>
            ))}
            <td style={{ padding: '3px 10px', textAlign: 'center', fontWeight: 'var(--weight-bold)' }}>
              {away.score}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '3px 10px', color: 'var(--color-text-secondary)' }}>
              {getTeamLabel(home)}
            </td>
            {(quarterScores.home || []).map((q, i) => (
              <td key={i} style={{ padding: '3px 10px', textAlign: 'center' }}>{q}</td>
            ))}
            <td style={{ padding: '3px 10px', textAlign: 'center', fontWeight: 'var(--weight-bold)' }}>
              {home.score}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TeamBoxTable({ team, isUserTeam }) {
  const players = team.players || [];
  const starters = players.filter(p => p.starter);
  const bench = players.filter(p => !p.starter);

  const topScorer = players.reduce((best, p) => 
    (p.pts || 0) > (best.pts || 0) ? p : best, { pts: -1 }
  );

  const totals = players.reduce((t, p) => ({
    pts: t.pts + (p.pts || 0),
    reb: t.reb + (p.reb || 0),
    ast: t.ast + (p.ast || 0),
    stl: t.stl + (p.stl || 0),
    blk: t.blk + (p.blk || 0),
    to: t.to + (p.to || 0),
    fgm: t.fgm + (p.fgm || 0),
    fga: t.fga + (p.fga || 0),
    tpm: t.tpm + (p.tpm || 0),
    tpa: t.tpa + (p.tpa || 0),
    ftm: t.ftm + (p.ftm || 0),
    fta: t.fta + (p.fta || 0),
  }), { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 });

  const teamLabel = team.city && team.name 
    ? `${team.city} ${team.name}` 
    : (team.teamName || team.name || 'Team');

  const cellStyle = { padding: '4px 6px', textAlign: 'center' };
  const leftCellStyle = { ...cellStyle, textAlign: 'left' };

  return (
    <div>
      {/* Team Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingBottom: 6,
        borderBottom: '2px solid var(--color-border)',
        marginBottom: 4,
      }}>
        <div style={{ 
          fontWeight: 'var(--weight-bold)', 
          fontSize: 'var(--text-base)', 
          color: isUserTeam ? 'var(--color-accent)' : 'var(--color-text)',
        }}>
          {teamLabel} — {team.score}
        </div>
        <div style={{
          display: 'flex',
          gap: 12,
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-mono)',
        }}>
          <span>FG {totals.fgm}–{totals.fga} ({pctFmt(totals.fgm, totals.fga)})</span>
          <span>3P {totals.tpm}–{totals.tpa} ({pctFmt(totals.tpm, totals.tpa)})</span>
          <span>FT {totals.ftm}–{totals.fta} ({pctFmt(totals.ftm, totals.fta)})</span>
        </div>
      </div>

      {/* Stats Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
        }}>
          <thead>
            <tr style={{ 
              color: 'var(--color-text-tertiary)',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}>
              <th style={{ ...leftCellStyle, fontWeight: 'var(--weight-semi)' }}>Player</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-semi)' }}>MIN</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-semi)', color: 'var(--color-rating-good)' }}>GmSc</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-bold)' }}>PTS</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-semi)' }}>REB</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-semi)' }}>AST</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-semi)' }}>STL</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-semi)' }}>BLK</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-semi)' }}>TO</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-semi)' }}>FG</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-semi)' }}>FG%</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-semi)' }}>3PT</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-semi)' }}>3P%</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-semi)' }}>FT</th>
              <th style={{ ...cellStyle, fontWeight: 'var(--weight-semi)' }}>+/-</th>
            </tr>
          </thead>
          <tbody>
            {starters.map((p, i) => (
              <PlayerRow key={i} p={p} isTopScorer={p.name === topScorer.name} />
            ))}
            {bench.length > 0 && (
              <tr>
                <td colSpan={15} style={{
                  padding: '5px 6px 3px',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  borderTop: '1px solid var(--color-border-subtle)',
                }}>
                  Bench
                </td>
              </tr>
            )}
            {bench.map((p, i) => (
              <PlayerRow key={`b${i}`} p={p} isTopScorer={p.name === topScorer.name} />
            ))}
            {/* Totals Row */}
            <tr style={{ borderTop: '2px solid var(--color-border)', fontWeight: 'var(--weight-bold)' }}>
              <td style={leftCellStyle}>TOTAL</td>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
              <td style={cellStyle}>{totals.pts}</td>
              <td style={cellStyle}>{totals.reb}</td>
              <td style={cellStyle}>{totals.ast}</td>
              <td style={cellStyle}>{totals.stl}</td>
              <td style={cellStyle}>{totals.blk}</td>
              <td style={cellStyle}>{totals.to}</td>
              <td style={cellStyle}>{totals.fgm}–{totals.fga}</td>
              <td style={cellStyle}>{pctFmt(totals.fgm, totals.fga)}</td>
              <td style={cellStyle}>{totals.tpm}–{totals.tpa}</td>
              <td style={cellStyle}>{pctFmt(totals.tpm, totals.tpa)}</td>
              <td style={cellStyle}>{totals.ftm}–{totals.fta}</td>
              <td style={cellStyle}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerRow({ p, isTopScorer }) {
  const gameScore = calcGameScore(p);
  const pm = p.pm || 0;
  const pmColor = pm > 0 ? 'var(--color-win)' : pm < 0 ? 'var(--color-loss)' : 'var(--color-text-tertiary)';
  const pmLabel = pm > 0 ? `+${pm}` : `${pm}`;

  const cellStyle = { padding: '4px 6px', textAlign: 'center' };
  const leftCellStyle = { ...cellStyle, textAlign: 'left' };

  return (
    <tr style={{
      borderBottom: '1px solid var(--color-border-subtle)',
      background: isTopScorer ? 'var(--color-accent-bg)' : 'transparent',
    }}>
      <td style={leftCellStyle}>
        <span style={{ fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-body)' }}>
          {p.name}
        </span>
        {' '}
        <span style={{ color: 'var(--color-text-tertiary)' }}>{p.pos}</span>
      </td>
      <td style={cellStyle}>{p.min}</td>
      <td style={{ ...cellStyle, fontWeight: 'var(--weight-semi)', color: gmScColor(gameScore) }}>
        {gameScore.toFixed(1)}
      </td>
      <td style={{ ...cellStyle, fontWeight: 'var(--weight-bold)' }}>{p.pts}</td>
      <td style={cellStyle}>{p.reb}</td>
      <td style={cellStyle}>{p.ast}</td>
      <td style={cellStyle}>{p.stl}</td>
      <td style={cellStyle}>{p.blk}</td>
      <td style={cellStyle}>{p.to}</td>
      <td style={cellStyle}>{p.fgm}–{p.fga}</td>
      <td style={cellStyle}>{pctFmt(p.fgm, p.fga)}</td>
      <td style={cellStyle}>{p.tpm}–{p.tpa}</td>
      <td style={cellStyle}>{pctFmt(p.tpm, p.tpa)}</td>
      <td style={cellStyle}>{p.ftm}–{p.fta}</td>
      <td style={{ ...cellStyle, fontWeight: 'var(--weight-semi)', color: pmColor }}>{pmLabel}</td>
    </tr>
  );
}

// ─── Win Probability Chart ─────────────────────────────────────────────────────
// Displays from HOME team perspective (home at bottom, away at top) like WatchGame
// Colors are based on USER's probability (green = user winning, red = user losing)
function WinProbabilityChart({ winProbHistory, userIsHome }) {
  const [tooltip, setTooltip] = useState(null);
  
  if (!winProbHistory || winProbHistory.length < 2) {
    return null;
  }
  
  // Chart constants matching WatchGame
  const CHART_HEIGHT = 130;
  const CHART_WIDTH = 920;
  const RUN_THRESHOLD = 10;
  const RUN_Y_OFFSET = 5;
  
  // Keep points in home perspective (don't flip probability)
  // Just add user-relative fields for tooltip and coloring
  const points = winProbHistory.map(pt => ({
    ...pt,
    // Keep homeProb as-is for chart positioning
    prob: pt.homeProb,
    // User probability for coloring
    userProb: userIsHome ? pt.homeProb : (1 - pt.homeProb),
    userScore: userIsHome ? pt.homeScore : pt.awayScore,
    oppScore: userIsHome ? pt.awayScore : pt.homeScore,
    // Runs from home/away perspective for positioning
    homeRun: pt.homeRun || 0,
    awayRun: pt.awayRun || 0,
  }));
  
  // Chart geometry - home at bottom (high homeProb = low Y)
  const probToY = (homeProb) => (1 - homeProb) * CHART_HEIGHT;
  const elapsedToX = (s) => (s / TOTAL_GAME_SECONDS) * CHART_WIDTH;
  
  // Color based on USER probability
  const lineColorForUser = (userProb) => userProb > 0.55 ? C_WIN : userProb < 0.45 ? C_LOSS : C_EVEN;
  
  // Build color-segmented line (colored by user probability)
  const buildSegments = (pts) => {
    if (pts.length < 2) return [];
    const segs = [];
    let start = 0;
    for (let i = 1; i <= pts.length; i++) {
      const isLast = i === pts.length;
      if (isLast || lineColorForUser(pts[i].userProb) !== lineColorForUser(pts[start].userProb)) {
        const segPts = pts.slice(start, i);
        segs.push({ color: lineColorForUser(pts[start].userProb), points: isLast ? segPts : [...segPts, pts[i]] });
        start = i - 1;
      }
    }
    return segs;
  };
  
  // Detect scoring runs from HOME perspective (like WatchGame)
  // Home runs appear above midline, away runs below
  const detectRuns = (pts) => {
    if (pts.length < 3) return [];
    const runs = [];
    let activeRun = null;
    
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      const homeRun = pt.homeRun || 0;
      const awayRun = pt.awayRun || 0;
      
      if (homeRun >= RUN_THRESHOLD) {
        if (!activeRun || !activeRun.isHome) {
          if (activeRun && !activeRun.isHome) runs.push({ ...activeRun });
          activeRun = { isHome: true, startSeconds: pt.elapsedSeconds, peakRun: homeRun, endSeconds: pt.elapsedSeconds };
        } else {
          activeRun.peakRun = Math.max(activeRun.peakRun, homeRun);
          activeRun.endSeconds = pt.elapsedSeconds;
        }
      } else if (awayRun >= RUN_THRESHOLD) {
        if (!activeRun || activeRun.isHome) {
          if (activeRun?.isHome) runs.push({ ...activeRun });
          activeRun = { isHome: false, startSeconds: pt.elapsedSeconds, peakRun: awayRun, endSeconds: pt.elapsedSeconds };
        } else {
          activeRun.peakRun = Math.max(activeRun.peakRun, awayRun);
          activeRun.endSeconds = pt.elapsedSeconds;
        }
      } else {
        if (activeRun) {
          runs.push({ ...activeRun });
          activeRun = null;
        }
      }
    }
    if (activeRun) runs.push({ ...activeRun });
    return runs;
  };
  
  const segments = buildSegments(points);
  const runs = detectRuns(points);
  const lastPoint = points[points.length - 1];
  const finalUserProb = lastPoint ? Math.round(lastPoint.userProb * 100) : null;
  
  // Mouse handling for tooltip
  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const chartFrac = mouseX / rect.width;
    const targetSeconds = chartFrac * TOTAL_GAME_SECONDS;
    
    let closest = points[0];
    let minDist = Infinity;
    for (const pt of points) {
      const d = Math.abs(pt.elapsedSeconds - targetSeconds);
      if (d < minDist) { minDist = d; closest = pt; }
    }
    
    const ptX = (closest.elapsedSeconds / TOTAL_GAME_SECONDS) * rect.width;
    const userProbPct = Math.round(closest.userProb * 100);
    
    setTooltip({
      left: Math.max(50, Math.min(ptX, rect.width - 70)),
      userProbPct,
      userScore: closest.userScore,
      oppScore: closest.oppScore,
    });
  }, [points]);
  
  const handleMouseLeave = useCallback(() => setTooltip(null), []);
  
  // Grid lines
  const gridVerticals = [];
  for (let s = 360; s < TOTAL_GAME_SECONDS; s += 360) {
    gridVerticals.push(s);
  }
  
  // Y-axis labels: if user is home, "You" at bottom; if user is away, "You" at top
  const topLabel = userIsHome ? 'Opp' : 'You';
  const bottomLabel = userIsHome ? 'You' : 'Opp';
  
  return (
    <div style={{ 
      marginBottom: 16,
      background: 'var(--color-bg-raised)',
      padding: '12px 16px',
      border: '1px solid var(--color-border-subtle)',
    }}>
      {/* Header with title and final probability */}
      <div style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <div style={{ 
          fontSize: 'var(--text-xs)', 
          color: 'var(--color-text-tertiary)', 
          fontWeight: 'var(--weight-semi)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          Win Probability
        </div>
        {finalUserProb !== null && (
          <div style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-bold)',
            color: finalUserProb > 55 ? C_WIN : finalUserProb < 45 ? C_LOSS : 'var(--color-text)',
          }}>
            {finalUserProb}%
          </div>
        )}
      </div>
      
      <div 
        style={{ position: 'relative', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          viewBox={`-8 0 ${CHART_WIDTH + 16} ${CHART_HEIGHT + 20}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        >
          {/* Subtle grid — verticals every 6 min */}
          {gridVerticals.map((s) => (
            <line key={`gv-${s}`}
              x1={elapsedToX(s)} y1={0}
              x2={elapsedToX(s)} y2={CHART_HEIGHT}
              stroke="#ECEAE6" strokeWidth={0.75}
            />
          ))}
          
          {/* Subtle grid — horizontals at 25% and 75% */}
          <line x1={0} y1={probToY(0.75)} x2={CHART_WIDTH} y2={probToY(0.75)} stroke="#ECEAE6" strokeWidth={0.75} />
          <line x1={0} y1={probToY(0.25)} x2={CHART_WIDTH} y2={probToY(0.25)} stroke="#ECEAE6" strokeWidth={0.75} />
          
          {/* Quarter boundary lines — more visible */}
          {[720, 1440, 2160].map((s, i) => (
            <line key={`qb-${i}`}
              x1={elapsedToX(s)} y1={0}
              x2={elapsedToX(s)} y2={CHART_HEIGHT}
              stroke="#E0DDD8" strokeWidth={1} strokeDasharray="3,3"
            />
          ))}
          
          {/* 50% baseline — most prominent */}
          <line
            x1={0} y1={CHART_HEIGHT / 2}
            x2={CHART_WIDTH} y2={CHART_HEIGHT / 2}
            stroke="#D8D5D0" strokeWidth={1.5}
          />
          
          {/* Probability line — color segmented by USER probability */}
          {segments.map((seg, i) => (
            <polyline key={i}
              fill="none"
              stroke={seg.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={seg.points
                .map(p => `${elapsedToX(p.elapsedSeconds).toFixed(1)},${probToY(p.prob).toFixed(1)}`)
                .join(' ')}
            />
          ))}
          
          {/* Run annotations - positioned from HOME perspective */}
          {runs.map((run, i) => {
            const x1 = elapsedToX(run.startSeconds);
            const x2 = elapsedToX(run.endSeconds);
            const midX = (x1 + x2) / 2;
            // Home runs sit below midline (home is at bottom), away runs above
            const lineY = run.isHome
              ? CHART_HEIGHT / 2 + RUN_Y_OFFSET
              : CHART_HEIGHT / 2 - RUN_Y_OFFSET;
            const labelY = run.isHome ? lineY + 10 : lineY - 4;
            // Color based on whether this run helps the user
            const isUserRun = run.isHome === userIsHome;
            const color = isUserRun ? C_WIN : C_LOSS;
            return (
              <g key={`run-${i}`}>
                <line
                  x1={x1} y1={lineY}
                  x2={x2} y2={lineY}
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  opacity={0.85}
                />
                {/* End caps */}
                <line x1={x1} y1={lineY - 3} x2={x1} y2={lineY + 3} stroke={color} strokeWidth={1.5} opacity={0.85}/>
                <line x1={x2} y1={lineY - 3} x2={x2} y2={lineY + 3} stroke={color} strokeWidth={1.5} opacity={0.85}/>
                {/* Label */}
                <text
                  x={midX} y={labelY}
                  fontSize={8} fontWeight={600}
                  fill={color}
                  fontFamily="DM Sans, sans-serif"
                  textAnchor="middle"
                >
                  {run.peakRun}-0 run
                </text>
              </g>
            );
          })}
          
          {/* End point marker */}
          {lastPoint && (
            <circle 
              cx={elapsedToX(lastPoint.elapsedSeconds)} 
              cy={probToY(lastPoint.prob)} 
              r={3.5} 
              fill={lineColorForUser(lastPoint.userProb)} 
            />
          )}
          
          {/* X-axis labels */}
          {[
            { s: 0, label: '0' },
            { s: 720, label: 'Q2' },
            { s: 1440, label: 'Q3' },
            { s: 2160, label: 'Q4' },
            { s: 2880, label: '48' },
          ].map(({ s, label }) => (
            <text key={label}
              x={elapsedToX(s)} y={CHART_HEIGHT + 14}
              fontSize={9} fill="#A0A09A"
              fontFamily="DM Sans, sans-serif"
              textAnchor="middle"
            >{label}</text>
          ))}
          
          {/* Y-axis edge labels - adjusted based on user's side */}
          <text x={5} y={11} fontSize={9} fill="#A0A09A" fontFamily="DM Sans, sans-serif" textAnchor="start">{topLabel}</text>
          <text x={5} y={CHART_HEIGHT - 3} fontSize={9} fill="#A0A09A" fontFamily="DM Sans, sans-serif" textAnchor="start">{bottomLabel}</text>
          <text x={CHART_WIDTH - 5} y={11} fontSize={9} fill="#A0A09A" fontFamily="DM Sans, sans-serif" textAnchor="end">{topLabel}</text>
          <text x={CHART_WIDTH - 5} y={CHART_HEIGHT - 3} fontSize={9} fill="#A0A09A" fontFamily="DM Sans, sans-serif" textAnchor="end">{bottomLabel}</text>
        </svg>
        
        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: tooltip.left,
            top: 8,
            transform: 'translateX(-50%)',
            background: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border)',
            padding: '4px 8px',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}>
            <span style={{ 
              fontWeight: 'var(--weight-bold)',
              color: tooltip.userProbPct > 55 ? C_WIN : tooltip.userProbPct < 45 ? C_LOSS : 'var(--color-text)',
            }}>
              {tooltip.userProbPct}%
            </span>
            <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 8 }}>
              {tooltip.userScore}–{tooltip.oppScore}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameLogScreen;
