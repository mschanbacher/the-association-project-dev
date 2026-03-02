import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card, CardHeader } from '../components/Card.jsx';
import { Badge, RatingBadge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';

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
    { id: 'scanner', label: 'League Scanner', icon: '🔍' },
    { id: 'pipeline', label: 'Draft Pipeline', icon: '🎓' },
    { id: 'watchlist', label: 'Watch List', icon: '⭐' },
    { id: 'needs', label: 'Team Needs', icon: '📊' },
  ];

  return (
    <div style={{
      maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-6)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-5)',
    }}>
      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>
        Scouting
      </h2>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2, background: 'var(--color-bg-sunken)',
        borderRadius: 'var(--radius-md)', padding: 2,
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '8px 12px', borderRadius: 'calc(var(--radius-md) - 2px)',
            border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)', fontWeight: activeTab === tab.id ? 'var(--weight-semi)' : 'var(--weight-normal)',
            background: activeTab === tab.id ? 'var(--color-bg-raised)' : 'transparent',
            color: activeTab === tab.id ? 'var(--color-text)' : 'var(--color-text-tertiary)',
            boxShadow: activeTab === tab.id ? 'var(--shadow-xs)' : 'none',
            transition: 'all var(--duration-fast) ease',
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'scanner' && <ScannerTab gameState={gameState} engines={engines} />}
      {activeTab === 'pipeline' && <PipelineTab gameState={gameState} engines={engines} />}
      {activeTab === 'watchlist' && <WatchListTab gameState={gameState} engines={engines} />}
      {activeTab === 'needs' && <NeedsTab gameState={gameState} engines={engines} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS — pure functions replicated from ScoutingEngine
   ═══════════════════════════════════════════════════════════════ */
function getAllLeaguePlayers(gameState) {
  const all = [];
  const raw = gameState._raw || gameState;
  [...(raw.tier1Teams || []), ...(raw.tier2Teams || []), ...(raw.tier3Teams || [])].forEach(team => {
    if (team.roster) {
      team.roster.forEach(p => {
        // Annotate with team info (matching the legacy getAllLeaguePlayers)
        all.push({ ...p, _teamName: team.name, _teamTier: team.tier, _teamId: team.id });
      });
    }
  });
  return all;
}

function calculateTeamFit(player, userTeam, coach, engines) {
  // Use ScoutingEngine from the bridge if available
  const SE = engines?.ScoutingEngine || window.ScoutingEngine;
  if (SE?.calculateTeamFit) {
    return SE.calculateTeamFit(player, userTeam, coach);
  }
  // Simple fallback grade based on position need and rating
  const posCount = (userTeam.roster || []).filter(p => p.position === player.position).length;
  const needBonus = posCount === 0 ? 20 : posCount === 1 ? 10 : 0;
  const ratingScore = Math.min(100, (player.rating || 60) + needBonus);
  const combined = Math.round(ratingScore * 0.7 + 50 * 0.3);
  let grade;
  if (combined >= 82) grade = 'A';
  else if (combined >= 70) grade = 'B';
  else if (combined >= 55) grade = 'C';
  else if (combined >= 40) grade = 'D';
  else grade = 'F';
  return {
    combined, grade,
    systemFit: { score: 50, grade: 'C', details: [] },
    roleFit: { score: 50, label: '—' },
    chemFit: { score: 50, label: '—', details: [] },
  };
}

function gradeColor(grade) {
  if (!grade) return 'var(--color-text-tertiary)';
  if (grade.startsWith('A')) return 'var(--color-win)';
  if (grade.startsWith('B')) return 'var(--color-info)';
  if (grade.startsWith('C')) return 'var(--color-warning)';
  if (grade.startsWith('D')) return '#f28b82';
  return 'var(--color-loss)';
}

function ratingColor(r) {
  if (!r) return 'var(--color-text-tertiary)';
  if (r >= 85) return 'var(--color-rating-elite)';
  if (r >= 78) return 'var(--color-rating-good)';
  if (r >= 70) return 'var(--color-rating-avg)';
  if (r >= 60) return 'var(--color-rating-below)';
  return 'var(--color-rating-poor)';
}

function formatCurrency(amount) {
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

/* ═══════════════════════════════════════════════════════════════
   TAB 1: League Scanner
   ═══════════════════════════════════════════════════════════════ */
function ScannerTab({ gameState, engines }) {
  const [filters, setFilters] = useState({
    pos: 'ALL', tier: 'ALL', minAge: '', maxAge: '',
    minRating: '', maxRating: '', contractStatus: 'ALL', sort: 'fit',
  });
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [watchVersion, setWatchVersion] = useState(0);

  const userTeam = gameState.userTeam;
  const coach = userTeam.coach;

  const allPlayers = useMemo(() => getAllLeaguePlayers(gameState), [gameState]);

  const filtered = useMemo(() => {
    const f = filters;
    let result = allPlayers.filter(p => {
      if (f.pos !== 'ALL' && p.position !== f.pos) return false;
      if (f.tier !== 'ALL' && String(p._teamTier) !== f.tier) return false;
      if (f.minAge && p.age < parseInt(f.minAge)) return false;
      if (f.maxAge && p.age > parseInt(f.maxAge)) return false;
      if (f.minRating && p.rating < parseInt(f.minRating)) return false;
      if (f.maxRating && p.rating > parseInt(f.maxRating)) return false;
      if (f.contractStatus === 'expiring' && p.contractYears > 1) return false;
      if (f.contractStatus === 'short' && p.contractYears > 2) return false;
      if (p._teamId === userTeam.id) return false;
      return true;
    });

    result.forEach(p => { p._fit = calculateTeamFit(p, userTeam, coach, engines); });

    if (f.sort === 'fit') result.sort((a, b) => b._fit.combined - a._fit.combined);
    else if (f.sort === 'rating') result.sort((a, b) => b.rating - a.rating);
    else if (f.sort === 'age') result.sort((a, b) => a.age - b.age || b.rating - a.rating);
    else if (f.sort === 'salary') result.sort((a, b) => a.salary - b.salary);

    return result.slice(0, 100);
  }, [allPlayers, filters, userTeam, coach]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setSelectedPlayer(null);
  };

  const toggleWatch = useCallback((playerId) => {
    if (isOnWatchList(gameState, playerId)) {
      window.removeFromWatchList?.(playerId);
    } else {
      window.addToWatchList?.(playerId);
    }
    setWatchVersion(v => v + 1);
  }, [gameState]);

  // Player detail view
  if (selectedPlayer) {
    const p = allPlayers.find(pl => pl.id === selectedPlayer);
    if (p) {
      const fit = calculateTeamFit(p, userTeam, coach, engines);
      return <PlayerDetail player={p} fit={fit} gameState={gameState}
        onBack={() => setSelectedPlayer(null)}
        onToggleWatch={() => toggleWatch(p.id)}
        watchVersion={watchVersion} engines={engines} />;
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Filters */}
      <Card padding="md" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <FilterSelect value={filters.pos} onChange={v => updateFilter('pos', v)}
            options={[['ALL','All Pos'],['PG','PG'],['SG','SG'],['SF','SF'],['PF','PF'],['C','C']]} />
          <FilterSelect value={filters.tier} onChange={v => updateFilter('tier', v)}
            options={[['ALL','All Tiers'],['1','Tier 1'],['2','Tier 2'],['3','Tier 3']]} />
          <FilterInput value={filters.minAge} onChange={v => updateFilter('minAge', v)} placeholder="Min Age" width={70} />
          <FilterInput value={filters.maxAge} onChange={v => updateFilter('maxAge', v)} placeholder="Max Age" width={70} />
          <FilterInput value={filters.minRating} onChange={v => updateFilter('minRating', v)} placeholder="Min OVR" width={72} />
          <FilterInput value={filters.maxRating} onChange={v => updateFilter('maxRating', v)} placeholder="Max OVR" width={72} />
          <FilterSelect value={filters.contractStatus} onChange={v => updateFilter('contractStatus', v)}
            options={[['ALL','Any Contract'],['expiring','Expiring (1yr)'],['short','1–2yr']]} />
          <FilterSelect value={filters.sort} onChange={v => updateFilter('sort', v)}
            options={[['fit','Sort: Fit'],['rating','Sort: Rating'],['age','Sort: Age'],['salary','Sort: Salary']]} />
        </div>
      </Card>

      {/* Results count */}
      <div style={{
        fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
        marginBottom: 'var(--space-2)',
      }}>
        {filtered.length >= 100 ? '100+ players found (showing top 100)' : `${filtered.length} players found`}
      </div>

      {/* Results table */}
      <Card padding="none">
        <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                <Th width={30}>★</Th>
                <Th align="left">Player</Th>
                <Th width={44}>Pos</Th>
                <Th width={40}>Age</Th>
                <Th width={70}>OVR</Th>
                <Th width={44}>Fit</Th>
                <Th width={44}>Sys</Th>
                <Th width={80}>Role</Th>
                <Th width={80} align="right">Salary</Th>
                <Th width={36}>Yrs</Th>
                <Th align="left" width={140}>Team</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const fit = p._fit;
                const watched = isOnWatchList(gameState, p.id);
                return (
                  <tr key={p.id || i}
                    onClick={() => setSelectedPlayer(p.id)}
                    style={{
                      ...trowStyle,
                      background: watched ? 'rgba(212, 168, 67, 0.06)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { if (!watched) e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
                    onMouseLeave={e => { if (!watched) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Td>
                      <span onClick={e => { e.stopPropagation(); toggleWatch(p.id); }}
                        style={{ cursor: 'pointer', fontSize: '1em' }}>
                        {watched ? '⭐' : '☆'}
                      </span>
                    </Td>
                    <Td align="left" style={{ fontWeight: 'var(--weight-semi)' }}>
                      {p.name}{p.isCollegeGrad ? ' 🎓' : ''}
                    </Td>
                    <Td style={{ fontWeight: 'var(--weight-semi)' }}>{p.position}</Td>
                    <Td mono>{p.age}</Td>
                    <Td mono style={{ color: ratingColor(p.rating), fontWeight: 'var(--weight-semi)' }}>
                      {p.rating}
                      {p.offRating != null && (
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, fontWeight: 'var(--weight-normal)' }}>
                          {Math.round(p.offRating)}/{Math.round(p.defRating)}
                        </div>
                      )}
                    </Td>
                    <Td style={{ fontWeight: 'var(--weight-bold)', color: gradeColor(fit?.grade) }}>{fit?.grade || '—'}</Td>
                    <Td style={{ color: gradeColor(fit?.systemFit?.grade) }}>{fit?.systemFit?.grade || '—'}</Td>
                    <Td style={{ fontSize: 'var(--text-xs)' }}>
                      {(fit?.roleFit?.label || '—').replace(/🔥|📢|⬆️|⚠️/g, '').trim()}
                    </Td>
                    <Td align="right" mono>{formatCurrency(p.salary || 0)}</Td>
                    <Td mono>{p.contractYears}yr</Td>
                    <Td align="left" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                      T{p._teamTier} {p._teamName}
                    </Td>
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
   Player Detail (within Scanner)
   ═══════════════════════════════════════════════════════════════ */
function PlayerDetail({ player, fit, gameState, onBack, onToggleWatch, watchVersion, engines }) {
  const watched = isOnWatchList(gameState, player.id);
  const PA = engines.PlayerAttributes;
  const m = player.measurables;
  const attrs = player.attributes || {};

  // Get all attribute definitions
  const physAttrs = PA?.PHYSICAL_ATTRS || {};
  const mentAttrs = PA?.MENTAL_ATTRS || {};
  const allAttrDefs = { ...physAttrs, ...mentAttrs };
  const attrEntries = Object.entries(attrs).sort(([,a],[,b]) => b - a);

  return (
    <div className="animate-fade-in">
      <Button variant="ghost" size="sm" onClick={onBack} style={{ marginBottom: 'var(--space-3)' }}>
        ← Back to Results
      </Button>

      <Card padding="lg" style={{ marginBottom: 'var(--space-4)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)' }}>
              {player.name} {player.isCollegeGrad ? '🎓' : ''}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {player.position} · Age {player.age} · T{player._teamTier} {player._teamName}
              {player.college ? ` · 🎓 ${player.college}` : ''}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              {formatCurrency(player.salary || 0)} · {player.contractYears}yr
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <RatingBadge rating={player.rating} offRating={player.offRating} defRating={player.defRating} />
          </div>
        </div>

        {/* Measurables */}
        {m && PA?.formatHeight && (
          <div style={{
            display: 'flex', gap: 'var(--space-5)', marginBottom: 'var(--space-4)',
            fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
          }}>
            <span>{PA.formatHeight(m.height)}</span>
            <span>{m.weight}lbs</span>
            <span>{PA.formatWingspan(m.wingspan)} wingspan</span>
          </div>
        )}

        {/* Attributes Grid */}
        {attrEntries.length > 0 && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{
              fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-2)',
            }}>Attributes</div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)',
            }}>
              {attrEntries.map(([key, val]) => {
                const def = allAttrDefs[key];
                return (
                  <div key={key} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '4px var(--space-2)', fontSize: 'var(--text-sm)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg-sunken)',
                  }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {def?.icon || ''} {def?.name || key}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-semi)',
                      color: attrColor(val),
                    }}>{val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Team Fit Analysis */}
      <Card padding="lg" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <CardHeader style={{ margin: 0 }}>Team Fit Analysis</CardHeader>
          <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: gradeColor(fit.grade) }}>
            {fit.grade}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <FitCard label="System Fit" value={fit.systemFit?.grade || '—'} color={gradeColor(fit.systemFit?.grade)} />
          <FitCard label="Role Clarity" value={fit.roleFit?.label || '—'} />
          <FitCard label="Chemistry" value={fit.chemFit?.label || '—'} />
        </div>

        {(fit.systemFit?.details?.length > 0 || fit.chemFit?.details?.length > 0) && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {[...(fit.systemFit?.details || []), ...(fit.chemFit?.details || [])].map((d, i) => (
              <div key={i} style={{ marginBottom: 3 }}>{d}</div>
            ))}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
        <Button variant={watched ? 'secondary' : 'primary'} onClick={onToggleWatch}>
          {watched ? '⭐ On Watch List (remove)' : '☆ Add to Watch List'}
        </Button>
        <Button variant="ghost" onClick={onBack}>← Back to Results</Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 2: Draft Pipeline
   ═══════════════════════════════════════════════════════════════ */
function PipelineTab({ gameState, engines }) {
  const [posFilter, setPosFilter] = useState('ALL');

  // Get or generate pipeline preview
  const raw = gameState._raw;
  const preview = raw?._pipelinePreview || [];
  const season = gameState.currentSeason;

  const filtered = useMemo(() => {
    if (posFilter === 'ALL') return preview;
    return preview.filter(p => p.position === posFilter);
  }, [preview, posFilter]);

  if (preview.length === 0) {
    return (
      <Card padding="lg" className="animate-fade-in">
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--color-text-tertiary)' }}>
          <div style={{ fontSize: '2em', marginBottom: 'var(--space-3)' }}>🎓</div>
          <p>Pipeline preview generates when you open scouting during a season.</p>
          <p style={{ fontSize: 'var(--text-sm)' }}>Open the legacy scouting modal first to populate the draft class.</p>
          <Button variant="secondary" size="sm" onClick={() => window.openScoutingModal?.()}
            style={{ marginTop: 'var(--space-3)' }}>
            Open Legacy Scouting
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 'var(--space-4)',
      }}>
        <div>
          <div style={{ fontWeight: 'var(--weight-semi)' }}>
            Class of {(season || 0) + 2} · {preview.length} Prospects
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            Rating ranges narrow as the season progresses. Players enter College Grad FA next offseason.
          </div>
        </div>
        <FilterSelect value={posFilter} onChange={setPosFilter}
          options={[['ALL','All Pos'],['PG','PG'],['SG','SG'],['SF','SF'],['PF','PF'],['C','C']]} />
      </div>

      <Card padding="none">
        <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                <Th align="left">Prospect</Th>
                <Th>College</Th>
                <Th width={44}>Pos</Th>
                <Th width={130}>Est. Rating</Th>
                <Th width={60}>Ceiling</Th>
                <Th width={60}>Tier</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const midColor = p.midEstimate >= 70 ? 'var(--color-win)' : p.midEstimate >= 60 ? 'var(--color-warning)' : 'var(--color-text-tertiary)';
                const ceilColor = p.projectedCeiling >= 80 ? 'var(--color-win)' : p.projectedCeiling >= 70 ? 'var(--color-warning)' : 'var(--color-text-tertiary)';
                return (
                  <tr key={i} style={trowStyle}>
                    <Td align="left" style={{ fontWeight: 'var(--weight-semi)' }}>{p.name}</Td>
                    <Td style={{ fontSize: 'var(--text-sm)' }}>🎓 {p.college}</Td>
                    <Td style={{ fontWeight: 'var(--weight-semi)' }}>{p.position}</Td>
                    <Td mono>
                      <span style={{ opacity: 0.5 }}>{p.ratingLow}</span>
                      {' — '}
                      <span style={{ fontWeight: 'var(--weight-bold)', color: midColor }}>{p.midEstimate}</span>
                      {' — '}
                      <span style={{ opacity: 0.5 }}>{p.ratingHigh}</span>
                    </Td>
                    <Td mono style={{ color: ceilColor }}>↑{p.projectedCeiling}</Td>
                    <Td>{p.tier === 2 ? 'T2' : 'T3'}</Td>
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
   TAB 3: Watch List
   ═══════════════════════════════════════════════════════════════ */
function WatchListTab({ gameState, engines }) {
  const [version, setVersion] = useState(0);
  const watchList = getWatchList(gameState);
  const allPlayers = useMemo(() => getAllLeaguePlayers(gameState), [gameState]);
  const userTeam = gameState.userTeam;
  const coach = userTeam.coach;

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
    <Card padding="none" className="animate-fade-in">
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <Th align="left">Player</Th>
              <Th width={44}>Pos</Th>
              <Th width={40}>Age</Th>
              <Th width={70}>OVR</Th>
              <Th width={44}>Fit</Th>
              <Th width={80} align="right">Salary</Th>
              <Th width={60}>Contract</Th>
              <Th align="left" width={140}>Team</Th>
              <Th width={40}></Th>
            </tr>
          </thead>
          <tbody>
            {watchList.map((w, i) => {
              const p = allPlayers.find(pl => String(pl.id) === String(w.id));
              if (!p) {
                return (
                  <tr key={w.id || i} style={{ ...trowStyle, opacity: 0.4 }}>
                    <Td align="left">{w.name}</Td>
                    <Td colSpan={6} style={{ color: 'var(--color-text-tertiary)' }}>No longer in the league</Td>
                    <Td>
                      <span onClick={() => removeWatch(w.id)} style={{ cursor: 'pointer' }}>❌</span>
                    </Td>
                  </tr>
                );
              }

              const fit = calculateTeamFit(p, userTeam, coach, engines);
              const contractColor = p.contractYears <= 1 ? 'var(--color-warning)' : 'var(--color-text)';

              return (
                <tr key={p.id} style={trowStyle}>
                  <Td align="left" style={{ fontWeight: 'var(--weight-semi)' }}>
                    {p.name}{p.isCollegeGrad ? ' 🎓' : ''}
                  </Td>
                  <Td style={{ fontWeight: 'var(--weight-semi)' }}>{p.position}</Td>
                  <Td mono>{p.age}</Td>
                  <Td mono style={{ color: ratingColor(p.rating), fontWeight: 'var(--weight-semi)' }}>
                    {p.rating}
                    {p.offRating != null && (
                      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, fontWeight: 'var(--weight-normal)' }}>
                        {Math.round(p.offRating)}/{Math.round(p.defRating)}
                      </div>
                    )}
                  </Td>
                  <Td style={{ fontWeight: 'var(--weight-bold)', color: gradeColor(fit.grade) }}>{fit.grade}</Td>
                  <Td align="right" mono>{formatCurrency(p.salary || 0)}</Td>
                  <Td style={{ color: contractColor }}>{p.contractYears}yr{p.contractYears <= 1 ? ' ⚠️' : ''}</Td>
                  <Td align="left" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    T{p._teamTier} {p._teamName}
                  </Td>
                  <Td>
                    <span onClick={() => removeWatch(p.id)} style={{ cursor: 'pointer' }}>❌</span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 4: Team Needs
   ═══════════════════════════════════════════════════════════════ */
function NeedsTab({ gameState, engines }) {
  const { userTeam } = gameState;
  const roster = userTeam.roster || [];
  const PA = engines.PlayerAttributes;

  // Position depth
  const posCounts = useMemo(() => {
    const counts = { PG: [], SG: [], SF: [], PF: [], C: [] };
    roster.forEach(p => { if (counts[p.position]) counts[p.position].push(p); });
    return counts;
  }, [roster]);

  // Age profile
  const avgAge = roster.length > 0
    ? (roster.reduce((s, p) => s + (p.age || 0), 0) / roster.length).toFixed(1) : '—';
  const young = roster.filter(p => p.age <= 24).length;
  const prime = roster.filter(p => p.age >= 25 && p.age <= 30).length;
  const veteran = roster.filter(p => p.age >= 31).length;

  // Contract outlook
  const expiring = roster.filter(p => p.contractYears <= 1);
  const expiringNext = roster.filter(p => p.contractYears === 2);

  // Attribute analysis
  const physAttrs = PA?.PHYSICAL_ATTRS || {};
  const mentAttrs = PA?.MENTAL_ATTRS || {};
  const allAttrDefs = { ...physAttrs, ...mentAttrs };
  const attrKeys = Object.keys(allAttrDefs);

  const { weakest, strongest } = useMemo(() => {
    if (attrKeys.length === 0 || roster.length === 0) return { weakest: [], strongest: [] };
    const avgs = {};
    attrKeys.forEach(key => {
      const vals = roster.map(p => (p.attributes?.[key]) || 50);
      avgs[key] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    });
    const sorted = [...attrKeys].sort((a, b) => avgs[a] - avgs[b]);
    return {
      weakest: sorted.slice(0, 3).map(k => ({ key: k, avg: avgs[k], def: allAttrDefs[k] })),
      strongest: sorted.slice(-3).reverse().map(k => ({ key: k, avg: avgs[k], def: allAttrDefs[k] })),
    };
  }, [roster, attrKeys, allAttrDefs]);

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
      {/* Position Depth */}
      <Card padding="lg">
        <CardHeader>Position Depth</CardHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {Object.entries(posCounts).map(([pos, players]) => {
            const count = players.length;
            const variant = count === 0 ? 'loss' : count === 1 ? 'loss' : count === 2 ? 'warning' : 'win';
            const label = count === 0 ? 'EMPTY' : count === 1 ? 'THIN' : count === 2 ? 'OK' : 'DEEP';
            const avgR = count > 0 ? Math.round(players.reduce((s, p) => s + p.rating, 0) / count) : 0;
            return (
              <div key={pos} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-subtle)',
              }}>
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

      {/* Roster Profile */}
      <Card padding="lg">
        <CardHeader>Roster Profile</CardHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
          <ProfileRow label="Average Age" value={avgAge} />
          <ProfileRow label="Young (≤24)" value={young} valueColor="var(--color-win)" />
          <ProfileRow label="Prime (25–30)" value={prime} valueColor="var(--color-info)" />
          <ProfileRow label="Veteran (31+)" value={veteran} valueColor="var(--color-warning)" />
          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
            <ProfileRow label="Roster Size" value={`${roster.length}/15`} />
          </div>
        </div>
      </Card>

      {/* Contract Outlook */}
      <Card padding="lg">
        <CardHeader>Contract Outlook</CardHeader>
        {expiring.length > 0 ? (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ fontWeight: 'var(--weight-semi)', color: 'var(--color-warning)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
              ⚠️ Expiring This Year ({expiring.length})
            </div>
            {expiring.map(p => (
              <div key={p.id} style={{ fontSize: 'var(--text-sm)', padding: '3px 0', color: 'var(--color-text-secondary)' }}>
                {p.name} ({p.position}, {p.rating} OVR) — {formatCurrency(p.salary || 0)}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
            No contracts expiring this year
          </div>
        )}
        {expiringNext.length > 0 && (
          <div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>
              Next Year ({expiringNext.length})
            </div>
            {expiringNext.map(p => (
              <div key={p.id} style={{ fontSize: 'var(--text-xs)', padding: '2px 0', color: 'var(--color-text-tertiary)' }}>
                {p.name} ({p.position}, {p.rating} OVR)
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Attribute Analysis */}
      <Card padding="lg">
        <CardHeader>Attribute Profile</CardHeader>
        {weakest.length > 0 && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontWeight: 'var(--weight-semi)', color: 'var(--color-loss)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
              Weakest Areas
            </div>
            {weakest.map(a => (
              <div key={a.key} style={{
                display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--text-sm)',
              }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{a.def?.icon || ''} {a.def?.name || a.key}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-semi)', color: '#f28b82' }}>{a.avg}</span>
              </div>
            ))}
          </div>
        )}
        {strongest.length > 0 && (
          <div>
            <div style={{ fontWeight: 'var(--weight-semi)', color: 'var(--color-win)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
              Strongest Areas
            </div>
            {strongest.map(a => (
              <div key={a.key} style={{
                display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--text-sm)',
              }}>
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
   Shared Primitives
   ═══════════════════════════════════════════════════════════════ */
function FilterSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)', background: 'var(--color-bg-raised)',
      color: 'var(--color-text)', fontSize: 'var(--text-sm)',
      fontFamily: 'var(--font-body)', cursor: 'pointer',
    }}>
      {options.map(([val, label]) => (
        <option key={val} value={val}>{label}</option>
      ))}
    </select>
  );
}

function FilterInput({ value, onChange, placeholder, width = 70 }) {
  return (
    <input type="number" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width, padding: '6px 8px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)', background: 'var(--color-bg-raised)',
        color: 'var(--color-text)', fontSize: 'var(--text-sm)',
        fontFamily: 'var(--font-body)',
      }} />
  );
}

function FitCard({ label, value, color }) {
  return (
    <div style={{
      textAlign: 'center', padding: 'var(--space-3)',
      background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)',
        color: color || 'var(--color-text)',
      }}>{value}</div>
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

function attrColor(val) {
  if (val >= 80) return 'var(--color-rating-elite)';
  if (val >= 65) return 'var(--color-rating-good)';
  if (val >= 50) return 'var(--color-rating-avg)';
  if (val >= 35) return 'var(--color-rating-below)';
  return 'var(--color-rating-poor)';
}

function Loader({ text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: 'var(--color-text-tertiary)',
    }}>{text}</div>
  );
}

function Th({ children, align = 'center', width, style }) {
  return (
    <th style={{ padding: '8px 10px', textAlign: align, fontWeight: 600, width, ...style }}>{children}</th>
  );
}

function Td({ children, align = 'center', mono = false, style, colSpan }) {
  return (
    <td colSpan={colSpan} style={{
      padding: '7px 10px', textAlign: align,
      fontVariantNumeric: mono ? 'tabular-nums' : undefined,
      fontFamily: mono ? 'var(--font-mono)' : undefined,
      fontSize: mono ? 'var(--text-sm)' : undefined,
      ...style,
    }}>{children}</td>
  );
}

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-base)' };
const theadRowStyle = {
  borderBottom: '2px solid var(--color-border)',
  fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  position: 'sticky', top: 0, background: 'var(--color-bg-raised)', zIndex: 1,
};
const trowStyle = { borderBottom: '1px solid var(--color-border-subtle)', transition: 'background var(--duration-fast) ease' };
