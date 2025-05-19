// __tests__/content_script.test.js

// Setup global mocks BEFORE importing content_script.js
// These would normally be globally available from other content scripts
// In the JSDOM environment, 'window' is the global context.
window.handleCutLine = jest.fn();
window.handleCopyLine = jest.fn();
window.handlePaste = jest.fn();
window.handleDeleteLine = jest.fn();
window.handleInsertLineBelow = jest.fn();
window.handleInsertLineAbove = jest.fn();
window.handleMoveLine = jest.fn();
window.handleCopyLineUpDown = jest.fn();
window.handleUndo = jest.fn();
window.handleRedo = jest.fn();
window.handleSelectLine = jest.fn();
window.handleIndentSelection = jest.fn();
window.handleSmartHome = jest.fn();
window.handleToggleLineCommentAction = jest.fn();
window.handleToggleBlockCommentAction = jest.fn();
window.handleSelectWordOrNextOccurrenceAction = jest.fn();
window.handleTrimTrailingWhitespaceAction = jest.fn();
window.handleToUpperCase = jest.fn();
window.handleToLowerCase = jest.fn();
window.handleToTitleCase = jest.fn();

window.isEditable = jest.fn().mockReturnValue(true);
window.showFeedbackMessage = jest.fn();
window.getDisplayKey = jest.fn().mockImplementation(key => key);

// Mock chrome APIs and make it global for content_script.js
const jestChrome = require('jest-chrome');
window.chrome = jestChrome.chrome; // or global.chrome = jestChrome.chrome;

// Import constants from common.js to make them available globally for content_script logic
// This needs to happen before content_script is required if content_script uses them at the top level
const common = require('../common.js');
window.DEFAULT_SHORTCUT_SETTINGS_CONFIG = common.DEFAULT_SHORTCUT_SETTINGS_CONFIG;
window.DEFAULT_GLOBAL_SETTINGS = common.DEFAULT_GLOBAL_SETTINGS;


// Import functions and state accessors from content_script.js
// This import should happen AFTER global mocks and constants are set up
const {
    loadSettingsAndInitialize,
    getCurrentShortcutSettings,
    getCurrentGlobalSettings,
    getIsSiteDisabled,
    _setInternalState // Helper to reset state for tests
} = require('../content_script.js');


describe('content_script.js', () => {
    describe('loadSettingsAndInitialize', () => {
        let mockGet;
        let originalWindowLocation;

        beforeEach(() => {
            // Reset state before each test using the exported helper
            _setInternalState({
                currentShortcutSettings: {},
                currentGlobalSettings: { ...global.DEFAULT_GLOBAL_SETTINGS }, // Start with defaults
                isSiteDisabled: false
            });

            // Mock chrome.storage.sync.get
            mockGet = jest.fn();
            chrome.storage.sync.get.mockImplementation(mockGet);

            // Mock window.location.hostname
            originalWindowLocation = window.location;
            delete window.location; // Necessary to mock a read-only property
            window.location = { hostname: 'www.example.com' };
        });

        afterEach(() => {
            jest.clearAllMocks();
            window.location = originalWindowLocation; // Restore original window.location
        });

        it('should load default settings if nothing is in storage', () => {
            mockGet.mockImplementation((keys, callback) => {
                callback({}); // Empty storage
            });

            loadSettingsAndInitialize();

            const settings = getCurrentShortcutSettings();
            expect(Object.keys(settings).length).toEqual(Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).length);
            expect(settings['cutLine'].enabled).toEqual(DEFAULT_SHORTCUT_SETTINGS_CONFIG['cutLine'].defaultEnabled);
            expect(settings['cutLine'].key).toEqual(DEFAULT_SHORTCUT_SETTINGS_CONFIG['cutLine'].defaultKey);
            expect(settings['cutLine'].isCustom).toBe(false);

            const globalSettings = getCurrentGlobalSettings();
            expect(globalSettings.disabledSites).toEqual(DEFAULT_GLOBAL_SETTINGS.disabledSites);
            expect(globalSettings.showFeedback).toEqual(DEFAULT_GLOBAL_SETTINGS.showFeedback);

            expect(getIsSiteDisabled()).toBe(false);
        });

        it('should load stored shortcut settings and merge with defaults', () => {
            const storedSettings = {
                shortcutSettings: {
                    'cutLine': { key: 'Ctrl+Y', enabled: false, isCustom: true, isNowChord: false }, // New format
                    'copyLine': true, // Old format (enabled)
                    'deleteLine': false // Old format (disabled)
                    // 'paste' will use default
                },
                globalSettings: {
                    showFeedback: false,
                    disabledSites: ['www.test.com']
                }
            };
            mockGet.mockImplementation((keys, callback) => {
                callback(storedSettings);
            });

            loadSettingsAndInitialize();

            const settings = getCurrentShortcutSettings();
            // cutLine - Overridden
            expect(settings['cutLine'].enabled).toBe(false);
            expect(settings['cutLine'].key).toBe('Ctrl+Y');
            expect(settings['cutLine'].isCustom).toBe(true);

            // copyLine - Migrated from old format (true)
            expect(settings['copyLine'].enabled).toBe(true);
            expect(settings['copyLine'].key).toBe(DEFAULT_SHORTCUT_SETTINGS_CONFIG['copyLine'].defaultKey);
            expect(settings['copyLine'].isCustom).toBe(false);
            
            // deleteLine - Migrated from old format (false)
            expect(settings['deleteLine'].enabled).toBe(false);
            expect(settings['deleteLine'].key).toBe(DEFAULT_SHORTCUT_SETTINGS_CONFIG['deleteLine'].defaultKey);

            // paste - Should use default
            expect(settings['paste'].enabled).toBe(DEFAULT_SHORTCUT_SETTINGS_CONFIG['paste'].defaultEnabled);
            expect(settings['paste'].key).toBe(DEFAULT_SHORTCUT_SETTINGS_CONFIG['paste'].defaultKey);

            const global = getCurrentGlobalSettings();
            expect(global.showFeedback).toBe(false);
            expect(global.disabledSites).toEqual(['www.test.com']);
        });

        it('should correctly determine isSiteDisabled - exact match', () => {
            window.location.hostname = 'www.disabled.com';
            const storedSettings = {
                disabledSites: ['www.disabled.com', 'www.another.com']
            };
            mockGet.mockImplementation((keys, callback) => {
                callback(storedSettings);
            });

            loadSettingsAndInitialize();
            expect(getIsSiteDisabled()).toBe(true);
        });

        it('should correctly determine isSiteDisabled - subdomain wildcard match', () => {
            window.location.hostname = 'sub.disabled-wild.com';
            const storedSettings = {
                disabledSites: ['*.disabled-wild.com']
            };
            mockGet.mockImplementation((keys, callback) => {
                callback(storedSettings);
            });
            loadSettingsAndInitialize();
            expect(getIsSiteDisabled()).toBe(true);
        });
        
        it('should correctly determine isSiteDisabled - root domain wildcard match', () => {
            window.location.hostname = 'disabled-wild.com'; // Matches *.disabled-wild.com
             const storedSettings = {
                disabledSites: ['*.disabled-wild.com']
            };
            mockGet.mockImplementation((keys, callback) => {
                callback(storedSettings);
            });
            loadSettingsAndInitialize();
            expect(getIsSiteDisabled()).toBe(true);
        });

        it('should correctly determine isSiteDisabled - no match', () => {
            window.location.hostname = 'www.enabled.com';
            const storedSettings = {
                disabledSites: ['www.disabled.com', '*.another.org']
            };
            mockGet.mockImplementation((keys, callback) => {
                callback(storedSettings);
            });

            loadSettingsAndInitialize();
            expect(getIsSiteDisabled()).toBe(false);
        });
         it('should use default disabledSites if none are stored', () => {
            window.location.hostname = 'a.default.disabled.site.com'; // Example, if defaults change
            const defaultDisabled = [...DEFAULT_GLOBAL_SETTINGS.disabledSites]; // Make a copy
            DEFAULT_GLOBAL_SETTINGS.disabledSites.push('a.default.disabled.site.com'); // Temporarily modify

            mockGet.mockImplementation((keys, callback) => {
                callback({ globalSettings: {} }); // No disabledSites in globalSettings from storage
            });

            loadSettingsAndInitialize();
            expect(getIsSiteDisabled()).toBe(true);

            DEFAULT_GLOBAL_SETTINGS.disabledSites = defaultDisabled; // Restore
        });

        it('should handle empty disabledSites array from storage', () => {
            window.location.hostname = 'www.example.com';
            mockGet.mockImplementation((keys, callback) => {
                callback({ disabledSites: [] });
            });
            loadSettingsAndInitialize();
            expect(getIsSiteDisabled()).toBe(false);
        });
    });
});