// ═══════════════════════════════════════════════════════════════════
// OffseasonHub — Full-screen offseason hub
//
// Replaces the dashboard (sidebar + main) during the offseason.
// Activated via window._reactShowOffseasonHub(data) from OffseasonController.
// Hands back to season setup via data.onComplete() when done.
//
// Design: mirrors DashboardScreen layout with offseason-specific content.
// Phase 2: FA content embedded inline (not as modal).
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';

// Import existing screens for reuse
import { RosterScreen } from './RosterScreen.jsx';
import { FinancesScreen } from './FinancesScreen.jsx';
import { HistoryScreen } from './HistoryScreen.jsx';
import { CoachScreen } from './CoachScreen.jsx';
import { ScoutingScreen } from './ScoutingScreen.jsx';
import GlossaryScreen from './GlossaryScreen.jsx';

// ─── Offseason phase definitions ─────────────────────────────────────────────
const OFFSEASON_PHASES = [
  { key: 'season_ended', label: 'End' },
  { key: 'postseason', label: 'Playoffs' },
  { key: 'promo_rel', label: 'P/R' },
  { key: 'draft', label: 'Draft' },
  { key: 'college_fa', label: 'CFA' },
  { key: 'development', label: 'Dev' },
  { key: 'free_agency', label: 'FA' },
  { key: 'training_camp', label: 'Camp' },
  { key: 'roster_compliance', label: 'Cuts' },
  { key: 'setup_complete', label: 'Ready' },
];

// ─── Navigation items (mirrors Sidebar but for offseason) ────────────────────
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'roster', label: 'Roster' },
  { id: 'freeagency', label: 'Free Agency' },
  { id: 'trades', label: 'Trades' },
  { id: 'scouting', label: 'Scouting' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'coach', label: 'Coach' },
  { id: 'finances', label: 'Finances' },
  { id: 'history', label: 'History' },
  { id: 'glossary', label: 'Glossary' },
];

// ─── Phase Tracker Bar ───────────────────────────────────────────────────────
function OffseasonPhaseTracker({ currentPhase }) {
  const currentIdx = OFFSEASON_PHASES.findIndex(p => p.key === currentPhase);

  return (
    <div style={{
      background: 'var(--color-bg-raised)',
      borderBottom: '1px solid var(--color-border-subtle)',
      padding: '8px var(--space-6)',
      display: 'flex',
      alignItems: 'center',
      gap: 0,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--color-accent)',
        marginRight: 14,
        flexShrink: 0,
      }}>Offseason</div>

      {OFFSEASON_PHASES.map((phase, i) => {
        const isActive = phase.key === currentPhase;
        const isDone = i < currentIdx;
        const isFuture = i > currentIdx;

        return (
          <React.Fragment key={phase.key}>
            {i > 0 && (
              <div style={{
                width: 16,
                height: 2,
                background: isDone ? 'var(--color-accent)' : 'var(--color-border-subtle)',
                flexShrink: 0,
              }} />
            )}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              minWidth: 36,
              flexShrink: 0,
              opacity: isFuture ? 0.5 : 1,
            }}>
              <div style={{
                width: isActive ? 18 : 14,
                height: isActive ? 18 : 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isDone ? 10 : 8,
                fontWeight: 700,
                background: isDone ? 'var(--color-accent)'
                  : isActive ? 'var(--color-bg-raised)'
                  : 'var(--color-bg-sunken)',
                border: isActive ? '2px solid var(--color-accent)'
                  : isDone ? 'none'
                  : '1px solid var(--color-border-subtle)',
                color: isDone ? 'var(--color-text-inverse)'
                  : isActive ? 'var(--color-accent)'
                  : 'var(--color-text-tertiary)',
              }}>
                {isDone ? '+' : (i + 1)}
              </div>
              <span style={{
                fontSize: 8,
                whiteSpace: 'nowrap',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--color-text)'
                  : isFuture ? 'var(--color-text-tertiary)'
                  : 'var(--color-text-secondary)',
              }}>{phase.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Sidebar Navigation ──────────────────────────────────────────────────────
function OffseasonSidebar({ activeScreen, onNavigate }) {
  const [hoveredItem, setHoveredItem] = useState(null);

  return (
    <nav style={{
      width: 'var(--sidebar-width)',
      minHeight: 'calc(100vh - var(--topbar-height) - 42px)', // Account for phase tracker
      background: 'var(--color-bg-raised)',
      borderRight: '1px solid var(--color-border-subtle)',
      padding: 'var(--space-4) var(--space-2)',
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
    }}>
      {NAV_ITEMS.map(item => {
        const isActive = activeScreen === item.id;
        const isHovered = hoveredItem === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              border: 'none',
              background: isActive ? 'var(--color-accent-bg)' :
                          isHovered ? 'var(--color-bg-hover)' :
                          'transparent',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              fontSize: 'var(--text-sm)',
              fontWeight: isActive ? 'var(--weight-semi)' : 'var(--weight-medium)',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              transition: 'all var(--duration-fast) ease',
              letterSpacing: '-0.005em',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Dashboard Screen (Offseason version) ────────────────────────────────────
function OffseasonDashboard({ onNavigate, gameState, engines }) {
  const userTeam = gameState?.userTeam;
  if (!userTeam) return null;

  const { LeagueManager, SalaryCapEngine, FinanceEngine } = engines || {};

  // Calculate metrics
  const strength = LeagueManager?.calculateTeamStrength?.(userTeam) || 0;
  FinanceEngine?.ensureFinances?.(userTeam);
  const capSpace = SalaryCapEngine?.getRemainingCap?.(userTeam) || 0;
  const effCap = SalaryCapEngine?.getEffectiveCap?.(userTeam) || 0;
  const rosterSize = userTeam.roster?.length || 0;
  const totalPlayed = userTeam.wins + userTeam.losses;
  const pctStr = totalPlayed > 0 ? ((userTeam.wins / totalPlayed) * 100).toFixed(1) : '—';

  const fmtShort = (amount) => {
    if (amount >= 1e6) return '$' + (amount / 1e6).toFixed(1) + 'M';
    if (amount >= 1e3) return '$' + (amount / 1e3).toFixed(0) + 'K';
    return '$' + amount;
  };

  // Get free agent count
  const raw = gameState._raw || gameState;
  const faCount = raw.freeAgents?.length || 0;

  // Get recent trades for news
  const recentTrades = (raw.tradeHistory || []).slice(-3).reverse();

  // Top players
  const topPlayers = [...(userTeam.roster || [])]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);

  return (
    <div style={{
      maxWidth: 'var(--content-max)',
      margin: '0 auto',
      padding: 'var(--space-6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--gap)',
    }}>
      {/* Row 1: Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gap)' }}>
        <MetricCard
          label="Record"
          value={`${userTeam.wins}–${userTeam.losses}`}
          detail={`${pctStr}% — Season Complete`}
          valueColor={userTeam.wins > userTeam.losses ? 'var(--color-win)' :
                      userTeam.wins < userTeam.losses ? 'var(--color-loss)' : undefined}
        />
        <MetricCard
          label="Team Rating"
          value={Math.round(strength)}
          detail="League avg: 68"
        />
        <MetricCard
          label="Cap Space"
          value={fmtShort(capSpace)}
          detail={`of ${fmtShort(effCap)}`}
          valueColor={capSpace < 0 ? 'var(--color-loss)' : undefined}
        />
        <MetricCard
          label="Roster"
          value={`${rosterSize} / 20`}
          detail={`${20 - rosterSize} spots available`}
        />
      </div>

      {/* Row 2: Offseason Actions + News */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '340px 1fr',
        gap: 'var(--gap)',
      }}>
        {/* Offseason Actions Card */}
        <div style={{
          background: 'var(--color-bg-raised)',
          border: '1px solid var(--color-border-subtle)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <CardLabel>Offseason Actions</CardLabel>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ActionButton onClick={() => onNavigate('freeagency')} primary>
              <span>Browse Free Agents</span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
              }}>{faCount} available</span>
            </ActionButton>
            <ActionButton onClick={() => onNavigate('trades')}>
              Propose a Trade
            </ActionButton>
            <ActionButton onClick={() => onNavigate('roster')}>
              Manage Roster
            </ActionButton>
          </div>

          {/* Sim Controls */}
          <div style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--color-border-subtle)',
          }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <SimButton onClick={() => window.simDay?.()}>Sim Day</SimButton>
              <SimButton onClick={() => window.simWeek?.()}>Sim Week</SimButton>
            </div>
            <button
              onClick={() => window.simToNextEvent?.()}
              style={{
                width: '100%',
                padding: 10,
                background: 'var(--color-accent)',
                border: 'none',
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-inverse)',
                cursor: 'pointer',
              }}
            >
              Sim to Training Camp
            </button>
          </div>
        </div>

        {/* League News */}
        <div style={{
          background: 'var(--color-bg-raised)',
          border: '1px solid var(--color-border-subtle)',
          padding: 'var(--space-4)',
        }}>
          <CardLabel>League News</CardLabel>
          
          {recentTrades.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: 'var(--space-4) 0',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--text-sm)',
            }}>
              No recent transactions
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {recentTrades.map((trade, i) => (
                <NewsItem key={i} trade={trade} isLast={i === recentTrades.length - 1} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Top Players + Recent Transactions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--gap)',
      }}>
        {/* Top Players */}
        <div style={{
          background: 'var(--color-bg-raised)',
          border: '1px solid var(--color-border-subtle)',
          padding: 'var(--space-4)',
        }}>
          <CardLabel>Top Players</CardLabel>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {topPlayers.map((player, i) => (
              <div key={player.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                borderBottom: i < topPlayers.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                <RatingBadge rating={player.rating} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                    {player.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                    {player.position} — {player.age}yo — ${(player.salary / 1e6).toFixed(1)}M
                  </div>
                </div>
              </div>
            ))}
          </div>

          {rosterSize > 3 && (
            <div style={{
              paddingTop: 8,
              marginTop: 8,
              borderTop: '1px solid var(--color-border-subtle)',
              fontSize: 11,
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
            }} onClick={() => onNavigate('roster')}>
              +{rosterSize - 3} more — click to view full roster
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div style={{
          background: 'var(--color-bg-raised)',
          border: '1px solid var(--color-border-subtle)',
          padding: 'var(--space-4)',
        }}>
          <CardLabel>Recent Transactions</CardLabel>
          
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-4) 0',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--text-sm)',
          }}>
            Transaction history will appear here
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Free Agency Screen (embedded, not modal) ───────────────────────────────
const POSITIONS = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];

function FreeAgencyScreen({ faData, faPhase, onFaDataUpdate }) {
  const { gameState, engines, refresh } = useGame();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [posFilter, setPosFilter] = useState('ALL');
  const [offers, setOffers] = useState({});

  // Extract data (with defaults for when faData is null)
  const formerPlayers = faData?.formerPlayers || [];
  const otherPlayers = faData?.otherPlayers || [];
  const hiddenCount = faData?.hiddenCount || 0;
  const roster = faData?.roster || [];
  const capSpace = faData?.capSpace || 0;

  const fc = faData?.formatCurrency || (v => `$${(v / 1e6).toFixed(1)}M`);
  const rc = faData?.getRatingColor || ((r) =>
    r >= 80 ? 'var(--color-rating-elite)' : r >= 70 ? 'var(--color-rating-good)'
    : r >= 60 ? 'var(--color-rating-avg)' : 'var(--color-rating-poor)');

  // All useMemo/useCallback hooks MUST be called every render (before any return)
  const allPlayers = useMemo(() => [...formerPlayers, ...otherPlayers], [formerPlayers, otherPlayers]);
  const watchedFAs = useMemo(() => otherPlayers.filter(p => p._isWatched), [otherPlayers]);
  const unwatchedFAs = useMemo(() => otherPlayers.filter(p => !p._isWatched), [otherPlayers]);

  const filterByPos = useCallback((list) =>
    posFilter === 'ALL' ? list : list.filter(p => p.position === posFilter), [posFilter]);

  const filteredFormer = useMemo(() => filterByPos(formerPlayers), [formerPlayers, filterByPos]);
  const filteredWatched = useMemo(() => filterByPos(watchedFAs), [watchedFAs, filterByPos]);
  const filteredUnwatched = useMemo(() => filterByPos(unwatchedFAs), [unwatchedFAs, filterByPos]);

  const selectedPlayers = useMemo(() =>
    allPlayers.filter(p => selectedIds.has(String(p.id))), [allPlayers, selectedIds]);

  const estCost = useMemo(() =>
    selectedPlayers.reduce((sum, p) => sum + (offers[p.id]?.salary || p._marketValue || p.salary || 0), 0),
    [selectedPlayers, offers]);

  const posCounts = useMemo(() => {
    const counts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    roster.forEach(p => { if (counts[p.position] !== undefined) counts[p.position]++; });
    return counts;
  }, [roster]);

  const sortedRoster = useMemo(() =>
    [...roster].sort((a, b) => (b.rating || 0) - (a.rating || 0)), [roster]);

  // Initialize selections when data arrives
  useEffect(() => {
    if (faData && faPhase === 'select') {
      const initial = new Set();
      (faData.formerPlayers || []).forEach(p => initial.add(String(p.id)));
      setSelectedIds(initial);
      setPosFilter('ALL');
      setOffers({});
    }
  }, [faData, faPhase]);

  // Toggle player selection
  const toggle = useCallback((id) => {
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
  }, [allPlayers]);

  const handleSubmit = useCallback(() => {
    if (selectedPlayers.length === 0) { 
      alert('Select at least one player to make offers.'); 
      return; 
    }
    const finalOffers = selectedPlayers.map(p => ({
      playerId: p.id,
      salary: offers[p.id]?.salary || p._marketValue || p.salary,
      years: offers[p.id]?.years || p._suggestedYears || 2,
    }));
    window._faSubmitOffers?.(finalOffers);
  }, [selectedPlayers, offers]);

  // Derived values
  const remaining = capSpace - estCost;
  const isEmpty = filteredFormer.length === 0 && filteredWatched.length === 0 && filteredUnwatched.length === 0;
  const raw = gameState?._raw || gameState;
  const inFaPhase = raw?.offseasonPhase === 'free_agency';

  // ─── RENDER ───────────────────────────────────────────────────────────────

  // No FA data yet — show waiting state
  if (!faData) {
    return (
      <div style={{
        maxWidth: 'var(--content-max)',
        margin: '0 auto',
        padding: 'var(--space-6)',
      }}>
        <h2 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--weight-semi)',
          marginBottom: 'var(--space-4)',
        }}>Free Agency</h2>
        <div style={{
          padding: 'var(--space-6)',
          background: 'var(--color-bg-sunken)',
          border: '1px solid var(--color-border-subtle)',
          textAlign: 'center',
          color: 'var(--color-text-tertiary)',
        }}>
          {inFaPhase 
            ? 'Loading free agent data...'
            : 'Free agency will begin after player development phase'}
        </div>
      </div>
    );
  }

  // Results phase
  if (faPhase === 'results' && faData.results) {
    return (
      <div style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: 'var(--space-6)',
      }}>
        <h2 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--weight-semi)',
          marginBottom: 'var(--space-4)',
        }}>Free Agency Results</h2>
        
        <FaResultsView 
          results={faData.results} 
          fc={fc} 
          getTeamById={faData.getTeamById}
        />
        
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button
            onClick={() => window.continueFreeAgency?.()}
            style={{
              padding: '12px 32px',
              background: 'var(--color-accent)',
              border: 'none',
              color: 'var(--color-text-inverse)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-semi)',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
            }}
          >
            Continue to Season Setup
          </button>
        </div>
      </div>
    );
  }

  // Selection phase
  return (
    <div style={{
      maxWidth: 1100,
      margin: '0 auto',
      padding: 'var(--space-6)',
    }}>
      <h2 style={{
        fontSize: 'var(--text-lg)',
        fontWeight: 'var(--weight-semi)',
        marginBottom: 'var(--space-4)',
      }}>Free Agency</h2>

      {/* Summary bar */}
      <div style={{
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 12, 
        fontSize: 'var(--text-sm)',
        padding: '12px 16px',
        background: 'var(--color-bg-raised)',
        border: '1px solid var(--color-border-subtle)',
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

      <div style={{ 
        color: 'var(--color-text-tertiary)', 
        fontSize: 'var(--text-xs)', 
        marginBottom: 16 
      }}>
        You'll compete with other teams for these players. Higher offers and team success increase your chances.
      </div>

      {isEmpty ? (
        <div style={{ 
          textAlign: 'center', 
          padding: 40, 
          color: 'var(--color-text-secondary)',
          background: 'var(--color-bg-sunken)',
          border: '1px solid var(--color-border-subtle)',
        }}>
          <div style={{ fontSize: 'var(--text-md)', marginBottom: 8 }}>No Free Agents Available</div>
          <div style={{ fontSize: 'var(--text-sm)' }}>All quality players have been re-signed this offseason.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--gap)' }}>
          {/* Roster Sidebar */}
          <div style={{
            background: 'var(--color-bg-sunken)',
            border: '1px solid var(--color-border-subtle)',
            padding: '12px 14px',
            alignSelf: 'start',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
            }}>Roster ({roster.length}/15)</div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(5, 1fr)', 
              gap: 4, 
              textAlign: 'center', 
              marginBottom: 10 
            }}>
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
          </div>

          {/* Main FA list */}
          <div>
            {/* Position filter */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {POSITIONS.map(pos => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 500,
                    fontFamily: 'var(--font-body)',
                    border: '1px solid',
                    borderColor: posFilter === pos ? 'var(--color-accent)' : 'var(--color-border-subtle)',
                    background: posFilter === pos ? 'var(--color-accent-bg)' : 'transparent',
                    color: posFilter === pos ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {pos}
                </button>
              ))}
            </div>

            {/* Player table */}
            <div style={{ 
              border: '1px solid var(--color-border-subtle)', 
              background: 'var(--color-bg-raised)',
              marginBottom: 16,
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-sunken)' }}>
                    <th style={{ ...thS, width: 30, paddingLeft: 12 }}></th>
                    <th style={{ ...thS, textAlign: 'left', paddingLeft: 8 }}>Player</th>
                    <th style={thS}>Pos</th>
                    <th style={thS}>Age</th>
                    <th style={thS}>OVR</th>
                    <th style={thS}>Fit</th>
                    <th style={{ ...thS, textAlign: 'right', paddingRight: 12 }}>Market</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Former players section */}
                  {filteredFormer.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={7} style={sectionTd}>Former Players (5% loyalty bonus)</td>
                      </tr>
                      {filteredFormer.map(p => (
                        <FaPlayerRow
                          key={p.id}
                          player={p}
                          isSelected={selectedIds.has(String(p.id))}
                          onToggle={() => toggle(p.id)}
                          fc={fc}
                          rc={rc}
                        />
                      ))}
                    </>
                  )}
                  
                  {/* Watched players section */}
                  {filteredWatched.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={7} style={sectionTd}>Watched Free Agents</td>
                      </tr>
                      {filteredWatched.map(p => (
                        <FaPlayerRow
                          key={p.id}
                          player={p}
                          isSelected={selectedIds.has(String(p.id))}
                          onToggle={() => toggle(p.id)}
                          fc={fc}
                          rc={rc}
                        />
                      ))}
                    </>
                  )}
                  
                  {/* Other players section */}
                  {filteredUnwatched.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={7} style={sectionTd}>Available Free Agents</td>
                      </tr>
                      {filteredUnwatched.map(p => (
                        <FaPlayerRow
                          key={p.id}
                          player={p}
                          isSelected={selectedIds.has(String(p.id))}
                          onToggle={() => toggle(p.id)}
                          fc={fc}
                          rc={rc}
                        />
                      ))}
                    </>
                  )}
                </tbody>
              </table>
              
              {hiddenCount > 0 && (
                <div style={{ 
                  padding: '8px 16px', 
                  fontSize: 'var(--text-xs)', 
                  color: 'var(--color-text-tertiary)',
                  borderTop: '1px solid var(--color-border-subtle)',
                }}>
                  +{hiddenCount} lower-rated players hidden
                </div>
              )}
            </div>

            {/* Selected offers */}
            {selectedPlayers.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
                }}>Your Offers ({selectedPlayers.length})</div>
                {selectedPlayers.map(p => (
                  <FaOfferCard
                    key={p.id}
                    player={p}
                    fc={fc}
                    offer={offers[p.id] || { salary: p._marketValue, years: p._suggestedYears || 2 }}
                    onChange={(newOffer) => setOffers(o => ({ ...o, [p.id]: newOffer }))}
                  />
                ))}
              </div>
            )}

            {/* Submit button */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleSubmit}
                disabled={selectedPlayers.length === 0}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: selectedPlayers.length > 0 ? 'var(--color-accent)' : 'var(--color-bg-sunken)',
                  border: 'none',
                  color: selectedPlayers.length > 0 ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-semi)',
                  fontFamily: 'var(--font-body)',
                  cursor: selectedPlayers.length > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                Submit Offers ({selectedPlayers.length})
              </button>
              <button
                onClick={() => window.skipFreeAgency?.()}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                }}
              >
                Skip Free Agency
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// FA Player Row
function FaPlayerRow({ player: p, isSelected, onToggle, fc, rc }) {
  return (
    <tr 
      onClick={onToggle}
      style={{ 
        cursor: 'pointer',
        background: isSelected ? 'var(--color-accent-bg)' : 
                   p._isFormer ? 'rgba(45,106,79,0.03)' : 'transparent',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <td style={{ ...tdC, paddingLeft: 12 }}>
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={onToggle}
          onClick={e => e.stopPropagation()}
          style={{ cursor: 'pointer' }}
        />
      </td>
      <td style={{ ...tdC, textAlign: 'left', paddingLeft: 8 }}>
        <div style={{ fontWeight: 500 }}>{p.name}</div>
        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
          {p._fromTeamName || 'Free Agent'}
        </div>
      </td>
      <td style={{ ...tdC, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{p.position}</td>
      <td style={{ ...tdC, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{p.age}</td>
      <td style={tdC}>
        <span style={{
          padding: '2px 6px',
          background: rc(p.rating),
          color: 'var(--color-text-inverse)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
        }}>{p.rating}</span>
      </td>
      <td style={{ ...tdC, color: p._fitColor || 'var(--color-text-secondary)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>
        {p._fitGrade || '—'}
      </td>
      <td style={{ ...tdC, textAlign: 'right', paddingRight: 12, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
        {fc(p._marketValue || p.salary || 0)}
      </td>
    </tr>
  );
}

// FA Offer Card
function FaOfferCard({ player: p, fc, offer, onChange }) {
  return (
    <div style={{
      padding: '12px 14px', 
      marginBottom: 8,
      background: p._isFormer ? 'var(--color-accent-bg)' : 'var(--color-bg-sunken)',
      border: `1px solid ${p._isFormer ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`,
    }}>
      <div style={{
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 8,
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
          padding: '4px 8px', 
          marginBottom: 8, 
          fontSize: 'var(--text-xs)',
          background: 'var(--color-loss-bg)', 
          borderLeft: '3px solid var(--color-loss)',
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
          <input 
            type="number" 
            value={offer.salary}
            min={p._minOffer} 
            max={p._maxOffer} 
            step={100000}
            onChange={e => onChange({ ...offer, salary: parseInt(e.target.value) || p._marketValue })}
            style={{
              width: '100%', 
              padding: '5px 8px', 
              fontSize: 'var(--text-xs)',
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-raised)', 
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text)',
            }} 
          />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 3 }}>
            Years (Suggested: {p._suggestedYears || 2})
          </div>
          <select 
            value={offer.years}
            onChange={e => onChange({ ...offer, years: parseInt(e.target.value) })}
            style={{
              width: '100%', 
              padding: '5px 8px', 
              fontSize: 'var(--text-xs)',
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-raised)', 
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y} Year{y > 1 ? 's' : ''}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// FA Results View
function FaResultsView({ results, fc, getTeamById }) {
  const resultsArray = Array.isArray(results) ? results : [];
  const signed = resultsArray.filter(r => r.userWon);
  const lost = resultsArray.filter(r => r.userOffered && !r.userWon);
  const aiSignings = resultsArray.filter(r => !r.userOffered);

  return (
    <div>
      <div style={{ 
        textAlign: 'center', 
        marginBottom: 24, 
        padding: '16px',
        background: 'var(--color-bg-raised)',
        border: '1px solid var(--color-border-subtle)',
      }}>
        <span style={{ 
          fontSize: 'var(--text-xl)', 
          color: 'var(--color-win)', 
          fontWeight: 700 
        }}>{signed.length}</span>
        <span style={{ 
          fontSize: 'var(--text-md)', 
          color: 'var(--color-text-secondary)', 
          marginLeft: 8 
        }}>signed</span>
        {lost.length > 0 && (
          <>
            <span style={{ margin: '0 16px', color: 'var(--color-text-tertiary)' }}>·</span>
            <span style={{ 
              fontSize: 'var(--text-xl)', 
              color: 'var(--color-loss)' 
            }}>{lost.length}</span>
            <span style={{ 
              fontSize: 'var(--text-md)', 
              color: 'var(--color-text-secondary)', 
              marginLeft: 8 
            }}>chose other teams</span>
          </>
        )}
      </div>

      {signed.length > 0 && (
        <FaResultSection title="Signed" color="var(--color-win)">
          {signed.map((r, i) => <FaResultRow key={i} result={r} fc={fc} won />)}
        </FaResultSection>
      )}

      {lost.length > 0 && (
        <FaResultSection title="Lost" color="var(--color-loss)">
          {lost.map((r, i) => <FaResultRow key={i} result={r} fc={fc} getTeamById={getTeamById} />)}
        </FaResultSection>
      )}

      {aiSignings.length > 0 && (
        <FaResultSection title="Notable AI Signings" color="var(--color-text-tertiary)">
          {aiSignings.slice(0, 10).map((r, i) => <FaResultRow key={i} result={r} fc={fc} />)}
        </FaResultSection>
      )}
    </div>
  );
}

function FaResultSection({ title, color, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
      }}>{title}</div>
      <div style={{ 
        background: 'var(--color-bg-raised)', 
        border: '1px solid var(--color-border-subtle)' 
      }}>
        {children}
      </div>
    </div>
  );
}

function FaResultRow({ result, fc, won, getTeamById }) {
  const p = result.player || result;
  const winningTeamId = result.winningOffer?.teamId;
  const teamName = !won && winningTeamId && getTeamById
    ? (getTeamById(winningTeamId)?.name || 'Unknown team')
    : null;

  return (
    <div style={{
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: '8px 12px', 
      borderBottom: '1px solid var(--color-border-subtle)',
      fontSize: 'var(--text-sm)',
    }}>
      <div>
        <span style={{ fontWeight: 500 }}>{p.name || result.name}</span>
        <span style={{ 
          color: 'var(--color-text-tertiary)', 
          marginLeft: 8, 
          fontSize: 'var(--text-xs)' 
        }}>
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
        {(result.winningOffer?.salary || result.salary) && (
          <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)' }}>
            {fc(result.winningOffer?.salary || result.salary)}
          </span>
        )}
      </div>
    </div>
  );
}

// Table styles
const thS = {
  padding: '7px 8px', 
  fontSize: 10, 
  fontWeight: 600,
  color: 'var(--color-text-tertiary)',
  textTransform: 'uppercase', 
  letterSpacing: '0.06em', 
  textAlign: 'center',
};

const tdC = {
  padding: '6px 8px', 
  textAlign: 'center', 
  fontVariantNumeric: 'tabular-nums',
};

const sectionTd = {
  padding: '6px 16px', 
  fontSize: 10, 
  fontWeight: 600,
  color: 'var(--color-accent)', 
  textTransform: 'uppercase',
  letterSpacing: '0.04em', 
  borderBottom: '1px solid var(--color-border-subtle)',
  background: 'var(--color-bg-sunken)',
};

// ─── Placeholder Screens ─────────────────────────────────────────────────────
function PlaceholderScreen({ title, message }) {
  return (
    <div style={{
      maxWidth: 'var(--content-max)',
      margin: '0 auto',
      padding: 'var(--space-6)',
    }}>
      <h2 style={{
        fontSize: 'var(--text-lg)',
        fontWeight: 'var(--weight-semi)',
        marginBottom: 'var(--space-4)',
      }}>{title}</h2>
      <div style={{
        padding: 'var(--space-6)',
        background: 'var(--color-bg-sunken)',
        border: '1px solid var(--color-border-subtle)',
        textAlign: 'center',
        color: 'var(--color-text-tertiary)',
      }}>
        {message}
      </div>
    </div>
  );
}

function TradesScreen() {
  return (
    <PlaceholderScreen
      title="Trades"
      message="Trade center — click Propose a Trade on dashboard to open trade screen"
    />
  );
}

function CalendarScreen() {
  return (
    <PlaceholderScreen
      title="Offseason Calendar"
      message="Offseason calendar will be added in a future update"
    />
  );
}

// ─── Helper Components ───────────────────────────────────────────────────────
function MetricCard({ label, value, detail, valueColor }) {
  return (
    <div style={{
      background: 'var(--color-bg-raised)',
      border: '1px solid var(--color-border-subtle)',
      padding: 'var(--space-4)',
    }}>
      <div style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-semi)',
        color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 'var(--text-2xl)',
        fontWeight: 'var(--weight-bold)',
        color: valueColor || 'var(--color-text)',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
      }}>{value}</div>
      {detail && (
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)',
          marginTop: 4,
        }}>{detail}</div>
      )}
    </div>
  );
}

function CardLabel({ children }) {
  return (
    <div style={{
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semi)',
      color: 'var(--color-text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 12,
    }}>{children}</div>
  );
}

function ActionButton({ children, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 14px',
        background: primary ? 'var(--color-accent-bg)' : 'var(--color-bg-sunken)',
        border: `1px solid ${primary ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`,
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        fontWeight: 500,
        color: primary ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      {children}
    </button>
  );
}

function SimButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 6px',
        background: 'var(--color-bg-sunken)',
        border: '1px solid var(--color-border-subtle)',
        fontFamily: 'var(--font-body)',
        fontSize: 10,
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function RatingBadge({ rating }) {
  const color = rating >= 85 ? 'var(--color-tier1)'
    : rating >= 75 ? 'var(--color-accent)'
    : 'var(--color-text-tertiary)';

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 6px',
      background: color,
      color: 'var(--color-text-inverse)',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 600,
    }}>{rating}</span>
  );
}

function NewsItem({ trade, isLast }) {
  const t1Name = trade.team1?.name || trade.team1Name || 'Team';
  const t2Name = trade.team2?.name || trade.team2Name || 'Team';

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 3,
      }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
          {t1Name} ↔ {t2Name}
        </span>
        {trade.date && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--color-text-tertiary)',
          }}>{trade.date}</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>
        Trade completed
      </div>
    </div>
  );
}

// ─── Main OffseasonHub Component ─────────────────────────────────────────────
export function OffseasonHub({ data, onClose }) {
  const { gameState, engines, refresh } = useGame();
  const [activeScreen, setActiveScreen] = useState('dashboard');
  
  // FA state - intercept FA modal data and render inline
  const [faData, setFaData] = useState(null);
  const [faPhase, setFaPhase] = useState('select'); // 'select' or 'results'

  // Get current offseason phase
  const raw = gameState?._raw || gameState;
  const currentPhase = raw?.offseasonPhase || 'free_agency';

  // Intercept FA modal calls and redirect to inline display
  useEffect(() => {
    // Store original functions
    const originalShowFA = window._reactShowFA;
    
    // Override to intercept FA data
    window._reactShowFA = (faDataFromController) => {
      console.log('🌴 [OFFSEASON-HUB] Intercepting FA data for inline display');
      setFaData(faDataFromController);
      setFaPhase(faDataFromController?.phase || 'select');
      setActiveScreen('freeagency'); // Auto-navigate to FA screen
    };

    // Cleanup
    return () => {
      window._reactShowFA = originalShowFA;
    };
  }, []);

  // Also listen for phase changes to auto-navigate
  useEffect(() => {
    if (currentPhase === 'free_agency' && activeScreen === 'dashboard') {
      // When FA phase starts and we're on dashboard, navigate to FA
      // (but don't force it if user navigated elsewhere)
    }
  }, [currentPhase, activeScreen]);

  // Screen components map - pass FA data to FreeAgencyScreen
  const screens = useMemo(() => ({
    dashboard: (
      <OffseasonDashboard
        onNavigate={setActiveScreen}
        gameState={gameState}
        engines={engines}
      />
    ),
    roster: <RosterScreen />,
    freeagency: (
      <FreeAgencyScreen 
        faData={faData} 
        faPhase={faPhase}
        onFaDataUpdate={setFaData}
      />
    ),
    trades: <TradesScreen />,
    scouting: <ScoutingScreen />,
    calendar: <CalendarScreen />,
    coach: <CoachScreen />,
    finances: <FinancesScreen />,
    history: <HistoryScreen />,
    glossary: <GlossaryScreen />,
  }), [gameState, engines, faData, faPhase]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
    }}>
      {/* Phase Tracker */}
      <OffseasonPhaseTracker currentPhase={currentPhase} />

      {/* Sidebar + Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <OffseasonSidebar
          activeScreen={activeScreen}
          onNavigate={setActiveScreen}
        />
        <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {screens[activeScreen] || screens.dashboard}
        </main>
      </div>
    </div>
  );
}
