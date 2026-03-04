// ═══════════════════════════════════════════════════════════════════
// UIRenderer — Watch Game Feed Rendering
// ═══════════════════════════════════════════════════════════════════
//
// These methods remain as innerHTML for performance — the play-by-play
// feed generates hundreds of entries per second at max sim speed.
//
// Icons: minimal geometric symbols, no emoji. Color-coded to team.
// Colors: CSS custom properties from design-system.css.
//

export class UIRenderer {

    static formatCurrency(amount) {
        if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(2) + 'M';
        if (amount >= 1000) return '$' + (amount / 1000).toFixed(0) + 'K';
        return '$' + amount;
    }

    static watchGamePlayEntry(event) {
        const sideColor = event.side === 'home' ? 'var(--color-home)' : 'var(--color-away)';
        const sideLabel = event.side === 'home' ? 'HME' : 'AWY';

        // Minimal geometric icons — a small colored symbol per play type
        let icon = '';
        let text = '';
        let highlight = false;

        switch (event.type) {
            case 'made_shot':
                icon = event.shotType === '3pt'
                    ? `<span style="color:${sideColor};font-weight:700;font-size:0.9em;">3</span>`
                    : `<span style="color:${sideColor};font-size:0.75em;">●</span>`;
                text = `<strong>${event.player}</strong> ${event.shotType === '3pt' ? 'three-pointer' : 'scores'}`;
                highlight = event.shotType === '3pt';
                break;
            case 'missed_shot':
                icon = `<span style="color:var(--color-text-tertiary);font-size:0.75em;">○</span>`;
                text = `<strong>${event.player}</strong> misses ${event.shotType === '3pt' ? 'three' : 'shot'}`;
                break;
            case 'turnover':
                icon = `<span style="color:var(--color-text-tertiary);font-size:0.85em;">—</span>`;
                text = `<strong>${event.player}</strong> turnover`;
                break;
            case 'steal':
                icon = `<span style="color:${sideColor};font-size:0.85em;">↗</span>`;
                text = `<strong>${event.player}</strong> steal`;
                break;
            case 'foul_shooting':
                icon = `<span style="color:${sideColor};font-size:0.85em;">|</span>`;
                text = `<strong>${event.shooter}</strong> ${event.ftMade}/${event.ftAttempted} FT`;
                break;
            case 'foul':
                icon = `<span style="color:var(--color-warning);font-size:0.85em;">×</span>`;
                text = `Foul on <strong>${event.fouler}</strong>`;
                break;
            case 'and_one':
                icon = `<span style="color:${sideColor};font-weight:700;font-size:0.9em;">+1</span>`;
                text = `<strong>${event.player}</strong> AND ONE`;
                highlight = true;
                break;
            case 'run':
                icon = `<span style="color:${sideColor};font-weight:700;font-size:0.85em;">▲</span>`;
                text = `<strong>${event.run}-0 run</strong>`;
                highlight = true;
                break;
            case 'quarter_end':
                return `<div style="text-align:center;padding:6px;margin:3px 0;border-top:1px solid var(--color-border-subtle);border-bottom:1px solid var(--color-border-subtle);font-size:0.82em;color:var(--color-text-tertiary);">End of Q${event.quarter} — ${event.awayScore}-${event.homeScore}</div>`;
            case 'overtime':
                return `<div style="text-align:center;padding:6px;margin:3px 0;background:var(--color-warning-bg);color:var(--color-warning);font-weight:600;font-size:0.85em;">OVERTIME</div>`;
            case 'timeout':
                return `<div style="text-align:center;padding:4px;margin:2px 0;color:var(--color-text-tertiary);font-size:0.8em;">Timeout — ${event.side === 'home' ? 'Home' : 'Away'}</div>`;
            case 'game_end':
                return '';
            default:
                return '';
        }

        const bg = highlight ? 'background:var(--color-highlight-bg);' : '';
        return `<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;margin:1px 0;font-size:0.84em;${bg}"><span style="flex-shrink:0;width:18px;text-align:center;">${icon}</span><span style="color:${sideColor};font-size:0.7em;opacity:0.6;flex-shrink:0;width:26px;">${sideLabel}</span><span style="flex:1;">${text}</span><span style="color:var(--color-text-tertiary);font-size:0.78em;flex-shrink:0;font-family:var(--font-mono);">${event.clock || ''}</span></div>`;
    }

    static watchGameLeaders(homeStats, awayStats, homeName, awayName) {
        const topN = (stats, n) => [...stats]
            .filter(s => s.points > 0)
            .sort((a, b) => b.points - a.points)
            .slice(0, n);

        let html = '';
        [{stats: awayStats, name: awayName, color: 'var(--color-away)'}, {stats: homeStats, name: homeName, color: 'var(--color-home)'}].forEach(({stats, name, color}) => {
            html += `<div style="margin-bottom:14px;"><div style="font-size:0.75em;font-weight:600;color:${color};margin-bottom:5px;text-transform:uppercase;letter-spacing:0.04em;">${name}</div>`;
            topN(stats, 4).forEach(p => {
                html += `<div style="padding:3px 0;font-size:0.82em;display:flex;justify-content:space-between;"><span><strong>${p.playerName}</strong></span><span style="opacity:0.7;font-family:var(--font-mono);font-size:0.9em;">${p.points}p ${p.rebounds}r ${p.assists}a</span></div>`;
            });
            html += '</div>';
        });
        return html;
    }

}
