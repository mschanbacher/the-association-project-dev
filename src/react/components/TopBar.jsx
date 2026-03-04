import React, { useState, useCallback } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { TierBadge } from './Badge.jsx';

export function TopBar() {
  const { gameState, engines } = useGame();
  if (!gameState?.userTeam) return null;

  const { userTeam, currentSeason, currentDate, currentTier } = gameState;
  const { CalendarEngine } = engines;

  let dateStr = '—';
  if (currentDate && CalendarEngine?.formatDateDisplay) {
    dateStr = CalendarEngine.formatDateDisplay(currentDate);
  }
  const seasonStr = `${currentSeason}–${String((currentSeason + 1) % 100).padStart(2, '0')}`;

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'var(--color-bg-raised)',
      borderBottom: '1px solid var(--color-border)',
      padding: '0 var(--space-6)',
      height: 'var(--topbar-height)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      {/* Left: Identity mark + title + context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        {/* Team identity gradient mark */}
        <div style={{
          width: 3,
          height: 24,
          background: 'linear-gradient(180deg, var(--color-accent), var(--color-accent-secondary))',
        }} />
        <span style={{
          fontSize: 'var(--text-md)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: '-0.01em',
        }}>
          The Association
        </span>
        <span style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-medium)',
          color: 'var(--color-text-tertiary)',
        }}>
          Season {seasonStr} · {dateStr}
        </span>
      </div>

      {/* Right: Sim controls + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <SimControls gameState={gameState} />
        <Divider />
        <TopBarButton label="Trade" onClick={() => window._reactOpenTrade?.()} />
        <TopBarButton label="Menu" onClick={() => {
          if (window._reactOpenGameMenu) window._reactOpenGameMenu();
          else window.openGameMenu?.();
        }} />
      </div>
    </header>
  );
}

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
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button
          onClick={wrap(() => window.resumeOffseason?.())}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', border: 'none',
            background: 'var(--color-accent)',
            color: 'var(--color-text-inverse)',
            fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
            fontFamily: 'var(--font-body)', cursor: 'pointer',
            opacity: simming ? 0.5 : 1,
            transition: 'opacity var(--duration-fast) ease',
          }}
        >
          {PHASE_LABELS[offPhase] || 'Continue'} →
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <SimBtn label="Next" onClick={wrap(() => window.simNextGame?.())} disabled={disabled} />
      <SimBtn label="Watch" onClick={wrap(() => window.watchNextGame?.())} disabled={disabled} accent />
      <SimDivider />
      <SimBtn label="Day" onClick={wrap(() => window.simDay?.())} disabled={disabled} />
      <SimBtn label="Week" onClick={wrap(() => window.simWeek?.())} disabled={disabled} />
      <SimBtn label="Finish" onClick={wrap(() => window.finishSeason?.())} disabled={disabled} />
    </div>
  );
}

function SimBtn({ label, onClick, disabled, accent }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px 10px', border: 'none',
        background: hovered && !disabled
          ? accent ? 'var(--color-accent)' : 'var(--color-bg-raised)'
          : 'transparent',
        color: disabled ? 'var(--color-text-tertiary)'
          : accent && hovered ? 'var(--color-text-inverse)'
          : 'var(--color-text-secondary)',
        fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)',
        fontFamily: 'var(--font-body)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all var(--duration-fast) ease',
      }}
    >
      {label}
    </button>
  );
}

function SimDivider() {
  return <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 2px' }} />;
}

function Divider() {
  return <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />;
}

function TopBarButton({ label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px 10px', border: 'none',
        background: hovered ? 'var(--color-bg-hover)' : 'transparent',
        color: 'var(--color-text-secondary)',
        fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
        fontFamily: 'var(--font-body)', cursor: 'pointer',
        transition: 'background var(--duration-fast) ease',
      }}
    >
      {label}
    </button>
  );
}
