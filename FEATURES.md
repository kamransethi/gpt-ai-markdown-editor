# Visual Markdown Editor — Feature Guide

A premium WYSIWYG markdown editing experience inside VS Code. Write naturally, focus on content — not syntax.

---

## Editor Core

- **WYSIWYG editing** — Live rendered markdown as you type, no split panes needed
- **Distraction-free writing** — Serif typography (Charter/Georgia), generous spacing
- **Auto-formatting** — Type `# ` for headings, `- ` for lists, `> ` for blockquotes, `` ``` `` for code blocks, `[]` for task lists
- **Undo / Redo** — Full history (100 levels) with Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z

## Text Formatting

| Action | Shortcut |
|--------|----------|
| **Bold** | Cmd/Ctrl+B |
| *Italic* | Cmd/Ctrl+I |
| Underline | Cmd/Ctrl+U |
| ~~Strikethrough~~ | Toolbar |
| `Inline code` | Toolbar |
| ==Highlight== | Toolbar |
| Text color | Toolbar (8 preset colors) |
| Clear formatting | Toolbar |

### Floating Selection Toolbar

Select any text to see a context-aware formatting bar with bold, italic, highlight, text color, strikethrough, inline code, heading controls, and link insertion.

### Header Formatting Toolbar

A persistent toolbar at the top of the editor with the same formatting options, plus insert buttons for tables, images, code blocks, and Mermaid diagrams.

## Headings

- H1–H6 with full visual styling
- Heading dropdown in toolbar (Paragraph, H1–H6)
- Auto-created via markdown syntax (`# `, `## `, etc.)

## Lists

- Bullet lists, ordered lists, and task/checkbox lists
- Nested indentation with Tab / Shift+Tab
- Checkbox toggling in task lists

## Tables

- **Visual editing** — Click into cells to edit, Tab/Shift+Tab to navigate
- **Drag-to-resize columns** — Grab column borders and drag
- **Right-click context menu** — Add/delete rows and columns, move rows/columns
- **Table insertion** — Toolbar button creates a default 3×2 table
- **CSV export** — Export any table to CSV format
- **Proper markdown serialization** — Clean output, no manual syntax needed

## Images

- **Drag & drop** from desktop or VS Code Explorer directly into the editor
- **In-place resizing** — Drag corner handles to adjust width with live preview
- **Image renaming** — Change filename without leaving the editor (updates disk + markdown)
- **Auto-size warnings** — Prompted when images are oversized (helpful for Git repos)
- **Image metadata overlay** — View dimensions, file size, and path
- **Original backup** — Always backed up before resizing

### Image Storage Modes

Configure where images are saved via `gptAiMarkdownEditor.mediaPathBase`:

| Mode | Description |
|------|-------------|
| `sameNameFolder` | Folder matching the markdown filename (recommended) |
| `relativeToDocument` | Subfolder relative to the markdown file |
| `workspaceFolder` | Subfolder relative to the workspace root |

## Links

- **Insert/edit link** — Cmd/Ctrl+K opens the link dialog
- **Click to edit** — Click any link to open the edit dialog
- **Ctrl/Cmd+click to navigate** — Opens external URLs, scrolls to heading anchors, opens workspace files
- **Three modes** — URL, File search (with autocomplete), Heading search (same-document anchors)
- **Auto-populated link text** — Selecting a file or heading auto-fills the display text
- **File browser** — Browse button opens VS Code file picker

## Table of Contents

- **Always-visible sidebar** — Outline pane on the right side of the editor
- **Heading navigation** — Click any heading to jump to it
- **Active heading indicator** — Highlights current section while you scroll
- **Configurable depth** — `gptAiMarkdownEditor.tocMaxDepth` controls max heading level shown (default: 3, range: 1–6)
- **Filter headings** — Cmd/Ctrl+Shift+P → "Filter Headings" to search by text

## In-Document Search

- **Cmd/Ctrl+F** — Opens search overlay
- **Match counter** — Shows current match position and total count
- **Navigation** — Arrow buttons to move between matches
- **Highlights** — All matches highlighted, active match emphasized
- **Esc to close**

## Highlight Syntax

Choose how highlighted text is saved to markdown via `gptAiMarkdownEditor.highlightSyntax`:

| Style | Syntax | Best for |
|-------|--------|----------|
| Obsidian (default) | `==text==` | Obsidian vault compatibility |
| GitHub | `<mark>text</mark>` | GitHub rendering compatibility |

Both formats are loaded regardless of the setting — only the save format changes.

## Code Blocks

- Syntax highlighting for 11+ languages (JavaScript, TypeScript, Python, Bash, JSON, CSS, HTML, SQL, Java, Go, Rust, and more)
- Triple-backtick auto-formatting
- Language selector

## GitHub Alerts

Renders GitHub-flavored markdown alerts with colored styling:

- **Note** (blue) — `> [!NOTE]`
- **Tip** (green) — `> [!TIP]`
- **Important** (purple) — `> [!IMPORTANT]`
- **Warning** (yellow) — `> [!WARNING]`
- **Caution** (red) — `> [!CAUTION]`

## Mermaid Diagrams

- Live rendering of Mermaid diagram code blocks
- Double-click to edit diagram source
- 15 built-in templates: Flowchart, Sequence, Gantt, Pie, Class, State, ER, Journey, Git, Mindmap, Timeline, Sankey, XY Chart, Block, Quadrant
- Syntax error detection

## Math (KaTeX)

- Inline math: `$...$`
- Display math: `$$...$$`
- Full KaTeX rendering

## Copy & Paste

### Copy

- **Copy as Markdown** — Toolbar / context menu copies selection as clean markdown
- **Standard Copy** — Cmd/Ctrl+C copies HTML (TipTap default)

### Paste

- **HTML → Markdown** — Smart paste converts HTML clipboard to markdown equivalent
- **Image Paste** — Images from clipboard inserted and saved to media folder
- **Table Paste** — CSV and HTML table data pasted as visual tables
- **Markdown Paste** — Recognized markdown text rendered immediately
- **File Link Paste** — Drag files from Explorer to insert links

## Export

| Format | Method |
|--------|--------|
| **PDF** | Via Chrome/Chromium (`gptAiMarkdownEditor.chromePath`) |
| **HTML** | Full standalone HTML document |
| **DOCX** | Microsoft Word format |
| **CSV** | Table-only export |

## AI Features

### AI Refine (Copilot Integration)

Right-click context menu with preset modes:

| Mode | Effect |
|------|--------|
| **Fix Spelling** | Corrects typos and grammar |
| **Improve Writing** | Enhances clarity and flow |
| **Make Shorter** | Condenses text |
| **Make Longer** | Expands text with more detail |
| **Make Professional** | Adjusts tone to business/formal |
| **Simplify Language** | Reduces complexity |
| **Custom Instruction** | User-provided prompt |

Requires GitHub Copilot extension. Uses VS Code Language Model API.

### Chat Participant

- Invoked with `@markdown-editor` in Copilot Chat
- Provides full document context to Copilot
- Includes currently selected text when available
- Ask questions about your document, get writing suggestions

### Selection Visibility for Copilot

- The editor exposes selected text to the extension host on every selection change
- Context key `gptAiMarkdownEditor.hasSelection` is set when text is selected
- Command `gptAiMarkdownEditor.getSelectedText` returns the current selection for any extension to query

## Source View Toggle

Command `gptAiMarkdownEditor.toggleSource` opens the raw markdown source in a VS Code split pane alongside the WYSIWYG view.

## Customization

### Spacing

| Setting | Description | Default | Range |
|---------|-------------|---------|-------|
| `lineSpacing` | Line height multiplier | 1 | 1–3 |
| `paragraphSpacing` | Paragraph gap (em) | 1 | 0–3 |
| `tableCellSpacing` | Table cell vertical padding (em) | 0.1 | 0–2 |
| `tableCellHorizontalSpacing` | Table cell horizontal padding (em) | 0.2 | 0–3 |

### Theme

`gptAiMarkdownEditor.themeOverride` — Override with `system`, `light`, or `dark`. Inherits VS Code theme colors by default.

### Developer Mode

`gptAiMarkdownEditor.developerMode` — When enabled (default: true), shows detailed error notifications for runtime failures.

### HTML Comment Preservation

`gptAiMarkdownEditor.preserveHtmlComments` — When enabled, `<!-- HTML comments -->` are preserved during round-trip editing instead of being stripped.

## VS Code Integration

### Commands

| Command | Description |
|---------|-------------|
| Open File | Open any `.md`/`.markdown` file with this editor |
| Show Detailed Stats | Word count, character count, reading time |
| Toggle TOC | Show/hide the Table of Contents sidebar |
| Navigate to Heading | Jump to a heading by position |
| Filter Outline | Search headings by text |
| Toggle Source View | Open raw markdown alongside WYSIWYG |
| Open Attachments Folder | Open the media/attachments folder in the file explorer |
| Get Selected Text | Returns currently selected text (for extension interop) |

### Context Menus

- Right-click `.md` files → "Open with Visual Markdown Editor"
- Right-click in tables → Row/column operations
- Right-click images → Resize, rename, open in Finder/Explorer

### Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Bold | Ctrl+B | Cmd+B |
| Italic | Ctrl+I | Cmd+I |
| Underline | Ctrl+U | Cmd+U |
| Save | Ctrl+S | Cmd+S |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Shift+Z | Cmd+Shift+Z |
| Insert/Edit Link | Ctrl+K | Cmd+K |
| Find | Ctrl+F | Cmd+F |
| Settings | Ctrl+Shift+X | Cmd+Shift+X |
| Indent | Tab | Tab |
| Outdent | Shift+Tab | Shift+Tab |

### File Support

- `.md` and `.markdown` files
- Untitled documents (with workspace fallback)
- Full Git diff compatibility (text-based storage)

## Advanced Features

- **HTML Preservation** — Unknown/arbitrary HTML tags preserved during round-trip
- **HTML Comment Preservation** — `<!-- comments -->` preserved when enabled
- **Smart Typography** — Automatic curly quotes, em-dashes, ellipses
- **Frontmatter** — YAML frontmatter recognized and preserved
- **Indented Image Support** — 4-space or tab-indented images parsed correctly
- **Space-Friendly Paths** — Image paths with spaces handled via angle-bracket encoding

## Performance

- <500ms editor initialization
- <16ms typing latency
- <50ms interactions (cursor, formatting)
- <300ms menu/toolbar actions
- Handles 10,000+ line documents smoothly
