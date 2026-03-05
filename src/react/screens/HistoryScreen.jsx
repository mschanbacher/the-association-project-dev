import React, { useMemo } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card, CardHeader } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';

export function HistoryScreen() {
  const { gameState, isReady } = useGame();

  if (!isReady || !gameState) {
    return <Loader text="Loading history…" />;
  }

  const history = gameState._raw?._fullSeasonHistory || gameState._raw?.fullSeasonHistory || [];

  if (history.length === 0) {
    return (
      <div style={{
        maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-6)',
      }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0, marginBottom: 'var(--space-6)' }}>
          Franchise History
        </h2>
        <Card padding="lg">
          <div style={{
            textAlign: 'center', padding: 'var(--space-10) 0',
            color: 'var(--color-text-tertiary)',
          }}>
            
            <p style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-2)' }}>
              No completed seasons yet.
            </p>
            <p style={{ fontSize: 'var(--text-sm)' }}>
              Complete your first season to start building your franchise history.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Aggregate stats
  const stats = useMemo(() => {
    let wins = 0, losses = 0, championships = 0;
    history.forEach(s => {
      const ut = s.userTeam;
      if (ut) { wins += ut.wins || 0; losses += ut.losses || 0; }
      if (s.champions && ut) {
        const tier = ut.tier;
        const champ = tier === 1 ? s.champions.tier1 : tier === 2 ? s.champions.tier2 : s.champions.tier3;
        if (champ && champ.id === ut.id) championships++;
      }
    });
    const total = wins + losses;
    const pct = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';
    return { wins, losses, championships, pct, seasons: history.length };
  }, [history]);

  const sorted = useMemo(() => [...history].sort((a, b) => b.season - a.season), [history]);

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
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', textAlign: 'center',
        }}>
          <AllTimeStat label="Seasons" value={stats.seasons} color="var(--color-info)" />
          <AllTimeStat label="All-Time Record" value={`${stats.wins}–${stats.losses}`} color="var(--color-win)" />
          <AllTimeStat label="Championships" value={stats.championships} color="var(--color-tier1)" />
          <AllTimeStat label="Win %" value={`${stats.pct}%`} color="var(--color-accent)" />
        </div>
      </Card>

      {/* Season Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {sorted.map((season, i) => (
          <SeasonCard key={season.season || i} season={season} />
        ))}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Season Card
   ═══════════════════════════════════════════════════════════════ */
function SeasonCard({ season }) {
  const ut = season.userTeam;
  if (!ut) return null;

  const tierLabels = { 1: 'Tier 1 · NAPL', 2: 'Tier 2 · NARBL', 3: 'Tier 3 · MBL' };
  const tierCounts = { 1: 30, 2: 86, 3: 144 };

  // Championship check
  const isChampion = season.champions && (() => {
    const champ = ut.tier === 1 ? season.champions.tier1 : ut.tier === 2 ? season.champions.tier2 : season.champions.tier3;
    return champ && champ.id === ut.id;
  })();

  // Promotion/relegation
  let promoRelStatus = null;
  if (season.promotions) {
    const promoted = [...(season.promotions.toT1 || []), ...(season.promotions.toT2 || [])];
    if (promoted.some(t => t.id === ut.id)) promoRelStatus = 'promoted';
  }
  if (season.relegations) {
    const relegated = [...(season.relegations.fromT1 || []), ...(season.relegations.fromT2 || [])];
    if (relegated.some(t => t.id === ut.id)) promoRelStatus = 'relegated';
  }

  // Awards
  const tierAwards = season.awards
    ? (ut.tier === 1 ? season.awards.tier1 : ut.tier === 2 ? season.awards.tier2 : season.awards.tier3)
    : null;
  const userAwards = [];
  if (tierAwards) {
    const awardLabels = { mvp: 'MVP', dpoy: 'DPOY', roy: 'ROY', sixthMan: '6MOY', mostImproved: 'MIP' };
    Object.entries(awardLabels).forEach(([key, label]) => {
      if (tierAwards[key]?.teamId === ut.id) {
        userAwards.push({ label, name: tierAwards[key].name });
      }
    });
  }

  // Champions line
  const champLine = season.champions ? [
    season.champions.tier1 ? `T1: ${season.champions.tier1.name}` : null,
    season.champions.tier2 ? `T2: ${season.champions.tier2.name}` : null,
    season.champions.tier3 ? `T3: ${season.champions.tier3.name}` : null,
  ].filter(Boolean).join(' · ') : '';

  const winColor = (() => {
    const total = (ut.wins || 0) + (ut.losses || 0);
    const pct = total > 0 ? ut.wins / total : 0.5;
    return pct >= 0.6 ? 'var(--color-win)' : pct <= 0.4 ? 'var(--color-loss)' : 'var(--color-text)';
  })();

  return (
    <Card padding="lg" className="animate-slide-up" style={isChampion ? {
      borderColor: 'rgba(212, 168, 67, 0.4)',
      background: 'rgba(212, 168, 67, 0.04)',
    } : {}}>
      {/* Header row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 'var(--space-3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>
            {season.seasonLabel || season.season}
          </span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
            {tierLabels[ut.tier] || `Tier ${ut.tier}`}
          </span>
          {isChampion && <Badge variant="warning" style={{ fontWeight: 'var(--weight-bold)' }}>Champion</Badge>}
          {promoRelStatus === 'promoted' && <Badge variant="win">⬆️ Promoted</Badge>}
          {promoRelStatus === 'relegated' && <Badge variant="loss">⬇️ Relegated</Badge>}
        </div>
        <span style={{
          fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)',
          color: winColor, fontVariantNumeric: 'tabular-nums',
        }}>
          {ut.wins}–{ut.losses}
        </span>
      </div>

      {/* Details grid */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)',
        fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
      }}>
        <span>Finished {rankSuffix(ut.rank)} of {tierCounts[ut.tier] || '?'}</span>
        <span>Coach: {ut.coachName || '—'}</span>
        {ut.topPlayer && (
          <span>Best: {ut.topPlayer.name} ({ut.topPlayer.rating} OVR, {ut.topPlayer.position})</span>
        )}
      </div>

      {/* Awards */}
      {userAwards.length > 0 && (
        <div style={{
          display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap',
          marginTop: 'var(--space-3)',
        }}>
          {userAwards.map((a, i) => (
            <Badge key={i} variant="accent">{a.label}: {a.name}</Badge>
          ))}
        </div>
      )}

      {/* League MVP + Champions */}
      {(tierAwards?.mvp || champLine) && (
        <div style={{
          marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--color-border-subtle)',
          fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {tierAwards?.mvp && (
            <span>League MVP: {tierAwards.mvp.name} ({tierAwards.mvp.team}) — {tierAwards.mvp.ppg?.toFixed(1)} PPG, {tierAwards.mvp.rpg?.toFixed(1)} RPG, {tierAwards.mvp.apg?.toFixed(1)} APG</span>
          )}
          {champLine && <span>Champions: {champLine}</span>}
        </div>
      )}
    </Card>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
function AllTimeStat({ label, value, color }) {
  return (
    <div>
      <div style={{
        fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)',
        color, fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>{label}</div>
    </div>
  );
}

function rankSuffix(n) {
  if (!n && n !== 0) return '';
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + 'th';
  const last = n % 10;
  if (last === 1) return n + 'st';
  if (last === 2) return n + 'nd';
  if (last === 3) return n + 'rd';
  return n + 'th';
}

function Loader({ text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: 'var(--color-text-tertiary)',
    }}>{text}</div>
  );
}
