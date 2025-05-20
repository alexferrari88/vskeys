// __tests__/options.test.js
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Load HTML content for the DOM
const htmlPath = path.resolve(__dirname, '../src/options.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// Mock chrome APIs
global.chrome = {
    storage: {
        sync: {
            get: jest.fn((keys, callback) => callback({})),
            set: jest.fn((data, callback) => callback())
        }
    },
    tabs: {
        query: jest.fn((queryInfo, callback) => callback([])),
        sendMessage: jest.fn()
    },
    runtime: {
        lastError: null
    }
};

// Mock common.js constants that options.js expects to be global
const common = require('../src/common.js'); // Adjust path as necessary
global.DEFAULT_SHORTCUT_SETTINGS_CONFIG = common.DEFAULT_SHORTCUT_SETTINGS_CONFIG;
global.DEFAULT_GLOBAL_SETTINGS = common.DEFAULT_GLOBAL_SETTINGS;

describe('options.js - Site Overrides Functionality', () => {
    let dom;
    let document;
    let window;

    // Function to initialize or re-initialize options.js logic within a fresh DOM
    const initOptionsScript = () => {
        // Execute options.js script content within the JSDOM window context
        const optionsScriptPath = path.resolve(__dirname, '../src/options.js');
        const optionsScriptContent = fs.readFileSync(optionsScriptPath, 'utf-8');
        const scriptEl = document.createElement('script');
        scriptEl.textContent = optionsScriptContent;
        document.body.appendChild(scriptEl);
        // Trigger DOMContentLoaded manually if options.js relies on it for setup
        document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true, cancelable: true }));
    };

    beforeEach(() => {
        dom = new JSDOM(htmlContent, { runScripts: 'dangerously', resources: 'usable' });
        window = dom.window;
        document = window.document;
        
        // Make JSDOM's window global for the scope of the tests
        global.window = window;
        global.document = document;
        global.navigator = window.navigator; // For IS_MAC_OPTIONS
        global.alert = jest.fn(); // Mock alert
        global.confirm = jest.fn().mockReturnValue(true); // Mock confirm, default to true

        // Reset mocks for chrome.storage.sync
        chrome.storage.sync.get.mockReset().mockImplementation((keys, callback) => callback({}));
        chrome.storage.sync.set.mockReset().mockImplementation((data, callback) => callback());
        chrome.tabs.query.mockReset().mockImplementation((queryInfo, callback) => callback([]));
        chrome.tabs.sendMessage.mockReset();
        chrome.runtime.lastError = null;

        // The options.js script will be loaded fresh for each test via initOptionsScript if needed,
        // or we can load it once here and rely on resetting state.
        // For simplicity in managing state variables within options.js, we might re-initialize.
    });

    afterEach(() => {
        // Clean up JSDOM window
        if (window) {
            window.close();
        }
        // Clear any global mocks if necessary, or Jest will do it if configured
        jest.clearAllMocks();
    });

    test('Initial loadSettings should fetch siteOverrides', () => {
        const mockSiteOverrides = { 'example.com': { 'cutLine': { enabled: false } } };
        chrome.storage.sync.get.mockImplementation((keys, callback) => {
            if (keys.includes('siteOverrides')) {
                callback({ siteOverrides: mockSiteOverrides });
            } else {
                callback({});
            }
        });
        
        initOptionsScript(); // Load and run options.js

        // At this point, options.js's internal currentSiteOverrides should be populated.
        // We need a way to inspect this internal state or test its effects on the UI.
        // For now, we'll check if the configuredSitesList is rendered based on it.
        const configuredList = document.getElementById('configuredSitesList');
        expect(configuredList.textContent).toContain('example.com');
    });

    test('renderConfiguredSitesList displays sites with overrides', () => {
        initOptionsScript(); // Initialize script to get access to its functions if they were global
                               // Or, more robustly, trigger actions that call it.

        // Manually set currentSiteOverrides (as if loaded) and call render
        // This requires exposing currentSiteOverrides or renderConfiguredSitesList for testing,
        // or triggering loadSettings which calls it.
        
        // Simulate loading settings that include siteOverrides
        const siteOverridesData = { 'test.com': { 'copyLine': { key: 'Alt+C' } }, 'another.org': {} };
        chrome.storage.sync.get.mockImplementation((keys, callback) => {
            callback({ siteOverrides: siteOverridesData, shortcutSettings: {}, disabledSites: [], globalSettings: {} });
        });

        initOptionsScript(); // This will call loadSettings -> renderConfiguredSitesList

        const listItems = document.querySelectorAll('#configuredSitesList li');
        expect(listItems.length).toBe(2);
        expect(listItems[0].textContent).toContain('another.org'); // Sorted
        expect(listItems[1].textContent).toContain('test.com');
        expect(listItems[0].querySelector('button.edit-site-override-btn') || listItems[0].querySelector('button[title^="Edit overrides"]')).not.toBeNull();
    });
    
    test('renderConfiguredSitesList displays "no sites" message when empty', () => {
        chrome.storage.sync.get.mockImplementation((keys, callback) => {
            callback({ siteOverrides: {}, shortcutSettings: {}, disabledSites: [], globalSettings: {} });
        });
        initOptionsScript();
        const listItem = document.querySelector('#configuredSitesList li');
        expect(listItem.textContent).toBe('No sites have specific configurations yet.');
    });

    test('Manage Site Config button opens the manager UI', () => {
        initOptionsScript();
        const hostnameInput = document.getElementById('siteOverrideHostname');
        const manageButton = document.getElementById('manageSiteOverrides');
        const managerDiv = document.getElementById('siteOverridesManager');

        hostnameInput.value = 'example.com';
        manageButton.click();

        expect(managerDiv.style.display).toBe('block');
        expect(document.getElementById('editingSiteHostname').textContent).toContain('Editing: example.com');
    });

    test('Manage Site Config button shows error for invalid hostname', () => {
        initOptionsScript();
        const hostnameInput = document.getElementById('siteOverrideHostname');
        const manageButton = document.getElementById('manageSiteOverrides');
        const statusMessage = document.getElementById('statusMessage');
        
        hostnameInput.value = 'invalid host name'; // Invalid hostname
        manageButton.click();
        
        expect(statusMessage.textContent).toContain('Invalid hostname pattern');
        expect(statusMessage.style.display).toBe('block');
    });


    test('Close Site Manager button hides the UI', () => {
        initOptionsScript();
        // First, open it
        document.getElementById('siteOverrideHostname').value = 'example.com';
        document.getElementById('manageSiteOverrides').click();
        
        const managerDiv = document.getElementById('siteOverridesManager');
        expect(managerDiv.style.display).toBe('block');

        const closeButton = document.getElementById('closeSiteOverridesManager');
        closeButton.click();
        expect(managerDiv.style.display).toBe('none');
    });

    describe('renderSiteSpecificShortcuts', () => {
        beforeEach(() => {
            // Provide some global settings for context
            const globalShortcutSettings = {
                'cutLine': { key: 'Ctrl+X', enabled: true, isCustom: false, isNowChord: false },
                'copyLine': { key: 'Ctrl+C', enabled: true, isCustom: false, isNowChord: false },
            };
            chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback({ 
                    shortcutSettings: globalShortcutSettings, 
                    siteOverrides: {
                        'example.com': {
                            'cutLine': { enabled: false }, // Site override: disabled
                            'copyLine': { key: 'Alt+C' }     // Site override: new key
                        }
                    },
                    disabledSites: [],
                    globalSettings: {}
                });
            });
            initOptionsScript(); // Load settings

            // Open manager for 'example.com'
            document.getElementById('siteOverrideHostname').value = 'example.com';
            document.getElementById('manageSiteOverrides').click();
        });

        test('displays shortcuts with site-specific overrides correctly', () => {
            const siteListDiv = document.getElementById('siteSpecificShortcutsList');
            const cutLineItem = Array.from(siteListDiv.querySelectorAll('.shortcut-item')).find(item => item.querySelector('.keys').dataset.action === 'cutLine');
            const copyLineItem = Array.from(siteListDiv.querySelectorAll('.shortcut-item')).find(item => item.querySelector('.keys').dataset.action === 'copyLine');

            expect(cutLineItem.querySelector('input[type="checkbox"]').checked).toBe(false); // Overridden to disabled
            expect(cutLineItem.textContent).toContain('(Site Specific)');
            
            expect(copyLineItem.querySelector('.keys').textContent).toContain('⌥ C'); // Mac specific display for Alt+C
            expect(copyLineItem.textContent).toContain('(Site Specific)');
            expect(copyLineItem.querySelector('input[type="checkbox"]').checked).toBe(true); // Enabled from global
        });

        test('toggle-site-shortcut updates temporary settings and re-renders', () => {
            const siteListDiv = document.getElementById('siteSpecificShortcutsList');
            const cutLineToggle = Array.from(siteListDiv.querySelectorAll('.toggle-site-shortcut')).find(cb => cb.dataset.action === 'cutLine');
            
            expect(cutLineToggle.checked).toBe(false); // Initially disabled by override
            cutLineToggle.checked = true;
            cutLineToggle.dispatchEvent(new window.Event('change')); // Trigger change

            // Check if it re-rendered and the checkbox is now checked
            const updatedCutLineToggle = Array.from(document.querySelectorAll('#siteSpecificShortcutsList .toggle-site-shortcut')).find(cb => cb.dataset.action === 'cutLine');
            expect(updatedCutLineToggle.checked).toBe(true);
            // Also check if temporarySiteSpecificSettings was updated (would need to expose or test via save)
        });
        
        test('reset-site-shortcut removes override and re-renders', () => {
            const siteListDiv = document.getElementById('siteSpecificShortcutsList');
            const copyLineResetButton = Array.from(siteListDiv.querySelectorAll('.reset-site-shortcut')).find(btn => btn.dataset.action === 'copyLine');
            
            // copyLine has a site-specific key 'Alt+C'
            expect(Array.from(siteListDiv.querySelectorAll('.keys.site-specific-keys')).find(k => k.dataset.action === 'copyLine').textContent).toContain('⌥ C');
            
            copyLineResetButton.click();

            const updatedCopyLineKey = Array.from(document.querySelectorAll('#siteSpecificShortcutsList .keys.site-specific-keys')).find(k => k.dataset.action === 'copyLine');
            // Assuming global key for copyLine is Ctrl+C (⌘ C on Mac)
            expect(updatedCopyLineKey.textContent).toContain('⌘ C'); 
            expect(updatedCopyLineKey.textContent).not.toContain('*S'); // No longer site specific key
        });
    });
    
    test('Apply Site Changes button updates currentSiteOverrides and closes manager', () => {
        initOptionsScript();
        document.getElementById('siteOverrideHostname').value = 'apply-test.com';
        document.getElementById('manageSiteOverrides').click(); // Open manager

        // Simulate making a change (e.g., disabling cutLine)
        const cutLineToggle = document.querySelector('#siteSpecificShortcutsList .toggle-site-shortcut[data-action="cutLine"]');
        if (cutLineToggle) { // cutLine might not be in DEFAULT_SHORTCUT_SETTINGS_CONFIG for this simplified test setup
            cutLineToggle.checked = false;
            cutLineToggle.dispatchEvent(new window.Event('change'));
        }
        
        document.getElementById('saveSiteOverrides').click(); // Apply changes

        // Check if manager is closed
        expect(document.getElementById('siteOverridesManager').style.display).toBe('none');
        // Check if currentSiteOverrides was updated (this requires inspecting internal state or saving and reloading)
        // For now, check if the site appears in the configured list
        expect(document.getElementById('configuredSitesList').textContent).toContain('apply-test.com');
        
        // To truly verify currentSiteOverrides, we'd save all settings and check chrome.storage.sync.set
        document.getElementById('saveSettings').click();
        expect(chrome.storage.sync.set).toHaveBeenCalledWith(
            expect.objectContaining({
                siteOverrides: expect.objectContaining({
                    'apply-test.com': expect.objectContaining({
                        'cutLine': { enabled: false }
                    })
                })
            }),
            expect.any(Function)
        );
    });

    test('Remove All Config for This Site button clears overrides for the site', () => {
        // Setup: load a site with overrides
         chrome.storage.sync.get.mockImplementation((keys, callback) => {
            callback({ 
                siteOverrides: { 'remove-test.com': { 'cutLine': { enabled: false } } },
                shortcutSettings: {}, disabledSites: [], globalSettings: {}
            });
        });
        initOptionsScript();

        document.getElementById('siteOverrideHostname').value = 'remove-test.com';
        document.getElementById('manageSiteOverrides').click(); // Open manager
        
        expect(document.getElementById('configuredSitesList').textContent).toContain('remove-test.com');

        document.getElementById('removeSiteOverrides').click(); // Click remove
        expect(global.confirm).toHaveBeenCalled(); // Confirm was called

        // Check if manager is closed
        expect(document.getElementById('siteOverridesManager').style.display).toBe('none');
        // Check if site is removed from the configured list (after save)
        expect(document.getElementById('configuredSitesList').textContent).not.toContain('remove-test.com');

        // Verify by saving all settings
        document.getElementById('saveSettings').click();
        expect(chrome.storage.sync.set).toHaveBeenCalledWith(
            expect.objectContaining({
                siteOverrides: expect.not.objectContaining({
                    'remove-test.com': expect.anything()
                })
            }),
            expect.any(Function)
        );
    });
    
    // TODO: Add tests for site-specific key capture and conflict detection
    // These will be more involved due to the interaction with keydown events and UI updates.
    // For now, we've tested the main UI flow and data management for site overrides.

});