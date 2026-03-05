import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

export function AllStarModal({ isOpen, data, onContinue }) {
  if (!isOpen || !data) return null;

  const { results = [], userTeamId } = data;

  const userAllStars = [];
  for (const r of results) {
    const inEast = r.selections.east.filter(p => p.team.id === userTeamId);
    const inWest = r.selections.west.filter(p => p.team.id === userTeamId);
    userAllStars.push(...inEast, ...inWest);
  }

  return (
    <Modal isOpen={isOpen} onClose={onContinue} maxWidth={640} zIndex={1300}>
      <ModalHeader onClose={onContinue}>All-Star Weekend</ModalHeader>

      <ModalBody style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {/* Your All-Stars */}
        {userAllStars.length > 0 ? (
          <div style={{
            padding: '12px 14px', background: 'var(--color-accent-bg)',
            border: '1px solid var(--color-accent-border)', marginBottom: 16,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
            }}>Your All-Stars ({userAllStars.length})</div>
            {userAllStars.map((p, i) => (
              <div key={i} style={{ fontSize: 'var(--text-sm)', marginBottom: 2 }}>
                <strong>{p.player.name}</strong>
                <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 8 }}>
                  {p.player.position} — {p.avgs.pointsPerGame} PPG · {p.avgs.reboundsPerGame} RPG · {p.avgs.assistsPerGame} APG
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center', padding: 12, fontSize: 'var(--text-sm)',
            color: 'var(--color-text-tertiary)', marginBottom: 16,
          }}>
            Your team did not have any All-Star selections this season.
          </div>
        )}

        {/* Tier Games */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {results.map((r, idx) => (
            <TierGame key={idx} result={r} userTeamId={userTeamId} />
          ))}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="primary" onClick={onContinue}>Continue Season</Button>
      </ModalFooter>
    </Modal>
  );
}

function TierGame({ result, userTeamId }) {
  const { selections, gameResult, label, color } = result;
  const eastWon = gameResult.winner === 'East';
  const mvp = gameResult.gameMVP;

  return (
    <div style={{
      padding: 16, background: 'var(--color-bg-sunken)',
      border: '1px solid var(--color-border-subtle)',
    }}>
      {/* Tier label */}
      <div style={{
        fontSize: 10, fontWeight: 600, color,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        textAlign: 'center', marginBottom: 12,
      }}>{label} All-Star Game</div>

      {/* Score — no separator */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 40, marginBottom: 12,
      }}>
        <ScoreBlock label="East" score={gameResult.eastScore} won={eastWon} />
        <ScoreBlock label="West" score={gameResult.westScore} won={!eastWon} />
      </div>

      {/* MVP */}
      {mvp && (
        <div style={{
          padding: '8px 12px', background: 'var(--color-accent-bg)',
          border: '1px solid var(--color-accent-border)',
          textAlign: 'center', marginBottom: 14, fontSize: 'var(--text-xs)',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
            textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 8,
          }}>MVP</span>
          <strong>{mvp.player.name}</strong>
          <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 6 }}>
            ({mvp.team.name}) — {mvp.avgs.pointsPerGame} PPG · {mvp.avgs.reboundsPerGame} RPG · {mvp.avgs.assistsPerGame} APG
          </span>
        </div>
      )}

      {/* Rosters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <RosterColumn label="East" players={selections.east} userTeamId={userTeamId} mvpId={mvp?.player?.id} />
        <RosterColumn label="West" players={selections.west} userTeamId={userTeamId} mvpId={mvp?.player?.id} />
      </div>
    </div>
  );
}

function ScoreBlock({ label, score, won }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)',
        color: won ? 'var(--color-text)' : 'var(--color-text-tertiary)',
      }}>{score}</div>
    </div>
  );
}

function RosterColumn({ label, players, userTeamId, mvpId }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
        textAlign: 'center', marginBottom: 6,
      }}>{label}</div>
      {players.map((p, i) => {
        const isUser = p.team.id === userTeamId;
        return (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', padding: '4px 8px',
            fontSize: 'var(--text-xs)',
            background: isUser ? 'var(--color-accent-bg)' : 'transparent',
            borderBottom: i < players.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
          }}>
            <span>
              <span style={{ fontWeight: 500 }}>{p.player.name}</span>
              <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 4 }}>{p.player.position}</span>
            </span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>{p.team.name.split(' ').pop()}</span>
          </div>
        );
      })}
    </div>
  );
}
