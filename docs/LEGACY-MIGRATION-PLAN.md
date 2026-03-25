# The Association Project — Legacy DOM Migration Plan

Last updated: 2026-03-25 (legacy DOM audit session)

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
| OffseasonController.js | 9 | 9 in contract decisions flow (active, needs migration) |
| DashboardController.js | 36 | Entire controller is legacy — React DashboardScreen exists |
| game-init.js | 49 | Bridge file — cleans up as controllers migrate |
| TradeController.js | 32 | React TradeScreen renders — controller DOM is wasted work |
| FreeAgencyController.js | 27 | React FreeAgencyModal exists — controller still drives old UI |
| RosterController.js | 23 | React RosterScreen exists — some stubs already removed |
| FinanceController.js | 17 | React FinancesScreen exists — controller still drives old UI |
| CoachManagementController.js | 8 | React CoachScreen exists — controller still drives old UI |

**Total remaining:** ~202 getElementById calls across 8 files (excluding clean files).


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

### Session A: TradeController.js (32 calls) — WASTED WORK REMOVAL

**Why first:** TradeScreen.jsx (772 lines) already renders the full trade UI
with local React state. The controller's DOM calls target hidden stubs and do
nothing visible. This is the most impactful cleanup because the user is
already seeing the React version — the legacy code is just wasted CPU cycles.

**Current state:**
- `openTradeScreen()`: Populates `tradePartnerSelect` dropdown, position
  breakdown, shows/hides `tradeInterface` / `noTradePartner` — all targeting
  hidden stubs. Then calls `window._reactOpenTrade()` which opens the React
  TradeScreen that manages its own partner selection and roster display.
- `selectTradePartner()`, `updateTradeInterface()`, `executeTrade()`: Build
  HTML for roster lists, pick lists, trade summary, value bars — all into
  hidden stubs. The React TradeScreen has its own versions of all of these.
- `showAiTradeProposal()`: Opens `aiTradeProposalModal` stub. React
  `AiTradeProposalModal` (exported from TradeScreen.jsx) handles this.

**What to do:**
1. Gut `openTradeScreen()` to just the trade deadline check + `_reactOpenTrade()` call
2. Gut `selectTradePartner()`, `updateTradeInterface()` — these are only
   called from legacy onclick handlers in the hidden stubs
3. Verify `executeTrade()` logic (roster mutations, history, events) is
   preserved — only remove the DOM update parts, keep the engine calls
4. Verify `showAiTradeProposal()` routes to React modal
5. Remove stubs from index.html: `tradeModal`, `tradePositionBreakdown`,
   `tradePartnerSelect`, `tradeInterface`, `yourTradeRoster`,
   `yourTradePicksHeader`, `yourTradePicks`, `aiTradeRoster`,
   `aiTradePicksHeader`, `aiTradePicks`, `tradeSummary`, `tradeYourValue`,
   `tradeAiValue`, `tradeNetValue`, `noTradePartner`,
   `aiTradeProposalModal` (16 stubs)

**React component:** TradeScreen.jsx (772 lines) — fully self-contained with
local state for partner selection, player/pick lists, trade evaluation.
Delegates to `TradeEngine.evaluateTrade()` for AI decisions. Also exports
`AiTradeProposalModal`.

**Dependencies:** TradeEngine.js (pure logic, no DOM — untouched).

**Estimated effort:** Small-medium. Mostly deleting code. The React component
already works.

**Risk:** Low. The DOM code is invisible. Removing it changes nothing visible.

**Test:** Open trade screen from sidebar. Select partner. Add players/picks.
Propose trade. Verify AI counter-offers work. Check AI-to-AI trade proposals
still appear during sim.


### Session B: CoachManagementController.js (8 calls) — SMALLEST MIGRATION

**Why second:** Only 8 calls. CoachScreen.jsx (289 lines) and CoachModal.jsx
exist. Small scope makes this a good proof-of-concept for the "rewire
controller" pattern.

**Current state:**
- `showCoachModal()`: Builds entire coach management page via
  `UIRenderer.coachManagementPage()`, writes to `coachModalContent`, shows
  `coachModal`. React `CoachModal` is registered in App.jsx via
  `_reactShowCoach`.
- `showCoachMarket()`: Builds coach market list via
  `UIRenderer.coachMarketContainer()`, writes to `coachMarketContainer`.
- Tab switching: `freeAgentCoachTab`, `poachCoachTab`,
  `freeAgentCoachList`, `poachCoachList` — tab visibility toggling.

**What to do:**
1. Check if `_reactShowCoach` is called from the controller or only from
   game-init wiring
2. If the React modal already receives the right data, gut the DOM code
3. If the React modal is incomplete, extend it to handle coach market,
   hiring, tab switching
4. Remove stubs: `coachModal`, `coachModalContent` (2 stubs)

**React component:** CoachScreen.jsx (289 lines) — sidebar screen.
CoachModal.jsx — registered in App.jsx. Need to verify which one the user
actually sees and whether it covers hiring/firing/market.

**Dependencies:** CoachEngine.js (pure logic, no DOM).

**Estimated effort:** Small. 8 calls, small controller (257 lines).

**Test:** Open coach screen from sidebar. View current coach. Open coach
market. Hire/fire a coach. Verify coach displays update on dashboard.


### Session C: FinanceController.js (17 calls) — MEDIUM MIGRATION

**Current state:**
- `showFinanceDashboard()`: Builds finance dashboard content via
  `UIRenderer.financeDashboard()`, writes to `financeDashboardContent`, shows
  `financeDashboardModal`, wires close button. React `FinanceDashboardModal`
  is registered in App.jsx via `_reactShowFinanceDashboard`.
- Spending slider: `spendingRatioDisplay`, `spendingLimitDisplay` — live
  updates as user drags slider. These are dynamically created DOM elements
  inside the modal, not index.html stubs.
- Ticket pricing: `ticketPriceDisplay`, `ticketPriceEffect` — same pattern.
- Financial transition: `financialTransitionModal`,
  `transitionSpendingPct`, `transitionSpendingLimit`, `transitionCapSpace` —
  the transition modal during promo/rel. React `FinancialTransitionModal`
  exists and is registered.
- Owner mode displays: `ownerSpendingDisplay`, `ownerLimitDisplay`.

**What to do:**
1. Verify FinancesScreen.jsx (634 lines) handles all dashboard functionality
2. Verify FinancialTransitionModal handles promo/rel briefing
3. Gut the DOM code, keep the engine calls (FinanceEngine, SalaryCapEngine)
4. Remove stubs: `financeDashboardModal`, `financeDashboardCloseBtn`,
   `financeDashboardContent`, `financialTransitionModal`,
   `financialTransitionContent` (5 stubs)

**React components:** FinancesScreen.jsx (634 lines) — sidebar screen with
spending sliders, ticket pricing, sponsor management. FinanceDashboardModal.jsx,
FinancialTransitionModal.jsx, OwnerModeModal.jsx — all registered in App.jsx.

**Dependencies:** FinanceEngine.js, SalaryCapEngine.js (pure logic, no DOM).

**Estimated effort:** Medium. Need to verify React components cover all
interactive elements (sliders, real-time displays).

**Test:** Open finances from sidebar. Adjust spending slider. Change ticket
prices. Accept/decline sponsor offers. Complete offseason promo/rel transition.


### Session D: RosterController.js (23 calls) — MEDIUM MIGRATION

**Current state:**
- `showRosterManagement()`: Builds roster display via `UIRenderer`, writes to
  `positionBreakdown`, `rosterCount`, `capStatus`, `currentRoster`. Shows
  `rosterModal`. React `RosterScreen.jsx` (1,479 lines) handles all of this.
- `openScouting()`: Opens `scoutingModal`, builds scout tabs. React
  `ScoutingScreen.jsx` (1,036 lines) handles scouting. Several scout tab IDs
  (`scoutTabScanner`, `scoutTabPipeline`, `scoutTabWatchlist`,
  `scoutTabNeeds`) were already removed from index.html in Phase 1 — some
  controller calls are already silently failing.
- Filter/sort for scouting: `scoutPos`, `scoutTier`, `scoutMinAge`,
  `scoutMaxAge`, `scoutMinRating`, `scoutMaxRating`, `scoutContract`,
  `scoutSort` — reads from DOM select elements that don't exist (returns
  undefined/null, falls through to defaults).
- `scoutTabContent`: Still in index.html (5 refs), used to render scout
  results.
- `watchlistCount`: Still in index.html (1 ref).

**What to do:**
1. Verify RosterScreen.jsx covers roster display, position breakdown, release
2. Verify ScoutingScreen.jsx covers all scout tabs, filtering, pipeline
3. Gut DOM code in controller
4. Remove stubs: `rosterModal`, `positionBreakdown`, `rosterCount`,
   `capStatus`, `currentRoster`, `positionFilter`, `tierFilter`,
   `freeAgentsList`, `scoutingModal`, `watchlistCount`, `scoutTabContent`
   (11 stubs)

**React components:** RosterScreen.jsx (1,479 lines) — comprehensive roster
management with release button, compliance banners, position breakdown.
ScoutingScreen.jsx (1,036 lines) — full scouting with tabs, filters,
pipeline, watchlist. RosterModal.jsx — registered in App.jsx.

**Dependencies:** LeagueManager.js, SalaryCapEngine.js (pure logic).

**Estimated effort:** Medium. Large React components already exist and are
mature. Main work is verifying coverage and removing dead code.

**Test:** Open roster from sidebar. View position breakdown. Release a player.
Open scouting. Filter by position/tier/age. Check pipeline. Check watchlist.


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

| Session | Stubs to remove | Count |
|---------|----------------|------:|
| A (Trade) | tradeModal, tradePositionBreakdown, tradePartnerSelect, tradeInterface, yourTradeRoster, yourTradePicksHeader, yourTradePicks, aiTradeRoster, aiTradePicksHeader, aiTradePicks, tradeSummary, tradeYourValue, tradeAiValue, tradeNetValue, noTradePartner, aiTradeProposalModal | 16 |
| B (Coach) | coachModal, coachModalContent | 2 |
| C (Finance) | financeDashboardModal, financeDashboardCloseBtn, financeDashboardContent, financialTransitionModal, financialTransitionContent | 5 |
| D (Roster) | rosterModal, positionBreakdown, rosterCount, capStatus, currentRoster, positionFilter, tierFilter, freeAgentsList, scoutingModal, watchlistCount, scoutTabContent | 11 |
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
