// ═══════════════════════════════════════════════════════════════════
// The Association Project — Module Index
// ═══════════════════════════════════════════════════════════════════
//
// All engine modules are exported here so Vite includes them in the bundle.
// The React entry point imports from this file, ensuring all code is bundled.
//
// ═══════════════════════════════════════════════════════════════════

// ── Core Engines ──
export { PlayerAttributes } from './engines/PlayerAttributes.js';
export { CoachEngine } from './engines/CoachEngine.js';
export { GameState } from './engines/GameState.js';
export { FinanceEngine, METRO_POPULATIONS, getMetroPopulation, populationToMarketSize } from './engines/FinanceEngine.js';
export { GameEngine } from './engines/GameEngine.js';
export { GamePipeline } from './engines/GamePipeline.js';
export { CalendarEngine } from './engines/CalendarEngine.js';
export { EventBus, GameEvents, eventBus } from './engines/EventBus.js';
export { StorageEngine } from './engines/StorageEngine.js';
export { UIRenderer } from './engines/UIRenderer.js';
export { ChemistryEngine } from './engines/ChemistryEngine.js';
export { InjuryEngine } from './engines/InjuryEngine.js';
export { FatigueEngine } from './engines/FatigueEngine.js';
export { SalaryCapEngine } from './engines/SalaryCapEngine.js';
export { PlayerDevelopmentEngine } from './engines/PlayerDevelopmentEngine.js';
export { LeagueManager } from './engines/LeagueManager.js';
export { DivisionManager, CITY_TO_DIVISIONS } from './engines/DivisionManager.js';
export { StatEngine } from './engines/StatEngine.js';
export { TeamFactory } from './engines/TeamFactory.js';
export { DraftEngine } from './engines/DraftEngine.js';
export { TradeEngine } from './engines/TradeEngine.js';
export { FreeAgencyEngine } from './engines/FreeAgencyEngine.js';
export { PlayoffEngine } from './engines/PlayoffEngine.js';
export { GMMode } from './engines/GMMode.js';
export { ScoutingEngine } from './engines/ScoutingEngine.js';
export { OwnerEngine } from './engines/OwnerEngine.js';
export { UIHelpers } from './engines/UIHelpers.js';
export * as BasketballMath from './engines/BasketballMath.js';

// ── Controllers ──
// These orchestrate game flow and wire engines to UI
export { SimulationController } from './engines/SimulationController.js';
export { GameSimController } from './engines/GameSimController.js';
export { PlayoffSimController } from './engines/PlayoffSimController.js';
export { OffseasonController } from './engines/OffseasonController.js';
export { DashboardController } from './engines/DashboardController.js';
export { RosterController } from './engines/RosterController.js';
export { TradeController } from './engines/TradeController.js';
export { DraftController } from './engines/DraftController.js';
export { FreeAgencyController } from './engines/FreeAgencyController.js';
export { FinanceController } from './engines/FinanceController.js';
export { CoachManagementController } from './engines/CoachManagementController.js';
export { SaveLoadController } from './engines/SaveLoadController.js';
export { TrainingCampEngine } from './engines/TrainingCampEngine.js';
export { SettingsManager } from './engines/SettingsManager.js';
export { LoanEngine } from './engines/LoanEngine.js';
