// ═══════════════════════════════════════════════════════════════════
// SalaryCapEngine — Salary caps, floors, cap space calculations
// ═══════════════════════════════════════════════════════════════════
//
// Pure logic: no DOM, no gameState, no UI.
// Delegates to FinanceEngine for T2/T3 revenue-based limits.
//
// PHILOSOPHY:
//   Tier 1: Hard salary cap ($100M, American franchise model)
//   Tier 2/3: Revenue-based spending limits (European model)
//
// This module centralizes all cap-related calculations that were
// previously scattered as standalone functions in index.html.
//

import { FinanceEngine } from './FinanceEngine.js';

export class SalaryCapEngine {

    // ─────────────────────────────────────────────────────────────
    // CONSTANTS
    // ─────────────────────────────────────────────────────────────

    static SALARY_CAPS = {
        1: 100000000,  // Tier 1: $100M hard cap
        2: 12000000,   // Tier 2: $12M (fallback — actual from FinanceEngine)
        3: 1500000     // Tier 3: $1.5M (fallback — actual from FinanceEngine)
    };

    static SALARY_FLOORS = {
        1: 80000000,   // Tier 1: $80M minimum spend
        2: 9600000,    // Tier 2: (fallback — actual from FinanceEngine)
        3: 1200000     // Tier 3: (fallback — actual from FinanceEngine)
    };

    // Legacy constants for backward compatibility
    static PARACHUTE_PAYMENTS = {
        '1to2': [7500000, 3750000],
        '2to3': [1500000, 750000]
    };

    static PROMOTION_BONUSES = {
        '3to2': 2000000,
        '2to1': 10000000
    };

    // ─────────────────────────────────────────────────────────────
    // CAP CALCULATIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Get salary cap for a tier (static fallback value)
     * @param {number} tier
     * @returns {number}
     */
    static getSalaryCap(tier) {
        return SalaryCapEngine.SALARY_CAPS[tier] || SalaryCapEngine.SALARY_CAPS[3];
    }

    /**
     * Get salary floor for a tier (static fallback value)
     * @param {number} tier
     * @returns {number}
     */
    static getSalaryFloor(tier) {
        return SalaryCapEngine.SALARY_FLOORS[tier] || SalaryCapEngine.SALARY_FLOORS[3];
    }

    /**
     * Get EFFECTIVE SPENDING LIMIT for a team
     * T1: Hard cap ($100M)
     * T2/T3: Revenue-based spending limit from FinanceEngine
     * @param {Object} team
     * @returns {number}
     */
    static getEffectiveCap(team) {
        FinanceEngine.ensureFinances(team);
        return FinanceEngine.getSpendingLimit(team);
    }

    /**
     * Calculate total team salary
     * @param {Object} team
     * @returns {number}
     */
    static calculateTeamSalary(team) {
        if (!team.roster || team.roster.length === 0) {
            return 0;
        }
        return team.roster.reduce((total, player) => {
            return total + (player.salary || 0);
        }, 0);
    }

    /**
     * Check if team is under salary cap
     * @param {Object} team
     * @param {number} additionalSalary - Salary being considered (e.g., signing)
     * @returns {boolean}
     */
    static isUnderCap(team, additionalSalary = 0) {
        const currentSalary = SalaryCapEngine.calculateTeamSalary(team);
        const cap = SalaryCapEngine.getEffectiveCap(team);
        return (currentSalary + additionalSalary) <= cap;
    }

    /**
     * Get remaining cap space
     * @param {Object} team
     * @returns {number}
     */
    static getRemainingCap(team) {
        const currentSalary = SalaryCapEngine.calculateTeamSalary(team);
        const cap = SalaryCapEngine.getEffectiveCap(team);
        return Math.max(0, cap - currentSalary);
    }

    // ─────────────────────────────────────────────────────────────
    // TIER TRANSITION HELPERS
    // ─────────────────────────────────────────────────────────────

    /**
     * Apply parachute payment for relegation (delegates to FinanceEngine)
     * @param {Object} team
     * @param {number} fromTier
     * @param {number} toTier
     */
    static applyParachutePayment(team, fromTier, toTier) {
        FinanceEngine.ensureFinances(team);
        FinanceEngine.applyRelegation(team, fromTier, toTier);
    }

    /**
     * Apply promotion bonus (delegates to FinanceEngine)
     * @param {Object} team
     * @param {number} fromTier
     * @param {number} toTier
     */
    static applyPromotionBonus(team, fromTier, toTier) {
        FinanceEngine.ensureFinances(team);
        FinanceEngine.applyPromotion(team, fromTier, toTier);
    }

    /**
     * Advance financial transitions for all teams (called each offseason)
     * @param {Array<Object>} allTeams
     */
    static advanceFinancialTransitions(allTeams) {
        allTeams.forEach(team => {
            FinanceEngine.ensureFinances(team);
            FinanceEngine.advanceFinances(team, { wins: team.wins || 0, losses: team.losses || 0 });
        });
    }

    // ─────────────────────────────────────────────────────────────
    // UTILITY
    // ─────────────────────────────────────────────────────────────

    /**
     * Format currency for display
     * @param {number} amount
     * @returns {string}
     */
    static formatCurrency(amount) {
        if (amount >= 1000000) {
            return '$' + (amount / 1000000).toFixed(2) + 'M';
        } else if (amount >= 1000) {
            return '$' + (amount / 1000).toFixed(0) + 'K';
        }
        return '$' + amount.toFixed(0);
    }
}
