import React, { useState, useMemo, useCallback } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/Modal.jsx';
import { Card, CardHeader } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';

/* ═══════════════════════════════════════════════════════════════
   TradeScreen — Full-screen modal for user-initiated trades.
   
   State managed locally in React:
     - selectedPartner (team id)
     - userGives / userReceives (player ids)
     - userGivesPicks / userReceivesPicks (pick objects)
   
   Delegates to legacy for:
     - TradeEngine.evaluateTrade (AI decision)
     - Trade execution (roster mutations, history, events)
   ═══════════════════════════════════════════════════════════════ */
export function TradeScreen({ isOpen, onClose }) {
  const { gameState, engines } = useGame();
  const [partnerId, setPartnerId] = useState(null);
  const [userGives, setUserGives] = useState([]);
  const [userReceives, setUserReceives] = useState([]);
  const [userGivesPicks, setUserGivesPicks] = useState([]);
  const [userReceivesPicks, setUserReceivesPicks] = useState([]);
  const [tradeResult, setTradeResult] = useState(null); // { accepted, reason }

  if (!isOpen || !gameState?.userTeam) return null;

  const raw = gameState._raw || gameState;
  const userTeam = gameState.userTeam;
  const currentTier = gameState.currentTier;
  const allTeams = currentTier === 1 ? gameState.tier1Teams :
                   currentTier === 2 ? gameState.tier2Teams : gameState.tier3Teams;
  const partnerTeam = partnerId ? allTeams.find(t => t.id === partnerId) : null;

  // Trade deadline check
  const maxGames = currentTier === 1 ? 82 : currentTier === 2 ? 60 : 40;
  const tradeDeadline = Math.floor(maxGames * 0.75);
  const gamesPlayed = (userTeam.wins || 0) + (userTeam.losses || 0);
  const seasonComplete = raw.schedule?.every(g => g.played);
  const pastDeadline = gamesPlayed >= tradeDeadline && !seasonComplete;

  const resetTrade = () => {
    setUserGives([]);
    setUserReceives([]);
    setUserGivesPicks([]);
    setUserReceivesPicks([]);
    setTradeResult(null);
  };

  const handleSelectPartner = (id) => {
    setPartnerId(id);
    resetTrade();
  };

  const handleClose = () => {
    setPartnerId(null);
    resetTrade();
    onClose();
  };

  // Toggle player in/out of trade
  const toggleUserPlayer = (playerId) => {
    setTradeResult(null);
    setUserGives(prev =>
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    );
  };

  const toggleAiPlayer = (playerId) => {
    setTradeResult(null);
    setUserReceives(prev =>
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    );
  };

  // Toggle pick
  const toggleUserPick = (pick) => {
    setTradeResult(null);
    setUserGivesPicks(prev => {
      const exists = prev.some(p => p.originalTeamId === pick.originalTeamId && p.year === pick.year && p.round === pick.round);
      return exists ? prev.filter(p => !(p.originalTeamId === pick.originalTeamId && p.year === pick.year && p.round === pick.round)) : [...prev, pick];
    });
  };

  const toggleAiPick = (pick) => {
    setTradeResult(null);
    setUserReceivesPicks(prev => {
      const exists = prev.some(p => p.originalTeamId === pick.originalTeamId && p.year === pick.year && p.round === pick.round);
      return exists ? prev.filter(p => !(p.originalTeamId === pick.originalTeamId && p.year === pick.year && p.round === pick.round)) : [...prev, pick];
    });
  };

  // Propose trade — delegate evaluation to legacy TradeEngine
  const handlePropose = () => {
    const hasGives = userGives.length > 0 || userGivesPicks.length > 0;
    const hasReceives = userReceives.length > 0 || userReceivesPicks.length > 0;
    if (!hasGives || !hasReceives) return;

    // Roster size checks
    const userAfter = userTeam.roster.length - userGives.length + userReceives.length;
    const aiAfter = partnerTeam.roster.length - userReceives.length + userGives.length;
    if (userAfter < 12 || userAfter > 15) {
      setTradeResult({ accepted: false, reason: `Your roster would have ${userAfter} players. Must be 12-15.` });
      return;
    }
    if (aiAfter < 12 || aiAfter > 15) {
      setTradeResult({ accepted: false, reason: `${partnerTeam.name} would have ${aiAfter} players. Must be 12-15.` });
      return;
    }

    // Delegate to legacy TradeEngine
    const TE = engines.TradeEngine || window.TradeEngine;
    if (!TE?.evaluateTrade) {
      setTradeResult({ accepted: false, reason: 'Trade engine not available.' });
      return;
    }

    const userGivesPlayers = userGives.map(id => userTeam.roster.find(p => p.id === id)).filter(Boolean);
    const aiGivesPlayers = userReceives.map(id => partnerTeam.roster.find(p => p.id === id)).filter(Boolean);

    const result = TE.evaluateTrade({
      userGivesPlayers,
      aiGivesPlayers,
      userGivesPicks: currentTier === 1 ? userGivesPicks : [],
      userReceivesPicks: currentTier === 1 ? userReceivesPicks : [],
      aiTeam: partnerTeam,
      calculatePickValue: window.calculatePickValue || ((y, r) => r === 1 ? 30 : 15),
      getEffectiveCap: window.getEffectiveCap || (() => 100000000),
      calculateTeamSalary: window.calculateTeamSalary || (() => 0),
      formatCurrency: window.formatCurrency || fmtCurrency,
    });

    setTradeResult(result);

    if (result.accepted) {
      // Execute via legacy controller
      if (window.executeTrade) {
        window.executeTrade(partnerId, userGives, userReceives, userGivesPicks, userReceivesPicks);
      } else {
        // Manual execution fallback
        executeTradeDirect(userTeam, partnerTeam, userGives, userReceives, userGivesPicks, userReceivesPicks, raw, engines);
      }
      // Close after brief delay to show result
      setTimeout(() => handleClose(), 1500);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth={1100}>
      <ModalHeader onClose={handleClose}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          Trade Center
          {pastDeadline && (
            <Badge variant="loss">Past Deadline</Badge>
          )}
        </div>
      </ModalHeader>

      <ModalBody style={{ padding: 'var(--space-4) var(--space-5)' }}>
        {pastDeadline ? (
          <div style={{
            textAlign: 'center', padding: 'var(--space-8) 0',
            color: 'var(--color-text-tertiary)',
          }}>
            <div style={{ fontSize: '2em', marginBottom: 'var(--space-3)' }}>🚫</div>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semi)' }}>
              Trade deadline has passed
            </div>
            <div style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
              Game {gamesPlayed}/{maxGames} — deadline was game {tradeDeadline}
            </div>
          </div>
        ) : (
          <>
            {/* Team selector */}
            <TeamSelector
              teams={allTeams}
              userTeamId={userTeam.id}
              selectedId={partnerId}
              onSelect={handleSelectPartner}
            />

            {partnerTeam && (
              <>
                {/* Two-column: Your roster | Their roster */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-4)', marginTop: 'var(--space-4)',
                }}>
                  <RosterColumn
                    title={`Your Team — ${userTeam.name}`}
                    team={userTeam}
                    selectedIds={userGives}
                    onToggle={toggleUserPlayer}
                    side="user"
                  />
                  <RosterColumn
                    title={partnerTeam.name}
                    team={partnerTeam}
                    selectedIds={userReceives}
                    onToggle={toggleAiPlayer}
                    side="ai"
                  />
                </div>

                {/* Draft picks (T1 only) */}
                {currentTier === 1 && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    gap: 'var(--space-4)', marginTop: 'var(--space-4)',
                  }}>
                    <PicksColumn
                      title="Your Picks"
                      teamId={userTeam.id}
                      selectedPicks={userGivesPicks}
                      onToggle={toggleUserPick}
                      gameState={raw}
                    />
                    <PicksColumn
                      title={`${partnerTeam.name} Picks`}
                      teamId={partnerTeam.id}
                      selectedPicks={userReceivesPicks}
                      onToggle={toggleAiPick}
                      gameState={raw}
                    />
                  </div>
                )}

                {/* Trade summary */}
                <TradeSummary
                  userTeam={userTeam}
                  partnerTeam={partnerTeam}
                  userGives={userGives}
                  userReceives={userReceives}
                  userGivesPicks={userGivesPicks}
                  userReceivesPicks={userReceivesPicks}
                  currentTier={currentTier}
                  tradeResult={tradeResult}
                />
              </>
            )}
          </>
        )}
      </ModalBody>

      {partnerTeam && !pastDeadline && (
        <ModalFooter>
          <Button variant="ghost" onClick={resetTrade}>Reset</Button>
          <Button
            variant="primary"
            onClick={handlePropose}
            disabled={
              (userGives.length === 0 && userGivesPicks.length === 0) ||
              (userReceives.length === 0 && userReceivesPicks.length === 0) ||
              tradeResult?.accepted
            }
          >
            {tradeResult?.accepted ? '✅ Trade Accepted!' : 'Propose Trade'}
          </Button>
        </ModalFooter>
      )}
    </Modal>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Team Selector
   ═══════════════════════════════════════════════════════════════ */
function TeamSelector({ teams, userTeamId, selectedId, onSelect }) {
  const options = teams.filter(t => t.id !== userTeamId).sort((a, b) => (b.rating || 0) - (a.rating || 0));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <span style={{
        fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)',
        color: 'var(--color-text-secondary)', whiteSpace: 'nowrap',
      }}>Trade with:</span>
      <select
        value={selectedId || ''}
        onChange={(e) => onSelect(parseInt(e.target.value) || null)}
        style={{
          flex: 1,
          maxWidth: 300,
          padding: '8px 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-sunken)',
          color: 'var(--color-text)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <option value="">— Select a team —</option>
        {options.map(t => (
          <option key={t.id} value={t.id}>
            {t.city ? `${t.city} ${t.name}` : t.name} ({Math.round(t.rating || 0)} OVR)
          </option>
        ))}
      </select>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Roster Column — clickable player list
   ═══════════════════════════════════════════════════════════════ */
function RosterColumn({ title, team, selectedIds, onToggle, side }) {
  const sorted = useMemo(
    () => [...(team.roster || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0)),
    [team.roster]
  );

  return (
    <div>
      <div style={{
        fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)',
        marginBottom: 'var(--space-2)',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{title}</span>
        <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 'var(--weight-normal)' }}>
          {team.roster?.length || 0} players
        </span>
      </div>
      <div style={{
        maxHeight: 320, overflowY: 'auto',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-md)',
      }}>
        {sorted.map(player => {
          const selected = selectedIds.includes(player.id);
          return (
            <PlayerRow
              key={player.id}
              player={player}
              selected={selected}
              onClick={() => onToggle(player.id)}
              side={side}
            />
          );
        })}
      </div>
    </div>
  );
}

function PlayerRow({ player, selected, onClick, side }) {
  const r = Math.round(player.rating || 0);
  const rColor = ratingColor(r);
  const sal = fmtCurrency(player.salary || 0);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '6px 10px', gap: 'var(--space-2)',
        cursor: 'pointer',
        background: selected
          ? side === 'user' ? 'rgba(234, 67, 53, 0.08)' : 'rgba(52, 168, 83, 0.08)'
          : 'transparent',
        borderBottom: '1px solid var(--color-border-subtle)',
        transition: 'background var(--duration-fast) ease',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Selection indicator */}
      <div style={{
        width: 18, height: 18, borderRadius: 'var(--radius-sm)',
        border: `2px solid ${selected ? (side === 'user' ? 'var(--color-loss)' : 'var(--color-win)') : 'var(--color-border)'}`,
        background: selected ? (side === 'user' ? 'var(--color-loss)' : 'var(--color-win)') : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        transition: 'all var(--duration-fast) ease',
        fontSize: '10px', color: '#fff',
      }}>
        {selected && '✓'}
      </div>

      {/* Player info */}
      <span style={{
        fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
        width: 24, textAlign: 'center', flexShrink: 0,
      }}>{player.position}</span>
      <span style={{
        flex: 1, fontSize: 'var(--text-sm)',
        fontWeight: selected ? 'var(--weight-semi)' : 'var(--weight-normal)',
      }}>{player.name}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-semi)', color: rColor,
        width: 28, textAlign: 'right',
      }}>{r}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)', width: 48, textAlign: 'right',
      }}>{sal}</span>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Picks Column — T1 draft pick selection
   ═══════════════════════════════════════════════════════════════ */
function PicksColumn({ title, teamId, selectedPicks, onToggle, gameState }) {
  const currentYear = gameState.currentSeason || 2025;
  const picks = useMemo(() => {
    const result = [];
    const getOwner = window.getPickOwner || ((tid, y, r) => tid);
    for (let year = currentYear; year <= currentYear + 3; year++) {
      [1, 2].forEach(round => {
        const owner = getOwner(teamId, year, round);
        result.push({ teamId, year, round, owner, owned: owner === teamId });
      });
    }
    return result;
  }, [teamId, currentYear]);

  return (
    <div>
      <div style={{
        fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)',
        marginBottom: 'var(--space-2)',
      }}>{title}</div>
      <div style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-md)',
      }}>
        {picks.map((pick, i) => {
          if (!pick.owned) {
            return (
              <div key={i} style={{
                padding: '5px 10px', fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)', opacity: 0.5,
                borderBottom: '1px solid var(--color-border-subtle)',
              }}>
                {pick.year} Rd {pick.round} — traded away
              </div>
            );
          }
          const selected = selectedPicks.some(
            p => p.originalTeamId === pick.teamId && p.year === pick.year && p.round === pick.round
          );
          return (
            <div
              key={i}
              onClick={() => onToggle({ originalTeamId: pick.teamId, year: pick.year, round: pick.round })}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '5px 10px', gap: 'var(--space-2)',
                cursor: 'pointer',
                background: selected ? 'rgba(212, 168, 67, 0.08)' : 'transparent',
                borderBottom: '1px solid var(--color-border-subtle)',
                fontSize: 'var(--text-xs)',
                transition: 'background var(--duration-fast) ease',
              }}
              onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
              onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                width: 14, height: 14, borderRadius: 3,
                border: `2px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: selected ? 'var(--color-accent)' : 'transparent',
                flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '8px', color: '#1a1a2e',
              }}>
                {selected && '✓'}
              </div>
              <span style={{ fontWeight: 'var(--weight-medium)' }}>
                {pick.year} Round {pick.round}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Trade Summary — value comparison + result
   ═══════════════════════════════════════════════════════════════ */
function TradeSummary({ userTeam, partnerTeam, userGives, userReceives, userGivesPicks, userReceivesPicks, currentTier, tradeResult }) {
  // Calculate values
  const calcPickValue = window.calculatePickValue || ((y, r) => r === 1 ? 30 : 15);

  let givesVal = 0, givesSal = 0, receivesVal = 0, receivesSal = 0;
  userGives.forEach(id => {
    const p = userTeam.roster?.find(pl => pl.id === id);
    if (p) { givesVal += (p.rating || 0); givesSal += (p.salary || 0); }
  });
  userReceives.forEach(id => {
    const p = partnerTeam.roster?.find(pl => pl.id === id);
    if (p) { receivesVal += (p.rating || 0); receivesSal += (p.salary || 0); }
  });
  userGivesPicks.forEach(pick => { givesVal += calcPickValue(pick.year, pick.round); });
  userReceivesPicks.forEach(pick => { receivesVal += calcPickValue(pick.year, pick.round); });

  const net = receivesVal - givesVal;
  const salDiff = Math.abs(receivesSal - givesSal);
  const hasAssets = userGives.length > 0 || userReceives.length > 0 || userGivesPicks.length > 0 || userReceivesPicks.length > 0;

  if (!hasAssets) return null;

  // Gather names for summary
  const givesNames = userGives.map(id => userTeam.roster?.find(p => p.id === id)?.name || '?');
  const receivesNames = userReceives.map(id => partnerTeam.roster?.find(p => p.id === id)?.name || '?');
  userGivesPicks.forEach(p => givesNames.push(`${p.year} Rd ${p.round}`));
  userReceivesPicks.forEach(p => receivesNames.push(`${p.year} Rd ${p.round}`));

  // Roster size after
  const userAfter = (userTeam.roster?.length || 0) - userGives.length + userReceives.length;

  return (
    <div style={{
      marginTop: 'var(--space-4)',
      padding: 'var(--space-4)',
      background: 'var(--color-bg-sunken)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border-subtle)',
    }}>
      {/* Summary header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        gap: 'var(--space-3)', alignItems: 'center',
        marginBottom: 'var(--space-3)',
      }}>
        {/* You give */}
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
            You send
          </div>
          {givesNames.map((n, i) => (
            <div key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-loss)' }}>{n}</div>
          ))}
        </div>

        {/* Arrow */}
        <div style={{
          fontSize: 'var(--text-lg)', color: 'var(--color-text-tertiary)', opacity: 0.4,
        }}>⇄</div>

        {/* You receive */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
            You receive
          </div>
          {receivesNames.map((n, i) => (
            <div key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-win)' }}>{n}</div>
          ))}
        </div>
      </div>

      {/* Value comparison */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 'var(--space-6)',
        padding: 'var(--space-2) 0',
        fontSize: 'var(--text-xs)',
        borderTop: '1px solid var(--color-border-subtle)',
        paddingTop: 'var(--space-3)',
      }}>
        <span>Your value: <strong>{Math.round(givesVal)}</strong></span>
        <span>Their value: <strong>{Math.round(receivesVal)}</strong></span>
        <span>
          Net:{' '}
          <strong style={{ color: net > 0 ? 'var(--color-win)' : net < 0 ? 'var(--color-loss)' : 'var(--color-text)' }}>
            {net > 0 ? '+' : ''}{Math.round(net)}
          </strong>
        </span>
        <span>Roster after: <strong>{userAfter}/15</strong></span>
        {givesSal > 0 && (
          <span>
            Salary Δ:{' '}
            <strong style={{ color: salDiff <= 2000000 ? 'var(--color-win)' : 'var(--color-text-tertiary)' }}>
              {fmtCurrency(salDiff)}
            </strong>
          </span>
        )}
      </div>

      {/* Trade result */}
      {tradeResult && (
        <div style={{
          marginTop: 'var(--space-3)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)',
          background: tradeResult.accepted ? 'rgba(52, 168, 83, 0.08)' : 'rgba(234, 67, 53, 0.08)',
          border: `1px solid ${tradeResult.accepted ? 'rgba(52, 168, 83, 0.2)' : 'rgba(234, 67, 53, 0.2)'}`,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)',
            color: tradeResult.accepted ? 'var(--color-win)' : 'var(--color-loss)',
            marginBottom: 4,
          }}>
            {tradeResult.accepted ? '✅ Trade Accepted!' : '❌ Trade Declined'}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {tradeResult.reason}
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   AI Trade Proposal Modal — incoming trade from AI
   ═══════════════════════════════════════════════════════════════ */
export function AiTradeProposalModal({ isOpen, onClose }) {
  const { gameState, engines } = useGame();

  if (!isOpen || !gameState) return null;

  const raw = gameState._raw || gameState;
  const proposal = raw.pendingTradeProposal;
  if (!proposal) return null;

  const calcPickValue = window.calculatePickValue || ((y, r) => r === 1 ? 30 : 15);

  const userGivesVal = proposal.userGives.reduce((s, p) => s + (p.rating || 0), 0);
  let aiGivesVal = proposal.aiGives.reduce((s, p) => s + (p.rating || 0), 0);
  if (proposal.aiGivesPicks) {
    proposal.aiGivesPicks.forEach(pick => { aiGivesVal += calcPickValue(pick.year, pick.round); });
  }
  const net = aiGivesVal - userGivesVal;

  const handleAccept = () => {
    window.acceptAiTradeProposal?.();
    onClose();
  };

  const handleReject = () => {
    window.rejectAiTradeProposal?.();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleReject} maxWidth={600}>
      <ModalHeader onClose={handleReject}>
        📨 Trade Proposal from {proposal.aiTeamName}
      </ModalHeader>
      <ModalBody>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr',
          gap: 'var(--space-4)', alignItems: 'start',
        }}>
          {/* They want */}
          <div>
            <div style={{
              fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase', marginBottom: 'var(--space-2)',
              fontWeight: 'var(--weight-semi)',
            }}>They want</div>
            {proposal.userGives.map((p, i) => (
              <ProposalPlayerCard key={i} player={p} />
            ))}
          </div>

          {/* Arrow */}
          <div style={{
            fontSize: '1.5em', color: 'var(--color-text-tertiary)', opacity: 0.3,
            paddingTop: 'var(--space-6)',
          }}>⇄</div>

          {/* You receive */}
          <div>
            <div style={{
              fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase', marginBottom: 'var(--space-2)',
              fontWeight: 'var(--weight-semi)',
            }}>You receive</div>
            {proposal.aiGives.map((p, i) => (
              <ProposalPlayerCard key={i} player={p} />
            ))}
            {proposal.aiGivesPicks?.map((pick, i) => (
              <div key={`pk${i}`} style={{
                padding: 'var(--space-2)',
                background: 'rgba(212, 168, 67, 0.06)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-1)',
              }}>
                📋 {pick.year} Round {pick.round} Pick
              </div>
            ))}
          </div>
        </div>

        {/* Value summary */}
        <div style={{
          marginTop: 'var(--space-4)', textAlign: 'center',
          fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
        }}>
          Value: You give <strong>{Math.round(userGivesVal)}</strong> — You receive <strong>{Math.round(aiGivesVal)}</strong>
          {' '}
          <span style={{ color: net > 0 ? 'var(--color-win)' : net < 0 ? 'var(--color-loss)' : 'var(--color-text)' }}>
            ({net > 0 ? '+' : ''}{Math.round(net)})
          </span>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={handleReject}>Decline</Button>
        <Button variant="primary" onClick={handleAccept}>Accept Trade</Button>
      </ModalFooter>
    </Modal>
  );
}

function ProposalPlayerCard({ player }) {
  const r = Math.round(player.rating || 0);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      padding: 'var(--space-2)',
      background: 'var(--color-bg-sunken)',
      borderRadius: 'var(--radius-sm)',
      marginBottom: 'var(--space-1)',
    }}>
      <span style={{
        fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
        width: 24, textAlign: 'center',
      }}>{player.position}</span>
      <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
        {player.name}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-bold)', color: ratingColor(r),
      }}>{r}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)',
      }}>{fmtCurrency(player.salary || 0)}</span>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
function fmtCurrency(amount) {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return '$' + Math.round(amount / 1000) + 'K';
  return '$' + amount;
}

function ratingColor(r) {
  if (r >= 85) return 'var(--color-rating-elite)';
  if (r >= 78) return 'var(--color-rating-good)';
  if (r >= 70) return 'var(--color-rating-avg)';
  if (r >= 60) return 'var(--color-rating-below)';
  return 'var(--color-rating-poor)';
}

/**
 * Direct trade execution fallback — used when legacy controller bridge isn't available.
 * Mutates rosters directly, logs to trade history.
 */
function executeTradeDirect(userTeam, aiTeam, userGiveIds, aiGiveIds, userGivesPicks, aiGivesPicks, gameState, engines) {
  const TE = engines.TradeEngine || window.TradeEngine;
  if (TE?.executeTrade) {
    TE.executeTrade({
      team1: userTeam,
      team2: aiTeam,
      team1GivesPlayerIds: userGiveIds,
      team2GivesPlayerIds: aiGiveIds,
      team1GivesPicks: userGivesPicks,
      team2GivesPicks: aiGivesPicks,
      applyTradePenalty: window.applyTradePenalty || (() => {}),
      initializePlayerChemistry: window.initializePlayerChemistry || (() => {}),
      tradeDraftPick: window.tradeDraftPick || (() => {}),
    });
  }

  // Log to history
  if (gameState.tradeHistory) {
    const givePlayers = userGiveIds.map(id => userTeam.roster?.find(p => p.id === id) || aiTeam.roster?.find(p => p.id === id)).filter(Boolean);
    const recvPlayers = aiGiveIds.map(id => aiTeam.roster?.find(p => p.id === id) || userTeam.roster?.find(p => p.id === id)).filter(Boolean);
    gameState.tradeHistory.push({
      season: gameState.currentSeason,
      date: gameState.currentDate,
      tier: gameState.currentTier,
      team1: { id: userTeam.id, name: userTeam.name },
      team2: { id: aiTeam.id, name: aiTeam.name },
      team1Gave: givePlayers.map(p => ({ id: p.id, name: p.name, position: p.position, rating: p.rating })),
      team2Gave: recvPlayers.map(p => ({ id: p.id, name: p.name, position: p.position, rating: p.rating })),
      type: 'user-proposed'
    });
  }

  // Save
  window.saveGameState?.();

  // Notify React
  if (window._notifyReact) window._notifyReact();
}
