import React, { useState, useEffect } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';

/* ═══════════════════════════════════════════════════════════════
   OffseasonTracker — persistent banner during offseason flow.
   
   Shows the current phase in a horizontal stepper bar at the
   top of the screen (below the TopBar). The actual phase
   content is still handled by legacy modals — this React
   component provides visual context for where you are in the
   multi-step offseason pipeline.
   
   Phase progression:
   Season End → Playoffs → Promo/Rel → Draft → Development →
   Free Agency → Roster Check → Owner Mode → New Season
   ═══════════════════════════════════════════════════════════════ */

const PHASE_STEPS = [
  { key: 'season_ended',       label: 'Season End',   icon: '🏁', short: 'End' },
  { key: 'postseason',         label: 'Playoffs',     icon: '🏆', short: 'Playoffs' },
  { key: 'promo_rel',          label: 'Promo / Rel',  icon: '⬆️', short: 'P/R' },
  { key: 'draft',              label: 'Draft',        icon: '🎓', short: 'Draft' },
  { key: 'college_fa',         label: 'College FA',   icon: '📋', short: 'CFA' },
  { key: 'development',        label: 'Development',  icon: '🌟', short: 'Dev' },
  { key: 'free_agency',        label: 'Free Agency',  icon: '🤝', short: 'FA' },
  { key: 'roster_compliance',  label: 'Roster Check', icon: '✅', short: 'Roster' },
  { key: 'owner_mode',         label: 'Owner Mode',   icon: '💼', short: 'Owner' },
  { key: 'setup_complete',     label: 'New Season',   icon: '🏀', short: 'Ready' },
];

export function OffseasonTracker() {
  const { gameState } = useGame();
  const [currentPhase, setCurrentPhase] = useState(null);

  // Poll for phase changes (gameState.offseasonPhase is mutated by legacy code)
  useEffect(() => {
    const check = () => {
      const raw = gameState?._raw || gameState;
      const phase = raw?.offseasonPhase;
      if (phase && phase !== 'none') {
        setCurrentPhase(phase);
      } else {
        setCurrentPhase(null);
      }
    };
    check();
    const interval = setInterval(check, 500);
    return () => clearInterval(interval);
  }, [gameState]);

  if (!currentPhase) return null;

  const currentIdx = PHASE_STEPS.findIndex(s => s.key === currentPhase);

  return (
    <div style={{
      background: 'var(--color-bg-raised)',
      borderBottom: '1px solid var(--color-border-subtle)',
      padding: '8px var(--space-6)',
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      overflowX: 'auto',
      zIndex: 90,
    }}>
      {/* Label */}
      <div style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-semi)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--color-accent)',
        marginRight: 'var(--space-4)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        Offseason
      </div>

      {/* Steps */}
      {PHASE_STEPS.map((step, i) => {
        const isActive = step.key === currentPhase;
        const isDone = i < currentIdx;
        const isFuture = i > currentIdx;

        return (
          <React.Fragment key={step.key}>
            {/* Connector line */}
            {i > 0 && (
              <div style={{
                width: 16,
                height: 2,
                background: isDone ? 'var(--color-accent)' : 'var(--color-border-subtle)',
                flexShrink: 0,
                transition: 'background 0.3s ease',
              }} />
            )}

            {/* Step dot + label */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, flexShrink: 0, minWidth: 44,
            }}>
              <div style={{
                width: isActive ? 24 : 18,
                height: isActive ? 24 : 18,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isActive ? '12px' : '9px',
                background: isDone
                  ? 'var(--color-accent)'
                  : isActive
                    ? 'var(--color-bg)'
                    : 'var(--color-bg-sunken)',
                border: isActive
                  ? '2px solid var(--color-accent)'
                  : isDone
                    ? 'none'
                    : '1px solid var(--color-border-subtle)',
                color: isDone ? '#1a1a2e' : isActive ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                transition: 'all 0.3s ease',
                boxShadow: isActive ? '0 0 8px rgba(212, 168, 67, 0.25)' : 'none',
              }}>
                {isDone ? '✓' : step.icon}
              </div>
              <span style={{
                fontSize: '9px',
                fontWeight: isActive ? 'var(--weight-semi)' : 'var(--weight-normal)',
                color: isActive ? 'var(--color-text)' : isFuture ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
                opacity: isFuture ? 0.5 : 1,
                transition: 'all 0.3s ease',
              }}>
                {step.short}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
