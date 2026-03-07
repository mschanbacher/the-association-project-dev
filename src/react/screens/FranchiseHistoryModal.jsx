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
// Use real totalTeams from snapshot; fall back to known sizes for legacy entries
const getTotalTeams = ut => ut.totalTeams || (ut.tier === 1 ? 30 : ut.tier === 2 ? 86 : 144);

export function FranchiseHistoryModal({ isOpen, data, onClose }) {
  if (!isOpen || !data) return null;
  const { history = [] } = data;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={700} zIndex={1300}>
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
  const { totalWins, totalLosses, championships, playoffAppearances } = useMemo(() => {
    let w = 0, l = 0, ch = 0, pa = 0;
    history.forEach(s => {
      if (s.userTeam) {
        w += s.userTeam.wins;
        l += s.userTeam.losses;
        const po = s.userTeam.playoff;
        if (po && po.result !== 'missed') pa++;
        if (po && po.result === 'champion') ch++;
        else if (!po && s.champions && s.userTeam) {
          // Legacy: check champions object
          const tier = s.userTeam.tier;
          const champ = tier === 1 ? s.champions.tier1 : tier === 2 ? s.champions.tier2 : s.champions.tier3;
          if (champ && champ.id === s.userTeam.id) ch++;
        }
      }
    });
    return { totalWins: w, totalLosses: l, championships: ch, playoffAppearances: pa };
  }, [history]);

  const sorted = useMemo(() => [...history].sort((a, b) => {
    // Sort by season label descending
    const aYear = parseInt((a.seasonLabel || a.season || '').split('-')[0]) || 0;
    const bYear = parseInt((b.seasonLabel || b.season || '').split('-')[0]) || 0;
    return bYear - aYear;
  }), [history]);

  return (
    <>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gap)', marginBottom: 20 }}>
        <MetricBox value={history.length} label="Seasons" />
        <MetricBox value={`${totalWins}–${totalLosses}`} label="All-Time Record" />
        <MetricBox value={playoffAppearances} label="Playoff Apps" />
        <MetricBox value={championships} label="Championships" highlight={championships > 0} />
      </div>

      {/* Season Cards */}
      {sorted.map(season => {
        if (!season.userTeam) return null;
        return <SeasonCard key={season.season || season.seasonLabel} season={season} />;
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

/* ─── Playoff Badge ────────────────────────────────────────────────── */
function PlayoffBadge({ playoff }) {
  if (!playoff) return null;

  const { result, label, seed, conf } = playoff;

  const colors = {
    champion:  { bg: 'var(--color-accent-bg)',  border: 'var(--color-accent)',  text: 'var(--color-accent)'  },
    eliminated:{ bg: 'rgba(102,126,234,0.08)',   border: 'rgba(102,126,234,0.3)',text: '#667eea'              },
    playoffs:  { bg: 'rgba(102,126,234,0.08)',   border: 'rgba(102,126,234,0.3)',text: '#667eea'              },
    missed:    { bg: 'var(--color-bg-sunken)',    border: 'var(--color-border-subtle)', text: 'var(--color-text-tertiary)' },
  };
  const c = colors[result] || colors.missed;

  const seedStr = seed ? `#${seed} ${conf || ''} · ` : '';

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 8px', fontSize: 11, fontWeight: 600,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      whiteSpace: 'nowrap',
    }}>
      {result === 'champion' && <span>🏆</span>}
      <span>{seedStr}{label}</span>
    </div>
  );
}

/* ─── MVP Stats Panel ──────────────────────────────────────────────── */
function MVPPanel({ topPlayer, seasonLabel }) {
  if (!topPlayer) return null;

  const hasPts = topPlayer.ppg > 0;
  // Generate a brief analysis blurb based on the stat profile
  const blurb = (() => {
    if (!hasPts) return null;
    const { ppg, rpg, apg, spg, bpg, fgPct, position } = topPlayer;
    const parts = [];
    if (ppg >= 25) parts.push('elite scorer');
    else if (ppg >= 20) parts.push('reliable scorer');
    else if (ppg >= 15) parts.push('solid contributor');
    if (apg >= 7) parts.push('playmaking threat');
    else if (apg >= 5) parts.push('facilitator');
    if (rpg >= 10) parts.push('dominant rebounder');
    else if (rpg >= 7) parts.push('strong rebounder');
    if ((spg >= 1.5 || bpg >= 1.5)) parts.push('defensive anchor');
    if (fgPct >= 52) parts.push('efficient shooter');
    return parts.length > 0 ? parts.slice(0, 2).join(', ') : null;
  })();

  return (
    <div style={{
      marginTop: 10, padding: '10px 12px',
      background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)',
      borderLeft: '2px solid var(--color-accent)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasPts ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{topPlayer.name}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 5px',
            background: 'var(--color-bg-sunken)', color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border-subtle)',
          }}>{topPlayer.position}</span>
          {blurb && (
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
              {blurb}
            </span>
          )}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: 'var(--color-text-secondary)',
        }}>{topPlayer.rating} OVR</span>
      </div>

      {hasPts && (
        <>
          {/* Stat pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <StatPill label="PPG" value={topPlayer.ppg} />
            <StatPill label="RPG" value={topPlayer.rpg} />
            <StatPill label="APG" value={topPlayer.apg} />
            {topPlayer.spg > 0 && <StatPill label="SPG" value={topPlayer.spg} />}
            {topPlayer.bpg > 0 && <StatPill label="BPG" value={topPlayer.bpg} />}
          </div>
          {/* Shooting line */}
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            FG {topPlayer.fgPct}%
            {topPlayer.threePct > 0 && ` · 3P ${topPlayer.threePct}%`}
            {topPlayer.ftPct > 0  && ` · FT ${topPlayer.ftPct}%`}
            {topPlayer.gamesPlayed > 0 && ` · ${topPlayer.gamesPlayed} GP`}
          </div>
        </>
      )}
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '3px 8px', background: 'var(--color-bg-sunken)',
      border: '1px solid var(--color-border-subtle)', minWidth: 40,
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1.2 }}>
        {value}
      </span>
      <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
    </div>
  );
}

/* ─── Season Card ──────────────────────────────────────────────────── */
function SeasonCard({ season }) {
  const ut = season.userTeam;
  const wCol = winColor(ut.wins, ut.losses);

  const isChampion = ut.playoff?.result === 'champion' ||
    (season.champions && (() => {
      const champ = ut.tier === 1 ? season.champions.tier1 : ut.tier === 2 ? season.champions.tier2 : season.champions.tier3;
      return champ && champ.id === ut.id;
    })());

  let promoRelStatus = null;
  if (season.promotions) {
    const promoted = [...(season.promotions.toT1 || []), ...(season.promotions.toT2 || [])];
    if (promoted.some(t => t.id === ut.id)) promoRelStatus = { type: 'promoted', label: 'Promoted' };
  }
  if (season.relegations) {
    const relegated = [...(season.relegations.fromT1 || []), ...(season.relegations.fromT2 || [])];
    if (relegated.some(t => t.id === ut.id)) promoRelStatus = { type: 'relegated', label: 'Relegated' };
  }

  const tierAwards = season.awards
    ? (ut.tier === 1 ? season.awards.tier1 : ut.tier === 2 ? season.awards.tier2 : season.awards.tier3)
    : null;
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

  const seasonLabel = season.seasonLabel || season.season;

  return (
    <div style={{
      padding: '14px 16px', marginBottom: 8,
      background: isChampion ? 'var(--color-accent-bg)' : 'var(--color-bg-sunken)',
      border: isChampion ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border-subtle)',
      borderLeft: isChampion ? '3px solid var(--color-accent)' : '3px solid transparent',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-md)', fontWeight: 700 }}>{seasonLabel}</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{tierLabel(ut.tier)}</span>
          {promoRelStatus && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: promoRelStatus.type === 'promoted' ? 'var(--color-win)' : 'var(--color-loss)',
            }}>{promoRelStatus.label}</span>
          )}
        </div>
        <span style={{
          fontSize: 'var(--text-md)', fontWeight: 700,
          fontFamily: 'var(--font-mono)', color: wCol, flexShrink: 0,
        }}>{ut.wins}–{ut.losses}</span>
      </div>

      {/* Season details row */}
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 6 }}>
        Finished {rankSuffix(ut.rank)} of {getTotalTeams(ut)} · Coach: {ut.coachName}
      </div>

      {/* Playoff result badge */}
      {ut.playoff && (
        <div style={{ marginBottom: ut.topPlayer ? 0 : 4 }}>
          <PlayoffBadge playoff={ut.playoff} />
        </div>
      )}

      {/* MVP panel */}
      <MVPPanel topPlayer={ut.topPlayer} seasonLabel={seasonLabel} />

      {/* Awards */}
      {userAwards.length > 0 && (
        <div style={{
          fontSize: 'var(--text-xs)', color: 'var(--color-accent)',
          fontWeight: 500, marginTop: 8,
        }}>{userAwards.join(' · ')}</div>
      )}

      {/* League awards & champions footnote */}
      {(tierAwards?.mvp || champLine) && (
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {tierAwards?.mvp && (
            <span>
              League MVP: {tierAwards.mvp.name} ({tierAwards.mvp.team}) — {tierAwards.mvp.ppg?.toFixed(1)} PPG
            </span>
          )}
          {champLine && <span>Champions: {champLine}</span>}
        </div>
      )}
    </div>
  );
}
