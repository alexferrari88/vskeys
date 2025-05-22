// __tests__/e2e/content_script.e2e.test.js
import { test, expect } from './fixtures.js'; // IMPORT FROM FIXTURES
import {
  getTestPageUrl,
  // getOptionsPageUrl, // No longer needed from helpers
  activateVSKeys,
  pressShortcut,
  getEditableValue,
  setEditableValue,
  getClipboardText,
} from './helpers.js'; // Keep other helpers

test.describe('VS Keys Content Script Functionality', () => {
  let testPageUrl;
  const inputSelector = '#input-field';
  const textareaSelector = '#textarea-field';
  const contentEditableSelector = '#contenteditable-field';
  const multilineTextareaSelector = '#textarea-multiline';

  const IS_MAC_TEST = process.platform === 'darwin';
  const CTRL_OR_CMD = IS_MAC_TEST ? 'Meta' : 'Control';

  test.beforeAll(async () => {
    testPageUrl = getTestPageUrl();
  });

  // The `context` and `extensionId` are now provided by the fixture
  test.beforeEach(async ({ page, context, extensionId }) => {
    // Reset extension settings to default for each test
    const optionsUrlForReset = `chrome-extension://${extensionId}/src/options.html`;
    console.log(`[Test BeforeEach] Resetting storage via options page: ${optionsUrlForReset}`);
    
    const optionsPage = await context.newPage(); // Use the fixture's context
    try {
      await optionsPage.goto(optionsUrlForReset, { timeout: 20000 }); // Increased timeout
    } catch (e) {
      console.error(`Failed to navigate to options page for reset: ${optionsUrlForReset}`, e);
      // You might want to take a screenshot or dump HTML here for debugging
      // await optionsPage.screenshot({ path: `options_page_load_error_${Date.now()}.png` });
      // console.log(await optionsPage.content());
      throw e; // Re-throw to fail the test if options page can't be loaded
    }
    
    await optionsPage.evaluate(() => {
      return new Promise((resolve, reject) => {
        if (typeof chrome === 'undefined' || typeof chrome.storage === 'undefined' || typeof chrome.storage.sync === 'undefined') {
            console.error("chrome.storage.sync is undefined in options page context for reset.");
            return reject(new Error("chrome.storage.sync is undefined"));
        }
        chrome.storage.sync.clear(() => {
          if (chrome.runtime.lastError) {
            console.error("Error clearing storage:", chrome.runtime.lastError.message);
            return reject(chrome.runtime.lastError);
          }
          console.log("Storage cleared successfully.");
          resolve(true);
        });
      });
    });
    await optionsPage.close();

    await page.goto(testPageUrl);
    await page.locator(textareaSelector).waitFor({ state: 'visible' });
    await page.locator(textareaSelector).focus();
    await activateVSKeys(page);
  });

  test.describe('Line Operations (Textarea)', () => {
    test('should copy line (Ctrl+C / Cmd+C with empty selection)', async ({ page }) => {
        await setEditableValue(page, textareaSelector, 'First line\nSecond line\nThird line');
        await page.locator(textareaSelector).focus();
        await page.locator(textareaSelector).evaluate(el => el.setSelectionRange(0, 0));
        await pressShortcut(page, `${CTRL_OR_CMD}+C`);
        await expect(page.locator('div:has-text("Line Copied")')).toBeVisible({ timeout: 3000 });
        expect(await getClipboardText(page)).toBe('First line\n');
        await page.locator(textareaSelector).evaluate(el => {
          const secondLineStart = el.value.indexOf('Second line');
          el.setSelectionRange(secondLineStart, secondLineStart);
        });
        await pressShortcut(page, `${CTRL_OR_CMD}+C`);
        await expect(page.locator('div:has-text("Line Copied")')).toBeVisible({ timeout: 3000 });
        expect(await getClipboardText(page)).toBe('Second line\n');
      });

    test('should cut line (Ctrl+X / Cmd+X with empty selection)', async ({ page }) => {
      await setEditableValue(page, textareaSelector, 'Line to cut\nAnother line');
      await page.locator(textareaSelector).focus();
      // @ts-ignore
      await page.locator(textareaSelector).evaluate(el => el.setSelectionRange(0, 0));

      await pressShortcut(page, `${CTRL_OR_CMD}+X`);
      await expect(page.locator('div:has-text("Line Cut")')).toBeVisible({ timeout: 3000 });

      expect(await getClipboardText(page)).toBe('Line to cut\n');
      expect(await getEditableValue(page, textareaSelector)).toBe('Another line');
    });

    test('should delete line (Ctrl+Shift+K / Cmd+Shift+K)', async ({ page }) => {
      await setEditableValue(page, textareaSelector, 'Line one\nLine two to delete\nLine three');
      await page.locator(textareaSelector).focus();
      // @ts-ignore
      await page.locator(textareaSelector).evaluate(el => {
        const secondLineStart = el.value.indexOf('Line two');
        el.setSelectionRange(secondLineStart, secondLineStart);
      });

      await pressShortcut(page, `${CTRL_OR_CMD}+Shift+K`);
      await expect(page.locator('div:has-text("Line Deleted")')).toBeVisible({ timeout: 3000 });
      expect(await getEditableValue(page, textareaSelector)).toBe('Line one\nLine three');
    });

    test('should insert line above (Ctrl+Shift+Enter / Cmd+Shift+Enter)', async ({ page }) => {
      await setEditableValue(page, textareaSelector, 'First line\nThird line');
      await page.locator(textareaSelector).focus();
      // @ts-ignore
      await page.locator(textareaSelector).evaluate(el => {
        const thirdLineStart = el.value.indexOf('Third line');
        el.setSelectionRange(thirdLineStart, thirdLineStart);
      });

      await pressShortcut(page, `${CTRL_OR_CMD}+Shift+Enter`);
      await expect(page.locator('div:has-text("Line Inserted Above")')).toBeVisible({ timeout: 3000 });
      expect(await getEditableValue(page, textareaSelector)).toMatch(/First line\n\s*\nThird line/);
    });

    test('should copy line down (Shift+Alt+ArrowDown)', async ({ page }) => {
      await setEditableValue(page, textareaSelector, 'Copy this down\nOriginal next line');
      await page.locator(textareaSelector).focus();
      // @ts-ignore
      await page.locator(textareaSelector).evaluate(el => el.setSelectionRange(0, 0));

      await pressShortcut(page, 'Shift+Alt+ArrowDown');
      await expect(page.locator('div:has-text("Line Copied down")')).toBeVisible({ timeout: 3000 });
      expect(await getEditableValue(page, textareaSelector)).toBe('Copy this down\nCopy this down\nOriginal next line');
    });

    test('should copy line up (Shift+Alt+ArrowUp)', async ({ page }) => {
      await setEditableValue(page, textareaSelector, 'Original previous line\nCopy this up');
      await page.locator(textareaSelector).focus();
      // @ts-ignore
      await page.locator(textareaSelector).evaluate(el => {
        const secondLineStart = el.value.indexOf('Copy this up');
        el.setSelectionRange(secondLineStart, secondLineStart);
      });

      await pressShortcut(page, 'Shift+Alt+ArrowUp');
      await expect(page.locator('div:has-text("Line Copied up")')).toBeVisible({ timeout: 3000 });
      expect(await getEditableValue(page, textareaSelector)).toBe('Original previous line\nCopy this up\nCopy this up');
    });

    test('should move line down (Alt+ArrowDown)', async ({ page }) => {
      await setEditableValue(page, multilineTextareaSelector, 'Alpha\nBeta\nGamma');
      await page.locator(multilineTextareaSelector).focus();
      // @ts-ignore
      await page.locator(multilineTextareaSelector).evaluate(el => el.setSelectionRange(0, 0)); // Cursor on "Alpha"

      await pressShortcut(page, 'Alt+ArrowDown');
      await expect(page.locator('div:has-text("Line Moved down")')).toBeVisible({ timeout: 3000 });
      expect(await getEditableValue(page, multilineTextareaSelector)).toBe('Beta\nAlpha\nGamma');
    });

    test('should move line up (Alt+ArrowUp)', async ({ page }) => {
      await setEditableValue(page, multilineTextareaSelector, 'Alpha\nBeta\nGamma');
      const betaIndex = (await getEditableValue(page, multilineTextareaSelector)).indexOf('Beta');
      await page.locator(multilineTextareaSelector).focus();
      // @ts-ignore
      await page.locator(multilineTextareaSelector).evaluate((el, index) => el.setSelectionRange(index, index), betaIndex); // Cursor on "Beta"

      await pressShortcut(page, 'Alt+ArrowUp');
      await expect(page.locator('div:has-text("Line Moved up")')).toBeVisible({ timeout: 3000 });
      expect(await getEditableValue(page, multilineTextareaSelector)).toBe('Beta\nAlpha\nGamma');
    });
  });

  test.describe('Selection & Case Transformation (Textarea)', () => {
    test('should select line (Ctrl+L / Cmd+L)', async ({ page }) => {
      const initialValue = 'Select this full line.';
      await setEditableValue(page, textareaSelector, initialValue); 
      await page.locator(textareaSelector).focus();
      // @ts-ignore
      await page.locator(textareaSelector).evaluate(el => el.setSelectionRange(5, 5));

      await pressShortcut(page, `${CTRL_OR_CMD}+L`);
      await expect(page.locator('div:has-text("Line Selected")')).toBeVisible({ timeout: 3000 });

      const selectedText = await page.locator(textareaSelector).evaluate(el => {
        // @ts-ignore
        return el.value.substring(el.selectionStart, el.selectionEnd);
      });
      expect(selectedText).toBe(initialValue + (initialValue.endsWith('\n') ? '' : '\n') );
    });

    test('should transform selection to UPPERCASE (Ctrl+Alt+U)', async ({ page }) => {
      await setEditableValue(page, textareaSelector, 'make this uppercase');
      await page.locator(textareaSelector).focus();
      // @ts-ignore
      await page.locator(textareaSelector).evaluate(el => el.setSelectionRange(0, 9)); // Select "make this"

      await pressShortcut(page, `${CTRL_OR_CMD}+Alt+U`);
      await expect(page.locator('div:has-text("UPPERCASED")')).toBeVisible({ timeout: 3000 });
      expect(await getEditableValue(page, textareaSelector)).toBe('MAKE THIS uppercase');
    });
  });

  test.describe('Commenting (Textarea)', () => {
    test('should toggle line comment (Ctrl+/ or Cmd+/)', async ({ page }) => {
      await setEditableValue(page, textareaSelector, 'Line one\nLine two\nLine three');
      await page.locator(textareaSelector).focus();
      // @ts-ignore
      await page.locator(textareaSelector).evaluate(el => {
        const lineTwoStart = el.value.indexOf('Line two');
        const lineThreeEnd = el.value.indexOf('Line three') + 'Line three'.length;
        el.setSelectionRange(lineTwoStart, lineThreeEnd);
      });

      await pressShortcut(page, `${CTRL_OR_CMD}+/`);
      await expect(page.locator('div:has-text("Line Comment Toggled")')).toBeVisible({ timeout: 3000 });
      expect(await getEditableValue(page, textareaSelector)).toBe('Line one\n// Line two\n// Line three');

      // @ts-ignore
      await page.locator(textareaSelector).evaluate(el => {
        const lineTwoStart = el.value.indexOf('// Line two');
        const lineThreeEnd = el.value.indexOf('// Line three') + '// Line three'.length;
        el.setSelectionRange(lineTwoStart, lineThreeEnd);
      });
      await pressShortcut(page, `${CTRL_OR_CMD}+/`);
      await expect(page.locator('div:has-text("Line Comment Toggled")')).toBeVisible({ timeout: 3000 });
      expect(await getEditableValue(page, textareaSelector)).toBe('Line one\nLine two\nLine three');
    });
  });

  test.describe('Chorded Shortcuts (Textarea)', () => {
    test('should add line comment with chord (Ctrl+K Ctrl+C)', async ({ page }) => {
      await setEditableValue(page, textareaSelector, 'Comment me via chord');
      await page.locator(textareaSelector).focus();
      // @ts-ignore
      await page.locator(textareaSelector).evaluate(el => el.setSelectionRange(0, 0));

      await page.keyboard.down(CTRL_OR_CMD);
      await page.keyboard.press('K');
      await page.keyboard.up(CTRL_OR_CMD);

      const chordFeedbackText = IS_MAC_TEST ? '⌘K...' : 'Ctrl+K...';
      await expect(page.locator(`div:has-text("${chordFeedbackText}")`)).toBeVisible({ timeout: 3000 });

      await page.keyboard.press('C');

      await expect(page.locator('div:has-text("Line Comment Added")')).toBeVisible({ timeout: 3000 });
      expect(await getEditableValue(page, textareaSelector)).toBe('// Comment me via chord');
    });
  });

  test.describe('ContentEditable Operations', () => {
    test('should copy selected text (Ctrl+C / Cmd+C)', async ({ page }) => {
      await page.locator(contentEditableSelector).focus();
      
      await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        el.focus(); 
        const range = document.createRange();
        const textNode = el.childNodes[0]; 
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          range.setStart(textNode, 0);
          range.setEnd(textNode, "Hello contenteditable world.".length);
          window.getSelection().removeAllRanges();
          window.getSelection().addRange(range);
        } else {
          range.selectNodeContents(el);
          window.getSelection().removeAllRanges();
          window.getSelection().addRange(range);
        }
      }, contentEditableSelector);

      await pressShortcut(page, `${CTRL_OR_CMD}+C`);
      await expect(page.locator('div:has-text("Selection Copied")')).toBeVisible({ timeout: 3000 });
      expect(await getClipboardText(page)).toBe('Hello contenteditable world.');
    });

    test('should paste text (Ctrl+V / Cmd+V)', async ({ page, context }) => {
      await setEditableValue(page, contentEditableSelector, ''); 
      const textToPaste = 'Pasted into contenteditable.';
      
      // Grant permissions for the current context if not already done by config
      // Although it's in playwright.config.js, being explicit here doesn't hurt for debugging
      try {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      } catch (e) {
        // console.warn("Could not explicitly grant clipboard permissions, relying on config.", e.message);
      }
      
      await page.evaluate(async (text) => {
        await navigator.clipboard.writeText(text);
      }, textToPaste);


      await page.locator(contentEditableSelector).focus();
      await pressShortcut(page, `${CTRL_OR_CMD}+V`);
      
      await expect(page.locator('div:has-text("Pasted")')).toBeVisible({ timeout: 3500 });
      expect(await getEditableValue(page, contentEditableSelector)).toBe(textToPaste);
    });
  });
});