import React, { useState, useMemo, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

export function CoachModal({ isOpen, data, onClose }) {
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketTab, setMarketTab] = useState('freeAgent');
  const [refreshKey, setRefreshKey] = useState(0);

  // Extract data safely before early return
  const coach = data?.coach;
  const synergy = data?.synergy;
  const traits = data?.traits;
  const freeAgents = data?.freeAgents || [];
  const poachable = data?.poachable || [];
  const formatCurrency = data?.formatCurrency || (v => `$${(v/1e6).toFixed(1)}M`);
  const getOverallColor = data?.getOverallColor || (() => 'var(--color-accent)');
  const getTraitColor = data?.getTraitColor || (() => 'var(--color-accent)');
  const getTraitLabel = data?.getTraitLabel || (() => '');

  if (!isOpen || !data) return null;

  const handleHire = (coachId, isPoach) => {
    if (window.hireCoach) {
      window.hireCoach(coachId, isPoach);
    }
    onClose();
  };

  const handleFire = () => {
    if (window.fireCoach) {
      window.fireCoach();
    }
    onClose();
  };

  const handleBrowseMarket = () => {
    setMarketOpen(true);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={900} zIndex={1300}>
      <ModalHeader onClose={onClose}>
        {'\ud83c\udf93'} Coaching Staff
      </ModalHeader>

      <ModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        {/* Current Coach or Warning */}
        {coach ? (
          <CurrentCoachSection coach={coach} synergy={synergy} traits={traits}
            formatCurrency={formatCurrency} getOverallColor={getOverallColor}
            getTraitColor={getTraitColor} getTraitLabel={getTraitLabel} />
        ) : (
          <div style={{
            textAlign: 'center', padding: 'var(--space-5)',
            background: 'var(--color-loss)10', borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-4)', border: '2px dashed var(--color-loss)40',
          }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-loss)', marginBottom: 'var(--space-2)' }}>
              {'\u26a0\ufe0f'} No Head Coach
            </div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              Your team needs a head coach! Browse the coaching market below.
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex', gap: 'var(--space-3)', justifyContent: 'center',
          marginBottom: 'var(--space-4)',
        }}>
          <Button variant="primary" onClick={handleBrowseMarket}>
            {'\ud83d\udd0d'} Browse Coaching Market
          </Button>
          {coach && (
            <Button variant="danger" onClick={handleFire}>
              {'\ud83d\udeaa'} Fire Coach
            </Button>
          )}
        </div>

        {/* Market */}
        {marketOpen && (
          <MarketSection key={refreshKey}
            freeAgents={data?.freeAgents || []}
            poachable={data?.poachable || []}
            marketTab={marketTab} setMarketTab={setMarketTab}
            formatCurrency={formatCurrency} getOverallColor={getOverallColor}
            onHire={handleHire}
          />
        )}
      </ModalBody>
    </Modal>
  );
}

/* ── Current Coach ── */
function CurrentCoachSection({ coach, synergy, traits, formatCurrency, getOverallColor, getTraitColor, getTraitLabel }) {
  const overallColor = getOverallColor(coach.overall);
  const synergyColor = synergy.grade === 'A' ? '#4ecdc4'
    : synergy.grade === 'B' ? '#45b7d1'
    : synergy.grade === 'C' ? '#f9d56e' : '#ff6b6b';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)',
      marginBottom: 'var(--space-4)',
    }}>
      {/* Info Panel */}
      <div style={{
        background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)', border: '1px solid var(--color-border-subtle)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-3)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>{coach.name}</div>
            <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>{coach.archetype}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2em', fontWeight: 'var(--weight-bold)', color: overallColor }}>{coach.overall}</div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', letterSpacing: '0.05em' }}>OVERALL</div>
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)',
          fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)',
        }}>
          <StatLine icon={'\ud83d\udcc5'} label="Age" value={coach.age} />
          <StatLine icon={'\ud83d\udccb'} label="Exp" value={`${coach.experience} yrs`} />
          <StatLine icon={'\ud83c\udfc6'} label="Titles" value={coach.championships} />
          <StatLine icon={'\ud83d\udcca'} label="Career" value={`${coach.careerWins}W-${coach.careerLosses}L`} />
          <StatLine icon={'\ud83d\udcb0'} label="Salary" value={`${formatCurrency(coach.salary)}/yr`} />
          <StatLine icon={'\ud83d\udcdd'} label="Contract" value={`${coach.contractYears} yr${coach.contractYears !== 1 ? 's' : ''}`} />
        </div>

        {/* Synergy */}
        <div style={{
          background: 'var(--color-bg-active)', padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>System-Roster Synergy</div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: synergyColor }}>
            {synergy.grade} ({synergy.score})
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{synergy.description}</div>
        </div>
      </div>

      {/* Traits Panel */}
      <div style={{
        background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)', border: '1px solid var(--color-border-subtle)',
      }}>
        <div style={{ fontWeight: 'var(--weight-semi)', marginBottom: 'var(--space-3)' }}>Coaching Tendencies</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {Object.entries(traits || {}).map(([key, def]) => {
            const val = coach.traits?.[key] || 50;
            const color = getTraitColor(val);
            const label = getTraitLabel(key, val);
            return (
              <div key={key}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 'var(--text-xs)', marginBottom: 2,
                }}>
                  <span>{def.icon} {def.name}</span>
                  <span style={{ color }}>{val} — {label}</span>
                </div>
                <div style={{
                  height: 8, background: 'var(--color-bg-active)',
                  borderRadius: 'var(--radius-full)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${val}%`, background: color,
                    borderRadius: 'var(--radius-full)', transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatLine({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
      <span>{icon}</span> {label}: <strong>{value}</strong>
    </div>
  );
}

/* ── Market Section ── */
function MarketSection({ freeAgents, poachable, marketTab, setMarketTab, formatCurrency, getOverallColor, onHire }) {
  const active = marketTab === 'freeAgent' ? freeAgents : poachable;
  const isPoach = marketTab === 'poach';

  return (
    <div>
      <div style={{
        fontWeight: 'var(--weight-semi)', textAlign: 'center',
        marginBottom: 'var(--space-3)',
      }}>
        {'\ud83d\udccb'} Coaching Market
      </div>

      <div style={{
        display: 'flex', gap: 2,
        borderBottom: '1px solid var(--color-border-subtle)',
        marginBottom: 'var(--space-3)',
      }}>
        <button onClick={() => setMarketTab('freeAgent')} style={{
          padding: 'var(--space-2) var(--space-4)', background: 'none', border: 'none',
          borderBottom: marketTab === 'freeAgent' ? '2px solid var(--color-win)' : '2px solid transparent',
          color: marketTab === 'freeAgent' ? 'var(--color-text)' : 'var(--color-text-tertiary)',
          fontWeight: marketTab === 'freeAgent' ? 'var(--weight-semi)' : 'var(--weight-normal)',
          fontSize: 'var(--text-sm)', cursor: 'pointer',
        }}>
          Free Agents ({freeAgents.length})
        </button>
        <button onClick={() => setMarketTab('poach')} style={{
          padding: 'var(--space-2) var(--space-4)', background: 'none', border: 'none',
          borderBottom: marketTab === 'poach' ? '2px solid var(--color-warning)' : '2px solid transparent',
          color: marketTab === 'poach' ? 'var(--color-text)' : 'var(--color-text-tertiary)',
          fontWeight: marketTab === 'poach' ? 'var(--weight-semi)' : 'var(--weight-normal)',
          fontSize: 'var(--text-sm)', cursor: 'pointer',
        }}>
          Poach from Teams ({poachable.length})
        </button>
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {active.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--color-text-tertiary)' }}>
            No coaches available
          </div>
        ) : active.map(c => (
          <CoachCard key={c.id} coach={c} isPoach={isPoach}
            formatCurrency={formatCurrency} getOverallColor={getOverallColor}
            onHire={onHire} />
        ))}
      </div>
    </div>
  );
}

/* ── Coach Card ── */
function CoachCard({ coach, isPoach, formatCurrency, getOverallColor, onHire }) {
  const overallColor = getOverallColor(coach.overall);
  const synergyColor = coach._synergyGrade === 'A' ? '#4ecdc4'
    : coach._synergyGrade === 'B' ? '#45b7d1'
    : coach._synergyGrade === 'C' ? '#f9d56e' : '#ff6b6b';

  return (
    <div style={{
      background: 'var(--color-bg-sunken)', borderRadius: 'var(--radius-md)',
      padding: 'var(--space-3)', border: '1px solid var(--color-border-subtle)',
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-3)', alignItems: 'center',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-1)' }}>
          <span style={{ fontSize: '1.4em', fontWeight: 'var(--weight-bold)', color: overallColor }}>{coach.overall}</span>
          <div>
            <div style={{ fontWeight: 'var(--weight-semi)' }}>{coach.name}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {coach.archetype} · Age {coach.age} · {coach.experience} yrs exp
            </div>
          </div>
        </div>
        {coach._topTraits && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
            {coach._topTraits}
          </div>
        )}
        <div style={{ fontSize: 'var(--text-xs)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', color: 'var(--color-text-secondary)' }}>
          <span>{'\ud83d\udcca'} {coach.careerWins}W-{coach.careerLosses}L</span>
          <span>{'\ud83c\udfc6'} {coach.championships} title{coach.championships !== 1 ? 's' : ''}</span>
          <span>{'\ud83d\udcb0'} {formatCurrency(coach.salary)}/yr</span>
          <span style={{ color: synergyColor }}>Synergy: {coach._synergyGrade}</span>
          {isPoach && coach._buyout > 0 && (
            <span style={{ color: 'var(--color-warning)' }}>Buyout: {formatCurrency(coach._buyout)}</span>
          )}
          {isPoach && coach._fromTeam && (
            <span style={{ color: 'var(--color-text-tertiary)' }}>From: {coach._fromTeam}</span>
          )}
        </div>
      </div>
      <Button variant={isPoach ? 'secondary' : 'primary'} onClick={() => onHire(coach.id, isPoach)}
        style={{ whiteSpace: 'nowrap' }}>
        {isPoach ? '\ud83d\udcbc Poach' : '\u270d\ufe0f Hire'}
      </Button>
    </div>
  );
}
