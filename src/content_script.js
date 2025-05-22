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
// const CHORD_TIMEOUT = 1500; // ms - This will be sourced from currentGlobalSettings.feedbackDuration or a specific chord timeout if needed
const IS_MAC = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
let _extensionHandledPaste = false; // Global flag for paste handling

// New state variables for activation logic
let isVscodeModeActive = false;
let lastFocusedEditableOnAction = null; // Element reference
let incorrectActivationCount = 0;
let incorrectActivationLastTime = 0;
const INCORRECT_ACTIVATION_TIME_WINDOW = 3000; // ms, within which repeated presses count
let parsedActivationShortcut = null; // Stores the parsed activation shortcut key object
const VSCODE_KEYS_ACTIVE_CLASS = 'vscode-keys-active-field'; // CSS class for active fields

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
    const currentElementIsEditable = isEditable(activeElement);

    // --- Activation Shortcut Handling ---
    if (parsedActivationShortcut && eventMatchesKey(event, parsedActivationShortcut, IS_MAC)) {
        event.preventDefault();
        event.stopPropagation();

        if (isVscodeModeActive) { // Attempting to deactivate
            isVscodeModeActive = false;
            lastFocusedEditableOnAction = currentElementIsEditable ? activeElement : null;
            if (currentGlobalSettings.feedbackOnDeactivation && currentGlobalSettings.showFeedback) {
                showFeedbackMessage('VSCode Shortcuts Deactivated', lastFocusedEditableOnAction, currentGlobalSettings);
            }
            removePersistentActivationCues();
            incorrectActivationCount = 0; // Reset counter on successful deactivation
            chordState = null; // Clear any pending chord
        } else { // Attempting to activate
            if (currentElementIsEditable) {
                isVscodeModeActive = true;
                lastFocusedEditableOnAction = activeElement;
                if (currentGlobalSettings.feedbackOnActivation && currentGlobalSettings.showFeedback) {
                    showFeedbackMessage('VSCode Shortcuts Activated', lastFocusedEditableOnAction, currentGlobalSettings);
                }
                applyPersistentActivationCues();
                incorrectActivationCount = 0; // Reset counter on successful activation
            } else {
                // Incorrect activation attempt (not in an editable field)
                const now = Date.now();
                if (now - incorrectActivationLastTime < INCORRECT_ACTIVATION_TIME_WINDOW) {
                    incorrectActivationCount++;
                } else {
                    incorrectActivationCount = 1; // Reset if too much time has passed
                }
                incorrectActivationLastTime = now;

                if (incorrectActivationCount >= currentGlobalSettings.incorrectActivationWarningThreshold) {
                    if (currentGlobalSettings.showFeedback) {
                        showFeedbackMessage('Focus an editable field to use VSCode shortcuts.', null, currentGlobalSettings); // General message
                    }
                    incorrectActivationCount = 0; // Reset after warning
                }
                // The activation shortcut itself was handled (preventDefault/stopPropagation already called)
                // So we don't need to worry about default browser actions for this specific key press.
            }
        }
        return; // Activation shortcut handled, nothing more to do in this event.
    }

    // If VSCode mode is not active, do nothing further.
    if (!isVscodeModeActive) {
        return;
    }

    // If mode is active, but current element is not editable, clear chord and do nothing.
    if (!currentElementIsEditable) {
        chordState = null;
        return;
    }
    
    // --- VSCode Shortcut Processing (Only if isVscodeModeActive and in an editable field) ---
    const eventCtrlKey = IS_MAC ? event.metaKey : event.ctrlKey;

    // --- Chord Handling ---
    let potentialChordPrefixEvent = false;
    let activeChordPrefixString = '';

    for (const actionName in currentShortcutSettings) {
        const setting = currentShortcutSettings[actionName];
        if (!setting.enabled) continue;

        const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
        const isEffectivelyChord = defaultConfig.chordPrefix || setting.isNowChord === true;

        if (isEffectivelyChord) {
            const parts = setting.key.split(/\s+/);
            if (parts.length >= 2) { 
                const currentActionPrefix = parts[0];
                const parsedPrefixKey = parseKeyString(currentActionPrefix);
                if (eventMatchesKey(event, parsedPrefixKey, IS_MAC)) {
                    potentialChordPrefixEvent = true;
                    activeChordPrefixString = currentActionPrefix;
                    break;
                }
            }
        }
    }

    if (potentialChordPrefixEvent) {
        chordState = { prefix: activeChordPrefixString, time: Date.now() };
        event.preventDefault();
        event.stopPropagation();
        if (currentGlobalSettings.showFeedback) {
            showFeedbackMessage(`${getDisplayKey(activeChordPrefixString)}...`, activeElement, currentGlobalSettings);
        }
        setTimeout(() => {
            if (chordState && chordState.prefix === activeChordPrefixString && (Date.now() - chordState.time >= currentGlobalSettings.feedbackDuration)) {
                chordState = null;
                if (currentGlobalSettings.showFeedback) {
                    showFeedbackMessage(`${getDisplayKey(activeChordPrefixString)} timed out`, activeElement, currentGlobalSettings);
                }
            }
        }, currentGlobalSettings.feedbackDuration);
        return;
    }
    
    if (chordState && (Date.now() - chordState.time < currentGlobalSettings.feedbackDuration)) {
        let chordActionFound = false;
        for (const actionName in currentShortcutSettings) {
            const setting = currentShortcutSettings[actionName];
            if (!setting.enabled) continue;

            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            const isEffectivelyChord = defaultConfig.chordPrefix || setting.isNowChord === true;

            if (isEffectivelyChord) {
                const parts = setting.key.split(/\s+/);
                if (parts.length < 2) continue;

                const expectedPrefix = parts[0];
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
        const previousChordPrefix = chordState.prefix; 
        chordState = null; 
        if (chordActionFound) {
            return;
        } else {
            // If a chord sequence was active (previousChordPrefix is true) but the second key didn't match,
            // we should still consume the event to prevent it from triggering other actions.
            if (previousChordPrefix) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
        }
    }

    // --- Regular (Non-Chorded) Shortcuts ---
    for (const actionName in currentShortcutSettings) {
        const setting = currentShortcutSettings[actionName];
        if (!setting.enabled) continue;

        const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
        const isEffectivelyChord = defaultConfig.chordPrefix || setting.isNowChord === true;

        if (isEffectivelyChord) continue; 

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

// --- Visual Feedback Functions ---
function applyPersistentActivationCues() {
    if (!currentGlobalSettings || currentGlobalSettings.persistentCueStyle !== 'border') return;
    const styleId = 'vscode-keys-dynamic-styles';
    if (!document.getElementById(styleId)) {
        const styleSheet = document.createElement("style");
        styleSheet.id = styleId;
        styleSheet.innerText = `.${VSCODE_KEYS_ACTIVE_CLASS} { border: 2px solid ${currentGlobalSettings.activationBorderColor || DEFAULT_GLOBAL_SETTINGS.activationBorderColor} !important; box-sizing: border-box; outline: none !important; }`;
        document.head.appendChild(styleSheet);
    }

    document.querySelectorAll('textarea, input[type="text"], input[type="search"], input[type="email"], input[type="password"], input[type="url"], input[type="tel"], input:not([type]), [contenteditable="true"]').forEach(el => {
        if (isEditable(el)) { 
            el.classList.add(VSCODE_KEYS_ACTIVE_CLASS);
        }
    });
}

function removePersistentActivationCues() {
    // if (!currentGlobalSettings || currentGlobalSettings.persistentCueStyle !== 'border') return; // Not needed if class is specific
    document.querySelectorAll(`.${VSCODE_KEYS_ACTIVE_CLASS}`).forEach(el => {
        el.classList.remove(VSCODE_KEYS_ACTIVE_CLASS);
    });
    const styleSheet = document.getElementById('vscode-keys-dynamic-styles');
    if (styleSheet) {
        // styleSheet.remove(); // Optionally remove the stylesheet itself, or keep for re-activation
    }
}
// --- End Visual Feedback Functions ---

function determineEffectiveShortcutSettings(baseGlobalSettings, siteOverrides, hostname) {
    const effectiveSettings = {};
    const currentHostname = hostname.toLowerCase();

    let siteRule = null;
    if (siteOverrides[currentHostname]) {
        siteRule = siteOverrides[currentHostname];
    } else {
        const parts = currentHostname.split('.');
        // Check for wildcard matches like *.example.com, then *.com (less likely for *.com to be useful)
        for (let i = 0; i < parts.length -1; i++) { // Iterate to create *.domain.tld, *.sub.domain.tld etc.
            const wildcardHostname = `*.${parts.slice(i + 1).join('.')}`;
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
            isCustom: false, 
            isNowChord: defaultConfig.defaultKey.includes(' ')
        };

        let effectiveKey = globalSettingForAction.key;
        let effectiveEnabled = globalSettingForAction.enabled;
        let isNowChord = globalSettingForAction.isNowChord; 

        if (siteRule && siteRule[actionName]) {
            const siteActionOverride = siteRule[actionName];
            if (siteActionOverride.hasOwnProperty('key')) {
                effectiveKey = siteActionOverride.key;
                isNowChord = effectiveKey.includes(' ');
            }
            if (siteActionOverride.hasOwnProperty('enabled')) {
                effectiveEnabled = siteActionOverride.enabled;
            }
        }
        
        effectiveSettings[actionName] = {
            enabled: effectiveEnabled,
            key: effectiveKey,
            isNowChord: isNowChord,
        };
    });
    return effectiveSettings;
}


function loadSettingsAndInitialize() {
    chrome.storage.sync.get(['shortcutSettings', 'disabledSites', 'globalSettings', 'siteOverrides'], (data) => {
        const loadedGlobalShortcutSettingsFromStorage = data.shortcutSettings || {};
        const loadedDisabledSites = data.disabledSites || [...DEFAULT_GLOBAL_SETTINGS.disabledSites];
        currentGlobalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...(data.globalSettings || {}) };
        currentSiteOverrides = data.siteOverrides || {}; 

        if (currentGlobalSettings.activationShortcut) {
            parsedActivationShortcut = parseKeyString(currentGlobalSettings.activationShortcut);
        } else {
            parsedActivationShortcut = parseKeyString(DEFAULT_GLOBAL_SETTINGS.activationShortcut); 
        }

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
            } else if (typeof loadedGlobalSetting === 'boolean') { 
                baseGlobalSettings[actionName] = {
                    enabled: loadedGlobalSetting,
                    key: defaultConfig.defaultKey,
                    isCustom: false,
                    isNowChord: defaultConfig.defaultKey.includes(' ')
                };
            } else { 
                baseGlobalSettings[actionName] = {
                    enabled: defaultConfig.defaultEnabled,
                    key: defaultConfig.defaultKey,
                    isCustom: false,
                    isNowChord: defaultConfig.defaultKey.includes(' ')
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
                console.warn("VS Keys: Error matching site pattern:", sitePattern, e);
                return false;
            }
        });
        
        if (isSiteDisabled) {
            console.log(`VS Keys Extension disabled on ${currentHostname}`);
            removePersistentActivationCues(); 
            isVscodeModeActive = false; 
            currentShortcutSettings = {}; // Explicitly clear shortcuts if site is disabled
        } else {
            // *** PRIMARY FIX IS HERE ***
            // Populate currentShortcutSettings with the effective settings for this site.
            currentShortcutSettings = determineEffectiveShortcutSettings(baseGlobalSettings, currentSiteOverrides, currentHostname);

            if (isVscodeModeActive) { // If mode was active (e.g. from before settings reload)
                applyPersistentActivationCues();
            } else {
                removePersistentActivationCues(); 
            }
        }
    });
}

// --- Event Listeners ---
document.addEventListener('keydown', mainKeyDownHandler, true); 

document.addEventListener('paste', (event) => {
    if (_extensionHandledPaste && isEditable(event.target)) {
        event.preventDefault(); 
        event.stopPropagation(); 
    }
    setTimeout(() => {
        _extensionHandledPaste = false;
    }, 0);
}, true); 


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
        loadSettingsAndInitialize,
        determineEffectiveShortcutSettings,
        mainKeyDownHandler,
        applyPersistentActivationCues,
        removePersistentActivationCues,
        // Allow tests to get/set internal state
        _getState: () => ({
            currentShortcutSettings,
            currentGlobalSettings,
            currentSiteOverrides,
            isSiteDisabled,
            isVscodeModeActive,
            parsedActivationShortcut,
            chordState
        }),
        _setState: (newState) => {
            if (newState.hasOwnProperty('currentShortcutSettings')) currentShortcutSettings = newState.currentShortcutSettings;
            if (newState.hasOwnProperty('currentGlobalSettings')) currentGlobalSettings = newState.currentGlobalSettings;
            if (newState.hasOwnProperty('currentSiteOverrides')) currentSiteOverrides = newState.currentSiteOverrides;
            if (newState.hasOwnProperty('isSiteDisabled')) isSiteDisabled = newState.isSiteDisabled;
            if (newState.hasOwnProperty('isVscodeModeActive')) isVscodeModeActive = newState.isVscodeModeActive;
            if (newState.hasOwnProperty('parsedActivationShortcut')) parsedActivationShortcut = newState.parsedActivationShortcut;
            if (newState.hasOwnProperty('chordState')) chordState = newState.chordState;
        },
         // Expose other functions or constants if needed for specific tests
        shortcutActionHandlers, // To check if handlers are mapped
        IS_MAC,
        VSCODE_KEYS_ACTIVE_CLASS
    };
}