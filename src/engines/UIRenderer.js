// ═══════════════════════════════════════════════════════════════════
// UIRenderer — Watch Game Feed Rendering
// ═══════════════════════════════════════════════════════════════════
//
// All other rendering has been migrated to native React components.
// These two methods remain as innerHTML for performance reasons —
// the play-by-play feed generates hundreds of entries per second
// at max simulation speed.
//
// All colors use CSS custom properties from design-system.css
// with fallback values for safety.
//

export class UIRenderer {

    static formatCurrency(amount) {
        if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(2) + 'M';
        if (amount >= 1000) return '$' + (amount / 1000).toFixed(0) + 'K';
        return '$' + amount;
    }

    static watchGamePlayEntry(event) {
        const sideColor = event.side === 'home' ? 'var(--color-home, #4ecdc4)' : 'var(--color-away, #ff6b6b)';
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
                return `<div style="text-align: center; padding: 8px; margin: 4px 0; border-top: 1px solid var(--color-border-subtle); border-bottom: 1px solid var(--color-border-subtle); font-size: 0.85em; opacity: 0.6;">End of Q${event.quarter} — ${event.awayScore}-${event.homeScore}</div>`;
            case 'overtime':
                return `<div style="text-align: center; padding: 8px; margin: 4px 0; background: var(--color-warning-bg, rgba(255,215,0,0.1)); border-radius: 6px; color: var(--color-warning); font-weight: bold;">⚡ OVERTIME</div>`;
            case 'timeout':
                return `<div style="text-align: center; padding: 6px; margin: 3px 0; opacity: 0.5; font-size: 0.82em;">⏱️ Timeout — ${event.side === 'home' ? 'Home' : 'Away'}</div>`;
            case 'game_end':
                return '';
            default:
                return '';
        }

        const bg = highlight ? 'background: var(--color-highlight-bg, rgba(255,215,0,0.08));' : '';
        return `
            <div style="display: flex; align-items: center; gap: 8px; padding: 5px 8px; margin: 1px 0; border-radius: var(--radius-sm, 4px); font-size: 0.85em; ${bg}">
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
        [{stats: awayStats, name: awayName, color: 'var(--color-away, #ff6b6b)'}, {stats: homeStats, name: homeName, color: 'var(--color-home, #4ecdc4)'}].forEach(({stats, name, color}) => {
            html += `<div style="margin-bottom: 15px;">
                <div style="font-size: 0.8em; font-weight: bold; color: ${color}; margin-bottom: 6px;">${name}</div>`;
            topN(stats, 4).forEach(p => {
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

}
