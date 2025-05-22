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

    // Activation Shortcut UI Elements
    const activationShortcutDisplay = document.getElementById('activationShortcutDisplay');
    const editActivationShortcutButton = document.getElementById('editActivationShortcut');
    const resetActivationShortcutButton = document.getElementById('resetActivationShortcut');
    const incorrectActivationWarningThresholdInput = document.getElementById('incorrectActivationWarningThresholdInput');

    // Site Overrides UI Elements
    const siteOverrideHostnameInput = document.getElementById('siteOverrideHostname');
    const manageSiteOverridesButton = document.getElementById('manageSiteOverrides');
    const siteOverridesManagerDiv = document.getElementById('siteOverridesManager');
    const editingSiteHostnameHeader = document.getElementById('editingSiteHostname');
    const activeSiteOverrideHostnameSpan = document.getElementById('activeSiteOverrideHostname');
    const siteSpecificShortcutsListDiv = document.getElementById('siteSpecificShortcutsList');
    const saveSiteOverridesButton = document.getElementById('saveSiteOverrides'); // Apply changes for current site to temp state
    const removeSiteOverridesButton = document.getElementById('removeSiteOverrides'); // Remove all overrides for current site
    const closeSiteOverridesManagerButton = document.getElementById('closeSiteOverridesManager');
    const configuredSitesListUl = document.getElementById('configuredSitesList');
    // const configuredSitesListContainerDiv = document.getElementById('configuredSitesListContainer'); // Not strictly needed if Ul is direct child

    let currentSettings = {}; // Stores global { actionName: { enabled, key, isCustom, isNowChord } }
    let currentGlobalSettingsState = {}; // To store loaded global settings like activationShortcut
    let currentDisabledSites = [];
    let currentSiteOverrides = {}; // Stores { hostname: { actionName: { enabled?, key? } } }
    let activeManagingHostname = null; // Stores the hostname currently being edited in the site manager
    let temporarySiteSpecificSettings = {}; // Stores { actionName: { enabled?, key? } } for the activeManagingHostname

    const IS_MAC_OPTIONS = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    let activeActivationKeyCapture = null; // { originalKey, capturedKey }
    let tempActivationShortcut = null; // Stores the locally captured key before global save

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
        // const config = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName]; // config.chordPrefix not used here anymore for initial mode
        
        activeKeyCapture = { actionName, originalKey, itemElement, part: 'first', capturedFirstKey: null, capturedSecondKey: null }; // isChord determined later

        // Clear existing key display and show "listening" UI
        const keyKbd = itemElement.querySelector('.keys');
        const actionsDiv = itemElement.querySelector('.actions');
        
        keyKbd.innerHTML = `<em>Press first key / first part of chord...</em>`;
        
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
        console.log(`Starting key capture for ${actionName}. Part: ${activeKeyCapture.part}`);
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
        const keyKbd = activeKeyCapture.itemElement.querySelector('.keys');

        if (activeKeyCapture.part === 'first') {
            if (!capturedKeyString) { // Only a modifier was pressed for the first part
                keyKbd.innerHTML = `<em style="color: orange;">Prefix must include a non-modifier key. Try Ctrl+K, etc.</em>`;
                if (saveButton) saveButton.disabled = true;
                return;
            }
            activeKeyCapture.capturedFirstKey = capturedKeyString;
            keyKbd.innerHTML = `<em>${getDisplayKey(activeKeyCapture.capturedFirstKey)} + Press optional second key... (or Save)</em>`;
            activeKeyCapture.part = 'second';
            if (saveButton) saveButton.disabled = false; // Enable save for single key
        } else if (activeKeyCapture.part === 'second') {
            if (!capturedKeyString) { // Only a modifier was pressed for the second part
                // Display first part + error for second
                keyKbd.innerHTML = `<em>${getDisplayKey(activeKeyCapture.capturedFirstKey)} + <span style="color: orange;">Second key must include a non-modifier.</span> (or Save first part)</em>`;
                // Save button remains enabled to save just the first part.
                // activeKeyCapture.capturedSecondKey remains null.
                return;
            }
            activeKeyCapture.capturedSecondKey = capturedKeyString;
            keyKbd.innerHTML = `<em>${getDisplayKey(activeKeyCapture.capturedFirstKey + ' ' + activeKeyCapture.capturedSecondKey)}</em>`;
            if (saveButton) saveButton.disabled = false; // Full chord captured, save button should already be enabled
        }
    }

    function saveCapturedKey(actionName) { // newKey is now taken from activeKeyCapture object
        if (!activeKeyCapture || activeKeyCapture.actionName !== actionName) return;
        
        let finalKeyToSave;
        if (activeKeyCapture.capturedFirstKey && activeKeyCapture.capturedSecondKey) {
            finalKeyToSave = `${activeKeyCapture.capturedFirstKey} ${activeKeyCapture.capturedSecondKey}`;
        } else if (activeKeyCapture.capturedFirstKey) {
            finalKeyToSave = activeKeyCapture.capturedFirstKey;
        } else {
            displayStatus(`Key not fully captured for ${actionName}. Please try again.`, false);
            // It's unlikely to reach here if saveButton logic in handleKeyCaptureEvent is correct
            cancelKeyCapture(); // Cancel to reset the UI properly
            return;
        }

        // --- Conflict Detection ---
        if (isKeyConflicting(finalKeyToSave, actionName)) {
            const conflictingAction = getConflictingAction(finalKeyToSave, actionName);
            let conflictDescription = "another shortcut";
            if (conflictingAction === '__ACTIVATION_SHORTCUT__') {
                conflictDescription = "the global Activation Shortcut";
            } else if (DEFAULT_SHORTCUT_SETTINGS_CONFIG[conflictingAction]) {
                conflictDescription = `"${DEFAULT_SHORTCUT_SETTINGS_CONFIG[conflictingAction].description}"`;
            }
            displayStatus(`Error: Key "${getDisplayKey(finalKeyToSave)}" is already used by ${conflictDescription}.`, false);
            // UI remains in capture mode for user to try a different key or cancel.
            return;
        }
        // --- End Conflict Detection ---

        console.log(`Attempting to save key: ${finalKeyToSave} for action: ${actionName}`);

        currentSettings[actionName].key = finalKeyToSave;
        // isCustom will be set properly during the main save to storage,
        // considering if it's now a chord or not.
        // currentSettings[actionName].isCustom = (finalKeyToSave !== DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].defaultKey);
        
        console.log(`Key updated locally to: ${finalKeyToSave} for action: ${actionName}`);
        cleanupAfterKeyCapture();
        renderShortcuts(); // Re-render to show the new key and update button states
        displayStatus(`Key for "${DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].description}" updated. Save settings to make permanent.`, true);
    }

    // --- Conflict Detection for Activation Shortcut ---
    function isActivationKeyConflicting(keyToTest, isResettingDefault = false) {
        // Check against all individual shortcuts in currentSettings
        for (const actionName in currentSettings) {
            const setting = currentSettings[actionName];
            // If we are resetting the activation shortcut to its default,
            // and this actionName's key IS the default activation shortcut key,
            // it's not a "conflict" in the traditional sense if the action itself is disabled.
            // However, for simplicity and safety, any active shortcut using the key is a conflict.
            if (setting.enabled && setting.key === keyToTest) {
                return true; // Conflict found with an individual shortcut
            }
        }
        // Potentially check against other global key settings if more are added in the future
        return false; // No conflict
    }

    function getActivationConflictingActionDetails(keyToTest) {
        for (const actionName in currentSettings) {
            const setting = currentSettings[actionName];
            if (setting.enabled && setting.key === keyToTest) {
                return {
                    description: DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].description,
                    source: 'Individual Shortcut'
                };
            }
        }
        return { description: 'Unknown action', source: 'Unknown' }; // Fallback
    }
    // --- End Conflict Detection for Activation Shortcut ---
    
    function isKeyConflicting(keyToTest, actionNameToExclude) {
        // Check against other individual shortcuts
        for (const actionName in currentSettings) {
            if (actionName === actionNameToExclude) continue; // Don't compare with itself

            const setting = currentSettings[actionName];
            if (setting.enabled && setting.key === keyToTest) {
                return true; // Conflict found
            }
        }
        // Also check against the global activation shortcut
        if (currentGlobalSettingsState.activationShortcut === keyToTest) {
            // If actionNameToExclude is not provided, or it's not a special identifier for the activation shortcut itself
            if (actionNameToExclude !== '__ACTIVATION_SHORTCUT__') { // Use a special identifier if needed
                 return true; // Conflict with global activation shortcut
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
        if (currentGlobalSettingsState.activationShortcut === keyToTest && actionNameToExclude !== '__ACTIVATION_SHORTCUT__') {
            return '__ACTIVATION_SHORTCUT__'; // Special identifier for the activation shortcut
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

    // --- Activation Shortcut Key Capture Functions ---
    function startActivationKeyCapture() {
        if (activeKeyCapture) cancelKeyCapture(); // Cancel other captures
        if (activeActivationKeyCapture) cancelActivationKeyCapture();

        const originalKey = currentGlobalSettingsState.activationShortcut;
        tempActivationShortcut = originalKey; // Initialize with current
        activeActivationKeyCapture = { originalKey, capturedKey: null };

        activationShortcutDisplay.innerHTML = `<em>Press new shortcut key...</em>`;
        editActivationShortcutButton.style.display = 'none';
        resetActivationShortcutButton.style.display = 'none'; // Hide reset during capture

        const tempSaveButton = document.createElement('button');
        tempSaveButton.textContent = 'Save Activation Key';
        tempSaveButton.id = 'saveCapturedActivationKey';
        tempSaveButton.disabled = true;

        const tempCancelButton = document.createElement('button');
        tempCancelButton.textContent = 'Cancel';
        tempCancelButton.id = 'cancelCapturedActivationKey';

        const actionsDiv = editActivationShortcutButton.parentElement; // Get the .actions div
        actionsDiv.appendChild(tempSaveButton);
        actionsDiv.appendChild(tempCancelButton);

        tempSaveButton.addEventListener('click', saveActivationCapturedKey);
        tempCancelButton.addEventListener('click', cancelActivationKeyCapture);

        document.addEventListener('keydown', handleActivationKeyCaptureEvent, true);
    }

    function handleActivationKeyCaptureEvent(event) {
        if (!activeActivationKeyCapture) return;

        event.preventDefault();
        event.stopPropagation();

        const capturedKeyString = formatCapturedKey(event); // Reuse existing formatter
        const saveButton = document.getElementById('saveCapturedActivationKey');

        if (!capturedKeyString) { // Only a modifier was pressed
            activationShortcutDisplay.innerHTML = `<em style="color: orange;">Shortcut must include a non-modifier key.</em>`;
            if (saveButton) saveButton.disabled = true;
            return;
        }
        activeActivationKeyCapture.capturedKey = capturedKeyString;
        activationShortcutDisplay.innerHTML = `<em>${getDisplayKey(capturedKeyString)}</em>`;
        if (saveButton) saveButton.disabled = false;
    }

    function saveActivationCapturedKey() {
        if (!activeActivationKeyCapture || !activeActivationKeyCapture.capturedKey) {
            displayStatus('Activation key not fully captured.', false);
            cancelActivationKeyCapture();
            return;
        }

        const newKey = activeActivationKeyCapture.capturedKey;

        // Conflict detection for activation shortcut
        if (isActivationKeyConflicting(newKey)) {
            const conflictingActionDetails = getActivationConflictingActionDetails(newKey);
            displayStatus(`Error: Key "${getDisplayKey(newKey)}" is already used by "${conflictingActionDetails.description}". Choose a different key.`, false);
            // UI remains in capture mode for user to try a different key or cancel.
            // To allow this, we don't call cancelActivationKeyCapture() here.
            // We should re-enable the save button if they type another key.
            // For simplicity now, let's just clear the captured key and prompt again.
            activeActivationKeyCapture.capturedKey = null;
            activationShortcutDisplay.innerHTML = `<em>Conflict! Press new shortcut key...</em>`;
            const saveBtn = document.getElementById('saveCapturedActivationKey');
            if(saveBtn) saveBtn.disabled = true;
            return;
        }

        currentGlobalSettingsState.activationShortcut = newKey;
        tempActivationShortcut = newKey; // Update temp holder as well
        cleanupAfterActivationKeyCapture();
        activationShortcutDisplay.textContent = getDisplayKey(newKey);
        resetActivationShortcutButton.style.display = (newKey !== DEFAULT_GLOBAL_SETTINGS.activationShortcut) ? 'inline-block' : 'none';
        displayStatus('Activation shortcut updated. Save settings to make permanent.', true);
    }

    function cancelActivationKeyCapture() {
        if (!activeActivationKeyCapture) return;
        cleanupAfterActivationKeyCapture();
        activationShortcutDisplay.textContent = getDisplayKey(currentGlobalSettingsState.activationShortcut); // Revert to original/last saved
        resetActivationShortcutButton.style.display = (currentGlobalSettingsState.activationShortcut !== DEFAULT_GLOBAL_SETTINGS.activationShortcut) ? 'inline-block' : 'none';
    }

    function cleanupAfterActivationKeyCapture() {
        if (activeActivationKeyCapture) {
            document.removeEventListener('keydown', handleActivationKeyCaptureEvent, true);
            activeActivationKeyCapture = null;
        }
        const saveBtn = document.getElementById('saveCapturedActivationKey');
        const cancelBtn = document.getElementById('cancelCapturedActivationKey');
        if (saveBtn) saveBtn.remove();
        if (cancelBtn) cancelBtn.remove();
        editActivationShortcutButton.style.display = 'inline-block';
        // resetActivationShortcutButton display is handled by save/cancel
    }
    
    function resetActivationShortcutToDefault() {
        const defaultKey = DEFAULT_GLOBAL_SETTINGS.activationShortcut;
        if (currentGlobalSettingsState.activationShortcut === defaultKey) return;

        // Check for conflicts before resetting, though less likely for a default.
        if (isActivationKeyConflicting(defaultKey, true)) { // true to exclude itself if it were somehow the conflict
            const conflictingActionDetails = getActivationConflictingActionDetails(defaultKey);
            displayStatus(`Error: Default key "${getDisplayKey(defaultKey)}" conflicts with "${conflictingActionDetails.description}". Cannot reset.`, false);
            return;
        }

        currentGlobalSettingsState.activationShortcut = defaultKey;
        tempActivationShortcut = defaultKey;
        activationShortcutDisplay.textContent = getDisplayKey(defaultKey);
        resetActivationShortcutButton.style.display = 'none';
        displayStatus('Activation shortcut reset to default. Save settings to apply.', true);
    }

    // --- End Activation Shortcut Key Capture Functions ---

    function resetShortcutToDefault(actionName) {
        if (DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName]) {
            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            currentSettings[actionName] = {
                ...currentSettings[actionName], // Preserve enabled status
                key: defaultConfig.defaultKey,
                isCustom: false,
                isNowChord: defaultConfig.defaultKey.includes(' ')
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
                    enabled: currentSettings[actionName] ? currentSettings[actionName].enabled : defaultConfig.defaultEnabled,
                    key: defaultConfig.defaultKey,
                    isCustom: false,
                    isNowChord: defaultConfig.defaultKey.includes(' ')
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

    // --- Site Overrides Management ---

    function renderConfiguredSitesList() {
        configuredSitesListUl.innerHTML = '';
        const sortedHostnames = Object.keys(currentSiteOverrides).sort();

        if (sortedHostnames.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No sites have specific configurations yet.';
            li.style.fontStyle = 'italic';
            configuredSitesListUl.appendChild(li);
            return;
        }

        sortedHostnames.forEach(hostname => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '5px 0';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = hostname;
            li.appendChild(nameSpan);

            const buttonsDiv = document.createElement('div');

            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.title = `Edit overrides for ${hostname}`;
            editButton.dataset.hostname = hostname;
            editButton.style.marginRight = '5px';
            editButton.style.fontSize = '0.85em';
            editButton.style.padding = '3px 8px';
            editButton.addEventListener('click', () => {
                siteOverrideHostnameInput.value = hostname; // Populate input for consistency
                openSiteOverridesManager(hostname);
            });
            buttonsDiv.appendChild(editButton);

            const quickDeleteButton = document.createElement('button');
            quickDeleteButton.textContent = 'Delete';
            quickDeleteButton.title = `Delete all overrides for ${hostname}`;
            quickDeleteButton.dataset.hostname = hostname;
            quickDeleteButton.style.backgroundColor = '#dc3545';
            quickDeleteButton.style.fontSize = '0.85em';
            quickDeleteButton.style.padding = '3px 8px';
            quickDeleteButton.addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete all shortcut overrides for "${hostname}"? This action will be saved when you click 'Save Settings'.`)) {
                    delete currentSiteOverrides[hostname];
                    if (activeManagingHostname === hostname) { // If currently editing this site, close manager
                        closeOverridesManagerUI();
                    }
                    renderConfiguredSitesList();
                    displayStatus(`Overrides for "${hostname}" marked for deletion. Save settings to make permanent.`, true);
                }
            });
            buttonsDiv.appendChild(quickDeleteButton);
            li.appendChild(buttonsDiv);
            configuredSitesListUl.appendChild(li);
        });
    }

    function openSiteOverridesManager(hostname) {
        if (!hostname) {
            displayStatus('Please enter a valid hostname.', false);
            return;
        }
        activeManagingHostname = hostname.trim().toLowerCase();
        temporarySiteSpecificSettings = JSON.parse(JSON.stringify(currentSiteOverrides[activeManagingHostname] || {})); // Deep copy or new object

        editingSiteHostnameHeader.textContent = `Editing: ${activeManagingHostname}`;
        activeSiteOverrideHostnameSpan.textContent = activeManagingHostname;

        renderSiteSpecificShortcuts(activeManagingHostname); // Placeholder for now

        siteOverridesManagerDiv.style.display = 'block';
        siteOverrideHostnameInput.value = ''; // Clear input after opening
    }

    function closeOverridesManagerUI() {
        siteOverridesManagerDiv.style.display = 'none';
        activeManagingHostname = null;
        temporarySiteSpecificSettings = {};
        siteSpecificShortcutsListDiv.innerHTML = ''; // Clear the list
        editingSiteHostnameHeader.textContent = '';
        activeSiteOverrideHostnameSpan.textContent = '';
    }

    manageSiteOverridesButton.addEventListener('click', () => {
        const hostname = siteOverrideHostnameInput.value.trim().toLowerCase();
        if (!hostname) {
            displayStatus('Please enter a hostname to configure (e.g., example.com or *.example.com).', false);
            return;
        }
        // Basic validation for hostname-like patterns
        if (!(/^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/.test(hostname) || /^[a-z0-9-]+\.[a-z]{2,}$/.test(hostname) || hostname === "localhost")) {
            displayStatus(`Invalid hostname pattern: ${hostname}. Use format like 'example.com' or '*.example.com'.`, false);
            return;
        }
        openSiteOverridesManager(hostname);
    });
    
    siteOverrideHostnameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            manageSiteOverridesButton.click();
        }
    });

    closeSiteOverridesManagerButton.addEventListener('click', () => {
        closeOverridesManagerUI();
    });

    function renderSiteSpecificShortcuts(hostname) {
        siteSpecificShortcutsListDiv.innerHTML = ''; // Clear previous content
        const categories = {};

        // Group shortcuts by category using DEFAULT_SHORTCUT_SETTINGS_CONFIG for structure
        Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            if (!categories[defaultConfig.category]) {
                categories[defaultConfig.category] = [];
            }
            categories[defaultConfig.category].push({
                actionName,
                description: defaultConfig.description,
                category: defaultConfig.category,
                defaultKey: defaultConfig.defaultKey, // Global default key
                defaultEnabled: defaultConfig.defaultEnabled // Global default enabled
            });
        });

        for (const categoryName in categories) {
            const categoryTitle = document.createElement('h3');
            categoryTitle.textContent = categoryName;
            categoryTitle.className = 'category-title'; // Reuse existing class
            siteSpecificShortcutsListDiv.appendChild(categoryTitle);

            categories[categoryName].sort((a, b) => a.description.localeCompare(b.description)).forEach(shortcut => {
                const item = document.createElement('div');
                item.className = 'shortcut-item'; // Reuse existing class

                const siteOverride = temporarySiteSpecificSettings[shortcut.actionName];
                // Ensure globalSetting has a fallback structure if currentSettings[shortcut.actionName] is undefined
                const globalSetting = currentSettings[shortcut.actionName] ||
                                      {
                                          key: shortcut.defaultKey,
                                          enabled: shortcut.defaultEnabled,
                                          isCustom: false,
                                          isNowChord: shortcut.defaultKey.includes(' ')
                                      };


                let effectiveKey, effectiveEnabled, sourceIndicatorText, isSiteCustomKey, isSiteCustomEnabled;

                if (siteOverride && siteOverride.hasOwnProperty('key')) {
                    effectiveKey = siteOverride.key;
                    isSiteCustomKey = true;
                } else {
                    effectiveKey = globalSetting.key;
                    isSiteCustomKey = false;
                }

                if (siteOverride && siteOverride.hasOwnProperty('enabled')) {
                    effectiveEnabled = siteOverride.enabled;
                    isSiteCustomEnabled = true;
                } else {
                    effectiveEnabled = globalSetting.enabled;
                    isSiteCustomEnabled = false;
                }
                
                const keyDisplay = getDisplayKey(effectiveKey);
                let customKeyIndicator = '';
                if (isSiteCustomKey) {
                    customKeyIndicator = ' <span class="custom-indicator" title="Site-specific key">*S</span>';
                } else if (globalSetting.isCustom) { // isCustom on globalSetting refers to global customization
                    customKeyIndicator = ' <span class="custom-indicator" title="Globally custom key">*G</span>';
                }
                
                if (isSiteCustomKey || isSiteCustomEnabled) {
                    sourceIndicatorText = `Site Specific`;
                } else if (globalSetting.isCustom) {
                    sourceIndicatorText = `Global Custom`;
                } else {
                    sourceIndicatorText = `Global Default`;
                }


                item.innerHTML = `
                    <div style="display: flex; align-items: center; flex-grow: 1;">
                        <kbd class="keys site-specific-keys" data-action="${shortcut.actionName}">${keyDisplay}${customKeyIndicator}</kbd>
                        <span style="margin-left: 10px;">${shortcut.description} <small>(${sourceIndicatorText})</small></span>
                    </div>
                    <div class="actions site-specific-actions">
                        <button class="edit-site-shortcut" data-action="${shortcut.actionName}" title="Edit shortcut key for this site">Edit Key</button>
                        <button class="reset-site-shortcut" data-action="${shortcut.actionName}" title="Reset to global setting for this site" ${!(isSiteCustomKey || isSiteCustomEnabled) ? 'style="display:none;"' : ''}>Reset to Global</button>
                    </div>
                    <input type="checkbox" class="toggle-site-shortcut" data-action="${shortcut.actionName}" title="Enable/Disable for this site" ${effectiveEnabled ? 'checked' : ''}>
                `;
                siteSpecificShortcutsListDiv.appendChild(item);

                // Event listeners for site-specific controls
                item.querySelector('.toggle-site-shortcut').addEventListener('change', (event) => {
                    const action = event.target.dataset.action;
                    if (!temporarySiteSpecificSettings[action]) temporarySiteSpecificSettings[action] = {};
                    temporarySiteSpecificSettings[action].enabled = event.target.checked;
                    renderSiteSpecificShortcuts(hostname); // Re-render this specific item or the whole list to update indicators
                });

                item.querySelector('.reset-site-shortcut').addEventListener('click', (event) => {
                    const action = event.target.dataset.action;
                    if (temporarySiteSpecificSettings[action]) {
                        delete temporarySiteSpecificSettings[action].key;
                        delete temporarySiteSpecificSettings[action].enabled;
                        if (Object.keys(temporarySiteSpecificSettings[action]).length === 0) {
                            delete temporarySiteSpecificSettings[action];
                        }
                    }
                    renderSiteSpecificShortcuts(hostname);
                    displayStatus(`Shortcut "${shortcut.description}" for ${hostname} reset to global. Apply site changes.`, true);
                });
                
                item.querySelector('.edit-site-shortcut').addEventListener('click', (event) => {
                    const action = event.target.dataset.action;
                    startSiteKeyCapture(action, item, hostname);
                });
            });
        }
    }

    saveSiteOverridesButton.addEventListener('click', () => {
        if (!activeManagingHostname) return;

        if (Object.keys(temporarySiteSpecificSettings).length > 0) {
            // Ensure we are only saving properties that are actual overrides (key or enabled)
            const cleanTemporarySettings = {};
            for (const actionName in temporarySiteSpecificSettings) {
                const override = temporarySiteSpecificSettings[actionName];
                if (override.hasOwnProperty('key') || override.hasOwnProperty('enabled')) {
                    if (!cleanTemporarySettings[actionName]) cleanTemporarySettings[actionName] = {};
                    if (override.hasOwnProperty('key')) cleanTemporarySettings[actionName].key = override.key;
                    if (override.hasOwnProperty('enabled')) cleanTemporarySettings[actionName].enabled = override.enabled;
                }
            }
            if (Object.keys(cleanTemporarySettings).length > 0) {
                 currentSiteOverrides[activeManagingHostname] = JSON.parse(JSON.stringify(cleanTemporarySettings));
            } else {
                 delete currentSiteOverrides[activeManagingHostname]; // No actual overrides left
            }

        } else {
            // If temporary settings are empty, it means all overrides were removed for this site.
            delete currentSiteOverrides[activeManagingHostname];
        }
        
        displayStatus(`Changes for "${activeManagingHostname}" applied locally. Save all settings to make them permanent.`, true);
        closeOverridesManagerUI();
        renderConfiguredSitesList();
    });

    removeSiteOverridesButton.addEventListener('click', () => {
        if (!activeManagingHostname) return;
        if (confirm(`Are you sure you want to remove ALL shortcut configurations for "${activeManagingHostname}"? This action will be applied locally. Click 'Save Settings' to make it permanent.`)) {
            delete currentSiteOverrides[activeManagingHostname];
            temporarySiteSpecificSettings = {}; // Clear temp settings as well
            displayStatus(`All configurations for "${activeManagingHostname}" removed locally. Save all settings to make permanent.`, true);
            closeOverridesManagerUI();
            renderConfiguredSitesList();
        }
    });

    let activeSiteKeyCapture = null; // { actionName, originalKey, itemElement, part, capturedFirstKey, capturedSecondKey, hostname }

    function startSiteKeyCapture(actionName, itemElement, hostname) {
        if (activeKeyCapture) cancelKeyCapture(); // Cancel global capture if active
        if (activeSiteKeyCapture) cancelSiteKeyCapture(); // Cancel any existing site capture

        const siteOverride = temporarySiteSpecificSettings[actionName] || {};
        // Fallback to global default if not in currentSettings (e.g., new shortcut added to config)
        const globalSetting = currentSettings[actionName] || {
            key: DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].defaultKey,
            enabled: DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].defaultEnabled
        };
        const originalKey = siteOverride.key || globalSetting.key;

        activeSiteKeyCapture = { actionName, originalKey, itemElement, hostname, part: 'first', capturedFirstKey: null, capturedSecondKey: null };

        const keyKbd = itemElement.querySelector('.keys.site-specific-keys');
        const actionsDiv = itemElement.querySelector('.actions.site-specific-actions');
        
        keyKbd.innerHTML = `<em>Press first key / chord part...</em>`;
        actionsDiv.innerHTML = `
            <button class="save-captured-site-key" data-action="${actionName}" style="font-size:0.8em; padding: 2px 6px;">Save Site Key</button>
            <button class="cancel-captured-site-key" data-action="${actionName}" style="font-size:0.8em; padding: 2px 6px;">Cancel</button>
        `;

        itemElement.querySelector('.save-captured-site-key').addEventListener('click', () => {
            saveSiteCapturedKey(activeSiteKeyCapture.actionName);
        });
        itemElement.querySelector('.cancel-captured-site-key').addEventListener('click', () => {
            cancelSiteKeyCapture();
        });
        
        itemElement.querySelector('.save-captured-site-key').disabled = true;
        document.addEventListener('keydown', handleSiteKeyCaptureEvent, true);
        // console.log(`Starting site key capture for ${actionName} on ${hostname}. Part: ${activeSiteKeyCapture.part}`);
    }

    function handleSiteKeyCaptureEvent(event) { // This can be largely the same as handleKeyCaptureEvent
        if (!activeSiteKeyCapture) return;

        event.preventDefault();
        event.stopPropagation();

        const capturedKeyString = formatCapturedKey(event); // Re-use existing formatter
        const saveButton = activeSiteKeyCapture.itemElement.querySelector('.save-captured-site-key');
        const keyKbd = activeSiteKeyCapture.itemElement.querySelector('.keys.site-specific-keys');

        if (activeSiteKeyCapture.part === 'first') {
            if (!capturedKeyString) {
                keyKbd.innerHTML = `<em style="color: orange;">Prefix must include a non-modifier key.</em>`;
                if (saveButton) saveButton.disabled = true;
                return;
            }
            activeSiteKeyCapture.capturedFirstKey = capturedKeyString;
            keyKbd.innerHTML = `<em>${getDisplayKey(activeSiteKeyCapture.capturedFirstKey)} + Press optional second key... (or Save)</em>`;
            activeSiteKeyCapture.part = 'second';
            if (saveButton) saveButton.disabled = false;
        } else if (activeSiteKeyCapture.part === 'second') {
            if (!capturedKeyString) {
                keyKbd.innerHTML = `<em>${getDisplayKey(activeSiteKeyCapture.capturedFirstKey)} + <span style="color: orange;">Second key must include a non-modifier.</span> (or Save first part)</em>`;
                return; // Save button remains enabled for the first part
            }
            activeSiteKeyCapture.capturedSecondKey = capturedKeyString;
            keyKbd.innerHTML = `<em>${getDisplayKey(activeSiteKeyCapture.capturedFirstKey + ' ' + activeSiteKeyCapture.capturedSecondKey)}</em>`;
            if (saveButton) saveButton.disabled = false; // Full chord captured
        }
    }
    
    function saveSiteCapturedKey(actionName) {
        if (!activeSiteKeyCapture || activeSiteKeyCapture.actionName !== actionName) return;

        let finalKeyToSave;
        if (activeSiteKeyCapture.capturedFirstKey && activeSiteKeyCapture.capturedSecondKey) {
            finalKeyToSave = `${activeSiteKeyCapture.capturedFirstKey} ${activeSiteKeyCapture.capturedSecondKey}`;
        } else if (activeSiteKeyCapture.capturedFirstKey) {
            finalKeyToSave = activeSiteKeyCapture.capturedFirstKey;
        } else {
            displayStatus(`Site-specific key not fully captured for ${actionName}. Please try again.`, false);
            cancelSiteKeyCapture(); // Resets UI
            return;
        }

        if (isSiteKeyConflicting(finalKeyToSave, actionName, activeSiteKeyCapture.hostname)) {
            const conflictingActionDetails = getSiteConflictingActionDetails(finalKeyToSave, actionName, activeSiteKeyCapture.hostname);
            displayStatus(`Error: Key "${getDisplayKey(finalKeyToSave)}" for site ${activeSiteKeyCapture.hostname} conflicts with "${conflictingActionDetails.description}" (Source: ${conflictingActionDetails.source}). Choose a different key.`, false);
            // UI remains in capture mode for user to try a different key or cancel.
            return;
        }
        
        if (!temporarySiteSpecificSettings[actionName]) temporarySiteSpecificSettings[actionName] = {};
        temporarySiteSpecificSettings[actionName].key = finalKeyToSave;
        
        // console.log(`Site-specific key updated locally to: ${finalKeyToSave} for action: ${actionName} on ${activeSiteKeyCapture.hostname}`);
        const hostname = activeSiteKeyCapture.hostname; // Store before cleanup
        cleanupAfterSiteKeyCapture();
        renderSiteSpecificShortcuts(hostname); // Re-render to show the new key and restore buttons
        displayStatus(`Site-specific key for "${DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].description}" on ${hostname} updated. Apply site changes to confirm, then Save Settings.`, true);
    }

    function cancelSiteKeyCapture() {
        if (!activeSiteKeyCapture) return;
        const hostname = activeSiteKeyCapture.hostname;
        // console.log(`Cancelling site key capture for ${activeSiteKeyCapture.actionName} on ${hostname}`);
        cleanupAfterSiteKeyCapture();
        renderSiteSpecificShortcuts(hostname); // Re-render to restore original display
    }

    function cleanupAfterSiteKeyCapture() {
        if (activeSiteKeyCapture) {
            document.removeEventListener('keydown', handleSiteKeyCaptureEvent, true);
            activeSiteKeyCapture = null;
        }
    }

    function isSiteKeyConflicting(keyToTest, actionNameToExclude, hostname) {
        // Check against other site-specific settings for the *same hostname* being edited
        const siteSettingsBeingEdited = temporarySiteSpecificSettings;
        for (const actionName in siteSettingsBeingEdited) {
            if (actionName === actionNameToExclude) continue;
            const siteShortcutOverride = siteSettingsBeingEdited[actionName];

            if (siteShortcutOverride.hasOwnProperty('key') && siteShortcutOverride.key === keyToTest) {
                // This site-specific key conflicts. Check if it's enabled.
                const isEnabled = siteShortcutOverride.hasOwnProperty('enabled')
                                ? siteShortcutOverride.enabled
                                : (currentSettings[actionName] ? currentSettings[actionName].enabled : DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].defaultEnabled);
                if (isEnabled) return true;
            }
        }

        // Check against global settings that are NOT overridden by a site-specific *key* for this hostname
        for (const actionName in currentSettings) {
            if (actionName === actionNameToExclude) continue;
            
            const globalShortcut = currentSettings[actionName]; // This is the global setting {enabled, key, isCustom, isNowChord}
            const siteOverrideForThisAction = siteSettingsBeingEdited[actionName]; // Potential override for this action on this site

            // If there's a site-specific key override for this global action, it was already checked above. So skip.
            if (siteOverrideForThisAction && siteOverrideForThisAction.hasOwnProperty('key')) {
                continue;
            }

            // At this point, the action uses its global key. Check if this global key conflicts.
            if (globalShortcut.key === keyToTest) {
                // The global key matches. Now check if this action is effectively enabled for the site.
                // It's enabled if:
                // 1. Globally enabled AND no site-specific 'enabled' override exists, OR
                // 2. Site-specifically 'enabled: true' override exists.
                let isEffectivelyEnabledForSite = globalShortcut.enabled;
                if (siteOverrideForThisAction && siteOverrideForThisAction.hasOwnProperty('enabled')) {
                    isEffectivelyEnabledForSite = siteOverrideForThisAction.enabled;
                }
                
                if (isEffectivelyEnabledForSite) return true; // Global key conflicts and is active for this site.
            }
        }
        return false;
    }

    function getSiteConflictingActionDetails(keyToTest, actionNameToExclude, hostname) {
        const siteSettingsBeingEdited = temporarySiteSpecificSettings;
        for (const actionName in siteSettingsBeingEdited) {
            if (actionName === actionNameToExclude) continue;
            const siteShortcutOverride = siteSettingsBeingEdited[actionName];
            if (siteShortcutOverride.hasOwnProperty('key') && siteShortcutOverride.key === keyToTest) {
                 const isEnabled = siteShortcutOverride.hasOwnProperty('enabled')
                                ? siteShortcutOverride.enabled
                                : (currentSettings[actionName] ? currentSettings[actionName].enabled : DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].defaultEnabled);
                if (isEnabled) return { description: DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].description, source: 'Site Specific (currently editing)' };
            }
        }

        for (const actionName in currentSettings) {
            if (actionName === actionNameToExclude) continue;
            const globalShortcut = currentSettings[actionName];
            const siteOverrideForThisAction = siteSettingsBeingEdited[actionName];

            if (siteOverrideForThisAction && siteOverrideForThisAction.hasOwnProperty('key')) {
                continue; // Already handled by the loop above
            }

            if (globalShortcut.key === keyToTest) {
                let isEffectivelyEnabledForSite = globalShortcut.enabled;
                if (siteOverrideForThisAction && siteOverrideForThisAction.hasOwnProperty('enabled')) {
                    isEffectivelyEnabledForSite = siteOverrideForThisAction.enabled;
                }
                if (isEffectivelyEnabledForSite) {
                    return { description: DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].description, source: 'Global (active on this site)' };
                }
            }
        }
        return { description: 'Unknown action', source: 'Unknown' }; // Fallback
    }
    // --- End Site Overrides Management ---


    function loadSettings() {
        chrome.storage.sync.get(['shortcutSettings', 'disabledSites', 'globalSettings', 'siteOverrides'], (data) => {
            const loadedShortcutSettings = data.shortcutSettings || {};
            currentDisabledSites = data.disabledSites || [...DEFAULT_GLOBAL_SETTINGS.disabledSites];
            // Store all global settings, including our new ones
            currentGlobalSettingsState = { ...DEFAULT_GLOBAL_SETTINGS, ...(data.globalSettings || {}) };
            const global = currentGlobalSettingsState; // Use this for consistency below
            currentSiteOverrides = data.siteOverrides || {};

            currentSettings = {}; // This will store the new structure: { actionName: { enabled, key, isCustom } }

            Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
                const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
                const loadedSetting = loadedShortcutSettings[actionName];

                if (typeof loadedSetting === 'object' && loadedSetting !== null && loadedSetting.hasOwnProperty('key')) {
                    // New format already exists
                    let isCustom = loadedSetting.isCustom || (loadedSetting.key !== defaultConfig.defaultKey);
                    const isNowChord = loadedSetting.hasOwnProperty('isNowChord') ? loadedSetting.isNowChord : loadedSetting.key.includes(' ');
                    const defaultIsChord = defaultConfig.defaultKey.includes(' ');
                    if (isNowChord !== defaultIsChord && loadedSetting.key !== defaultConfig.defaultKey) { // if structure changed and key is different
                        isCustom = true;
                    } else if (isNowChord !== defaultIsChord && loadedSetting.key === defaultConfig.defaultKey && defaultConfig.chordPrefix === undefined && isNowChord) {
                        // Handles case where default was "X" and user made it "X Y" -> custom because structure changed
                        // But if default was "Ctrl+K C" and user saved "Ctrl+K C", it's not custom by this rule unless keys differ
                        isCustom = true;
                    }


                    currentSettings[actionName] = {
                        enabled: loadedSetting.hasOwnProperty('enabled') ? loadedSetting.enabled : defaultConfig.defaultEnabled,
                        key: loadedSetting.key,
                        isCustom: isCustom,
                        isNowChord: isNowChord
                    };
                } else if (typeof loadedSetting === 'boolean') {
                    // Old format (just enabled status) - migrate
                    currentSettings[actionName] = {
                        enabled: loadedSetting,
                        key: defaultConfig.defaultKey,
                        isCustom: false,
                        isNowChord: defaultConfig.defaultKey.includes(' ')
                    };
                } else {
                    // No setting found, use defaults
                    currentSettings[actionName] = {
                        enabled: defaultConfig.defaultEnabled,
                        key: defaultConfig.defaultKey,
                        isCustom: false,
                        isNowChord: defaultConfig.defaultKey.includes(' ')
                    };
                }
            });

            showFeedbackCheckbox.checked = global.showFeedback;
            feedbackDurationInput.value = global.feedbackDuration;

            // Populate new Global Activation Settings
            activationShortcutDisplay.textContent = getDisplayKey(global.activationShortcut);
            incorrectActivationWarningThresholdInput.value = global.incorrectActivationWarningThreshold;
            
            editActivationShortcutButton.addEventListener('click', startActivationKeyCapture);
            resetActivationShortcutButton.addEventListener('click', resetActivationShortcutToDefault);
            resetActivationShortcutButton.style.display = (global.activationShortcut !== DEFAULT_GLOBAL_SETTINGS.activationShortcut) ? 'inline-block' : 'none';

            renderShortcuts();
            renderDisabledSites();
            renderConfiguredSitesList(); // New function to render the list of sites with overrides
        });
    }

    saveButton.addEventListener('click', () => {
        const shortcutSettingsToSave = {};
        Object.keys(currentSettings).forEach(actionName => {
            const checkbox = document.getElementById(`toggle_${actionName}`);
            const currentKey = currentSettings[actionName].key;
            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            const defaultKey = defaultConfig.defaultKey;
            
            const isNowChord = currentKey.includes(' ');
            let isCustom = currentKey !== defaultKey;

            // If the default was a chord and the new one is not (or vice versa), it's custom.
            // Also, if the default was not a chord, but the new one is, it's custom.
            // Or if default was chord, new is chord, but different keys.
            const defaultIsChord = defaultKey.includes(' ');
            if (isNowChord !== defaultIsChord) {
                isCustom = true;
            }
            // If both are chords or both are not, the simple currentKey !== defaultKey check is enough.

            shortcutSettingsToSave[actionName] = {
                enabled: checkbox ? checkbox.checked : currentSettings[actionName].enabled,
                key: currentKey,
                isCustom: isCustom,
                isNowChord: isNowChord // Add this new property
            };
        });

        const globalSettingsToSave = {
            showFeedback: showFeedbackCheckbox.checked,
            feedbackDuration: parseInt(feedbackDurationInput.value, 10) || DEFAULT_GLOBAL_SETTINGS.feedbackDuration,
            activationShortcut: tempActivationShortcut || currentGlobalSettingsState.activationShortcut, // Use temp if capture happened
            incorrectActivationWarningThreshold: parseInt(incorrectActivationWarningThresholdInput.value, 10) || DEFAULT_GLOBAL_SETTINGS.incorrectActivationWarningThreshold
        };
        // After saving, tempActivationShortcut should be cleared or aligned with currentGlobalSettingsState
        currentGlobalSettingsState.activationShortcut = globalSettingsToSave.activationShortcut;
        tempActivationShortcut = null;


        chrome.storage.sync.set({
            shortcutSettings: shortcutSettingsToSave,
            disabledSites: currentDisabledSites,
            globalSettings: globalSettingsToSave,
            siteOverrides: currentSiteOverrides // Save site-specific overrides
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