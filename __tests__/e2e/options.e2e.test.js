// __tests__/e2e/options.e2e.test.js
import { test, expect } from './fixtures.js'; // IMPORT FROM FIXTURES
import { getDisplayKeyForTest } from './helpers.js';
import { DEFAULT_SHORTCUT_SETTINGS_CONFIG, DEFAULT_GLOBAL_SETTINGS } from '../../src/common.js';

test.describe('VS Keys Options Page', () => {
  let optionsUrl; 
  const IS_MAC_TEST = process.platform === 'darwin';

  test.beforeEach(async ({ page, context, extensionId }) => {
    optionsUrl = `chrome-extension://${extensionId}/src/options.html`;
    console.log(`[Options Test BeforeEach] Target options page URL: ${optionsUrl}`);

    // Navigate to the options page FIRST to establish context for page.evaluate
    await page.goto(optionsUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log(`[Options Test BeforeEach] Navigated to options page: ${page.url()}`);
    
    // Now evaluate in the context of the options page
    await page.evaluate(() => {
        return new Promise((resolve, reject) => {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
                console.error("chrome.storage.sync is undefined in options page context for reset (after navigation).");
                return reject(new Error("chrome.storage.sync is undefined (after navigation)"));
            }
            chrome.storage.sync.clear(() => {
                if (chrome.runtime.lastError) {
                    console.error("Error clearing storage in options.e2e beforeEach:", chrome.runtime.lastError.message);
                    return reject(chrome.runtime.lastError);
                }
                console.log("Storage cleared successfully in options.e2e beforeEach.");
                resolve(true);
            });
        });
    });

    // Reload the page so options.js loads with the cleared storage
    // This ensures that the initial state displayed on the page is from defaults.
    console.log(`[Options Test BeforeEach] Reloading options page to apply cleared storage.`);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    
    // Wait for a known element to ensure the page is fully reloaded and initialized
    await page.waitForSelector('#shortcutsListContainer', { timeout: 15000 });
    console.log(`[Options Test BeforeEach] Options page setup complete, ready for test.`);
  });

  test('should load the options page with default settings', async ({ page }) => {
    await expect(page).toHaveTitle('VS Code Shortcuts Settings');
    const feedbackCheckbox = page.locator('#showFeedbackEnabled');
    await expect(feedbackCheckbox).toBeChecked({ checked: DEFAULT_GLOBAL_SETTINGS.showFeedback });

    const activationShortcutDisplay = page.locator('#activationShortcutDisplay');
    const expectedActivationDisplay = getDisplayKeyForTest(DEFAULT_GLOBAL_SETTINGS.activationShortcut, IS_MAC_TEST);
    await expect(activationShortcutDisplay).toHaveText(expectedActivationDisplay);
  });

  test('should allow changing feedback settings', async ({ page }) => {
    const feedbackCheckbox = page.locator('#showFeedbackEnabled');
    const initialCheckedState = await feedbackCheckbox.isChecked();
    
    await feedbackCheckbox.setChecked(!initialCheckedState);
    await expect(feedbackCheckbox).toBeChecked({checked: !initialCheckedState});

    await page.locator('#feedbackDuration').fill('2500');
    
    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();
    await expect(page.locator('.status.success')).toContainText('Settings saved successfully!');

    await page.reload(); 
    await page.waitForSelector('#shortcutsListContainer', { timeout: 15000 }); 
    
    const reloadedFeedbackCheckbox = page.locator('#showFeedbackEnabled');
    await expect(reloadedFeedbackCheckbox).toBeChecked({checked: !initialCheckedState});
    await expect(page.locator('#feedbackDuration')).toHaveValue('2500');

    await reloadedFeedbackCheckbox.setChecked(initialCheckedState);
    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();
  });

  test('should allow editing and resetting the activation shortcut', async ({ page }) => {
    const originalShortcutDisplay = getDisplayKeyForTest(DEFAULT_GLOBAL_SETTINGS.activationShortcut, IS_MAC_TEST);
    const newShortcutPressString = IS_MAC_TEST ? 'Meta+Shift+T' : 'Control+Shift+T';
    const newShortcutDisplayString = getDisplayKeyForTest(newShortcutPressString, IS_MAC_TEST);

    await page.locator('#editActivationShortcut').click();
    await expect(page.locator('#saveCapturedActivationKey')).toBeVisible();

    await page.keyboard.press(newShortcutPressString); 
    
    await page.locator('#saveCapturedActivationKey').click();
    await expect(page.locator('#editActivationShortcut')).toBeVisible(); 

    await expect(page.locator('#activationShortcutDisplay')).toHaveText(newShortcutDisplayString);
    
    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();
    await page.reload();
    await page.waitForSelector('#activationShortcutDisplay', { timeout: 10000 });
    await expect(page.locator('#activationShortcutDisplay')).toHaveText(newShortcutDisplayString);

    await page.locator('#resetActivationShortcut').click(); 
    await expect(page.locator('#resetActivationShortcut')).toBeHidden(); 
    await expect(page.locator('#activationShortcutDisplay')).toHaveText(originalShortcutDisplay);
    
    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();
  });

  test('should allow adding and removing a disabled site', async ({ page }) => {
    const siteToDisable = 'example-e2e-options.com';
    await page.locator('#newDisabledSite').fill(siteToDisable);
    await page.locator('#addDisabledSite').click();
    await expect(page.locator(`#disabledSitesList li`).filter({ hasText: siteToDisable })).toBeVisible();

    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();

    await page.reload();
    await page.waitForSelector('#shortcutsListContainer', { timeout: 15000 }); 
    await expect(page.locator(`#disabledSitesList li`).filter({ hasText: siteToDisable })).toBeVisible();

    await page.locator(`#disabledSitesList li`).filter({ hasText: siteToDisable }).locator('button').click();
    await expect(page.locator(`#disabledSitesList li`).filter({ hasText: siteToDisable })).toBeHidden();
    
    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();

    await page.reload();
    await page.waitForSelector('#shortcutsListContainer', { timeout: 15000 });
    await expect(page.locator('ul#disabledSitesList')).toBeVisible();
    await expect(page.locator('ul#disabledSitesList li')).toHaveCount(0);
  });

  test('should allow enabling/disabling a global shortcut and changing its key', async ({ page }) => {
    const actionName = 'deleteLine'; 
    const defaultKeyConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
    const originalDisplayKey = getDisplayKeyForTest(defaultKeyConfig.defaultKey, IS_MAC_TEST);
    
    const newKeyPressString = 'Alt+D'; 
    const newDisplayKey = getDisplayKeyForTest(newKeyPressString, IS_MAC_TEST);

    const itemLocator = page.locator(`.shortcut-item[data-action-name="${actionName}"]`);
    const checkboxLocator = itemLocator.locator(`input[type="checkbox"][data-action="${actionName}"]`);

    await checkboxLocator.uncheck(); 
    await expect(checkboxLocator).not.toBeChecked();

    await itemLocator.locator(`.actions button.edit-shortcut[data-action="${actionName}"]`).click();
    await expect(itemLocator.locator(`.actions button.save-captured-key[data-action="${actionName}"]`)).toBeVisible();
    
    await page.keyboard.press(newKeyPressString);
    await itemLocator.locator(`.actions button.save-captured-key[data-action="${actionName}"]`).click();
    await expect(itemLocator.locator(`.actions button.edit-shortcut[data-action="${actionName}"]`)).toBeVisible();
    
    const keyKbdLocator = itemLocator.locator('.keys');
    const displayedKeyText = (await keyKbdLocator.textContent()).replace(/\s*\*(G|S)?$/, '').trim();
    expect(displayedKeyText).toBe(newDisplayKey);

    await expect(checkboxLocator).not.toBeChecked();

    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();
    
    await page.reload();
    await page.waitForSelector('#shortcutsListContainer', { timeout: 10000 });
    
    const reloadedItemLocator = page.locator(`.shortcut-item[data-action-name="${actionName}"]`);
    const reloadedCheckboxLocator = reloadedItemLocator.locator(`input[type="checkbox"][data-action="${actionName}"]`);
    const reloadedKeyKbdLocator = reloadedItemLocator.locator('.keys');

    await expect(reloadedCheckboxLocator).not.toBeChecked(); 
    const reloadedDisplayedKeyText = (await reloadedKeyKbdLocator.textContent()).replace(/\s*\*(G|S)?$/, '').trim();
    expect(reloadedDisplayedKeyText).toBe(newDisplayKey);

    const resetButtonLocator = reloadedItemLocator.locator(`.actions button.reset-shortcut[data-action="${actionName}"]`);
    await expect(resetButtonLocator).toBeVisible();
    await resetButtonLocator.click();
    await expect(resetButtonLocator).toBeHidden(); 
    
    const originalKeyAfterReset = (await reloadedKeyKbdLocator.textContent()).replace(/\s*\*(G|S)?$/, '').trim();
    expect(originalKeyAfterReset).toBe(originalDisplayKey);

    await reloadedCheckboxLocator.check(); 
    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();
  });
  
  test('should manage per-site overrides', async ({ page }) => {
    const siteHostname = 'test-overrides-options.com';
    const actionToOverride = 'copyLine'; 
    const newKeyForSitePressString = 'Alt+C';
    const newDisplayKeyForSite = getDisplayKeyForTest(newKeyForSitePressString, IS_MAC_TEST);

    await page.locator('#siteOverrideHostname').fill(siteHostname);
    await page.locator('#manageSiteOverrides').click();
    await expect(page.locator('#siteOverridesManager')).toBeVisible();
    await expect(page.locator('#editingSiteHostname')).toContainText(siteHostname);

    const siteItemLocator = page.locator(`#siteSpecificShortcutsList .shortcut-item[data-action-name="${actionToOverride}"]`);
    await siteItemLocator.locator(`button.edit-site-shortcut[data-action="${actionToOverride}"]`).click();
    
    const saveSiteKeyButtonLocator = siteItemLocator.locator(`button.save-captured-site-key[data-action="${actionToOverride}"]`);
    await expect(saveSiteKeyButtonLocator).toBeVisible({timeout: 7000});
    
    await page.keyboard.press(newKeyForSitePressString);
    await expect(saveSiteKeyButtonLocator).toBeEnabled(); 
    await saveSiteKeyButtonLocator.click();
    
    await expect(siteItemLocator.locator(`button.edit-site-shortcut[data-action="${actionToOverride}"]`)).toBeVisible();
    const siteKeyKbdLocator = siteItemLocator.locator('.keys.site-specific-keys');
    await expect(siteKeyKbdLocator).toContainText(newDisplayKeyForSite);
    await expect(siteKeyKbdLocator).toContainText('*S');

    const actionToDisableSiteSpecific = 'cutLine';
    const siteCheckboxLocator = page.locator(`#siteSpecificShortcutsList .shortcut-item[data-action-name="${actionToDisableSiteSpecific}"] input.toggle-site-shortcut`);
    await siteCheckboxLocator.uncheck();
    await expect(siteCheckboxLocator).not.toBeChecked();

    await page.locator('#saveSiteOverrides').click();
    await expect(page.locator('#siteOverridesManager')).toBeHidden();
    await expect(page.locator(`#configuredSitesList li button.edit-site-override[data-hostname="${siteHostname}"]`)).toBeVisible();

    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();
    await page.reload();
    await page.waitForSelector('#configuredSitesListContainer', { timeout: 10000 });
    
    await page.locator(`#configuredSitesList li button.edit-site-override[data-hostname="${siteHostname}"]`).click();
    await expect(page.locator('#siteOverridesManager')).toBeVisible();

    const reloadedSiteItemLocator = page.locator(`#siteSpecificShortcutsList .shortcut-item[data-action-name="${actionToOverride}"]`);
    const reloadedSiteKeyKbdLocator = reloadedSiteItemLocator.locator('.keys.site-specific-keys');
    await expect(reloadedSiteKeyKbdLocator).toContainText(newDisplayKeyForSite);
    await expect(reloadedSiteKeyKbdLocator).toContainText('*S');

    const reloadedSiteCheckboxLocator = page.locator(`#siteSpecificShortcutsList .shortcut-item[data-action-name="${actionToDisableSiteSpecific}"] input.toggle-site-shortcut`);
    await expect(reloadedSiteCheckboxLocator).not.toBeChecked();

    // Handle the confirm dialog for "Remove All Config for This Site"
    page.once('dialog', async dialog => {
      console.log(`Dialog message: ${dialog.message()}`);
      await dialog.accept(); // Or dialog.dismiss();
    });
    await page.locator('#removeSiteOverrides').click(); 
    
    await expect(page.locator('#siteOverridesManager')).toBeHidden({ timeout: 5000 }); // Added timeout for stability
    
    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();
    await page.reload();
    await page.waitForSelector('#configuredSitesListContainer', { timeout: 10000 });
    await expect(page.locator(`#configuredSitesList li button.edit-site-override[data-hostname="${siteHostname}"]`)).toBeHidden();
  });
});