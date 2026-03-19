# Research: Popular TipTap & ProseMirror Extensions

**Date:** 2026-01-14  
**Status:** Research complete

## Currently Installed Extensions

| Package | Purpose |
|---------|---------|
| `@tiptap/starter-kit` | Base: bold, italic, strike, code, heading, blockquote, bullet/ordered list, code block, horizontal rule, history |
| `@tiptap/extension-bubble-menu` | Floating selection toolbar |
| `@tiptap/extension-character-count` | Word/char counts |
| `@tiptap/extension-code-block-lowlight` | Syntax-highlighted code blocks |
| `@tiptap/extension-color` | Text color |
| `@tiptap/extension-drag-handle` | Block drag handles |
| `@tiptap/extension-highlight` | Text highlight/marker |
| `@tiptap/extension-image` | Image nodes |
| `@tiptap/extension-link` | Hyperlinks |
| `@tiptap/extension-list` | List handling (v3 unified) |
| `@tiptap/extension-placeholder` | Placeholder text |
| `@tiptap/extension-table` | Tables |
| `@tiptap/extension-table-cell` | Table cells |
| `@tiptap/extension-table-header` | Table header cells |
| `@tiptap/extension-table-row` | Table rows |
| `@tiptap/extension-table-of-contents` | Heading outline/TOC feed |
| `@tiptap/extension-text-style` | Inline text styling |
| `@tiptap/extension-typography` | Smart typography (quotes, dashes) |
| `@tiptap/extension-underline` | Underline mark |
| `@tiptap/markdown` | Markdown serialization/deserialization |

---

## Recommended Extensions to Evaluate

### High Priority (directly relevant to a markdown editor)

| Extension | Source | Why |
|-----------|--------|-----|
| **tiptap-search-and-replace** | [sereneinserenade/tiptap-search-n-replace-demo](https://github.com/sereneinserenade/tiptap-search-n-replace-demo) | In-document search is on the roadmap (`task-p1-in-document-search.md`). This provides ProseMirror decorations for find/replace. |
| **tiptap-footnotes** | [buttondown/tiptap-footnotes](https://github.com/buttondown/tiptap-footnotes) | Footnotes are a common markdown feature. Renders as superscript with footnote content at bottom. |
| **tiptap-text-direction** | [amirhhashemi/tiptap-text-direction](https://github.com/amirhhashemi/tiptap-text-direction) | RTL/LTR text support. Important for i18n. |
| **tiptap-extension-global-drag-handle** | [NiclasDev63/tiptap-extension-global-drag-handle](https://github.com/NiclasDev63/tiptap-extension-global-drag-handle) | Better drag handles for block-level content. On roadmap (`task-p1-draggable-blocks.md`). |
| **@tiptap/extension-mathematics** | Official TipTap Pro | KaTeX math rendering. On roadmap (`task-p1-katex-math.md`). |

### Medium Priority (nice-to-have enhancements)

| Extension | Source | Why |
|-----------|--------|-----|
| **tiptap-extension-code-block-shiki** | [aolyang/tiptap-extension-code-block-shiki](https://github.com/aolyang/tiptap-contentful/tree/main/packages/tiptap-extension-code-block-shiki) | Shiki-based syntax highlighting as an alternative to Lowlight. Better theme support. |
| **tiptap-slash-command** | [harshtalks/tiptap-plugins](https://github.com/harshtalks/tiptap-plugins/tree/main/packages/slash-tiptap) | Slash commands. Already on roadmap (`task-p0-slash-commands.md`), but this is a community reference. |
| **tiptap-extension-office-paste** | [Intevation/tiptap-extension-office-paste](https://github.com/Intevation/tiptap-extension-office-paste) | Better paste handling from Word/Google Docs. Cleans up HTML and preserves formatting. |
| **tiptap-extension-figure** | [@pentestpad/tiptap-extension-figure](https://www.npmjs.com/package/@pentestpad/tiptap-extension-figure) | Image/figure with caption support. Extends basic image node. |
| **tiptap-extension-pagination** | [hugs7/tiptap-extension-pagination](https://github.com/hugs7/tiptap-extension-pagination) | Page breaks / pagination for PDF export scenarios. |

### Low Priority / Reference Only

| Extension | Source | Why |
|-----------|--------|-----|
| **tiptap-comment-extension** | [sereneinserenade/tiptap-comment-extension](https://github.com/sereneinserenade/tiptap-comment-extension) | Commenting/annotations - useful reference if review features are added later. |
| **tiptap-languagetool** | [sereneinserenade/tiptap-languagetool](https://github.com/sereneinserenade/tiptap-languagetool) | Grammar/spell checking via LanguageTool API. |
| **tiptap-extension-video** | [sereneinserenade/tiptap-extension-video](https://github.com/sereneinserenade/tiptap-extension-video) | Embedded video node. |
| **tiptap-media-resize** | [sereneinserenade/tiptap-media-resize](https://github.com/sereneinserenade/tiptap-media-resize) | Media resize handles. We already have custom image resize. |

---

## ProseMirror-Level Extensions Worth Noting

| Extension | Why |
|-----------|-----|
| **prosemirror-math** | KaTeX integration at ProseMirror level (alternative to TipTap wrapper) |
| **prosemirror-tables** | Already used via `@tiptap/extension-table` |
| **prosemirror-dropcursor** | Already included in StarterKit |
| **prosemirror-gapcursor** | Already included in StarterKit |
| **prosemirror-inputrules** | Already included in StarterKit |

---

## Open Source Editor References

These full-featured open-source editors built on TipTap are good architectural references:

| Project | Description | Stars |
|---------|-------------|-------|
| [Novel](https://novel.sh/) | Notion-like editor with AI, slash commands, built on TipTap | 15k+ |
| [mui-tiptap](https://github.com/sjdemartini/mui-tiptap) | Material UI styled TipTap editor | 1k+ |
| [umo-editor](https://github.com/umodoc/editor) | Full document editor (Vue3 + TipTap), page-based | 1k+ |
| [Nextcloud Text](https://github.com/nextcloud/text) | Collaborative markdown editor (TipTap) | 500+ |
| [GitLab Content Editor](https://gitlab.com/gitlab-org/gitlab/-/tree/master/app/assets/javascripts/content_editor) | Production TipTap markdown editor | - |

---

## Recommendations

1. **Immediate wins**: Search-and-replace extension pairs with the `task-p1-in-document-search.md` roadmap item. Evaluate `tiptap-search-n-replace-demo` as a starting point.

2. **Roadmap alignment**: The global drag handle extension directly addresses `task-p1-draggable-blocks.md`. Consider using it as-is or as reference.

3. **Architecture study**: Novel and GitLab's editor are the best references for production TipTap markdown editors at scale.

4. **Don't add**: Avoid extensions that duplicate existing custom features (media resize, comments) or that are framework-specific (Vue/React wrappers).
