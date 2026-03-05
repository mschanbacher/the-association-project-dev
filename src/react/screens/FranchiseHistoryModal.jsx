import React, { useMemo } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

const rankSuffix = n => {
  if (!n && n !== 0) return '';
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + 'th';
  const last = n % 10;
  if (last === 1) return n + 'st';
  if (last === 2) return n + 'nd';
  if (last === 3) return n + 'rd';
  return n + 'th';
};
const pct = (w, l) => { const t = w + l; return t > 0 ? (w / t * 100).toFixed(1) : '0.0'; };
const winColor = (w, l) => { const p = w / Math.max(1, w + l); return p >= 0.6 ? 'var(--color-win)' : p <= 0.4 ? 'var(--color-loss)' : 'var(--color-text)'; };
const tierLabel = t => t === 1 ? 'Tier 1 — NAPL' : t === 2 ? 'Tier 2 — NARBL' : 'Tier 3 — MBL';
const tierTeamCount = t => t === 1 ? 30 : t === 2 ? 86 : 144;

export function FranchiseHistoryModal({ isOpen, data, onClose }) {
  if (!isOpen || !data) return null;
  const { history = [] } = data;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={680} zIndex={1300}>
      <ModalHeader onClose={onClose}>Franchise History</ModalHeader>
      <ModalBody style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)' }}>
            <div style={{ fontSize: 'var(--text-md)', marginBottom: 4 }}>No completed seasons yet.</div>
            <div style={{ fontSize: 'var(--text-sm)' }}>Complete your first season to start building your franchise history.</div>
          </div>
        ) : (
          <HistoryContent history={history} />
        )}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </ModalBody>
    </Modal>
  );
}

function HistoryContent({ history }) {
  const { totalWins, totalLosses, championships } = useMemo(() => {
    let w = 0, l = 0, ch = 0;
    history.forEach(s => {
      if (s.userTeam) { w += s.userTeam.wins; l += s.userTeam.losses; }
      if (s.champions && s.userTeam) {
        const tier = s.userTeam.tier;
        const champ = tier === 1 ? s.champions.tier1 : tier === 2 ? s.champions.tier2 : s.champions.tier3;
        if (champ && champ.id === s.userTeam.id) ch++;
      }
    });
    return { totalWins: w, totalLosses: l, championships: ch };
  }, [history]);

  const sorted = useMemo(() => [...history].sort((a, b) => b.season - a.season), [history]);

  return (
    <>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gap)', marginBottom: 20 }}>
        <MetricBox value={history.length} label="Seasons" />
        <MetricBox value={`${totalWins}–${totalLosses}`} label="All-Time Record" />
        <MetricBox value={championships} label="Championships"
          highlight={championships > 0} />
        <MetricBox value={`${pct(totalWins, totalLosses)}%`} label="Win Pct" />
      </div>

      {/* Season Cards */}
      {sorted.map(season => {
        if (!season.userTeam) return null;
        return <SeasonCard key={season.season} season={season} />;
      })}
    </>
  );
}

function MetricBox({ value, label, highlight }) {
  return (
    <div style={{
      padding: 12, textAlign: 'center',
      background: highlight ? 'var(--color-tier1)' : 'var(--color-bg-sunken)',
      border: highlight ? 'none' : '1px solid var(--color-border-subtle)',
    }}>
      <div style={{
        fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)',
        color: highlight ? '#1C1C1C' : 'var(--color-text)',
      }}>{value}</div>
      <div style={{
        fontSize: 10, marginTop: 2,
        color: highlight ? 'rgba(28,28,28,0.7)' : 'var(--color-text-tertiary)',
      }}>{label}</div>
    </div>
  );
}

function SeasonCard({ season }) {
  const ut = season.userTeam;
  const wCol = winColor(ut.wins, ut.losses);

  const isChampion = season.champions && (() => {
    const champ = ut.tier === 1 ? season.champions.tier1 : ut.tier === 2 ? season.champions.tier2 : season.champions.tier3;
    return champ && champ.id === ut.id;
  })();

  let promoRelStatus = null;
  if (season.promotions) {
    const promoted = [...(season.promotions.toT1 || []), ...(season.promotions.toT2 || [])];
    if (promoted.some(t => t.id === ut.id)) promoRelStatus = { type: 'promoted', label: 'Promoted' };
  }
  if (season.relegations) {
    const relegated = [...(season.relegations.fromT1 || []), ...(season.relegations.fromT2 || [])];
    if (relegated.some(t => t.id === ut.id)) promoRelStatus = { type: 'relegated', label: 'Relegated' };
  }

  const tierAwards = season.awards ? (ut.tier === 1 ? season.awards.tier1 : ut.tier === 2 ? season.awards.tier2 : season.awards.tier3) : null;
  const userAwards = [];
  if (tierAwards) {
    const labels = { mvp: 'MVP', dpoy: 'DPOY', roy: 'ROY', sixthMan: '6MOY', mostImproved: 'MIP' };
    ['mvp', 'dpoy', 'roy', 'sixthMan', 'mostImproved'].forEach(award => {
      if (tierAwards[award] && tierAwards[award].teamId === ut.id) {
        userAwards.push(`${labels[award]}: ${tierAwards[award].name}`);
      }
    });
  }

  const champLine = season.champions ? [
    season.champions.tier1 ? `T1: ${season.champions.tier1.name}` : null,
    season.champions.tier2 ? `T2: ${season.champions.tier2.name}` : null,
    season.champions.tier3 ? `T3: ${season.champions.tier3.name}` : null,
  ].filter(Boolean).join(' · ') : '';

  return (
    <div style={{
      padding: '14px 16px', marginBottom: 8,
      background: isChampion ? 'var(--color-accent-bg)' : 'var(--color-bg-sunken)',
      border: isChampion ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border-subtle)',
      borderLeft: isChampion ? '3px solid var(--color-accent)' : '3px solid transparent',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-md)', fontWeight: 700 }}>{season.seasonLabel}</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{tierLabel(ut.tier)}</span>
          {isChampion && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--color-accent)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>Champion</span>
          )}
          {promoRelStatus && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: promoRelStatus.type === 'promoted' ? 'var(--color-win)' : 'var(--color-loss)',
            }}>{promoRelStatus.label}</span>
          )}
        </div>
        <span style={{
          fontSize: 'var(--text-md)', fontWeight: 700,
          fontFamily: 'var(--font-mono)', color: wCol,
        }}>{ut.wins}–{ut.losses}</span>
      </div>

      {/* Details */}
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div>
          Finished {rankSuffix(ut.rank)} of {tierTeamCount(ut.tier)} · Coach: {ut.coachName}
        </div>
        {ut.topPlayer && (
          <div>Best: {ut.topPlayer.name} ({ut.topPlayer.rating} OVR, {ut.topPlayer.position})</div>
        )}
        {userAwards.length > 0 && (
          <div style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{userAwards.join(' · ')}</div>
        )}
        {tierAwards?.mvp && (
          <div style={{ color: 'var(--color-text-tertiary)' }}>
            League MVP: {tierAwards.mvp.name} ({tierAwards.mvp.team}) — {tierAwards.mvp.ppg.toFixed(1)} PPG, {tierAwards.mvp.rpg.toFixed(1)} RPG, {tierAwards.mvp.apg.toFixed(1)} APG
          </div>
        )}
        {champLine && (
          <div style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>Champions: {champLine}</div>
        )}
      </div>
    </div>
  );
}
