// options.js
document.addEventListener('DOMContentLoaded', () => {
    const shortcutsListContainer = document.getElementById('shortcutsList');
    const saveButton = document.getElementById('saveSettings');
    const statusMessage = document.getElementById('statusMessage');
    // globalResetButtonContainer is dynamically created if needed
    const newDisabledSiteInput = document.getElementById('newDisabledSite');
    const addDisabledSiteButton = document.getElementById('addDisabledSite');
    const disabledSitesUl = document.getElementById('disabledSitesList');

    const showFeedbackCheckbox = document.getElementById('showFeedbackEnabled');
    const feedbackDurationInput = document.getElementById('feedbackDuration');

    const activationShortcutDisplay = document.getElementById('activationShortcutDisplay');
    const editActivationShortcutButton = document.getElementById('editActivationShortcut');
    const resetActivationShortcutButton = document.getElementById('resetActivationShortcut');
    const incorrectActivationWarningThresholdInput = document.getElementById('incorrectActivationWarningThresholdInput');

    const siteOverrideHostnameInput = document.getElementById('siteOverrideHostname');
    const manageSiteOverridesButton = document.getElementById('manageSiteOverrides');
    const siteOverridesManagerDiv = document.getElementById('siteOverridesManager');
    const editingSiteHostnameHeader = document.getElementById('editingSiteHostname');
    const activeSiteOverrideHostnameSpan = document.getElementById('activeSiteOverrideHostname');
    const siteSpecificShortcutsListDiv = document.getElementById('siteSpecificShortcutsList');
    const saveSiteOverridesButton = document.getElementById('saveSiteOverrides');
    const removeSiteOverridesButton = document.getElementById('removeSiteOverrides');
    const closeSiteOverridesManagerButton = document.getElementById('closeSiteOverridesManager');
    const configuredSitesListUl = document.getElementById('configuredSitesList');

    let currentSettings = {};
    let currentGlobalSettingsState = {};
    let currentDisabledSites = [];
    let currentSiteOverrides = {};
    let activeManagingHostname = null;
    let temporarySiteSpecificSettings = {};

    // IS_MAC_COMMON is defined in common.js, available globally here
    // const IS_MAC_OPTIONS = IS_MAC_COMMON; // Alias if preferred, or use IS_MAC_COMMON directly

    let activeActivationKeyCapture = null;
    let tempActivationShortcut = null;

    function displayStatus(message, success = true) {
        statusMessage.textContent = message;
        statusMessage.classList.remove('success', 'error');
        statusMessage.classList.add(success ? 'success' : 'error');
        statusMessage.style.display = 'block';
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, success ? 3000 : 5000);
    }

    // getDisplayKeyForCommon is from common.js

    function renderShortcuts(specificActionToUpdate = null) {
        if (!specificActionToUpdate) {
            shortcutsListContainer.innerHTML = ''; // Clear existing only for full re-render
        }
        const categories = {};

        Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            if (!categories[defaultConfig.category]) {
                categories[defaultConfig.category] = [];
            }
            categories[defaultConfig.category].push({
                actionName,
                description: defaultConfig.description,
                category: defaultConfig.category,
                defaultKey: defaultConfig.defaultKey
            });
        });

        for (const categoryName in categories) {
            if (!specificActionToUpdate) { // Only add category title on full render
                const categoryTitle = document.createElement('h3');
                categoryTitle.textContent = categoryName;
                categoryTitle.className = 'category-title';
                shortcutsListContainer.appendChild(categoryTitle);
            }

            categories[categoryName].sort((a, b) => a.description.localeCompare(b.description)).forEach(shortcut => {
                // If specificActionToUpdate is provided, only update that one item
                if (specificActionToUpdate && shortcut.actionName !== specificActionToUpdate) {
                    return;
                }
                
                let item = shortcutsListContainer.querySelector(`.shortcut-item[data-action-name="${shortcut.actionName}"]`);
                if (specificActionToUpdate && item) {
                    // Item exists, update it
                } else if (specificActionToUpdate && !item) {
                    return; // Should not happen if called correctly
                } else {
                    // Full render or item doesn't exist, create it
                    item = document.createElement('div');
                    item.className = 'shortcut-item';
                    item.dataset.actionName = shortcut.actionName; // For easier selection
                    // Append to correct category if doing full render, otherwise it's an update
                    if (!specificActionToUpdate) shortcutsListContainer.appendChild(item);
                }


                const setting = currentSettings[shortcut.actionName];
                const keyToDisplay = setting && setting.key ? setting.key : shortcut.defaultKey;
                
                // IMPORTANT: For enabled state, if the item already exists (e.g. during targeted update after key change),
                // preserve its current DOM checked state rather than re-evaluating from currentSettings.
                // This is because currentSettings.enabled might not have been updated by a programmatic uncheck yet.
                const existingCheckbox = item.querySelector(`input[type="checkbox"][data-action="${shortcut.actionName}"]`);
                const isEnabled = existingCheckbox && specificActionToUpdate // If updating existing and checkbox exists
                                    ? existingCheckbox.checked
                                    : (setting && setting.enabled !== undefined ? setting.enabled : DEFAULT_SHORTCUT_SETTINGS_CONFIG[shortcut.actionName].defaultEnabled);
                
                const isCustom = setting && setting.isCustom;
                const keyDisplay = getDisplayKeyForCommon(keyToDisplay, IS_MAC_COMMON);
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
                // If it's a full render, new item gets appended already.
                // If it's an update, innerHTML just got replaced.

                 // Re-attach listeners for the newly created/updated buttons within this item
                item.querySelector(`.edit-shortcut[data-action="${shortcut.actionName}"]`).addEventListener('click', (event) => {
                    startKeyCapture(shortcut.actionName, event.target.closest('.shortcut-item'));
                });
                item.querySelector(`.reset-shortcut[data-action="${shortcut.actionName}"]`).addEventListener('click', (event) => {
                    resetShortcutToDefault(shortcut.actionName);
                });
            });
        }

        if (!specificActionToUpdate && !document.getElementById('resetAllShortcuts')) {
            const resetButton = document.createElement('button');
            resetButton.id = 'resetAllShortcuts';
            resetButton.textContent = 'Reset All Global Shortcuts to Defaults';
            resetButton.className = 'secondary';
            resetButton.style.marginTop = '20px';
            const globalShortcutsWrapper = document.getElementById('shortcutsListContainer');
            if (globalShortcutsWrapper) globalShortcutsWrapper.appendChild(resetButton);
            resetButton.addEventListener('click', resetAllShortcutsToDefault);
        }
    }

    let activeKeyCapture = null;

    function startKeyCapture(actionName, itemElement) {
        if (activeKeyCapture) cancelKeyCapture();
        const setting = currentSettings[actionName];
        const originalKey = setting.key;
        activeKeyCapture = { actionName, originalKey, itemElement, part: 'first', capturedFirstKey: null, capturedSecondKey: null };
        const keyKbd = itemElement.querySelector('.keys');
        const actionsDiv = itemElement.querySelector('.actions');
        keyKbd.innerHTML = `<em>Press first key / first part of chord...</em>`;
        actionsDiv.innerHTML = `
            <button class="save-captured-key" data-action="${actionName}">Save Key</button>
            <button class="cancel-captured-key" data-action="${actionName}">Cancel</button>
        `;
        itemElement.querySelector('.save-captured-key').addEventListener('click', () => saveCapturedKey(activeKeyCapture.actionName));
        itemElement.querySelector('.cancel-captured-key').addEventListener('click', cancelKeyCapture);
        itemElement.querySelector('.save-captured-key').disabled = true;
        document.addEventListener('keydown', handleKeyCaptureEvent, true);
    }

    function formatCapturedKey(event) {
        const parts = [];
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.altKey) parts.push('Alt');
        if (event.shiftKey) parts.push('Shift');
        if (IS_MAC_COMMON && event.metaKey && !event.ctrlKey) parts.push('Meta');
        let key = event.key;
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return null;
        if (key.startsWith('Arrow')) { /* No change */ }
        else if (key === ' ') key = 'Space';
        else if (key.length === 1 && key.match(/[a-zA-Z0-9]/)) key = key.toUpperCase();
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
            if (!capturedKeyString) {
                keyKbd.innerHTML = `<em style="color: orange;">Prefix must include a non-modifier key. Try Ctrl+K, etc.</em>`;
                if (saveButton) saveButton.disabled = true;
                return;
            }
            activeKeyCapture.capturedFirstKey = capturedKeyString;
            keyKbd.innerHTML = `<em>${getDisplayKeyForCommon(activeKeyCapture.capturedFirstKey, IS_MAC_COMMON)} + Press optional second key... (or Save)</em>`;
            activeKeyCapture.part = 'second';
            if (saveButton) saveButton.disabled = false;
        } else if (activeKeyCapture.part === 'second') {
            if (!capturedKeyString) {
                keyKbd.innerHTML = `<em>${getDisplayKeyForCommon(activeKeyCapture.capturedFirstKey, IS_MAC_COMMON)} + <span style="color: orange;">Second key must include a non-modifier.</span> (or Save first part)</em>`;
                return;
            }
            activeKeyCapture.capturedSecondKey = capturedKeyString;
            keyKbd.innerHTML = `<em>${getDisplayKeyForCommon(activeKeyCapture.capturedFirstKey + ' ' + activeKeyCapture.capturedSecondKey, IS_MAC_COMMON)}</em>`;
            if (saveButton) saveButton.disabled = false;
        }
    }

    function saveCapturedKey(actionName) {
        if (!activeKeyCapture || activeKeyCapture.actionName !== actionName) return;
        let finalKeyToSave;
        if (activeKeyCapture.capturedFirstKey && activeKeyCapture.capturedSecondKey) {
            finalKeyToSave = `${activeKeyCapture.capturedFirstKey} ${activeKeyCapture.capturedSecondKey}`;
        } else if (activeKeyCapture.capturedFirstKey) {
            finalKeyToSave = activeKeyCapture.capturedFirstKey;
        } else {
            displayStatus(`Key not fully captured for ${actionName}. Please try again.`, false);
            cancelKeyCapture();
            return;
        }
        if (isKeyConflicting(finalKeyToSave, actionName)) {
            const conflictingAction = getConflictingAction(finalKeyToSave, actionName);
            let conflictDescription = "another shortcut";
            if (conflictingAction === '__ACTIVATION_SHORTCUT__') {
                conflictDescription = "the global Activation Shortcut";
            } else if (DEFAULT_SHORTCUT_SETTINGS_CONFIG[conflictingAction]) {
                conflictDescription = `"${DEFAULT_SHORTCUT_SETTINGS_CONFIG[conflictingAction].description}"`;
            }
            displayStatus(`Error: Key "${getDisplayKeyForCommon(finalKeyToSave, IS_MAC_COMMON)}" is already used by ${conflictDescription}.`, false);
            return;
        }
        
        const itemElementToUpdate = activeKeyCapture.itemElement; // Store before cleanup
        
        currentSettings[actionName].key = finalKeyToSave;
        // isCustom and isNowChord will be calculated correctly on save or by renderShortcuts
        const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
        currentSettings[actionName].isCustom = (finalKeyToSave !== defaultConfig.defaultKey || finalKeyToSave.includes(' ') !== defaultConfig.defaultKey.includes(' '));
        currentSettings[actionName].isNowChord = finalKeyToSave.includes(' ');

        cleanupAfterKeyCapture(); // This removes old event listeners on capture buttons
        
        // Targeted DOM update for the specific item
        renderShortcuts(actionName); // Pass actionName to re-render only this item

        displayStatus(`Key for "${DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].description}" updated. Save settings to make permanent.`, true);
    }
    
    function isKeyConflicting(keyToTest, actionNameToExclude) {
        for (const actionName in currentSettings) {
            if (actionName === actionNameToExclude) continue;
            const setting = currentSettings[actionName];
            if (setting.enabled && setting.key === keyToTest) return true;
        }
        if (currentGlobalSettingsState.activationShortcut === keyToTest && actionNameToExclude !== '__ACTIVATION_SHORTCUT__') {
            return true;
        }
        return false;
    }

    function getConflictingAction(keyToTest, actionNameToExclude) {
        for (const actionName in currentSettings) {
            if (actionName === actionNameToExclude) continue;
            const setting = currentSettings[actionName];
            if (setting.enabled && setting.key === keyToTest) return actionName;
        }
        if (currentGlobalSettingsState.activationShortcut === keyToTest && actionNameToExclude !== '__ACTIVATION_SHORTCUT__') {
            return '__ACTIVATION_SHORTCUT__';
        }
        return null;
    }

    function cancelKeyCapture() {
        if (!activeKeyCapture) return;
        const actionNameToRestore = activeKeyCapture.actionName;
        cleanupAfterKeyCapture();
        renderShortcuts(actionNameToRestore); // Re-render the specific item to restore its state
    }

    function cleanupAfterKeyCapture() {
        if (activeKeyCapture) {
            document.removeEventListener('keydown', handleKeyCaptureEvent, true);
            activeKeyCapture = null;
        }
    }

    function startActivationKeyCapture() {
        if (activeKeyCapture) cancelKeyCapture();
        if (activeActivationKeyCapture) cancelActivationKeyCapture();
        const originalKey = currentGlobalSettingsState.activationShortcut;
        tempActivationShortcut = originalKey;
        activeActivationKeyCapture = { originalKey, capturedKey: null };
        activationShortcutDisplay.innerHTML = `<em>Press new shortcut key...</em>`;
        editActivationShortcutButton.style.display = 'none';
        resetActivationShortcutButton.style.display = 'none';
        const tempSaveButton = document.createElement('button');
        tempSaveButton.textContent = 'Save Activation Key';
        tempSaveButton.id = 'saveCapturedActivationKey';
        tempSaveButton.disabled = true;
        const tempCancelButton = document.createElement('button');
        tempCancelButton.textContent = 'Cancel';
        tempCancelButton.id = 'cancelCapturedActivationKey';
        const actionsDiv = editActivationShortcutButton.parentElement;
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
        const capturedKeyString = formatCapturedKey(event);
        const saveButton = document.getElementById('saveCapturedActivationKey');
        if (!capturedKeyString) {
            activationShortcutDisplay.innerHTML = `<em style="color: orange;">Shortcut must include a non-modifier key.</em>`;
            if (saveButton) saveButton.disabled = true;
            return;
        }
        activeActivationKeyCapture.capturedKey = capturedKeyString;
        activationShortcutDisplay.innerHTML = `<em>${getDisplayKeyForCommon(capturedKeyString, IS_MAC_COMMON)}</em>`;
        if (saveButton) saveButton.disabled = false;
    }

    function saveActivationCapturedKey() {
        if (!activeActivationKeyCapture || !activeActivationKeyCapture.capturedKey) {
            displayStatus('Activation key not fully captured.', false);
            cancelActivationKeyCapture();
            return;
        }
        const newKey = activeActivationKeyCapture.capturedKey;
        if (isActivationKeyConflicting(newKey)) {
            const conflictingDetails = getActivationConflictingActionDetails(newKey);
            displayStatus(`Error: Key "${getDisplayKeyForCommon(newKey, IS_MAC_COMMON)}" is already used by "${conflictingDetails.description}". Choose a different key.`, false);
            activeActivationKeyCapture.capturedKey = null;
            activationShortcutDisplay.innerHTML = `<em>Conflict! Press new shortcut key...</em>`;
            const saveBtn = document.getElementById('saveCapturedActivationKey');
            if(saveBtn) saveBtn.disabled = true;
            return;
        }
        currentGlobalSettingsState.activationShortcut = newKey;
        tempActivationShortcut = newKey;
        cleanupAfterActivationKeyCapture();
        activationShortcutDisplay.textContent = getDisplayKeyForCommon(newKey, IS_MAC_COMMON);
        resetActivationShortcutButton.style.display = (newKey !== DEFAULT_GLOBAL_SETTINGS.activationShortcut) ? 'inline-block' : 'none';
        displayStatus('Activation shortcut updated. Save settings to make permanent.', true);
    }

    function isActivationKeyConflicting(keyToTest, isResettingDefault = false) {
        for (const actionName in currentSettings) {
            const setting = currentSettings[actionName];
            if (setting.enabled && setting.key === keyToTest) {
                return true; 
            }
        }
        return false;
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
        return { description: 'Unknown action', source: 'Unknown' };
    }

    function cancelActivationKeyCapture() {
        if (!activeActivationKeyCapture) return;
        cleanupAfterActivationKeyCapture();
        activationShortcutDisplay.textContent = getDisplayKeyForCommon(currentGlobalSettingsState.activationShortcut, IS_MAC_COMMON);
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
    }
    
    function resetActivationShortcutToDefault() {
        const defaultKey = DEFAULT_GLOBAL_SETTINGS.activationShortcut;
        if (currentGlobalSettingsState.activationShortcut === defaultKey) return;
        if (isActivationKeyConflicting(defaultKey, true)) {
            const conflictingDetails = getActivationConflictingActionDetails(defaultKey);
            displayStatus(`Error: Default key "${getDisplayKeyForCommon(defaultKey, IS_MAC_COMMON)}" conflicts with "${conflictingDetails.description}". Cannot reset.`, false);
            return;
        }
        currentGlobalSettingsState.activationShortcut = defaultKey;
        tempActivationShortcut = defaultKey;
        activationShortcutDisplay.textContent = getDisplayKeyForCommon(defaultKey, IS_MAC_COMMON);
        resetActivationShortcutButton.style.display = 'none';
        displayStatus('Activation shortcut reset to default. Save settings to apply.', true);
    }

    function resetShortcutToDefault(actionName) {
        if (DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName]) {
            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            // Preserve current 'enabled' state
            const currentEnabledState = currentSettings[actionName] ? currentSettings[actionName].enabled : defaultConfig.defaultEnabled;
            currentSettings[actionName] = {
                enabled: currentEnabledState,
                key: defaultConfig.defaultKey,
                isCustom: false,
                isNowChord: defaultConfig.defaultKey.includes(' ')
            };
            renderShortcuts(actionName); // Re-render only this specific shortcut's display
            displayStatus(`Shortcut "${defaultConfig.description}" reset to default key. Save settings to apply.`, true);
        }
    }

    function resetAllShortcutsToDefault() {
        if (confirm("Are you sure you want to reset ALL shortcuts to their default keybindings? This cannot be undone until you save.")) {
            Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
                const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
                currentSettings[actionName] = {
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
                renderDisabledSites();
            });
            li.appendChild(removeButton);
            disabledSitesUl.appendChild(li);
        });
    }
    
    addDisabledSiteButton.addEventListener('click', () => {
        const newSite = newDisabledSiteInput.value.trim().toLowerCase();
        if (newSite && !currentDisabledSites.includes(newSite)) {
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
        if (e.key === 'Enter') addDisabledSiteButton.click();
    });

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
            const nameSpan = document.createElement('span');
            nameSpan.textContent = hostname;
            li.appendChild(nameSpan);
            const buttonsDiv = document.createElement('div');
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.className = 'edit-site-override';
            editButton.title = `Edit overrides for ${hostname}`;
            editButton.dataset.hostname = hostname;
            editButton.addEventListener('click', () => {
                siteOverrideHostnameInput.value = hostname;
                openSiteOverridesManager(hostname);
            });
            buttonsDiv.appendChild(editButton);
            const quickDeleteButton = document.createElement('button');
            quickDeleteButton.textContent = 'Delete';
            quickDeleteButton.className = 'danger';
            quickDeleteButton.title = `Delete all overrides for ${hostname}`;
            quickDeleteButton.dataset.hostname = hostname;
            quickDeleteButton.addEventListener('click', () => {
                if (confirm(`Are you sure you want to delete all shortcut overrides for "${hostname}"? This action will be saved when you click 'Save Settings'.`)) {
                    delete currentSiteOverrides[hostname];
                    if (activeManagingHostname === hostname) closeOverridesManagerUI();
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
        temporarySiteSpecificSettings = JSON.parse(JSON.stringify(currentSiteOverrides[activeManagingHostname] || {}));
        editingSiteHostnameHeader.textContent = `Editing: ${activeManagingHostname}`;
        activeSiteOverrideHostnameSpan.textContent = activeManagingHostname;
        renderSiteSpecificShortcuts(activeManagingHostname);
        siteOverridesManagerDiv.style.display = 'block';
        siteOverrideHostnameInput.value = '';
    }

    function closeOverridesManagerUI() {
        siteOverridesManagerDiv.style.display = 'none';
        activeManagingHostname = null;
        temporarySiteSpecificSettings = {};
        siteSpecificShortcutsListDiv.innerHTML = '';
        editingSiteHostnameHeader.textContent = '';
        activeSiteOverrideHostnameSpan.textContent = '';
    }

    manageSiteOverridesButton.addEventListener('click', () => {
        const hostname = siteOverrideHostnameInput.value.trim().toLowerCase();
        if (!hostname) {
            displayStatus('Please enter a hostname to configure (e.g., example.com or *.example.com).', false);
            return;
        }
        if (!(/^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/.test(hostname) || /^[a-z0-9-]+\.[a-z]{2,}$/.test(hostname) || hostname === "localhost")) {
            displayStatus(`Invalid hostname pattern: ${hostname}. Use format like 'example.com' or '*.example.com'.`, false);
            return;
        }
        openSiteOverridesManager(hostname);
    });
    siteOverrideHostnameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') manageSiteOverridesButton.click();
    });
    closeSiteOverridesManagerButton.addEventListener('click', closeOverridesManagerUI);

    function renderSiteSpecificShortcuts(hostname, specificActionToUpdate = null) {
        if (!specificActionToUpdate) {
            siteSpecificShortcutsListDiv.innerHTML = ''; // Clear previous content only on full render
        }
        const categories = {};
        Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
            const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            if (!categories[defaultConfig.category]) categories[defaultConfig.category] = [];
            categories[defaultConfig.category].push({
                actionName,
                description: defaultConfig.description,
                defaultKey: defaultConfig.defaultKey,
                defaultEnabled: defaultConfig.defaultEnabled
            });
        });

        for (const categoryName in categories) {
            if (!specificActionToUpdate) {
                const categoryTitle = document.createElement('h3');
                categoryTitle.textContent = categoryName;
                categoryTitle.className = 'category-title';
                siteSpecificShortcutsListDiv.appendChild(categoryTitle);
            }

            categories[categoryName].sort((a, b) => a.description.localeCompare(b.description)).forEach(shortcut => {
                if (specificActionToUpdate && shortcut.actionName !== specificActionToUpdate) {
                    return;
                }

                let item = siteSpecificShortcutsListDiv.querySelector(`.shortcut-item[data-action-name="${shortcut.actionName}"]`);
                if (specificActionToUpdate && item) {
                    // Item exists, will be updated
                } else if (specificActionToUpdate && !item) {
                    return; 
                } else {
                    item = document.createElement('div');
                    item.className = 'shortcut-item';
                    item.dataset.actionName = shortcut.actionName;
                    if (!specificActionToUpdate) siteSpecificShortcutsListDiv.appendChild(item);
                }


                const siteOverride = temporarySiteSpecificSettings[shortcut.actionName];
                const globalSetting = currentSettings[shortcut.actionName] || {
                    key: shortcut.defaultKey,
                    enabled: shortcut.defaultEnabled,
                    isCustom: false,
                    isNowChord: shortcut.defaultKey.includes(' ')
                };
                let effectiveKey = globalSetting.key, effectiveEnabled = globalSetting.enabled;
                let isSiteCustomKey = false, isSiteCustomEnabled = false;

                if (siteOverride) {
                    if (siteOverride.hasOwnProperty('key')) { effectiveKey = siteOverride.key; isSiteCustomKey = true; }
                    if (siteOverride.hasOwnProperty('enabled')) { effectiveEnabled = siteOverride.enabled; isSiteCustomEnabled = true; }
                }
                
                const existingCheckbox = item.querySelector(`.toggle-site-shortcut[data-action="${shortcut.actionName}"]`);
                if (existingCheckbox && specificActionToUpdate) {
                    effectiveEnabled = existingCheckbox.checked; // Preserve DOM state if only key changed
                }


                const keyDisplay = getDisplayKeyForCommon(effectiveKey, IS_MAC_COMMON);
                let customKeyIndicator = '';
                if (isSiteCustomKey) customKeyIndicator = ' <span class="custom-indicator" title="Site-specific key">*S</span>';
                else if (globalSetting.isCustom) customKeyIndicator = ' <span class="custom-indicator" title="Globally custom key">*G</span>';
                
                const sourceIndicatorText = (isSiteCustomKey || isSiteCustomEnabled) ? `Site Specific` : (globalSetting.isCustom ? `Global Custom` : `Global Default`);

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
                
                item.querySelector('.toggle-site-shortcut').addEventListener('change', (event) => {
                    const action = event.target.dataset.action;
                    if (!temporarySiteSpecificSettings[action]) temporarySiteSpecificSettings[action] = {};
                    temporarySiteSpecificSettings[action].enabled = event.target.checked;
                    renderSiteSpecificShortcuts(hostname, action); // Re-render only this item
                });
                item.querySelector('.reset-site-shortcut').addEventListener('click', (event) => {
                    const action = event.target.dataset.action;
                    if (temporarySiteSpecificSettings[action]) {
                        delete temporarySiteSpecificSettings[action].key;
                        delete temporarySiteSpecificSettings[action].enabled;
                        if (Object.keys(temporarySiteSpecificSettings[action]).length === 0) delete temporarySiteSpecificSettings[action];
                    }
                    renderSiteSpecificShortcuts(hostname, action); // Re-render only this item
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
        const cleanTemporarySettings = {};
        for (const actionName in temporarySiteSpecificSettings) {
            const override = temporarySiteSpecificSettings[actionName];
            if (override.hasOwnProperty('key') || override.hasOwnProperty('enabled')) {
                if (!cleanTemporarySettings[actionName]) cleanTemporarySettings[actionName] = {};
                if (override.hasOwnProperty('key')) cleanTemporarySettings[actionName].key = override.key;
                if (override.hasOwnProperty('enabled')) cleanTemporarySettings[actionName].enabled = override.enabled;
            }
        }
        if (Object.keys(cleanTemporarySettings).length > 0) currentSiteOverrides[activeManagingHostname] = JSON.parse(JSON.stringify(cleanTemporarySettings));
        else delete currentSiteOverrides[activeManagingHostname];
        displayStatus(`Changes for "${activeManagingHostname}" applied locally. Save all settings to make them permanent.`, true);
        closeOverridesManagerUI();
        renderConfiguredSitesList();
    });

    removeSiteOverridesButton.addEventListener('click', () => {
        if (!activeManagingHostname) return;
        if (confirm(`Are you sure you want to remove ALL shortcut configurations for "${activeManagingHostname}"? This action will be applied locally. Click 'Save Settings' to make it permanent.`)) {
            delete currentSiteOverrides[activeManagingHostname];
            temporarySiteSpecificSettings = {};
            displayStatus(`All configurations for "${activeManagingHostname}" removed locally. Save all settings to make permanent.`, true);
            closeOverridesManagerUI();
            renderConfiguredSitesList();
        }
    });

    let activeSiteKeyCapture = null;

    function startSiteKeyCapture(actionName, itemElement, hostname) {
        if (activeKeyCapture) cancelKeyCapture();
        if (activeSiteKeyCapture) cancelSiteKeyCapture();
        const siteOverride = temporarySiteSpecificSettings[actionName] || {};
        const globalSetting = currentSettings[actionName] || { key: DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].defaultKey };
        const originalKey = siteOverride.key || globalSetting.key;
        activeSiteKeyCapture = { actionName, originalKey, itemElement, hostname, part: 'first', capturedFirstKey: null, capturedSecondKey: null };
        const keyKbd = itemElement.querySelector('.keys.site-specific-keys');
        const actionsDiv = itemElement.querySelector('.actions.site-specific-actions');
        keyKbd.innerHTML = `<em>Press first key / chord part...</em>`;
        actionsDiv.innerHTML = `
            <button class="save-captured-site-key" data-action="${actionName}" style="font-size:0.8em; padding: 2px 6px;">Save Site Key</button>
            <button class="cancel-captured-site-key" data-action="${actionName}" style="font-size:0.8em; padding: 2px 6px;">Cancel</button>
        `;
        itemElement.querySelector('.save-captured-site-key').addEventListener('click', () => saveSiteCapturedKey(activeSiteKeyCapture.actionName));
        itemElement.querySelector('.cancel-captured-site-key').addEventListener('click', cancelSiteKeyCapture);
        itemElement.querySelector('.save-captured-site-key').disabled = true;
        document.addEventListener('keydown', handleSiteKeyCaptureEvent, true);
    }

    function handleSiteKeyCaptureEvent(event) {
        if (!activeSiteKeyCapture) return;
        event.preventDefault();
        event.stopPropagation();
        const capturedKeyString = formatCapturedKey(event);
        const saveButton = activeSiteKeyCapture.itemElement.querySelector('.save-captured-site-key');
        const keyKbd = activeSiteKeyCapture.itemElement.querySelector('.keys.site-specific-keys');

        if (activeSiteKeyCapture.part === 'first') {
            if (!capturedKeyString) {
                keyKbd.innerHTML = `<em style="color: orange;">Prefix must include a non-modifier key.</em>`;
                if (saveButton) saveButton.disabled = true;
                return;
            }
            activeSiteKeyCapture.capturedFirstKey = capturedKeyString;
            keyKbd.innerHTML = `<em>${getDisplayKeyForCommon(activeSiteKeyCapture.capturedFirstKey, IS_MAC_COMMON)} + Press optional second key... (or Save)</em>`;
            activeSiteKeyCapture.part = 'second';
            if (saveButton) saveButton.disabled = false;
        } else if (activeSiteKeyCapture.part === 'second') {
            if (!capturedKeyString) {
                keyKbd.innerHTML = `<em>${getDisplayKeyForCommon(activeSiteKeyCapture.capturedFirstKey, IS_MAC_COMMON)} + <span style="color: orange;">Second key must include a non-modifier.</span> (or Save first part)</em>`;
                return;
            }
            activeSiteKeyCapture.capturedSecondKey = capturedKeyString;
            keyKbd.innerHTML = `<em>${getDisplayKeyForCommon(activeSiteKeyCapture.capturedFirstKey + ' ' + activeSiteKeyCapture.capturedSecondKey, IS_MAC_COMMON)}</em>`;
            if (saveButton) saveButton.disabled = false;
        }
    }
    
    function saveSiteCapturedKey(actionName) {
        if (!activeSiteKeyCapture || activeSiteKeyCapture.actionName !== actionName) return;
        let finalKeyToSave;
        if (activeSiteKeyCapture.capturedFirstKey && activeSiteKeyCapture.capturedSecondKey) {
            finalKeyToSave = `${activeSiteKeyCapture.capturedFirstKey} ${activeSiteKeyCapture.capturedSecondKey}`;
        } else if (activeSiteKeyCapture.capturedFirstKey) {
            finalKeyToSave = finalKeyToSave = activeSiteKeyCapture.capturedFirstKey;
        } else {
            displayStatus(`Site-specific key not fully captured for ${actionName}. Please try again.`, false);
            cancelSiteKeyCapture();
            return;
        }
        if (isSiteKeyConflicting(finalKeyToSave, actionName, activeSiteKeyCapture.hostname)) {
            const conflictingDetails = getSiteConflictingActionDetails(finalKeyToSave, actionName, activeSiteKeyCapture.hostname);
            displayStatus(`Error: Key "${getDisplayKeyForCommon(finalKeyToSave, IS_MAC_COMMON)}" for site ${activeSiteKeyCapture.hostname} conflicts with "${conflictingDetails.description}" (Source: ${conflictingDetails.source}). Choose a different key.`, false);
            return;
        }
        if (!temporarySiteSpecificSettings[actionName]) temporarySiteSpecificSettings[actionName] = {};
        temporarySiteSpecificSettings[actionName].key = finalKeyToSave;
        
        const hostnameForRender = activeSiteKeyCapture.hostname;
        cleanupAfterSiteKeyCapture();
        renderSiteSpecificShortcuts(hostnameForRender, actionName); // Re-render only this specific item
        displayStatus(`Site-specific key for "${DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].description}" on ${hostnameForRender} updated. Apply site changes, then Save Settings.`, true);
    }

    function cancelSiteKeyCapture() {
        if (!activeSiteKeyCapture) return;
        const hostname = activeSiteKeyCapture.hostname;
        const actionName = activeSiteKeyCapture.actionName;
        cleanupAfterSiteKeyCapture();
        renderSiteSpecificShortcuts(hostname, actionName); // Re-render the specific item to restore its state
    }

    function cleanupAfterSiteKeyCapture() {
        if (activeSiteKeyCapture) {
            document.removeEventListener('keydown', handleSiteKeyCaptureEvent, true);
            activeSiteKeyCapture = null;
        }
    }

    function isSiteKeyConflicting(keyToTest, actionNameToExclude, hostname) {
        const siteSettingsBeingEdited = temporarySiteSpecificSettings;
        for (const actionName in siteSettingsBeingEdited) {
            if (actionName === actionNameToExclude) continue;
            const siteShortcutOverride = siteSettingsBeingEdited[actionName];
            if (siteShortcutOverride.hasOwnProperty('key') && siteShortcutOverride.key === keyToTest) {
                 const isEnabled = siteShortcutOverride.hasOwnProperty('enabled')
                                ? siteShortcutOverride.enabled
                                : (currentSettings[actionName] ? currentSettings[actionName].enabled : DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].defaultEnabled);
                if (isEnabled) return true;
            }
        }
        for (const actionName in currentSettings) {
            if (actionName === actionNameToExclude) continue;
            const globalShortcut = currentSettings[actionName];
            const siteOverrideForThisAction = siteSettingsBeingEdited[actionName];
            if (siteOverrideForThisAction && siteOverrideForThisAction.hasOwnProperty('key')) continue;
            if (globalShortcut.key === keyToTest) {
                let isEffectivelyEnabledForSite = globalShortcut.enabled;
                if (siteOverrideForThisAction && siteOverrideForThisAction.hasOwnProperty('enabled')) {
                    isEffectivelyEnabledForSite = siteOverrideForThisAction.enabled;
                }
                if (isEffectivelyEnabledForSite) return true;
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
            if (siteOverrideForThisAction && siteOverrideForThisAction.hasOwnProperty('key')) continue;
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
        return { description: 'Unknown action', source: 'Unknown' };
    }

    function loadSettings() {
        chrome.storage.sync.get(['shortcutSettings', 'disabledSites', 'globalSettings', 'siteOverrides'], (data) => {
            const loadedShortcutSettings = data.shortcutSettings || {};
            currentDisabledSites = data.disabledSites || [...DEFAULT_GLOBAL_SETTINGS.disabledSites];
            currentGlobalSettingsState = { ...DEFAULT_GLOBAL_SETTINGS, ...(data.globalSettings || {}) };
            const global = currentGlobalSettingsState;
            currentSiteOverrides = data.siteOverrides || {};
            currentSettings = {};

            Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
                const defaultConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
                const loadedSetting = loadedShortcutSettings[actionName];
                if (typeof loadedSetting === 'object' && loadedSetting !== null && loadedSetting.hasOwnProperty('key')) {
                    let isCustom = loadedSetting.isCustom || (loadedSetting.key !== defaultConfig.defaultKey);
                    const isNowChord = loadedSetting.hasOwnProperty('isNowChord') ? loadedSetting.isNowChord : loadedSetting.key.includes(' ');
                    const defaultIsChord = defaultConfig.defaultKey.includes(' ');
                    if (isNowChord !== defaultIsChord && loadedSetting.key !== defaultConfig.defaultKey) isCustom = true;
                    else if (isNowChord !== defaultIsChord && loadedSetting.key === defaultConfig.defaultKey && !defaultConfig.chordPrefix && isNowChord) isCustom = true;
                    currentSettings[actionName] = {
                        enabled: loadedSetting.hasOwnProperty('enabled') ? loadedSetting.enabled : defaultConfig.defaultEnabled,
                        key: loadedSetting.key,
                        isCustom: isCustom,
                        isNowChord: isNowChord
                    };
                } else if (typeof loadedSetting === 'boolean') {
                    currentSettings[actionName] = {
                        enabled: loadedSetting,
                        key: defaultConfig.defaultKey,
                        isCustom: false,
                        isNowChord: defaultConfig.defaultKey.includes(' ')
                    };
                } else {
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
            activationShortcutDisplay.textContent = getDisplayKeyForCommon(global.activationShortcut, IS_MAC_COMMON);
            incorrectActivationWarningThresholdInput.value = global.incorrectActivationWarningThreshold;
            editActivationShortcutButton.addEventListener('click', startActivationKeyCapture);
            resetActivationShortcutButton.addEventListener('click', resetActivationShortcutToDefault);
            resetActivationShortcutButton.style.display = (global.activationShortcut !== DEFAULT_GLOBAL_SETTINGS.activationShortcut) ? 'inline-block' : 'none';
            renderShortcuts(); // Full render on initial load
            renderDisabledSites();
            renderConfiguredSitesList();
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
            const defaultIsChord = defaultKey.includes(' ');
            if (isNowChord !== defaultIsChord) isCustom = true;
            shortcutSettingsToSave[actionName] = {
                enabled: checkbox ? checkbox.checked : currentSettings[actionName].enabled, // Read from DOM for 'enabled'
                key: currentKey, // From currentSettings (updated by key capture)
                isCustom: isCustom,
                isNowChord: isNowChord
            };
        });

        const globalSettingsToSave = {
            showFeedback: showFeedbackCheckbox.checked,
            feedbackDuration: parseInt(feedbackDurationInput.value, 10) || DEFAULT_GLOBAL_SETTINGS.feedbackDuration,
            activationShortcut: tempActivationShortcut || currentGlobalSettingsState.activationShortcut,
            incorrectActivationWarningThreshold: parseInt(incorrectActivationWarningThresholdInput.value, 10) || DEFAULT_GLOBAL_SETTINGS.incorrectActivationWarningThreshold
        };
        currentGlobalSettingsState.activationShortcut = globalSettingsToSave.activationShortcut;
        tempActivationShortcut = null;

        chrome.storage.sync.set({
            shortcutSettings: shortcutSettingsToSave,
            disabledSites: currentDisabledSites,
            globalSettings: globalSettingsToSave,
            siteOverrides: currentSiteOverrides
        }, () => {
            displayStatus('Settings saved successfully!');
            Object.keys(shortcutSettingsToSave).forEach(actionName => {
                currentSettings[actionName] = shortcutSettingsToSave[actionName];
            });
            renderShortcuts(); // Full re-render to reflect saved state consistently
            chrome.tabs.query({}, function(tabs) {
                for (let tab of tabs) {
                    if (tab.id && (tab.url?.startsWith('http') || tab.url?.startsWith('file'))) {
                        chrome.tabs.sendMessage(tab.id, { type: "settingsUpdated" }, function(response) {
                            if (chrome.runtime.lastError) { /* Suppress error for tabs that might not have content script */ }
                        });
                    }
                }
            });
        });
    });

    loadSettings();
});