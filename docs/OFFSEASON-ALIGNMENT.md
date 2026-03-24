# The Association Project -- Offseason Flow Alignment

Last updated: 2026-03-18 (Training Camp prep session)

This document is the single source of truth for offseason architecture, flow, and status.
New sessions should start by reading this file before making any changes.


## Offseason Calendar (all dates relative to seasonStartYear + 1)

| Date     | Phase Key              | What Happens                                              | Status       |
|----------|------------------------|-----------------------------------------------------------|--------------|
| Apr 12   | `seasonEnd`            | Regular season ends for all tiers                         | Complete     |
| Apr 16   | `playoffsStart`        | Playoff brackets generated, PlayoffHub opens              | Complete     |
| Jun 1    | `seasonOfficialEnd`    | Promo/rel executes, OffseasonHub opens                    | Complete     |
| Jun 8    | `draftLottery`         | Lottery balls drawn (T1 only)                             | Complete     |
| Jun 15   | `draftDay`             | T1 Draft + college grads generated + undrafted to FA pool | Complete     |
| Jun 22   | ~~`collegeFA`~~        | **REMOVED** -- college grads now generated at draft time  | Eliminated   |
| Jun 30   | `contractExpiration`   | All contracts decremented; expired players move to FA pool | Complete    |
| Jul 1    | `freeAgencyStart`      | FA opens -- user signs FAs, then AI signing phase runs    | Complete     |
| Aug 1    | `playerDevelopment`    | Ratings change, aging, retirements, injury heal, fatigue reset | Complete |
| Aug 16   | `trainingCamp`         | Roster compliance check, then season setup                | Placeholder  |
| Oct ~15  | Season start           | New season begins (3rd Tue of Oct for T1)                 | Complete     |


## Phase Execution Details

### Season End -> Postseason (OffseasonController.advanceToNextSeason)
- SeasonEndModal shows season label + record + "Begin Playoffs" button (gutted to minimal gate)
- Clicking button calls `advanceToNextSeason(action)` where action is 'championship', 't2-championship', 't3-championship', or 'stay'
- Playoff brackets generated for all 3 tiers, stored in `gameState.playoffData`
- PlayoffHub opens via `window._reactShowPlayoffHub()`
- **Critical constraint**: `_showPlayoffSeriesStatus()` must call `window._reactPlayoffHubRefresh()`, never any modal opener
- PlayoffHub.jsx is stable (1,900 lines). Prior context-compaction regressions have been resolved. Calendar-era methods being extracted to PlayoffSimController (see docs/PHASE2-PLAN.md).

### Promo/Rel (OffseasonController.continueAfterPostseason)
- Executes after PlayoffHub's `onComplete` callback fires
- Captures full season history snapshot (standings, champions, user team stats)
- Runs `LeagueManager.executePromotionRelegation()` 
- If user's tier changed: shows `FinancialTransitionModal` with tier-appropriate briefing
- After promo/rel: OffseasonHub opens via `window._reactShowOffseasonHub()`
- **Hub-based flow**: After promo/rel, the controller does NOT auto-trigger subsequent phases. The user sims forward using dashboard sim controls, and `_checkDateTriggers()` fires events as dates are reached.

### Draft (T1 only, Jun 15)
- Triggered by `_checkDateTriggers()` when date >= Jun 15
- Guard flags: `_draftStarted` (prevents re-trigger), `_draftComplete` (marks done)
- Flow: Generate draft class -> Run lottery -> Show lottery modal -> User pick -> AI picks -> Results
- **At draft finalization**: undrafted prospects go to FA pool, college graduate class is generated and added to FA pool, `_collegeFAComplete` set to true
- Post-draft roster trim is now 20 (offseason expanded limit), not 15
- OffseasonHub intercepts `_reactShowLottery`, `_reactShowUserPick`, `_reactShowDraftResults` and renders inline in Draft screen

### College Grad FA -- ELIMINATED
- **No longer a standalone phase.** College graduates are generated at draft finalization (`finalizeDraft()`) and added directly to `gameState.freeAgents`.
- The `collegeFA` date (Jun 22) remains in `CalendarEngine.getSeasonDates()` for backward compatibility but is no longer a trigger.
- Graduates are available to any tier as camp invites or during Free Agency.
- For T2/T3 users: the draft runs silently, and college grads still flow to FA pool at that time.

### Contract Expiration (Jun 30) -- NEW
- Triggered by `_checkDateTriggers()` when date >= Jun 30
- Guard flag: `_contractExpirationComplete`
- `OffseasonController.runContractExpiration()` processes ALL teams:
  - Decrements `contractYears` for every player
  - Players with `contractYears <= 0` removed from roster, added to `gameState.freeAgents`
  - Sets `previousTeamId` on expired players so they appear highlighted in FA
  - Assigns new contract length for when they sign
- **Does NOT return** -- allows FA trigger to fire on same sim tick if date >= Jul 1
- Separated from PlayerDevelopmentEngine (which now only handles ratings/aging/retirements)

### Free Agency (Jul 1)
- Triggered by `_checkDateTriggers()` when date >= Jul 1
- Guard flags: `_freeAgencyStarted`, `_freeAgencyComplete`
- `OffseasonController.startFreeAgencyPeriod()` -> `helpers.showFreeAgencyModal()`
- OffseasonHub intercepts `_reactShowFA` and renders inline in Free Agency screen
- **"Return to Dashboard" flow**: 
  1. User clicks "Return to Dashboard" on FA results screen
  2. Calls `window.continueFreeAgency()` (runs AI signing, marks `_freeAgencyComplete`, saves)
  3. Calls `onFaComplete()` which clears FA state and navigates to OffseasonHub dashboard
  4. Does NOT advance to next phase -- user continues simming forward

### Player Development (Aug 1)
- Triggered by `_checkDateTriggers()` when date >= Aug 1
- Guard flag: `_developmentComplete`
- Runs `OffseasonController.applyPlayerDevelopment()`:
  - Rating changes (age curves, playing time bonuses)
  - Retirements (roster players + free agents)
  - Heals all injuries
  - Resets all fatigue
- **Does NOT handle contracts** (separated in Phase 2)
- Shows Development screen in OffseasonHub via `_reactShowDevelopment`

### Training Camp (Aug 16) -- PLACEHOLDER
- Triggered by `_checkDateTriggers()` when date >= Aug 16
- Currently shows "Coming Soon" placeholder with reminder to check Finances tab
- "Continue to Season Setup" button triggers `checkRosterComplianceAndContinue()`
- **Compliance check**:
  - Auto-releases lowest-rated players if over 15
  - Shows red warning banner on RosterScreen if: over cap, under 12, or over 15 players
  - "Check Compliance" button re-runs the check
  - Shows green success banner with "Start Season" button when compliant
  - "Start Season" calls `continueToSeasonSetup()`

### Season Setup (OffseasonController.continueToSeasonSetup)
- Increments `gameState.currentSeason`
- Advances coaches (retirement, contract renewals)
- Resets team records (W/L/pointDiff)
- Archives player season stats, initializes new season stats
- Generates schedules for all 3 tiers
- Clears offseason phase to `NONE`
- Closes OffseasonHub, returns to regular dashboard


## OffseasonHub Architecture

### Structure
Full-screen component that replaces the dashboard during offseason. Mirrors the regular dashboard layout: sidebar nav (left) + main content area (right) + phase tracker bar (top).

### Navigation
Sidebar items: Dashboard, Roster, Draft, Free Agency, Development, Contracts, Trades, Scouting, Coach, Finances, History, Glossary.

### Modal Interception Pattern
OffseasonHub registers window functions (`_reactShowFA`, `_reactShowLottery`, etc.) that intercept data meant for modals and instead store it in React state, rendering content inline in the appropriate screen. Original functions are restored on unmount.

### Sim Controls
The OffseasonHub dashboard has sim buttons:
- **Sim Day**: advances 1 day
- **Sim Week**: advances 7 days  
- **Sim to Next Event**: jumps to next phase date
- **Sim to Training Camp**: runs all remaining phases silently

All sim buttons call methods on `OffseasonController` which advance the date and call `_checkDateTriggers()`.

### Quick Sim Path
`_runRemainingOffseasonPhases()` runs all incomplete phases silently:
1. Draft (AI picks best available)
2. College FA (AI distributes graduates)
3. Contract Expiration
4. Free Agency (AI signs for all teams including user)
5. Development
6. Roster compliance -> owner mode -> season setup


## State Flags (on gameState)

| Flag                          | Set when...                        | Purpose                         |
|-------------------------------|------------------------------------|---------------------------------|
| `offseasonPhase`              | Every phase transition             | Current phase enum              |
| `_draftStarted`               | Lottery modal shown                | Prevent re-trigger on sim       |
| `_draftComplete`              | All picks made                     | Skip draft in future sims       |
| `_collegeFAStarted`           | CGFA window shown                  | Prevent re-trigger              |
| `_collegeFAComplete`          | CGFA done                          | Skip in future sims             |
| `_contractExpirationComplete` | Contracts processed                | Prevent double-decrement        |
| `_freeAgencyStarted`          | FA modal shown                     | Prevent re-trigger              |
| `_freeAgencyComplete`         | User closes FA + AI signing done   | Skip in future sims             |
| `_developmentComplete`        | Development applied                | Skip in future sims             |

These flags are all cleared implicitly when `continueToSeasonSetup()` increments the season and resets state.


## Key Files

| File | Role | Lines |
|------|------|-------|
| `src/engines/OffseasonController.js` | Orchestrates entire offseason flow, phase management, date triggers | ~2026 |
| `src/react/screens/OffseasonHub.jsx` | Full-screen hub UI, modal interception, inline rendering | ~2587 |
| `src/engines/CalendarEngine.js` | Season date definitions, schedule generation | ~1039 |
| `src/engines/FreeAgencyController.js` | FA setup, enrichment, user/AI signing logic | ~624 |
| `src/engines/PlayerDevelopmentEngine.js` | Ratings, aging, retirements (no longer touches contracts) | ~275 |
| `src/react/screens/RosterScreen.jsx` | Roster display, release button, compliance banners | ~1400 |
| `src/react/screens/FinancesScreen.jsx` | Financial dashboard + inline Owner Mode controls | ~500 |
| `src/engines/PlayoffEngine.js` | Bracket generation, playoff simulation | ~1200 |
| `src/react/screens/PlayoffHub.jsx` | Playoff hub UI (needs stable rebuild) | ~2000 |


## Design Decisions Made

1. **Hub-based offseason**: OffseasonHub replaces the dashboard entirely during offseason. No more linear modal chain. User controls pacing via sim buttons.

2. **Date-triggered phases**: Phases fire via `_checkDateTriggers()` when the simmed date passes their calendar date. Each phase has `_started` and `_complete` guard flags to prevent re-triggering.

3. **Contract expiration separated from development**: `runContractExpiration()` runs on Jun 30 (before FA opens Jul 1). `PlayerDevelopmentEngine` only handles ratings/aging/retirements. This ensures expired players appear in the FA pool with `previousTeamId` set for highlighting.

4. **Owner Mode inline**: Sponsor offers, arena controls, ticket pricing, marketing sliders all live in the Finances tab. No separate Owner Mode modal during offseason. The "Coming Soon" Training Camp screen reminds users to visit Finances before continuing.

5. **FA "Return to Dashboard" returns to hub**: After FA results, the button navigates back to OffseasonHub dashboard (not advancing to next season). User continues simming forward at their own pace.

6. **Compliance at Training Camp gate**: The "Continue to Season Setup" button in Training Camp triggers `checkRosterComplianceAndContinue()`. Red warning banner if non-compliant (with "Check Compliance" button), green success banner with "Start Season" button when ready.

7. **PlayoffHub design**: Single-screen hub with left sidebar (series card, arc win probability gauge, Game/Watch/Series buttons, Sim to Championship, game log) and full bracket tree always visible in main area. No modals. Currently stable at 1,900 lines; calendar-era simulation logic being extracted to PlayoffSimController.

8. **College grads flow to FA at draft time**: College graduates are no longer a standalone phase. They are generated in `finalizeDraft()` and added directly to `gameState.freeAgents`. Available to any tier as camp invites or FA signings. The `collegeFA` date in CalendarEngine is kept for backward compatibility but no longer triggers an event.

9. **Global player ID counter**: `gameState._nextPlayerId` (seeded at 2,000,000) replaces all range-based ID schemes. All player generation (draft prospects, college grads) calls `gameState.getNextPlayerId(count)`. Legacy saves compute a safe starting point by scanning all existing player IDs.

10. **Offseason roster limit is 20**: Post-draft roster trim raised from 15 to 20. The real cutdown to 15 will happen at each tier's training camp deadline. This allows promoted teams to draft 3 players without immediate forced cuts.

11. **Staggered training camp (planned)**: T1 camp ~Oct 1-19, T2 camp ~Oct 20-Nov 3, T3 camp ~Nov 10-30. Each tier's cuts flow to FA pool for the next tier's camp invites. Mirrors NBA's ~3 week camp duration.


## What's Placeholder / Not Yet Built

| Feature | Status | Notes |
|---------|--------|-------|
| Training Camp gameplay | Placeholder | "Coming Soon" screen. Planned: staggered 3-week camps per tier, camp invites (expand to 20), development focuses, 4 preseason games, cutdown to 15 |
| Development Focuses | Design phase | Player-chosen training areas, outcomes based on intangibles + coach quality + age. Will replace `applyPlayerDevelopment()` one-shot system |
| Camp Invite Signing | Design phase | Mini-FA at camp open: browse FA pool, sign up to 5 camp invitees to fill 20-man roster |
| Preseason Games | Design phase | 4 exhibition games during camp, reuse WatchGameModal, results influence development |
| Awards presentation | Not started | Deferred from SeasonEndModal. Planned for future OffseasonHub iteration |
| Promo/rel info display | Not started | Deferred from SeasonEndModal. Planned for OffseasonHub |
| PlayoffHub extraction | In progress | Calendar-era sim methods moving to PlayoffSimController. UI stable, no rebuild needed. See docs/PHASE2-PLAN.md |
| Persistent college pool | Hook ready | `gameState.getNextPlayerId()` ensures stable IDs. Future: `gameState.collegePool` array with multi-year tracking |
| League-wide news system | Not started | Data infrastructure exists via `tradeHistory`. High-leverage next feature |
| Hall of Fame | Not started | Requires accumulated historical data. IndexedDB storage ready |
| 2D match visualization | Long-term | Rendering layer on top of GamePipeline. Confirmed achievable without sim changes |


## Architecture Principles (reference for all sessions)

1. **Design before code**: Always build and approve a static mockup before wiring logic, especially for complex UI screens.
2. **Context compaction risk**: Long sessions cause architectural drift. Use handoff prompts and this document for continuity.
3. **Engine purity**: All engine files (in `src/engines/`) are pure logic with no DOM access. React components handle rendering.
4. **Dependency injection**: Wrapper functions often carry critical DI logic. Never auto-refactor to simple aliases without checking git history.
5. **Tier-aware logic**: Salary caps, playoff structures, trade frequency, and sim behavior differ by tier (T1/T2/T3). Thread tier context through all systems.
6. **Save-on-phase-transition**: `setPhase()` auto-saves after every offseason phase change for crash resilience.
7. **Backward-compatible saves**: Never break existing save format. LZ-string compression for localStorage backup, IndexedDB primary.
8. **Modal interception**: OffseasonHub intercepts window._reactShow* functions and renders content inline. Original functions restored on unmount.
