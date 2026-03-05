import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

export function ContractDecisionsModal({ isOpen, data, onConfirm }) {
  const [decisions, setDecisions] = useState({});

  if (!isOpen || !data) return null;

  const { players = [], capSpace, rosterCount, formatCurrency, getRatingColor, determineContractLength } = data;
  const fc = formatCurrency || ((v) => '$' + (v / 1e6).toFixed(1) + 'M');
  const rc = getRatingColor || ((r) =>
    r >= 80 ? 'var(--color-rating-elite)' : r >= 70 ? 'var(--color-rating-good)'
    : r >= 60 ? 'var(--color-rating-avg)' : 'var(--color-rating-poor)');

  const resignedSalary = players
    .filter(p => decisions[p.id] === 'resign')
    .reduce((sum, p) => sum + (p.salary || 0), 0);
  const resignedCount = Object.values(decisions).filter(d => d === 'resign').length;
  const releasedCount = Object.values(decisions).filter(d => d === 'release').length;
  const remainingCap = capSpace - resignedSalary;
  const decidedAll = Object.keys(decisions).length === players.length;

  const toggle = (playerId, action) => {
    setDecisions(prev => ({ ...prev, [playerId]: action }));
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} maxWidth={580} zIndex={1300}>
      <ModalHeader>Contract Decisions</ModalHeader>

      {/* Summary bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        padding: '12px 20px', background: 'var(--color-bg-sunken)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <SummaryCell label="Expiring" value={players.length} color="var(--color-warning)" />
        <SummaryCell label="Cap Space" value={fc(remainingCap)}
          color={remainingCap >= 0 ? 'var(--color-text)' : 'var(--color-loss)'} />
        <SummaryCell label="After Decisions" value={`${rosterCount + resignedCount} players`} />
      </div>

      <ModalBody style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {players.map(player => {
            const decision = decisions[player.id];
            const newYears = determineContractLength ? determineContractLength(player.age, player.rating) : 2;
            const canAfford = player.salary <= remainingCap || decision === 'resign';

            return (
              <div key={player.id} style={{
                padding: '12px 14px',
                background: 'var(--color-bg-sunken)',
                border: '1px solid var(--color-border-subtle)',
                borderLeft: decision === 'resign' ? '3px solid var(--color-win)'
                  : decision === 'release' ? '3px solid var(--color-loss)'
                  : '3px solid transparent',
              }}>
                {/* Player info */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 10,
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{player.name}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 8 }}>
                      {player.position} · {player.age}yo
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 'var(--text-xs)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: rc(player.rating) }}>{player.rating}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{fc(player.salary)}/yr</span>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>{newYears}yr new</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button
                    onClick={() => toggle(player.id, 'resign')}
                    disabled={!canAfford && decision !== 'resign'}
                    style={{
                      padding: 6, border: 'none',
                      cursor: !canAfford && decision !== 'resign' ? 'not-allowed' : 'pointer',
                      opacity: !canAfford && decision !== 'resign' ? 0.3 : 1,
                      background: decision === 'resign' ? 'var(--color-win)' : 'var(--color-win-bg)',
                      color: decision === 'resign' ? 'var(--color-text-inverse)' : 'var(--color-win)',
                      fontWeight: 600, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-body)',
                      transition: 'all 100ms ease',
                    }}
                  >Re-sign ({newYears}yr)</button>
                  <button
                    onClick={() => toggle(player.id, 'release')}
                    style={{
                      padding: 6, border: 'none', cursor: 'pointer',
                      background: decision === 'release' ? 'var(--color-loss)' : 'var(--color-loss-bg)',
                      color: decision === 'release' ? 'var(--color-text-inverse)' : 'var(--color-loss)',
                      fontWeight: 600, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-body)',
                      transition: 'all 100ms ease',
                    }}
                  >Release</button>
                </div>

                {/* Can't afford */}
                {!canAfford && decision !== 'resign' && (
                  <div style={{ fontSize: 11, color: 'var(--color-loss)', marginTop: 4 }}>
                    Cannot afford — {fc(player.salary - remainingCap)} over cap
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ModalBody>

      <ModalFooter>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {Object.keys(decisions).length}/{players.length} decided
            {resignedCount > 0 && <span style={{ color: 'var(--color-win)' }}> · {resignedCount} re-signed</span>}
            {releasedCount > 0 && <span style={{ color: 'var(--color-loss)' }}> · {releasedCount} released</span>}
          </div>
          <Button
            variant="primary"
            disabled={!decidedAll}
            onClick={() => onConfirm(decisions)}
            style={{ opacity: decidedAll ? 1 : 0.4, minWidth: 150 }}
          >
            {decidedAll ? 'Confirm Decisions' : `${players.length - Object.keys(decisions).length} remaining`}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

function SummaryCell({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 10, color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>{label}</div>
      <div style={{
        fontSize: 'var(--text-base)', fontWeight: 700,
        fontFamily: 'var(--font-mono)', color: color || 'var(--color-text)',
      }}>{value}</div>
    </div>
  );
}
