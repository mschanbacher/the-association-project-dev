import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';

/**
 * BracketViewerModal — native React playoff bracket viewer.
 * Renders T1/T2/T3 brackets from raw playoff data.
 */
export function BracketViewerModal({ isOpen, data, onClose }) {
  if (!isOpen || !data) return null;
  const { bracketData, userTeamId, playoffWatch } = data;

  if (!bracketData) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} maxWidth={1400} zIndex={1400}>
        <ModalHeader onClose={onClose}>Playoff Bracket</ModalHeader>
        <ModalBody>
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
            No active playoff bracket
          </div>
        </ModalBody>
      </Modal>
    );
  }

  const { tier, playoffData } = bracketData;
  const activeInfo = playoffWatch || null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={1400} zIndex={1400}>
      <ModalHeader onClose={onClose}>
        {tier === 1 ? '🏆 Championship Playoffs' : tier === 2 ? '🥈 Tier 2 Playoffs' : '🥉 Tier 3 Playoffs'}
      </ModalHeader>
      <ModalBody style={{ maxHeight: '85vh', overflowY: 'auto', overflowX: 'auto', padding: 'var(--space-4)' }}>
        {tier === 1 && <T1Bracket pd={playoffData} userId={userTeamId} active={activeInfo} />}
        {tier === 2 && <T2Bracket pd={playoffData} userId={userTeamId} active={activeInfo} />}
        {tier === 3 && <T3Bracket pd={playoffData} userId={userTeamId} active={activeInfo} />}
      </ModalBody>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function TeamCell({ team, seed, isWinner, isLoser, isUser }) {
  if (!team) return <div style={styles.tbd}>TBD</div>;
  return (
    <div style={{
      ...styles.team,
      fontWeight: isWinner ? 'var(--weight-bold)' : 'var(--weight-normal)',
      opacity: isLoser ? 0.35 : 1,
    }}>
      {seed && <span style={styles.seed}>{seed}</span>}
      <span style={{
        ...styles.name,
        color: isUser ? 'var(--color-accent)' : 'var(--color-text)',
      }}>{team.name}</span>
      <span style={styles.record}>{team.wins}-{team.losses}</span>
    </div>
  );
}

function MatchupCard({ higher, lower, hSeed, lSeed, seriesResult, userId, activeInfo, seriesKey }) {
  const [expanded, setExpanded] = useState(false);

  let isHigherWinner = false, isLowerWinner = false, scoreText = '', isUserSeries = false;
  let games = [];

  if (seriesResult) {
    // seriesResult can be either { result: {...} } or direct result object
    const r = seriesResult.result || seriesResult;
    const winnerId = r.winner?.id;
    isHigherWinner = higher && winnerId === higher.id;
    isLowerWinner = lower && winnerId === lower.id;
    scoreText = r.seriesScore || seriesResult.seriesScore || '';
    isUserSeries = (r.higherSeed?.id === userId || r.lowerSeed?.id === userId);
    games = r.games || seriesResult.games || [];
  } else if (activeInfo && higher && lower) {
    const match = (activeInfo.higherId === higher.id && activeInfo.lowerId === lower.id) ||
                  (activeInfo.higherId === lower.id && activeInfo.lowerId === higher.id);
    if (match) {
      if (activeInfo.higherId === higher.id) {
        scoreText = `🔴 ${activeInfo.higherWins}-${activeInfo.lowerWins}`;
      } else {
        scoreText = `🔴 ${activeInfo.lowerWins}-${activeInfo.higherWins}`;
      }
    }
  }

  const hasGames = games.length > 0;
  const clickable = hasGames;

  return (
    <div style={{ marginBottom: 'var(--space-2)' }}>
      <div
        onClick={clickable ? () => setExpanded(!expanded) : undefined}
        style={{
          ...styles.matchup,
          cursor: clickable ? 'pointer' : 'default',
        }}
      >
        <TeamCell team={higher} seed={hSeed} isWinner={isHigherWinner} isLoser={isLowerWinner} isUser={higher?.id === userId} />
        <div style={styles.teamDivider} />
        <TeamCell team={lower} seed={lSeed} isWinner={isLowerWinner} isLoser={isHigherWinner} isUser={lower?.id === userId} />
        {scoreText && (
          <div style={styles.score}>{scoreText}{hasGames ? ' ▼' : ''}</div>
        )}
      </div>
      {expanded && hasGames && (
        <GameDetails games={games} isUserSeries={isUserSeries} seriesKey={seriesKey} />
      )}
    </div>
  );
}

function GameDetails({ games, isUserSeries, seriesKey }) {
  return (
    <div style={styles.gameDetails}>
      {games.map((game, idx) => {
        const homeWon = game.winner?.id === game.homeTeam?.id;
        const hasBox = isUserSeries && game.boxScore;
        return (
          <div
            key={idx}
            onClick={hasBox && seriesKey ? (e) => { e.stopPropagation(); window.showPlayoffBoxScore?.(seriesKey, idx); } : undefined}
            style={{
              ...styles.gameRow,
              cursor: hasBox ? 'pointer' : 'default',
            }}
          >
            <span style={{ minWidth: 30, opacity: 0.5, fontSize: 'var(--text-xs)' }}>G{game.gameNumber}</span>
            <span style={{
              flex: 1, textAlign: 'right', fontSize: 'var(--text-xs)',
              fontWeight: homeWon ? 'var(--weight-bold)' : 'var(--weight-normal)',
              opacity: homeWon ? 1 : 0.6,
            }}>{game.homeTeam?.name} {game.homeScore}</span>
            <span style={{ opacity: 0.3, margin: '0 3px', fontSize: 'var(--text-xs)' }}>-</span>
            <span style={{
              flex: 1, fontSize: 'var(--text-xs)',
              fontWeight: !homeWon ? 'var(--weight-bold)' : 'var(--weight-normal)',
              opacity: !homeWon ? 1 : 0.6,
            }}>{game.awayScore} {game.awayTeam?.name}</span>
            {hasBox && <span style={{ opacity: 0.4 }}>📊</span>}
          </div>
        );
      })}
    </div>
  );
}

function RoundColumn({ label, children }) {
  return (
    <div style={styles.round}>
      <div style={styles.roundLabel}>{label}</div>
      <div style={styles.roundMatchups}>{children}</div>
    </div>
  );
}

function SectionHeader({ title, color }) {
  return (
    <div style={{
      fontSize: '1.2em', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-3)',
      paddingBottom: 'var(--space-2)', borderBottom: '2px solid var(--color-border)',
      color: color || 'var(--color-text)',
    }}>{title}</div>
  );
}

function Champion({ name, color }) {
  if (!name) return null;
  return (
    <div style={{
      textAlign: 'center', marginTop: 'var(--space-4)', padding: 'var(--space-4)',
      background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{ fontSize: '1.1em', fontWeight: 'var(--weight-bold)', color: color || '#ffd700' }}>
        🏆 {name}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>
        Champions
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   T1 BRACKET — East/West Conferences → Finals
   ═══════════════════════════════════════════════════════════════ */

function T1Bracket({ pd, userId, active }) {
  const { eastTeams, westTeams, roundResults } = pd;

  const getSeriesResult = (round, conf, idx) => {
    if (!roundResults[round]) return null;
    return roundResults[round].filter(s => s.conf === conf)[idx] || null;
  };

  const finalsResult = roundResults[3]?.[0] || null;
  const champion = finalsResult?.result?.winner;

  const renderConf = (confName, seeds, color, label) => {
    const r1Pairs = [[0,7],[1,6],[2,5],[3,4]];

    return (
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <SectionHeader title={`${label} Conference`} color={color} />
        <div style={styles.rounds}>
          <RoundColumn label="Round 1">
            {r1Pairs.map(([hi, lo], i) => {
              const s = getSeriesResult(0, confName, i);
              return <MatchupCard key={i} higher={seeds[hi]} lower={seeds[lo]}
                hSeed={hi+1} lSeed={lo+1} seriesResult={s} userId={userId} activeInfo={active}
                seriesKey={s ? `t1-0-${roundResults[0].indexOf(s)}` : null} />;
            })}
          </RoundColumn>

          <RoundColumn label="Conf. Semis">
            {[0,1].map(i => {
              const s = getSeriesResult(1, confName, i);
              if (s) {
                return <MatchupCard key={i} higher={s.result?.higherSeed} lower={s.result?.lowerSeed}
                  hSeed="" lSeed="" seriesResult={s} userId={userId} activeInfo={active}
                  seriesKey={`t1-1-${roundResults[1].indexOf(s)}`} />;
              }
              return <MatchupCard key={i} higher={null} lower={null} hSeed="?" lSeed="?" userId={userId} />;
            })}
          </RoundColumn>

          <RoundColumn label="Conf. Finals">
            {(() => {
              const s = getSeriesResult(2, confName, 0);
              if (s) {
                return <MatchupCard higher={s.result?.higherSeed} lower={s.result?.lowerSeed}
                  hSeed="" lSeed="" seriesResult={s} userId={userId} activeInfo={active}
                  seriesKey={`t1-2-${roundResults[2].indexOf(s)}`} />;
              }
              return <MatchupCard higher={null} lower={null} hSeed="?" lSeed="?" userId={userId} />;
            })()}
          </RoundColumn>
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderConf('East', eastTeams, '#fbbc04', 'Eastern')}
      {renderConf('West', westTeams, '#667eea', 'Western')}

      <div style={{ marginTop: 'var(--space-4)' }}>
        <SectionHeader title="Finals" color="#ffd700" />
        {finalsResult ? (
          <MatchupCard
            higher={finalsResult.result?.higherSeed} lower={finalsResult.result?.lowerSeed}
            hSeed="" lSeed="" seriesResult={finalsResult} userId={userId} activeInfo={active}
            seriesKey="t1-3-0" />
        ) : (
          <MatchupCard higher={null} lower={null} hSeed="?" lSeed="?" userId={userId} />
        )}
      </div>

      {champion && <Champion name={champion.name} color="#ffd700" />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   T2 BRACKET — Division Playoffs → National Tournament
   ═══════════════════════════════════════════════════════════════ */

function T2Bracket({ pd, userId, active }) {
  const db = pd.userDivBracket;
  const ir = pd.interactiveResults || {};
  const natRounds = ir.nationalRounds || [];

  const semi1 = ir.divSemi1;
  const semi2 = ir.divSemi2;
  const divFinal = ir.divFinal;

  const roundNames = ['Round of 16', 'Quarterfinals', 'Semifinals', 'Championship'];
  const stageCounts = [8, 4, 2, 1];

  let champion = null;
  if (natRounds.length >= 4 && natRounds[3]?.[0]) {
    champion = natRounds[3][0].result?.winner;
  }

  return (
    <div>
      <SectionHeader title={`${db?.division || ''} Division Playoffs`} color="var(--color-text-secondary)" />
      <div style={styles.rounds}>
        <RoundColumn label="Semifinals">
          <MatchupCard higher={db?.seed1} lower={db?.seed4} hSeed={1} lSeed={4}
            seriesResult={semi1} userId={userId} activeInfo={active} seriesKey="t2-div-divSemi1" />
          <MatchupCard higher={db?.seed2} lower={db?.seed3} hSeed={2} lSeed={3}
            seriesResult={semi2} userId={userId} activeInfo={active} seriesKey="t2-div-divSemi2" />
        </RoundColumn>

        <RoundColumn label="Division Final">
          {divFinal ? (
            <MatchupCard higher={divFinal.higherSeed} lower={divFinal.lowerSeed}
              hSeed="" lSeed="" seriesResult={divFinal} userId={userId} activeInfo={active}
              seriesKey="t2-div-divFinal" />
          ) : semi1 && semi2 ? (
            <MatchupCard higher={semi1.winner} lower={semi2.winner}
              hSeed="" lSeed="" userId={userId} activeInfo={active} />
          ) : (
            <MatchupCard higher={null} lower={null} hSeed="?" lSeed="?" userId={userId} />
          )}
        </RoundColumn>
      </div>

      <div style={{ marginTop: 'var(--space-6)' }}>
        <SectionHeader title="National Tournament" color="var(--color-text-secondary)" />
        <div style={styles.rounds}>
          {roundNames.map((name, r) => {
            const roundData = natRounds[r] || null;
            return (
              <RoundColumn key={r} label={name}>
                {roundData ? (
                  roundData.filter(s => s?.result).map((s, idx) => (
                    <MatchupCard key={idx}
                      higher={s.result.higherSeed} lower={s.result.lowerSeed}
                      hSeed="" lSeed="" seriesResult={s.result} userId={userId} activeInfo={active}
                      seriesKey={`t2-nat-${r}-${idx}`} />
                  ))
                ) : (
                  Array.from({ length: stageCounts[r] }, (_, i) => (
                    <MatchupCard key={i} higher={null} lower={null} hSeed="?" lSeed="?" userId={userId} />
                  ))
                )}
              </RoundColumn>
            );
          })}
        </div>
      </div>

      {champion && <Champion name={champion.name} color="#c0c0c0" />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   T3 BRACKET — Metro Final → Regional → National Tournament
   ═══════════════════════════════════════════════════════════════ */

function T3Bracket({ pd, userId, active }) {
  const ir = pd.interactiveResults || {};
  const metro = ir.metroFinal;
  const stages = ['sweet16', 'quarterfinals', 'semifinals', 'championship'];
  const stageNames = ['Sweet 16', 'Quarterfinals', 'Semifinals', 'Championship'];
  const stageCounts = [8, 4, 2, 1];

  let champion = null;
  if (ir[stages[3]]?.length > 0 && ir[stages[3]][0]) {
    const champResult = ir[stages[3]][0].result || ir[stages[3]][0];
    champion = champResult.winner;
  }

  return (
    <div>
      <SectionHeader title="Your Path" color="#cd7f32" />

      {metro && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={styles.stageLabel}>Metro Final (Bo3)</div>
          <MatchupCard higher={metro.higherSeed} lower={metro.lowerSeed}
            hSeed="#1" lSeed="#2" seriesResult={metro} userId={userId} activeInfo={active}
            seriesKey="t3-metroFinal" />
        </div>
      )}
      {!metro && pd.stage === 'metro-final' && active && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={styles.stageLabel}>Metro Final (Bo3)</div>
          <MatchupCard higher={{ id: active.higherId, name: active.higherName || 'TBD', wins: 0, losses: 0 }}
            lower={{ id: active.lowerId, name: active.lowerName || 'TBD', wins: 0, losses: 0 }}
            hSeed="#1" lSeed="#2" userId={userId} activeInfo={active} />
        </div>
      )}

      {metro && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          {ir.userHadBye ? (
            <>
              <div style={styles.stageLabel}>Regional Round</div>
              <div style={{
                padding: 'var(--space-3)', textAlign: 'center', opacity: 0.5, fontStyle: 'italic',
                background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-md)',
              }}>BYE — Top 8 seed</div>
            </>
          ) : ir.regionalRound ? (
            <>
              <div style={styles.stageLabel}>Regional Round (Play-In, Bo3)</div>
              {ir.regionalRound.filter(r => r?.result && (r.result.winner?.id === userId || r.result.loser?.id === userId)).map((r, i) => (
                <MatchupCard key={i} higher={r.result.higherSeed} lower={r.result.lowerSeed}
                  hSeed="" lSeed="" seriesResult={r.result} userId={userId} activeInfo={active}
                  seriesKey={`t3-regional-${i}`} />
              ))}
            </>
          ) : pd.stage === 'regional' && active ? (
            <>
              <div style={styles.stageLabel}>Regional Round (Play-In, Bo3)</div>
              <MatchupCard higher={{ id: active.higherId, name: active.higherName || 'TBD', wins: 0, losses: 0 }}
                lower={{ id: active.lowerId, name: active.lowerName || 'TBD', wins: 0, losses: 0 }}
                hSeed="" lSeed="" userId={userId} activeInfo={active} />
            </>
          ) : null}
        </div>
      )}

      <div style={{ marginTop: 'var(--space-6)' }}>
        <SectionHeader title="National Tournament" color="#cd7f32" />
        <div style={styles.rounds}>
          {stages.map((stage, r) => {
            let roundData = ir[stage] || null;
            // championship is stored as single object, normalize to array
            if (roundData && !Array.isArray(roundData)) roundData = [roundData];
            return (
              <RoundColumn key={r} label={stageNames[r]}>
                {roundData && roundData.length > 0 ? (
                  roundData.filter(Boolean).map((s, idx) => {
                    const res = s.result || s;
                    return (
                      <MatchupCard key={idx}
                        higher={res.higherSeed} lower={res.lowerSeed}
                        hSeed="" lSeed="" seriesResult={res} userId={userId} activeInfo={active}
                        seriesKey={`t3-${stage}-${idx}`} />
                    );
                  })
                ) : (
                  Array.from({ length: stageCounts[r] }, (_, i) => (
                    <MatchupCard key={i} higher={null} lower={null} hSeed="?" lSeed="?" userId={userId} />
                  ))
                )}
              </RoundColumn>
            );
          })}
        </div>
      </div>

      {champion && <Champion name={champion.name} color="#cd7f32" />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */

const styles = {
  rounds: {
    display: 'flex',
    gap: 'var(--space-4)',
    alignItems: 'stretch',
    overflowX: 'auto',
  },
  round: {
    flex: 1,
    minWidth: 160,
    display: 'flex',
    flexDirection: 'column',
  },
  roundLabel: {
    fontSize: 'var(--text-xs)',
    textTransform: 'uppercase',
    opacity: 0.5,
    marginBottom: 'var(--space-2)',
    textAlign: 'center',
    letterSpacing: '0.5px',
    flexShrink: 0,
  },
  roundMatchups: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-around',
  },
  matchup: {
    background: 'var(--color-bg-sunken)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-2)',
    border: '1px solid var(--color-border-subtle)',
    position: 'relative',
  },
  team: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: '4px var(--space-2)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-sm)',
  },
  teamDivider: {
    height: 1,
    background: 'var(--color-border-subtle)',
    margin: '2px 0',
  },
  seed: {
    fontSize: 'var(--text-xs)',
    opacity: 0.5,
    minWidth: 18,
    textAlign: 'center',
  },
  name: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  record: {
    fontSize: 'var(--text-xs)',
    opacity: 0.5,
  },
  score: {
    textAlign: 'center',
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    marginTop: 3,
    opacity: 0.7,
  },
  tbd: {
    padding: '4px var(--space-2)',
    opacity: 0.3,
    fontStyle: 'italic',
    textAlign: 'center',
    fontSize: 'var(--text-sm)',
  },
  gameDetails: {
    marginTop: -2,
    padding: 'var(--space-2)',
    background: 'var(--color-bg-active)',
    borderRadius: '0 0 var(--radius-md) var(--radius-md)',
    border: '1px solid var(--color-border-subtle)',
    borderTop: 'none',
    fontSize: 'var(--text-xs)',
  },
  gameRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '3px 4px',
    gap: 4,
    borderBottom: '1px solid var(--color-border-subtle)',
  },
  stageLabel: {
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-semi)',
    color: 'var(--color-text-secondary)',
    marginBottom: 'var(--space-2)',
  },
};
