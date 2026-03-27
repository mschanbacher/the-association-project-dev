import React, { useState, useMemo } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Modal, ModalBody, ModalFooter } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';
import { ratingColor, SectionLabel, AttrBars } from '../visualizations/PlayerVisuals.jsx';

// ═══════════════════════════════════════════════════════════════
// Inbound Loan Request Modal
// Shown when a higher-tier AI team wants to borrow one of your players
// ═══════════════════════════════════════════════════════════════

const fmtCurrency = (v) => {
  if (v >= 1000000) return '$' + (v / 1000000).toFixed(2) + 'M';
  if (v >= 1000) return '$' + (v / 1000).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
};

const TIER_NAMES = { 1: 'NBA', 2: 'NARBL', 3: 'MBL' };

export function InboundLoanRequestModal({ isOpen, data, onRespond }) {
  const [showDetail, setShowDetail] = useState(false);
  const { engines } = useGame();

  // Destructure safely before early return
  const borrowingTeam = data?.borrowingTeam;
  const injuredPlayer = data?.injuredPlayer;
  const requestedPlayer = data?.requestedPlayer;
  const offerAmount = data?.offerAmount || 0;
  const proratedSalary = data?.proratedSalary || 0;
  const gamesRemaining = data?.gamesRemaining || 0;

  if (!isOpen || !data) return null;

  const totalRevenue = offerAmount; // Loan fee is pure revenue for lending team
  const tierName = TIER_NAMES[borrowingTeam.tier] || 'League';

  return (
    <Modal isOpen={isOpen} onClose={() => {}} maxWidth={580} zIndex={1300}>
      <ModalBody style={{ padding: 0 }}>
        <div style={{ borderTop: '3px solid var(--color-info)' }}>
          {/* Header */}
          <div style={{
            padding: '16px 24px', borderBottom: '1px solid var(--color-border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'var(--color-info)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2,
              }}>Inbound Loan Request</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {borrowingTeam.city} {borrowingTeam.name}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>{tierName}</div>
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {/* Context */}
            <div style={{
              padding: '12px 14px', background: 'var(--color-info-bg)',
              border: '1px solid rgba(53,116,196,0.15)', marginBottom: 16,
              fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5,
            }}>
              <strong style={{ color: 'var(--color-text)' }}>{borrowingTeam.city} {borrowingTeam.name}</strong> ({tierName}) has lost{' '}
              <strong style={{ color: 'var(--color-text)' }}>{injuredPlayer.name}</strong> ({injuredPlayer.position}, {injuredPlayer.rating} OVR) to a season-ending injury and has been granted a Disabled Player Exception. They are requesting an emergency loan of your player.
            </div>

            {/* Requested player */}
            <div style={{
              padding: '14px', background: 'var(--color-bg-sunken)',
              border: '1px solid var(--color-border-subtle)', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: showDetail ? 14 : 0 }}>
                <div style={{
                  width: 44, height: 44, background: ratingColor(requestedPlayer.rating),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-text-inverse)', fontWeight: 700, fontSize: 16,
                  fontFamily: 'var(--font-mono)',
                }}>{requestedPlayer.rating}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>{requestedPlayer.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {requestedPlayer.position} · {requestedPlayer.age}yo · {fmtCurrency(requestedPlayer.salary || 0)}/yr
                  </div>
                </div>
                <button onClick={() => setShowDetail(!showDetail)} style={{
                  fontSize: 'var(--text-xs)', color: 'var(--color-accent)', cursor: 'pointer',
                  padding: '4px 8px', border: '1px solid var(--color-accent-border)',
                  background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 600,
                }}>
                  {showDetail ? 'Hide Stats' : 'View Stats'}
                </button>
              </div>

              {showDetail && (
                <PlayerQuickStats player={requestedPlayer} engines={engines} />
              )}
            </div>

            {/* Offer terms */}
            <SectionLabel>Loan Terms</SectionLabel>
            <div style={{
              padding: '10px 14px', background: 'var(--color-bg-sunken)',
              border: '1px solid var(--color-border-subtle)', marginBottom: 16,
            }}>
              <CostRow label="Loan fee (you receive)" value={fmtCurrency(offerAmount)} valueColor="var(--color-win)" />
              <CostRow label="Duration" value={`Rest of season (~${gamesRemaining} games)`} />
              <CostRow label="Player returns when" value="Injured player heals or season ends" />
              <CostRow label="Your salary relief" value={fmtCurrency(proratedSalary)} />
            </div>

            {/* Impact note */}
            {(() => {
              const gp = requestedPlayer.seasonStats?.gamesPlayed || 1;
              const mpg = gp > 0 ? ((requestedPlayer.seasonStats?.minutesPlayed || 0) / gp).toFixed(1) : '0.0';
              const isStarter = parseFloat(mpg) >= 20;
              return (
                <div style={{
                  padding: '8px 12px',
                  borderLeft: `3px solid ${isStarter ? 'var(--color-warning)' : 'var(--color-border)'}`,
                  background: isStarter ? 'var(--color-warning-bg)' : 'var(--color-bg-sunken)',
                  fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5,
                  marginBottom: 16,
                }}>
                  {isStarter
                    ? `${requestedPlayer.name} averages ${mpg} minutes per game. Loaning a rotation player will weaken your roster for the remainder of the season.`
                    : `${requestedPlayer.name} averages ${mpg} minutes per game. Loaning a bench player for ${fmtCurrency(offerAmount)} could be a valuable revenue boost.`
                  }
                </div>
              );
            })()}
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="success" onClick={() => onRespond('accept')}>
          Accept Loan ({fmtCurrency(offerAmount)})
        </Button>
        <Button variant="secondary" onClick={() => onRespond('decline')}>
          Decline
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function PlayerQuickStats({ player, engines }) {
  const { StatEngine, PlayerAttributes: PA } = engines || {};
  const analytics = StatEngine?.getPlayerAnalytics?.(player) || null;
  const avgs = analytics?.avgs || null;
  const hasStats = avgs && avgs.gamesPlayed > 0;

  const stat = (v, d = 1) => v != null ? v.toFixed(d) : '—';
  const pct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—';

  if (!hasStats) {
    return <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>No stats available</div>;
  }

  return (
    <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        This Season — {avgs.gamesPlayed}G · {stat(avgs.minutesPerGame)} MPG
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 8 }}>
        {['PTS', 'REB', 'AST', 'STL', 'BLK', 'TOV'].map(h => (
          <div key={h} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>{h}</div>
        ))}
        {[avgs.pointsPerGame, avgs.reboundsPerGame, avgs.assistsPerGame, avgs.stealsPerGame, avgs.blocksPerGame, avgs.turnoversPerGame].map((v, i) => (
          <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>{stat(v)}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {['FG%', '3P%', 'FT%', 'TS%'].map(h => (
          <div key={h} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>{h}</div>
        ))}
        {[avgs.fieldGoalPct, avgs.threePointPct, avgs.freeThrowPct, avgs.trueShootingPct].map((v, i) => (
          <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>{pct(v)}</div>
        ))}
      </div>
      {analytics?.flags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
          {analytics.flags.map((f, i) => (
            <span key={i} style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px',
              border: `1px solid ${f.type === 'positive' ? 'var(--color-win)' : f.type === 'warning' ? 'var(--color-warning)' : 'var(--color-accent)'}`,
              color: f.type === 'positive' ? 'var(--color-win)' : f.type === 'warning' ? 'var(--color-warning)' : 'var(--color-accent)',
            }}>{f.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function CostRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        color: valueColor || 'var(--color-text)',
      }}>{value}</span>
    </div>
  );
}
