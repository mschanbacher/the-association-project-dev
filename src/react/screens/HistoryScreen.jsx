import React, { useMemo } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';
import { HexChart } from '../visualizations/PlayerVisuals.jsx';

/* ─── Helpers ──────────────────────────────────────────────────────── */
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
const getTotalTeams = ut => ut.totalTeams || (ut.tier === 1 ? 30 : ut.tier === 2 ? 86 : 144);
const tierLabel = t => ({ 1: 'Tier 1 · NAPL', 2: 'Tier 2 · NARBL', 3: 'Tier 3 · MBL' })[t] || `Tier ${t}`;

// Derive hex components from snapshot player stats
function hexFromTopPlayer(tp) {
  if (!tp || !tp.ppg) return null;
  const scoring    = Math.min(30, Math.max(0, tp.ppg * 0.9));
  const effScalar  = tp.fgPct > 0 ? tp.fgPct / 100 : 0.45;
  const efficiency = Math.min(20, Math.max(0, (effScalar - 0.42) * 80));
  const pos        = tp.position || 'SF';
  const plBase     = ['PG', 'SG'].includes(pos) ? 1.4 : ['SF'].includes(pos) ? 0.9 : 0.5;
  const playmaking = Math.min(15, Math.max(0, (tp.apg || 0) * 1.2 * plBase));
  const defense    = Math.min(15, Math.max(0, ((tp.spg || 0) * 3 + (tp.bpg || 0) * 2.5)));
  const rebBase    = ['C', 'PF'].includes(pos) ? 1.3 : 0.6;
  const rebounding = Math.min(10, Math.max(0, (tp.rpg || 0) * 0.9 * rebBase));
  const impact     = Math.min(10, Math.max(-5, ((tp.rating || 70) - 65) * 0.15));
  return {
    scoring: Math.round(scoring), efficiency: Math.round(efficiency),
    playmaking: Math.round(playmaking), defense: Math.round(defense),
    rebounding: Math.round(rebounding), impact: Math.round(impact),
  };
}

/* ─── Screen ───────────────────────────────────────────────────────── */
export function HistoryScreen() {
  const { gameState, isReady } = useGame();
  if (!isReady || !gameState) return <Loader text="Loading history…" />;

  const history = gameState._raw?._fullSeasonHistory || gameState._raw?.fullSeasonHistory || [];

  if (history.length === 0) {
    return (
      <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0, marginBottom: 'var(--space-6)' }}>
          Franchise History
        </h2>
        <Card padding="lg">
          <div style={{ textAlign: 'center', padding: 'var(--space-10) 0', color: 'var(--color-text-tertiary)' }}>
            <p style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-2)' }}>No completed seasons yet.</p>
            <p style={{ fontSize: 'var(--text-sm)' }}>Complete your first season to start building your franchise history.</p>
          </div>
        </Card>
      </div>
    );
  }

  const stats = useMemo(() => {
    let wins = 0, losses = 0, championships = 0, playoffApps = 0;
    history.forEach(s => {
      const ut = s.userTeam;
      if (!ut) return;
      wins += ut.wins || 0;
      losses += ut.losses || 0;
      const po = ut.playoff;
      if (po && po.result !== 'missed') playoffApps++;
      if (po && po.result === 'champion') championships++;
      else if (!po && s.champions) {
        const champ = ut.tier === 1 ? s.champions.tier1 : ut.tier === 2 ? s.champions.tier2 : s.champions.tier3;
        if (champ && champ.id === ut.id) championships++;
      }
    });
    const total = wins + losses;
    const winPct = total > 0 ? wins / total : 0.5;
    const recordColor = winPct >= 0.5 ? 'var(--color-win)' : 'var(--color-loss)';
    return { wins, losses, championships, seasons: history.length, playoffApps, recordColor };
  }, [history]);

  const sorted = useMemo(() =>
    [...history].sort((a, b) => {
      const ay = parseInt((a.seasonLabel || a.season || '').split('-')[0]) || 0;
      const by = parseInt((b.seasonLabel || b.season || '').split('-')[0]) || 0;
      return by - ay;
    }), [history]);

  return (
    <div style={{
      maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-6)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-5)',
    }}>
      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>
        Franchise History
      </h2>

      {/* All-time summary */}
      <Card padding="lg" className="animate-slide-up">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--space-4)', textAlign: 'center' }}>
          <AllTimeStat label="Seasons"         value={stats.seasons}                   color="var(--color-text-secondary)" />
          <AllTimeStat label="All-Time Record"  value={`${stats.wins}–${stats.losses}`} color={stats.recordColor} />
          <AllTimeStat label="Playoff Apps"    value={stats.playoffApps}               color="var(--color-info)" />
          <AllTimeStat label="Championships"   value={stats.championships}             color="var(--color-tier1)" />
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {sorted.map((season, i) => (
          <SeasonCard key={season.season || i} season={season} />
        ))}
      </div>
    </div>
  );
}

/* ─── Playoff Section ──────────────────────────────────────────────── */
function PlayoffSection({ playoff, isChampion }) {
  if (!playoff) return null;
  const { result, label, seed, conf } = playoff;

  if (result === 'missed') {
    return (
      <div style={{
        padding: '7px 12px', marginBottom: 'var(--space-2)',
        background: 'var(--color-bg-sunken)',
        border: '1px solid var(--color-border-subtle)',
        fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
      }}>
        Missed Playoffs
      </div>
    );
  }

  if (isChampion) {
    return (
      <div style={{
        padding: '12px 16px', marginBottom: 'var(--space-2)',
        background: 'var(--color-tier1-bg)',
        border: '2px solid var(--color-tier1)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        {/* Typographic trophy mark — no emoji */}
        <div style={{
          width: 32, height: 32, flexShrink: 0,
          border: '2px solid var(--color-tier1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2 L10 6 L14 6.5 L11 9.5 L11.8 13.5 L8 11.5 L4.2 13.5 L5 9.5 L2 6.5 L6 6 Z"
              fill="var(--color-tier1)" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-warning)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Champions
          </div>
          {seed && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 3 }}>
              #{seed} {conf || ''} seed
            </div>
          )}
        </div>
      </div>
    );
  }

  // Eliminated
  const seedStr = seed ? `#${seed} ${conf || ''} seed` : null;
  return (
    <div style={{
      padding: '8px 12px', marginBottom: 'var(--space-2)',
      background: 'var(--color-info-bg)',
      border: '1px solid var(--color-border)',
      borderLeft: '3px solid var(--color-info)',
    }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-info)' }}>
        {label}
      </div>
      {seedStr && (
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
          {seedStr}
        </div>
      )}
    </div>
  );
}

/* ─── Team MVP Panel ───────────────────────────────────────────────── */
function MVPPanel({ topPlayer, isLeagueMvp }) {
  if (!topPlayer) return null;
  const hasPts = topPlayer.ppg > 0;
  const hexComponents = hasPts ? hexFromTopPlayer(topPlayer) : null;

  const blurb = (() => {
    if (!hasPts) return null;
    const { ppg, rpg, apg, spg, bpg, fgPct } = topPlayer;
    const parts = [];
    if (ppg >= 25) parts.push('elite scorer');
    else if (ppg >= 20) parts.push('reliable scorer');
    else if (ppg >= 15) parts.push('solid contributor');
    if (apg >= 7) parts.push('playmaking threat');
    else if (apg >= 5) parts.push('facilitator');
    if (rpg >= 10) parts.push('dominant rebounder');
    else if (rpg >= 7) parts.push('strong rebounder');
    if (spg >= 1.5 || bpg >= 1.5) parts.push('defensive anchor');
    if (fgPct >= 52) parts.push('efficient shooter');
    return parts.length > 0 ? parts.slice(0, 2).join(', ') : null;
  })();

  const panelBorder = isLeagueMvp ? 'var(--color-warning)' : 'var(--color-accent)';
  const panelBg     = isLeagueMvp ? 'var(--color-warning-bg)' : 'var(--color-bg)';
  const labelColor  = isLeagueMvp ? 'var(--color-warning)' : 'var(--color-text-tertiary)';
  const pillBg      = isLeagueMvp ? 'rgba(196,138,24,0.06)' : 'var(--color-bg-sunken)';
  const pillBorder  = isLeagueMvp ? 'rgba(196,138,24,0.2)' : 'var(--color-border-subtle)';

  return (
    <div style={{
      border: '1px solid var(--color-border-subtle)',
      borderLeft: `2px solid ${panelBorder}`,
      background: panelBg,
      overflow: 'hidden',
      marginTop: 'var(--space-2)',
    }}>
      {/* Label row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px',
        borderBottom: `1px solid ${isLeagueMvp ? 'rgba(196,138,24,0.2)' : 'var(--color-border-subtle)'}`,
        background: isLeagueMvp ? 'var(--color-warning-bg)' : 'transparent',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: labelColor,
        }}>
          Team MVP
        </span>
        {isLeagueMvp && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px',
            background: 'var(--color-warning)', color: 'var(--color-text-inverse)',
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            League MVP
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ display: 'flex' }}>
        {/* Hex chart */}
        {hexComponents && (
          <div style={{
            padding: '14px 10px 14px 14px',
            borderRight: '1px solid var(--color-border-subtle)',
            display: 'flex', alignItems: 'center', flexShrink: 0,
          }}>
            <HexChart components={hexComponents} size={130} />
          </div>
        )}

        {/* Stats */}
        <div style={{ padding: '14px', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 4 }}>
                {topPlayer.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', flexShrink: 0 }}>
              {topPlayer.rating} OVR
            </span>
          </div>

          {hasPts && (
            <>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                <StatPill label="PPG" value={topPlayer.ppg} pillBg={pillBg} pillBorder={pillBorder} />
                <StatPill label="RPG" value={topPlayer.rpg} pillBg={pillBg} pillBorder={pillBorder} />
                <StatPill label="APG" value={topPlayer.apg} pillBg={pillBg} pillBorder={pillBorder} />
                {topPlayer.spg > 0 && <StatPill label="SPG" value={topPlayer.spg} pillBg={pillBg} pillBorder={pillBorder} />}
                {topPlayer.bpg > 0 && <StatPill label="BPG" value={topPlayer.bpg} pillBg={pillBg} pillBorder={pillBorder} />}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                FG {topPlayer.fgPct}%
                {topPlayer.threePct > 0 && ` · 3P ${topPlayer.threePct}%`}
                {topPlayer.ftPct > 0    && ` · FT ${topPlayer.ftPct}%`}
                {topPlayer.gamesPlayed > 0 && ` · ${topPlayer.gamesPlayed} GP`}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, pillBg, pillBorder }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '3px 8px', minWidth: 42,
      background: pillBg || 'var(--color-bg-sunken)',
      border: `1px solid ${pillBorder || 'var(--color-border-subtle)'}`,
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{value}</span>
      <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
    </div>
  );
}

/* ─── Season Card ──────────────────────────────────────────────────── */
function SeasonCard({ season }) {
  const ut = season.userTeam;
  if (!ut) return null;

  const winPct = (ut.wins || 0) / Math.max(1, (ut.wins || 0) + (ut.losses || 0));
  const wCol = winPct >= 0.6 ? 'var(--color-win)' : winPct <= 0.4 ? 'var(--color-loss)' : 'var(--color-text)';

  const isChampion = ut.playoff?.result === 'champion' ||
    (season.champions && (() => {
      const champ = ut.tier === 1 ? season.champions.tier1 : ut.tier === 2 ? season.champions.tier2 : season.champions.tier3;
      return champ && champ.id === ut.id;
    })());

  let promoRelStatus = null;
  if (season.promotions) {
    if ([...(season.promotions.toT1 || []), ...(season.promotions.toT2 || [])].some(t => t.id === ut.id))
      promoRelStatus = 'promoted';
  }
  if (season.relegations) {
    if ([...(season.relegations.fromT1 || []), ...(season.relegations.fromT2 || [])].some(t => t.id === ut.id))
      promoRelStatus = 'relegated';
  }

  const tierAwards = season.awards
    ? (ut.tier === 1 ? season.awards.tier1 : ut.tier === 2 ? season.awards.tier2 : season.awards.tier3)
    : null;

  // Check if team MVP is also league MVP
  const isLeagueMvp = tierAwards?.mvp?.teamId === ut.id;

  const userAwards = [];
  if (tierAwards) {
    const awardLabels = { mvp: 'MVP', dpoy: 'DPOY', roy: 'ROY', sixthMan: '6MOY', mostImproved: 'MIP' };
    Object.entries(awardLabels).forEach(([key, label]) => {
      if (key !== 'mvp' && tierAwards[key]?.teamId === ut.id)
        userAwards.push({ label, name: tierAwards[key].name });
    });
  }

  const champLine = season.champions ? [
    season.champions.tier1 ? `T1: ${season.champions.tier1.name}` : null,
    season.champions.tier2 ? `T2: ${season.champions.tier2.name}` : null,
    season.champions.tier3 ? `T3: ${season.champions.tier3.name}` : null,
  ].filter(Boolean).join(' · ') : '';

  return (
    <Card padding="lg" className="animate-slide-up" style={isChampion ? {
      borderColor: 'var(--color-tier1)', background: 'var(--color-tier1-bg)',
    } : {}}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>
            {season.seasonLabel || season.season}
          </span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
            {tierLabel(ut.tier)}
          </span>
          {promoRelStatus === 'promoted'  && <Badge variant="win">Promoted</Badge>}
          {promoRelStatus === 'relegated' && <Badge variant="loss">Relegated</Badge>}
        </div>
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: wCol, fontVariantNumeric: 'tabular-nums' }}>
          {ut.wins}–{ut.losses}
        </span>
      </div>

      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
        Finished {rankSuffix(ut.rank)} of {getTotalTeams(ut)} · Coach: {ut.coachName || '—'}
      </div>

      <PlayoffSection playoff={ut.playoff} isChampion={isChampion} />

      <MVPPanel topPlayer={ut.topPlayer} isLeagueMvp={isLeagueMvp} />

      {userAwards.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
          {userAwards.map((a, i) => (
            <Badge key={i} variant="accent">{a.label}: {a.name}</Badge>
          ))}
        </div>
      )}

      {(!isLeagueMvp && tierAwards?.mvp) || champLine ? (
        <div style={{
          marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--color-border-subtle)',
          fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {!isLeagueMvp && tierAwards?.mvp && (
            <span>League MVP: {tierAwards.mvp.name} ({tierAwards.mvp.team}) — {tierAwards.mvp.ppg?.toFixed(1)} PPG, {tierAwards.mvp.rpg?.toFixed(1)} RPG, {tierAwards.mvp.apg?.toFixed(1)} APG</span>
          )}
          {champLine && <span>Champions: {champLine}</span>}
        </div>
      ) : null}
    </Card>
  );
}

/* ─── Primitives ───────────────────────────────────────────────────── */
function AllTimeStat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>{label}</div>
    </div>
  );
}

function Loader({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--color-text-tertiary)' }}>
      {text}
    </div>
  );
}
