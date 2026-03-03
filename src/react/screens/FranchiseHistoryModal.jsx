import React, { useMemo } from 'react';
import { Modal, ModalHeader, ModalBody } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

// Helpers
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
const winColor = (w, l) => { const p = w / Math.max(1, w + l); return p >= 0.6 ? '#4ecdc4' : p <= 0.4 ? '#ff6b6b' : 'var(--color-text)'; };
const tierLabel = t => t === 1 ? 'Tier 1 — NAPL' : t === 2 ? 'Tier 2 — NARBL' : 'Tier 3 — MBL';
const tierTeamCount = t => t === 1 ? 30 : t === 2 ? 86 : 144;

export function FranchiseHistoryModal({ isOpen, data, onClose }) {
  if (!isOpen || !data) return null;
  const { history = [] } = data;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={1000} zIndex={1300}>
      <ModalHeader>{'\ud83d\udcdc'} Franchise History</ModalHeader>
      <ModalBody style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        {history.length === 0 ? <EmptyState /> : <HistoryContent history={history} />}
        <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </ModalBody>
    </Modal>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-tertiary)' }}>
      <div style={{ fontSize: '3em', marginBottom: 'var(--space-3)' }}>{'\ud83d\udccb'}</div>
      <div style={{ fontSize: 'var(--text-md)' }}>No completed seasons yet.</div>
      <div style={{ marginTop: 'var(--space-1)' }}>Complete your first season to start building your franchise history!</div>
    </div>
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
      {/* Summary Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-accent)10, var(--color-accent)05)',
        borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-5)',
        border: '1px solid var(--color-accent)20',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', textAlign: 'center' }}>
          <StatBox value={history.length} label="Seasons" color="var(--color-accent)" />
          <StatBox value={`${totalWins}-${totalLosses}`} label="All-Time Record" color="#4ecdc4" />
          <StatBox value={championships} label="Championships" color="#ffd700" />
          <StatBox value={`${pct(totalWins, totalLosses)}%`} label="Win Pct" color="#f9d56e" />
        </div>
      </div>

      {/* Season Cards */}
      {sorted.map(season => {
        if (!season.userTeam) return null;
        return <SeasonCard key={season.season} season={season} />;
      })}
    </>
  );
}

function StatBox({ value, label, color }) {
  return (
    <div>
      <div style={{ fontSize: '2em', fontWeight: 'var(--weight-bold)', color }}>{value}</div>
      <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>{label}</div>
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

  let promoRelStatus = '';
  if (season.promotions) {
    const promoted = [...(season.promotions.toT1 || []), ...(season.promotions.toT2 || [])];
    if (promoted.some(t => t.id === ut.id)) promoRelStatus = '\u2b06\ufe0f Promoted';
  }
  if (season.relegations) {
    const relegated = [...(season.relegations.fromT1 || []), ...(season.relegations.fromT2 || [])];
    if (relegated.some(t => t.id === ut.id)) promoRelStatus = '\u2b07\ufe0f Relegated';
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
  ].filter(Boolean).join(' \u00B7 ') : '';

  return (
    <div style={{
      background: isChampion ? 'rgba(255,215,0,0.05)' : 'var(--color-bg-sunken)',
      borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-3)',
      border: `1px solid ${isChampion ? 'rgba(255,215,0,0.35)' : 'var(--color-border-subtle)'}`,
    }}>
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>{season.seasonLabel}</span>
          <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>{tierLabel(ut.tier)}</span>
          {isChampion && <span style={{ color: '#ffd700' }}>{'\ud83c\udfc6'} CHAMPION</span>}
          {promoRelStatus && <span style={{ fontSize: 'var(--text-sm)' }}>{promoRelStatus}</span>}
        </div>
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: wCol }}>{ut.wins}-{ut.losses}</span>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
        <div>{'\ud83d\udcca'} Finished {rankSuffix(ut.rank)} of {tierTeamCount(ut.tier)}</div>
        <div>{'\ud83d\udc68\u200d\ud83d\udcbc'} Coach: {ut.coachName}</div>
        {ut.topPlayer && <div>{'\u2b50'} Best: {ut.topPlayer.name} ({ut.topPlayer.rating} OVR, {ut.topPlayer.position})</div>}
      </div>

      {/* Awards */}
      {userAwards.length > 0 && (
        <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>{'\ud83c\udfc5'} {userAwards.join(' \u00B7 ')}</div>
      )}
      {tierAwards?.mvp && (
        <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          League MVP: {tierAwards.mvp.name} ({tierAwards.mvp.team}) — {tierAwards.mvp.ppg.toFixed(1)} PPG, {tierAwards.mvp.rpg.toFixed(1)} RPG, {tierAwards.mvp.apg.toFixed(1)} APG
        </div>
      )}
      {champLine && (
        <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{'\ud83c\udfc6'} {champLine}</div>
      )}
    </div>
  );
}
