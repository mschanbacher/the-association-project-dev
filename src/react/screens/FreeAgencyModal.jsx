import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

const POSITIONS = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];

export function FreeAgencyModal({ isOpen, data, onClose }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [posFilter, setPosFilter] = useState('ALL');
  const [offers, setOffers] = useState({}); // { playerId: { salary, years } }

  // Reset state when new select-phase data arrives
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
      <Modal isOpen={isOpen} onClose={null} maxWidth={1000} zIndex={1300}>
        <ModalHeader>{'\ud83d\udcca'} Free Agency Results</ModalHeader>
        <ModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <ResultsView results={data.results} fc={fc} getTeamById={data.getTeamById} userOffers={data.userOffers} />
          <div style={{ textAlign: 'center', marginTop: 'var(--space-5)' }}>
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

/* ══════════════════════════════════════════════════════════
   SELECTION PHASE
   ══════════════════════════════════════════════════════════ */

function SelectionView({ data, fc, selectedIds, setSelectedIds, posFilter, setPosFilter, offers, setOffers }) {
  const { formerPlayers = [], otherPlayers = [], hiddenCount = 0, roster = [], capSpace = 0, rosterSidebar } = data;

  const allPlayers = useMemo(() => [...(formerPlayers || []), ...(otherPlayers || [])], [formerPlayers, otherPlayers]);

  // Separate watched/unwatched from otherPlayers
  const watchedFAs = useMemo(() => (otherPlayers || []).filter(p => p._isWatched), [otherPlayers]);
  const unwatchedFAs = useMemo(() => (otherPlayers || []).filter(p => !p._isWatched), [otherPlayers]);

  // Filter
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

  const toggle = (id) => {
    const idStr = String(id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(idStr)) next.delete(idStr); else next.add(idStr);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selectedPlayers.length === 0) { alert('Please select at least one player.'); return; }
    // Validate
    for (const p of selectedPlayers) {
      const s = offers[p.id]?.salary ?? p._marketValue;
      if (s < p._minOffer || s > p._maxOffer) {
        alert(`Offer to ${p.name} outside range (${fc(p._minOffer)} - ${fc(p._maxOffer)})`);
        return;
      }
    }
    if (estCost > capSpace) {
      alert(`Offers total ${fc(estCost)}, but cap space is only ${fc(capSpace)}.`);
      return;
    }
    // Build offers and call controller
    const offerData = selectedPlayers.map(p => ({
      playerId: p.id,
      salary: offers[p.id]?.salary ?? p._marketValue,
      years: offers[p.id]?.years ?? p._suggestedYears ?? 2,
    }));
    window._faSubmitOffers?.(offerData);
  };

  const handleSkip = () => {
    if (confirm("Skip free agency? You won't sign any free agents this off-season.")) {
      window.skipFreeAgency?.();
    }
  };

  const isEmpty = (formerPlayers || []).length === 0 && (otherPlayers || []).length === 0;

  return (
    <Modal isOpen={true} onClose={null} maxWidth={1600} zIndex={1300}>
      <ModalHeader>{'\ud83e\udd1d'} Free Agency Period</ModalHeader>
      <ModalBody style={{ maxHeight: '78vh', overflowY: 'auto' }}>
        {/* Header info */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
          <span>Select players to make offers to. </span>
          <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-win)' }}>Cap Space: {fc(capSpace)}</span>
        </div>

        {/* Offer tally */}
        {selectedPlayers.length > 0 && (
          <div style={{
            textAlign: 'center', marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
            background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)', fontSize: 'var(--text-sm)',
          }}>
            Selected: <strong>{selectedPlayers.length}</strong> player(s) {'\u00b7'} Est. Cost: <strong style={{ color: 'var(--color-warning)' }}>{fc(estCost)}</strong> {'\u00b7'} Remaining: <strong style={{ color: remaining >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>{fc(remaining)}</strong>
          </div>
        )}

        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
          You'll compete with other teams for these players. Higher offers and team success increase your chances.
        </div>

        {isEmpty ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-secondary)' }}>
            <div style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>No Free Agents Available</div>
            <div>All quality players have been re-signed this off-season.</div>
          </div>
        ) : (
          /* Two column layout */
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            {/* Left: Current Roster sidebar */}
            <div style={{
              background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-3)', border: '1px solid var(--color-border-subtle)',
            }}>
              <div style={{ fontWeight: 'var(--weight-semi)', textAlign: 'center', marginBottom: 'var(--space-3)' }}>{'\ud83d\udccb'} Current Roster</div>
              <RosterSidebar roster={roster} rosterSidebar={rosterSidebar} fc={fc} />
            </div>

            {/* Right: Free Agents */}
            <div>
              {/* Position filter */}
              <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
                <span style={{ marginRight: 'var(--space-2)', fontWeight: 'var(--weight-semi)', fontSize: 'var(--text-sm)' }}>Filter:</span>
                {POSITIONS.map(pos => (
                  <button key={pos} onClick={() => setPosFilter(pos)} style={{
                    padding: '4px 12px', marginRight: 'var(--space-1)', fontSize: 'var(--text-xs)',
                    background: posFilter === pos ? 'var(--color-accent)20' : 'var(--color-bg-active)',
                    border: `1px solid ${posFilter === pos ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)', color: posFilter === pos ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}>{pos === 'ALL' ? 'All' : pos}</button>
                ))}
              </div>

              {/* FA Table */}
              <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border-subtle)' }}>
                      <th style={thStyle}></th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Player</th>
                      <th style={thStyle}>OVR</th>
                      <th style={thStyle}>Fit</th>
                      <th style={thStyle}>Pos</th>
                      <th style={thStyle}>Age</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Market</th>
                      <th style={thStyle}>From</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Former Players */}
                    {filteredFormer.length > 0 && filteredFormer.map(p => (
                      <FAPlayerRow key={p.id} player={p} isFormer isChecked={selectedIds.has(String(p.id))} onToggle={toggle} />
                    ))}
                    {/* Watched */}
                    {filteredWatched.length > 0 && (
                      <>
                        <SectionDivider label={'\ud83d\udd0d WATCHED PLAYERS'} count={filteredWatched.length} color="#bb86fc" />
                        {filteredWatched.map(p => (
                          <FAPlayerRow key={p.id} player={p} isWatched isChecked={selectedIds.has(String(p.id))} onToggle={toggle} />
                        ))}
                      </>
                    )}
                    {/* Unwatched */}
                    {filteredUnwatched.length > 0 && (
                      <>
                        <SectionDivider label={posFilter !== 'ALL' ? `OTHER FREE AGENTS (${posFilter})` : 'OTHER FREE AGENTS'} count={filteredUnwatched.length} color="var(--color-text-tertiary)" />
                        {hiddenCount > 0 && (
                          <tr><td colSpan={8} style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>{hiddenCount} more lower-rated players not shown</td></tr>
                        )}
                        {filteredUnwatched.map(p => (
                          <FAPlayerRow key={p.id} player={p} isChecked={selectedIds.has(String(p.id))} onToggle={toggle} />
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Offer Cards for selected players */}
        {selectedPlayers.length > 0 && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-3)' }}>{'\ud83d\udcdd'} Your Offers ({selectedPlayers.length})</div>
            <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {selectedPlayers.map(p => (
                <OfferCard key={p.id} player={p} fc={fc}
                  offer={offers[p.id] || { salary: p._marketValue, years: p._suggestedYears || 2 }}
                  onChange={(o) => setOffers(prev => ({ ...prev, [p.id]: o }))}
                />
              ))}
            </div>
          </div>
        )}

        {/* Submit / Skip */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
          <Button variant="primary" onClick={handleSubmit} disabled={selectedPlayers.length === 0}>
            Submit Offers
          </Button>
          <Button variant="ghost" onClick={handleSkip}>
            Skip Free Agency
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
}

/* ── FA Player Row ── */
const thStyle = { padding: 'var(--space-2)', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' };

function FAPlayerRow({ player, isFormer, isWatched, isChecked, onToggle }) {
  const p = player;
  const bg = isFormer ? 'linear-gradient(90deg, rgba(251,188,4,0.2), rgba(102,126,234,0.15))'
    : isWatched ? 'rgba(155,89,182,0.1)' : 'transparent';

  return (
    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', background: bg }}>
      <td style={{ padding: 'var(--space-2)' }}>
        <input type="checkbox" checked={isChecked} onChange={() => onToggle(p.id)}
          style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
      </td>
      <td style={{ padding: 'var(--space-2)' }}>
        <strong>{p.name}</strong>
        {isFormer && <span style={{ color: 'var(--color-warning)', marginLeft: 6, fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-xs)' }}>{'\u2b50'} YOUR PLAYER</span>}
        {p.isCollegeGrad && <span style={{ color: 'var(--color-warning)', fontSize: 'var(--text-xs)', marginLeft: 6 }}>{'\ud83c\udf93'} GRAD</span>}
        {isWatched && <span style={{ color: '#bb86fc', marginLeft: 4 }} title="On Watch List">{'\ud83d\udd0d'}</span>}
      </td>
      <td style={{ padding: 'var(--space-2)', textAlign: 'center', fontWeight: 'var(--weight-bold)' }}>
        {p.rating}
        {p.offRating !== undefined && (
          <div style={{ fontSize: '0.7em', opacity: 0.6, fontWeight: 'var(--weight-normal)' }}>{p.offRating}/{p.defRating}</div>
        )}
      </td>
      <td style={{ padding: 'var(--space-2)', textAlign: 'center', fontWeight: 'var(--weight-bold)', color: p._fitColor || 'var(--color-text)' }}>{p._fitGrade || '-'}</td>
      <td style={{ padding: 'var(--space-2)', textAlign: 'center' }}>{p.position}</td>
      <td style={{ padding: 'var(--space-2)', textAlign: 'center' }}>{p.age}</td>
      <td style={{ padding: 'var(--space-2)', textAlign: 'right', fontSize: 'var(--text-xs)' }}>
        <MarketDisplay data={p._marketData} />
      </td>
      <td style={{ padding: 'var(--space-2)', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
        {isFormer ? <span style={{ color: 'var(--color-warning)', fontWeight: 'var(--weight-bold)' }}>{p._fromTeamName}</span> : (p._fromTeamName || 'N/A')}
      </td>
    </tr>
  );
}

/* ── Section Divider ── */
function SectionDivider({ label, count, color }) {
  return (
    <tr>
      <td colSpan={8} style={{
        padding: 'var(--space-2) var(--space-3)',
        borderTop: `2px solid ${color}40`,
        fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color,
        background: `${color}08`,
      }}>
        {label} ({count})
      </td>
    </tr>
  );
}

/* ── Offer Card ── */
function OfferCard({ player, fc, offer, onChange }) {
  const p = player;
  const isFormer = p._isFormer;
  const isAboveTier = p._isAboveTier;
  const bg = isFormer ? 'linear-gradient(135deg, rgba(251,188,4,0.15), rgba(102,126,234,0.15))' : 'var(--color-bg-sunken)';
  const border = isFormer ? '2px solid rgba(251,188,4,0.4)' : '1px solid var(--color-border-subtle)';

  return (
    <div style={{ background: bg, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <div>
          <strong>{p.name}</strong>
          {isFormer && <span style={{ color: 'var(--color-warning)', marginLeft: 8, fontWeight: 'var(--weight-bold)' }}>{'\u2b50'} YOUR PLAYER</span>}
          <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--space-2)' }}>{p.position} | {p.rating} OVR | Age {p.age}</span>
        </div>
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
          <MarketDisplay data={p._marketData} />
        </span>
      </div>

      {isAboveTier && (
        <div style={{ background: 'rgba(255,107,107,0.1)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-2)', borderLeft: '3px solid #ff6b6b', fontSize: 'var(--text-xs)' }}>
          <span style={{ color: '#ff6b6b', fontWeight: 'var(--weight-bold)' }}>{'\u26a0\ufe0f'} Tier {p._naturalTier} Caliber Player</span>
          <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--space-2)' }}>Higher-tier teams will compete!</span>
        </div>
      )}
      {isFormer && (
        <div style={{ background: 'rgba(251,188,4,0.1)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-2)', borderLeft: '3px solid var(--color-warning)', fontSize: 'var(--text-xs)' }}>
          <span style={{ color: 'var(--color-warning)', fontWeight: 'var(--weight-bold)' }}>{'\ud83c\udfaf'} 5% Loyalty Bonus Active</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 3, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            Salary ({fc(p._minOffer)} - {fc(p._maxOffer)})
          </label>
          <input type="number" value={offer.salary} min={p._minOffer} max={p._maxOffer} step={100000}
            onChange={e => onChange({ ...offer, salary: parseInt(e.target.value) || p._marketValue })}
            style={{
              width: '100%', padding: 'var(--space-2)', fontSize: 'var(--text-sm)',
              borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-active)',
              color: 'var(--color-text)', border: '1px solid var(--color-border-subtle)',
            }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 3, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            Years (Suggested: {p._suggestedYears || 2})
          </label>
          <select value={offer.years}
            onChange={e => onChange({ ...offer, years: parseInt(e.target.value) })}
            style={{
              width: '100%', padding: 'var(--space-2)', fontSize: 'var(--text-sm)',
              borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-active)',
              color: 'var(--color-text)', border: '1px solid var(--color-border-subtle)',
            }}>
            {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y} Year{y > 1 ? 's' : ''}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

/* ── Roster Sidebar ── */
function RosterSidebar({ roster, rosterSidebar, fc }) {
  if (!roster || roster.length === 0) return <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 'var(--space-4)' }}>No players on roster</div>;

  const byPos = {};
  roster.forEach(p => { byPos[p.position] = byPos[p.position] || []; byPos[p.position].push(p); });

  return (
    <div style={{ fontSize: 'var(--text-xs)', maxHeight: 450, overflowY: 'auto' }}>
      <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'var(--color-bg-active)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-2)' }}>
        Roster: {roster.length}/15 {rosterSidebar?.capLabel && <span>{'\u00b7'} {rosterSidebar.capLabel}</span>}
      </div>
      {['PG', 'SG', 'SF', 'PF', 'C'].map(pos => {
        const players = byPos[pos] || [];
        if (players.length === 0) return null;
        return (
          <div key={pos} style={{ marginBottom: 'var(--space-2)' }}>
            <div style={{ fontWeight: 'var(--weight-semi)', color: 'var(--color-text-tertiary)', marginBottom: 2 }}>{pos} ({players.length})</div>
            {players.sort((a, b) => b.rating - a.rating).map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span>{p.name}</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>{p.rating}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   RESULTS PHASE
   ══════════════════════════════════════════════════════════ */

function ResultsView({ results, fc, getTeamById, userOffers }) {
  const userSigned = results.filter(r => r.userWon);
  const userMissed = results.filter(r => r.userOffered && !r.userWon);
  const otherSignings = results.filter(r => !r.userOffered);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Successful */}
      {userSigned.length > 0 && (
        <ResultSection color="var(--color-win)" icon={'\u2705'} title={`Successful Signings (${userSigned.length})`}>
          {userSigned.map(r => (
            <ResultRow key={r.player.id} player={r.player} fc={fc}>
              <div style={{ fontWeight: 'var(--weight-bold)' }}>{r.winningOffer.years}yr / {fc(r.winningOffer.salary)}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{r.numOffers} total offer(s)</div>
            </ResultRow>
          ))}
        </ResultSection>
      )}

      {/* Missed */}
      {userMissed.length > 0 && (
        <ResultSection color="var(--color-loss)" icon={'\u274c'} title={`Missed Signings (${userMissed.length})`}>
          {userMissed.map(r => {
            const team = getTeamById?.(r.winningOffer.teamId);
            const uo = userOffers?.find(o => o.playerId == r.player.id);
            return (
              <ResultRow key={r.player.id} player={r.player} fc={fc}>
                <div style={{ fontWeight: 'var(--weight-bold)' }}>Chose {team?.name || 'Unknown'}</div>
                {uo && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                  Their: {r.winningOffer.years}yr/{fc(r.winningOffer.salary)} vs Yours: {uo.years}yr/{fc(uo.salary)}
                </div>}
              </ResultRow>
            );
          })}
        </ResultSection>
      )}

      {/* No signings warning */}
      {userSigned.length === 0 && userMissed.length > 0 && (
        <div style={{
          background: 'var(--color-warning)15', padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)', textAlign: 'center',
          border: '1px solid var(--color-warning)30',
        }}>
          {'\u26a0\ufe0f'} Unfortunately, you didn't sign any of your targets this year. Consider offering more or improving your record.
        </div>
      )}

      {/* Other */}
      {otherSignings.length > 0 && (
        <ResultSection color="var(--color-text-secondary)" icon={'\ud83d\udccb'} title={`Other Signings (${Math.min(10, otherSignings.length)} of ${otherSignings.length})`}>
          {otherSignings.slice(0, 10).map(r => {
            const team = getTeamById?.(r.winningOffer.teamId);
            return (
              <div key={r.player.id} style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--text-sm)' }}>
                <strong>{r.player.name}</strong> ({r.player.rating} OVR) {'\u2192'} {team?.name || 'Unknown'} ({r.winningOffer.years}yr/{fc(r.winningOffer.salary)})
              </div>
            );
          })}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({ color, icon, title, children }) {
  return (
    <div style={{
      background: `${color}15`, padding: 'var(--space-4)',
      borderRadius: 'var(--radius-lg)', border: `2px solid ${color}40`,
    }}>
      <div style={{ color, fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-3)' }}>{icon} {title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>{children}</div>
    </div>
  );
}

function ResultRow({ player, fc, children }) {
  return (
    <div style={{
      background: 'var(--color-bg-sunken)', padding: 'var(--space-3)',
      borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <strong>{player.name}</strong>
        <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--space-2)' }}>{player.position} | {player.rating} OVR</span>
      </div>
      <div style={{ textAlign: 'right' }}>{children}</div>
    </div>
  );
}

/* ── Market Display (replaces formatMarketDisplay HTML) ── */
function MarketDisplay({ data }) {
  if (!data) return null;
  return (
    <span>
      {data.value}{' '}
      <span style={{
        background: data.badgeColor, color: '#fff',
        padding: '1px 6px', borderRadius: 3,
        fontSize: '0.75em', fontWeight: 'bold', marginLeft: 4,
      }}>
        T{data.natTier}
      </span>
      {data.crossTierValue && (
        <>
          <br />
          <span style={{ fontSize: '0.8em', color: '#ff6b6b', opacity: 0.9 }}>
            T{data.natTier} value: {data.crossTierValue}
          </span>
        </>
      )}
    </span>
  );
}
