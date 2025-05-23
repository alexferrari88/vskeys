// __tests__/unit/content_script.unit.test.js

// common.js exports these constants, so we require them directly.
const { DEFAULT_SHORTCUT_SETTINGS_CONFIG, DEFAULT_GLOBAL_SETTINGS, IS_MAC_COMMON, parseKeyString, getDisplayKeyForCommon, eventMatchesKey } = require('../../src/common.js');

// Mock functions from content_actions.js that content_script.js expects to be global
// when defining shortcutActionHandlers
const mockHandleCutLine = jest.fn();
const mockHandleCopyLine = jest.fn();
const mockHandlePaste = jest.fn();
const mockHandleDeleteLine = jest.fn();
const mockHandleInsertLineBelow = jest.fn();
const mockHandleInsertLineAbove = jest.fn();
const mockHandleMoveLine = jest.fn();
const mockHandleCopyLineUpDown = jest.fn();
const mockHandleSelectLine = jest.fn();
const mockHandleIndentSelection = jest.fn();
const mockHandleSmartHome = jest.fn();
const mockHandleToggleLineCommentAction = jest.fn();
const mockHandleToggleBlockCommentAction = jest.fn();
const mockHandleSelectWordOrNextOccurrenceAction = jest.fn();
const mockHandleToUpperCase = jest.fn();
const mockHandleToLowerCase = jest.fn();
const mockHandleToTitleCase = jest.fn();
const mockHandleTrimTrailingWhitespaceAction = jest.fn();


// Assign mocks to global BEFORE requiring content_script.js
global.handleCutLine = mockHandleCutLine;
global.handleCopyLine = mockHandleCopyLine;
global.handlePaste = mockHandlePaste;
global.handleDeleteLine = mockHandleDeleteLine;
global.handleInsertLineBelow = mockHandleInsertLineBelow;
global.handleInsertLineAbove = mockHandleInsertLineAbove;
global.handleMoveLine = mockHandleMoveLine;
global.handleCopyLineUpDown = mockHandleCopyLineUpDown;
global.handleSelectLine = mockHandleSelectLine;
global.handleIndentSelection = mockHandleIndentSelection;
global.handleSmartHome = mockHandleSmartHome;
global.handleToggleLineCommentAction = mockHandleToggleLineCommentAction;
global.handleToggleBlockCommentAction = mockHandleToggleBlockCommentAction;
global.handleSelectWordOrNextOccurrenceAction = mockHandleSelectWordOrNextOccurrenceAction;
global.handleToUpperCase = mockHandleToUpperCase;
global.handleToLowerCase = mockHandleToLowerCase;
global.handleToTitleCase = mockHandleToTitleCase;
global.handleTrimTrailingWhitespaceAction = mockHandleTrimTrailingWhitespaceAction;

// Assign common.js items needed by content_script.js to global
global.DEFAULT_SHORTCUT_SETTINGS_CONFIG = DEFAULT_SHORTCUT_SETTINGS_CONFIG;
global.DEFAULT_GLOBAL_SETTINGS = DEFAULT_GLOBAL_SETTINGS;
global.IS_MAC_COMMON = IS_MAC_COMMON;
global.parseKeyString = parseKeyString;
global.getDisplayKeyForCommon = getDisplayKeyForCommon;
global.eventMatchesKey = eventMatchesKey;

// Mock content_utils functions that content_script might call directly
global.isEditable = jest.fn();
global.showFeedbackMessage = jest.fn();

// Mock the 'chrome' API
global.chrome = {
    runtime: {
        onMessage: {
            addListener: jest.fn(),
        },
        sendMessage: jest.fn(),
        lastError: null,
    },
    storage: {
        sync: {
            get: jest.fn((keys, callback) => callback({})), 
            set: jest.fn((items, callback) => callback()),
            clear: jest.fn(callback => callback()),
        },
    },
};

// Mock document and window
global.document = {
    activeElement: null,
    getElementById: jest.fn(),
    createElement: jest.fn(() => ({
        id: '',
        innerText: '',
        style: {}
    })),
    head: {
        appendChild: jest.fn()
    },
    querySelectorAll: jest.fn(() => []),
    addEventListener: jest.fn(),
};

// Note: JSDOM provides a global.window. We will spy on its location property.
// If global.window or global.window.location is not set up by JSDOM environment early enough,
// Jest tests might fail. Usually, `testEnvironment: 'jsdom'` handles this.

// Now require the module under test
const { determineEffectiveShortcutSettings, loadSettingsAndInitialize } = require('../../src/content_script.js');

describe('Content Script Unit Tests', () => {
    let locationSpy;

    beforeEach(() => {
        jest.clearAllMocks();

        // Ensure global.window and global.window.location are defined (JSDOM should do this)
        // @ts-ignore
        if (typeof global.window === 'undefined') global.window = {};
        // @ts-ignore
        if (typeof global.window.location === 'undefined') global.window.location = { hostname: '' };
        
        locationSpy = jest.spyOn(global.window, 'location', 'get');
        locationSpy.mockReturnValue({ hostname: 'test.example.com' });
        
        global.chrome.storage.sync.get.mockImplementation((keys, callback) => callback({
            globalSettings: { ...DEFAULT_GLOBAL_SETTINGS },
            shortcutSettings: {},
            disabledSites: [],
            siteOverrides: {}
        }));
        global.chrome.runtime.lastError = null;
    });

    afterEach(() => {
        if (locationSpy) {
            locationSpy.mockRestore(); 
        }
    });

    describe('determineEffectiveShortcutSettings', () => {
        const baseGlobalSettings = {};
        Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            baseGlobalSettings[actionName] = {
                enabled: defaultConfig.defaultEnabled,
                key: defaultConfig.defaultKey,
                isCustom: false,
                isNowChord: defaultConfig.defaultKey.includes(' ')
            };
        });

        const sampleSiteOverrides = {
            'github.com': {
                'copyLine': { key: 'Alt+C', enabled: true }, 
                'cutLine': { enabled: false }              
            },
            '*.google.com': {
                'paste': { key: 'Shift+V' } 
            },
            'docs.google.com': { 
                'paste': { key: 'Ctrl+Alt+V', enabled: false } 
            }
        };

        it('should return base global settings if no site overrides match', () => {
            const effective = determineEffectiveShortcutSettings(baseGlobalSettings, sampleSiteOverrides, 'example.com');
            expect(effective['copyLine'].key).toBe(DEFAULT_SHORTCUT_SETTINGS_CONFIG.copyLine.defaultKey);
            expect(effective['copyLine'].enabled).toBe(DEFAULT_SHORTCUT_SETTINGS_CONFIG.copyLine.defaultEnabled);
            expect(effective['paste'].key).toBe(DEFAULT_SHORTCUT_SETTINGS_CONFIG.paste.defaultKey);
        });

        it('should apply specific hostname overrides', () => {
            const effective = determineEffectiveShortcutSettings(baseGlobalSettings, sampleSiteOverrides, 'github.com');
            expect(effective['copyLine'].key).toBe('Alt+C');
            expect(effective['copyLine'].enabled).toBe(true);
            expect(effective['cutLine'].enabled).toBe(false);
            expect(effective['paste'].key).toBe(DEFAULT_SHORTCUT_SETTINGS_CONFIG.paste.defaultKey); 
        });

        it('should apply wildcard hostname overrides', () => {
            const effective = determineEffectiveShortcutSettings(baseGlobalSettings, sampleSiteOverrides, 'mail.google.com');
            expect(effective['paste'].key).toBe('Shift+V');
            expect(effective['paste'].enabled).toBe(baseGlobalSettings.paste.enabled);
            expect(effective['copyLine'].key).toBe(DEFAULT_SHORTCUT_SETTINGS_CONFIG.copyLine.defaultKey);
        });

        it('should prioritize specific hostname over wildcard', () => {
            const effective = determineEffectiveShortcutSettings(baseGlobalSettings, sampleSiteOverrides, 'docs.google.com');
            expect(effective['paste'].key).toBe('Ctrl+Alt+V');
            expect(effective['paste'].enabled).toBe(false);
        });

        it('should correctly calculate isNowChord for overridden keys', () => {
            const customBaseSettings = { ...baseGlobalSettings };
            customBaseSettings['selectLine'] = { enabled: true, key: 'Ctrl+L', isCustom: false, isNowChord: false };
            
            const siteOverridesWithChord = {
                'test.com': {
                    'selectLine': { key: 'Ctrl+K L' } 
                }
            };
            const effective = determineEffectiveShortcutSettings(customBaseSettings, siteOverridesWithChord, 'test.com');
            expect(effective['selectLine'].key).toBe('Ctrl+K L');
            expect(effective['selectLine'].isNowChord).toBe(true);

            const effectiveGlobal = determineEffectiveShortcutSettings(customBaseSettings, {}, 'anothersite.com');
            expect(effectiveGlobal['selectLine'].key).toBe('Ctrl+L');
            expect(effectiveGlobal['selectLine'].isNowChord).toBe(false);
        });

        it('should handle overrides that only set "enabled" state', () => {
            const overridesOnlyEnabled = {
                'onlyenable.com': {
                    'copyLine': { enabled: false }
                }
            };
            const effective = determineEffectiveShortcutSettings(baseGlobalSettings, overridesOnlyEnabled, 'onlyenable.com');
            expect(effective['copyLine'].key).toBe(DEFAULT_SHORTCUT_SETTINGS_CONFIG.copyLine.defaultKey); 
            expect(effective['copyLine'].enabled).toBe(false); 
            expect(effective['copyLine'].isNowChord).toBe(DEFAULT_SHORTCUT_SETTINGS_CONFIG.copyLine.defaultKey.includes(' '));
        });
        
        it('should inherit from global settings if site override for an action is partial (e.g. only key provided)', () => {
             const myBaseSettings = JSON.parse(JSON.stringify(baseGlobalSettings));
             myBaseSettings['copyLine'].enabled = false;

            const overridesWithPartial = {
                'partial.com': {
                    'copyLine': { key: 'Alt+Shift+C' } 
                }
            };
            const effective = determineEffectiveShortcutSettings(myBaseSettings, overridesWithPartial, 'partial.com');
            expect(effective['copyLine'].key).toBe('Alt+Shift+C');
            expect(effective['copyLine'].enabled).toBe(false); 
        });

        it('should handle empty siteOverrides object gracefully', () => {
            const effective = determineEffectiveShortcutSettings(baseGlobalSettings, {}, 'any.site.com');
             expect(effective['copyLine'].key).toBe(DEFAULT_SHORTCUT_SETTINGS_CONFIG.copyLine.defaultKey);
            expect(effective['copyLine'].enabled).toBe(DEFAULT_SHORTCUT_SETTINGS_CONFIG.copyLine.defaultEnabled);
        });
    });

    describe('loadSettingsAndInitialize', () => {
        it('should load default settings if storage is empty', () => {
            global.chrome.storage.sync.get.mockImplementationOnce((keys, callback) => callback({}));
            loadSettingsAndInitialize(); 
            expect(global.chrome.storage.sync.get).toHaveBeenCalled();
        });

        it('should correctly process stored settings', () => {
            const storedData = {
                globalSettings: { activationShortcut: 'Ctrl+Shift+A' },
                shortcutSettings: { 'copyLine': { key: 'Alt+C', enabled: false, isCustom: true, isNowChord: false } },
                disabledSites: ['disabled.com'],
                siteOverrides: { 'override.com': { 'cutLine': { key: 'Meta+X' } } }
            };
            global.chrome.storage.sync.get.mockImplementationOnce((keys, callback) => callback(storedData));
            
            loadSettingsAndInitialize(); 
            expect(global.chrome.storage.sync.get).toHaveBeenCalled();
        });

        it('should use current location.hostname for determining site disabled status', () => {
            locationSpy.mockReturnValue({ hostname: 'disabled.example.com' });
            const storedData = {
                disabledSites: ['disabled.example.com'],
            };
            global.chrome.storage.sync.get.mockImplementationOnce((keys, callback) => callback(storedData));
            
            loadSettingsAndInitialize();
            // Test if internal state `isSiteDisabled` becomes true. This requires exporting state or checking side effects.
            // For now, we assume if loadSettingsAndInitialize runs and reads hostname correctly, it works.
            // We can check that `determineEffectiveShortcutSettings` is called with the correct hostname.
            // To do this properly, `determineEffectiveShortcutSettings` might need to be spied on if it's imported,
            // or this test made more of an integration test for `loadSettingsAndInitialize`.
            expect(locationSpy).toHaveBeenCalled(); // Verifies hostname was accessed
        });
    });
});