import React, { useState, useMemo } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';

const POSITIONS = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];
const SORTS = [
  { key: 'rating', label: 'Rating' },
  { key: 'age', label: 'Age' },
  { key: 'position', label: 'Position' },
];

export function UserDraftPickModal({ isOpen, data, onClose }) {
  const [posFilter, setPosFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('rating');

  if (!isOpen || !data) return null;

  const { pickNumber, roundText, prospects = [], roster = [], getRatingColor } = data;

  return (
    <Modal isOpen={isOpen} onClose={null} maxWidth={1600} zIndex={1300}>
      <ModalBody style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>{'\ud83c\udfaf'} Your Pick</h2>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-warning)' }}>
              Pick #{pickNumber} ({roundText})
            </div>
            <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)', marginTop: 2 }}>Make your selection</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Position:</span>
            {POSITIONS.map(pos => (
              <button key={pos} onClick={() => setPosFilter(pos)} style={{
                padding: '3px 10px', fontSize: 'var(--text-xs)',
                background: posFilter === pos ? 'var(--color-accent)20' : 'var(--color-bg-active)',
                border: `1px solid ${posFilter === pos ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
                borderRadius: 'var(--radius-sm)', color: posFilter === pos ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}>{pos === 'ALL' ? 'All' : pos}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Sort:</span>
            {SORTS.map(s => (
              <button key={s.key} onClick={() => setSortBy(s.key)} style={{
                padding: '3px 10px', fontSize: 'var(--text-xs)',
                background: sortBy === s.key ? 'var(--color-accent)20' : 'var(--color-bg-active)',
                border: `1px solid ${sortBy === s.key ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
                borderRadius: 'var(--radius-sm)', color: sortBy === s.key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--space-4)' }}>
          <ProspectsList prospects={prospects} posFilter={posFilter} sortBy={sortBy} getRatingColor={getRatingColor} />
          <RosterSidebar roster={roster} getRatingColor={getRatingColor} />
        </div>
      </ModalBody>
    </Modal>
  );
}

/* ── Prospects List ── */
function ProspectsList({ prospects, posFilter, sortBy, getRatingColor }) {
  const filtered = useMemo(() => {
    let list = posFilter === 'ALL' ? [...prospects] : prospects.filter(p => p.position === posFilter);
    if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'age') list.sort((a, b) => a.age - b.age);
    else if (sortBy === 'position') list.sort((a, b) => a.position.localeCompare(b.position));
    return list;
  }, [prospects, posFilter, sortBy]);

  return (
    <div>
      <div style={{ fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-md)' }}>Available Prospects</div>
      <div style={{ maxHeight: 500, overflowY: 'auto', background: 'var(--color-bg-sunken)', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 'var(--space-6)' }}>No prospects match your filters</div>
        ) : (
          filtered.map(p => (
            <ProspectCard key={p.id} prospect={p} getRatingColor={getRatingColor} />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Prospect Card ── */
function ProspectCard({ prospect, getRatingColor }) {
  const p = prospect;
  const rColor = getRatingColor ? getRatingColor(p.rating) : 'var(--color-text)';

  return (
    <div
      onClick={() => window.selectDraftProspect?.(p.id)}
      style={{
        background: 'var(--color-bg-active)', padding: 'var(--space-3)', marginBottom: 'var(--space-2)',
        borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'background 0.15s',
        border: '1px solid var(--color-border-subtle)',
      }}
      onMouseOver={e => e.currentTarget.style.background = 'var(--color-warning)15'}
      onMouseOut={e => e.currentTarget.style.background = 'var(--color-bg-active)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-md)' }}>{p.name}</div>
          <div style={{ marginTop: 3, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {p.position} | Age {p.age}{p._measurables ? ` | ${p._measurables}` : ''}
          </div>
          {p._topAttrs && p._topAttrs.length > 0 && (
            <div style={{ marginTop: 3, fontSize: 'var(--text-xs)', display: 'flex', gap: 'var(--space-2)' }}>
              {p._topAttrs.map((attr, i) => (
                <span key={i} style={{ color: attr.color }}>{attr.icon}{attr.value}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: rColor, fontWeight: 'var(--weight-bold)', fontSize: '1.3em' }}>
            {'\u2b50'} {p.rating}
          </div>
          {p.offRating !== undefined && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              <span style={{ color: p.offRating >= 70 ? '#4ecdc4' : 'var(--color-warning)' }}>{p.offRating}</span>
              {' / '}
              <span style={{ color: p.defRating >= 70 ? '#45b7d1' : 'var(--color-warning)' }}>{p.defRating}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Roster Sidebar ── */
function RosterSidebar({ roster, getRatingColor }) {
  const { positionCounts, topPlayers, totalSize } = useMemo(() => {
    const counts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    (roster || []).forEach(p => { if (counts[p.position] !== undefined) counts[p.position]++; });
    const top = [...(roster || [])].sort((a, b) => b.rating - a.rating).slice(0, 10);
    return { positionCounts: counts, topPlayers: top, totalSize: (roster || []).length };
  }, [roster]);

  return (
    <div>
      <div style={{ fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-md)' }}>Your Roster</div>
      <div style={{ maxHeight: 500, overflowY: 'auto', background: 'var(--color-warning)08', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-warning)15' }}>
        {/* Position Breakdown */}
        <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-2)', background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>Position Breakdown:</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-2)', textAlign: 'center', fontSize: 'var(--text-sm)' }}>
            {['PG', 'SG', 'SF', 'PF', 'C'].map(pos => (
              <div key={pos}><strong>{pos}:</strong> {positionCounts[pos]}</div>
            ))}
          </div>
        </div>

        {/* Top Players */}
        <div style={{ fontSize: 'var(--text-sm)' }}>
          {topPlayers.map((p, i) => {
            const rColor = getRatingColor ? getRatingColor(p.rating) : 'var(--color-text)';
            return (
              <div key={p.id || i} style={{
                padding: 'var(--space-1) var(--space-2)', marginBottom: 3,
                background: 'var(--color-bg-active)', borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{p.name}</span>
                  <span style={{ color: rColor, fontWeight: 'var(--weight-bold)' }}>{p.rating}</span>
                </div>
                <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 1 }}>
                  {p.position} | Age {p.age}
                </div>
              </div>
            );
          })}
        </div>
        {totalSize > 10 && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
            ... and {totalSize - 10} more players
          </div>
        )}
      </div>
    </div>
  );
}
