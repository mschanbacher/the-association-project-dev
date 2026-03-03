import React, { useState, useEffect, useCallback } from 'react';
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
import { PostGameModal } from './screens/PostGameModal.jsx';
import { BoxScoreModal } from './screens/BoxScoreModal.jsx';
import { NewGameFlow } from './screens/NewGameFlow.jsx';
import { TradeScreen, AiTradeProposalModal } from './screens/TradeScreen.jsx';
import { GameMenuModal } from './screens/GameMenuModal.jsx';
import { OffseasonTracker } from './screens/OffseasonTracker.jsx';
import { OffseasonModals } from './screens/OffseasonModals.jsx';
import { InjuryModal } from './screens/InjuryModal.jsx';
import { DevelopmentModal } from './screens/DevelopmentModal.jsx';
import { ComplianceModal } from './screens/ComplianceModal.jsx';
import { FinancialTransitionModal } from './screens/FinancialTransitionModal.jsx';
import { AllStarModal } from './screens/AllStarModal.jsx';
import { ContractDecisionsModal } from './screens/ContractDecisionsModal.jsx';
import { SeasonEndModal } from './screens/SeasonEndModal.jsx';
import { DraftResultsModal } from './screens/DraftResultsModal.jsx';
import { CalendarModal } from './screens/CalendarModal.jsx';
import { CoachModal } from './screens/CoachModal.jsx';
import { RosterModal } from './screens/RosterModal.jsx';
import { FinanceDashboardModal } from './screens/FinanceDashboardModal.jsx';

function AppContent() {
  const { isReady, gameState, refresh } = useGame();
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [gameStarted, setGameStarted] = useState(false);

  // ── Modal state ──
  const [postGameData, setPostGameData] = useState(null);
  const [boxScoreData, setBoxScoreData] = useState(null);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [aiTradeOpen, setAiTradeOpen] = useState(false);
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [injuryData, setInjuryData] = useState(null);
  const [developmentData, setDevelopmentData] = useState(null);
  const [complianceData, setComplianceData] = useState(null);
  const [financialTransitionData, setFinancialTransitionData] = useState(null);
  const [allStarData, setAllStarData] = useState(null);
  const [contractDecisionsData, setContractDecisionsData] = useState(null);
  const [seasonEndData, setSeasonEndData] = useState(null);
  const [draftResultsData, setDraftResultsData] = useState(null);
  const [calendarData, setCalendarData] = useState(null);
  const [coachData, setCoachData] = useState(null);
  const [rosterData, setRosterData] = useState(null);
  const [financeDashData, setFinanceDashData] = useState(null);

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

  // ── Listen for modal events from legacy code ──
  useEffect(() => {
    const handlePostGame = (e) => {
      setPostGameData(e.detail);
    };
    const handleBoxScore = (e) => {
      setBoxScoreData(e.detail);
    };

    window.addEventListener('reactShowPostGame', handlePostGame);
    window.addEventListener('reactShowBoxScore', handleBoxScore);

    // Expose imperative openers so legacy code can call them directly
    window._reactShowPostGame = (data) => setPostGameData(data);
    window._reactShowBoxScore = (data) => setBoxScoreData(data);
    window._reactOpenTrade = () => setTradeOpen(true);
    window._reactOpenAiTrade = () => setAiTradeOpen(true);
    window._reactOpenGameMenu = () => setGameMenuOpen(true);
    window._reactShowInjury = (data) => setInjuryData(data);
    window._reactHideInjury = () => setInjuryData(null);
    window._reactShowDevelopment = (data) => setDevelopmentData(data);
    window._reactShowCompliance = (data) => setComplianceData(data);
    window._reactShowFinancialTransition = (data) => setFinancialTransitionData(data);
    window._reactShowAllStar = (data) => setAllStarData(data);
    window._reactShowContractDecisions = (data) => setContractDecisionsData(data);
    window._reactShowSeasonEnd = (data) => setSeasonEndData(data);
    window._reactShowDraftResults = (data) => setDraftResultsData(data);
    window._reactShowCalendar = (data) => setCalendarData(data);
    window._reactShowCoach = (data) => setCoachData(data);
    window._reactShowRoster = (data) => setRosterData(data);
    window._reactShowFinanceDashboard = (data) => setFinanceDashData(data);

    return () => {
      window.removeEventListener('reactShowPostGame', handlePostGame);
      window.removeEventListener('reactShowBoxScore', handleBoxScore);
      delete window._reactShowPostGame;
      delete window._reactShowBoxScore;
      delete window._reactOpenTrade;
      delete window._reactOpenAiTrade;
      delete window._reactOpenGameMenu;
      delete window._reactShowInjury;
      delete window._reactHideInjury;
      delete window._reactShowDevelopment;
      delete window._reactShowCompliance;
      delete window._reactShowFinancialTransition;
      delete window._reactShowAllStar;
      delete window._reactShowContractDecisions;
      delete window._reactShowSeasonEnd;
      delete window._reactShowDraftResults;
      delete window._reactShowCalendar;
      delete window._reactShowCoach;
      delete window._reactShowRoster;
      delete window._reactShowFinanceDashboard;
    };
  }, []);

  // ── Box score opener from post-game ──
  const handlePostGameBoxScore = useCallback(() => {
    if (!postGameData) return;
    const d = postGameData;
    setBoxScoreData({
      home: d.isHome ? d.userTeam : d.opponent,
      away: d.isHome ? d.opponent : d.userTeam,
      date: d.date,
      hasDetailedStats: true,
      quarterScores: d.quarterScores || null,
    });
  }, [postGameData]);

  // ── New game flow: show when engines loaded but no team selected ──
  const hasTeam = gameState?.userTeam || gameStarted;
  const enginesLoaded = isReady && gameState?._raw?.tier1Teams;

  // Hide legacy team selection modal when React takes over
  useEffect(() => {
    if (enginesLoaded) {
      const legacyModal = document.getElementById('teamSelectionModal');
      if (legacyModal) legacyModal.classList.add('hidden');
    }
  }, [enginesLoaded]);

  if (!isReady) return null;

  // Show new game flow if engines are ready but no team picked yet
  if (enginesLoaded && !hasTeam) {
    return (
      <NewGameFlow
        gameState={gameState}
        onComplete={() => {
          setGameStarted(true);
          refresh?.();
        }}
      />
    );
  }

  // Still loading or waiting for team
  if (!hasTeam) return null;

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
      <OffseasonTracker />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />
        <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {screens[activeScreen] || screens.dashboard}
        </main>
      </div>

      {/* ── Modals ── */}
      <PostGameModal
        isOpen={!!postGameData}
        data={postGameData}
        onClose={() => setPostGameData(null)}
        onViewBoxScore={handlePostGameBoxScore}
      />
      <BoxScoreModal
        isOpen={!!boxScoreData}
        data={boxScoreData}
        onClose={() => setBoxScoreData(null)}
      />
      <TradeScreen
        isOpen={tradeOpen}
        onClose={() => { setTradeOpen(false); refresh?.(); }}
      />
      <AiTradeProposalModal
        isOpen={aiTradeOpen}
        onClose={() => { setAiTradeOpen(false); refresh?.(); }}
      />
      <GameMenuModal
        isOpen={gameMenuOpen}
        onClose={() => setGameMenuOpen(false)}
      />
      <OffseasonModals />
      <InjuryModal
        isOpen={!!injuryData}
        data={injuryData}
        onDecision={(decision) => {
          setInjuryData(null);
          window._injuryDecisionCallback?.(decision);
        }}
      />
      <DevelopmentModal
        isOpen={!!developmentData}
        data={developmentData}
        onContinue={() => {
          setDevelopmentData(null);
          window._developmentContinueCallback?.();
        }}
      />
      <ComplianceModal
        isOpen={!!complianceData}
        data={complianceData}
        onManageRoster={() => {
          setComplianceData(null);
          window._complianceManageRosterCallback?.();
        }}
        onRecheck={() => {
          setComplianceData(null);
          window._complianceRecheckCallback?.();
        }}
      />
      <FinancialTransitionModal
        isOpen={!!financialTransitionData}
        data={financialTransitionData}
        onContinue={() => {
          setFinancialTransitionData(null);
          window._financialTransitionContinueCallback?.();
        }}
        onSpendingChange={(pct) => {
          window._financialTransitionSpendingCallback?.(pct);
        }}
      />
      <AllStarModal
        isOpen={!!allStarData}
        data={allStarData}
        onContinue={() => {
          setAllStarData(null);
          window._allStarContinueCallback?.();
        }}
      />
      <ContractDecisionsModal
        isOpen={!!contractDecisionsData}
        data={contractDecisionsData}
        onConfirm={(decisions) => {
          setContractDecisionsData(null);
          window._contractDecisionsConfirmCallback?.(decisions);
        }}
      />
      <SeasonEndModal
        isOpen={!!seasonEndData}
        data={seasonEndData}
        onAdvance={(action) => {
          setSeasonEndData(null);
          window._seasonEndAdvanceCallback?.(action);
        }}
        onManageRoster={() => {
          setSeasonEndData(null);
          window._seasonEndManageRosterCallback?.();
        }}
        onStay={() => {
          setSeasonEndData(null);
          window._seasonEndStayCallback?.();
        }}
      />
      <DraftResultsModal
        isOpen={!!draftResultsData}
        data={draftResultsData}
        onContinue={() => {
          setDraftResultsData(null);
          window._draftResultsContinueCallback?.();
        }}
      />
      <CalendarModal
        isOpen={!!calendarData}
        data={calendarData}
        onClose={() => setCalendarData(null)}
      />
      <CoachModal
        isOpen={!!coachData}
        data={coachData}
        onClose={() => setCoachData(null)}
      />
      <RosterModal
        isOpen={!!rosterData}
        data={rosterData}
        onClose={() => {
          setRosterData(null);
          window._rosterCloseCallback?.();
        }}
      />
      <FinanceDashboardModal
        isOpen={!!financeDashData}
        data={financeDashData}
        onClose={() => setFinanceDashData(null)}
      />
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
