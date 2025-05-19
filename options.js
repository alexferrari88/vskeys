// options.js
document.addEventListener('DOMContentLoaded', () => {
    const shortcutsListContainer = document.getElementById('shortcutsList');
    const saveButton = document.getElementById('saveSettings');
    const statusMessage = document.getElementById('statusMessage');
    const newDisabledSiteInput = document.getElementById('newDisabledSite');
    const addDisabledSiteButton = document.getElementById('addDisabledSite');
    const disabledSitesUl = document.getElementById('disabledSitesList');

    const showFeedbackCheckbox = document.getElementById('showFeedbackEnabled');
    const feedbackDurationInput = document.getElementById('feedbackDuration');

    let currentSettings = {};
    let currentDisabledSites = [];
    const IS_MAC_OPTIONS = navigator.platform.toUpperCase().indexOf('MAC') >= 0;


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

        Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
            const config = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
            if (!categories[config.category]) {
                categories[config.category] = [];
            }
            categories[config.category].push({ actionName, ...config });
        });

        for (const categoryName in categories) {
            const categoryTitle = document.createElement('h3');
            categoryTitle.textContent = categoryName;
            categoryTitle.className = 'category-title';
            shortcutsListContainer.appendChild(categoryTitle);

            categories[categoryName].sort((a,b) => a.description.localeCompare(b.description)).forEach(shortcut => {
                const item = document.createElement('div');
                item.className = 'shortcut-item';
                const keyDisplay = getDisplayKey(shortcut.defaultKey);
                
                item.innerHTML = `
                    <kbd class="keys">${keyDisplay}</kbd>
                    <span>${shortcut.description}</span>
                    <input type="checkbox" id="toggle_${shortcut.actionName}" title="Enable/Disable ${shortcut.description}" data-action="${shortcut.actionName}" ${currentSettings[shortcut.actionName] !== false ? 'checked' : ''}>
                `;
                shortcutsListContainer.appendChild(item);
            });
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

            currentSettings = {};
            Object.keys(DEFAULT_SHORTCUT_SETTINGS_CONFIG).forEach(actionName => {
                currentSettings[actionName] = loadedShortcutSettings.hasOwnProperty(actionName) ?
                                              loadedShortcutSettings[actionName] :
                                              DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName].defaultEnabled;
            });
            
            showFeedbackCheckbox.checked = global.hasOwnProperty('showFeedback') ? global.showFeedback : DEFAULT_GLOBAL_SETTINGS.showFeedback;
            feedbackDurationInput.value = global.hasOwnProperty('feedbackDuration') ? global.feedbackDuration : DEFAULT_GLOBAL_SETTINGS.feedbackDuration;

            renderShortcuts();
            renderDisabledSites();
        });
    }

    saveButton.addEventListener('click', () => {
        const shortcutSettingsToSave = {};
        document.querySelectorAll('#shortcutsList input[type="checkbox"]').forEach(checkbox => {
            shortcutSettingsToSave[checkbox.dataset.action] = checkbox.checked;
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
            currentSettings = shortcutSettingsToSave; 
            
            // Notify content scripts in all tabs (if any are active on a page we can script)
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