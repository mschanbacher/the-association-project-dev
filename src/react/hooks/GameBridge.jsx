// ═══════════════════════════════════════════════════════════════
// GameBridge — Connects React components to game engine instances
// ═══════════════════════════════════════════════════════════════
// The existing game puts all engines on `window` and manages a
// `gameState` instance inside `_initGame`. This bridge provides
// React-friendly access via context and hooks.
//
// IMPORTANT: Engines are pure logic classes — React only reads
// from them, never mutates game state directly. All mutations
// go through the existing controller layer.
// ═══════════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { applyTeamColors } from '../styles/TeamColors.js';

// ── Context ──
const GameContext = createContext(null);

/**
 * Hook to access game state and engines from any React component.
 * Returns { gameState, engines, refresh, isReady }
 */
export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within <GameProvider>');
  return ctx;
}

/**
 * Snapshot the current gameState into a plain object for React rendering.
 * This avoids React depending on mutable class instances.
 */
function snapshotGameState() {
  const gs = window._reactGameState;
  if (!gs) return null;

  const tier = gs.currentTier || 1;
  const teams = tier === 1 ? gs.tier1Teams :
                tier === 2 ? gs.tier2Teams : gs.tier3Teams;
  const userTeam = teams?.find(t => t.id === gs.userTeamId) || null;
  const numGames = tier === 1 ? 82 : tier === 2 ? 60 : 40;

  return {
    // Core identifiers
    userTeamId: gs.userTeamId,
    currentTier: tier,
    currentSeason: gs.currentSeason,
    currentDate: gs.currentDate,
    seasonDates: gs.seasonDates,

    // Team data
    userTeam,
    tier1Teams: gs.tier1Teams || [],
    tier2Teams: gs.tier2Teams || [],
    tier3Teams: gs.tier3Teams || [],

    // Schedule / Standings
    schedule: gs.schedule || [],
    playoffData: gs.playoffData,
    playoffSchedule: gs.playoffSchedule,

    // Season progress
    gamesPlayed: userTeam ? (userTeam.wins + userTeam.losses) : 0,
    totalGames: numGames,
    isSeasonComplete: gs.isSeasonComplete?.() || false,
    offseasonPhase: gs.offseasonPhase,

    // Trade / News data
    tradeHistory: gs.tradeHistory || [],
    recentNews: gs.recentNews || [],

    // Feature data
    freeAgents: gs.freeAgents || [],
    draftProspects: gs.draftProspects || [],

    // Raw ref for engines that need the actual object
    _raw: gs,
  };
}

/**
 * Get engine references from window (set by the module script).
 */
function getEngines() {
  return {
    CalendarEngine:   window.CalendarEngine,
    LeagueManager:    window.LeagueManager,
    SalaryCapEngine:  window.SalaryCapEngine,
    FinanceEngine:    window.FinanceEngine,
    CoachEngine:      window.CoachEngine,
    UIRenderer:       window.UIRenderer,
    UIHelpers:        window.UIHelpers,
    PlayerAttributes: window.PlayerAttributes,
    ChemistryEngine:  window.ChemistryEngine,
    InjuryEngine:     window.InjuryEngine,
    FatigueEngine:    window.FatigueEngine,
    StatEngine:       window.StatEngine,
    TradeEngine:      window.TradeEngine,
    PlayoffEngine:    window.PlayoffEngine,
    DivisionManager:  window.DivisionManager,
    StorageEngine:    window.StorageEngine,
    EventBus:         window.EventBus,
    GameEvents:       window.GameEvents,
    eventBus:         window.eventBus,
    ScoutingEngine:   window.ScoutingEngine,
    TeamFactory:      window.TeamFactory,
    GamePipeline:     window.GamePipeline,
    OwnerEngine:      window.OwnerEngine,
    LoanEngine:       window.LoanEngine,
  };
}

/**
 * GameProvider wraps the React app and provides game state + engines.
 * It listens for a custom event 'gameStateChanged' that the existing
 * game code dispatches after any mutation.
 */
export function GameProvider({ children }) {
  const [snapshot, setSnapshot] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const enginesRef = useRef(null);

  const refresh = useCallback(() => {
    const snap = snapshotGameState();
    if (snap) {
      setSnapshot(snap);
      if (!isReady) setIsReady(true);
      // Apply team identity colors to CSS custom properties
      if (snap.userTeam?.name) {
        applyTeamColors(snap.userTeam.name);
      }
    }
  }, [isReady]);

  useEffect(() => {
    enginesRef.current = getEngines();

    // Listen for game state changes dispatched by existing code
    const handler = () => refresh();
    window.addEventListener('gameStateChanged', handler);

    // Also poll briefly on mount in case the game already loaded
    const poll = setInterval(() => {
      if (window._reactGameState) {
        refresh();
        clearInterval(poll);
      }
    }, 100);

    return () => {
      window.removeEventListener('gameStateChanged', handler);
      clearInterval(poll);
    };
  }, [refresh]);

  const value = {
    gameState: snapshot,
    engines: enginesRef.current || getEngines(),
    refresh,
    isReady,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

/**
 * Helper: Dispatch gameStateChanged from existing code.
 * Call this from any controller after mutating gameState.
 */
export function notifyReact() {
  window.dispatchEvent(new CustomEvent('gameStateChanged'));
}

// Expose globally so existing non-React code can call it
window._notifyReact = notifyReact;
