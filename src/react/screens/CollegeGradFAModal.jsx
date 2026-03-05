import React, { useState, useMemo, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

const POSITIONS = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];

export function CollegeGradFAModal({ isOpen, data, onClose }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [posFilter, setPosFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('rating');

  const dataPhase = data?.phase || 'select';
  useEffect(() => {
    if (dataPhase === 'select') {
      setSelectedIds(new Set());
      setPosFilter('ALL');
      setSortBy('rating');
    }
  }, [dataPhase]);

  if (!isOpen || !data) return null;
  const fc = data.formatCurrency || (v => `$${(v / 1e6).toFixed(1)}M`);

  if (dataPhase === 'results' && data.results) {
    return (
      <Modal isOpen={isOpen} onClose={null} maxWidth={600} zIndex={1300}>
        <ModalHeader>College Graduate Signing Results</ModalHeader>
        <ModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <ResultsView results={data.results} onContinue={() => window.closeCollegeGradResults?.()} />
        </ModalBody>
      </Modal>
    );
  }

  return (
    <SelectionView
      data={data} fc={fc} selectedIds={selectedIds} setSelectedIds={setSelectedIds}
      posFilter={posFilter} setPosFilter={setPosFilter}
      sortBy={sortBy} setSortBy={setSortBy}
    />
  );
}

function SelectionView({ data, fc, selectedIds, setSelectedIds, posFilter, setPosFilter, sortBy, setSortBy }) {
  const { graduates = [], capSpace = 0, rosterSize = 0, season = 0 } = data;

  const rc = data?.getRatingColor || ((r) =>
    r >= 80 ? 'var(--color-rating-elite)' : r >= 70 ? 'var(--color-rating-good)'
    : r >= 60 ? 'var(--color-rating-avg)' : 'var(--color-rating-poor)');

  const filtered = useMemo(() => {
    let list = posFilter === 'ALL' ? [...graduates] : graduates.filter(g => g.position === posFilter);
    if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'age') list.sort((a, b) => a.age - b.age || b.rating - a.rating);
    else if (sortBy === 'salary') list.sort((a, b) => a.salary - b.salary);
    else if (sortBy === 'potential') list.sort((a, b) => b.projectedCeiling - a.projectedCeiling);
    return list;
  }, [graduates, posFilter, sortBy]);

  const selectedPlayers = useMemo(() =>
    graduates.filter(g => selectedIds.has(String(g.id))), [graduates, selectedIds]);
  const estCost = useMemo(() => selectedPlayers.reduce((s, p) => s + p.salary, 0), [selectedPlayers]);
  const remaining = capSpace - estCost;
  const rosterSpace = 15 - rosterSize;

  const toggle = (id) => {
    const idStr = String(id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(idStr)) next.delete(idStr); else next.add(idStr);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selectedPlayers.length === 0) { alert('Select at least one player.'); return; }
    if (estCost > capSpace) { alert(`Selections cost ${fc(estCost)} but cap space is ${fc(capSpace)}.`); return; }
    if (selectedPlayers.length > rosterSpace) { alert(`Only ${rosterSpace} roster spot${rosterSpace !== 1 ? 's' : ''} available.`); return; }
    window._cgSubmitOffers?.(selectedPlayers.map(p => String(p.id)));
  };

  return (
    <Modal isOpen={true} onClose={null} maxWidth={900} zIndex={1300}>
      <ModalHeader>College Graduate Free Agency</ModalHeader>
      <ModalBody style={{ maxHeight: '78vh', overflowY: 'auto' }}>
        {/* Summary bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12, fontSize: 'var(--text-sm)',
        }}>
          <div style={{ color: 'var(--color-text-secondary)' }}>
            {graduates.length} graduates · Class of {(season || 0) + 1}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>Cap: <strong>{fc(capSpace)}</strong></span>
            <span>Roster: <strong>{rosterSize}/15</strong></span>
          </div>
        </div>

        {/* Selection tally */}
        {selectedPlayers.length > 0 && (
          <div style={{
            padding: '10px 14px', background: 'var(--color-accent-bg)',
            border: '1px solid var(--color-accent-border)',
            marginBottom: 12, fontSize: 'var(--text-sm)',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>Selected: <strong>{selectedPlayers.length}</strong></span>
            <span>Est. Cost: <strong>{fc(estCost)}</strong></span>
            <span>Remaining: <strong style={{
              color: remaining >= 0 ? 'var(--color-text)' : 'var(--color-loss)',
            }}>{fc(remaining)}</strong></span>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4 }}>Pos</span>
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
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4 }}>Sort</span>
            {[
              { key: 'rating', label: 'Rating' },
              { key: 'potential', label: 'Ceiling' },
              { key: 'salary', label: 'Salary' },
              { key: 'age', label: 'Age' },
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

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
            No graduates match this filter.
          </div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg-raised)', zIndex: 1 }}>
                  <th style={{ ...th, width: 32 }}></th>
                  <th style={{ ...th, textAlign: 'left' }}>Player</th>
                  <th style={{ ...th, textAlign: 'left' }}>College</th>
                  <th style={th}>Pos</th>
                  <th style={th}>Age</th>
                  <th style={th}>OVR</th>
                  <th style={th}>Ceil</th>
                  <th style={{ ...th, textAlign: 'right', paddingRight: 16 }}>Salary</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <GradRow key={p.id} player={p} isChecked={selectedIds.has(String(p.id))}
                    onToggle={toggle} fc={fc} rc={rc} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <Button variant="primary" onClick={handleSubmit} disabled={selectedPlayers.length === 0}>
            Submit Offers ({selectedPlayers.length})
          </Button>
          <Button variant="ghost" onClick={() => window.skipCollegeGradFA?.()}>
            Skip
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
}

function GradRow({ player: p, isChecked, onToggle, fc, rc }) {
  const ceilingColor = p.projectedCeiling >= 80 ? 'var(--color-win)' :
    p.projectedCeiling >= 70 ? 'var(--color-text)' : 'var(--color-text-tertiary)';

  return (
    <tr style={{
      borderBottom: '1px solid var(--color-border-subtle)',
      background: isChecked ? 'var(--color-accent-bg)' : 'transparent',
      cursor: 'pointer',
    }} onClick={() => onToggle(p.id)}>
      <td style={{ padding: '6px 8px' }}>
        <input type="checkbox" checked={isChecked} readOnly
          style={{ width: 16, height: 16, accentColor: 'var(--color-accent)', pointerEvents: 'none' }} />
      </td>
      <td style={{ padding: '6px 8px' }}>
        <div style={{ fontWeight: 600 }}>{p.name}</div>
        {p._measurables && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 1 }}>{p._measurables}</div>
        )}
      </td>
      <td style={{ padding: '6px 8px', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
        {p.college}
      </td>
      <td style={{ ...tdc, fontWeight: 500 }}>{p.position}</td>
      <td style={{ ...tdc, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{p.age}</td>
      <td style={{ ...tdc }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: rc(p.rating) }}>{p.rating}</span>
        {p.offRating !== undefined && (
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {p.offRating}/{p.defRating}
          </div>
        )}
      </td>
      <td style={{ ...tdc, fontFamily: 'var(--font-mono)', fontWeight: 600, color: ceilingColor }}>
        {p.projectedCeiling}
      </td>
      <td style={{ ...tdc, textAlign: 'right', paddingRight: 16, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
        {fc(p.salary)}
      </td>
    </tr>
  );
}

function ResultsView({ results, onContinue }) {
  const { signed, lost, details } = results;

  return (
    <div>
      <div style={{
        textAlign: 'center', marginBottom: 16, fontSize: 'var(--text-md)',
      }}>
        <span style={{ color: 'var(--color-win)', fontWeight: 700 }}>{signed} signed</span>
        {lost > 0 && (
          <span style={{ marginLeft: 16, color: 'var(--color-loss)' }}>{lost} chose other teams</span>
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
        <tbody>
          {details.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <td style={{ padding: '8px 0', fontWeight: 500 }}>{r.player.name}</td>
              <td style={{ padding: '8px', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
                {r.player.position} · {r.player.rating} OVR · {r.player.college}
              </td>
              <td style={{
                padding: '8px 0', textAlign: 'right', fontWeight: 600,
                color: r.signed ? 'var(--color-win)' : 'var(--color-loss)',
              }}>
                {r.signed ? 'Signed' : 'Declined'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Button variant="primary" onClick={onContinue}>Continue</Button>
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
  padding: '6px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
};
