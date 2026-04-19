# Changelog

All notable changes to DK-AI Markdown Editor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

**Note:** This is the ONLY changelog file. Use this content for GitHub releases (copy and polish as needed with emojis and user-friendly sections).

## [3.0.0] - 2026-04-19

### Added

- Knowledge Graph beta: workspace-wide markdown indexing, backlinks, hybrid search, and AI-powered graph chat.
- Backlinks explorer view for markdown files, with live updates as documents change.
- Configurable graph data directory via `knowledgeGraph.dataDir`, defaulting to `~/.fluxflow` and supporting custom storage folders.
- Support for semantic search and retrieval-augmented generation when a local AI embedding server is available.
- Graph Chat panel for asking questions over your indexed markdown workspace.

### Changed

- Bumped the extension major version to 3.0.0 for a new wave of graph and editor platform features.
- Upgraded TipTap dependencies to the 3.22.x line for improved Markdown round-tripping and table serialization.
- Improved local configuration support with a dedicated config/data folder for graph database and vector storage.

### Fixed

- Stabilized table hard-break serialization across the TipTap Markdown pipeline.

---

## [Unreleased]

---

## [2.0.1] - 2026-03-20

### Changed

- Bumped release version to 2.0.1 and rebuilt the marketplace package

## [2.0.0] - 2026-03-20

### Launch Release

This is the major launch baseline for the current generation of Flux Flow Markdown Editor.

### Added

- Flux Flow: A feature-rich visual Markdown workflow inside VS Code with strong emphasis on direct manipulation instead of syntax-first editing
- Advanced table editing with resizing, context actions, and toolbar controls
- Inline image management with drag and drop, resize, rename, and metadata workflows
- Mermaid diagram support with rendering, templates, and source editing workflow
- Rich formatting controls including highlighting, text color, headings, code, and contextual toolbar actions
- Export workflows for PDF and DOCX
- Outline, navigation, and writing aids for longer documents

### Changed

- Repositioned the extension on a new major version line to reflect the expanded feature set and launch readiness
- Rewrote the README to make the feature set easier to scan for users evaluating the extension

### Fixed

- Documentation and repository support links now point to the current project repository and help channels

## [0.1.3] - 2026-01-16

### 🎯 What's New

#### Critical Bug Fix

**Fixed Auto-Linking Bug** — Previously, typing text ending with file extensions (like `.md`, `.txt`, `.pdf`) would automatically convert them into links. This has been fixed! File extensions now remain as plain text, giving you complete control over when text becomes a link.

#### Enhanced Link Creation Experience

**Completely Redesigned Link Dialog** — Creating links is now faster and more intuitive:

- **Three Link Modes**: Switch between URL, File, and Headings with radio buttons positioned right after the Link Text input
- **Smart File Search**: Type to search workspace files with fuzzy matching and category filters (Markdown, Images, Code, Config)
- **In-Document Headings**: Instantly link to any heading (H1-H6) within your current document
- **Cleaner Display**: Shows only the filename or heading name in the input field, while storing the full path correctly
- **Better Navigation**: Fixed image and file link clicking - images now open in VS Code's preview, files open correctly in both development and packaged builds

#### Documentation & Discovery

- **Enhanced README** — Added comparison table showing how DK-AI Markdown Editor differs from other markdown editors
- **Improved Marketplace Listing** — Better keywords and descriptions to help users discover the extension more easily

### 🛠️ Technical Improvements

This release includes several under-the-hood improvements that make the extension more stable and reliable:

- Enhanced test coverage for better reliability
- Improved CI/CD pipeline for faster packaging
- Code quality improvements
- Enabled pre-commit hook (previously disabled) - automatically fixes linting issues before commits
- Fixed GitHub Actions CI/CD pipeline - now properly creates VSIX packages on push to main branch
- Improved test reliability and CI stability with enhanced Jest configuration

### Fixed (Technical Details)

- Fixed auto-linking bug where file extensions (.md, .txt, .pdf, etc.) and filenames ending with document extensions were incorrectly converted to links when typing
- Fixed lint regex and formatting issues in test files (image path resolution, image rename checks, image resize, and in-memory files tests)
- Fixed Jest configuration to resolve failing tests in CI pipeline
- Fixed pre-commit hook script for Windows system compatibility
- **Image Link Navigation**: Fixed image files not opening when clicked - now properly opens in VS Code's image preview
- **File Link Navigation**: Enhanced path resolution for both development and packaged builds
- **Path Resolution**: Improved relative path handling with fallback to workspace root when document-relative path fails
- **Link Click Handling**: Fixed preventDefault() and stopPropagation() to prevent browser from interfering with link navigation

### Added

- Added shouldAutoLink validation utility to prevent unwanted auto-linking of file extensions and bare filenames
- Added comprehensive test suite for link autolink prevention (src/**tests**/webview/linkAutolink.test.ts)
- Added pre-commit hook that automatically runs npm run lint:fix before each commit
- Added enhanced test setup files (setup-after-env.ts) for improved test reliability
- Added GitHub Actions workflow for automated package creation on push to main branch
- **Enhanced Link Dialog** - Completely redesigned link creation experience with three modes:
  - **URL Mode**: Create external links to websites
  - **File Mode**: Link to local files with intelligent fuzzy search and autocomplete
  - **Headings Mode**: Link to headings within the current document (H1-H6)
- **File Search with Filters**: Search workspace files with category filters (Markdown, Images, Code, Config)
- **Smart Path Display**: Shows only filename or heading text in the input field while storing the full path internally
- **Dynamic Label**: Link input label changes based on selected mode (URL/File/Heading)
- **Visual Differentiation**: Subtle colored borders in autocomplete results to distinguish files from headings

### Changed

- Enhanced marketplace discoverability: Updated displayName to "DK-AI Markdown Editor: WYSIWYG Editor" to improve brand clarity while maintaining search ranking for "markdown editor" and "wysiwyg markdown" queries
- Expanded keywords from 6 to 30 terms for better marketplace visibility (includes: notion-like, writing, documentation, formatting, syntax-highlighting, live-preview, full-screen, distraction-free, cover-images, image-resizing, export, html, pdf, docx, human-friendly, and more)
- Updated package.json description to SEO-optimized version highlighting key features
- Restructured README with comparison table ("What Makes It Different") and improved SEO positioning
- Improved Jest test configuration with better coverage thresholds and setup files
- Updated test files to use more robust patterns and improved error handling
- **Link Dialog UX**: Radio buttons moved to appear right after Link Text input for better workflow
- **Button Alignment**: Cancel and OK buttons aligned to the right side of the dialog
- **Autocomplete UI**: Removed emojis, replaced with clean borders for a more professional appearance
- **Dropdown Sizing**: Autocomplete dropdown now dynamically adjusts height to prevent overflow in different modes

### Developer Experience

- Enabled pre-commit hook (previously disabled) - automatically fixes linting issues before commits
- Fixed GitHub Actions CI/CD pipeline - now properly creates VSIX packages on push to main branch
- Improved test reliability and CI stability with enhanced Jest configuration

---

## [0.1.0] - Initial Release

### Added

- WYSIWYG markdown editing with TipTap
- Headers (H1-H6)
- Inline formatting (bold, italic, strikethrough, code)
- Lists (ordered, unordered, task lists)
- Links and images
- Blockquotes
- Code blocks with syntax highlighting (11 languages)
- Tables with resize, context menu, and toolbar dropdown
- Mermaid diagrams with toggle view
- Compact formatting toolbar
- Theme support (light, dark, system)
- VS Code custom editor integration
- Two-way document synchronization
- Cursor position preservation
- Git integration (text-based diffs)
- Document outline sidebar with navigation, filtering, and auto-reveal
- Word count status bar with detailed statistics
- Image resize handles with modal editor and undo/redo
- PDF and Word document export functionality
- Mermaid diagram templates (15 diagram types)
- Mermaid double-click editing in modal
- Tab indentation support for lists and code blocks
- Image enter spacing and cursor styling improvements
- GitHub alerts callout support
- In-memory file support (untitled files)
- Image drag-drop reliability improvements
- Image path robustness (URL-encoded path handling)
- Source view button (opens VS Code native editor)
- Copy/paste support with HTML→Markdown conversion
- Toolbar icon refresh with Codicon-based icons

### Changed

- Enhanced undo reliability and dirty state handling
- Improved frontmatter rendering (no false dirty indicators)
- Better image handling with workspace path resolution

### Fixed

- Fixed image drag-drop bugs preventing VS Code from opening files
- Fixed frontmatter dirty state on document open
- Fixed undo stack synchronization with VS Code
- Fixed image path resolution for URL-encoded paths

---