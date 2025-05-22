// __tests__/e2e/fixtures.js
import { test as base, chromium } from '@playwright/test';
import path from 'path';

// Resolve the path to your extension's 'dist' directory relative to this fixtures file
// Assuming fixtures.js is in __tests__/e2e/
// and your extension dist is in the root/dist
const pathToExtension = path.join(__dirname, '..', '..', 'dist');
console.log(`[Fixtures] Path to extension for persistent context: ${pathToExtension}`);


export const test = base.extend({
  // Fixture for the browser context, launched persistently with the extension
  context: async ({}, use) => {
    // For persistent context, an empty string for userDataDir means Playwright creates a temp one
    const userDataDir = ''; // Let Playwright manage the temp user data dir for persistence
    
    console.log('[Fixtures] Launching persistent context...');
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium', // Recommended for extensions
      // headless: false, // Optional: keep it headful for debugging, can be true for CI
      headless: process.env.HEADLESS !== 'false', // Match your usual config
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        // Add any other essential args you found helpful, but start minimal
        // e.g., '--disable-site-isolation-trials' if it was needed
      ],
      // slowMo: 250, // Optional for debugging
    });
    console.log('[Fixtures] Persistent context launched.');
    await use(browserContext);
    console.log('[Fixtures] Closing persistent context.');
    await browserContext.close();
  },

  // Fixture to get the extension ID
  extensionId: async ({ context }, use) => {
    console.log('[Fixtures] Attempting to get extensionId...');
    // For Manifest V3:
    let background;
    try {
        // Wait for the service worker to be available with a timeout
        console.log('[Fixtures] Waiting for serviceworker event or existing service worker...');
        background = await Promise.race([
            context.waitForEvent('serviceworker', { timeout: 15000 }), // Wait up to 15 seconds
            (async () => { // Check if already present
                const serviceWorkers = context.serviceWorkers();
                if (serviceWorkers.length > 0) {
                    console.log(`[Fixtures] Found existing service worker: ${serviceWorkers[0].url()}`);
                    return serviceWorkers[0];
                }
                return null; // Return null if not found, so Promise.race continues with waitForEvent
            })()
        ]);

        if (!background && context.serviceWorkers().length > 0) {
             // Fallback if race condition meant it was already there but initial check missed it
             console.log('[Fixtures] waitForEvent timed out or returned null, but SW found in context.serviceWorkers()');
             background = context.serviceWorkers()[0];
        }

    } catch (e) {
        console.error('[Fixtures] Error waiting for serviceworker event or getting existing SW:', e.message);
        // Attempt to see if it's there anyway, despite timeout/error
        const serviceWorkers = context.serviceWorkers();
        if (serviceWorkers.length > 0) {
            console.warn('[Fixtures] serviceworker event failed, but found one in context.serviceWorkers(). Using that.');
            background = serviceWorkers[0];
        } else {
            console.error('[Fixtures] No service worker found after error and final check.');
            throw new Error(`[Fixtures] Service worker not found. Error: ${e.message}. Check extension loading and SW registration.`);
        }
    }
    
    if (!background) {
        console.error('[Fixtures] CRITICAL: Service worker (background) is null or undefined.');
        throw new Error('[Fixtures] Failed to obtain service worker for the extension.');
    }

    const backgroundUrl = background.url();
    console.log(`[Fixtures] Service worker URL: ${backgroundUrl}`);
    if (!backgroundUrl || !backgroundUrl.startsWith('chrome-extension://')) {
        console.error(`[Fixtures] Invalid service worker URL: ${backgroundUrl}`);
        throw new Error(`[Fixtures] Invalid service worker URL obtained: ${backgroundUrl}`);
    }
    
    const extensionId = backgroundUrl.split('/')[2];
    console.log(`[Fixtures] Successfully obtained extensionId: ${extensionId}`);
    await use(extensionId);
  },
});

export const expect = test.expect;