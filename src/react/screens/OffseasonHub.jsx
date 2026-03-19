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
// Offseason phases with calendar dates (month is 0-indexed)
// These define when each phase BECOMES AVAILABLE - user can sim to reach them
const OFFSEASON_PHASES = [
  { key: 'postseason', label: 'Playoffs', month: 3, day: 16 },      // Apr 16
  { key: 'promo_rel', label: 'P/R', month: 5, day: 1 },             // Jun 1
  { key: 'draft', label: 'Draft', month: 5, day: 15 },              // Jun 15
  { key: 'contracts_expire', label: 'Exp', month: 5, day: 30 },     // Jun 30
  { key: 'free_agency', label: 'FA', month: 6, day: 1 },            // Jul 1
  { key: 'development', label: 'Dev', month: 7, day: 1 },           // Aug 1
  { key: 'training_camp', label: 'Camp', dynamic: true },            // Tier-specific
  { key: 'season_start', label: 'Ready', dynamic: true },            // Tier-specific
];

// Helper to check if current date has reached a phase date
function hasReachedPhase(currentDateStr, phaseKey, seasonStartYear, userTier) {
  if (!currentDateStr || !seasonStartYear) return false;
  const phase = OFFSEASON_PHASES.find(p => p.key === phaseKey);
  if (!phase) return false;
  
  // Parse date string manually to avoid UTC vs local timezone issues
  const [year, month, day] = currentDateStr.split('-').map(Number);
  const current = new Date(year, month - 1, day); // month is 0-indexed
  
  // Dynamic phases use tier-specific dates from CalendarEngine
  if (phase.dynamic) {
    const dates = window.CalendarEngine?.getSeasonDates?.(seasonStartYear);
    if (!dates) return false;
    const tier = userTier || 1;
    if (phaseKey === 'training_camp') {
      const campOpen = tier === 1 ? dates.t1CampOpen : tier === 2 ? dates.t2CampOpen : dates.t3CampOpen;
      return current >= campOpen;
    }
    if (phaseKey === 'season_start') {
      // Use next season tier start dates (same year as camp dates)
      const nextStart = tier === 1 ? dates.t1CampOpen : tier === 2 ? dates.t2CampOpen : dates.t3CampOpen;
      // Season starts = cutdown + 1 day (day after cutdown is first game)
      const cutdown = tier === 1 ? dates.t1Cutdown : tier === 2 ? dates.t2Cutdown : dates.t3Cutdown;
      // Season start is the day after cutdown
      const seasonStart = new Date(cutdown.getTime() + 86400000);
      return current >= seasonStart;
    }
    return false;
  }
  
  const phaseDate = new Date(seasonStartYear + 1, phase.month, phase.day);
  return current >= phaseDate;
}

// Helper to get the display date for a phase (including dynamic ones)
function getPhaseDateStr(phase, seasonStartYear, userTier) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!phase.dynamic) {
    return `${months[phase.month]} ${phase.day}`;
  }
  const dates = window.CalendarEngine?.getSeasonDates?.(seasonStartYear);
  if (!dates) return '';
  const tier = userTier || 1;
  let d;
  if (phase.key === 'training_camp') {
    d = tier === 1 ? dates.t1CampOpen : tier === 2 ? dates.t2CampOpen : dates.t3CampOpen;
  } else if (phase.key === 'season_start') {
    // Day after cutdown
    const cutdown = tier === 1 ? dates.t1Cutdown : tier === 2 ? dates.t2Cutdown : dates.t3Cutdown;
    d = new Date(cutdown.getTime() + 86400000);
  }
  if (!d) return '';
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// ─── Navigation items (mirrors Sidebar but for offseason) ────────────────────
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'roster', label: 'Roster' },
  { id: 'draft', label: 'Draft' },
  { id: 'freeagency', label: 'Free Agency' },
  { id: 'development', label: 'Development' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'trades', label: 'Trades' },
  { id: 'scouting', label: 'Scouting' },
  { id: 'coach', label: 'Coach' },
  { id: 'finances', label: 'Finances' },
  { id: 'history', label: 'History' },
  { id: 'glossary', label: 'Glossary' },
];

// ─── Phase Tracker Bar ───────────────────────────────────────────────────────
function OffseasonPhaseTracker({ currentDate, seasonStartYear }) {
  const { gameState } = useGame();
  const raw = gameState?._raw || gameState;
  const dateStr = currentDate || raw?.currentDate;
  const startYear = seasonStartYear || raw?.seasonStartYear || raw?.currentSeason;
  const userTier = raw?.currentTier || raw?.userTeam?.tier || 1;
  
  // Format current date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Determine if user is in camp mode (for label)
  const inCamp = hasReachedPhase(dateStr, 'training_camp', startYear, userTier) && 
                 !hasReachedPhase(dateStr, 'season_start', startYear, userTier);

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
      }}>
        <div>{inCamp ? 'Training Camp' : 'Offseason'}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {formatDate(dateStr)}
        </div>
      </div>

      {OFFSEASON_PHASES.map((phase, i) => {
        const reached = hasReachedPhase(dateStr, phase.key, startYear, userTier);
        const nextPhase = OFFSEASON_PHASES[i + 1];
        const nextReached = nextPhase ? hasReachedPhase(dateStr, nextPhase.key, startYear, userTier) : true;
        const isActive = reached && !nextReached;

        return (
          <React.Fragment key={phase.key}>
            {i > 0 && (
              <div style={{
                width: 16,
                height: 2,
                background: reached ? 'var(--color-accent)' : 'var(--color-border-subtle)',
                flexShrink: 0,
              }} />
            )}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              minWidth: 40,
              flexShrink: 0,
              opacity: reached ? 1 : 0.5,
            }}>
              <div style={{
                width: isActive ? 18 : 14,
                height: isActive ? 18 : 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: reached && !isActive ? 10 : 8,
                fontWeight: 700,
                background: reached && !isActive ? 'var(--color-accent)'
                  : isActive ? 'var(--color-bg-raised)'
                  : 'var(--color-bg-sunken)',
                border: isActive ? '2px solid var(--color-accent)'
                  : reached ? 'none'
                  : '1px solid var(--color-border-subtle)',
                color: reached && !isActive ? 'var(--color-text-inverse)'
                  : isActive ? 'var(--color-accent)'
                  : 'var(--color-text-tertiary)',
              }}>
                {reached && !isActive ? '+' : (i + 1)}
              </div>
              <span style={{
                fontSize: 8,
                whiteSpace: 'nowrap',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--color-text)'
                  : !reached ? 'var(--color-text-tertiary)'
                  : 'var(--color-text-secondary)',
              }}>{phase.label}</span>
              <span style={{
                fontSize: 7,
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-mono)',
              }}>{getPhaseDateStr(phase, startYear, userTier)}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Sidebar Navigation ──────────────────────────────────────────────────────
function OffseasonSidebar({ activeScreen, onNavigate, inCamp }) {
  const [hoveredItem, setHoveredItem] = useState(null);

  // Build nav items based on whether we're in camp mode
  const campItems = inCamp ? [
    { id: 'trainingcamp', label: 'Dashboard' },
    { id: 'focuses', label: 'Focus Assignment' },
    { id: 'invites', label: 'Camp Invites' },
  ] : [];

  const standardItems = inCamp ? [
    { id: 'roster', label: 'Roster' },
    { id: 'finances', label: 'Finances' },
    { id: 'history', label: 'History' },
    { id: 'glossary', label: 'Glossary' },
  ] : NAV_ITEMS;

  const renderItem = (item) => {
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
          padding: '8px 12px 8px 16px',
          border: 'none',
          borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent',
          background: isHovered && !isActive ? 'var(--color-bg-hover)' : 'transparent',
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
  };

  return (
    <nav style={{
      width: 'var(--sidebar-width)',
      minHeight: 'calc(100vh - var(--topbar-height) - 42px)',
      background: 'var(--color-bg-raised)',
      borderRight: '1px solid var(--color-border-subtle)',
      padding: 'var(--space-4) 0',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      {campItems.map(renderItem)}
      {campItems.length > 0 && standardItems.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '8px 16px' }} />
      )}
      {standardItems.map(renderItem)}
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
                marginBottom: 6,
                background: 'var(--color-bg-sunken)',
                border: '1px solid var(--color-border-subtle)',
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              Sim to Next Event
            </button>
            <button
              onClick={() => window.simToTrainingCamp?.()}
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

function FreeAgencyScreen({ faData, faPhase, cgfaData, cgfaPhase, currentDate, seasonStartYear, onCgfaComplete, onFaComplete }) {
  const { gameState, engines, refresh } = useGame();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [posFilter, setPosFilter] = useState('ALL');
  const [offers, setOffers] = useState({});
  const [activeTab, setActiveTab] = useState('fa'); // 'fa' or 'cgfa'

  // Check if FA date has been reached (Jul 1)
  const faReached = hasReachedPhase(currentDate, 'free_agency', seasonStartYear);
  const collegeFAReached = hasReachedPhase(currentDate, 'college_fa', seasonStartYear);

  // Determine which data to show
  const showCgfa = cgfaData && cgfaPhase !== 'waiting';
  const showFa = faData && faPhase !== 'waiting';
  
  // If CGFA data arrives, switch to that tab
  useEffect(() => {
    if (showCgfa && !showFa) {
      setActiveTab('cgfa');
    } else if (showFa) {
      setActiveTab('fa');
    }
  }, [showCgfa, showFa]);

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

  // ─── RENDER ───────────────────────────────────────────────────────────────

  // ─── COLLEGE GRAD FA (T2/T3 only) ───────────────────────────────────────────
  if (showCgfa) {
    const graduates = cgfaData?.graduates || [];
    const cgCapSpace = cgfaData?.capSpace || 0;
    const cgRosterSize = cgfaData?.rosterSize || 0;
    const cgSeason = cgfaData?.season || '';
    const cgFc = cgfaData?.formatCurrency || fc;
    const cgRc = cgfaData?.getRatingColor || rc;
    
    // Filter graduates by position
    const filteredGrads = posFilter === 'ALL' ? graduates : graduates.filter(g => g.position === posFilter);
    
    // Results phase
    if (cgfaPhase === 'results') {
      // Results come as { results: { signed, lost, details } }
      const resultsData = cgfaData?.results || {};
      const signedCount = resultsData.signed || 0;
      const lostCount = resultsData.lost || 0;
      const details = resultsData.details || [];
      
      // Handle continue - close CG modal, clear data, return to dashboard
      const handleContinue = () => {
        window.closeCollegeGradResults?.();
        if (onCgfaComplete) onCgfaComplete();
      };
      
      return (
        <div style={{ maxWidth: 700, margin: '0 auto', padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-4)' }}>
            College Graduate FA Results
          </h2>
          
          {/* Show details of each player */}
          {details.length > 0 ? (
            <div style={{ marginBottom: 20, background: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)' }}>
              {details.map((d, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderBottom: '1px solid var(--color-border-subtle)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.player?.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                      {d.player?.position} · {d.player?.age}yo · {d.player?.college || 'Unknown'}
                    </div>
                  </div>
                  <div style={{ 
                    fontFamily: 'var(--font-mono)', fontWeight: 700, 
                    color: cgRc(d.player?.rating), marginRight: 16 
                  }}>
                    {d.player?.rating}
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    fontSize: 'var(--text-xs)', fontWeight: 600,
                    background: d.signed ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
                    color: d.signed ? 'var(--color-win)' : 'var(--color-loss)',
                  }}>
                    {d.signed ? 'SIGNED' : 'DECLINED'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ 
              marginBottom: 20, padding: 24, background: 'var(--color-bg-sunken)', 
              border: '1px solid var(--color-border-subtle)', textAlign: 'center',
              color: 'var(--color-text-tertiary)'
            }}>
              No players selected
            </div>
          )}
          
          <div style={{ padding: 24, background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 'var(--text-md)', marginBottom: 8 }}>
              {signedCount} graduate{signedCount !== 1 ? 's' : ''} signed
            </div>
            {lostCount > 0 && (
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                {lostCount} chose other teams
              </div>
            )}
          </div>
          <button
            onClick={handleContinue}
            style={{
              width: '100%', padding: '14px 20px', background: 'var(--color-accent)',
              border: 'none', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)',
              fontWeight: 600, color: 'var(--color-text-inverse)', cursor: 'pointer',
            }}
          >
            Continue
          </button>
        </div>
      );
    }
    
    // Selection phase
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-4)' }}>
          College Graduate Free Agency
        </h2>
        
        {/* Summary */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', background: 'var(--color-bg-raised)',
          border: '1px solid var(--color-border-subtle)', marginBottom: 12,
          fontSize: 'var(--text-sm)',
        }}>
          <span>
            {selectedIds.size} selected
          </span>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>Roster: <strong>{cgRosterSize}/15</strong></span>
            <span>Cap: <strong style={{ fontFamily: 'var(--font-mono)' }}>{cgFc(cgCapSpace)}</strong></span>
          </div>
        </div>
        
        {/* Position filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {['ALL', 'PG', 'SG', 'SF', 'PF', 'C'].map(pos => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              style={{
                padding: '6px 12px', border: 'none', fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer',
                background: posFilter === pos ? 'var(--color-accent)' : 'var(--color-bg-raised)',
                color: posFilter === pos ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
              }}
            >
              {pos}
            </button>
          ))}
        </div>
        
        {/* Graduate list */}
        <div style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)', marginBottom: 16 }}>
          {filteredGrads.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              No graduates available
            </div>
          ) : (
            filteredGrads.map(grad => {
              const isSelected = selectedIds.has(String(grad.id));
              return (
                <div
                  key={grad.id}
                  onClick={() => toggle(grad.id)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '10px 14px',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--color-accent-bg)' : 'transparent',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, border: '2px solid var(--color-border-subtle)',
                    background: isSelected ? 'var(--color-accent)' : 'transparent',
                    marginRight: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: 'var(--color-text-inverse)',
                  }}>
                    {isSelected && '✓'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{grad.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                      {grad.position} · {grad.age}yo · {grad.college || 'Unknown'} · {grad._measurables || ''}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--text-md)',
                    color: cgRc(grad.rating), marginRight: 16,
                  }}>
                    {grad.rating}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                    {cgFc(grad.salary)}
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Submit button */}
        <button
          onClick={() => {
            const selectedIdStrings = [...selectedIds];
            window._cgSubmitOffers?.(selectedIdStrings);
          }}
          style={{
            width: '100%', padding: '14px 20px', background: 'var(--color-accent)',
            border: 'none', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)',
            fontWeight: 600, color: 'var(--color-text-inverse)', cursor: 'pointer',
          }}
        >
          {selectedIds.size > 0 ? `Sign ${selectedIds.size} Graduate${selectedIds.size > 1 ? 's' : ''}` : 'Skip College FA'}
        </button>
      </div>
    );
  }

  // Not yet FA date (for regular FA)
  if (!faReached) {
    // If college FA date reached but no data yet for T2/T3
    if (collegeFAReached && !showCgfa) {
      return (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-4)' }}>College Graduate FA</h2>
          <div style={{ padding: 40, background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
              Loading college graduates...
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
              Use Sim Day to trigger the college FA period
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-4)' }}>Free Agency</h2>
        <div style={{ padding: 40, background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
            Free agency opens on July 1
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
            Use the Sim controls on the Dashboard to advance time
          </div>
        </div>
      </div>
    );
  }

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
          Loading free agent data...
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
            onClick={() => {
              console.log('📋 [FA] Return to Dashboard clicked');
              // Run the controller logic (AI signing, mark complete, save)
              window.continueFreeAgency?.();
              // Navigate back to dashboard
              if (onFaComplete) {
                console.log('📋 [FA] Calling onFaComplete...');
                onFaComplete();
              }
            }}
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
            Return to Dashboard
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

// ─── Training Camp Dashboard ─────────────────────────────────────────────────
function TrainingCampScreen({ campData, onNavigate }) {
  const { gameState, engines } = useGame();
  const raw = gameState?._raw || gameState;
  const userTeam = gameState?.userTeam;
  if (!userTeam) return null;

  const { SalaryCapEngine, CalendarEngine, LeagueManager } = engines || {};

  // Camp state
  const currentDate = raw?.currentDate;
  const seasonStartYear = raw?.seasonStartYear || raw?.currentSeason;
  const userTier = raw?.currentTier || 1;
  const dates = CalendarEngine?.getSeasonDates?.(seasonStartYear);
  const campOpen = dates ? (userTier === 1 ? dates.t1CampOpen : userTier === 2 ? dates.t2CampOpen : dates.t3CampOpen) : null;
  const cutdown = dates ? (userTier === 1 ? dates.t1Cutdown : userTier === 2 ? dates.t2Cutdown : dates.t3Cutdown) : null;

  const totalCampDays = campOpen && cutdown ? Math.round((cutdown - campOpen) / 86400000) : 21;
  let campDay = 1;
  if (campOpen && currentDate) {
    const [y, m, d] = currentDate.split('-').map(Number);
    const cur = new Date(y, m - 1, d);
    campDay = Math.max(1, Math.min(totalCampDays, Math.round((cur - campOpen) / 86400000) + 1));
  }

  const rosterSize = userTeam.roster?.length || 0;
  const maxCamp = 20;
  const focusPool = 25;
  const focusesUsed = raw?._campFocuses ? Object.values(raw._campFocuses).reduce((s, a) => s + a.length, 0) : 0;
  const focusesRemaining = focusPool - focusesUsed;

  const totalPlayed = userTeam.wins + userTeam.losses;
  const pctStr = totalPlayed > 0 ? ((userTeam.wins / totalPlayed) * 100).toFixed(1) : '--';

  const cutdownDateStr = cutdown ? CalendarEngine.toDateString(cutdown) : '';
  const formatShortDate = (str) => {
    if (!str) return '';
    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      {/* Page title */}
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
        Training Camp
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gap)' }}>
        <MetricCard label="Record" value={`${userTeam.wins}-${userTeam.losses}`} detail={`${pctStr}% -- Season complete`}
          valueColor={userTeam.wins > userTeam.losses ? 'var(--color-win)' : userTeam.wins < userTeam.losses ? 'var(--color-loss)' : undefined} />
        <MetricCard label="Roster" value={`${rosterSize} / ${maxCamp}`} detail={`${maxCamp - rosterSize} camp spots open`} />
        <MetricCard label="Focuses" value={`${focusesUsed} / ${focusPool}`} detail={`${focusesRemaining} remaining to assign`}
          valueColor="var(--color-accent)" />
        <MetricCard label="Camp Day" value={`${campDay} / ${totalCampDays}`} detail={`Cutdown: ${formatShortDate(cutdownDateStr)}`} />
      </div>

      {/* Two-column layout: actions + schedule/notes */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 'var(--gap)' }}>
        {/* Camp actions */}
        <div style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column' }}>
          <CardLabel>Camp Actions</CardLabel>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => onNavigate?.('focuses')} style={{
              width: '100%', padding: '7px 14px', background: 'var(--color-accent)', border: 'none',
              fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-inverse)', cursor: 'pointer',
            }}>Assign Development Focuses</button>
            <button onClick={() => onNavigate?.('invites')} style={{
              width: '100%', padding: '7px 14px', background: 'transparent', border: '1px solid var(--color-border)',
              fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer',
            }}>Sign Camp Invitees</button>
            <button onClick={() => onNavigate?.('roster')} style={{
              width: '100%', padding: '7px 14px', background: 'transparent', border: '1px solid var(--color-border)',
              fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer',
            }}>Manage Roster</button>
            <div style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: 4, paddingTop: 10, display: 'flex', gap: 6 }}>
              <button onClick={() => window._offseasonController?.simOffseasonDay?.()} style={{
                flex: 1, padding: '6px 12px', background: 'transparent', border: '1px solid var(--color-border)',
                fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer',
              }}>Sim Day</button>
              <button onClick={() => window._offseasonController?.simOffseasonWeek?.()} style={{
                flex: 1, padding: '6px 12px', background: 'transparent', border: '1px solid var(--color-border)',
                fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer',
              }}>Sim Week</button>
            </div>
            <button onClick={() => window._offseasonController?.simToNextEvent?.()} style={{
              width: '100%', padding: '6px 12px', background: 'var(--color-accent)', border: 'none',
              fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-inverse)', cursor: 'pointer',
            }}>Sim to Cutdown Day</button>
          </div>
        </div>

        {/* Right column: schedule + notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          {/* Preseason schedule placeholder */}
          <div style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)', padding: 'var(--space-4)' }}>
            <CardLabel>Preseason Schedule</CardLabel>
            <div style={{ padding: '6px 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
              Preseason games coming in a future update.
            </div>
          </div>

          {/* Camp notes */}
          <div style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)', padding: 'var(--space-4)' }}>
            <CardLabel>Camp Notes</CardLabel>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              {campDay <= 1 ? (
                <div style={{ padding: '4px 0', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                  Camp has just opened. Assign development focuses and sign camp invitees to get started.
                </div>
              ) : (
                <div style={{ padding: '4px 0', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                  Camp notes will populate as development focuses are assigned and resolved.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Camp Invites Screen ─────────────────────────────────────────────────────
function CampInvitesScreen({ onNavigate }) {
  const { gameState, engines, refresh } = useGame();
  const raw = gameState?._raw || gameState;
  const userTeam = gameState?.userTeam;
  const [posFilter, setPosFilter] = useState('ALL');
  const [signingId, setSigningId] = useState(null);

  if (!userTeam) return null;

  const rosterSize = userTeam.roster?.length || 0;
  const spotsAvailable = 20 - rosterSize;
  const freeAgents = raw?.freeAgents || [];
  const userTier = raw?.currentTier || 1;

  // Get candidates from TrainingCampEngine
  const TCE = window.TrainingCampEngine;
  const allCandidates = TCE ? TCE.getCampInviteCandidates(freeAgents, userTier, rosterSize) : [];

  // Position filter
  const posGroups = {
    ALL: null,
    Guards: ['PG', 'SG'],
    Wings: ['SF'],
    Bigs: ['PF', 'C'],
  };
  const filtered = posFilter === 'ALL' ? allCandidates :
    allCandidates.filter(p => posGroups[posFilter]?.includes(p.position));

  // Get team name from previousTeamId
  const getTeamName = (teamId) => {
    if (!teamId) return null;
    const allTeams = [...(raw?.tier1Teams || []), ...(raw?.tier2Teams || []), ...(raw?.tier3Teams || [])];
    const team = allTeams.find(t => t.id === teamId);
    return team ? team.name : null;
  };

  // Build origin string
  const getOrigin = (player) => {
    if (player.isCollegeGrad) return 'College grad, undrafted';
    if (player.previousTeamId) {
      const name = getTeamName(player.previousTeamId);
      if (name) {
        const prevTeam = [...(raw?.tier1Teams || []), ...(raw?.tier2Teams || []), ...(raw?.tier3Teams || [])].find(t => t.id === player.previousTeamId);
        const tierLabel = prevTeam ? `T${prevTeam.tier}` : '';
        return `Cut by ${name}${tierLabel ? ' (' + tierLabel + ')' : ''}`;
      }
    }
    return 'Free agent';
  };

  const handleInvite = (player) => {
    if (spotsAvailable <= 0) return;
    setSigningId(player.id);

    const TF = window.TeamFactory;
    const success = TCE?.signCampInvite(player, userTeam, freeAgents, { TeamFactory: TF });

    if (success) {
      console.log(`⛺ [CAMP] Signed camp invite: ${player.name} (${player.rating} OVR)`);
      // Save and refresh
      window._offseasonController?.ctx?.helpers?.saveGameState?.();
      if (refresh) refresh();
    }

    setTimeout(() => setSigningId(null), 300);
  };

  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Camp Invites</div>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          {spotsAvailable} roster spot{spotsAvailable !== 1 ? 's' : ''} available
        </div>
      </div>

      {spotsAvailable <= 0 && (
        <div style={{ padding: '10px 16px', background: 'var(--color-warning-bg, #fdf5e4)', border: '1px solid var(--color-warning)', fontSize: 'var(--text-sm)' }}>
          <b style={{ color: 'var(--color-warning)' }}>Roster full (20 players).</b> Release a player from the Roster screen to open a camp invite spot.
        </div>
      )}

      {/* Position filter */}
      <div style={{ display: 'flex', gap: 0 }}>
        {Object.keys(posGroups).map(key => (
          <button key={key} onClick={() => setPosFilter(key)} style={{
            padding: '6px 14px', fontSize: 'var(--text-sm)', fontWeight: posFilter === key ? 600 : 500,
            color: posFilter === key ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            background: posFilter === key ? 'var(--color-accent)' : 'transparent',
            border: `1px solid ${posFilter === key ? 'var(--color-accent)' : 'var(--color-border)'}`,
            marginRight: -1, cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>{key === 'ALL' ? 'All Positions' : key}</button>
        ))}
      </div>

      {/* Candidates table */}
      <div style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr>
              <th style={thStyle}>Pos</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Player</th>
              <th style={thStyle}>Age</th>
              <th style={thStyle}>OVR</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Origin</th>
              <th style={{ ...thStyle, width: 72 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 30).map(player => (
              <tr key={player.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-accent-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={{ ...tdStyle, fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-tertiary)', width: 36 }}>{player.position}</td>
                <td style={{ ...tdStyle, fontWeight: 500 }}>
                  {player.name}
                  {player.measurables && (
                    <span style={{ marginLeft: 8, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                      {player.measurables.height ? Math.floor(player.measurables.height / 12) + "'" + (player.measurables.height % 12) + '"' : ''}
                      {player.measurables.weight ? ' · ' + player.measurables.weight + 'lbs' : ''}
                    </span>
                  )}
                </td>
                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', width: 36 }}>{player.age}</td>
                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontWeight: 700, width: 40 }}>{player.rating}</td>
                <td style={{ ...tdStyle, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{getOrigin(player)}</td>
                <td style={{ ...tdStyle, width: 72 }}>
                  <button onClick={() => handleInvite(player)} disabled={spotsAvailable <= 0 || signingId === player.id}
                    style={{
                      padding: '4px 10px', fontSize: 'var(--text-xs)', fontWeight: 600,
                      background: 'var(--color-accent)', color: 'var(--color-text-inverse)', border: 'none',
                      cursor: spotsAvailable > 0 ? 'pointer' : 'not-allowed',
                      opacity: spotsAvailable <= 0 || signingId === player.id ? 0.4 : 1,
                      fontFamily: 'var(--font-body)',
                    }}>Invite</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 30 && (
          <div style={{ padding: 8, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center', borderTop: '1px solid var(--color-border-subtle)' }}>
            Showing 30 of {filtered.length} eligible free agents
          </div>
        )}
        {filtered.length === 0 && (
          <div style={{ padding: 16, fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
            No eligible free agents for this tier and position filter.
          </div>
        )}
      </div>
    </div>
  );
}

// Table cell styles for Camp Invites (shared)
const thStyle = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid var(--color-border)' };
const tdStyle = { padding: '6px 8px', verticalAlign: 'middle', textAlign: 'center' };

// ─── Focus Assignment Screen (placeholder for Phase 3) ──────────────────────
function FocusAssignmentScreen() {
  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-6)' }}>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>
        Focus Assignment
      </div>
      <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', lineHeight: 1.6 }}>
          Development focus assignment will be available in a future update.
          Assign training focuses to your players to improve specific skills during camp.
        </div>
      </div>
    </div>
  );
}

// ─── Draft Screen ────────────────────────────────────────────────────────────
function DraftScreen({ draftData, draftPhase, setDraftPhase, currentDate, seasonStartYear }) {
  const { gameState } = useGame();
  const [posFilter, setPosFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('rating');
  const [resultsTab, setResultsTab] = useState('round1');
  
  const raw = gameState?._raw || gameState;
  const userTier = raw?.userTeam?.tier || 1;
  
  // Check if draft date has been reached
  const draftReached = hasReachedPhase(currentDate, 'draft', seasonStartYear);
  const collegeFAReached = hasReachedPhase(currentDate, 'college_fa', seasonStartYear);
  
  // Extract data safely (with defaults)
  const lotteryData = draftData?.lottery || null;
  const userPickData = draftData?.userPick || null;
  const resultsData = draftData?.results || null;
  
  const prospects = userPickData?.prospects || [];
  const roster = userPickData?.roster || [];
  const results = resultsData?.results || [];
  const userTeamId = resultsData?.userTeamId || lotteryData?.userTeamId;
  
  // All useMemo hooks at top level
  const filteredProspects = useMemo(() => {
    let list = posFilter === 'ALL' ? [...prospects] : prospects.filter(p => p.position === posFilter);
    if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'age') list.sort((a, b) => a.age - b.age);
    return list;
  }, [prospects, posFilter, sortBy]);
  
  const round1 = useMemo(() => results.filter(r => r.round === 1), [results]);
  const comp = useMemo(() => results.filter(r => r.round === 'Comp'), [results]);
  const round2 = useMemo(() => results.filter(r => r.round === 2), [results]);
  const userPicks = useMemo(() => results.filter(r => r.teamId === userTeamId), [results, userTeamId]);
  
  // Rating color helper
  const rc = (r) => r >= 80 ? 'var(--color-rating-elite)' : r >= 70 ? 'var(--color-rating-good)' : r >= 60 ? 'var(--color-rating-avg)' : 'var(--color-rating-poor)';
  
  // ─── RENDER ───────────────────────────────────────────────────────────────
  
  // Not yet draft date
  if (!draftReached) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-4)' }}>Draft</h2>
        <div style={{ padding: 40, background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
            {userTier === 1 ? 'The draft will take place on June 15' : 'College Graduate FA will open on June 22'}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
            Use the Sim controls on the Dashboard to advance time
          </div>
        </div>
      </div>
    );
  }
  
  // Waiting for draft data to load
  if (!draftData || draftPhase === 'waiting') {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-4)' }}>Draft</h2>
        <div style={{ padding: 40, background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-tertiary)' }}>
            Draft data loading...
          </div>
        </div>
      </div>
    );
  }
  
  // Lottery results
  if (draftPhase === 'lottery' && lotteryData) {
    const { lotteryResults = [] } = lotteryData;
    const top4 = lotteryResults.slice(0, 4);
    const remaining = lotteryResults.slice(4);
    const userResult = lotteryResults.find(r => r.team.id === userTeamId);
    
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-4)' }}>
          Draft Lottery Results
        </h2>
        
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center', marginBottom: 16 }}>
          14 teams competed for the top 4 picks
        </div>
        
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-tier1)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Lottery Winners
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {top4.map(result => (
            <LotteryCard key={result.pick} result={result} isUser={result.team.id === userTeamId} />
          ))}
        </div>
        
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Remaining Picks
        </div>
        <div style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)', marginBottom: 16 }}>
          {remaining.map(result => (
            <div key={result.pick} style={{
              display: 'flex', alignItems: 'center', padding: '6px 12px',
              borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--text-sm)',
              background: result.team.id === userTeamId ? 'var(--color-accent-bg)' : 'transparent',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text-tertiary)', width: 40 }}>{result.pick}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{result.team.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{result.team.wins}–{result.team.losses}</span>
            </div>
          ))}
        </div>
        
        {userResult && (
          <div style={{
            padding: '14px 16px', background: 'var(--color-accent-bg)',
            border: '1px solid var(--color-accent-border)', textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 700 }}>
              {userResult.pick <= 4 ? `You won the #${userResult.pick} pick` : `You have the #${userResult.pick} pick`}
            </div>
          </div>
        )}
        
        {/* Continue to Draft button */}
        <button
          onClick={() => {
            // Close lottery and start draft via DraftController
            if (window.closeLotteryModal) {
              window.closeLotteryModal();
            }
          }}
          style={{
            width: '100%',
            padding: '14px 20px',
            background: 'var(--color-accent)',
            border: 'none',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--color-text-inverse)',
            cursor: 'pointer',
          }}
        >
          Continue to Draft
        </button>
      </div>
    );
  }
  
  // User draft pick
  if (draftPhase === 'picking' && userPickData) {
    const { pickNumber, roundText } = userPickData;
    
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Your Pick</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>Make Your Selection</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>#{pickNumber}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{roundText}</div>
          </div>
        </div>
        
        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 4 }}>Pos</span>
            {POSITIONS.map(pos => (
              <button key={pos} onClick={() => setPosFilter(pos)} style={{
                padding: '3px 10px', fontSize: 'var(--text-xs)', border: 'none',
                background: posFilter === pos ? 'var(--color-accent)' : 'transparent',
                color: posFilter === pos ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                fontWeight: posFilter === pos ? 600 : 400, fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}>{pos === 'ALL' ? 'All' : pos}</button>
            ))}
          </div>
        </div>
        
        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 'var(--gap)' }}>
          {/* Prospects */}
          <div style={{ background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)' }}>
            {filteredProspects.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 40, fontSize: 'var(--text-sm)' }}>No prospects match your filters</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ ...thS, paddingLeft: 16, textAlign: 'left' }}>Prospect</th>
                    <th style={thS}>Pos</th>
                    <th style={thS}>Age</th>
                    <th style={thS}>OVR</th>
                    <th style={{ ...thS, paddingRight: 16 }}>Pot</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProspects.map((p, i) => (
                    <tr key={p.id || i}
                      onClick={() => window.selectDraftProspect?.(p.id)}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer',
                        background: 'var(--color-bg-raised)', transition: 'background 100ms ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-accent-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg-raised)'}
                    >
                      <td style={{ padding: '10px 12px 10px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{p.college || ''}</div>
                      </td>
                      <td style={{ ...tdC, fontWeight: 500, fontSize: 'var(--text-xs)' }}>{p.position}</td>
                      <td style={{ ...tdC, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{p.age}</td>
                      <td style={{ ...tdC, fontFamily: 'var(--font-mono)', fontWeight: 700, color: rc(p.rating) }}>{p.rating}</td>
                      <td style={{ ...tdC, paddingRight: 16, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{p.projectedCeiling || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Roster sidebar */}
          <DraftRosterSidebar roster={roster} getRatingColor={rc} />
        </div>
      </div>
    );
  }
  
  // Draft results
  if (draftPhase === 'results' && resultsData) {
    const tabs = [
      { key: 'round1', label: 'Round 1', count: round1.length },
      comp.length > 0 && { key: 'comp', label: 'Comp.', count: comp.length },
      { key: 'round2', label: 'Round 2', count: round2.length },
      { key: 'user', label: 'Your Picks', count: userPicks.length },
    ].filter(Boolean);
    
    const activeResults = resultsTab === 'round1' ? round1 : resultsTab === 'comp' ? comp : resultsTab === 'round2' ? round2 : userPicks;
    
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-4)' }}>Draft Results</h2>
        
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-sunken)', marginBottom: 16 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setResultsTab(t.key)} style={{
              padding: '10px 16px', border: 'none',
              borderBottom: resultsTab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
              background: 'transparent', color: resultsTab === t.key ? 'var(--color-text)' : 'var(--color-text-tertiary)',
              fontWeight: resultsTab === t.key ? 600 : 400, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t.label}
              <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--color-bg-sunken)', color: 'var(--color-text-tertiary)' }}>{t.count}</span>
            </button>
          ))}
        </div>
        
        {/* Results table */}
        <div style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)', marginBottom: 16 }}>
          {activeResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>No picks in this round.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ ...thS, paddingLeft: 16, textAlign: 'left', width: 44 }}>Pick</th>
                  <th style={{ ...thS, textAlign: 'left' }}>Player</th>
                  <th style={thS}>Pos</th>
                  <th style={thS}>Age</th>
                  <th style={{ ...thS, paddingRight: 16 }}>OVR</th>
                </tr>
              </thead>
              <tbody>
                {activeResults.map((result, i) => {
                  const isUser = result.teamId === userTeamId;
                  const p = result.player;
                  return (
                    <tr key={i} style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      background: isUser ? 'var(--color-accent-bg)' : 'transparent',
                      borderLeft: isUser ? '3px solid var(--color-accent)' : '3px solid transparent',
                    }}>
                      <td style={{ padding: '8px 8px 8px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>{result.pick}</td>
                      <td style={{ padding: 8 }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 1 }}>{result.teamName}</div>
                      </td>
                      <td style={{ ...tdC, fontWeight: 500, fontSize: 'var(--text-xs)' }}>{p.position}</td>
                      <td style={{ ...tdC, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{p.age}</td>
                      <td style={{ ...tdC, paddingRight: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, color: rc(p.rating) }}>{p.rating}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Info text instead of Continue button */}
        <div style={{ 
          padding: '12px 16px', 
          background: 'var(--color-bg-sunken)', 
          border: '1px solid var(--color-border-subtle)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
        }}>
          Draft complete. Free Agency opens on July 1 — use Sim controls to advance.
        </div>
      </div>
    );
  }
  
  return <PlaceholderScreen title="Draft" message="No draft data available" />;
}

function LotteryCard({ result, isUser }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      background: isUser ? 'var(--color-accent-bg)' : 'var(--color-bg-sunken)',
      border: isUser ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border-subtle)',
      borderLeft: `3px solid ${isUser ? 'var(--color-accent)' : 'var(--color-tier1)'}`,
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-tier1)', minWidth: 40, textAlign: 'center' }}>#{result.pick}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{result.team.name}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
          {result.team.wins}–{result.team.losses}
          {result.jumped && result.originalPosition && (
            <span style={{ color: 'var(--color-win)', marginLeft: 8, fontWeight: 600 }}>Jumped from #{result.originalPosition}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftRosterSidebar({ roster, getRatingColor }) {
  const rc = getRatingColor || ((r) => r >= 80 ? 'var(--color-rating-elite)' : r >= 70 ? 'var(--color-rating-good)' : r >= 60 ? 'var(--color-rating-avg)' : 'var(--color-rating-poor)');
  const posCounts = useMemo(() => {
    const counts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    (roster || []).forEach(p => { if (counts[p.position] !== undefined) counts[p.position]++; });
    return counts;
  }, [roster]);
  const topPlayers = useMemo(() => [...(roster || [])].sort((a, b) => b.rating - a.rating).slice(0, 8), [roster]);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{ background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', padding: '12px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Roster ({(roster || []).length}/15)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, textAlign: 'center' }}>
          {['PG', 'SG', 'SF', 'PF', 'C'].map(pos => (
            <div key={pos}>
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{pos}</div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: posCounts[pos] === 0 ? 'var(--color-loss)' : 'var(--color-text)' }}>{posCounts[pos]}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', padding: '12px 14px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Current Players</div>
        {topPlayers.map((p, i) => (
          <div key={p.id || i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--text-xs)', borderBottom: i < topPlayers.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
            <span><span style={{ fontWeight: 500 }}>{p.name}</span><span style={{ color: 'var(--color-text-tertiary)', marginLeft: 4 }}>{p.position}</span></span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: rc(p.rating) }}>{p.rating}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Development Screen ──────────────────────────────────────────────────────
function DevelopmentScreen({ devData, currentDate, seasonStartYear }) {
  const { gameState } = useGame();
  const [tab, setTab] = useState('summary');
  
  const raw = gameState?._raw || gameState;
  
  // Check if development date has been reached (Aug 1)
  const devReached = hasReachedPhase(currentDate, 'development', seasonStartYear);
  
  // Not yet development date
  if (!devReached) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-4)' }}>Player Development</h2>
        <div style={{ padding: 40, background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
            Development reports will be available on August 1
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
            Use the Sim controls on the Dashboard to advance time
          </div>
        </div>
      </div>
    );
  }
  
  if (!devData) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-4)' }}>Player Development</h2>
        <div style={{ padding: 40, background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-tertiary)' }}>
            Loading development report...
          </div>
        </div>
      </div>
    );
  }
  
  const { improvements = [], declines = [], userRetirements = [], notableRetirements = [], allRetirementsCount = 0 } = devData;
  const hasContent = improvements.length > 0 || declines.length > 0 || userRetirements.length > 0 || notableRetirements.length > 0;
  
  const tabs = [
    { key: 'summary', label: 'Summary' },
    improvements.length > 0 && { key: 'improved', label: 'Improved', count: improvements.length, color: 'var(--color-win)' },
    declines.length > 0 && { key: 'declined', label: 'Declined', count: declines.length, color: 'var(--color-loss)' },
    (userRetirements.length > 0 || notableRetirements.length > 0) && { key: 'retired', label: 'Retired', count: allRetirementsCount || notableRetirements.length, color: 'var(--color-warning)' },
  ].filter(Boolean);
  
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-4)' }}>Player Development Report</h2>
      
      {/* Tabs */}
      {tabs.length > 1 && (
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-sunken)', marginBottom: 16 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '10px 16px', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
              background: 'transparent', color: tab === t.key ? 'var(--color-text)' : 'var(--color-text-tertiary)',
              fontWeight: tab === t.key ? 600 : 400, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t.label}
              {t.count != null && <span style={{ fontSize: 10, padding: '1px 6px', background: tab === t.key ? `${t.color}15` : 'var(--color-bg-sunken)', color: tab === t.key ? t.color : 'var(--color-text-tertiary)' }}>{t.count}</span>}
            </button>
          ))}
        </div>
      )}
      
      {!hasContent ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)' }}>No significant player changes this offseason.</div>
      ) : (
        <>
          {tab === 'summary' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)', marginBottom: 20 }}>
                <DevMetricBox label="Improved" value={improvements.length} color="var(--color-win)" />
                <DevMetricBox label="Declined" value={declines.length} color="var(--color-loss)" />
                <DevMetricBox label="Retired" value={allRetirementsCount} color="var(--color-warning)" />
              </div>
              {userRetirements.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Your Team — Retirements</div>
                  {userRetirements.map((r, i) => <DevPlayerRow key={i} player={r} type="retired" />)}
                </>
              )}
            </div>
          )}
          {tab === 'improved' && improvements.map((p, i) => <DevPlayerRow key={i} player={p} type="improved" />)}
          {tab === 'declined' && declines.map((p, i) => <DevPlayerRow key={i} player={p} type="declined" />)}
          {tab === 'retired' && [...userRetirements, ...notableRetirements].map((p, i) => <DevPlayerRow key={i} player={p} type="retired" />)}
        </>
      )}
    </div>
  );
}

function DevMetricBox({ label, value, color }) {
  return (
    <div style={{ padding: '12px 14px', background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function DevPlayerRow({ player, type }) {
  const p = player;
  const color = type === 'improved' ? 'var(--color-win)' : type === 'declined' ? 'var(--color-loss)' : 'var(--color-warning)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-raised)' }}>
      <div>
        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{p.name}</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 8 }}>{p.position} · {p.age}yo</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color }}>
        {type === 'retired' ? 'Retired' : `${p.oldRating || p.rating} → ${p.newRating || p.rating}`}
      </div>
    </div>
  );
}

// ─── Contracts Screen ────────────────────────────────────────────────────────
function ContractsScreen({ contractData }) {
  const { gameState } = useGame();
  const [decisions, setDecisions] = useState({});
  
  const raw = gameState?._raw || gameState;
  
  if (!contractData) {
    return (
      <PlaceholderScreen
        title="Contract Decisions"
        message="Contract decisions will appear when players have expiring contracts"
      />
    );
  }
  
  const { players = [], capSpace, rosterCount, formatCurrency, getRatingColor, determineContractLength } = contractData;
  const fc = formatCurrency || ((v) => '$' + (v / 1e6).toFixed(1) + 'M');
  const rc = getRatingColor || ((r) => r >= 80 ? 'var(--color-rating-elite)' : r >= 70 ? 'var(--color-rating-good)' : r >= 60 ? 'var(--color-rating-avg)' : 'var(--color-rating-poor)');
  
  const resignedSalary = players.filter(p => decisions[p.id] === 'resign').reduce((sum, p) => sum + (p.salary || 0), 0);
  const resignedCount = Object.values(decisions).filter(d => d === 'resign').length;
  const releasedCount = Object.values(decisions).filter(d => d === 'release').length;
  const remainingCap = capSpace - resignedSalary;
  const decidedAll = Object.keys(decisions).length === players.length;
  
  const toggle = (playerId, action) => {
    setDecisions(prev => ({ ...prev, [playerId]: action }));
  };
  
  const handleConfirm = () => {
    if (!decidedAll) { alert('Please make a decision for all players.'); return; }
    window._confirmContractDecisions?.(decisions);
  };
  
  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-4)' }}>Contract Decisions</h2>
      
      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '12px 20px', background: 'var(--color-bg-sunken)', borderBottom: '1px solid var(--color-border)', marginBottom: 16 }}>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Expiring</div><div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-warning)' }}>{players.length}</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Cap Space</div><div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: remainingCap >= 0 ? 'var(--color-text)' : 'var(--color-loss)' }}>{fc(remainingCap)}</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>After</div><div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{rosterCount + resignedCount}</div></div>
      </div>
      
      {/* Player cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {players.map(player => {
          const decision = decisions[player.id];
          const newYears = determineContractLength ? determineContractLength(player.age, player.rating) : 2;
          const canAfford = player.salary <= remainingCap || decision === 'resign';
          
          return (
            <div key={player.id} style={{
              padding: '12px 14px', background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)',
              borderLeft: decision === 'resign' ? '3px solid var(--color-win)' : decision === 'release' ? '3px solid var(--color-loss)' : '3px solid transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{player.name}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 8 }}>{player.position} · {player.age}yo</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 'var(--text-xs)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: rc(player.rating) }}>{player.rating}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{fc(player.salary)}/yr</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button onClick={() => toggle(player.id, 'resign')} disabled={!canAfford && decision !== 'resign'} style={{
                  padding: 6, border: 'none', cursor: !canAfford && decision !== 'resign' ? 'not-allowed' : 'pointer',
                  opacity: !canAfford && decision !== 'resign' ? 0.3 : 1,
                  background: decision === 'resign' ? 'var(--color-win)' : 'var(--color-win-bg)',
                  color: decision === 'resign' ? 'var(--color-text-inverse)' : 'var(--color-win)',
                  fontWeight: 600, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-body)',
                }}>Re-sign ({newYears}yr)</button>
                <button onClick={() => toggle(player.id, 'release')} style={{
                  padding: 6, border: 'none', cursor: 'pointer',
                  background: decision === 'release' ? 'var(--color-loss)' : 'var(--color-loss-bg)',
                  color: decision === 'release' ? 'var(--color-text-inverse)' : 'var(--color-loss)',
                  fontWeight: 600, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-body)',
                }}>Release</button>
              </div>
            </div>
          );
        })}
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <button onClick={handleConfirm} disabled={!decidedAll} style={{
          padding: '12px 32px', background: decidedAll ? 'var(--color-accent)' : 'var(--color-bg-sunken)',
          border: 'none', color: decidedAll ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)',
          fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)', fontFamily: 'var(--font-body)',
          cursor: decidedAll ? 'pointer' : 'not-allowed',
        }}>Confirm Decisions</button>
      </div>
    </div>
  );
}

function TradesScreen() {
  return (
    <PlaceholderScreen
      title="Trades"
      message="Trade center — use Propose Trade button on dashboard"
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
  
  // ─── Offseason data state (intercept modal data, render inline) ────────────
  // Free Agency
  const [faData, setFaData] = useState(null);
  const [faPhase, setFaPhase] = useState('select');
  
  // Draft (lottery, user pick, results)
  const [draftData, setDraftData] = useState(null);
  const [draftPhase, setDraftPhase] = useState('waiting'); // waiting, lottery, picking, results
  
  // College Grad FA
  const [cgfaData, setCgfaData] = useState(null);
  const [cgfaPhase, setCgfaPhase] = useState('waiting');
  
  // Player Development
  const [devData, setDevData] = useState(null);
  
  // Contract Decisions
  const [contractData, setContractData] = useState(null);
  
  // Compliance (roster cuts)
  const [complianceData, setComplianceData] = useState(null);
  
  // Training Camp
  const [trainingCampData, setTrainingCampData] = useState(null);

  // Get current offseason state
  const raw = gameState?._raw || gameState;
  const currentPhase = raw?.offseasonPhase || 'free_agency';
  const currentDate = raw?.currentDate;
  const seasonStartYear = raw?.seasonStartYear || raw?.currentSeason;
  const userTier = raw?.currentTier || raw?.userTeam?.tier || 1;

  // Determine if we're in training camp mode
  const inCamp = hasReachedPhase(currentDate, 'training_camp', seasonStartYear, userTier) &&
                 !hasReachedPhase(currentDate, 'season_start', seasonStartYear, userTier);

  // ─── Initialize offseason data on mount ──────────────────────────────────────
  useEffect(() => {
    // Generate sponsor offers if not already present
    const userTeam = gameState?.userTeam;
    if (userTeam && engines?.FinanceEngine) {
      engines.FinanceEngine.ensureFinances(userTeam);
      const pendingOffers = userTeam.finances?.pendingSponsorOffers || [];
      console.log('📋 [OFFSEASON-HUB] Current pending offers:', pendingOffers.length);
      if (pendingOffers.length === 0 && engines?.OwnerEngine) {
        console.log('📋 [OFFSEASON-HUB] Generating sponsor offers...');
        engines.OwnerEngine.generateSponsorOffers(userTeam);
        console.log('📋 [OFFSEASON-HUB] After generation:', userTeam.finances?.pendingSponsorOffers?.length || 0);
        // Trigger a refresh so components see the new offers
        if (refresh) refresh();
      }
    }
  }, [gameState?.userTeam, engines?.FinanceEngine, engines?.OwnerEngine, refresh]);

  // ─── Intercept all offseason modal calls ───────────────────────────────────
  useEffect(() => {
    // Store original functions
    const originals = {
      showFA: window._reactShowFA,
      showLottery: window._reactShowLottery,
      showUserPick: window._reactShowUserPick,
      showDraftResults: window._reactShowDraftResults,
      showCGFA: window._reactShowCGFA,
      showCG: window._reactShowCG,
      showDevelopment: window._reactShowDevelopment,
      showContractDecisions: window._reactShowContractDecisions,
      showCompliance: window._reactShowCompliance,
      showTrainingCamp: window._reactShowTrainingCamp,
    };
    
    // Free Agency
    window._reactShowFA = (faDataFromController) => {
      console.log('🌴 [OFFSEASON-HUB] Intercepting FA data');
      setFaData(faDataFromController);
      setFaPhase(faDataFromController?.phase || 'select');
      setActiveScreen('freeagency');
    };
    
    // Draft Lottery
    window._reactShowLottery = (lotteryData) => {
      console.log('🎰 [OFFSEASON-HUB] Intercepting lottery data');
      setDraftData(prev => ({ ...prev, lottery: lotteryData }));
      setDraftPhase('lottery');
      setActiveScreen('draft');
    };
    
    // User Draft Pick
    window._reactShowUserPick = (pickData) => {
      console.log('🏀 [OFFSEASON-HUB] Intercepting user pick data');
      setDraftData(prev => ({ ...prev, userPick: pickData }));
      setDraftPhase('picking');
      setActiveScreen('draft');
    };
    
    // Draft Results
    window._reactShowDraftResults = (resultsData) => {
      console.log('📋 [OFFSEASON-HUB] Intercepting draft results');
      setDraftData(prev => ({ ...prev, results: resultsData }));
      setDraftPhase('results');
      setActiveScreen('draft');
    };
    
    // College Grad FA (intercept both naming conventions)
    window._reactShowCGFA = (cgfaDataFromController) => {
      console.log('🎓 [OFFSEASON-HUB] Intercepting CGFA data');
      setCgfaData(cgfaDataFromController);
      setCgfaPhase(cgfaDataFromController?.phase || 'select');
      setActiveScreen('freeagency'); // Show in FA screen since it's similar
    };
    window._reactShowCG = (cgfaDataFromController) => {
      console.log('🎓 [OFFSEASON-HUB] Intercepting CG data (from DraftController)');
      setCgfaData(cgfaDataFromController);
      setCgfaPhase(cgfaDataFromController?.phase || 'select');
      setActiveScreen('freeagency');
    };
    
    // Player Development
    window._reactShowDevelopment = (devDataFromController) => {
      console.log('📈 [OFFSEASON-HUB] Intercepting development data');
      setDevData(devDataFromController);
      setActiveScreen('development');
    };
    
    // Contract Decisions
    window._reactShowContractDecisions = (contractDataFromController) => {
      console.log('📝 [OFFSEASON-HUB] Intercepting contract decisions');
      setContractData(contractDataFromController);
      setActiveScreen('contracts');
    };
    
    // Compliance
    window._reactShowCompliance = (complianceDataFromController) => {
      console.log('✂️ [OFFSEASON-HUB] Intercepting compliance data');
      setComplianceData(complianceDataFromController);
      setActiveScreen('roster'); // Show on roster screen
    };
    
    // Training Camp
    window._reactShowTrainingCamp = (campData) => {
      console.log('⛺ [OFFSEASON-HUB] Intercepting training camp data');
      setTrainingCampData(campData);
      setActiveScreen('trainingcamp');
    };

    // Cleanup
    return () => {
      window._reactShowFA = originals.showFA;
      window._reactShowLottery = originals.showLottery;
      window._reactShowUserPick = originals.showUserPick;
      window._reactShowDraftResults = originals.showDraftResults;
      window._reactShowCGFA = originals.showCGFA;
      window._reactShowCG = originals.showCG;
      window._reactShowDevelopment = originals.showDevelopment;
      window._reactShowContractDecisions = originals.showContractDecisions;
      window._reactShowCompliance = originals.showCompliance;
      window._reactShowTrainingCamp = originals.showTrainingCamp;
    };
  }, []);

  // Screen components map
  const screens = useMemo(() => ({
    dashboard: (
      <OffseasonDashboard
        onNavigate={setActiveScreen}
        gameState={gameState}
        engines={engines}
      />
    ),
    roster: <RosterScreen complianceData={complianceData} />,
    draft: (
      <DraftScreen 
        draftData={draftData}
        draftPhase={draftPhase}
        setDraftPhase={setDraftPhase}
        currentDate={currentDate}
        seasonStartYear={seasonStartYear}
      />
    ),
    freeagency: (
      <FreeAgencyScreen 
        faData={faData} 
        faPhase={faPhase}
        cgfaData={cgfaData}
        cgfaPhase={cgfaPhase}
        currentDate={currentDate}
        seasonStartYear={seasonStartYear}
        onCgfaComplete={() => {
          setCgfaData(null);
          setCgfaPhase('waiting');
          setActiveScreen('dashboard');
        }}
        onFaComplete={() => {
          setFaData(null);
          setFaPhase('waiting');
          setActiveScreen('dashboard');
        }}
      />
    ),
    development: (
      <DevelopmentScreen 
        devData={devData}
        currentDate={currentDate}
        seasonStartYear={seasonStartYear}
      />
    ),
    contracts: (
      <ContractsScreen contractData={contractData} />
    ),
    trades: <TradesScreen />,
    scouting: <ScoutingScreen />,
    coach: <CoachScreen />,
    finances: <FinancesScreen isOffseason={true} onNavigate={setActiveScreen} />,
    history: <HistoryScreen />,
    glossary: <GlossaryScreen />,
    trainingcamp: <TrainingCampScreen campData={trainingCampData} onNavigate={setActiveScreen} />,
    invites: <CampInvitesScreen onNavigate={setActiveScreen} />,
    focuses: <FocusAssignmentScreen />,
  }), [gameState, engines, faData, faPhase, cgfaData, cgfaPhase, draftData, draftPhase, devData, contractData, complianceData, trainingCampData, currentDate, seasonStartYear]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
    }}>
      {/* Phase Tracker */}
      <OffseasonPhaseTracker currentDate={currentDate} seasonStartYear={seasonStartYear} />

      {/* Sidebar + Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <OffseasonSidebar
          activeScreen={activeScreen}
          onNavigate={setActiveScreen}
          inCamp={inCamp}
        />
        <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {screens[activeScreen] || (inCamp ? screens.trainingcamp : screens.dashboard)}
        </main>
      </div>
    </div>
  );
}
