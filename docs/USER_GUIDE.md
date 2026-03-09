# GPT-AI Markdown Editor: User Guide

Welcome to the **GPT-AI Markdown Editor**, a powerful, premium WYSIWYG editor designed specifically for VS Code. This guide covers the key features and how to make the most of your editing experience.

---

## 🚀 Getting Started

### Opening a File
To open a file with the editor:
- **Right-click** any `.md` or `.markdown` file in the VS Code Explorer and select **"Open with GPT-AI Markdown Editor"**.
- Alternatively, click the **"GPT-AI" icon** in the editor title bar when a markdown file is already open.

### The Workspace
- **WYSIWYG Mode**: The default view where you see your formatted content (Bold, Italic, Tables, Images, etc.) exactly as it will appear.
- **Source Mode**: Click the `</>` icon in the toolbar to toggle between the visual editor and the raw markdown source code.

---

## 🖼️ Image Management (The Human Way)

The GPT-AI editor solves the biggest pain point of markdown: images.

- **Drag & Drop**: Drag an image from your computer directly into the editor. We handle the paths and storage automatically.
- **Visual Resizing**: Click any image to reveal blue drag handles at the corners. Resize your image visually to fit your document layout.
- **HTML Tag Conversion**: When you resize an image, the editor automatically converts the standard markdown `![]()` syntax into an `<img />` tag with specific `width` and `height`. This ensures your custom size is preserved in all markdown viewers.
- **Revert to Original**: Want the standard markdown image back? Right-click the image and select **"Revert to original size"**. This removes the dimensions and switches it back to a standard markdown image tag.
- **In-Place Renaming**: Right-click an image and select **"Rename Image"**. We'll rename the file on your disk and update all references in your document automatically.

---

## 📊 Visual Table Editing

Stop fighting with pipes (`|`) and dashes (`-`).

- **Interactive Rows/Columns**: Hover over the edges of a table to see the `+` icons for adding rows or columns instantly.
- **Visual Resizing**: Click and drag the borders of columns to adjust their width visually.
- **Context Menu**: Right-click any cell to access options for deleting rows/columns or adding them at specific positions.
- **Navigation**: Use `Tab` and `Shift+Tab` to move smoothly between cells, just like in a spreadsheet.

---

## 🧜 Mermaid Diagrams

Create beautiful, live-rendered diagrams using the powerful [Mermaid](https://mermaid.js.org/) syntax.

- **Live Rendering**: Type your Mermaid code and watch the diagram render instantly in the editor.
- **Templates**: Use the Mermaid Insert tool in the toolbar to choose from over 15 built-in templates (Flowcharts, Sequence Diagrams, Gantt Charts, etc.).
- **Double-Click to Edit**: Double-click any rendered diagram to open the code editor and make quick adjustments.

---

## ✨ Pro Features

- **GitHub Alerts**: Create beautiful callouts (Note, Tip, Important, Warning, Caution) that render exactly like they do on GitHub.
- **Math Support**: Write LaTeX and see it rendered beautifully via KaTeX.
- **Enhanced Links**: Use the link modal to search for heading links or other files within your workspace.
- **Document Outline**: Use the VS Code Sidebar "Outline" view to quickly jump between sections of your document.

---

## 🛠️ For Developers & Maintainers

If you are building the extension from source, we have automated the versioning and packaging process:

### `npm run repackage`
This single command handles the entire release flow:
1.  **Increments Patch Version**: Automatically bumps the version in `package.json` (e.g., `1.2.3` → `1.2.4`).
2.  **Cleans Environment**: Deletes any existing `.vsix` files in the `dist/` folder.
3.  **Production Build**: Runs a full production-ready build of the extension and webview.
4.  **VSIX Package**: Generates a clean `.vsix` file in the `dist/` folder ready for sharing or local installation.

---

## 📄 License & Credits
Built with ❤️ by the open-source community. Based on the original work by Concretios. Licensed under MIT.
