import React, { useState, useMemo } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card, CardHeader } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

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

  return (
    <div style={{
      maxWidth: 'var(--content-max)', margin: '0 auto',
      padding: 'var(--space-6)',
      display: 'flex', flexDirection: 'column', gap: 'var(--gap)',
    }}>
      <EmbeddedCalendar gameState={gameState} engines={engines} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)', alignItems: 'start' }}>
        <TodaysGames gameState={gameState} engines={engines} />
        <UpcomingGames gameState={gameState} engines={engines} />
      </div>

      <RecentResults gameState={gameState} engines={engines} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Embedded Calendar — matches CalendarModal design
   ═══════════════════════════════════════════════════════════════ */
function EmbeddedCalendar({ gameState, engines }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const { CalendarEngine } = engines;

  const calData = useMemo(() => {
    const gs = gameState._raw || gameState;
    if (!gs?.currentDate || !CalendarEngine?.getSeasonDates) return null;

    const startYear = gs.seasonStartYear || 2025;
    const seasonDates = CalendarEngine.getSeasonDates(startYear);
    const months = [];
    for (let m = 9; m <= 11; m++) months.push({ year: startYear, month: m });
    for (let m = 0; m <= 3; m++) months.push({ year: startYear + 1, month: m });

    const userTeamId = gs.userTeamId;
    const userTier = gs.currentTier || 1;
    const userSchedule = userTier === 1 ? gs.tier1Schedule :
                         userTier === 2 ? gs.tier2Schedule : gs.tier3Schedule;
    const allTeams = [...(gs.tier1Teams || []), ...(gs.tier2Teams || []), ...(gs.tier3Teams || [])];

    const userGamesByDate = {};
    if (userSchedule) {
      userSchedule.forEach(game => {
        if (game.date && (game.homeTeamId === userTeamId || game.awayTeamId === userTeamId)) {
          const isHome = game.homeTeamId === userTeamId;
          const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
          const opponent = allTeams.find(t => t.id === opponentId);
          userGamesByDate[game.date] = {
            isHome, opponent, played: game.played, game,
            homeScore: game.homeScore, awayScore: game.awayScore,
            homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId,
          };
        }
      });
    }

    const allGamesByDate = {};
    [gs.tier1Schedule, gs.tier2Schedule, gs.tier3Schedule].forEach(sched => {
      if (!sched) return;
      sched.forEach(game => {
        if (game.date) {
          if (!allGamesByDate[game.date]) allGamesByDate[game.date] = { total: 0 };
          allGamesByDate[game.date].total++;
        }
      });
    });

    return {
      months, currentDate: gs.currentDate, userGamesByDate, allGamesByDate,
      seasonDates: {
        allStarStart: CalendarEngine.toDateString(seasonDates.allStarStart),
        allStarEnd: CalendarEngine.toDateString(seasonDates.allStarEnd),
        tradeDeadline: CalendarEngine.toDateString(seasonDates.tradeDeadline),
        tier1End: CalendarEngine.toDateString(seasonDates.tier1End),
      },
      startYear, allTeams, userTeamId, gameState: gs,
    };
  }, [gameState, engines]);

  const dayDetail = useMemo(() => {
    if (!selectedDate || !calData) return null;
    return buildDayDetail(selectedDate, calData.gameState, calData.allTeams, calData.userTeamId);
  }, [selectedDate, calData]);

  if (!calData) return null;

  const { months, currentDate, userGamesByDate, allGamesByDate, seasonDates, startYear } = calData;
  const { allStarStart, allStarEnd, tradeDeadline, tier1End } = seasonDates;

  return (
    <Card padding="md">
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
      }}>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 700 }}>
          Season {startYear}–{(startYear + 1) % 100} Calendar
        </div>
        {/* Legend */}
        <div style={{
          display: 'flex', gap: 12, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)',
        }}>
          <LegendItem bg="var(--color-bg-raised)" label="Home" />
          <LegendItem bg="var(--color-accent-bg)" label="Away" />
          <LegendItem bg="var(--color-warning-bg)" label="Event" />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, background: 'var(--color-win)' }} /> W
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, background: 'var(--color-loss)' }} /> L
          </span>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
        gap: 'var(--gap)',
      }}>
        {months.map(({ year, month }) => (
          <MonthCard key={`${year}-${month}`}
            year={year} month={month} currentDate={currentDate}
            userGamesByDate={userGamesByDate} allGamesByDate={allGamesByDate}
            allStarStart={allStarStart} allStarEnd={allStarEnd}
            tradeDeadline={tradeDeadline} tier1End={tier1End}
            selectedDate={selectedDate} onSelectDate={setSelectedDate}
          />
        ))}
      </div>

      {dayDetail && (
        <DayDetailPanel detail={dayDetail} userTeamId={calData.userTeamId}
          onShowBoxScore={(date, homeId, awayId) => window.showBoxScore?.(date, homeId, awayId)}
        />
      )}
    </Card>
  );
}

function LegendItem({ bg, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 12, height: 12, background: bg }} />
      {label}
    </span>
  );
}

function MonthCard({
  year, month, currentDate, userGamesByDate, allGamesByDate,
  allStarStart, allStarEnd, tradeDeadline, tier1End,
  selectedDate, onSelectDate,
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div style={{
      background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)',
      padding: 12,
    }}>
      <div style={{
        textAlign: 'center', fontWeight: 600, fontSize: 'var(--text-sm)',
        color: 'var(--color-text)', marginBottom: 10,
      }}>
        {MONTH_NAMES[month]} {year}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ fontSize: 10, color: 'var(--color-text-tertiary)', padding: '2px 0', fontWeight: 600 }}>{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return (
            <DayCell key={day} day={day} dateStr={dateStr}
              currentDate={currentDate} selectedDate={selectedDate}
              userGame={userGamesByDate?.[dateStr]}
              dayGames={allGamesByDate?.[dateStr]}
              allStarStart={allStarStart} allStarEnd={allStarEnd}
              tradeDeadline={tradeDeadline} tier1End={tier1End}
              onClick={onSelectDate}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  day, dateStr, currentDate, selectedDate, userGame, dayGames,
  allStarStart, allStarEnd, tradeDeadline, tier1End, onClick,
}) {
  const isToday = dateStr === currentDate;
  const isSelected = dateStr === selectedDate;
  const isAllStar = dateStr >= allStarStart && dateStr <= allStarEnd;
  const isTradeDeadline = dateStr === tradeDeadline;
  const isSeasonEnd = dateStr === tier1End;
  const isSpecial = isAllStar || isTradeDeadline || isSeasonEnd;
  const hasContent = userGame || (dayGames && dayGames.total > 0) || isSpecial;

  let bg = 'var(--color-bg-sunken)';
  let textColor = 'var(--color-text-tertiary)';
  let sub = '';
  let resultDot = null;

  if (userGame) {
    bg = userGame.isHome ? 'var(--color-bg-raised)' : 'var(--color-accent-bg)';
    textColor = 'var(--color-text)';
    const oppName = userGame.opponent ? userGame.opponent.name.split(' ').pop() : '???';
    sub = `${userGame.isHome ? 'vs' : '@'} ${oppName}`;

    if (userGame.played) {
      const won = userGame.isHome
        ? userGame.homeScore > userGame.awayScore
        : userGame.awayScore > userGame.homeScore;
      resultDot = won ? 'var(--color-win)' : 'var(--color-loss)';
    }
  } else if (isSpecial) {
    bg = 'var(--color-warning-bg)';
    textColor = 'var(--color-warning)';
    sub = isAllStar ? 'ASG' : isTradeDeadline ? 'TDL' : 'END';
  } else if (dayGames && dayGames.total > 0) {
    sub = `${dayGames.total}g`;
  }

  return (
    <div onClick={hasContent ? () => onClick(dateStr) : undefined} style={{
      background: isSelected ? 'var(--color-accent-bg)' : bg,
      padding: '4px 3px', minHeight: 40,
      borderLeft: isToday ? '3px solid var(--color-accent)' : undefined,
      cursor: hasContent ? 'pointer' : 'default',
      transition: 'all 100ms ease',
      position: 'relative',
    }}>
      <div style={{
        fontSize: 11, fontWeight: isToday ? 700 : userGame ? 600 : 400, color: textColor,
      }}>{day}</div>
      {sub && (
        <div style={{
          fontSize: 7, color: textColor, opacity: 0.75,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1,
        }}>{sub}</div>
      )}
      {resultDot && (
        <div style={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, background: resultDot }} />
      )}
    </div>
  );
}

function DayDetailPanel({ detail, userTeamId, onShowBoxScore }) {
  const { formattedDate, event, userGame, otherGames, dateStr } = detail;

  return (
    <div style={{
      marginTop: 'var(--gap)', background: 'var(--color-bg-sunken)',
      border: '1px solid var(--color-border-subtle)', padding: '14px 16px',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      }}>{formattedDate}</div>

      {event && (
        <div style={{
          marginBottom: 12, padding: '8px 12px',
          background: 'var(--color-warning-bg)',
          color: 'var(--color-warning)', fontSize: 'var(--text-sm)', fontWeight: 600,
        }}>{event}</div>
      )}

      {!userGame && otherGames.length === 0 && (
        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>No games scheduled</div>
      )}

      {userGame && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
            textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
          }}>Your Game</div>
          <DetailGameRow game={userGame} userTeamId={userTeamId} dateStr={dateStr} onShowBoxScore={onShowBoxScore} highlight />
        </div>
      )}

      {otherGames.length > 0 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{
            cursor: 'pointer', color: 'var(--color-text-tertiary)',
            fontSize: 'var(--text-xs)', marginBottom: 6,
          }}>
            {otherGames.length} other game{otherGames.length !== 1 ? 's' : ''} today
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
            {otherGames.map((g, i) => (
              <DetailGameRow key={i} game={g} userTeamId={userTeamId} dateStr={dateStr} onShowBoxScore={onShowBoxScore} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function DetailGameRow({ game, userTeamId, dateStr, onShowBoxScore, highlight }) {
  if (!game.played) {
    return (
      <div style={{
        background: highlight ? 'var(--color-accent-bg)' : 'var(--color-bg-active)',
        border: highlight ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border-subtle)',
        padding: '10px 12px', fontSize: 'var(--text-sm)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500 }}>{game.homeName}</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>—</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontWeight: 500 }}>{game.awayName}</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>—</span>
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
          {highlight ? (game.homeTeamId === userTeamId ? 'Home' : 'Away') + ' · ' : ''}Upcoming
        </div>
      </div>
    );
  }

  const homeWon = game.homeScore > game.awayScore;
  return (
    <div onClick={() => onShowBoxScore(dateStr, game.homeTeamId, game.awayTeamId)} style={{
      background: highlight ? 'var(--color-accent-bg)' : 'var(--color-bg-raised)',
      border: highlight ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border-subtle)',
      padding: '10px 12px', cursor: 'pointer', fontSize: 'var(--text-sm)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontWeight: homeWon ? 600 : 400, color: homeWon ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>{game.homeName}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: homeWon ? 700 : 400, color: homeWon ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>{game.homeScore}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: !homeWon ? 600 : 400, color: !homeWon ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>{game.awayName}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: !homeWon ? 700 : 400, color: !homeWon ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>{game.awayScore}</span>
      </div>
      {highlight && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
          {game.homeTeamId === userTeamId ? 'Home' : 'Away'}
          {' · '}{homeWon === (game.homeTeamId === userTeamId) ? 'W' : 'L'}
          {' · View Box Score →'}
        </div>
      )}
    </div>
  );
}

function buildDayDetail(dateStr, gameState, allTeams, userTeamId) {
  const CalendarEngine = window.CalendarEngine;
  if (!CalendarEngine) return null;

  const games = CalendarEngine.getGamesForDate(dateStr, gameState);
  const event = CalendarEngine.getCalendarEvent(dateStr, gameState.seasonDates);
  const formattedDate = CalendarEngine.formatDateDisplay(dateStr);

  const allGames = [];
  for (const { schedule, tier } of [
    { schedule: games.tier1, tier: 1 },
    { schedule: games.tier2, tier: 2 },
    { schedule: games.tier3, tier: 3 },
  ]) {
    if (!schedule) continue;
    for (const game of schedule) {
      const home = allTeams.find(t => t.id === game.homeTeamId);
      const away = allTeams.find(t => t.id === game.awayTeamId);
      if (!home || !away) continue;
      allGames.push({ ...game, homeName: home.name, awayName: away.name, tier });
    }
  }

  const userGame = allGames.find(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId);
  const otherGames = allGames.filter(g => g.homeTeamId !== userTeamId && g.awayTeamId !== userTeamId);
  return { formattedDate, event, allGames, userGame, otherGames, dateStr };
}

/* ═══════════════════════════════════════════════════════════════
   Today's Games
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
    ? CalendarEngine.formatDateShort(currentDate) : currentDate;

  return (
    <Card padding="md">
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Today's Games
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{dateStr}</span>
      </div>

      {unplayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
          No games scheduled today
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {unplayed.slice(0, 8).map((game, i) => {
            const home = teams.find(t => t.id === game.homeTeamId);
            const away = teams.find(t => t.id === game.awayTeamId);
            const isUserGame = game.homeTeamId === userTeam.id || game.awayTeamId === userTeam.id;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: '6px 10px',
                background: isUserGame ? 'var(--color-accent-bg)' : 'transparent',
                border: isUserGame ? '1px solid var(--color-accent-border)' : 'none',
                fontSize: 'var(--text-sm)',
              }}>
                <span style={{ flex: 1, textAlign: 'right', fontWeight: 500 }}>{away ? away.name : '?'}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', width: 16, textAlign: 'center' }}>@</span>
                <span style={{ flex: 1, fontWeight: 500 }}>{home ? home.name : '?'}</span>
              </div>
            );
          })}
          {unplayed.length > 8 && (
            <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', paddingTop: 4 }}>
              +{unplayed.length - 8} more
            </div>
          )}
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
      !g.played && g.date >= currentDate &&
      (g.homeTeamId === userTeam.id || g.awayTeamId === userTeam.id)
    ).slice(0, 10);
  }, [schedule, currentDate, userTeam.id]);

  return (
    <Card padding="md">
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      }}>Upcoming Games</div>

      {upcoming.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
          Season complete
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {upcoming.map((game, i) => {
            const home = teams.find(t => t.id === game.homeTeamId);
            const away = teams.find(t => t.id === game.awayTeamId);
            const isHome = game.homeTeamId === userTeam.id;
            const dateStr = CalendarEngine?.formatDateShort
              ? CalendarEngine.formatDateShort(game.date) : game.date;

            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: '6px 10px',
                background: i === 0 ? 'var(--color-accent-bg)' : 'transparent',
                fontSize: 'var(--text-sm)',
              }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', minWidth: 56, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, width: 36, textAlign: 'center',
                  color: isHome ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                }}>{isHome ? 'HOME' : 'AWAY'}</span>
                <span style={{ flex: 1, fontWeight: 500 }}>
                  vs {isHome ? (away ? away.name : '?') : (home ? home.name : '?')}
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
  const { currentTier, userTeam } = gameState;
  const { CalendarEngine } = engines;
  const teams = currentTier === 1 ? gameState.tier1Teams :
                currentTier === 2 ? gameState.tier2Teams : gameState.tier3Teams;
  const schedule = currentTier === 1 ? (gameState._raw?.tier1Schedule || []) :
                   currentTier === 2 ? (gameState._raw?.tier2Schedule || []) :
                                       (gameState._raw?.tier3Schedule || []);

  const recentGames = useMemo(() => {
    if (!schedule) return [];
    return schedule.filter(g =>
      g.played && (g.homeTeamId === userTeam.id || g.awayTeamId === userTeam.id)
    ).slice(-10).reverse();
  }, [schedule, userTeam.id]);

  if (recentGames.length === 0) return null;

  return (
    <Card padding="md">
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      }}>Recent Results</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {recentGames.map((game, i) => {
          const isHome = game.homeTeamId === userTeam.id;
          const userScore = isHome ? game.homeScore : game.awayScore;
          const oppScore = isHome ? game.awayScore : game.homeScore;
          const won = userScore > oppScore;
          const opponent = teams.find(t => t.id === (isHome ? game.awayTeamId : game.homeTeamId));
          const dateStr = CalendarEngine?.formatDateShort
            ? CalendarEngine.formatDateShort(game.date) : (game.date || '');

          return (
            <div key={i}
              onClick={() => { if (game.played && game.date) window.showBoxScore?.(game.date, game.homeTeamId, game.awayTeamId); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: '6px 10px', cursor: 'pointer',
                fontSize: 'var(--text-sm)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', minWidth: 56, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, width: 16, textAlign: 'center',
                color: won ? 'var(--color-win)' : 'var(--color-loss)',
              }}>{won ? 'W' : 'L'}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600, minWidth: 52 }}>
                {userScore}–{oppScore}
              </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {isHome ? 'vs' : '@'} {opponent ? opponent.name : '?'}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
