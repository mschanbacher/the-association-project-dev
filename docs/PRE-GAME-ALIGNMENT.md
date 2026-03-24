# The Association Project -- Pre-Game Alignment

Last updated: 2026-03-24

This document is the single source of truth for game initialization, team generation, save/load, and the new game flow. New sessions should start by reading this file before making changes to startup, team generation, or save/load systems.


## Bootstrap Sequence

The game starts in `src/react/index.jsx`, which imports all modules from `src/main.js`, exposes them on `window`, mounts the React app, and calls `window._initGame()`.

`_initGame()` lives in `src/game-init.js` (2,020 lines) and runs this sequence:

1. **Destructure** all engine/controller classes from `window` (set by index.jsx)
2. **Define lazy getters** for all controllers (OffseasonController, GameSimController, PlayoffSimController, etc.)
3. **Define helper functions** (selectTeam, getUserTeam, generateRoster, saveGameState, etc.)
4. **Load or create GameState** (async IIFE):
   - `StorageEngine.load()` — tries IndexedDB first, falls back to localStorage
   - If save found: `GameState.deserialize(savedData)` — validates tier counts (30/86/144)
   - If no save or corrupt: `new GameState()` — blank state for new game
5. **Generate teams** (new game only): `TeamFactory.initializeTierTeams()` for all 3 tiers
6. **Generate free agent pool** (new game only): `generateFreeAgentPool()`
7. **Initialize GMMode** with all dependencies
8. **Wire window globals** — all `window.*` functions for React ↔ engine communication
9. **Auto-resume offseason** if save was mid-offseason: `getOffseasonController().resumeOffseason()`


## New Game Flow

### React Side: NewGameFlow.jsx (~18,700 bytes)

Three-phase wizard displayed when no existing save is detected:

| Phase | Screen | User Action |
|-------|--------|-------------|
| `welcome` | Title screen with "New Game" button | Click to start |
| `tier` | Tier selection (T1/T2/T3) with descriptions | Pick tier |
| `team` | Team grid grouped by division, with team details panel | Pick team, click "Start Game" |

On "Start Game": calls `window.selectTeam(teamId, tier)` and signals `onComplete` to App.jsx.

### Engine Side: selectTeam() in game-init.js

`selectTeam(teamId, tier)` performs all first-season initialization:

1. Sets `gameState.userTeamId`, `currentTier`, `seasonStartYear` (2025), `currentSeason` (2025)
2. Gets season dates from `CalendarEngine.getSeasonDates(2025)`
3. Sets `currentDate` to T1 start (3rd Tue of Oct) — even if user chose T2/T3
4. Generates calendar schedules for all 3 tiers:
   - T1: 82 games, Oct start → Apr 12
   - T2: 60 games, Nov start → Apr 12
   - T3: 40 games, Dec start → Apr 12
5. Sets `gameState.schedule` to the user's tier schedule (alias)
6. Ensures all teams have rosters via `ensureRosterExists()`
7. Generates free agent pool if empty
8. Saves, hides team selection, shows game container
9. Refreshes dashboard via `getDashboardController().refresh()`
10. Bridges to React: sets `window._reactGameState` and notifies


## Team Generation

### TeamFactory.js (801 lines)

`TeamFactory.initializeTierTeams(tier, generateRoster)` — creates all teams for a tier from hardcoded city/name/division configurations. Each team gets:
- City, name, abbreviation, division assignment
- Tier designation
- Financial attributes (arena, market size, ticket prices — via FinanceEngine)
- Generated roster via `TeamFactory.generateRoster()`

### Roster Generation

`TeamFactory.generateRoster(tier, teamId, deps)` — creates a 15-player roster:
- Player ratings scaled by tier (T1 highest, T3 lowest)
- Age distribution curve (21–36, weighted toward prime years)
- Position balance (PG, SG, SF, PF, C)
- Contract lengths and salaries via `SalaryCapEngine`
- Each player gets full `PlayerAttributes` (offRating, defRating, intangibles, potential, etc.)

`generateFreeAgentPool()` — creates ~80 unsigned players across all tiers for the initial FA pool.

### Team Counts

| Tier | Teams | Divisions | Teams/Division |
|------|------:|-----------|---------------|
| T1 (NBA) | 30 | 6 (Atlantic, Central, Southeast, Northwest, Pacific, Southwest) | 5 |
| T2 (NARBL) | 86 | 11 (Great Lakes, Heartland, Mid-Atlantic, etc.) | 7–8 |
| T3 (MBL) | 144 | 24 metro divisions | 6 |

Division assignments are managed by `DivisionManager` (456 lines) using the `CITY_TO_DIVISIONS` mapping. T2/T3 divisions are geographically organized.


## Save/Load System

### Storage Architecture

`StorageEngine.js` (692 lines) — dual-storage system:

| Protocol | Primary | Backup |
|----------|---------|--------|
| `http(s)://` | IndexedDB | localStorage (LZ-compressed) |
| `file://` | localStorage (LZ-compressed) | — |

LZ-string compression achieves ~67% reduction on localStorage saves. IndexedDB stores raw JSON (no compression needed — browser handles it).

### Save Triggers

- `saveGameState()` — called manually and after every phase transition
- `OffseasonController.setPhase()` — auto-saves on every offseason phase change
- Sim actions — save after each day/game simulation

### GameState Serialization

`GameState.serialize()` — converts the full game state to a JSON string. Includes all team arrays, schedules, player objects, playoff data, offseason state, season history.

`GameState.deserialize(data)` — reconstructs a GameState from saved JSON. Handles backward compatibility for older save formats.

### SaveLoadController.js (135 lines)

Thin wrapper providing user-facing save/load operations:

| Method | Action |
|--------|--------|
| `save()` | Manual save via StorageEngine |
| `downloadSave()` | Export save as downloadable JSON file |
| `uploadSave()` | Import save from uploaded JSON file |
| `reset()` | Delete save, reload page |

### Global Player ID Counter

`gameState._nextPlayerId` (seeded at 2,000,000) ensures unique player IDs across all generation events. All player creation (draft prospects, college grads, free agents) calls `gameState.getNextPlayerId(count)`. Legacy saves compute a safe starting point by scanning all existing player IDs.


## Resume from Save

When loading an existing save, the bootstrap determines the game's current state and routes appropriately:

| Condition | Route |
|-----------|-------|
| `offseasonPhase !== 'none'` | `setTimeout(() => resumeOffseason(), 100)` — resumes into the correct offseason phase (playoffs, draft, FA, etc.) |
| Regular season in progress | Dashboard renders, sim controls active |
| No `userTeamId` | NewGameFlow shows (should not happen with a valid save) |

The 100ms delay on offseason resume allows the React UI to finish mounting before modals/hubs are triggered.

### Save Corruption Detection

At load time, tier counts are validated: T1=30, T2=86, T3=144. If counts don't match, the save is considered corrupt — an alert is shown and the save is deleted.


## Key Files

| File | Role | Lines |
|------|------|------:|
| `src/game-init.js` | Bootstrap, selectTeam, all controller wiring, window globals | 2,020 |
| `src/react/screens/NewGameFlow.jsx` | New game wizard (tier/team selection) | ~600 |
| `src/react/App.jsx` | React root — routes between NewGameFlow and game UI | ~530 |
| `src/react/index.jsx` | Module imports, window exposure, React mount | 130 |
| `src/main.js` | Module index — all engine/controller exports | 55 |
| `src/engines/GameState.js` | Game state container, serialization/deserialization | 1,084 |
| `src/engines/StorageEngine.js` | IndexedDB + localStorage dual storage, LZ compression | 692 |
| `src/engines/SaveLoadController.js` | User-facing save/load/download/upload/reset | 135 |
| `src/engines/TeamFactory.js` | Team configs, player generation, roster generation | 801 |
| `src/engines/DivisionManager.js` | Division assignments, city-to-division mapping | 456 |
| `src/engines/CalendarEngine.js` | Season dates, schedule generation | 1,060 |
| `src/engines/PlayerAttributes.js` | Player stat structure, rating calculations | ~500 |


## Design Decisions Made

1. **All 3 tiers generated immediately**: Even when the user picks T2, all 260 teams across 3 tiers are generated at once. This enables cross-tier features (promotion/relegation, scouting, draft) from day one.

2. **Calendar starts at T1 start**: `currentDate` is set to the T1 season start regardless of user's tier. Games for T2/T3 don't exist yet on those early dates, but the calendar advances linearly. The user's first game appears when their tier's season begins.

3. **Schedule generation at team selection**: All three tier schedules are generated in `selectTeam()`, not lazily. This avoids mid-season generation issues and ensures save/load consistency.

4. **Dual storage for protocol compatibility**: GitHub Pages (`https://`) uses IndexedDB + localStorage backup. Local file opens (`file://`) use localStorage only since IndexedDB is unreliable on `file://` protocol.

5. **LZ-string compression for localStorage**: The game state can exceed 5MB uncompressed. LZ-string achieves ~67% compression, keeping saves under the ~5MB localStorage limit.

6. **Auto-resume offseason on load**: If a save is mid-offseason, the bootstrap automatically calls `resumeOffseason()` which routes to the correct phase (playoffs, draft, FA, etc.). No manual "continue" button needed.

7. **NewGameFlow is React-native**: The team selection wizard is a pure React component. It calls `window.selectTeam()` to bridge into the engine-side initialization. The legacy HTML team selection modal is hidden when React is active.

8. **Global player ID counter**: `_nextPlayerId` at 2,000,000 avoids collisions with the ~4,000 initial players (IDs 0–~4000). All subsequent generation uses this counter, ensuring no ID conflicts even across save/load cycles.

9. **Tier count validation**: The 30/86/144 check at load time catches saves corrupted by bugs in promotion/relegation or team generation. Rather than attempting repair, the save is wiped — data integrity is prioritized over recovery.

10. **Free agent pool is tier-mixed**: The initial FA pool contains players from all three tier rating ranges. This allows promoted/relegated teams to find tier-appropriate talent immediately.


## What's Placeholder / Not Yet Built

| Feature | Status | Notes |
|---------|--------|-------|
| Difficulty settings | Not started | No way to adjust AI competitiveness, trade fairness, or injury frequency at game start |
| Custom team creation | Not started | User picks from existing teams only — no custom names/colors |
| Multiple save slots | Not started | Single save only. Download/upload provides manual backup |
| Season length options | Not started | T1 is always 82, T2 always 60, T3 always 40. No short/long season modes |
| Intro tutorial | Not started | No guided first-game experience. NewGameFlow explains tiers but not gameplay |
| Settings/preferences | Not started | No sound, sim speed, or UI preference persistence |
| Save file versioning | Partial | `GameState.deserialize` handles some backward compatibility but no formal version number in save format |
