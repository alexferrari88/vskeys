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
        const isAnyKChordEnabled = Object.entries(currentShortcutSettings)
            .some(([action, enabled]) =>
                enabled && DEFAULT_SHORTCUT_SETTINGS_CONFIG[action]?.chordPrefix === 'Ctrl+K'
            );
        if (isAnyKChordEnabled) {
            chordState = 'K_PENDING';
            lastChordKeyTime = Date.now();
            event.preventDefault(); 
            event.stopPropagation(); 
            showFeedbackMessage("Ctrl+K...", activeElement, currentGlobalSettings);
            setTimeout(() => {
                if (Date.now() - lastChordKeyTime >= CHORD_TIMEOUT && chordState === 'K_PENDING') {
                    chordState = null;
                    showFeedbackMessage("Ctrl+K timed out", activeElement, currentGlobalSettings);
                }
            }, CHORD_TIMEOUT);
            return;
        } else {
            
        }
    }

    if (chordState === 'K_PENDING' && Date.now() - lastChordKeyTime < CHORD_TIMEOUT) {
        const secondKey = event.key.toLowerCase();
        let chordActionFound = false;
        for (const actionName in DEFAULT_SHORTCUT_SETTINGS_CONFIG) {
            if (currentShortcutSettings[actionName] !== true) continue;
            const config = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            if (config.chordPrefix === 'Ctrl+K' && config.chordKey.toLowerCase() === secondKey) {
                
                if (shortcutActionHandlers[actionName]) {
                    event.preventDefault(); 
                    event.stopPropagation(); 
                    await shortcutActionHandlers[actionName](activeElement, currentGlobalSettings);
                    chordActionFound = true;
                    break;
                }
            }
        }
        chordState = null; 
        if (chordActionFound) {
            return;
        } 
    }


    // --- Regular (Non-Chorded) Shortcuts ---
    
    for (const actionName in DEFAULT_SHORTCUT_SETTINGS_CONFIG) {
        if (currentShortcutSettings[actionName] !== true) continue;

        const config = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
        if (config.chordPrefix) continue;

        const parsedKey = parseKeyString(config.defaultKey);

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
        const loadedShortcutSettings = data.shortcutSettings || {};
        const loadedDisabledSites = data.disabledSites || [...DEFAULT_GLOBAL_SETTINGS.disabledSites];
        currentGlobalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...(data.globalSettings || {}) };

        Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
            currentShortcutSettings[actionName] = loadedShortcutSettings.hasOwnProperty(actionName) ?
                                          loadedShortcutSettings[actionName] :
                                          DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].defaultEnabled;
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