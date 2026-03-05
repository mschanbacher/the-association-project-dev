import React from 'react';
import { Modal, ModalBody, ModalFooter } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

export function ComplianceModal({ isOpen, data, onManageRoster, onRecheck }) {
  if (!isOpen || !data) return null;

  const { isOverCap, isUnderMinimum, isOverMaximum, totalSalary, salaryCap, rosterSize, tier, formatCurrency } = data;
  const fc = formatCurrency || ((v) => '$' + (v / 1e6).toFixed(1) + 'M');
  const limitLabel = tier !== 1 ? 'Spending Limit' : 'Salary Cap';
  const issues = [isOverCap, isOverMaximum, isUnderMinimum].filter(Boolean).length;

  return (
    <Modal isOpen={isOpen} onClose={() => {}} maxWidth={480} zIndex={1300}>
      <ModalBody style={{ padding: 0 }}>
        <div style={{ borderTop: '3px solid var(--color-loss)' }}>
          {/* Header */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--color-loss)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
            }}>Compliance Required</div>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 700 }}>Roster Issues</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              {issues} issue{issues !== 1 ? 's' : ''} must be resolved before continuing
            </div>
          </div>

          <div style={{ padding: '16px 24px' }}>
            {isOverCap && (
              <div style={{
                padding: '12px 14px', marginBottom: 8,
                background: 'var(--color-loss-bg)', borderLeft: '3px solid var(--color-loss)',
              }}>
                <div style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600,
                  color: 'var(--color-loss)', marginBottom: 8,
                }}>Over {limitLabel}</div>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                  fontSize: 'var(--text-sm)', marginBottom: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>Current Salary</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{fc(totalSalary)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{limitLabel}</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{fc(salaryCap)}</div>
                  </div>
                </div>
                <div style={{
                  padding: '6px 10px', background: 'var(--color-loss)10',
                  fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-loss)',
                  textAlign: 'center', fontFamily: 'var(--font-mono)',
                }}>
                  {fc(totalSalary - salaryCap)} over limit
                </div>
              </div>
            )}

            {isOverMaximum && (
              <div style={{
                padding: '12px 14px', marginBottom: 8,
                background: 'var(--color-loss-bg)', borderLeft: '3px solid var(--color-loss)',
              }}>
                <div style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600,
                  color: 'var(--color-loss)', marginBottom: 6,
                }}>Over Maximum Roster ({rosterSize}/15)</div>
                <div style={{ fontSize: 'var(--text-sm)' }}>
                  Need to cut <strong style={{ color: 'var(--color-loss)' }}>
                    {rosterSize - 15} player{rosterSize - 15 > 1 ? 's' : ''}
                  </strong>
                </div>
              </div>
            )}

            {isUnderMinimum && (
              <div style={{
                padding: '12px 14px', marginBottom: 8,
                background: 'var(--color-warning-bg)', borderLeft: '3px solid var(--color-warning)',
              }}>
                <div style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600,
                  color: 'var(--color-warning)', marginBottom: 6,
                }}>Below Minimum Roster ({rosterSize}/12)</div>
                <div style={{ fontSize: 'var(--text-sm)' }}>
                  Need to sign <strong style={{ color: 'var(--color-warning)' }}>
                    {12 - rosterSize} player{12 - rosterSize > 1 ? 's' : ''}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
          <Button variant="primary" onClick={onManageRoster}>Manage Roster</Button>
          <Button variant="secondary" onClick={onRecheck}>Continue</Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
