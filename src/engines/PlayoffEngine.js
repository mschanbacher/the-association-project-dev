// ═══════════════════════════════════════════════════════════════════
// PlayoffEngine — Playoff brackets, simulation, championship rounds
// ═══════════════════════════════════════════════════════════════════

export class PlayoffEngine {
    /**
     * Get playoff calendar dates for a season
     */
    static getPlayoffDates(seasonStartYear) {
        const y = seasonStartYear + 1; // Playoffs happen in the following year
        return {
            // T1 Playoffs (Bo7 throughout, 4 rounds)
            t1Round1Start: `${y}-04-16`,
            t1Round1End: `${y}-04-27`,
            t1Round2Start: `${y}-04-29`,
            t1Round2End: `${y}-05-10`,
            t1ConfFinalsStart: `${y}-05-12`,
            t1ConfFinalsEnd: `${y}-05-23`,
            t1FinalsStart: `${y}-05-25`,
            t1FinalsEnd: `${y}-06-05`,
            
            // T2 Playoffs (Bo5 throughout, 4 rounds)
            t2Round1Start: `${y}-04-16`,
            t2Round1End: `${y}-04-27`,
            t2Round2Start: `${y}-04-29`,
            t2Round2End: `${y}-05-08`,
            t2ConfFinalsStart: `${y}-05-10`,
            t2ConfFinalsEnd: `${y}-05-18`,
            t2FinalsStart: `${y}-05-20`,
            t2FinalsEnd: `${y}-05-28`,
            // T2 3rd place game for potential promotion
            t2ThirdPlaceStart: `${y}-05-20`,
            t2ThirdPlaceEnd: `${y}-05-24`,
            
            // T3 Playoffs (multi-stage, Bo3 early, Bo5 late)
            t3MetroFinalsStart: `${y}-04-16`,
            t3MetroFinalsEnd: `${y}-04-20`,
            t3RegionalStart: `${y}-04-22`,
            t3RegionalEnd: `${y}-04-26`,
            t3Sweet16Start: `${y}-04-28`,
            t3Sweet16End: `${y}-05-02`,
            t3QuartersStart: `${y}-05-04`,
            t3QuartersEnd: `${y}-05-08`,
            t3SemisStart: `${y}-05-10`,
            t3SemisEnd: `${y}-05-14`,
            t3ThirdPlaceStart: `${y}-05-14`,
            t3ThirdPlaceEnd: `${y}-05-16`,
            t3FinalsStart: `${y}-05-17`,
            t3FinalsEnd: `${y}-05-22`,
            
            // Relegation brackets
            relRound1Start: `${y}-05-10`,
            relRound1End: `${y}-05-16`,
            relRound2Start: `${y}-05-18`,
            relRound2End: `${y}-05-24`,
            
            // Promotion announced
            promotionDate: `${y}-05-28`,
            seasonCloseDate: `${y}-06-01`
        };
    }
    
    // ============================================
    // T1 PLAYOFFS — 16 teams, conference-based, Bo7
    // ============================================
    
    /**
     * Generate T1 playoff bracket
     * @param {Array} teams - All T1 teams sorted by standings
     * @returns {Object} Playoff bracket data structure
     */
    static generateT1Bracket(teams) {
        // Split into conferences
        const eastDivisions = ['Atlantic', 'Central', 'Southeast'];
        const westDivisions = ['Northwest', 'Pacific', 'Southwest'];
        
        const eastTeams = teams.filter(t => eastDivisions.includes(t.division));
        const westTeams = teams.filter(t => westDivisions.includes(t.division));
        
        // Sort by record within conference
        const sortByRecord = (a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.pointDiff - a.pointDiff;
        };
        eastTeams.sort(sortByRecord);
        westTeams.sort(sortByRecord);
        
        // Top 8 from each conference
        const east8 = eastTeams.slice(0, 8);
        const west8 = westTeams.slice(0, 8);
        
        return {
            type: 't1',
            bestOf: 7,
            east: east8,
            west: west8,
            rounds: [],
            currentRound: 0,
            champion: null,
            completed: false
        };
    }
    
    // ============================================
    // ============================================
    // T2 PLAYOFFS — Division Playoffs + National Tournament
    // ============================================
    //
    // Stage 1: Division Playoffs (11 divisions)
    //   Top 4 in each division play Bo3 brackets:
    //     Semi 1: #1 vs #4, Semi 2: #2 vs #3
    //     Division Final: winners meet (Bo3)
    //   → 11 division champions + 5 best runners-up = 16 teams
    //
    // Stage 2: National Tournament (16 teams, Bo5)
    //   Seeded by regular season record
    //   Round 1: 1v16, 2v15, ... 8v9
    //   Round 2: Re-seed, 1v4, 2v3 per half
    //   Semifinals → Championship (Bo5)
    //   3rd place game between semifinal losers (Bo3)
    
    /**
     * Generate T2 playoff bracket — division playoffs stage
     */
    static generateT2Bracket(teams) {
        const sortByRecord = (a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.pointDiff - a.pointDiff;
        };

        // Group by division
        const divisionMap = {};
        teams.forEach(t => {
            if (!divisionMap[t.division]) divisionMap[t.division] = [];
            divisionMap[t.division].push(t);
        });

        // Build division playoff brackets
        const divisionBrackets = [];
        for (const [divName, divTeams] of Object.entries(divisionMap)) {
            const sorted = [...divTeams].sort(sortByRecord);
            const top4 = sorted.slice(0, Math.min(4, sorted.length));
            divisionBrackets.push({
                division: divName,
                teams: top4,
                seed1: top4[0] || null,
                seed2: top4[1] || null,
                seed3: top4[2] || null,
                seed4: top4[3] || null,
                semi1Result: null,  // #1 vs #4
                semi2Result: null,  // #2 vs #3
                finalResult: null,
                champion: null,
                runnerUp: null
            });
        }

        return {
            type: 't2',
            stage: 'division',
            divisionBrackets,
            nationalBracket: null,
            champion: null,
            runnerUp: null,
            thirdPlaceWinner: null,
            thirdPlaceLoser: null,
            completed: false
        };
    }
    
    // ============================================
    // T3 PLAYOFFS — 48 teams, multi-stage bracket
    // ============================================
    
    /**
     * Generate T3 playoff bracket
     * Top 2 from each of 24 metro leagues → 48 teams
     */
    static generateT3Bracket(teams) {
        // Group teams by division (metro league)
        const divisionMap = {};
        teams.forEach(t => {
            if (!divisionMap[t.division]) divisionMap[t.division] = [];
            divisionMap[t.division].push(t);
        });
        
        const sortByRecord = (a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.pointDiff - a.pointDiff;
        };
        
        // Get top 2 from each division
        const metroMatchups = []; // Stage 1: #1 vs #2 in each metro
        const divisions = Object.keys(divisionMap);
        
        for (const div of divisions) {
            const divTeams = divisionMap[div].sort(sortByRecord);
            if (divTeams.length >= 2) {
                metroMatchups.push({
                    division: div,
                    seed1: divTeams[0],
                    seed2: divTeams[1]
                });
            }
        }
        
        return {
            type: 't3',
            metroMatchups: metroMatchups, // Stage 1 data
            metroChampions: [],           // After stage 1
            stage: 0,
            rounds: [],
            champion: null,
            runnerUp: null,
            thirdPlaceWinner: null,
            thirdPlaceLoser: null,
            completed: false
        };
    }
    
    // ============================================
    // RELEGATION BRACKETS
    // ============================================
    
    /**
     * Generate relegation bracket for a tier
     * Last place: auto-relegated
     * 28th vs 29th (Bo5): loser drops
     * Winner vs 27th (Bo5): loser drops, winner survives
     */
    static generateRelegationBracket(sortedTeams, tier) {
        const n = sortedTeams.length;
        const autoRelegated = sortedTeams[n - 1]; // Last place
        const team29 = sortedTeams[n - 2]; // 2nd to last (e.g. 29th in T1)
        const team28 = sortedTeams[n - 3]; // 3rd to last
        const team27 = sortedTeams[n - 4]; // 4th to last (gets bye)
        
        return {
            tier: tier,
            autoRelegated: autoRelegated,
            round1Higher: team28, // Better record
            round1Lower: team29,  // Worse record
            byeTeam: team27,      // Best of the 3, gets bye
            round1Result: null,
            round2Result: null,
            relegated: [autoRelegated], // Will add 2 more after bracket plays out
            survived: null,
            completed: false
        };
    }
    
    // ============================================
    // SERIES SIMULATION
    // ============================================
    
    /**
     * Simulate a playoff series using the full game engine
     * @param {Object} higherSeed - Higher seeded team
     * @param {Object} lowerSeed - Lower seeded team
     * @param {number} bestOf - 3, 5, or 7
     * @returns {Object} Series result with game-by-game data
     */
    static simulateSeries(higherSeed, lowerSeed, bestOf) {
        const winsNeeded = Math.ceil(bestOf / 2);
        let higherWins = 0;
        let lowerWins = 0;
        const games = [];
        
        // Home court patterns
        // Bo7: 2-2-1-1-1 (higher home for 1,2,5,7)
        // Bo5: 2-2-1 (higher home for 1,2,5)
        // Bo3: 1-1-1 (higher home for 1,3)
        const homePattern7 = ['higher', 'higher', 'lower', 'lower', 'higher', 'lower', 'higher'];
        const homePattern5 = ['higher', 'higher', 'lower', 'lower', 'higher'];
        const homePattern3 = ['higher', 'lower', 'higher'];
        
        let pattern;
        if (bestOf === 7) pattern = homePattern7;
        else if (bestOf === 5) pattern = homePattern5;
        else pattern = homePattern3;
        
        let gameNum = 0;
        while (higherWins < winsNeeded && lowerWins < winsNeeded && gameNum < bestOf) {
            const homeTeam = pattern[gameNum] === 'higher' ? higherSeed : lowerSeed;
            const awayTeam = pattern[gameNum] === 'higher' ? lowerSeed : higherSeed;
            
            // Use the simulation engine for realistic games
            // Don't track win probability to save memory during batch playoff sim
            // Use lightweight mode (skips events and detailed stats)
            const result = GameEngine.calculateGameOutcome(homeTeam, awayTeam, true, false, true);
            
            games.push({
                gameNumber: gameNum + 1,
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                homeScore: result.homeScore,
                awayScore: result.awayScore,
                winner: result.winner
            });
            
            if (result.winner.id === higherSeed.id) {
                higherWins++;
            } else {
                lowerWins++;
            }
            
            gameNum++;
        }
        
        const winner = higherWins >= winsNeeded ? higherSeed : lowerSeed;
        const loser = winner.id === higherSeed.id ? lowerSeed : higherSeed;
        
        return {
            higherSeed,
            lowerSeed,
            winner,
            loser,
            higherWins,
            lowerWins,
            games,
            bestOf,
            gamesPlayed: games.length
        };
    }
    
    // ============================================
    // FULL POSTSEASON SIMULATION
    // ============================================
    
    /**
     * Simulate the complete postseason for all tiers
     * Returns all results needed for promotion/relegation
     */
    static simulateFullPostseason(gameState) {
        console.log('🏆 PlayoffEngine: Running full postseason simulation...');
        
        const results = {
            t1: null,
            t2: null,
            t3: null,
            t1Relegation: null,
            t2Relegation: null,
            promoted: { toT1: [], toT2: [] },
            relegated: { fromT1: [], fromT2: [] }
        };
        
        // === T1 PLAYOFFS ===
        console.log('🏆 T1 Playoffs...');
        results.t1 = PlayoffEngine._runT1Playoffs(gameState);
        
        // === T2 PLAYOFFS ===
        console.log('🏆 T2 Playoffs...');
        results.t2 = PlayoffEngine._runT2Playoffs(gameState);
        
        // === T3 PLAYOFFS ===
        console.log('🏆 T3 Playoffs...');
        results.t3 = PlayoffEngine._runT3Playoffs(gameState);
        
        // === RELEGATION ===
        console.log('⬇️ Relegation brackets...');
        const t1Sorted = [...gameState.tier1Teams].sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.pointDiff - a.pointDiff;
        });
        const t2Sorted = [...gameState.tier2Teams].sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.pointDiff - a.pointDiff;
        });
        
        results.t1Relegation = PlayoffEngine._runRelegationBracket(t1Sorted, 1);
        results.t2Relegation = PlayoffEngine._runRelegationBracket(t2Sorted, 2);
        
        // === DETERMINE PROMOTION ===
        // T2 → T1: Best record + champion + highest remaining finisher
        results.promoted.toT1 = PlayoffEngine._determineT2Promotion(gameState, results.t2);
        
        // T3 → T2: Champion, runner-up, 3rd place winner
        results.promoted.toT2 = PlayoffEngine._determineT3Promotion(results.t3);
        
        // Relegated teams
        results.relegated.fromT1 = results.t1Relegation.relegated;
        results.relegated.fromT2 = results.t2Relegation.relegated;
        
        console.log('🏆 Postseason complete!');
        console.log('  T1 Champion:', results.t1.champion?.name);
        console.log('  T2 Champion:', results.t2.champion?.name);
        console.log('  T3 Champion:', results.t3.champion?.name);
        console.log('  Promoted to T1:', results.promoted.toT1.map(t => t.name));
        console.log('  Promoted to T2:', results.promoted.toT2.map(t => t.name));
        console.log('  Relegated from T1:', results.relegated.fromT1.map(t => t.name));
        console.log('  Relegated from T2:', results.relegated.fromT2.map(t => t.name));
        
        return results;
    }
    
    /**
     * Run T1 playoffs: 16 teams, conference-based, Bo7
     */
    static _runT1Playoffs(gameState) {
        const bracket = PlayoffEngine.generateT1Bracket(
            [...gameState.tier1Teams].sort((a, b) => (b.wins - a.wins) || (b.pointDiff - a.pointDiff))
        );
        
        // Round 1: 1v8, 2v7, 3v6, 4v5 in each conference
        const r1 = [];
        for (const conf of [{ name: 'East', teams: bracket.east }, { name: 'West', teams: bracket.west }]) {
            r1.push({ conf: conf.name, result: PlayoffEngine.simulateSeries(conf.teams[0], conf.teams[7], 7) });
            r1.push({ conf: conf.name, result: PlayoffEngine.simulateSeries(conf.teams[1], conf.teams[6], 7) });
            r1.push({ conf: conf.name, result: PlayoffEngine.simulateSeries(conf.teams[2], conf.teams[5], 7) });
            r1.push({ conf: conf.name, result: PlayoffEngine.simulateSeries(conf.teams[3], conf.teams[4], 7) });
        }
        bracket.rounds.push(r1);
        
        // Round 2: Re-seed winners, 1v4, 2v3 in each conference
        const r2 = [];
        for (const confName of ['East', 'West']) {
            const confTeams = confName === 'East' ? bracket.east : bracket.west;
            const winners = r1.filter(s => s.conf === confName).map(s => s.result.winner);
            winners.sort((a, b) => {
                const aIdx = confTeams.findIndex(t => t.id === a.id);
                const bIdx = confTeams.findIndex(t => t.id === b.id);
                return aIdx - bIdx;
            });
            r2.push({ conf: confName, result: PlayoffEngine.simulateSeries(winners[0], winners[3], 7) });
            r2.push({ conf: confName, result: PlayoffEngine.simulateSeries(winners[1], winners[2], 7) });
        }
        bracket.rounds.push(r2);
        
        // Conference Finals
        const r3 = [];
        for (const confName of ['East', 'West']) {
            const confTeams = confName === 'East' ? bracket.east : bracket.west;
            const winners = r2.filter(s => s.conf === confName).map(s => s.result.winner);
            winners.sort((a, b) => {
                const aIdx = confTeams.findIndex(t => t.id === a.id);
                const bIdx = confTeams.findIndex(t => t.id === b.id);
                return aIdx - bIdx;
            });
            r3.push({ conf: confName, result: PlayoffEngine.simulateSeries(winners[0], winners[1], 7) });
        }
        bracket.rounds.push(r3);
        
        // Finals
        const eastChamp = r3.find(s => s.conf === 'East').result.winner;
        const westChamp = r3.find(s => s.conf === 'West').result.winner;
        // Higher seed by original seeding
        const eastOrigSeed = bracket.east.findIndex(t => t.id === eastChamp.id);
        const westOrigSeed = bracket.west.findIndex(t => t.id === westChamp.id);
        const higher = eastOrigSeed <= westOrigSeed ? eastChamp : westChamp;
        const lower = higher.id === eastChamp.id ? westChamp : eastChamp;
        const finals = PlayoffEngine.simulateSeries(higher, lower, 7);
        bracket.rounds.push([{ conf: 'Finals', result: finals }]);
        
        bracket.champion = finals.winner;
        bracket.completed = true;
        
        return bracket;
    }
    
    /**
     * Run T2 playoffs: 16 teams, conference-based, Bo5, plus 3rd place game
     */
    static _runT2Playoffs(gameState) {
        const bracket = PlayoffEngine.generateT2Bracket(gameState.tier2Teams);

        // ═══ STAGE 1: Division Playoffs (Bo3) ═══
        console.log('  T2 Stage 1: Division Playoffs...');
        for (const db of bracket.divisionBrackets) {
            if (db.teams.length < 2) {
                // Division too small — top team auto-wins
                db.champion = db.seed1;
                db.runnerUp = db.seed2;
                continue;
            }
            if (db.teams.length < 4) {
                // 2 or 3 teams — just play a final
                if (db.teams.length === 3) {
                    db.semi2Result = PlayoffEngine.simulateSeries(db.seed2, db.seed3, 3);
                    db.finalResult = PlayoffEngine.simulateSeries(db.seed1, db.semi2Result.winner, 3);
                } else {
                    db.finalResult = PlayoffEngine.simulateSeries(db.seed1, db.seed2, 3);
                }
                db.champion = db.finalResult.winner;
                db.runnerUp = db.finalResult.loser;
                continue;
            }

            // Full 4-team bracket
            db.semi1Result = PlayoffEngine.simulateSeries(db.seed1, db.seed4, 3);
            db.semi2Result = PlayoffEngine.simulateSeries(db.seed2, db.seed3, 3);
            db.finalResult = PlayoffEngine.simulateSeries(db.semi1Result.winner, db.semi2Result.winner, 3);
            db.champion = db.finalResult.winner;
            db.runnerUp = db.finalResult.loser;
        }

        // ═══ STAGE 2: National Tournament (Bo5) ═══
        console.log('  T2 Stage 2: National Tournament...');

        // Collect 11 division champions + 5 best runners-up
        const sortByRecord = (a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.pointDiff - a.pointDiff;
        };

        const champions = bracket.divisionBrackets
            .filter(db => db.champion)
            .map(db => db.champion);
        const runnersUp = bracket.divisionBrackets
            .filter(db => db.runnerUp)
            .map(db => db.runnerUp)
            .sort(sortByRecord)
            .slice(0, 5);

        const national16 = [...champions, ...runnersUp].sort(sortByRecord);
        // Pad to 16 if we somehow have fewer (shouldn't happen with 11 divisions)
        if (national16.length < 16) {
            const allT2 = [...gameState.tier2Teams].sort(sortByRecord);
            for (const t of allT2) {
                if (national16.length >= 16) break;
                if (!national16.find(n => n.id === t.id)) national16.push(t);
            }
        }

        bracket.nationalBracket = {
            teams: national16.slice(0, 16),
            rounds: [],
            champions: champions.map(c => c.id), // track which are division champs
            runnersUp: runnersUp.map(r => r.id)
        };

        const nat = bracket.nationalBracket;

        // Round 1 (Bo5): 1v16, 2v15, ... 8v9
        const r1 = [];
        for (let i = 0; i < 8; i++) {
            const result = PlayoffEngine.simulateSeries(nat.teams[i], nat.teams[15 - i], 5);
            r1.push({ result });
        }
        nat.rounds.push(r1);

        // Round 2 (Bo5): Re-seed winners 1v8, 2v7, 3v6, 4v5
        const r1Winners = r1.map(s => s.result.winner);
        r1Winners.sort(sortByRecord);
        const r2 = [];
        for (let i = 0; i < 4; i++) {
            const result = PlayoffEngine.simulateSeries(r1Winners[i], r1Winners[7 - i], 5);
            r2.push({ result });
        }
        nat.rounds.push(r2);

        // Semifinals (Bo5): Re-seed 1v4, 2v3
        const r2Winners = r2.map(s => s.result.winner);
        r2Winners.sort(sortByRecord);
        const sf1 = PlayoffEngine.simulateSeries(r2Winners[0], r2Winners[3], 5);
        const sf2 = PlayoffEngine.simulateSeries(r2Winners[1], r2Winners[2], 5);
        nat.rounds.push([{ result: sf1 }, { result: sf2 }]);

        // 3rd place game (Bo3)
        const thirdPlace = PlayoffEngine.simulateSeries(sf1.loser, sf2.loser, 3);
        bracket.thirdPlaceResult = thirdPlace;
        bracket.thirdPlaceWinner = thirdPlace.winner;
        bracket.thirdPlaceLoser = thirdPlace.loser;

        // Championship (Bo5)
        const finals = PlayoffEngine.simulateSeries(sf1.winner, sf2.winner, 5);
        nat.rounds.push([{ result: finals }]);

        bracket.champion = finals.winner;
        bracket.runnerUp = finals.loser;
        bracket.completed = true;

        console.log(`  T2 Champion: ${bracket.champion.name}`);
        return bracket;
    }
    
    /**
     * Run T3 playoffs: 48 teams, multi-stage
     */
    static _runT3Playoffs(gameState) {
        const bracket = PlayoffEngine.generateT3Bracket(gameState.tier3Teams);
        
        // Stage 1: Metro Finals (Bo3) — #1 vs #2 in each metro
        console.log('  T3 Stage 1: Metro Finals...');
        const metroChampions = [];
        for (const matchup of bracket.metroMatchups) {
            const result = PlayoffEngine.simulateSeries(matchup.seed1, matchup.seed2, 3);
            metroChampions.push({
                division: matchup.division,
                team: result.winner,
                result: result
            });
        }
        bracket.metroChampions = metroChampions;
        bracket.rounds.push(metroChampions.map(mc => ({ conf: mc.division, result: mc.result })));
        
        // Sort metro champions by record to determine byes
        const champsSorted = [...metroChampions].sort((a, b) => {
            if (b.team.wins !== a.team.wins) return b.team.wins - a.team.wins;
            return b.team.pointDiff - a.team.pointDiff;
        });
        
        // Stage 2: Regional Round — top 8 get byes, remaining 16 play (Bo3)
        // This produces 24 → 16
        console.log('  T3 Stage 2: Regional Round...');
        const byeTeams = champsSorted.slice(0, 8).map(c => c.team);
        const playInTeams = champsSorted.slice(8).map(c => c.team);
        
        // Pair play-in teams: 9v24, 10v23, 11v22, etc.
        const playInResults = [];
        for (let i = 0; i < playInTeams.length / 2; i++) {
            const higher = playInTeams[i];
            const lower = playInTeams[playInTeams.length - 1 - i];
            const result = PlayoffEngine.simulateSeries(higher, lower, 3);
            playInResults.push(result);
        }
        bracket.rounds.push(playInResults.map(r => ({ conf: 'Regional', result: r })));
        
        // 16 teams: 8 bye teams + 8 play-in winners
        const sweet16Teams = [...byeTeams, ...playInResults.map(r => r.winner)];
        // Re-sort by regular season record for seeding
        sweet16Teams.sort((a, b) => (b.wins - a.wins) || (b.pointDiff - a.pointDiff));
        
        // Stage 3: Sweet 16 (Bo5) — 16 → 8
        console.log('  T3 Stage 3: Sweet 16...');
        const sweet16Results = [];
        for (let i = 0; i < 8; i++) {
            const result = PlayoffEngine.simulateSeries(sweet16Teams[i], sweet16Teams[15 - i], 5);
            sweet16Results.push(result);
        }
        bracket.rounds.push(sweet16Results.map(r => ({ conf: 'National', result: r })));
        
        // Stage 4: Quarterfinals (Bo5) — 8 → 4
        console.log('  T3 Stage 4: Quarterfinals...');
        const qfTeams = sweet16Results.map(r => r.winner);
        qfTeams.sort((a, b) => (b.wins - a.wins) || (b.pointDiff - a.pointDiff));
        const qfResults = [];
        for (let i = 0; i < 4; i++) {
            const result = PlayoffEngine.simulateSeries(qfTeams[i], qfTeams[7 - i], 5);
            qfResults.push(result);
        }
        bracket.rounds.push(qfResults.map(r => ({ conf: 'National', result: r })));
        
        // Stage 5: Semifinals (Bo5) — 4 → 2
        console.log('  T3 Stage 5: Semifinals...');
        const sfTeams = qfResults.map(r => r.winner);
        sfTeams.sort((a, b) => (b.wins - a.wins) || (b.pointDiff - a.pointDiff));
        const sf1 = PlayoffEngine.simulateSeries(sfTeams[0], sfTeams[3], 5);
        const sf2 = PlayoffEngine.simulateSeries(sfTeams[1], sfTeams[2], 5);
        bracket.rounds.push([
            { conf: 'National', result: sf1 },
            { conf: 'National', result: sf2 }
        ]);
        
        // 3rd place game (Bo3) — semifinal losers
        const thirdPlace = PlayoffEngine.simulateSeries(sf1.loser, sf2.loser, 3);
        bracket.thirdPlaceResult = thirdPlace;
        bracket.thirdPlaceWinner = thirdPlace.winner;
        bracket.thirdPlaceLoser = thirdPlace.loser;
        
        // Stage 6: Championship (Bo5)
        console.log('  T3 Stage 6: Championship...');
        const finals = PlayoffEngine.simulateSeries(sf1.winner, sf2.winner, 5);
        bracket.rounds.push([{ conf: 'Finals', result: finals }]);
        
        bracket.champion = finals.winner;
        bracket.runnerUp = finals.loser;
        bracket.completed = true;
        
        return bracket;
    }
    
    /**
     * Run relegation bracket for a tier
     */
    static _runRelegationBracket(sortedTeams, tier) {
        const bracket = PlayoffEngine.generateRelegationBracket(sortedTeams, tier);
        
        // Round 1: 28th vs 29th (or 84th vs 85th)
        const r1 = PlayoffEngine.simulateSeries(bracket.round1Higher, bracket.round1Lower, 5);
        bracket.round1Result = r1;
        bracket.relegated.push(r1.loser); // Loser is relegated
        
        // Round 2: Round 1 winner vs bye team (27th or 83rd)
        const r2 = PlayoffEngine.simulateSeries(bracket.byeTeam, r1.winner, 5);
        bracket.round2Result = r2;
        bracket.relegated.push(r2.loser); // Loser is relegated
        bracket.survived = r2.winner;
        bracket.completed = true;
        
        console.log(`  T${tier} Relegation: Auto-relegated: ${bracket.autoRelegated.name}`);
        console.log(`  T${tier} Relegation: ${r1.loser.name} relegated (lost R1)`);
        console.log(`  T${tier} Relegation: ${r2.loser.name} relegated (lost R2)`);
        console.log(`  T${tier} Relegation: ${r2.winner.name} survived!`);
        
        return bracket;
    }
    
    // ============================================
    // PROMOTION DETERMINATION
    // ============================================
    
    /**
     * Determine T2 → T1 promotion (3 spots)
     * 1. Best regular season record (always promoted)
     * 2. Playoff champion (always promoted if different)
     * 3. Highest remaining playoff finisher not already promoted
     */
    static _determineT2Promotion(gameState, t2Bracket) {
        const promoted = [];
        
        // Get best regular season record
        const t2Sorted = [...gameState.tier2Teams].sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.pointDiff - a.pointDiff;
        });
        const bestRecord = t2Sorted[0];
        promoted.push(bestRecord);
        console.log(`  T2 Promotion #1 (best record): ${bestRecord.name} (${bestRecord.wins}-${bestRecord.losses})`);
        
        // Playoff champion
        if (t2Bracket.champion && t2Bracket.champion.id !== bestRecord.id) {
            promoted.push(t2Bracket.champion);
            console.log(`  T2 Promotion #2 (champion): ${t2Bracket.champion.name}`);
        }
        
        // Fill remaining spots from playoff finishers
        // Priority: champion > runner-up > 3rd place winner > 3rd place loser
        const finishOrder = [
            t2Bracket.champion,
            t2Bracket.runnerUp,
            t2Bracket.thirdPlaceWinner,
            t2Bracket.thirdPlaceLoser
        ].filter(t => t != null);
        
        for (const team of finishOrder) {
            if (promoted.length >= 3) break;
            if (!promoted.find(p => p.id === team.id)) {
                promoted.push(team);
                console.log(`  T2 Promotion #${promoted.length} (playoff finisher): ${team.name}`);
            }
        }
        
        // Safety: if we still don't have 3, fill from regular season
        while (promoted.length < 3) {
            for (const team of t2Sorted) {
                if (!promoted.find(p => p.id === team.id)) {
                    promoted.push(team);
                    console.log(`  T2 Promotion #${promoted.length} (fallback record): ${team.name}`);
                    break;
                }
            }
        }
        
        return promoted;
    }
    
    /**
     * Determine T3 → T2 promotion (3 spots)
     * Champion, runner-up, 3rd place game winner
     */
    static _determineT3Promotion(t3Bracket) {
        const promoted = [];
        if (t3Bracket.champion) promoted.push(t3Bracket.champion);
        if (t3Bracket.runnerUp) promoted.push(t3Bracket.runnerUp);
        if (t3Bracket.thirdPlaceWinner) promoted.push(t3Bracket.thirdPlaceWinner);
        
        console.log('  T3 Promoted:', promoted.map(t => t.name));
        return promoted;
    }
    
    // ============================================
    // PLAYOFF CALENDAR GENERATION
    // ============================================
    
    /**
     * Generate a complete playoff calendar with all potential games dated
     * @param {Object} brackets - { t1: bracket, t2: bracket, t3: bracket }
     * @param {number} seasonStartYear - e.g., 2025 for 2025-26 season
     * @returns {Object} playoffSchedule - { games: [...], byDate: {...}, bySeries: {...} }
     */
    static generatePlayoffSchedule(brackets, seasonStartYear) {
        const dates = PlayoffEngine.getPlayoffDates(seasonStartYear);
        const games = [];
        
        // Generate T1 playoff games
        if (brackets.t1) {
            games.push(...PlayoffEngine._generateT1PlayoffGames(brackets.t1, dates));
        }
        
        // Generate T2 playoff games
        if (brackets.t2) {
            games.push(...PlayoffEngine._generateT2PlayoffGames(brackets.t2, dates));
        }
        
        // Generate T3 playoff games
        if (brackets.t3) {
            games.push(...PlayoffEngine._generateT3PlayoffGames(brackets.t3, dates));
        }
        
        // Sort all games by date
        games.sort((a, b) => a.date.localeCompare(b.date) || a.gameNumber - b.gameNumber);
        
        // Build lookup indexes
        const byDate = {};
        const bySeries = {};
        
        for (const game of games) {
            // Index by date
            if (!byDate[game.date]) byDate[game.date] = [];
            byDate[game.date].push(game);
            
            // Index by series ID
            if (!bySeries[game.seriesId]) bySeries[game.seriesId] = [];
            bySeries[game.seriesId].push(game);
        }
        
        return { games, byDate, bySeries };
    }
    
    /**
     * Generate dates for a single series (Bo3, Bo5, or Bo7)
     * Games are scheduled every other day within the date range
     * @param {string} seriesId - Unique identifier for the series
     * @param {Object} higherSeed - Higher seeded team
     * @param {Object} lowerSeed - Lower seeded team
     * @param {number} bestOf - 3, 5, or 7
     * @param {string} startDate - YYYY-MM-DD
     * @param {string} endDate - YYYY-MM-DD
     * @param {number} tier - 1, 2, or 3
     * @param {string} round - 'Round1', 'Round2', 'ConfFinals', 'Finals', etc.
     * @param {string} conference - 'East', 'West', 'National', division name, etc.
     * @returns {Array} Array of game objects
     */
    static _generateSeriesGames(seriesId, higherSeed, lowerSeed, bestOf, startDate, endDate, tier, round, conference) {
        const games = [];
        const winsNeeded = Math.ceil(bestOf / 2);
        
        // Home court pattern: 2-2-1-1-1 for Bo7, 2-2-1 for Bo5, 2-1 for Bo3
        // Higher seed gets home for games 1, 2, 5, 7 (Bo7) or 1, 2, 5 (Bo5) or 1, 3 (Bo3)
        const homePattern = bestOf === 7 
            ? [higherSeed, higherSeed, lowerSeed, lowerSeed, higherSeed, lowerSeed, higherSeed]
            : bestOf === 5
            ? [higherSeed, higherSeed, lowerSeed, lowerSeed, higherSeed]
            : [higherSeed, lowerSeed, higherSeed]; // Bo3
        
        // Calculate days available and spacing
        const daysAvailable = PlayoffEngine._daysBetween(startDate, endDate) + 1;
        const daysPerGame = Math.max(2, Math.floor(daysAvailable / bestOf)); // At least every other day
        
        let currentDate = startDate;
        
        for (let gameNum = 1; gameNum <= bestOf; gameNum++) {
            const homeTeam = homePattern[gameNum - 1];
            const awayTeam = homeTeam.id === higherSeed.id ? lowerSeed : higherSeed;
            const isNecessary = gameNum <= winsNeeded; // First games to clinch are always played
            
            games.push({
                id: `${seriesId}-g${gameNum}`,
                seriesId,
                gameNumber: gameNum,
                tier,
                round,
                conference,
                bestOf,
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
                homeTeam,
                awayTeam,
                higherSeedId: higherSeed.id,
                lowerSeedId: lowerSeed.id,
                date: currentDate,
                played: false,
                necessary: isNecessary, // Games 1-4 in Bo7 are always necessary
                ifNecessary: !isNecessary, // Games 5-7 are "if necessary"
                result: null // Will hold { homeScore, awayScore, winner, loser } after played
            });
            
            // Advance date for next game (every other day typically)
            currentDate = PlayoffEngine._addDays(currentDate, daysPerGame);
            if (currentDate > endDate) currentDate = endDate; // Cap at end date
        }
        
        return games;
    }
    
    /**
     * Generate all T1 playoff games (4 rounds, Bo7, conference-based)
     */
    static _generateT1PlayoffGames(bracket, dates) {
        const games = [];
        
        // Round 1: 8 series (4 East, 4 West)
        // Matchups: 1v8, 2v7, 3v6, 4v5 in each conference
        const r1Matchups = [
            { conf: 'East', seeds: [[0, 7], [1, 6], [2, 5], [3, 4]] },
            { conf: 'West', seeds: [[0, 7], [1, 6], [2, 5], [3, 4]] }
        ];
        
        for (const { conf, seeds } of r1Matchups) {
            const confTeams = conf === 'East' ? bracket.east : bracket.west;
            for (const [highIdx, lowIdx] of seeds) {
                if (confTeams[highIdx] && confTeams[lowIdx]) {
                    const seriesId = `t1-r1-${conf.toLowerCase()}-${highIdx + 1}v${lowIdx + 1}`;
                    games.push(...PlayoffEngine._generateSeriesGames(
                        seriesId,
                        confTeams[highIdx],
                        confTeams[lowIdx],
                        7,
                        dates.t1Round1Start,
                        dates.t1Round1End,
                        1,
                        'Round1',
                        conf
                    ));
                }
            }
        }
        
        // Round 2: 4 series (2 per conference) - matchups determined by Round 1 results
        // We create placeholder series that will be populated as Round 1 completes
        for (const conf of ['East', 'West']) {
            for (let i = 0; i < 2; i++) {
                const seriesId = `t1-r2-${conf.toLowerCase()}-${i + 1}`;
                // Placeholder - teams will be set when R1 completes
                games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
                    seriesId, 7, dates.t1Round2Start, dates.t1Round2End, 1, 'Round2', conf
                ));
            }
        }
        
        // Conference Finals: 2 series
        for (const conf of ['East', 'West']) {
            const seriesId = `t1-cf-${conf.toLowerCase()}`;
            games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
                seriesId, 7, dates.t1ConfFinalsStart, dates.t1ConfFinalsEnd, 1, 'ConfFinals', conf
            ));
        }
        
        // Finals: 1 series
        games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
            't1-finals', 7, dates.t1FinalsStart, dates.t1FinalsEnd, 1, 'Finals', 'National'
        ));
        
        return games;
    }
    
    /**
     * Generate placeholder games for a series where teams aren't known yet
     */
    static _generatePlaceholderSeriesGames(seriesId, bestOf, startDate, endDate, tier, round, conference) {
        const games = [];
        const daysAvailable = PlayoffEngine._daysBetween(startDate, endDate) + 1;
        const daysPerGame = Math.max(2, Math.floor(daysAvailable / bestOf));
        
        let currentDate = startDate;
        
        for (let gameNum = 1; gameNum <= bestOf; gameNum++) {
            const winsNeeded = Math.ceil(bestOf / 2);
            
            games.push({
                id: `${seriesId}-g${gameNum}`,
                seriesId,
                gameNumber: gameNum,
                tier,
                round,
                conference,
                bestOf,
                homeTeamId: null, // TBD
                awayTeamId: null, // TBD
                homeTeam: null,
                awayTeam: null,
                higherSeedId: null,
                lowerSeedId: null,
                date: currentDate,
                played: false,
                necessary: gameNum <= winsNeeded,
                ifNecessary: gameNum > winsNeeded,
                result: null,
                placeholder: true // Flag to indicate teams not yet determined
            });
            
            currentDate = PlayoffEngine._addDays(currentDate, daysPerGame);
            if (currentDate > endDate) currentDate = endDate;
        }
        
        return games;
    }
    
    /**
     * Generate all T2 playoff games (division stage + national tournament)
     */
    static _generateT2PlayoffGames(bracket, dates) {
        const games = [];
        
        // Stage 1: Division Playoffs (11 divisions × 3 games each for semis + final)
        // Each division: Semi 1 (Bo3), Semi 2 (Bo3), Final (Bo3)
        if (bracket.divisionBrackets) {
            for (const divBracket of bracket.divisionBrackets) {
                const divName = divBracket.division;
                const divId = divName.toLowerCase().replace(/\s+/g, '-');
                
                // Division Semi 1: #1 vs #4
                if (divBracket.seed1 && divBracket.seed4) {
                    games.push(...PlayoffEngine._generateSeriesGames(
                        `t2-div-${divId}-s1`, divBracket.seed1, divBracket.seed4, 3,
                        dates.t2Round1Start, PlayoffEngine._addDays(dates.t2Round1Start, 4),
                        2, 'DivSemi', divName
                    ));
                }
                
                // Division Semi 2: #2 vs #3
                if (divBracket.seed2 && divBracket.seed3) {
                    games.push(...PlayoffEngine._generateSeriesGames(
                        `t2-div-${divId}-s2`, divBracket.seed2, divBracket.seed3, 3,
                        dates.t2Round1Start, PlayoffEngine._addDays(dates.t2Round1Start, 4),
                        2, 'DivSemi', divName
                    ));
                }
                
                // Division Final (placeholder - winners of semis)
                games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
                    `t2-div-${divId}-final`, 3,
                    PlayoffEngine._addDays(dates.t2Round1Start, 6), dates.t2Round1End,
                    2, 'DivFinal', divName
                ));
            }
        }
        
        // Stage 2: National Tournament (16 teams, 4 rounds of Bo5)
        // Round 1: 8 series
        for (let i = 0; i < 8; i++) {
            games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
                `t2-nat-r1-${i + 1}`, 5, dates.t2Round2Start, dates.t2Round2End, 2, 'NatRound1', 'National'
            ));
        }
        
        // Quarterfinals: 4 series
        for (let i = 0; i < 4; i++) {
            games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
                `t2-nat-qf-${i + 1}`, 5, dates.t2ConfFinalsStart, dates.t2ConfFinalsEnd, 2, 'NatQuarter', 'National'
            ));
        }
        
        // Semifinals: 2 series
        for (let i = 0; i < 2; i++) {
            games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
                `t2-nat-sf-${i + 1}`, 5, dates.t2FinalsStart, PlayoffEngine._addDays(dates.t2FinalsStart, 6), 2, 'NatSemi', 'National'
            ));
        }
        
        // 3rd Place Game: Bo3
        games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
            't2-3rd-place', 3, dates.t2ThirdPlaceStart, dates.t2ThirdPlaceEnd, 2, 'ThirdPlace', 'National'
        ));
        
        // Finals: Bo5
        games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
            't2-finals', 5, PlayoffEngine._addDays(dates.t2FinalsStart, 5), dates.t2FinalsEnd, 2, 'Finals', 'National'
        ));
        
        return games;
    }
    
    /**
     * Generate all T3 playoff games (multi-stage tournament)
     */
    static _generateT3PlayoffGames(bracket, dates) {
        const games = [];
        
        // Stage 1: Metro Finals (24 series, Bo3) - #1 vs #2 in each metro
        if (bracket.metroMatchups) {
            for (const matchup of bracket.metroMatchups) {
                const divId = matchup.division.toLowerCase().replace(/\s+/g, '-');
                games.push(...PlayoffEngine._generateSeriesGames(
                    `t3-metro-${divId}`, matchup.seed1, matchup.seed2, 3,
                    dates.t3MetroFinalsStart, dates.t3MetroFinalsEnd, 3, 'MetroFinal', matchup.division
                ));
            }
        }
        
        // Stage 2: Regional Round (8 series, Bo3) - play-in for teams 9-24
        for (let i = 0; i < 8; i++) {
            games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
                `t3-regional-${i + 1}`, 3, dates.t3RegionalStart, dates.t3RegionalEnd, 3, 'Regional', 'National'
            ));
        }
        
        // Stage 3: Sweet 16 (8 series, Bo5)
        for (let i = 0; i < 8; i++) {
            games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
                `t3-sweet16-${i + 1}`, 5, dates.t3Sweet16Start, dates.t3Sweet16End, 3, 'Sweet16', 'National'
            ));
        }
        
        // Stage 4: Quarterfinals (4 series, Bo5)
        for (let i = 0; i < 4; i++) {
            games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
                `t3-qf-${i + 1}`, 5, dates.t3QuartersStart, dates.t3QuartersEnd, 3, 'Quarter', 'National'
            ));
        }
        
        // Stage 5: Semifinals (2 series, Bo5)
        for (let i = 0; i < 2; i++) {
            games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
                `t3-sf-${i + 1}`, 5, dates.t3SemisStart, dates.t3SemisEnd, 3, 'Semi', 'National'
            ));
        }
        
        // 3rd Place Game: Bo3
        games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
            't3-3rd-place', 3, dates.t3ThirdPlaceStart, dates.t3ThirdPlaceEnd, 3, 'ThirdPlace', 'National'
        ));
        
        // Finals: Bo5
        games.push(...PlayoffEngine._generatePlaceholderSeriesGames(
            't3-finals', 5, dates.t3FinalsStart, dates.t3FinalsEnd, 3, 'Finals', 'National'
        ));
        
        return games;
    }

    /**
     * Get the current state of a series (wins for each team, games played, etc.)
     */
    static getSeriesState(playoffSchedule, seriesId) {
        const seriesGames = playoffSchedule.bySeries[seriesId] || [];
        const playedGames = seriesGames.filter(g => g.played);
        
        // Get bestOf from first game in series (even if not played yet)
        const firstGame = seriesGames[0];
        const bestOf = firstGame?.bestOf || 7;
        const winsNeeded = Math.ceil(bestOf / 2);
        
        if (seriesGames.length === 0) {
            return {
                seriesId,
                gamesPlayed: 0,
                higherSeedWins: 0,
                lowerSeedWins: 0,
                bestOf,
                winsNeeded,
                leader: null,
                complete: false,
                winner: null,
                loser: null
            };
        }
        
        const higherSeedId = firstGame.higherSeedId;
        const lowerSeedId = firstGame.lowerSeedId;
        
        // Get team objects - they could be homeTeam or awayTeam depending on game
        // Find them from any game in the series that has them set
        let higherSeedTeam = null;
        let lowerSeedTeam = null;
        for (const g of seriesGames) {
            if (!higherSeedTeam && g.homeTeam?.id === higherSeedId) higherSeedTeam = g.homeTeam;
            if (!higherSeedTeam && g.awayTeam?.id === higherSeedId) higherSeedTeam = g.awayTeam;
            if (!lowerSeedTeam && g.homeTeam?.id === lowerSeedId) lowerSeedTeam = g.homeTeam;
            if (!lowerSeedTeam && g.awayTeam?.id === lowerSeedId) lowerSeedTeam = g.awayTeam;
            if (higherSeedTeam && lowerSeedTeam) break;
        }
        
        let higherSeedWins = 0;
        let lowerSeedWins = 0;
        
        for (const game of playedGames) {
            if (game.result?.winner?.id === higherSeedId) {
                higherSeedWins++;
            } else if (game.result?.winner?.id === lowerSeedId) {
                lowerSeedWins++;
            }
        }
        
        const complete = higherSeedWins >= winsNeeded || lowerSeedWins >= winsNeeded;
        const winner = complete ? (higherSeedWins >= winsNeeded ? higherSeedTeam : lowerSeedTeam) : null;
        const loser = complete ? (higherSeedWins >= winsNeeded ? lowerSeedTeam : higherSeedTeam) : null;
        
        return {
            seriesId,
            gamesPlayed: playedGames.length,
            higherSeedWins,
            lowerSeedWins,
            bestOf,
            winsNeeded,
            leader: higherSeedWins > lowerSeedWins ? 'higher' : lowerSeedWins > higherSeedWins ? 'lower' : 'tied',
            complete,
            winner,
            loser
        };
    }
    
    /**
     * Check if a game is still necessary (series not yet decided)
     */
    static isGameNecessary(playoffSchedule, gameId) {
        const game = playoffSchedule.games.find(g => g.id === gameId);
        if (!game) return false;
        if (game.played) return true; // Already played
        
        const seriesState = PlayoffEngine.getSeriesState(playoffSchedule, game.seriesId);
        if (seriesState.complete) return false; // Series already decided
        
        // For "if necessary" games, check if we've reached that point
        const winsNeeded = seriesState.winsNeeded;
        const gamesPlayed = seriesState.gamesPlayed;
        const maxPossibleGames = gamesPlayed + (winsNeeded - seriesState.higherSeedWins) + (winsNeeded - seriesState.lowerSeedWins) - 1;
        
        return game.gameNumber <= maxPossibleGames + 1;
    }
    
    /**
     * Get all games scheduled for a specific date that are still necessary
     */
    static getPlayoffGamesOnDate(playoffSchedule, date) {
        const gamesOnDate = playoffSchedule.byDate[date] || [];
        return gamesOnDate.filter(game => {
            if (game.played) return false;
            if (game.placeholder && !game.homeTeamId) return false; // Teams not determined yet
            return PlayoffEngine.isGameNecessary(playoffSchedule, game.id);
        });
    }
    
    /**
     * Get the next date with unplayed playoff games
     */
    static getNextPlayoffGameDate(playoffSchedule, afterDate = null) {
        const dates = Object.keys(playoffSchedule.byDate).sort();
        
        for (const date of dates) {
            if (afterDate && date <= afterDate) continue;
            
            const games = PlayoffEngine.getPlayoffGamesOnDate(playoffSchedule, date);
            if (games.length > 0) return date;
        }
        
        return null;
    }
    
    // ============================================
    // HELPER METHODS
    // ============================================
    
    /**
     * Add days to a date string
     */
    static _addDays(dateStr, days) {
        const d = new Date(dateStr + 'T12:00:00');
        d.setDate(d.getDate() + days);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    /**
     * Get days between two date strings
     */
    static _daysBetween(dateStr1, dateStr2) {
        const d1 = new Date(dateStr1 + 'T12:00:00');
        const d2 = new Date(dateStr2 + 'T12:00:00');
        return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    }
    
    // ============================================
    // HTML GENERATION FOR RESULTS
    // ============================================
    
    /**
     * Generate a summary HTML of the full postseason results
     */
}
