import React from 'react';
import { Modal, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

export function ChampionshipPlayoffModal({ isOpen, data, onClose }) {
  if (!isOpen || !data) return null;
  const { mode } = data;

  return (
    <Modal isOpen={isOpen} onClose={null} maxWidth={1000} zIndex={1300}>
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
      </ModalBody>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      marginBottom: 8, marginTop: 16,
    }}>{children}</div>
  );
}

function PageTitle({ label, title }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 20 }}>
      {label && (
        <div style={{
          fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4,
        }}>{label}</div>
      )}
      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
    </div>
  );
}

function ActionBar({ children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
      {children}
    </div>
  );
}

function SeriesCard({ series, userTeamId, isFinals }) {
  const r = series.result;
  const isUserInvolved = r.higherSeed?.id === userTeamId || r.lowerSeed?.id === userTeamId;
  const higherWon = r.higherSeedWins > r.lowerSeedWins;
  const winner = higherWon ? r.higherSeed : r.lowerSeed;
  const loser = higherWon ? r.lowerSeed : r.higherSeed;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '12px 16px',
      background: isUserInvolved ? 'var(--color-accent-bg)' : 'var(--color-bg-sunken)',
      border: isUserInvolved ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border-subtle)',
      marginBottom: 8,
    }}>
      <div style={{ flex: 1 }}>
        {r.higherSeed?.seed && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', marginRight: 6 }}>
            ({r.higherSeed.seed})
          </span>
        )}
        <span style={{
          fontSize: 'var(--text-base)',
          fontWeight: higherWon ? 700 : 400,
          color: higherWon ? 'var(--color-text)' : 'var(--color-text-secondary)',
        }}>{r.higherSeed?.name || '?'}</span>
      </div>
      <div style={{
        display: 'flex', gap: 4, fontFamily: 'var(--font-mono)',
        fontSize: 18, fontWeight: 700,
      }}>
        <span style={{ color: higherWon ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>{r.higherSeedWins}</span>
        <span style={{ color: 'var(--color-text-tertiary)' }}>–</span>
        <span style={{ color: !higherWon ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>{r.lowerSeedWins}</span>
      </div>
      <div style={{ flex: 1, textAlign: 'right' }}>
        <span style={{
          fontSize: 'var(--text-base)',
          fontWeight: !higherWon ? 700 : 400,
          color: !higherWon ? 'var(--color-text)' : 'var(--color-text-secondary)',
        }}>{r.lowerSeed?.name || '?'}</span>
        {r.lowerSeed?.seed && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', marginLeft: 6 }}>
            ({r.lowerSeed.seed})
          </span>
        )}
      </div>
    </div>
  );
}

function InlineSeriesCard({ result, userTeamId, highlight }) {
  if (!result) return null;
  const isUserInvolved = highlight !== undefined ? highlight : (result.higherSeed?.id === userTeamId || result.lowerSeed?.id === userTeamId);
  const higherWon = result.higherSeedWins > result.lowerSeedWins;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '10px 14px',
      background: isUserInvolved ? 'var(--color-accent-bg)' : 'var(--color-bg-sunken)',
      border: isUserInvolved ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border-subtle)',
      marginBottom: 8,
    }}>
      <div style={{ flex: 1 }}>
        <span style={{
          fontWeight: higherWon ? 600 : 400,
          color: higherWon ? 'var(--color-text)' : 'var(--color-text-secondary)',
          fontSize: 'var(--text-sm)',
        }}>{result.higherSeed?.name || '?'}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700 }}>
        <span style={{ color: higherWon ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>{result.higherSeedWins}</span>
        <span style={{ color: 'var(--color-text-tertiary)', margin: '0 3px' }}>–</span>
        <span style={{ color: !higherWon ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>{result.lowerSeedWins}</span>
      </div>
      <div style={{ flex: 1, textAlign: 'right' }}>
        <span style={{
          fontWeight: !higherWon ? 600 : 400,
          color: !higherWon ? 'var(--color-text)' : 'var(--color-text-secondary)',
          fontSize: 'var(--text-sm)',
        }}>{result.lowerSeed?.name || '?'}</span>
      </div>
    </div>
  );
}

function ChampionBanner({ tier, name, subtitle, isUser }) {
  return (
    <div style={{
      margin: '12px 0', padding: '20px 24px', textAlign: 'center',
      background: isUser ? 'var(--color-accent-bg)' : 'var(--color-bg-sunken)',
      border: isUser ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 6,
        color: isUser ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
      }}>{tier}</div>
      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 4 }}>{name}</div>
      {subtitle && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{subtitle}</div>}
    </div>
  );
}

function ProRelBox({ title, color, teams }) {
  if (!teams || teams.length === 0) return null;
  return (
    <div style={{ padding: '12px 14px', background: `${color}08`, border: `1px solid ${color}15`, marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {title}
      </div>
      {teams.filter(Boolean).map((t, i) => (
        <div key={i} style={{ fontSize: 'var(--text-sm)', marginBottom: 2 }}>{t.name || t}</div>
      ))}
    </div>
  );
}

function RelegationBracket({ data, userTeamId }) {
  if (!data || !data.matchups) return null;
  return (
    <div>
      <SectionHeader>{data.title || 'Relegation Playoffs'}</SectionHeader>
      {data.matchups.map((m, i) => (
        <InlineSeriesCard key={i} result={m} userTeamId={userTeamId} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   T1 VIEWS
   ═══════════════════════════════════════════════════════════════ */

function MissedView({ data }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <PageTitle label="Tier 1" title="Championship Playoffs" />
      <div style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Your team did not make the playoffs
      </div>
      <ActionBar>
        <Button variant="secondary" onClick={() => window.simAllChampionshipRounds?.()}>Sim to Finals</Button>
        <Button variant="primary" onClick={() => window.skipChampionshipPlayoffs?.()}>Skip to Offseason</Button>
      </ActionBar>
    </div>
  );
}

function RoundView({ data }) {
  const { roundName, roundNumber, eastSeries, westSeries, finalsSeries, userTeamId } = data;
  const isFinals = finalsSeries && finalsSeries.length > 0;
  const champion = isFinals ? finalsSeries[0].result.winner : null;

  return (
    <div>
      <PageTitle title={roundName} />

      {eastSeries && eastSeries.length > 0 && (
        <>
          <SectionHeader>Eastern Conference</SectionHeader>
          {eastSeries.map((s, i) => <SeriesCard key={`e${i}`} series={s} userTeamId={userTeamId} />)}
        </>
      )}

      {westSeries && westSeries.length > 0 && (
        <>
          <SectionHeader>Western Conference</SectionHeader>
          {westSeries.map((s, i) => <SeriesCard key={`w${i}`} series={s} userTeamId={userTeamId} />)}
        </>
      )}

      {isFinals && (
        <>
          <SectionHeader>Finals</SectionHeader>
          {finalsSeries.map((s, i) => <SeriesCard key={`f${i}`} series={s} userTeamId={userTeamId} isFinals />)}
          {champion && (
            <ChampionBanner
              tier="NBA Champion"
              name={champion.name}
              isUser={champion.id === userTeamId}
            />
          )}
        </>
      )}

      <ActionBar>
        {!isFinals ? (
          <>
            <Button variant="secondary" onClick={() => window.simChampionshipRound?.()}>Sim Next Round</Button>
            <Button variant="primary" onClick={() => window.simAllChampionshipRounds?.()}>Sim Remaining</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => window.viewPlayoffBracket?.()}>View Bracket</Button>
            <Button variant="primary" onClick={() => window.advanceFromChampionship?.()}>Continue</Button>
          </>
        )}
      </ActionBar>
    </div>
  );
}

function CompleteView({ data }) {
  const { championName } = data;
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <PageTitle label="Championship Complete" title="NBA Playoffs" />
      <ChampionBanner tier="NBA Champion" name={championName} isUser />
      <ActionBar>
        <Button variant="secondary" onClick={() => window.viewPlayoffBracket?.()}>View Bracket</Button>
        <Button variant="primary" onClick={() => window.advanceFromChampionship?.()}>Continue to Offseason</Button>
      </ActionBar>
    </div>
  );
}

function SeriesWatchView({ data }) {
  const { higherSeed, lowerSeed, higherWins, lowerWins, bestOf, nextGameNum, games, userTeamId, isHigherHome } = data;
  const userIsHigher = userTeamId === higherSeed.id;

  // Helper to get user/opp scores from game objects (which store home/away)
  const getScores = (g) => {
    const higherIsHome = g.homeTeam?.id === higherSeed.id;
    const hScore = higherIsHome ? g.homeScore : g.awayScore;
    const lScore = higherIsHome ? g.awayScore : g.homeScore;
    return {
      userScore: userIsHigher ? hScore : lScore,
      oppScore: userIsHigher ? lScore : hScore,
    };
  };

  const handleBoxScore = (gameIdx) => {
    const g = games[gameIdx];
    if (g?.boxScore) {
      window._reactShowBoxScore?.({
        home: g.boxScore.home,
        away: g.boxScore.away,
        quarterScores: g.boxScore.quarterScores,
        date: `Playoff Game ${i + 1}`,
        hasDetailedStats: true,
      });
    }
  };

  return (
    <div>
      <PageTitle label={data.roundName || 'Playoff Series'} title="Your Series" />

      {/* Matchup */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 40,
        marginBottom: 20, padding: '8px 0',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{higherSeed.name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>#{higherSeed.seed} seed</div>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1, marginTop: 4,
            color: higherWins > lowerWins ? 'var(--color-accent)' : 'var(--color-text)' }}>{higherWins}</div>
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>vs</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{lowerSeed.name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>#{lowerSeed.seed} seed</div>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1, marginTop: 4,
            color: lowerWins > higherWins ? 'var(--color-accent)' : 'var(--color-text)' }}>{lowerWins}</div>
        </div>
      </div>

      {/* Game results */}
      {games && games.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {games.map((g, i) => {
            const { userScore, oppScore } = getScores(g);
            const won = userScore > oppScore;
            const hasBox = !!g.boxScore;
            return (
              <div key={i} onClick={() => hasBox && handleBoxScore(i)} style={{
                width: 60, padding: '8px 4px', textAlign: 'center',
                background: won ? 'var(--color-accent-bg)' : 'var(--color-loss-bg)',
                border: `1px solid ${won ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`,
                cursor: hasBox ? 'pointer' : 'default',
              }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>G{i + 1}</div>
                <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{userScore}</div>
                <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{oppScore}</div>
                <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2, color: won ? 'var(--color-win)' : 'var(--color-loss)' }}>
                  {won ? 'W' : 'L'}
                </div>
              </div>
            );
          })}
          {/* Remaining games */}
          {Array.from({ length: bestOf - games.length }, (_, i) => (
            <div key={`r${i}`} style={{
              width: 60, padding: '8px 4px', textAlign: 'center',
              background: 'var(--color-bg-sunken)', border: '1px dashed var(--color-border-subtle)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>G{games.length + i + 1}</div>
              <div style={{ padding: '8px 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>—</div>
            </div>
          ))}
        </div>
      )}

      <ActionBar>
        <Button variant="secondary" onClick={() => window.simPlayoffGame?.()}>Sim Game</Button>
        <Button variant="primary" onClick={() => window.watchPlayoffGame?.()}>
          Watch Game {nextGameNum || (games ? games.length + 1 : 1)}
        </Button>
        <Button variant="secondary" onClick={() => window.simPlayoffSeries?.()}>Sim Series</Button>
        <Button variant="ghost" onClick={() => window.viewPlayoffBracket?.()}>View Bracket</Button>
      </ActionBar>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   T2 VIEWS
   ═══════════════════════════════════════════════════════════════ */

function T2ActionBar({ data }) {
  return (
    <ActionBar>
      <Button variant="secondary" onClick={() => window.simT2PlayoffRound?.()}>Sim Round</Button>
      <Button variant="primary" onClick={() => window.simAllT2Rounds?.()}>Sim Remaining</Button>
    </ActionBar>
  );
}

function T2DivSemisView({ data }) {
  const { division, semi1, semi2, userTeam } = data;
  const userTeamId = userTeam?.id;
  const userSeries = [semi1, semi2].find(s =>
    s?.higherSeed?.id === userTeamId || s?.lowerSeed?.id === userTeamId
  );
  return (
    <div>
      <PageTitle label="NARBL Playoffs" title="Division Semifinals" />
      <SectionHeader>{division} Division</SectionHeader>
      {semi1 && <InlineSeriesCard result={semi1} userTeamId={userTeamId} />}
      {semi2 && <InlineSeriesCard result={semi2} userTeamId={userTeamId} />}
      {userSeries && <UserSeriesDetail series={userSeries} userTeamId={userTeamId} />}
      <ActionBar>
        <Button variant="ghost" onClick={() => window.viewPlayoffBracket?.()}>View Bracket</Button>
        <Button variant="primary" onClick={() => window.continueT2AfterDivSemis?.()}>Continue</Button>
      </ActionBar>
    </div>
  );
}

function T2DivFinalView({ data }) {
  const { division, divFinal, userTeam } = data;
  const userTeamId = userTeam?.id;
  const isUserSeries = divFinal?.higherSeed?.id === userTeamId || divFinal?.lowerSeed?.id === userTeamId;
  return (
    <div>
      <PageTitle label="NARBL Playoffs" title="Division Finals" />
      <SectionHeader>{division} Division Final</SectionHeader>
      {divFinal && <InlineSeriesCard result={divFinal} userTeamId={userTeamId} />}
      {divFinal?.winner && (
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-accent)', marginBottom: 12 }}>
          Division Champion: {divFinal.winner.name}
        </div>
      )}
      {isUserSeries && divFinal && <UserSeriesDetail series={divFinal} userTeamId={userTeamId} />}
      <ActionBar>
        <Button variant="ghost" onClick={() => window.viewPlayoffBracket?.()}>View Bracket</Button>
        <Button variant="primary" onClick={() => window.continueT2AfterDivFinal?.()}>Continue</Button>
      </ActionBar>
    </div>
  );
}

function T2NationalRoundView({ data }) {
  const { roundName, roundResults, champion, userTeam } = data;
  const userTeamId = userTeam?.id;
  // roundResults is array of { result: { higherSeed, lowerSeed, winner, ... } } or null
  const series = (roundResults || []).filter(Boolean).map(r => r.result);
  const userSeries = series.find(s =>
    s?.higherSeed?.id === userTeamId || s?.lowerSeed?.id === userTeamId
  );
  return (
    <div>
      <PageTitle label="NARBL Playoffs" title={roundName || 'National Round'} />
      {series.map((s, i) => <InlineSeriesCard key={i} result={s} userTeamId={userTeamId} />)}
      {userSeries && <UserSeriesDetail series={userSeries} userTeamId={userTeamId} />}
      {champion && <ChampionBanner tier="NARBL Champion" name={champion.name} isUser={champion.id === userTeamId} />}
      <ActionBar>
        <Button variant="ghost" onClick={() => window.viewPlayoffBracket?.()}>View Bracket</Button>
        <Button variant="secondary" onClick={() => window.simT2PlayoffRound?.()}>Sim Round</Button>
        <Button variant="primary" onClick={() => window.simAllT2Rounds?.()}>Sim Remaining</Button>
      </ActionBar>
    </div>
  );
}

function T2EliminationView({ data }) {
  const { userTeam, eliminatedIn, champion } = data;
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <PageTitle label="NARBL Playoffs" title="Eliminated" />
      <div style={{ fontSize: 'var(--text-md)', color: 'var(--color-loss)', marginBottom: 20 }}>
        Your team has been eliminated{eliminatedIn ? ` in the ${eliminatedIn}` : ''}
      </div>
      <ActionBar>
        <Button variant="ghost" onClick={() => window.viewPlayoffBracket?.()}>View Bracket</Button>
        <Button variant="secondary" onClick={() => window.simAllT2Rounds?.()}>Sim Remaining</Button>
        <Button variant="primary" onClick={() => window.skipT2Playoffs?.()}>Skip to Offseason</Button>
      </ActionBar>
    </div>
  );
}

function T2CompleteView({ data }) {
  const { champion, userTeamId } = data;
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <PageTitle label="Playoffs Complete" title="NARBL Playoffs" />
      {champion && <ChampionBanner tier="NARBL Champion" name={champion.name} isUser={champion.id === userTeamId} />}
      <ActionBar>
        <Button variant="ghost" onClick={() => window.viewPlayoffBracket?.()}>View Bracket</Button>
        <Button variant="primary" onClick={() => window.advanceFromT2Playoffs?.()}>Continue</Button>
      </ActionBar>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   T3 VIEWS
   ═══════════════════════════════════════════════════════════════ */

function T3ActionBar() {
  return (
    <ActionBar>
      <Button variant="ghost" onClick={() => window.viewPlayoffBracket?.()}>View Bracket</Button>
      <Button variant="secondary" onClick={() => window.simT3PlayoffRound?.()}>Sim Round</Button>
      <Button variant="primary" onClick={() => window.simAllT3Rounds?.()}>Sim Remaining</Button>
    </ActionBar>
  );
}

function T3MetroResultView({ data }) {
  const { metroName, result, userTeamId } = data;
  const isUserSeries = result?.higherSeed?.id === userTeamId || result?.lowerSeed?.id === userTeamId;
  return (
    <div>
      <PageTitle label="MBL Playoffs" title={metroName || 'Metro Final'} />
      <InlineSeriesCard result={result} userTeamId={userTeamId} />
      {isUserSeries && result && <UserSeriesDetail series={result} userTeamId={userTeamId} />}
      <T3ActionBar />
    </div>
  );
}

function T3RegionalResultView({ data }) {
  const { regionName, series, userTeamId } = data;
  const userSeries = (series || []).find(s =>
    s?.higherSeed?.id === userTeamId || s?.lowerSeed?.id === userTeamId
  );
  return (
    <div>
      <PageTitle label="MBL Playoffs" title={regionName || 'Regional Round'} />
      {(series || []).map((s, i) => <InlineSeriesCard key={i} result={s} userTeamId={userTeamId} />)}
      {userSeries && <UserSeriesDetail series={userSeries} userTeamId={userTeamId} />}
      <T3ActionBar />
    </div>
  );
}

function T3NationalRoundView({ data }) {
  const { roundName, series, champion, userTeamId } = data;
  return (
    <div>
      <PageTitle label="MBL Playoffs" title={roundName || 'National Round'} />
      {(series || []).map((s, i) => <InlineSeriesCard key={i} result={s} userTeamId={userTeamId} />)}
      {champion && <ChampionBanner tier="MBL Champion" name={champion.name} isUser={champion.id === userTeamId} />}
      <T3ActionBar />
    </div>
  );
}

function T3EliminationView({ data }) {
  const { eliminatedBy } = data;
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <PageTitle label="MBL Playoffs" title="Eliminated" />
      <div style={{ fontSize: 'var(--text-md)', color: 'var(--color-loss)', marginBottom: 20 }}>
        Your team has been eliminated{eliminatedBy ? ` by ${eliminatedBy}` : ''}
      </div>
      <ActionBar>
        <Button variant="ghost" onClick={() => window.viewPlayoffBracket?.()}>View Bracket</Button>
        <Button variant="secondary" onClick={() => window.simAllT3Rounds?.()}>Sim Remaining</Button>
        <Button variant="primary" onClick={() => window.skipT3Playoffs?.()}>Skip to Offseason</Button>
      </ActionBar>
    </div>
  );
}

function T3CompleteView({ data }) {
  const { champion, userTeamId } = data;
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <PageTitle label="Playoffs Complete" title="MBL Playoffs" />
      {champion && <ChampionBanner tier="MBL Champion" name={champion.name} isUser={champion.id === userTeamId} />}
      <ActionBar>
        <Button variant="ghost" onClick={() => window.viewPlayoffBracket?.()}>View Bracket</Button>
        <Button variant="primary" onClick={() => window.advanceFromT2Playoffs?.()}>Continue</Button>
      </ActionBar>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   POSTSEASON SUMMARY
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   USER SERIES DETAIL — game-by-game results with box score access
   ═══════════════════════════════════════════════════════════════ */

function UserSeriesDetail({ series, userTeamId }) {
  if (!series?.games || series.games.length === 0) return null;

  const userIsHigher = series.higherSeed?.id === userTeamId;
  const won = series.winner?.id === userTeamId;

  const getScores = (g) => {
    const higherIsHome = g.homeTeam?.id === series.higherSeed?.id;
    const hScore = higherIsHome ? g.homeScore : g.awayScore;
    const lScore = higherIsHome ? g.awayScore : g.homeScore;
    return {
      userScore: userIsHigher ? hScore : lScore,
      oppScore: userIsHigher ? lScore : hScore,
    };
  };

  const handleBoxScore = (g) => {
    if (g?.boxScore && window._reactShowBoxScore) {
      window._reactShowBoxScore({
        home: g.boxScore.home,
        away: g.boxScore.away,
        quarterScores: g.boxScore.quarterScores,
        date: `Playoff Game ${g.gameNumber || ''}`,
        hasDetailedStats: true,
      });
    }
  };

  return (
    <div style={{ marginTop: 12, marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: won ? 'var(--color-win)' : 'var(--color-loss)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
      }}>
        Series {won ? 'Won' : 'Lost'} {series.higherSeedWins || series.higherWins}–{series.lowerSeedWins || series.lowerWins}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {series.games.map((g, i) => {
          const { userScore, oppScore } = getScores(g);
          const gameWon = userScore > oppScore;
          const hasBox = !!g.boxScore;
          return (
            <div key={i} onClick={() => hasBox && handleBoxScore(g)} style={{
              width: 60, padding: '8px 4px', textAlign: 'center',
              background: gameWon ? 'var(--color-accent-bg)' : 'var(--color-loss-bg)',
              border: `1px solid ${gameWon ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`,
              cursor: hasBox ? 'pointer' : 'default',
            }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>G{i + 1}</div>
              <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{userScore}</div>
              <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{oppScore}</div>
              <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2, color: gameWon ? 'var(--color-win)' : 'var(--color-loss)' }}>
                {gameWon ? 'W' : 'L'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   POSTSEASON SUMMARY
   ═══════════════════════════════════════════════════════════════ */

function PostseasonView({ data }) {
  const {
    t1Champion, t2Champion, t3Champion, t1Finals,
    promotedToT1, promotedToT2, relegatedFromT1, relegatedFromT2,
    t1Relegation, t2Relegation, userTeamId,
  } = data;

  // t1Finals comes as { conf, result: { higherSeed, lowerSeed, ... } }
  // InlineSeriesCard expects the inner result object
  const finalsResult = t1Finals?.result || t1Finals;

  return (
    <div>
      <PageTitle label="Postseason" title="Postseason Results" />

      {/* Champions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        {t1Champion && (
          <ChampionBanner tier="Tier 1 — NBA Champion" name={t1Champion.name}
            isUser={t1Champion.id === userTeamId} />
        )}
        {t2Champion && (
          <ChampionBanner tier="Tier 2 — NARBL Champion" name={t2Champion.name}
            isUser={t2Champion.id === userTeamId} />
        )}
        {t3Champion && (
          <ChampionBanner tier="Tier 3 — MBL Champion" name={t3Champion.name}
            isUser={t3Champion.id === userTeamId} />
        )}
      </div>

      {/* Finals detail */}
      {finalsResult && (
        <>
          <SectionHeader>NBA Finals</SectionHeader>
          <InlineSeriesCard result={finalsResult} userTeamId={userTeamId} />
        </>
      )}

      {/* Relegation playoffs */}
      {t1Relegation && <RelegationBracket data={t1Relegation} userTeamId={userTeamId} />}
      {t2Relegation && <RelegationBracket data={t2Relegation} userTeamId={userTeamId} />}

      {/* Promotion / Relegation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
        {promotedToT1 && <ProRelBox title="Promoted to Tier 1" color="var(--color-win)" teams={promotedToT1} />}
        {relegatedFromT1 && <ProRelBox title="Relegated to Tier 2" color="var(--color-loss)" teams={relegatedFromT1} />}
        {promotedToT2 && <ProRelBox title="Promoted to Tier 2" color="var(--color-win)" teams={promotedToT2} />}
        {relegatedFromT2 && <ProRelBox title="Relegated to Tier 3" color="var(--color-loss)" teams={relegatedFromT2} />}
      </div>

      <ActionBar>
        <Button variant="primary" onClick={() => window.advanceFromPostseason?.()}>Continue to Draft</Button>
      </ActionBar>
    </div>
  );
}
