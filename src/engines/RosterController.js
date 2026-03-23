// ═══════════════════════════════════════════════════════════════════════════════
// RosterController.js — Roster management, scouting, and injury handling
// ═══════════════════════════════════════════════════════════════════════════════

import { UIRenderer } from './UIRenderer.js';

export class RosterController {
    constructor(ctx) {
        this.ctx = ctx;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Roster Display
    // ═══════════════════════════════════════════════════════════════════

    updateRosterDisplay() {
        const { gameState, helpers, engines } = this.ctx;
        const userTeam = helpers.getUserTeam();
        helpers.ensureRosterExists(userTeam);

        const positionBreakdownDiv = document.getElementById('positionBreakdown');
        if (positionBreakdownDiv) {
            positionBreakdownDiv.innerHTML = helpers.generatePositionBreakdownHTML(userTeam.roster, 'Current Roster');
        }

        const roster = userTeam.roster || [];
        const totalSalary = Math.round(helpers.calculateTeamSalary(userTeam));
        engines.FinanceEngine.ensureFinances(userTeam);
        const salaryCap = helpers.getEffectiveCap(userTeam);
        const baseCap = helpers.getSalaryCap(userTeam.tier);
        const salaryFloor = engines.FinanceEngine.getSalaryFloor(userTeam);
        const remainingCap = Math.round(helpers.getRemainingCap(userTeam));
        const isOverCap = totalSalary > salaryCap;
        const isUnderFloor = totalSalary < salaryFloor;
        const isRevenueBasedCap = userTeam.tier !== 1;
        const hasCapBoost = isRevenueBasedCap ? (salaryCap > baseCap) : false;

        let boostLabel = '';
        if (isRevenueBasedCap && salaryCap > baseCap * 1.2) {
 boostLabel = 'Revenue exceeds tier baseline';
        } else if (userTeam.finances && userTeam.finances.previousTier && userTeam.finances.previousTier < userTeam.tier) {
 boostLabel = `Retained revenue from Tier ${userTeam.finances.previousTier}`;
        }

        document.getElementById('rosterCount').textContent = roster.length;

        const teamChemistry = helpers.calculateTeamChemistry(userTeam);
        const chemistryColor = helpers.getChemistryColor(teamChemistry);
        const chemistryDesc = helpers.getChemistryDescription(teamChemistry);

        const capDisplay = document.getElementById('capStatus');
        if (capDisplay) {
            // [LEGACY REMOVED] capDisplay.innerHTML = UIRenderer.rosterCapStatus({
                // totalSalary, salaryCap, salaryFloor, remainingCap, isOverCap, isUnderFloor,
                // isRevenueBasedCap, hasCapBoost, boostLabel, boostAmount: salaryCap - baseCap,
                // teamChemistry, chemistryColor, chemistryDesc, formatCurrency: helpers.formatCurrency
            // });
        }

        const rosterHtml = roster
            .sort((a, b) => b.rating - a.rating)
            .map(player => {
                const canDrop = roster.length > 12 || isOverCap;
                const contractYears = player.contractYears || 1;
                const contractColor = contractYears === 1 ? '#fbbc04' : '#34a853';

                let injuryDisplay = '';
                if (player.injuryStatus === 'out') {
                    const gamesOut = player.injury?.gamesRemaining || '?';
 injuryDisplay = `<span style="color: #ea4335; margin-left: 10px; font-weight: bold;">OUT (${gamesOut} games)</span>`;
                } else if (player.injuryStatus === 'day-to-day') {
                    injuryDisplay = `<span style="color: #fbbc04; margin-left: 10px; font-weight: bold;">🩹 Day-to-Day</span>`;
                }

                const fatigue = player.fatigue || 0;
                const fatigueColor = helpers.getFatigueColor(fatigue);
                const fatigueDesc = helpers.getFatigueDescription(fatigue);
 const fatigueDisplay = `<span style="color: ${fatigueColor}; margin-left: 10px; font-weight: bold;">${Math.round(fatigue)}% (${fatigueDesc})</span>`;

                const releaseClauseDisplay = player.relegationRelease ?
 `<span style="color: #e67e22; margin-left: 10px; font-size: 0.85em;" title="This player has a relegation release clause">Release Clause</span>` : '';

                const m = player.measurables;
                const measurablesDisplay = m ?
                    `<span style="opacity: 0.7; margin-left: 10px;">${engines.PlayerAttributes.formatHeight(m.height)} · ${m.weight}lbs · ${engines.PlayerAttributes.formatWingspan(m.wingspan)} WS</span>` : '';

                const collab = player.attributes ? player.attributes.collaboration : 50;
 const collabIcon = collab >= 75 ? '' : collab >= 50 ? '' : collab >= 35 ? '️' : '';
                const collabDisplay = collabIcon ? `<span style="margin-left: 6px;" title="Collaboration: ${collab}">${collabIcon}</span>` : '';

                let attrPreview = '';
                if (player.attributes) {
                    const sortedAttrs = Object.entries(player.attributes).sort(([,a],[,b]) => b - a).slice(0, 3);
                    const allAttrDefs = { ...engines.PlayerAttributes.PHYSICAL_ATTRS, ...engines.PlayerAttributes.MENTAL_ATTRS };
                    attrPreview = sortedAttrs.map(([key, val]) => {
                        const def = allAttrDefs[key];
                        return def ? `<span style="color: ${engines.PlayerAttributes.getAttrColor(val)};" title="${def.name}: ${val}">${def.icon}${val}</span>` : '';
                    }).join(' ');
                }

                // [LEGACY REMOVED] return UIRenderer.rosterPlayerCard({
                    // player, canDrop, contractYears, contractColor, injuryDisplay,
                    // fatigueDisplay, releaseClauseDisplay, measurablesDisplay,
                    // collabDisplay, attrPreview, ratingColor: helpers.getRatingColor(player.rating), formatCurrency: helpers.formatCurrency
                // });
            }).join('');

        document.getElementById('currentRoster').innerHTML = rosterHtml || '<p style="text-align: center; opacity: 0.7;">No players on roster</p>';
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

        this.updateRosterDisplay();
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

        this.updateRosterDisplay();
        helpers.saveGameState();
        if (window._notifyReact) window._notifyReact();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Scouting System
    // ═══════════════════════════════════════════════════════════════════

    openScoutingModal() {
        this._updateWatchListCount();
        this.switchScoutTab('scanner');
        document.getElementById('scoutingModal').classList.remove('hidden');
    }

    closeScoutingModal() {
        document.getElementById('scoutingModal').classList.add('hidden');
    }

    switchScoutTab(tab) {
        ['scanner', 'pipeline', 'watchlist', 'needs'].forEach(t => {
            const btn = document.getElementById(`scoutTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
            if (btn) {
                btn.style.background = t === tab ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.05)';
                btn.style.opacity = t === tab ? '1' : '0.7';
                btn.style.borderBottom = t === tab ? '2px solid #667eea' : '2px solid transparent';
            }
        });

        if (tab === 'scanner') this._renderScannerTab();
        else if (tab === 'pipeline') this.renderPipelineTab();
        else if (tab === 'watchlist') this.renderWatchListTab();
        else if (tab === 'needs') this.renderNeedsTab();
    }

    _renderScannerTab() {
        const f = window._scoutFilters;
        // [LEGACY REMOVED] document.getElementById('scoutTabContent').innerHTML = UIRenderer.scannerFilters({ f });
        this.applyScoutFilter();
    }

    applyScoutFilter() {
        const { helpers, engines } = this.ctx;
        const f = window._scoutFilters;
        f.pos = document.getElementById('scoutPos')?.value || 'ALL';
        f.tier = document.getElementById('scoutTier')?.value || 'ALL';
        f.minAge = document.getElementById('scoutMinAge')?.value || '';
        f.maxAge = document.getElementById('scoutMaxAge')?.value || '';
        f.minRating = document.getElementById('scoutMinRating')?.value || '';
        f.maxRating = document.getElementById('scoutMaxRating')?.value || '';
        f.contractStatus = document.getElementById('scoutContract')?.value || 'ALL';
        f.sort = document.getElementById('scoutSort')?.value || 'fit';

        const allPlayers = helpers.getAllLeaguePlayers();
        const userTeam = helpers.getUserTeam();
        const coach = userTeam.coach;

        let filtered = allPlayers.filter(p => {
            if (f.pos !== 'ALL' && p.position !== f.pos) return false;
            if (f.tier !== 'ALL' && String(p._teamTier) !== f.tier) return false;
            if (f.minAge && p.age < parseInt(f.minAge)) return false;
            if (f.maxAge && p.age > parseInt(f.maxAge)) return false;
            if (f.minRating && p.rating < parseInt(f.minRating)) return false;
            if (f.maxRating && p.rating > parseInt(f.maxRating)) return false;
            if (f.contractStatus === 'expiring' && p.contractYears > 1) return false;
            if (f.contractStatus === 'short' && p.contractYears > 2) return false;
            if (p._teamId === userTeam.id) return false;
            return true;
        });

        filtered.forEach(p => { p._fit = helpers.calculateTeamFit(p, userTeam, coach); });

        if (f.sort === 'fit') filtered.sort((a, b) => b._fit.combined - a._fit.combined);
        else if (f.sort === 'rating') filtered.sort((a, b) => b.rating - a.rating);
        else if (f.sort === 'age') filtered.sort((a, b) => a.age - b.age || b.rating - a.rating);
        else if (f.sort === 'salary') filtered.sort((a, b) => a.salary - b.salary);

        const display = filtered.slice(0, 100);
        // [LEGACY REMOVED] let html = UIRenderer.scoutResultsTableHeader({ count: filtered.length, truncated: filtered.length > 100 })
        display.forEach(p => {
            const watched = this._isOnWatchList(p.id);
            // [LEGACY REMOVED] html += UIRenderer.scoutResultRow(...)
        });
        // [LEGACY DOM] scoutResults rendered by ScoutingScreen React component
    }

    showPlayerScoutDetail(playerId) {
        const { helpers, engines } = this.ctx;
        const allPlayers = helpers.getAllLeaguePlayers();
        const player = allPlayers.find(p => p.id === playerId);
        if (!player) return;

        const userTeam = helpers.getUserTeam();
        const fit = helpers.calculateTeamFit(player, userTeam, userTeam.coach);
        const watched = this._isOnWatchList(playerId);

        // [LEGACY REMOVED] document.getElementById('scoutTabContent').innerHTML = UIRenderer.scoutPlayerDetail({
            // player, fit, watched,
            // attrKeys: engines.PlayerAttributes.ALL_ATTR_KEYS || [],
            // attrs: player.attributes || {},
            // getRatingColor: helpers.getRatingColor, formatCurrency: helpers.formatCurrency,
            // gradeColor: helpers.gradeColor, PlayerAttributes: engines.PlayerAttributes
        // });
    }

    renderPipelineTab() {
        const { gameState, helpers, engines } = this.ctx;
        const content = document.getElementById('scoutTabContent');
        const userTeam = helpers.getUserTeam();

        if (!gameState._pipelinePreview || gameState._pipelinePreviewSeason !== gameState.currentSeason) {
            const previewClass = [];
            const classSize = 90 + Math.floor(Math.random() * 31);
            const POSITIONS = engines.TeamFactory.POSITIONS;
            const COLLEGE_NAMES = engines.TeamFactory.COLLEGE_NAMES;
            const FIRST_NAMES = engines.TeamFactory.FIRST_NAMES;
            const LAST_NAMES = engines.TeamFactory.LAST_NAMES;

            for (let i = 0; i < classSize; i++) {
                const targetTier = Math.random() < 0.30 ? 2 : 3;
                const position = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
                const college = COLLEGE_NAMES[Math.floor(Math.random() * COLLEGE_NAMES.length)];
                const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
                const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

                const trueRating = targetTier === 2 ? Math.floor(58 + Math.random() * 20) : Math.floor(48 + Math.random() * 20);
                const scoutUncertainty = 8;
                const low = Math.max(45, trueRating - scoutUncertainty);
                const high = Math.min(85, trueRating + scoutUncertainty);
                const midEstimate = Math.round((low + high) / 2);
                const potentialBoost = Math.floor(3 + Math.random() * 12);

                previewClass.push({
                    name: `${firstName} ${lastName}`, position, college, age: 20,
                    tier: targetTier, ratingLow: low, ratingHigh: high, midEstimate,
                    trueRating, projectedCeiling: Math.min(92, trueRating + potentialBoost)
                });
            }
            previewClass.sort((a, b) => b.midEstimate - a.midEstimate);
            gameState._pipelinePreview = previewClass;
            gameState._pipelinePreviewSeason = gameState.currentSeason;
        }

        // [LEGACY REMOVED] content.innerHTML = UIRenderer.pipelineTabContainer({
            // currentSeason: gameState.currentSeason, previewCount: gameState._pipelinePreview.length
        // });
        this.filterPipeline();
    }

    filterPipeline() {
        const { gameState } = this.ctx;
        const pos = document.getElementById('pipelinePos')?.value || 'ALL';
        const preview = gameState._pipelinePreview || [];
        const filtered = pos === 'ALL' ? preview : preview.filter(p => p.position === pos);
        // [LEGACY REMOVED] document.getElementById('pipelineResults').innerHTML = UIRenderer.pipelineTable({ filtered });
    }

    renderWatchListTab() {
        const { helpers } = this.ctx;
        const content = document.getElementById('scoutTabContent');
        const watchList = this._getWatchList();
        const allPlayers = helpers.getAllLeaguePlayers();
        const userTeam = helpers.getUserTeam();
        const coach = userTeam.coach;

        // [LEGACY REMOVED] if (watchList.length === 0) { content.innerHTML = UIRenderer.watchListEmpty(); return; }

        // [LEGACY REMOVED] let html = UIRenderer.watchListTableHeader();
        watchList.forEach(w => {
            const p = allPlayers.find(pl => pl.id === w.id);
            // [LEGACY REMOVED] if (!p) { html += UIRenderer.watchListGoneRow({ w }); return; }
            const fit = helpers.calculateTeamFit(p, userTeam, coach);
            const contractLabel = p.contractYears <= 1 ? `<span style="color: #fbbc04;">${p.contractYears}yr ️</span>` : `${p.contractYears}yr`;
            // [LEGACY REMOVED] html += UIRenderer.watchListRow(...)
        });
        // [LEGACY DOM] watchList rendered by ScoutingScreen React component
    }

    renderNeedsTab() {
        const { helpers, engines } = this.ctx;
        const content = document.getElementById('scoutTabContent');
        const userTeam = helpers.getUserTeam();
        if (!userTeam.roster) { content.innerHTML = '<p>No roster data</p>'; return; }

        const positionCounts = { PG: [], SG: [], SF: [], PF: [], C: [] };
        userTeam.roster.forEach(p => { if (positionCounts[p.position]) positionCounts[p.position].push(p); });

        const expiring = userTeam.roster.filter(p => p.contractYears <= 1);
        const expiringNext = userTeam.roster.filter(p => p.contractYears === 2);
        const avgAge = (userTeam.roster.reduce((s, p) => s + p.age, 0) / userTeam.roster.length).toFixed(1);
        const young = userTeam.roster.filter(p => p.age <= 24).length;
        const prime = userTeam.roster.filter(p => p.age >= 25 && p.age <= 30).length;
        const veteran = userTeam.roster.filter(p => p.age >= 31).length;

        const attrKeys = engines.PlayerAttributes.ALL_ATTR_KEYS || [];
        const attrAvgs = {};
        attrKeys.forEach(key => {
            const vals = userTeam.roster.map(p => (p.attributes && p.attributes[key]) || 50);
            attrAvgs[key] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
        });
        const weakestAttrs = [...attrKeys].sort((a, b) => attrAvgs[a] - attrAvgs[b]).slice(0, 3);
        const strongestAttrs = [...attrKeys].sort((a, b) => attrAvgs[b] - attrAvgs[a]).slice(0, 3);

        // [LEGACY REMOVED] content.innerHTML = UIRenderer.needsTab({
            // positionCounts, expiring, expiringNext, avgAge, young, prime, veteran,
            // rosterLength: userTeam.roster.length, weakestAttrs, strongestAttrs, attrAvgs,
            // formatCurrency: helpers.formatCurrency, PlayerAttributes: engines.PlayerAttributes
        // });
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
        this._updateWatchListCount();
    }

    removeFromWatchList(playerId) {
        const { helpers } = this.ctx;
        const wl = this._getWatchList();
        const idx = wl.findIndex(w => String(w.id) === String(playerId));
        if (idx !== -1) wl.splice(idx, 1);
        helpers.saveGameState();
        this._updateWatchListCount();
    }

    _updateWatchListCount() {
        const el = document.getElementById('watchlistCount');
        if (el) el.textContent = this._getWatchList().length;
    }

}
