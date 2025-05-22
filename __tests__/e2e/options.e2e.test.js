// __tests__/e2e/options.e2e.test.js
import { test, expect } from './fixtures.js'; // IMPORT FROM FIXTURES
import { pressShortcut, getDisplayKeyForTest } from './helpers.js';
import { DEFAULT_SHORTCUT_SETTINGS_CONFIG, DEFAULT_GLOBAL_SETTINGS } from '../../src/common.js';

test.describe('VS Keys Options Page', () => {
  let optionsUrl; // Will be constructed in beforeEach using extensionId from fixture
  const IS_MAC_TEST = process.platform === 'darwin';

  test.beforeEach(async ({ page, context, extensionId }) => {
    // Construct optionsUrl using the extensionId from the fixture
    optionsUrl = `chrome-extension://${extensionId}/src/options.html`;
    console.log(`[Options Test BeforeEach] Navigating to options page: ${optionsUrl}`);

    await page.goto(optionsUrl, { timeout: 20000 }); // Increased timeout
    await page.waitForSelector('#shortcutsListContainer', { timeout: 15000 }); // Increased timeout
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

    await page.reload(); // Reload the options page
    await page.waitForSelector('#shortcutsListContainer', { timeout: 15000 }); // Wait after reload
    
    const reloadedFeedbackCheckbox = page.locator('#showFeedbackEnabled');
    await expect(reloadedFeedbackCheckbox).toBeChecked({checked: !initialCheckedState});
    await expect(page.locator('#feedbackDuration')).toHaveValue('2500');

    // Revert
    await reloadedFeedbackCheckbox.setChecked(initialCheckedState);
    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();
  });

  test('should allow editing and resetting the activation shortcut', async ({ page }) => {
    const originalShortcutDisplay = getDisplayKeyForTest(DEFAULT_GLOBAL_SETTINGS.activationShortcut, IS_MAC_TEST);
    const newShortcutPressString = IS_MAC_TEST ? 'Meta+Shift+T' : 'Control+Shift+T';
    const newShortcutDisplayString = getDisplayKeyForTest(newShortcutPressString.replace('Meta', 'Cmd'), IS_MAC_TEST);

    await page.locator('#editActivationShortcut').click();
    await expect(page.locator('#saveCapturedActivationKey')).toBeVisible();

    // Simulate key presses for the new shortcut
    // For multi-key shortcuts like 'Meta+Shift+T', Playwright's press handles it.
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
    await page.waitForSelector('#disabledSitesList', { timeout: 10000 });
    await expect(page.locator(`#disabledSitesList li`).filter({ hasText: siteToDisable })).toBeVisible();

    await page.locator(`#disabledSitesList li`).filter({ hasText: siteToDisable }).locator('button').click();
    await expect(page.locator(`#disabledSitesList li`).filter({ hasText: siteToDisable })).toBeHidden();
    
    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();
    await page.reload();
    await page.waitForSelector('#disabledSitesList', { timeout: 10000 });
    const listItemsCount = await page.locator(`#disabledSitesList li`).count();
    if (listItemsCount > 0) {
        await expect(page.locator(`#disabledSitesList li`).filter({ hasText: siteToDisable })).toBeHidden();
    } else {
        expect(listItemsCount).toBe(0);
    }
  });

  test('should allow enabling/disabling a global shortcut and changing its key', async ({ page }) => {
    const actionName = 'deleteLine'; 
    const defaultKeyConfig = DEFAULT_SHORTCUT_SETTINGS_CONFIG[actionName];
    const originalDisplayKey = getDisplayKeyForTest(defaultKeyConfig.defaultKey.replace('Meta','Cmd'), IS_MAC_TEST);
    
    const newKeyPressString = 'Alt+D'; 
    const newDisplayKey = getDisplayKeyForTest(newKeyPressString, IS_MAC_TEST);

    const itemLocator = page.locator(`.shortcut-item:has(input[data-action="${actionName}"])`);
    const checkboxLocator = itemLocator.locator(`input[type="checkbox"][data-action="${actionName}"]`);

    await checkboxLocator.uncheck(); 
    await expect(checkboxLocator).not.toBeChecked();

    await itemLocator.locator(`.actions button.edit-shortcut[data-action="${actionName}"]`).click();
    await expect(itemLocator.locator(`.actions button.save-captured-key[data-action="${actionName}"]`)).toBeVisible();
    
    await page.keyboard.press(newKeyPressString);
    await itemLocator.locator(`.actions button.save-captured-key[data-action="${actionName}"]`).click();
    await expect(itemLocator.locator(`.actions button.edit-shortcut[data-action="${actionName}"]`)).toBeVisible();
    
    const keyKbdLocator = itemLocator.locator('.keys');
    // Regex to strip " *G" or " *S" or " *" from the end of the key display for comparison
    const displayedKeyText = (await keyKbdLocator.textContent()).replace(/\s*\*(G|S)?$/, '').trim();
    expect(displayedKeyText).toBe(newDisplayKey);

    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();
    await page.reload();
    await page.waitForSelector('#shortcutsListContainer', { timeout: 10000 });
    
    const reloadedItemLocator = page.locator(`.shortcut-item:has(input[data-action="${actionName}"])`);
    const reloadedCheckboxLocator = reloadedItemLocator.locator(`input[type="checkbox"][data-action="${actionName}"]`);
    const reloadedKeyKbdLocator = reloadedItemLocator.locator('.keys');

    await expect(reloadedCheckboxLocator).not.toBeChecked();
    const reloadedDisplayedKeyText = (await reloadedKeyKbdLocator.textContent()).replace(/\s*\*(G|S)?$/, '').trim();
    expect(reloadedDisplayedKeyText).toBe(newDisplayKey);

    const resetButtonLocator = reloadedItemLocator.locator(`.actions button.reset-shortcut[data-action="${actionName}"]`);
    await expect(resetButtonLocator).toBeVisible();
    await resetButtonLocator.click();
    await expect(resetButtonLocator).toBeHidden(); 
    await expect(reloadedKeyKbdLocator).toHaveText(originalDisplayKey);

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

    const siteItemLocator = page.locator(`#siteSpecificShortcutsList .shortcut-item:has(button.edit-site-shortcut[data-action="${actionToOverride}"])`);
    await siteItemLocator.locator(`button.edit-site-shortcut[data-action="${actionToOverride}"]`).click();
    
    await expect(siteItemLocator.locator(`button.save-captured-site-key[data-action="${actionToOverride}"]`)).toBeVisible();
    await page.keyboard.press(newKeyForSitePressString);
    await siteItemLocator.locator(`button.save-captured-site-key[data-action="${actionToOverride}"]`).click();
    
    await expect(siteItemLocator.locator(`button.edit-site-shortcut[data-action="${actionToOverride}"]`)).toBeVisible();
    const siteKeyKbdLocator = siteItemLocator.locator('.keys.site-specific-keys');
    // Check for the key and the site-specific indicator separately for robustness
    await expect(siteKeyKbdLocator).toContainText(newDisplayKeyForSite);
    await expect(siteKeyKbdLocator).toContainText('*S');

    const actionToDisableSiteSpecific = 'cutLine';
    const siteCheckboxLocator = page.locator(`#siteSpecificShortcutsList input.toggle-site-shortcut[data-action="${actionToDisableSiteSpecific}"]`);
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

    const reloadedSiteItemLocator = page.locator(`#siteSpecificShortcutsList .shortcut-item:has(.keys.site-specific-keys[data-action="${actionToOverride}"])`);
    const reloadedSiteKeyKbdLocator = reloadedSiteItemLocator.locator('.keys.site-specific-keys');
    await expect(reloadedSiteKeyKbdLocator).toContainText(newDisplayKeyForSite);
    await expect(reloadedSiteKeyKbdLocator).toContainText('*S');

    const reloadedSiteCheckboxLocator = page.locator(`#siteSpecificShortcutsList input.toggle-site-shortcut[data-action="${actionToDisableSiteSpecific}"]`);
    await expect(reloadedSiteCheckboxLocator).not.toBeChecked();

    await page.locator('#removeSiteOverrides').click(); 
    await expect(page.locator('#siteOverridesManager')).toBeHidden(); 
    await page.locator('#saveSettings').click();
    await expect(page.locator('.status.success')).toBeVisible();
    await page.reload();
    await page.waitForSelector('#configuredSitesListContainer', { timeout: 10000 });
    await expect(page.locator(`#configuredSitesList li button.edit-site-override[data-hostname="${siteHostname}"]`)).toBeHidden();
  });
});