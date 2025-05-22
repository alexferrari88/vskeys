// playwright.config.js
import { defineConfig } from '@playwright/test'; // Removed 'devices' as we rely on fixtures
import path from 'path';

// const pathToExtension = path.join(__dirname, 'dist'); // No longer needed here
// console.log(`[Playwright Config] Path to extension: ${pathToExtension}`); // No longer needed here

export default defineConfig({
  testDir: './__tests__/e2e',
  timeout: 70 * 1000,
  expect: {
    timeout: 15 * 1000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, // Keep retries for CI
  workers: 1, // Essential for persistent context tests if they share state (though our fixture creates a new temp dir)
  reporter: 'html',
  use: {
    // Global settings for all tests using the fixtures
    actionTimeout: 7000,
    trace: 'on-first-retry',
    permissions: ['clipboard-read', 'clipboard-write'],
    // headless: process.env.HEADLESS !== 'false', // This will be controlled by fixture now
    // channel: 'chromium', // This will be controlled by fixture now
  },

  projects: [
    {
      name: 'chromium-with-extension', // Name is for reporting
      // `use` block for project-specific browser launch is removed.
      // Fixtures will provide the context and extensionId.
    },
    // You can add other projects here if needed (e.g., for Firefox, WebKit without extension)
  ],
});