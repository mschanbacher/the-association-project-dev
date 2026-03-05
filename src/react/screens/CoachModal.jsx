import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

export function CoachModal({ isOpen, data, onClose }) {
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketTab, setMarketTab] = useState('freeAgent');

  const coach = data?.coach;
  const synergy = data?.synergy;
  const traits = data?.traits;
  const freeAgents = data?.freeAgents || [];
  const poachable = data?.poachable || [];
  const formatCurrency = data?.formatCurrency || (v => `$${(v/1e6).toFixed(1)}M`);
  const getOverallColor = data?.getOverallColor || (() => 'var(--color-accent)');
  const getTraitColor = data?.getTraitColor || ((v) =>
    v >= 70 ? 'var(--color-win)' : v >= 50 ? 'var(--color-text-secondary)' : 'var(--color-loss)');
  const getTraitLabel = data?.getTraitLabel || (() => '');

  if (!isOpen || !data) return null;

  const handleHire = (coachId, isPoach) => {
    if (window.hireCoach) window.hireCoach(coachId, isPoach);
    onClose();
  };

  const handleFire = () => {
    if (window.fireCoach) window.fireCoach();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={720} zIndex={1300}>
      <ModalHeader onClose={onClose}>Coaching Staff</ModalHeader>
      <ModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        {/* Current Coach or Warning */}
        {coach ? (
          <CurrentCoachSection coach={coach} synergy={synergy} traits={traits}
            formatCurrency={formatCurrency} getOverallColor={getOverallColor}
            getTraitColor={getTraitColor} getTraitLabel={getTraitLabel} />
        ) : (
          <div style={{
            textAlign: 'center', padding: 20,
            background: 'var(--color-loss-bg)', borderLeft: '3px solid var(--color-loss)',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-loss)', marginBottom: 4 }}>
              No Head Coach
            </div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              Your team needs a head coach. Browse the coaching market below.
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
          <Button variant="primary" onClick={() => setMarketOpen(!marketOpen)}>
            Browse Coaching Market
          </Button>
          {coach && (
            <button onClick={handleFire} style={{
              padding: '7px 16px', border: '1px solid var(--color-loss)30',
              background: 'transparent', color: 'var(--color-loss)',
              fontSize: 'var(--text-xs)', fontWeight: 500,
              fontFamily: 'var(--font-body)', cursor: 'pointer',
            }}>Fire Coach</button>
          )}
        </div>

        {/* Market */}
        {marketOpen && (
          <MarketSection freeAgents={freeAgents} poachable={poachable}
            marketTab={marketTab} setMarketTab={setMarketTab}
            formatCurrency={formatCurrency} getOverallColor={getOverallColor}
            onHire={handleHire} />
        )}
      </ModalBody>
    </Modal>
  );
}

function CurrentCoachSection({ coach, synergy, traits, formatCurrency, getOverallColor, getTraitColor, getTraitLabel }) {
  const overallColor = getOverallColor(coach.overall);
  const synergyColor = synergy.grade === 'A' ? 'var(--color-rating-elite)'
    : synergy.grade === 'B' ? 'var(--color-rating-good)'
    : synergy.grade === 'C' ? 'var(--color-rating-avg)' : 'var(--color-loss)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)', marginBottom: 16 }}>
      {/* Info Panel */}
      <div style={{ background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 700 }}>{coach.name}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{coach.archetype}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: overallColor }}>{coach.overall}</div>
            <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Overall</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 'var(--text-xs)', marginBottom: 12 }}>
          <StatRow label="Age" value={coach.age} />
          <StatRow label="Experience" value={`${coach.experience} yrs`} />
          <StatRow label="Titles" value={coach.championships} />
          <StatRow label="Career" value={`${coach.careerWins}W–${coach.careerLosses}L`} />
          <StatRow label="Salary" value={`${formatCurrency(coach.salary)}/yr`} />
          <StatRow label="Contract" value={`${coach.contractYears} yr${coach.contractYears !== 1 ? 's' : ''}`} />
        </div>

        {/* Synergy */}
        <div style={{
          padding: '8px 10px', background: 'var(--color-bg-raised)',
          border: '1px solid var(--color-border-subtle)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>System-Roster Synergy</div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: synergyColor }}>
            {synergy.grade} ({synergy.score})
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{synergy.description}</div>
        </div>
      </div>

      {/* Traits Panel */}
      <div style={{ background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)', padding: '14px 16px' }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
        }}>Coaching Tendencies</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(traits || {}).map(([key, def]) => {
            const val = coach.traits?.[key] || 50;
            const color = getTraitColor(val);
            const label = getTraitLabel(key, val);
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 3 }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{def.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color }}>{val}</span>
                </div>
                <div style={{
                  height: 4, background: 'var(--color-bg-raised)', overflow: 'hidden',
                  border: '1px solid var(--color-border-subtle)',
                }}>
                  <div style={{ height: '100%', width: `${val}%`, background: color, opacity: 0.7 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '3px 0',
      borderBottom: '1px solid var(--color-border-subtle)',
    }}>
      <span style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function MarketSection({ freeAgents, poachable, marketTab, setMarketTab, formatCurrency, getOverallColor, onHire }) {
  const active = marketTab === 'freeAgent' ? freeAgents : poachable;
  const isPoach = marketTab === 'poach';

  return (
    <div>
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)',
        marginBottom: 12,
      }}>
        {[
          { key: 'freeAgent', label: 'Free Agents', count: freeAgents.length },
          { key: 'poach', label: 'Poach from Teams', count: poachable.length },
        ].map(tab => (
          <button key={tab.key} onClick={() => setMarketTab(tab.key)} style={{
            padding: '8px 16px', border: 'none',
            borderBottom: marketTab === tab.key ? '2px solid var(--color-accent)' : '2px solid transparent',
            background: 'transparent',
            color: marketTab === tab.key ? 'var(--color-text)' : 'var(--color-text-tertiary)',
            fontWeight: marketTab === tab.key ? 600 : 400,
            fontSize: 'var(--text-xs)', fontFamily: 'var(--font-body)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {tab.label}
            <span style={{
              fontSize: 10, padding: '1px 6px',
              background: marketTab === tab.key ? 'var(--color-accent-bg)' : 'var(--color-bg-sunken)',
              color: 'var(--color-text-tertiary)',
            }}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {active.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
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

function CoachCard({ coach, isPoach, formatCurrency, getOverallColor, onHire }) {
  const overallColor = getOverallColor(coach.overall);
  const synergyColor = coach._synergyGrade === 'A' ? 'var(--color-rating-elite)'
    : coach._synergyGrade === 'B' ? 'var(--color-rating-good)'
    : coach._synergyGrade === 'C' ? 'var(--color-rating-avg)' : 'var(--color-loss)';

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 14px', background: 'var(--color-bg-sunken)',
      border: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: overallColor, minWidth: 32,
        }}>{coach.overall}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{coach.name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {coach.archetype} · Age {coach.age} · {coach.experience}yr exp
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            {coach.careerWins}W–{coach.careerLosses}L
            {' · '}{coach.championships} title{coach.championships !== 1 ? 's' : ''}
            {' · '}{formatCurrency(coach.salary)}/yr
            {' · '}<span style={{ color: synergyColor }}>Synergy: {coach._synergyGrade}</span>
            {isPoach && coach._buyout > 0 && (
              <span style={{ color: 'var(--color-warning)', marginLeft: 6 }}>
                Buyout: {formatCurrency(coach._buyout)}
              </span>
            )}
            {isPoach && coach._fromTeam && (
              <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 6 }}>
                From: {coach._fromTeam}
              </span>
            )}
          </div>
          {coach._topTraits && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              {coach._topTraits}
            </div>
          )}
        </div>
      </div>
      <Button variant={isPoach ? 'secondary' : 'primary'} size="sm"
        onClick={() => onHire(coach.id, isPoach)}>
        {isPoach ? 'Poach' : 'Hire'}
      </Button>
    </div>
  );
}
