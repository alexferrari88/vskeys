// __tests__/e2e/helpers.js
import path from 'path';

// const KNOWN_EXTENSION_ID = 'lmffcggpbgijhcpbemfphhdnfbpdffeb'; // YOUR ACTUAL ID

// export async function getExtensionId(context) {
//   // FOR DEBUGGING - RETURN HARDCODED ID
//   if (KNOWN_EXTENSION_ID) {
//     // console.warn(`[GET_EXTENSION_ID] USING HARDCODED EXTENSION ID: ${KNOWN_EXTENSION_ID}`);
//     return KNOWN_EXTENSION_ID;
//   }

//   // Fallback logic (should not be reached if KNOWN_EXTENSION_ID is set)
//   console.log("[GET_EXTENSION_ID] Starting dynamic search (this should not happen with hardcoded ID)...");
//   let extensionId = null;
//   const maxAttempts = 10;
//   const retryDelay = 1000;

//   for (let attempt = 1; attempt <= maxAttempts; attempt++) {
//     const serviceWorkers = context.serviceWorkers();
//     if (serviceWorkers.length > 0) {
//       for (const sw of serviceWorkers) {
//         if (sw.url().startsWith('chrome-extension://')) {
//           extensionId = sw.url().split('/')[2];
//           break;
//         }
//       }
//     }
//     if (extensionId) break;

//     const backgroundPages = context.backgroundPages();
//      if (backgroundPages.length > 0) {
//       for (const bp of backgroundPages) {
//         if (bp.url().startsWith('chrome-extension://')) {
//           extensionId = bp.url().split('/')[2];
//           break;
//         }
//       }
//     }
//     if (extensionId) break;
    
//     const pages = context.pages();
//     for (const p of pages) {
//         if (p.url().startsWith('chrome-extension://')) {
//             extensionId = p.url().split('/')[2];
//             break;
//         }
//     }
//     if (extensionId) break;

//     if (attempt < maxAttempts) {
//       await new Promise(resolve => setTimeout(resolve, retryDelay));
//     }
//   }

//   if (!extensionId) {
//     throw new Error(`Dynamic Extension ID discovery failed after ${maxAttempts} attempts.`);
//   }
//   return extensionId;
// }

// // Helper to get the options page URL
// export async function getOptionsPageUrl(context) {
//   const extensionId = await getExtensionId(context);
//   return `chrome-extension://${extensionId}/src/options.html`;
// }

// Helper to get the test page URL
export function getTestPageUrl() {
  const testPagePath = path.resolve(__dirname, 'test-page.html');
  return `file://${testPagePath}`;
}

export async function activateVSKeys(page) {
  await page.bringToFront();
  try {
    await page.locator('body').focus({ timeout: 1000 });
  } catch (e) { /* Gulp */ }

  const activationKey = 'S';
  await page.keyboard.down('Alt');
  await page.keyboard.down('Shift');
  await page.keyboard.press(activationKey);
  await page.keyboard.up('Shift');
  await page.keyboard.up('Alt');

  try {
    await page.locator('div:has-text("VSCode Shortcuts Activated")').waitFor({ state: 'visible', timeout: 3500 });
  } catch (e) {
    await page.waitForTimeout(750);
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
    await locator.fill('');
  } else if (await locator.evaluate(el => el.isContentEditable)) {
    await page.keyboard.press(isMac ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    if (await locator.innerText() !== '') {
        await locator.evaluate(el => el.innerHTML = '');
    }
  }

  if (value === '') return;
  
  if (tagName === 'input' || tagName === 'textarea') {
    await locator.fill(value);
  } else {
    await locator.type(value, { delay: 30 });
  }
}

export async function pressShortcut(page, shortcutString) {
  const isMac = process.platform === 'darwin';
  let playwrightShortcut = shortcutString;

  if (isMac) {
    playwrightShortcut = playwrightShortcut.replace(/\bCtrl\b/g, 'Meta');
    playwrightShortcut = playwrightShortcut.replace(/\bCmd\b/g, 'Meta');
    playwrightShortcut = playwrightShortcut.replace(/\bAlt\b/g, 'Alt');
  } else {
     playwrightShortcut = playwrightShortcut.replace(/\bCmd\b/g, 'Control');
  }
  await page.keyboard.press(playwrightShortcut);
}

export async function getClipboardText(page) {
  await page.bringToFront();
  try {
    await page.locator('body').focus({timeout: 1000});
  } catch(e) { /* Gulp */ }
  await page.waitForTimeout(250);
  try {
    const text = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch (err) {
        return `CLIPBOARD_READ_ERROR: ${err.message}`;
      }
    });
     if (text.startsWith('CLIPBOARD_READ_ERROR')) {
        return "";
    }
    return text;
  } catch (e) {
    return "";
  }
}

export function getDisplayKeyForTest(keyString, isMac = process.platform === 'darwin') {
    let result = keyString;
    if (isMac) {
        result = result
            .replace(/\bCtrl\b/g, '⌘')
            .replace(/\bMeta\b/g, '⌘')
            .replace(/\bAlt\b/g, '⌥')
            .replace(/\bShift\b/g, '⇧')
            .replace(/\bEnter\b/g, '↵')
            .replace(/\bArrowUp\b/g, '↑')
            .replace(/\bArrowDown\b/g, '↓')
            .replace(/\bArrowLeft\b/g, '←')
            .replace(/\bArrowRight\b/g, '→')
            .replace(/\+/g, ' ');
    } else {
        result = result
            .replace(/\bArrowUp\b/g, 'Up')
            .replace(/\bArrowDown\b/g, 'Down')
            .replace(/\bArrowLeft\b/g, 'Left')
            .replace(/\bArrowRight\b/g, 'Right');
    }
    return result.trim();
}