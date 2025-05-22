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
    // 'trimTrailingWhitespace': { defaultKey: 'Alt+Shift+T', description: 'Trim Trailing Whitespace (Selection/Current Line)', category: 'Whitespace', defaultEnabled: true }, // Non-chorded alternative if preferred
};

function parseKeyString(keyString) {
    // Step 0: Handle exact single space input first.
    if (keyString === " ") {
        return { ctrl: false, shift: false, alt: false, meta: false, key: 'space' };
    }

    // Step 1: Trim leading/trailing whitespace for all other cases.
    let normalized = keyString.trim();

    if (normalized === "") {
        return { ctrl: false, shift: false, alt: false, meta: false, key: '' };
    }

    // Step 2: Normalize spacing around '+' signs. "CTRL + c" -> "CTRL+c"
    // This also handles cases like "Ctrl +", reducing them to "Ctrl+"
    normalized = normalized.replace(/\s*\+\s*/g, '+');


    // Step 3: Take only the first part if it's a chord (e.g., "Ctrl+K" from "Ctrl+K C").
    const chordParts = normalized.split(/\s+/);
    const keyComboToParse = chordParts[0].toLowerCase(); // "ctrl+k", "ctrl+c"

    // Step 4: Split the key combination by '+' to identify modifiers and the main key.
    // Filter out empty parts that can arise from "Ctrl++" or a trailing "+" like in "Ctrl+"
    const parts = keyComboToParse.split('+').filter(p => p !== "");

    const result = {
        ctrl: parts.includes('ctrl'),
        shift: parts.includes('shift'),
        alt: parts.includes('alt'),
        meta: parts.includes('meta'),
        key: parts.filter(p => !['ctrl', 'shift', 'alt', 'meta'].includes(p)).pop() || ''
    };

    // Step 5: Apply key map for special key names.
    // The 'space' key is already handled by the initial check.
    const keyMap = {
        'arrowdown': 'arrowdown', 'arrowup': 'arrowup', 'arrowleft': 'arrowleft', 'arrowright': 'arrowright',
        'enter': 'enter', 'escape': 'escape', 'tab': 'tab', 'backspace': 'backspace', 'delete': 'delete',
        'home': 'home', 'end': 'end', 'pageup': 'pageup', 'pagedown': 'pagedown',
        '[': '[', ']': ']', '/': '/', '\\': '\\'
        // 'spacebar': 'space' // if event.key is 'Spacebar'
    };
    if (result.key === 'spacebar') result.key = 'space'; // Normalize spacebar to space
    result.key = keyMap[result.key] || result.key;
    return result;
}

function eventMatchesKey(event, parsedKey, isMac) {
    const eventCtrl = isMac ? event.metaKey : event.ctrlKey;
    const eventKeyLower = event.key.toLowerCase();
    const targetKey = parsedKey.key.toLowerCase();

    // If Alt is part of the shortcut, event.key might be altered by the OS/browser
    // e.g. Alt+U -> ü on some systems. 'event.code' gives the physical key.
    // We need to be careful: 'event.code' is like 'KeyU', 'Digit1', 'Slash'.
    // parsedKey.key is usually 'u', '1', '/'.
    
    let keyToCompareWithEvent;
    if (parsedKey.alt && event.altKey && event.code && event.code.startsWith('Key') && event.code.length === 4 && event.key.length === 1) {
        // If Alt is pressed and it's a letter key (e.g. event.code 'KeyU')
        // Compare against the character from event.code (e.g., 'u')
        keyToCompareWithEvent = event.code.substring(3).toLowerCase();
    } else {
        const specialKeyMap = { ' ': 'space', 'arrowdown': 'arrowdown', 'arrowup': 'arrowup', 'arrowleft': 'arrowleft', 'arrowright': 'arrowright', 'enter': 'enter', 'escape': 'escape', 'tab': 'tab', 'backspace': 'backspace', 'delete': 'delete', 'home': 'home', 'end': 'end', 'pageup': 'pageup', 'pagedown': 'pagedown' };
        keyToCompareWithEvent = specialKeyMap[eventKeyLower] || eventKeyLower;
    }

    const keyMatches = (keyToCompareWithEvent === targetKey);
    const ctrlMatch = (eventCtrl === parsedKey.ctrl);
    const shiftMatch = (event.shiftKey === parsedKey.shift);
    const altMatch = (event.altKey === parsedKey.alt);
    // For meta key, only check if parsedKey.meta is true. If parsedKey.meta is false, event.metaKey can be anything (e.g. Mac Cmd without being part of shortcut)
    // However, on Mac, we treat event.metaKey as Ctrl. So this is covered by ctrlMatch.
    // The only case for distinct meta is if a shortcut explicitly uses 'Meta' (e.g. Windows Key) on non-Mac.
    // This is rare for this extension's scope. Let's assume parsedKey.meta is primarily for Mac Cmd, handled by eventCtrl.

    if (!parsedKey.ctrl && !parsedKey.shift && !parsedKey.alt && !parsedKey.meta) { // Shortcut is a single, unmodified key
        return keyMatches && !eventCtrl && !event.shiftKey && !event.altKey && !event.metaKey;
    }

    const finalMatch = ctrlMatch && shiftMatch && altMatch && keyMatches;

    return finalMatch;
}

// Default global settings
const DEFAULT_GLOBAL_SETTINGS = {
    extensionEnabled: true, 
    disabledSites: [],
    showFeedback: true,
    feedbackDuration: 1500, // ms
    activationShortcut: 'Alt+Shift+S',
    incorrectActivationWarningThreshold: 2,
    activationBorderColor: '#007ACC', 
    feedbackOnActivation: true, 
    feedbackOnDeactivation: true, 
    persistentCueStyle: 'border' 
};

// Export for testing purposes (Jest will pick this up)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEFAULT_SHORTCUT_SETTINGS_CONFIG,
        parseKeyString,
        eventMatchesKey,
        DEFAULT_GLOBAL_SETTINGS
    };
}