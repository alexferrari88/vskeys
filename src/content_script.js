// src/content_script.js
// content_script.js - Main logic, event listeners, settings, keydown router

// Constants are now expected to be loaded from common.js via manifest
// (or via require in Jest environment if content_script.js itself is tested directly, which is rare)

let currentShortcutSettings = {}; 
let currentGlobalSettings = { ...(typeof DEFAULT_GLOBAL_SETTINGS !== 'undefined' ? DEFAULT_GLOBAL_SETTINGS : {}) };
let currentSiteOverrides = {}; 
let isSiteDisabled = false;
let chordState = null; 
// IS_MAC_COMMON from common.js will be used, aliased to IS_MAC for brevity in this file
const IS_MAC = typeof IS_MAC_COMMON !== 'undefined' ? IS_MAC_COMMON : (typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0);
let _extensionHandledPaste = false; 

let isVscodeModeActive = false;
let lastFocusedEditableOnAction = null; 
let incorrectActivationCount = 0;
let incorrectActivationLastTime = 0;
const INCORRECT_ACTIVATION_TIME_WINDOW = 3000; 
let parsedActivationShortcut = null; 
const VSCODE_KEYS_ACTIVE_CLASS = 'vscode-keys-active-field'; 

const shortcutActionHandlers = {
    'cutLine': handleCutLine,
    'copyLine': handleCopyLine,
    'paste': handlePaste, 
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
    if (isSiteDisabled) return;

    const activeElement = document.activeElement;
    const currentElementIsEditable = isEditable(activeElement);

    // --- Activation Shortcut Handling --- (Keep as is)
    if (parsedActivationShortcut && eventMatchesKey(event, parsedActivationShortcut, IS_MAC)) {
        event.preventDefault();
        event.stopPropagation();

        if (isVscodeModeActive) {
            isVscodeModeActive = false;
            lastFocusedEditableOnAction = currentElementIsEditable ? activeElement : null;
            if (currentGlobalSettings.feedbackOnDeactivation && currentGlobalSettings.showFeedback) {
                showFeedbackMessage('VSCode Shortcuts Deactivated', lastFocusedEditableOnAction, currentGlobalSettings);
            }
            removePersistentActivationCues();
            incorrectActivationCount = 0; 
            chordState = null; 
        } else { 
            if (currentElementIsEditable) {
                isVscodeModeActive = true;
                lastFocusedEditableOnAction = activeElement;
                if (currentGlobalSettings.feedbackOnActivation && currentGlobalSettings.showFeedback) {
                    showFeedbackMessage('VSCode Shortcuts Activated', lastFocusedEditableOnAction, currentGlobalSettings);
                }
                applyPersistentActivationCues();
                incorrectActivationCount = 0; 
            } else {
                const now = Date.now();
                if (now - incorrectActivationLastTime < INCORRECT_ACTIVATION_TIME_WINDOW) {
                    incorrectActivationCount++;
                } else {
                    incorrectActivationCount = 1; 
                }
                incorrectActivationLastTime = now;

                if (incorrectActivationCount >= currentGlobalSettings.incorrectActivationWarningThreshold) {
                    if (currentGlobalSettings.showFeedback) {
                        showFeedbackMessage('Focus an editable field to use VSCode shortcuts.', null, currentGlobalSettings); 
                    }
                    incorrectActivationCount = 0; 
                }
            }
        }
        return; 
    }


    if (!isVscodeModeActive || !currentElementIsEditable) {
        if (chordState) console.log('[VSKeys Debug] Chord cancelled due to mode/editable change.');
        chordState = null;
        return;
    }
    
    // --- Chord Handling ---
    // Check if the current key event is ONLY a modifier key.
    // We want to ignore these if a chord is pending, waiting for the actual character key.
    const isModifierOnlyEvent = ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key);

    if (chordState && isModifierOnlyEvent) {
        // If a chord is pending and this is just a modifier key being pressed/held,
        // don't process it as the second part of the chord yet.
        // Also, don't reset chordState here, as the modifier might be part of the *next* actual key press.
        // We also don't preventDefault, as the modifier might be needed for the next key.
        console.log(`[VSKeys Debug] Chord pending (${chordState.prefix}), modifier key ${event.key} pressed. Ignoring for now, awaiting non-modifier.`);
        return; 
    }


    let potentialChordPrefixEvent = false;
    let activeChordPrefixString = '';

    // This loop is for detecting the START of a chord (the prefix)
    if (!chordState) { // Only try to detect a new prefix if no chord is currently active
        for (const actionName in currentShortcutSettings) {
            const setting = currentShortcutSettings[actionName];
            if (!setting.enabled) continue;
            const isEffectivelyChord = setting.isNowChord; 

            if (isEffectivelyChord) {
                const parts = setting.key.split(/\s+/);
                if (parts.length >= 2) { 
                    const currentActionPrefix = parts[0];
                    const parsedPrefixKey = parseKeyString(currentActionPrefix);
                    if (eventMatchesKey(event, parsedPrefixKey, IS_MAC)) {
                        console.log(`[VSKeys Debug] Potential chord prefix matched: ${currentActionPrefix} for event key: ${event.key}`);
                        potentialChordPrefixEvent = true;
                        activeChordPrefixString = currentActionPrefix;
                        break;
                    }
                }
            }
        }
    }


    if (potentialChordPrefixEvent) { // This means a new chord prefix was just matched
        chordState = { prefix: activeChordPrefixString, time: Date.now() };
        console.log('[VSKeys Debug] Chord state SET:', chordState);
        event.preventDefault();
        event.stopPropagation();
        if (currentGlobalSettings.showFeedback) {
            const displayPrefix = typeof getDisplayKeyForCommon === 'function' ? getDisplayKeyForCommon(activeChordPrefixString, IS_MAC) : activeChordPrefixString;
            showFeedbackMessage(`${displayPrefix}...`, activeElement, currentGlobalSettings);
        }
        setTimeout(() => {
            if (chordState && chordState.prefix === activeChordPrefixString && (Date.now() - chordState.time >= currentGlobalSettings.feedbackDuration)) {
                console.log('[VSKeys Debug] Chord timed out:', activeChordPrefixString);
                chordState = null;
                if (currentGlobalSettings.showFeedback) {
                     const displayPrefix = typeof getDisplayKeyForCommon === 'function' ? getDisplayKeyForCommon(activeChordPrefixString, IS_MAC) : activeChordPrefixString;
                    showFeedbackMessage(`${displayPrefix} timed out`, activeElement, currentGlobalSettings);
                }
            }
        }, currentGlobalSettings.feedbackDuration);
        return;
    }
    
    // This part handles the SECOND key of an ALREADY ACTIVE chord
    if (chordState && (Date.now() - chordState.time < currentGlobalSettings.feedbackDuration)) {
        // We already checked for isModifierOnlyEvent and returned if true.
        // So, event.key here should be the actual non-modifier key.
        console.log(`[VSKeys Debug] Active chord state: ${chordState.prefix}. Trying to match second part with event key: ${event.key}, Ctrl: ${event.ctrlKey || event.metaKey}, Shift: ${event.shiftKey}, Alt: ${event.altKey}`);
        let chordActionFound = false;
        for (const actionName in currentShortcutSettings) {
            const setting = currentShortcutSettings[actionName];
            if (!setting.enabled) continue;
            const isEffectivelyChord = setting.isNowChord;

            if (isEffectivelyChord) {
                const parts = setting.key.split(/\s+/);
                if (parts.length < 2) continue;
                const expectedPrefix = parts[0];
                const expectedSecondKeyString = parts.slice(1).join(' ');

                if (chordState.prefix === expectedPrefix) {
                    const parsedSecondKey = parseKeyString(expectedSecondKeyString);
                    console.log(`[VSKeys Debug] Checking action ${actionName}. Expected second part: ${expectedSecondKeyString} (parsed: ${JSON.stringify(parsedSecondKey)})`);
                    
                    if (eventMatchesKey(event, parsedSecondKey, IS_MAC)) {
                        console.log(`[VSKeys Debug] Chord action ${actionName} MATCHED!`);
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
        const previousChordPrefixForLog = chordState.prefix; 
        chordState = null; 
        console.log('[VSKeys Debug] Chord state CLEARED after attempting to match second part.');
        if (chordActionFound) {
            return;
        } else {
            // If a chord was active, but this key didn't complete it, consume the event
            // to prevent it from triggering other non-chord shortcuts or default browser actions.
            console.log(`[VSKeys Debug] Chord prefix ${previousChordPrefixForLog} was active, but key ${event.key} did not complete any defined chord. Consuming event.`);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
    }

    // --- Regular (Non-Chorded) Shortcuts ---
    for (const actionName in currentShortcutSettings) {
        const setting = currentShortcutSettings[actionName];
        if (!setting.enabled || setting.isNowChord) continue; 

        const parsedKey = parseKeyString(setting.key);
        if (eventMatchesKey(event, parsedKey, IS_MAC)) {
            const handler = shortcutActionHandlers[actionName];
            if (handler) {
                let handled = true; 
                if (actionName === 'paste') _extensionHandledPaste = true;
                
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
    document.querySelectorAll(`.${VSCODE_KEYS_ACTIVE_CLASS}`).forEach(el => {
        el.classList.remove(VSCODE_KEYS_ACTIVE_CLASS);
    });
}

function determineEffectiveShortcutSettings(baseGlobalSettings, siteOverrides, hostname) {
    const effectiveSettings = {};
    const currentHostname = hostname.toLowerCase();
    let siteRule = null;

    if (siteOverrides[currentHostname]) {
        siteRule = siteOverrides[currentHostname];
    } else {
        const parts = currentHostname.split('.');
        for (let i = 0; i < parts.length -1; i++) { 
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
        let isNowChord = effectiveKey.includes(' '); // Recalculate based on current effectiveKey

        if (siteRule && siteRule[actionName]) {
            const siteActionOverride = siteRule[actionName];
            if (siteActionOverride.hasOwnProperty('key') && siteActionOverride.key !== null && siteActionOverride.key !== undefined) {
                effectiveKey = siteActionOverride.key;
            }
            if (siteActionOverride.hasOwnProperty('enabled') && siteActionOverride.enabled !== null && siteActionOverride.enabled !== undefined) {
                effectiveEnabled = siteActionOverride.enabled;
            }
            isNowChord = effectiveKey.includes(' '); // Update based on potentially overridden key
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
            currentShortcutSettings = {}; 
        } else {
            currentShortcutSettings = determineEffectiveShortcutSettings(baseGlobalSettings, currentSiteOverrides, currentHostname);
            if (isVscodeModeActive) { 
                applyPersistentActivationCues();
            } else {
                removePersistentActivationCues(); 
            }
        }
    });
}

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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadSettingsAndInitialize,
        determineEffectiveShortcutSettings,
        mainKeyDownHandler,
        applyPersistentActivationCues,
        removePersistentActivationCues,
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
        shortcutActionHandlers, 
        IS_MAC,
        VSCODE_KEYS_ACTIVE_CLASS
    };
}