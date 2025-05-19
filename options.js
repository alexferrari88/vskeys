// options.js
document.addEventListener('DOMContentLoaded', () => {
    const shortcutsListContainer = document.getElementById('shortcutsList');
    const saveButton = document.getElementById('saveSettings');
    const statusMessage = document.getElementById('statusMessage');
    const globalResetButtonContainer = document.createElement('div'); // Placeholder for global reset
    const newDisabledSiteInput = document.getElementById('newDisabledSite');
    const addDisabledSiteButton = document.getElementById('addDisabledSite');
    const disabledSitesUl = document.getElementById('disabledSitesList');

    const showFeedbackCheckbox = document.getElementById('showFeedbackEnabled');
    const feedbackDurationInput = document.getElementById('feedbackDuration');

    let currentSettings = {}; // Stores { actionName: { enabled, key, isCustom } }
    let currentDisabledSites = [];
    const IS_MAC_OPTIONS = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    // --- Helper Functions ---
    function displayStatus(message, success = true) {
        statusMessage.textContent = message;
        statusMessage.style.backgroundColor = success ? '#d4edda' : '#f8d7da';
        statusMessage.style.color = success ? '#155724' : '#721c24';
        statusMessage.style.borderColor = success ? '#c3e6cb' : '#f5c6cb';
        statusMessage.style.display = 'block';
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }

    function getDisplayKey(keyString) {
        if (IS_MAC_OPTIONS) {
            return keyString
                .replace(/\bCtrl\b/g, '⌘') // Cmd
                .replace(/\bAlt\b/g, '⌥')  // Opt
                .replace(/\bShift\b/g, '⇧') // Shift
                .replace(/\bEnter\b/g, '↵')
                .replace(/\bArrowUp\b/g, '↑')
                .replace(/\bArrowDown\b/g, '↓')
                .replace(/\bArrowLeft\b/g, '←')
                .replace(/\bArrowRight\b/g, '→')
                .replace(/\+/g, ' '); // Replace + with space for better visual separation on Mac
        }
        // For Windows/Linux, keep + separator, could add icons too if desired
        return keyString.replace(/\bArrowUp\b/g, 'Up')
                        .replace(/\bArrowDown\b/g, 'Down')
                        .replace(/\bArrowLeft\b/g, 'Left')
                        .replace(/\bArrowRight\b/g, 'Right');
    }


    function renderShortcuts() {
        shortcutsListContainer.innerHTML = ''; // Clear existing
        const categories = {};

        // Group shortcuts by category using DEFAULT_SHORTCUT_SETTINGS_CONFIG for structure
        Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            if (!categories[defaultConfig.category]) {
                categories[defaultConfig.category] = [];
            }
            // Push an object containing the actionName and its full default configuration
            categories[defaultConfig.category].push({
                actionName,
                description: defaultConfig.description,
                category: defaultConfig.category,
                defaultKey: defaultConfig.defaultKey // Keep defaultKey for reference
            });
        });

        for (const categoryName in categories) {
            const categoryTitle = document.createElement('h3');
            categoryTitle.textContent = categoryName;
            categoryTitle.className = 'category-title';
            shortcutsListContainer.appendChild(categoryTitle);

            categories[categoryName].sort((a, b) => a.description.localeCompare(b.description)).forEach(shortcut => {
                const item = document.createElement('div');
                item.className = 'shortcut-item';

                // currentSettings[shortcut.actionName] now holds { enabled, key, isCustom }
                const setting = currentSettings[shortcut.actionName];
                const keyToDisplay = setting && setting.key ? setting.key : shortcut.defaultKey;
                const isEnabled = setting && setting.enabled !== undefined ? setting.enabled : DEFAULT_SHORTCUT_SETTINGS_CONFIG[shortcut.actionName].defaultEnabled;
                const isCustom = setting && setting.isCustom;

                const keyDisplay = getDisplayKey(keyToDisplay);
                const customIndicator = isCustom ? ' <span class="custom-indicator" title="Customized shortcut">*</span>' : '';
                
                item.innerHTML = `
                    <div style="display: flex; align-items: center; flex-grow: 1;">
                        <kbd class="keys">${keyDisplay}${customIndicator}</kbd>
                        <span style="margin-left: 10px;">${shortcut.description}</span>
                    </div>
                    <div class="actions">
                        <button class="edit-shortcut" data-action="${shortcut.actionName}" title="Edit shortcut key">Edit</button>
                        <button class="reset-shortcut" data-action="${shortcut.actionName}" title="Reset to default" ${!isCustom ? 'style="display:none;"' : ''}>Reset</button>
                    </div>
                    <input type="checkbox" id="toggle_${shortcut.actionName}" title="Enable/Disable ${shortcut.description}" data-action="${shortcut.actionName}" ${isEnabled ? 'checked' : ''}>
                `;
                shortcutsListContainer.appendChild(item);
            });
        }

        // Add Global Reset Button if not already there
        if (!document.getElementById('resetAllShortcuts')) {
            const resetButton = document.createElement('button');
            resetButton.id = 'resetAllShortcuts';
            resetButton.textContent = 'Reset All Shortcuts to Defaults';
            resetButton.style.marginTop = '20px';
            resetButton.style.marginRight = '5px';
            
            // Insert before the save button or at the end of the shortcut list container
            const saveSettingsButton = document.getElementById('saveSettings');
            if (saveSettingsButton) {
                saveSettingsButton.parentNode.insertBefore(resetButton, saveSettingsButton);
            } else {
                shortcutsListContainer.parentNode.appendChild(resetButton);
            }
            // Event listener for global reset will be added now
            resetButton.addEventListener('click', resetAllShortcutsToDefault);
        }
        // Add event listeners for individual reset buttons
        document.querySelectorAll('.reset-shortcut').forEach(button => {
            button.addEventListener('click', (event) => {
                const actionName = event.target.dataset.action;
                resetShortcutToDefault(actionName);
            });
        });
        // Add event listeners for edit buttons
        document.querySelectorAll('.edit-shortcut').forEach(button => {
            button.addEventListener('click', (event) => {
                const actionName = event.target.dataset.action;
                startKeyCapture(actionName, event.target.closest('.shortcut-item'));
            });
        });
    }

    let activeKeyCapture = null; // { actionName, originalKey, element, isChord, part }

    function startKeyCapture(actionName, itemElement) {
        if (activeKeyCapture) {
            cancelKeyCapture(); // Cancel any existing capture
        }

        const setting = currentSettings[actionName];
        const originalKey = setting.key;
        const config = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
        const isChord = !!config.chordPrefix;

        activeKeyCapture = { actionName, originalKey, itemElement, isChord, part: isChord ? 'prefix' : 'full' };

        // Clear existing key display and show "listening" UI
        const keyKbd = itemElement.querySelector('.keys');
        const actionsDiv = itemElement.querySelector('.actions');
        
        keyKbd.innerHTML = `<em>Press new key${isChord ? ' for Prefix...' : '...'}</em>`;
        
        // Hide Edit/Reset, show Save/Cancel for key capture
        actionsDiv.innerHTML = `
            <button class="save-captured-key" data-action="${actionName}">Save Key</button>
            <button class="cancel-captured-key" data-action="${actionName}">Cancel</button>
        `;

        itemElement.querySelector('.save-captured-key').addEventListener('click', () => {
            saveCapturedKey(activeKeyCapture.actionName);
        });
        itemElement.querySelector('.cancel-captured-key').addEventListener('click', () => {
            cancelKeyCapture();
        });
        
        itemElement.querySelector('.save-captured-key').disabled = true; // Disabled until a key is captured

        document.addEventListener('keydown', handleKeyCaptureEvent, true);
        console.log(`Starting key capture for ${actionName}. Chord: ${isChord}, Part: ${activeKeyCapture.part}`);
    }

    function formatCapturedKey(event) {
        const parts = [];
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.altKey) parts.push('Alt');
        if (event.shiftKey) parts.push('Shift');
        if (IS_MAC_OPTIONS && event.metaKey && !event.ctrlKey) parts.push('Meta'); // Use Meta for Cmd on Mac if Ctrl isn't also pressed

        let key = event.key;
        
        // Prevent capturing standalone modifier keys
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
            return null; // Not a valid shortcut key on its own
        }

        if (key.startsWith('Arrow')) {
            // No change e.g. ArrowDown
        } else if (key === ' ') {
            key = 'Space';
        } else if (key.length === 1 && key.match(/[a-zA-Z0-9]/)) { // Alphanumeric
            key = key.toUpperCase();
        }
        // Other special keys like Enter, Tab, Escape, Home, [, ], / will be used as is from event.key
        // This aligns with how parseKeyString in common.js might expect them.

        parts.push(key);
        return parts.join('+');
    }

    function handleKeyCaptureEvent(event) {
        if (!activeKeyCapture) return;

        event.preventDefault();
        event.stopPropagation();

        const capturedKeyString = formatCapturedKey(event);
        const saveButton = activeKeyCapture.itemElement.querySelector('.save-captured-key');

        if (!capturedKeyString) { // e.g. only a modifier was pressed
            if (saveButton) saveButton.disabled = true;
            return;
        }
        
        const keyKbd = activeKeyCapture.itemElement.querySelector('.keys');
        if (activeKeyCapture.isChord) {
            if (activeKeyCapture.part === 'prefix') {
                activeKeyCapture.capturedPrefix = capturedKeyString;
                keyKbd.innerHTML = `<em>${getDisplayKey(capturedKeyString)} + Press second key...</em>`;
                activeKeyCapture.part = 'second'; // Move to next part
                if (saveButton) saveButton.disabled = true; // Wait for second key
            } else { // part === 'second'
                activeKeyCapture.capturedSecondKey = capturedKeyString;
                keyKbd.innerHTML = `<em>${getDisplayKey(activeKeyCapture.capturedPrefix + ' ' + capturedKeyString)}</em>`;
                if (saveButton) saveButton.disabled = false; // Full chord captured
            }
        } else { // Not a chord
            activeKeyCapture.capturedKey = capturedKeyString;
            keyKbd.innerHTML = `<em>${getDisplayKey(capturedKeyString)}</em>`;
            if (saveButton) saveButton.disabled = false; // Key captured
        }
    }

    function saveCapturedKey(actionName) { // newKey is now taken from activeKeyCapture object
        if (!activeKeyCapture || activeKeyCapture.actionName !== actionName) return;
        
        let finalKeyToSave;
        if (activeKeyCapture.isChord) {
            if (activeKeyCapture.capturedPrefix && activeKeyCapture.capturedSecondKey) {
                finalKeyToSave = `${activeKeyCapture.capturedPrefix} ${activeKeyCapture.capturedSecondKey}`;
            } else {
                displayStatus(`Chord not fully captured for ${actionName}. Press both parts.`, false);
                // Don't cancel, allow user to try capturing the second part if only prefix was done.
                // Or, if a save was attempted prematurely, this error is appropriate.
                // For now, let's assume save is only enabled when fully captured.
                return;
            }
        } else { // Not a chord
            if (activeKeyCapture.capturedKey) {
                finalKeyToSave = activeKeyCapture.capturedKey;
            } else {
                displayStatus(`Key not captured for ${actionName}.`, false);
                return;
            }
        }

        // --- Conflict Detection ---
        if (isKeyConflicting(finalKeyToSave, actionName)) {
            const conflictingAction = getConflictingAction(finalKeyToSave, actionName);
            displayStatus(`Error: Key "${getDisplayKey(finalKeyToSave)}" is already used by "${DEFAULT_SHORTCUT_SETTINGS_CONFIG[conflictingAction].description}".`, false);
            // UI remains in capture mode for user to try a different key or cancel.
            return;
        }
        // --- End Conflict Detection ---

        console.log(`Attempting to save key: ${finalKeyToSave} for action: ${actionName}`);

        currentSettings[actionName].key = finalKeyToSave;
        currentSettings[actionName].isCustom = (finalKeyToSave !== DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].defaultKey);
        
        // console.log(`Simulated save for ${actionName} with key ${finalKeyToSave}`); // Already logged above
        cleanupAfterKeyCapture();
        renderShortcuts(); // Re-render to show the new key and update button states
        displayStatus(`Key for "${DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].description}" updated. Save settings to make permanent.`, true);
    }
    
    function isKeyConflicting(keyToTest, actionNameToExclude) {
        for (const actionName in currentSettings) {
            if (actionName === actionNameToExclude) continue; // Don't compare with itself

            const setting = currentSettings[actionName];
            if (setting.enabled && setting.key === keyToTest) {
                return true; // Conflict found
            }
        }
        return false; // No conflict
    }

    function getConflictingAction(keyToTest, actionNameToExclude) {
        for (const actionName in currentSettings) {
            if (actionName === actionNameToExclude) continue;
            const setting = currentSettings[actionName];
            if (setting.enabled && setting.key === keyToTest) {
                return actionName;
            }
        }
        return null;
    }

    function cancelKeyCapture() {
        if (!activeKeyCapture) return;
        console.log(`Cancelling key capture for ${activeKeyCapture.actionName}`);
        cleanupAfterKeyCapture();
        renderShortcuts(); // Re-render to restore original display
    }

    function cleanupAfterKeyCapture() {
        if (activeKeyCapture) {
            document.removeEventListener('keydown', handleKeyCaptureEvent, true);
            activeKeyCapture = null;
        }
    }

    function resetShortcutToDefault(actionName) {
        if (DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName]) {
            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            currentSettings[actionName] = {
                ...currentSettings[actionName], // Preserve enabled status
                key: defaultConfig.defaultKey,
                isCustom: false
            };
            renderShortcuts(); // Re-render to update the specific shortcut's display
            // No need to save immediately, user will click main "Save Settings"
            displayStatus(`Shortcut "${defaultConfig.description}" reset to default key. Save settings to apply.`, true);
        }
    }

    function resetAllShortcutsToDefault() {
        if (confirm("Are you sure you want to reset ALL shortcuts to their default keybindings? This cannot be undone until you save.")) {
            Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
                const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
                currentSettings[actionName] = {
                    ...currentSettings[actionName], // Preserve enabled status
                    enabled: currentSettings[actionName] ? currentSettings[actionName].enabled : defaultConfig.defaultEnabled, // Ensure 'enabled' exists
                    key: defaultConfig.defaultKey,
                    isCustom: false
                };
            });
            renderShortcuts(); // Re-render the entire list
            displayStatus('All shortcuts reset to default keys. Save settings to apply.', true);
        }
    }


    function renderDisabledSites() {
        disabledSitesUl.innerHTML = '';
        currentDisabledSites.forEach((site, index) => {
            const li = document.createElement('li');
            li.textContent = site;
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.title = `Remove ${site} from disabled list`;
            removeButton.dataset.index = index;
            removeButton.addEventListener('click', () => {
                currentDisabledSites.splice(index, 1);
                renderDisabledSites(); // Re-render
            });
            li.appendChild(removeButton);
            disabledSitesUl.appendChild(li);
        });
    }
    
    addDisabledSiteButton.addEventListener('click', () => {
        const newSite = newDisabledSiteInput.value.trim().toLowerCase();
        if (newSite && !currentDisabledSites.includes(newSite)) {
            // Basic validation for hostname-like patterns
            if (/^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/.test(newSite) || /^[a-z0-9-]+\.[a-z]{2,}$/.test(newSite) || newSite === "localhost") {
                currentDisabledSites.push(newSite);
                newDisabledSiteInput.value = '';
                renderDisabledSites();
            } else {
                displayStatus(`Invalid hostname pattern: ${newSite}. Use format like 'example.com' or '*.example.com'.`, false);
            }
        } else if (currentDisabledSites.includes(newSite)) {
            displayStatus(`Site "${newSite}" is already in the list.`, false);
        }
        newDisabledSiteInput.focus();
    });
    newDisabledSiteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addDisabledSiteButton.click();
        }
    });


    function loadSettings() {
        chrome.storage.sync.get(['shortcutSettings', 'disabledSites', 'globalSettings'], (data) => {
            const loadedShortcutSettings = data.shortcutSettings || {};
            currentDisabledSites = data.disabledSites || [...DEFAULT_GLOBAL_SETTINGS.disabledSites];
            const global = data.globalSettings || { ...DEFAULT_GLOBAL_SETTINGS };

            currentSettings = {}; // This will store the new structure: { actionName: { enabled, key, isCustom } }

            Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
                const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
                const loadedSetting = loadedShortcutSettings[actionName];

                if (typeof loadedSetting === 'object' && loadedSetting !== null && loadedSetting.hasOwnProperty('key')) {
                    // New format already exists
                    currentSettings[actionName] = {
                        enabled: loadedSetting.hasOwnProperty('enabled') ? loadedSetting.enabled : defaultConfig.defaultEnabled,
                        key: loadedSetting.key,
                        isCustom: loadedSetting.isCustom || (loadedSetting.key !== defaultConfig.defaultKey)
                    };
                } else if (typeof loadedSetting === 'boolean') {
                    // Old format (just enabled status) - migrate
                    currentSettings[actionName] = {
                        enabled: loadedSetting,
                        key: defaultConfig.defaultKey,
                        isCustom: false
                    };
                } else {
                    // No setting found, use defaults
                    currentSettings[actionName] = {
                        enabled: defaultConfig.defaultEnabled,
                        key: defaultConfig.defaultKey,
                        isCustom: false
                    };
                }
            });

            showFeedbackCheckbox.checked = global.hasOwnProperty('showFeedback') ? global.showFeedback : DEFAULT_GLOBAL_SETTINGS.showFeedback;
            feedbackDurationInput.value = global.hasOwnProperty('feedbackDuration') ? global.feedbackDuration : DEFAULT_GLOBAL_SETTINGS.feedbackDuration;

            renderShortcuts();
            renderDisabledSites();
        });
    }

    saveButton.addEventListener('click', () => {
        const shortcutSettingsToSave = {};
        Object.keys(currentSettings).forEach(actionName => {
            const checkbox = document.getElementById(`toggle_${actionName}`);
            const currentKey = currentSettings[actionName].key; // This will be updated by edit UI later
            const defaultKey = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].defaultKey;

            shortcutSettingsToSave[actionName] = {
                enabled: checkbox ? checkbox.checked : currentSettings[actionName].enabled,
                key: currentKey,
                isCustom: currentKey !== defaultKey
            };
        });

        const globalSettingsToSave = {
            showFeedback: showFeedbackCheckbox.checked,
            feedbackDuration: parseInt(feedbackDurationInput.value, 10) || DEFAULT_GLOBAL_SETTINGS.feedbackDuration
        };

        chrome.storage.sync.set({
            shortcutSettings: shortcutSettingsToSave,
            disabledSites: currentDisabledSites,
            globalSettings: globalSettingsToSave
        }, () => {
            displayStatus('Settings saved successfully!');
            // Update currentSettings to reflect what was just saved, especially the isCustom flag
            Object.keys(shortcutSettingsToSave).forEach(actionName => {
                currentSettings[actionName] = shortcutSettingsToSave[actionName];
            });
            renderShortcuts(); // Re-render to show any changes like custom indicators
            
            // Notify content scripts in all tabs
            chrome.tabs.query({}, function(tabs) {
                for (let tab of tabs) {
                    if (tab.id && (tab.url?.startsWith('http') || tab.url?.startsWith('file'))) { // Basic check if we can script it
                        chrome.tabs.sendMessage(tab.id, { type: "settingsUpdated" }, function(response) {
                            if (chrome.runtime.lastError) {
                                // console.warn(`Could not send settingsUpdated to tab ${tab.id}: ${chrome.runtime.lastError.message}`);
                            }
                        });
                    }
                }
            });
        });
    });

    loadSettings();
});