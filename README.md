# VS Keys ⌨️✨

**Bring your favorite VS Code text editing shortcuts to any text field on the web!**

VS Keys is a Chrome extension that empowers you to use a wide range of Visual Studio Code's powerful text editing shortcuts directly within `<input>`, `<textarea>`, and `contenteditable` elements on any webpage. Boost your productivity and maintain a consistent editing workflow across your browser.

[![GitHub stars](https://img.shields.io/github/stars/alexferrari88/vs-keys?style=social)](https://github.com/alexferrari88/vs-keys)
[![GitHub license](https://img.shields.io/github/license/alexferrari88/vs-keys)](https://github.com/alexferrari88/vs-keys/blob/main/LICENSE)
<!-- Add this line once you publish to the Chrome Web Store -->
<!-- [![Chrome Web Store](https://img.shields.io/chrome-web-store/v/YOUR_EXTENSION_ID_HERE?label=Chrome%20Web%20Store)](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID_HERE) -->

## Features

*   **Comprehensive Shortcut Support:** Implements many essential VS Code shortcuts, including:
    *   Line operations (cut, copy, delete, move, duplicate)
    *   Indentation (indent/outdent lines)
    *   Commenting (toggle line/block comments)
    *   Selection enhancements (select line, smart home)
    *   Case transformation (uppercase, lowercase, title case)
    *   Whitespace management (trim trailing whitespace)
    *   And more!
*   **Works Everywhere:** Enhances standard input fields, textareas, and rich text editors using `contenteditable`.
*   **Customizable:**
    *   Enable/disable individual shortcuts.
    *   Disable the extension on specific websites to avoid conflicts.
    *   Configure visual feedback for actions.
*   **Visual Feedback:** Get subtle on-screen confirmations for actions like "Line Copied" or "Text Uppercased".
*   **Mac-Friendly Display:** Shows Mac-specific key symbols (⌘, ⌥, ⇧) in the options page if you're on a Mac.
*   **Lightweight and Efficient:** Designed to be non-intrusive and performant.

## Implemented Shortcuts (Default)

Here's a list of commonly used shortcuts available by default (these can be toggled in settings):

**Editing & Clipboard:**
*   `Ctrl+X` / `⌘X`: Cut line (empty selection) / Cut selection
*   `Ctrl+C` / `⌘C`: Copy line (empty selection) / Copy selection
*   `Ctrl+V` / `⌘V`: Paste (with VS Code-like line pasting behavior)
*   `Ctrl+Z` / `⌘Z`: Undo (Browser Native)
*   `Ctrl+Y` / `⌘Y`: Redo (Browser Native)

**Line Operations:**
*   `Ctrl+Shift+K` / `⌘⇧K`: Delete Line
*   `Ctrl+Enter` / `⌘↵`: Insert Line Below
*   `Ctrl+Shift+Enter` / `⌘⇧↵`: Insert Line Above
*   `Alt+DownArrow` / `⌥↓`: Move Line Down (Textarea)
*   `Alt+UpArrow` / `⌥↑`: Move Line Up (Textarea)
*   `Shift+Alt+DownArrow` / `⇧⌥↓`: Copy Line Down
*   `Shift+Alt+UpArrow` / `⇧⌥↑`: Copy Line Up

**Selection & Navigation:**
*   `Ctrl+L` / `⌘L`: Select current line
*   `Home`: Smart Home (to first non-whitespace / line start)
*   `Ctrl+D` / `⌘D`: Select word / Find next occurrence (single selection)

**Indentation & Comments:**
*   `Ctrl+]` / `⌘]`: Indent Line/Selection
*   `Ctrl+[` / `⌘[`: Outdent Line/Selection
*   `Ctrl+/` / `⌘/`: Toggle Line Comment
*   `Shift+Alt+A` / `⇧⌥A`: Toggle Block Comment
*   `Ctrl+K Ctrl+C` / `⌘K ⌘C`: Add Line Comment
*   `Ctrl+K Ctrl+U` / `⌘K ⌘U`: Remove Line Comment

**Case Transformation & Whitespace:**
*   `Ctrl+Alt+U` / `⌘⌥U`: Selection to UPPERCASE
*   `Ctrl+Alt+L` / `⌘⌥L`: Selection to lowercase
*   `Ctrl+Alt+T` / `⌘⌥T`: Selection to Title Case
*   `Ctrl+K Ctrl+W` / `⌘K ⌘W`: Trim Trailing Whitespace

*(For a complete list and to customize, check the extension's options page!)*

## Installation

### From Chrome Web Store (Recommended - Coming Soon!)

1.  Once published, visit the VS Keys page on the Chrome Web Store.
2.  Click "Add to Chrome".
3.  Enjoy your enhanced text editing!

### Manual Installation (for Development or Testing)

1.  **Clone or Download:**
    *   Clone this repository: `git clone https://github.com/alexferrari88/vs-keys.git`
    *   Or, download the ZIP and extract it.
2.  **Open Chrome Extensions:**
    *   Navigate to `chrome://extensions` in your Chrome browser.
3.  **Enable Developer Mode:**
    *   Ensure the "Developer mode" toggle in the top-right corner is switched on.
4.  **Load Unpacked:**
    *   Click the "Load unpacked" button.
    *   Select the directory where you cloned or extracted the extension files (the folder containing `manifest.json`).
5.  **Pin the Extension (Optional):**
    *   Click the puzzle icon (Extensions) in the Chrome toolbar and pin VS Keys for easy access to its options.

## Usage

Once installed, VS Keys will automatically be active on web pages. Simply focus an editable text field and use your familiar VS Code shortcuts!

*   **Accessing Options:** Click the VS Keys icon in your Chrome toolbar (or find it in the Extensions menu) to open the settings page. Here you can:
    *   Toggle individual shortcuts on or off.
    *   Add websites where you want VS Keys to be disabled.
    *   Configure visual feedback settings.

## Contributing

Contributions are welcome! Whether it's reporting a bug, suggesting a feature, or submitting a pull request, your help is appreciated.

1.  **Fork the repository.**
2.  **Create a new branch** for your feature or bug fix: `git checkout -b feature/your-feature-name` or `bugfix/issue-description`.
3.  **Make your changes.**
4.  **Test thoroughly.**
5.  **Commit your changes:** `git commit -m "feat: Implement amazing new feature"` (Follow Conventional Commits if possible).
6.  **Push to your branch:** `git push origin feature/your-feature-name`.
7.  **Open a Pull Request** against the `main` branch of this repository.

Please ensure your code follows the existing style and that any new features are well-documented.

## Support VS Keys

If you find VS Keys helpful and want to support its development, you can become a sponsor! Your support helps me dedicate more time to improving this extension and creating other useful open-source projects.

[![Sponsor alexferrari88 on GitHub Sponsors](https://img.shields.io/badge/Sponsor%20on%20GitHub-%E2%9D%A4-%23db61a2?style=flat&logo=github)](https://github.com/sponsors/alexferrari88)

Every contribution, no matter the size, is greatly appreciated!

## Known Limitations & Considerations

*   **`contenteditable` Complexity:** While VS Keys strives to work well with `contenteditable` elements (used by many rich text editors), the diverse and complex nature of their HTML structures means some shortcuts might behave differently or less predictably compared to standard `<textarea>` elements.
*   **Web App Conflicts:** Some web applications have their own extensive keyboard shortcuts. While VS Keys allows disabling on specific sites, an undiscovered conflict might occur. Please report such issues!
*   **Multi-Cursor Features:** Advanced VS Code features like multi-cursor editing are extremely complex to replicate reliably in a browser environment and are currently outside the scope of this extension.

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [alexferrari88](https://github.com/alexferrari88)