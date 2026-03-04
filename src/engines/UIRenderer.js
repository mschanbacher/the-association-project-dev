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

    static collegeGradModalInfo({ graduateCount, season, capSpace, rosterSize, formatCurrency }) {
        return {
            subtitle: `<strong>${graduateCount}</strong> college seniors entering the professional ranks · Class of ${season + 1}`,
            capInfo: `<span style="font-weight: bold; color: #34a853;">Your Cap Space: ${formatCurrency(capSpace)}</span> · <span style="opacity: 0.7;">Roster: ${rosterSize}/15</span>`
        };
    }

}