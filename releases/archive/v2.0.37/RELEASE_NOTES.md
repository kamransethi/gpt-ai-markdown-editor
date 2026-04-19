# Version 2.0.37

**Release Date**: April 12, 2026  
**Previous Release**: [v2.0.36](../v2.0.36/)

## 🎉 What's New

### Navigation Panel Improvements

#### Fixed TOC Pane Sticky Positioning

The navigation panel was scrolling away with the document body instead of staying docked to the right side. This was caused by `overflow-x: auto` on the editor layout creating a new CSS scroll context, which broke `position: sticky`.

**Changes**:

- Changed `.editor-layout` overflow from `auto` to `clip` (prevents horizontal scroll without creating a new sticky context)
- Re-enabled auto-scroll of the active heading within the TOC list using manual `scrollTop` calculation
- Result: TOC pane now stays docked while scrolling, with a working independent vertical scrollbar

#### Added Heading Filter

Quickly find headings in long documents with a searchable filter field that replaces the "Contents" title.

**Features**:

- Real-time case-insensitive substring filtering as you type
- Clear button (×) appears when filter has text
- Keyboard shortcuts:
  - **Escape** — clears filter and returns focus to editor
  - **ArrowDown** — focuses first matching result
  - **Enter** — navigates to focused heading
- 8 new tests covering filtering, keyboard navigation, and edge cases

**Files Modified**:

- `src/webview/features/tocPane.ts` — filter input, filtering logic, keyboard handlers
- `src/webview/editor.css` — filter input and clear button styles

---

### Editor Meta Bar Enhancements

#### Document Statistics &amp; Modification Time

The editor meta bar now shows meaningful metadata instead of character count:

- **Updated timestamp** — Last modified time from the file on disk
- **Word count** — Total words in document
- **Reading time** — Estimated reading time (words ÷ 200, minimum 1 min)

**Format**: `Updated: April 12, 2026 @ 2:15 PM • 612 words • 3 min read`

**Technical Details**:

- Extension reads file's modification time via `fs.statSync()` and sends to webview
- Webview displays actual disk file mtime (not open time)
- Falls back to current time for untitled files
- Stats displayed in a dedicated `.editor-meta-stats` span that preserves other buttons (e.g., "VIEW FRONTMATTER")

**Files Modified**:

- `src/editor/handlers/documentSync.ts` — reads file mtime, sends fileModifiedTime in UPDATE message
- `src/webview/editor.ts` — receives mtime, uses as base for Updated timestamp, calculates reading time
- `src/webview/editor.css` — layout for stats span with proper flex alignment

---

## 📊 Statistics

**Commits**: 8  
**Files Changed**: 7+ modified/created  
**Test Status**: ✅ All 828 tests passing  
**Linting**: ✅ All checks pass  
**Build**: ✅ Debug and release builds successful

---

## 🔧 Technical Improvements

- **TOC Sticky Context**: Fixed CSS scroll context issue that affected position:sticky behavior
- **Meta Bar Architecture**: Separated stats text from buttons to avoid clearing dynamic elements
- **File Metadata**: Integration with OS file system for accurate modification time
- **Reading Time Algorithm**: Based on 200 words-per-minute average comprehension rate

---

## ✅ Testing &amp; Validation

- ✅ All 828 existing tests continue to pass
- ✅ 8 new tests for TOC filter functionality
- ✅ Manual testing: TOC pane scrolling, filter interactions, meta bar display
- ✅ Keyboard navigation fully tested (Escape, ArrowDown, Enter)
- ✅ Edge cases: whitespace-only filters, special characters in headings, untitled files
- ✅ Pre-commit linting checks pass

---

## 🔗 Compatibility

- **VS Code**: 1.115.0+
- **Node.js**: 18+
- **Pandoc**: 5.0+ (for DOCX export)
- **Platforms**: macOS, Windows, Linux

---

## 📝 Known Issues

Refer to [KNOWN_ISSUES.md](../../KNOWN_ISSUES.md) for:

- 🔴 Open: AI Refine code block corruption
- ⚠️ Partial: AI Refine preserves only blockquote formatting
- 🔒 Platform Limitations: Copilot Chat file exposure, selected text context

---

## 📥 Installation

### VS Code Marketplace

[Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=kamransethi.gpt-ai-markdown-editor)

### Manual Installation

Download `gpt-ai-markdown-editor-2.0.37.vsix` and install via VS Code extension menu.

---

## 🐛 Bug Reports &amp; Feedback

- **GitHub Issues**: [Report a bug](https://github.com/kamransethi/gpt-ai-markdown-editor/issues)
- **Feature Requests**: [Request a feature](https://github.com/kamransethi/gpt-ai-markdown-editor/issues)

---

## 📄 File Information

- **VSIX Package**: `gpt-ai-markdown-editor-2.0.37.vsix`
- **Size**: Optimized release build
- **Release**: Stable

---

**Happy Writing! 🎨✍️**