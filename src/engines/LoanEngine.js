// ═══════════════════════════════════════════════════════════════════
// LoanEngine — Emergency injury loan system
// ═══════════════════════════════════════════════════════════════════
//
// Pure logic: no DOM, no gameState mutation, no UI.
// Operates on team/player/loan objects passed as arguments.
//
// Loan flow:
//   1. getAvailableLoanPlayers()  — scan tier below for candidates
//   2. calculateLoanTerms()      — compute adjusted salary + cost estimate
//   3. evaluateLoanOffer()       — AI negotiation (accept/counter/decline)
//   4. executeLoan()             — move player, create loan record, adjust finances
//   5. returnLoanedPlayer()      — move player back, clean up
//   6. checkLoanReturns()        — tick-based check for loans that should end
//   7. processAiLoan()           — AI team auto-loan logic
//

export class LoanEngine {

    // ─────────────────────────────────────────────────────────────
    // AVAILABLE PLAYERS
    // ─────────────────────────────────────────────────────────────

    /**
     * Get all players from the tier below that could be loaned.
     * Returns every player with team context — availability is governed
     * by the negotiation model, not hard filters.
     *
     * @param {number} borrowingTier - The tier of the team seeking a loan (1 or 2)
     * @param {Array} lowerTierTeams - Teams from the tier below
     * @param {Array} activeLoans - Current active loans (to exclude already-loaned players)
     * @returns {Array<{player, team, teamContext}>}
     */
    static getAvailableLoanPlayers(borrowingTier, lowerTierTeams, activeLoans = []) {
        if (borrowingTier === 3) return []; // T3 has no tier below

        const loanedPlayerIds = new Set(activeLoans.map(l => l.playerId));
        const results = [];

        for (const team of lowerTierTeams) {
            if (!team.roster || team.roster.length === 0) continue;

            const teamContext = LoanEngine._getTeamContext(team, lowerTierTeams);

            for (const player of team.roster) {
                // Skip already-loaned players
                if (loanedPlayerIds.has(player.id)) continue;
                // Skip injured players
                if (player.injuryStatus !== 'healthy') continue;

                results.push({
                    player,
                    team,
                    teamContext,
                });
            }
        }

        // Sort by rating descending for browse convenience
        results.sort((a, b) => b.player.rating - a.player.rating);
        return results;
    }

    /**
     * Compute team situation context for negotiation.
     * @param {Object} team
     * @param {Array} allTierTeams
     * @returns {Object} teamContext
     */
    static _getTeamContext(team, allTierTeams) {
        const totalTeams = allTierTeams.length;
        const sorted = [...allTierTeams].sort((a, b) => {
            const aWinPct = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0.5;
            const bWinPct = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0.5;
            return bWinPct - aWinPct;
        });

        const rank = sorted.findIndex(t => t.id === team.id) + 1;
        const promotionZone = Math.ceil(totalTeams * 0.15);  // top ~15%
        const relegationZone = Math.floor(totalTeams * 0.85); // bottom ~15%

        let situation;
        if (rank <= promotionZone) {
            situation = 'contending';
        } else if (rank > relegationZone) {
            situation = 'relegation';
        } else {
            situation = 'mid-table';
        }

        // Financial health: check if team has decent revenue vs salary
        let financialHealth = 'stable';
        if (team.finances) {
            const revenue = team.finances.revenue || 0;
            const salary = (team.roster || []).reduce((s, p) => s + (p.salary || 0), 0);
            if (revenue > 0 && salary > revenue * 0.9) {
                financialHealth = 'stressed';
            } else if (revenue > 0 && salary < revenue * 0.5) {
                financialHealth = 'healthy';
            }
        }

        return {
            rank,
            totalTeams,
            situation,
            financialHealth,
            gamesPlayed: (team.wins || 0) + (team.losses || 0),
            wins: team.wins || 0,
            losses: team.losses || 0,
        };
    }

    // ─────────────────────────────────────────────────────────────
    // LOAN COST ESTIMATION
    // ─────────────────────────────────────────────────────────────

    /**
     * Calculate loan financial terms for display and validation.
     *
     * @param {Object} player - Player being loaned
     * @param {number} borrowingTier - Tier of the borrowing team
     * @param {number} gamesRemaining - Approximate games left in the season
     * @param {number} totalGames - Total games in the season for the borrowing tier
     * @param {Function} generateSalary - TeamFactory.generateSalary
     * @returns {Object} { adjustedSalary, proratedSalary, estimatedLoanFee, estimatedTotal }
     */
    static calculateLoanTerms(player, borrowingTier, gamesRemaining, totalGames, generateSalary) {
        // What this player would earn at the higher tier
        const adjustedSalary = generateSalary(player.rating, borrowingTier);

        // Prorated portion of their existing salary for the loan period
        const seasonFraction = totalGames > 0 ? gamesRemaining / totalGames : 0.5;
        const proratedSalary = Math.round(player.salary * seasonFraction);

        // Estimated loan fee (midpoint — actual asking price depends on negotiation)
        const estimatedLoanFee = Math.round(adjustedSalary * 0.35);

        return {
            adjustedSalary,
            proratedSalary,
            estimatedLoanFee,
            estimatedTotal: proratedSalary + estimatedLoanFee,
        };
    }

    /**
     * Get a rough cost tier for UI display (low/medium/high).
     * Compares estimated total cost to DPE amount.
     *
     * @param {number} estimatedTotal
     * @param {number} dpeAmount
     * @returns {string} 'low' | 'medium' | 'high'
     */
    static getCostTier(estimatedTotal, dpeAmount) {
        if (dpeAmount <= 0) return 'high';
        const ratio = estimatedTotal / dpeAmount;
        if (ratio < 0.4) return 'low';
        if (ratio < 0.75) return 'medium';
        return 'high';
    }

    // ─────────────────────────────────────────────────────────────
    // NEGOTIATION
    // ─────────────────────────────────────────────────────────────

    /**
     * Evaluate a loan offer from the borrowing team.
     * Returns accept/counter/decline with reasoning.
     *
     * @param {Object} params
     * @param {Object} params.lendingTeam - Team being borrowed from
     * @param {Object} params.player - Player being requested
     * @param {number} params.offerAmount - Loan fee offered by borrowing team
     * @param {Object} params.teamContext - From _getTeamContext
     * @param {number} params.adjustedSalary - Player's salary at borrowing tier
     * @param {Array} params.activeLoans - Current active loans
     * @returns {{ response: 'accept'|'counter'|'decline', counterAmount?: number, reasoning: string }}
     */
    static evaluateLoanOffer(params) {
        const { lendingTeam, player, offerAmount, teamContext, adjustedSalary, activeLoans = [] } = params;

        // Calculate asking price and walk-away threshold
        const { askingPrice, walkAway, declineReason } = LoanEngine._calculateAiValuation(
            lendingTeam, player, teamContext, adjustedSalary, activeLoans
        );

        // Hard decline — player too important
        if (declineReason) {
            return {
                response: 'decline',
                reasoning: declineReason,
            };
        }

        // Accept — offer meets or exceeds asking price
        if (offerAmount >= askingPrice) {
            return {
                response: 'accept',
                reasoning: LoanEngine._getAcceptReasoning(lendingTeam, player, teamContext),
            };
        }

        // Counter — offer is between walk-away and asking price
        if (offerAmount >= walkAway) {
            return {
                response: 'counter',
                counterAmount: askingPrice,
                reasoning: LoanEngine._getCounterReasoning(lendingTeam, player, teamContext),
            };
        }

        // Decline — offer below walk-away
        return {
            response: 'decline',
            reasoning: LoanEngine._getDeclineReasoning(lendingTeam, player, teamContext),
        };
    }

    /**
     * Core AI valuation model.
     * Returns asking price, walk-away threshold, and optional hard-decline reason.
     */
    static _calculateAiValuation(team, player, teamContext, adjustedSalary, activeLoans) {
        // Base fee: percentage of adjusted salary
        let baseFeePercent = 0.35; // 35% of what they'd earn at higher tier
        let walkAwayPercent = 0.20; // 20% minimum

        // ── Factor 1: Minutes per game (player importance) ──
        const gp = player.seasonStats?.gamesPlayed || 1;
        const mpg = gp > 0 ? (player.seasonStats?.minutesPlayed || 0) / gp : 0;

        if (mpg >= 30) {
            // Core starter — very likely decline
            return {
                askingPrice: 0, walkAway: 0,
                declineReason: `${team.city} ${team.name} cannot afford to lose a core player averaging ${Math.round(mpg)} minutes per game`,
            };
        }
        if (mpg >= 24) {
            // Starter — huge premium, near-decline
            baseFeePercent += 0.25;
            walkAwayPercent += 0.20;
        } else if (mpg >= 16) {
            // Key rotation — notable premium
            baseFeePercent += 0.12;
            walkAwayPercent += 0.08;
        } else if (mpg >= 8) {
            // Bench — moderate
            baseFeePercent += 0.05;
            walkAwayPercent += 0.03;
        }
        // Deep bench (<8 mpg) — no adjustment

        // ── Factor 2: Position scarcity ──
        const samePos = (team.roster || []).filter(p =>
            p.position === player.position && p.id !== player.id && p.injuryStatus === 'healthy'
        ).length;

        if (samePos === 0) {
            // Loaning would leave 0 at this position — hard decline
            return {
                askingPrice: 0, walkAway: 0,
                declineReason: `${team.city} ${team.name} has no other ${player.position} players and cannot loan out ${player.name}`,
            };
        }
        if (samePos === 1) {
            // Only 1 backup — strong reluctance
            baseFeePercent += 0.15;
            walkAwayPercent += 0.12;
        }

        // ── Factor 3: Rating relative to team ──
        const teamAvgRating = (team.roster || []).reduce((s, p) => s + p.rating, 0) / Math.max(team.roster.length, 1);
        const ratingDelta = player.rating - teamAvgRating;

        if (ratingDelta > 5) {
            // Well above team average — premium
            baseFeePercent += 0.08;
            walkAwayPercent += 0.05;
        } else if (ratingDelta < -5) {
            // Below average — discount
            baseFeePercent -= 0.05;
            walkAwayPercent -= 0.03;
        }

        // ── Factor 4: Team situation ──
        if (teamContext.situation === 'contending') {
            // In promotion race — massive premium on rotation players
            if (mpg >= 16) {
                return {
                    askingPrice: 0, walkAway: 0,
                    declineReason: `${team.city} ${team.name} is fighting for promotion and can't afford to lose rotation players`,
                };
            }
            baseFeePercent += 0.15;
            walkAwayPercent += 0.10;
        } else if (teamContext.situation === 'relegation') {
            // Relegation danger — reluctant but might consider bench for premium
            if (mpg >= 12) {
                return {
                    askingPrice: 0, walkAway: 0,
                    declineReason: `${team.city} ${team.name} is in a relegation fight and can't weaken their roster`,
                };
            }
            baseFeePercent += 0.10;
            walkAwayPercent += 0.05;
        }
        // Mid-table: no adjustment — most flexible

        // ── Factor 5: Financial health ──
        if (teamContext.financialHealth === 'stressed') {
            // Financially stressed teams have lower walk-away (they want the fee)
            walkAwayPercent -= 0.08;
        } else if (teamContext.financialHealth === 'healthy') {
            // Wealthy teams don't need the money
            walkAwayPercent += 0.03;
        }

        // ── Factor 6: Chemistry / tenure ──
        if (player.gamesWithTeam && player.gamesWithTeam > 60) {
            baseFeePercent += 0.05;
        }

        // ── Factor 7: Already loaned out a player ──
        const existingLoansFromTeam = activeLoans.filter(l => l.originalTeamId === team.id).length;
        if (existingLoansFromTeam >= 2) {
            return {
                askingPrice: 0, walkAway: 0,
                declineReason: `${team.city} ${team.name} has already loaned out multiple players and cannot part with more`,
            };
        }
        if (existingLoansFromTeam === 1) {
            baseFeePercent += 0.10;
            walkAwayPercent += 0.08;
        }

        // Clamp percentages
        baseFeePercent = Math.max(0.15, Math.min(0.75, baseFeePercent));
        walkAwayPercent = Math.max(0.10, Math.min(baseFeePercent - 0.05, walkAwayPercent));

        const askingPrice = Math.round(adjustedSalary * baseFeePercent);
        const walkAway = Math.round(adjustedSalary * walkAwayPercent);

        return { askingPrice, walkAway, declineReason: null };
    }

    // ── Reasoning strings ──

    static _getAcceptReasoning(team, player, ctx) {
        if (ctx.situation === 'mid-table') {
            return `${team.city} ${team.name} is comfortable parting with bench depth at this price`;
        }
        if (ctx.financialHealth === 'stressed') {
            return `${team.city} ${team.name} welcomes the financial windfall for a bench contributor`;
        }
        return `${team.city} ${team.name} agrees to the loan terms`;
    }

    static _getCounterReasoning(team, player, ctx) {
        const gp = player.seasonStats?.gamesPlayed || 1;
        const mpg = gp > 0 ? (player.seasonStats?.minutesPlayed || 0) / gp : 0;

        if (mpg >= 16) {
            return `${team.city} ${team.name} is open to the deal but needs more compensation for a player averaging ${Math.round(mpg)} minutes`;
        }
        if (ctx.situation === 'contending') {
            return `${team.city} ${team.name} is in the promotion race and needs a premium to part with any depth`;
        }
        return `${team.city} ${team.name} wants a higher fee to make this worthwhile`;
    }

    static _getDeclineReasoning(team, player, ctx) {
        if (ctx.situation === 'contending') {
            return `${team.city} ${team.name} is fighting for promotion and values ${player.name} as a key piece`;
        }
        if (ctx.situation === 'relegation') {
            return `${team.city} ${team.name} is in a relegation battle and can't afford to weaken their roster`;
        }
        return `${team.city} ${team.name} doesn't see enough value in this offer for ${player.name}`;
    }

    // ─────────────────────────────────────────────────────────────
    // LOAN EXECUTION
    // ─────────────────────────────────────────────────────────────

    /**
     * Execute a loan: move player to borrowing team, create loan record.
     *
     * @param {Object} params
     * @param {Object} params.player - Player being loaned
     * @param {Object} params.originalTeam - Lending team
     * @param {Object} params.borrowingTeam - Team receiving the player
     * @param {Object} params.injuredPlayer - The player whose DPE triggered this
     * @param {number} params.loanFee - Agreed loan fee
     * @param {number} params.proratedSalary - Prorated salary for loan period
     * @param {string} params.currentDate - Game date (YYYY-MM-DD)
     * @param {Array} params.activeLoans - Mutable activeLoans array
     * @param {Function} [params.initializePlayerChemistry] - Optional chemistry reset
     * @returns {Object} The created loan record
     */
    static executeLoan(params) {
        const {
            player, originalTeam, borrowingTeam, injuredPlayer,
            loanFee, proratedSalary, currentDate,
            activeLoans, initializePlayerChemistry
        } = params;

        // Generate loan ID
        const loanId = 'loan_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

        // Create loan record
        const loanRecord = {
            id: loanId,
            playerId: player.id,
            playerName: player.name,
            playerPosition: player.position,
            playerRating: player.rating,
            originalTeamId: originalTeam.id,
            originalTeamName: `${originalTeam.city} ${originalTeam.name}`,
            originalTier: originalTeam.tier,
            borrowingTeamId: borrowingTeam.id,
            borrowingTeamName: `${borrowingTeam.city} ${borrowingTeam.name}`,
            borrowingTier: borrowingTeam.tier,
            injuredPlayerId: injuredPlayer.id,
            injuredPlayerName: injuredPlayer.name,
            startDate: currentDate,
            endDate: null,
            endReason: null,
            loanFee,
            proratedSalary,
            originalSalary: player.salary,
        };

        // Move player: remove from original team, add to borrowing team
        const origIdx = originalTeam.roster.findIndex(p => p.id === player.id);
        if (origIdx !== -1) {
            originalTeam.roster.splice(origIdx, 1);
        }

        // Set loan flags on player
        player.onLoan = true;
        player.loanFromTeamId = originalTeam.id;
        player.loanToTeamId = borrowingTeam.id;

        // Reset chemistry for the new team
        if (initializePlayerChemistry) {
            initializePlayerChemistry(player);
        } else {
            player.chemistry = 50;
            player.gamesWithTeam = 0;
        }

        // Add to borrowing team roster
        borrowingTeam.roster.push(player);

        // Financial adjustments
        // Lending team receives loan fee as revenue
        if (originalTeam.finances) {
            originalTeam.finances.revenue = (originalTeam.finances.revenue || 0) + loanFee;
        }

        // Add loan record
        activeLoans.push(loanRecord);

        console.log(`[LoanEngine] Loan executed: ${player.name} (${originalTeam.city} ${originalTeam.name} -> ${borrowingTeam.city} ${borrowingTeam.name}) Fee: ${loanFee}`);

        return loanRecord;
    }

    /**
     * Return a loaned player to their original team.
     *
     * @param {Object} params
     * @param {string} params.loanId - Loan record ID
     * @param {string} params.reason - 'injury-healed' | 'season-end' | 'loan-player-injured'
     * @param {Array} params.activeLoans - Mutable activeLoans array
     * @param {Array} params.allTeams - All teams across tiers (to find teams by ID)
     * @param {string} params.currentDate - Current game date
     * @param {Function} [params.initializePlayerChemistry]
     * @returns {{ loan: Object, player: Object }|null}
     */
    static returnLoanedPlayer(params) {
        const { loanId, reason, activeLoans, allTeams, currentDate, initializePlayerChemistry } = params;

        const loanIdx = activeLoans.findIndex(l => l.id === loanId);
        if (loanIdx === -1) {
            console.warn(`[LoanEngine] Loan ${loanId} not found for return`);
            return null;
        }

        const loan = activeLoans[loanIdx];
        const borrowingTeam = allTeams.find(t => t.id === loan.borrowingTeamId);
        const originalTeam = allTeams.find(t => t.id === loan.originalTeamId);

        if (!borrowingTeam || !originalTeam) {
            console.warn(`[LoanEngine] Teams not found for loan ${loanId}`);
            return null;
        }

        // Find the player on the borrowing team's roster
        const playerIdx = borrowingTeam.roster.findIndex(p => p.id === loan.playerId);
        if (playerIdx === -1) {
            console.warn(`[LoanEngine] Player ${loan.playerId} not found on borrowing team roster`);
            // Still clean up the loan record
            loan.endDate = currentDate;
            loan.endReason = reason;
            activeLoans.splice(loanIdx, 1);
            return null;
        }

        const player = borrowingTeam.roster[playerIdx];

        // Move player back: remove from borrowing, add to original
        borrowingTeam.roster.splice(playerIdx, 1);

        // Clear loan flags
        player.onLoan = false;
        player.loanFromTeamId = null;
        player.loanToTeamId = null;

        // Restore original salary
        player.salary = loan.originalSalary;

        // Reset chemistry for return to original team
        if (initializePlayerChemistry) {
            initializePlayerChemistry(player);
        } else {
            player.chemistry = 60; // Slight familiarity bonus on return
            player.gamesWithTeam = 0;
        }

        // Add back to original team
        originalTeam.roster.push(player);

        // Mark loan as ended
        loan.endDate = currentDate;
        loan.endReason = reason;

        // Remove from active loans
        activeLoans.splice(loanIdx, 1);

        console.log(`[LoanEngine] Loan returned: ${player.name} -> ${originalTeam.city} ${originalTeam.name} (${reason})`);

        return { loan, player };
    }

    // ─────────────────────────────────────────────────────────────
    // LOAN RETURN CHECKS
    // ─────────────────────────────────────────────────────────────

    /**
     * Check if any active loans should end.
     * Called alongside updateInjuries each game day.
     *
     * Triggers:
     *   1. Injured player has healed (gamesRemaining === 0 or injuryStatus === 'healthy')
     *   2. Loaned player got injured
     *
     * Season-end sweep is handled separately by returnAllLoans().
     *
     * @param {Object} params
     * @param {Array} params.activeLoans
     * @param {Array} params.allTeams
     * @param {string} params.currentDate
     * @param {Function} [params.initializePlayerChemistry]
     * @returns {Array<{loan, player, reason}>} Loans that ended
     */
    static checkLoanReturns(params) {
        const { activeLoans, allTeams, currentDate, initializePlayerChemistry } = params;
        const ended = [];

        // Iterate in reverse since we're modifying the array
        for (let i = activeLoans.length - 1; i >= 0; i--) {
            const loan = activeLoans[i];

            // Find the injured player on the borrowing team
            const borrowingTeam = allTeams.find(t => t.id === loan.borrowingTeamId);
            if (!borrowingTeam) continue;

            const injuredPlayer = borrowingTeam.roster.find(p => p.id === loan.injuredPlayerId);

            // Check 1: Injured player has healed
            if (injuredPlayer && injuredPlayer.injuryStatus === 'healthy') {
                const result = LoanEngine.returnLoanedPlayer({
                    loanId: loan.id, reason: 'injury-healed',
                    activeLoans, allTeams, currentDate, initializePlayerChemistry,
                });
                if (result) {
                    ended.push({ ...result, reason: 'injury-healed', injuredPlayerName: loan.injuredPlayerName });
                }
                continue;
            }

            // Check 2: Loaned player got injured on borrowing team
            const loanedPlayer = borrowingTeam.roster.find(p => p.id === loan.playerId);
            if (loanedPlayer && loanedPlayer.injuryStatus !== 'healthy') {
                const result = LoanEngine.returnLoanedPlayer({
                    loanId: loan.id, reason: 'loan-player-injured',
                    activeLoans, allTeams, currentDate, initializePlayerChemistry,
                });
                if (result) {
                    ended.push({ ...result, reason: 'loan-player-injured' });
                }
                // DPE reactivation: the borrowing team gets remaining DPE value back.
                // The caller (game-init or GMMode) should handle this by checking
                // if the borrowing team's DPE array still has an entry.
                continue;
            }
        }

        return ended;
    }

    /**
     * Return all active loans. Called at season end.
     *
     * @param {Object} params
     * @param {Array} params.activeLoans
     * @param {Array} params.allTeams
     * @param {string} params.currentDate
     * @param {Function} [params.initializePlayerChemistry]
     * @returns {Array} Returned loan records
     */
    static returnAllLoans(params) {
        const { activeLoans, allTeams, currentDate, initializePlayerChemistry } = params;
        const returned = [];

        // Iterate in reverse since returnLoanedPlayer modifies the array
        for (let i = activeLoans.length - 1; i >= 0; i--) {
            const loan = activeLoans[i];
            const result = LoanEngine.returnLoanedPlayer({
                loanId: loan.id, reason: 'season-end',
                activeLoans, allTeams, currentDate, initializePlayerChemistry,
            });
            if (result) returned.push(result);
        }

        console.log(`[LoanEngine] Season-end sweep: returned ${returned.length} loaned players`);
        return returned;
    }

    // ─────────────────────────────────────────────────────────────
    // AI-TO-AI LOAN PROCESSING
    // ─────────────────────────────────────────────────────────────

    /**
     * Process an AI team's attempt to fill a DPE via loan.
     * Called when an AI team gets a DPE-eligible injury.
     *
     * @param {Object} params
     * @param {Object} params.team - AI team that needs a loan
     * @param {Object} params.injuredPlayer - The injured player
     * @param {number} params.dpeAmount - DPE budget
     * @param {Array} params.lowerTierTeams - Teams from tier below
     * @param {Array} params.activeLoans
     * @param {Array} params.allTeams
     * @param {string} params.currentDate
     * @param {Function} params.generateSalary
     * @param {number} params.gamesRemaining
     * @param {number} params.totalGames
     * @param {Function} [params.initializePlayerChemistry]
     * @returns {Object|null} Loan record if successful, null if no loan made
     */
    static processAiLoan(params) {
        const {
            team, injuredPlayer, dpeAmount, lowerTierTeams,
            activeLoans, allTeams, currentDate,
            generateSalary, gamesRemaining, totalGames,
            initializePlayerChemistry
        } = params;

        if (team.tier === 3) return null; // T3 can't loan

        const candidates = LoanEngine.getAvailableLoanPlayers(team.tier, lowerTierTeams, activeLoans);
        if (candidates.length === 0) return null;

        // Filter to same position or adjacent positions
        const targetPos = injuredPlayer.position;
        const adjacentPositions = LoanEngine._getAdjacentPositions(targetPos);
        const positionCandidates = candidates.filter(c =>
            c.player.position === targetPos || adjacentPositions.includes(c.player.position)
        );

        // Try candidates in order of rating (best first)
        const toTry = positionCandidates.length > 0 ? positionCandidates : candidates.slice(0, 15);

        for (const candidate of toTry.slice(0, 10)) {
            const terms = LoanEngine.calculateLoanTerms(
                candidate.player, team.tier, gamesRemaining, totalGames, generateSalary
            );

            // Check if within DPE budget
            if (terms.estimatedTotal > dpeAmount) continue;

            // AI offers slightly above walk-away to be efficient
            // Use 80% of estimated loan fee as offer (conservative but reasonable)
            const offerAmount = Math.round(terms.estimatedLoanFee * 0.85);

            const evaluation = LoanEngine.evaluateLoanOffer({
                lendingTeam: candidate.team,
                player: candidate.player,
                offerAmount,
                teamContext: candidate.teamContext,
                adjustedSalary: terms.adjustedSalary,
                activeLoans,
            });

            if (evaluation.response === 'accept') {
                // Execute the loan
                return LoanEngine.executeLoan({
                    player: candidate.player,
                    originalTeam: candidate.team,
                    borrowingTeam: team,
                    injuredPlayer,
                    loanFee: offerAmount,
                    proratedSalary: terms.proratedSalary,
                    currentDate,
                    activeLoans,
                    initializePlayerChemistry,
                });
            }

            if (evaluation.response === 'counter' && evaluation.counterAmount) {
                // AI accepts counter if within DPE
                const totalWithCounter = terms.proratedSalary + evaluation.counterAmount;
                if (totalWithCounter <= dpeAmount) {
                    return LoanEngine.executeLoan({
                        player: candidate.player,
                        originalTeam: candidate.team,
                        borrowingTeam: team,
                        injuredPlayer,
                        loanFee: evaluation.counterAmount,
                        proratedSalary: terms.proratedSalary,
                        currentDate,
                        activeLoans,
                        initializePlayerChemistry,
                    });
                }
            }
            // If declined, try next candidate
        }

        return null; // No loan found
    }

    /**
     * Get adjacent positions for flexible position matching.
     */
    static _getAdjacentPositions(pos) {
        const adjacency = {
            'PG': ['SG'],
            'SG': ['PG', 'SF'],
            'SF': ['SG', 'PF'],
            'PF': ['SF', 'C'],
            'C': ['PF'],
        };
        return adjacency[pos] || [];
    }

    // ─────────────────────────────────────────────────────────────
    // NOTABLE LOAN CHECK (for Breaking News)
    // ─────────────────────────────────────────────────────────────

    /**
     * Determine if an AI loan is notable enough for Breaking News.
     * @param {Object} loan - Loan record
     * @returns {boolean}
     */
    static isNotableLoan(loan) {
        // Notable if: high-rated player (75+), or involves a T1 team
        return loan.playerRating >= 75 || loan.borrowingTier === 1;
    }

    // ─────────────────────────────────────────────────────────────
    // FA SIGNING VIA DPE (simplified for in-season use)
    // ─────────────────────────────────────────────────────────────

    /**
     * Get free agents that fit within a DPE budget.
     *
     * @param {Array} freeAgents - The free agent pool
     * @param {number} dpeAmount - Maximum budget
     * @param {number} tier - Team's tier (for salary context)
     * @returns {Array} Filtered and sorted free agents
     */
    static getAffordableFreeAgents(freeAgents, dpeAmount, tier) {
        return (freeAgents || [])
            .filter(p => (p.salary || 0) <= dpeAmount)
            .sort((a, b) => b.rating - a.rating);
    }

    /**
     * Sign a free agent using DPE.
     * Rest-of-season contract.
     *
     * @param {Object} params
     * @param {Object} params.player - FA to sign
     * @param {Object} params.team - Signing team
     * @param {Array} params.freeAgents - Mutable FA pool
     * @param {Function} [params.initializePlayerChemistry]
     * @returns {Object} The signed player
     */
    static signFreeAgentViaDPE(params) {
        const { player, team, freeAgents, initializePlayerChemistry } = params;

        // Remove from FA pool
        const faIdx = freeAgents.findIndex(p => p.id === player.id);
        if (faIdx !== -1) {
            freeAgents.splice(faIdx, 1);
        }

        // Set contract: 1 year (expires at season end)
        player.contractYears = 1;
        player.originalContractLength = 1;

        // Reset chemistry
        if (initializePlayerChemistry) {
            initializePlayerChemistry(player);
        } else {
            player.chemistry = 50;
            player.gamesWithTeam = 0;
        }

        // Add to roster
        team.roster.push(player);

        console.log(`[LoanEngine] DPE FA signing: ${player.name} -> ${team.city} ${team.name}`);
        return player;
    }
}
