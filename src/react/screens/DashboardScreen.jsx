import React from 'react';
import { useGame } from '../hooks/GameBridge.jsx';
import {
  TeamSummaryWidget,
  NextGameWidget,
  StandingsWidget,
  RecentActivityWidget,
  RosterQuickWidget,
} from '../components/Widgets.jsx';

export function DashboardScreen() {
  const { gameState, isReady } = useGame();

  if (!isReady || !gameState?.userTeam) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: 'var(--color-text-tertiary)',
        fontSize: 'var(--text-md)',
      }}>
        Loading game state…
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 'var(--content-max)',
      margin: '0 auto',
      padding: 'var(--space-6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)',
    }}>
      {/* Top row: Team Summary + Next Game */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 'var(--space-5)',
      }}>
        <TeamSummaryWidget />
        <NextGameWidget />
      </div>

      {/* Middle row: Standings (wide) + Roster Quick */}
      <div className="stagger" style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 'var(--space-5)',
      }}>
        <StandingsWidget />
        <RosterQuickWidget />
      </div>

      {/* Bottom row: Recent Activity */}
      <div className="stagger" style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 'var(--space-5)',
      }}>
        <RecentActivityWidget />
      </div>
    </div>
  );
}
