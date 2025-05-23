// __tests__/unit/common.unit.test.js
const {
    parseKeyString,
    eventMatchesKey,
    getDisplayKeyForCommon,
    DEFAULT_SHORTCUT_SETTINGS_CONFIG, // If you need to test against it
    DEFAULT_GLOBAL_SETTINGS // If you need to test against it
} = require('../../src/common.js');

describe('common.js utility functions', () => {

    describe('parseKeyString', () => {
        it('should parse simple keys', () => {
            expect(parseKeyString('A')).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: 'a' });
            expect(parseKeyString('Enter')).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: 'enter' });
        });

        it('should parse keys with Ctrl modifier', () => {
            expect(parseKeyString('Ctrl+C')).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: 'c' });
        });

        it('should parse keys with Alt modifier', () => {
            expect(parseKeyString('Alt+F')).toEqual({ ctrl: false, shift: false, alt: true, meta: false, key: 'f' });
        });

        it('should parse keys with Shift modifier', () => {
            expect(parseKeyString('Shift+A')).toEqual({ ctrl: false, shift: true, alt: false, meta: false, key: 'a' });
        });

        it('should parse keys with Meta modifier', () => {
            expect(parseKeyString('Meta+S')).toEqual({ ctrl: false, shift: false, alt: false, meta: true, key: 's' });
        });

        it('should parse complex combinations', () => {
            expect(parseKeyString('Ctrl+Shift+Alt+P')).toEqual({ ctrl: true, shift: true, alt: true, meta: false, key: 'p' });
            expect(parseKeyString('Ctrl+Shift+Enter')).toEqual({ ctrl: true, shift: true, alt: false, meta: false, key: 'enter' });
        });

        it('should handle whitespace and capitalization consistently', () => {
            expect(parseKeyString(' ctrl + shift + k ')).toEqual({ ctrl: true, shift: true, alt: false, meta: false, key: 'k' });
            expect(parseKeyString('CONTROL+c')).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: 'c' });
        });

        it('should parse special keys like Space', () => {
            expect(parseKeyString('Space')).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: 'space' });
            expect(parseKeyString('Ctrl+Space')).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: 'space' });
            expect(parseKeyString(' ')).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: 'space' }); // Test actual space character
        });

        it('should parse bracket and slash keys', () => {
            expect(parseKeyString('Ctrl+]')).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: ']' });
            expect(parseKeyString('Ctrl+[')).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: '[' });
            expect(parseKeyString('Ctrl+/')).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: '/' });
        });

        it('should parse chorded keys (first part)', () => {
            // parseKeyString is designed to parse one "key combo" at a time.
            // Chord handling logic (splitting "Ctrl+K Ctrl+C") happens before calling parseKeyString for each part.
            expect(parseKeyString('Ctrl+K Ctrl+C')).toEqual({ ctrl: true, shift: false, alt: false, meta: false, key: 'k' });
        });

         it('should return empty/default for empty string', () => {
            expect(parseKeyString('')).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: '' });
        });
    });

    describe('eventMatchesKey', () => {
        // Mock event objects
        const createMockEvent = (key, ctrlKey = false, shiftKey = false, altKey = false, metaKey = false) => ({
            key,
            ctrlKey,
            shiftKey,
            altKey,
            metaKey,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        });

        it('should match simple keys', () => {
            const parsed = parseKeyString('A');
            expect(eventMatchesKey(createMockEvent('A'), parsed, false)).toBe(true);
            expect(eventMatchesKey(createMockEvent('a'), parsed, false)).toBe(true); // Case insensitivity for letter keys
            expect(eventMatchesKey(createMockEvent('B'), parsed, false)).toBe(false);
        });

        it('should match keys with Ctrl modifier (non-Mac)', () => {
            const parsed = parseKeyString('Ctrl+C');
            expect(eventMatchesKey(createMockEvent('C', true), parsed, false)).toBe(true);
            expect(eventMatchesKey(createMockEvent('c', true), parsed, false)).toBe(true);
            expect(eventMatchesKey(createMockEvent('C', false), parsed, false)).toBe(false); // Missing Ctrl
            expect(eventMatchesKey(createMockEvent('C', true, true), parsed, false)).toBe(false); // Extra Shift
        });

        it('should match keys with Meta as Ctrl modifier (Mac)', () => {
            const parsed = parseKeyString('Ctrl+C'); // Parsed as if 'Ctrl' means Cmd on Mac
            expect(eventMatchesKey(createMockEvent('C', false, false, false, true), parsed, true)).toBe(true); // MetaKey is Cmd
            expect(eventMatchesKey(createMockEvent('c', false, false, false, true), parsed, true)).toBe(true);
            expect(eventMatchesKey(createMockEvent('C', true, false, false, false), parsed, true)).toBe(false); // Actual Ctrl on Mac, not Cmd
            expect(eventMatchesKey(createMockEvent('C', false, false, false, false), parsed, true)).toBe(false); // Missing Meta/Cmd
        });
        
        it('should match keys specified with "Meta" as Meta (Windows key for non-Mac)', () => {
            const parsed = parseKeyString('Meta+S');
            expect(eventMatchesKey(createMockEvent('S', false, false, false, true), parsed, false)).toBe(true);
            expect(eventMatchesKey(createMockEvent('S', false, false, false, false), parsed, false)).toBe(false); // Missing Meta
        });


        it('should correctly match "Home" key without modifiers', () => {
            const parsed = parseKeyString('Home');
            expect(eventMatchesKey(createMockEvent('Home'), parsed, false)).toBe(true);
            expect(eventMatchesKey(createMockEvent('Home', true), parsed, false)).toBe(false); // Should not match with Ctrl
        });
        
        it('should correctly match "Ctrl+Home" key', () => {
            const parsed = parseKeyString('Ctrl+Home');
            expect(eventMatchesKey(createMockEvent('Home', true), parsed, false)).toBe(true); // Non-Mac
            expect(eventMatchesKey(createMockEvent('Home', false, false, false, true), parsed, true)).toBe(true); // Mac (Ctrl becomes Meta)
            expect(eventMatchesKey(createMockEvent('Home', false), parsed, false)).toBe(false); 
        });


        it('should match complex combinations', () => {
            const parsed = parseKeyString('Ctrl+Shift+ArrowUp');
            // Non-Mac
            expect(eventMatchesKey(createMockEvent('ArrowUp', true, true), parsed, false)).toBe(true);
            expect(eventMatchesKey(createMockEvent('ArrowUp', true, false), parsed, false)).toBe(false);
            // Mac
            expect(eventMatchesKey(createMockEvent('ArrowUp', false, true, false, true), parsed, true)).toBe(true);
            expect(eventMatchesKey(createMockEvent('ArrowUp', false, false, false, true), parsed, true)).toBe(false);
        });

        it('should not match if extra modifiers are pressed', () => {
            const parsed = parseKeyString('A');
            expect(eventMatchesKey(createMockEvent('A', true), parsed, false)).toBe(false); // A vs Ctrl+A
        });

        it('should match keys like Spacebar', () => {
            const parsed = parseKeyString('Space');
            expect(eventMatchesKey(createMockEvent(' '), parsed, false)).toBe(true); // Event.key for space is " "
            expect(eventMatchesKey(createMockEvent('Spacebar'), parsed, false)).toBe(false); // Playwright/some libraries might send 'Spacebar'
                                                                                            // but common.js normalizes to 'space'. Event ' ' maps to 'space'.
        });
        
        it('should match event.key " " for parsedKey.key "space"', () => {
            const parsed = { ctrl: false, shift: false, alt: false, meta: false, key: 'space' };
            const event = createMockEvent(' ');
            expect(eventMatchesKey(event, parsed, false)).toBe(true);
        });

        it('should match event.key "Escape" for parsedKey.key "escape"', () => {
            const parsed = { ctrl: false, shift: false, alt: false, meta: false, key: 'escape' };
            const event = createMockEvent('Escape');
            expect(eventMatchesKey(event, parsed, false)).toBe(true);
        });
    });

    describe('getDisplayKeyForCommon', () => {
        // Non-Mac Tests
        describe('Non-Mac Platform', () => {
            const isMac = false;
            it('should display Ctrl, Alt, Shift as is', () => {
                expect(getDisplayKeyForCommon('Ctrl+C', isMac)).toBe('Ctrl+C');
                expect(getDisplayKeyForCommon('Alt+ArrowDown', isMac)).toBe('Alt+Down');
                expect(getDisplayKeyForCommon('Shift+Alt+ArrowUp', isMac)).toBe('Shift+Alt+Up');
            });

            it('should display Meta as Win', () => {
                expect(getDisplayKeyForCommon('Meta+L', isMac)).toBe('Win+L');
            });

            it('should format Arrow keys', () => {
                expect(getDisplayKeyForCommon('ArrowUp', isMac)).toBe('Up');
                expect(getDisplayKeyForCommon('Ctrl+ArrowLeft', isMac)).toBe('Ctrl+Left');
            });
            it('should handle space correctly', () => {
                expect(getDisplayKeyForCommon('Ctrl+Space', isMac)).toBe('Ctrl+Space');
            });
        });

        // Mac Tests
        describe('Mac Platform', () => {
            const isMac = true;
            it('should display Ctrl as ⌘', () => {
                expect(getDisplayKeyForCommon('Ctrl+C', isMac)).toBe('⌘ C');
                expect(getDisplayKeyForCommon('Control+X', isMac)).toBe('⌘ X'); // Test "Control" spelling
            });

            it('should display Meta as ⌘', () => {
                expect(getDisplayKeyForCommon('Meta+S', isMac)).toBe('⌘ S');
            });
            
            it('should display Cmd as ⌘', () => {
                expect(getDisplayKeyForCommon('Cmd+V', isMac)).toBe('⌘ V');
            });

            it('should display Alt as ⌥', () => {
                expect(getDisplayKeyForCommon('Alt+ArrowDown', isMac)).toBe('⌥ ↓');
            });

            it('should display Shift as ⇧', () => {
                expect(getDisplayKeyForCommon('Shift+Enter', isMac)).toBe('⇧ ↵');
            });

            it('should display combined modifiers with spaces', () => {
                expect(getDisplayKeyForCommon('Ctrl+Shift+K', isMac)).toBe('⌘ ⇧ K');
                expect(getDisplayKeyForCommon('Shift+Alt+ArrowUp', isMac)).toBe('⇧ ⌥ ↑');
            });

            it('should format Arrow keys with symbols', () => {
                expect(getDisplayKeyForCommon('ArrowUp', isMac)).toBe('↑');
                expect(getDisplayKeyForCommon('ArrowDown', isMac)).toBe('↓');
                expect(getDisplayKeyForCommon('ArrowLeft', isMac)).toBe('←');
                expect(getDisplayKeyForCommon('ArrowRight', isMac)).toBe('→');
            });

            it('should format Enter as ↵', () => {
                expect(getDisplayKeyForCommon('Enter', isMac)).toBe('↵');
            });
            it('should handle space correctly', () => {
                expect(getDisplayKeyForCommon('Ctrl+Space', isMac)).toBe('⌘ Space'); // "+" removed, space added for readability
            });
        });
    });
});