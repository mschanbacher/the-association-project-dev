import React from 'react';
import { Modal, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

export function BreakingNewsModal({ isOpen, data, onClose }) {
  if (!isOpen || !data) return null;

  const { team1Name, team2Name, t1Gave, t2Gave, tierLabel } = data;

  return (
    <Modal isOpen={isOpen} onClose={null} maxWidth={550} zIndex={10001}>
      <ModalBody style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        {/* Red accent banner */}
        <div style={{
          color: 'var(--color-loss)', fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-bold)', letterSpacing: '3px', marginBottom: 'var(--space-2)',
        }}>
          {'\u26a1'} BREAKING NEWS {'\u26a1'}
        </div>

        <div style={{
          fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)',
          marginBottom: 'var(--space-5)', lineHeight: 1.3,
        }}>
          {tierLabel} Trade Alert
        </div>

        {/* Trade columns */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'stretch', marginBottom: 'var(--space-5)' }}>
          <TradeColumn teamName={team1Name} sends={t1Gave} />
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '1.5em', color: 'var(--color-text-tertiary)' }}>{'\u21c4'}</div>
          <TradeColumn teamName={team2Name} sends={t2Gave} />
        </div>

        <Button variant="primary" onClick={onClose}>
          Continue
        </Button>
      </ModalBody>
    </Modal>
  );
}

function TradeColumn({ teamName, sends }) {
  return (
    <div style={{
      flex: 1, background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-3)', border: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-warning)', marginBottom: 'var(--space-2)' }}>{teamName}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>Sends:</div>
      <div style={{ fontSize: 'var(--text-sm)' }}>{sends}</div>
    </div>
  );
}
