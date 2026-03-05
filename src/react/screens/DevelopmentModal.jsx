import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

export function DevelopmentModal({ isOpen, data, onContinue }) {
  const [tab, setTab] = useState('summary');

  if (!isOpen || !data) return null;

  const { improvements = [], declines = [], userRetirements = [], notableRetirements = [], allRetirementsCount = 0 } = data;
  const hasContent = improvements.length > 0 || declines.length > 0 || userRetirements.length > 0 || notableRetirements.length > 0;

  const tabs = [
    { key: 'summary', label: 'Summary' },
    improvements.length > 0 && { key: 'improved', label: 'Improved', count: improvements.length, color: 'var(--color-win)' },
    declines.length > 0 && { key: 'declined', label: 'Declined', count: declines.length, color: 'var(--color-loss)' },
    (userRetirements.length > 0 || notableRetirements.length > 0) && { key: 'retired', label: 'Retired', count: allRetirementsCount || notableRetirements.length, color: 'var(--color-warning)' },
  ].filter(Boolean);

  return (
    <Modal isOpen={isOpen} onClose={onContinue} maxWidth={620} zIndex={1300}>
      <ModalHeader onClose={onContinue}>Player Development Report</ModalHeader>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-sunken)',
        }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '10px 16px', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
              background: 'transparent',
              color: tab === t.key ? 'var(--color-text)' : 'var(--color-text-tertiary)',
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t.label}
              {t.count != null && (
                <span style={{
                  fontSize: 10, padding: '1px 6px',
                  background: tab === t.key ? `${t.color}15` : 'var(--color-bg-sunken)',
                  color: tab === t.key ? t.color : 'var(--color-text-tertiary)',
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <ModalBody style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        {!hasContent && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)' }}>
            No significant player changes this offseason.
          </div>
        )}

        {/* Summary */}
        {tab === 'summary' && hasContent && (
          <div>
            {/* Metric boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)', marginBottom: 20 }}>
              <MetricBox label="Improved" value={improvements.length} color="var(--color-win)" />
              <MetricBox label="Declined" value={declines.length} color="var(--color-loss)" />
              <MetricBox label="Retired" value={allRetirementsCount} color="var(--color-warning)" />
            </div>

            {/* User retirements */}
            {userRetirements.length > 0 && (
              <>
                <SectionLabel color="var(--color-warning)">Your Team — Retirements</SectionLabel>
                {userRetirements.map((r, i) => (
                  <RetirementRow key={i} player={r} featured />
                ))}
              </>
            )}

            {/* Top improvements */}
            {improvements.length > 0 && (
              <>
                <SectionLabel color="var(--color-win)" mt>Biggest Improvements</SectionLabel>
                {improvements.slice(0, 3).map((log, i) => (
                  <RatingChangeRow key={i} log={log} />
                ))}
                {improvements.length > 3 && (
                  <button onClick={() => setTab('improved')} style={seeAllStyle}>
                    See all {improvements.length} →
                  </button>
                )}
              </>
            )}

            {/* Top declines */}
            {declines.length > 0 && (
              <>
                <SectionLabel color="var(--color-loss)" mt>Biggest Declines</SectionLabel>
                {declines.slice(0, 3).map((log, i) => (
                  <RatingChangeRow key={i} log={log} />
                ))}
                {declines.length > 3 && (
                  <button onClick={() => setTab('declined')} style={seeAllStyle}>
                    See all {declines.length} →
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Improved */}
        {tab === 'improved' && (
          <div>
            {improvements.map((log, i) => <RatingChangeRow key={i} log={log} />)}
          </div>
        )}

        {/* Declined */}
        {tab === 'declined' && (
          <div>
            {declines.map((log, i) => <RatingChangeRow key={i} log={log} />)}
          </div>
        )}

        {/* Retired */}
        {tab === 'retired' && (
          <div>
            {userRetirements.length > 0 && (
              <>
                <SectionLabel color="var(--color-warning)">Your Team</SectionLabel>
                {userRetirements.map((r, i) => <RetirementRow key={i} player={r} featured />)}
              </>
            )}
            {notableRetirements.length > 0 && (
              <>
                <SectionLabel color="var(--color-text-tertiary)" mt>
                  Notable League Retirements ({allRetirementsCount} total)
                </SectionLabel>
                {notableRetirements.map((r, i) => <RetirementRow key={i} player={r} />)}
              </>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="primary" onClick={onContinue}>Continue to Free Agency</Button>
      </ModalFooter>
    </Modal>
  );
}

function MetricBox({ label, value, color }) {
  return (
    <div style={{
      textAlign: 'center', padding: 14,
      background: `${color}08`, border: `1px solid ${color}15`,
    }}>
      <div style={{
        fontSize: 24, fontWeight: 700,
        fontFamily: 'var(--font-mono)', color,
      }}>{value}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SectionLabel({ children, color, mt }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      marginBottom: 8, ...(mt ? { marginTop: 16 } : {}),
    }}>{children}</div>
  );
}

function RatingChangeRow({ log }) {
  const isUp = log.change > 0;
  const color = isUp ? 'var(--color-win)' : 'var(--color-loss)';
  const bg = isUp ? 'var(--color-win-bg)' : 'var(--color-loss-bg)';

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 12px', marginBottom: 4,
      background: bg, borderLeft: `3px solid ${color}`,
    }}>
      <div>
        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{log.name}</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 8 }}>
          {log.position} · {log.age}yo
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
        <span style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{log.oldRating}</span>
        <span style={{ color: 'var(--color-text-tertiary)' }}>→</span>
        <span style={{ fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{log.newRating}</span>
        <span style={{
          fontSize: 11, padding: '1px 6px', fontWeight: 600,
          background: `${color}15`, color,
        }}>{isUp ? '+' : ''}{log.change}</span>
      </div>
    </div>
  );
}

function RetirementRow({ player, featured }) {
  const badge = player.peakRating >= 93 ? 'Legendary' :
    player.peakRating >= 88 && player.careerLength >= 12 ? 'HOF Candidate' : '';

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 12px', marginBottom: 4,
      background: featured ? 'var(--color-warning-bg)' : 'var(--color-bg-sunken)',
      borderLeft: featured ? '3px solid var(--color-warning)' : 'none',
    }}>
      <div>
        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{player.name}</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 8 }}>
          {player.position} · {player.age}yo
        </span>
        {badge && (
          <span style={{
            fontSize: 10, color: 'var(--color-warning)', marginLeft: 8, fontWeight: 600,
          }}>{badge}</span>
        )}
      </div>
      <div style={{
        display: 'flex', gap: 12, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
      }}>
        <span>Peak <strong style={{ color: 'var(--color-text-secondary)' }}>{player.peakRating}</strong></span>
        <span>{player.careerLength}yr</span>
      </div>
    </div>
  );
}

const seeAllStyle = {
  background: 'none', border: 'none', color: 'var(--color-accent)',
  fontSize: 'var(--text-xs)', cursor: 'pointer', padding: '8px 0',
  fontWeight: 600, fontFamily: 'var(--font-body)',
};
