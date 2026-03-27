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
import { PlayerBrowseModal } from './screens/PlayerBrowseModal.jsx';
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
import { OwnerModeModal } from './screens/OwnerModeModal.jsx';
import { FreeAgencyModal } from './screens/FreeAgencyModal.jsx';
import { CollegeGradFAModal } from './screens/CollegeGradFAModal.jsx';
import { BracketViewerModal } from './screens/BracketViewerModal.jsx';
import { LotteryModal } from './screens/LotteryModal.jsx';
import { UserDraftPickModal } from './screens/UserDraftPickModal.jsx';
import { WatchGameModal } from './screens/WatchGameModal.jsx';
import { BreakingNewsModal } from './screens/BreakingNewsModal.jsx';
import { DPEReplacementModal } from './screens/DPEReplacementModal.jsx';
import { InboundLoanRequestModal } from './screens/InboundLoanRequestModal.jsx';
import { PlayoffHub } from './screens/PlayoffHub.jsx';
import { PlayoffEndModal } from './screens/PlayoffEndModal.jsx';
import { OffseasonHub } from './screens/OffseasonHub.jsx';
import { GameLogScreen } from './screens/GameLogScreen.jsx';
import GlossaryScreen from './screens/GlossaryScreen.jsx';

function AppContent() {
  const { isReady, gameState, refresh } = useGame();
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [gameStarted, setGameStarted] = useState(false);

  // ── Modal state ──
  const [postGameData, setPostGameData] = useState(null);
  const [boxScoreData, setBoxScoreData] = useState(null);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradePartnerId, setTradePartnerId] = useState(null);
  const [browseMode, setBrowseMode] = useState(null); // 'freeAgents' | 'trade' | null
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
  const [ownerModeData, setOwnerModeData] = useState(null);
  const [faData, setFaData] = useState(null);
  const [cgData, setCgData] = useState(null);
  const [bracketData, setBracketData] = useState(null);
  const [lotteryData, setLotteryData] = useState(null);
  const [draftPickData, setDraftPickData] = useState(null);
  const [watchGameData, setWatchGameData] = useState(null);
  const [breakingNewsData, setBreakingNewsData] = useState(null);
  const [dpeReplacementData, setDpeReplacementData] = useState(null);
  const [inboundLoanData, setInboundLoanData] = useState(null);
  const [playoffHubData, setPlayoffHubData] = useState(null);
  const [playoffEndData, setPlayoffEndData] = useState(null);
  const [offseasonHubData, setOffseasonHubData] = useState(null);

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
    window._reactOpenTrade = () => { setTradePartnerId(null); setTradeOpen(true); };
    window._reactOpenTradeWith = (teamId) => { setTradePartnerId(teamId ?? null); setTradeOpen(true); };
    window._reactOpenFreeAgentBrowse = () => setBrowseMode('freeAgents');
    window._reactOpenTradeBrowse = () => setBrowseMode('trade');
    window._reactCloseTrade = () => setTradeOpen(false);
    window._reactOpenAiTrade = () => setAiTradeOpen(true);
    window._reactCloseAiTrade = () => setAiTradeOpen(false);
    window._reactOpenGameMenu = () => setGameMenuOpen(true);
    window._reactCloseGameMenu = () => setGameMenuOpen(false);
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
    window._reactShowOwnerMode = (data) => setOwnerModeData(data);
    window._reactCloseOwnerMode = () => setOwnerModeData(null);
    window._reactShowFA = (data) => setFaData({...data});
    window._reactCloseFA = () => setFaData(null);
    window._reactShowCG = (data) => setCgData({...data});
    window._reactCloseCG = () => setCgData(null);
    window._reactShowBracket = (data) => setBracketData({...data});
    window._reactCloseBracket = () => setBracketData(null);
    window._reactShowLottery = (data) => setLotteryData({...data});
    window._reactCloseLottery = () => setLotteryData(null);
    window._reactShowDraftPick = (data) => setDraftPickData({...data});
    window._reactCloseDraftPick = () => setDraftPickData(null);
    window._reactShowWatchGame = (data) => setWatchGameData({...data});
    window._reactCloseWatchGame = () => setWatchGameData(null);
    window._reactNavigate = (screen) => setActiveScreen(screen);
    window._reactShowBreakingNews = (data, resolve) => { setBreakingNewsData({ ...data, _resolve: resolve }); };
    window._reactShowDPEReplacement = (data) => setDpeReplacementData({ ...data });
    window._reactCloseDPEReplacement = () => setDpeReplacementData(null);
    window._reactShowInboundLoan = (data) => setInboundLoanData({ ...data });
    window._reactCloseInboundLoan = () => setInboundLoanData(null);

    // Playoff Hub
    window._reactShowPlayoffHub = (data) => {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🎯 [DIAG-REACT] _reactShowPlayoffHub CALLED');
      console.log('🎯 [DIAG-REACT] data received:', data);
      console.log('🎯 [DIAG-REACT] data.action:', data?.action);
      console.log('🎯 [DIAG-REACT] data.userTier:', data?.userTier);
      console.log('🎯 [DIAG-REACT] data.userTeamId:', data?.userTeamId);
      console.log('🎯 [DIAG-REACT] Setting playoffHubData state...');
      console.log('═══════════════════════════════════════════════════════════');
      setPlayoffHubData({ ...data });
    };
    window._reactClosePlayoffHub = () => setPlayoffHubData(null);
    window._reactShowPlayoffEnd = (data) => setPlayoffEndData({ ...data });
    window._reactClosePlayoffEnd = () => setPlayoffEndData(null);

    // Offseason Hub
    window._reactShowOffseasonHub = (data) => {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🌴 [OFFSEASON-HUB] _reactShowOffseasonHub CALLED');
      console.log('🌴 [OFFSEASON-HUB] data received:', data);
      console.log('═══════════════════════════════════════════════════════════');
      setOffseasonHubData({ ...data });
    };
    window._reactCloseOffseasonHub = () => setOffseasonHubData(null);

    // Bridge to access GameSimController from React components
    window._getGameSimController = () => {
      const bridge = window._gameBridge;
      return bridge?.helpers?.getGameSimController?.() || null;
    };

    return () => {
      window.removeEventListener('reactShowPostGame', handlePostGame);
      window.removeEventListener('reactShowBoxScore', handleBoxScore);
      delete window._reactShowPostGame;
      delete window._reactShowBoxScore;
      delete window._reactOpenTrade;
      delete window._reactOpenTradeWith;
      delete window._reactOpenFreeAgentBrowse;
      delete window._reactOpenTradeBrowse;
      delete window._reactCloseTrade;
      delete window._reactOpenAiTrade;
      delete window._reactCloseAiTrade;
      delete window._reactOpenGameMenu;
      delete window._reactCloseGameMenu;
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
      delete window._reactShowOwnerMode;
      delete window._reactCloseOwnerMode;
      delete window._reactShowFA;
      delete window._reactCloseFA;
      delete window._reactShowCG;
      delete window._reactCloseCG;
      delete window._reactShowBracket;
      delete window._reactCloseBracket;
      delete window._reactShowLottery;
      delete window._reactCloseLottery;
      delete window._reactShowDraftPick;
      delete window._reactCloseDraftPick;
      delete window._reactShowWatchGame;
      delete window._reactCloseWatchGame;
      delete window._reactNavigate;
      delete window._reactShowBreakingNews;
      delete window._reactShowPlayoffHub;
      delete window._reactClosePlayoffHub;
      delete window._reactShowPlayoffEnd;
      delete window._reactClosePlayoffEnd;
      delete window._reactShowOffseasonHub;
      delete window._reactCloseOffseasonHub;
      delete window._getGameSimController;
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
    gamelog:    <GameLogScreen />,
    roster:     <RosterScreen />,
    finances:   <FinancesScreen />,
    history:    <HistoryScreen />,
    coach:      <CoachScreen />,
    scouting:   <ScoutingScreen />,
    glossary:   <GlossaryScreen />,
  };

  // Diagnostic logging for PlayoffHub render decision
  console.log('🔄 [DIAG-RENDER] App render - playoffHubData:', playoffHubData ? 'SET' : 'NULL');
  console.log('🔄 [DIAG-RENDER] App render - offseasonHubData:', offseasonHubData ? 'SET' : 'NULL');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: 'var(--color-bg)',
    }}>
      <TopBar />
      {/* Only show OffseasonTracker when NOT in OffseasonHub (it has its own phase tracker) */}
      {!offseasonHubData && <OffseasonTracker />}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Playoff Hub replaces sidebar + main during postseason */}
        {playoffHubData ? (
          <>
            {console.log('🎯 [DIAG-RENDER] RENDERING PlayoffHub component')}
            <PlayoffHub
              data={playoffHubData}
              onClose={() => {
                setPlayoffHubData(null);
                playoffHubData?.onComplete?.();
              }}
            />
          </>
        ) : offseasonHubData ? (
          <>
            {console.log('🌴 [DIAG-RENDER] RENDERING OffseasonHub component')}
            <OffseasonHub
              data={offseasonHubData}
              onClose={() => {
                setOffseasonHubData(null);
                offseasonHubData?.onComplete?.();
              }}
            />
          </>
        ) : (
          <>
            <Sidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />
            <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
              {screens[activeScreen] || screens.dashboard}
            </main>
          </>
        )}
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
        initialPartnerId={tradePartnerId}
        onClose={() => { setTradeOpen(false); setTradePartnerId(null); refresh?.(); }}
      />
      <PlayerBrowseModal
        isOpen={browseMode !== null}
        mode={browseMode || 'freeAgents'}
        onClose={() => setBrowseMode(null)}
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
      <DPEReplacementModal
        isOpen={!!dpeReplacementData}
        data={dpeReplacementData}
        onComplete={(action, details) => {
          setDpeReplacementData(null);
          window._dpeReplacementCallback?.(action, details);
        }}
      />
      <InboundLoanRequestModal
        isOpen={!!inboundLoanData}
        data={inboundLoanData}
        onRespond={(response) => {
          setInboundLoanData(null);
          window._inboundLoanCallback?.(response);
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
      {/* Owner Mode Modal (offseason financial decisions) */}
      {ownerModeData && (
        <OwnerModeModal data={ownerModeData} onClose={() => setOwnerModeData(null)} />
      )}

      <FinanceDashboardModal
        isOpen={!!financeDashData}
        data={financeDashData}
        onClose={() => setFinanceDashData(null)}
      />
      <FreeAgencyModal
        isOpen={!!faData}
        data={faData}
        onClose={() => setFaData(null)}
      />
      <CollegeGradFAModal
        isOpen={!!cgData}
        data={cgData}
        onClose={() => setCgData(null)}
      />
      <BracketViewerModal
        isOpen={!!bracketData}
        data={bracketData}
        onClose={() => setBracketData(null)}
      />
      <LotteryModal
        isOpen={!!lotteryData}
        data={lotteryData}
        onClose={() => setLotteryData(null)}
      />
      <UserDraftPickModal
        isOpen={!!draftPickData}
        data={draftPickData}
        onClose={() => setDraftPickData(null)}
      />
      <WatchGameModal
        isOpen={!!watchGameData}
        data={watchGameData}
        onClose={() => setWatchGameData(null)}
      />
      <BreakingNewsModal
        isOpen={!!breakingNewsData}
        data={breakingNewsData}
        onClose={() => {
          const resolve = breakingNewsData?._resolve;
          setBreakingNewsData(null);
          if (resolve) resolve();
        }}
      />
      <PlayoffEndModal
        isOpen={!!playoffEndData}
        data={playoffEndData}
        onBeginOffseason={() => {
          setPlayoffEndData(null);
          window._playoffEndContinueCallback?.();
        }}
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
