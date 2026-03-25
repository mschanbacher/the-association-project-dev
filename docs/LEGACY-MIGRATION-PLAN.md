# The Association Project — Legacy DOM Migration Plan

Last updated: 2026-03-25 (after Sessions A/B/C/D — Trade, Coach, Finance, Roster migrated)

This document is the single source of truth for migrating remaining legacy DOM
code to React. Each controller section documents current state, what needs to
happen, dependencies, and estimated effort. Sessions should use this file to
pick up where the last one left off.


## Current State Summary

| File | getElementById | Status |
|------|---------------:|--------|
| GameSimController.js | 0 | **Clean** — fully migrated |
| DraftController.js | 0 | **Clean** — fully migrated |
| GMMode.js | 1 | **Clean** — 1 remaining is working self-contained overlay |
| TradeController.js | 0 | **Clean** — Session A (2026-03-25) |
| CoachManagementController.js | 0 | **Clean** — Session B (2026-03-25) |
| FinanceController.js | 0 | **Clean** — Session C (2026-03-25) |
| OffseasonController.js | 9 | 9 in contract decisions flow (active, needs migration) |
| DashboardController.js | 36 | Entire controller is legacy — React DashboardScreen exists |
| game-init.js | 39 | Bridge file — cleans up as controllers migrate |
| FreeAgencyController.js | 27 | React FreeAgencyModal exists — controller still drives old UI |
| RosterController.js | 0 | **Clean** — Session D (2026-03-25) |

**Total remaining:** ~112 getElementById calls across 4 files (excluding clean files).
**Removed so far:** 80 getElementById calls (32 Trade + 8 Coach + 17 Finance + 23 Roster), 38 index.html stubs, 21 dead window globals.


## Migration Pattern

Every controller migration follows the same pattern:

1. **Audit**: Map every getElementById call to its purpose (open/close modal,
   populate content, read form input, style button)
2. **Verify React coverage**: Confirm the React component handles the same
   functionality. If not, extend the React component first.
3. **Rewire controller → React**: Replace DOM manipulation with calls to
   `window._reactShow*` / `window._reactClose*` / React state updates.
4. **Remove dead DOM code**: Delete the getElementById calls and any HTML
   generation that fed them.
5. **Remove index.html stubs**: Once a modal's stubs have zero references,
   remove them from index.html.
6. **Clean game-init.js wiring**: Remove `window.*` globals that pointed at
   the now-dead controller methods.
7. **Test**: Full flow test of the feature end-to-end.


## Migration Order (recommended)

Ordered by: risk (low first), dependency chain, and bang-for-buck.

### Session A: TradeController.js (32 calls) — COMPLETE

**Completed:** 2026-03-25. 32 → 0 getElementById calls.

**What was done:**
- Gutted all DOM methods: openTradeScreen (kept deadline check + React call),
  closeTradeScreen, loadTradePartner, displayTradeRosters, displayTradePicks,
  toggleUserTradePlayer, toggleAiTradePlayer, updateTradeSummary, proposeTrade
- Stripped 2 getElementById from acceptAiTradeProposal/rejectAiTradeProposal
- Removed UIRenderer import
- Preserved: executeTrade (roster mutations, history, events), evaluateTrade,
  checkForAiTradeProposals, generateAiTradeProposal, showAiTradeProposal,
  acceptAiTradeProposal, rejectAiTradeProposal
- game-init.js: removed 5 dead globals (closeTradeScreen, loadTradePartner,
  proposeTrade, toggleAiTradePlayer, toggleUserTradePlayer), removed dead
  currentTrade state object
- Kept 4 globals called by React: acceptAiTradeProposal, rejectAiTradeProposal,
  executeTrade, openTradeScreenFromRoster
- index.html: 16 stubs removed
- 617 → 348 lines, net -279 lines


### Session B: CoachManagementController.js (8 calls) — COMPLETE

**Completed:** 2026-03-25. 8 → 0 getElementById calls.

**What was done:**
- Gutted: open() legacy fallback (kept React data-building path), close(),
  showMarket(), showTab(), _buildCurrentCoachHTML(), _buildCoachListHTML()
- Removed UIRenderer dependency from constructor
- Preserved: open() React path (data assembly + _reactShowCoach call),
  hire() (poach/FA logic, coach assignment, events, save),
  fire() (severance, events, save), marketPool lazy generation
- game-init.js: removed 3 dead globals (closeCoachModal, showCoachMarket,
  showCoachTab)
- Kept 3 globals: fireCoach, hireCoach, openCoachManagement
- index.html: 2 stubs removed (coachModal, coachModalContent)
- 257 → 172 lines, net -97 lines


### Session C: FinanceController.js (17 calls) — COMPLETE

**Completed:** 2026-03-25. 17 → 0 getElementById calls.

**What was done:**
- Gutted openFinanceDashboard() legacy fallback (kept React data assembly path)
- Gutted showOwnerModeModal() legacy fallback (kept React path)
- Stripped DOM lines from updateSpendingRatio(), updateTicketPrice(),
  updateOwnerSpendingRatio() — kept state mutations in all three
- Stripped DOM lines from updateTransitionSpending(), dismissTransitionBriefing()
- Removed dead updateTicketPriceEffect() module function
- Removed UIRenderer import
- Preserved: acceptSponsor(), upgradeArena(), setMarketingBudget(),
  toggleOwnerMode(), all data assembly in open methods
- game-init.js: removed dismissTransitionBriefing, updateTransitionSpending
  globals (zero React callers), removed duplicate updateTicketPriceEffect()
- Kept 8 globals: openFinanceDashboard, updateSpendingRatio, updateTicketPrice,
  setMarketingBudget, updateOwnerSpendingRatio, toggleOwnerMode, acceptSponsor,
  upgradeArena
- index.html: 5 stubs removed (financeDashboardModal, financeDashboardCloseBtn,
  financeDashboardContent, financialTransitionModal, financialTransitionContent)
- 354 → 269 lines, net -107 lines

**Note:** Both src/index.html (Vite build entry) and root index.html must be
kept in sync. src/index.html is what Vite builds from (root is `src/` per
vite.config.js). Root index.html is a reference copy.


### Session D: RosterController.js (23 calls) — COMPLETE

**Completed:** 2026-03-25. 23 → 0 getElementById calls.

**What was done:**
- Gutted updateRosterDisplay() — removed 4 getElementById calls
  (positionBreakdown, rosterCount, capStatus, currentRoster) + all HTML
  generation and UIRenderer calls
- Gutted 8 scouting methods: openScoutingModal, closeScoutingModal,
  switchScoutTab, _renderScannerTab, applyScoutFilter (8 DOM reads from
  scoutPos/scoutTier/scoutMinAge/scoutMaxAge/scoutMinRating/scoutMaxRating/
  scoutContract/scoutSort), showPlayerScoutDetail, renderPipelineTab/
  filterPipeline, renderWatchListTab, renderNeedsTab, _updateWatchListCount
  — 19 getElementById calls total
- Removed UIRenderer import
- Preserved: dropPlayer (roster mutation, penalty, save, events),
  signPlayer (FA signing, cap checks, chemistry init, events),
  watchlist CRUD (_getWatchList, _isOnWatchList, addToWatchList,
  removeFromWatchList)
- Added window._notifyReact() calls to addToWatchList/removeFromWatchList
  for React refresh
- game-init.js: removed 10 dead globals (openScoutingModal,
  closeScoutingModal, switchScoutTab, applyScoutFilter,
  showPlayerScoutDetail, renderScannerTab, renderWatchListTab,
  filterPipeline, filterFreeAgents, sortFreeAgents)
- game-init.js: removed dead state (_scoutFilters, currentFreeAgentFilter)
- game-init.js: removed dead functions (filterFreeAgents, sortFreeAgents,
  displayFreeAgents — 64 lines, 3 getElementById)
- game-init.js: cleaned 5 rosterModal getElementById calls from
  openRosterManagement, closeRosterManagement, closeRosterManagementToGame,
  openTradeScreenFromRoster, openRosterManagementHub — removed legacy
  fallback paths (React is now sole path)
- game-init.js: removed displayFreeAgents from RosterController context
- Kept 6 globals: dropPlayer, signPlayer, signFreeAgent, addToWatchList,
  removeFromWatchList, isOnWatchList
- index.html: 15 stubs removed per file (11 planned: rosterModal,
  positionBreakdown, rosterCount, capStatus, currentRoster, positionFilter,
  tierFilter, freeAgentsList, scoutingModal, watchlistCount, scoutTabContent
  + 4 bonus: scoutTabScanner, scoutTabPipeline, scoutTabWatchlist,
  scoutTabNeeds — zero references after scouting methods gutted)
- 432 → 121 lines, net -311 lines (controller)
- game-init.js: 1955 → 1858 lines, net -97 lines; 48 → 39 getElementById


### Session E: FreeAgencyController.js (27 calls) — MEDIUM-LARGE MIGRATION

**Current state:**
- `showFreeAgencyModal()`: Builds entire FA interface — cap space display,
  roster sidebar, position filter, player list with checkboxes, offer panel
  with salary/years inputs, submit button. Writes to ~12 DOM elements. React
  `FreeAgencyModal.jsx` (500 lines) is registered in App.jsx via
  `_reactShowFA`.
- `updateFreeAgencyFilters()`: Reads `faPositionFilter` select value,
  rebuilds player list. Dynamic DOM elements (checkboxes, inputs).
- `toggleFreeAgentSelection()`, `updateSelectedOffers()`: Manages offer
  state via DOM checkbox/input reads. Creates offer panel HTML.
- `submitFreeAgencyOffers()`: Reads salary/years from DOM inputs, processes
  offers.

**What to do:**
1. **Critical check:** Determine if FreeAgencyModal.jsx (500 lines) is a
   complete replacement or a partial shell. If partial, extend it before
   removing controller DOM code.
2. If complete: verify it handles filtering, offer selection, salary/years
   input, submission, results display.
3. OffseasonHub.jsx intercepts `_reactShowFA` and renders FA inline during
   offseason. Verify both paths work (modal during season if applicable,
   inline during offseason).
4. Remove stubs: `freeAgencyModal`, `faCapSpace`, `faOfferTally`,
   `faOfferCount`, `faOfferTotal`, `faOfferRemaining`, `faCurrentRoster`,
   `faPositionFilter`, `freeAgencyPlayersList`, `selectedOffersPanel`,
   `offerCount`, `offersList`, `submitOffersBtn`, `freeAgencyResultsModal`,
   `freeAgencyResultsContent` (15 stubs)

**React components:** FreeAgencyModal.jsx (500 lines) — registered in App.jsx.
OffseasonHub.jsx intercepts `_reactShowFA` for inline rendering.

**Dependencies:** FreeAgencyController.js drives the FA logic (enrichment,
AI signing). The React component needs to call back into the controller for
`submitFreeAgencyOffers()` and `continueFreeAgency()`.

**Estimated effort:** Medium-large. This is the feature most likely to have
the "two paths fighting" bug you've noticed. The controller builds DOM,
React renders its own UI, and they can get out of sync. Needs careful
verification that the React modal handles all interaction.

**Risk:** Medium. Free agency is a critical game flow. Test thoroughly.

**Test:** Enter free agency during offseason. Filter by position. Select
players. Set salary/years offers. Submit offers. View results. Return to
dashboard. Verify AI signing phase runs correctly after.


### Session F: OffseasonController.js contract decisions (9 calls)

**Current state:**
The 9 remaining calls are all in the expired contract decisions flow:
`resignExpiredPlayer()`, `releaseExpiredPlayer()`,
`_removeExpiredDecision()`, `updateContractDecisionsSummary()`,
`updateContractDecisionsButton()`, `confirmContractDecisions()`.

These methods build dynamic HTML for contract cards (resign/release buttons,
status indicators) and manage decision state via DOM reads.

**React component:** ContractDecisionsModal.jsx (151 lines) exists and is
registered in App.jsx. OffseasonHub.jsx intercepts
`_reactShowContractDecisions`. However, the controller never calls
`_reactShowContractDecisions` — it appears the React modal may receive data
from OffseasonHub's interception but the controller's resign/release
callbacks still target DOM.

**What to do:**
1. Check if ContractDecisionsModal.jsx handles resign/release interactions
2. If not, extend it to handle the full flow
3. Rewire controller to update React state instead of DOM
4. Remove stubs: `contractDecisionsModal`, `contractDecisionsSummary`,
   `contractDecisionsConfirmBtn` (3 stubs)

**Estimated effort:** Small-medium. 9 calls, well-scoped feature.

**Test:** Reach contract expiration date in offseason. Resign and release
players. Confirm decisions. Verify players move correctly (re-signed stay,
released go to FA pool).


### Session G: DashboardController.js (36 calls) — INVESTIGATION + MIGRATION

**Why last:** This is the most complex investigation. DashboardScreen.jsx
(62 lines) is a shell that renders widget components from Widgets.jsx
(715 lines). DashboardController's 36 calls target IDs that don't exist in
index.html — the entire `updateDashboard()` method is mostly a no-op.

**Current state:**
- `updateDashboard()`: Writes to 26 unique IDs — `userTeamName`,
  `currentSeason`, `currentGame`, `totalGames`, `userRecord`,
  `rosterStrength`, `budgetDisplay`, `coachNameDisplay`, standings legend,
  etc. **None of these IDs exist.** The method is almost entirely dead.
- `refreshStandings()`, `refreshSchedule()`, `refreshHistory()`: Called at
  the end of `updateDashboard()`. Need to check if these do useful work or
  also target dead IDs.
- The React DashboardScreen renders via Widgets.jsx which reads from
  `useGame()` hook — it gets its data from `window._reactGameState`, not
  from DashboardController.

**What to do:**
1. **Investigate first:** Determine if `refreshStandings()`,
   `refreshSchedule()`, `refreshHistory()` do anything visible
2. Map which data flows currently reach the dashboard widgets
3. If DashboardController is entirely dead (likely), it can be gutted to
   just `updateDashboard() { if (window._notifyReact) window._notifyReact(); }`
4. If any sub-methods do useful work, preserve that logic
5. Remove all dead stubs (many are unique to this controller)

**React component:** DashboardScreen.jsx (62 lines) + Widgets.jsx (715 lines).
Uses `useGame()` hook for all data. Self-sufficient — doesn't need
DashboardController at all for rendering.

**Estimated effort:** Medium. Needs investigation before any code changes.
Could be very quick (gut the whole controller) or require some data flow
rewiring.

**Test:** Load dashboard. Verify all widgets display correctly: team summary,
next game, standings, recent activity, roster quick view, team form.
Sim a game. Verify dashboard updates.


### Session H: game-init.js (49 calls) — INCREMENTAL CLEANUP

**Not a standalone session.** game-init.js is the bridge file that wires
controllers to `window.*` globals and sets up event listeners. Its
getElementById calls fall into categories:

1. **One-time setup** (finding `gameContainer`, `react-root`): Keep these.
2. **Modal show/hide wiring** (legacy onclick handlers): Remove as each
   controller migrates.
3. **Legacy event listener wiring** (onclick for stubs): Remove as stubs
   are removed from index.html.

**Pattern:** At the end of each controller migration session (A–G), also
clean the corresponding wiring in game-init.js. Don't do a standalone
game-init session — it cleans up naturally.

After all controllers are migrated, game-init.js should be left with only:
- `gameContainer` / `react-root` setup
- Engine instantiation and dependency injection
- `window._initGame` definition
- Legitimate `window.*` globals that React components call into
  (sim controls, save/load, etc.)


## index.html Stub Removal Tracker

After all migrations complete, the `legacy-modal-stubs` container can be
removed entirely. Current remaining stubs grouped by migration session:

| Session | Stubs to remove | Count | Status |
|---------|----------------|------:|--------|
| A (Trade) | tradeModal, tradePositionBreakdown, tradePartnerSelect, tradeInterface, yourTradeRoster, yourTradePicksHeader, yourTradePicks, aiTradeRoster, aiTradePicksHeader, aiTradePicks, tradeSummary, tradeYourValue, tradeAiValue, tradeNetValue, noTradePartner, aiTradeProposalModal | 16 | **DONE** |
| B (Coach) | coachModal, coachModalContent | 2 | **DONE** |
| C (Finance) | financeDashboardModal, financeDashboardCloseBtn, financeDashboardContent, financialTransitionModal, financialTransitionContent | 5 | **DONE** |
| D (Roster) | rosterModal, positionBreakdown, rosterCount, capStatus, currentRoster, positionFilter, tierFilter, freeAgentsList, scoutingModal, watchlistCount, scoutTabContent + scoutTabScanner, scoutTabPipeline, scoutTabWatchlist, scoutTabNeeds | 15 | **DONE** |
| E (FA) | freeAgencyModal, faCapSpace, faOfferTally, faOfferCount, faOfferTotal, faOfferRemaining, faCurrentRoster, faPositionFilter, freeAgencyPlayersList, selectedOffersPanel, offerCount, offersList, submitOffersBtn, freeAgencyResultsModal, freeAgencyResultsContent | 15 |
| F (Contracts) | contractDecisionsModal, contractDecisionsSummary, contractDecisionsConfirmBtn | 3 |
| G (Dashboard) | TBD after investigation | ? |
| Keep | gameContainer (active React root), teamSelectionModal + tier*Teams (4, new game flow), seasonEndModal, playoffModal, developmentModal + developmentSummary, watchGameModal + watchGameContent, boxScoreModal + boxScoreContent, franchiseHistoryModal + franchiseHistoryContent, complianceModal + complianceModalContent, injuryModal + injuryDetails + injuryOptions + injuryConfirmBtn, calendarModal + calendarContent, allStarModal + allStarContent, collegeGradFAModal, bracketViewerModal + bracketViewerContent, lotteryModal + lotteryContent, userDraftPickModal + userPickNumber + draftPositionFilter + draftSortBy + draftProspectsList + draftYourRoster, draftResultsModal + draftRound1Btn + draftCompBtn + draftRound2Btn + userPicksBtn + draftResultsContent, gameMenuModal | ~34 |

**After sessions A–G:** ~52 stubs removed, ~34 remaining (mostly modals
that are wired via game-init.js event listeners and still referenced).

**Final pass (Session I):** Audit the ~34 remaining stubs. Many may become
zero-reference after sessions A–G clean game-init.js wiring. Could
potentially remove the `legacy-modal-stubs` container entirely if all
remaining modals are fully React-driven.


## Key Risks and Mitigations

**Risk: Two paths fighting (especially FA, Roster, Finance)**
The controller builds DOM content AND React renders its own UI. They can get
out of sync — e.g., controller sets FA offer count in DOM while React tracks
offers in local state.
**Mitigation:** During migration, verify React component is the sole renderer.
Remove DOM path completely, don't leave it as fallback.

**Risk: Context compaction drift in long sessions**
Complex migrations (especially E: Free Agency) involve many files and
interactions. Long sessions accumulate drift.
**Mitigation:** One controller per session. Start each session by reading
this plan + the relevant alignment doc. Commit after each major step.

**Risk: Breaking game-init.js wiring**
Removing `window.*` globals that are still called from React components.
**Mitigation:** Before removing any `window.*` global, grep for all callers.
Only remove if zero references outside game-init.js itself.

**Risk: Save format changes**
Controller migrations should not change any data structures on gameState.
**Mitigation:** Keep engine files untouched. Only change how data flows
to/from UI, not how it's computed or stored.


## Session Checklist (copy for each session)

```
Before starting:
[ ] Read this plan's section for the target controller
[ ] Read relevant alignment doc (OFFSEASON, PLAYOFFS, or REGULAR-SEASON)
[ ] Read DESIGN-SYSTEM.md
[ ] Pull latest from dev repo
[ ] Note the current getElementById count

During:
[ ] Verify React component coverage before removing DOM code
[ ] Preserve all engine logic (roster mutations, trade execution, etc.)
[ ] Remove DOM calls, not business logic
[ ] Clean corresponding game-init.js wiring
[ ] Remove freed index.html stubs
[ ] Build passes (vite build)
[ ] Commit after each sub-phase

After:
[ ] Full flow test of the migrated feature
[ ] Verify getElementById count matches expected
[ ] Update this plan with new counts and status
[ ] present_files for all modified files
```
