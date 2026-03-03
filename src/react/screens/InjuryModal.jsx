import React, { useState, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

/* ═══════════════════════════════════════════════════════════════
   InjuryModal — native React injury decision modal.
   
   Three modes:
   1. AI team injury — informational, just "Continue"
   2. User team, can play through — choose Rest vs Play Through
   3. Severe/season-ending — no choice, info + possible DPE
   
   Props:
   - isOpen: boolean
   - data: { team, player, injury, isUserTeam }
   - onDecision: (decision) => void  — called with 'rest' | 'playThrough' | 'continue'
   ═══════════════════════════════════════════════════════════════ */

const SEVERITY_COLORS = {
  'minor':         { text: 'var(--color-warning)',  bg: 'var(--color-warning-bg)' },
  'moderate':      { text: '#e07a3a',               bg: '#fdf0e8' },
  'severe':        { text: 'var(--color-loss)',      bg: 'var(--color-loss-bg)' },
  'season-ending': { text: '#9a2020',               bg: '#fce4e4' },
};

export function InjuryModal({ isOpen, data, onDecision }) {
  const [selected, setSelected] = useState(null);

  if (!isOpen || !data) return null;

  const { team, player, injury, isUserTeam, aiDecision, dpeEligible, dpeAmount, formatCurrency } = data;
  const severity = SEVERITY_COLORS[injury.severity] || SEVERITY_COLORS.moderate;
  const canChoose = isUserTeam && injury.canPlayThrough;
  const isSevere = isUserTeam && !injury.canPlayThrough;

  const handleConfirm = () => {
    if (canChoose && !selected) return; // Must select
    const decision = canChoose ? selected : isSevere ? 'rest' : 'continue';
    setSelected(null);
    onDecision(decision);
  };

  const getRatingColor = (rating) => {
    if (rating >= 85) return 'var(--color-rating-elite)';
    if (rating >= 75) return 'var(--color-rating-good)';
    if (rating >= 65) return 'var(--color-rating-avg)';
    if (rating >= 55) return 'var(--color-rating-below)';
    return 'var(--color-rating-poor)';
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} maxWidth={560} zIndex={1300}>
      {/* ── Header ── */}
      <div style={{
        padding: 'var(--space-5) var(--space-6)',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: severity.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', flexShrink: 0,
        }}>
          🏥
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>
            Injury Report
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {team.city} {team.name}
          </div>
        </div>
      </div>

      <ModalBody>
        {/* ── Player Card ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
          padding: 'var(--space-4)',
          background: 'var(--color-bg-sunken)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-4)',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--radius-md)',
            background: getRatingColor(player.rating),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-lg)',
            flexShrink: 0,
          }}>
            {player.rating}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'var(--weight-semi)', fontSize: 'var(--text-base)' }}>
              {player.name}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              {player.position} · {player.age}yo
            </div>
          </div>
        </div>

        {/* ── Injury Details ── */}
        <div style={{
          padding: 'var(--space-4)',
          background: severity.bg,
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${severity.text}20`,
          marginBottom: 'var(--space-4)',
        }}>
          <div style={{
            fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)',
            color: severity.text, marginBottom: 4,
          }}>
            {injury.name}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
            textTransform: 'capitalize',
          }}>
            {injury.severity} injury
          </div>
        </div>

        {/* ── AI Decision (non-user team) ── */}
        {!isUserTeam && (
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--color-bg-sunken)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
              {team.name} has placed <strong>{player.name}</strong>{' '}
              {aiDecision === 'rest' ? 'on the injury report' : 'as day-to-day'}.
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {aiDecision === 'rest'
                ? `Expected return: ${injury.gamesRemaining === 999 ? 'End of season' : injury.gamesRemaining + ' games'}`
                : `Playing through — ${injury.gamesRemainingIfPlaying} games to full recovery`
              }
            </div>
          </div>
        )}

        {/* ── User Choice: Rest vs Play Through ── */}
        {canChoose && (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)',
            }}>
              <OptionCard
                selected={selected === 'rest'}
                onClick={() => setSelected('rest')}
                icon="🛌"
                title="Rest"
                subtitle="Recommended"
                color="var(--color-win)"
                colorBg="var(--color-win-bg)"
                details={[
                  { label: 'Out', value: `${injury.gamesRemaining} games` },
                  { label: 'Returns', value: 'at 100% health' },
                ]}
              />
              <OptionCard
                selected={selected === 'playThrough'}
                onClick={() => setSelected('playThrough')}
                icon="🏀"
                title="Play Through"
                subtitle="Risk"
                color="var(--color-warning)"
                colorBg="var(--color-warning-bg)"
                details={[
                  { label: 'Rating', value: `${player.rating} → ${player.rating + injury.ratingPenalty}` },
                  { label: 'Recovery', value: `${injury.gamesRemainingIfPlaying} games` },
                ]}
              />
            </div>
            {!selected && (
              <div style={{
                textAlign: 'center', fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)', marginTop: 'var(--space-3)',
              }}>
                Select a treatment option to continue
              </div>
            )}
          </>
        )}

        {/* ── Severe / Season-Ending (no choice) ── */}
        {isSevere && (
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--color-loss-bg)',
            border: '1px solid var(--color-loss)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{
              fontWeight: 'var(--weight-semi)', color: 'var(--color-loss)',
              marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)',
            }}>
              Placed on Injured Reserve
            </div>
            <div style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
              Expected return: {injury.gamesRemaining === 999 ? 'End of season' : `${injury.gamesRemaining} games`}
            </div>
            {injury.carryOver && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-loss)', fontWeight: 'var(--weight-semi)' }}>
                ⚠ Will miss start of next season
              </div>
            )}
            {dpeEligible && (
              <div style={{
                marginTop: 'var(--space-3)', padding: 'var(--space-3)',
                background: 'var(--color-win-bg)', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-win)',
              }}>
                <div style={{ fontWeight: 'var(--weight-semi)', color: 'var(--color-win)', fontSize: 'var(--text-sm)' }}>
                  ✅ Disabled Player Exception Approved
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Sign a replacement for {formatCurrency ? formatCurrency(dpeAmount) : `$${(dpeAmount / 1e6).toFixed(1)}M`}
                </div>
              </div>
            )}
          </div>
        )}
      </ModalBody>

      {/* ── Footer ── */}
      <ModalFooter>
        <Button
          variant={canChoose && !selected ? 'secondary' : 'primary'}
          disabled={canChoose && !selected}
          onClick={handleConfirm}
          style={{ minWidth: 160 }}
        >
          {canChoose ? 'Confirm Decision' : 'Continue'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}


/* ── Option Card (rest / play through) ── */
function OptionCard({ selected, onClick, icon, title, subtitle, color, colorBg, details }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        border: `2px solid ${selected ? color : hovered ? color + '40' : 'var(--color-border)'}`,
        background: selected ? colorBg : hovered ? colorBg + '80' : 'var(--color-bg-raised)',
        cursor: 'pointer',
        transition: 'all var(--duration-fast) ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span style={{ fontWeight: 'var(--weight-semi)', fontSize: 'var(--text-sm)', color: selected ? color : 'var(--color-text)' }}>
          {title}
        </span>
        <span style={{
          fontSize: '10px', padding: '1px 6px',
          background: color + '18', color,
          borderRadius: 'var(--radius-full)', fontWeight: 'var(--weight-semi)',
        }}>
          {subtitle}
        </span>
      </div>
      {details.map((d, i) => (
        <div key={i} style={{
          fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)',
          display: 'flex', justifyContent: 'space-between',
          marginBottom: i < details.length - 1 ? 2 : 0,
        }}>
          <span>{d.label}</span>
          <span style={{ fontWeight: 'var(--weight-semi)' }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}
