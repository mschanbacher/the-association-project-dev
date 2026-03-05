import React from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

export function LotteryModal({ isOpen, data, onClose }) {
  if (!isOpen || !data) return null;

  const { lotteryResults = [], userTeamId } = data;
  const top4 = lotteryResults.slice(0, 4);
  const remaining = lotteryResults.slice(4);
  const userResult = lotteryResults.find(r => r.team.id === userTeamId);

  return (
    <Modal isOpen={isOpen} onClose={null} maxWidth={580} zIndex={1300}>
      <ModalHeader>Draft Lottery Results</ModalHeader>
      <ModalBody style={{ maxHeight: '78vh', overflowY: 'auto' }}>
        <div style={{
          textAlign: 'center', fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)', marginBottom: 16,
        }}>
          14 teams competed for the top 4 picks
        </div>

        {/* Top 4 Lottery Winners */}
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'var(--color-tier1)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
        }}>Lottery Winners</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {top4.map(result => (
            <LotteryCard key={result.pick} result={result} isUser={result.team.id === userTeamId} />
          ))}
        </div>

        {/* Remaining Picks */}
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
        }}>Remaining Picks</div>

        <div style={{ marginBottom: 16 }}>
          {remaining.map(result => (
            <div key={result.pick} style={{
              display: 'flex', alignItems: 'center', padding: '6px 12px',
              borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--text-sm)',
              background: result.team.id === userTeamId ? 'var(--color-accent-bg)' : 'transparent',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: 'var(--color-text-tertiary)', width: 40,
              }}>{result.pick}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{result.team.name}</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
              }}>{result.team.wins}–{result.team.losses}</span>
            </div>
          ))}
        </div>

        {/* User result */}
        {userResult && (
          <div style={{
            padding: '14px 16px', background: 'var(--color-accent-bg)',
            border: '1px solid var(--color-accent-border)',
            textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 700 }}>
              {userResult.pick <= 4
                ? `You won the #${userResult.pick} pick`
                : `You have the #${userResult.pick} pick`}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
          <Button variant="primary" onClick={() => window.closeLotteryModal?.()}>
            Continue to Draft
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
}

function LotteryCard({ result, isUser }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      background: isUser ? 'var(--color-accent-bg)' : 'var(--color-bg-sunken)',
      border: isUser ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border-subtle)',
      borderLeft: `3px solid ${isUser ? 'var(--color-accent)' : 'var(--color-tier1)'}`,
    }}>
      <div style={{
        fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)',
        color: 'var(--color-tier1)', minWidth: 40, textAlign: 'center',
      }}>#{result.pick}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{result.team.name}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
          {result.team.wins}–{result.team.losses}
          {result.jumped && result.originalPosition && (
            <span style={{ color: 'var(--color-win)', marginLeft: 8, fontWeight: 600 }}>
              Jumped from #{result.originalPosition}
            </span>
          )}
          {result.isPromoted && (
            <span style={{ color: 'var(--color-warning)', marginLeft: 8, fontWeight: 600 }}>
              Promoted
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
