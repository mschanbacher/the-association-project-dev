import React, { useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '../components/Modal.jsx';
import { Button } from '../components/Button.jsx';

export function SeasonEndModal({ isOpen, data, onAdvance, onManageRoster, onStay }) {
  const [tab, setTab] = useState('summary');

  if (!isOpen || !data) return null;

  const {
    userTeam, rank, tier, status, statusColor, nextAction, seasonLabel,
    awards, t1TopTeam, t2Champion, t3Champion,
    t2Promoted, t1Relegated, t3Promoted, tier2Sorted, getRankSuffix
  } = data;

  const sfx = getRankSuffix || ((n) => {
    if (n % 10 === 1 && n !== 11) return 'st';
    if (n % 10 === 2 && n !== 12) return 'nd';
    if (n % 10 === 3 && n !== 13) return 'rd';
    return 'th';
  });

  const hasAwards = awards && awards.some(a => a.data);

  const tabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'prorel', label: 'Promo / Rel' },
    hasAwards ? { key: 'awards', label: 'Awards' } : null,
  ].filter(Boolean);

  return (
    <Modal isOpen={isOpen} onClose={onStay} maxWidth={800} zIndex={1300}>
      <div style={{
        padding: 'var(--space-6)', textAlign: 'center',
        background: 'linear-gradient(135deg, var(--color-bg-sunken), var(--color-bg-active))',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}>
        <div style={{ fontSize: '32px', marginBottom: 'var(--space-2)' }}>{'🏀'}</div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)' }}>
          Season {seasonLabel} Complete
        </div>
        <div style={{
          marginTop: 'var(--space-3)', fontSize: 'var(--text-lg)',
          fontWeight: 'var(--weight-bold)', color: statusColor,
        }}>
          {status}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          <strong>{userTeam.name}</strong> &mdash; {rank}{sfx(rank)} place &middot; {userTeam.wins}-{userTeam.losses} &middot; Diff: {userTeam.pointDiff > 0 ? '+' : ''}{userTeam.pointDiff}
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 2, padding: '0 var(--space-5)',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-sunken)',
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: tab === t.key ? 'var(--color-text)' : 'var(--color-text-tertiary)',
            fontWeight: tab === t.key ? 'var(--weight-semi)' : 'var(--weight-normal)',
            fontSize: 'var(--text-sm)', cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      <ModalBody style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        {tab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
              {t1TopTeam && <LeaderCard tier="Tier 1" color="var(--color-tier1)" team={t1TopTeam} label="Best Record" />}
              {t2Champion && <LeaderCard tier="Tier 2" color="#c0c0c0" team={t2Champion} label="Champion" />}
              {t3Champion && <LeaderCard tier="Tier 3" color="#cd7f32" team={t3Champion} label="Champion" />}
            </div>
          </div>
        )}

        {tab === 'prorel' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            {t2Promoted && <ProRelCard title="Promoted to Tier 1" icon={'\u2B06\uFE0F'} color="var(--color-win)" teams={t2Promoted} />}
            {t1Relegated && <ProRelCard title="Relegated to Tier 2" icon={'\u2B07\uFE0F'} color="var(--color-loss)" teams={t1Relegated} />}
            {t3Promoted && <ProRelCard title="Promoted to Tier 2" icon={'\u2B06\uFE0F'} color="var(--color-win)" teams={t3Promoted} />}
            {tier2Sorted && tier2Sorted.length >= 4 && (
              <ProRelCard title="Relegated to Tier 3" icon={'\u2B07\uFE0F'} color="var(--color-loss)"
                teams={[
                  tier2Sorted[tier2Sorted.length - 1], tier2Sorted[tier2Sorted.length - 2],
                  tier2Sorted[tier2Sorted.length - 3], tier2Sorted[tier2Sorted.length - 4]
                ]} />
            )}
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
              *Playoff results may adjust final placement
            </div>
          </div>
        )}

        {tab === 'awards' && hasAwards && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {awards.filter(a => a.data).map((tier, idx) => (
              <TierAwardsSection key={idx} tierLabel={tier.tierLabel} awards={tier.data} />
            ))}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <div style={{ display: 'flex', gap: 'var(--space-3)', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={onManageRoster}>Manage Roster</Button>
          <Button variant="primary" onClick={() => onAdvance(nextAction)}>
            Start Playoffs & Off-Season
          </Button>
          <Button variant="ghost" onClick={onStay} style={{ fontSize: 'var(--text-xs)' }}>Stay on Season</Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

/* ── Tier Awards Section ── */
function TierAwardsSection({ tierLabel, awards }) {
  if (!awards) return null;

  const mvpExtra = awards.mvp
    ? `${awards.mvp.avgs.fieldGoalPct.toFixed(1)}% FG · ${awards.mvp.team.wins}-${awards.mvp.team.losses}`
    : '';
  const dpoyExtra = awards.dpoy
    ? `DEF ${awards.dpoy.player.defRating || '??'} · ${awards.dpoy.avgs.stealsPerGame} SPG · ${awards.dpoy.avgs.blocksPerGame} BPG`
    : '';
  const mipExtra = awards.mostImproved?.prevAvgs
    ? `+${awards.mostImproved.improvement.toFixed(1)} composite improvement`
    : '';

  return (
    <div style={{
      background: 'var(--color-accent-subtle, rgba(212,168,67,0.05))',
      padding: 'var(--space-5)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-accent-border, rgba(212,168,67,0.15))',
    }}>
      <div style={{
        fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)',
        color: 'var(--color-accent)', marginBottom: 'var(--space-4)',
      }}>
        🏆 {tierLabel} Season Awards
      </div>

      {/* Major Awards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 'var(--space-3)', marginBottom: 'var(--space-4)',
      }}>
        <AwardCard emoji="🏅" title="MVP" winner={awards.mvp} extra={mvpExtra} />
        <AwardCard emoji="🛡️" title="Defensive POY" winner={awards.dpoy} extra={dpoyExtra} />
        <AwardCard emoji="⭐" title="Rookie of the Year" winner={awards.roy} />
        <AwardCard emoji="💪" title="Sixth Man" winner={awards.sixthMan} />
        <AwardCard emoji="📈" title="Most Improved" winner={awards.mostImproved} extra={mipExtra} />
      </div>

      {/* All-League Teams */}
      <div style={{
        background: 'var(--color-bg-sunken)', padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)',
      }}>
        <div style={{
          color: 'var(--color-accent)', fontWeight: 'var(--weight-bold)',
          fontSize: 'var(--text-md)', marginBottom: 'var(--space-3)',
        }}>
          All-League Teams
        </div>
        <AllLeagueRow label="First Team" team={awards.allLeagueFirst} />
        <AllLeagueRow label="Second Team" team={awards.allLeagueSecond} />
      </div>

      {/* Stat Leaders */}
      {awards.statLeaders && (
        <div style={{
          background: 'var(--color-bg-sunken)', padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{
            color: 'var(--color-accent)', fontWeight: 'var(--weight-bold)',
            fontSize: 'var(--text-md)', marginBottom: 'var(--space-3)',
          }}>
            Statistical Leaders
          </div>
          <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.8 }}>
            <StatLeaderRow label="Scoring" stat="pointsPerGame" leaders={awards.statLeaders.scoring} />
            <StatLeaderRow label="Rebounds" stat="reboundsPerGame" leaders={awards.statLeaders.rebounds} />
            <StatLeaderRow label="Assists" stat="assistsPerGame" leaders={awards.statLeaders.assists} />
            <StatLeaderRow label="Steals" stat="stealsPerGame" leaders={awards.statLeaders.steals} />
            <StatLeaderRow label="Blocks" stat="blocksPerGame" leaders={awards.statLeaders.blocks} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Award Card ── */
function AwardCard({ emoji, title, winner, extra }) {
  if (!winner) return null;
  const a = winner.avgs;
  return (
    <div style={{
      background: 'var(--color-accent-subtle, rgba(212,168,67,0.05))',
      border: '1px solid var(--color-accent-border, rgba(212,168,67,0.15))',
      borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', textAlign: 'center',
    }}>
      <div style={{ fontSize: '2em', marginBottom: 'var(--space-1)' }}>{emoji}</div>
      <div style={{
        fontSize: 'var(--text-xs)', color: 'var(--color-accent)',
        textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 'var(--space-2)',
      }}>
        {title}
      </div>
      <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)', marginBottom: 2 }}>
        {winner.player.name}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', opacity: 0.8 }}>
        {winner.team.name} · {winner.player.position}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 'var(--space-1)' }}>
        {a.pointsPerGame} PPG · {a.reboundsPerGame} RPG · {a.assistsPerGame} APG
      </div>
      {extra && (
        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 2 }}>{extra}</div>
      )}
    </div>
  );
}

/* ── All-League Row ── */
function AllLeagueRow({ label, team }) {
  if (!team) return null;
  const slots = [team.G1, team.G2, team.F1, team.F2, team.C].filter(Boolean);
  if (slots.length === 0) return null;
  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <div style={{
        fontSize: 'var(--text-sm)', color: 'var(--color-accent)',
        fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)',
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'var(--space-2)' }}>
        {slots.map((p, i) => (
          <div key={i} style={{
            background: 'var(--color-bg-active)', padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-sm)', minWidth: 135,
          }}>
            <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
              {p.player.name}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
              {p.player.position} · {p.team.name}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>
              {p.avgs.pointsPerGame}/{p.avgs.reboundsPerGame}/{p.avgs.assistsPerGame}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Stat Leader Row ── */
function StatLeaderRow({ label, stat, leaders }) {
  if (!leaders || leaders.length === 0) return null;
  return (
    <div>
      <strong>{label}:</strong>{' '}
      {leaders.map((p, i) => (
        <span key={i} style={{ opacity: 1 - i * 0.2 }}>
          {i === 0 ? '👑 ' : ''}{p.player.name} ({p.avgs[stat]})
          {i < leaders.length - 1 ? ' · ' : ''}
        </span>
      ))}
    </div>
  );
}

/* ── Summary cards ── */
function LeaderCard({ tier, color, team, label }) {
  if (!team) return null;
  return (
    <div style={{
      textAlign: 'center', padding: 'var(--space-3)',
      background: color + '08', borderRadius: 'var(--radius-md)',
      border: '1px solid ' + color + '15',
    }}>
      <div style={{ fontSize: 'var(--text-xs)', color, fontWeight: 'var(--weight-semi)', marginBottom: 2 }}>
        {tier} &mdash; {label}
      </div>
      <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>{team.name}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
        {team.wins}-{team.losses}
      </div>
    </div>
  );
}

function ProRelCard({ title, icon, color, teams }) {
  if (!teams || teams.length === 0) return null;
  return (
    <div style={{
      padding: 'var(--space-3)', background: color + '08',
      borderRadius: 'var(--radius-md)', border: '1px solid ' + color + '15',
    }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semi)', color, marginBottom: 'var(--space-2)' }}>
        {icon} {title}
      </div>
      {teams.filter(Boolean).map((t, i) => (
        <div key={i} style={{ fontSize: 'var(--text-xs)', marginBottom: 1 }}>
          <span style={{ fontWeight: i === 0 ? 'var(--weight-semi)' : 'var(--weight-normal)' }}>
            {t.name || t.city} {i === 0 ? '(Auto)' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
