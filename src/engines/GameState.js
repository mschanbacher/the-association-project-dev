// ═══════════════════════════════════════════════════════════════════
// GameState — Central game state with serialization/deserialization
// ═══════════════════════════════════════════════════════════════════

import { CoachEngine } from './CoachEngine.js';

export 
class GameState {
    constructor() {
        // === SEASON & USER INFO ===
        this._currentSeason = 2025;
        this._currentTier = 1;
        this._userTeamId = null;
        this._currentGame = 0;
        this._currentMode = 'gm'; // 'gm', 'coach', or 'board'
        
        // === CALENDAR SYSTEM ===
        this._currentDate = null; // YYYY-MM-DD string, set when season starts
        this._seasonStartYear = 2025; // The year the season begins (Oct)
        this._seasonDates = null; // Cached season dates object
        
        // === TEAMS ===
        this._tier1Teams = [];
        this._tier2Teams = [];
        this._tier3Teams = [];
        
        // === SCHEDULES ===
        this._schedule = []; // Current tier schedule
        this._tier1Schedule = [];
        this._tier2Schedule = [];
        this._tier3Schedule = [];
        
        // === DRAFT SYSTEM ===
        this._draftPickOwnership = {}; // { teamId: { year: { round1: ownerId, round2: ownerId } } }
        this._promotedToT1 = []; // Track teams promoted to T1 for compensatory picks
        this._relegatedFromT1 = [];
        
        // === FREE AGENCY ===
        this._freeAgents = [];
        
        // === PLAYER ID SYSTEM ===
        // Monotonically increasing counter for all player generation.
        // Replaces range-based schemes (teamId*1000, 100000+season*1000, 800000+)
        // that could collide across seasons. Seeded at 2000000 to avoid overlap
        // with any legacy IDs from existing saves.
        this._nextPlayerId = 2000000;
        
        // === TRADING ===
        this._pendingTradeProposal = null;
        
        // === HISTORY ===
        this._seasonHistory = [];
        this._championshipHistory = [];
        this._fullSeasonHistory = []; // Detailed season snapshots (standings, awards, champions)
        
        // === METADATA ===
        this._lastSaveTime = null;
        this._gameVersion = '4.0';
        
        // ══════════════════════════════════════════════════════════════
        // SEASON / OFFSEASON FLOW STATE
        // Previously ad-hoc properties set via proxy. Now formalized.
        // Persistent = survives save/load. Transient = session only.
        // ══════════════════════════════════════════════════════════════
        
        // --- Persistent: survives save/load ---
        this._offseasonPhase = 'none';        // Current offseason phase (see OffseasonController.PHASES)
        this._retirementHistory = [];          // Accumulates across seasons
        this._lastAiTradeCheck = 0;            // Game number of last AI trade check
        this._scoutingWatchList = [];           // User-curated scouting watch list
        this._tradeHistory = [];               // All trades (user + AI-AI) across seasons
        this._lastAiToAiTradeDate = null;      // Date string of last AI-AI trade check

        // --- Feature flags (persistent so mid-offseason saves respect the flag they started with) ---
        // _usePlayoffHub: when true, postseason routes to the new Playoff Hub screen instead of
        // the legacy ChampionshipPlayoffModal chain. Flip to true once PlayoffHub is built & tested.
        this._usePlayoffHub = true;
        this._pendingBreakingNews = null;       // Notable trade to show user
        
        // --- Persistent: playoff state (survives save/load during playoffs) ---
        this._postseasonResults = null;         // Playoff/promo-rel results for current offseason
        this._championshipPlayoffData = null;   // T1 interactive playoff bracket data
        this._t2PlayoffData = null;             // T2 interactive playoff state
        this._t3PlayoffData = null;             // T3 interactive playoff state
        
        // --- Transient: regenerated during gameplay, reset on load ---
        this._pendingInjuries = [];             // Injuries awaiting user decision
        this._userPlayoffResult = null;         // User's playoff outcome
        this._seasonEndData = null;             // Cached season-end summary for modals
        
        // --- Transient: offseason working data ---
        this._seasonRetirements = [];           // All retirements this offseason
        this._userTeamRetirements = [];         // User's team retirements this offseason
        this._pendingExpiredDecisions = [];     // Player IDs with expiring contracts pending decision
        this._collegeGraduates = [];            // College players entering FA this offseason
        this._userFreeAgencyOffers = [];        // User's pending FA offers
        this._aiFreeAgencyOffers = [];          // AI-generated FA offers for display
        
        // --- Transient: All-Star event ---
        this._allStarCompleted = false;         // Whether All-Star weekend has run this season
        this._allStarResults = null;            // All-Star game results
        
        // --- Transient: UI state (candidates for relocation to controllers later) ---
        this._viewingTier = null;               // Which tier's standings are displayed
        this._standingsView = 'overall';        // 'overall' or 'division'
        this._pipelinePreview = null;           // Cached pipeline preview class
        this._pipelinePreviewSeason = null;     // Season the preview was generated for
    }
    
    // ============================================
    // GETTERS & SETTERS (with validation)
    // ============================================
    
    get currentSeason() { return this._currentSeason; }
    set currentSeason(value) {
        if (value < 2025) throw new Error('Invalid season year');
        this._currentSeason = value;
    }
    
    // Convenience getter: returns formatted "2025-26" string.
    // Fixes pre-existing bug where gameState.season was always undefined.
    get season() {
        return `${this._currentSeason}-${String(this._currentSeason + 1).slice(-2)}`;
    }
    
    get currentTier() { return this._currentTier; }
    set currentTier(value) {
        if (![1, 2, 3].includes(value)) throw new Error('Tier must be 1, 2, or 3');
        this._currentTier = value;
    }
    
    get userTeamId() { return this._userTeamId; }
    set userTeamId(value) {
        if (value !== null && !this.getTeamById(value)) {
            throw new Error('Invalid team ID');
        }
        this._userTeamId = value;
    }
    
    get currentGame() { return this._currentGame; }
    set currentGame(value) {
        if (value < 0) throw new Error('Game number cannot be negative');
        this._currentGame = value;
    }
    
    get currentDate() { return this._currentDate; }
    set currentDate(value) { this._currentDate = value; }
    
    get seasonStartYear() { return this._seasonStartYear; }
    set seasonStartYear(value) { this._seasonStartYear = value; }
    
    get seasonDates() {
        if (!this._seasonDates) {
            this._seasonDates = CalendarEngine.getSeasonDates(this._seasonStartYear);
        }
        return this._seasonDates;
    }
    set seasonDates(value) { this._seasonDates = value; }
    
    get currentMode() { return this._currentMode; }
    set currentMode(value) {
        if (!['gm', 'coach', 'board'].includes(value)) {
            throw new Error('Mode must be gm, coach, or board');
        }
        this._currentMode = value;
    }
    
    // Direct access to arrays (with setters for assignment compatibility)
    get tier1Teams() { return this._tier1Teams; }
    set tier1Teams(value) { this._tier1Teams = value; }
    get tier2Teams() { return this._tier2Teams; }
    set tier2Teams(value) { this._tier2Teams = value; }
    get tier3Teams() { return this._tier3Teams; }
    set tier3Teams(value) { this._tier3Teams = value; }
    get schedule() { return this._schedule; }
    set schedule(value) { this._schedule = value; }
    get tier1Schedule() { return this._tier1Schedule; }
    set tier1Schedule(value) { this._tier1Schedule = value; }
    get tier2Schedule() { return this._tier2Schedule; }
    set tier2Schedule(value) { this._tier2Schedule = value; }
    get tier3Schedule() { return this._tier3Schedule; }
    set tier3Schedule(value) { this._tier3Schedule = value; }
    get freeAgents() { return this._freeAgents; }
    set freeAgents(value) { this._freeAgents = value; }
    get nextPlayerId() { return this._nextPlayerId; }
    set nextPlayerId(value) { this._nextPlayerId = value; }
    
    /**
     * Get the next unique player ID and increment the counter.
     * All player generation should use this instead of range-based IDs.
     * @param {number} [count=1] - Number of IDs to reserve (returns the first)
     * @returns {number} The first reserved ID
     */
    getNextPlayerId(count = 1) {
        const id = this._nextPlayerId;
        this._nextPlayerId += count;
        return id;
    }
    get draftPickOwnership() { return this._draftPickOwnership; }
    set draftPickOwnership(value) { this._draftPickOwnership = value; }
    get promotedToT1() { return this._promotedToT1; }
    set promotedToT1(value) { this._promotedToT1 = value; }
    get relegatedFromT1() { return this._relegatedFromT1; }
    set relegatedFromT1(value) { this._relegatedFromT1 = value; }
    get pendingTradeProposal() { return this._pendingTradeProposal; }
    set pendingTradeProposal(value) { this._pendingTradeProposal = value; }
    get seasonHistory() { return this._seasonHistory; }
    set seasonHistory(value) { this._seasonHistory = value; }
    get championshipHistory() { return this._championshipHistory; }
    set championshipHistory(value) { this._championshipHistory = value; }
    get fullSeasonHistory() { return this._fullSeasonHistory; }
    set fullSeasonHistory(value) { this._fullSeasonHistory = value; }
    
    // ============================================
    // SEASON / OFFSEASON FLOW (formalized from ad-hoc proxy properties)
    // ============================================
    
    // --- Persistent ---
    get offseasonPhase() { return this._offseasonPhase; }
    set offseasonPhase(value) { this._offseasonPhase = value; }

    get usePlayoffHub() { return this._usePlayoffHub; }
    set usePlayoffHub(value) { this._usePlayoffHub = !!value; }
    
    get retirementHistory() { return this._retirementHistory; }
    set retirementHistory(value) { this._retirementHistory = value; }
    
    get lastAiTradeCheck() { return this._lastAiTradeCheck; }
    set lastAiTradeCheck(value) { this._lastAiTradeCheck = value; }
    
    get scoutingWatchList() { return this._scoutingWatchList; }
    set scoutingWatchList(value) { this._scoutingWatchList = value; }

    get tradeHistory() { return this._tradeHistory; }
    set tradeHistory(value) { this._tradeHistory = value; }
    get lastAiToAiTradeDate() { return this._lastAiToAiTradeDate; }
    set lastAiToAiTradeDate(value) { this._lastAiToAiTradeDate = value; }
    get pendingBreakingNews() { return this._pendingBreakingNews; }
    set pendingBreakingNews(value) { this._pendingBreakingNews = value; }
    
    // --- Transient: season/offseason flow ---
    get pendingInjuries() { return this._pendingInjuries; }
    set pendingInjuries(value) { this._pendingInjuries = value; }
    
    get postseasonResults() { return this._postseasonResults; }
    set postseasonResults(value) { this._postseasonResults = value; }
    
    get championshipPlayoffData() { return this._championshipPlayoffData; }
    set championshipPlayoffData(value) { this._championshipPlayoffData = value; }
    
    get t2PlayoffData() { return this._t2PlayoffData; }
    set t2PlayoffData(value) { this._t2PlayoffData = value; }
    
    get t3PlayoffData() { return this._t3PlayoffData; }
    set t3PlayoffData(value) { this._t3PlayoffData = value; }
    
    get userPlayoffResult() { return this._userPlayoffResult; }
    set userPlayoffResult(value) { this._userPlayoffResult = value; }
    
    // Using underscore-prefixed names to match existing access patterns.
    // These are direct instance properties, not getter/setter pairs,
    // because calling code accesses them as gameState._seasonEndData etc.
    // No getter/setter indirection needed — direct property access works fine.
    
    // --- Transient: offseason working data ---
    get pendingExpiredDecisions() { return this._pendingExpiredDecisions; }
    set pendingExpiredDecisions(value) { this._pendingExpiredDecisions = value; }
    
    get collegeGraduates() { return this._collegeGraduates; }
    set collegeGraduates(value) { this._collegeGraduates = value; }
    
    get userFreeAgencyOffers() { return this._userFreeAgencyOffers; }
    set userFreeAgencyOffers(value) { this._userFreeAgencyOffers = value; }
    
    get aiFreeAgencyOffers() { return this._aiFreeAgencyOffers; }
    set aiFreeAgencyOffers(value) { this._aiFreeAgencyOffers = value; }
    
    // --- Transient: UI state ---
    get viewingTier() { return this._viewingTier; }
    set viewingTier(value) { this._viewingTier = value; }
    
    get standingsView() { return this._standingsView; }
    set standingsView(value) { this._standingsView = value; }
    
    // ============================================
    // TEAM MANAGEMENT
    // ============================================
    
    /**
     * Get the user's team
     */
    getUserTeam() {
        if (this._userTeamId === null) return null;
        return this.getCurrentTeams().find(t => t.id === this._userTeamId);
    }
    
    /**
     * Get teams for current tier
     */
    getCurrentTeams() {
        if (this._currentTier === 1) return this._tier1Teams;
        if (this._currentTier === 2) return this._tier2Teams;
        return this._tier3Teams;
    }
    
    /**
     * Get all teams across all tiers
     */
    getAllTeams() {
        return [...this._tier1Teams, ...this._tier2Teams, ...this._tier3Teams];
    }
    
    /**
     * Get team by ID (searches all tiers)
     */
    getTeamById(id) {
        return this.getAllTeams().find(t => t.id === id);
    }
    
    /**
     * Get teams by tier
     */
    getTeamsByTier(tier) {
        if (tier === 1) return this._tier1Teams;
        if (tier === 2) return this._tier2Teams;
        if (tier === 3) return this._tier3Teams;
        throw new Error('Invalid tier');
    }
    
    // ============================================
    // SCHEDULE MANAGEMENT
    // ============================================
    
    /**
     * Get the current schedule based on tier
     */
    getCurrentSchedule() {
        if (this._currentTier === 1) return this._tier1Schedule;
        if (this._currentTier === 2) return this._tier2Schedule;
        return this._tier3Schedule;
    }
    
    /**
     * Check if season is complete (all tiers' regular season games played)
     */
    isSeasonComplete() {
        // Check if ALL tiers are done (calendar-aware)
        const t1Done = !this._tier1Schedule || this._tier1Schedule.length === 0 || this._tier1Schedule.every(g => g.played);
        const t2Done = !this._tier2Schedule || this._tier2Schedule.length === 0 || this._tier2Schedule.every(g => g.played);
        const t3Done = !this._tier3Schedule || this._tier3Schedule.length === 0 || this._tier3Schedule.every(g => g.played);
        return t1Done && t2Done && t3Done;
    }
    
    /**
     * Get games played
     */
    getGamesPlayed() {
        return this._schedule.filter(g => g.played).length;
    }
    
    /**
     * Get total games in season for current tier
     */
    getTotalGamesInSeason() {
        if (this._currentTier === 1) return 82;
        if (this._currentTier === 2) return 60;
        return 40;
    }
    
    // ============================================
    // DRAFT MANAGEMENT
    // ============================================
    
    /**
     * Initialize draft pick ownership
     */
    initializeDraftPickOwnership() {
        if (!this._draftPickOwnership) {
            this._draftPickOwnership = {};
        }
        
        const allTeams = this.getAllTeams();
        
        // Initialize picks for next 5 years
        allTeams.forEach(team => {
            if (!this._draftPickOwnership[team.id]) {
                this._draftPickOwnership[team.id] = {};
            }
            
            for (let year = this._currentSeason; year <= this._currentSeason + 5; year++) {
                if (!this._draftPickOwnership[team.id][year]) {
                    this._draftPickOwnership[team.id][year] = {
                        round1: team.id,
                        round2: team.id
                    };
                }
            }
        });
    }
    
    /**
     * Get who owns a team's pick for a given year/round
     */
    getPickOwner(originalTeamId, year, round) {
        this.initializeDraftPickOwnership();
        
        const roundKey = `round${round}`;
        
        if (!this._draftPickOwnership[originalTeamId]?.[year]) {
            return originalTeamId; // Default: team owns their own pick
        }
        
        return this._draftPickOwnership[originalTeamId][year][roundKey] || originalTeamId;
    }
    
    /**
     * Trade a draft pick
     */
    tradeDraftPick(fromTeamId, toTeamId, originalTeamId, year, round) {
        // Check Ted Stepien Rule
        if (this.violatesStepienRule(originalTeamId, year, round)) {
            throw new Error('Trade violates Ted Stepien Rule (cannot trade first-round picks in consecutive years)');
        }
        
        this.initializeDraftPickOwnership();
        
        const roundKey = `round${round}`;
        
        if (!this._draftPickOwnership[originalTeamId]) {
            this._draftPickOwnership[originalTeamId] = {};
        }
        if (!this._draftPickOwnership[originalTeamId][year]) {
            this._draftPickOwnership[originalTeamId][year] = {};
        }
        
        this._draftPickOwnership[originalTeamId][year][roundKey] = toTeamId;
        
        const originalTeam = this.getTeamById(originalTeamId);
        const fromTeam = this.getTeamById(fromTeamId);
        const toTeam = this.getTeamById(toTeamId);
        
        console.log(`📝 Draft pick traded: ${originalTeam?.name}'s ${year} Round ${round}`);
        console.log(`   From: ${fromTeam?.name} → To: ${toTeam?.name}`);
    }
    
    /**
     * Check if trading a pick violates Ted Stepien Rule
     */
    violatesStepienRule(teamId, year, round) {
        if (round !== 1) return false; // Rule only applies to 1st rounders
        
        this.initializeDraftPickOwnership();
        
        // Check if team owns their 1st rounder in adjacent years
        const prevYearOwner = this.getPickOwner(teamId, year - 1, 1);
        const nextYearOwner = this.getPickOwner(teamId, year + 1, 1);
        
        // Violation: team doesn't own picks in BOTH adjacent years
        return prevYearOwner !== teamId && nextYearOwner !== teamId;
    }
    
    /**
     * Get all picks owned by a team for a given year
     */
    getPicksOwnedByTeam(teamId, year) {
        this.initializeDraftPickOwnership();
        
        const picks = [];
        const allTeams = this.getAllTeams();
        
        allTeams.forEach(originalTeam => {
            [1, 2].forEach(round => {
                const owner = this.getPickOwner(originalTeam.id, year, round);
                if (owner === teamId) {
                    picks.push({
                        originalTeamId: originalTeam.id,
                        originalTeamName: originalTeam.name,
                        year: year,
                        round: round
                    });
                }
            });
        });
        
        return picks;
    }
    
    // ============================================
    // PLAYOFF SERIALIZATION HELPERS
    // ============================================
    // Team objects in playoff data are live references to gameState team arrays.
    // For serialization we replace them with { _ref: teamId } markers,
    // and on deserialization we re-link them to the loaded team objects.
    
    /**
     * Returns true if `obj` looks like a team object (has id + roster/city).
     * Avoids false positives on series results, player objects, etc.
     */
    static _isTeamObj(obj) {
        return obj && typeof obj === 'object' && obj.id !== undefined && 
               (Array.isArray(obj.roster) || obj.city !== undefined || obj.division !== undefined) &&
               obj._ref === undefined;
    }
    
    /**
     * Recursively walk a data structure and replace team objects with { _ref: teamId }.
     * Preserves all non-team data (scores, strings, numbers, booleans, null) as-is.
     * Handles arrays, plain objects, and the known playoff sub-structures.
     */
    /**
     * Recursively dehydrate playoff data: replace team objects with {_ref: id}
     * markers and strip boxScore objects (large player stat arrays per game).
     * Combined into a single pass to avoid double-recursive walk.
     */
    static _dehydrate(obj) {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj !== 'object') return obj; // number, string, boolean
        
        // Team object → reference marker
        if (GameState._isTeamObj(obj)) {
            return { _ref: obj.id };
        }
        
        // Array → map each element
        if (Array.isArray(obj)) {
            return obj.map(item => GameState._dehydrate(item));
        }
        
        // Plain object → recurse into each value, skipping transient and boxScore keys
        const result = {};
        for (const key of Object.keys(obj)) {
            if (key.startsWith('_pending') || key.startsWith('_current')) continue;
            if (key === 'boxScore') continue; // strip box scores (large per-game player stats)
            result[key] = GameState._dehydrate(obj[key]);
        }
        return result;
    }
    
    /**
     * Recursively walk a deserialized structure and replace { _ref: teamId }
     * markers with actual team objects from the provided lookup map.
     */
    static _rehydrate(obj, teamLookup) {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj !== 'object') return obj;
        
        // Reference marker → team object
        if (obj._ref !== undefined) {
            const team = teamLookup[obj._ref];
            if (!team) {
                console.warn(`⚠️ Playoff rehydrate: team ${obj._ref} not found`);
                return obj; // Leave marker as-is if team disappeared
            }
            return team;
        }
        
        // Array → map each element
        if (Array.isArray(obj)) {
            return obj.map(item => GameState._rehydrate(item, teamLookup));
        }
        
        // Plain object → recurse into each value
        const result = {};
        for (const key of Object.keys(obj)) {
            result[key] = GameState._rehydrate(obj[key], teamLookup);
        }
        return result;
    }
    
    // ============================================
    // SERIALIZATION (Save/Load)
    // ============================================
    
    /**
     * Serialize to JSON for saving
     */
    serialize() {
        // Compress schedules: store dates in a lookup table, games reference by index
        const compressSchedule = (schedule) => {
            if (!schedule || schedule.length === 0) return { dates: [], games: [] };
            
            // Build unique date lookup
            const dateSet = new Set();
            schedule.forEach(g => { if (g.date) dateSet.add(g.date); });
            const dates = [...dateSet].sort();
            const dateIndex = {};
            dates.forEach((d, i) => { dateIndex[d] = i; });
            
            // Compress games: [homeId, awayId, played(0/1), dateIndex]
            const games = schedule.map(g => [
                g.homeTeamId,
                g.awayTeamId,
                g.played ? 1 : 0,
                g.date ? (dateIndex[g.date] !== undefined ? dateIndex[g.date] : -1) : -1
            ]);
            
            return { dates, games };
        };
        
        // ═══════════════════════════════════════════════════════════
        // COMPACT PLAYER SERIALIZATION
        // Converts verbose player objects into compact arrays
        // Saves ~60-70% of player data size
        // ═══════════════════════════════════════════════════════════
        const ATTR_KEYS = ['speed','strength','verticality','endurance','basketballIQ','clutch','workEthic','coachability','collaboration'];
        const STAT_KEYS = ['gamesPlayed','gamesStarted','minutesPlayed','points','rebounds','assists','steals','blocks','turnovers','fouls','fieldGoalsMade','fieldGoalsAttempted','threePointersMade','threePointersAttempted','freeThrowsMade','freeThrowsAttempted'];
        
        const compressPlayer = (p) => {
            // Pack into compact object with short keys
            const cp = {
                i: p.id, n: p.name, p: p.position, r: p.rating, a: p.age, t: p.tier,
                s: p.salary, cy: p.contractYears, oc: p.originalContractLength,
                ch: Math.round(p.chemistry || 75), gw: p.gamesWithTeam || 0,
                is: p.injuryStatus === 'healthy' ? 0 : p.injuryStatus === 'out' ? 1 : 2,
                ft: Math.round(p.fatigue || 0), fth: p.fatigueThreshold || 75,
                gr: p.gamesRested || 0, gp: p.gamesPlayed || 0
            };
            // Injury details (only if injured)
            if (p.injury) cp.inj = p.injury;
            // Measurables as array: [height, weight, wingspan]
            if (p.measurables) cp.m = [p.measurables.height, p.measurables.weight, p.measurables.wingspan];
            // Attributes as array (ordered by ATTR_KEYS)
            if (p.attributes) cp.at = ATTR_KEYS.map(k => p.attributes[k] || 50);
            // Season stats as array (ordered by STAT_KEYS) — only non-zero
            if (p.seasonStats) {
                const sv = STAT_KEYS.map(k => p.seasonStats[k] || 0);
                if (sv.some(v => v !== 0)) cp.ss = sv;
            }
            // Preserve special flags
            if (p.isDraftProspect) cp.dp = 1;
            if (p.previousTeamId) cp.ptid = p.previousTeamId;
            if (p.previousSeasonAvgs) cp.psa = p.previousSeasonAvgs;
            return cp;
        };
        
        const compressCoach = (c) => {
            if (!c) return null;
            return {
                i: c.id, n: c.name, a: c.age, o: c.overall, ar: c.archetype, t: c.tier,
                s: c.salary, cy: c.contractYears, ti: c.teamId, ex: c.experience,
                cw: c.careerWins, cl: c.careerLosses, ch: c.championships,
                sw: c.seasonWins || 0, sl: c.seasonLosses || 0,
                tr: Object.values(c.traits || {})
            };
        };
        
        const compressTeam = (team) => {
            const ct = { ...team };
            ct.roster = (team.roster || []).map(compressPlayer);
            ct.coach = compressCoach(team.coach);
            return ct;
        };
        
        return JSON.stringify({
            _v: 4, // Save format version — v4 adds playoff state persistence
            currentSeason: this._currentSeason,
            currentTier: this._currentTier,
            userTeamId: this._userTeamId,
            currentGame: this._currentGame,
            currentMode: this._currentMode,
            currentDate: this._currentDate,
            seasonStartYear: this._seasonStartYear,
            tier1Teams: this._tier1Teams.map(compressTeam),
            tier2Teams: this._tier2Teams.map(compressTeam),
            tier3Teams: this._tier3Teams.map(compressTeam),
            tier1ScheduleC: compressSchedule(this._tier1Schedule),
            tier2ScheduleC: compressSchedule(this._tier2Schedule),
            tier3ScheduleC: compressSchedule(this._tier3Schedule),
            draftPickOwnership: this._draftPickOwnership,
            promotedToT1: this._promotedToT1,
            relegatedFromT1: this._relegatedFromT1,
            freeAgents: (this._freeAgents || []).map(compressPlayer),
            nextPlayerId: this._nextPlayerId,
            pendingTradeProposal: this._pendingTradeProposal,
            seasonHistory: this._seasonHistory,
            championshipHistory: this._championshipHistory,
            fullSeasonHistory: this._fullSeasonHistory,
            // v3: persistent state that previously wasn't saved
            offseasonPhase: this._offseasonPhase,
            retirementHistory: this._retirementHistory,
            lastAiTradeCheck: this._lastAiTradeCheck,
            scoutingWatchList: this._scoutingWatchList,
            tradeHistory: this._tradeHistory,
            lastAiToAiTradeDate: this._lastAiToAiTradeDate,
            // Feature flags
            usePlayoffHub: this._usePlayoffHub,
            // v4: playoff state persistence (dehydrated: team objects → {_ref: id}, boxScores stripped)
            postseasonResults: GameState._dehydrate(this._postseasonResults),
            championshipPlayoffData: GameState._dehydrate(this._championshipPlayoffData),
            t2PlayoffData: GameState._dehydrate(this._t2PlayoffData),
            t3PlayoffData: GameState._dehydrate(this._t3PlayoffData),
            lastSaveTime: new Date().toISOString(),
            gameVersion: this._gameVersion
        });
    }
    
    /**
     * Deserialize from JSON (load game)
     */
    static deserialize(jsonString) {
        const data = JSON.parse(jsonString);
        const state = new GameState();
        
        // Decompress schedule from compact format
        const decompressSchedule = (compressed) => {
            if (!compressed || !compressed.dates || !compressed.games) return [];
            const dates = compressed.dates;
            return compressed.games.map(g => ({
                homeTeamId: g[0],
                awayTeamId: g[1],
                played: g[2] === 1,
                date: g[3] >= 0 && g[3] < dates.length ? dates[g[3]] : null
            }));
        };
        
        // ═══════════════════════════════════════════════════════════
        // DECOMPRESS PLAYER AND COACH DATA (v2 format)
        // ═══════════════════════════════════════════════════════════
        const ATTR_KEYS = ['speed','strength','verticality','endurance','basketballIQ','clutch','workEthic','coachability','collaboration'];
        const STAT_KEYS = ['gamesPlayed','gamesStarted','minutesPlayed','points','rebounds','assists','steals','blocks','turnovers','fouls','fieldGoalsMade','fieldGoalsAttempted','threePointersMade','threePointersAttempted','freeThrowsMade','freeThrowsAttempted'];
        const COACH_TRAIT_KEYS = ['pace','threePointTendency','defensiveIntensity','ballMovement','benchUsage','playerDevelopment','adaptability'];
        const isV2 = data._v >= 2;
        
        const decompressPlayer = (cp) => {
            if (!cp || cp.name !== undefined) return cp; // Already full format (legacy)
            const injMap = { 0: 'healthy', 1: 'out', 2: 'day-to-day' };
            const p = {
                id: cp.i, name: cp.n, position: cp.p, rating: cp.r, age: cp.a, tier: cp.t,
                salary: cp.s, contractYears: cp.cy, originalContractLength: cp.oc,
                chemistry: cp.ch || 75, gamesWithTeam: cp.gw || 0,
                injuryStatus: injMap[cp.is] || 'healthy',
                injury: cp.inj || null,
                fatigue: cp.ft || 0, fatigueThreshold: cp.fth || 75,
                gamesRested: cp.gr || 0, gamesPlayed: cp.gp || 0,
                minutesThisGame: 0, resting: false
            };
            // Measurables
            if (cp.m) p.measurables = { height: cp.m[0], weight: cp.m[1], wingspan: cp.m[2] };
            // Attributes
            if (cp.at) {
                p.attributes = {};
                ATTR_KEYS.forEach((k, idx) => { p.attributes[k] = cp.at[idx] || 50; });
            }
            // Season stats
            p.seasonStats = {};
            STAT_KEYS.forEach((k, idx) => { p.seasonStats[k] = (cp.ss && cp.ss[idx]) || 0; });
            // Special flags
            if (cp.dp) p.isDraftProspect = true;
            if (cp.ptid) p.previousTeamId = cp.ptid;
            if (cp.psa) p.previousSeasonAvgs = cp.psa;
            return p;
        };
        
        const decompressCoach = (cc) => {
            if (!cc) return null;
            if (cc.name !== undefined) return cc; // Already full format (legacy)
            const c = {
                id: cc.i, name: cc.n, age: cc.a, overall: cc.o, archetype: cc.ar, tier: cc.t,
                salary: cc.s, contractYears: cc.cy, teamId: cc.ti, experience: cc.ex,
                careerWins: cc.cw, careerLosses: cc.cl, championships: cc.ch,
                seasonWins: cc.sw || 0, seasonLosses: cc.sl || 0, traits: {}
            };
            if (cc.tr && Array.isArray(cc.tr)) {
                COACH_TRAIT_KEYS.forEach((k, idx) => { c.traits[k] = cc.tr[idx] || 50; });
            }
            return c;
        };
        
        const decompressTeam = (team) => {
            if (!team) return team;
            if (isV2 && team.roster) {
                team.roster = team.roster.map(decompressPlayer);
            }
            if (isV2 && team.coach !== undefined) {
                team.coach = decompressCoach(team.coach);
            }
            return team;
        };
        
        // Restore all properties
        state._currentSeason = data.currentSeason;
        state._currentTier = data.currentTier;
        state._userTeamId = data.userTeamId;
        state._currentGame = data.currentGame || 0;
        state._currentMode = data.currentMode || 'gm';
        state._currentDate = data.currentDate || null;
        state._seasonStartYear = data.seasonStartYear || data.currentSeason || 2025;
        state._tier1Teams = (data.tier1Teams || []).map(decompressTeam);
        state._tier2Teams = (data.tier2Teams || []).map(decompressTeam);
        state._tier3Teams = (data.tier3Teams || []).map(decompressTeam);
        
        // Load schedules: try compressed format first, fall back to uncompressed
        if (data.tier1ScheduleC) {
            state._tier1Schedule = decompressSchedule(data.tier1ScheduleC);
            state._tier2Schedule = decompressSchedule(data.tier2ScheduleC);
            state._tier3Schedule = decompressSchedule(data.tier3ScheduleC);
            console.log('📦 Loaded compressed schedules');
        } else {
            state._tier1Schedule = data.tier1Schedule || [];
            state._tier2Schedule = data.tier2Schedule || [];
            state._tier3Schedule = data.tier3Schedule || [];
        }
        
        // Set _schedule as reference to user's tier schedule
        if (state._currentTier === 1) state._schedule = state._tier1Schedule;
        else if (state._currentTier === 2) state._schedule = state._tier2Schedule;
        else state._schedule = state._tier3Schedule;
        
        state._draftPickOwnership = data.draftPickOwnership || {};
        state._promotedToT1 = data.promotedToT1 || [];
        state._relegatedFromT1 = data.relegatedFromT1 || [];
        state._freeAgents = isV2 ? (data.freeAgents || []).map(decompressPlayer) : (data.freeAgents || []);
        
        // Player ID counter: load from save, or compute safe default for legacy saves
        if (data.nextPlayerId) {
            state._nextPlayerId = data.nextPlayerId;
        } else {
            // Legacy save — scan all existing player IDs to find a safe starting point
            let maxId = 2000000;
            const scanRoster = (teams) => {
                teams.forEach(t => {
                    (t.roster || []).forEach(p => {
                        if (p.id && p.id > maxId) maxId = p.id;
                    });
                });
            };
            scanRoster(state._tier1Teams);
            scanRoster(state._tier2Teams);
            scanRoster(state._tier3Teams);
            (state._freeAgents || []).forEach(p => {
                if (p.id && p.id > maxId) maxId = p.id;
            });
            state._nextPlayerId = maxId + 1000; // 1000 buffer above highest existing ID
            console.log(`[GameState] Legacy save: computed _nextPlayerId = ${state._nextPlayerId} (maxId found: ${maxId})`);
        }
        
        state._pendingTradeProposal = data.pendingTradeProposal || null;
        state._seasonHistory = data.seasonHistory || [];
        state._championshipHistory = data.championshipHistory || [];
        state._fullSeasonHistory = data.fullSeasonHistory || [];
        state._lastSaveTime = data.lastSaveTime;
        state._gameVersion = data.gameVersion || '3.0';
        
        // v3: persistent state (safe defaults for v2 saves missing these fields)
        state._offseasonPhase = data.offseasonPhase || 'none';
        state._retirementHistory = data.retirementHistory || [];
        state._lastAiTradeCheck = data.lastAiTradeCheck || 0;
        state._scoutingWatchList = data.scoutingWatchList || [];
        state._tradeHistory = data.tradeHistory || [];
        state._lastAiToAiTradeDate = data.lastAiToAiTradeDate || null;
        // Feature flags — PlayoffHub is now the only postseason path; always true
        // regardless of what old saves stored, so stale false values don't revert behavior.
        state._usePlayoffHub = true;
        
        // v4: playoff state persistence (rehydrate team references)
        if (data._v >= 4 && (data.postseasonResults || data.championshipPlayoffData || data.t2PlayoffData || data.t3PlayoffData)) {
            // Build team lookup map: id → team object
            const teamLookup = {};
            for (const team of [...state._tier1Teams, ...state._tier2Teams, ...state._tier3Teams]) {
                teamLookup[team.id] = team;
            }
            
            state._postseasonResults = data.postseasonResults 
                ? GameState._rehydrate(data.postseasonResults, teamLookup) : null;
            state._championshipPlayoffData = data.championshipPlayoffData 
                ? GameState._rehydrate(data.championshipPlayoffData, teamLookup) : null;
            state._t2PlayoffData = data.t2PlayoffData 
                ? GameState._rehydrate(data.t2PlayoffData, teamLookup) : null;
            state._t3PlayoffData = data.t3PlayoffData 
                ? GameState._rehydrate(data.t3PlayoffData, teamLookup) : null;
            
            console.log('🏆 Playoff state restored from save');
        }
        
        console.log(`📁 Game loaded: Season ${state._currentSeason}, ${state._tier1Teams.length + state._tier2Teams.length + state._tier3Teams.length} teams${isV2 ? ' (v2+ compressed)' : ''}`);
        
        return state;
    }
}
