# Project Plan: On-Demand VSCode Shortcut Activation

**Goal:** Modify the Chrome extension so that VSCode-like shortcuts are not active by default. Users will press a configurable "activation shortcut" to enable these shortcuts for the current web page. Activation will provide clear visual feedback.

**Key User Preferences Incorporated:**
*   **Activation Scope:** Shortcuts become active for *any* editable field on the page once the activation shortcut is used, and remain active until explicitly deactivated.
*   **Deactivation:** Pressing the activation shortcut again (when an editable field is focused, or generally to toggle the page-wide active state).
*   **Visual Feedback:**
    *   A temporary message near the focused editable field upon activation/deactivation.
    *   A persistent visual cue (e.g., border change) on *all visible editable fields* while the mode is active for the page.
*   **Incorrect Activation Warning:** After 2 (configurable) presses of the activation shortcut outside an editable field within a short timeframe, a temporary warning message will appear.
*   **Default Activation Shortcut:** `Ctrl+Shift+S` (configurable).

---

### I. Core Logic Changes (Content Script - `src/content_script.js`)

1.  **State Management:**
    *   Introduce `isVscodeModeActive` (boolean, default: `false`): Tracks if shortcuts are active for the current tab.
    *   Introduce `lastFocusedEditableOnAction` (element reference, default: `null`): Stores the editable element that was focused when activation/deactivation occurred, to help position temporary feedback.
    *   Introduce `incorrectActivation` object: `{ count: 0, lastTime: 0 }` to track presses of the activation shortcut outside editable fields.

2.  **Main Key Down Handler (`mainKeyDownHandler`) Modifications:**
    *   The logic for the activation shortcut will be the *first* thing processed.
    *   **On Activation Shortcut Press:**
        *   Let `currentFocusedElement = document.activeElement;`
        *   **If `isVscodeModeActive` is `true` (attempting to deactivate):**
            *   Set `isVscodeModeActive = false;`.
            *   `lastFocusedEditableOnAction = isEditable(currentFocusedElement) ? currentFocusedElement : null;`
            *   Show "VSCode Shortcuts Deactivated" temporary message (near `lastFocusedEditableOnAction` if available, otherwise general page message).
            *   Call `removePersistentActivationCues()`.
            *   Reset `incorrectActivation.count = 0;`.
            *   Prevent default browser action and stop propagation.
        *   **Else (`isVscodeModeActive` is `false`, attempting to activate):**
            *   **If `isEditable(currentFocusedElement)`:**
                *   Set `isVscodeModeActive = true;`.
                *   `lastFocusedEditableOnAction = currentFocusedElement;`
                *   Show "VSCode Shortcuts Activated" temporary message near `lastFocusedEditableOnAction`.
                *   Call `applyPersistentActivationCues()`.
                *   Reset `incorrectActivation.count = 0;`.
                *   Prevent default browser action and stop propagation.
            *   **Else (not `isEditable(currentFocusedElement)` - incorrect activation attempt):**
                *   Manage `incorrectActivation.count` and `incorrectActivation.lastTime` to detect rapid succession.
                *   If `incorrectActivation.count >= settings.incorrectActivationWarningThreshold`:
                    *   Show "Activation shortcut pressed. Focus an editable field to use VSCode shortcuts." temporary message.
                    *   Reset `incorrectActivation.count = 0;`.
                *   *Do not* prevent default or stop propagation for incorrect attempts, allowing the key press for other browser functions.
    *   **Conditional Shortcut Execution:**
        *   After the activation logic, if `!isVscodeModeActive`, the function will `return` immediately.
        *   The existing logic for handling specific VSCode shortcuts (chords, regular keys) will only execute if `isVscodeModeActive` is `true` and an editable field is focused (as per existing checks like `isEditable(activeElement)`).

3.  **Visual Feedback Implementation:**
    *   **Temporary Messages:**
        *   Adapt the existing `showFeedbackMessage()` function to display activation, deactivation, and warning messages. It should be able to position messages near a target element or show a general page message.
    *   **Persistent Visual Cues:**
        *   Define a CSS class (e.g., `vscode-keys-active-field`) that applies a distinct border (e.g., `2px solid #007ACC`). This style can be injected dynamically.
        *   `applyPersistentActivationCues()`:
            *   Iterates through all known editable elements on the page (e.g., `textarea`, `input[type="text"]`, `[contenteditable="true"]`).
            *   Adds the `vscode-keys-active-field` class to them.
        *   `removePersistentActivationCues()`:
            *   Removes the `vscode-keys-active-field` class from all relevant elements.
        *   **Dynamic Element Handling (Consideration for future enhancement):** For dynamically added editable fields after activation, a `MutationObserver` could be used to automatically apply/remove cues. For the initial implementation, cues will apply to elements present at the time of activation/deactivation.

4.  **Loading New Settings in `loadSettingsAndInitialize()`:**
    *   Fetch `activationShortcut` (key string) and `incorrectActivationWarningThreshold` (number) from the `globalSettings` object retrieved from `chrome.storage.sync`.
    *   Store these in module-level variables (e.g., `loadedActivationShortcutKey`, `loadedWarningThreshold`).

---

### II. Settings UI & Logic (Options Page - `src/options.html` & `src/options.js`)

1.  **HTML Structure (`src/options.html`):**
    *   Create a new section, possibly labeled "Global Activation Settings" or similar.
    *   Within this section:
        *   A dedicated area for the "Activation Shortcut":
            *   Display label: "Extension Activation Shortcut".
            *   Key display area (e.g., `<kbd>`).
            *   "Edit" button.
        *   A dedicated area for "Incorrect Activation Warning":
            *   Display label: "Warn after N incorrect activation attempts outside text fields:".
            *   Number input field (`<input type="number" min="1">`).

2.  **JavaScript Logic (`src/options.js`):**
    *   **Loading Settings (`loadSettings` function):**
        *   Retrieve `activationShortcut` and `incorrectActivationWarningThreshold` from `data.globalSettings`.
        *   Populate the new UI elements with these values, using defaults from `DEFAULT_GLOBAL_SETTINGS` if not found in storage.
    *   **Saving Settings (within `saveButton` event listener):**
        *   Read the values from the new "Activation Shortcut" key capture mechanism and the "Incorrect Activation Warning Threshold" input.
        *   Store these values in the `globalSettingsToSave` object before calling `chrome.storage.sync.set`.
    *   **Key Capture for Activation Shortcut:**
        *   Adapt the existing key capture UI and logic (`startKeyCapture`, `handleKeyCaptureEvent`, `formatCapturedKey`, `saveCapturedKey` etc.) to work for this single, global activation shortcut.
        *   This will involve:
            *   Triggering capture from the new "Edit" button for the activation shortcut.
            *   Displaying "Press key..." feedback in its dedicated area.
            *   Saving the captured key to a temporary variable representing the pending `activationShortcut` value.
        *   **Conflict Detection:** The `isKeyConflicting` function (and its site-specific counterpart) must be updated to check the new activation shortcut against all other configured shortcuts (global and site-specific) to prevent users from setting a conflicting key.
    *   **UI Updates:**
        *   Ensure the options page correctly displays the currently configured (or default) activation shortcut and warning threshold upon loading.
        *   Update the display immediately if the user changes these settings locally (before saving).

---

### III. Default Configurations (`src/common.js`)

1.  **Update `DEFAULT_GLOBAL_SETTINGS`:**
    *   Add: `activationShortcut: 'Ctrl+Shift+S'`
    *   Add: `incorrectActivationWarningThreshold: 2`
    *   Add: `activationBorderColor: '#007ACC'` (or similar, for the persistent border)
    *   Add: `feedbackOnActivation: true` (boolean to control temporary message on activation)
    *   Add: `feedbackOnDeactivation: true` (boolean to control temporary message on deactivation)
    *   Add: `persistentCueStyle: 'border'` (string: 'border', 'none', potentially 'icon' later)

---

### IV. Flow Diagram for `mainKeyDownHandler` (Revised)

```mermaid
graph TD
    A[Keydown Event] --> B{Is it Activation Shortcut?};

    B -- Yes --> C{isVscodeModeActive currently true?};
    C -- Yes (Attempting Deactivation) --> D[Set isVscodeModeActive = false];
    D --> E[focusedEl = current active element];
    E --> F[Show Deactivation Feedback (temp, near focusedEl if editable)];
    F --> G[Remove Persistent Activation Cues from all editable fields];
    G --> H[Reset incorrectActivation.count];
    H --> Z[Prevent Default & Stop Propagation, Return];

    C -- No (Attempting Activation) --> I{Is current element editable?};
    I -- Yes --> J[Set isVscodeModeActive = true];
    J --> K[focusedEl = current active element];
    K --> L[Show Activation Feedback (temp, near focusedEl)];
    L --> M[Apply Persistent Activation Cues to all editable fields];
    M --> N[Reset incorrectActivation.count];
    N --> Z;

    I -- No (Incorrect Activation Attempt) --> O[Handle Incorrect Activation Count];
    O --> P{Threshold Met for Warning?};
    P -- Yes --> Q[Show "Focus editable field" Warning (temp)];
    Q --> R[Reset incorrectActivation.count];
    R --> Y[Allow Default Browser Action, Return];
    P -- No --> Y;

    B -- No (Not Activation Shortcut) --> S{isVscodeModeActive true?};
    S -- No --> Y; % Mode not active, do nothing further with VSCode shortcuts
    S -- Yes --> T{Is current element editable? (Existing Check)};
    T -- No --> Y; % Mode active, but not in editable field, do nothing further
    T -- Yes --> U[Process VSCode Shortcuts (Existing Chord/Regular Logic)];
    U --> Z;