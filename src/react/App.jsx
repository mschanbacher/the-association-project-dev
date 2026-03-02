import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './hooks/GameBridge.jsx';
import { TopBar } from './components/TopBar.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { DashboardScreen } from './screens/DashboardScreen.jsx';
import { StandingsScreen } from './screens/StandingsScreen.jsx';
import { ScheduleScreen } from './screens/ScheduleScreen.jsx';
import { RosterScreen } from './screens/RosterScreen.jsx';

function AppContent() {
  const { isReady, gameState } = useGame();
  const [activeScreen, setActiveScreen] = useState('dashboard');

  // When the React UI is active, hide the legacy game container.
  // When navigating to legacy screens (trades, etc.),
  // those open as modals on top of the existing DOM — so the React
  // dashboard stays visible underneath.
  useEffect(() => {
    if (isReady && gameState?.userTeam) {
      // Hide the direct children that make up the old dashboard
      // but keep the container visible for modal mounting
      const gc = document.getElementById('gameContainer');
      if (gc) {
        const infoBar = gc.querySelector('.info-bar');
        const controls = gc.querySelector('.controls');
        const legend = gc.querySelector('.legend');
        const contentGrid = gc.querySelector('.content-grid');
        const history = gc.querySelector('#seasonHistory');
        const h1 = gc.querySelector('h1');
        const subtitle = gc.querySelector('.subtitle');

        [infoBar, controls, legend, contentGrid, history, h1, subtitle].forEach(el => {
          if (el) el.style.display = 'none';
        });
      }
    }
  }, [isReady, gameState?.userTeam]);

  if (!isReady || !gameState?.userTeam) {
    // While the game is loading / in team selection, don't show React UI
    return null;
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'standings': return <StandingsScreen />;
      case 'schedule': return <ScheduleScreen />;
      case 'roster': return <RosterScreen />;
      case 'dashboard':
      default: return <DashboardScreen />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: 'var(--color-bg)',
    }}>
      <TopBar />
      <div style={{
        display: 'flex',
        flex: 1,
      }}>
        <Sidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />
        <main style={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
        }}>
          {renderScreen()}
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
