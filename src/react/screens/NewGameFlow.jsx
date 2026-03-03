import React, { useState, useMemo, useEffect } from 'react';

/* ═══════════════════════════════════════════════════════════════
   NewGameFlow — the front door of The Association Project.
   Three phases: Welcome → Tier Selection → Team Selection
   
   Renders when no userTeamId exists in gameState. Once a team
   is selected, calls the legacy selectTeam() to initialize the
   season and triggers React to show the main dashboard.
   ═══════════════════════════════════════════════════════════════ */
export function NewGameFlow({ gameState, onComplete }) {
  const [phase, setPhase] = useState('welcome'); // welcome | tier | team
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [starting, setStarting] = useState(false);

  const handleSelectTier = (tier) => {
    setSelectedTier(tier);
    setPhase('team');
  };

  const handleSelectTeam = (teamId) => {
    setSelectedTeamId(teamId);
  };

  const handleConfirm = () => {
    if (selectedTeamId == null || !selectedTier || starting) return;
    setStarting(true);
    // Call legacy selectTeam which initializes season, generates schedules, etc.
    if (window.selectTeam) {
      window.selectTeam(selectedTeamId, selectedTier);
    }
    onComplete?.();
  };

  const handleBack = () => {
    if (phase === 'team') {
      setPhase('tier');
      setSelectedTeamId(null);
    } else if (phase === 'tier') {
      setPhase('welcome');
      setSelectedTier(null);
    }
  };

  return (
    <div style={containerStyle}>
      {/* Background texture */}
      <div style={bgGlowStyle} />

      {phase === 'welcome' && (
        <WelcomePhase
          onNewGame={() => setPhase('tier')}
          hasSave={false} /* save detection handled outside */
        />
      )}
      {phase === 'tier' && (
        <TierPhase
          onSelect={handleSelectTier}
          onBack={handleBack}
        />
      )}
      {phase === 'team' && (
        <TeamPhase
          gameState={gameState}
          tier={selectedTier}
          selectedTeamId={selectedTeamId}
          onSelectTeam={handleSelectTeam}
          onConfirm={handleConfirm}
          onBack={handleBack}
          starting={starting}
        />
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Phase 1: Welcome
   ═══════════════════════════════════════════════════════════════ */
function WelcomePhase({ onNewGame }) {
  return (
    <div style={phaseStyle}>
      <div style={{
        animation: 'fadeIn 0.8s ease both',
        textAlign: 'center',
        maxWidth: 600,
      }}>
        {/* Logo / Title */}
        <div style={{
          fontSize: '4em',
          marginBottom: 'var(--space-4)',
          filter: 'drop-shadow(0 4px 12px rgba(212, 168, 67, 0.3))',
        }}>🏀</div>
        <h1 style={{
          fontSize: 'clamp(2em, 5vw, 3.2em)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          margin: 0,
          marginBottom: 'var(--space-3)',
        }}>
          The Association
          <br />
          <span style={{
            fontSize: '0.4em',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--color-accent)',
          }}>
            Project
          </span>
        </h1>

        <p style={{
          fontSize: 'var(--text-md)',
          color: 'var(--color-text-secondary)',
          maxWidth: 440,
          margin: '0 auto',
          lineHeight: 'var(--leading-relaxed)',
          marginBottom: 'var(--space-8)',
        }}>
          Build a dynasty across three tiers of professional basketball.
          Draft, trade, develop, and compete for championships.
        </p>

        <button
          onClick={onNewGame}
          style={primaryBtnStyle}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(212, 168, 67, 0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(212, 168, 67, 0.15)'; }}
        >
          New Game
        </button>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Phase 2: Tier Selection
   ═══════════════════════════════════════════════════════════════ */
const tierData = [
  {
    tier: 1,
    name: 'North American Premier League',
    abbrev: 'NAPL',
    emoji: '🥇',
    color: '#d4a843',
    teams: 30,
    games: 82,
    desc: 'The pinnacle of basketball. 30 elite franchises competing in an 82-game season with a fixed salary cap, national TV revenue, and the biggest stage in the sport.',
    details: ['Fixed $100M salary cap', '6 divisions · 2 conferences', 'Promotion from T2 · Relegation to T2'],
  },
  {
    tier: 2,
    name: 'North American Regional Basketball League',
    abbrev: 'NARBL',
    emoji: '🥈',
    color: '#8a99aa',
    teams: 86,
    games: 60,
    desc: 'The stepping stone to the premier league. 86 teams play a 60-game season with revenue-based budgets and fierce competition for promotion.',
    details: ['Revenue-based spending limits', '12 divisions', 'Promotion to T1 · Relegation to T3'],
  },
  {
    tier: 3,
    name: 'Metro Basketball League',
    abbrev: 'MBL',
    emoji: '🥉',
    color: '#a0734f',
    teams: 144,
    games: 40,
    desc: 'Where every journey begins. 144 metro teams in a 40-game season. Build from the ground up and climb through the ranks.',
    details: ['Revenue-based spending limits', '16 divisions', 'Promotion to T2'],
  },
];

function TierPhase({ onSelect, onBack }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div style={phaseStyle}>
      <div style={{
        width: '100%', maxWidth: 900,
        animation: 'fadeIn 0.5s ease both',
      }}>
        <BackButton onClick={onBack} />

        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <h2 style={{
            fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)',
            margin: 0, marginBottom: 'var(--space-2)',
          }}>Choose Your Starting Tier</h2>
          <p style={{
            color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)',
            margin: 0,
          }}>Each tier offers a different challenge. You can climb — or fall — between tiers through promotion and relegation.</p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-5)',
        }}>
          {tierData.map((td, i) => (
            <button
              key={td.tier}
              onClick={() => onSelect(td.tier)}
              onMouseEnter={() => setHovered(td.tier)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: hovered === td.tier
                  ? 'var(--color-bg-raised)'
                  : 'var(--color-bg-raised)',
                border: `1px solid ${hovered === td.tier ? td.color : 'var(--color-border-subtle)'}`,
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-6)',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
                transition: 'all var(--duration-normal) ease',
                transform: hovered === td.tier ? 'translateY(-4px)' : 'translateY(0)',
                boxShadow: hovered === td.tier
                  ? `0 12px 40px ${td.color}22, 0 0 0 1px ${td.color}44`
                  : 'var(--shadow-sm)',
                animation: `slideUp 0.5s ease ${i * 0.1}s both`,
              }}
            >
              <div style={{ fontSize: '2em', marginBottom: 'var(--space-3)' }}>{td.emoji}</div>
              <div style={{
                fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semi)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: td.color, marginBottom: 'var(--space-1)',
              }}>{td.abbrev}</div>
              <div style={{
                fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)',
                marginBottom: 'var(--space-3)', lineHeight: 'var(--leading-tight)',
              }}>{td.name}</div>
              <p style={{
                fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
                lineHeight: 'var(--leading-relaxed)', margin: 0,
                marginBottom: 'var(--space-4)',
              }}>{td.desc}</p>

              <div style={{
                display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-sm)',
              }}>
                <span style={{ fontWeight: 'var(--weight-semi)' }}>{td.teams} teams</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>·</span>
                <span style={{ fontWeight: 'var(--weight-semi)' }}>{td.games} games</span>
              </div>

              <div style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
              }}>
                {td.details.map((d, j) => (
                  <span key={j}>{d}</span>
                ))}
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

  // Group by division
  const divisions = useMemo(() => {
    if (!teams) return {};
    const groups = {};
    teams.forEach(team => {
      const div = team.division || 'Other';
      if (!groups[div]) groups[div] = [];
      groups[div].push(team);
    });
    // Sort teams within division by rating desc
    Object.values(groups).forEach(arr => arr.sort((a, b) => (b.rating || 0) - (a.rating || 0)));
    return groups;
  }, [teams]);

  const selectedTeam = teams?.find(t => t.id === selectedTeamId);

  // Ensure finances for selected team
  useEffect(() => {
    if (selectedTeam && window.FinanceEngine?.ensureFinances) {
      window.FinanceEngine.ensureFinances(selectedTeam);
    }
  }, [selectedTeam]);

  const divEntries = Object.entries(divisions).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div style={{ ...phaseStyle, alignItems: 'flex-start', paddingTop: 'var(--space-6)' }}>
      <div style={{
        width: '100%', maxWidth: 1000,
        animation: 'fadeIn 0.4s ease both',
      }}>
        <BackButton onClick={onBack} />

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          marginBottom: 'var(--space-6)',
        }}>
          <div>
            <div style={{
              fontSize: 'var(--text-xs)', textTransform: 'uppercase',
              letterSpacing: '0.08em', color: td?.color || 'var(--color-accent)',
              fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-1)',
            }}>{td?.abbrev} · Tier {tier}</div>
            <h2 style={{
              fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)',
              margin: 0,
            }}>Select Your Team</h2>
          </div>

          {/* Confirm button */}
          {selectedTeam && (
            <button
              onClick={handleConfirmClick}
              disabled={starting}
              style={{
                ...primaryBtnStyle,
                opacity: starting ? 0.6 : 1,
                fontSize: 'var(--text-base)',
                padding: '10px 28px',
              }}
              onMouseEnter={e => { if (!starting) { e.currentTarget.style.transform = 'translateY(-2px)'; }}}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {starting ? 'Starting…' : `Start as ${selectedTeam.name} →`}
            </button>
          )}
        </div>

        {/* Two-column: Team grid + Selection detail */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedTeam ? '1fr 320px' : '1fr',
          gap: 'var(--space-5)',
          alignItems: 'start',
        }}>
          {/* Team grid */}
          <div style={{
            maxHeight: 'calc(100vh - 200px)', overflowY: 'auto',
            paddingRight: 'var(--space-2)',
          }}>
            {divEntries.map(([division, divTeams]) => (
              <DivisionGroup
                key={division}
                division={division}
                teams={divTeams}
                tier={tier}
                selectedTeamId={selectedTeamId}
                onSelect={onSelectTeam}
                tierColor={td?.color}
              />
            ))}
          </div>

          {/* Selected team detail panel */}
          {selectedTeam && (
            <TeamDetailPanel
              team={selectedTeam}
              tier={tier}
              tierColor={td?.color}
              onConfirm={onConfirm}
              starting={starting}
            />
          )}
        </div>
      </div>
    </div>
  );

  function handleConfirmClick() {
    onConfirm();
  }
}

function DivisionGroup({ division, teams, tier, selectedTeamId, onSelect, tierColor }) {
  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div style={{
        fontSize: 'var(--text-xs)', textTransform: 'uppercase',
        letterSpacing: '0.06em', fontWeight: 'var(--weight-semi)',
        color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)',
        paddingBottom: 'var(--space-1)', borderBottom: '1px solid var(--color-border-subtle)',
      }}>{division}</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 'var(--space-2)',
      }}>
        {teams.map(team => (
          <TeamCard
            key={team.id}
            team={team}
            tier={tier}
            isSelected={team.id === selectedTeamId}
            onSelect={() => onSelect(team.id)}
            tierColor={tierColor}
          />
        ))}
      </div>
    </div>
  );
}

function TeamCard({ team, tier, isSelected, onSelect, tierColor }) {
  const [hovered, setHovered] = useState(false);
  const rating = Math.round(team.rating || 0);
  const rColor = rating >= 78 ? 'var(--color-rating-good)' : rating >= 68 ? 'var(--color-rating-avg)' : 'var(--color-rating-below)';

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isSelected ? `${tierColor}14` : hovered ? 'var(--color-bg-hover)' : 'var(--color-bg-raised)',
        border: `1px solid ${isSelected ? tierColor : hovered ? 'var(--color-border)' : 'var(--color-border-subtle)'}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-body)',
        transition: 'all var(--duration-fast) ease',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}
    >
      <div>
        <div style={{
          fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semi)',
          marginBottom: 2,
        }}>{team.name}</div>
        <div style={{
          fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
        }}>{team.city || ''}</div>
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-bold)', color: rColor,
      }}>{rating}</div>
    </button>
  );
}

function TeamDetailPanel({ team, tier, tierColor, onConfirm, starting }) {
  const FE = window.FinanceEngine;
  let capLabel = '', capValue = '', fanbase = 0, marketLabel = '';

  if (FE && team.finances) {
    FE.ensureFinances(team);
    const limit = FE.getSpendingLimit(team);
    capLabel = tier === 1 ? 'Salary Cap' : 'Spending Limit';
    capValue = formatCurrency(limit);
    fanbase = team.finances.fanbase || 0;
    const ms = team.finances.marketSize || 1;
    marketLabel = ms >= 1.2 ? '🏙️ Major Market' : ms >= 1.0 ? '🏘️ Mid Market' : ms >= 0.8 ? '🏡 Small Market' : '🏚️ Tiny Market';
  }

  const rating = Math.round(team.rating || 0);
  const rColor = rating >= 78 ? 'var(--color-rating-good)' : rating >= 68 ? 'var(--color-rating-avg)' : 'var(--color-rating-below)';

  // Top players
  const topPlayers = (team.roster || [])
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5);

  return (
    <div style={{
      background: 'var(--color-bg-raised)',
      border: `1px solid ${tierColor}44`,
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-5)',
      position: 'sticky', top: 'var(--space-6)',
      animation: 'fadeIn 0.3s ease both',
    }}>
      {/* Team name + rating */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{
          fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)',
          marginBottom: 2,
        }}>{team.name}</div>
        <div style={{
          fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)',
          marginBottom: 'var(--space-3)',
        }}>
          {team.city || ''} · {team.division || ''}
        </div>
        <div style={{
          display: 'inline-block',
          background: `${rColor}18`,
          borderRadius: 'var(--radius-sm)',
          padding: '4px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-md)',
          fontWeight: 'var(--weight-bold)',
          color: rColor,
        }}>
          {rating} OVR
        </div>
      </div>

      {/* Finance info */}
      {capValue && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-3)',
          background: 'var(--color-bg-sunken)',
          borderRadius: 'var(--radius-md)',
        }}>
          <InfoRow label={capLabel} value={capValue} />
          <InfoRow label="Fanbase" value={`${(fanbase / 1000).toFixed(0)}K`} />
          <InfoRow label="Market" value={marketLabel} />
        </div>
      )}

      {/* Top players */}
      {topPlayers.length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{
            fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-2)',
          }}>Key Players</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {topPlayers.map((p, i) => (
              <div key={p.id || i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 'var(--text-sm)', padding: '3px 0',
              }}>
                <span>
                  <span style={{ color: 'var(--color-text-tertiary)', width: 28, display: 'inline-block' }}>{p.position}</span>
                  {' '}{p.name}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-semi)',
                  color: playerRatingColor(p.rating),
                }}>{Math.round(p.rating || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coach */}
      {team.coach && (
        <div style={{
          fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-5)',
        }}>
          Coach: <strong>{team.coach.name}</strong> ({team.coach.overall} OVR · {team.coach.archetype})
        </div>
      )}

      {/* Confirm */}
      <button
        onClick={onConfirm}
        disabled={starting}
        style={{
          ...primaryBtnStyle,
          width: '100%',
          opacity: starting ? 0.6 : 1,
          fontSize: 'var(--text-base)',
          padding: '12px',
        }}
        onMouseEnter={e => { if (!starting) e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {starting ? 'Starting Season…' : 'Start Season →'}
      </button>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Shared primitives
   ═══════════════════════════════════════════════════════════════ */
function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
      <span style={{ fontWeight: 'var(--weight-medium)' }}>{value}</span>
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)',
        fontFamily: 'var(--font-body)', padding: '4px 0',
        marginBottom: 'var(--space-4)',
        transition: 'color var(--duration-fast) ease',
      }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
    >
      ← Back
    </button>
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


/* ═══════════════════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════════════════ */
const containerStyle = {
  minHeight: '100vh',
  background: 'var(--color-bg)',
  position: 'relative',
  overflow: 'hidden',
};

const bgGlowStyle = {
  position: 'fixed',
  top: '-30%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '120vw',
  height: '60vh',
  background: 'radial-gradient(ellipse, rgba(212, 168, 67, 0.06) 0%, transparent 70%)',
  pointerEvents: 'none',
  zIndex: 0,
};

const phaseStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  padding: 'var(--space-6)',
  position: 'relative',
  zIndex: 1,
};

const primaryBtnStyle = {
  background: 'var(--color-accent)',
  color: '#1a1a2e',
  border: 'none',
  borderRadius: 'var(--radius-lg)',
  padding: '14px 36px',
  fontSize: 'var(--text-lg)',
  fontWeight: 'var(--weight-bold)',
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
  transition: 'all var(--duration-normal) ease',
  boxShadow: '0 4px 16px rgba(212, 168, 67, 0.15)',
};
