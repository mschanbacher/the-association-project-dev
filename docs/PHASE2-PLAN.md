# Phase 2: GameSimController Split (PlayoffSimController Extraction)

Last updated: 2026-03-24

## Context

GameSimController.js is 4,151 lines. It contains three generations of playoff code:

1. **Modal-era** (lines 635–1058): `startPlayoffSeriesWatch`, `_showPlayoffSeriesStatus`, `watchPlayoffGame` (v1), `watchPlayoffGameClose`, `_closeCalendarPlayoffWatch`, `simRestOfPlayoffSeries`, `simOnePlayoffGame`, `_completePlayoffSeries`. These use `this._playoffWatch` state and are the game-level interaction layer (watch a game, sim one game, sim rest of series).

2. **Hub-era** (lines ~1387–2780): `initBracketForHub`, `simAllChampionshipRounds`, `continueAfterChampionshipRound`, `continueT2AfterDivisionSemis`, `continueT2AfterDivisionFinal`, `continueT2AfterNationalRound`, `simAllT2Rounds`, `_finishT2Playoffs`, and their T3 equivalents. These are the old per-round modal chain that drives `startPlayoffSeriesWatch` callbacks. They are only reachable via `window.*` globals in game-init.js — **PlayoffHub no longer calls any of them** except `simAllChampionshipRounds` as a fallback in `handleSimToChampionship`.

3. **Calendar-era** (lines 2782–4100): `simPlayoffDay`, `simUserPlayoffSeries`, `simPlayoffRound`, `simToChampionship`, `watchPlayoffGame` (v2), `_simOneScheduledGame`, `_updateBracketsAfterGames`, all the bracket population helpers, `_buildPostseasonResults`. These work with `gameState.playoffSchedule` and are the primary simulation layer for PlayoffHub.

PlayoffHub.jsx currently calls from systems 1 and 3, with one fallback to system 2. The hub-era system (2) is the old modal chain that existed before the calendar schedule was built.

### The Duplicate `watchPlayoffGame`

- **v1 (line 720)**: Uses `this._playoffWatch` state from `startPlayoffSeriesWatch`. Wired to `window.watchPlayoffGame` in game-init.js (line 234).
- **v2 (line 3072)**: Uses `gameState.playoffSchedule` and `gameState.userSeriesId`. Wired to `window.watchPlayoffGame` at game-init.js line 1928 (LATER in file, overwrites v1).

Since game-init.js processes top-to-bottom, the **later binding (line 1928) wins**. The v2 calendar-based version is the active one. The v1 at line 720 is only reachable through the internal `startPlayoffSeriesWatch` → `_showPlayoffSeriesStatus` → hub-era chain, which PlayoffHub no longer uses.

### The `mapStats` Duplication

The same 12-line `mapStats` closure is copy-pasted 5 times across: `watchPlayoffGameClose` (modal-era), `_closeCalendarPlayoffWatch`, `simRestOfPlayoffSeries`, `simOnePlayoffGame`, and `_simOneScheduledGame`. This should become a static utility on the class.

---

## Part 1: What Gets Extracted into PlayoffSimController.js

### New file: `src/engines/PlayoffSimController.js`

Everything in the calendar-era block (lines 2782–4100) moves here, plus the `_closeCalendarPlayoffWatch` method (lines 847–916) which is calendar-era code that landed in the modal section.

#### Methods to extract (22 methods, ~1,370 lines):

**Sim controls (called by PlayoffHub):**
- `simPlayoffDay()` — sim all games on next game date
- `simUserPlayoffSeries()` — sim user's current series to completion
- `simPlayoffRound()` — sim user's tier current round to completion
- `simToChampionship()` — fast-forward all remaining playoff games
- `watchPlayoffGame()` (v2, line 3072) — set up live watch for user's next game

**Game execution:**
- `_simOneScheduledGame(game)` — simulate one scheduled playoff game
- `_closeCalendarPlayoffWatch()` — handle watch game close for calendar games

**Bracket management:**
- `_updateBracketsAfterGames()` — check series completion, populate next round
- `_checkT2NationalTournamentSeeding()` — seed T2 national after division finals
- `_checkT3TournamentSeeding()` — seed T3 regional/sweet16 after metro finals
- `_checkThirdPlaceGames()` — populate 3rd place series after semis
- `_populateSeriesWithTeams(seriesId, higher, lower)` — fill both slots
- `_populateSeriesWithTeam(seriesId, team, fromSeriesId)` — fill one slot
- `_getNextSeriesId(completedSeriesId)` — bracket advancement mapping
- `_isHigherSeedAdvancement(from, to)` — seeding position logic
- `_finalizeSeriesMatchup(seriesId)` — set home/away after both teams known

**Round tracking:**
- `_getCurrentPlayoffRoundForTier(tier)` — find current incomplete round
- `_isRoundCompleteForTier(round, tier)` — check round completion

**Completion:**
- `_updateUserSeriesForNextRound()` — advance or eliminate user
- `_checkPlayoffsComplete()` — check all 3 tiers done
- `_isTierPlayoffsComplete(tier)` — check one tier finals done
- `_buildPostseasonResults()` — build offseason-compatible results

**Utility (shared, extract as static):**
- `_mapStats(stats)` — the duplicated box score stat mapper (new static method)

#### What stays in GameSimController.js:

**Modal-era game-level interaction (lines 635–1058 minus `_closeCalendarPlayoffWatch`):**
- `startPlayoffSeriesWatch()` — entry point for watching a series
- `_showPlayoffSeriesStatus()` — refresh hub or show modal after game
- `watchPlayoffGame()` (v1, line 720) — the modal-era watch setup
- `watchPlayoffGameClose()` — route to calendar handler or modal handler
- `simRestOfPlayoffSeries()` — auto-sim remaining in modal-era series
- `simOnePlayoffGame()` — sim one game in modal-era series
- `_completePlayoffSeries()` — finish modal-era series, fire callback

These stay because they handle the watch-game UX flow and are deeply intertwined with the `_watchGame`, `_watchTimer`, `_startWatchTimer` regular-season watch infrastructure that lives in GameSimController. They also still serve the hub-era chain (system 2).

**Hub-era per-round chain (lines ~1387–2780):**
- `initBracketForHub`, `simAllChampionshipRounds`, `continueAfterChampionshipRound`, all T2/T3 continuation methods
- These stay for now but are candidates for Phase 3 removal once we confirm the calendar system fully replaces them.

**Everything else stays:** regular season sim, watch game, bracket viewer, season end, promo/rel playoffs, win probability helpers.

### Shared state and dependencies

PlayoffSimController needs access to:
- `this.ctx` (same dependency injection pattern as GameSimController)
- `gameState.playoffSchedule` — the calendar data
- `gameState.playoffData` — bracket structures
- `gameState.userSeriesId`, `gameState.userTeamId`, `gameState.userInPlayoffs`
- `engines.PlayoffEngine` — for `getSeriesState`, `getNextPlayoffGameDate`, etc.
- `helpers.getSimulationController()` — for `simulatePlayoffGame` and `accumulatePlayerStats`
- `helpers.saveGameState()`
- `helpers.applyFatigueAutoRest?.()`
- `GamePipeline.create()` — for watch game setup
- `LeagueManager.calcPreGameWinProb()` — for pre-game probability

The new controller will NOT own `_watchGame` or `_watchTimer` state — watch setup calls into `GameSimController._watchGame` setup, then `_closeCalendarPlayoffWatch` on PlayoffSimController handles the result recording.

#### Cross-controller call pattern:

When PlayoffSimController.watchPlayoffGame() sets up a watch:
1. It sets `gameSimController._watchPlayoffGame = nextGame` (so `watchPlayoffGameClose` routes to the right handler)
2. It calls `gameSimController._watchGame = GamePipeline.create(...)` and starts the timer
3. On close, `gameSimController.watchPlayoffGameClose()` sees `_watchPlayoffGame` and delegates to `playoffSimController._closeCalendarPlayoffWatch()`

This means PlayoffSimController needs a reference to GameSimController, and vice versa. The cleanest pattern: both receive each other via `ctx` during init, same as other controllers.

---

## Part 2: PlayoffHub.jsx — No Rebuild Needed

PlayoffHub.jsx (1,900 lines) is stable and functioning. The "needs a stable rebuild session" note in the alignment doc was written during a period of context-compaction regressions that have since been resolved. The current committed version correctly calls all calendar-era methods and renders the bracket, series card, win prob arc, game log, and sim controls.

**This extraction does not touch PlayoffHub.jsx.** The `window.*` global names it calls (`simPlayoffDay`, `simUserPlayoffSeries`, `simPlayoffRound`, `simToChampionship`, `watchPlayoffGame`) remain identical — only the controller they route to changes in game-init.js.

Any visual tweaks to PlayoffHub are a separate effort, not part of this extraction.

---

## Part 3: Wiring Changes in game-init.js

### New controller instantiation

```javascript
// After GameSimController creation (~line 169):
_playoffSimController = new window.PlayoffSimController({
    gameState,
    helpers: { ...helpers, getGameSimController: () => _gameSimController },
    engines: { PlayoffEngine, GamePipeline, StatEngine, ... },
    eventBus,
    GameEvents
});

// Give GameSimController a reference back:
_gameSimController._playoffSimController = _playoffSimController;
```

### Window global rewiring

**Replace** (currently pointing to GameSimController):
```javascript
// OLD (line 1928-1931):
window.simPlayoffDay = (...args) => getGameSimController().simPlayoffDay(...args);
window.simUserPlayoffSeries = (...args) => getGameSimController().simUserPlayoffSeries(...args);
window.simPlayoffRound = (...args) => getGameSimController().simPlayoffRound(...args);
window.simToChampionship = (...args) => getGameSimController().simToChampionship(...args);

// NEW:
window.simPlayoffDay = () => getPlayoffSimController().simPlayoffDay();
window.simUserPlayoffSeries = () => getPlayoffSimController().simUserPlayoffSeries();
window.simPlayoffRound = () => getPlayoffSimController().simPlayoffRound();
window.simToChampionship = () => getPlayoffSimController().simToChampionship();
window.watchPlayoffGame = () => getPlayoffSimController().watchPlayoffGame();
```

**Keep** (hub-era and modal-era, still pointing to GameSimController):
```javascript
window.simOnePlayoffGame    // → gsc.simOnePlayoffGame()     (modal-era)
window.simPlayoffSeries     // → gsc.simRestOfPlayoffSeries() (modal-era)  
window.initBracketForHub    // → gsc.initBracketForHub()      (hub-era)
window.simAllChampionshipRounds // → gsc.simAllChampionshipRounds() (hub-era)
// etc.
```

### Watch game close routing

`watchPlayoffGameClose()` stays on GameSimController. Its routing:
- If `this._watchPlayoffGame` exists → call `this._playoffSimController._closeCalendarPlayoffWatch()`
- Else if `this._playoffWatch` exists → modal-era handler (unchanged)

### Lazy getter pattern

```javascript
function getPlayoffSimController() {
    if (!_playoffSimController) {
        // Initialize on first access (same pattern as other controllers)
    }
    return _playoffSimController;
}
```

---

## Part 4: Phased Implementation Order

### Phase 2A: Extract PlayoffSimController (engine work, no UI changes)

1. Create `src/engines/PlayoffSimController.js` with constructor accepting `ctx`
2. Extract static `_mapStats()` utility first (replace all 5 copies)
3. Move calendar-era methods one section at a time:
   - Sim controls: `simPlayoffDay`, `simUserPlayoffSeries`, `simPlayoffRound`, `simToChampionship`
   - Watch: `watchPlayoffGame` (v2), `_closeCalendarPlayoffWatch`
   - Bracket management: `_updateBracketsAfterGames` through `_finalizeSeriesMatchup`
   - Round tracking: `_getCurrentPlayoffRoundForTier`, `_isRoundCompleteForTier`
   - Completion: `_updateUserSeriesForNextRound`, `_checkPlayoffsComplete`, `_isTierPlayoffsComplete`, `_buildPostseasonResults`
4. Update `game-init.js` wiring
5. Add `PlayoffSimController` to Vite entry / main.js imports
6. **TEST**: Build passes (`npm run build`). Load existing save. Verify PlayoffHub opens. Verify simPlayoffDay/simToChampionship work. Verify watchPlayoffGame launches and closes correctly.

### Phase 2B: Clean up

1. Remove the v1 `watchPlayoffGame` from GameSimController (line 720) — confirm it's unreachable from PlayoffHub
2. Remove duplicate `_mapStats` closures in GameSimController modal-era methods, use shared static version from PlayoffSimController
3. Fix `resumeOffseason()` POSTSEASON case to pass full data (currently missing `playoffSchedule`, `userSeriesId`, etc.)
4. Fix the duplicate `window.watchPlayoffGame` binding in game-init.js (line 234 vs 1928)
5. **TEST**: Same as 2A — build, load save, full playoff flow.

### Emergency: If PlayoffHub breaks after extraction

PlayoffHub.jsx is NOT being modified. If it breaks, the cause is a wiring issue in game-init.js — the `window.*` globals it calls are pointing at the wrong controller or the new controller isn't initialized. Debug checklist:

1. **PlayoffHub won't open**: Check `OffseasonController.advanceToNextSeason()` — is `window._reactShowPlayoffHub` registered? Is `SeasonEndModal` closing?
2. **Sim buttons do nothing**: Check game-init.js — are `window.simPlayoffDay` etc. pointing at `getPlayoffSimController()`? Is the lazy getter returning a valid instance?
3. **Watch game doesn't close properly**: Check `GameSimController.watchPlayoffGameClose()` — is `this._playoffSimController` set? Is it calling `_closeCalendarPlayoffWatch` with the right arguments?
4. **Brackets don't advance after sim**: Check `PlayoffSimController._updateBracketsAfterGames()` — does it have access to `this.ctx.engines.PlayoffEngine`?
5. **Save/load resumes to blank screen**: Check `OffseasonController.resumeOffseason()` POSTSEASON case — is it passing `playoffSchedule`, `userSeriesId`, `userInPlayoffs`?

If the situation is unrecoverable, `git checkout -- src/engines/GameSimController.js src/game-init.js` restores the pre-extraction state. PlayoffHub.jsx was never modified so it needs no revert.

---

## Part 5: Risks and Mitigations

### Risk 1: SeasonEndModal hijacking flow before reaching PlayoffHub

**The problem**: In prior sessions, `SeasonEndModal` would re-trigger or not close properly, preventing `advanceToNextSeason()` from being called, which means PlayoffHub never opens.

**Current flow**: 
1. Season ends → `GameSimController.showSeasonEnd()` → sets `window._seasonEndAdvanceCallback`
2. `SeasonEndModal` renders with "Begin Playoffs" button
3. Button calls `window._seasonEndAdvanceCallback(action)`
4. `OffseasonController.advanceToNextSeason(action)` closes SeasonEndModal, generates brackets, calls `window._reactShowPlayoffHub()`

**Mitigation**: 
- Add defensive logging at each transition point
- In `advanceToNextSeason`, add explicit `window._reactCloseSeasonEnd?.()` before showing PlayoffHub (already exists at line 195)
- The split doesn't change this flow at all — it's upstream of the extraction. SeasonEndModal → OffseasonController → PlayoffHub entry path is untouched.
- Test this flow explicitly after wiring changes.

### Risk 2: Watch game close routing breaks

**The problem**: `watchPlayoffGameClose()` on GameSimController routes between modal-era and calendar-era based on `this._watchPlayoffGame`. After extraction, the calendar handler lives on a different controller.

**Mitigation**: 
- `watchPlayoffGameClose()` stays on GameSimController (it owns `_watchGame`, `_watchTimer`)
- It delegates to `this._playoffSimController._closeCalendarPlayoffWatch()` when `this._watchPlayoffGame` is set
- Both controllers share `this.ctx`, so `_closeCalendarPlayoffWatch` can read `_watchGame` result from `gameSimController._watchGame`
- Actually: cleaner to pass the result as an argument: `_closeCalendarPlayoffWatch(this._watchGame, this._watchPlayoffGame)`

### Risk 3: Save/load breaks — `resumeOffseason()` POSTSEASON case

**The problem**: `resumeOffseason()` (line 110) only passes `action`, `postseasonResults`, `userTier`, `userTeamId`, `onComplete` to `_reactShowPlayoffHub`. It's missing `playoffSchedule`, `userSeriesId`, `userInPlayoffs`, `currentDate` that `advanceToNextSeason()` (line 306) passes.

**Mitigation**: Fix `resumeOffseason()` to pass the same full payload as `advanceToNextSeason()`. This is a small, safe change. The data already exists in `gameState` at load time.

### Risk 4: Hub-era methods reference calendar methods that moved

**The problem**: `simAllChampionshipRounds()` (line 1603) has no cross-references to calendar methods. BUT `simToChampionship()` at line 3014 has a fallback `if (this.simAllChampionshipRounds)` — after extraction, `simToChampionship` lives on PlayoffSimController and would need `this.ctx.helpers.getGameSimController().simAllChampionshipRounds()` for the fallback.

**Mitigation**: The fallback only triggers when `gameState.playoffSchedule` is null (line 3010-3017). If we're in the calendar era, it's never null. Still, update the fallback to call through the correct controller reference.

### Risk 5: Context compaction in this session

**The problem**: This is going to be a long session with a lot of code movement.

**Mitigation**: 
- Phase 2A is pure extraction with no behavioral changes — if regressions appear, they're wiring bugs, not logic bugs
- PlayoffHub.jsx is NOT being modified, eliminating the largest historical source of regressions
- If the session gets long, stop after Phase 2A, commit, and start Phase 2B cleanup in a new session
- The plan document (this file) serves as the handoff prompt with an emergency debug checklist

### Risk 6: `window.watchPlayoffGame` binding order

**The problem**: game-init.js binds `window.watchPlayoffGame` twice — line 234 (modal-era v1) and line 1928 (calendar-era v2). After extraction, if we only change line 1928 to point at PlayoffSimController, the line 234 binding could overwrite it depending on execution order.

**Mitigation**: Remove the line 234 binding and replace with `window.watchPlayoffGameV1 = () => gsc.watchPlayoffGame()` (or just delete it). Ensure only one binding for `window.watchPlayoffGame` pointing at PlayoffSimController.
