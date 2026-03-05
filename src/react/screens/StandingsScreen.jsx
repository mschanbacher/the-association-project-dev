import React, { useState, useMemo } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card, CardHeader } from '../components/Card.jsx';
import { Badge, TierBadge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';

export function StandingsScreen() {
  const { gameState, engines, isReady } = useGame();
  const [viewTier, setViewTier] = useState(null); // null = current tier
  const [viewMode, setViewMode] = useState('overall'); // 'overall' | 'division'

  if (!isReady || !gameState?.userTeam) {
    return <ScreenLoader text="Loading standings…" />;
  }

  const activeTier = viewTier ?? gameState.currentTier;

  const teams = activeTier === 1 ? gameState.tier1Teams :
                activeTier === 2 ? gameState.tier2Teams : gameState.tier3Teams;

  const leagueNames = {
    1: 'National Basketball Association',
    2: 'North American Regional Basketball League',
    3: 'North American Metro Basketball League' };

  return (
    <div style={{
      maxWidth: 'var(--content-max)',
      margin: '0 auto',
      padding: 'var(--space-6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)' }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <h2 style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--weight-bold)',
            margin: 0 }}>
            Standings
          </h2>
          <TierBadge tier={activeTier} />
          <span style={{
            fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)',
            fontWeight: 400,
          }}>{leagueNames[activeTier]}</span>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {/* View mode toggle */}
          <ToggleGroup
            options={[
              { value: 'overall', label: 'Overall' },
              { value: 'division', label: 'Division' },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
          <div style={{ width: 1, background: 'var(--color-border)', margin: '0 var(--space-1)' }} />
          {/* Tier switching */}
          <ToggleGroup
            options={[
              { value: 1, label: 'T1' },
              { value: 2, label: 'T2' },
              { value: 3, label: 'T3' },
            ]}
            value={activeTier}
            onChange={(t) => setViewTier(t === gameState.currentTier ? null : t)}
            activeVariant={activeTier === gameState.currentTier ? 'accent' : 'info'}
          />
        </div>
      </div>

      {/* Standings Table */}
      {viewMode === 'overall' ? (
        <OverallStandings teams={teams} tier={activeTier} gameState={gameState} engines={engines} />
      ) : (
        <DivisionStandings teams={teams} tier={activeTier} gameState={gameState} engines={engines} />
      )}

      {/* Zone Legend */}
      <ZoneLegend tier={activeTier} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Overall Standings Table
   ═══════════════════════════════════════════════════════════════ */
function OverallStandings({ teams, tier, gameState, engines }) {
  const { LeagueManager } = engines;

  const sorted = useMemo(() => {
    if (LeagueManager?.sortTeamsByStandings) {
      return LeagueManager.sortTeamsByStandings([...teams], gameState.schedule);
    }
    return [...teams].sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses));
  }, [teams, gameState.schedule, LeagueManager]);

  const leaderWins = sorted[0]?.wins || 0;
  const leaderLosses = sorted[0]?.losses || 0;

  return (
    <Card padding="none" className="animate-fade-in">
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <Th align="center" width={48}>#</Th>
              <Th align="left">Team</Th>
              <Th align="left" width={140}>Division</Th>
              <Th align="center" width={56}>W</Th>
              <Th align="center" width={56}>L</Th>
              <Th align="center" width={64}>PCT</Th>
              <Th align="center" width={56}>GB</Th>
              <Th align="center" width={64}>DIFF</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((team, i) => {
              const rank = i + 1;
              const zone = getZone(rank, sorted.length, tier);
              const isUser = team.id === gameState.userTeamId;
              const total = team.wins + team.losses;
              const pct = total > 0 ? (team.wins / total).toFixed(3).slice(1) : '.000';
              const gb = rank === 1 ? '—' :
                ((leaderWins - team.wins + team.losses - leaderLosses) / 2);
              const gbStr = gb === '—' ? '—' : gb === 0 ? '—' : gb.toFixed(1);
              const diff = (team.pointDiff || 0);

              return (
                <tr key={team.id} style={{
                  ...trowStyle,
                  background: isUser ? 'var(--color-accent-bg)' :
                              zone === 'promotion' ? 'rgba(45, 138, 86, 0.06)' :
                              zone === 'playoff' ? 'rgba(196, 138, 24, 0.06)' :
                              zone === 'relegation-playoff' ? 'rgba(196, 138, 24, 0.06)' :
                              zone === 'auto-relegate' ? 'rgba(196, 62, 62, 0.06)' :
                              'transparent',
                  fontWeight: isUser ? 'var(--weight-semi)' : 'var(--weight-normal)' }}>
                  <Td align="center" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                    {rank}
                  </Td>
                  <Td align="left" style={{ color: isUser ? 'var(--color-accent)' : 'var(--color-text)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {team.name}
                      {zone && !isUser && <ZoneDot zone={zone} />}
                    </div>
                  </Td>
                  <Td align="left" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                    {team.division || '—'}
                  </Td>
                  <Td align="center" mono style={{ color: 'var(--color-win)' }}>{team.wins}</Td>
                  <Td align="center" mono style={{ color: 'var(--color-loss)' }}>{team.losses}</Td>
                  <Td align="center" mono>{pct}</Td>
                  <Td align="center" mono style={{ color: 'var(--color-text-tertiary)' }}>{gbStr}</Td>
                  <Td align="center" mono style={{
                    color: diff > 0 ? 'var(--color-win)' : diff < 0 ? 'var(--color-loss)' : 'var(--color-text-tertiary)' }}>
                    {diff > 0 ? '+' : ''}{diff}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Division Standings
   ═══════════════════════════════════════════════════════════════ */
function DivisionStandings({ teams, tier, gameState, engines }) {
  const divisions = useMemo(() => {
    const divMap = {};
    teams.forEach(team => {
      const div = team.division || 'Unknown';
      if (!divMap[div]) divMap[div] = [];
      divMap[div].push(team);
    });
    // Sort teams within each division
    Object.keys(divMap).forEach(div => {
      divMap[div].sort((a, b) => {
        const pctA = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0;
        const pctB = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0;
        return pctB - pctA;
      });
    });
    return divMap;
  }, [teams]);

  const sortedDivNames = Object.keys(divisions).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {sortedDivNames.map(divName => (
        <Card key={divName} padding="none" className="animate-slide-up">
          <div style={{
            padding: 'var(--space-3) var(--space-5)',
            background: 'var(--color-bg-sunken)',
            borderBottom: '1px solid var(--color-border)' }}>
            <span style={{
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-semi)',
              color: 'var(--color-text)' }}>
              {divName}
            </span>
            <span style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-tertiary)',
              marginLeft: 'var(--space-2)' }}>
              {divisions[divName].length} teams
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={theadRowStyle}>
                  <Th align="center" width={48}>#</Th>
                  <Th align="left">Team</Th>
                  <Th align="center" width={56}>W</Th>
                  <Th align="center" width={56}>L</Th>
                  <Th align="center" width={64}>PCT</Th>
                  <Th align="center" width={64}>DIFF</Th>
                </tr>
              </thead>
              <tbody>
                {divisions[divName].map((team, i) => {
                  const isUser = team.id === gameState.userTeamId;
                  const total = team.wins + team.losses;
                  const pct = total > 0 ? (team.wins / total).toFixed(3).slice(1) : '.000';
                  const diff = team.pointDiff || 0;

                  return (
                    <tr key={team.id} style={{
                      ...trowStyle,
                      background: isUser ? 'var(--color-accent-bg)' : 'transparent',
                      fontWeight: isUser ? 'var(--weight-semi)' : 'var(--weight-normal)' }}>
                      <Td align="center" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                        {i + 1}
                      </Td>
                      <Td align="left" style={{ color: isUser ? 'var(--color-accent)' : 'var(--color-text)' }}>
                        {team.name}
                      </Td>
                      <Td align="center" mono style={{ color: 'var(--color-win)' }}>{team.wins}</Td>
                      <Td align="center" mono style={{ color: 'var(--color-loss)' }}>{team.losses}</Td>
                      <Td align="center" mono>{pct}</Td>
                      <Td align="center" mono style={{
                        color: diff > 0 ? 'var(--color-win)' : diff < 0 ? 'var(--color-loss)' : 'var(--color-text-tertiary)' }}>
                        {diff > 0 ? '+' : ''}{diff}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Zone Legend
   ═══════════════════════════════════════════════════════════════ */
function ZoneLegend({ tier }) {
  const items = tier === 1 ? [
    { color: 'rgba(196, 138, 24, 0.25)', label: 'Relegation Playoff' },
    { color: 'rgba(196, 62, 62, 0.25)', label: 'Auto-Relegation' },
  ] : [
    { color: 'rgba(45, 138, 86, 0.25)', label: 'Auto-Promotion' },
    { color: 'rgba(196, 138, 24, 0.25)', label: 'Promotion Playoff' },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: 'center',
      padding: 'var(--space-3) 0' }}>
      <span style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontWeight: 'var(--weight-semi)' }}>
        Zones
      </span>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{
            width: 12, height: 12,
            background: item.color,
            border: `1px solid ${item.color.replace('0.25', '0.5')}` }} />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {item.label}
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <div style={{
          width: 12, height: 12,
          background: 'var(--color-accent-bg)',
          border: '1px solid var(--color-accent-border)' }} />
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Your Team
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Shared Primitives
   ═══════════════════════════════════════════════════════════════ */
function ToggleGroup({ options, value, onChange, activeVariant = 'accent' }) {
  return (
    <div style={{
      display: 'flex',
      background: 'var(--color-bg-sunken)',
      padding: 2,
      gap: 2 }}>
      {options.map(opt => {
        const isActive = opt.value === value;
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)} style={{
            padding: '5px 12px',
            border: 'none',
            background: isActive ? 'var(--color-bg-raised)' : 'transparent',
            color: isActive ? 'var(--color-text)' : 'var(--color-text-tertiary)',
            fontSize: 'var(--text-sm)',
            fontWeight: isActive ? 'var(--weight-semi)' : 'var(--weight-normal)',
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            transition: 'all var(--duration-fast) ease',
            boxShadow: isActive ? 'var(--shadow-xs)' : 'none' }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ZoneDot({ zone }) {
  const colors = {
    promotion: 'var(--color-win)',
    playoff: 'var(--color-warning)',
    'relegation-playoff': 'var(--color-warning)',
    'auto-relegate': 'var(--color-loss)' };
  return (
    <span style={{
      width: 6, height: 6,
      background: colors[zone] || 'transparent',
      display: 'inline-block',
      flexShrink: 0 }} />
  );
}

function getZone(rank, totalTeams, tier) {
  if (tier === 1) {
    if (rank >= totalTeams - 2 && rank <= totalTeams - 1) return 'relegation-playoff';
    if (rank === totalTeams) return 'auto-relegate';
  } else {
    if (rank === 1) return 'promotion';
    if (rank >= 2 && rank <= 4) return 'playoff';
  }
  return null;
}

function ScreenLoader({ text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: 'var(--color-text-tertiary)' }}>
      {text}
    </div>
  );
}

function Th({ children, align = 'left', width, style }) {
  return (
    <th style={{
      padding: '10px 12px',
      textAlign: align,
      fontWeight: 600,
      width,
      ...style }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left', mono = false, style }) {
  return (
    <td style={{
      padding: '9px 12px',
      textAlign: align,
      fontVariantNumeric: mono ? 'tabular-nums' : undefined,
      fontFamily: mono ? 'var(--font-mono)' : undefined,
      fontSize: mono ? 'var(--text-sm)' : undefined,
      ...style }}>
      {children}
    </td>
  );
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--text-base)' };

const theadRowStyle = {
  borderBottom: '2px solid var(--color-border)',
  fontSize: 'var(--text-xs)',
  color: 'var(--color-text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em' };

const trowStyle = {
  borderBottom: '1px solid var(--color-border-subtle)',
  transition: 'background var(--duration-fast) ease' };
