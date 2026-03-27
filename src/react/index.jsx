import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/design-system.css';

// ═══════════════════════════════════════════════════════════════════
// Import ALL modules from main.js and expose on window
// This ensures Vite bundles them and _initGame can access them
// ═══════════════════════════════════════════════════════════════════
import {
  PlayerAttributes,
  CoachEngine,
  GameState,
  FinanceEngine, METRO_POPULATIONS, getMetroPopulation, populationToMarketSize,
  GameEngine,
  GamePipeline,
  CalendarEngine,
  EventBus, GameEvents, eventBus,
  StorageEngine,
  UIRenderer,
  ChemistryEngine,
  InjuryEngine,
  FatigueEngine,
  SalaryCapEngine,
  PlayerDevelopmentEngine,
  LeagueManager,
  DivisionManager, CITY_TO_DIVISIONS,
  StatEngine,
  TeamFactory,
  DraftEngine,
  TradeEngine,
  FreeAgencyEngine,
  PlayoffEngine,
  GMMode,
  ScoutingEngine,
  OwnerEngine,
  UIHelpers,
  BasketballMath,
  // Controllers
  SimulationController,
  GameSimController,
  PlayoffSimController,
  OffseasonController,
  DashboardController,
  RosterController,
  TradeController,
  DraftController,
  FreeAgencyController,
  FinanceController,
  CoachManagementController,
  SaveLoadController,
  TrainingCampEngine,
} from '../main.js';
import { SettingsManager } from '../engines/SettingsManager.js';
import { LoanEngine } from '../engines/LoanEngine.js';

// Expose all modules on window for _initGame to access
Object.assign(window, {
  PlayerAttributes,
  CoachEngine,
  GameState,
  FinanceEngine, METRO_POPULATIONS, getMetroPopulation, populationToMarketSize,
  GameEngine,
  GamePipeline,
  CalendarEngine,
  EventBus, GameEvents, eventBus,
  StorageEngine,
  UIRenderer,
  ChemistryEngine,
  InjuryEngine,
  FatigueEngine,
  SalaryCapEngine,
  PlayerDevelopmentEngine,
  LeagueManager,
  DivisionManager,
  _CTD: CITY_TO_DIVISIONS,
  getFatiguePenalty: (fatigue) => FatigueEngine.getPenalty(fatigue),
  StatEngine,
  TeamFactory,
  DraftEngine,
  TradeEngine,
  FreeAgencyEngine,
  PlayoffEngine,
  GMMode,
  ScoutingEngine,
  OwnerEngine,
  UIHelpers,
  BasketballMath,
  // Controllers
  SimulationController,
  GameSimController,
  PlayoffSimController,
  OffseasonController,
  DashboardController,
  RosterController,
  TradeController,
  DraftController,
  FreeAgencyController,
  FinanceController,
  CoachManagementController,
  SaveLoadController,
  TrainingCampEngine,
  LoanEngine,
});

console.log('🏀 Modules loaded via Vite bundle');

/**
 * Mount the React app into #react-root.
 * Called after the existing game code has initialized.
 */
export function mountReactApp() {
  let root = document.getElementById('react-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'react-root';
    document.body.prepend(root);
  }
  
  const reactRoot = createRoot(root);
  reactRoot.render(<App />);
  
  console.log('⚛️ React UI mounted');
  return reactRoot;
}

// Initialize: load storage + settings, then mount React, then init game
SettingsManager.init();
StorageEngine.init().then(() => {
  mountReactApp();
  if (typeof window._initGame === 'function') {
    window._initGame();
  }
});
