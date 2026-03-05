import React, { useState, useMemo } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

export function DraftResultsModal({ isOpen, data, onContinue }) {
  const [activeTab, setActiveTab] = useState('round1');

  const results = data?.results || [];
  const userTeamId = data?.userTeamId;

  const round1 = useMemo(() => results.filter(r => r.round === 1), [results]);
  const comp = useMemo(() => results.filter(r => r.round === 'Comp'), [results]);
  const round2 = useMemo(() => results.filter(r => r.round === 2), [results]);
  const userPicks = useMemo(() => results.filter(r => r.teamId === userTeamId), [results, userTeamId]);

  if (!isOpen || !data) return null;

  const rc = data?.getRatingColor || ((r) =>
    r >= 80 ? 'var(--color-rating-elite)' : r >= 70 ? 'var(--color-rating-good)'
    : r >= 60 ? 'var(--color-rating-avg)' : 'var(--color-rating-poor)');

  const tabs = [
    { key: 'round1', label: 'Round 1', count: round1.length },
    comp.length > 0 ? { key: 'comp', label: 'Comp.', count: comp.length } : null,
    { key: 'round2', label: 'Round 2', count: round2.length },
    { key: 'user', label: 'Your Picks', count: userPicks.length },
  ].filter(Boolean);

  const activeResults = activeTab === 'round1' ? round1
    : activeTab === 'comp' ? comp
    : activeTab === 'round2' ? round2
    : userPicks;

  return (
    <Modal isOpen={isOpen} onClose={onContinue} maxWidth={640} zIndex={1300}>
      <ModalHeader onClose={onContinue}>Draft Results</ModalHeader>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-sunken)',
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '10px 16px', border: 'none',
            borderBottom: activeTab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
            background: 'transparent',
            color: activeTab === t.key ? 'var(--color-text)' : 'var(--color-text-tertiary)',
            fontWeight: activeTab === t.key ? 600 : 400,
            fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {t.label}
            <span style={{
              fontSize: 10, padding: '1px 6px',
              background: activeTab === t.key ? 'var(--color-accent-bg)' : 'var(--color-bg-sunken)',
              color: 'var(--color-text-tertiary)',
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      <ModalBody style={{ maxHeight: '55vh', overflowY: 'auto', padding: 'var(--space-4) var(--space-5)' }}>
        {activeResults.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: 40,
            color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)',
          }}>No picks in this round.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ ...th, paddingLeft: 16, textAlign: 'left', width: 44 }}>Pick</th>
                <th style={{ ...th, textAlign: 'left' }}>Player</th>
                <th style={th}>Pos</th>
                <th style={th}>Age</th>
                <th style={th}>OVR</th>
                <th style={th}>OFF</th>
                <th style={{ ...th, paddingRight: 16 }}>DEF</th>
              </tr>
            </thead>
            <tbody>
              {activeResults.map((result, i) => {
                const isUser = result.teamId === userTeamId;
                const p = result.player;
                const wasTraded = result.originalTeamId && result.originalTeamId !== result.teamId;
                return (
                  <tr key={i} style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    background: isUser ? 'var(--color-accent-bg)' : 'transparent',
                    borderLeft: isUser ? '3px solid var(--color-accent)' : '3px solid transparent',
                  }}>
                    <td style={{
                      padding: '8px 8px 8px 16px',
                      fontFamily: 'var(--font-mono)', fontWeight: 600,
                      color: 'var(--color-text-tertiary)',
                    }}>{result.pick}</td>
                    <td style={{ padding: 8 }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{
                        fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 1,
                      }}>
                        {activeTab !== 'user' && result.teamName}
                        {activeTab === 'user' && `Rd ${result.round} · ${result.teamName}`}
                        {wasTraded && (
                          <span style={{ color: 'var(--color-info)', marginLeft: 4 }}>
                            (via {result.originalTeamName})
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdc, fontWeight: 500, fontSize: 'var(--text-xs)' }}>{p.position}</td>
                    <td style={{ ...tdc, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{p.age}</td>
                    <td style={{ ...tdc, fontFamily: 'var(--font-mono)', fontWeight: 700, color: rc(p.rating) }}>{p.rating}</td>
                    <td style={{ ...tdc, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{p.offRating || '—'}</td>
                    <td style={{ ...tdc, paddingRight: 16, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{p.defRating || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="primary" onClick={onContinue}>Continue to Free Agency</Button>
      </ModalFooter>
    </Modal>
  );
}

const th = {
  padding: '7px 8px', fontSize: 10, fontWeight: 600,
  color: 'var(--color-text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center',
};

const tdc = {
  padding: '8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
};
