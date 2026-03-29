# Toolbar and Menu Documentation

This document describes all menu options in the markdown editor, organized from left to right.

## Toolbar Structure

The formatting toolbar is arranged left-to-right with logical groupings separated by dividers.

---

## Toolbar Buttons & Dropdowns (Left to Right)

### 1. **Save** (Button)
- Saves the current document to disk
- Icon: Save icon
- Always enabled
- Shortcut: Cmd/Ctrl+S (via editor shortcuts)

### 2. **Text Style** (Dropdown)
- Dropdown showing the current block style (e.g., "Paragraph", "Heading 1")
- **Layout**: Positioned immediately after the Save button for quick logical access to structure.
- **Items**:
  - Paragraph
  - Heading 1 through Heading 5
- Active item is highlighted
- Only enabled when editor has focus

---

### 3. **Text Formatting** (Flat Buttons)
- **Bold** (`Cmd/Ctrl+B`)
  - Toggles bold formatting on selected text
  - Active button shows current state

- **Italic** (`Cmd/Ctrl+I`)
  - Toggles italic formatting
  - Active button shows current state

- **Underline** (`Cmd/Ctrl+U`)
  - Toggles underline formatting
  - Active button shows current state

- **Font Color** (Color Grid Dropdown)
  - Shows current text color as an underline on the icon.
  - Displays a grid of **Material Design pastel colors** (Red, Pink, Purple, Blue, Teal, Green, Yellow, Orange).
  - Selected color is applied immediately to selection or new text.
  - Remembers the user's last-used color across sessions.
  - Only enabled when editor has focus.

- **Inline Code** (Button)
  - Wraps selected text in backticks (`` ` ``)
  - Only enabled when editor has focus

- **Strikethrough** (Button)
  - Toggles strikethrough formatting (`~~text~~`)
  - Only enabled when editor has focus

---

### 4. **List Types** (Flat Buttons)
- **Bullet List** (Unordered)
  - Converts selection to bullet-point list
  - Only enabled when editor has focus

- **Numbered List** (Ordered)
  - Converts selection to numbered list (1, 2, 3...)
  - Only enabled when editor has focus

- **Task List** (Checkbox)
  - Converts selection to task list with checkboxes (`- [ ] item`)
  - Checkboxes are interactive in the editor
  - Only enabled when editor has focus

---

### 5. **Insert Media & Objects** (Flat Buttons)
- **Image** (Button)
  - Opens the **native OS file picker** (multi-select) directly.
  - No intermediate dialog; images are inserted immediately at the cursor.
  - **Smart Linking**:
    - Automatically creates **relative links** for images inside the workspace.
    - Automatically **copies external images** to the project's media folder to prevent broken links.
  - Only enabled when editor has focus.

- **Link** (Button)
  - Opens link insertion/editing dialog
  - **Link Dialog Tabs** (in order):
    1. **Heading** - Link to heading within current document
    2. **File** - Link to another file in the workspace
    3. **URL** - Link to external web address
  - Dialog auto-detects if cursor is inside existing link for editing
  - Prefills form with selected text
  - Only enabled when editor has focus

- **Emoji** (Button)
  - Opens emoji picker panel
  - Features search functionality
  - Organized by categories
  - Only enabled when editor has focus

---

### 6. **Table** (Dropdown)
- **Section: Table**
  - **Insert table** - Opens dialog to specify rows and columns
    - Creates table with header row

- **Table Operations** (appears when cursor is in a table)
  - Insert row above
  - Insert row below
  - Delete row
  - Insert column left
  - Insert column right
  - Delete column
  - Delete table

- Only enabled when editor has focus

---

### 7. **Blocks & Alerts** (Dropdown)
- **Block Quote**
  - Wraps selection or creates new blockquote block
  - Supports nested blockquotes (`>` markdown syntax)
  - Active button shows when cursor is in blockquote

- **Section: Alerts** (GitHub-style alerts)
  - Alert type buttons (displayed in a row):
    - **Note** (blue, ℹ️) - `> [!NOTE]`
    - **Tip** (green, 💡) - `> [!TIP]`
    - **Important** (purple, 📢) - `> [!IMPORTANT]`
    - **Warning** (orange, ⚠️) - `> [!WARNING]`
    - **Caution** (red, 🔴) - `> [!CAUTION]`
  - Remove alert - Removes alert styling from the block

- **Section: Code Blocks**
  - Plain code block (no language)
  - Markdown code block
  - JSON
  - Python
  - JavaScript
  - TypeScript
  - Bash
  - HTML
  - CSS

- **Section: Diagrams**
  - Mermaid (empty) - Insert blank mermaid diagram block
  - Mermaid Flowchart - Insert flowchart template

- Only enabled when editor has focus (disabled inside tables)

---

### 8. **AI Explain** (Button)
- Opens AI explanation panel for the document.
- **Icon**: Sparkle icon (`wand_stars`).
- Shows structured analysis in a side panel.
- Always enabled.

---

### 9. **View** (Dropdown)
- **Section: Display**
  - **Source View** - Toggle between WYSIWYG and raw markdown editor
  - **Navigation Pane** - Toggle table of contents sidebar visibility

- **Section: Zoom**
  - **Zoom Level Display** - Shows current zoom percentage (e.g., "Zoom (90%)")
  - **Zoom In** - Increases editor zoom by 10%
  - **Zoom Out** - Decreases editor zoom by 10%
  - **Reset Zoom** - Returns to default zoom level (100%)
  - Range: 70% to 150%

- **Section: Preferences**
  - **Configuration** - Opens VS Code extension settings

- Always enabled

---

## Context Menus (Right-Click)

### On Text/Content in Editor
- **Open Link** - If cursor is over a link, opens it
- **Format Submenu**
  - Bold
  - Italic
  - Underline
  - Code
  - Strikethrough
  - Highlight
  - Text Color
- **Insert Link** - Opens link dialog
- **Insert Image** - Opens image dialog
- **Insert Table** - Opens table dialog
- **Insert Mermaid Block** - Inserts template
- **Cut**, **Copy**, **Paste** - Standard OS menu items

### On Table (inside table)
- **Table Operations Widget** - Insert/delete rows and columns
- **Format Submenu** - Same as text (Bold, Italic, etc.)

### On Image (right-click on image)
- **Resize** - Shows resize handles on image
- **Copy Image** - Copies image to clipboard
- **Delete** - Remove image from document
- **Copy Link** - Copies image markdown link

---

## Search & Replace Panel

- **Open**: `Cmd/Ctrl+F` (Find) or `Cmd/Ctrl+H` (Find & Replace)
- **Features**:
  - Find next match: Press `Enter` or click Find button
  - Find previous: `Shift+Enter`
  - Replace single: Click Replace button or press `Cmd/Ctrl+Shift+1`
  - Replace all: Click Replace All button or press `Cmd/Ctrl+Alt+Enter`
  - Match case: Toggle checkbox
  - Whole word: Toggle checkbox
  - Wraps from end to beginning of document
  - Highlights all matches in editor

---

## Keyboard Shortcuts Reference

| Action | Shortcut |
|--------|----------|
| **Bold** | `Cmd/Ctrl+B` |
| **Italic** | `Cmd/Ctrl+I` |
| **Underline** | `Cmd/Ctrl+U` |
| **Inline Code** | `Cmd/Ctrl+\`` |
| **Strikethrough** | `Cmd/Ctrl+Shift+X` |
| **Insert Link** | `Cmd/Ctrl+K` |
| **Insert Image** | `Cmd/Ctrl+V` (paste) or drag from Finder |
| **Insert Table** | `Cmd/Ctrl+Shift+T` |
| **Save** | `Cmd/Ctrl+S` |
| **Find** | `Cmd/Ctrl+F` |
| **Find & Replace** | `Cmd/Ctrl+H` |
| **Undo** | `Cmd/Ctrl+Z` |
| **Redo** | `Cmd/Ctrl+Shift+Z` or `Cmd/Ctrl+Y` |
| **Indent** | `Tab` |
| **Unindent** | `Shift+Tab` |

---

## Extension Settings

Accessible via **View > Configuration** or through VS Code Settings (`Cmd/Ctrl+,`).

### Spacing & Typography
- `editorLineSpacing` - Line height multiplier for body text (default: 1.58)
- `editorZoomLevel` - Default zoom level (default: 0.9, range: 0.7-1.5)

### Editor Behavior
- `developerMode` - Enable console logging for debugging
- `editorFocusTimeout` - Debounce delay for focus events (ms)
- `syncDebounceMs` - Debounce for editor→VS Code sync

### File & Image Handling
- `imageAutoRename` - Auto-rename images based on alt text
- `imageDefaultPath` - Default folder for inserted images (relative)
- `chromeExecutablePath` - Custom Chrome path for PDF export

### Display
- `showWordCount` - Display word count in status bar
- `showReadingTime` - Display estimated reading time

---

## Link Dialog Details

When you click **Link** button or press `Cmd/Ctrl+K`:

### **Heading Tab** (Default)
- Autocomplete list of all headings in the current document
- Type to filter/search headings
- Select a heading to create: `[link text](#heading-slug)` format
- Link text auto-populates from current selection or prompt

### **File Tab**
- Autocomplete list of markdown files in workspace
- Type to search for files
- Selected file shown with relative path
- Can link to specific heading in file: `[text](./path/file.md#heading)`
- Browse button opens file picker from filesystem

### **URL Tab**
- Enter any web address: `https://example.com`
- Full protocol required (http, https, ftp, mailto, etc.)
- Autocomplete for recently used URLs (optional)
- Creates standard external hyperlink

---

## Color & Theme Support

- **Light Mode**: Subtle gray (#f5f5f5) backgrounds for toolbar and navigation pane
- **Dark Mode**: Dark gray (#252526) backgrounds with light text
- **Color Scheme**: Uses VS Code theme variables for automatic adaptation
- **Custom Colors**: Configurable via CSS variables in editor settings

---

## Notes on Toolbar Behavior

- **Focus Requirement**: Most buttons (formatting, lists, etc.) are only enabled when the editor has focus. This prevents accidental changes.
- **Active State**: Buttons show "pressed" appearance when the current selection matches that format (e.g., Bold button highlights in bold text).
- **Disabled Buttons**: Appear faded and are not clickable.
- **Tooltips**: Hover over buttons to see name and keyboard shortcut.
- **Responsive**: Toolbar adapts to window width; buttons may wrap in narrow windows.
- **Button Order**: Save, Separator, Text Style, Formatting, Lists, Media, Table, Blocks, AI Explain, View

---

## Toolbar Order

Left to right:
1. Save
2. (Separator)
3. Text Style Dropdown
4. (Separator)
5. Bold, Italic, Underline, Highlight, Color, Strikethrough, Inline Code
6. (Separator)
7. Bullet List, Numbered List, Task List
8. (Separator)
9. Image, Link, Emoji, Table, Blocks & Alerts
10. (Separator)
11. AI Explain
12. View Dropdown

---

Last updated: 2026-03-29