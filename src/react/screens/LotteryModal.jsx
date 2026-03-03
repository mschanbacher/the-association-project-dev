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
    <Modal isOpen={isOpen} onClose={null} maxWidth={900} zIndex={1300}>
      <ModalHeader>{'\ud83c\udfb0'} Draft Lottery Results</ModalHeader>
      <ModalBody style={{ maxHeight: '78vh', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-5)' }}>
          14 teams competed for the top 4 picks...
        </div>

        {/* Top 4 Lottery Winners */}
        <div style={{
          background: 'rgba(255,215,0,0.08)', padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)',
          border: '1px solid rgba(255,215,0,0.15)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)', color: '#ffd700', fontWeight: 'var(--weight-semi)', fontSize: 'var(--text-lg)' }}>
            {'\ud83c\udfb0'} Lottery Winners (Picks 1-4)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {top4.map(result => (
              <LotteryCard key={result.pick} result={result} isUser={result.team.id === userTeamId} isTop />
            ))}
          </div>
        </div>

        {/* Remaining Picks 5-14 */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)', fontWeight: 'var(--weight-semi)' }}>
            Remaining Lottery Picks (5-14)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {remaining.map(result => (
              <div key={result.pick} style={{
                background: result.team.id === userTeamId ? 'var(--color-warning)15' : 'var(--color-bg-sunken)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: result.team.id === userTeamId ? '1px solid var(--color-warning)30' : '1px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-text-tertiary)', minWidth: 50 }}>Pick {result.pick}</span>
                  <span>{result.team.name}</span>
                </div>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>{result.team.wins}-{result.team.losses}</span>
              </div>
            ))}
          </div>
        </div>

        {/* User result banner */}
        {userResult && (
          <div style={{
            padding: 'var(--space-4)', background: 'var(--color-warning)15',
            borderRadius: 'var(--radius-lg)', textAlign: 'center',
            border: '1px solid var(--color-warning)30', marginBottom: 'var(--space-4)',
          }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>
              {userResult.pick <= 4 ? `\ud83c\udf89 You won the #${userResult.pick} pick!` : `You have the #${userResult.pick} pick.`}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
          <Button variant="primary" size="lg" onClick={() => window.closeLotteryModal?.()}>
            Continue to Draft
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
}

function LotteryCard({ result, isUser, isTop }) {
  return (
    <div style={{
      background: isUser ? 'var(--color-warning)20' : 'var(--color-bg-sunken)',
      padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
      borderLeft: `4px solid ${isUser ? 'var(--color-warning)' : '#ffd700'}`,
      display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
    }}>
      <div style={{ fontSize: '2em', fontWeight: 'var(--weight-bold)', color: '#ffd700', minWidth: 55, textAlign: 'center' }}>
        #{result.pick}
      </div>
      <div>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>{result.team.name}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {result.team.wins}-{result.team.losses} record
          {result.isPromoted && <span style={{ color: 'var(--color-warning)', marginLeft: 'var(--space-2)' }}>{'\ud83d\udc51'} Promoted</span>}
          {result.jumped && <span style={{ color: 'var(--color-win)', marginLeft: 'var(--space-2)' }}>{'\u2b06\ufe0f'} Jumped from #{result.originalPosition}!</span>}
        </div>
      </div>
    </div>
  );
}
