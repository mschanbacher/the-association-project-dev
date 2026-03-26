# The Association Project — Legacy DOM Migration Plan

Last updated: 2026-03-25 (MIGRATION COMPLETE — Sessions A–H + post-migration cleanup)

This document records the completed migration of all legacy DOM code to React,
and tracks the small amount of remaining bridge code.


## Final State Summary

| File | getElementById | Status |
|------|---------------:|--------|
| GameSimController.js | 0 | **Clean** — fully migrated (pre-Session A) |
| DraftController.js | 0 | **Clean** — fully migrated (pre-Session A) |
| GMMode.js | 1 | **Clean** — 1 remaining is working self-contained overlay |
| TradeController.js | 0 | **Clean** — Session A (2026-03-25) |
| CoachManagementController.js | 0 | **Clean** — Session B (2026-03-25) |
| FinanceController.js | 0 | **Clean** — Session C (2026-03-25) |
| RosterController.js | 0 | **Clean** — Session D (2026-03-25) |
| FreeAgencyController.js | 0 | **Clean** — Session E (2026-03-25) |
| OffseasonController.js | 0 | **Clean** — Session F (2026-03-25) |
| DashboardController.js | 0 | **Clean** — Session G (2026-03-25) |
| game-init.js | 5 | **Near-clean** — Session H (2026-03-25). 5 remaining are structural (see below) |

**Total removed:** 186 getElementById calls, 117 index.html stubs (57 during sessions + 60 in post-migration cleanup), 35 dead window globals, ~2,150 lines of dead code.

**Total remaining:** 5 getElementById calls in game-init.js + 1 in GMMode.js = 6 across entire codebase. All are active, not legacy.


## Remaining getElementById Calls (6 total — all active)

### game-init.js (5 calls)
All target `gameContainer` or `teamSelectionModal` — the two stubs App.jsx
reads during the new-game → in-game transition:
- `selectTeam()`: hides teamSelectionModal, shows gameContainer (2 calls)
- `_initGame` load path: shows gameContainer + hides teamSelectionModal (3 calls)

These could be eliminated by moving the transition logic into React (App.jsx
already reads both elements), but this is low priority — they work correctly
and are not legacy DOM rendering.

### GMMode.js (1 call)
Self-contained overlay for a specific game mode feature. Not legacy.


## Remaining Legacy Artifacts

### index.html stubs (2 remaining)
`src/index.html` and root `index.html` each contain only:
- `teamSelectionModal` — read by App.jsx + game-init.js (5 refs)
- `gameContainer` — read by App.jsx + game-init.js (5 refs)
- `react-root` — React mount point (not legacy)
- `legacy-modal-stubs` — the container div (could be renamed)

All other stubs (117 total) have been removed.

### UIRenderer.js (100 lines — 2 active methods)
Only `watchGamePlayEntry()` and `watchGameLeaders()` are still called, both
from GameSimController.js for the live watch game play-by-play feed. These
generate HTML strings inserted into the watch game modal DOM.

**Future cleanup:** These could be converted to React components inside
WatchGameModal.jsx, which would eliminate UIRenderer.js entirely. Low
priority — the watch game feed works well as-is.

### UIHelpers.js (utility functions)
`getRatingColor()`, `getRankSuffix()`, `generatePositionBreakdownHTML()` are
called from game-init.js to build data passed to React. These are pure
utility functions, not DOM manipulation. No action needed.

### window.* globals bridge (~50 globals)
React components call `window.dropPlayer()`, `window.simNextGame()`,
`window.saveGameState()`, etc. to reach engine logic in game-init.js. This
is the intended architecture pattern (React UI → window global → engine),
not technical debt. These will remain until/unless engines are refactored
to be importable ES modules that React can call directly.


## Completed Sessions Log

### Session A: TradeController.js — 32 → 0 getElementById
- Gutted all DOM methods, kept trade execution logic
- Removed UIRenderer import
- game-init.js: 5 dead globals removed
- 16 stubs removed. 617 → 348 lines (-279)

### Session B: CoachManagementController.js — 8 → 0 getElementById
- Gutted legacy fallbacks, kept hire/fire logic
- Removed UIRenderer dependency
- game-init.js: 3 dead globals removed
- 2 stubs removed. 257 → 172 lines (-97)

### Session C: FinanceController.js — 17 → 0 getElementById
- Gutted legacy fallbacks, kept state mutations
- Removed UIRenderer import
- game-init.js: 2 dead globals removed
- 5 stubs removed. 354 → 269 lines (-107)

### Session D: RosterController.js — 23 → 0 getElementById
- Gutted updateRosterDisplay (4 calls) + 8 scouting methods (19 calls)
- Removed UIRenderer import
- game-init.js: 10 dead globals + 3 dead functions removed
- 15 stubs removed (11 planned + 4 bonus). 432 → 121 lines (-311)

### Session E: FreeAgencyController.js — 27 → 0 getElementById
- Gutted 10 DOM methods, kept enrichment + processing pipeline
- Removed UIRenderer dependency
- game-init.js: 3 dead globals removed
- 15 stubs removed. 624 → 226 lines (-398)

### Session F: OffseasonController.js — 9 → 0 getElementById
- Removed 7 dead interactive contract decision methods + confirmContractDecisions
- Old flow replaced by automated runContractExpiration()
- game-init.js: 3 dead globals removed
- 4 stubs removed (3 planned + 1 bonus). 2047 → 1873 lines (-174)

### Session G: DashboardController.js — 36 → 0 getElementById
- Investigation found all 36 calls targeted nonexistent IDs (dead code)
- Gutted to single refresh() with _notifyReact
- game-init.js: 3 dead globals removed
- 0 stubs (none existed). 394 → 27 lines (-367)

### Session H: game-init.js — 39 → 5 getElementById
- Removed legacy fallbacks for: team selection (7), calendar (4),
  All-Star (3), box score (2), injury (12), roster modal management (6),
  bracket/game menu (3), player attributes (1)
- 5 dead globals removed
- 0 stubs (cleaned in post-migration pass). 1844 → 1553 lines (-291)

### Post-migration cleanup
- Audited all 65 remaining stubs — 62 had zero references
- Removed 60 dead stubs from both index.html files (2 kept: teamSelectionModal, gameContainer)
- Removed dead UIRenderer import from OffseasonController
- Removed UIRenderer from game-init.js destructure + CoachManagement context


## Migration Pattern (reference)

The pattern used for every controller migration:

1. **Audit**: Map every getElementById call to its purpose
2. **Verify React coverage**: Confirm React component handles the functionality
3. **Gut DOM code**: Remove getElementById calls and HTML generation
4. **Keep business logic**: Preserve engine calls, state mutations, events
5. **Clean game-init.js**: Remove dead window globals (grep first)
6. **Remove stubs**: From both src/index.html and root index.html
7. **Build + test**: `npx vite build` must pass with `130 modules transformed`
