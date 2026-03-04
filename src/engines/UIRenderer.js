// ═══════════════════════════════════════════════════════════════════
// UIRenderer — Pure rendering functions for The Association Project
// ═══════════════════════════════════════════════════════════════════
//
// Every function in this module:
//   ✅ Takes data as parameters
//   ✅ Returns an HTML string
//   ❌ Never reads gameState
//   ❌ Never modifies DOM directly
//   ❌ Never calls game logic
//
// This separation allows:
//   - Complete UI redesign without touching simulation
//   - Unit testing of rendering logic
//   - Future migration to a framework (React, etc.)
//

export class UIRenderer {

    // ═══════════════════════════════════════════════════════════════
    // SHARED HELPERS
    // ═══════════════════════════════════════════════════════════════

    static rankSuffix(n) {
        if (!n && n !== 0) return '';
        const v = n % 100;
        if (v >= 11 && v <= 13) return n + 'th';
        const last = n % 10;
        if (last === 1) return n + 'st';
        if (last === 2) return n + 'nd';
        if (last === 3) return n + 'rd';
        return n + 'th';
    }

    /** Safe team display name — handles city+name or just name */
    static _tn(obj) {
        if (!obj) return '';
        const city = obj.city || '';
        const name = obj.teamName || obj.name || '';
        return city ? `${city} ${name}` : name;
    }

    static pct(wins, losses) {
        const total = wins + losses;
        return total > 0 ? (wins / total * 100).toFixed(1) : '0.0';
    }

    static winColor(wins, losses) {
        const p = wins / Math.max(1, wins + losses);
        return p >= 0.6 ? '#4ecdc4' : p <= 0.4 ? '#ff6b6b' : '';
    }

    static formatCurrency(amount) {
        if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(2) + 'M';
        if (amount >= 1000) return '$' + (amount / 1000).toFixed(0) + 'K';
        return '$' + amount;
    }

    static tierLabel(tier) {
        return tier === 1 ? 'Tier 1 — NAPL' : tier === 2 ? 'Tier 2 — NARBL' : 'Tier 3 — MBL';
    }

    static tierTeamCount(tier) {
        return tier === 1 ? 30 : tier === 2 ? 86 : 144;
    }

    // ═══════════════════════════════════════════════════════════════
    /**
     * Compact inline rating display: "78 OVR (82 / 74)" with color coding.
     * Used in roster rows, trade rows, FA lists, draft boards.
     * @param {Object} player - Must have .rating, optionally .offRating / .defRating
     * @param {Function} getRatingColor - Color function for overall rating
     * @returns {string} HTML string
     */
    static compactRating(player, getRatingColor) {
        const _rc = typeof getRatingColor === 'function' ? getRatingColor
            : (r) => r >= 85 ? '#4ecdc4' : r >= 78 ? '#45b7d1' : r >= 70 ? '#96ceb4' : r >= 60 ? '#fbbc04' : '#f28b82';
        const off = player.offRating;
        const def = player.defRating;
        if (off === undefined && def === undefined) {
            return `<span style="color: ${_rc(player.rating)}; font-weight: bold;">⭐ ${player.rating}</span>`;
        }
        const offColor = off >= 80 ? '#4ecdc4' : off >= 70 ? '#45b7d1' : off >= 60 ? '#fbbc04' : '#f28b82';
        const defColor = def >= 80 ? '#4ecdc4' : def >= 70 ? '#45b7d1' : def >= 60 ? '#fbbc04' : '#f28b82';
        return `<span style="color: ${_rc(player.rating)}; font-weight: bold;">⭐ ${player.rating}</span>`
             + `<span style="opacity: 0.75; margin-left: 6px; font-size: 0.88em;">`
             + `(<span style="color: ${offColor};" title="Offensive Rating">${off}</span>`
             + ` / `
             + `<span style="color: ${defColor};" title="Defensive Rating">${def}</span>)`
             + `</span>`;
    }

    /**
     * Detailed three-number rating header with off/def balance bar.
     * Used in scout detail, player profile, 📊 expand panels.
     * @param {Object} player - Must have .rating, .offRating, .defRating
     * @param {Function} getRatingColor - Color function
     * @returns {string} HTML string
     */
    static detailedRatingHeader(player, getRatingColor) {
        const _rc = typeof getRatingColor === 'function' ? getRatingColor
            : (r) => r >= 85 ? '#4ecdc4' : r >= 78 ? '#45b7d1' : r >= 70 ? '#96ceb4' : r >= 60 ? '#fbbc04' : '#f28b82';
        const off = player.offRating || player.rating;
        const def = player.defRating || player.rating;
        const offColor = off >= 80 ? '#4ecdc4' : off >= 70 ? '#45b7d1' : off >= 60 ? '#fbbc04' : '#f28b82';
        const defColor = def >= 80 ? '#4ecdc4' : def >= 70 ? '#45b7d1' : def >= 60 ? '#fbbc04' : '#f28b82';
        // Balance bar: position a marker between pure-offense and pure-defense
        const range = Math.max(1, (off + def));
        const offPct = Math.round((off / range) * 100);
        const offLabel = off > def + 3 ? 'Offensive' : def > off + 3 ? 'Defensive' : 'Two-Way';
        const labelColor = off > def + 3 ? offColor : def > off + 3 ? defColor : '#aaa';
        return `
            <div style="display: flex; align-items: center; gap: 18px;">
                <div style="text-align: center;">
                    <div style="font-size: 2em; font-weight: bold; color: ${_rc(player.rating)};">${player.rating}</div>
                    <div style="font-size: 0.75em; opacity: 0.6; margin-top: 2px;">OVR</div>
                </div>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <div style="text-align: center;">
                            <div style="font-size: 1.4em; font-weight: bold; color: ${offColor};">${off}</div>
                            <div style="font-size: 0.7em; opacity: 0.6;">OFF</div>
                        </div>
                        <div style="text-align: center; padding-top: 4px;">
                            <div style="font-size: 0.85em; font-weight: bold; color: ${labelColor};">${offLabel}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 1.4em; font-weight: bold; color: ${defColor};">${def}</div>
                            <div style="font-size: 0.7em; opacity: 0.6;">DEF</div>
                        </div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 6px; position: relative; overflow: hidden;">
                        <div style="position: absolute; left: 0; top: 0; height: 100%; width: ${offPct}%; background: linear-gradient(90deg, ${offColor}, transparent); border-radius: 4px;"></div>
                        <div style="position: absolute; right: 0; top: 0; height: 100%; width: ${100 - offPct}%; background: linear-gradient(270deg, ${defColor}, transparent); border-radius: 4px;"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attribute grid split into OFF and DEF sections.
     * @param {Object} attributes - Player attributes object
     * @param {Object} PlayerAttributes - The PlayerAttributes class (for PHYSICAL_ATTRS, MENTAL_ATTRS)
     * @returns {string} HTML string
     */
    static splitAttributeGrid(attributes, PlayerAttributes) {
        if (!attributes || !PlayerAttributes) return '';
        const allDefs = { ...(PlayerAttributes.PHYSICAL_ATTRS || {}), ...(PlayerAttributes.MENTAL_ATTRS || {}) };

        // Offensive attributes: clutch, basketballIQ, speed are offense-primary
        const offKeys = ['clutch', 'basketballIQ', 'speed'];
        // Defensive attributes: strength, verticality, endurance are defense-primary
        const defKeys = ['strength', 'verticality', 'endurance'];
        // Intangibles: modifiers that don't directly feed ratings
        const intKeys = ['workEthic', 'coachability', 'collaboration'];

        const attrCell = (key) => {
            const val = attributes[key] || 50;
            const def = allDefs[key] || {};
            const color = val >= 80 ? '#4ecdc4' : val >= 70 ? '#45b7d1' : val >= 60 ? '#96ceb4' : val >= 50 ? '#fbbc04' : val >= 40 ? '#ffa07a' : '#f28b82';
            return `<div style="display: flex; justify-content: space-between; padding: 4px 8px; background: rgba(255,255,255,0.04); border-radius: 4px;">
                <span style="font-size: 0.85em;">${def.icon || ''} ${def.name || key}</span>
                <span style="font-weight: bold; color: ${color};">${val}</span>
            </div>`;
        };

        const section = (label, emoji, keys, accentColor) => {
            if (keys.length === 0) return '';
            return `
                <div>
                    <div style="font-size: 0.8em; font-weight: bold; color: ${accentColor}; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${emoji} ${label}
                    </div>
                    <div style="display: grid; gap: 4px;">
                        ${keys.map(k => attrCell(k)).join('')}
                    </div>
                </div>
            `;
        };

        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;">
                ${section('Offense', '⚔️', offKeys, '#4ecdc4')}
                ${section('Defense', '🛡️', defKeys, '#45b7d1')}
                ${section('Intangibles', '🧠', intKeys, '#96ceb4')}
            </div>
        `;
    }

    /**
     * Render a small colored tier badge for a player.
     */
    static getTierBadge(player) {
        const natTier = window.TeamFactory
            ? window.TeamFactory.getPlayerNaturalTier(player)
            : (player.rating >= 72 ? 1 : player.rating >= 60 ? 2 : 3);
        const colors = { 1: '#ff6b6b', 2: '#4ecdc4', 3: '#95afc0' };
        const labels = { 1: 'T1', 2: 'T2', 3: 'T3' };
        return `<span style="background:${colors[natTier]};color:#fff;padding:1px 6px;border-radius:3px;font-size:0.75em;font-weight:bold;margin-left:5px;" title="Valued at Tier ${natTier} rates">${labels[natTier]}</span>`;
    }

    /**
     * Format market value display with tier badge and cross-tier comparison.
     */
    static formatMarketDisplay(player, userTier) {
        const TeamFactory = window.TeamFactory;
        if (!TeamFactory) return UIRenderer.formatCurrency(player.salary || 0);
        const natTier = TeamFactory.getPlayerNaturalTier(player);
        const tierValue = TeamFactory.getMarketValue(player, userTier);
        const badge = UIRenderer.getTierBadge(player);

        if (natTier < userTier) {
            const natValue = TeamFactory.getNaturalMarketValue(player);
            return `${UIRenderer.formatCurrency(tierValue)} ${badge}<br><span style="font-size:0.8em;color:#ff6b6b;opacity:0.9;">T${natTier} value: ${UIRenderer.formatCurrency(natValue)}</span>`;
        }
        return `${UIRenderer.formatCurrency(tierValue)} ${badge}`;
    }

    // _leagueSummarySection removed — no longer needed, content integrated into seasonEndModal

    // ═══════════════════════════════════════════════════════════════
    // FINANCIAL TRANSITION BRIEFING
    // ═══════════════════════════════════════════════════════════════

    static financialTransitionBriefing({ team, isRelegation, isPromotion, previousTier, currentTier,
                                        summary, totalSalary, spendingLimit, capSpace,
                                        locked, expiring, lockedSalary, expiringSalary,
                                        releasedPlayers, rosterBySalary, oldTierBaseline, newTotalBaseline,
                                        formatCurrency, getRatingColor, spendingRatio, currentSeason }) {
        const f = team.finances;
        const r = summary.revenue;

        return `
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 25px; padding: 25px; background: ${isRelegation ? 'linear-gradient(135deg, rgba(234,67,53,0.2), rgba(234,67,53,0.05))' : 'linear-gradient(135deg, rgba(52,168,83,0.2), rgba(52,168,83,0.05))'}; border-radius: 12px; border: 1px solid ${isRelegation ? 'rgba(234,67,53,0.3)' : 'rgba(52,168,83,0.3)'};">
                <div style="font-size: 2em; margin-bottom: 8px;">${isRelegation ? '📉' : '📈'}</div>
                <h1 style="margin: 0 0 8px 0; color: ${isRelegation ? '#ea4335' : '#34a853'};">${isRelegation ? 'Relegation' : 'Promotion'} Financial Briefing</h1>
                <div style="font-size: 1.1em; opacity: 0.8;">
                    ${team.name} · Tier ${previousTier} → Tier ${currentTier}
                </div>
            </div>
            
            <!-- Financial Overview Cards -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                <div style="background: rgba(255,255,255,0.08); border-radius: 10px; padding: 18px; text-align: center;">
                    <div style="font-size: 0.85em; opacity: 0.6;">Total Revenue</div>
                    <div style="font-size: 1.5em; font-weight: bold; color: #2ecc71;">${formatCurrency(summary.totalRevenue)}</div>
                    <div style="font-size: 0.8em; opacity: 0.5; margin-top: 4px;">
                        ${isRelegation ? '↓ from ~' + formatCurrency(oldTierBaseline.league + oldTierBaseline.matchday + oldTierBaseline.commercial + oldTierBaseline.legacy) + ' tier avg' : '↑ from ~' + formatCurrency(oldTierBaseline.league + oldTierBaseline.matchday + oldTierBaseline.commercial + oldTierBaseline.legacy) + ' tier avg'}
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.08); border-radius: 10px; padding: 18px; text-align: center;">
                    <div style="font-size: 0.85em; opacity: 0.6;">${currentTier === 1 ? 'Salary Cap' : 'Spending Limit'}</div>
                    <div style="font-size: 1.5em; font-weight: bold; color: #667eea;">${formatCurrency(spendingLimit)}</div>
                    <div style="font-size: 0.8em; opacity: 0.5; margin-top: 4px;">
                        ${Math.round(spendingRatio * 100)}% of revenue
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.08); border-radius: 10px; padding: 18px; text-align: center;">
                    <div style="font-size: 0.85em; opacity: 0.6;">Cap Space</div>
                    <div style="font-size: 1.5em; font-weight: bold; color: ${capSpace >= 0 ? '#34a853' : '#ea4335'};">${formatCurrency(capSpace)}</div>
                    <div style="font-size: 0.8em; opacity: 0.5; margin-top: 4px;">
                        ${capSpace >= 0 ? 'Available for signings' : '⚠️ Over limit — must cut salary'}
                    </div>
                </div>
            </div>
            
            ${isRelegation ? `
            <!-- Relegation-Specific: What Changed -->
            <div style="background: rgba(234,67,53,0.1); border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid rgba(234,67,53,0.2);">
                <h3 style="margin: 0 0 12px 0; color: #ea4335;">📋 What Changed</h3>
                <div style="display: grid; gap: 8px; font-size: 0.95em;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #ea4335;">●</span>
                        <span><strong>TV Revenue dropped</strong> — League deal went from ${formatCurrency(oldTierBaseline.league)} to ${formatCurrency(r.league)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #fbbc04;">●</span>
                        <span><strong>Matchday & Commercial retained</strong> — Currently ${formatCurrency(r.matchday + r.commercial)}, but will decay ~30% each season without promotion</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #34a853;">●</span>
                        <span><strong>All player contracts restructured</strong> — Relegation wage clauses activated, salaries adjusted to new economics</span>
                    </div>
                    ${releasedPlayers.length > 0 ? `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #e67e22;">●</span>
                        <span><strong>${releasedPlayers.length} player${releasedPlayers.length > 1 ? 's' : ''} activated release clause${releasedPlayers.length > 1 ? 's' : ''}</strong> — ${releasedPlayers.map(p => p.name + ' (' + p.rating + ' OVR)').join(', ')} left for free agency</span>
                    </div>
                    ` : ''}
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #3498db;">●</span>
                        <span><strong>Fanbase took 12% initial hit</strong> — Now ${f.fanbase.toLocaleString()} fans. Marketing investment can slow further decline.</span>
                    </div>
                </div>
            </div>
            ` : `
            <!-- Promotion-Specific: What Changed -->
            <div style="background: rgba(52,168,83,0.1); border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid rgba(52,168,83,0.2);">
                <h3 style="margin: 0 0 12px 0; color: #34a853;">📋 What Changed</h3>
                <div style="display: grid; gap: 8px; font-size: 0.95em;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #34a853;">●</span>
                        <span><strong>TV Revenue jumped</strong> — League deal went from ${formatCurrency(oldTierBaseline.league)} to ${formatCurrency(r.league)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #fbbc04;">●</span>
                        <span><strong>Matchday & Commercial growing</strong> — Got a 20% promotion boost, will grow toward tier baseline over 2-3 seasons</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #3498db;">●</span>
                        <span><strong>Fanbase boosted 15%</strong> — Now ${f.fanbase.toLocaleString()} fans. Winning keeps them, losing risks decline.</span>
                    </div>
                </div>
            </div>
            `}
            
            <!-- Roster Salary Breakdown -->
            <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 4px 0;">💰 Roster Salary Breakdown</h3>
                <div style="font-size: 0.8em; opacity: 0.5; margin-bottom: 15px;">
                    ${isRelegation ? 'Contracts have been restructured to reflect new tier economics. Expiring contracts will re-sign at Tier ' + currentTier + ' rates.' : 'Your roster is priced for Tier ' + currentTier + '. You may need to upgrade to compete.'}
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">
                    <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 6px;">
                        <div style="font-size: 0.85em; opacity: 0.7;">🔒 Locked Contracts (${locked.length} players)</div>
                        <div style="font-size: 1.2em; font-weight: bold;">${formatCurrency(lockedSalary)}</div>
                        <div style="font-size: 0.8em; opacity: 0.5;">Cannot be reduced until expiry</div>
                    </div>
                    <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 6px;">
                        <div style="font-size: 0.85em; opacity: 0.7;">📝 Expiring This Year (${expiring.length} players)</div>
                        <div style="font-size: 1.2em; font-weight: bold;">${formatCurrency(expiringSalary)}</div>
                        <div style="font-size: 0.8em; opacity: 0.5;">Will re-sign at T${currentTier} rates or enter FA</div>
                    </div>
                </div>
                
                <!-- Salary Usage Bar -->
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85em;">
                        <span>Total Payroll: ${formatCurrency(totalSalary)}</span>
                        <span>${currentTier === 1 ? 'Cap' : 'Limit'}: ${formatCurrency(spendingLimit)}</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 20px; position: relative; overflow: hidden;">
                        <div style="position: absolute; left: 0; top: 0; height: 100%; width: ${Math.min(100, (totalSalary / spendingLimit) * 100)}%; background: ${capSpace >= 0 ? 'linear-gradient(90deg, #34a853, #2e7d32)' : 'linear-gradient(90deg, #ea4335, #c62828)'}; border-radius: 4px;"></div>
                    </div>
                </div>
                
                <!-- Roster Table (top 10 by salary) -->
                <div style="max-height: 200px; overflow-y: auto; font-size: 0.85em;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="opacity: 0.6; font-size: 0.9em;">
                            <td style="padding: 4px 8px;">Player</td>
                            <td style="padding: 4px 8px; text-align: center;">OVR</td>
                            <td style="padding: 4px 8px; text-align: right;">Salary</td>
                            <td style="padding: 4px 8px; text-align: center;">Contract</td>
                            ${isRelegation ? '<td style="padding: 4px 8px; text-align: right; opacity: 0.5;">Was</td>' : ''}
                        </tr>
                        ${rosterBySalary.slice(0, 10).map(p => `
                            <tr style="border-top: 1px solid rgba(255,255,255,0.05);">
                                <td style="padding: 6px 8px;">${p.name} <span style="opacity: 0.5;">${p.position}</span></td>
                                <td style="padding: 6px 8px; text-align: center; color: ${getRatingColor(p.rating)};">${p.rating}${p.offRating !== undefined ? `<span style="font-size: 0.75em; opacity: 0.6; margin-left: 4px;">(${p.offRating}/${p.defRating})</span>` : ''}</td>
                                <td style="padding: 6px 8px; text-align: right; font-weight: bold;">${formatCurrency(p.salary)}</td>
                                <td style="padding: 6px 8px; text-align: center; color: ${p.contractYears <= 1 ? '#fbbc04' : '#aaa'};">${p.contractYears <= 1 ? 'Expiring' : p.contractYears + 'yr'}</td>
                                ${isRelegation && p.preRelegationSalary ? `<td style="padding: 6px 8px; text-align: right; opacity: 0.4; text-decoration: line-through;">${formatCurrency(p.preRelegationSalary)}</td>` : (isRelegation ? '<td style="padding: 6px 8px;"></td>' : '')}
                            </tr>
                        `).join('')}
                        ${rosterBySalary.length > 10 ? `<tr><td colspan="${isRelegation ? 5 : 4}" style="padding: 6px 8px; opacity: 0.5; text-align: center;">+ ${rosterBySalary.length - 10} more players...</td></tr>` : ''}
                    </table>
                </div>
            </div>
            
            <!-- Spending Strategy Adjustment -->
            ${currentTier !== 1 ? `
            <div style="background: rgba(102,126,234,0.1); border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid rgba(102,126,234,0.2);">
                <h3 style="margin: 0 0 10px 0;">⚙️ Adjust Spending Strategy</h3>
                <div style="font-size: 0.85em; opacity: 0.7; margin-bottom: 12px;">
                    Set how much of your revenue to allocate to player salaries. ${isRelegation ? 'Higher spending lets you keep more talent, but leaves less cushion if revenue continues to drop.' : 'You may want to start conservative and increase spending as revenue grows.'}
                </div>
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                    <span style="font-size: 0.85em; white-space: nowrap;">Conservative (60%)</span>
                    <input type="range" id="transitionSpendingSlider" min="60" max="90" value="${Math.round(spendingRatio * 100)}" 
                        style="flex: 1; cursor: pointer; accent-color: #667eea;"
                        oninput="updateTransitionSpending(this.value)">
                    <span style="font-size: 0.85em; white-space: nowrap;">Aggressive (90%)</span>
                </div>
                <div style="text-align: center;">
                    <span style="font-size: 1.1em; font-weight: bold;" id="transitionSpendingPct">${Math.round(spendingRatio * 100)}%</span>
                    <span style="font-size: 0.9em; opacity: 0.7;"> of revenue → </span>
                    <span style="font-size: 1.1em; font-weight: bold; color: #667eea;" id="transitionSpendingLimit">${formatCurrency(spendingLimit)}</span>
                    <span style="font-size: 0.9em; opacity: 0.7;"> spending limit → </span>
                    <span style="font-size: 1.1em; font-weight: bold;" id="transitionCapSpace" style="color: ${capSpace >= 0 ? '#34a853' : '#ea4335'};">${formatCurrency(capSpace)}</span>
                    <span style="font-size: 0.9em; opacity: 0.7;"> cap space</span>
                </div>
            </div>
            ` : ''}
            
            <!-- Key Advice -->
            <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 20px; margin-bottom: 25px;">
                <h3 style="margin: 0 0 10px 0;">💡 Planning Ahead</h3>
                <div style="display: grid; gap: 8px; font-size: 0.9em; line-height: 1.5;">
                    ${isRelegation ? `
                        <div>• <strong>${expiring.length} player${expiring.length !== 1 ? 's' : ''} expiring</strong> — they'll re-sign at T${currentTier} salaries (much cheaper). Prioritize keeping your best performers.</div>
                        <div>• <strong>Your retained revenue gives you an edge</strong> — your ${formatCurrency(spendingLimit)} limit is ${formatCurrency(spendingLimit - Math.round(newTotalBaseline * spendingRatio))} more than a native T${currentTier} team. Use this to dominate.</div>
                        <div>• <strong>Revenue will decay ~30% per year</strong> without promotion. Year 1 is your best shot at bouncing back while your budget is strongest.</div>
                        <div>• <strong>Free agents will be available at T${currentTier} prices</strong> — much cheaper than your locked contracts. Look for high-rated bargains.</div>
                    ` : `
                        <div>• <strong>Your budget is growing</strong> — it will take 2-3 seasons for revenue to reach full T${currentTier} levels. Spend carefully early on.</div>
                        <div>• <strong>You'll face T${currentTier}-caliber teams</strong> — your roster may need upgrades to be competitive. Target the free agency market.</div>
                        <div>• <strong>${expiring.length} contract${expiring.length !== 1 ? 's' : ''} expiring</strong> — re-signing will be at T${currentTier} rates (more expensive). Make sure you can afford them.</div>
                    `}
                </div>
            </div>
            
            <!-- Continue Button -->
            <div style="text-align: center;">
                <button onclick="dismissTransitionBriefing()" class="success" style="font-size: 1.2em; padding: 15px 50px;">
                    Continue to ${currentTier === 1 ? 'Draft' : 'Player Development'} →
                </button>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════
    // DEVELOPMENT SUMMARY
    // ═══════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════
    // INJURY MODAL
    // ═══════════════════════════════════════════════════════════════

    // Injury modal — details header (player info + injury name/severity)
    static injuryDetails({ player, team, injury }) {
        const severityColor = {
            'minor': '#fbbc04',
            'moderate': '#ff9800',
            'severe': '#ea4335',
            'season-ending': '#c62828'
        };
        return `
            <div style="text-align: center; margin-bottom: 15px;">
                <h3 style="margin: 0 0 10px 0; font-size: 1.4em;">${player.name}</h3>
                <div style="opacity: 0.8; font-size: 0.95em;">${team.name} • ${player.position} • ${player.rating} OVR</div>
            </div>
            
            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                <div style="font-size: 1.3em; font-weight: bold; color: ${severityColor[injury.severity]}; margin-bottom: 8px;">
                    ${injury.name}
                </div>
                <div style="opacity: 0.9; text-transform: capitalize;">
                    Severity: ${injury.severity}
                </div>
            </div>
        `;
    }

    // Injury modal — AI team decision info
    static injuryAiDecision({ team, player, aiDecision, injury }) {
        return `
            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; text-align: center;">
                <p style="font-size: 1.1em; margin-bottom: 15px;">
                    ${team.name} has placed <strong>${player.name}</strong> ${aiDecision === 'rest' ? 'on the injury report' : 'as day-to-day'}.
                </p>
                ${aiDecision === 'rest' ?
                    `<p>Expected return: ${injury.gamesRemaining === 999 ? 'End of season' : injury.gamesRemaining + ' games'}</p>` :
                    `<p>Playing through injury with reduced effectiveness (${injury.gamesRemainingIfPlaying} games to full recovery)</p>`
                }
            </div>
        `;
    }

    // Injury modal — user choice options (rest vs play through)
    static injuryUserOptions({ player, injury }) {
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="injury-option-btn" data-option="rest" onclick="selectInjuryOption('rest')" style="background: rgba(52,168,83,0.2); padding: 20px; border-radius: 8px; cursor: pointer; border: 3px solid transparent; transition: all 0.2s;">
                    <h4 style="margin: 0 0 10px 0; color: #34a853;">✅ Rest (Recommended)</h4>
                    <div style="margin-bottom: 8px;"><strong>Out:</strong> ${injury.gamesRemaining} games</div>
                    <div style="opacity: 0.9;">Returns at 100% health</div>
                </div>
                
                <div class="injury-option-btn" data-option="playThrough" onclick="selectInjuryOption('playThrough')" style="background: rgba(255,152,0,0.2); padding: 20px; border-radius: 8px; cursor: pointer; border: 3px solid transparent; transition: all 0.2s;">
                    <h4 style="margin: 0 0 10px 0; color: #ff9800;">⚠️ Play Through</h4>
                    <div style="margin-bottom: 8px;"><strong>Available for games</strong></div>
                    <div style="margin-bottom: 8px;">Rating: ${player.rating} → ${player.rating + injury.ratingPenalty}</div>
                    <div style="opacity: 0.9;">Recovery: ${injury.gamesRemainingIfPlaying} games</div>
                </div>
            </div>
            
            <div style="margin-top: 15px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 6px; font-size: 0.9em; opacity: 0.8;">
                💡 Playing through injury extends recovery time and reduces performance
            </div>
        `;
    }

    // Injury modal — severe/season-ending (no choice)
    static injurySevereOptions({ player, injury, formatCurrency, dpeEligible, dpeAmount }) {
        const fc = formatCurrency || UIRenderer.formatCurrency;
        return `
            <div style="background: rgba(234,67,53,0.2); padding: 20px; border-radius: 8px; border: 2px solid rgba(234,67,53,0.5);">
                <h4 style="margin: 0 0 15px 0; color: #ea4335;">🚨 Placed on Injured Reserve</h4>
                <div style="margin-bottom: 10px;">
                    <strong>Expected Return:</strong> ${injury.gamesRemaining === 999 ? 'End of season' : injury.gamesRemaining + ' games'}
                </div>
                ${injury.carryOver ? '<div style="margin-bottom: 10px; color: #ea4335;"><strong>⚠️ Will miss start of next season</strong></div>' : ''}
                ${dpeEligible ?
                    `<div style="margin-top: 15px; padding: 15px; background: rgba(52,168,83,0.2); border-radius: 6px; border: 1px solid rgba(52,168,83,0.5);">
                        <strong style="color: #34a853;">✅ Disabled Player Exception Approved</strong>
                        <div style="margin-top: 8px; opacity: 0.9;">You may sign a replacement player for ${fc(dpeAmount)}</div>
                    </div>` : ''
                }
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════
    // AI TRADE PROPOSAL
    // ═══════════════════════════════════════════════════════════════

    // AI trade proposal — header line
    static aiTradeProposalHeader(aiTeamName) {
        return `<strong style="color: #fbbc04;">${aiTeamName}</strong> wants to make a trade with you!`;
    }

    // AI trade proposal — player card (reused for both sides + picks)
    static aiTradeProposalPlayerCard({ player, getRatingColor, formatCurrency }) {
        const rc = getRatingColor || (() => '#667eea');
        const fc = formatCurrency || UIRenderer.formatCurrency;
        return `
            <div style="background: rgba(255,255,255,0.05); padding: 10px; margin-bottom: 8px; border-radius: 6px;">
                <div>
                    <strong>${player.name}</strong>
                    <span style="opacity: 0.8; margin-left: 10px;">${player.position}</span>
                    <span style="opacity: 0.8; margin-left: 10px;">Age ${player.age}</span>
                </div>
                <div style="margin-top: 4px; font-size: 0.9em;">
                    ${UIRenderer.compactRating(player, rc)}
                    <span style="opacity: 0.7; margin-left: 15px;">💰 ${fc(player.salary)}</span>
                </div>
            </div>
        `;
    }

    // AI trade proposal — draft pick card
    static aiTradeProposalPickCard({ pick, pickValue }) {
        return `
            <div style="background: rgba(52,168,83,0.15); border: 1px solid rgba(52,168,83,0.4); padding: 10px; margin-bottom: 8px; border-radius: 6px;">
                <div>
                    <strong>🏀 ${pick.year} Round ${pick.round} Draft Pick</strong>
                </div>
                <div style="margin-top: 4px; font-size: 0.9em;">
                    <span style="color: #34a853; font-weight: bold;">Est. Value: ~${pickValue}</span>
                </div>
            </div>
        `;
    }

    // AI trade proposal — summary line
    static aiTradeProposalSummary({ userGivesValue, aiGivesValue }) {
        const netValue = aiGivesValue - userGivesValue;
        return `
            <div style="font-size: 1.1em;">
                <div style="margin-bottom: 10px;">
                    <strong>Trade Value:</strong> 
                    You give ${userGivesValue} OVR → Receive ${aiGivesValue} OVR
                    <span style="color: ${netValue >= 0 ? '#34a853' : '#ea4335'}; font-weight: bold; margin-left: 10px;">
                        (${netValue >= 0 ? '+' : ''}${netValue})
                    </span>
                </div>
                <div style="opacity: 0.8; font-size: 0.9em;">
                    ${netValue > 5 ? '✅ Great deal for you!' : netValue >= 0 ? '✅ Fair trade' : netValue >= -5 ? '⚠️ Slight value loss' : '❌ Bad value for you'}
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════
    // FRANCHISE HISTORY
    // ═══════════════════════════════════════════════════════════════

    static franchiseHistory({ history, getRankSuffix }) {
        if (!history || history.length === 0) {
            return `
                <div style="text-align: center; padding: 40px; opacity: 0.7;">
                    <div style="font-size: 3em; margin-bottom: 15px;">📋</div>
                    <p style="font-size: 1.1em;">No completed seasons yet.</p>
                    <p>Complete your first season to start building your franchise history!</p>
                </div>
            `;
        }

        const totalWins = history.reduce((sum, s) => sum + (s.userTeam ? s.userTeam.wins : 0), 0);
        const totalLosses = history.reduce((sum, s) => sum + (s.userTeam ? s.userTeam.losses : 0), 0);
        const championships = history.filter(s => {
            if (!s.champions || !s.userTeam) return false;
            const tier = s.userTeam.tier;
            const champ = tier === 1 ? s.champions.tier1 : tier === 2 ? s.champions.tier2 : s.champions.tier3;
            return champ && champ.id === s.userTeam.id;
        }).length;

        let html = `
            <div style="background: linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.15)); border-radius: 12px; padding: 20px; margin-bottom: 25px; border: 1px solid rgba(102,126,234,0.2);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px; text-align: center;">
                    <div>
                        <div style="font-size: 2em; font-weight: bold; color: #667eea;">${history.length}</div>
                        <div style="opacity: 0.7; font-size: 0.85em;">Seasons</div>
                    </div>
                    <div>
                        <div style="font-size: 2em; font-weight: bold; color: #4ecdc4;">${totalWins}-${totalLosses}</div>
                        <div style="opacity: 0.7; font-size: 0.85em;">All-Time Record</div>
                    </div>
                    <div>
                        <div style="font-size: 2em; font-weight: bold; color: #ffd700;">${championships}</div>
                        <div style="opacity: 0.7; font-size: 0.85em;">Championships</div>
                    </div>
                    <div>
                        <div style="font-size: 2em; font-weight: bold; color: #f9d56e;">${UIRenderer.pct(totalWins, totalLosses)}%</div>
                        <div style="opacity: 0.7; font-size: 0.85em;">Win Pct</div>
                    </div>
                </div>
            </div>
        `;

        const sorted = [...history].sort((a, b) => b.season - a.season);
        const rsFn = UIRenderer.rankSuffix;

        for (const season of sorted) {
            const ut = season.userTeam;
            if (!ut) continue;
            html += UIRenderer._franchiseSeasonCard(season, ut, rsFn);
        }

        return html;
    }

    static _franchiseSeasonCard(season, ut, rankFn) {
        const tierLabel = UIRenderer.tierLabel(ut.tier);
        const winCol = UIRenderer.winColor(ut.wins, ut.losses);

        const userChamp = season.champions && (() => {
            const champ = ut.tier === 1 ? season.champions.tier1 : ut.tier === 2 ? season.champions.tier2 : season.champions.tier3;
            return champ && champ.id === ut.id;
        })();

        let promoRelStatus = '';
        if (season.promotions) {
            const promoted = [...(season.promotions.toT1 || []), ...(season.promotions.toT2 || [])];
            if (promoted.some(t => t.id === ut.id)) promoRelStatus = '⬆️ Promoted';
        }
        if (season.relegations) {
            const relegated = [...(season.relegations.fromT1 || []), ...(season.relegations.fromT2 || [])];
            if (relegated.some(t => t.id === ut.id)) promoRelStatus = '⬇️ Relegated';
        }

        const tierAwards = season.awards ? (ut.tier === 1 ? season.awards.tier1 : ut.tier === 2 ? season.awards.tier2 : season.awards.tier3) : null;
        let userAwards = [];
        if (tierAwards) {
            ['mvp', 'dpoy', 'roy', 'sixthMan', 'mostImproved'].forEach(award => {
                if (tierAwards[award] && tierAwards[award].teamId === ut.id) {
                    const labels = { mvp: 'MVP', dpoy: 'DPOY', roy: 'ROY', sixthMan: '6MOY', mostImproved: 'MIP' };
                    userAwards.push(`${labels[award]}: ${tierAwards[award].name}`);
                }
            });
        }

        const champLine = season.champions ? [
            season.champions.tier1 ? `T1: ${season.champions.tier1.name}` : null,
            season.champions.tier2 ? `T2: ${season.champions.tier2.name}` : null,
            season.champions.tier3 ? `T3: ${season.champions.tier3.name}` : null
        ].filter(Boolean).join(' · ') : '';

        return `
            <div style="background: rgba(255,255,255,0.04); border-radius: 10px; padding: 18px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.08); ${userChamp ? 'border-color: rgba(255,215,0,0.4); background: rgba(255,215,0,0.05);' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <span style="font-size: 1.3em; font-weight: bold;">${season.seasonLabel}</span>
                        <span style="opacity: 0.6; margin-left: 10px; font-size: 0.9em;">${tierLabel}</span>
                        ${userChamp ? '<span style="color: #ffd700; margin-left: 10px;">🏆 CHAMPION</span>' : ''}
                        ${promoRelStatus ? `<span style="margin-left: 10px; font-size: 0.9em;">${promoRelStatus}</span>` : ''}
                    </div>
                    <div style="font-size: 1.2em; font-weight: bold; ${winCol ? 'color:' + winCol + ';' : ''}">${ut.wins}-${ut.losses}</div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; font-size: 0.88em; opacity: 0.85;">
                    <div>📊 Finished ${rankFn(ut.rank)} of ${UIRenderer.tierTeamCount(ut.tier)}</div>
                    <div>👨‍💼 Coach: ${ut.coachName}</div>
                    ${ut.topPlayer ? `<div>⭐ Best: ${ut.topPlayer.name} (${ut.topPlayer.rating} OVR, ${ut.topPlayer.position})</div>` : ''}
                </div>
                
                ${userAwards.length > 0 ? `<div style="margin-top: 8px; font-size: 0.88em;">🏅 ${userAwards.join(' · ')}</div>` : ''}
                ${tierAwards && tierAwards.mvp ? `<div style="margin-top: 8px; font-size: 0.85em; opacity: 0.7;">League MVP: ${tierAwards.mvp.name} (${tierAwards.mvp.team}) — ${tierAwards.mvp.ppg.toFixed(1)} PPG, ${tierAwards.mvp.rpg.toFixed(1)} RPG, ${tierAwards.mvp.apg.toFixed(1)} APG</div>` : ''}
                ${champLine ? `<div style="margin-top: 6px; font-size: 0.82em; opacity: 0.6;">🏆 ${champLine}</div>` : ''}
            </div>
        `;
    }


    // ═══════════════════════════════════════════════════════════════
    // DEVELOPMENT & OFFSEASON
    // ═══════════════════════════════════════════════════════════════

    /**
     * Player rating change row (shared by multiple screens)
     */
    static ratingChangeRow(log, index) {
        const isImprovement = log.change > 0;
        const color = isImprovement ? '#34a853' : '#ea4335';
        const bgColor = isImprovement ? 'rgba(52,168,83,0.1)' : 'rgba(234,67,53,0.1)';
        return `
            <div style="background: ${bgColor}; padding: 12px; margin-bottom: 8px; border-radius: 6px; border-left: 4px solid ${color};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${log.name}</strong>
                        <span style="opacity: 0.8; margin-left: 10px;">${log.position || ''} · ${log.age} years old</span>
                    </div>
                    <div>
                        <span style="color: #999;">${log.oldRating}</span>
                        <span style="margin: 0 10px;">→</span>
                        <span style="color: ${color}; font-weight: bold;">${log.newRating}</span>
                        <span style="color: ${color}; margin-left: 10px;">(${isImprovement ? '+' : ''}${log.change})</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Retirement row for notable retirements table
     */
    static retirementTableRow(r) {
        const peakColor = r.peakRating >= 90 ? '#fbbc04' : r.peakRating >= 85 ? '#34a853' : '#8ab4f8';
        const hofBadge = r.peakRating >= 93 ? ' 🏅' : r.peakRating >= 88 && r.careerLength >= 12 ? ' ⭐' : '';
        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                <td style="padding: 8px 6px;"><strong>${r.name}</strong>${hofBadge}</td>
                <td style="padding: 8px 6px; text-align: center;">${r.position}</td>
                <td style="padding: 8px 6px; text-align: center;">${r.age}</td>
                <td style="padding: 8px 6px; text-align: center; color: ${peakColor}; font-weight: bold;">${r.peakRating}</td>
                <td style="padding: 8px 6px; text-align: center;">${r.careerLength}yr</td>
                <td style="padding: 8px 6px; opacity: 0.8;">T${r.tier} ${r.teamName}</td>
            </tr>
        `;
    }

    // ═══════════════════════════════════════════════════════════════
    // STANDINGS
    // ═══════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════
    // FREE AGENCY
    // ═══════════════════════════════════════════════════════════════

    static freeAgentCard({ player, capSpace, ratingColor, canAfford }) {
        return `
            <div style="background: rgba(255,255,255,0.05); padding: 12px; margin-bottom: 8px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${player.name}</strong>
                    <span style="opacity: 0.8; margin-left: 10px;">${player.position} · Age ${player.age}</span>
                    <span style="margin-left: 10px;">${UIRenderer.compactRating(player)}</span>
                    <span style="opacity: 0.7; margin-left: 10px;">💰 ${UIRenderer.formatCurrency(player.salary)}/yr</span>
                </div>
                <button onclick="signFreeAgent(${player.id})" ${!canAfford ? 'disabled' : ''} class="success" style="padding: 6px 16px; ${!canAfford ? 'opacity: 0.4; cursor: not-allowed;' : ''}">Sign</button>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════
    // ROSTER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    // Cap status card for roster management screen
    static rosterCapStatus({ totalSalary, salaryCap, salaryFloor, remainingCap, isOverCap, isUnderFloor,
                            isRevenueBasedCap, hasCapBoost, boostLabel, boostAmount,
                            teamChemistry, chemistryColor, chemistryDesc, formatCurrency }) {
        const fc = formatCurrency || UIRenderer.formatCurrency;
        return `
            <div style="margin-bottom: 15px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span><strong>Total Salary:</strong></span>
                    <span style="color: ${isOverCap ? '#ea4335' : isUnderFloor ? '#fbbc04' : '#34a853'}; font-weight: bold;">${fc(totalSalary)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span><strong>${isRevenueBasedCap ? 'Spending Limit:' : 'Salary Cap:'}</strong></span>
                    <span>${fc(salaryCap)}${hasCapBoost ? ` <span style="color:#4ecdc4;font-size:0.85em;">(${boostLabel})</span>` : (isRevenueBasedCap ? ' <span style="font-size:0.8em;opacity:0.6;">(revenue-based)</span>' : '')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span><strong>Salary Floor:</strong></span>
                    <span style="opacity: 0.8;">${fc(salaryFloor)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span><strong>Cap Space:</strong></span>
                    <span style="color: ${isOverCap ? '#ea4335' : '#34a853'}; font-weight: bold;">${fc(remainingCap)}</span>
                </div>
                <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span><strong>Team Chemistry:</strong></span>
                        <span style="color: ${chemistryColor}; font-weight: bold;">${teamChemistry} - ${chemistryDesc}</span>
                    </div>
                    <div style="background: rgba(0,0,0,0.3); height: 10px; border-radius: 5px; overflow: hidden;">
                        <div style="background: ${chemistryColor}; height: 100%; width: ${teamChemistry}%; transition: width 0.3s;"></div>
                    </div>
                </div>
                ${isOverCap ? `
                    <div style="margin-top: 12px; padding: 10px; background: rgba(234,67,53,0.2); border-radius: 5px; border: 1px solid #ea4335;">
                        <strong style="color: #ea4335;">⚠️ OVER ${isRevenueBasedCap ? 'SPENDING LIMIT' : 'CAP'}!</strong> You must drop players before advancing to next season.
                    </div>
                ` : ''}
                ${isUnderFloor ? `
                    <div style="margin-top: 12px; padding: 10px; background: rgba(251,188,4,0.2); border-radius: 5px; border: 1px solid #fbbc04;">
                        <strong style="color: #fbbc04;">⚠️ UNDER SALARY FLOOR!</strong> You need to spend at least ${fc(salaryFloor)} on player salaries.
                    </div>
                ` : ''}
                ${hasCapBoost ? `
                    <div style="margin-top: 12px; padding: 10px; background: rgba(78,205,196,0.15); border-radius: 5px; border: 1px solid #4ecdc4;">
                        <strong style="color: #4ecdc4;">${boostLabel}</strong>
                        <div style="font-size: 0.9em; margin-top: 4px; opacity: 0.85;">+${fc(boostAmount)} temporary cap boost to help transition your roster.</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Individual roster player card
    static rosterPlayerCard({ player, canDrop, contractYears, contractColor, injuryDisplay,
                             fatigueDisplay, releaseClauseDisplay, measurablesDisplay,
                             collabDisplay, attrPreview, ratingColor, formatCurrency }) {
        const fc = formatCurrency || UIRenderer.formatCurrency;
        return `
            <div style="background: rgba(255,255,255,0.1); padding: 12px; margin-bottom: 8px; border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div>
                            <strong>${player.name}</strong>${collabDisplay}
                            <span style="opacity: 0.8; margin-left: 10px;">${player.position}</span>
                            <span style="opacity: 0.8; margin-left: 10px;">Age ${player.age}</span>
                            ${measurablesDisplay}
                            <span style="color: ${contractColor}; margin-left: 10px; font-weight: bold;">📝 ${contractYears}yr${contractYears > 1 ? 's' : ''}</span>
                            ${releaseClauseDisplay}
                            ${injuryDisplay}
                        </div>
                        <div style="margin-top: 4px; font-size: 0.9em;">
                            ${UIRenderer.compactRating(player)}
                            <span style="opacity: 0.7; margin-left: 15px;">💰 ${fc(player.salary)}</span>
                            ${fatigueDisplay}
                            <span style="margin-left: 12px;">${attrPreview}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button onclick="togglePlayerAttributes(${player.id})" style="padding: 8px 12px; font-size: 0.85em; background: rgba(255,255,255,0.1);">📊</button>
                        <button onclick="dropPlayer(${player.id})" class="danger" style="padding: 8px 16px; font-size: 0.9em;" ${!canDrop ? 'disabled' : ''}>
                            Drop
                        </button>
                    </div>
                </div>
                <div id="playerAttrs_${player.id}" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                </div>
            </div>
        `;
    }

    // TRADE SCREEN
    // ═══════════════════════════════════════════════════════════════

    // Trade roster player row (selectable, with checkbox)
    static tradeRosterRow({ player, isSelected, side, ratingColor, formatCurrency }) {
        const fc = formatCurrency || UIRenderer.formatCurrency;
        const selColor = side === 'user' ? '#fbbc04' : '#34a853';
        const bgColor = isSelected ? `rgba(${side === 'user' ? '251,188,4' : '52,168,83'},0.2)` : 'rgba(255,255,255,0.05)';
        const toggleFn = side === 'user' ? 'toggleUserTradePlayer' : 'toggleAiTradePlayer';
        const contractYears = player.contractYears || 1;
        const contractColor = contractYears === 1 ? '#fbbc04' : '#34a853';
        return `
            <div style="background: ${bgColor}; padding: 10px; margin-bottom: 6px; border-radius: 6px; display: flex; align-items: center; cursor: pointer; border: ${isSelected ? `2px solid ${selColor}` : '2px solid transparent'};" onclick="${toggleFn}(${player.id})">
                <input type="checkbox" ${isSelected ? 'checked' : ''} style="margin-right: 10px;" onclick="event.stopPropagation(); ${toggleFn}(${player.id})">
                <div style="flex: 1;">
                    <div>
                        <strong>${player.name}</strong>
                        <span style="opacity: 0.8; margin-left: 10px;">${player.position}</span>
                        <span style="opacity: 0.8; margin-left: 10px;">Age ${player.age}</span>
                        <span style="color: ${contractColor}; margin-left: 10px; font-weight: bold;">📝 ${contractYears}yr</span>
                    </div>
                    <div style="margin-top: 4px; font-size: 0.9em;">
                        ${UIRenderer.compactRating(player)}
                        <span style="opacity: 0.7; margin-left: 15px;">💰 ${fc(player.salary)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Trade pick row (owned, selectable)
    static tradePickRow({ teamId, year, round, isSelected, side, pickValue, violatesRule }) {
        const selColor = side === 'user' ? '#fbbc04' : '#34a853';
        const bgColor = isSelected ? `rgba(${side === 'user' ? '251,188,4' : '52,168,83'},0.2)` : 'rgba(255,255,255,0.05)';
        const toggleFn = side === 'user' ? 'toggleUserTradePick' : 'toggleAiTradePick';
        return `
            <div style="background: ${bgColor}; padding: 8px; margin-bottom: 4px; border-radius: 4px; display: flex; align-items: center; cursor: ${violatesRule ? 'not-allowed' : 'pointer'}; opacity: ${violatesRule ? '0.4' : '1'}; border: ${isSelected ? `2px solid ${selColor}` : '2px solid transparent'};"
                 onclick="${violatesRule ? '' : `${toggleFn}('${teamId}', ${year}, ${round})`}">
                <input type="checkbox" ${isSelected ? 'checked' : ''} ${violatesRule ? 'disabled' : ''} style="margin-right: 10px;">
                <div style="flex: 1; font-size: 0.9em;">
                    <strong>${year} Round ${round}</strong>
                    <span style="opacity: 0.7; margin-left: 10px;">Value: ~${pickValue}</span>
                    ${violatesRule ? '<span style="color: #ea4335; margin-left: 10px;">❌ Stepien Rule</span>' : ''}
                </div>
            </div>
        `;
    }

    // Trade pick row (owed to another team, non-selectable)
    static tradePickOwedRow({ year, round, ownerName }) {
        return `
            <div style="background: rgba(234,67,53,0.1); padding: 8px; margin-bottom: 4px; border-radius: 4px; font-size: 0.85em; opacity: 0.6;">
                <strong>${year} Round ${round}</strong>
                <span style="margin-left: 10px;">→ Owed to ${ownerName}</span>
            </div>
        `;
    }

    // Trade salary match info panel
    static tradeSalarySummary({ userGivesSalary, userReceivesSalary, salaryDiff, salaryMatch, formatCurrency }) {
        const fc = formatCurrency || UIRenderer.formatCurrency;
        return `
            <div class="salary-match-info" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2);">
                <div style="display: flex; justify-content: space-around; text-align: center; font-size: 0.9em;">
                    <div>
                        <div style="opacity: 0.8;">Your Salary</div>
                        <div style="font-weight: bold; margin-top: 5px;">${fc(userGivesSalary)}</div>
                    </div>
                    <div>
                        <div style="opacity: 0.8;">Their Salary</div>
                        <div style="font-weight: bold; margin-top: 5px;">${fc(userReceivesSalary)}</div>
                    </div>
                    <div>
                        <div style="opacity: 0.8;">Salary Match</div>
                        <div style="font-weight: bold; margin-top: 5px; color: ${salaryMatch ? '#34a853' : '#ea4335'};">
                            ${salaryMatch ? '✅ Within $2M' : '❌ Over $2M'}
                        </div>
                        <div style="font-size: 0.85em; opacity: 0.7; margin-top: 3px;">
                            (${fc(salaryDiff)} apart)
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════
    // ALL-STAR MODAL
    // ═══════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════
    // SCOUTING
    // ═══════════════════════════════════════════════════════════════

    // Scout player detail view
    static scoutPlayerDetail({ player, fit, watched, attrKeys, attrs, getRatingColor, formatCurrency, gradeColor, PlayerAttributes }) {
        const rc = getRatingColor || (() => '#667eea');
        const fc = formatCurrency || UIRenderer.formatCurrency;
        const gc = gradeColor || (() => '#aaa');
        return `
            <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 20px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div>
                        <h2 style="margin: 0;">${player.name} ${player.isCollegeGrad ? '🎓' : ''}</h2>
                        <div style="opacity: 0.7; margin-top: 4px;">
                            ${player.position} · Age ${player.age} · T${player._teamTier} ${player._teamName}
                            ${player.college ? ` · 🎓 ${player.college}` : ''}
                        </div>
                        <div style="font-size: 0.85em; opacity: 0.7; margin-top: 2px;">${fc(player.salary)} · ${player.contractYears}yr</div>
                    </div>
                </div>

                <div style="margin-bottom: 15px;">
                    ${UIRenderer.detailedRatingHeader(player, rc)}
                </div>
                
                ${player.measurables ? `
                <div style="display: flex; gap: 20px; margin-bottom: 15px; font-size: 0.9em; opacity: 0.8;">
                    <span>${PlayerAttributes.formatHeight(player.measurables.height)}</span>
                    <span>${player.measurables.weight}lbs</span>
                    <span>${PlayerAttributes.formatWingspan(player.measurables.wingspan)} WS</span>
                </div>
                ` : ''}
                
                <div style="margin-bottom: 15px;">
                    ${UIRenderer.splitAttributeGrid(attrs || player.attributes, PlayerAttributes)}
                </div>
                
                <div style="background: rgba(102,126,234,0.1); border-radius: 8px; padding: 15px; border: 1px solid rgba(102,126,234,0.3);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin: 0;">Team Fit Analysis</h3>
                        <span style="font-size: 1.5em; font-weight: bold; color: ${gc(fit.grade)};">${fit.grade}</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px;">
                        <div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.04); border-radius: 6px;">
                            <div style="font-size: 0.8em; opacity: 0.6; margin-bottom: 4px;">System Fit</div>
                            <div style="font-size: 1.3em; font-weight: bold; color: ${gc(fit.systemFit.grade)};">${fit.systemFit.grade}</div>
                        </div>
                        <div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.04); border-radius: 6px;">
                            <div style="font-size: 0.8em; opacity: 0.6; margin-bottom: 4px;">Role Clarity</div>
                            <div style="font-size: 0.95em; font-weight: bold;">${fit.roleFit.label}</div>
                        </div>
                        <div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.04); border-radius: 6px;">
                            <div style="font-size: 0.8em; opacity: 0.6; margin-bottom: 4px;">Chemistry</div>
                            <div style="font-size: 0.95em; font-weight: bold;">${fit.chemFit.label}</div>
                        </div>
                    </div>
                    
                    ${fit.systemFit.details.length > 0 || fit.chemFit.details.length > 0 ? `
                        <div style="font-size: 0.85em; opacity: 0.8;">
                            ${[...fit.systemFit.details, ...fit.chemFit.details].map(d => `<div style="margin-bottom: 3px;">${d}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <div style="text-align: center; margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                    <button onclick="${watched ? `removeFromWatchList(${player.id})` : `addToWatchList(${player.id})`}; showPlayerScoutDetail(${player.id});" 
                            style="padding: 10px 25px; font-size: 1em;">
                        ${watched ? '⭐ On Watch List (click to remove)' : '☆ Add to Watch List'}
                    </button>
                    <button onclick="renderScannerTab();" style="padding: 10px 25px; font-size: 1em;">
                        ← Back to Results
                    </button>
                </div>
            </div>
        `;
    }

    // Watch list table row
    static watchListRow({ p, fit, contractLabel, getRatingColor, gradeColor, formatCurrency }) {
        const rc = getRatingColor || (() => '#667eea');
        const gc = gradeColor || (() => '#aaa');
        const fc = formatCurrency || UIRenderer.formatCurrency;
        return `<tr style="border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer;" onclick="showPlayerScoutDetail(${p.id})">
            <td style="padding: 8px;"><strong>${p.name}</strong>${p.isCollegeGrad ? ' 🎓' : ''}</td>
            <td style="padding: 8px; text-align: center; font-weight: bold;">${p.position}</td>
            <td style="padding: 8px; text-align: center;">${p.age}</td>
            <td style="padding: 8px; text-align: center; font-weight: bold; color: ${rc(p.rating)};">${p.rating}${p.offRating !== undefined ? `<div style="font-size: 0.75em; opacity: 0.7; font-weight: normal;">${p.offRating}/${p.defRating}</div>` : ''}</td>
            <td style="padding: 8px; text-align: center; font-weight: bold; color: ${gc(fit.grade)};">${fit.grade}</td>
            <td style="padding: 8px; text-align: right; font-size: 0.9em;">${fc(p.salary)}</td>
            <td style="padding: 8px; text-align: center;">${contractLabel}</td>
            <td style="padding: 8px; font-size: 0.85em; opacity: 0.8;">T${p._teamTier} ${p._teamName}</td>
            <td style="padding: 8px; text-align: center;">
                <span onclick="event.stopPropagation(); removeFromWatchList(${p.id}); renderWatchListTab();" style="cursor: pointer;">❌</span>
            </td>
        </tr>`;
    }

    // Watch list — gone player row
    static watchListGoneRow({ w }) {
        return `<tr style="border-bottom: 1px solid rgba(255,255,255,0.06); opacity: 0.4;">
            <td style="padding: 8px;">${w.name}</td>
            <td colspan="7" style="padding: 8px; text-align: center;">No longer in the league</td>
            <td style="padding: 8px; text-align: center;">
                <span onclick="removeFromWatchList(${w.id}); renderWatchListTab();" style="cursor: pointer;">❌</span>
            </td>
        </tr>`;
    }

    // Scout results table row
    static scoutResultRow({ p, fit, watched, getRatingColor, gradeColor, formatCurrency }) {
        const rc = getRatingColor || (() => '#667eea');
        const gc = gradeColor || (() => '#aaa');
        const fc = formatCurrency || UIRenderer.formatCurrency;
        const gradBadge = p.isCollegeGrad ? ' 🎓' : '';
        return `<tr style="border-bottom: 1px solid rgba(255,255,255,0.06); ${watched ? 'background: rgba(251,188,4,0.08);' : ''}" 
                     onclick="showPlayerScoutDetail(${p.id})" style="cursor: pointer;">
            <td style="padding: 7px 8px;">
                <span onclick="event.stopPropagation(); ${watched ? `removeFromWatchList(${p.id})` : `addToWatchList(${p.id})`}; applyScoutFilter();" 
                      style="cursor: pointer; font-size: 1.1em;" title="${watched ? 'Remove from watch list' : 'Add to watch list'}">
                    ${watched ? '⭐' : '☆'}
                </span>
            </td>
            <td style="padding: 7px 8px;"><strong>${p.name}</strong>${gradBadge}</td>
            <td style="padding: 7px 8px; text-align: center; font-weight: bold;">${p.position}</td>
            <td style="padding: 7px 8px; text-align: center;">${p.age}</td>
            <td style="padding: 7px 8px; text-align: center; font-weight: bold; color: ${rc(p.rating)};">${p.rating}${p.offRating !== undefined ? `<div style="font-size: 0.72em; opacity: 0.7; font-weight: normal;">${p.offRating}/${p.defRating}</div>` : ''}</td>
            <td style="padding: 7px 8px; text-align: center; font-weight: bold; color: ${gc(fit.grade)}; font-size: 1.1em;">${fit.grade}</td>
            <td style="padding: 7px 8px; text-align: center; color: ${gc(fit.systemFit.grade)};">${fit.systemFit.grade}</td>
            <td style="padding: 7px 8px; text-align: center; font-size: 0.85em;">${fit.roleFit.label.replace(/🔥|📢|⬆️|⚠️/g, '').trim()}</td>
            <td style="padding: 7px 8px; text-align: center;">${fit.chemFit.label.split(' ')[0]}</td>
            <td style="padding: 7px 8px; text-align: right; font-size: 0.9em;">${fc(p.salary)}</td>
            <td style="padding: 7px 8px; text-align: center;">${p.contractYears}yr</td>
            <td style="padding: 7px 8px; font-size: 0.85em; opacity: 0.8;">T${p._teamTier} ${p._teamName}</td>
        </tr>`;
    }

    // Current coach display (full detail with traits)
    static currentCoachDisplay({ coach, synergy, traitBars, formatCurrency }) {
        const fc = formatCurrency || UIRenderer.formatCurrency;
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px;">
                <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                        <div>
                            <h3 style="font-size: 1.4em; margin-bottom: 4px;">${coach.name}</h3>
                            <div style="opacity: 0.7; font-size: 0.9em;">${coach.archetype}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 2em; font-weight: bold; color: ${coach.overallColor || '#667eea'};">${coach.overall}</div>
                            <div style="font-size: 0.75em; opacity: 0.6;">OVERALL</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.9em; margin-bottom: 15px;">
                        <div>📅 Age: <strong>${coach.age}</strong></div>
                        <div>📋 Exp: <strong>${coach.experience} yrs</strong></div>
                        <div>🏆 Titles: <strong>${coach.championships}</strong></div>
                        <div>📊 Career: <strong>${coach.careerWins}W-${coach.careerLosses}L</strong></div>
                        <div>💰 Salary: <strong>${fc(coach.salary)}/yr</strong></div>
                        <div>📝 Contract: <strong>${coach.contractYears} yr${coach.contractYears !== 1 ? 's' : ''}</strong></div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.85em; opacity: 0.7;">System-Roster Synergy</div>
                        <div style="font-size: 1.3em; font-weight: bold; color: ${synergy.grade === 'A' ? '#4ecdc4' : synergy.grade === 'B' ? '#45b7d1' : synergy.grade === 'C' ? '#f9d56e' : '#ff6b6b'};">
                            ${synergy.grade} (${synergy.score})
                        </div>
                        <div style="font-size: 0.8em; opacity: 0.7; margin-top: 2px;">${synergy.description}</div>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin-bottom: 12px;">Coaching Tendencies</h3>
                    ${traitBars}
                </div>
            </div>`;
    }

    // Coach trait bar
    static coachTraitBar({ def, val, color, label }) {
        return `
            <div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-bottom: 2px;">
                    <span>${def.icon} ${def.name}</span>
                    <span style="color: ${color};">${val} — ${label}</span>
                </div>
                <div style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${val}%; background: ${color}; border-radius: 4px; transition: width 0.3s;"></div>
                </div>
            </div>`;
    }

    // Roster needs analysis tab
    static needsTab({ positionCounts, expiring, expiringNext, avgAge, young, prime, veteran, rosterLength,
                      weakestAttrs, strongestAttrs, attrAvgs, formatCurrency, PlayerAttributes }) {
        const fc = formatCurrency || UIRenderer.formatCurrency;
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <!-- Position Depth -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 15px;">
                    <h3 style="margin: 0 0 12px 0;">📊 Position Depth</h3>
                    ${Object.entries(positionCounts).map(([pos, players]) => {
                        const count = players.length;
                        const needColor = count === 0 ? '#ea4335' : count === 1 ? '#f28b82' : count === 2 ? '#fbbc04' : '#34a853';
                        const needLabel = count === 0 ? 'EMPTY' : count === 1 ? 'THIN' : count === 2 ? 'OK' : 'DEEP';
                        const avgRating = count > 0 ? Math.round(players.reduce((s, p) => s + p.rating, 0) / count) : 0;
                        return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <div>
                                <strong>${pos}</strong>
                                <span style="opacity: 0.6; margin-left: 8px; font-size: 0.85em;">${players.map(p => `${p.name.split(' ').pop()} (${p.rating})`).join(', ') || 'None'}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                ${count > 0 ? `<span style="opacity: 0.6; font-size: 0.85em;">Avg ${avgRating}</span>` : ''}
                                <span style="background: ${needColor}22; color: ${needColor}; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold;">${needLabel}</span>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
                
                <!-- Age Profile -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 15px;">
                    <h3 style="margin: 0 0 12px 0;">👥 Roster Profile</h3>
                    <div style="margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                            <span>Average Age</span><strong>${avgAge}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                            <span>Young (≤24)</span><strong style="color: #34a853;">${young}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                            <span>Prime (25-30)</span><strong style="color: #8ab4f8;">${prime}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                            <span>Veteran (31+)</span><strong style="color: #fbbc04;">${veteran}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 6px; padding-top: 8px;">
                            <span>Roster Size</span><strong>${rosterLength}/15</strong>
                        </div>
                    </div>
                </div>
                
                <!-- Contract Status -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 15px;">
                    <h3 style="margin: 0 0 12px 0;">📝 Contract Outlook</h3>
                    ${expiring.length > 0 ? `
                        <div style="margin-bottom: 10px;">
                            <div style="font-weight: bold; color: #fbbc04; margin-bottom: 6px;">⚠️ Expiring This Year (${expiring.length})</div>
                            ${expiring.map(p => `<div style="padding: 3px 0; font-size: 0.9em;">${p.name} (${p.position}, ${p.rating} OVR) — ${fc(p.salary)}</div>`).join('')}
                        </div>
                    ` : '<div style="opacity: 0.6; margin-bottom: 10px;">No contracts expiring this year</div>'}
                    ${expiringNext.length > 0 ? `
                        <div>
                            <div style="font-weight: bold; opacity: 0.7; margin-bottom: 6px;">Next Year (${expiringNext.length})</div>
                            ${expiringNext.map(p => `<div style="padding: 3px 0; font-size: 0.9em; opacity: 0.7;">${p.name} (${p.position}, ${p.rating} OVR)</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <!-- Attribute Analysis -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 15px;">
                    <h3 style="margin: 0 0 12px 0;">📈 Attribute Profile</h3>
                    <div style="margin-bottom: 10px;">
                        <div style="font-weight: bold; color: #ea4335; margin-bottom: 6px;">Weakest Areas</div>
                        ${weakestAttrs.map(key => {
                            const def = (PlayerAttributes.PHYSICAL_ATTRS || {})[key] || (PlayerAttributes.MENTAL_ATTRS || {})[key] || {};
                            return `<div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.9em;">
                                <span>${def.icon || ''} ${def.name || key}</span>
                                <strong style="color: #f28b82;">${attrAvgs[key]}</strong>
                            </div>`;
                        }).join('')}
                    </div>
                    <div>
                        <div style="font-weight: bold; color: #34a853; margin-bottom: 6px;">Strongest Areas</div>
                        ${strongestAttrs.map(key => {
                            const def = (PlayerAttributes.PHYSICAL_ATTRS || {})[key] || (PlayerAttributes.MENTAL_ATTRS || {})[key] || {};
                            return `<div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.9em;">
                                <span>${def.icon || ''} ${def.name || key}</span>
                                <strong style="color: #34a853;">${attrAvgs[key]}</strong>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════
    // COACHING
    // ═══════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════
    // CALENDAR
    // ═══════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════
    // POST-GAME SUMMARY (popup after user team games)
    // ═══════════════════════════════════════════════════════════════

    static postGameSummary({ userTeam, opponent, isHome, userWon, topPlayer, date, userRecord }) {
        const resultColor = userWon ? '#4ecdc4' : '#ff6b6b';
        const resultText = userWon ? 'VICTORY' : 'DEFEAT';
        const resultIcon = userWon ? '🎉' : '😤';

        let html = `
            <div style="text-align: center; padding: 10px;">
                <div style="font-size: 1.5em; margin-bottom: 5px;">${resultIcon}</div>
                <div style="font-size: 1.8em; font-weight: bold; color: ${resultColor}; margin-bottom: 5px;">${resultText}</div>
                <div style="opacity: 0.7; font-size: 0.9em; margin-bottom: 15px;">${date}</div>
                
                <div style="display: flex; justify-content: center; align-items: center; gap: 25px; margin-bottom: 20px;">
                    <div style="text-align: center;">
                        <div style="font-size: 0.9em; opacity: 0.8; margin-bottom: 5px;">${UIRenderer._tn(userTeam)}</div>
                        <div style="font-size: 2.5em; font-weight: bold; color: ${userWon ? '#4ecdc4' : '#fff'};">${userTeam.score}</div>
                    </div>
                    <div style="font-size: 1.2em; opacity: 0.4;">—</div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.9em; opacity: 0.8; margin-bottom: 5px;">${UIRenderer._tn(opponent)}</div>
                        <div style="font-size: 2.5em; font-weight: bold; color: ${!userWon ? '#4ecdc4' : '#fff'};">${opponent.score}</div>
                    </div>
                </div>
                
                <div style="opacity: 0.7; margin-bottom: 15px;">Record: ${userRecord.wins}-${userRecord.losses}</div>
        `;

        if (topPlayer) {
            const fgPct = topPlayer.fga > 0 ? ((topPlayer.fgm / topPlayer.fga) * 100).toFixed(0) : 0;
            html += `
                <div style="background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.2); border-radius: 10px; padding: 15px; margin-bottom: 10px;">
                    <div style="font-size: 0.85em; opacity: 0.7; margin-bottom: 5px;">⭐ Player of the Game</div>
                    <div style="font-size: 1.2em; font-weight: bold; margin-bottom: 8px;">${topPlayer.name}</div>
                    <div style="display: flex; justify-content: center; gap: 20px; font-size: 1.1em;">
                        <span><strong>${topPlayer.pts}</strong> <span style="opacity: 0.6; font-size: 0.8em;">PTS</span></span>
                        <span><strong>${topPlayer.reb}</strong> <span style="opacity: 0.6; font-size: 0.8em;">REB</span></span>
                        <span><strong>${topPlayer.ast}</strong> <span style="opacity: 0.6; font-size: 0.8em;">AST</span></span>
                    </div>
                    <div style="opacity: 0.6; font-size: 0.85em; margin-top: 5px;">${topPlayer.fgm}-${topPlayer.fga} FG (${fgPct}%) · ${topPlayer.min} MIN</div>
                </div>
            `;
        }

        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left;">';
        [userTeam, opponent].forEach(team => {
            html += `<div><div style="font-weight: bold; margin-bottom: 8px; opacity: 0.8;">${UIRenderer._tn(team)} Leaders</div>`;
            const top3 = (team.players || []).sort((a, b) => b.pts - a.pts).slice(0, 3);
            top3.forEach(p => {
                html += `<div style="padding: 4px 0; font-size: 0.88em;"><strong>${p.name}</strong> <span style="opacity: 0.7;">${p.pts} pts, ${p.reb} reb, ${p.ast} ast</span></div>`;
            });
            html += '</div>';
        });
        html += '</div></div>';
        return html;
    }

    // ═══════════════════════════════════════════════════════════════
    // CALENDAR SCORES VIEW
    // ═══════════════════════════════════════════════════════════════

    static calendarDayScores({ games, date, userTeamId, showHeader }) {
        if (!games || games.length === 0) {
            return '<p style="text-align: center; opacity: 0.7; padding: 15px;">No games on this date.</p>';
        }

        let html = '';
        if (showHeader !== false && date) {
            html += `<div style="margin-bottom: 10px; font-weight: bold; opacity: 0.8;">${date} — ${games.length} game${games.length !== 1 ? 's' : ''}</div>`;
        }
        html += '<div style="display: grid; gap: 6px;">';

        games.forEach(game => {
            const isUserGame = game.homeTeamId === userTeamId || game.awayTeamId === userTeamId;
            const bg = isUserGame ? 'background: rgba(102,126,234,0.15); border: 1px solid rgba(102,126,234,0.3);' : 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);';
            const hasBox = !!game.boxScore;
            const cursor = game.played ? 'cursor: pointer;' : '';
            const onclick = game.played ? `onclick="showBoxScore('${date}', ${game.homeTeamId}, ${game.awayTeamId})"` : '';

            if (game.played) {
                const homeWon = game.homeScore > game.awayScore;
                html += `
                    <div style="${bg} padding: 10px 12px; border-radius: 6px; ${cursor}" ${onclick}>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="flex: 1;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                                    <span ${!homeWon ? 'style="opacity: 0.6;"' : 'style="font-weight: bold;"'}>${game.homeName || 'Home'}</span>
                                    <span ${!homeWon ? 'style="opacity: 0.6;"' : 'style="font-weight: bold;"'}>${game.homeScore}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span ${homeWon ? 'style="opacity: 0.6;"' : 'style="font-weight: bold;"'}>${game.awayName || 'Away'}</span>
                                    <span ${homeWon ? 'style="opacity: 0.6;"' : 'style="font-weight: bold;"'}>${game.awayScore}</span>
                                </div>
                            </div>
                            ${hasBox ? '<div style="margin-left: 12px; opacity: 0.4; font-size: 0.8em;">📊</div>' : ''}
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div style="${bg} padding: 10px 12px; border-radius: 6px; opacity: 0.6;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>${game.homeName || 'Home'} vs ${game.awayName || 'Away'}</span>
                            <span>Upcoming</span>
                        </div>
                    </div>
                `;
            }
        });

        html += '</div>';
        return html;
    }

    // ═══════════════════════════════════════════════════════════════
    // CALENDAR GRID VIEW
    // ═══════════════════════════════════════════════════════════════

    static calendarGrid({ months, currentDate, userGamesByDate, allGamesByDate, seasonDates, startYear }) {
        const allStarStart = seasonDates.allStarStart;
        const allStarEnd = seasonDates.allStarEnd;
        const tradeDeadline = seasonDates.tradeDeadline;
        const regSeasonEnd = seasonDates.tier1End;
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h2 style="margin: 0;">📅 Season ${startYear}-${(startYear + 1) % 100} Calendar</h2>
                <button onclick="document.getElementById('calendarModal').classList.add('hidden')" 
                        style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 1em;">
                    ✕ Close
                </button>
            </div>
            
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 15px; font-size: 0.85em;">
                <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <span style="width: 14px; height: 14px; background: rgba(102,126,234,0.6); border-radius: 3px; display: inline-block;"></span> Your Game (Home)
                </span>
                <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <span style="width: 14px; height: 14px; background: rgba(234,67,53,0.5); border-radius: 3px; display: inline-block;"></span> Your Game (Away)
                </span>
                <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <span style="width: 14px; height: 14px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; display: inline-block;"></span> League Games
                </span>
                <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <span style="width: 14px; height: 14px; background: rgba(255,215,0,0.3); border-radius: 3px; display: inline-block;"></span> Special Event
                </span>
                <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <span style="width: 14px; height: 14px; border: 2px solid #ffd700; border-radius: 3px; display: inline-block;"></span> Today
                </span>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; max-height: 65vh; overflow-y: auto; padding-right: 5px;">
        `;
        
        for (const { year, month } of months) {
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            html += `
            <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 12px; border: 1px solid rgba(255,255,255,0.06);">
                <h3 style="text-align: center; margin: 0 0 10px 0; font-size: 1.05em; color: #ffd700;">${monthNames[month]} ${year}</h3>
                <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center;">
            `;
            
            for (const d of dayNames) {
                html += `<div style="font-size: 0.7em; opacity: 0.5; padding: 2px 0;">${d}</div>`;
            }
            for (let i = 0; i < firstDay; i++) {
                html += '<div></div>';
            }
            
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = dateStr === currentDate;
                const userGame = userGamesByDate[dateStr];
                const dayGames = allGamesByDate[dateStr];
                const isAllStar = dateStr >= allStarStart && dateStr <= allStarEnd;
                const isTradeDeadline = dateStr === tradeDeadline;
                const isSeasonEnd = dateStr === regSeasonEnd;
                const isSpecial = isAllStar || isTradeDeadline || isSeasonEnd;
                
                let bgColor = 'transparent';
                let border = 'none';
                let textColor = 'rgba(255,255,255,0.3)';
                let title = '';
                let dotHTML = '';
                
                if (userGame) {
                    if (userGame.isHome) {
                        bgColor = userGame.played ? 'rgba(102,126,234,0.35)' : 'rgba(102,126,234,0.6)';
                    } else {
                        bgColor = userGame.played ? 'rgba(234,67,53,0.3)' : 'rgba(234,67,53,0.5)';
                    }
                    textColor = '#fff';
                    const oppName = userGame.opponent ? userGame.opponent.name.split(' ').pop() : '???';
                    title = `${userGame.isHome ? 'vs' : '@'} ${oppName}`;
                    dotHTML = `<div style="font-size: 0.55em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.9; margin-top: 1px;">${userGame.isHome ? 'vs' : '@'} ${oppName}</div>`;
                } else if (dayGames && dayGames.total > 0) {
                    bgColor = 'rgba(255,255,255,0.06)';
                    textColor = 'rgba(255,255,255,0.6)';
                    title = `${dayGames.total} games`;
                    dotHTML = `<div style="font-size: 0.5em; opacity: 0.4; margin-top: 1px;">${dayGames.total}g</div>`;
                }
                
                if (isSpecial) {
                    bgColor = 'rgba(255,215,0,0.2)';
                    textColor = '#ffd700';
                    if (isAllStar) { title = '⭐ All-Star Break'; dotHTML = `<div style="font-size: 0.5em; color: #ffd700;">⭐</div>`; }
                    if (isTradeDeadline) { title = '⏰ Trade Deadline'; dotHTML = `<div style="font-size: 0.5em; color: #ffd700;">TDL</div>`; }
                    if (isSeasonEnd) { title = '🏁 Season End'; dotHTML = `<div style="font-size: 0.5em; color: #ffd700;">END</div>`; }
                }
                
                if (isToday) border = '2px solid #ffd700';
                
                html += `
                    <div style="background: ${bgColor}; border-radius: 4px; padding: 3px 1px; min-height: 36px;
                        color: ${textColor}; border: ${border}; cursor: ${(userGame || dayGames) ? 'pointer' : 'default'};
                        position: relative; transition: background 0.15s;"
                        title="${title}" onclick="${(userGame || dayGames) ? `showCalendarDayDetail('${dateStr}')` : ''}">
                        <div style="font-size: 0.8em; font-weight: ${isToday ? 'bold' : 'normal'};">${day}</div>
                        ${dotHTML}
                    </div>
                `;
            }
            
            html += '</div></div>';
        }
        
        html += '</div>';
        html += '<div id="calendarDayDetail" style="margin-top: 15px; display: none;"></div>';
        return html;
    }

    static watchGamePlayEntry(event) {
        const sideColor = event.side === 'home' ? '#4ecdc4' : '#ff6b6b';
        const sideLabel = event.side === 'home' ? 'HME' : 'AWY';
        let icon = '';
        let text = '';
        let highlight = false;

        switch (event.type) {
            case 'made_shot':
                icon = event.shotType === '3pt' ? '🎯' : '🏀';
                text = `<strong>${event.player}</strong> ${event.shotType === '3pt' ? 'three-pointer' : 'scores'}`;
                highlight = event.shotType === '3pt';
                break;
            case 'missed_shot':
                icon = '❌';
                text = `<strong>${event.player}</strong> misses ${event.shotType === '3pt' ? 'three' : 'shot'}`;
                break;
            case 'turnover':
                icon = '💨';
                text = `<strong>${event.player}</strong> turnover`;
                break;
            case 'steal':
                icon = '🤚';
                text = `<strong>${event.player}</strong> steal`;
                break;
            case 'foul_shooting':
                icon = '🎯';
                text = `<strong>${event.shooter}</strong> ${event.ftMade}/${event.ftAttempted} FT`;
                break;
            case 'foul':
                icon = '🫳';
                text = `Foul on <strong>${event.fouler}</strong>`;
                break;
            case 'and_one':
                icon = '💪';
                text = `<strong>${event.player}</strong> AND ONE!`;
                highlight = true;
                break;
            case 'run':
                icon = '🔥';
                text = `<strong>${event.run}-0 run!</strong>`;
                highlight = true;
                break;
            case 'quarter_end':
                return `<div style="text-align: center; padding: 8px; margin: 4px 0; border-top: 1px solid rgba(255,255,255,0.1); border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 0.85em; opacity: 0.6;">End of Q${event.quarter} — ${event.awayScore}-${event.homeScore}</div>`;
            case 'overtime':
                return `<div style="text-align: center; padding: 8px; margin: 4px 0; background: rgba(255,215,0,0.1); border-radius: 6px; color: #ffd700; font-weight: bold;">⚡ OVERTIME</div>`;
            case 'timeout':
                return `<div style="text-align: center; padding: 6px; margin: 3px 0; opacity: 0.5; font-size: 0.82em;">⏱️ Timeout — ${event.side === 'home' ? 'Home' : 'Away'}</div>`;
            case 'game_end':
                return '';
            default:
                return '';
        }

        const bg = highlight ? 'background: rgba(255,215,0,0.08);' : '';
        return `
            <div style="display: flex; align-items: center; gap: 8px; padding: 5px 8px; margin: 1px 0; border-radius: 4px; font-size: 0.85em; ${bg}">
                <span style="font-size: 1.1em; flex-shrink: 0;">${icon}</span>
                <span style="color: ${sideColor}; font-size: 0.7em; opacity: 0.7; flex-shrink: 0; width: 28px;">${sideLabel}</span>
                <span style="flex: 1;">${text}</span>
                <span style="opacity: 0.4; font-size: 0.78em; flex-shrink: 0;">${event.clock || ''}</span>
            </div>
        `;
    }

    static watchGameLeaders(homeStats, awayStats, homeName, awayName) {
        const topN = (stats, n) => [...stats]
            .filter(s => s.points > 0)
            .sort((a, b) => b.points - a.points)
            .slice(0, n);

        let html = '';
        [{stats: awayStats, name: awayName, color: '#ff6b6b'}, {stats: homeStats, name: homeName, color: '#4ecdc4'}].forEach(({stats, name, color}) => {
            html += `<div style="margin-bottom: 15px;">
                <div style="font-size: 0.8em; font-weight: bold; color: ${color}; margin-bottom: 6px;">${name}</div>`;
            topN(stats, 4).forEach(p => {
                const fgPct = p.fieldGoalsAttempted > 0 ? Math.round(p.fieldGoalsMade / p.fieldGoalsAttempted * 100) : 0;
                html += `
                    <div style="padding: 4px 0; font-size: 0.82em; display: flex; justify-content: space-between;">
                        <span><strong>${p.playerName}</strong></span>
                        <span style="opacity: 0.8;">${p.points} pts ${p.rebounds} reb ${p.assists} ast</span>
                    </div>`;
            });
            html += '</div>';
        });
        return html;
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 4B — MAJOR MODALS & DASHBOARDS
    // ═══════════════════════════════════════════════════════════════

    static financeDashboard(d) {
        const fc = d.formatCurrency;
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                <div style="background: rgba(255,255,255,0.08); border-radius: 10px; padding: 18px; text-align: center;">
                    <div style="font-size: 0.85em; opacity: 0.7; margin-bottom: 6px;">Total Revenue</div>
                    <div style="font-size: 1.6em; font-weight: bold; color: #2ecc71;">${fc(d.totalRev)}</div>
                    <div style="font-size: 0.8em; margin-top: 4px;">${d.trendHtml}</div>
                </div>
                <div style="background: rgba(255,255,255,0.08); border-radius: 10px; padding: 18px; text-align: center;">
                    <div style="font-size: 0.85em; opacity: 0.7; margin-bottom: 6px;">${d.capLabel}</div>
                    <div style="font-size: 1.6em; font-weight: bold; color: #667eea;">${fc(d.spendingLimit)}</div>
                    <div style="font-size: 0.8em; opacity: 0.7; margin-top: 4px;">Cap Space: <span style="color: ${d.capSpace > 0 ? '#34a853' : '#ea4335'}; font-weight: bold;">${fc(d.capSpace)}</span></div>
                </div>
                <div style="background: rgba(255,255,255,0.08); border-radius: 10px; padding: 18px; text-align: center;">
                    <div style="font-size: 0.85em; opacity: 0.7; margin-bottom: 6px;">Financial Health</div>
                    <div style="font-size: 1.4em; font-weight: bold; color: ${d.stabilityColor};">${d.stabilityLabel}</div>
                    <div style="font-size: 0.8em; opacity: 0.7; margin-top: 4px;">Using ${Math.round(d.usagePct * 100)}% of limit</div>
                </div>
            </div>
            <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 15px; margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 0.9em;"><strong>Payroll:</strong> ${fc(d.currentSalary)}</span>
                    <span style="font-size: 0.9em; opacity: 0.7;">Floor: ${fc(d.salaryFloor)} | Limit: ${fc(d.spendingLimit)}</span>
                </div>
                <div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 24px; position: relative; overflow: hidden;">
                    <div style="position: absolute; left: 0; top: 0; height: 100%; width: ${Math.min(100, d.usagePct * 100)}%; background: ${d.usagePct > 0.90 ? 'linear-gradient(90deg, #ea4335, #c62828)' : d.usagePct > 0.80 ? 'linear-gradient(90deg, #fbbc04, #f57f17)' : 'linear-gradient(90deg, #34a853, #2e7d32)'}; border-radius: 4px; transition: width 0.5s;"></div>
                    ${d.salaryFloor > 0 ? `<div style="position: absolute; left: ${(d.salaryFloor / d.spendingLimit) * 100}%; top: 0; height: 100%; width: 2px; background: #fbbc04; opacity: 0.8;"></div>` : ''}
                </div>
            </div>
            <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 20px; margin-bottom: 25px;">
                <h3 style="margin: 0 0 5px 0;">Revenue Breakdown</h3>
                <div style="font-size: 0.8em; opacity: 0.6; margin-bottom: 15px;">${d.capExplain}</div>
                <div style="display: grid; gap: 12px;">
                    ${UIRenderer._revenueBar('📺 League (TV Deal)', d.rev.league, d.barPct(d.rev.league), '#667eea', 'Shared equally among Tier ' + d.tier + ' teams.', fc)}
                    ${UIRenderer._revenueBar('🏟️ Matchday (Gate)', d.rev.matchday, d.barPct(d.rev.matchday), '#e67e22', 'Driven by fanbase and winning.', fc)}
                    ${UIRenderer._revenueBar('🤝 Commercial (Sponsors)', d.rev.commercial, d.barPct(d.rev.commercial), '#9b59b6', 'Based on tier and results.', fc)}
                    ${UIRenderer._revenueBar('🏆 Legacy (Brand)', d.rev.legacy, d.barPct(d.rev.legacy), '#f1c40f', 'Built from championships and history.', fc)}
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 20px;">
                    <h3 style="margin: 0 0 12px 0;">👥 Fanbase</h3>
                    <div style="font-size: 1.4em; font-weight: bold; margin-bottom: 6px;">${d.fanbase.toLocaleString()} fans</div>
                    <div style="font-size: 0.85em; margin-bottom: 4px;">${d.fanLabel} <span style="opacity: 0.6;">(${d.fanMultiple}× tier avg)</span></div>
                    <div style="font-size: 0.8em; opacity: 0.6;">Tier average: ${d.tierAvgFanbase.toLocaleString()}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 20px;">
                    <h3 style="margin: 0 0 12px 0;">📊 Financial Standing</h3>
                    <div style="margin-bottom: 8px;"><span style="font-size: 0.85em;">vs Tier ${d.tier} Average:</span> <span style="font-size: 1.1em; font-weight: bold; color: ${d.revVsAvgColor}; margin-left: 8px;">${d.revVsAvgLabel}</span></div>
                    <div style="font-size: 0.85em; margin-bottom: 4px;">Tier avg revenue: ${fc(d.tierAvgRevenue)}</div>
                    <div style="font-size: 0.85em; margin-bottom: 4px;">Market: ${d.marketLabel} (${d.marketSize.toFixed(2)}×)${d.metroPopStr}</div>
                    ${!d.isHardCap ? `<div style="font-size: 0.85em;">Spending ratio: ${Math.round(d.spendingRatio * 100)}% of revenue ${d.ratioWarning}</div>` : ''}
                </div>
            </div>
            <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 20px; margin-bottom: 15px;">
                <h3 style="margin: 0 0 12px 0;">🏛️ Franchise Legacy</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
                    ${[['Championships',d.lp.championships||0],['Seasons in T1',d.lp.seasonsInT1||0],['Playoff Apps',d.lp.playoffAppearances||0],['Iconic Players',d.lp.iconicPlayers||0],['Yrs in Tier '+d.tier,d.seasonsInCurrentTier||0]].map(([l,v]) => `<div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px;"><div style="font-size: 1.3em; font-weight: bold;">${v}</div><div style="font-size: 0.8em; opacity: 0.7;">${l}</div></div>`).join('')}
                </div>
            </div>
            ${!d.isHardCap ? `
            <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 20px;">
                <h3 style="margin: 0 0 12px 0;">⚙️ Spending Strategy</h3>
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                    <span style="font-size: 0.85em; white-space: nowrap;">Conservative (60%)</span>
                    <input type="range" id="spendingRatioSlider" min="60" max="90" value="${Math.round(d.spendingRatio * 100)}" style="flex: 1; cursor: pointer; accent-color: #667eea;" oninput="updateSpendingRatio(this.value)">
                    <span style="font-size: 0.85em; white-space: nowrap;">Aggressive (90%)</span>
                </div>
                <div style="text-align: center; margin-bottom: 8px;">
                    <span style="font-size: 1.1em; font-weight: bold;" id="spendingRatioDisplay">${Math.round(d.spendingRatio * 100)}%</span>
                    <span style="font-size: 0.85em; opacity: 0.7;"> of revenue → </span>
                    <span style="font-size: 1.1em; font-weight: bold; color: #667eea;" id="spendingLimitDisplay">${fc(d.spendingLimit)}</span>
                    <span style="font-size: 0.85em; opacity: 0.7;"> spending limit</span>
                </div>
            </div>` : `
            <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 20px;">
                <div style="font-size: 0.85em; opacity: 0.7; line-height: 1.5;"><strong>Tier 1 — Fixed Salary Cap Model</strong><br>All Tier 1 teams share equally in the league's national TV contract and operate under a uniform $100M salary cap with an $80M salary floor.</div>
            </div>`}
            <div style="margin-top: 20px; padding: 15px; background: rgba(102,126,234,0.1); border-radius: 10px; border: 1px solid rgba(102,126,234,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>⚙️ Owner Mode</strong>
                        <div style="font-size: 0.8em; opacity: 0.7; margin-top: 2px;">${d.ownerMode ? 'Active — you manage arena, tickets, sponsors, and marketing each offseason.' : 'Inactive — finances are managed automatically. Toggle on to take control.'}</div>
                    </div>
                    <button onclick="toggleOwnerMode()" style="padding: 8px 20px; font-size: 0.9em; background: ${d.ownerMode ? 'linear-gradient(135deg, #2ecc71, #27ae60)' : 'linear-gradient(135deg, #95a5a6, #7f8c8d)'};">${d.ownerMode ? '✅ ON' : '⬜ OFF'}</button>
                </div>
            </div>
            ${d.ownerMode ? `
            <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;"><div style="font-size: 0.85em; opacity: 0.7;">🏟️ Arena</div><div style="font-weight: bold;">${d.arenaCapacity.toLocaleString()} seats · ${d.arenaCondition}% condition</div></div>
                <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;"><div style="font-size: 0.85em; opacity: 0.7;">🤝 Sponsors</div><div style="font-weight: bold;">${d.sponsorCount} deal${d.sponsorCount !== 1 ? 's' : ''}${d.sponsorCount > 0 ? ' · ' + fc(d.sponsorRevenue) + '/yr' : ''}</div></div>
                <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;"><div style="font-size: 0.85em; opacity: 0.7;">🎟️ Ticket Pricing</div><div style="font-weight: bold;">${d.ticketPct}% of base</div></div>
                <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;"><div style="font-size: 0.85em; opacity: 0.7;">📢 Marketing</div><div style="font-weight: bold;">${d.marketingBudget > 0 ? fc(d.marketingBudget) + '/season' : 'None'}</div></div>
            </div>` : ''}
        `;
    }

    static _revenueBar(label, amount, barWidth, color, desc, fc) {
        return `<div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>${label}</span><span style="font-weight: bold;">${fc(amount)}</span></div>
            <div style="background: rgba(255,255,255,0.1); border-radius: 3px; height: 12px; overflow: hidden;"><div style="height: 100%; width: ${barWidth}%; background: ${color}; border-radius: 3px;"></div></div>
            <div style="font-size: 0.75em; opacity: 0.5; margin-top: 2px;">${desc}</div>
        </div>`;
    }

    // ─── Phase 4C: Extracted methods ───

    /**
     * Today's games panel + upcoming user schedule
     */
    static todaysGamesPanel({ todaysGames, userTier, userTeams, userTeamId, currentDate, CalendarEngine }) {
        let html = `<div style="background: rgba(102,126,234,0.15); padding: 12px; border-radius: 8px; border: 1px solid rgba(102,126,234,0.3);">`;
        html += `<div style="font-weight: bold; margin-bottom: 8px; font-size: 1.05em;">🏀 Today's Games — ${CalendarEngine.formatDateShort(currentDate)}</div>`;

        let userTierGames = [];
        if (userTier === 1) userTierGames = todaysGames.tier1.filter(g => !g.played);
        else if (userTier === 2) userTierGames = todaysGames.tier2.filter(g => !g.played);
        else userTierGames = todaysGames.tier3.filter(g => !g.played);

        const displayGames = userTierGames.slice(0, 6);
        displayGames.forEach(game => {
            const home = userTeams.find(t => t.id === game.homeTeamId);
            const away = userTeams.find(t => t.id === game.awayTeamId);
            const isUserGame = (game.homeTeamId === userTeamId || game.awayTeamId === userTeamId);
            html += `<div class="game-card" style="${isUserGame ? 'border: 2px solid rgba(102,126,234,0.6); background: rgba(102,126,234,0.15);' : ''}">
                <span class="team">${away ? away.name : '?'}</span>
                <span class="vs">@</span>
                <span class="team">${home ? home.name : '?'}</span>
            </div>`;
        });

        if (userTierGames.length > 6) {
            html += `<div style="text-align: center; opacity: 0.7; font-size: 0.9em;">+${userTierGames.length - 6} more Tier ${userTier} games</div>`;
        }

        const otherTierSummary = [];
        if (userTier !== 1 && todaysGames.tier1.filter(g => !g.played).length > 0) {
            otherTierSummary.push(`T1: ${todaysGames.tier1.filter(g => !g.played).length} games`);
        }
        if (userTier !== 2 && todaysGames.tier2.filter(g => !g.played).length > 0) {
            otherTierSummary.push(`T2: ${todaysGames.tier2.filter(g => !g.played).length} games`);
        }
        if (userTier !== 3 && todaysGames.tier3.filter(g => !g.played).length > 0) {
            otherTierSummary.push(`T3: ${todaysGames.tier3.filter(g => !g.played).length} games`);
        }
        if (otherTierSummary.length > 0) {
            html += `<div style="text-align: center; opacity: 0.6; font-size: 0.85em; margin-top: 8px;">Also today: ${otherTierSummary.join(' | ')}</div>`;
        }

        html += `</div>`;
        return html;
    }

    /**
     * Upcoming user games list
     */
    static upcomingGamesPanel({ upcomingGames, userTeams, userTeamId, CalendarEngine }) {
        let html = '<div style="font-weight: bold; margin-bottom: 8px; font-size: 0.95em; opacity: 0.8;">Your Upcoming Games</div>';
        upcomingGames.forEach(game => {
            const home = userTeams.find(t => t.id === game.homeTeamId);
            const away = userTeams.find(t => t.id === game.awayTeamId);
            const dateDisplay = CalendarEngine.formatDateShort(game.date);
            const isHome = game.homeTeamId === userTeamId;

            html += `
                <div class="game-card" style="flex-direction: column; padding: 10px 15px;">
                    <div style="font-size: 0.8em; opacity: 0.6; margin-bottom: 4px;">${dateDisplay}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <span class="team">${away ? away.name : '?'}</span>
                        <span class="vs">@</span>
                        <span class="team">${home ? home.name : '?'}</span>
                        ${isHome ? '<span style="font-size: 0.75em; opacity: 0.5; margin-left: 8px;">🏠</span>' : '<span style="font-size: 0.75em; opacity: 0.5; margin-left: 8px;">✈️</span>'}
                    </div>
                </div>
            `;
        });
        return html;
    }

    /**
     * College grad table (filtered/sorted list)
     */
    static collegeGradTable({ filtered, selected, getRatingColor, formatCurrency, PlayerAttributes }) {
        if (filtered.length === 0) {
            return '<p style="text-align: center; opacity: 0.6; padding: 30px;">No graduates match this filter.</p>';
        }

        let html = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: rgba(255,255,255,0.15); position: sticky; top: 0;">
                        <th style="padding: 10px; text-align: left; width: 40px;">✓</th>
                        <th style="padding: 10px; text-align: left;">Player</th>
                        <th style="padding: 10px; text-align: center;">College</th>
                        <th style="padding: 10px; text-align: center;">Pos</th>
                        <th style="padding: 10px; text-align: center;">Age</th>
                        <th style="padding: 10px; text-align: center;">OVR</th>
                        <th style="padding: 10px; text-align: center;">Ceiling</th>
                        <th style="padding: 10px; text-align: right;">Salary</th>
                    </tr>
                </thead>
                <tbody>
        `;

        filtered.forEach(player => {
            const isChecked = selected.has(String(player.id));
            const ceilingColor = player.projectedCeiling >= 80 ? '#34a853' : player.projectedCeiling >= 70 ? '#fbbc04' : '#aaa';
            const tierLabel = player.tier === 2 ?
                '<span style="background: rgba(102,126,234,0.3); padding: 1px 6px; border-radius: 3px; font-size: 0.75em;">T2</span>' :
                '<span style="background: rgba(255,255,255,0.15); padding: 1px 6px; border-radius: 3px; font-size: 0.75em;">T3</span>';

            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); ${isChecked ? 'background: rgba(52,168,83,0.15);' : ''}">
                    <td style="padding: 8px 10px;">
                        <input type="checkbox" id="cg_${player.id}"
                               onchange="toggleCollegeGradSelection('${player.id}')"
                               ${isChecked ? 'checked' : ''}
                               style="width: 18px; height: 18px; cursor: pointer;">
                    </td>
                    <td style="padding: 8px 10px;">
                        <strong>${player.name}</strong> ${tierLabel}
                        <div style="font-size: 0.8em; opacity: 0.6;">
                            ${PlayerAttributes.formatHeight(player.measurables.height)} · ${player.measurables.weight}lbs · ${PlayerAttributes.formatWingspan(player.measurables.wingspan)} WS
                        </div>
                    </td>
                    <td style="padding: 8px 10px; text-align: center; font-size: 0.9em;">
                        🎓 ${player.college}
                    </td>
                    <td style="padding: 8px 10px; text-align: center; font-weight: bold;">
                        ${player.position}
                    </td>
                    <td style="padding: 8px 10px; text-align: center;">
                        ${player.age}
                    </td>
                    <td style="padding: 8px 10px; text-align: center; font-weight: bold; color: ${getRatingColor(player.rating)};">
                        ${player.rating}
                        ${player.offRating !== undefined ? `<div style="font-size: 0.72em; opacity: 0.65; font-weight: normal;">${player.offRating}/${player.defRating}</div>` : ''}
                    </td>
                    <td style="padding: 8px 10px; text-align: center; color: ${ceilingColor};">
                        ↑${player.projectedCeiling}
                    </td>
                    <td style="padding: 8px 10px; text-align: right;">
                        ${formatCurrency(player.salary)}
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        return html;
    }

    /**
     * Player attributes panel (measurables, physical, mental)
     */
    static playerAttributesPanel({ player, PlayerAttributes }) {
        const m = player.measurables || {};
        const a = player.attributes || {};

        let html = '';

        // Rating header with off/def balance
        html += `<div style="margin-bottom: 14px;">`;
        html += UIRenderer.detailedRatingHeader(player, PlayerAttributes.getAttrColor);
        html += `</div>`;

        html += '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px; font-size: 0.88em;">';

        // Column 1: Measurables
        html += '<div>';
        html += '<div style="font-weight: bold; margin-bottom: 8px; opacity: 0.8;">📏 MEASURABLES</div>';
        html += `<div style="margin-bottom: 4px;">Height: <strong>${PlayerAttributes.formatHeight(m.height || 78)}</strong></div>`;
        html += `<div style="margin-bottom: 4px;">Weight: <strong>${m.weight || 210} lbs</strong></div>`;
        html += `<div style="margin-bottom: 4px;">Wingspan: <strong>${PlayerAttributes.formatWingspan(m.wingspan || 82)}</strong></div>`;
        html += '</div>';

        // Helper for attribute bar
        const attrBar = (key, def) => {
            const val = a[key] || 50;
            const color = PlayerAttributes.getAttrColor(val);
            return `<div style="margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 1px;">
                    <span>${def.icon} ${def.name}</span>
                    <span style="color: ${color}; font-weight: bold;">${val}</span>
                </div>
                <div style="height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${val}%; background: ${color}; border-radius: 3px;"></div>
                </div>
            </div>`;
        };

        // Column 2: Offensive Attributes
        const offKeys = ['clutch', 'basketballIQ', 'speed'];
        const allDefs = { ...PlayerAttributes.PHYSICAL_ATTRS, ...PlayerAttributes.MENTAL_ATTRS };
        html += '<div>';
        html += '<div style="font-weight: bold; margin-bottom: 8px; color: #4ecdc4;">⚔️ OFFENSE</div>';
        for (const key of offKeys) {
            if (allDefs[key]) html += attrBar(key, allDefs[key]);
        }
        html += '</div>';

        // Column 3: Defensive Attributes
        const defKeys = ['strength', 'verticality', 'endurance'];
        html += '<div>';
        html += '<div style="font-weight: bold; margin-bottom: 8px; color: #45b7d1;">🛡️ DEFENSE</div>';
        for (const key of defKeys) {
            if (allDefs[key]) html += attrBar(key, allDefs[key]);
        }
        html += '</div>';

        // Column 4: Intangibles
        const intKeys = ['workEthic', 'coachability', 'collaboration'];
        html += '<div>';
        html += '<div style="font-weight: bold; margin-bottom: 8px; color: #96ceb4;">🧠 INTANGIBLES</div>';
        for (const key of intKeys) {
            if (allDefs[key]) html += attrBar(key, allDefs[key]);
        }
        html += '</div>';

        html += '</div>';
        return html;
    }

    /**
     * Pipeline prospect table (filtered)
     */
    static pipelineTable({ filtered }) {
        let html = `<table style="width: 100%; border-collapse: collapse;">
            <thead><tr style="background: rgba(255,255,255,0.1);">
                <th style="padding: 8px; text-align: left;">Prospect</th>
                <th style="padding: 8px; text-align: center;">College</th>
                <th style="padding: 8px; text-align: center;">Pos</th>
                <th style="padding: 8px; text-align: center;">Est. Rating</th>
                <th style="padding: 8px; text-align: center;">Ceiling</th>
                <th style="padding: 8px; text-align: center;">Tier Proj.</th>
            </tr></thead><tbody>`;

        filtered.forEach(p => {
            const rangeColor = p.midEstimate >= 70 ? '#34a853' : p.midEstimate >= 60 ? '#fbbc04' : '#aaa';
            const ceilingColor = p.projectedCeiling >= 80 ? '#34a853' : p.projectedCeiling >= 70 ? '#fbbc04' : '#aaa';

            html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                <td style="padding: 8px;"><strong>${p.name}</strong></td>
                <td style="padding: 8px; text-align: center; font-size: 0.9em;">🎓 ${p.college}</td>
                <td style="padding: 8px; text-align: center; font-weight: bold;">${p.position}</td>
                <td style="padding: 8px; text-align: center; color: ${rangeColor};">
                    <span style="opacity: 0.6;">${p.ratingLow}</span> — <strong>${p.midEstimate}</strong> — <span style="opacity: 0.6;">${p.ratingHigh}</span>
                </td>
                <td style="padding: 8px; text-align: center; color: ${ceilingColor};">↑${p.projectedCeiling}</td>
                <td style="padding: 8px; text-align: center;">${p.tier === 2 ? 'T2' : 'T3'}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        return html;
    }

    /**
     * Scanner tab filter controls
     */
    static scannerFilters({ f }) {
        return `
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; align-items: center;">
                <select id="scoutPos" onchange="applyScoutFilter()" style="padding: 6px;">
                    <option value="ALL" ${f.pos === 'ALL' ? 'selected' : ''}>All Pos</option>
                    <option value="PG" ${f.pos === 'PG' ? 'selected' : ''}>PG</option>
                    <option value="SG" ${f.pos === 'SG' ? 'selected' : ''}>SG</option>
                    <option value="SF" ${f.pos === 'SF' ? 'selected' : ''}>SF</option>
                    <option value="PF" ${f.pos === 'PF' ? 'selected' : ''}>PF</option>
                    <option value="C" ${f.pos === 'C' ? 'selected' : ''}>C</option>
                </select>
                <select id="scoutTier" onchange="applyScoutFilter()" style="padding: 6px;">
                    <option value="ALL" ${f.tier === 'ALL' ? 'selected' : ''}>All Tiers</option>
                    <option value="1" ${f.tier === '1' ? 'selected' : ''}>Tier 1</option>
                    <option value="2" ${f.tier === '2' ? 'selected' : ''}>Tier 2</option>
                    <option value="3" ${f.tier === '3' ? 'selected' : ''}>Tier 3</option>
                </select>
                <input id="scoutMinAge" type="number" placeholder="Min Age" value="${f.minAge}" onchange="applyScoutFilter()" style="width: 70px; padding: 6px;">
                <input id="scoutMaxAge" type="number" placeholder="Max Age" value="${f.maxAge}" onchange="applyScoutFilter()" style="width: 70px; padding: 6px;">
                <input id="scoutMinRating" type="number" placeholder="Min OVR" value="${f.minRating}" onchange="applyScoutFilter()" style="width: 70px; padding: 6px;">
                <input id="scoutMaxRating" type="number" placeholder="Max OVR" value="${f.maxRating}" onchange="applyScoutFilter()" style="width: 75px; padding: 6px;">
                <select id="scoutContract" onchange="applyScoutFilter()" style="padding: 6px;">
                    <option value="ALL" ${f.contractStatus === 'ALL' ? 'selected' : ''}>Any Contract</option>
                    <option value="expiring" ${f.contractStatus === 'expiring' ? 'selected' : ''}>Expiring (1yr)</option>
                    <option value="short" ${f.contractStatus === 'short' ? 'selected' : ''}>1-2yr</option>
                </select>
                <select id="scoutSort" onchange="applyScoutFilter()" style="padding: 6px;">
                    <option value="fit" ${f.sort === 'fit' ? 'selected' : ''}>Sort: Team Fit</option>
                    <option value="rating" ${f.sort === 'rating' ? 'selected' : ''}>Sort: Rating</option>
                    <option value="age" ${f.sort === 'age' ? 'selected' : ''}>Sort: Age</option>
                    <option value="salary" ${f.sort === 'salary' ? 'selected' : ''}>Sort: Salary</option>
                </select>
            </div>
            <div id="scoutResults" style="max-height: 55vh; overflow-y: auto;"></div>
        `;
    }

    /**
     * Scout results table header
     */
    static scoutResultsTableHeader({ count, truncated }) {
        let html = `<div style="font-size: 0.85em; opacity: 0.6; margin-bottom: 8px;">${count} players found${truncated ? ' (showing top 100)' : ''}</div>`;
        html += `<table style="width: 100%; border-collapse: collapse;">
            <thead><tr style="background: rgba(255,255,255,0.1); position: sticky; top: 0; z-index: 1;">
                <th style="padding: 8px; text-align: left; width: 30px;">⭐</th>
                <th style="padding: 8px; text-align: left;">Player</th>
                <th style="padding: 8px; text-align: center;">Pos</th>
                <th style="padding: 8px; text-align: center;">Age</th>
                <th style="padding: 8px; text-align: center;">OVR</th>
                <th style="padding: 8px; text-align: center;">Team Fit</th>
                <th style="padding: 8px; text-align: center;">System</th>
                <th style="padding: 8px; text-align: center;">Role</th>
                <th style="padding: 8px; text-align: center;">Chem</th>
                <th style="padding: 8px; text-align: right;">Salary</th>
                <th style="padding: 8px; text-align: center;">Yrs</th>
                <th style="padding: 8px; text-align: left;">Team</th>
            </tr></thead><tbody>`;
        return html;
    }

    /**
     * Watch list table header
     */
    static watchListTableHeader() {
        return `<table style="width: 100%; border-collapse: collapse;">
            <thead><tr style="background: rgba(255,255,255,0.1);">
                <th style="padding: 8px; text-align: left;">Player</th>
                <th style="padding: 8px; text-align: center;">Pos</th>
                <th style="padding: 8px; text-align: center;">Age</th>
                <th style="padding: 8px; text-align: center;">OVR</th>
                <th style="padding: 8px; text-align: center;">Fit</th>
                <th style="padding: 8px; text-align: right;">Salary</th>
                <th style="padding: 8px; text-align: center;">Contract</th>
                <th style="padding: 8px; text-align: left;">Team</th>
                <th style="padding: 8px; text-align: center;">Remove</th>
            </tr></thead><tbody>`;
    }

    /**
     * Watch list empty state
     */
    static watchListEmpty() {
        return `
            <div style="text-align: center; padding: 60px 20px; opacity: 0.6;">
                <div style="font-size: 2em; margin-bottom: 15px;">☆</div>
                <h3>No players on your watch list</h3>
                <p>Use the League Scanner to find and star players you want to track.</p>
            </div>
        `;
    }

    /**
     * Coach card in market list
     */
    static coachMarketCard({ coach, synergy, topTraits, isPoach, buyout, formatCurrency, CoachEngine }) {
        return `
            <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.08); display: grid; grid-template-columns: 1fr auto; gap: 15px; align-items: center;">
                <div>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                        <span style="font-size: 1.5em; font-weight: bold; color: ${CoachEngine.getOverallColor(coach.overall)};">${coach.overall}</span>
                        <div>
                            <strong style="font-size: 1.1em;">${coach.name}</strong>
                            <div style="font-size: 0.8em; opacity: 0.7;">${coach.archetype} · Age ${coach.age} · ${coach.experience} yrs exp</div>
                        </div>
                    </div>
                    <div style="font-size: 0.82em; opacity: 0.8; margin-bottom: 4px;">${topTraits}</div>
                    <div style="font-size: 0.82em; display: flex; gap: 15px; flex-wrap: wrap;">
                        <span>📊 ${coach.careerWins}W-${coach.careerLosses}L</span>
                        <span>🏆 ${coach.championships} title${coach.championships !== 1 ? 's' : ''}</span>
                        <span>💰 ${formatCurrency(coach.salary)}/yr × ${coach.contractYears || 1}yr</span>
                        <span style="color: ${synergy.grade === 'A' ? '#4ecdc4' : synergy.grade === 'B' ? '#45b7d1' : synergy.grade === 'C' ? '#f9d56e' : '#ff6b6b'};">Synergy: ${synergy.grade}</span>
                        ${isPoach ? `<span style="color: #ffa07a;">Buyout: ${formatCurrency(buyout)}</span>` : ''}
                        ${isPoach ? `<span style="opacity: 0.6;">From: ${coach._fromTeam}</span>` : ''}
                    </div>
                </div>
                <button onclick="hireCoach(${coach.id}, ${isPoach})" class="success" style="padding: 10px 20px; white-space: nowrap;">
                    ${isPoach ? '💼 Poach' : '✍️ Hire'}
                </button>
            </div>`;
    }

    /**
     * Current roster display (for FA sidebar)
     */
    static currentRosterSidebar({ roster, byPosition, teamEffCap, baseCap, tier, totalSalary, formatCurrency }) {
        if (!roster || roster.length === 0) {
            return '<p style="text-align: center; opacity: 0.6; padding: 20px;">No players on roster</p>';
        }

        const hasBoost = teamEffCap > baseCap * 1.1;
        const capLabel = tier === 1 ? 'Cap' : 'Limit';

        let html = `
            <div style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px; text-align: center;">
                <div style="font-size: 0.9em; opacity: 0.8;">Roster Size: ${roster.length}/15</div>
                <div style="font-size: 0.9em; opacity: 0.8; margin-top: 5px;">
                    Salary: ${formatCurrency(totalSalary)} / ${formatCurrency(teamEffCap)} ${capLabel}${hasBoost ? ` <span style="color:#4ecdc4;font-size:0.85em;">(elevated revenue)</span>` : ''}
                </div>
            </div>
        `;

        for (const [pos, players] of Object.entries(byPosition)) {
            if (players.length > 0) {
                html += `
                    <div style="margin-bottom: 15px;">
                        <div style="font-weight: bold; margin-bottom: 8px; padding: 5px; background: rgba(255,255,255,0.1); border-radius: 3px;">
                            ${pos} (${players.length})
                        </div>
                `;

                players.forEach(player => {
                    const yearsLeft = player.contractYears || 0;
                    html += `
                        <div style="display: flex; justify-content: space-between; padding: 8px; margin-bottom: 5px; background: rgba(255,255,255,0.03); border-radius: 3px; font-size: 0.9em;">
                            <div>
                                <strong>${player.name}</strong>
                                <span style="opacity: 0.7; margin-left: 5px;">(${player.age})</span>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: bold;">${player.rating}</div>
                                ${player.offRating !== undefined ? `<div style="font-size: 0.75em; opacity: 0.6;">${player.offRating}/${player.defRating}</div>` : ''}
                                <div style="opacity: 0.6; font-size: 0.85em;">${yearsLeft}yr${yearsLeft !== 1 ? 's' : ''}</div>
                            </div>
                        </div>
                    `;
                });

                html += '</div>';
            }
        }

        return html;
    }

    /**
     * College grad signing results
     */
    static collegeGradResults({ signed, lost, results }) {
        let html = `<div style="text-align: center; padding: 20px;">
            <h2 style="margin-bottom: 15px;">🎓 College Graduate Signing Results</h2>
            <div style="margin-bottom: 20px;">
                <span style="color: #34a853; font-size: 1.2em; font-weight: bold;">${signed} signed</span>
                ${lost > 0 ? `<span style="margin-left: 15px; color: #ea4335; font-size: 1.2em;">${lost} chose other teams</span>` : ''}
            </div>
            <div style="text-align: left; max-width: 500px; margin: 0 auto;">`;

        results.forEach(r => {
            html += `<div style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between;">
                <span><strong>${r.player.name}</strong> (${r.player.position}, ${r.player.rating} OVR) — 🎓 ${r.player.college}</span>
                <span style="color: ${r.signed ? '#34a853' : '#ea4335'}; font-weight: bold;">${r.signed ? '✅ Signed' : '❌ Declined'}</span>
            </div>`;
        });

        html += `</div>
            <button onclick="closeCollegeGradResults()" class="success" style="margin-top: 20px; font-size: 1.1em; padding: 12px 35px;">
                Continue →
            </button>
        </div>`;
        return html;
    }

    /**
     * Free agent player card (in-season FA list)
     */
    static freeAgentCard({ player, canSign, canAfford, rosterFull, getRatingColor, formatCurrency }) {
        const contractYears = player.contractYears;
        const contractColor = contractYears === 1 ? '#fbbc04' : '#34a853';

        return `
            <div style="background: rgba(255,255,255,0.05); padding: 12px; margin-bottom: 8px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <div>
                        <strong>${player.name}</strong>
                        <span style="opacity: 0.8; margin-left: 10px;">${player.position}</span>
                        <span style="opacity: 0.8; margin-left: 10px;">Age ${player.age}</span>
                        <span style="color: ${contractColor}; margin-left: 10px; font-weight: bold;">📝 ${contractYears}yr${contractYears > 1 ? 's' : ''}</span>
                    </div>
                    <div style="margin-top: 4px; font-size: 0.9em;">
                        ${UIRenderer.compactRating(player, getRatingColor)}
                        <span style="opacity: 0.7; margin-left: 15px;">💰 ${formatCurrency(player.salary)}</span>
                        ${!canAfford && !rosterFull ? `<span style="color: #ea4335; margin-left: 10px;">⚠️ Can't afford</span>` : ''}
                    </div>
                </div>
                <button onclick="signPlayer(${player.id})" class="success" style="padding: 8px 16px; font-size: 0.9em;" ${!canSign ? 'disabled' : ''} title="${!canAfford ? 'Not enough cap space' : rosterFull ? 'Roster full' : 'Sign player'}">
                    Sign
                </button>
            </div>
        `;
    }

    /**
     * Pipeline tab container with header and filter
     */
    static pipelineTabContainer({ currentSeason, previewCount }) {
        return `
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0;">Class of ${currentSeason + 2} · ${previewCount} Prospects</h3>
                        <div style="font-size: 0.85em; opacity: 0.6; margin-top: 4px;">
                            Rating ranges narrow as the season progresses. These players enter the College Grad FA next offseason.
                        </div>
                    </div>
                    <div>
                        <select id="pipelinePos" onchange="filterPipeline()" style="padding: 6px;">
                            <option value="ALL">All Pos</option>
                            <option value="PG">PG</option><option value="SG">SG</option>
                            <option value="SF">SF</option><option value="PF">PF</option><option value="C">C</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="pipelineResults"></div>
        `;
    }

    /**
     * Coach management page
     */
    static coachManagementPage({ coachSection, hasCoach }) {
        let html = '<h2 style="text-align: center; margin-bottom: 20px;">🎓 Coaching Staff</h2>';
        html += '<button onclick="closeCoachModal()" style="position: absolute; top: 15px; right: 20px; background: rgba(255,255,255,0.1); padding: 8px 16px; font-size: 0.9em;">✕ Close</button>';

        html += coachSection;

        html += '<div style="text-align: center; margin: 20px 0; display: flex; gap: 15px; justify-content: center;">';
        html += '<button onclick="showCoachMarket()" class="success" style="font-size: 1.1em; padding: 12px 30px;">🔍 Browse Coaching Market</button>';
        if (hasCoach) {
            html += '<button onclick="fireCoach()" class="danger" style="font-size: 1em; padding: 12px 24px;">🚪 Fire Coach</button>';
        }
        html += '</div>';
        html += '<div id="coachMarketContainer"></div>';

        return html;
    }

    /**
     * No coach warning
     */
    static noCoachWarning() {
        return '<div style="text-align: center; padding: 30px; background: rgba(234,67,53,0.1); border-radius: 12px; margin-bottom: 20px; border: 2px dashed rgba(234,67,53,0.3);"><h3 style="color: #ea4335;">⚠️ No Head Coach</h3><p style="opacity: 0.8; margin-top: 8px;">Your team needs a head coach! Browse the coaching market below.</p></div>';
    }

    /**
     * Coach market container with tabs
     */
    static coachMarketContainer({ freeAgentCount, poachableCount, freeAgentListHTML, poachListHTML }) {
        let html = '<h3 style="margin-bottom: 15px; text-align: center;">📋 Coaching Market</h3>';

        html += '<div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 15px;">';
        html += `<button id="freeAgentCoachTab" onclick="showCoachTab('freeAgent')" style="padding: 8px 20px; background: linear-gradient(135deg, #34a853 0%, #2e7d32 100%);">Free Agents (${freeAgentCount})</button>`;
        html += `<button id="poachCoachTab" onclick="showCoachTab('poach')" style="padding: 8px 20px;">Poach from Teams (${poachableCount})</button>`;
        html += '</div>';

        html += '<div id="freeAgentCoachList">';
        html += freeAgentListHTML;
        html += '</div>';

        html += '<div id="poachCoachList" style="display: none;">';
        html += poachListHTML;
        html += '</div>';

        return html;
    }

    static standingsRows({ sortedTeams, tier, userTeamId }) {
        return sortedTeams.map((team, index) => {
            const winPct = team.wins + team.losses > 0
                ? (team.wins / (team.wins + team.losses)).toFixed(3) : '.000';

            let rowClass = '';
            const rank = index + 1;
            const totalTeams = sortedTeams.length;

            if (team.id === userTeamId) {
                rowClass = 'user-team';
            } else if (tier === 2 || tier === 3) {
                if (rank === 1) rowClass = 'promotion-zone';
                else if (rank >= 2 && rank <= 4) rowClass = 'playoff-zone';
            } else if (tier === 1) {
                if (rank >= totalTeams - 2 && rank <= totalTeams - 1) rowClass = 'playoff-zone';
                else if (rank === totalTeams) rowClass = 'auto-relegate';
            }

            return `<tr class="${rowClass}">
                <td>${rank}</td>
                <td><strong>${team.name}</strong></td>
                <td>${team.division}</td>
                <td>${team.wins}</td>
                <td>${team.losses}</td>
                <td>${winPct}</td>
                <td>${team.pointDiff > 0 ? '+' : ''}${team.pointDiff}</td>
            </tr>`;
        }).join('');
    }

    static divisionStandingsRows({ sortedDivisions, divisions, userTeamId }) {
        let html = '';
        sortedDivisions.forEach(divisionName => {
            const divisionTeams = divisions[divisionName];
            html += `<tr style="background: rgba(102, 126, 234, 0.2); border-top: 2px solid rgba(102, 126, 234, 0.5);"><td colspan="7" style="font-weight: bold; padding: 12px 15px; font-size: 1.05em;">${divisionName}</td></tr>`;
            divisionTeams.forEach((team, index) => {
                const winPct = team.wins + team.losses > 0 ? (team.wins / (team.wins + team.losses)).toFixed(3) : '.000';
                const rowClass = team.id === userTeamId ? 'user-team' : '';
                html += `<tr class="${rowClass}"><td>${index + 1}</td><td><strong>${team.name}</strong></td><td>-</td><td>${team.wins}</td><td>${team.losses}</td><td>${winPct}</td><td>${team.pointDiff > 0 ? '+' : ''}${team.pointDiff}</td></tr>`;
            });
        });
        return html;
    }

    static teamSelectionCard({ team, tier, marketLabel, spendingLimit, fanbase, formatCurrency }) {
        return `<div class="team-card" onclick="selectTeam(${team.id}, ${tier})" style="padding: 12px;">
            <h3 style="margin-bottom: 4px;">${team.name}</h3>
            <p style="margin: 2px 0;">Rating: ${Math.round(team.rating)}</p>
            <div style="font-size: 0.8em; opacity: 0.75; margin-top: 4px; line-height: 1.4;">
                ${marketLabel} ${tier === 1 ? `Cap: ${formatCurrency(spendingLimit)}` : `Budget: ${formatCurrency(spendingLimit)}`}
                · ${(fanbase/1000).toFixed(0)}K fans
            </div>
        </div>`;
    }

    static collegeGradModalInfo({ graduateCount, season, capSpace, rosterSize, formatCurrency }) {
        return {
            subtitle: `<strong>${graduateCount}</strong> college seniors entering the professional ranks · Class of ${season + 1}`,
            capInfo: `<span style="font-weight: bold; color: #34a853;">Your Cap Space: ${formatCurrency(capSpace)}</span> · <span style="opacity: 0.7;">Roster: ${rosterSize}/15</span>`
        };
    }

    static calendarDayDetail({ formattedDate, event, allGames, userGame, otherGames, userGameHTML, otherGamesHTML }) {
        let html = `<div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 15px; border: 1px solid rgba(255,255,255,0.1);">
            <h3 style="margin: 0 0 12px 0; color: #ffd700;">${formattedDate}</h3>`;

        if (event) {
            html += `<div style="margin-bottom: 10px; padding: 8px 12px; background: rgba(255,215,0,0.15); border-radius: 6px; color: #ffd700;">${event}</div>`;
        }

        if (allGames.length === 0) {
            html += '<p style="opacity: 0.6;">No games scheduled</p>';
        } else {
            if (userGame) {
                html += `<div style="margin-bottom: 10px;"><strong style="font-size: 0.9em;">🏀 Your Game</strong>${userGameHTML}</div>`;
            }
            if (otherGames.length > 0) {
                html += `<details style="margin-top: 5px;">
                    <summary style="cursor: pointer; opacity: 0.7; font-size: 0.9em;">${otherGames.length} other game${otherGames.length !== 1 ? 's' : ''} today</summary>
                    <div style="max-height: 300px; overflow-y: auto; margin-top: 5px;">${otherGamesHTML}</div></details>`;
            }
        }

        html += '</div>';
        return html;
    }

}