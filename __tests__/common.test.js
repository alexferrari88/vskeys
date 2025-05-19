// __tests__/common.test.js

// Import the necessary members from common.js
const {
    DEFAULT_SHORTCUT_SETTINGS_CONFIG,
    DEFAULT_GLOBAL_SETTINGS,
    parseKeyString, // Will be used in later tests for DEFAULT_SHORTCUT_SETTINGS_CONFIG
    eventMatchesKey // Import this function
} = require('../common.js');

describe('common.js', () => {
    describe('DEFAULT_SHORTCUT_SETTINGS_CONFIG', () => {
        it('should be defined and be an object', () => {
            expect(DEFAULT_SHORTCUT_SETTINGS_CONFIG).toBeDefined();
            expect(typeof DEFAULT_SHORTCUT_SETTINGS_CONFIG).toBe('object');
            expect(DEFAULT_SHORTCUT_SETTINGS_CONFIG).not.toBeNull();
        });

        it('should contain core actions with correct properties', () => {
            const coreActions = ['cutLine', 'copyLine', 'paste', 'deleteLine'];
            coreActions.forEach(actionName => {
                expect(DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName]).toBeDefined();
                const actionConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
                expect(actionConfig).toHaveProperty('defaultKey');
                expect(typeof actionConfig.defaultKey).toBe('string');
                expect(actionConfig).toHaveProperty('description');
                expect(typeof actionConfig.description).toBe('string');
                expect(actionConfig).toHaveProperty('category');
                expect(typeof actionConfig.category).toBe('string');
                expect(actionConfig).toHaveProperty('defaultEnabled');
                expect(typeof actionConfig.defaultEnabled).toBe('boolean');
            });
        });

        it('should have valid chordPrefix and chordKey for chorded actions', () => {
            const chordedActions = ['addLineCommentChord', 'removeLineCommentChord', 'trimTrailingWhitespaceChord'];
            chordedActions.forEach(actionName => {
                expect(DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName]).toBeDefined();
                const actionConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
                expect(actionConfig).toHaveProperty('chordPrefix');
                expect(typeof actionConfig.chordPrefix).toBe('string');
                expect(actionConfig).toHaveProperty('chordKey');
                expect(typeof actionConfig.chordKey).toBe('string');
            });
        });

        it('all defaultKey strings should be parsable by parseKeyString', () => {
            for (const actionName in DEFAULT_SHORTCUT_SETTINGS_CONFIG) {
                const config = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
                // parseKeyString parses the first part of a space-separated key string
                const keyToParse = config.defaultKey.split(/\s+/)[0];
                expect(() => parseKeyString(keyToParse)).not.toThrow();
                const parsed = parseKeyString(keyToParse);
                expect(parsed).toHaveProperty('key'); // Basic check
            }
        });
    });

    describe('DEFAULT_GLOBAL_SETTINGS', () => {
        it('should be defined and be an object', () => {
            expect(DEFAULT_GLOBAL_SETTINGS).toBeDefined();
            expect(typeof DEFAULT_GLOBAL_SETTINGS).toBe('object');
            expect(DEFAULT_GLOBAL_SETTINGS).not.toBeNull();
        });

        it('should contain expected global settings keys with correct types', () => {
            expect(DEFAULT_GLOBAL_SETTINGS).toHaveProperty('extensionEnabled');
            expect(typeof DEFAULT_GLOBAL_SETTINGS.extensionEnabled).toBe('boolean');

            expect(DEFAULT_GLOBAL_SETTINGS).toHaveProperty('disabledSites');
            expect(Array.isArray(DEFAULT_GLOBAL_SETTINGS.disabledSites)).toBe(true);

            expect(DEFAULT_GLOBAL_SETTINGS).toHaveProperty('showFeedback');
            expect(typeof DEFAULT_GLOBAL_SETTINGS.showFeedback).toBe('boolean');

            expect(DEFAULT_GLOBAL_SETTINGS).toHaveProperty('feedbackDuration');
            expect(typeof DEFAULT_GLOBAL_SETTINGS.feedbackDuration).toBe('number');
        });
    });

    describe('parseKeyString(keyString)', () => {
        it('should parse simple keys', () => {
            expect(parseKeyString('A')).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: 'a' });
            expect(parseKeyString('Enter')).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: 'enter' });
            expect(parseKeyString('Space')).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: 'space' }); // Assuming ' ' maps to 'space'
            expect(parseKeyString('[')).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: '[' });
        });

        it('should parse keys with single modifiers', () => {
            expect(parseKeyString('Ctrl+C')).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: 'c' });
            expect(parseKeyString('Shift+Tab')).toEqual({ ctrl: false, shift: true, alt: false, meta: false, key: 'tab' });
            expect(parseKeyString('Alt+F4')).toEqual({ ctrl: false, shift: false, alt: true, meta: false, key: 'f4' });
            expect(parseKeyString('Meta+S')).toEqual({ ctrl: false, shift: false, alt: false, meta: true, key: 's' });
        });

        it('should parse keys with multiple modifiers', () => {
            expect(parseKeyString('Ctrl+Shift+Z')).toEqual({ ctrl: true, shift: true, alt: false, meta: false, key: 'z' });
            expect(parseKeyString('Shift+Alt+ArrowUp')).toEqual({ ctrl: false, shift: true, alt: true, meta: false, key: 'arrowup' });
            expect(parseKeyString('Ctrl+Shift+Alt+P')).toEqual({ ctrl: true, shift: true, alt: true, meta: false, key: 'p' });
        });

        it('should handle case insensitivity and whitespace for modifiers', () => {
            expect(parseKeyString('ctrl+c')).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: 'c' });
            expect(parseKeyString(' CTRL + c ')).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: 'c' });
            expect(parseKeyString('ShIfT+AlT+aRrOwUp')).toEqual({ ctrl: false, shift: true, alt: true, meta: false, key: 'arrowup' });
        });

        it('should parse the first part of a chorded key string like "Ctrl+K C"', () => {
            // parseKeyString is designed to take the first part before a space for chorded keys.
            expect(parseKeyString('Ctrl+K C')).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: 'k' });
            expect(parseKeyString('Ctrl+K Ctrl+C')).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: 'k' });
        });

        it('should handle key normalization from keyMap', () => {
            expect(parseKeyString('ArrowDown')).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: 'arrowdown' });
            expect(parseKeyString(' ')).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: 'space' }); // Direct space input
        });

        it('should return empty key for empty or modifier-only strings', () => {
            expect(parseKeyString('')).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: '' });
            expect(parseKeyString('Ctrl+')).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: '' });
            expect(parseKeyString('Shift+Alt')).toEqual({ ctrl: false, shift: true, alt: true, meta: false, key: '' });
        });
    });

    describe('eventMatchesKey(event, parsedKey, isMac)', () => {
        // Helper to create mock event objects
        const mockEvent = (key, { ctrlKey = false, shiftKey = false, altKey = false, metaKey = false, code = '' } = {}) => ({
            key: key,
            ctrlKey: ctrlKey,
            shiftKey: shiftKey,
            altKey: altKey,
            metaKey: metaKey,
            code: code || (key.length === 1 ? `Key${key.toUpperCase()}` : key) // Simplistic code generation
        });

        // Parsed keys for testing
        const pA = parseKeyString('A'); // { key: 'a', ... }
        const pCtrlC = parseKeyString('Ctrl+C'); // { key: 'c', ctrl: true, ... }
        const pShiftAltP = parseKeyString('Shift+Alt+P'); // { key: 'p', shift: true, alt: true, ... }
        const pAltU = parseKeyString('Alt+U'); // { key: 'u', alt: true, ... }
        const pBracket = parseKeyString('['); // {key: '[', ...}
        const pHome = parseKeyString('Home'); // {key: 'home', ...}


        // Non-Mac (isMac = false)
        describe('when isMac is false', () => {
            const isMac = false;

            it('should match simple key without modifiers', () => {
                expect(eventMatchesKey(mockEvent('a'), pA, isMac)).toBe(true);
                expect(eventMatchesKey(mockEvent('Home'), pHome, isMac)).toBe(true);
                expect(eventMatchesKey(mockEvent('['), pBracket, isMac)).toBe(true);
            });

            it('should not match simple key if modifiers are pressed in event', () => {
                expect(eventMatchesKey(mockEvent('a', { ctrlKey: true }), pA, isMac)).toBe(false);
                expect(eventMatchesKey(mockEvent('a', { shiftKey: true }), pA, isMac)).toBe(false);
            });
            
            it('should not match simple key if modifiers are expected but not pressed', () => {
                expect(eventMatchesKey(mockEvent('c'), pCtrlC, isMac)).toBe(false);
            });

            it('should match key with Ctrl modifier', () => {
                expect(eventMatchesKey(mockEvent('c', { ctrlKey: true }), pCtrlC, isMac)).toBe(true);
            });

            it('should not match if Ctrl is expected but not pressed', () => {
                expect(eventMatchesKey(mockEvent('c'), pCtrlC, isMac)).toBe(false);
            });

            it('should match key with multiple modifiers (Shift+Alt+P)', () => {
                expect(eventMatchesKey(mockEvent('p', { shiftKey: true, altKey: true }), pShiftAltP, isMac)).toBe(true);
            });

            it('should not match if some multi-modifiers are missing', () => {
                expect(eventMatchesKey(mockEvent('p', { shiftKey: true }), pShiftAltP, isMac)).toBe(false);
                expect(eventMatchesKey(mockEvent('p', { altKey: true }), pShiftAltP, isMac)).toBe(false);
            });

            it('should handle Alt key correctly (event.code matching for letters)', () => {
                // Simulate Alt+U -> 'ü' (event.key), but event.code is 'KeyU'
                const eventWithAltU = { key: 'ü', ctrlKey: false, shiftKey: false, altKey: true, metaKey: false, code: 'KeyU' };
                expect(eventMatchesKey(eventWithAltU, pAltU, isMac)).toBe(true);
            });

            it('should handle Alt key with non-letter (e.g. Alt+ArrowUp - uses event.key)', () => {
                 const pAltArrowUp = parseKeyString('Alt+ArrowUp');
                 expect(eventMatchesKey(mockEvent('ArrowUp', { altKey: true }), pAltArrowUp, isMac)).toBe(true);
            });

             it('should return false for key mismatch', () => {
                expect(eventMatchesKey(mockEvent('b'), pA, isMac)).toBe(false);
                expect(eventMatchesKey(mockEvent('d', { ctrlKey: true }), pCtrlC, isMac)).toBe(false);
            });
        });

        // Mac (isMac = true)
        describe('when isMac is true', () => {
            const isMac = true;
            const pMetaC = parseKeyString('Ctrl+C'); // On Mac, 'Ctrl' in string maps to 'meta' in event
                                                    // parseKeyString sets ctrl:true. eventMatchesKey adapts.

            it('should match key with Meta (Cmd) modifier when parsedKey.ctrl is true', () => {
                expect(eventMatchesKey(mockEvent('c', { metaKey: true }), pMetaC, isMac)).toBe(true);
            });

            it('should NOT match key with Ctrl modifier when parsedKey.ctrl is true (expects Meta)', () => {
                expect(eventMatchesKey(mockEvent('c', { ctrlKey: true }), pMetaC, isMac)).toBe(false);
            });
            
            it('should match simple key without modifiers', () => {
                expect(eventMatchesKey(mockEvent('a'), pA, isMac)).toBe(true);
            });

            it('should not match simple key if metaKey is pressed in event', () => {
                expect(eventMatchesKey(mockEvent('a', { metaKey: true }), pA, isMac)).toBe(false);
            });

            it('should handle Alt key correctly (event.code matching for letters)', () => {
                const eventWithAltU = { key: 'ü', ctrlKey: false, shiftKey: false, altKey: true, metaKey: false, code: 'KeyU' };
                expect(eventMatchesKey(eventWithAltU, pAltU, isMac)).toBe(true);
            });
        });
    });
});