import React, { useState, useMemo, useCallback } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Modal, ModalBody, ModalFooter } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';
import { ratingColor, SectionLabel, AttrBars } from '../visualizations/PlayerVisuals.jsx';

// ═══════════════════════════════════════════════════════════════
// DPE Replacement Modal
// Two tabs: Emergency Loan (T1/T2) and Free Agents (all tiers)
// ═══════════════════════════════════════════════════════════════

const POSITIONS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'];

const fmtCurrency = (v) => {
  if (v >= 1000000) return '$' + (v / 1000000).toFixed(2) + 'M';
  if (v >= 1000) return '$' + (v / 1000).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
};

export function DPEReplacementModal({ isOpen, data, onComplete }) {
  const [activeTab, setActiveTab] = useState('loan');
  const [posFilter, setPosFilter] = useState('All');
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);
  const [negotiationState, setNegotiationState] = useState(null); // null | { player, team, ... }
  const [selectedFAId, setSelectedFAId] = useState(null);
  const [lastDataKey, setLastDataKey] = useState(null);

  const { gameState, engines } = useGame();

  // Destructure data safely (may be null)
  const injuredPlayer = data?.injuredPlayer;
  const userTeam = data?.team;
  const dpeAmount = data?.dpeAmount || 0;
  const borrowingTier = data?.borrowingTier || 1;
  const loanCandidates = data?.loanCandidates;
  const freeAgents = data?.freeAgents;
  const activeLoans = data?.activeLoans;
  const generateSalary = data?.generateSalary;
  const gamesRemaining = data?.gamesRemaining || 0;
  const totalGames = data?.totalGames || 82;
  const currentDate = data?.currentDate;
  const calculateLoanTerms = data?.calculateLoanTerms;
  const evaluateLoanOffer = data?.evaluateLoanOffer;
  const executeLoan = data?.executeLoan;
  const signFreeAgentViaDPE = data?.signFreeAgentViaDPE;
  const initializePlayerChemistry = data?.initializePlayerChemistry;

  const isT3 = borrowingTier === 3;

  // Reset state when modal opens with new data
  const dataKey = injuredPlayer?.id;
  if (dataKey && dataKey !== lastDataKey) {
    setLastDataKey(dataKey);
    setActiveTab(isT3 ? 'fa' : 'loan');
    setPosFilter('All');
    setExpandedPlayerId(null);
    setNegotiationState(null);
    setSelectedFAId(null);
  }

  // ── Filtered loan candidates ──
  const filteredCandidates = useMemo(() => {
    if (!loanCandidates) return [];
    if (posFilter === 'All') return loanCandidates;
    return loanCandidates.filter(c => c.player.position === posFilter);
  }, [loanCandidates, posFilter]);

  // ── Filtered free agents ──
  const filteredFA = useMemo(() => {
    if (!freeAgents) return [];
    if (posFilter === 'All') return freeAgents;
    return freeAgents.filter(p => p.position === posFilter);
  }, [freeAgents, posFilter]);

  // ── Loan terms cache ──
  const getTerms = useCallback((player) => {
    if (!calculateLoanTerms) return null;
    return calculateLoanTerms(player, borrowingTier, gamesRemaining, totalGames, generateSalary);
  }, [calculateLoanTerms, borrowingTier, gamesRemaining, totalGames, generateSalary]);

  // ── Cost tier label ──
  const costTierLabel = useCallback((estimatedTotal) => {
    if (dpeAmount <= 0) return { text: 'High', cls: 'loss' };
    const ratio = estimatedTotal / dpeAmount;
    if (ratio < 0.4) return { text: 'Low', cls: 'win' };
    if (ratio < 0.75) return { text: 'Medium', cls: 'warning' };
    return { text: 'High', cls: 'loss' };
  }, [dpeAmount]);

  // Early return AFTER all hooks
  if (!isOpen || !data) return null;

  // ── Team situation label ──
  const sitLabel = (ctx) => {
    if (!ctx) return null;
    if (ctx.situation === 'contending') return { text: 'Contending', color: 'var(--color-win)', bg: 'rgba(45,122,79,0.08)' };
    if (ctx.situation === 'relegation') return { text: 'Relegation', color: 'var(--color-loss)', bg: 'rgba(181,64,58,0.08)' };
    return { text: 'Mid-table', color: 'var(--color-text-secondary)', bg: 'rgba(107,107,101,0.08)' };
  };

  // ── Handle negotiation ──
  const handleMakeOffer = (candidate, offerAmount) => {
    if (!evaluateLoanOffer) return;
    const terms = getTerms(candidate.player);
    if (!terms) return;

    const result = evaluateLoanOffer({
      lendingTeam: candidate.team,
      player: candidate.player,
      offerAmount,
      teamContext: candidate.teamContext,
      adjustedSalary: terms.adjustedSalary,
      activeLoans: activeLoans || [],
    });

    setNegotiationState({
      candidate,
      terms,
      offerAmount,
      result,
    });
  };

  // ── Handle accept (direct or counter) ──
  const handleAcceptLoan = (finalFee) => {
    if (!negotiationState || !executeLoan) return;
    const { candidate, terms } = negotiationState;

    executeLoan({
      player: candidate.player,
      originalTeam: candidate.team,
      borrowingTeam: userTeam,
      injuredPlayer,
      loanFee: finalFee,
      proratedSalary: terms.proratedSalary,
      currentDate,
      activeLoans: activeLoans || [],
      initializePlayerChemistry,
    });

    onComplete?.('loan', {
      playerName: candidate.player.name,
      teamName: `${candidate.team.city} ${candidate.team.name}`,
      loanFee: finalFee,
    });
  };

  // ── Handle FA signing ──
  const handleSignFA = (player) => {
    if (!signFreeAgentViaDPE) return;

    signFreeAgentViaDPE({
      player,
      team: userTeam,
      freeAgents: data._freeAgentsRef || [],
      initializePlayerChemistry,
    });

    onComplete?.('fa', { playerName: player.name, salary: player.salary });
  };

  // ── Handle skip ──
  const handleSkip = () => {
    onComplete?.('skip');
  };

  // ── Negotiation sub-view ──
  if (negotiationState) {
    return (
      <Modal isOpen={isOpen} onClose={() => {}} maxWidth={560} zIndex={1300}>
        <ModalBody style={{ padding: 0 }}>
          <div style={{ borderTop: '3px solid var(--color-info)' }}>
            <div style={headerStyle}>
              <div>
                <div style={labelStyle}>Loan Negotiation</div>
                <div style={titleStyle}>Emergency Roster Move</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={dpeStyle}>{fmtCurrency(dpeAmount)}</div>
                <div style={dpeSubStyle}>DPE budget</div>
              </div>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <NegotiationPanel
                negotiation={negotiationState}
                dpeAmount={dpeAmount}
                onAccept={handleAcceptLoan}
                onWalkAway={() => setNegotiationState(null)}
                onBack={() => setNegotiationState(null)}
              />
            </div>
          </div>
        </ModalBody>
      </Modal>
    );
  }

  // ── Main modal ──
  return (
    <Modal isOpen={isOpen} onClose={() => {}} maxWidth={820} zIndex={1300}>
      <ModalBody style={{ padding: 0 }}>
        <div style={{ borderTop: '3px solid var(--color-info)' }}>
          {/* Header */}
          <div style={headerStyle}>
            <div>
              <div style={labelStyle}>DPE Replacement</div>
              <div style={titleStyle}>Emergency Roster Move</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={dpeStyle}>{fmtCurrency(dpeAmount)}</div>
              <div style={dpeSubStyle}>Available DPE budget</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', padding: '0 24px', borderBottom: '1px solid var(--color-border)' }}>
            {!isT3 && (
              <TabButton active={activeTab === 'loan'} onClick={() => { setActiveTab('loan'); setPosFilter('All'); }}>
                Emergency Loan
              </TabButton>
            )}
            <TabButton active={activeTab === 'fa'} onClick={() => { setActiveTab('fa'); setPosFilter('All'); setSelectedFAId(null); }}>
              Free Agents
            </TabButton>
            <button onClick={handleSkip} style={skipStyle}>Skip</button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 24px' }}>
            {/* Injured player context */}
            <InjuredPlayerContext player={injuredPlayer} />

            {/* Position filter */}
            <PosFilter value={posFilter} onChange={setPosFilter} />

            {/* Loan tab */}
            {activeTab === 'loan' && (
              <LoanTab
                candidates={filteredCandidates}
                expandedPlayerId={expandedPlayerId}
                onToggleExpand={(id) => setExpandedPlayerId(expandedPlayerId === id ? null : id)}
                onMakeOffer={handleMakeOffer}
                getTerms={getTerms}
                costTierLabel={costTierLabel}
                sitLabel={sitLabel}
                dpeAmount={dpeAmount}
                gamesRemaining={gamesRemaining}
                borrowingTier={borrowingTier}
                generateSalary={generateSalary}
                gameState={gameState}
                engines={engines}
              />
            )}

            {/* FA tab */}
            {activeTab === 'fa' && (
              <FATab
                players={filteredFA}
                selectedId={selectedFAId}
                onSelect={setSelectedFAId}
                injuredPos={injuredPlayer?.position}
                isT3={isT3}
              />
            )}
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        {activeTab === 'fa' && selectedFAId ? (
          <Button variant="primary" onClick={() => {
            const player = freeAgents.find(p => p.id === selectedFAId);
            if (player) handleSignFA(player);
          }}>
            Sign {freeAgents.find(p => p.id === selectedFAId)?.name} ({fmtCurrency(freeAgents.find(p => p.id === selectedFAId)?.salary || 0)})
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            {activeTab === 'loan' ? 'Select a player and make an offer' : 'Select a free agent to sign'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}


// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 0', marginRight: 24,
      fontSize: 'var(--text-sm)', fontWeight: 600,
      cursor: 'pointer', border: 'none', background: 'transparent',
      color: active ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
      borderBottom: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
      fontFamily: 'var(--font-body)',
      transition: 'color 100ms',
    }}>
      {children}
    </button>
  );
}

function InjuredPlayerContext({ player }) {
  if (!player) return null;
  return (
    <div style={{
      padding: '10px 14px', background: 'var(--color-bg-sunken)',
      border: '1px solid var(--color-border-subtle)', marginBottom: 14,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, background: 'var(--color-loss)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-inverse)', fontWeight: 700, fontSize: 13,
          fontFamily: 'var(--font-mono)',
        }}>{player.rating}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{player.name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {player.position} · {player.age}yo · {player.injury?.name || 'Injured'}
          </div>
        </div>
      </div>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--color-loss)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>Season-ending</div>
    </div>
  );
}

function PosFilter({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 12, alignItems: 'center' }}>
      <span style={{
        fontSize: 10, color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 8,
      }}>Pos</span>
      {POSITIONS.map(pos => (
        <button key={pos} onClick={() => onChange(pos)} style={{
          padding: '4px 10px', fontSize: 'var(--text-xs)', border: 'none',
          cursor: 'pointer', fontFamily: 'var(--font-body)',
          background: value === pos ? 'var(--color-accent)' : 'transparent',
          color: value === pos ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
          fontWeight: value === pos ? 600 : 400,
        }}>{pos}</button>
      ))}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// Loan Tab — Player browse with inline detail expansion
// ═══════════════════════════════════════════════════════════════

function LoanTab({ candidates, expandedPlayerId, onToggleExpand, onMakeOffer,
  getTerms, costTierLabel, sitLabel, dpeAmount, gamesRemaining, borrowingTier,
  generateSalary, gameState, engines }) {

  if (!candidates || candidates.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
        No players available from the tier below at this position.
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 480, overflowY: 'auto', border: '1px solid var(--color-border-subtle)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg-raised)', zIndex: 2 }}>
            <th style={{ ...thBase, textAlign: 'left', paddingLeft: 14 }}>Player</th>
            <th style={thBase}>Pos</th>
            <th style={thBase}>OVR</th>
            <th style={thBase}>Age</th>
            <th style={{ ...thBase, textAlign: 'left' }}>Team</th>
            <th style={thBase}>Status</th>
            <th style={thBase}>MIN/G</th>
            <th style={{ ...thBase, textAlign: 'right', paddingRight: 14 }}>Est. Cost</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const p = c.player;
            const terms = getTerms(p);
            const costLabel = terms ? costTierLabel(terms.estimatedTotal) : null;
            const sit = sitLabel(c.teamContext);
            const isExpanded = expandedPlayerId === p.id;
            const gp = p.seasonStats?.gamesPlayed || 0;
            const mpg = gp > 0 ? ((p.seasonStats?.minutesPlayed || 0) / gp).toFixed(1) : '0.0';

            return (
              <React.Fragment key={p.id}>
                <tr
                  onClick={() => onToggleExpand(p.id)}
                  style={{
                    cursor: 'pointer', borderBottom: '1px solid var(--color-border-subtle)',
                    background: isExpanded ? 'var(--color-accent-bg)' : 'var(--color-bg-raised)',
                    transition: 'background 80ms',
                  }}
                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
                  onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--color-bg-raised)'; }}
                >
                  <td style={{ ...tdBase, textAlign: 'left', paddingLeft: 14, fontWeight: isExpanded ? 600 : 500 }}>{p.name}</td>
                  <td style={tdBase}>{p.position}</td>
                  <td style={tdBase}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: ratingColor(p.rating), fontVariantNumeric: 'tabular-nums' }}>{p.rating}</span>
                  </td>
                  <td style={tdBase}>{p.age}</td>
                  <td style={{ ...tdBase, textAlign: 'left' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{c.team.city} {c.team.name}</span>
                  </td>
                  <td style={tdBase}>
                    {sit && <span style={{ fontSize: 10, padding: '2px 6px', fontWeight: 600, letterSpacing: '0.02em', background: sit.bg, color: sit.color }}>{sit.text}</span>}
                  </td>
                  <td style={tdBase}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--text-xs)' }}>{mpg}</span>
                  </td>
                  <td style={{ ...tdBase, textAlign: 'right', paddingRight: 14 }}>
                    {costLabel && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                        color: costLabel.cls === 'win' ? 'var(--color-win)' : costLabel.cls === 'warning' ? 'var(--color-warning)' : 'var(--color-loss)',
                      }}>{costLabel.text}</span>
                    )}
                  </td>
                </tr>

                {isExpanded && (
                  <tr style={{ background: 'var(--color-accent-bg)', borderBottom: '2px solid var(--color-accent-border)' }}>
                    <td colSpan={8} style={{ padding: 0 }}>
                      <ExpandedPlayerDetail
                        candidate={c}
                        terms={terms}
                        dpeAmount={dpeAmount}
                        gamesRemaining={gamesRemaining}
                        onMakeOffer={onMakeOffer}
                        gameState={gameState}
                        engines={engines}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// Expanded Player Detail — inline panel with stats + offer slider
// ═══════════════════════════════════════════════════════════════

function ExpandedPlayerDetail({ candidate, terms, dpeAmount, gamesRemaining, onMakeOffer, gameState, engines }) {
  const { player, team, teamContext } = candidate;
  const [offerAmount, setOfferAmount] = useState(() => terms ? Math.round(terms.estimatedLoanFee) : 0);

  const { StatEngine, PlayerAttributes: PA } = engines || {};
  const analytics = StatEngine?.getPlayerAnalytics?.(player, team) || null;
  const avgs = analytics?.avgs || null;
  const hasStats = avgs && avgs.gamesPlayed > 0;

  const m = player.measurables;
  const measStr = m && PA?.formatHeight
    ? `${PA.formatHeight(m.height)} · ${m.weight}lbs · ${PA.formatWingspan ? PA.formatWingspan(m.wingspan) : m.wingspan + '"'} WS`
    : '';

  const stat = (v, d = 1) => v != null ? v.toFixed(d) : '—';
  const pct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—';
  const pm = (v) => v == null ? '—' : v > 0 ? `+${v}` : `${v}`;
  const pmColor = (v) => v > 0 ? 'var(--color-win)' : v < 0 ? 'var(--color-loss)' : 'var(--color-text-tertiary)';

  const verdictMap = {
    great_deal: { label: 'Great Deal', color: 'var(--color-win)' },
    good_value: { label: 'Good Value', color: 'var(--color-win)' },
    fair: { label: 'Fair', color: 'var(--color-text-secondary)' },
    overpaid: { label: 'Overpaid', color: 'var(--color-loss)' },
  };
  const flagColors = { warning: 'var(--color-warning)', positive: 'var(--color-win)', info: 'var(--color-accent)' };

  // Slider range: 0 to adjustedSalary * 0.75, capped at dpeAmount
  const maxOffer = terms ? Math.min(Math.round(terms.adjustedSalary * 0.75), dpeAmount) : dpeAmount;
  const proratedSalary = terms?.proratedSalary || 0;
  const totalCost = offerAmount + proratedSalary;
  const remainingDPE = dpeAmount - totalCost;
  const overBudget = totalCost > dpeAmount;

  // Suggested marks on slider
  const suggestedMarks = terms ? [
    { pct: 0.25, value: Math.round(terms.adjustedSalary * 0.25), label: fmtCurrency(Math.round(terms.adjustedSalary * 0.25)) },
    { pct: 0.35, value: Math.round(terms.adjustedSalary * 0.35), label: fmtCurrency(Math.round(terms.adjustedSalary * 0.35)) },
    { pct: 0.50, value: Math.round(terms.adjustedSalary * 0.50), label: fmtCurrency(Math.round(terms.adjustedSalary * 0.50)) },
  ] : [];

  return (
    <div style={{ padding: '16px 20px 20px' }}>
      {/* Ratings bar */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: ratingColor(player.rating), fontFamily: 'var(--font-mono)' }}>{player.rating}</div>
          <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall</div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{player.offRating || '—'}</div>
            <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>OFF</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{player.defRating || '—'}</div>
            <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>DEF</div>
          </div>
        </div>
        {measStr && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{measStr}</div>}
        {analytics?.role && (
          <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {analytics.role}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right', fontSize: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
            {fmtCurrency(player.salary || 0)} · {player.contractYears || 1}yr
          </div>
          {analytics?.contractVerdict && verdictMap[analytics.contractVerdict] && (
            <div style={{ marginTop: 2, fontWeight: 600, fontSize: 11, color: verdictMap[analytics.contractVerdict].color }}>
              {verdictMap[analytics.contractVerdict].label}
            </div>
          )}
        </div>
      </div>

      {/* Season stats */}
      {hasStats ? (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>This Season — {avgs.gamesPlayed}G · {stat(avgs.minutesPerGame)} MPG</SectionLabel>
          {/* Counting stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(6, 1fr)', marginBottom: 12 }}>
            <div />
            {['PTS', 'REB', 'AST', 'STL', 'BLK', 'TOV'].map(h => (
              <div key={h} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', alignSelf: 'center' }}>Per Game</div>
            {[avgs.pointsPerGame, avgs.reboundsPerGame, avgs.assistsPerGame, avgs.stealsPerGame, avgs.blocksPerGame, avgs.turnoversPerGame].map((v, i) => (
              <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: (i === 5 && v > 2.5) ? 'var(--color-warning)' : 'var(--color-text)' }}>{stat(v)}</div>
            ))}
            {analytics?.per36 && (
              <>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', alignSelf: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 6, marginTop: 4 }}>Per 36</div>
                {[analytics.per36.points, analytics.per36.rebounds, analytics.per36.assists, analytics.per36.steals, analytics.per36.blocks, analytics.per36.turnovers].map((v, i) => (
                  <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 6, marginTop: 4 }}>{stat(v)}</div>
                ))}
              </>
            )}
          </div>
          {/* Shooting */}
          <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(6, 1fr)', marginBottom: 12 }}>
            <div />
            {['FG%', '3P%', 'FT%', 'TS%', '+/- /G', '+/- TOT'].map(h => (
              <div key={h} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', alignSelf: 'center' }}>Season</div>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700 }}>{pct(avgs.fieldGoalPct)}</div>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700 }}>{pct(avgs.threePointPct)}</div>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700 }}>{pct(avgs.freeThrowPct)}</div>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: avgs.trueShootingPct >= 0.60 ? 'var(--color-win)' : avgs.trueShootingPct < 0.48 ? 'var(--color-warning)' : 'var(--color-text)' }}>{pct(avgs.trueShootingPct)}</div>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: pmColor(avgs.plusMinusPerGame) }}>{pm(avgs.plusMinusPerGame)}</div>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: pmColor(avgs.plusMinus) }}>{pm(avgs.plusMinus)}</div>
          </div>
          {/* Flags */}
          {analytics?.flags?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {analytics.flags.map((f, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', border: `1px solid ${flagColors[f.type] || 'var(--color-border)'}`, color: flagColors[f.type] || 'var(--color-text-secondary)' }}>
                  {f.label}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic', marginBottom: 16 }}>
          No games played this season yet.
        </div>
      )}

      {/* Attributes */}
      {player.attributes && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>Attributes</SectionLabel>
          <AttrBars attributes={player.attributes} />
        </div>
      )}

      {/* Team context */}
      <div style={{
        padding: '10px 14px', background: 'var(--color-info-bg)',
        border: '1px solid rgba(53,116,196,0.15)', marginBottom: 16,
        fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5,
      }}>
        <strong style={{ color: 'var(--color-text)' }}>{team.city} {team.name}</strong> is {teamContext?.situation || 'mid-table'} in the {team.tier === 2 ? 'NARBL' : 'MBL'} ({team.wins || 0}-{team.losses || 0}).
        {hasStats && ` ${player.name} averages ${stat(avgs.minutesPerGame)} minutes as a ${analytics?.role || 'bench player'}.`}
      </div>

      {/* Offer slider */}
      <SectionLabel>Loan Fee Offer</SectionLabel>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={0}
            max={maxOffer}
            step={10000}
            value={offerAmount}
            onChange={(e) => setOfferAmount(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--color-accent)', height: 4 }}
          />
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, minWidth: 64, textAlign: 'right' }}>
            {fmtCurrency(offerAmount)}
          </div>
        </div>
        {/* Suggested marks */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--color-text-tertiary)', padding: '4px 2px 0' }}>
          <span>{fmtCurrency(0)}</span>
          {suggestedMarks.map((mark, i) => (
            <span key={i} style={{ cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
              onClick={() => setOfferAmount(mark.value)}>
              {mark.label}
            </span>
          ))}
          <span>{fmtCurrency(maxOffer)}</span>
        </div>
      </div>

      {/* Cost breakdown */}
      <div style={{ padding: '10px 14px', background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', marginBottom: 16 }}>
        <CostRow label="Loan fee" value={fmtCurrency(offerAmount)} />
        <CostRow label={`Prorated salary (${gamesRemaining} games)`} value={fmtCurrency(proratedSalary)} />
        <CostRow label="Total cost" value={fmtCurrency(totalCost)} bold
          valueColor={overBudget ? 'var(--color-loss)' : undefined} />
        <CostRow label="Remaining DPE" value={overBudget ? 'Over budget' : fmtCurrency(remainingDPE)}
          valueColor={overBudget ? 'var(--color-loss)' : 'var(--color-win)'} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <Button
          variant="primary"
          disabled={offerAmount === 0 || overBudget}
          onClick={() => onMakeOffer(candidate, offerAmount)}
          style={{ minWidth: 200 }}
        >
          Make Offer
        </Button>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// Negotiation Panel — shown after making an offer
// ═══════════════════════════════════════════════════════════════

function NegotiationPanel({ negotiation, dpeAmount, onAccept, onWalkAway, onBack }) {
  const { candidate, terms, offerAmount, result } = negotiation;
  const { player, team, teamContext } = candidate;

  const proratedSalary = terms?.proratedSalary || 0;

  return (
    <div>
      <button onClick={onBack} style={{
        fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', cursor: 'pointer',
        padding: 0, border: 'none', background: 'none', fontFamily: 'var(--font-body)', marginBottom: 14,
      }}>
        Back to player list
      </button>

      {/* Player card */}
      <div style={{
        padding: '12px 14px', background: 'var(--color-bg-sunken)',
        border: '1px solid var(--color-border-subtle)', marginBottom: 14,
        display: 'flex', gap: 12, alignItems: 'center',
      }}>
        <div style={{
          width: 40, height: 40, background: ratingColor(player.rating),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-inverse)', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-mono)',
        }}>{player.rating}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>{player.name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {player.position} · {player.age}yo · {team.city} {team.name} ({team.tier === 2 ? 'NARBL' : 'MBL'})
          </div>
        </div>
      </div>

      {/* Your offer */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>Your offer</div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 'var(--text-sm)',
          color: result.response === 'accept' ? 'var(--color-text)' : 'var(--color-text-tertiary)',
          textDecoration: result.response !== 'accept' ? 'line-through' : 'none',
        }}>{fmtCurrency(offerAmount)} loan fee</div>
      </div>

      {/* Response */}
      {result.response === 'accept' && (
        <div style={{
          padding: 14, border: '2px solid var(--color-win)', background: 'var(--color-win-bg)', marginBottom: 16,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-win)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Accepted</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: 12 }}>{result.reasoning}</div>
          <CostBreakdown fee={offerAmount} prorated={proratedSalary} dpe={dpeAmount} />
          <div style={{ marginTop: 12 }}>
            <Button variant="success" onClick={() => onAccept(offerAmount)}>
              Confirm Loan ({fmtCurrency(offerAmount + proratedSalary)} total)
            </Button>
          </div>
        </div>
      )}

      {result.response === 'counter' && (
        <div style={{
          padding: 14, border: '2px solid var(--color-warning)', background: 'var(--color-warning-bg)', marginBottom: 16,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Counter</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: 10 }}>{result.reasoning}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: 'var(--color-text)', marginBottom: 12 }}>
            {fmtCurrency(result.counterAmount)}
          </div>
          <CostBreakdown fee={result.counterAmount} prorated={proratedSalary} dpe={dpeAmount} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button variant="success" onClick={() => onAccept(result.counterAmount)}>
              Accept Counter ({fmtCurrency(result.counterAmount)})
            </Button>
            <Button variant="secondary" onClick={onWalkAway}>Walk Away</Button>
          </div>
        </div>
      )}

      {result.response === 'decline' && (
        <div style={{
          padding: 14, border: '2px solid var(--color-loss)', background: 'var(--color-loss-bg)', marginBottom: 16,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-loss)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Declined</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: 12 }}>{result.reasoning}</div>
          <Button variant="secondary" onClick={onWalkAway}>Try Another Player</Button>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// FA Tab
// ═══════════════════════════════════════════════════════════════

function FATab({ players, selectedId, onSelect, injuredPos, isT3 }) {
  if (!players || players.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
        No free agents available within the DPE budget.
      </div>
    );
  }

  return (
    <>
      {!isT3 && (
        <div style={{
          padding: '8px 12px', background: 'var(--color-tier3-bg)',
          borderLeft: '3px solid var(--color-tier3)', marginBottom: 14,
          fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5,
        }}>
          Free agents are players who did not make a roster. For T1 and T2 teams, the Emergency Loan tab offers access to stronger replacement options from the tier below.
        </div>
      )}
      <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--color-border-subtle)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg-raised)', zIndex: 1 }}>
              <th style={{ ...thBase, textAlign: 'left', paddingLeft: 14 }}>Player</th>
              <th style={thBase}>Pos</th>
              <th style={thBase}>OVR</th>
              <th style={thBase}>Age</th>
              <th style={{ ...thBase, textAlign: 'right', paddingRight: 14 }}>Salary</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => {
              const isMatch = p.position === injuredPos;
              const isSel = selectedId === p.id;
              return (
                <tr key={p.id}
                  onClick={() => onSelect(p.id)}
                  style={{
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    background: isSel ? 'var(--color-accent-bg)' : isMatch ? 'rgba(27,77,62,0.03)' : 'var(--color-bg-raised)',
                    borderLeft: isSel ? '3px solid var(--color-accent)' : '3px solid transparent',
                    transition: 'background 80ms',
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isSel ? 'var(--color-accent-bg)' : isMatch ? 'rgba(27,77,62,0.03)' : 'var(--color-bg-raised)'; }}
                >
                  <td style={{ ...tdBase, textAlign: 'left', paddingLeft: 14 }}>
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    {isMatch && <span style={{ fontSize: 9, color: 'var(--color-accent)', fontWeight: 600, letterSpacing: '0.04em', marginLeft: 6 }}>MATCH</span>}
                  </td>
                  <td style={tdBase}>{p.position}</td>
                  <td style={tdBase}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: ratingColor(p.rating), fontVariantNumeric: 'tabular-nums' }}>{p.rating}</span>
                  </td>
                  <td style={tdBase}>{p.age}</td>
                  <td style={{ ...tdBase, textAlign: 'right', paddingRight: 14 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmtCurrency(p.salary || 0)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════

function CostRow({ label, value, bold, valueColor }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0',
      ...(bold ? { borderTop: '1px solid var(--color-border)', marginTop: 4, paddingTop: 6, fontWeight: 600 } : {}),
    }}>
      <span style={{ color: bold ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: valueColor || (bold ? 'var(--color-text)' : undefined) }}>{value}</span>
    </div>
  );
}

function CostBreakdown({ fee, prorated, dpe }) {
  const total = fee + prorated;
  const remaining = dpe - total;
  return (
    <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
      <CostRow label="Loan fee" value={fmtCurrency(fee)} />
      <CostRow label="Prorated salary" value={fmtCurrency(prorated)} />
      <CostRow label="Total cost" value={fmtCurrency(total)} bold />
      <CostRow label="Remaining DPE" value={fmtCurrency(Math.max(0, remaining))} valueColor={remaining >= 0 ? 'var(--color-win)' : 'var(--color-loss)'} />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// Shared styles
// ═══════════════════════════════════════════════════════════════

const headerStyle = {
  padding: '16px 24px', borderBottom: '1px solid var(--color-border)',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const labelStyle = {
  fontSize: 10, fontWeight: 700, color: 'var(--color-info)',
  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2,
};
const titleStyle = { fontSize: 16, fontWeight: 700 };
const dpeStyle = { fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: 'var(--color-accent)' };
const dpeSubStyle = { fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2, textAlign: 'right' };
const skipStyle = {
  marginLeft: 'auto', padding: '10px 0', fontSize: 'var(--text-xs)',
  color: 'var(--color-text-tertiary)', cursor: 'pointer', border: 'none',
  background: 'transparent', fontFamily: 'var(--font-body)',
};
const thBase = {
  padding: '6px 10px', fontSize: 10, fontWeight: 600,
  color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
  letterSpacing: '0.06em', textAlign: 'center', whiteSpace: 'nowrap',
};
const tdBase = {
  padding: '7px 10px', borderBottom: '1px solid var(--color-border-subtle)',
  textAlign: 'center', whiteSpace: 'nowrap',
};
