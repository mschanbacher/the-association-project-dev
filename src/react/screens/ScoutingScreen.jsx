import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card, CardHeader } from '../components/Card.jsx';
import { Badge, RatingBadge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';
import { SparklineGrid } from '../visualizations/SparklineComponents.jsx';
import {
  HEX_AXES, hexComponentsFromAnalytics, hexComponentsFromProfile,
  HexChart, HexAxisTooltip, HexBreakdown, MiniHex,
  SectionLabel, ratingColor,
  MIN_GAMES_PERCENTILE,
  LeaguePercentileSection, PlayerStatGrid, AttrBars,
} from '../visualizations/PlayerVisuals.jsx';

/* ═══════════════════════════════════════════════════════════════
   Scouting Screen — 4 tabs: Scanner, Pipeline, Watch List, Needs
   ═══════════════════════════════════════════════════════════════ */
export function ScoutingScreen() {
  const { gameState, engines, isReady } = useGame();
  const [activeTab, setActiveTab] = useState('scanner');

  if (!isReady || !gameState?.userTeam) {
    return <Loader text="Loading scouting…" />;
  }

  const tabs = [
    { id: 'scanner',   label: 'League Scanner' },
    { id: 'pipeline',  label: 'Draft Pipeline'  },
    { id: 'watchlist', label: 'Watch List'       },
    { id: 'needs',     label: 'Team Needs'       },
  ];

  return (
    <div style={{
      maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-6)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>
        Scouting
      </h2>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--color-bg-sunken)', padding: 2 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '8px 12px',
            border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)', fontWeight: activeTab === tab.id ? 'var(--weight-semi)' : 'var(--weight-normal)',
            background: activeTab === tab.id ? 'var(--color-bg-raised)' : 'transparent',
            color: activeTab === tab.id ? 'var(--color-text)' : 'var(--color-text-tertiary)',
            boxShadow: activeTab === tab.id ? 'var(--shadow-xs)' : 'none',
            transition: 'all var(--duration-fast) ease' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'scanner'   && <ScannerTab   gameState={gameState} engines={engines} />}
      {activeTab === 'pipeline'  && <PipelineTab  gameState={gameState} engines={engines} />}
      {activeTab === 'watchlist' && <WatchListTab gameState={gameState} engines={engines} />}
      {activeTab === 'needs'     && <NeedsTab     gameState={gameState} engines={engines} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function getAllLeaguePlayers(gameState) {
  const all = [];
  const raw = gameState._raw || gameState;
  [...(raw.tier1Teams || []), ...(raw.tier2Teams || []), ...(raw.tier3Teams || [])].forEach(team => {
    (team.roster || []).forEach(p => {
      all.push({ ...p, _teamName: team.name, _teamTier: team.tier, _teamId: team.id });
    });
  });
  return all;
}

function calculateTeamFit(player, userTeam, coach, engines) {
  const SE = engines?.ScoutingEngine || window.ScoutingEngine;
  if (SE?.calculateTeamFit) return SE.calculateTeamFit(player, userTeam, coach);
  const posCount = (userTeam.roster || []).filter(p => p.position === player.position).length;
  const needBonus = posCount === 0 ? 20 : posCount === 1 ? 10 : 0;
  const combined = Math.round(Math.min(100, (player.rating || 60) + needBonus) * 0.7 + 50 * 0.3);
  let grade;
  if (combined >= 82) grade = 'A';
  else if (combined >= 70) grade = 'B';
  else if (combined >= 55) grade = 'C';
  else if (combined >= 40) grade = 'D';
  else grade = 'F';
  return { combined, grade,
    systemFit: { score: 50, grade: 'C', details: [] },
    roleFit: { score: 50, label: '—' },
    chemFit: { score: 50, label: '—', details: [] } };
}

function gradeColor(grade) {
  if (!grade) return 'var(--color-text-tertiary)';
  if (grade.startsWith('A')) return 'var(--color-win)';
  if (grade.startsWith('B')) return 'var(--color-info)';
  if (grade.startsWith('C')) return 'var(--color-warning)';
  return 'var(--color-loss)';
}

function fmtCurrency(amount) {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return '$' + Math.round(amount / 1000) + 'K';
  return '$' + amount;
}

function getWatchList(gameState) {
  return gameState._raw?.scoutingWatchList || [];
}

function isOnWatchList(gameState, playerId) {
  return getWatchList(gameState).some(w => String(w.id) === String(playerId));
}

function enrichPlayer(p, StatEngine) {
  const avgs      = StatEngine?.getSeasonAverages?.(p) || null;
  const analytics = StatEngine?.getPlayerAnalytics?.(p, null) || null;
  const hexObj    = analytics
    ? hexComponentsFromAnalytics(analytics, avgs)
    : hexComponentsFromProfile(p);
  const hex = hexObj
    ? HEX_AXES.map(ax => ({ label: ax.short, value: hexObj[ax.key] ?? 0, max: ax.max }))
    : null;
  return { ...p, _avgs: avgs, _analytics: analytics, _hexObj: hexObj, _hex: hex };
}

function buildTierPool(allTierTeams, StatEngine) {
  const pool = [];
  (allTierTeams || []).forEach(t => {
    (t.roster || []).forEach(p => {
      if (!p.seasonStats || p.seasonStats.gamesPlayed < MIN_GAMES_PERCENTILE) return;
      const a = StatEngine?.getSeasonAverages?.(p);
      if (a) pool.push({ pos: p.position, avgs: a });
    });
  });
  return pool;
}

/* ═══════════════════════════════════════════════════════════════
   TAB 1: League Scanner  — two-panel layout matching PlayerBrowseModal
   ═══════════════════════════════════════════════════════════════ */
const POSITIONS = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];

function ScannerTab({ gameState, engines }) {
  const { StatEngine } = engines;
  const [posFilter, setPosFilter]             = useState('ALL');
  const [search, setSearch]                   = useState('');
  const [sortKey, setSortKey]                 = useState('fit');
  const [sortDir, setSortDir]                 = useState('desc');
  const [tierFilter, setTierFilter]           = useState('ALL');
  const [contractFilter, setContractFilter]   = useState('ALL');
  const [minRating, setMinRating]             = useState('');
  const [maxRating, setMaxRating]             = useState('');
  const [expandedLeftId, setExpandedLeftId]   = useState(null);
  const [expandedRightId, setExpandedRightId] = useState(null);
  const [watchVersion, setWatchVersion]       = useState(0);

  const userTeam    = gameState.userTeam;
  const coach       = userTeam.coach;
  const currentTier = gameState.currentTier || 1;
  const raw         = gameState._raw || gameState;

  const allTierTeams = useMemo(() => [
    ...(raw.tier1Teams || []), ...(raw.tier2Teams || []), ...(raw.tier3Teams || [])
  ], [raw]);

  const tierPool = useMemo(() => buildTierPool(allTierTeams, StatEngine), [allTierTeams, StatEngine]);

  // Enrich user roster
  const userRosterEnriched = useMemo(() =>
    [...(userTeam.roster || [])]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .map(p => enrichPlayer(p, StatEngine)),
    [userTeam.roster, StatEngine]);

  // Enrich + filter league players
  const allLeaguePlayers = useMemo(() => getAllLeaguePlayers(gameState), [gameState]);

  const leagueEnriched = useMemo(() =>
    allLeaguePlayers
      .filter(p => p._teamId !== userTeam.id)
      .map(p => enrichPlayer(p, StatEngine)),
    [allLeaguePlayers, userTeam.id, StatEngine]);

  const filtered = useMemo(() => {
    let list = leagueEnriched;
    if (posFilter !== 'ALL')    list = list.filter(p => p.position === posFilter);
    if (tierFilter !== 'ALL')   list = list.filter(p => String(p._teamTier) === tierFilter);
    if (minRating)              list = list.filter(p => (p.rating || 0) >= parseInt(minRating));
    if (maxRating)              list = list.filter(p => (p.rating || 0) <= parseInt(maxRating));
    if (contractFilter === 'expiring') list = list.filter(p => p.contractYears <= 1);
    if (contractFilter === 'short')    list = list.filter(p => p.contractYears <= 2);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p._teamName?.toLowerCase().includes(q));
    }
    // Attach fit scores
    list.forEach(p => { if (!p._fit) p._fit = calculateTeamFit(p, userTeam, coach, engines); });

    return [...list].sort((a, b) => {
      let va, vb;
      switch (sortKey) {
        case 'fit':    va = a._fit?.combined || 0; vb = b._fit?.combined || 0; break;
        case 'ppg':    va = a._avgs?.pointsPerGame   || 0; vb = b._avgs?.pointsPerGame   || 0; break;
        case 'rpg':    va = a._avgs?.reboundsPerGame || 0; vb = b._avgs?.reboundsPerGame || 0; break;
        case 'apg':    va = a._avgs?.assistsPerGame  || 0; vb = b._avgs?.assistsPerGame  || 0; break;
        case 'age':    va = a.age    || 0; vb = b.age    || 0; break;
        case 'salary': va = a.salary || 0; vb = b.salary || 0; break;
        default:       va = a.rating || 0; vb = b.rating || 0;
      }
      return sortDir === 'desc' ? vb - va : va - vb;
    }).slice(0, 120);
  }, [leagueEnriched, posFilter, tierFilter, minRating, maxRating, contractFilter, search, sortKey, sortDir, userTeam, coach, engines]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const toggleWatch = useCallback((playerId) => {
    if (isOnWatchList(gameState, playerId)) {
      window.removeFromWatchList?.(playerId);
    } else {
      window.addToWatchList?.(playerId);
    }
    setWatchVersion(v => v + 1);
  }, [gameState]);

  const userPosCounts = useMemo(() => {
    const c = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    (userTeam.roster || []).forEach(p => { if (c[p.position] != null) c[p.position]++; });
    return c;
  }, [userTeam.roster]);

  const totalSalary  = (userTeam.roster || []).reduce((s, p) => s + (p.salary || 0), 0);
  const cap          = userTeam.salaryCap || (currentTier === 1 ? 136000000 : currentTier === 2 ? 85000000 : 55000000);
  const capRemaining = cap - totalSalary;
  const fc = window.formatCurrency || fmtCurrency;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 0,
      border: '1px solid var(--color-border)', background: 'var(--color-bg-raised)',
      height: '78vh', overflow: 'hidden' }}>

      {/* ══ LEFT: Your Roster ══ */}
      <div style={{ borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--color-border-subtle)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Your Roster <span style={{ fontWeight: 400 }}>{userTeam.roster?.length || 0}/15</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', textAlign: 'center', marginBottom: 6 }}>
            {['PG','SG','SF','PF','C'].map(pos => (
              <div key={pos}>
                <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>{pos}</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: userPosCounts[pos] === 0 ? 'var(--color-loss)' : 'var(--color-text)' }}>{userPosCounts[pos]}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
            Cap: <strong style={{ fontFamily: 'var(--font-mono)', color: capRemaining < 0 ? 'var(--color-loss)' : 'var(--color-text)' }}>{fc(capRemaining)}</strong>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {userRosterEnriched.map(p => (
            <div key={p.id}>
              <RosterRowLeft
                player={p} fc={fc}
                expanded={expandedLeftId === p.id}
                onToggle={() => setExpandedLeftId(prev => prev === p.id ? null : p.id)}
              />
              {expandedLeftId === p.id && (
                <PlayerDetailCompact player={p} tierPool={tierPool} currentTier={currentTier} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ══ RIGHT: League Players ══ */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          {/* Row 1: pos + tier + contract */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 1 }}>
              {POSITIONS.map(pos => (
                <button key={pos} onClick={() => setPosFilter(pos)} style={{
                  padding: '3px 8px', fontSize: 10, border: 'none', cursor: 'pointer',
                  background: posFilter === pos ? 'var(--color-accent)' : 'transparent',
                  color: posFilter === pos ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                  fontWeight: posFilter === pos ? 600 : 400, fontFamily: 'var(--font-body)',
                }}>{pos === 'ALL' ? 'All' : pos}</button>
              ))}
            </div>
            <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">All Tiers</option>
              <option value="1">Tier 1</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
            </select>
            <select value={contractFilter} onChange={e => setContractFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">Any Contract</option>
              <option value="expiring">Expiring (1yr)</option>
              <option value="short">1–2yr</option>
            </select>
            <input value={minRating} onChange={e => setMinRating(e.target.value)} placeholder="Min OVR" type="number" style={{ ...inputStyle, width: 64 }} />
            <input value={maxRating} onChange={e => setMaxRating(e.target.value)} placeholder="Max OVR" type="number" style={{ ...inputStyle, width: 64 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / team…" style={{ ...inputStyle, width: 160, marginLeft: 'auto' }} />
          </div>
          {/* Row 2: sort buttons + count */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Sort</span>
            {[{key:'fit',label:'Fit'},{key:'rating',label:'OVR'},{key:'ppg',label:'PPG'},{key:'rpg',label:'RPG'},{key:'apg',label:'APG'},{key:'age',label:'Age'},{key:'salary',label:'Salary'}].map(s => (
              <button key={s.key} onClick={() => handleSort(s.key)} style={{
                padding: '3px 7px', fontSize: 10,
                border: `1px solid ${sortKey === s.key ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: sortKey === s.key ? 'var(--color-accent-bg)' : 'transparent',
                color: sortKey === s.key ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                fontWeight: sortKey === s.key ? 600 : 400, fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}>
                {s.label}{sortKey === s.key && <span style={{marginLeft:2,fontSize:7}}>{sortDir==='desc'?'▼':'▲'}</span>}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
              {filtered.length >= 120 ? '120+ results (showing top 120)' : `${filtered.length} players`}
            </span>
          </div>
        </div>

        {/* Player list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <EmptyState>No players match your filters</EmptyState>
          ) : filtered.map(p => (
            <div key={p.id}>
              <ScoutPlayerCard
                player={p} fc={fc}
                isWatched={isOnWatchList(gameState, p.id)}
                onWatch={() => toggleWatch(p.id)}
                userPosCounts={userPosCounts}
                expanded={expandedRightId === p.id}
                onToggle={() => setExpandedRightId(prev => prev === p.id ? null : p.id)}
                watchVersion={watchVersion}
              />
              {expandedRightId === p.id && (
                <PlayerDetailFull player={p} tierPool={tierPool} currentTier={currentTier} showFit fit={p._fit} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Scanner — Left panel roster row
   ═══════════════════════════════════════════════════════════════ */
function RosterRowLeft({ player: p, fc, expanded, onToggle }) {
  const rc  = ratingColor(p.rating || 0);
  const ppg = p._avgs?.pointsPerGame != null ? p._avgs.pointsPerGame.toFixed(1) : null;
  return (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 14px', borderBottom: '1px solid var(--color-border-subtle)',
      fontSize: 'var(--text-xs)', cursor: 'pointer',
      background: expanded ? 'var(--color-accent-bg)' : 'transparent',
      borderLeft: '3px solid transparent',
      transition: 'background 80ms',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: rc, flexShrink: 0, minWidth: 24 }}>{p.rating}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
          <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>{p.position} · {p.age}yo · {fc(p.salary || 0)}/{p.contractYears || 1}yr</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        {ppg && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>{ppg}</span>}
        <span style={{ fontSize: 8, color: 'var(--color-text-tertiary)' }}>{expanded ? '▲' : '▼'}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Scanner — Right panel player card
   ═══════════════════════════════════════════════════════════════ */
function ScoutPlayerCard({ player: p, fc, isWatched, onWatch, userPosCounts, expanded, onToggle }) {
  const rc       = ratingColor(p.rating || 0);
  const avgs     = p._avgs;
  const fit      = p._fit;
  const posCount = userPosCounts[p.position] || 0;
  const needsPos = posCount === 0;

  const ppg = avgs?.pointsPerGame  != null ? avgs.pointsPerGame.toFixed(1)  : '—';
  const rpg = avgs?.reboundsPerGame != null ? avgs.reboundsPerGame.toFixed(1) : '—';
  const apg = avgs?.assistsPerGame  != null ? avgs.assistsPerGame.toFixed(1)  : '—';

  return (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px', borderBottom: '1px solid var(--color-border-subtle)',
      cursor: 'pointer',
      background: isWatched ? 'rgba(212,168,67,0.05)' : expanded ? 'var(--color-accent-bg)' : 'transparent',
      transition: 'background 80ms',
    }}>
      {/* Rating */}
      <div style={{ minWidth: 30, textAlign: 'center', fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-mono)', color: rc, lineHeight: 1 }}>{p.rating || '—'}</div>

      {/* Identity */}
      <div style={{ minWidth: 160, flex: '0 0 auto' }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 1 }}>
          {p.name}{p.isCollegeGrad ? <span style={{ fontSize: 9, color: 'var(--color-accent)', marginLeft: 4 }}>CG</span> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-inverse)', background: 'var(--color-text-secondary)', padding: '1px 4px' }}>{p.position}</span>
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{p.age}yo</span>
          {needsPos && <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--color-win)', border: '1px solid var(--color-win)', padding: '1px 3px' }}>NEED</span>}
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>· T{p._teamTier} {p._teamName}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
          {fc(p.salary || 0)}/yr · {p.contractYears ?? '?'}yr
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '0 10px', borderLeft: '1px solid var(--color-border-subtle)', borderRight: '1px solid var(--color-border-subtle)' }}>
        <StatPill label="PPG" value={ppg} />
        <StatPill label="RPG" value={rpg} />
        <StatPill label="APG" value={apg} />
        {fit && <div style={{ textAlign: 'center', minWidth: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: gradeColor(fit.grade), lineHeight: 1.2 }}>{fit.grade}</div>
          <div style={{ fontSize: 8, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 1 }}>Fit</div>
        </div>}
      </div>

      {/* Mini hex */}
      <MiniHex components={p._hex} size={40} />

      {/* Watch + expand */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button onClick={e => { e.stopPropagation(); onWatch(); }} style={{
          padding: '3px 8px',
          border: `1px solid ${isWatched ? 'var(--color-accent)' : 'var(--color-border)'}`,
          background: isWatched ? 'var(--color-accent-bg)' : 'transparent',
          color: isWatched ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          fontWeight: isWatched ? 600 : 400, fontSize: 10,
          fontFamily: 'var(--font-body)', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>{isWatched ? '★ Watching' : '☆ Watch'}</button>
        <span style={{ fontSize: 8, color: 'var(--color-text-tertiary)' }}>{expanded ? '▲' : '▼'}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Compact detail (left panel — hex + arc)
   ═══════════════════════════════════════════════════════════════ */
function PlayerDetailCompact({ player: p, tierPool, currentTier }) {
  const [hoveredAxis, setHoveredAxis] = useState(null);
  const components = p._hexObj;
  if (!components) return null;
  return (
    <div style={{ padding: '12px 14px 16px', background: 'var(--color-accent-bg)', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', gap: 14, marginBottom: 10, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', color: ratingColor(p.rating), lineHeight: 1 }}>{p.rating}</div>
          <div style={{ fontSize: 8, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>OVR</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{p.offRating || '—'}</div>
          <div style={{ fontSize: 8, color: 'var(--color-text-tertiary)' }}>OFF</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{p.defRating || '—'}</div>
          <div style={{ fontSize: 8, color: 'var(--color-text-tertiary)' }}>DEF</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <HexChart components={components} size={155} hoveredAxis={hoveredAxis} onHoverAxis={setHoveredAxis} />
      </div>
      <HexBreakdown components={components} hoveredAxis={hoveredAxis} onHoverAxis={setHoveredAxis} />
      {p.gameLog && p.gameLog.length >= 3 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Season Arc</div>
          <SparklineGrid gameLog={p.gameLog} compact={true} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Full detail (right panel — stats + hex + percentiles + fit + arc + attrs)
   ═══════════════════════════════════════════════════════════════ */
function PlayerDetailFull({ player: p, tierPool, currentTier, showFit, fit }) {
  const [hoveredAxis, setHoveredAxis] = useState(null);
  const components   = p._hexObj;
  const avgs         = p._avgs;
  const analytics    = p._analytics;
  const isProjection = components?.isProjection;
  const total = components ? HEX_AXES.reduce((s, ax) => s + (components[ax.key] ?? 0), 0) : 0;

  const verdictColors = { great_deal:'var(--color-win)', good_value:'var(--color-win)', fair:'var(--color-text-secondary)', overpaid:'var(--color-loss)' };
  const verdictLabels = { great_deal:'Great Deal', good_value:'Good Value', fair:'Fair', overpaid:'Overpaid' };

  return (
    <div style={{ padding: '16px 20px 20px', background: 'var(--color-accent-bg)', borderBottom: '2px solid var(--color-border)' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 34, fontWeight: 700, fontFamily: 'var(--font-mono)', color: ratingColor(p.rating), lineHeight: 1 }}>{p.rating}</div>
          <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Overall</div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{p.offRating || '—'}</div>
            <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>OFF</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{p.defRating || '—'}</div>
            <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>DEF</div>
          </div>
        </div>
        {analytics?.role && <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{analytics.role}</div>}
        {/* Team fit badge if coming from scanner */}
        {showFit && fit && (
          <div style={{ display: 'flex', gap: 10, marginLeft: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: gradeColor(fit.grade) }}>{fit.grade}</div>
              <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>Fit</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: gradeColor(fit.systemFit?.grade) }}>{fit.systemFit?.grade || '—'}</div>
              <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>Sys</div>
            </div>
          </div>
        )}
        <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
            {window.formatCurrency?.(p.salary || 0) || fmtCurrency(p.salary || 0)} · {p.contractYears || 1}yr
          </div>
          {analytics?.contractVerdict && verdictLabels[analytics.contractVerdict] && (
            <div style={{ marginTop: 2, fontWeight: 600, fontSize: 11, color: verdictColors[analytics.contractVerdict] }}>{verdictLabels[analytics.contractVerdict]}</div>
          )}
          {p._teamName && <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>T{p._teamTier} {p._teamName}</div>}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}><PlayerStatGrid avgs={avgs} analytics={analytics} /></div>

      {components && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <SectionLabel style={{ marginBottom: 0 }}>Player Profile</SectionLabel>
            {isProjection && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-warning)', border: '1px solid var(--color-warning)', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pre-Season Projection</span>}
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <HexChart components={components} size={155} hoveredAxis={hoveredAxis} onHoverAxis={setHoveredAxis} />
              <div style={{ position: 'absolute', top: 0, left: 163, opacity: hoveredAxis !== null ? 1 : 0, pointerEvents: 'none', transition: 'opacity 100ms', zIndex: 10 }}>
                <HexAxisTooltip axis={hoveredAxis !== null ? HEX_AXES[hoveredAxis] : null} components={components} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <HexBreakdown components={components} hoveredAxis={hoveredAxis} onHoverAxis={setHoveredAxis} />
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1, color: total >= 60 ? 'var(--color-rating-elite)' : total >= 40 ? 'var(--color-rating-good)' : total >= 25 ? 'var(--color-rating-avg)' : 'var(--color-rating-poor)' }}>{total}</span>
                <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Value Score</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <LeaguePercentileSection avgs={avgs} tierPool={tierPool} playerPos={p.position} currentTier={currentTier} />
      </div>

      {p.gameLog && p.gameLog.length >= 3 && (
        <div style={{ marginBottom: 14 }}>
          <SectionLabel>Season Arc</SectionLabel>
          <SparklineGrid gameLog={p.gameLog} />
        </div>
      )}

      <AttrBars attributes={p.attributes} />

      {/* Fit details if available */}
      {showFit && fit && (fit.systemFit?.details?.length > 0 || fit.chemFit?.details?.length > 0) && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--color-bg-sunken)', borderTop: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Fit Analysis</div>
          {[...(fit.systemFit?.details || []), ...(fit.chemFit?.details || [])].map((d, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 3 }}>{d}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 2: Draft Pipeline  — self-contained, no legacy modal needed
   ═══════════════════════════════════════════════════════════════ */
function generatePipelinePreview(engines) {
  const TF = engines.TeamFactory || window.TeamFactory;
  const POSITIONS_LIST   = TF?.POSITIONS    || ['PG','SG','SF','PF','C'];
  const COLLEGE_LIST     = TF?.COLLEGE_NAMES || ['State University','City College','Tech University'];
  const FIRST_LIST       = TF?.FIRST_NAMES   || ['James','Kevin','Marcus','Tyler','Jordan'];
  const LAST_LIST        = TF?.LAST_NAMES    || ['Johnson','Williams','Brown','Davis','Wilson'];

  const rand = arr => arr[Math.floor(Math.random() * arr.length)];
  const classSize = 90 + Math.floor(Math.random() * 31);
  const prospects = [];

  for (let i = 0; i < classSize; i++) {
    const targetTier      = Math.random() < 0.30 ? 2 : 3;
    const position        = rand(POSITIONS_LIST);
    const college         = rand(COLLEGE_LIST);
    const name            = `${rand(FIRST_LIST)} ${rand(LAST_LIST)}`;
    const trueRating      = targetTier === 2
      ? Math.floor(58 + Math.random() * 20)
      : Math.floor(48 + Math.random() * 20);
    const scoutUncertainty = 8;
    const low             = Math.max(45, trueRating - scoutUncertainty);
    const high            = Math.min(85, trueRating + scoutUncertainty);
    const midEstimate     = Math.round((low + high) / 2);
    const potentialBoost  = Math.floor(3 + Math.random() * 12);
    prospects.push({
      name, position, college, age: 20, tier: targetTier,
      ratingLow: low, ratingHigh: high, midEstimate, trueRating,
      projectedCeiling: Math.min(92, trueRating + potentialBoost),
    });
  }
  prospects.sort((a, b) => b.midEstimate - a.midEstimate);
  return prospects;
}

function PipelineTab({ gameState, engines }) {
  const [posFilter, setPosFilter] = useState('ALL');
  const raw    = gameState._raw || gameState;
  const season = gameState.currentSeason;

  // Auto-generate if not yet populated — no legacy modal needed
  useEffect(() => {
    if (!raw._pipelinePreview || raw._pipelinePreviewSeason !== season) {
      const preview = generatePipelinePreview(engines);
      raw._pipelinePreview       = preview;
      raw._pipelinePreviewSeason = season;
    }
  }, [raw, season, engines]);

  const preview  = raw._pipelinePreview || [];
  const filtered = useMemo(() => {
    if (posFilter === 'ALL') return preview;
    return preview.filter(p => p.position === posFilter);
  }, [preview, posFilter]);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div>
          <div style={{ fontWeight: 'var(--weight-semi)' }}>
            Class of {(season || 0) + 2} · {preview.length} Prospects
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            Rating ranges narrow as the season progresses. Players enter College Grad FA next offseason.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 1 }}>
            {POSITIONS.map(pos => (
              <button key={pos} onClick={() => setPosFilter(pos)} style={{
                padding: '3px 8px', fontSize: 10, border: 'none', cursor: 'pointer',
                background: posFilter === pos ? 'var(--color-accent)' : 'transparent',
                color: posFilter === pos ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                fontWeight: posFilter === pos ? 600 : 400, fontFamily: 'var(--font-body)',
              }}>{pos === 'ALL' ? 'All' : pos}</button>
            ))}
          </div>
        </div>
      </div>

      <Card padding="none">
        <div style={{ overflowX: 'auto', maxHeight: '64vh', overflowY: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                <Th align="left">Prospect</Th>
                <Th align="left">College</Th>
                <Th width={44}>Pos</Th>
                <Th width={44}>Age</Th>
                <Th width={150}>Est. Rating</Th>
                <Th width={70}>Ceiling</Th>
                <Th width={60}>Enters</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const midColor  = p.midEstimate >= 70 ? 'var(--color-win)' : p.midEstimate >= 60 ? 'var(--color-warning)' : 'var(--color-text-tertiary)';
                const ceilColor = p.projectedCeiling >= 80 ? 'var(--color-win)' : p.projectedCeiling >= 70 ? 'var(--color-warning)' : 'var(--color-text-tertiary)';
                return (
                  <tr key={i} style={trowStyle}>
                    <Td align="left" style={{ fontWeight: 'var(--weight-semi)' }}>{p.name}</Td>
                    <Td align="left" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{p.college}</Td>
                    <Td style={{ fontWeight: 'var(--weight-semi)' }}>{p.position}</Td>
                    <Td mono>{p.age}</Td>
                    <Td mono>
                      <span style={{ opacity: 0.45, fontSize: 11 }}>{p.ratingLow}</span>
                      <span style={{ margin: '0 4px', color: 'var(--color-text-tertiary)' }}>—</span>
                      <span style={{ fontWeight: 700, color: midColor }}>{p.midEstimate}</span>
                      <span style={{ margin: '0 4px', color: 'var(--color-text-tertiary)' }}>—</span>
                      <span style={{ opacity: 0.45, fontSize: 11 }}>{p.ratingHigh}</span>
                    </Td>
                    <Td mono style={{ color: ceilColor }}>↑{p.projectedCeiling}</Td>
                    <Td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>T{p.tier} FA</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 3: Watch List — expandable detail rows
   ═══════════════════════════════════════════════════════════════ */
function WatchListTab({ gameState, engines }) {
  const { StatEngine } = engines;
  const [version, setVersion]             = useState(0);
  const [expandedId, setExpandedId]       = useState(null);

  const watchList    = getWatchList(gameState);
  const allPlayers   = useMemo(() => getAllLeaguePlayers(gameState), [gameState]);
  const userTeam     = gameState.userTeam;
  const coach        = userTeam.coach;
  const currentTier  = gameState.currentTier || 1;
  const raw          = gameState._raw || gameState;

  const allTierTeams = useMemo(() => [
    ...(raw.tier1Teams || []), ...(raw.tier2Teams || []), ...(raw.tier3Teams || [])
  ], [raw]);
  const tierPool = useMemo(() => buildTierPool(allTierTeams, StatEngine), [allTierTeams, StatEngine]);

  const enriched = useMemo(() =>
    watchList.map(w => {
      const p = allPlayers.find(pl => String(pl.id) === String(w.id));
      if (!p) return { ...w, _missing: true };
      return enrichPlayer(p, StatEngine);
    }),
    [watchList, allPlayers, StatEngine]);

  const removeWatch = (playerId) => {
    window.removeFromWatchList?.(playerId);
    setVersion(v => v + 1);
  };

  if (watchList.length === 0) {
    return (
      <Card padding="lg" className="animate-fade-in">
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--color-text-tertiary)' }}>
          <div style={{ fontSize: '2.5em', marginBottom: 'var(--space-3)' }}>☆</div>
          <p style={{ fontWeight: 'var(--weight-semi)', fontSize: 'var(--text-md)' }}>No players on your watch list</p>
          <p style={{ fontSize: 'var(--text-sm)' }}>Use the League Scanner to find and star players you want to track.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="animate-fade-in" style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-raised)' }}>
      {enriched.map((p, i) => {
        if (p._missing) {
          return (
            <div key={p.id || i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--color-border-subtle)', opacity: 0.4, fontSize: 'var(--text-sm)' }}>
              <span>{p.name} — no longer in the league</span>
              <span onClick={() => removeWatch(p.id)} style={{ cursor: 'pointer', color: 'var(--color-loss)' }}>× Remove</span>
            </div>
          );
        }
        const fit          = calculateTeamFit(p, userTeam, coach, engines);
        const contractColor = p.contractYears <= 1 ? 'var(--color-warning)' : 'var(--color-text)';
        const isExpanded   = expandedId === p.id;

        return (
          <div key={p.id}>
            <div onClick={() => setExpandedId(prev => prev === p.id ? null : p.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px', borderBottom: '1px solid var(--color-border-subtle)',
              cursor: 'pointer',
              background: isExpanded ? 'var(--color-accent-bg)' : 'transparent',
              transition: 'background 80ms',
            }}>
              <div style={{ minWidth: 30, textAlign: 'center', fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-mono)', color: ratingColor(p.rating), lineHeight: 1 }}>{p.rating}</div>
              <div style={{ minWidth: 160, flex: '0 0 auto' }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{p.name}{p.isCollegeGrad ? <span style={{ fontSize: 9, color: 'var(--color-accent)', marginLeft: 4 }}>CG</span> : null}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{p.position} · {p.age}yo · T{p._teamTier} {p._teamName}</div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '0 10px', borderLeft: '1px solid var(--color-border-subtle)', borderRight: '1px solid var(--color-border-subtle)' }}>
                <StatPill label="OVR" value={p.rating} />
                <StatPill label="Fit" value={<span style={{ color: gradeColor(fit.grade) }}>{fit.grade}</span>} />
                <StatPill label="Salary" value={fmtCurrency(p.salary || 0)} />
                <StatPill label="Yrs" value={<span style={{ color: contractColor }}>{p.contractYears}yr</span>} />
              </div>
              <MiniHex components={p._hex} size={38} />
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={e => { e.stopPropagation(); removeWatch(p.id); }} style={{
                  padding: '3px 8px', fontSize: 10, cursor: 'pointer',
                  border: '1px solid var(--color-border)', background: 'transparent',
                  color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)',
                }}>× Remove</button>
                <span style={{ fontSize: 8, color: 'var(--color-text-tertiary)' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>
            {isExpanded && (
              <PlayerDetailFull player={p} tierPool={tierPool} currentTier={currentTier} showFit fit={calculateTeamFit(p, userTeam, coach, engines)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 4: Team Needs  — unchanged
   ═══════════════════════════════════════════════════════════════ */
function NeedsTab({ gameState, engines }) {
  const { userTeam } = gameState;
  const roster = userTeam.roster || [];
  const PA = engines.PlayerAttributes;

  const posCounts = useMemo(() => {
    const counts = { PG: [], SG: [], SF: [], PF: [], C: [] };
    roster.forEach(p => { if (counts[p.position]) counts[p.position].push(p); });
    return counts;
  }, [roster]);

  const avgAge = roster.length > 0
    ? (roster.reduce((s, p) => s + (p.age || 0), 0) / roster.length).toFixed(1) : '—';
  const young   = roster.filter(p => p.age <= 24).length;
  const prime   = roster.filter(p => p.age >= 25 && p.age <= 30).length;
  const veteran = roster.filter(p => p.age >= 31).length;

  const expiring     = roster.filter(p => p.contractYears <= 1);
  const expiringNext = roster.filter(p => p.contractYears === 2);

  const physAttrs  = PA?.PHYSICAL_ATTRS || {};
  const mentAttrs  = PA?.MENTAL_ATTRS   || {};
  const allAttrDefs = { ...physAttrs, ...mentAttrs };
  const attrKeys   = Object.keys(allAttrDefs);

  const { weakest, strongest } = useMemo(() => {
    if (attrKeys.length === 0 || roster.length === 0) return { weakest: [], strongest: [] };
    const avgs = {};
    attrKeys.forEach(key => {
      const vals = roster.map(p => (p.attributes?.[key]) || 50);
      avgs[key] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    });
    const sorted = [...attrKeys].sort((a, b) => avgs[a] - avgs[b]);
    return {
      weakest:   sorted.slice(0, 3).map(k => ({ key: k, avg: avgs[k], def: allAttrDefs[k] })),
      strongest: sorted.slice(-3).reverse().map(k => ({ key: k, avg: avgs[k], def: allAttrDefs[k] })),
    };
  }, [roster, attrKeys, allAttrDefs]);

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
      <Card padding="lg">
        <CardHeader>Position Depth</CardHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {Object.entries(posCounts).map(([pos, players]) => {
            const count   = players.length;
            const variant = count === 0 ? 'loss' : count === 1 ? 'loss' : count === 2 ? 'warning' : 'win';
            const label   = count === 0 ? 'EMPTY' : count === 1 ? 'THIN' : count === 2 ? 'OK' : 'DEEP';
            const avgR    = count > 0 ? Math.round(players.reduce((s, p) => s + p.rating, 0) / count) : 0;
            return (
              <div key={pos} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div>
                  <span style={{ fontWeight: 'var(--weight-semi)', marginRight: 'var(--space-2)' }}>{pos}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {players.map(p => `${p.name.split(' ').pop()} (${p.rating})`).join(', ') || 'None'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {count > 0 && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Avg {avgR}</span>}
                  <Badge variant={variant}>{label}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card padding="lg">
        <CardHeader>Roster Profile</CardHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
          <ProfileRow label="Average Age"   value={avgAge} />
          <ProfileRow label="Young (≤24)"   value={young}   valueColor="var(--color-win)" />
          <ProfileRow label="Prime (25–30)"  value={prime}   valueColor="var(--color-info)" />
          <ProfileRow label="Veteran (31+)"  value={veteran} valueColor="var(--color-warning)" />
          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
            <ProfileRow label="Roster Size" value={`${roster.length}/15`} />
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <CardHeader>Contract Outlook</CardHeader>
        {expiring.length > 0 ? (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ fontWeight: 'var(--weight-semi)', color: 'var(--color-warning)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>Expiring This Year ({expiring.length})</div>
            {expiring.map(p => (
              <div key={p.id} style={{ fontSize: 'var(--text-sm)', padding: '3px 0', color: 'var(--color-text-secondary)' }}>
                {p.name} ({p.position}, {p.rating} OVR) — {fmtCurrency(p.salary || 0)}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>No contracts expiring this year</div>
        )}
        {expiringNext.length > 0 && (
          <div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>Next Year ({expiringNext.length})</div>
            {expiringNext.map(p => (
              <div key={p.id} style={{ fontSize: 'var(--text-xs)', padding: '2px 0', color: 'var(--color-text-tertiary)' }}>
                {p.name} ({p.position}, {p.rating} OVR)
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padding="lg">
        <CardHeader>Attribute Profile</CardHeader>
        {weakest.length > 0 && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontWeight: 'var(--weight-semi)', color: 'var(--color-loss)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>Weakest Areas</div>
            {weakest.map(a => (
              <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{a.def?.icon || ''} {a.def?.name || a.key}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-semi)', color: 'var(--color-loss)' }}>{a.avg}</span>
              </div>
            ))}
          </div>
        )}
        {strongest.length > 0 && (
          <div>
            <div style={{ fontWeight: 'var(--weight-semi)', color: 'var(--color-win)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>Strongest Areas</div>
            {strongest.map(a => (
              <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{a.def?.icon || ''} {a.def?.name || a.key}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-semi)', color: 'var(--color-win)' }}>{a.avg}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Shared primitives
   ═══════════════════════════════════════════════════════════════ */
function StatPill({ label, value }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 32 }}>
      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text)', lineHeight: 1.2 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 8, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 1 }}>{label}</div>
    </div>
  );
}

function ProfileRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <strong style={{ color: valueColor || 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
      {children}
    </div>
  );
}

function Loader({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--color-text-tertiary)' }}>{text}</div>
  );
}

function Th({ children, align = 'center', width, style }) {
  return <th style={{ padding: '8px 10px', textAlign: align, fontWeight: 600, width, ...style }}>{children}</th>;
}

function Td({ children, align = 'center', mono = false, style, colSpan }) {
  return (
    <td colSpan={colSpan} style={{
      padding: '7px 10px', textAlign: align,
      fontVariantNumeric: mono ? 'tabular-nums' : undefined,
      fontFamily: mono ? 'var(--font-mono)' : undefined,
      fontSize: mono ? 'var(--text-sm)' : undefined,
      ...style }}>{children}</td>
  );
}

const selectStyle = {
  padding: '4px 7px', fontSize: 10,
  border: '1px solid var(--color-border)', background: 'var(--color-bg-sunken)',
  color: 'var(--color-text)', fontFamily: 'var(--font-body)', cursor: 'pointer',
};
const inputStyle = {
  padding: '4px 7px', fontSize: 10,
  border: '1px solid var(--color-border)', background: 'var(--color-bg-sunken)',
  color: 'var(--color-text)', fontFamily: 'var(--font-body)',
};
const tableStyle    = { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-base)' };
const theadRowStyle = {
  borderBottom: '2px solid var(--color-border)',
  fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  position: 'sticky', top: 0, background: 'var(--color-bg-raised)', zIndex: 1 };
const trowStyle = { borderBottom: '1px solid var(--color-border-subtle)', transition: 'background var(--duration-fast) ease' };
