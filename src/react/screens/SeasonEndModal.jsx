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
    <Modal isOpen={isOpen} onClose={onStay} maxWidth={720} zIndex={1300}>
      <ModalBody style={{ padding: 0 }}>
        {/* Header */}
        <div style={{ padding: '24px 28px', textAlign: 'center', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6,
          }}>Season Complete</div>
          <div style={{
            fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)',
            letterSpacing: '-0.02em', marginBottom: 8,
          }}>
            {seasonLabel} Season
          </div>
          <div style={{
            fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)',
            color: statusColor || 'var(--color-text)',
            marginBottom: 6,
          }}>{status}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            <strong>{userTeam.name}</strong> — {rank}{sfx(rank)} place · {userTeam.wins}–{userTeam.losses} · Diff: {userTeam.pointDiff > 0 ? '+' : ''}{userTeam.pointDiff}
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-sunken)',
        }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '10px 20px', background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: tab === t.key ? 'var(--color-text)' : 'var(--color-text-tertiary)',
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)', cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '20px 28px', maxHeight: '50vh', overflowY: 'auto' }}>
          {tab === 'summary' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)' }}>
              {t1TopTeam && <TierLeader tier="Tier 1" color="var(--color-tier1)" team={t1TopTeam} label="Best Record" />}
              {t2Champion && <TierLeader tier="Tier 2" color="var(--color-tier2)" team={t2Champion} label="Champion" />}
              {t3Champion && <TierLeader tier="Tier 3" color="var(--color-tier3)" team={t3Champion} label="Champion" />}
            </div>
          )}

          {tab === 'prorel' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)' }}>
              {t2Promoted && <ProRelGroup title="Promoted to Tier 1" color="var(--color-win)" teams={t2Promoted} />}
              {t1Relegated && <ProRelGroup title="Relegated to Tier 2" color="var(--color-loss)" teams={t1Relegated} />}
              {t3Promoted && <ProRelGroup title="Promoted to Tier 2" color="var(--color-win)" teams={t3Promoted} />}
              {tier2Sorted && tier2Sorted.length >= 4 && (
                <ProRelGroup title="Relegated to Tier 3" color="var(--color-loss)"
                  teams={[
                    tier2Sorted[tier2Sorted.length - 1], tier2Sorted[tier2Sorted.length - 2],
                    tier2Sorted[tier2Sorted.length - 3], tier2Sorted[tier2Sorted.length - 4],
                  ]} />
              )}
              <div style={{
                gridColumn: '1 / -1', textAlign: 'center',
                fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4,
              }}>
                Playoff results may adjust final placement
              </div>
            </div>
          )}

          {tab === 'awards' && hasAwards && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {awards.filter(a => a.data).map((tier, idx) => (
                <TierAwardsSection key={idx} tierLabel={tier.tierLabel} awards={tier.data} />
              ))}
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onManageRoster}>Manage Roster</Button>
        <Button variant="primary" onClick={() => onAdvance(nextAction)}>
          Start Playoffs & Offseason
        </Button>
        <Button variant="ghost" onClick={onStay} style={{ fontSize: 'var(--text-xs)' }}>Stay on Season</Button>
      </ModalFooter>
    </Modal>
  );
}

function TierLeader({ tier, color, team, label }) {
  if (!team) return null;
  return (
    <div style={{
      padding: '14px', background: 'var(--color-bg-sunken)',
      border: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
      }}>{tier} — {label}</div>
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{team.name}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
        {team.wins}–{team.losses}
      </div>
    </div>
  );
}

function ProRelGroup({ title, color, teams }) {
  if (!teams || teams.length === 0) return null;
  return (
    <div style={{
      padding: '12px 14px', background: `${color}08`,
      border: `1px solid ${color}15`,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
      }}>{title}</div>
      {teams.filter(Boolean).map((t, i) => (
        <div key={i} style={{
          fontSize: 'var(--text-sm)', marginBottom: 2,
          fontWeight: i === 0 ? 600 : 400,
        }}>
          {t.name || t.city}{i === 0 ? ' (Auto)' : ''}
        </div>
      ))}
    </div>
  );
}

function TierAwardsSection({ tierLabel, awards }) {
  if (!awards) return null;

  const mvpExtra = awards.mvp
    ? `${awards.mvp.avgs.fieldGoalPct.toFixed(1)}% FG · ${awards.mvp.team.wins}–${awards.mvp.team.losses}`
    : '';
  const dpoyExtra = awards.dpoy
    ? `DEF ${awards.dpoy.player.defRating || '??'} · ${awards.dpoy.avgs.stealsPerGame} SPG · ${awards.dpoy.avgs.blocksPerGame} BPG`
    : '';
  const mipExtra = awards.mostImproved?.prevAvgs
    ? `+${awards.mostImproved.improvement.toFixed(1)} composite improvement`
    : '';

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
      }}>{tierLabel} Season Awards</div>

      {/* Major Awards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 'var(--gap)', marginBottom: 16,
      }}>
        <AwardCard title="MVP" winner={awards.mvp} extra={mvpExtra} />
        <AwardCard title="Defensive POY" winner={awards.dpoy} extra={dpoyExtra} />
        <AwardCard title="Rookie of the Year" winner={awards.roy} />
        <AwardCard title="Sixth Man" winner={awards.sixthMan} />
        <AwardCard title="Most Improved" winner={awards.mostImproved} extra={mipExtra} />
      </div>

      {/* All-League Teams */}
      <div style={{
        background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)',
        padding: '14px 16px', marginBottom: 12,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
        }}>All-League Teams</div>
        <AllLeagueRow label="First Team" team={awards.allLeagueFirst} />
        <AllLeagueRow label="Second Team" team={awards.allLeagueSecond} />
      </div>

      {/* Stat Leaders */}
      {awards.statLeaders && (
        <div style={{
          background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)',
          padding: '14px 16px',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
          }}>Statistical Leaders</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <tbody>
              <StatLeaderRow label="Scoring" stat="pointsPerGame" leaders={awards.statLeaders.scoring} />
              <StatLeaderRow label="Rebounds" stat="reboundsPerGame" leaders={awards.statLeaders.rebounds} />
              <StatLeaderRow label="Assists" stat="assistsPerGame" leaders={awards.statLeaders.assists} />
              <StatLeaderRow label="Steals" stat="stealsPerGame" leaders={awards.statLeaders.steals} />
              <StatLeaderRow label="Blocks" stat="blocksPerGame" leaders={awards.statLeaders.blocks} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AwardCard({ title, winner, extra }) {
  if (!winner) return null;
  const a = winner.avgs;
  return (
    <div style={{
      padding: '12px 14px', background: 'var(--color-accent-bg)',
      border: '1px solid var(--color-accent-border)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
      }}>{title}</div>
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 2 }}>
        {winner.player.name}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
        {winner.team.name} · {winner.player.position}
      </div>
      <div style={{
        fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
        fontFamily: 'var(--font-mono)',
      }}>
        {a.pointsPerGame} PPG · {a.reboundsPerGame} RPG · {a.assistsPerGame} APG
      </div>
      {extra && (
        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{extra}</div>
      )}
    </div>
  );
}

function AllLeagueRow({ label, team }) {
  if (!team) return null;
  const slots = [team.G1, team.G2, team.F1, team.F2, team.C].filter(Boolean);
  if (slots.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 'var(--text-xs)', fontWeight: 600,
        color: 'var(--color-text-secondary)', marginBottom: 6,
      }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {slots.map((p, i) => (
          <div key={i} style={{
            padding: '6px 8px', background: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border-subtle)',
          }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{p.player.name}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
              {p.player.position} · {p.team.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {p.avgs.pointsPerGame}/{p.avgs.reboundsPerGame}/{p.avgs.assistsPerGame}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatLeaderRow({ label, stat, leaders }) {
  if (!leaders || leaders.length === 0) return null;
  const top = leaders[0];
  return (
    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <td style={{ padding: '5px 0', fontWeight: 600, width: 80 }}>{label}</td>
      <td style={{ padding: '5px 8px' }}>{top.player.name}</td>
      <td style={{ padding: '5px 8px', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
        {top.team.name}
      </td>
      <td style={{
        padding: '5px 0', textAlign: 'right',
        fontFamily: 'var(--font-mono)', fontWeight: 600,
      }}>{top.avgs[stat]}</td>
    </tr>
  );
}
