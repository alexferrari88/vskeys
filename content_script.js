// content_script.js - Main logic, event listeners, settings, keydown router

let currentShortcutSettings = {};
let currentGlobalSettings = { ...DEFAULT_GLOBAL_SETTINGS }; // From common.js
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
    'undo': handleUndo,
    'redo': handleRedo,
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
            if (defaultConfig.chordPrefix) {
                // Parse the *actual* key for the prefix from settings.key
                // Example: setting.key might be "Ctrl+K Ctrl+C"
                const parts = setting.key.split(/\s+/); // Split "Ctrl+K Ctrl+C" into ["Ctrl+K", "Ctrl+C"]
                if (parts.length < 2) continue; // Malformed chord key in settings
                
                const currentActionPrefix = parts[0];
                const parsedPrefixKey = parseKeyString(currentActionPrefix);

                if (eventMatchesKey(event, parsedPrefixKey, IS_MAC)) {
                    potentialChordPrefixEvent = true;
                    activeChordPrefixString = currentActionPrefix; // Store the matched prefix string
                    break;
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
            if (defaultConfig.chordPrefix) { // This action is a chord
                const parts = setting.key.split(/\s+/);
                if (parts.length < 2) continue;

                const expectedPrefix = parts[0];
                const expectedSecondKeyString = parts[1]; // This is like "C" or "Ctrl+C"

                if (chordState.prefix === expectedPrefix) {
                    // Now check if the current event matches the expectedSecondKeyString
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
        if (defaultConfig.chordPrefix) continue; // Chorded shortcuts are handled above

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

function loadSettingsAndInitialize() {
    chrome.storage.sync.get(['shortcutSettings', 'disabledSites', 'globalSettings'], (data) => {
        const loadedShortcutSettingsFromStorage = data.shortcutSettings || {};
        const loadedDisabledSites = data.disabledSites || [...DEFAULT_GLOBAL_SETTINGS.disabledSites];
        currentGlobalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...(data.globalSettings || {}) };

        // Initialize currentShortcutSettings for content script
        currentShortcutSettings = {};

        Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            const loadedSetting = loadedShortcutSettingsFromStorage[actionName];

            if (typeof loadedSetting === 'object' && loadedSetting !== null && loadedSetting.hasOwnProperty('key')) {
                // New format already exists in storage
                currentShortcutSettings[actionName] = {
                    enabled: loadedSetting.hasOwnProperty('enabled') ? loadedSetting.enabled : defaultConfig.defaultEnabled,
                    key: loadedSetting.key,
                    // isCustom is not strictly needed by content_script, but good to keep structure consistent if ever logged
                    isCustom: loadedSetting.isCustom || (loadedSetting.key !== defaultConfig.defaultKey)
                };
            } else if (typeof loadedSetting === 'boolean') {
                // Old format (just enabled status) - migrate
                currentShortcutSettings[actionName] = {
                    enabled: loadedSetting,
                    key: defaultConfig.defaultKey,
                    isCustom: false
                };
            } else {
                // No setting found, use defaults from DEFAULT_SHORTCUT_SETTINGS_CONFIG
                currentShortcutSettings[actionName] = {
                    enabled: defaultConfig.defaultEnabled,
                    key: defaultConfig.defaultKey,
                    isCustom: false
                };
            }
        });

        const currentHostname = window.location.hostname;
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