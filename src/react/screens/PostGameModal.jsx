import React from 'react';
import { Modal, ModalBody, ModalFooter } from '../components/Modal.jsx';
import { Badge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';

/**
 * PostGameModal — shown after user team games.
 * Props:
 *   data: { userTeam, opponent, isHome, userWon, topPlayer, date, userRecord }
 *   isOpen, onClose, onViewBoxScore
 */
export function PostGameModal({ isOpen, onClose, data, onViewBoxScore }) {
  if (!isOpen || !data) return null;

  const { userTeam, opponent, userWon, topPlayer, date, userRecord } = data;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={640}>
      <ModalBody>
        <div style={{ textAlign: 'center' }}>
          {/* Result banner */}
          <div style={{
            fontSize: '1.4em',
            marginBottom: 'var(--space-1)',
          }}>
            {userWon ? '🎉' : '😤'}
          </div>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-bold)',
            color: userWon ? 'var(--color-win)' : 'var(--color-loss)',
            marginBottom: 'var(--space-1)',
          }}>
            {userWon ? 'VICTORY' : 'DEFEAT'}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-tertiary)',
            marginBottom: 'var(--space-6)',
          }}>
            {date}
          </div>

          {/* Score */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 'var(--space-8)',
            marginBottom: 'var(--space-5)',
          }}>
            <TeamScore team={userTeam} isWinner={userWon} />
            <span style={{
              fontSize: 'var(--text-lg)',
              color: 'var(--color-text-tertiary)',
              opacity: 0.4,
            }}>—</span>
            <TeamScore team={opponent} isWinner={!userWon} />
          </div>

          {/* Record */}
          {userRecord && (
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-tertiary)',
              marginBottom: 'var(--space-5)',
            }}>
              Record: {userRecord.wins}–{userRecord.losses}
            </div>
          )}

          {/* Player of the Game */}
          {topPlayer && (
            <div style={{
              background: 'rgba(212, 168, 67, 0.08)',
              border: '1px solid rgba(212, 168, 67, 0.2)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-5)',
            }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
                marginBottom: 'var(--space-1)',
              }}>⭐ Player of the Game</div>
              <div style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-bold)',
                marginBottom: 'var(--space-2)',
              }}>{topPlayer.name}</div>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 'var(--space-5)',
                fontSize: 'var(--text-md)',
              }}>
                <StatPill value={topPlayer.pts} label="PTS" />
                <StatPill value={topPlayer.reb} label="REB" />
                <StatPill value={topPlayer.ast} label="AST" />
              </div>
              <div style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
                marginTop: 'var(--space-2)',
              }}>
                {topPlayer.fgm}–{topPlayer.fga} FG
                ({topPlayer.fga > 0 ? ((topPlayer.fgm / topPlayer.fga) * 100).toFixed(0) : 0}%)
                · {topPlayer.min} MIN
              </div>
            </div>
          )}

          {/* Team Leaders */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-4)',
            textAlign: 'left',
          }}>
            <TeamLeaders team={userTeam} />
            <TeamLeaders team={opponent} />
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        {onViewBoxScore && (
          <Button variant="ghost" size="sm" onClick={onViewBoxScore}>
            View Box Score
          </Button>
        )}
        <Button variant="primary" onClick={onClose}>
          Continue
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function TeamScore({ team, isWinner }) {
  const teamName = team.city ? `${team.city} ${team.name}` : team.name;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--space-1)',
      }}>{teamName}</div>
      <div style={{
        fontSize: '2.8em',
        fontWeight: 'var(--weight-bold)',
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        color: isWinner ? 'var(--color-win)' : 'var(--color-text)',
        lineHeight: 1,
      }}>{team.score}</div>
    </div>
  );
}

function StatPill({ value, label }) {
  return (
    <span>
      <strong style={{ fontSize: 'var(--text-lg)' }}>{value}</strong>
      {' '}
      <span style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)',
      }}>{label}</span>
    </span>
  );
}

function TeamLeaders({ team }) {
  const players = (team.players || []).sort((a, b) => b.pts - a.pts).slice(0, 3);
  const teamName = team.city ? `${team.city} ${team.name}` : team.name;

  return (
    <div>
      <div style={{
        fontWeight: 'var(--weight-semi)',
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--space-2)',
      }}>{teamName} Leaders</div>
      {players.map((p, i) => (
        <div key={i} style={{
          padding: '3px 0',
          fontSize: 'var(--text-sm)',
        }}>
          <strong>{p.name}</strong>
          {' '}
          <span style={{ color: 'var(--color-text-tertiary)' }}>
            {p.pts} pts, {p.reb} reb, {p.ast} ast
          </span>
        </div>
      ))}
    </div>
  );
}
