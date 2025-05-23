// common.js - Shared configurations and helpers

const DEFAULT_SHORTCUT_SETTINGS_CONFIG = {
    // actionName: { config }
    'cutLine': { defaultKey: 'Ctrl+X', description: 'Cut line (empty selection) / Cut selection', category: 'Editing', defaultEnabled: true },
    'copyLine': { defaultKey: 'Ctrl+C', description: 'Copy line (empty selection) / Copy selection', category: 'Editing', defaultEnabled: true },
    'paste': { defaultKey: 'Ctrl+V', description: 'Paste', category: 'Editing', defaultEnabled: true },
    'deleteLine': { defaultKey: 'Ctrl+Shift+K', description: 'Delete Line', category: 'Line Operations', defaultEnabled: true },
    'insertLineBelow': { defaultKey: 'Ctrl+Enter', description: 'Insert Line Below', category: 'Line Operations', defaultEnabled: false },
    'insertLineAbove': { defaultKey: 'Ctrl+Shift+Enter', description: 'Insert Line Above', category: 'Line Operations', defaultEnabled: true },
    'moveLineDown': { defaultKey: 'Alt+ArrowDown', description: 'Move Line Down', category: 'Line Operations', defaultEnabled: true },
    'moveLineUp': { defaultKey: 'Alt+ArrowUp', description: 'Move Line Up', category: 'Line Operations', defaultEnabled: true },
    'copyLineDown': { defaultKey: 'Shift+Alt+ArrowDown', description: 'Copy Line Down', category: 'Line Operations', defaultEnabled: true },
    'copyLineUp': { defaultKey: 'Shift+Alt+ArrowUp', description: 'Copy Line Up', category: 'Line Operations', defaultEnabled: true },
    'selectLine': { defaultKey: 'Ctrl+L', description: 'Select current line', category: 'Selection', defaultEnabled: true },
    'indentLine': { defaultKey: 'Ctrl+]', description: 'Indent Line/Selection', category: 'Indentation', defaultEnabled: true },
    'outdentLine': { defaultKey: 'Ctrl+[', description: 'Outdent Line/Selection', category: 'Indentation', defaultEnabled: true },
    'smartHome': { defaultKey: 'Home', description: 'Smart Home (to first non-whitespace / line start)', category: 'Navigation', defaultEnabled: true },
    'toggleLineComment': { defaultKey: 'Ctrl+/', description: 'Toggle Line Comment', category: 'Comments', defaultEnabled: true },
    'toggleBlockComment': { defaultKey: 'Shift+Alt+A', description: 'Toggle Block Comment', category: 'Comments', defaultEnabled: true },
    'selectWordOrNextOccurrence': { defaultKey: 'Ctrl+D', description: 'Select word / Find next occurrence (single selection)', category: 'Selection', defaultEnabled: true },

    // Chorded shortcuts
    'addLineCommentChord': { defaultKey: 'Ctrl+K Ctrl+C', description: 'Add Line Comment', category: 'Comments', defaultEnabled: true, chordPrefix: 'Ctrl+K', chordKey: 'C' },
    'removeLineCommentChord': { defaultKey: 'Ctrl+K Ctrl+U', description: 'Remove Line Comment', category: 'Comments', defaultEnabled: true, chordPrefix: 'Ctrl+K', chordKey: 'U' },
    'trimTrailingWhitespaceChord': { defaultKey: 'Ctrl+K Ctrl+W', description: 'Trim Trailing Whitespace (Selection/Current Line)', category: 'Whitespace', defaultEnabled: true, chordPrefix: 'Ctrl+K', chordKey: 'W' },

    'toUpperCase': { defaultKey: 'Ctrl+Alt+U', description: 'Selection to UPPERCASE', category: 'Case Transformation', defaultEnabled: true },
    'toLowerCase': { defaultKey: 'Ctrl+Alt+L', description: 'Selection to lowercase', category: 'Case Transformation', defaultEnabled: true },
    'toTitleCase': { defaultKey: 'Ctrl+Alt+T', description: 'Selection to Title Case', category: 'Case Transformation', defaultEnabled: true },
};

const IS_MAC_COMMON = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

function getDisplayKeyForCommon(keyString, isMacPlatform = IS_MAC_COMMON) {
    let result = keyString;
    if (isMacPlatform) {
        result = result
            .replace(/\bCtrl\b/g, '⌘')
            .replace(/\bMeta\b/g, '⌘') // Handle Meta as Cmd on Mac
            .replace(/\bCmd\b/g, '⌘')  // Explicit Cmd also
            .replace(/\bAlt\b/g, '⌥')
            .replace(/\bShift\b/g, '⇧')
            .replace(/\bEnter\b/g, '↵')
            .replace(/\bArrowUp\b/g, '↑')
            .replace(/\bArrowDown\b/g, '↓')
            .replace(/\bArrowLeft\b/g, '←')
            .replace(/\bArrowRight\b/g, '→')
            .replace(/\+/g, ' '); // Visual separation on Mac
    } else { // Non-Mac
        // Normalize "Control" to "Ctrl" for display consistency if it comes from raw input
        // However, if keyString is already "Ctrl", this won't change it.
        // This part of the logic is primarily for ensuring `getDisplayKeyForTest` and internal representation match.
        // If `formatCapturedKey` in options.js always saves "Ctrl", then this replace might not be strictly needed here
        // for display, but it standardizes.
        result = result.replace(/\bControl\b/g, 'Ctrl'); 
        result = result.replace(/\bMeta\b/g, 'Win'); // Meta on Win/Linux is typically Win/Super key

        result = result
            .replace(/\bArrowUp\b/g, 'Up')
            .replace(/\bArrowDown\b/g, 'Down')
            .replace(/\bArrowLeft\b/g, 'Left')
            .replace(/\bArrowRight\b/g, 'Right');
    }
    return result.trim();
}


function parseKeyString(keyString) {
    if (keyString === " ") {
        return { ctrl: false, shift: false, alt: false, meta: false, key: 'space' };
    }
    let normalized = keyString.trim();
    if (normalized === "") {
        return { ctrl: false, shift: false, alt: false, meta: false, key: '' };
    }
    normalized = normalized.replace(/\s*\+\s*/g, '+');
    const chordParts = normalized.split(/\s+/);
    const keyComboToParse = chordParts[0].toLowerCase(); 
    const parts = keyComboToParse.split('+').filter(p => p !== "");

    const result = {
        ctrl: parts.includes('ctrl') || parts.includes('control'), // Accept "Control" as well
        shift: parts.includes('shift'),
        alt: parts.includes('alt'),
        meta: parts.includes('meta'), // Meta for Windows Key or Mac Command if explicitly specified
        key: parts.filter(p => !['ctrl', 'control', 'shift', 'alt', 'meta'].includes(p)).pop() || ''
    };
    
    const keyMap = {
        'arrowdown': 'arrowdown', 'arrowup': 'arrowup', 'arrowleft': 'arrowleft', 'arrowright': 'arrowright',
        'enter': 'enter', 'escape': 'escape', 'tab': 'tab', 'backspace': 'backspace', 'delete': 'delete',
        'home': 'home', 'end': 'end', 'pageup': 'pageup', 'pagedown': 'pagedown',
        '[': '[', ']': ']', '/': '/', '\\': '\\',
        'spacebar': 'space', 'space': 'space' // Normalize spacebar and space
    };
    result.key = keyMap[result.key.toLowerCase()] || result.key.toLowerCase(); // Ensure key is lowercased for comparison unless special
    if (result.key.length === 1 && result.key >= 'a' && result.key <= 'z') {
        // Keep single letters as is for comparison with event.key (which can be upper or lower case)
        // The eventMatchesKey will handle case comparison for the key itself.
    }

    return result;
}

function eventMatchesKey(event, parsedKey, isMacPlatform = IS_MAC_COMMON) {
    const eventCtrl = isMacPlatform ? event.metaKey : event.ctrlKey;
    const eventKeyLower = event.key.toLowerCase();
    let targetKey = parsedKey.key; // Don't lowercase targetKey here if it's like '[' or ']'

    // Standardize common event.key values
    const eventKeyMap = { ' ': 'space', 'escape': 'escape', 'arrowdown': 'arrowdown', /* ... add more as needed */ };
    const mappedEventKey = eventKeyMap[eventKeyLower] || eventKeyLower;
    
    // If parsedKey.key is a single character (a-z), compare case-insensitively with event.key
    // For other keys (ArrowDown, Space, [, etc.), compare directly (after mapping event key)
    let keyMatches;
    if (targetKey.length === 1 && targetKey >= 'a' && targetKey <= 'z') {
        keyMatches = (mappedEventKey === targetKey); // eventKeyLower is already lowercase
    } else {
        keyMatches = (mappedEventKey === targetKey);
    }


    const ctrlMatch = (eventCtrl === parsedKey.ctrl);
    const shiftMatch = (event.shiftKey === parsedKey.shift);
    const altMatch = (event.altKey === parsedKey.alt);
    
    // Meta key check (primarily for non-Mac 'Meta' like Windows key)
    // On Mac, Meta (Cmd) is handled by eventCtrl.
    const metaMatch = isMacPlatform ? true : (event.metaKey === parsedKey.meta);


    if (!parsedKey.ctrl && !parsedKey.shift && !parsedKey.alt && !parsedKey.meta) { 
        return keyMatches && !eventCtrl && !event.shiftKey && !event.altKey && !event.metaKey;
    }

    return ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatches;
}


const DEFAULT_GLOBAL_SETTINGS = {
    extensionEnabled: true, 
    disabledSites: [],
    showFeedback: true,
    feedbackDuration: 1500,
    activationShortcut: 'Alt+Shift+S',
    incorrectActivationWarningThreshold: 2,
    activationBorderColor: '#007ACC', 
    feedbackOnActivation: true, 
    feedbackOnDeactivation: true, 
    persistentCueStyle: 'border' 
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEFAULT_SHORTCUT_SETTINGS_CONFIG,
        parseKeyString,
        eventMatchesKey,
        DEFAULT_GLOBAL_SETTINGS,
        IS_MAC_COMMON,
        getDisplayKeyForCommon
    };
}