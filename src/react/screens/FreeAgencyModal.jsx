import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

const POSITIONS = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];

export function FreeAgencyModal({ isOpen, data, onClose }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [posFilter, setPosFilter] = useState('ALL');
  const [offers, setOffers] = useState({});

  const dataPhase = data?.phase || 'select';
  useEffect(() => {
    if (dataPhase === 'select' && data) {
      const initial = new Set();
      (data.formerPlayers || []).forEach(p => initial.add(String(p.id)));
      setSelectedIds(initial);
      setPosFilter('ALL');
      setOffers({});
    }
  }, [dataPhase]);

  if (!isOpen || !data) return null;
  const fc = data.formatCurrency || (v => `$${(v / 1e6).toFixed(1)}M`);

  if (dataPhase === 'results' && data.results) {
    return (
      <Modal isOpen={isOpen} onClose={null} maxWidth={700} zIndex={1300}>
        <ModalHeader>Free Agency Results</ModalHeader>
        <ModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <ResultsView results={data.results} fc={fc} getTeamById={data.getTeamById} userOffers={data.userOffers} />
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <Button variant="primary" onClick={() => window.continueFreeAgency?.()}>
              Continue to Season Setup
            </Button>
          </div>
        </ModalBody>
      </Modal>
    );
  }

  return (
    <SelectionView
      data={data} fc={fc} selectedIds={selectedIds} setSelectedIds={setSelectedIds}
      posFilter={posFilter} setPosFilter={setPosFilter}
      offers={offers} setOffers={setOffers}
    />
  );
}

function SelectionView({ data, fc, selectedIds, setSelectedIds, posFilter, setPosFilter, offers, setOffers }) {
  const { formerPlayers = [], otherPlayers = [], hiddenCount = 0, roster = [], capSpace = 0, rosterSidebar } = data;

  const rc = data?.getRatingColor || ((r) =>
    r >= 80 ? 'var(--color-rating-elite)' : r >= 70 ? 'var(--color-rating-good)'
    : r >= 60 ? 'var(--color-rating-avg)' : 'var(--color-rating-poor)');

  const allPlayers = useMemo(() => [...(formerPlayers || []), ...(otherPlayers || [])], [formerPlayers, otherPlayers]);

  const watchedFAs = useMemo(() => (otherPlayers || []).filter(p => p._isWatched), [otherPlayers]);
  const unwatchedFAs = useMemo(() => (otherPlayers || []).filter(p => !p._isWatched), [otherPlayers]);

  const filterByPos = useCallback((list) =>
    posFilter === 'ALL' ? list : list.filter(p => p.position === posFilter), [posFilter]);

  const filteredFormer = useMemo(() => filterByPos(formerPlayers || []), [formerPlayers, filterByPos]);
  const filteredWatched = useMemo(() => filterByPos(watchedFAs), [watchedFAs, filterByPos]);
  const filteredUnwatched = useMemo(() => filterByPos(unwatchedFAs), [unwatchedFAs, filterByPos]);

  const selectedPlayers = useMemo(() =>
    allPlayers.filter(p => selectedIds.has(String(p.id))), [allPlayers, selectedIds]);

  const estCost = useMemo(() =>
    selectedPlayers.reduce((sum, p) => sum + (offers[p.id]?.salary || p._marketValue || p.salary || 0), 0),
    [selectedPlayers, offers]);

  const remaining = capSpace - estCost;
  const isEmpty = filteredFormer.length === 0 && filteredWatched.length === 0 && filteredUnwatched.length === 0;

  const toggle = (id) => {
    const idStr = String(id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(idStr)) {
        next.delete(idStr);
        setOffers(o => { const n = { ...o }; delete n[id]; return n; });
      } else {
        next.add(idStr);
        const player = allPlayers.find(p => String(p.id) === idStr);
        if (player) {
          setOffers(o => ({
            ...o,
            [id]: { salary: player._marketValue || player.salary || 500000, years: player._suggestedYears || 2 },
          }));
        }
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (selectedPlayers.length === 0) { alert('Select at least one player.'); return; }
    const finalOffers = selectedPlayers.map(p => ({
      playerId: p.id,
      salary: offers[p.id]?.salary || p._marketValue || p.salary,
      years: offers[p.id]?.years || p._suggestedYears || 2,
    }));
    window._faSubmitOffers?.(finalOffers);
  };

  // Position counts from roster
  const posCounts = useMemo(() => {
    const counts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    (roster || []).forEach(p => { if (counts[p.position] !== undefined) counts[p.position]++; });
    return counts;
  }, [roster]);

  const sortedRoster = useMemo(() =>
    [...(roster || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0)), [roster]);

  return (
    <Modal isOpen={true} onClose={null} maxWidth={900} zIndex={1300}>
      <ModalHeader>Free Agency</ModalHeader>
      <ModalBody style={{ maxHeight: '78vh', overflowY: 'auto' }}>
        {/* Summary */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12, fontSize: 'var(--text-sm)',
        }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {selectedPlayers.length > 0 && (
              <>{selectedPlayers.length} selected · Est. cost: <strong style={{ fontFamily: 'var(--font-mono)' }}>{fc(estCost)}</strong></>
            )}
          </span>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>Cap: <strong style={{ fontFamily: 'var(--font-mono)' }}>{fc(capSpace)}</strong></span>
            <span>Remaining: <strong style={{
              fontFamily: 'var(--font-mono)',
              color: remaining < 0 ? 'var(--color-loss)' : 'var(--color-text)',
            }}>{fc(remaining)}</strong></span>
          </div>
        </div>

        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', marginBottom: 12 }}>
          You'll compete with other teams for these players. Higher offers and team success increase your chances.
        </div>

        {isEmpty ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
            <div style={{ fontSize: 'var(--text-md)', marginBottom: 8 }}>No Free Agents Available</div>
            <div style={{ fontSize: 'var(--text-sm)' }}>All quality players have been re-signed this offseason.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--gap)' }}>
            {/* Roster Sidebar — full roster */}
            <div style={{
              background: 'var(--color-bg-sunken)',
              border: '1px solid var(--color-border-subtle)',
              padding: '12px 14px',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
              }}>Roster ({roster.length}/15)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, textAlign: 'center', marginBottom: 10 }}>
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
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {sortedRoster.map((p, i) => (
                  <div key={p.id || i} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '3px 0',
                    fontSize: 'var(--text-xs)',
                    borderBottom: i < sortedRoster.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                  }}>
                    <span>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 4 }}>{p.position}</span>
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: rc(p.rating) }}>{p.rating}</span>
                  </div>
                ))}
              </div>

              {/* Additional sidebar info */}
              {rosterSidebar && (
                <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                  {rosterSidebar}
                </div>
              )}
            </div>

            {/* FA Market */}
            <div>
              {/* Filter */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, alignItems: 'center' }}>
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

              {/* Table */}
              <div style={{ maxHeight: 300, overflowY: 'auto', background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg-raised)', zIndex: 1 }}>
                      <th style={{ ...thS, width: 32 }}></th>
                      <th style={{ ...thS, textAlign: 'left' }}>Player</th>
                      <th style={thS}>OVR</th>
                      <th style={thS}>Pos</th>
                      <th style={thS}>Age</th>
                      <th style={{ ...thS, textAlign: 'right', paddingRight: 16 }}>Market</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFormer.length > 0 && (
                      <tr><td colSpan={6} style={sectionTd}>Former Players</td></tr>
                    )}
                    {filteredFormer.map(p => (
                      <FARow key={p.id} p={p} checked={selectedIds.has(String(p.id))} onToggle={toggle} fc={fc} rc={rc} />
                    ))}
                    {filteredWatched.length > 0 && (
                      <tr><td colSpan={6} style={sectionTd}>Watched Players</td></tr>
                    )}
                    {filteredWatched.map(p => (
                      <FARow key={p.id} p={p} checked={selectedIds.has(String(p.id))} onToggle={toggle} fc={fc} rc={rc} />
                    ))}
                    {filteredUnwatched.length > 0 && (
                      <tr><td colSpan={6} style={sectionTd}>Free Agent Market</td></tr>
                    )}
                    {filteredUnwatched.map(p => (
                      <FARow key={p.id} p={p} checked={selectedIds.has(String(p.id))} onToggle={toggle} fc={fc} rc={rc} />
                    ))}
                    {hiddenCount > 0 && (
                      <tr><td colSpan={6} style={{ padding: '6px 16px', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                        +{hiddenCount} lower-rated players not shown
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Offer cards */}
              {selectedPlayers.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
                  }}>Your Offers ({selectedPlayers.length})</div>
                  {selectedPlayers.map(p => (
                    <OfferCard key={p.id} player={p} fc={fc}
                      offer={offers[p.id] || { salary: p._marketValue || p.salary || 500000, years: p._suggestedYears || 2 }}
                      onChange={(o) => setOffers(prev => ({ ...prev, [p.id]: o }))}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <Button variant="primary" onClick={handleSubmit} disabled={selectedPlayers.length === 0}>
            Submit Offers ({selectedPlayers.length})
          </Button>
          <Button variant="ghost" onClick={() => window.skipFreeAgency?.()}>Skip</Button>
        </div>
      </ModalBody>
    </Modal>
  );
}

function FARow({ p, checked, onToggle, fc, rc }) {
  return (
    <tr onClick={() => onToggle(p.id)} style={{
      borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer',
      background: checked ? 'var(--color-accent-bg)' : 'var(--color-bg-raised)',
      transition: 'background 100ms ease',
    }}>
      <td style={{ padding: '6px 8px' }}>
        <input type="checkbox" checked={checked} readOnly
          style={{ width: 14, height: 14, accentColor: 'var(--color-accent)', pointerEvents: 'none' }} />
      </td>
      <td style={{ padding: '6px 8px' }}>
        <div style={{ fontWeight: 500 }}>{p.name}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          {p._fromTeamName || 'Free Agent'}
          {p._isFormer && ' · Loyalty bonus'}
          {p._isAboveTier && (
            <span style={{ color: 'var(--color-loss)', marginLeft: 4 }}>T{p._naturalTier} caliber</span>
          )}
        </div>
      </td>
      <td style={{ ...tdC, fontFamily: 'var(--font-mono)', fontWeight: 700, color: rc(p.rating) }}>{p.rating}</td>
      <td style={{ ...tdC, fontWeight: 500, fontSize: 'var(--text-xs)' }}>{p.position}</td>
      <td style={{ ...tdC, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{p.age}</td>
      <td style={{ ...tdC, textAlign: 'right', paddingRight: 16, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
        {p._marketData ? <MarketDisplay data={p._marketData} /> : fc(p._marketValue || p.salary || 0)}
      </td>
    </tr>
  );
}

function OfferCard({ player, fc, offer, onChange }) {
  const p = player;
  return (
    <div style={{
      padding: '12px 14px', marginBottom: 8,
      background: p._isFormer ? 'var(--color-accent-bg)' : 'var(--color-bg-sunken)',
      border: `1px solid ${p._isFormer ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
      }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{p.name}</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 8 }}>
            {p.position} · {p.rating} OVR · {p.age}yo
          </span>
          {p._isFormer && (
            <span style={{ fontSize: 10, color: 'var(--color-accent)', marginLeft: 8, fontWeight: 600 }}>
              5% Loyalty Bonus
            </span>
          )}
        </div>
        <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
          Market: {fc(p._marketValue || p.salary || 0)}
        </span>
      </div>

      {p._isAboveTier && (
        <div style={{
          padding: '4px 8px', marginBottom: 8, fontSize: 'var(--text-xs)',
          background: 'var(--color-loss-bg)', borderLeft: '3px solid var(--color-loss)',
          color: 'var(--color-loss)',
        }}>
          T{p._naturalTier} caliber — higher-tier teams will compete
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 3 }}>
            Salary ({fc(p._minOffer || 0)} – {fc(p._maxOffer || 0)})
          </div>
          <input type="number" value={offer.salary}
            min={p._minOffer} max={p._maxOffer} step={100000}
            onChange={e => onChange({ ...offer, salary: parseInt(e.target.value) || p._marketValue })}
            style={{
              width: '100%', padding: '5px 8px', fontSize: 'var(--text-xs)',
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-raised)', fontFamily: 'var(--font-mono)',
              color: 'var(--color-text)',
            }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 3 }}>
            Years (Suggested: {p._suggestedYears || 2})
          </div>
          <select value={offer.years}
            onChange={e => onChange({ ...offer, years: parseInt(e.target.value) })}
            style={{
              width: '100%', padding: '5px 8px', fontSize: 'var(--text-xs)',
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-raised)', color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
            }}>
            {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y} Year{y > 1 ? 's' : ''}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function MarketDisplay({ data }) {
  if (!data) return null;
  return (
    <span style={{ fontSize: 'var(--text-xs)' }}>
      {data.display || data.value || '—'}
    </span>
  );
}

function ResultsView({ results, fc, getTeamById, userOffers }) {
  const { signed = [], lost = [], aiSignings = [] } = results;

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 'var(--text-md)' }}>
        <span style={{ color: 'var(--color-win)', fontWeight: 700 }}>{signed.length} signed</span>
        {lost.length > 0 && (
          <span style={{ marginLeft: 16, color: 'var(--color-loss)' }}>{lost.length} chose other teams</span>
        )}
      </div>

      {signed.length > 0 && (
        <ResultSection title="Signed" color="var(--color-win)">
          {signed.map((r, i) => <ResultRow key={i} result={r} fc={fc} won />)}
        </ResultSection>
      )}

      {lost.length > 0 && (
        <ResultSection title="Lost" color="var(--color-loss)">
          {lost.map((r, i) => <ResultRow key={i} result={r} fc={fc} getTeamById={getTeamById} />)}
        </ResultSection>
      )}

      {aiSignings.length > 0 && (
        <ResultSection title="Notable AI Signings" color="var(--color-text-tertiary)">
          {aiSignings.slice(0, 10).map((r, i) => <ResultRow key={i} result={r} fc={fc} />)}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({ title, color, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  );
}

function ResultRow({ result, fc, won, getTeamById }) {
  const p = result.player || result;
  const teamName = result.signedWith
    ? (getTeamById ? getTeamById(result.signedWith)?.name : result.teamName)
    : result.teamName;

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)',
      fontSize: 'var(--text-sm)',
    }}>
      <div>
        <span style={{ fontWeight: 500 }}>{p.name || result.name}</span>
        <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 8, fontSize: 'var(--text-xs)' }}>
          {p.position || result.position} · {p.rating || result.rating} OVR
        </span>
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
        {won ? (
          <span style={{ color: 'var(--color-win)', fontWeight: 600 }}>Signed</span>
        ) : teamName ? (
          <span>Signed with <strong>{teamName}</strong></span>
        ) : (
          <span style={{ color: 'var(--color-loss)', fontWeight: 600 }}>Declined</span>
        )}
        {result.salary && <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)' }}>{fc(result.salary)}</span>}
      </div>
    </div>
  );
}

const thS = {
  padding: '7px 8px', fontSize: 10, fontWeight: 600,
  color: 'var(--color-text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center',
};

const tdC = {
  padding: '6px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
};

const sectionTd = {
  padding: '6px 16px', fontSize: 10, fontWeight: 600,
  color: 'var(--color-accent)', textTransform: 'uppercase',
  letterSpacing: '0.04em', borderBottom: '1px solid var(--color-border-subtle)',
};
