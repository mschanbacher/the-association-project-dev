// ═══════════════════════════════════════════════════════════════════
// DashboardController — Dashboard Refresh
// ═══════════════════════════════════════════════════════════════════
// Session G migration: 36 → 0 getElementById calls. All UI via React
// (DashboardScreen.jsx + Widgets.jsx via useGame() hook).
//
// The controller's sole remaining job is to push gameState to React
// via _notifyReact after sim actions. All rendering is handled by
// React components reading from window._reactGameState.
// ═══════════════════════════════════════════════════════════════════

export class DashboardController {
    constructor(ctx) {
        this.ctx = ctx;
    }

    /**
     * Notify React that gameState has changed.
     * Called after every sim action, trade, roster change, etc.
     */
    refresh() {
        if (window._notifyReact) {
            window._reactGameState = this.ctx.gameState;
            window._notifyReact();
        }
    }
}
