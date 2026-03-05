import React, { useState, useMemo } from 'react';
import { Modal, ModalBody } from '../components/Modal.jsx';

const POSITIONS = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];

export function UserDraftPickModal({ isOpen, data, onClose }) {
  const [posFilter, setPosFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('rating');

  if (!isOpen || !data) return null;

  const { pickNumber, roundText, prospects = [], roster = [], getRatingColor } = data;

  return (
    <Modal isOpen={isOpen} onClose={null} maxWidth={900} zIndex={1300}>
      <ModalBody style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 16,
        }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
            }}>Your Pick</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>Make Your Selection</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)',
              color: 'var(--color-accent)',
            }}>#{pickNumber}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {roundText}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontSize: 10, color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4,
            }}>Pos</span>
            {POSITIONS.map(pos => (
              <button key={pos} onClick={() => setPosFilter(pos)} style={{
                padding: '3px 10px', fontSize: 'var(--text-xs)', border: 'none',
                background: posFilter === pos ? 'var(--color-accent)' : 'transparent',
                color: posFilter === pos ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                fontWeight: posFilter === pos ? 600 : 400,
                fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}>{pos === 'ALL' ? 'All' : pos}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontSize: 10, color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4,
            }}>Sort</span>
            {[
              { key: 'rating', label: 'Rating' },
              { key: 'age', label: 'Age' },
              { key: 'position', label: 'Position' },
            ].map(s => (
              <button key={s.key} onClick={() => setSortBy(s.key)} style={{
                padding: '3px 10px', fontSize: 'var(--text-xs)', border: 'none',
                background: sortBy === s.key ? 'var(--color-accent)' : 'transparent',
                color: sortBy === s.key ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                fontWeight: sortBy === s.key ? 600 : 400,
                fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 'var(--gap)' }}>
          <ProspectTable prospects={prospects} posFilter={posFilter} sortBy={sortBy} getRatingColor={getRatingColor} />
          <RosterSidebar roster={roster} getRatingColor={getRatingColor} />
        </div>
      </ModalBody>
    </Modal>
  );
}

function ProspectTable({ prospects, posFilter, sortBy, getRatingColor }) {
  const filtered = useMemo(() => {
    let list = posFilter === 'ALL' ? [...prospects] : prospects.filter(p => p.position === posFilter);
    if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'age') list.sort((a, b) => a.age - b.age);
    else if (sortBy === 'position') list.sort((a, b) => a.position.localeCompare(b.position));
    return list;
  }, [prospects, posFilter, sortBy]);

  const rc = (r) => {
    if (getRatingColor) return getRatingColor(r);
    return r >= 80 ? 'var(--color-rating-elite)' : r >= 70 ? 'var(--color-rating-good)' : r >= 60 ? 'var(--color-rating-avg)' : 'var(--color-rating-poor)';
  };

  return (
    <div style={{
      background: 'var(--color-bg-sunken)',
      border: '1px solid var(--color-border-subtle)',
    }}>
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', color: 'var(--color-text-tertiary)',
          padding: 40, fontSize: 'var(--text-sm)',
        }}>No prospects match your filters</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ ...th, paddingLeft: 16, textAlign: 'left' }}>Prospect</th>
              <th style={th}>Pos</th>
              <th style={th}>Age</th>
              <th style={th}>OVR</th>
              <th style={th}>OFF</th>
              <th style={{ ...th, paddingRight: 16 }}>DEF</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id || i}
                onClick={() => window.selectDraftProspect?.(p.id)}
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  cursor: 'pointer', background: 'var(--color-bg-raised)',
                  transition: 'background 100ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-accent-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg-raised)'}
              >
                <td style={{ padding: '10px 12px 10px 16px' }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                    {p._measurables || ''}
                  </div>
                </td>
                <td style={{ ...tdc, fontWeight: 500, fontSize: 'var(--text-xs)' }}>{p.position}</td>
                <td style={{ ...tdc, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{p.age}</td>
                <td style={{ ...tdc, fontFamily: 'var(--font-mono)', fontWeight: 700, color: rc(p.rating) }}>{p.rating}</td>
                <td style={{ ...tdc, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{p.offRating || '—'}</td>
                <td style={{ ...tdc, paddingRight: 16, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{p.defRating || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RosterSidebar({ roster, getRatingColor }) {
  const { posCounts, topPlayers, total } = useMemo(() => {
    const counts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    (roster || []).forEach(p => { if (counts[p.position] !== undefined) counts[p.position]++; });
    const top = [...(roster || [])].sort((a, b) => b.rating - a.rating).slice(0, 8);
    return { posCounts: counts, topPlayers: top, total: (roster || []).length };
  }, [roster]);

  const rc = (r) => {
    if (getRatingColor) return getRatingColor(r);
    return r >= 80 ? 'var(--color-rating-elite)' : r >= 70 ? 'var(--color-rating-good)' : r >= 60 ? 'var(--color-rating-avg)' : 'var(--color-rating-poor)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      {/* Position counts */}
      <div style={{
        background: 'var(--color-bg-sunken)',
        border: '1px solid var(--color-border-subtle)', padding: '12px 14px',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
        }}>Roster ({total}/15)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, textAlign: 'center' }}>
          {['PG', 'SG', 'SF', 'PF', 'C'].map(pos => (
            <div key={pos}>
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{pos}</div>
              <div style={{
                fontSize: 'var(--text-base)', fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: posCounts[pos] === 0 ? 'var(--color-loss)' : 'var(--color-text)',
              }}>{posCounts[pos]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Current roster */}
      <div style={{
        background: 'var(--color-bg-sunken)',
        border: '1px solid var(--color-border-subtle)', padding: '12px 14px',
        flex: 1,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
        }}>Current Players</div>
        {topPlayers.map((p, i) => (
          <div key={p.id || i} style={{
            display: 'flex', justifyContent: 'space-between', padding: '4px 0',
            fontSize: 'var(--text-xs)',
            borderBottom: i < topPlayers.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
          }}>
            <span>
              <span style={{ fontWeight: 500 }}>{p.name}</span>
              <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 4 }}>{p.position}</span>
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 600, color: rc(p.rating),
            }}>{p.rating}</span>
          </div>
        ))}
        {total > 8 && (
          <div style={{
            fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
            marginTop: 6, textAlign: 'center',
          }}>+{total - 8} more</div>
        )}
      </div>
    </div>
  );
}

const th = {
  padding: '7px 8px', fontSize: 10, fontWeight: 600,
  color: 'var(--color-text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center',
};

const tdc = {
  padding: '10px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
};
