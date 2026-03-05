import React, { useState, useMemo, useEffect } from 'react';
import { TEAM_COLORS } from '../styles/TeamColors.js';

const BRAND = '#F04E2C';
const BRAND_BG = 'rgba(240,78,44,0.07)';

export function NewGameFlow({ gameState, onComplete }) {
  const [phase, setPhase] = useState('welcome');
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [starting, setStarting] = useState(false);

  const handleSelectTier = (tier) => { setSelectedTier(tier); setPhase('team'); };
  const handleSelectTeam = (teamId) => { setSelectedTeamId(teamId); };

  const handleConfirm = () => {
    if (selectedTeamId == null || !selectedTier || starting) return;
    setStarting(true);
    if (window.selectTeam) window.selectTeam(selectedTeamId, selectedTier);
    onComplete?.();
  };

  const handleBack = () => {
    if (phase === 'team') { setPhase('tier'); setSelectedTeamId(null); }
    else if (phase === 'tier') { setPhase('welcome'); setSelectedTier(null); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', position: 'relative', overflow: 'hidden' }}>
      {phase === 'welcome' && <WelcomePhase onNewGame={() => setPhase('tier')} />}
      {phase === 'tier' && <TierPhase onSelect={handleSelectTier} onBack={handleBack} />}
      {phase === 'team' && (
        <TeamPhase gameState={gameState} tier={selectedTier}
          selectedTeamId={selectedTeamId} onSelectTeam={handleSelectTeam}
          onConfirm={handleConfirm} onBack={handleBack} starting={starting} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Phase 1: Welcome
   ═══════════════════════════════════════════════════════════════ */
function WelcomePhase({ onNewGame }) {
  return (
    <div style={phaseCenter}>
      <div style={{ textAlign: 'center', maxWidth: 500 }}>
        <div style={{
          fontSize: 'clamp(2.4em, 5vw, 3.2em)', fontWeight: 700,
          letterSpacing: '-0.03em', lineHeight: 1.05, margin: 0, marginBottom: 4,
        }}>The Association</div>
        <div style={{
          fontSize: 'var(--text-sm)', fontWeight: 600, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: BRAND, marginBottom: 32,
        }}>Project</div>
        <p style={{
          fontSize: 'var(--text-md)', color: 'var(--color-text-secondary)',
          maxWidth: 400, margin: '0 auto 40px', lineHeight: 1.6,
        }}>
          Build a dynasty across three tiers of professional basketball.
          Draft, trade, develop, and compete for championships.
        </p>
        <button onClick={onNewGame} style={{
          padding: '14px 40px', border: 'none', background: BRAND,
          color: '#fff', fontSize: 'var(--text-lg)', fontWeight: 700,
          fontFamily: 'var(--font-body)', cursor: 'pointer',
        }}>New Game</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Phase 2: Tier Selection
   ═══════════════════════════════════════════════════════════════ */
const tierData = [
  { tier: 1, name: 'North American Premier League', abbrev: 'NAPL', color: 'var(--color-tier1)',
    teams: 30, games: 82,
    desc: 'The pinnacle. 30 elite franchises, 82-game season, fixed salary cap, national TV revenue.',
    details: ['Fixed $100M salary cap', '6 divisions · 2 conferences', 'Promotion from T2 · Relegation to T2'] },
  { tier: 2, name: 'North American Regional Basketball League', abbrev: 'NARBL', color: 'var(--color-tier2)',
    teams: 86, games: 60,
    desc: 'The stepping stone. 86 teams, 60-game season, revenue-based budgets, fierce competition for promotion.',
    details: ['Revenue-based spending limits', '12 divisions', 'Promotion to T1 · Relegation to T3'] },
  { tier: 3, name: 'Metro Basketball League', abbrev: 'MBL', color: 'var(--color-tier3)',
    teams: 144, games: 40,
    desc: 'Where every journey begins. 144 metro teams, 40-game season. Build from the ground up.',
    details: ['Revenue-based spending limits', '16 divisions', 'Promotion to T2'] },
];

function TierPhase({ onSelect, onBack }) {
  return (
    <div style={phaseCenter}>
      <div style={{ width: '100%', maxWidth: 860 }}>
        <BackButton onClick={onBack} />
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 6 }}>
            Choose Your Starting Tier
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Each tier offers a different challenge. Climb — or fall — through promotion and relegation.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)' }}>
          {tierData.map(td => (
            <button key={td.tier} onClick={() => onSelect(td.tier)} style={{
              background: 'var(--color-bg-raised)', border: '1px solid var(--color-border-subtle)',
              borderLeft: `3px solid ${td.color}`,
              padding: '24px 20px', cursor: 'pointer', textAlign: 'left',
              fontFamily: 'var(--font-body)', color: 'var(--color-text)',
              transition: 'border-color 150ms ease',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: td.color,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
              }}>{td.abbrev}</div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 8, lineHeight: 1.2 }}>
                {td.name}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
                {td.desc}
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 'var(--text-sm)' }}>
                <span><strong style={{ fontFamily: 'var(--font-mono)' }}>{td.teams}</strong> teams</span>
                <span><strong style={{ fontFamily: 'var(--font-mono)' }}>{td.games}</strong> games</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                {td.details.map((d, i) => <span key={i}>{d}</span>)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Phase 3: Team Selection
   ═══════════════════════════════════════════════════════════════ */
function TeamPhase({ gameState, tier, selectedTeamId, onSelectTeam, onConfirm, onBack, starting }) {
  const raw = gameState?._raw || gameState;
  const teams = tier === 1 ? raw?.tier1Teams : tier === 2 ? raw?.tier2Teams : raw?.tier3Teams;
  const td = tierData.find(t => t.tier === tier);

  const divisions = useMemo(() => {
    if (!teams) return {};
    const groups = {};
    teams.forEach(team => {
      const div = team.division || 'Other';
      if (!groups[div]) groups[div] = [];
      groups[div].push(team);
    });
    Object.values(groups).forEach(arr => arr.sort((a, b) => (b.rating || 0) - (a.rating || 0)));
    return groups;
  }, [teams]);

  const selectedTeam = teams?.find(t => t.id === selectedTeamId);

  useEffect(() => {
    if (selectedTeam && window.FinanceEngine?.ensureFinances) {
      window.FinanceEngine.ensureFinances(selectedTeam);
    }
  }, [selectedTeam]);

  // Get team colors for the selected team
  const selectedColors = useMemo(() => {
    if (!selectedTeam) return null;
    const fullName = selectedTeam.city
      ? `${selectedTeam.city} ${selectedTeam.name}`
      : selectedTeam.name;
    return TEAM_COLORS[fullName] || TEAM_COLORS[selectedTeam.name] || null;
  }, [selectedTeam]);

  const divEntries = Object.entries(divisions).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div style={{ ...phaseCenter, alignItems: 'flex-start', paddingTop: 'var(--space-6)' }}>
      <div style={{ width: '100%', maxWidth: 1000 }}>
        <BackButton onClick={onBack} />

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          marginBottom: 24,
        }}>
          <div>
            <div style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: td?.color || BRAND, fontWeight: 600, marginBottom: 4,
            }}>{td?.abbrev} · Tier {tier}</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>Select Your Team</div>
          </div>
          {selectedTeam && (
            <button onClick={onConfirm} disabled={starting} style={{
              padding: '10px 28px', border: 'none',
              background: selectedColors?.primary || BRAND,
              color: '#fff', fontSize: 'var(--text-base)', fontWeight: 700,
              fontFamily: 'var(--font-body)', cursor: starting ? 'default' : 'pointer',
              opacity: starting ? 0.6 : 1,
            }}>
              {starting ? 'Starting…' : `Start as ${selectedTeam.name}`}
            </button>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedTeam ? '1fr 300px' : '1fr',
          gap: 'var(--gap)', alignItems: 'start',
        }}>
          {/* Team grid */}
          <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 8 }}>
            {divEntries.map(([division, divTeams]) => (
              <div key={division} style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
                  fontWeight: 600, color: 'var(--color-text-tertiary)',
                  marginBottom: 6, paddingBottom: 4,
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}>{division}</div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 6,
                }}>
                  {divTeams.map(team => {
                    const isSelected = team.id === selectedTeamId;
                    const fullName = team.city ? `${team.city} ${team.name}` : team.name;
                    const tc = TEAM_COLORS[fullName] || TEAM_COLORS[team.name] || { primary: 'var(--color-text-tertiary)', secondary: 'var(--color-text-secondary)' };
                    const rating = Math.round(team.rating || 0);

                    return (
                      <button key={team.id} onClick={() => onSelectTeam(team.id)} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 12px',
                        background: isSelected ? `${tc.secondary}18` : 'var(--color-bg-raised)',
                        border: isSelected ? `1px solid ${tc.secondary}` : '1px solid var(--color-border-subtle)',
                        borderLeft: `3px solid ${isSelected ? tc.secondary : tc.primary}`,
                        cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--color-text)',
                        textAlign: 'left', transition: 'all 100ms ease',
                      }}>
                        <div>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{team.name}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{team.city || ''}</div>
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
                          fontWeight: 700, color: playerRatingColor(rating),
                        }}>{rating}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selectedTeam && (
            <TeamDetailPanel team={selectedTeam} tier={tier}
              colors={selectedColors} onConfirm={onConfirm} starting={starting} />
          )}
        </div>
      </div>
    </div>
  );
}

function TeamDetailPanel({ team, tier, colors, onConfirm, starting }) {
  const FE = window.FinanceEngine;
  let capLabel = '', capValue = '', fanbase = 0, marketLabel = '';

  if (FE && team.finances) {
    FE.ensureFinances(team);
    const limit = FE.getSpendingLimit(team);
    capLabel = tier === 1 ? 'Salary Cap' : 'Spending Limit';
    capValue = formatCurrency(limit);
    fanbase = team.finances.fanbase || 0;
    const ms = team.finances.marketSize || 1;
    marketLabel = ms >= 1.2 ? 'Major Market' : ms >= 1.0 ? 'Mid Market' : ms >= 0.8 ? 'Small Market' : 'Tiny Market';
  }

  const rating = Math.round(team.rating || 0);
  const primary = colors?.primary || BRAND;
  const secondary = colors?.secondary || BRAND;

  const topPlayers = (team.roster || [])
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5);

  return (
    <div style={{
      background: 'var(--color-bg-raised)',
      border: `1px solid ${secondary}40`,
      borderTop: `3px solid ${primary}`,
      padding: 20, position: 'sticky', top: 24,
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 2 }}>{team.name}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
          {team.city || ''} · {team.division || ''}
        </div>
        <div style={{
          display: 'inline-block', padding: '4px 12px',
          background: `${playerRatingColor(rating)}12`,
          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-md)',
          fontWeight: 700, color: playerRatingColor(rating),
        }}>{rating} OVR</div>
      </div>

      {capValue && (
        <div style={{
          background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)',
          padding: '10px 12px', marginBottom: 12,
        }}>
          <InfoRow label={capLabel} value={capValue} />
          <InfoRow label="Fanbase" value={`${(fanbase / 1000).toFixed(0)}K`} />
          <InfoRow label="Market" value={marketLabel} />
        </div>
      )}

      {topPlayers.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
          }}>Key Players</div>
          {topPlayers.map((p, i) => (
            <div key={p.id || i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 'var(--text-sm)', padding: '3px 0',
              borderBottom: i < topPlayers.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <span>
                <span style={{ color: 'var(--color-text-tertiary)', width: 28, display: 'inline-block' }}>{p.position}</span>
                {' '}{p.name}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: playerRatingColor(p.rating),
              }}>{Math.round(p.rating || 0)}</span>
            </div>
          ))}
        </div>
      )}

      {team.coach && (
        <div style={{
          fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 16,
        }}>
          Coach: <strong>{team.coach.name}</strong> ({team.coach.overall} OVR · {team.coach.archetype})
        </div>
      )}

      <button onClick={onConfirm} disabled={starting} style={{
        width: '100%', padding: 12, border: 'none',
        background: primary, color: '#fff',
        fontSize: 'var(--text-base)', fontWeight: 700,
        fontFamily: 'var(--font-body)',
        cursor: starting ? 'default' : 'pointer',
        opacity: starting ? 0.6 : 1,
      }}>
        {starting ? 'Starting Season…' : 'Start Season'}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Shared
   ═══════════════════════════════════════════════════════════════ */
function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 'var(--text-xs)' }}>
      <span style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)',
      fontFamily: 'var(--font-body)', padding: '4px 0', marginBottom: 16,
    }}>← Back</button>
  );
}

function formatCurrency(amount) {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return '$' + Math.round(amount / 1000) + 'K';
  return '$' + amount;
}

function playerRatingColor(r) {
  if (r >= 85) return 'var(--color-rating-elite)';
  if (r >= 78) return 'var(--color-rating-good)';
  if (r >= 70) return 'var(--color-rating-avg)';
  if (r >= 60) return 'var(--color-rating-below)';
  return 'var(--color-rating-poor)';
}

const phaseCenter = {
  display: 'flex', justifyContent: 'center', alignItems: 'center',
  minHeight: '100vh', padding: 'var(--space-6)', position: 'relative', zIndex: 1,
};
