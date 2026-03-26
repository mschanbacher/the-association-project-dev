// ═══════════════════════════════════════════════════════════════════
// SettingsManager — Persistent player preferences
// ═══════════════════════════════════════════════════════════════════
// Stores UI/automation preferences separately from game state.
// Settings survive game resets and don't travel with save files.
//
// Usage:
//   SettingsManager.init()          — call once on app load
//   SettingsManager.get('key')      — read a setting
//   SettingsManager.set('key', val) — write + persist
//   window._gameSettings            — global read-only snapshot
// ═══════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'association-settings';
const SETTINGS_VERSION = 1;

const DEFAULTS = {
    // Watch Game
    watchGameSpeed: 1,          // 1 | 3 | 10 | 999

    // Sim Interrupts
    injuryDecisions: 'ask',     // 'ask' | 'always-rest' | 'ai-decides'
    showBreakingNews: true,     // true | false
    autoDeclineTrades: false,   // true | false (Sim Week + Finish Season only)
};

export class SettingsManager {

    static _settings = null;

    /**
     * Initialize: load from localStorage or create defaults.
     * Sets window._gameSettings for global access.
     */
    static init() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                // Merge with defaults so new settings added in future versions
                // get their default values even on existing installs
                SettingsManager._settings = { ...DEFAULTS, ...parsed };
            } else {
                SettingsManager._settings = { ...DEFAULTS };
            }
        } catch (err) {
            console.warn('⚠️ SettingsManager: Failed to load, using defaults', err);
            SettingsManager._settings = { ...DEFAULTS };
        }

        // Expose globally for engine code and React components
        window._gameSettings = { ...SettingsManager._settings };
        console.log('⚙️ SettingsManager: Initialized', window._gameSettings);
    }

    /**
     * Get a single setting value.
     */
    static get(key) {
        if (!SettingsManager._settings) SettingsManager.init();
        return SettingsManager._settings[key] ?? DEFAULTS[key];
    }

    /**
     * Get all settings as a plain object (copy).
     */
    static getAll() {
        if (!SettingsManager._settings) SettingsManager.init();
        return { ...SettingsManager._settings };
    }

    /**
     * Update a setting and persist immediately.
     */
    static set(key, value) {
        if (!SettingsManager._settings) SettingsManager.init();
        if (!(key in DEFAULTS)) {
            console.warn(`⚠️ SettingsManager: Unknown setting "${key}"`);
            return;
        }
        SettingsManager._settings[key] = value;
        SettingsManager._persist();

        // Update global snapshot
        window._gameSettings = { ...SettingsManager._settings };
    }

    /**
     * Reset all settings to defaults.
     */
    static reset() {
        SettingsManager._settings = { ...DEFAULTS };
        SettingsManager._persist();
        window._gameSettings = { ...SettingsManager._settings };
    }

    /**
     * Get the default value for a setting (for UI "reset" indicators).
     */
    static getDefault(key) {
        return DEFAULTS[key];
    }

    /**
     * Write current settings to localStorage.
     */
    static _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                _v: SETTINGS_VERSION,
                ...SettingsManager._settings,
            }));
        } catch (err) {
            console.warn('⚠️ SettingsManager: Failed to persist', err);
        }
    }
}
