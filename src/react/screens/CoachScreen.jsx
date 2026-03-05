import React, { useMemo } from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import { Card, CardHeader } from '../components/Card.jsx';
import { Badge, RatingBadge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';

export function CoachScreen() {
  const { gameState, engines, isReady } = useGame();

  if (!isReady || !gameState?.userTeam) {
    return <Loader text="Loading coach info…" />;
  }

  const { userTeam } = gameState;
  const { CoachEngine } = engines;
  const coach = userTeam.coach;

  if (!coach) {
    return (
      <div style={{
        maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-6)',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>Coach</h2>
        <Card padding="lg">
          <div style={{
            textAlign: 'center', padding: 'var(--space-10) 0' }}>
            
            <p style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semi)', color: 'var(--color-loss)', marginBottom: 'var(--space-2)' }}>
              No Head Coach
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-5)' }}>
              Your team is operating without a head coach. Hire one to unlock coaching bonuses and team synergy.
            </p>
            <Button variant="primary" onClick={() => window.openCoachManagement?.()}>
              Open Coach Market
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const synergyData = CoachEngine?.calculateSynergy?.(coach, userTeam.roster) || { score: 50, grade: 'C', description: '' };
  const synergy = typeof synergyData === 'number' ? synergyData : (synergyData.score || 0);
  const synergyGrade = typeof synergyData === 'object' ? synergyData.grade : null;
  const synergyDesc = typeof synergyData === 'object' ? synergyData.description : '';
  const traitDefs = CoachEngine?.TRAIT_DEFINITIONS || {};

  // Build trait list
  const traits = useMemo(() => {
    if (!coach.traits || !traitDefs) return [];
    return Object.entries(coach.traits)
      .map(([key, val]) => {
        const def = traitDefs[key];
        if (!def) return null;
        return { key, value: val, name: def.name || key, icon: null, max: 100 };
      })
      .filter(Boolean)
      .sort((a, b) => b.value - a.value);
  }, [coach.traits, traitDefs]);

  const ovrColor = ratingColor(coach.overall);

  return (
    <div style={{
      maxWidth: 'var(--content-max)', margin: '0 auto', padding: 'var(--space-6)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>Coach</h2>
        <Button variant="secondary" size="sm" onClick={() => window.openCoachManagement?.()}>
          Manage / Market →
        </Button>
      </div>

      {/* Coach Profile Card */}
      <Card padding="lg" className="animate-slide-up">
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 'var(--space-6)' }}>
          {/* Coach avatar — initials in team color */}
          <CoachAvatar name={coach.name} archetype={coach.archetype} />

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)',
              marginBottom: 'var(--space-1)' }}>
              {coach.name}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              marginBottom: 'var(--space-3)' }}>
              <Badge variant="accent">{coach.archetype}</Badge>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-md)',
                fontWeight: 'var(--weight-bold)', color: ovrColor }}>
                {coach.overall} OVR
              </span>
              {coach.salary && (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                  {formatCurrency(coach.salary)}/yr
                </span>
              )}
              {coach.contractYears && (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                  · {coach.contractYears}yr contract
                </span>
              )}
            </div>

            {/* Synergy */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 'var(--space-1)' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                  Roster Synergy
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-semi)',
                  color: synergy >= 70 ? 'var(--color-win)' : synergy >= 40 ? 'var(--color-warning)' : 'var(--color-loss)' }}>
                  {synergyGrade || ''} ({Math.round(synergy)})
                </span>
              </div>
              <ProgressBar value={synergy / 100} />
            </div>
          </div>
        </div>
      </Card>

      {/* Traits Grid */}
      {traits.length > 0 && (
        <Card padding="lg" className="animate-slide-up">
          <CardHeader>Coaching Traits</CardHeader>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 'var(--space-4)' }}>
            {traits.map(trait => (
              <TraitBar key={trait.key} trait={trait} />
            ))}
          </div>
        </Card>
      )}

      {/* Quick archetype description */}
      <Card padding="lg" className="animate-slide-up">
        <CardHeader>System</CardHeader>
        <div style={{
          fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
          lineHeight: 'var(--leading-relaxed)' }}>
          {getArchetypeDescription(coach.archetype)}
        </div>
      </Card>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

function CoachAvatar({ name, archetype }) {
  const initials = (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // Archetype indicator: a subtle geometric mark in the bottom-right corner
  const archetypeMarks = {
    'Offensive Minded': '▲',
    'Defensive Minded': '■',
    'Player Development': '◆',
    'Balanced': '●',
    'Tempo Pusher': '▶',
    'Three-Point Specialist': '△',
    'Post-Up Heavy': '▼',
    'Motion Offense': '◎',
  };
  const mark = archetypeMarks[archetype] || '●';

  return (
    <div style={{
      width: 80, height: 80, flexShrink: 0,
      background: 'var(--color-accent)', position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        fontSize: 28, fontWeight: 700, color: 'var(--color-text-inverse)',
        letterSpacing: '-0.02em', lineHeight: 1,
      }}>{initials}</div>
      <div style={{
        position: 'absolute', bottom: 4, right: 4,
        fontSize: 10, color: 'var(--color-text-inverse)', opacity: 0.6,
        lineHeight: 1,
      }}>{mark}</div>
    </div>
  );
}

function TraitBar({ trait }) {
  const pct = Math.min(100, Math.max(0, trait.value));
  const color = pct >= 80 ? 'var(--color-rating-elite)' :
                pct >= 60 ? 'var(--color-rating-good)' :
                pct >= 40 ? 'var(--color-rating-avg)' :
                            'var(--color-rating-below)';
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <span>{trait.icon}</span> {trait.name}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-semi)', color }}>
          {trait.value}
        </span>
      </div>
      <div style={{
        background: 'var(--color-bg-sunken)', height: 6, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color, transition: 'width 0.4s var(--ease-out)' }} />
      </div>
    </div>
  );
}

function ProgressBar({ value }) {
  const pct = Math.min(1, Math.max(0, value));
  const color = pct >= 0.7 ? 'var(--color-win)' : pct >= 0.4 ? 'var(--color-warning)' : 'var(--color-loss)';
  return (
    <div style={{
      background: 'var(--color-bg-sunken)', height: 6, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct * 100}%`, background: color, transition: 'width 0.4s var(--ease-out)' }} />
    </div>
  );
}

function getArchetypeDescription(archetype) {
  const descriptions = {
    'Offensive Minded': 'Prioritizes scoring, spacing, and pace. Teams under this system tend to run high-tempo offenses with an emphasis on three-point shooting and fast breaks.',
    'Defensive Minded': 'Focuses on defensive schemes, rim protection, and forcing turnovers. Expect slower-paced games with an emphasis on stops and half-court execution.',
    'Player Development': 'Excels at developing young talent and improving player ratings over time. Young prospects grow faster under this coaching style.',
    'Balanced': 'A well-rounded approach that adapts to roster strengths. No single area is heavily emphasized, providing consistent performance across all phases.',
    'Tempo Pusher': 'Runs an extremely fast-paced system. Teams play more possessions per game, favoring athletic lineups and transition offense.',
    'Three-Point Specialist': 'Designs systems around perimeter shooting. Expect a high volume of three-point attempts and floor spacing.',
    'Post-Up Heavy': 'Emphasizes interior scoring and traditional big men. The offense runs through the paint with strong rebounding.',
    'Motion Offense': 'Uses constant movement and passing to create open shots. Players need high basketball IQ to thrive in this system.' };
  return descriptions[archetype] || `Runs a ${archetype} system that shapes how the team plays on both ends of the floor.`;
}

function ratingColor(r) {
  if (r >= 85) return 'var(--color-rating-elite)';
  if (r >= 78) return 'var(--color-rating-good)';
  if (r >= 70) return 'var(--color-rating-avg)';
  if (r >= 60) return 'var(--color-rating-below)';
  return 'var(--color-rating-poor)';
}

function formatCurrency(amount) {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return '$' + Math.round(amount / 1000) + 'K';
  return '$' + amount;
}

function Loader({ text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: 'var(--color-text-tertiary)' }}>{text}</div>
  );
}
