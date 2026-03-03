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
    <Modal isOpen={isOpen} onClose={() => {}} maxWidth={520} zIndex={1300}>
      <div style={{
        padding: 'var(--space-5) var(--space-6)',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--color-loss-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', flexShrink: 0,
        }}>⚠️</div>
        <div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-loss)' }}>
            Roster Compliance Required
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {issues} issue{issues !== 1 ? 's' : ''} must be resolved
          </div>
        </div>
      </div>

      <ModalBody>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          Fix the following before continuing to next season:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {isOverCap && (
            <IssueCard icon="💰" title={`Over ${limitLabel}`} color="var(--color-loss)" bg="var(--color-loss-bg)">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                <div>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>Current Salary</span>
                  <div style={{ fontWeight: 'var(--weight-semi)' }}>{fc(totalSalary)}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>{limitLabel}</span>
                  <div style={{ fontWeight: 'var(--weight-semi)' }}>{fc(salaryCap)}</div>
                </div>
              </div>
              <div style={{
                marginTop: 'var(--space-2)', padding: 'var(--space-2)',
                background: 'rgba(196,62,62,0.1)', borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', color: 'var(--color-loss)',
                textAlign: 'center',
              }}>
                {fc(totalSalary - salaryCap)} over limit
              </div>
            </IssueCard>
          )}

          {isOverMaximum && (
            <IssueCard icon="👥" title={`Over Maximum (${rosterSize}/15)`} color="var(--color-loss)" bg="var(--color-loss-bg)">
              <div style={{ fontSize: 'var(--text-sm)' }}>
                Need to cut <strong style={{ color: 'var(--color-loss)' }}>{rosterSize - 15} player{rosterSize - 15 > 1 ? 's' : ''}</strong>
              </div>
            </IssueCard>
          )}

          {isUnderMinimum && (
            <IssueCard icon="👤" title={`Below Minimum (${rosterSize}/12)`} color="var(--color-warning)" bg="var(--color-warning-bg)">
              <div style={{ fontSize: 'var(--text-sm)' }}>
                Need to sign <strong style={{ color: 'var(--color-warning)' }}>{12 - rosterSize} player{12 - rosterSize > 1 ? 's' : ''}</strong>
              </div>
            </IssueCard>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <div style={{ display: 'flex', gap: 'var(--space-3)', width: '100%', justifyContent: 'flex-end' }}>
          <Button variant="primary" onClick={onManageRoster}>Manage Roster</Button>
          <Button variant="secondary" onClick={onRecheck}>Continue</Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

function IssueCard({ icon, title, color, bg, children }) {
  return (
    <div style={{
      padding: 'var(--space-4)', background: bg,
      borderRadius: 'var(--radius-md)', border: '1px solid ' + color + '30',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        marginBottom: 'var(--space-2)',
      }}>
        <span>{icon}</span>
        <span style={{ fontWeight: 'var(--weight-semi)', color, fontSize: 'var(--text-sm)' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}