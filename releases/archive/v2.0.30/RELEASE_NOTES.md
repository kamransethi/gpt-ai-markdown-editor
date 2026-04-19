# Release Notes: v2.0.30

**Release Date**: April 11, 2026

This release introduces refined frontmatter editing workflows and fixes critical editor behavior issues for a smoother writing experience.

---

## 🎯 New Features

### VIEW FRONTMATTER Button

Quick, one-click access to document metadata:

- **Compact Button**: Tiny "VIEW FRONTMATTER" text in the upper right corner, only visible when your document has YAML frontmatter
- **Single Click**: No menu navigation needed—click the button to open the frontmatter editor modal
- **Tight Integration**: Minimal visual weight with theme-aware colors that adapt to light and dark modes
- **Dynamic**: Button automatically appears when frontmatter is added and disappears when removed

Perfect for writers working with complex frontmatter like MARP presentations or blog metadata.

---

## 🐛 Fixes & Improvements

### Table of Contents Scroll Stability

Fixed an issue where the Table of Contents pane was causing the editor scroll position to jump unexpectedly when scrolling with H1-H3 headings visible.

- **Root Cause**: The TOC refresh logic was triggering unnecessary layout recalculations that cascaded to the main editor
- **Impact**: Smooth, predictable scrolling with all heading levels (H1-H6)
- **User Experience**: Writing flow is no longer interrupted by jump-to-top behavior

### Workflow & Process Improvements

- **Speckit Integration**: Added comprehensive AI-assisted workflow automation for spec→plan→code→test cycle
- **Release Process**: Established versioned release structure for better release management and GitHub publishing

---

## 📊 Release Statistics

- **Test Coverage**: 965 tests passing (zero regressions)
- **Changes**: Core editor functionality, frontmatter UI, scroll behavior
- **Breaking Changes**: None
- **Dependencies**: No new external dependencies added

---

## 🔧 Technical Details

### Files Modified

| Component | Changes |
|-----------|---------|
| Frontmatter Panel | Added VIEW FRONTMATTER button with lifecycle management |
| Editor CSS | Optimized spacing for compact layout |
| TOC Rendering | Removed scroll-triggering layout recalculation |
| Workflow Automation | Enhanced speckit integration |

### Compatibility

- **VS Code**: 1.90.0 and later
- **Platforms**: Windows, macOS, Linux
- **Breaking Changes**: None

---

## 📝 Known Issues

None identified in this release.

---

## 🚀 What's Next

Upcoming improvements in future releases:

- Enhanced keyboard shortcuts for metadata editing
- Improved frontmatter validation with inline error messages
- Release automation to GitHub Releases
- Additional export format options

---

## 💬 Feedback & Support

- **Report Bugs**: [GitHub Issues](https://github.com/kamransethi/gpt-ai-markdown-editor/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/kamransethi/gpt-ai-markdown-editor/discussions)
- **Documentation**: [README](https://github.com/kamransethi/gpt-ai-markdown-editor#readme)

---

## 📦 Installation

Install or upgrade from the VS Code Marketplace:

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Flux Flow Markdown Editor"
4. Click Install or Update

---

**Thank you for using Flux Flow Markdown Editor!** 🙏

For detailed changelog history, see [CHANGELOG.md](../../CHANGELOG.md)
