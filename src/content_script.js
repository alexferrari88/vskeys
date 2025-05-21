// content_script.js - Main logic, event listeners, settings, keydown router

// For Jest testing environment, ensure common.js constants are loaded.
// In a real browser extension, common.js is loaded via manifest.json before this script.
if (typeof DEFAULT_SHORTCUT_SETTINGS_CONFIG === 'undefined' || typeof DEFAULT_GLOBAL_SETTINGS === 'undefined') {
    if (typeof require !== 'undefined') { // Check if require is available (Node.js/Jest environment)
        const common = require('./src/common.js'); // Adjust path if necessary
        global.DEFAULT_SHORTCUT_SETTINGS_CONFIG = common.DEFAULT_SHORTCUT_SETTINGS_CONFIG;
        global.DEFAULT_GLOBAL_SETTINGS = common.DEFAULT_GLOBAL_SETTINGS;
    }
}

let currentShortcutSettings = {}; // This will store the *effective* settings for the current page
let currentGlobalSettings = { ...(typeof DEFAULT_GLOBAL_SETTINGS !== 'undefined' ? DEFAULT_GLOBAL_SETTINGS : {}) };
let currentSiteOverrides = {}; // Stores all site overrides { hostname: { actionName: { enabled?, key? } } }
let isSiteDisabled = false;
let chordState = null; // e.g., 'K_PENDING'
let lastChordKeyTime = 0;
const CHORD_TIMEOUT = 1500; // ms
const IS_MAC = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
let _extensionHandledPaste = false; // Global flag for paste handling

// Map action names to their handler functions (ensure this is complete)
const shortcutActionHandlers = {
    'cutLine': handleCutLine,
    'copyLine': handleCopyLine,
    'paste': handlePaste, // This is the one we updated
    'deleteLine': handleDeleteLine,
    'insertLineBelow': handleInsertLineBelow,
    'insertLineAbove': handleInsertLineAbove,
    'moveLineDown': (el, gs) => handleMoveLine(el, 'down', gs),
    'moveLineUp': (el, gs) => handleMoveLine(el, 'up', gs),
    'copyLineDown': (el, gs) => handleCopyLineUpDown(el, 'down', gs),
    'copyLineUp': (el, gs) => handleCopyLineUpDown(el, 'up', gs),
    'selectLine': handleSelectLine,
    'indentLine': (el, gs) => handleIndentSelection(el, 'indent', gs),
    'outdentLine': (el, gs) => handleIndentSelection(el, 'outdent', gs),
    'smartHome': handleSmartHome,
    'toggleLineComment': (el, gs) => handleToggleLineCommentAction(el, 'toggle', gs),
    'toggleBlockComment': handleToggleBlockCommentAction,
    'selectWordOrNextOccurrence': handleSelectWordOrNextOccurrenceAction,
    'addLineCommentChord': (el, gs) => handleToggleLineCommentAction(el, 'comment', gs),
    'removeLineCommentChord': (el, gs) => handleToggleLineCommentAction(el, 'uncomment', gs),
    'trimTrailingWhitespaceChord': handleTrimTrailingWhitespaceAction,
    'toUpperCase': handleToUpperCase,
    'toLowerCase': handleToLowerCase,
    'toTitleCase': handleToTitleCase,
};


async function mainKeyDownHandler(event) {

    if (isSiteDisabled) {
        return;
    }

    const activeElement = document.activeElement;
    if (!isEditable(activeElement)) {
        chordState = null;
        return;
    }

    const eventCtrlKey = IS_MAC ? event.metaKey : event.ctrlKey;

    // --- Chord Handling ---
    if (eventCtrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
        // Check if any chord starting with "Ctrl+K" (or its customized equivalent) is enabled
        let potentialChordPrefixEvent = false;
        let activeChordPrefixString = '';

        for (const actionName in currentShortcutSettings) {
            const setting = currentShortcutSettings[actionName];
            if (!setting.enabled) continue;

            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            // A setting is effectively a chord if its default config defines a chordPrefix OR if user made it a chord.
            const isEffectivelyChord = defaultConfig.chordPrefix || setting.isNowChord === true;

            if (isEffectivelyChord) {
                // Parse the *actual* key for the prefix from settings.key
                const parts = setting.key.split(/\s+/);
                if (parts.length < 1) continue; // Should not happen if key is present
                
                // If it's a chord (either by default or user-defined), it must have at least two parts in setting.key to be valid for chord logic.
                // However, for prefix detection, we only care about the first part.
                // If setting.key is "Ctrl+K C", parts[0] is "Ctrl+K".
                // If setting.key is "F5" but isNowChord is somehow true (should not happen), parts[0] is "F5".
                // This logic assumes that if isNowChord is true, setting.key will be space-separated.
                
                const currentActionPrefix = parts[0];
                const parsedPrefixKey = parseKeyString(currentActionPrefix);

                if (eventMatchesKey(event, parsedPrefixKey, IS_MAC)) {
                    // Check if this prefix actually belongs to a *two-part* chord in settings
                    if (parts.length >= 2) {
                        potentialChordPrefixEvent = true;
                        activeChordPrefixString = currentActionPrefix; // Store the matched prefix string
                        break;
                    }
                }
            }
        }

        if (potentialChordPrefixEvent) {
            chordState = { prefix: activeChordPrefixString, time: Date.now() };
            event.preventDefault();
            event.stopPropagation();
            showFeedbackMessage(`${getDisplayKey(activeChordPrefixString)}...`, activeElement, currentGlobalSettings); // Show the actual prefix
            setTimeout(() => {
                if (chordState && chordState.prefix === activeChordPrefixString && (Date.now() - chordState.time >= CHORD_TIMEOUT)) {
                    chordState = null;
                    showFeedbackMessage(`${getDisplayKey(activeChordPrefixString)} timed out`, activeElement, currentGlobalSettings);
                }
            }, CHORD_TIMEOUT);
            return;
        }
    }

    if (chordState && (Date.now() - chordState.time < CHORD_TIMEOUT)) {
        let chordActionFound = false;
        for (const actionName in currentShortcutSettings) {
            const setting = currentShortcutSettings[actionName];
            if (!setting.enabled) continue;

            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            const isEffectivelyChord = defaultConfig.chordPrefix || setting.isNowChord === true;

            if (isEffectivelyChord) {
                const parts = setting.key.split(/\s+/);
                // A valid chord for execution must have two parts.
                if (parts.length < 2) continue;

                const expectedPrefix = parts[0];
                // The second part could potentially have spaces if a user somehow inputs that,
                // so join remaining parts. Though formatCapturedKey in options.js should prevent this.
                const expectedSecondKeyString = parts.slice(1).join(' ');

                if (chordState.prefix === expectedPrefix) {
                    const parsedSecondKey = parseKeyString(expectedSecondKeyString);
                    if (eventMatchesKey(event, parsedSecondKey, IS_MAC)) {
                        if (shortcutActionHandlers[actionName]) {
                            event.preventDefault();
                            event.stopPropagation();
                            await shortcutActionHandlers[actionName](activeElement, currentGlobalSettings);
                            chordActionFound = true;
                            break;
                        }
                    }
                }
            }
        }
        chordState = null;
        if (chordActionFound) {
            return;
        } 
    }


    // --- Regular (Non-Chorded) Shortcuts ---
    
    for (const actionName in currentShortcutSettings) {
        const setting = currentShortcutSettings[actionName];
        if (!setting.enabled) continue;

        const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
        const isEffectivelyChord = defaultConfig.chordPrefix || setting.isNowChord === true;

        if (isEffectivelyChord) continue; // Chorded shortcuts (default or user-defined) are handled above

        // Use the actual key from settings (could be custom)
        const parsedKey = parseKeyString(setting.key);

        if (eventMatchesKey(event, parsedKey, IS_MAC)) {
            const handler = shortcutActionHandlers[actionName];
            if (handler) {
                let handled = true;

                if (actionName === 'paste') {
                    _extensionHandledPaste = true;
                }
                
                if (actionName === 'smartHome') {
                    handled = await handler(activeElement, currentGlobalSettings);
                } else {
                    await handler(activeElement, currentGlobalSettings);
                }

                if (handled !== false) {
                    event.preventDefault(); 
                    event.stopPropagation(); 
                }
                return;
            } 
        }
    }
}

document.addEventListener('paste', (event) => {
    if (_extensionHandledPaste && isEditable(event.target)) {
        event.preventDefault(); 
        event.stopPropagation(); 
    } else {
        
    }
    // It's crucial to reset this flag *after* the browser has had a chance to process (or be blocked by) the paste event.
    // Setting it in a timeout ensures it's reset *after* this event handler and any default action.
    setTimeout(() => {
        _extensionHandledPaste = false;
    }, 0);
}, true); // Capture phase

function determineEffectiveShortcutSettings(baseGlobalSettings, siteOverrides, hostname) {
    const effectiveSettings = {};
    const currentHostname = hostname.toLowerCase();

    // Find applicable site-specific rules (exact match first, then wildcard)
    let siteRule = null;
    if (siteOverrides[currentHostname]) {
        siteRule = siteOverrides[currentHostname];
    } else {
        const parts = currentHostname.split('.');
        while (parts.length > 1) {
            parts.shift();
            const wildcardHostname = `*.${parts.join('.')}`;
            if (siteOverrides[wildcardHostname]) {
                siteRule = siteOverrides[wildcardHostname];
                break;
            }
        }
    }

    Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
        const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
        const globalSettingForAction = baseGlobalSettings[actionName] || {
            enabled: defaultConfig.defaultEnabled,
            key: defaultConfig.defaultKey,
            isCustom: false, // This 'isCustom' is about global customization, not site-specific
            isNowChord: defaultConfig.defaultKey.includes(' ')
        };

        let effectiveKey = globalSettingForAction.key;
        let effectiveEnabled = globalSettingForAction.enabled;
        let isNowChord = globalSettingForAction.isNowChord; // Start with global chord status

        if (siteRule && siteRule[actionName]) {
            const siteActionOverride = siteRule[actionName];
            if (siteActionOverride.hasOwnProperty('key')) {
                effectiveKey = siteActionOverride.key;
                // If site overrides key, re-evaluate chord status based on the new key
                isNowChord = effectiveKey.includes(' ');
            }
            if (siteActionOverride.hasOwnProperty('enabled')) {
                effectiveEnabled = siteActionOverride.enabled;
            }
        }
        
        effectiveSettings[actionName] = {
            enabled: effectiveEnabled,
            key: effectiveKey,
            // 'isCustom' and 'isNowChord' for the content script primarily relate to the *final effective key*.
            // The 'isCustom' from global settings isn't directly used here for behavior, but for display in options.
            isNowChord: isNowChord,
            // We don't strictly need 'isCustom' in content_script if behavior only depends on 'key' and 'enabled'.
            // It's more for the options page UI.
        };
    });
    return effectiveSettings;
}


function loadSettingsAndInitialize() {
    chrome.storage.sync.get(['shortcutSettings', 'disabledSites', 'globalSettings', 'siteOverrides'], (data) => {
        const loadedGlobalShortcutSettingsFromStorage = data.shortcutSettings || {};
        const loadedDisabledSites = data.disabledSites || [...DEFAULT_GLOBAL_SETTINGS.disabledSites];
        currentGlobalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...(data.globalSettings || {}) };
        currentSiteOverrides = data.siteOverrides || {}; // Load all site overrides

        // First, build the complete global settings map (currentSettings used to be this)
        const baseGlobalSettings = {};
        Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            const loadedGlobalSetting = loadedGlobalShortcutSettingsFromStorage[actionName];

            if (typeof loadedGlobalSetting === 'object' && loadedGlobalSetting !== null && loadedGlobalSetting.hasOwnProperty('key')) {
                baseGlobalSettings[actionName] = {
                    enabled: loadedGlobalSetting.hasOwnProperty('enabled') ? loadedGlobalSetting.enabled : defaultConfig.defaultEnabled,
                    key: loadedGlobalSetting.key,
                    isCustom: loadedGlobalSetting.isCustom || (loadedGlobalSetting.key !== defaultConfig.defaultKey),
                    isNowChord: loadedGlobalSetting.hasOwnProperty('isNowChord') ? loadedGlobalSetting.isNowChord : loadedGlobalSetting.key.includes(' ')
                };
            } else if (typeof loadedGlobalSetting === 'boolean') { // Old format migration
                baseGlobalSettings[actionName] = {
                    enabled: loadedGlobalSetting,
                    key: defaultConfig.defaultKey,
                    isCustom: false,
                    isNowChord: defaultConfig.defaultKey.includes(' ')
                };
            } else { // No setting, use defaults
                baseGlobalSettings[actionName] = {
                    enabled: defaultConfig.defaultEnabled,
                    key: defaultConfig.defaultKey,
                    isCustom: false,
                    isNowChord: defaultConfig.defaultKey.includes(' ')
                };
            }
        });
        
        const currentHostname = window.location.hostname;
        // Determine if the entire extension is disabled for this site
        isSiteDisabled = loadedDisabledSites.some(sitePattern => {
            try {
                if (sitePattern.startsWith('*.')) { 
                    const domain = sitePattern.substring(2);
                    return currentHostname.endsWith(`.${domain}`) || currentHostname === domain;
                }
                return currentHostname === sitePattern; 
            } catch (e) {
                console.warn("Error matching site pattern:", sitePattern, e);
                return false;
            }
        });
        
        if (isSiteDisabled) {
            console.log(`VS Keys Extension disabled on ${currentHostname}`);
        }
    });
}

// --- Event Listeners ---
document.addEventListener('keydown', mainKeyDownHandler, true); 

// Add a paste event listener to prevent double paste if extension handled it
document.addEventListener('paste', (event) => {
    if (_extensionHandledPaste && isEditable(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        // console.log("Native paste event prevented by extension flag.");
    }
    _extensionHandledPaste = false; // Always reset flag after paste event occurs or would have occurred
}, true); // Capture phase


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "settingsUpdated") {
        loadSettingsAndInitialize();
        sendResponse({ status: "Settings reloaded in content script" });
        return true; 
    }
});

loadSettingsAndInitialize();
console.log("VS Keys Extension Loaded.");

// Exports for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Function to test
        loadSettingsAndInitialize,
        // Allow tests to get the current state of these variables
        // Note: These are copies at the time of access for primitives,
        // but objects would be references. For testing, we'll re-initialize state.
        getCurrentShortcutSettings: () => currentShortcutSettings,
        getCurrentGlobalSettings: () => currentGlobalSettings,
        getIsSiteDisabled: () => isSiteDisabled,
        // Allow tests to re-set internal state if needed, or set mock dependencies
        _setInternalState: (newState) => {
            if (newState.hasOwnProperty('currentShortcutSettings')) currentShortcutSettings = newState.currentShortcutSettings;
            if (newState.hasOwnProperty('currentGlobalSettings')) currentGlobalSettings = newState.currentGlobalSettings;
            if (newState.hasOwnProperty('isSiteDisabled')) isSiteDisabled = newState.isSiteDisabled;
            // Potentially allow overriding IS_MAC, DEFAULT_SHORTCUT_SETTINGS_CONFIG etc. for pure unit tests later
        },
        // Expose constants/dependencies if they are not easily mockable via globals
        // IS_MAC is derived from navigator.platform, which jest-chrome might mock.
        // DEFAULT_SHORTCUT_SETTINGS_CONFIG and DEFAULT_GLOBAL_SETTINGS are expected globals from common.js
    };
}