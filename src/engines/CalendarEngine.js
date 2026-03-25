// ═══════════════════════════════════════════════════════════════════
// CalendarEngine — Season schedule, calendar dates, event tracking
// ═══════════════════════════════════════════════════════════════════

import { DivisionManager } from './DivisionManager.js';

export class CalendarEngine {
    
    /**
     * Get season calendar dates for a given start year
     * All tiers end on the same date, staggered starts
     */
    static getSeasonDates(startYear) {
        // Find the third Tuesday of October for T1 start
        const t1Start = CalendarEngine.getNthDayOfWeek(startYear, 9, 2, 3); // Oct, Tue, 3rd
        // First Tuesday of November for T2
        const t2Start = CalendarEngine.getNthDayOfWeek(startYear, 10, 2, 1); // Nov, Tue, 1st
        // First Tuesday of December for T3
        const t3Start = CalendarEngine.getNthDayOfWeek(startYear, 11, 2, 1); // Dec, Tue, 1st
        
        // All tiers end on April 12 of start year + 1
        const seasonEnd = new Date(startYear + 1, 3, 12); // Apr 12
        
        // All-Star break: Feb 13-18
        const allStarStart = new Date(startYear + 1, 1, 13); // Feb 13
        const allStarEnd = new Date(startYear + 1, 1, 18);   // Feb 18
        
        // Universal trade deadline: March 5
        const tradeDeadline = new Date(startYear + 1, 2, 5); // Mar 5
        
        // Training camp dates — staggered by tier, ~3 weeks each.
        // Camp opens 21 days before the NEXT season start, cutdown is day before.
        // These are offseason events, so they use startYear+1 tier start dates.
        // T1 cuts flow to FA pool for T2 camp invites, T2 cuts flow for T3.
        const nextT1Start = CalendarEngine.getNthDayOfWeek(startYear + 1, 9, 2, 3); // Next season's Oct 3rd Tue
        const nextT2Start = CalendarEngine.getNthDayOfWeek(startYear + 1, 10, 2, 1); // Next season's Nov 1st Tue
        const nextT3Start = CalendarEngine.getNthDayOfWeek(startYear + 1, 11, 2, 1); // Next season's Dec 1st Tue
        const t1CampOpen = new Date(nextT1Start.getTime() - 21 * 86400000);   // ~Oct 1 of startYear+1
        const t1Cutdown = new Date(nextT1Start.getTime() - 1 * 86400000);     // Day before next T1 start
        const t2CampOpen = new Date(nextT1Start);                              // T2 camp opens when next T1 season starts
        const t2Cutdown = new Date(nextT2Start.getTime() - 1 * 86400000);     // Day before next T2 start
        const t3CampOpen = new Date(nextT2Start);                              // T3 camp opens when next T2 season starts
        const t3Cutdown = new Date(nextT3Start.getTime() - 1 * 86400000);     // Day before next T3 start
        
        return {
            t1Start,
            t2Start,
            t3Start,
            seasonEnd,
            allStarStart,
            allStarEnd,
            tradeDeadline,
            // Postseason dates
            playoffsStart: new Date(startYear + 1, 3, 16),     // Apr 16
            seasonOfficialEnd: new Date(startYear + 1, 5, 1),  // Jun 1
            draftLottery: new Date(startYear + 1, 5, 8),       // Jun 8
            draftDay: new Date(startYear + 1, 5, 15),          // Jun 15
            collegeFA: new Date(startYear + 1, 5, 22),         // Jun 22 (legacy: grads now generated at draft time, flow to FA pool)
            contractExpiration: new Date(startYear + 1, 5, 30), // Jun 30
            freeAgencyStart: new Date(startYear + 1, 6, 1),    // Jul 1
            freeAgencyEnd: new Date(startYear + 1, 6, 15),     // Jul 15
            rosterCompliance: new Date(startYear + 1, 6, 16),  // Jul 16
            playerDevelopment: new Date(startYear + 1, 7, 1),  // Aug 1
            ownerDecisions: new Date(startYear + 1, 7, 10),    // Aug 10
            trainingCamp: new Date(startYear + 1, 7, 16),      // Aug 16 (legacy: kept for backward compat)
            // Staggered training camp dates
            t1CampOpen,
            t1Cutdown,
            t2CampOpen,
            t2Cutdown,
            t3CampOpen,
            t3Cutdown,
        };
    }
    
    /**
     * Get the Nth occurrence of a day-of-week in a month
     * @param {number} year 
     * @param {number} month - 0-indexed (0=Jan, 9=Oct, etc.)
     * @param {number} dayOfWeek - 0=Sun, 1=Mon, 2=Tue, etc.
     * @param {number} nth - 1st, 2nd, 3rd, etc.
     */
    static getNthDayOfWeek(year, month, dayOfWeek, nth) {
        const firstOfMonth = new Date(year, month, 1);
        let dayOffset = dayOfWeek - firstOfMonth.getDay();
        if (dayOffset < 0) dayOffset += 7;
        const day = 1 + dayOffset + (nth - 1) * 7;
        return new Date(year, month, day);
    }
    
    /**
     * Format a date as YYYY-MM-DD string for storage and comparison
     */
    static toDateString(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    /**
     * Format a date for display: "Oct 21, 2025"
     */
    static formatDateDisplay(dateStr) {
        const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone issues
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }
    
    /**
     * Format a date short: "Oct 21"
     */
    static formatDateShort(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
    }
    /**
     * Check if a date falls within the All-Star break
     */
    static isAllStarBreak(dateStr, seasonDates) {
        const d = dateStr;
        const start = CalendarEngine.toDateString(seasonDates.allStarStart);
        const end = CalendarEngine.toDateString(seasonDates.allStarEnd);
        return d >= start && d <= end;
    }
    
    /**
     * Advance a date string by N days
     */
    static addDays(dateStr, days) {
        const d = new Date(dateStr + 'T12:00:00');
        d.setDate(d.getDate() + days);
        return CalendarEngine.toDateString(d);
    }
    
    /**
     * Get number of days between two date strings
     */
    static daysBetween(dateStr1, dateStr2) {
        const d1 = new Date(dateStr1 + 'T12:00:00');
        const d2 = new Date(dateStr2 + 'T12:00:00');
        return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    }
    
    /**
     * Generate a full calendar-aware schedule for a tier
     * @param {Array} teams - Array of team objects
     * @param {number} numGames - Games per team (82, 60, or 40)
     * @param {string} startDateStr - YYYY-MM-DD start date
     * @param {string} endDateStr - YYYY-MM-DD end date
     * @param {Object} seasonDates - Season dates object (for All-Star break)
     * @returns {Array} Schedule array with date-assigned games
     */
    static generateCalendarSchedule(teams, numGames, startDateStr, endDateStr, seasonDates, tier = 1) {
        console.log(`📅 Generating calendar schedule: ${teams.length} teams, ${numGames} games each, ${startDateStr} to ${endDateStr}, Tier ${tier}`);
        
        // Step 1: Generate all matchups — division-aware for T2/T3
        const matchups = (tier >= 2)
            ? CalendarEngine._generateDivisionMatchups(teams, numGames, tier)
            : CalendarEngine._generateMatchups(teams, numGames);
        console.log(`  Generated ${matchups.length} total matchups`);
        
        // Step 2: Generate the list of available game dates
        const gameDates = CalendarEngine._generateGameDates(startDateStr, endDateStr, seasonDates);
        console.log(`  Available game dates: ${gameDates.length}`);
        
        // Step 3: Distribute matchups across dates with rest constraints
        const schedule = CalendarEngine._distributeGamesToCalendar(matchups, gameDates, teams);
        console.log(`  Scheduled ${schedule.length} games across calendar`);
        
        return schedule;
    }
    
    /**
     * Generate all matchups for a tier (unordered) — random pairing
     * Used for Tier 1 only as a fallback; structured NBA scheduling below.
     */
    static _generateMatchups(teams, numGames) {
        // For T1, use the structured NBA approach
        if (teams.length === 30 && numGames === 82) {
            return CalendarEngine._generateNBAMatchups(teams);
        }

        // Fallback: random pairing (kept for any non-standard configuration)
        const matchups = [];
        const teamGameCounts = {};
        
        teams.forEach(team => {
            teamGameCounts[team.id] = 0;
        });
        
        let attempts = 0;
        const maxAttempts = numGames * teams.length * 2;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            const allTeamsFull = teams.every(team => teamGameCounts[team.id] >= numGames);
            if (allTeamsFull) break;
            
            const availableTeams = teams.filter(t => teamGameCounts[t.id] < numGames);
            if (availableTeams.length < 2) break;
            
            const team1 = availableTeams[Math.floor(Math.random() * availableTeams.length)];
            const otherTeams = availableTeams.filter(t => t.id !== team1.id);
            if (otherTeams.length === 0) break;
            
            const team2 = otherTeams[Math.floor(Math.random() * otherTeams.length)];
            
            if (Math.random() > 0.5) {
                matchups.push({ homeTeamId: team1.id, awayTeamId: team2.id, played: false });
            } else {
                matchups.push({ homeTeamId: team2.id, awayTeamId: team1.id, played: false });
            }
            
            teamGameCounts[team1.id]++;
            teamGameCounts[team2.id]++;
        }
        
        // Shuffle matchups before distributing
        for (let i = matchups.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [matchups[i], matchups[j]] = [matchups[j], matchups[i]];
        }
        
        return matchups;
    }

    // ─────────────────────────────────────────────────────────────────
    // NBA-STRUCTURED MATCHUP GENERATOR (Tier 1)
    // ─────────────────────────────────────────────────────────────────
    //
    // Models the real NBA schedule structure (82 games):
    //   • 4 division opponents × 4 games (2H + 2A) = 16
    //   • 10 conference non-division opponents:
    //       6 get 4 games (2H + 2A), 4 get 3 games (mixed) = 36
    //   • 15 cross-conference opponents × 2 games (1H + 1A) = 30
    //   Total: 16 + 36 + 30 = 82
    //
    // Which 6 conference opponents get 4 vs 3 is randomized per team
    // but balanced so the total matchup count across all pairs stays
    // consistent (each pair agrees on their game count).
    // ─────────────────────────────────────────────────────────────────

    static _generateNBAMatchups(teams) {
        const matchups = [];

        // Conference mapping
        const eastDivisions = ['Atlantic', 'Central', 'Southeast'];
        const westDivisions = ['Northwest', 'Pacific', 'Southwest'];

        const getConference = (team) => eastDivisions.includes(team.division) ? 'East' : 'West';

        // Group teams
        const divisionTeams = {};
        const conferenceTeams = { East: [], West: [] };
        teams.forEach(t => {
            if (!divisionTeams[t.division]) divisionTeams[t.division] = [];
            divisionTeams[t.division].push(t);
            conferenceTeams[getConference(t)].push(t);
        });

        // Helper: add N games between two teams with balanced H/A
        const addGames = (team1, team2, count) => {
            const homeFor1 = Math.ceil(count / 2);
            const homeFor2 = Math.floor(count / 2);
            // Randomize who gets the extra home game for odd counts
            let t1Home, t2Home;
            if (count % 2 === 0) {
                t1Home = count / 2;
                t2Home = count / 2;
            } else {
                if (Math.random() < 0.5) {
                    t1Home = homeFor1;
                    t2Home = homeFor2;
                } else {
                    t1Home = homeFor2;
                    t2Home = homeFor1;
                }
            }
            for (let i = 0; i < t1Home; i++) {
                matchups.push({ homeTeamId: team1.id, awayTeamId: team2.id, played: false });
            }
            for (let i = 0; i < t2Home; i++) {
                matchups.push({ homeTeamId: team2.id, awayTeamId: team1.id, played: false });
            }
        };

        // ═══════════════════════════════════════════════════════════
        // Determine game counts for conference non-division matchups
        // ═══════════════════════════════════════════════════════════
        // Each team plays 10 conference non-division opponents: 6 get 4 games, 4 get 3.
        // We need both teams in a pair to agree on the count.
        // Approach: for each conference, build the pair-game-count map globally.

        const pairGameCount = {}; // "id1-id2" -> 3 or 4
        const pairKey = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;

        for (const conf of ['East', 'West']) {
            const confDivisions = conf === 'East' ? eastDivisions : westDivisions;

            // For each pair of divisions in this conference, assign 4-game vs 3-game
            // matchups. Each team needs exactly 3 four-game opponents from each of
            // the other 2 divisions (totaling 6 fours, 4 threes across 10 opponents).
            //
            // Between two divisions of 5 teams each (25 pairs), we need each team
            // to have exactly 3 fours. That means 15 four-game pairs and 10 three-game
            // pairs per division pair. This is solved by random permutation matrices.

            for (let d1 = 0; d1 < confDivisions.length; d1++) {
                for (let d2 = d1 + 1; d2 < confDivisions.length; d2++) {
                    const div1Teams = divisionTeams[confDivisions[d1]];
                    const div2Teams = divisionTeams[confDivisions[d2]];
                    const n1 = div1Teams.length; // 5
                    const n2 = div2Teams.length; // 5

                    // Build a matrix: fourGame[i][j] = true if div1Teams[i] vs div2Teams[j] is 4 games
                    // Constraint: each row sums to 3, each column sums to 3
                    // With 5×5 and sum=3, that's 15 fours out of 25 pairs.
                    //
                    // Simple construction: start with all-4, then randomly pick 2 per row to downgrade
                    // while maintaining column constraints.
                    
                    // Start: all matchups = 4 games
                    const fourGame = Array.from({ length: n1 }, () => Array(n2).fill(true));
                    
                    // Need to set exactly 2 per row to false (3-game), such that each column
                    // also has exactly 2 falses. This is equivalent to placing 2 "threes" per row
                    // with 2 per column — a problem of two non-overlapping permutation matrices.
                    
                    // Generate two random permutations of [0..n2-1]
                    const perm1 = [...Array(n2).keys()];
                    const perm2 = [...Array(n2).keys()];
                    
                    // Fisher-Yates shuffle
                    for (let i = perm1.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [perm1[i], perm1[j]] = [perm1[j], perm1[i]];
                    }
                    
                    // perm2 must not collide with perm1 in any position
                    let valid = false;
                    for (let attempt = 0; attempt < 100; attempt++) {
                        for (let i = perm2.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [perm2[i], perm2[j]] = [perm2[j], perm2[i]];
                        }
                        if (perm1.every((v, i) => v !== perm2[i])) {
                            valid = true;
                            break;
                        }
                    }
                    if (!valid) {
                        // Fallback: just offset perm2
                        for (let i = 0; i < n2; i++) perm2[i] = (perm1[i] + 1) % n2;
                        if (perm1.some((v, i) => v === perm2[i])) {
                            for (let i = 0; i < n2; i++) perm2[i] = (perm1[i] + 2) % n2;
                        }
                    }
                    
                    // Mark the two permutations as 3-game matchups
                    for (let i = 0; i < n1; i++) {
                        fourGame[i][perm1[i]] = false;
                        fourGame[i][perm2[i]] = false;
                    }
                    
                    // Write to pairGameCount
                    for (let i = 0; i < n1; i++) {
                        for (let j = 0; j < n2; j++) {
                            const key = pairKey(div1Teams[i].id, div2Teams[j].id);
                            pairGameCount[key] = fourGame[i][j] ? 4 : 3;
                        }
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════════════════
        // Generate all matchups
        // ═══════════════════════════════════════════════════════════

        let divGames = 0, confGames = 0, crossGames = 0;

        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                const t1 = teams[i], t2 = teams[j];
                const sameDiv = t1.division === t2.division;
                const sameConf = getConference(t1) === getConference(t2);

                let games;
                if (sameDiv) {
                    games = 4; // Division: 4 games (2H + 2A)
                    divGames += 4;
                } else if (sameConf) {
                    const key = pairKey(t1.id, t2.id);
                    games = pairGameCount[key] || 3;
                    confGames += games;
                } else {
                    games = 2; // Cross-conference: 2 games (1H + 1A)
                    crossGames += 2;
                }

                addGames(t1, t2, games);
            }
        }

        console.log(`    T1 NBA structure: ${divGames / 2} div pair-games, ${confGames / 2} conf pair-games, ${crossGames / 2} cross pair-games`);
        console.log(`    Total matchups: ${matchups.length}`);

        // Verify per-team game counts
        const teamCounts = {};
        teams.forEach(t => { teamCounts[t.id] = 0; });
        matchups.forEach(m => { teamCounts[m.homeTeamId]++; teamCounts[m.awayTeamId]++; });
        const counts = Object.values(teamCounts);
        const min = Math.min(...counts), max = Math.max(...counts);
        if (min !== 82 || max !== 82) {
            console.warn(`    ⚠️ T1 game count issue: min=${min} max=${max} (expected 82)`);
        }

        // Shuffle before calendar distribution
        for (let i = matchups.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [matchups[i], matchups[j]] = [matchups[j], matchups[i]];
        }

        return matchups;
    }
    
    // ─────────────────────────────────────────────────────────────────
    // DIVISION-AWARE MATCHUP GENERATOR (Tiers 2 & 3)
    // ─────────────────────────────────────────────────────────────────
    //
    // Priority:
    //   1. Intra-division: target 6 games per opponent (3H + 3A).
    //      If that would exceed numGames, reduce evenly, alternating
    //      3H/2A and 2H/3A across opponents for fairness.
    //   2. Neighbor divisions: fill remaining games.
    //      T3 stops here — never goes beyond neighbors.
    //   3. T2 only: neighbor-of-neighbor if still short.
    //
    // Produces the same { homeTeamId, awayTeamId, played } format.
    // ─────────────────────────────────────────────────────────────────

    static _generateDivisionMatchups(teams, numGames, tier) {
        const matchups = [];
        const teamGameCounts = {};
        // Track matchup counts between specific pairs: "id1-id2" -> { total, homeFor1, homeFor2 }
        const pairCounts = {};
        
        teams.forEach(t => { teamGameCounts[t.id] = 0; });

        const neighbors = tier === 2 ? DivisionManager.T2_NEIGHBORS : DivisionManager.T3_NEIGHBORS;

        // Group teams by division
        const divisionTeams = {};
        teams.forEach(t => {
            if (!divisionTeams[t.division]) divisionTeams[t.division] = [];
            divisionTeams[t.division].push(t);
        });

        // Helper: get a stable pair key
        const pairKey = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;

        // Helper: add a matchup between two teams, respecting home/away balance
        const addMatchup = (team1, team2) => {
            const key = pairKey(team1.id, team2.id);
            if (!pairCounts[key]) pairCounts[key] = { total: 0, homeFor: {} };
            const pc = pairCounts[key];
            if (!pc.homeFor[team1.id]) pc.homeFor[team1.id] = 0;
            if (!pc.homeFor[team2.id]) pc.homeFor[team2.id] = 0;

            // Give home to whichever team has fewer home games in this matchup
            let home, away;
            if (pc.homeFor[team1.id] <= pc.homeFor[team2.id]) {
                home = team1; away = team2;
            } else {
                home = team2; away = team1;
            }

            matchups.push({ homeTeamId: home.id, awayTeamId: away.id, played: false });
            pc.homeFor[home.id]++;
            pc.total++;
            teamGameCounts[home.id]++;
            teamGameCounts[away.id]++;
        };

        // ═══════════════════════════════════════════════════════════
        // PHASE 1: Intra-division games
        // ═══════════════════════════════════════════════════════════
        // Target 6 games per opponent (3H + 3A).
        // If (divSize - 1) * 6 > numGames, reduce to fit.

        for (const [divName, divTeams] of Object.entries(divisionTeams)) {
            const opponents = divTeams.length - 1;
            const maxIntraDivision = numGames; // can't exceed total season games
            let gamesPerOpponent = Math.min(6, Math.floor(maxIntraDivision / Math.max(1, opponents)));
            // Ensure even number for balanced H/A, or at least 2
            if (gamesPerOpponent < 2) gamesPerOpponent = 2;

            for (let i = 0; i < divTeams.length; i++) {
                for (let j = i + 1; j < divTeams.length; j++) {
                    for (let g = 0; g < gamesPerOpponent; g++) {
                        // Only add if both teams still need games
                        if (teamGameCounts[divTeams[i].id] < numGames &&
                            teamGameCounts[divTeams[j].id] < numGames) {
                            addMatchup(divTeams[i], divTeams[j]);
                        }
                    }
                }
            }
        }

        const intraDivCount = matchups.length;
        console.log(`    Phase 1 (intra-division): ${intraDivCount} games`);

        // ═══════════════════════════════════════════════════════════
        // PHASE 2: Neighbor division games
        // ═══════════════════════════════════════════════════════════
        // Fill remaining games from neighbor divisions.
        // Distribute evenly across neighbor teams.

        // Build neighbor team pool for each division
        const neighborPools = {};
        for (const [divName, neighborDivs] of Object.entries(neighbors)) {
            neighborPools[divName] = [];
            for (const nDiv of neighborDivs) {
                if (divisionTeams[nDiv]) {
                    neighborPools[divName].push(...divisionTeams[nDiv]);
                }
            }
        }

        // For each team that still needs games, schedule against neighbor teams
        // Do multiple passes to spread games evenly
        let neighborAdded = 0;
        const maxNeighborPasses = numGames; // enough passes to fill any schedule
        for (let pass = 0; pass < maxNeighborPasses; pass++) {
            let addedThisPass = 0;
            
            // Shuffle division order each pass for fairness
            const divNames = Object.keys(divisionTeams);
            for (let i = divNames.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [divNames[i], divNames[j]] = [divNames[j], divNames[i]];
            }
            
            for (const divName of divNames) {
                const divTeams = divisionTeams[divName];
                const pool = neighborPools[divName] || [];
                if (pool.length === 0) continue;

                for (const team of divTeams) {
                    if (teamGameCounts[team.id] >= numGames) continue;

                    // Find the neighbor opponent this team has played least
                    const candidates = pool
                        .filter(opp => teamGameCounts[opp.id] < numGames)
                        .sort((a, b) => {
                            const pcA = pairCounts[pairKey(team.id, a.id)];
                            const pcB = pairCounts[pairKey(team.id, b.id)];
                            return (pcA ? pcA.total : 0) - (pcB ? pcB.total : 0);
                        });

                    if (candidates.length > 0) {
                        addMatchup(team, candidates[0]);
                        addedThisPass++;
                    }
                }
            }

            neighborAdded += addedThisPass;
            if (addedThisPass === 0) break; // No more to add

            // Check if all teams are full
            if (teams.every(t => teamGameCounts[t.id] >= numGames)) break;
        }

        console.log(`    Phase 2 (neighbor): ${neighborAdded} games`);

        // ═══════════════════════════════════════════════════════════
        // PHASE 3: Neighbor-of-neighbor (Tier 2 only)
        // ═══════════════════════════════════════════════════════════
        // T3 stops at neighbors. T2 can extend one more hop if needed.

        if (tier === 2) {
            // Build extended pools: neighbors of neighbors (excluding own division)
            const extendedPools = {};
            for (const [divName, neighborDivs] of Object.entries(neighbors)) {
                const extended = new Set();
                // Add neighbor-of-neighbor divisions
                for (const nDiv of neighborDivs) {
                    if (neighbors[nDiv]) {
                        for (const nnDiv of neighbors[nDiv]) {
                            if (nnDiv !== divName && !neighborDivs.includes(nnDiv)) {
                                extended.add(nnDiv);
                            }
                        }
                    }
                }
                extendedPools[divName] = [];
                for (const nnDiv of extended) {
                    if (divisionTeams[nnDiv]) {
                        extendedPools[divName].push(...divisionTeams[nnDiv]);
                    }
                }
            }

            let extendedAdded = 0;
            for (let pass = 0; pass < numGames; pass++) {
                let addedThisPass = 0;

                for (const [divName, divTeams] of Object.entries(divisionTeams)) {
                    const pool = extendedPools[divName] || [];
                    if (pool.length === 0) continue;

                    for (const team of divTeams) {
                        if (teamGameCounts[team.id] >= numGames) continue;

                        const candidates = pool
                            .filter(opp => teamGameCounts[opp.id] < numGames)
                            .sort((a, b) => {
                                const pcA = pairCounts[pairKey(team.id, a.id)];
                                const pcB = pairCounts[pairKey(team.id, b.id)];
                                return (pcA ? pcA.total : 0) - (pcB ? pcB.total : 0);
                            });

                        if (candidates.length > 0) {
                            addMatchup(team, candidates[0]);
                            addedThisPass++;
                        }
                    }
                }

                extendedAdded += addedThisPass;
                if (addedThisPass === 0) break;
                if (teams.every(t => teamGameCounts[t.id] >= numGames)) break;
            }

            console.log(`    Phase 3 (extended neighbor): ${extendedAdded} games`);
        }

        // ═══════════════════════════════════════════════════════════
        // FALLBACK: If any team is still short, add random regional
        // ═══════════════════════════════════════════════════════════
        // FALLBACK: If any team is still short, add games
        // ═══════════════════════════════════════════════════════════
        let fallbackAdded = 0;
        for (let pass = 0; pass < numGames; pass++) {
            const shortTeams = teams.filter(t => teamGameCounts[t.id] < numGames);
            if (shortTeams.length === 0) break;

            let addedThisPass = 0;
            for (const team of shortTeams) {
                if (teamGameCounts[team.id] >= numGames) continue;

                // Prefer opponents who also need games, fall back to anyone
                const underTarget = teams
                    .filter(t => t.id !== team.id && teamGameCounts[t.id] < numGames);
                const atTarget = teams
                    .filter(t => t.id !== team.id && teamGameCounts[t.id] === numGames);
                const candidates = underTarget.length > 0 ? underTarget : atTarget;

                if (candidates.length > 0) {
                    // Pick the least-played opponent
                    candidates.sort((a, b) => {
                        const pcA = pairCounts[pairKey(team.id, a.id)];
                        const pcB = pairCounts[pairKey(team.id, b.id)];
                        return (pcA ? pcA.total : 0) - (pcB ? pcB.total : 0);
                    });
                    addMatchup(team, candidates[0]);
                    addedThisPass++;
                    fallbackAdded++;
                }
            }
            if (addedThisPass === 0) break;
        }
        if (fallbackAdded > 0) {
            console.log(`    ⚠️ Fallback: ${fallbackAdded} games added to fill schedules`);
        }

        // Log distribution summary
        const totalGames = matchups.length;
        const intraPct = ((intraDivCount / totalGames) * 100).toFixed(1);
        console.log(`    Summary: ${totalGames} total games (${intraPct}% intra-division)`);

        // Verify game counts
        const shortAfter = teams.filter(t => teamGameCounts[t.id] < numGames);
        const overAfter = teams.filter(t => teamGameCounts[t.id] > numGames);
        if (shortAfter.length > 0) {
            console.warn(`    ⚠️ ${shortAfter.length} teams under ${numGames} games:`,
                shortAfter.map(t => `${t.name}(${teamGameCounts[t.id]})`).join(', '));
        }
        if (overAfter.length > 0) {
            console.warn(`    ⚠️ ${overAfter.length} teams over ${numGames} games:`,
                overAfter.map(t => `${t.name}(${teamGameCounts[t.id]})`).join(', '));
        }

        // Shuffle before calendar distribution
        for (let i = matchups.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [matchups[i], matchups[j]] = [matchups[j], matchups[i]];
        }

        return matchups;
    }

    /**
     * Generate available game dates between start and end, excluding All-Star break
     * Weight days of week: Tue/Wed/Fri/Sat are primary, Mon/Thu/Sun are secondary
     */
    static _generateGameDates(startDateStr, endDateStr, seasonDates) {
        const dates = [];
        let current = startDateStr;
        
        while (current <= endDateStr) {
            // Skip All-Star break
            if (!CalendarEngine.isAllStarBreak(current, seasonDates)) {
                dates.push(current);
            }
            current = CalendarEngine.addDays(current, 1);
        }
        
        return dates;
    }
    
    /**
     * Distribute matchups across calendar dates
     * Ensures no team plays back-to-back-to-back (max 2 in 3 days)
     * Varies games per day based on day of week
     */
    static _distributeGamesToCalendar(matchups, gameDates, teams) {
        const schedule = [];
        const teamLastPlayed = {}; // teamId -> last date string played
        const teamPlayedRecently = {}; // teamId -> array of recent date strings
        
        teams.forEach(t => {
            teamLastPlayed[t.id] = null;
            teamPlayedRecently[t.id] = [];
        });
        
        // Calculate how many games per date we need on average
        const totalGames = matchups.length;
        const totalDates = gameDates.length;
        const avgGamesPerDate = totalGames / totalDates;
        
        // Day of week weights (0=Sun through 6=Sat)
        // Primary days: Tue(2), Wed(3), Fri(5), Sat(6) — get more games
        // Secondary days: Sun(0), Mon(1), Thu(4) — get fewer games
        const dayWeights = [0.6, 0.5, 1.0, 1.0, 0.6, 1.0, 1.0]; // Sun-Sat
        
        // Calculate target games for each date
        const totalWeight = gameDates.reduce((sum, dateStr) => {
            const d = new Date(dateStr + 'T12:00:00');
            return sum + dayWeights[d.getDay()];
        }, 0);
        
        const dateTargets = gameDates.map(dateStr => {
            const d = new Date(dateStr + 'T12:00:00');
            const weight = dayWeights[d.getDay()];
            // Target based on weight, with some variance
            let target = Math.round((weight / totalWeight) * totalGames);
            // Ensure reasonable bounds — at least 1 game on game days, cap at half the teams
            const maxGamesPerDay = Math.floor(teams.length / 2);
            target = Math.max(0, Math.min(target, maxGamesPerDay));
            return { date: dateStr, target, weight };
        });
        
        // Normalize targets to sum to totalGames
        let targetSum = dateTargets.reduce((s, d) => s + d.target, 0);
        
        // Adjust if total is off
        while (targetSum < totalGames) {
            // Add games to highest-weight days that aren't maxed
            const maxGamesPerDay = Math.floor(teams.length / 2);
            const eligible = dateTargets.filter(d => d.target < maxGamesPerDay);
            if (eligible.length === 0) break;
            // Sort by weight desc, pick the highest weight day with room
            eligible.sort((a, b) => b.weight - a.weight);
            eligible[Math.floor(Math.random() * Math.min(3, eligible.length))].target++;
            targetSum++;
        }
        while (targetSum > totalGames) {
            // Remove games from lowest-weight days
            const eligible = dateTargets.filter(d => d.target > 0);
            if (eligible.length === 0) break;
            eligible.sort((a, b) => a.weight - b.weight);
            eligible[Math.floor(Math.random() * Math.min(3, eligible.length))].target--;
            targetSum--;
        }
        
        // Now distribute matchups to dates
        let matchupIndex = 0;
        const unplaced = []; // matchups that couldn't be placed due to rest constraints
        
        for (const dateInfo of dateTargets) {
            const date = dateInfo.date;
            let gamesPlacedToday = 0;
            const teamsPlayingToday = new Set();
            
            // Try to place target number of games on this date
            const toPlace = Math.min(dateInfo.target, matchups.length - matchupIndex - unplaced.length + unplaced.length);
            
            // First try to place from unplaced queue
            const stillUnplaced = [];
            for (const game of unplaced) {
                if (gamesPlacedToday >= dateInfo.target) {
                    stillUnplaced.push(game);
                    continue;
                }
                
                const homeId = game.homeTeamId;
                const awayId = game.awayTeamId;
                
                if (teamsPlayingToday.has(homeId) || teamsPlayingToday.has(awayId)) {
                    stillUnplaced.push(game);
                    continue;
                }
                
                // Check back-to-back-to-back constraint
                if (CalendarEngine._wouldCauseB2B2B(homeId, date, teamPlayedRecently) ||
                    CalendarEngine._wouldCauseB2B2B(awayId, date, teamPlayedRecently)) {
                    stillUnplaced.push(game);
                    continue;
                }
                
                game.date = date;
                schedule.push(game);
                teamsPlayingToday.add(homeId);
                teamsPlayingToday.add(awayId);
                gamesPlacedToday++;
            }
            unplaced.length = 0;
            unplaced.push(...stillUnplaced);
            
            // Now place from main queue
            while (gamesPlacedToday < dateInfo.target && matchupIndex < matchups.length) {
                const game = matchups[matchupIndex];
                const homeId = game.homeTeamId;
                const awayId = game.awayTeamId;
                
                if (teamsPlayingToday.has(homeId) || teamsPlayingToday.has(awayId)) {
                    unplaced.push(game);
                    matchupIndex++;
                    continue;
                }
                
                if (CalendarEngine._wouldCauseB2B2B(homeId, date, teamPlayedRecently) ||
                    CalendarEngine._wouldCauseB2B2B(awayId, date, teamPlayedRecently)) {
                    unplaced.push(game);
                    matchupIndex++;
                    continue;
                }
                
                game.date = date;
                schedule.push(game);
                teamsPlayingToday.add(homeId);
                teamsPlayingToday.add(awayId);
                gamesPlacedToday++;
                matchupIndex++;
            }
            
            // Update recent play tracking for all teams that played today
            for (const teamId of teamsPlayingToday) {
                if (!teamPlayedRecently[teamId]) teamPlayedRecently[teamId] = [];
                teamPlayedRecently[teamId].push(date);
                // Keep only last 3 dates
                if (teamPlayedRecently[teamId].length > 3) {
                    teamPlayedRecently[teamId].shift();
                }
                teamLastPlayed[teamId] = date;
            }
        }
        
        // Place any remaining unplaced games on the last available dates
        // (relaxing constraints if necessary)
        if (unplaced.length > 0) {
            console.log(`  ⚠️ ${unplaced.length} games need force-placement`);
            let dateIdx = gameDates.length - 1;
            for (const game of unplaced) {
                // Find a date where neither team already plays
                let placed = false;
                for (let tries = 0; tries < gameDates.length && !placed; tries++) {
                    const tryDate = gameDates[(dateIdx - tries + gameDates.length) % gameDates.length];
                    const gamesOnDate = schedule.filter(g => g.date === tryDate);
                    const teamsOnDate = new Set();
                    gamesOnDate.forEach(g => { teamsOnDate.add(g.homeTeamId); teamsOnDate.add(g.awayTeamId); });
                    
                    if (!teamsOnDate.has(game.homeTeamId) && !teamsOnDate.has(game.awayTeamId)) {
                        game.date = tryDate;
                        schedule.push(game);
                        placed = true;
                    }
                }
                if (!placed) {
                    // Absolute fallback: just put it on the last date
                    game.date = gameDates[gameDates.length - 1];
                    schedule.push(game);
                }
                dateIdx--;
            }
        }
        
        // Sort schedule by date
        schedule.sort((a, b) => a.date.localeCompare(b.date));
        
        return schedule;
    }
    
    /**
     * Check if adding a game on `date` for `teamId` would cause 3 games in 3 consecutive days
     */
    static _wouldCauseB2B2B(teamId, dateStr, teamPlayedRecently) {
        const recent = teamPlayedRecently[teamId];
        if (!recent || recent.length < 2) return false;
        
        const yesterday = CalendarEngine.addDays(dateStr, -1);
        const dayBefore = CalendarEngine.addDays(dateStr, -2);
        
        const playedYesterday = recent.includes(yesterday);
        const playedDayBefore = recent.includes(dayBefore);
        
        // Would be 3 in a row if they played both yesterday AND day before
        return playedYesterday && playedDayBefore;
    }
    
    /**
     * Get all games scheduled for a specific date across all tier schedules
     */
    static getGamesForDate(dateStr, gameState) {
        const games = {
            tier1: [],
            tier2: [],
            tier3: [],
            total: 0
        };
        
        if (gameState.tier1Schedule) {
            games.tier1 = gameState.tier1Schedule.filter(g => g.date === dateStr);
        }
        if (gameState.tier2Schedule) {
            games.tier2 = gameState.tier2Schedule.filter(g => g.date === dateStr);
        }
        if (gameState.tier3Schedule) {
            games.tier3 = gameState.tier3Schedule.filter(g => g.date === dateStr);
        }
        
        games.total = games.tier1.length + games.tier2.length + games.tier3.length;
        return games;
    }
    
    /**
     * Get the next date that has any scheduled (unplayed) games
     * Checks TODAY first, then future dates
     */
    static getNextGameDate(currentDateStr, gameState) {
        // First check if there are unplayed games TODAY
        const todaysGames = CalendarEngine.getGamesForDate(currentDateStr, gameState);
        const unplayedToday = todaysGames.tier1.filter(g => !g.played).length +
                             todaysGames.tier2.filter(g => !g.played).length +
                             todaysGames.tier3.filter(g => !g.played).length;
        if (unplayedToday > 0) return currentDateStr;
        
        // Then check future dates
        let checkDate = CalendarEngine.addDays(currentDateStr, 1);
        const maxCheck = CalendarEngine.toDateString(new Date(
            parseInt(currentDateStr.substring(0, 4)) + 1, 7, 1 // Check up to Aug of next year
        ));
        
        while (checkDate <= maxCheck) {
            const games = CalendarEngine.getGamesForDate(checkDate, gameState);
            const unplayed = games.tier1.filter(g => !g.played).length +
                           games.tier2.filter(g => !g.played).length +
                           games.tier3.filter(g => !g.played).length;
            if (unplayed > 0) return checkDate;
            checkDate = CalendarEngine.addDays(checkDate, 1);
        }
        
        return null; // No more game dates
    }
    
    /**
     * Get the next date when the user's team has a game
     * Checks TODAY first (for unplayed games), then future dates
     */
    static getNextUserGameDate(currentDateStr, gameState) {
        const userTeamId = gameState.userTeamId;
        const userTier = gameState.currentTier;
        
        // Get the appropriate schedule
        let userSchedule;
        if (userTier === 1) userSchedule = gameState.tier1Schedule;
        else if (userTier === 2) userSchedule = gameState.tier2Schedule;
        else userSchedule = gameState.tier3Schedule;
        
        if (!userSchedule) return null;
        
        // First check for unplayed game TODAY - prevents skipping current day's game
        const todayGame = userSchedule.find(g => 
            !g.played && 
            g.date === currentDateStr &&
            (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId)
        );
        if (todayGame) return todayGame.date;
        
        // Then find the next unplayed game for the user's team after current date
        const nextGame = userSchedule.find(g => 
            !g.played && 
            g.date > currentDateStr &&
            (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId)
        );
        
        return nextGame ? nextGame.date : null;
    }

    /**
     * Get a calendar event description for the current date (All-Star, Trade Deadline, etc.)
     */
    static getCalendarEvent(dateStr, seasonDates) {
        const tradeDeadline = CalendarEngine.toDateString(seasonDates.tradeDeadline);
        const allStarStart = CalendarEngine.toDateString(seasonDates.allStarStart);
        const allStarEnd = CalendarEngine.toDateString(seasonDates.allStarEnd);
        
 if (dateStr === tradeDeadline) return 'Trade Deadline';
 if (dateStr === allStarStart) return 'All-Star Weekend Begins';
 if (dateStr > allStarStart && dateStr < allStarEnd) return 'All-Star Break';
 if (dateStr === allStarEnd) return 'All-Star Break (Final Day)';
        
        // Check for special off-season dates
 if (seasonDates.draftLottery && dateStr === CalendarEngine.toDateString(seasonDates.draftLottery)) return ' Draft Lottery';
 if (seasonDates.draftDay && dateStr === CalendarEngine.toDateString(seasonDates.draftDay)) return 'Draft Day';
 if (seasonDates.freeAgencyStart && dateStr === CalendarEngine.toDateString(seasonDates.freeAgencyStart)) return '️ Free Agency Opens';
        
        return null;
    }
}
