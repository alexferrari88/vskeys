// __tests__/e2e/helpers.js
import path from 'path';

export function getTestPageUrl() {
  const testPagePath = path.resolve(__dirname, 'test-page.html');
  return `file://${testPagePath}`;
}

export async function activateVSKeys(page) {
  await page.bringToFront();
  try {
    await page.locator('body').focus({ timeout: 1000 });
  } catch (e) { /* Gulp */ }

  const activationKey = 'S'; // Default activation key, assuming it's Alt+Shift+S
  await page.keyboard.down('Alt');
  await page.keyboard.down('Shift');
  await page.keyboard.press(activationKey);
  await page.keyboard.up('Shift');
  await page.keyboard.up('Alt');

  try {
    // Use the more specific selector for feedback messages
    await page.locator('div.vskeys-feedback-message:has-text("VSCode Shortcuts Activated")').waitFor({ state: 'visible', timeout: 3500 });
  } catch (e) {
    // console.warn("Activation feedback not immediately visible, continuing test.");
    await page.waitForTimeout(750); // Give a bit more time if feedback is delayed
  }
}

export async function typeInEditable(page, selector, text, selectAllFirst = false) {
  const locator = page.locator(selector);
  await locator.waitFor({ state: 'visible' });
  await locator.focus();
  if (selectAllFirst) {
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+A' : 'Control+A');
    if (text === '') {
      await page.keyboard.press('Backspace');
      return;
    }
  }
  await locator.type(text, { delay: 30 });
}

export async function getEditableValue(page, selector) {
  const locator = page.locator(selector);
  await locator.waitFor();
  const tagName = await locator.evaluate(el => el.tagName.toLowerCase());
  if (tagName === 'input' || tagName === 'textarea') {
    return locator.inputValue();
  } else if (await locator.evaluate(el => el.isContentEditable)) {
    // Normalize line endings for contenteditable
    return (await locator.innerText()).replace(/\r\n|\r/g, '\n');
  }
  return '';
}

export async function setEditableValue(page, selector, value) {
  const locator = page.locator(selector);
  await locator.waitFor({ state: 'visible' });
  await locator.focus();
  const isMac = process.platform === 'darwin';

  const tagName = await locator.evaluate(el => el.tagName.toLowerCase());
  if (tagName === 'input' || tagName === 'textarea') {
    // Using fill should correctly clear and set the value.
    await locator.fill(value); 
  } else if (await locator.evaluate(el => el.isContentEditable)) {
    // For contenteditable, select all and delete is more robust than fill.
    await page.keyboard.press(isMac ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace'); 
    // Ensure it's empty if Backspace didn't clear everything (e.g. complex structures)
    if (value !== '' && await locator.innerText() !== '') {
        await locator.evaluate(el => el.innerHTML = ''); // Force clear
    }
    if (value !== '') {
      // Type for contenteditable to simulate user input, especially if it triggers events.
      // If pasting HTML or complex content, page.evaluate with execCommand('insertHTML') might be better.
      // For plain text, type is usually fine.
      await locator.type(value, { delay: 30 });
    }
  }
}


export async function pressShortcut(page, shortcutString) {
  const isMac = process.platform === 'darwin';
  let playwrightShortcut = shortcutString;

  if (isMac) {
    playwrightShortcut = playwrightShortcut.replace(/\bCtrl\b/g, 'Meta'); // For Mac, Ctrl in string means Cmd
    playwrightShortcut = playwrightShortcut.replace(/\bCmd\b/g, 'Meta'); // Explicit Cmd also maps to Meta
    // Alt and Shift are usually themselves
  } else {
     playwrightShortcut = playwrightShortcut.replace(/\bCmd\b/g, 'Control'); // On Win/Linux, Cmd in string means Control
     // Ctrl is already Control for Playwright on Win/Linux
  }
  await page.keyboard.press(playwrightShortcut);
}

export async function getClipboardText(page) {
  await page.bringToFront(); // Ensure the page is active
  try {
    await page.locator('body').focus({timeout: 1000}); // Focus body to ensure clipboard ops work
  } catch(e) { /* Gulp: Focus might fail on some pages but clipboard might still work */ }
  
  await page.waitForTimeout(250); // Small delay for clipboard to stabilize after action

  try {
    const text = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch (err) {
        console.error("Clipboard read error in browser context:", err);
        return `CLIPBOARD_READ_ERROR: ${err.message}`;
      }
    });
    // Check if the evaluate call itself returned an error string
     if (typeof text === 'string' && text.startsWith('CLIPBOARD_READ_ERROR')) {
        console.warn("Failed to read clipboard from page:", text);
        return ""; // Return empty or handle as error appropriately
    }
    return text;
  } catch (e) {
    // This catch is for errors in page.evaluate itself, not navigator.clipboard.readText
    console.error("Error during page.evaluate for clipboard read:", e);
    return "";
  }
}

export function getDisplayKeyForTest(keyString, isMac = process.platform === 'darwin') {
    let result = keyString;
    if (isMac) {
        result = result
            .replace(/\bCtrl\b/g, '⌘')
            .replace(/\bMeta\b/g, '⌘') // Meta on Mac is Cmd
            .replace(/\bCmd\b/g, '⌘')  // Explicit Cmd
            .replace(/\bAlt\b/g, '⌥')
            .replace(/\bShift\b/g, '⇧')
            .replace(/\bEnter\b/g, '↵')
            .replace(/\bArrowUp\b/g, '↑')
            .replace(/\bArrowDown\b/g, '↓')
            .replace(/\bArrowLeft\b/g, '←')
            .replace(/\bArrowRight\b/g, '→')
            .replace(/\+/g, ' '); // Visual separation for Mac
    } else { // Non-Mac
        result = result
            .replace(/\bControl\b/g, 'Ctrl') // Normalize "Control" to "Ctrl"
            .replace(/\bMeta\b/g, 'Win')    // Meta on Win/Linux is typically Windows/Super key
            .replace(/\bCmd\b/g, 'Ctrl')   // Treat Cmd as Ctrl on non-Mac
            .replace(/\bArrowUp\b/g, 'Up')
            .replace(/\bArrowDown\b/g, 'Down')
            .replace(/\bArrowLeft\b/g, 'Left')
            .replace(/\bArrowRight\b/g, 'Right');
        // Keep '+' for non-Mac as it's standard display
    }
    return result.trim();
}