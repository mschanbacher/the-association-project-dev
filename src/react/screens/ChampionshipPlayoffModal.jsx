import React from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

export function ChampionshipPlayoffModal({ isOpen, data, onClose }) {
  if (!isOpen || !data) return null;

  const { mode } = data;

  return (
    <Modal isOpen={isOpen} onClose={null} maxWidth={1200} zIndex={1300}>
      <ModalBody style={{ maxHeight: '80vh', overflowY: 'auto', padding: 'var(--space-5)' }}>
        {mode === 'missed' && <MissedView data={data} />}
        {mode === 'round' && <RoundView data={data} />}
        {mode === 'complete' && <CompleteView data={data} />}
        {mode === 'series' && <SeriesWatchView data={data} />}
        {mode === 'postseason' && <PostseasonView data={data} />}
        {mode === 'html' && <HtmlView data={data} />}
      </ModalBody>
    </Modal>
  );
}

/* ── Missed Playoffs ── */
function MissedView({ data }) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--space-5) 0' }}>
      <div style={{ fontSize: '2.5em', marginBottom: 'var(--space-5)' }}>{'\ud83c\udfc6'} Tier 1 Championship Playoffs</div>
      <div style={{ fontSize: '1.6em', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-8)' }}>
        Your team did not make the playoffs
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
        <Button variant="secondary" onClick={() => window.simAllChampionshipRounds?.()}>
          {'\u23e9'} Sim to Finals
        </Button>
        <Button variant="primary" onClick={() => window.skipChampionshipPlayoffs?.()}>
          {'\u23ed\ufe0f'} Skip to Off-Season
        </Button>
      </div>
    </div>
  );
}

/* ── Round Results ── */
function RoundView({ data }) {
  const { roundName, roundNumber, eastSeries, westSeries, finalsSeries, userTeamId } = data;
  const isFinals = finalsSeries && finalsSeries.length > 0;
  const champion = isFinals ? finalsSeries[0].result.winner : null;
  const isUserChampion = champion && champion.id === userTeamId;

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
        <div style={{ fontSize: '2.5em', fontWeight: 'var(--weight-bold)' }}>{'\ud83c\udfc6'} {roundName}</div>
      </div>

      {eastSeries && eastSeries.length > 0 && (
        <>
          <div style={{
            fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)',
            color: 'var(--color-warning)', margin: 'var(--space-5) 0 var(--space-3)',
          }}>Eastern Conference</div>
          {eastSeries.map((s, i) => (
            <SeriesCard key={`e${i}`} series={s} userTeamId={userTeamId} />
          ))}
        </>
      )}

      {westSeries && westSeries.length > 0 && (
        <>
          <div style={{
            fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)',
            color: 'var(--color-accent)', margin: 'var(--space-5) 0 var(--space-3)',
          }}>Western Conference</div>
          {westSeries.map((s, i) => (
            <SeriesCard key={`w${i}`} series={s} userTeamId={userTeamId} />
          ))}
        </>
      )}

      {isFinals && (
        <>
          <div style={{
            fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)',
            color: '#ffd700', textAlign: 'center',
            margin: 'var(--space-5) 0 var(--space-3)',
          }}>{'\ud83c\udfc6'} NBA FINALS {'\ud83c\udfc6'}</div>
          {finalsSeries.map((s, i) => (
            <SeriesCard key={`f${i}`} series={s} userTeamId={userTeamId} isFinals />
          ))}

          {/* Champion Banner */}
          <div style={{
            marginTop: 'var(--space-6)', padding: 'var(--space-6)',
            background: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
            borderRadius: 'var(--radius-xl)', textAlign: 'center', color: '#1e3c72',
          }}>
            <div style={{ fontSize: '3em', marginBottom: 'var(--space-2)' }}>{'\ud83c\udfc6'}</div>
            <div style={{ fontSize: '2em', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)' }}>
              {champion.name}
            </div>
            <div style={{ fontSize: '1.4em', fontWeight: 'var(--weight-bold)' }}>
              {isUserChampion ? 'YOU ARE THE CHAMPION!' : 'NBA CHAMPIONS'}
            </div>
          </div>
        </>
      )}

      {/* Action buttons */}
      <div style={{
        display: 'flex', gap: 'var(--space-3)', justifyContent: 'center',
        marginTop: 'var(--space-6)',
      }}>
        <Button variant="ghost" onClick={() => window.openBracketViewer?.()}
          style={{ opacity: 0.6 }}>
          {'\ud83d\udcca'} View Bracket
        </Button>
        {roundNumber < 4 && (
          <Button variant="secondary" onClick={() => window.simAllChampionshipRounds?.()}
            style={{ opacity: 0.7 }}>
            Sim All
          </Button>
        )}
        <Button variant="primary" onClick={() => window.continueAfterChampionshipRound?.()}>
          {roundNumber < 4 ? 'Continue to Next Round' : 'Continue to Draft'}
        </Button>
      </div>
    </div>
  );
}

/* ── Complete Quick ── */
function CompleteView({ data }) {
  const { championName } = data;
  return (
    <div style={{ textAlign: 'center', padding: 'var(--space-5) 0' }}>
      <div style={{ fontSize: '2.5em', marginBottom: 'var(--space-5)' }}>{'\ud83c\udfc6'} Championship Complete</div>

      <div style={{
        marginTop: 'var(--space-6)', padding: 'var(--space-6)',
        background: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
        borderRadius: 'var(--radius-xl)', color: '#1e3c72',
      }}>
        <div style={{ fontSize: '3em', marginBottom: 'var(--space-2)' }}>{'\ud83c\udfc6'}</div>
        <div style={{ fontSize: '2em', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)' }}>{championName}</div>
        <div style={{ fontSize: '1.4em', fontWeight: 'var(--weight-bold)' }}>NBA CHAMPIONS</div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
        <Button variant="ghost" onClick={() => window.openBracketViewer?.()}
          style={{ opacity: 0.6 }}>
          {'\ud83d\udcca'} View Bracket
        </Button>
        <Button variant="primary" onClick={() => window.skipChampionshipPlayoffs?.()}>
          Continue to Off-Season
        </Button>
      </div>
    </div>
  );
}

/* ── Playoff Series Watch Page ── */
function SeriesWatchView({ data }) {
  const { higherSeed, lowerSeed, higherWins, lowerWins, bestOf, nextGameNum, games, userTeamId, isHigherHome } = data;
  const userIsHigher = userTeamId === higherSeed.id;
  const opponent = userIsHigher ? lowerSeed : higherSeed;
  const userHome = (userIsHigher && isHigherHome) || (!userIsHigher && !isHigherHome);

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
        <div style={{ fontSize: '2em', fontWeight: 'var(--weight-bold)' }}>{'\ud83c\udfc0'} Playoff Series</div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-md)' }}>Best of {bestOf}</div>
      </div>

      {/* Scoreboard */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-6)', marginBottom: 'var(--space-5)' }}>
        <div style={{ textAlign: 'center', flex: 1, maxWidth: 200 }}>
          <div style={{ fontSize: '3em', fontWeight: 'var(--weight-bold)', color: userIsHigher ? 'var(--color-win)' : 'var(--color-loss)' }}>{higherWins}</div>
          <div style={{ fontSize: 'var(--text-md)', marginTop: 'var(--space-1)', fontWeight: userIsHigher ? 'var(--weight-bold)' : 'var(--weight-normal)', opacity: userIsHigher ? 1 : 0.8 }}>{higherSeed.name}</div>
          {userIsHigher && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-win)' }}>YOUR TEAM</div>}
        </div>
        <div style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-tertiary)' }}>vs</div>
        <div style={{ textAlign: 'center', flex: 1, maxWidth: 200 }}>
          <div style={{ fontSize: '3em', fontWeight: 'var(--weight-bold)', color: !userIsHigher ? 'var(--color-win)' : 'var(--color-loss)' }}>{lowerWins}</div>
          <div style={{ fontSize: 'var(--text-md)', marginTop: 'var(--space-1)', fontWeight: !userIsHigher ? 'var(--weight-bold)' : 'var(--weight-normal)', opacity: !userIsHigher ? 1 : 0.8 }}>{lowerSeed.name}</div>
          {!userIsHigher && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-win)' }}>YOUR TEAM</div>}
        </div>
      </div>

      {/* Game results */}
      {games && games.length > 0 && (
        <div style={{ maxWidth: 500, margin: '0 auto var(--space-5)', background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2)' }}>
          {games.map((game, i) => {
            const userWon = game.winner.id === userTeamId;
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 'var(--space-2) var(--space-3)',
                borderBottom: i < games.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                <span style={{ fontSize: 'var(--text-sm)' }}>Game {game.gameNumber}</span>
                <span style={{ color: userWon ? 'var(--color-win)' : 'var(--color-loss)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
                  {game.homeTeam.name} {game.homeScore} - {game.awayScore} {game.awayTeam.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Next game info */}
      <div style={{
        textAlign: 'center', padding: 'var(--space-4)',
        background: 'var(--color-accent)10', borderRadius: 'var(--radius-lg)',
        marginBottom: 'var(--space-4)', border: '1px solid var(--color-accent)20',
      }}>
        <div style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-2)' }}>
          Game {nextGameNum} — {userHome ? '\ud83c\udfe0 Home' : '\u2708\ufe0f Away'}
        </div>
        <div style={{ color: 'var(--color-text-secondary)' }}>
          {(userIsHigher ? higherSeed : lowerSeed).name} {userHome ? 'vs' : '@'} {opponent.name}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
        <Button variant="ghost" onClick={() => window.openBracketViewer?.()} style={{ opacity: 0.6 }}>
          {'\ud83d\udcca'} View Bracket
        </Button>
        <Button variant="secondary" onClick={() => window.simRestOfPlayoffSeries?.()} style={{ opacity: 0.7 }}>
          Sim Rest of Series
        </Button>
        <Button variant="primary" size="lg" onClick={() => window.watchPlayoffGame?.()}>
          {'\ud83c\udfc0'} Watch Game {nextGameNum}
        </Button>
      </div>
    </div>
  );
}

/* ── Generic HTML View (T2/T3 playoff pages with pre-rendered HTML) ── */
function HtmlView({ data }) {
  return (
    <div dangerouslySetInnerHTML={{ __html: data.html || '' }} />
  );
}

/* ── Postseason Results Summary ── */
function PostseasonView({ data }) {
  return (
    <div>
      <div style={{ textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: data.resultsHTML || '' }} />
      <div style={{ textAlign: 'center', marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
        <Button variant="primary" size="lg" onClick={() => window.continueAfterPostseason?.()}>
          Continue to Off-Season {'\u2192'}
        </Button>
      </div>
    </div>
  );
}

/* ── Series Card ── */
function SeriesCard({ series, userTeamId, isFinals }) {
  const r = series.result;
  const isUserInvolved = r.higherSeed?.id === userTeamId || r.lowerSeed?.id === userTeamId;

  return (
    <div style={{
      background: isUserInvolved ? 'var(--color-accent)20' : 'var(--color-bg-sunken)',
      padding: 'var(--space-4)', marginBottom: 'var(--space-4)',
      borderRadius: 'var(--radius-lg)',
      border: `2px solid ${isUserInvolved ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>
          {r.winner.name} defeat {r.loser.name}
        </div>
        <div style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)' }}>
          Series: {r.seriesScore}
        </div>
      </div>

      {/* Game-by-game */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: 600, margin: '0 auto' }}>
        {(r.games || []).map((game, idx) => {
          const homeWon = game.winner.id === game.homeTeam.id;
          return (
            <div key={idx} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--color-bg-active)', borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-sm)',
            }}>
              <span style={{ flex: '0 0 60px' }}>Game {game.gameNumber}</span>
              <span style={{
                flex: 2, textAlign: 'right',
                fontWeight: homeWon ? 'var(--weight-bold)' : 'var(--weight-normal)',
                opacity: homeWon ? 1 : 0.6,
              }}>{game.homeTeam.name} {game.homeScore}</span>
              <span style={{ margin: '0 var(--space-3)', color: 'var(--color-text-tertiary)' }}>-</span>
              <span style={{
                flex: 2, textAlign: 'left',
                fontWeight: !homeWon ? 'var(--weight-bold)' : 'var(--weight-normal)',
                opacity: !homeWon ? 1 : 0.6,
              }}>{game.awayScore} {game.awayTeam.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
