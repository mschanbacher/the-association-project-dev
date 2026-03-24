# Engine Bloat Analysis

Last updated: 2026-03-24

## Summary

Total engine code: **25,918 lines** across 30 files.
Pure dead code: **~424 lines** (~1.6%) — modest but worth cleaning.
Structural bloat: **~1,400 lines** in GameSimController from parallel playoff systems — the real problem.

## File Size Ranking

| File | Lines | Concern Level |
|------|------:|:-------------:|
| GameSimController.js | 4,308 | HIGH |
| OffseasonController.js | 2,223 | OK |
| GMMode.js | 1,314 | MEDIUM |
| PlayoffEngine.js | 1,298 | OK |
| GameState.js | 1,084 | MEDIUM |
| CalendarEngine.js | 1,060 | OK |
| GamePipeline.js | 989 | OK |
| TrainingCampEngine.js | 926 | OK |
| FinanceEngine.js | 915 | OK |
| TeamFactory.js | 801 | OK |

Everything under 800 lines is proportional to its responsibility.


## HIGH: GameSimController.js (4,308 lines)

### The Problem

Two generations of playoff code coexist:

| Section | Lines | Era | Status |
|---------|------:|-----|--------|
| Watch Next Game | 474 | Original | Active — regular season sim |
| Bracket Viewer | 138 | Original | Active |
| Playoff Series Watch | 424 | Modal-era | Active — `_showPlayoffSeriesStatus`, `watchPlayoffGame` (v1), `simOnePlayoffGame`, `simRestOfPlayoffSeries` |
| Season End | 185 | Original | Active |
| Promo/Rel Playoffs | 139 | Original | Active — `startPlayoffs` is dead, but `showPlayoffResults` still called |
| T1 Championship | 554 | Hub-era | Active — `initBracketForHub`, `simAllChampionshipRounds` |
| T2 Division + National | 403 | Hub-era | Active |
| T3 Metro + National | 486 | Hub-era | Active |
| Calendar-Based Playoff Sim | 1,435 | PlayoffHub-era | Active — `simPlayoffDay`, `simPlayoffRound`, `simToChampionship`, bracket population helpers |
| Win Probability Helpers | 48 | Utility | Active |

**PlayoffHub calls both systems**: it uses the calendar-based methods (`simPlayoffDay`, `simPlayoffRound`, `simToChampionship`) for sim controls, and the modal-era methods (`simOnePlayoffGame`, `simRestOfPlayoffSeries`, `watchPlayoffGame` v1) for game-level actions. Both are wired through `window.*` globals.

There are two `watchPlayoffGame()` methods (lines 720 and 3177). The first is the active one wired to `window.watchPlayoffGame`; the second is inside the calendar-based block and appears to be an unreferenced duplicate.

### Dead Methods (6)

- `startPlayoffs` — superseded by `initBracketForHub`
- `viewPromRelPlayoffResults` — no external refs
- `simulateOtherTier` — no external refs
- `simulateOtherTiersToCompletion` — no external refs
- `_getCurrentPlayoffRound` — only called internally by dead code
- `_isRoundComplete` — only called internally by dead code

### Recommendation

**Phase 1 (safe, do now)**: Remove the 6 dead methods (~144 lines). Remove the duplicate `watchPlayoffGame` at line 3177 if confirmed unused.

**Phase 2 (PlayoffSimController extraction)**: Extract the calendar-based playoff sim block (lines 2782–4100) into `PlayoffSimController.js`. This is the natural split point — these methods all share context (`playoffSchedule`, bracket population, round tracking) and are only called from PlayoffHub. The modal-era methods (635–1058) stay in GameSimController since they handle the watch/sim UX. PlayoffHub.jsx is stable and does NOT need a rebuild — only game-init.js wiring changes. Full plan in `docs/PHASE2-PLAN.md`.


## MEDIUM: GMMode.js (1,314 lines)

### Dead Methods (9 truly dead, ~225 lines, ~17%)

| Method | Lines | Notes |
|--------|------:|-------|
| `setupObservers` | ~18 | Legacy event wiring, never called |
| `bindEventHandlers` | ~38 | Legacy DOM event binding |
| `_generateUserTradeProposal` | ~8 | Superseded by TradeController |
| `simulateOtherTiersProportionally` | ~37 | Superseded; `_simulateAllGamesOnDate` handles this now |
| `updateInfoBar` | ~30 | Legacy DOM update, React handles this |
| `updateStandings` | ~29 | Legacy DOM update, React handles this |
| `updateControls` | ~23 | Legacy DOM update, React handles this |
| `saveGame` | ~25 | Legacy save UI, superseded by SaveLoadController |
| `loadGame` | ~17 | Legacy load UI, superseded by SaveLoadController |

### Recommendation

Safe to remove all 9 methods. The internal-only methods (`_resumeSimWeek`, `_showDayMessage`, `finishSeasonBatch`, `processAiToAiTrades`, `showBreakingNews`) are alive via internal call chains from `simulateDay`/`simulateWeek`/`finishSeason`.

After cleanup, GMMode drops to ~1,089 lines. Consider a future rename to `SeasonSimController` since it's really the regular-season simulation orchestrator, not a generic "GM Mode."


## MEDIUM: GameState.js (1,084 lines)

### Dead Methods (11, ~149 lines, ~14%)

| Method | Notes |
|--------|-------|
| `advanceSeason` | Season advancement handled by OffseasonController |
| `debug` | Debug utility, never called |
| `getNextGame` | Superseded by schedule-based lookups |
| `getRemainingGames` | Superseded |
| `getSummary` | Debug utility |
| `markGamePlayed` | Game pipeline handles this directly |
| `promoteTeam` | LeagueManager handles promotion |
| `recordChampionship` | Handled by OffseasonController |
| `recordSeasonInHistory` | Handled by OffseasonController |
| `relegateTeam` | LeagueManager handles relegation |
| `validate` | Validation utility, never called |

### Recommendation

Safe to remove. These are all pre-controller-era convenience methods that were superseded when the controller layer was added. GameState should be a pure data container + serialization, which it mostly is now.


## LOW: Other Files

### OffseasonController.js (2,223 lines)
Two dead methods (~83 lines): `showContractDecisionsModal` (old flow), `showDevelopmentAndFreeAgency` (old flow). Safe to remove. Otherwise well-structured.

### EventBus.js (327 lines)
5 dead utility methods (~35 lines): `debugHistory`, `debugListeners`, `offAll`, `pause`, `resume`. Could keep for debugging or remove.

### CalendarEngine.js (1,060 lines)
2 dead methods (~10 lines): `getDayOfWeek`, `isRegularSeasonComplete`. Trivial removal.

### Other dead methods (one each)
- `ChemistryEngine.getBonus`, `ChemistryEngine.updateAfterGame` — superseded
- `CoachEngine.deserializeCoach` — unused
- `FatigueEngine.accumulateFatigue`, `FatigueEngine.distributeMinutes` — superseded
- `GameEngine.calculatePlayerDevelopment`, `GameEngine.getChemistryBonus` — superseded
- `PlayerAttributes.getAttrGrade` — unused
- `PlayerDevelopmentEngine.calculateRatingChange` — superseded
- `PlayoffEngine.populateNextRoundSeries` — superseded by calendar-based population
- `SalaryCapEngine.getTeamSalaryFloor` — unused
- `SimulationController.removeObserver`, `SimulationController.updatePlayerGamesPlayed` — unused
- `TradeController.toggleAiTradePick`, `TradeController.toggleUserTradePick` — unused


## Action Plan

### Phase 1: Safe Dead Code Removal (this session or next)

Remove all confirmed dead methods. Estimated savings: ~424 lines. Low risk — these methods have zero callers.

Priority order:
1. GMMode.js — 225 lines (biggest win, cleanest removal)
2. GameState.js — 149 lines (pure data methods, no side effects)
3. GameSimController.js — 144 lines (dead playoff methods)
4. OffseasonController.js — 83 lines
5. Everything else — ~50 lines across 10+ files

### Phase 2: GameSimController Split (dedicated session)

Extract calendar-based playoff sim (lines 2782–4100) into `PlayoffSimController.js`. PlayoffHub.jsx is stable and unchanged — only game-init.js wiring updates needed. Full plan in `docs/PHASE2-PLAN.md`.

### Phase 3: GMMode Rename (low priority)

Rename `GMMode.js` to `SeasonSimController.js` once dead code is removed. Update all references in `game-init.js`, `main.js`, `index.jsx`.

### Not Recommended

- Automated refactoring of any kind — per project rules, this has caused regressions before
- Splitting OffseasonController — it's large but well-organized by phase
- Touching PlayoffEngine.js — it's cleanly separated logic
