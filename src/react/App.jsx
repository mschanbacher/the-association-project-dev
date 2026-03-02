import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './hooks/GameBridge.jsx';
import { TopBar } from './components/TopBar.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { DashboardScreen } from './screens/DashboardScreen.jsx';
import { StandingsScreen } from './screens/StandingsScreen.jsx';
import { ScheduleScreen } from './screens/ScheduleScreen.jsx';
import { RosterScreen } from './screens/RosterScreen.jsx';
import { FinancesScreen } from './screens/FinancesScreen.jsx';
import { HistoryScreen } from './screens/HistoryScreen.jsx';
import { CoachScreen } from './screens/CoachScreen.jsx';
import { ScoutingScreen } from './screens/ScoutingScreen.jsx';

function AppContent() {
  const { isReady, gameState } = useGame();
  const [activeScreen, setActiveScreen] = useState('dashboard');

  // Hide the legacy game container elements once React takes over
  useEffect(() => {
    if (isReady && gameState?.userTeam) {
      const gc = document.getElementById('gameContainer');
      if (gc) {
        const selectors = ['.info-bar', '.controls', '.legend', '.content-grid', '#seasonHistory', 'h1', '.subtitle'];
        selectors.forEach(sel => {
          const el = gc.querySelector(sel);
          if (el) el.style.display = 'none';
        });
      }
    }
  }, [isReady, gameState?.userTeam]);

  if (!isReady || !gameState?.userTeam) return null;

  const screens = {
    dashboard:  <DashboardScreen />,
    standings:  <StandingsScreen />,
    schedule:   <ScheduleScreen />,
    roster:     <RosterScreen />,
    finances:   <FinancesScreen />,
    history:    <HistoryScreen />,
    coach:      <CoachScreen />,
    scouting:   <ScoutingScreen />,
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: 'var(--color-bg)',
    }}>
      <TopBar />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />
        <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {screens[activeScreen] || screens.dashboard}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}
