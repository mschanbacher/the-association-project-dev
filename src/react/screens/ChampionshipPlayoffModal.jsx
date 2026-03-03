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
        {mode === 't2-div-semis' && <T2DivSemisView data={data} />}
        {mode === 't2-div-final' && <T2DivFinalView data={data} />}
        {mode === 't2-national-result' && <T2NationalRoundView data={data} />}
        {mode === 't2-elimination' && <T2EliminationView data={data} />}
        {mode === 't2-complete' && <T2CompleteView data={data} />}
        {mode === 't3-metro-result' && <T3MetroResultView data={data} />}
        {mode === 't3-regional-result' && <T3RegionalResultView data={data} />}
        {mode === 't3-national-result' && <T3NationalRoundView data={data} />}
        {mode === 't3-elimination' && <T3EliminationView data={data} />}
        {mode === 't3-complete' && <T3CompleteView data={data} />}
        {mode === 'html' && <div style={{ textAlign: 'center', padding: 'var(--space-6)', opacity: 0.5 }}>Legacy view — this should not appear.</div>}
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

/* ── T2 Division Semis Result ── */
function T2DivSemisView({ data }) {
  const { division, semi1, semi2, userTeam } = data;
  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
        <div style={{ fontSize: '2.2em', fontWeight: 'var(--weight-bold)' }}>🏀 Division Playoffs</div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-lg)' }}>{division} — Semifinals (Best of 3)</div>
      </div>
      <InlineSeriesCard result={semi1} userTeamId={userTeam?.id} />
      <InlineSeriesCard result={semi2} userTeamId={userTeam?.id} />
      <T2ActionBar onContinue={() => window.continueT2AfterDivisionSemis?.()} continueLabel="Continue to Division Final" />
    </div>
  );
}

/* ── T2 Division Final Result ── */
function T2DivFinalView({ data }) {
  const { division, divFinal, userTeam } = data;
  const isChampion = divFinal?.winner?.id === userTeam?.id;
  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
        <div style={{ fontSize: '2.2em', fontWeight: 'var(--weight-bold)' }}>🏀 Division Final</div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-lg)' }}>{division} — Championship (Best of 3)</div>
      </div>
      <InlineSeriesCard result={divFinal} userTeamId={userTeam?.id} />
      {isChampion ? (
        <div style={{
          margin: 'var(--space-5) 0', padding: 'var(--space-5)', textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,237,78,0.08))',
          borderRadius: 'var(--radius-xl)', border: '1px solid rgba(255,215,0,0.4)',
        }}>
          <div style={{ fontSize: '1.3em', fontWeight: 'var(--weight-bold)', color: '#ffd700', marginBottom: 'var(--space-1)' }}>🏆 Division Champions!</div>
          <div style={{ opacity: 0.9 }}>Advancing to the NARBL National Tournament</div>
        </div>
      ) : (
        <div style={{
          margin: 'var(--space-5) 0', padding: 'var(--space-4)', textAlign: 'center',
          background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ opacity: 0.9 }}>Division Runner-Up — may qualify for National Tournament based on record</div>
        </div>
      )}
      <T2ActionBar onContinue={() => window.continueT2AfterDivisionFinal?.()} continueLabel="Continue" />
    </div>
  );
}

/* ── T2 National Round Result ── */
function T2NationalRoundView({ data }) {
  const { roundName, roundNumber, roundResults, userTeam, isChampionshipRound, champion } = data;
  const isUserChampion = champion && champion.id === userTeam?.id;
  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
        <div style={{ fontSize: '2.2em', fontWeight: 'var(--weight-bold)' }}>{isChampionshipRound ? '🏆 ' : ''}{roundName}</div>
      </div>
      {(roundResults || []).filter(Boolean).map((s, i) => {
        const sr = s.result || s;
        const isUser = sr.higherSeed?.id === userTeam?.id || sr.lowerSeed?.id === userTeam?.id;
        return <InlineSeriesCard key={i} result={sr} userTeamId={userTeam?.id} highlight={isUser} />;
      })}
      {isChampionshipRound && champion && (
        <div style={{
          marginTop: 'var(--space-6)', padding: 'var(--space-6)', textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(192,192,192,0.25), rgba(192,192,192,0.08))',
          borderRadius: 'var(--radius-xl)', border: '1px solid rgba(192,192,192,0.4)',
        }}>
          <div style={{ fontSize: '3em', marginBottom: 'var(--space-2)' }}>🏆</div>
          <div style={{ fontSize: '2em', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)' }}>{champion.name}</div>
          <div style={{ fontSize: '1.3em', fontWeight: 'var(--weight-bold)' }}>
            {isUserChampion ? 'YOU ARE THE NARBL CHAMPION!' : 'NARBL CHAMPIONS'}
          </div>
        </div>
      )}
      <T2ActionBar
        onContinue={() => window.continueT2AfterNationalRound?.()}
        continueLabel={isChampionshipRound ? 'Continue to Off-Season' : 'Continue to Next Round'}
      />
    </div>
  );
}

/* ── T2 Elimination ── */
function T2EliminationView({ data }) {
  const { userTeam, eliminatedIn, champion } = data;
  return (
    <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
      <div style={{ fontSize: '2.2em', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-5)' }}>Season Over</div>
      <div style={{
        margin: 'var(--space-5) 0', padding: 'var(--space-5)',
        background: 'rgba(102,126,234,0.1)', borderRadius: 'var(--radius-xl)',
        border: '1px solid rgba(102,126,234,0.25)',
      }}>
        <div style={{ fontSize: '1.3em', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)' }}>{userTeam?.name}</div>
        <div style={{ opacity: 0.9 }}>Eliminated in {eliminatedIn}</div>
        <div style={{ marginTop: 'var(--space-2)', opacity: 0.7 }}>Final Record: {userTeam?.wins}-{userTeam?.losses}</div>
      </div>
      {champion && (
        <div style={{
          margin: 'var(--space-5) 0', padding: 'var(--space-5)',
          background: 'rgba(192,192,192,0.06)', borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(192,192,192,0.15)',
        }}>
          <div style={{ color: '#c0c0c0', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-1)' }}>NARBL Champion</div>
          <div style={{ fontSize: '1.5em', fontWeight: 'var(--weight-bold)' }}>🏆 {champion.name}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
        <Button variant="ghost" onClick={() => window.openBracketViewer?.()} style={{ opacity: 0.6 }}>📊 View Bracket</Button>
        <Button variant="primary" size="lg" onClick={() => window.skipT2Playoffs?.()}>Continue to Off-Season</Button>
      </div>
    </div>
  );
}

/* ── T2 Playoff Complete ── */
function T2CompleteView({ data }) {
  const { champion } = data;
  return (
    <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5em', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-5)' }}>🏆 NARBL Playoffs Complete</div>
      <div style={{
        marginTop: 'var(--space-5)', padding: 'var(--space-6)',
        background: 'linear-gradient(135deg, rgba(192,192,192,0.25), rgba(192,192,192,0.08))',
        borderRadius: 'var(--radius-xl)', border: '1px solid rgba(192,192,192,0.4)',
      }}>
        <div style={{ fontSize: '3em', marginBottom: 'var(--space-2)' }}>🏆</div>
        <div style={{ fontSize: '2em', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)' }}>{champion?.name || 'TBD'}</div>
        <div style={{ fontSize: '1.3em', fontWeight: 'var(--weight-bold)' }}>NARBL CHAMPIONS</div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
        <Button variant="ghost" onClick={() => window.openBracketViewer?.()} style={{ opacity: 0.6 }}>📊 View Bracket</Button>
        <Button variant="primary" size="lg" onClick={() => window.skipT2Playoffs?.()}>Continue to Off-Season</Button>
      </div>
    </div>
  );
}

/* ── Shared: T2 Action Bar ── */
function T2ActionBar({ onContinue, continueLabel }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
      <Button variant="ghost" onClick={() => window.openBracketViewer?.()} style={{ opacity: 0.6 }}>📊 View Bracket</Button>
      <Button variant="secondary" onClick={() => window.simAllT2Rounds?.()} style={{ opacity: 0.7 }}>Sim All</Button>
      <Button variant="primary" size="lg" onClick={onContinue}>{continueLabel}</Button>
    </div>
  );
}

/* ── T3 Metro Final Result ── */
function T3MetroResultView({ data }) {
  const { result, userTeam, userSeed, hasBye, totalMetroChamps } = data;
  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
        <div style={{ fontSize: '2.2em', fontWeight: 'var(--weight-bold)' }}>🏀 Metro Finals</div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-md)' }}>Best of 3</div>
      </div>
      <InlineSeriesCard result={result} userTeamId={userTeam?.id} />
      <div style={{
        margin: 'var(--space-5) 0', padding: 'var(--space-5)', textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(205,127,50,0.25), rgba(205,127,50,0.08))',
        borderRadius: 'var(--radius-xl)', border: '1px solid rgba(205,127,50,0.4)',
      }}>
        <div style={{ fontSize: '1.3em', fontWeight: 'var(--weight-bold)', color: '#cd7f32', marginBottom: 'var(--space-2)' }}>🏆 Metro Champion!</div>
        <div style={{ fontSize: 'var(--text-md)' }}>Seeded <strong>#{userSeed}</strong> of {totalMetroChamps} metro champions</div>
        <div style={{ marginTop: 'var(--space-2)', opacity: 0.8 }}>
          {hasBye ? '✨ You earned a BYE to the Sweet 16!' : '⚡ You will play in the Regional Round to reach the Sweet 16'}
        </div>
      </div>
      <T3ActionBar
        onContinue={() => window.continueT3AfterMetroFinal?.()}
        continueLabel={hasBye ? 'Continue to Sweet 16' : 'Continue to Regional Round'}
      />
    </div>
  );
}

/* ── T3 Regional Round Result ── */
function T3RegionalResultView({ data }) {
  const { userTeam, userSeed16, userResult } = data;
  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
        <div style={{ fontSize: '2.2em', fontWeight: 'var(--weight-bold)' }}>🏀 Regional Round</div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-md)' }}>Play-In (Best of 3)</div>
      </div>
      {userResult && <InlineSeriesCard result={userResult} userTeamId={userTeam?.id} />}
      <div style={{
        margin: 'var(--space-5) 0', padding: 'var(--space-4)', textAlign: 'center',
        background: 'rgba(205,127,50,0.08)', borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(205,127,50,0.25)',
      }}>
        <div style={{ fontSize: 'var(--text-md)' }}>Advanced to Sweet 16 as <strong>#{userSeed16} seed</strong></div>
      </div>
      <T3ActionBar onContinue={() => window.continueT3AfterRegionalRound?.()} continueLabel="Continue to Sweet 16" />
    </div>
  );
}

/* ── T3 National Round Result ── */
function T3NationalRoundView({ data }) {
  const { roundName, stage, roundResults, userTeam, isChampionship, champion } = data;
  const isUserChampion = champion && champion.id === userTeam?.id;
  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
        <div style={{ fontSize: '2.2em', fontWeight: 'var(--weight-bold)' }}>{isChampionship ? '🏆 ' : ''}{roundName}</div>
      </div>
      {(roundResults || []).filter(Boolean).map((s, i) => {
        const sr = s.result || s;
        const isUser = sr.higherSeed?.id === userTeam?.id || sr.lowerSeed?.id === userTeam?.id;
        return <InlineSeriesCard key={i} result={sr} userTeamId={userTeam?.id} highlight={isUser} />;
      })}
      {isChampionship && champion && (
        <div style={{
          marginTop: 'var(--space-6)', padding: 'var(--space-6)', textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(205,127,50,0.35), rgba(205,127,50,0.1))',
          borderRadius: 'var(--radius-xl)', border: '1px solid rgba(205,127,50,0.5)',
        }}>
          <div style={{ fontSize: '3em', marginBottom: 'var(--space-2)' }}>🏆</div>
          <div style={{ fontSize: '2em', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)' }}>{champion.name}</div>
          <div style={{ fontSize: '1.3em', fontWeight: 'var(--weight-bold)' }}>
            {isUserChampion ? 'YOU ARE THE METRO LEAGUE CHAMPION!' : 'METRO LEAGUE CHAMPIONS'}
          </div>
          {isUserChampion && <div style={{ marginTop: 'var(--space-2)', color: '#cd7f32' }}>🎉 Promoted to Tier 2!</div>}
        </div>
      )}
      <T3ActionBar
        onContinue={() => window.continueT3AfterNationalRound?.()}
        continueLabel={isChampionship ? 'Continue to Off-Season' : 'Continue to Next Round'}
      />
    </div>
  );
}

/* ── T3 Elimination ── */
function T3EliminationView({ data }) {
  const { userTeam, eliminatedIn, champion } = data;
  return (
    <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
      <div style={{ fontSize: '2.2em', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-5)' }}>Season Over</div>
      <div style={{
        margin: 'var(--space-5) 0', padding: 'var(--space-5)',
        background: 'rgba(205,127,50,0.08)', borderRadius: 'var(--radius-xl)',
        border: '1px solid rgba(205,127,50,0.25)',
      }}>
        <div style={{ fontSize: '1.3em', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)' }}>{userTeam?.name}</div>
        <div style={{ opacity: 0.9 }}>Eliminated in {eliminatedIn}</div>
        <div style={{ marginTop: 'var(--space-2)', opacity: 0.7 }}>Final Record: {userTeam?.wins}-{userTeam?.losses}</div>
      </div>
      {champion && (
        <div style={{
          margin: 'var(--space-5) 0', padding: 'var(--space-5)',
          background: 'rgba(205,127,50,0.06)', borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(205,127,50,0.15)',
        }}>
          <div style={{ color: '#cd7f32', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-1)' }}>Metro League Champion</div>
          <div style={{ fontSize: '1.5em', fontWeight: 'var(--weight-bold)' }}>🏆 {champion.name}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
        <Button variant="ghost" onClick={() => window.openBracketViewer?.()} style={{ opacity: 0.6 }}>📊 View Bracket</Button>
        <Button variant="primary" size="lg" onClick={() => window.skipT3Playoffs?.()}>Continue to Off-Season</Button>
      </div>
    </div>
  );
}

/* ── T3 Playoff Complete ── */
function T3CompleteView({ data }) {
  const { champion } = data;
  return (
    <div style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5em', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-5)' }}>🏆 Metro League Playoffs Complete</div>
      <div style={{
        marginTop: 'var(--space-5)', padding: 'var(--space-6)',
        background: 'linear-gradient(135deg, rgba(205,127,50,0.25), rgba(205,127,50,0.08))',
        borderRadius: 'var(--radius-xl)', border: '1px solid rgba(205,127,50,0.4)',
      }}>
        <div style={{ fontSize: '3em', marginBottom: 'var(--space-2)' }}>🏆</div>
        <div style={{ fontSize: '2em', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)' }}>{champion?.name || 'TBD'}</div>
        <div style={{ fontSize: '1.3em', fontWeight: 'var(--weight-bold)' }}>METRO LEAGUE CHAMPIONS</div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
        <Button variant="ghost" onClick={() => window.openBracketViewer?.()} style={{ opacity: 0.6 }}>📊 View Bracket</Button>
        <Button variant="primary" size="lg" onClick={() => window.skipT3Playoffs?.()}>Continue to Off-Season</Button>
      </div>
    </div>
  );
}

/* ── Postseason Results Summary (native React) ── */
function PostseasonView({ data }) {
  const {
    t1Champion, t2Champion, t3Champion, t1Finals,
    promotedToT1, promotedToT2, relegatedFromT1, relegatedFromT2,
    t1Relegation, t2Relegation,
  } = data;

  return (
    <div style={{ textAlign: 'center', maxHeight: '75vh', overflowY: 'auto', padding: 'var(--space-5)' }}>
      <div style={{ fontSize: '2.5em', marginBottom: 'var(--space-5)' }}>🏆 Postseason Results</div>

      {/* Champions */}
      {t1Champion && (
        <ChampionBanner
          tier="Tier 1 — NAPL Champion" name={t1Champion.name}
          bg="linear-gradient(135deg, var(--color-accent), #d4a843)"
          color="var(--color-bg)"
          subtitle={t1Finals ? `Finals: ${t1Finals.result.higherWins}-${t1Finals.result.lowerWins}` : null}
        />
      )}
      {t2Champion && (
        <ChampionBanner tier="Tier 2 — NARBL Champion" name={t2Champion.name}
          bg="rgba(192,192,192,0.1)" border="1px solid rgba(192,192,192,0.25)"
          tierColor="#c0c0c0"
        />
      )}
      {t3Champion && (
        <ChampionBanner tier="Tier 3 — MBL Champion" name={t3Champion.name}
          bg="rgba(205,127,50,0.1)" border="1px solid rgba(205,127,50,0.25)"
          tierColor="#cd7f32"
        />
      )}

      {/* Promotion / Relegation */}
      <div style={{
        background: 'var(--color-bg-sunken)', padding: 'var(--space-5)',
        borderRadius: 'var(--radius-lg)', margin: 'var(--space-5) 0',
      }}>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-4)' }}>
          ⬆️⬇️ Promotion & Relegation
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <ProRelBox title="⬆️ Promoted to Tier 1" color="var(--color-win, #34a853)" teams={promotedToT1} iconFirst="👑" iconRest="⬆️" />
          <ProRelBox title="⬇️ Relegated from Tier 1" color="var(--color-loss, #ea4335)" teams={relegatedFromT1} iconFirst="💀" iconRest="⬇️" autoFirst />
          <ProRelBox title="⬆️ Promoted to Tier 2" color="var(--color-win, #34a853)" teams={promotedToT2} iconFirst="👑" iconRest="⬆️" />
          <ProRelBox title="⬇️ Relegated from Tier 2" color="var(--color-loss, #ea4335)" teams={relegatedFromT2} iconFirst="💀" iconRest="⬇️" autoFirst />
        </div>
      </div>

      {/* Relegation Bracket Details */}
      {t1Relegation?.completed && <RelegationBracket bracket={t1Relegation} tierName="Tier 1" />}
      {t2Relegation?.completed && <RelegationBracket bracket={t2Relegation} tierName="Tier 2" />}

      {/* Continue */}
      <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
        <Button variant="primary" size="lg" onClick={() => window.continueAfterPostseason?.()}>
          Continue to Off-Season {'\u2192'}
        </Button>
      </div>
    </div>
  );
}

/* ── Champion Banner ── */
function ChampionBanner({ tier, name, subtitle, bg, color, border, tierColor }) {
  return (
    <div style={{
      margin: 'var(--space-4) 0', padding: 'var(--space-5)',
      background: bg || 'var(--color-bg-sunken)',
      borderRadius: 'var(--radius-lg)',
      color: color || 'var(--color-text)',
      border: border || 'none',
    }}>
      <div style={{ fontSize: 'var(--text-md)', opacity: 0.8, marginBottom: 'var(--space-1)', color: tierColor || 'inherit' }}>
        {tier}
      </div>
      <div style={{ fontSize: '2.2em', fontWeight: 'var(--weight-bold)', margin: 'var(--space-1) 0' }}>
        🏆 {name}
      </div>
      {subtitle && <div style={{ fontSize: 'var(--text-md)', opacity: 0.9 }}>{subtitle}</div>}
    </div>
  );
}

/* ── Promotion/Relegation Box ── */
function ProRelBox({ title, color, teams, iconFirst, iconRest, autoFirst }) {
  if (!teams || teams.length === 0) return null;
  return (
    <div style={{
      padding: 'var(--space-3)', background: color + '08',
      borderRadius: 'var(--radius-md)', textAlign: 'left',
    }}>
      <div style={{ color, fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
        {title}
      </div>
      {teams.map((t, i) => (
        <div key={i} style={{ margin: '4px 0', fontSize: 'var(--text-sm)' }}>
          {i === 0 ? iconFirst : iconRest} {t.name}{i === 0 && autoFirst ? ' (auto)' : ''}
        </div>
      ))}
    </div>
  );
}

/* ── Relegation Bracket Detail ── */
function RelegationBracket({ bracket, tierName }) {
  return (
    <div style={{
      background: 'var(--color-loss, #ea4335)05', padding: 'var(--space-4)',
      borderRadius: 'var(--radius-lg)', margin: 'var(--space-3) 0', textAlign: 'left',
    }}>
      <div style={{ color: 'var(--color-loss, #ea4335)', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-3)' }}>
        ⬇️ {tierName} Relegation Bracket
      </div>
      <div style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
        <span style={{ opacity: 0.7 }}>Auto-relegated:</span>{' '}
        <strong>{bracket.autoRelegated.name}</strong> (last place)
      </div>
      <div style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
        <span style={{ opacity: 0.7 }}>Round 1 (Bo5):</span>{' '}
        <strong>{bracket.round1Higher.name}</strong> vs <strong>{bracket.round1Lower.name}</strong>
        {' → '}{bracket.round1Result.winner.name} wins {bracket.round1Result.higherWins}-{bracket.round1Result.lowerWins}
        {' '}<span style={{ color: 'var(--color-loss, #ea4335)' }}>({bracket.round1Result.loser.name} relegated)</span>
      </div>
      <div style={{ fontSize: 'var(--text-sm)' }}>
        <span style={{ opacity: 0.7 }}>Round 2 (Bo5):</span>{' '}
        <strong>{bracket.byeTeam.name}</strong> vs <strong>{bracket.round1Result.winner.name}</strong>
        {' → '}{bracket.round2Result.winner.name} wins {bracket.round2Result.higherWins}-{bracket.round2Result.lowerWins}
        {' '}<span style={{ color: bracket.survived ? 'var(--color-win, #34a853)' : 'var(--color-loss, #ea4335)' }}>
          ({bracket.survived?.name} survives!)
        </span>
      </div>
    </div>
  );
}

/* ── Shared: Inline Series Result Card ── */
function InlineSeriesCard({ result, userTeamId, highlight }) {
  if (!result) return null;
  const isUserInvolved = highlight !== undefined ? highlight : (result.higherSeed?.id === userTeamId || result.lowerSeed?.id === userTeamId);
  return (
    <div style={{
      background: isUserInvolved ? 'var(--color-accent-subtle, rgba(212,168,67,0.15))' : 'var(--color-bg-sunken)',
      padding: 'var(--space-4)', marginBottom: 'var(--space-4)',
      borderRadius: 'var(--radius-lg)',
      border: isUserInvolved ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>
          {result.winner?.name} defeat {result.loser?.name}
        </div>
        <div style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)' }}>
          Series: {result.seriesScore}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: 600, margin: '0 auto' }}>
        {(result.games || []).map((game, idx) => {
          const homeWon = game.winner?.id === game.homeTeam?.id;
          return (
            <div key={idx} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--color-bg-active)', borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-sm)',
            }}>
              <span style={{ flex: '0 0 60px' }}>Game {game.gameNumber}</span>
              <span style={{ flex: 2, textAlign: 'right', fontWeight: homeWon ? 'var(--weight-bold)' : 'var(--weight-normal)', opacity: homeWon ? 1 : 0.6 }}>
                {game.homeTeam?.name} {game.homeScore}
              </span>
              <span style={{ margin: '0 var(--space-3)', color: 'var(--color-text-tertiary)' }}>-</span>
              <span style={{ flex: 2, textAlign: 'left', fontWeight: !homeWon ? 'var(--weight-bold)' : 'var(--weight-normal)', opacity: !homeWon ? 1 : 0.6 }}>
                {game.awayScore} {game.awayTeam?.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Shared: T3 Action Bar ── */
function T3ActionBar({ onContinue, continueLabel }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
      <Button variant="ghost" onClick={() => window.openBracketViewer?.()} style={{ opacity: 0.6 }}>📊 View Bracket</Button>
      <Button variant="secondary" onClick={() => window.simAllT3Rounds?.()} style={{ opacity: 0.7 }}>Sim All</Button>
      <Button variant="primary" size="lg" onClick={onContinue}>{continueLabel}</Button>
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
