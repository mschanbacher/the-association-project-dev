import React, { useState, useMemo, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function CalendarModal({ isOpen, data, onClose }) {
  const [selectedDate, setSelectedDate] = useState(null);

  // All data derived from props — hooks before early return
  const {
    months, currentDate, userGamesByDate, allGamesByDate,
    seasonDates, startYear, allTeams, userTeamId, gameState
  } = data || {};

  // Build day detail data when a date is selected
  const dayDetail = useMemo(() => {
    if (!selectedDate || !gameState) return null;
    return buildDayDetail(selectedDate, gameState, allTeams, userTeamId);
  }, [selectedDate, gameState, allTeams, userTeamId]);

  if (!isOpen || !data) return null;

  const { allStarStart, allStarEnd, tradeDeadline, tier1End } = seasonDates || {};

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={1100} zIndex={1300}>
      <ModalHeader onClose={onClose}>
        {'\ud83d\udcc5'} Season {startYear}-{(startYear + 1) % 100} Calendar
      </ModalHeader>

      <ModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        {/* Legend */}
        <div style={{
          display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap',
          marginBottom: 'var(--space-4)', fontSize: 'var(--text-xs)',
          color: 'var(--color-text-secondary)',
        }}>
          <LegendItem color="rgba(102,126,234,0.6)" label="Home Game" />
          <LegendItem color="rgba(234,67,53,0.5)" label="Away Game" />
          <LegendItem color="var(--color-bg-active)" label="League Games" border />
          <LegendItem color="rgba(255,215,0,0.3)" label="Special Event" />
          <LegendItem color="transparent" label="Today" todayBorder />
        </div>

        {/* Month Grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          {(months || []).map(({ year, month }) => (
            <MonthCard key={`${year}-${month}`}
              year={year} month={month} currentDate={currentDate}
              userGamesByDate={userGamesByDate} allGamesByDate={allGamesByDate}
              allStarStart={allStarStart} allStarEnd={allStarEnd}
              tradeDeadline={tradeDeadline} tier1End={tier1End}
              selectedDate={selectedDate} onSelectDate={setSelectedDate}
            />
          ))}
        </div>

        {/* Day Detail Panel */}
        {dayDetail && (
          <DayDetailPanel detail={dayDetail} userTeamId={userTeamId}
            onShowBoxScore={(dateStr, homeId, awayId) => {
              if (window.showBoxScore) window.showBoxScore(dateStr, homeId, awayId);
            }}
          />
        )}
      </ModalBody>
    </Modal>
  );
}

/* ── Legend Item ── */
function LegendItem({ color, label, border, todayBorder }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        width: 14, height: 14, borderRadius: 3, display: 'inline-block',
        background: color,
        border: todayBorder ? '2px solid #ffd700' : border ? '1px solid var(--color-border-subtle)' : 'none',
      }} />
      {label}
    </span>
  );
}

/* ── Month Card ── */
function MonthCard({
  year, month, currentDate, userGamesByDate, allGamesByDate,
  allStarStart, allStarEnd, tradeDeadline, tier1End,
  selectedDate, onSelectDate,
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = Array.from({ length: firstDay });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div style={{
      background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-3)', border: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{
        textAlign: 'center', fontWeight: 'var(--weight-semi)',
        fontSize: 'var(--text-sm)', color: 'var(--color-warning)',
        marginBottom: 'var(--space-2)',
      }}>
        {MONTH_NAMES[month]} {year}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2, textAlign: 'center',
      }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', padding: '2px 0' }}>{d}</div>
        ))}
        {blanks.map((_, i) => <div key={`b${i}`} />)}
        {days.map(day => {
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

/* ── Day Cell ── */
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
  const hasContent = userGame || (dayGames && dayGames.total > 0);

  let bg = 'transparent';
  let textColor = 'var(--color-text-tertiary)';
  let dotText = '';

  if (userGame) {
    bg = userGame.isHome
      ? (userGame.played ? 'rgba(102,126,234,0.35)' : 'rgba(102,126,234,0.6)')
      : (userGame.played ? 'rgba(234,67,53,0.3)' : 'rgba(234,67,53,0.5)');
    textColor = 'var(--color-text)';
    const oppName = userGame.opponent ? userGame.opponent.name.split(' ').pop() : '???';
    dotText = `${userGame.isHome ? 'vs' : '@'} ${oppName}`;
  } else if (dayGames && dayGames.total > 0) {
    bg = 'var(--color-bg-active)';
    textColor = 'var(--color-text-secondary)';
    dotText = `${dayGames.total}g`;
  }

  if (isSpecial) {
    bg = 'rgba(255,215,0,0.15)';
    textColor = '#ffd700';
    dotText = isAllStar ? '\u2b50' : isTradeDeadline ? 'TDL' : 'END';
  }

  return (
    <div
      onClick={hasContent ? () => onClick(dateStr) : undefined}
      style={{
        background: isSelected ? 'var(--color-accent)30' : bg,
        borderRadius: 4, padding: '3px 1px', minHeight: 36,
        color: textColor,
        border: isToday ? '2px solid #ffd700' : isSelected ? '1px solid var(--color-accent)' : 'none',
        cursor: hasContent ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ fontSize: '0.8em', fontWeight: isToday ? 'var(--weight-bold)' : 'var(--weight-normal)' }}>{day}</div>
      {dotText && (
        <div style={{
          fontSize: '0.5em', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', opacity: 0.85, marginTop: 1,
        }}>{dotText}</div>
      )}
    </div>
  );
}

/* ── Day Detail Panel ── */
function DayDetailPanel({ detail, userTeamId, onShowBoxScore }) {
  const { formattedDate, event, userGame, otherGames, dateStr } = detail;

  return (
    <div style={{
      marginTop: 'var(--space-4)', background: 'var(--color-bg-sunken)',
      borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
      border: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{
        fontWeight: 'var(--weight-semi)', color: 'var(--color-warning)',
        marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)',
      }}>
        {formattedDate}
      </div>

      {event && (
        <div style={{
          marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
          background: 'rgba(255,215,0,0.1)', borderRadius: 'var(--radius-md)',
          color: '#ffd700', fontSize: 'var(--text-sm)',
        }}>{event}</div>
      )}

      {!userGame && otherGames.length === 0 && (
        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>No games scheduled</div>
      )}

      {userGame && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)' }}>
            {'\ud83c\udfc0'} Your Game
          </div>
          <GameRow game={userGame} userTeamId={userTeamId} dateStr={dateStr} onShowBoxScore={onShowBoxScore} highlight />
        </div>
      )}

      {otherGames.length > 0 && (
        <details style={{ marginTop: 'var(--space-1)' }}>
          <summary style={{
            cursor: 'pointer', color: 'var(--color-text-tertiary)',
            fontSize: 'var(--text-xs)', marginBottom: 'var(--space-2)',
          }}>
            {otherGames.length} other game{otherGames.length !== 1 ? 's' : ''} today
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxHeight: 300, overflowY: 'auto' }}>
            {otherGames.map((g, i) => (
              <GameRow key={i} game={g} userTeamId={userTeamId} dateStr={dateStr} onShowBoxScore={onShowBoxScore} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/* ── Game Row ── */
function GameRow({ game, userTeamId, dateStr, onShowBoxScore, highlight }) {
  const isUser = game.homeTeamId === userTeamId || game.awayTeamId === userTeamId;
  const bg = highlight
    ? 'rgba(102,126,234,0.12)'
    : 'var(--color-bg-active)';

  if (!game.played) {
    return (
      <div style={{
        background: bg, padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-md)', opacity: 0.6, fontSize: 'var(--text-sm)',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{game.homeName} vs {game.awayName}</span>
        <span style={{ color: 'var(--color-text-tertiary)' }}>Upcoming</span>
      </div>
    );
  }

  const homeWon = game.homeScore > game.awayScore;
  return (
    <div
      onClick={game.played ? () => onShowBoxScore(dateStr, game.homeTeamId, game.awayTeamId) : undefined}
      style={{
        background: bg, padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-md)', cursor: game.played ? 'pointer' : 'default',
        fontSize: 'var(--text-sm)',
        border: highlight ? '1px solid rgba(102,126,234,0.25)' : '1px solid var(--color-border-subtle)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontWeight: homeWon ? 'var(--weight-semi)' : 'var(--weight-normal)', opacity: homeWon ? 1 : 0.6 }}>{game.homeName}</span>
        <span style={{ fontWeight: homeWon ? 'var(--weight-semi)' : 'var(--weight-normal)', opacity: homeWon ? 1 : 0.6 }}>{game.homeScore}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: !homeWon ? 'var(--weight-semi)' : 'var(--weight-normal)', opacity: !homeWon ? 1 : 0.6 }}>{game.awayName}</span>
        <span style={{ fontWeight: !homeWon ? 'var(--weight-semi)' : 'var(--weight-normal)', opacity: !homeWon ? 1 : 0.6 }}>{game.awayScore}</span>
      </div>
    </div>
  );
}

/* ── Helper: build day detail from gameState ── */
function buildDayDetail(dateStr, gameState, allTeams, userTeamId) {
  const CalendarEngine = window.CalendarEngine;
  if (!CalendarEngine) return null;

  const games = CalendarEngine.getGamesForDate(dateStr, gameState);
  const event = CalendarEngine.getCalendarEvent(dateStr, gameState.seasonDates);
  const formattedDate = CalendarEngine.formatDateDisplay(dateStr);

  const allGames = [];
  const tierSchedules = [
    { schedule: games.tier1, tier: 1 },
    { schedule: games.tier2, tier: 2 },
    { schedule: games.tier3, tier: 3 },
  ];

  for (const { schedule, tier } of tierSchedules) {
    if (!schedule) continue;
    for (const game of schedule) {
      const home = allTeams.find(t => t.id === game.homeTeamId);
      const away = allTeams.find(t => t.id === game.awayTeamId);
      if (!home || !away) continue;
      allGames.push({
        ...game,
        homeName: home.city ? `${home.city} ${home.name}` : home.name,
        awayName: away.city ? `${away.city} ${away.name}` : away.name,
        tier,
      });
    }
  }

  const userGame = allGames.find(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId);
  const otherGames = allGames.filter(g => g.homeTeamId !== userTeamId && g.awayTeamId !== userTeamId);

  return { formattedDate, event, allGames, userGame, otherGames, dateStr };
}
