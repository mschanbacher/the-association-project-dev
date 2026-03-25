// ═══════════════════════════════════════════════════════════════════════════════
// RosterController.js — Roster management, scouting, and injury handling
// Session D migration: 23 → 0 getElementById calls. All UI via React
// (RosterScreen.jsx, ScoutingScreen.jsx, RosterModal.jsx).
// ═══════════════════════════════════════════════════════════════════════════════

export class RosterController {
    constructor(ctx) {
        this.ctx = ctx;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Drop / Sign Players
    // ═══════════════════════════════════════════════════════════════════

    dropPlayer(playerId) {
        const { gameState, helpers } = this.ctx;
        const userTeam = helpers.getUserTeam();
        const totalSalary = helpers.calculateTeamSalary(userTeam);
        const salaryCap = helpers.getEffectiveCap(userTeam);
        const isOverCap = totalSalary > salaryCap;

        if (userTeam.roster.length <= 12 && !isOverCap) {
            alert('You must have at least 12 players on your roster!');
            return;
        }

        const playerIndex = userTeam.roster.findIndex(p => p.id === playerId);
        if (playerIndex === -1) { alert('Player not found on roster!'); return; }

        const droppedPlayer = userTeam.roster[playerIndex];
        userTeam.roster.splice(playerIndex, 1);
        // Create new array reference so React detects the mutation
        userTeam.roster = [...userTeam.roster];
        helpers.applyDropPenalty(userTeam, droppedPlayer);
        gameState.freeAgents.push(droppedPlayer);

        console.log(`Dropped ${droppedPlayer.name} (${helpers.formatCurrency(droppedPlayer.salary)}) from roster`);

        helpers.saveGameState();
        if (window._notifyReact) window._notifyReact();
    }

    signPlayer(playerId) {
        const { gameState, helpers, engines } = this.ctx;
        const userTeam = helpers.getUserTeam();

        if (userTeam.roster.length >= 15) { alert('Your roster is full! Drop a player first.'); return; }

        const playerIndex = gameState.freeAgents.findIndex(p => p.id === playerId);
        if (playerIndex === -1) { alert('Player not found in free agent pool!'); return; }

        const signedPlayer = gameState.freeAgents[playerIndex];
        const tierAdjustedSalary = helpers.generateSalary(signedPlayer.rating, userTeam.tier);
        const signingCost = Math.min(signedPlayer.salary, tierAdjustedSalary);

        if (!helpers.isUnderCap(userTeam, signingCost)) {
            const over = (helpers.calculateTeamSalary(userTeam) + signingCost) - helpers.getEffectiveCap(userTeam);
            const limitLabel = userTeam.tier === 1 ? 'salary cap' : 'spending limit';
            alert(`Cannot sign ${signedPlayer.name}!\n\nThis would put you ${helpers.formatCurrency(over)} over your ${limitLabel}.`);
            return;
        }

        gameState.freeAgents.splice(playerIndex, 1);
        signedPlayer.salary = signingCost;
        signedPlayer.tier = userTeam.tier;
        delete signedPlayer.preRelegationSalary;
        helpers.initializePlayerChemistry(signedPlayer);
        userTeam.roster.push(signedPlayer);
        userTeam.gamesSinceRosterChange = 0;

        console.log(`Signed ${signedPlayer.name} for ${helpers.formatCurrency(signedPlayer.salary)}`);

        helpers.eventBus.emit(helpers.GameEvents.PLAYER_CONTRACT_SIGNED, {
            playerId: signedPlayer.id, playerName: signedPlayer.name,
            teamId: userTeam.id, teamName: userTeam.name,
            salary: signedPlayer.salary, rating: signedPlayer.rating, source: 'free_agency'
        });

        helpers.saveGameState();
        if (window._notifyReact) window._notifyReact();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Watch List
    // ═══════════════════════════════════════════════════════════════════

    _getWatchList() {
        const { gameState } = this.ctx;
        if (!gameState.scoutingWatchList) gameState.scoutingWatchList = [];
        return gameState.scoutingWatchList;
    }

    _isOnWatchList(playerId) {
        return this._getWatchList().some(w => String(w.id) === String(playerId));
    }

    addToWatchList(playerId) {
        const { gameState, helpers } = this.ctx;
        const allPlayers = helpers.getAllLeaguePlayers();
        const player = allPlayers.find(p => p.id === playerId);
        if (!player || this._isOnWatchList(playerId)) return;

        this._getWatchList().push({
            id: player.id, name: player.name, position: player.position,
            addedSeason: gameState.currentSeason, note: ''
        });
        helpers.saveGameState();
        if (window._notifyReact) window._notifyReact();
    }

    removeFromWatchList(playerId) {
        const { helpers } = this.ctx;
        const wl = this._getWatchList();
        const idx = wl.findIndex(w => String(w.id) === String(playerId));
        if (idx !== -1) wl.splice(idx, 1);
        helpers.saveGameState();
        if (window._notifyReact) window._notifyReact();
    }

}
