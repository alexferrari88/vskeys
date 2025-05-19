// common.js - Shared configurations and helpers

const DEFAULT_SHORTCUT_SETTINGS_CONFIG = {
    // actionName: { config }
    'cutLine': { defaultKey: 'Ctrl+X', description: 'Cut line (empty selection) / Cut selection', category: 'Editing', defaultEnabled: true },
    'copyLine': { defaultKey: 'Ctrl+C', description: 'Copy line (empty selection) / Copy selection', category: 'Editing', defaultEnabled: true },
    'paste': { defaultKey: 'Ctrl+V', description: 'Paste', category: 'Editing', defaultEnabled: true },
    'deleteLine': { defaultKey: 'Ctrl+Shift+K', description: 'Delete Line', category: 'Line Operations', defaultEnabled: true },
    'insertLineBelow': { defaultKey: 'Ctrl+Enter', description: 'Insert Line Below', category: 'Line Operations', defaultEnabled: true },
    'insertLineAbove': { defaultKey: 'Ctrl+Shift+Enter', description: 'Insert Line Above', category: 'Line Operations', defaultEnabled: true },
    'moveLineDown': { defaultKey: 'Alt+ArrowDown', description: 'Move Line Down', category: 'Line Operations', defaultEnabled: true },
    'moveLineUp': { defaultKey: 'Alt+ArrowUp', description: 'Move Line Up', category: 'Line Operations', defaultEnabled: true },
    'copyLineDown': { defaultKey: 'Shift+Alt+ArrowDown', description: 'Copy Line Down', category: 'Line Operations', defaultEnabled: true },
    'copyLineUp': { defaultKey: 'Shift+Alt+ArrowUp', description: 'Copy Line Up', category: 'Line Operations', defaultEnabled: true },
    'undo': { defaultKey: 'Ctrl+Z', description: 'Undo (Browser Native)', category: 'Editing', defaultEnabled: true, isNative: true }, // Mark native ones if we just ensure event pass-through or special handling
    'redo': { defaultKey: 'Ctrl+Y', description: 'Redo (Browser Native)', category: 'Editing', defaultEnabled: true, isNative: true },
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

    // New features from user request
    'toUpperCase': { defaultKey: 'Ctrl+Alt+U', description: 'Selection to UPPERCASE', category: 'Case Transformation', defaultEnabled: true },
    'toLowerCase': { defaultKey: 'Ctrl+Alt+L', description: 'Selection to lowercase', category: 'Case Transformation', defaultEnabled: true },
    'toTitleCase': { defaultKey: 'Ctrl+Alt+T', description: 'Selection to Title Case', category: 'Case Transformation', defaultEnabled: true },
    // 'trimTrailingWhitespace': { defaultKey: 'Alt+Shift+T', description: 'Trim Trailing Whitespace (Selection/Current Line)', category: 'Whitespace', defaultEnabled: true }, // Non-chorded alternative if preferred
};

function parseKeyString(keyString) {
    // Check if it's a chorded key string
    const chordParts = keyString.split(/\s+/); // Split by one or more spaces
    if (chordParts.length > 1 && chordParts[0].includes('+')) { // Heuristic: "Ctrl+K C" or "Ctrl+K Ctrl+C"
        // For now, this function primarily parses single key combinations.
        // Chord parsing is implicitly handled by chordPrefix/chordKey in config.
        // This part is more for future-proofing if we parse full chord strings here.
    }

    const parts = (chordParts[0] || keyString).split('+').map(p => p.trim().toLowerCase());
    const result = {
        ctrl: parts.includes('ctrl'),
        shift: parts.includes('shift'),
        alt: parts.includes('alt'),
        meta: parts.includes('meta'), // Specifically for Mac Cmd if 'meta' is used in keyString
        key: parts.filter(p => !['ctrl', 'shift', 'alt', 'meta'].includes(p)).pop() || '' // Get the last non-modifier part as key
    };

    // Normalize key names from event.key to common representation
    const keyMap = {
        'arrowdown': 'arrowdown', 'arrowup': 'arrowup', 'arrowleft': 'arrowleft', 'arrowright': 'arrowright',
        'enter': 'enter', 'escape': 'escape', 'tab': 'tab', 'backspace': 'backspace', 'delete': 'delete',
        'home': 'home', 'end': 'end', 'pageup': 'pageup', 'pagedown': 'pagedown',
        '[': '[', ']': ']', '/': '/', '\\': '\\', // Keep symbols as is if they are the key
        // Add more if event.key gives different values than what we store (e.g. ' ' for spacebar)
        ' ': 'space' // Example: if we want to define 'Ctrl+Space'
    };
    result.key = keyMap[result.key] || result.key; // Use mapped key or original if not in map

    return result;
}

function eventMatchesKey(event, parsedKey, isMac) {
    const eventCtrl = isMac ? event.metaKey : event.ctrlKey;
    const eventKeyLower = event.key.toLowerCase();
    let targetKey = parsedKey.key.toLowerCase();

    // Map some event.key values to what we might have in parsedKey.key
    const eventKeyMap = {
        ' ': 'space',
        // Potentially more mappings if event.key provides variations
    };
    const mappedEventKey = eventKeyMap[eventKeyLower] || eventKeyLower;

    // If the parsed key is a single character (e.g. 'c', 'x', '/'), match directly
    // Otherwise, use the mappedEventKey which handles 'arrowdown', 'enter', etc.
    const keyToCompare = targetKey.length === 1 ? eventKeyLower : mappedEventKey;

    // For single key shortcuts like 'Home' (no modifiers in definition), ensure no modifiers are pressed
    if (!parsedKey.ctrl && !parsedKey.shift && !parsedKey.alt && !parsedKey.meta) {
        return keyToCompare === targetKey && !eventCtrl && !event.shiftKey && !event.altKey && !event.metaKey;
    }

    // For modifier shortcuts
    // Note: `parsedKey.meta` is true if "meta" was in the config string.
    // `event.metaKey` is true if Cmd (Mac) or Windows key was pressed.
    // `eventCtrl` handles Cmd/Ctrl equivalence based on `isMac`.
    return (eventCtrl === parsedKey.ctrl || (isMac && parsedKey.ctrl && event.metaKey) || (!isMac && parsedKey.meta && event.metaKey) ) &&
           event.shiftKey === parsedKey.shift &&
           event.altKey === parsedKey.alt && // Alt key must match exactly
           keyToCompare === targetKey;
}

// Default global settings
const DEFAULT_GLOBAL_SETTINGS = {
    extensionEnabled: true, // Overall enable/disable, not used in this iteration for site-specific
    disabledSites: [],
    showFeedback: true,
    feedbackDuration: 1500 // ms
};