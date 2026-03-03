import React, { useState, useCallback } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { TierBadge } from './Badge.jsx';

export function TopBar() {
  const { gameState, engines } = useGame();
  if (!gameState?.userTeam) return null;

  const { userTeam, currentSeason, currentDate, currentTier } = gameState;
  const { CalendarEngine } = engines;

  // Format date
  let dateStr = '—';
  if (currentDate && CalendarEngine?.formatDateDisplay) {
    dateStr = CalendarEngine.formatDateDisplay(currentDate);
  }

  // Format season
  const seasonStr = `${currentSeason}–${String((currentSeason + 1) % 100).padStart(2, '0')}`;

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(250, 249, 247, 0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--color-border-subtle)',
      padding: '0 var(--space-6)',
      height: 'var(--topbar-height)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      {/* Left: Logo + Team */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <span style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--weight-bold)',
          color: 'var(--color-text)',
          letterSpacing: '-0.02em',
        }}>
          The Association
        </span>
        <Divider />
        <TierBadge tier={currentTier} />
        <span style={{
          fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-medium)',
          color: 'var(--color-text)',
        }}>
          {userTeam.name}
        </span>
        <Divider />
        <Stat label="Record" value={`${userTeam.wins}–${userTeam.losses}`}
          valueColor={userTeam.wins > userTeam.losses ? 'var(--color-win)' :
                      userTeam.wins < userTeam.losses ? 'var(--color-loss)' :
                      'var(--color-text)'} />
        <Stat label="Season" value={seasonStr} />
        <Stat label="Date" value={dateStr} />
      </div>

      {/* Right: Sim Controls + Actions + Menu */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
      }}>
        <SimControls gameState={gameState} />
        <Divider />
        <TopBarButton label="Trade" icon="🔄" onClick={() => window._reactOpenTrade?.()} />
        <TopBarButton label="Menu" icon="⚙️" onClick={() => {
          if (window._reactOpenGameMenu) window._reactOpenGameMenu();
          else window.openGameMenu?.();
        }} />
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sim Controls — always visible in the top bar
   ═══════════════════════════════════════════════════════════════ */
function SimControls({ gameState }) {
  const [simming, setSimming] = useState(false);

  const isComplete = gameState?.isSeasonComplete;
  const offPhase = gameState?.offseasonPhase;
  const inOffseason = offPhase && offPhase !== 'none';
  const disabled = isComplete || simming;

  const wrap = useCallback((fn) => {
    return () => {
      if (simming) return;
      setSimming(true);
      setTimeout(() => {
        fn?.();
        setTimeout(() => setSimming(false), 200);
      }, 10);
    };
  }, [simming]);

  // ── Offseason mode: show "Continue Offseason" button ──
  if (inOffseason) {
    const PHASE_LABELS = {
      season_ended: 'Review Season',
      postseason: 'Playoffs',
      promo_rel: 'Promotion / Relegation',
      draft: 'Draft',
      college_fa: 'College Free Agency',
      development: 'Player Development',
      free_agency: 'Free Agency',
      roster_compliance: 'Roster Compliance',
      owner_mode: 'Owner Decisions',
      setup_complete: 'Start New Season',
    };
    const label = PHASE_LABELS[offPhase] || 'Continue';

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        background: 'var(--color-bg-sunken)',
        borderRadius: 'var(--radius-md)',
        padding: 2,
      }}>
        <button
          onClick={wrap(() => window.resumeOffseason?.())}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 'calc(var(--radius-md) - 2px)',
            border: 'none',
            background: 'var(--color-accent)',
            color: '#1a1a2e',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-bold)',
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'opacity var(--duration-fast) ease',
            opacity: simming ? 0.6 : 1,
          }}
        >
          <span style={{ fontSize: '0.85em' }}>📋</span>
          {label} →
        </button>
      </div>
    );
  }

  // ── Regular season mode ──
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      background: 'var(--color-bg-sunken)',
      borderRadius: 'var(--radius-md)',
      padding: 2,
    }}>
      <SimBtn icon="▶" label="Next" onClick={wrap(() => window.simNextGame?.())} disabled={disabled} />
      <SimBtn icon="👁" label="Watch" onClick={wrap(() => window.watchNextGame?.())} disabled={disabled} accent />
      <SimDivider />
      <SimBtn icon="📅" label="Day" onClick={wrap(() => window.simDay?.())} disabled={disabled} />
      <SimBtn icon="⏩" label="Week" onClick={wrap(() => window.simWeek?.())} disabled={disabled} />
      <SimBtn icon="⏭" label="Finish" onClick={wrap(() => window.finishSeason?.())} disabled={disabled} />
    </div>
  );
}

function SimBtn({ icon, label, onClick, disabled, accent }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 10px',
        borderRadius: 'calc(var(--radius-md) - 2px)',
        border: 'none',
        background: hovered && !disabled
          ? accent ? 'var(--color-accent)' : 'var(--color-bg-raised)'
          : 'transparent',
        color: disabled
          ? 'var(--color-text-tertiary)'
          : accent && hovered
            ? '#1a1a2e'
            : 'var(--color-text-secondary)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-medium)',
        fontFamily: 'var(--font-body)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all var(--duration-fast) ease',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '0.85em' }}>{icon}</span>
      {label}
    </button>
  );
}

function SimDivider() {
  return (
    <div style={{
      width: 1, height: 16,
      background: 'var(--color-border)',
      margin: '0 2px',
    }} />
  );
}

/* ═══════════════════════════════════════════════════════════════
   Shared primitives
   ═══════════════════════════════════════════════════════════════ */
function Stat({ label, value, valueColor }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontWeight: 'var(--weight-medium)',
        marginBottom: 1,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 'var(--text-base)',
        fontWeight: 'var(--weight-semi)',
        color: valueColor || 'var(--color-text)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 24, background: 'var(--color-border)' }} />;
}

function TopBarButton({ label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: '6px 10px',
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        background: 'transparent',
        color: 'var(--color-text-secondary)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-medium)',
        fontFamily: 'var(--font-body)',
        cursor: 'pointer',
        transition: 'background var(--duration-fast) ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
}
