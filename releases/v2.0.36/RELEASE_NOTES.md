# Version 2.0.36

**Release Date**: April 12, 2026  
**Latest Release**: [v2.0.35](../v2.0.35/)

## 🎉 What's New

### Bug Fixes

#### Pandoc Export: Bullet List Newline Handling

Fixed a critical issue where bullet lists exported to DOCX would collapse onto a single line instead of preserving line breaks between items.

**Impact**: 

- ✅ Standalone bullet lists now export with each item on a separate line
- ✅ Bullet lists in table cells (separated by `<br>` tags) render correctly
- ✅ Both ordered and unordered lists supported
- ✅ Backward compatible with existing features (tables, colors, alerts, mermaid diagrams)

**Changes**:

- Adjusted markdown normalization regex in `documentExport.ts` to preserve 2-newline runs before list items (only collapse 3+ newlines)
- Enhanced `table_formatting.lua` Pandoc filter to detect `<br>` + bullet patterns and convert to proper markdown list structures
- Test coverage for all list type combinations

**Files Modified**:

- `src/features/documentExport.ts`
- `src/features/pandoc/lua/table_formatting.lua`

**Tests Enhanced**:

- Added test coverage for regex behavior and list item boundary preservation

---

### Documentation

#### Feature Highlights Enhanced

Added comprehensive documentation highlighting key features:

- AI vision capabilities (Image Ask with vision models)
- LLM provider selection (GitHub Copilot or Ollama)
- Frontmatter management and editing
- All current capabilities clearly documented

---

## 📊 Statistics

**Commits**: 3  
**Files Changed**: 5+ modified/created  
**Test Status**: ✅ All 828 tests passing  
**Linting**: ✅ All checks pass  
**Build**: ✅ Debug and release builds successful

---

## 🔧 Technical Details

### Pandoc Filter Enhancement

The `table_formatting.lua` filter now includes:

- `Para()` function to process paragraph nodes
- `should_convert_to_bullet_list()` detection logic
- `convert_para_to_bullet_list()` conversion function
- Precise regex pattern matching for bullet markers

### Regex Optimization

Changed list item normalization from collapsing 2+ newlines to 3+, ensuring Pandoc parser recognizes list item boundaries correctly.

---

## ✅ Testing &amp; Validation

- ✅ All 828 existing tests continue to pass
- ✅ New test coverage for bullet list scenarios
- ✅ Verified with STRESS_TEST_DOC.md (contains bullet lists in tables)
- ✅ Pre-commit linting checks pass
- ✅ Full build pipeline tested

---

## 🔗 Compatibility

- **VS Code**: 1.115.0+
- **Node.js**: 18+
- **Pandoc**: 5.0+ (for DOCX export)
- **Platforms**: macOS, Windows, Linux

---

## 📝 Known Issues

### 🔴 Open Issues

#### BUG-FR1-PARTIAL: AI Refine Corrupts Code Blocks
- **Priority**: High
- **Status**: Needs investigation
- **Problem**: AI Refine works correctly for blockquotes/alerts, but still corrupts content inside code blocks, strikethrough regions, and other complex nesting scenarios
- **Workaround**: Don't use AI Refine on text inside code blocks; use standard find/replace instead
- **Tracking**: [specs/005-copilot-integration-and-ai-refine](https://github.com/kamransethi/gpt-ai-markdown-editor/tree/main/specs/005-copilot-integration-and-ai-refine)

### ⚠️ Partial Issues

#### FR-1: AI Refine Preserves Block Quote Formatting
- **Priority**: Medium
- **Status**: Works for blockquotes/alerts, broken for code blocks
- **What Works**: Blockquotes (`>`), GitHub alerts (`> [!NOTE]`), callouts work correctly
- **What Doesn't**: Code blocks and mixed nesting scenarios

### 🔒 Platform Limitations (Cannot Fix)

#### BUG-I: File Not Exposed to GitHub Copilot Chat
- **Priority**: Medium
- **Reason**: VS Code Custom Editor API does not integrate with Copilot's @-mention discovery system
- **Workaround**: Use `#file:` manual references or `@fluxflow` chat participant

#### FR-4: Selected Text Context in Copilot
- **Priority**: Low
- **Reason**: Blocked by BUG-I — selection tracking is implemented but Copilot cannot receive selection metadata
- **Workaround**: Manually copy/paste selected text into Copilot chat

**For detailed tracking**: See [KNOWN_ISSUES.md](../../KNOWN_ISSUES.md) in repository root.

---

## 📥 Installation

### VS Code Marketplace

[Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=kamransethi.gpt-ai-markdown-editor)

### Manual Installation

Download `gpt-ai-markdown-editor-2.0.36.vsix` and install via VS Code extension menu.

---

## 🐛 Bug Reports &amp; Feedback

- **GitHub Issues**: [Report a bug](https://github.com/kamransethi/gpt-ai-markdown-editor/issues)
- **Feature Requests**: [Request a feature](https://github.com/kamransethi/gpt-ai-markdown-editor/issues)

---

## 📄 File Information

- **VSIX Package**: `gpt-ai-markdown-editor-2.0.36.vsix`
- **Size**: Optimized release build
- **Release**: Stable

---

**Happy Writing! 🎨✍️**