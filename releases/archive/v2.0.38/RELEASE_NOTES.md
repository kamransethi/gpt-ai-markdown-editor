# Version 2.0.38

**Release Date**: April 16, 2026
**Previous Release**: [v2.0.37](../v2.0.37/)

## What's New

### Draw.io Diagram Editing

Double-click any embedded `.drawio.svg` image in the editor to open it for editing. If the [Draw.io Integration](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio) extension is installed, it opens directly in the diagram editor — the same as opening from the file explorer. If not installed, VS Code falls back to the built-in SVG viewer.

### Drop Any File onto the Editor

Previously only images could be dropped onto the editor. Now any file type is accepted. When you drop a non-image file (PDF, ZIP, script, etc.), the editor prompts for a save location, copies the file to your media folder, and inserts a bulleted Markdown link — ready to commit alongside your document.

### AI Provider Fallback & Broader VS Code Support

- Minimum supported VS Code version lowered from **1.115.0 → 1.90.0**, enabling use in older VS Code builds, Cursor, Windsurf, and other forks.
- If GitHub Copilot is unavailable, the editor detects Ollama automatically and suggests it as an alternative.
- AI features that fail now show clear, actionable error messages instead of silent failures.

### Custom Configuration Panel

A new dedicated settings panel (accessible via **Preferences → Configuration** or the toolbar gear icon) replaces the VS Code native settings UI for extension-specific options. Includes:

- A **Check Models** button that queries the VS Code Language Model API and shows which Copilot models are currently available — no more guessing model names.
- Corrected toggle alignment and layout.

### Quick Open Panel

The **Save and Open** panel has been renamed and redesigned as **Quick Open** — a lightweight dropdown that lists Markdown files in the workspace for fast switching without leaving the editor.

### Image & Attachment Folder Configuration

The paste and insert dialogs now show editable path fields for the media/attachment target folder. Settings are persisted per session so you don't have to re-enter them each time.

---

## Bug Fixes

- Fixed a blank-editor bug when double-clicking Draw.io images (`vscode.openWith` used wrong editor ID; replaced with `vscode.open`).
- Fixed toggle control alignment in the settings panel (flex layout correction).
- Fixed input field box-sizing in the image configuration dialog.
- Removed a redundant "Save to folder" override field that duplicated the main path field.

---

## Internal

- All `<br />` self-closing tags replaced with `<br>` in generated Markdown output — reduces token usage and improves compatibility with strict HTML parsers.
- H3 headings now use the same blue accent colour as H2 for visual consistency.

---

## Stats

**Test Status**: ✅ 1023 tests passing
**Build**: ✅ Debug and release builds clean
**Linting**: ✅ All checks pass

---

## Installation

### VS Code Marketplace

[Install Flux Flow Markdown Editor](https://marketplace.visualstudio.com/items?itemName=kamransethi.gpt-ai-markdown-editor)

### Recommended Companion Extension

Install [**Draw.io Integration**](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio) (`hediet.vscode-drawio`) to enable double-click editing of embedded `.drawio.svg` diagrams.

### Manual Installation

Download `gpt-ai-markdown-editor-2.0.38.vsix` and install via the VS Code Extensions panel → **Install from VSIX…**
