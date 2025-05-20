# Testing Plan for "VS Code Shortcuts for Web" Chrome Extension

This document outlines the testing strategy for the "VS Code Shortcuts for Web" Chrome extension. It includes unit, integration, and end-to-end (E2E) testing approaches.

## Testing Layers Overview

```mermaid
graph TD
    A[VS Code Shortcuts for Web Testing] --> B{Testing Layers};
    B --> C[Unit Tests (Jest)];
    B --> D[Integration Tests (Jest)];
    B --> E[End-to-End Tests (Puppeteer)];

    C --> C0[common.js Unit Tests];
    C0 --> C0a[DEFAULT_SHORTCUT_SETTINGS_CONFIG & DEFAULT_GLOBAL_SETTINGS (Constants validation)];
    C0 --> C0b[parseKeyString() (Varied inputs, edge cases, normalization)];
    C0 --> C0c[eventMatchesKey() (Extensive cases: modifiers, Mac/non-Mac, Alt+key, event.code logic)];

    C --> C1[Content Script Logic];
    C1 --> C1a[Action Handlers (e.g., handleCutLine in content_operations.js/content_actions.js)];
    C1 --> C1b[Utility Functions (e.g., isEditable in content_utils.js)];
    C1 --> C1c[Settings Loading & Processing (loadSettingsAndInitialize in content_script.js)];
    C1 --> C1d[Site Disabling Logic (within loadSettingsAndInitialize)];

    C --> C2[Options Page Logic (options.js)];
    C2 --> C2a[UI Event Handlers & Rendering];
    C2 --> C2b[Settings Persistence (saving/loading from chrome.storage)];
    C2 --> C2c[Input Validation (e.g., for custom shortcuts)];

    D --> D1[Content Script Interactions (content_script.js)];
    D1 --> D1a[mainKeyDownHandler: Key Event Routing (chords, non-chords, using eventMatchesKey)];
    D1 --> D1b[mainKeyDownHandler: Chord Timeout & State Management];
    D1 --> D1c[mainKeyDownHandler: Interaction with Action Handlers];
    D1 --> D1d[Paste Event Handling & _extensionHandledPaste flag];
    D1 --> D1e[Message Handling (chrome.runtime.onMessage for settingsUpdated)];

    D --> D2[Options Page & Content Script];
    D2 --> D2a[Settings changes in Options reflect in Content Script behavior (via chrome.storage & message passing)];

    E --> E1[Core Shortcut Functionality];
    E1 --> E1a[Single Key Shortcuts on various input elements];
    E1 --> E1b[Chorded Key Shortcuts (using default and custom chords)];
    E1 --> E1c[Interaction with native browser shortcuts (prevention where appropriate)];

    E --> E2[Options Page Functionality];
    E2 --> E2a[Loading and Displaying Settings from DEFAULT_SHORTCUT_SETTINGS_CONFIG and storage];
    E2 --> E2b[Modifying and Saving Shortcut keys and enabled/disabled status];
    E2 --> E2c[Managing Disabled Sites List];
    E2 --> E2d[Changing Global Settings (e.g., feedback duration) and verifying effect];

    E --> E3[Site Disabling Feature];
    E3 --> E3a[Shortcuts active on enabled sites];
    E3 --> E3b[Shortcuts inactive on disabled sites (based on hostname matching)];

    subgraph Mocking_Helpers_Setup [Mocking, Helpers & Setup]
        M1[Mock chrome.* APIs (storage, runtime, i18n if used)]
        M2[Mock DOM (document, activeElement, window.location, selection APIs, input elements)]
        M3[Test HTML pages for E2E (various input fields, iframes if all_frames:true is relevant)]
        M4[Jest setup (jest.config.js, jest-chrome for mocks)]
        M5[Puppeteer setup (helper to load extension, navigate, interact)]
    end
    C --> M1; C --> M2; C --> M4;
    D --> M1; D --> M2; D --> M4;
    E --> M3; E --> M5;
```

## 1. Unit Tests (using Jest)

*   **Goal:** Test individual functions and modules in isolation.
*   **Framework:** Jest
*   **Key Files & Functions for Unit Testing:**
    *   **`common.js`:**
        *   `DEFAULT_SHORTCUT_SETTINGS_CONFIG`:
            *   Verify definition and presence of core actions.
            *   Check structure for sample actions (keys: `defaultKey`, `description`, `category`, `defaultEnabled`).
            *   Validate `chordPrefix` and `chordKey` for chorded actions.
            *   Ensure `defaultKey` strings are parsable by `parseKeyString`.
        *   `DEFAULT_GLOBAL_SETTINGS`:
            *   Verify definition and presence of expected keys.
        *   `parseKeyString(keyString)`:
            *   Test with various valid inputs: "A", "Ctrl+C", "Shift+Alt+ArrowUp", "Ctrl+]", "Ctrl+K C".
            *   Test key normalization (e.g., "enter", "space").
            *   Test edge cases: empty string, only modifiers.
            *   Assert correct output structure: `{ ctrl, shift, alt, meta, key }`.
        *   `eventMatchesKey(event, parsedKey, isMac)`:
            *   Test numerous `event` object scenarios against `parsedKey` outputs.
            *   Cover `isMac` true/false.
            *   Test modifier logic (exact matches, no modifiers, extra modifiers).
            *   Test `event.key` vs `parsedKey.key` (case-insensitive).
            *   Test `event.code` logic for `Alt` key combinations.
            *   Test non-modifier shortcuts only trigger if no modifiers are pressed.
    *   **`content_script.js`**:
        *   `loadSettingsAndInitialize()`: Mock `chrome.storage.sync.get` and `window.location`. Test:
            *   Loading/merging default and stored shortcut settings (including old format migration).
            *   Loading/merging default and stored global settings.
            *   Correct `isSiteDisabled` determination (including `*.domain.com` matching).
    *   **`content_utils.js`** (and similar utility files):
        *   `isEditable()`: Test with mock DOM elements.
        *   `showFeedbackMessage()`: Test feedback element creation/update (mocking DOM).
    *   **`content_operations.js` & `content_actions.js`**:
        *   Test each action handler (e.g., `handleCutLine`, `handleMoveLine`, `handleToggleLineCommentAction`).
        *   Mock `activeElement` (with `value`, `selectionStart`, `selectionEnd`, `type`, `isContentEditable`).
        *   Mock `currentGlobalSettings`.
        *   Assert changes to `activeElement.value`, `selectionStart`/`End`.
        *   Mock and verify `navigator.clipboard` calls.
    *   **`options.js`**:
        *   Functions for rendering shortcuts: Mock dependencies, verify DOM generation.
        *   Event handlers for input changes: Mock DOM and `chrome.storage.sync.set`.
        *   Functions for saving/loading settings.
        *   Logic for managing the disabled sites list.
*   **Mocking Strategy:**
    *   Use `jest-chrome` for mocking Chrome APIs (`storage`, `runtime`).
    *   Manual mocks for DOM elements, `window`, `document`, `navigator`.

## 2. Integration Tests (using Jest)

*   **Goal:** Test interactions between modules, primarily within the content script's logic.
*   **Framework:** Jest
*   **Focus Areas for `content_script.js`:**
    *   **`mainKeyDownHandler()`:**
        *   Provide mock `event` objects and initial settings.
        *   Verify `eventMatchesKey` is called correctly.
        *   Test routing to `shortcutActionHandlers` for non-chorded shortcuts.
        *   Test chord sequence logic: prefix detection, `chordState` update, feedback, full chord execution, timeout, invalid second key.
        *   Verify `event.preventDefault()` and `event.stopPropagation()`.
        *   Test behavior when `isSiteDisabled` is true.
    *   **Paste Handling:**
        *   Simulate `mainKeyDownHandler` calling `handlePaste` (setting `_extensionHandledPaste = true`).
        *   Simulate a `'paste'` event, verify cancellation and flag reset.
    *   **Settings Updates:**
        *   Mock `chrome.runtime.onMessage.addListener`. Trigger "settingsUpdated" message.
        *   Verify `loadSettingsAndInitialize()` is called and settings are updated.
*   **Mocking Strategy:** Similar to unit tests.

## 3. End-to-End (E2E) Tests (using Puppeteer)

*   **Goal:** Test the extension in a real browser environment, simulating user workflows.
*   **Framework:** Puppeteer
*   **Scenarios:**
    *   **Setup:**
        *   Load the extension into Puppeteer.
        *   Use local test HTML pages with various editable elements (`<input>`, `<textarea>`, `contenteditable`).
    *   **Core Shortcut Functionality:**
        *   For a representative subset of shortcuts:
            *   Navigate, focus, press keys via Puppeteer.
            *   Verify outcomes (text, selection, clipboard content, feedback messages).
        *   Test chorded shortcuts thoroughly.
    *   **Options Page (`options.html`):**
        *   Open options page.
        *   Verify settings display.
        *   **Modify a shortcut:** Change key, disable. Save. Test effects on a test page.
        *   **Disabled Sites:** Add/remove test page's hostname, save, verify shortcut status on test page.
        *   **Global Settings:** Change feedback duration, verify effect.
    *   **Error Cases:** Test scenarios that might lead to errors (e.g., actions on non-editable elements).

## Mocking, Helpers & Setup Summary

*   **Jest Setup:**
    *   `jest.config.js`
    *   `jest-chrome` for Chrome API mocks.
    *   Global mocks for DOM/`window` if necessary.
*   **Puppeteer Setup:**
    *   Helper functions to load the extension.
    *   Helper functions for navigation and common interactions.
    *   A simple local web server for test HTML pages.
*   **Test HTML Files:** A suite of simple HTML files with different input types, text, and structures to test against.

This plan should provide a solid foundation for testing the "VS Code Shortcuts for Web" extension.