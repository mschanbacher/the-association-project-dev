import React, { useMemo } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card, CardHeader } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';

export function ScheduleScreen() {
  const { gameState, engines, isReady } = useGame();

  if (!isReady || !gameState?.userTeam) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', color: 'var(--color-text-tertiary)',
      }}>
        Loading schedule…
      </div>
    );
  }

  const { currentDate, currentTier, userTeam } = gameState;
  const { CalendarEngine } = engines;

  return (
    <div style={{
      maxWidth: 'var(--content-max)',
      margin: '0 auto',
      padding: 'var(--space-6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)',
    }}>
      <h2 style={{
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--weight-bold)',
        margin: 0,
      }}>
        Schedule
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-5)',
        alignItems: 'start',
      }}>
        {/* Today's Games */}
        <TodaysGames gameState={gameState} engines={engines} />

        {/* Upcoming User Games */}
        <UpcomingGames gameState={gameState} engines={engines} />
      </div>

      {/* Recent Results */}
      <RecentResults gameState={gameState} engines={engines} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Today's Games Panel
   ═══════════════════════════════════════════════════════════════ */
function TodaysGames({ gameState, engines }) {
  const { CalendarEngine } = engines;
  const { currentDate, currentTier, userTeam } = gameState;

  const todaysData = useMemo(() => {
    if (!currentDate || !CalendarEngine?.getGamesForDate) return null;
    return CalendarEngine.getGamesForDate(currentDate, gameState._raw || gameState);
  }, [currentDate, CalendarEngine, gameState]);

  if (!todaysData) return null;

  const tierGames = currentTier === 1 ? todaysData.tier1 :
                    currentTier === 2 ? todaysData.tier2 : todaysData.tier3;
  const unplayed = (tierGames || []).filter(g => !g.played);

  const teams = currentTier === 1 ? gameState.tier1Teams :
                currentTier === 2 ? gameState.tier2Teams : gameState.tier3Teams;

  const dateStr = CalendarEngine?.formatDateShort
    ? CalendarEngine.formatDateShort(currentDate)
    : currentDate;

  // Other tier counts
  const otherTiers = [];
  if (currentTier !== 1) {
    const c = (todaysData.tier1 || []).filter(g => !g.played).length;
    if (c > 0) otherTiers.push({ tier: 1, count: c });
  }
  if (currentTier !== 2) {
    const c = (todaysData.tier2 || []).filter(g => !g.played).length;
    if (c > 0) otherTiers.push({ tier: 2, count: c });
  }
  if (currentTier !== 3) {
    const c = (todaysData.tier3 || []).filter(g => !g.played).length;
    if (c > 0) otherTiers.push({ tier: 3, count: c });
  }

  return (
    <Card padding="lg" className="animate-slide-up">
      <CardHeader action={
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>{dateStr}</span>
      }>
        Today's Games
      </CardHeader>

      {unplayed.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 'var(--space-6) 0',
          color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)',
        }}>
          No games scheduled today
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {unplayed.slice(0, 8).map((game, i) => {
            const home = teams.find(t => t.id === game.homeTeamId);
            const away = teams.find(t => t.id === game.awayTeamId);
            const isUserGame = game.homeTeamId === userTeam.id || game.awayTeamId === userTeam.id;

            return (
              <GameRow key={i}
                home={home} away={away}
                isUserGame={isUserGame}
              />
            );
          })}
          {unplayed.length > 8 && (
            <div style={{
              textAlign: 'center', fontSize: 'var(--text-sm)',
              color: 'var(--color-text-tertiary)', paddingTop: 'var(--space-2)',
            }}>
              +{unplayed.length - 8} more games
            </div>
          )}
        </div>
      )}

      {otherTiers.length > 0 && (
        <div style={{
          marginTop: 'var(--space-3)',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--color-border-subtle)',
          display: 'flex',
          gap: 'var(--space-3)',
          justifyContent: 'center',
        }}>
          {otherTiers.map(({ tier, count }) => (
            <span key={tier} style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-tertiary)',
            }}>
              T{tier}: {count} games
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Upcoming User Games
   ═══════════════════════════════════════════════════════════════ */
function UpcomingGames({ gameState, engines }) {
  const { CalendarEngine } = engines;
  const { currentDate, currentTier, userTeam } = gameState;

  const teams = currentTier === 1 ? gameState.tier1Teams :
                currentTier === 2 ? gameState.tier2Teams : gameState.tier3Teams;

  const schedule = currentTier === 1 ? (gameState._raw?.tier1Schedule || []) :
                   currentTier === 2 ? (gameState._raw?.tier2Schedule || []) :
                                       (gameState._raw?.tier3Schedule || []);

  const upcoming = useMemo(() => {
    if (!schedule || !currentDate) return [];
    return schedule.filter(g =>
      !g.played &&
      g.date >= currentDate &&
      (g.homeTeamId === userTeam.id || g.awayTeamId === userTeam.id)
    ).slice(0, 10);
  }, [schedule, currentDate, userTeam.id]);

  return (
    <Card padding="lg" className="animate-slide-up">
      <CardHeader>Upcoming Games</CardHeader>

      {upcoming.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 'var(--space-6) 0',
          color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)',
        }}>
          Season complete!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {upcoming.map((game, i) => {
            const home = teams.find(t => t.id === game.homeTeamId);
            const away = teams.find(t => t.id === game.awayTeamId);
            const isHome = game.homeTeamId === userTeam.id;
            const dateStr = CalendarEngine?.formatDateShort
              ? CalendarEngine.formatDateShort(game.date) : game.date;

            return (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: i === 0 ? 'var(--color-accent-light)' : 'transparent',
                border: i === 0 ? '1px solid var(--color-accent-subtle)' : '1px solid transparent',
              }}>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-tertiary)',
                  minWidth: 60,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {dateStr}
                </span>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--weight-semi)',
                  color: isHome ? 'var(--color-win)' : 'var(--color-info)',
                  width: 36,
                  textAlign: 'center',
                }}>
                  {isHome ? 'HOME' : 'AWAY'}
                </span>
                <span style={{
                  flex: 1,
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                }}>
                  vs {isHome
                    ? (away ? `${away.city} ${away.teamName || away.name}` : '?')
                    : (home ? `${home.city} ${home.teamName || home.name}` : '?')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Recent Results
   ═══════════════════════════════════════════════════════════════ */
function RecentResults({ gameState, engines }) {
  const { currentTier, userTeam, currentDate } = gameState;
  const { CalendarEngine } = engines;

  const teams = currentTier === 1 ? gameState.tier1Teams :
                currentTier === 2 ? gameState.tier2Teams : gameState.tier3Teams;

  const schedule = currentTier === 1 ? (gameState._raw?.tier1Schedule || []) :
                   currentTier === 2 ? (gameState._raw?.tier2Schedule || []) :
                                       (gameState._raw?.tier3Schedule || []);

  const recentGames = useMemo(() => {
    if (!schedule) return [];
    return schedule.filter(g =>
      g.played &&
      (g.homeTeamId === userTeam.id || g.awayTeamId === userTeam.id)
    ).slice(-10).reverse();
  }, [schedule, userTeam.id]);

  if (recentGames.length === 0) return null;

  const handleClickGame = (game) => {
    if (!game.played || !game.date) return;
    // Delegate to the legacy showBoxScore which now routes to React modal
    window.showBoxScore?.(game.date, game.homeTeamId, game.awayTeamId);
  };

  return (
    <Card padding="lg" className="animate-slide-up">
      <CardHeader>Recent Results</CardHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {recentGames.map((game, i) => {
          const home = teams.find(t => t.id === game.homeTeamId);
          const away = teams.find(t => t.id === game.awayTeamId);
          const isHome = game.homeTeamId === userTeam.id;
          const userScore = isHome ? game.homeScore : game.awayScore;
          const oppScore = isHome ? game.awayScore : game.homeScore;
          const won = userScore > oppScore;
          const opponent = isHome ? away : home;
          const dateStr = CalendarEngine?.formatDateShort
            ? CalendarEngine.formatDateShort(game.date) : (game.date || '');
          const hasBox = !!game.boxScore;

          return (
            <div key={i}
              onClick={() => handleClickGame(game)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                cursor: game.played ? 'pointer' : 'default',
                transition: 'background var(--duration-fast) ease',
              }}
              onMouseEnter={e => { if (game.played) e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
                minWidth: 60,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {dateStr}
              </span>
              <Badge variant={won ? 'win' : 'loss'}>
                {won ? 'W' : 'L'}
              </Badge>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semi)',
                minWidth: 56,
              }}>
                {userScore}–{oppScore}
              </span>
              <span style={{
                flex: 1,
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-secondary)',
              }}>
                {isHome ? 'vs' : '@'} {opponent ? `${opponent.city} ${opponent.teamName || opponent.name}` : '?'}
              </span>
              {hasBox && (
                <span style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-tertiary)',
                  opacity: 0.6,
                }}>📊</span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Game Row
   ═══════════════════════════════════════════════════════════════ */
function GameRow({ home, away, isUserGame, score }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: 'var(--space-2) var(--space-3)',
      borderRadius: 'var(--radius-md)',
      background: isUserGame ? 'var(--color-accent-light)' : 'var(--color-bg-sunken)',
      border: isUserGame ? '1px solid var(--color-accent-subtle)' : '1px solid var(--color-border-subtle)',
      gap: 'var(--space-3)',
    }}>
      <span style={{
        flex: 1,
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-medium)',
        textAlign: 'right',
      }}>
        {away ? `${away.city} ${away.teamName || away.name}` : '?'}
      </span>
      <span style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)',
        fontWeight: 'var(--weight-semi)',
        padding: '2px 8px',
      }}>
        @
      </span>
      <span style={{
        flex: 1,
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-medium)',
      }}>
        {home ? `${home.city} ${home.teamName || home.name}` : '?'}
      </span>
      {isUserGame && (
        <Badge variant="accent" style={{ flexShrink: 0 }}>You</Badge>
      )}
    </div>
  );
}
