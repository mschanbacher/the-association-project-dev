import React, { useState, useEffect } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';

const PHASE_STEPS = [
  { key: 'season_ended',       label: 'End' },
  { key: 'postseason',         label: 'Playoffs' },
  { key: 'promo_rel',          label: 'P/R' },
  { key: 'draft',              label: 'Draft' },
  { key: 'college_fa',         label: 'CFA' },
  { key: 'development',        label: 'Dev' },
  { key: 'free_agency',        label: 'FA' },
  { key: 'roster_compliance',  label: 'Roster' },
  { key: 'owner_mode',         label: 'Owner' },
  { key: 'setup_complete',     label: 'Ready' },
];

export function OffseasonTracker() {
  const { gameState } = useGame();
  const [currentPhase, setCurrentPhase] = useState(null);

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
      padding: '10px var(--space-6)',
      display: 'flex', alignItems: 'center', gap: 0,
      overflowX: 'auto', zIndex: 90,
    }}>
      {/* Label */}
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--color-accent)',
        marginRight: 16, flexShrink: 0,
      }}>Offseason</div>

      {/* Steps */}
      {PHASE_STEPS.map((step, i) => {
        const isActive = step.key === currentPhase;
        const isDone = i < currentIdx;
        const isFuture = i > currentIdx;

        return (
          <React.Fragment key={step.key}>
            {i > 0 && (
              <div style={{
                width: 20, height: 2, flexShrink: 0,
                background: isDone ? 'var(--color-accent)' : 'var(--color-border-subtle)',
                transition: 'background 0.3s',
              }} />
            )}

            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, flexShrink: 0, minWidth: 40,
            }}>
              <div style={{
                width: isActive ? 20 : 16,
                height: isActive ? 20 : 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isDone ? 10 : 8,
                background: isDone ? 'var(--color-accent)'
                  : isActive ? 'var(--color-bg-raised)'
                  : 'var(--color-bg-sunken)',
                border: isActive ? '2px solid var(--color-accent)'
                  : isDone ? 'none'
                  : '1px solid var(--color-border-subtle)',
                color: isDone ? 'var(--color-text-inverse)'
                  : isActive ? 'var(--color-accent)'
                  : 'var(--color-text-tertiary)',
                fontWeight: 700,
                transition: 'all 0.2s ease',
              }}>
                {isDone ? '✓' : (i + 1)}
              </div>
              <span style={{
                fontSize: 9, whiteSpace: 'nowrap',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--color-text)'
                  : isFuture ? 'var(--color-text-tertiary)'
                  : 'var(--color-text-secondary)',
                opacity: isFuture ? 0.5 : 1,
                transition: 'all 0.3s ease',
              }}>{step.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
