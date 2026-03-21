# Markdown for Humans - Development Guide

**Development roadmap, design principles, and philosophy**

> This document is for developers contributing to or maintaining the project. For practical setup and workflow, see [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Table of Contents

1. [Development Philosophy](#development-philosophy)
2. [Design Principles](#design-principles)
3. [Development Roadmap](#development-roadmap)
4. [Feature Priority Matrix](#feature-priority-matrix)
5. [AI Coding Assistant Integration](#ai-coding-assistant-integration)
6. [Release Process](#release-process)
7. [Related Documentation](#related-documentation)

> **Note:** For practical development setup, workflow, coding standards, and testing guidelines, see [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Development Philosophy

### Core Tenets

**1. Ship Early, Iterate Fast**
- Get MVP in users' hands quickly
- Real user feedback > speculation
- Small, frequent releases beat big launches

**2. Performance First**
- Optimize from day one, not "later"
- Profile before optimizing (data-driven decisions)
- User perception matters more than benchmarks

**3. Progressive Enhancement**
- Core features work everywhere
- Advanced features enhance experience
- Graceful degradation (no hard failures)

**4. Community-Driven**
- Prioritize based on user feedback
- Encourage contributions (code, docs, design)
- Be responsive to issues and PRs

**5. Reading Experience > Feature Completeness**
- Better to have 80% of features with 120% reading quality
- Typography isn't decoration—it's the core value proposition
- Test every change by reading a 3000+ word doc

---

## Design Principles

### 1. Reading Experience is PARAMOUNT

**Philosophy:**
> Writing markdown should feel like writing in a premium publishing tool, not a code editor.

#### Typography Excellence

**Body Text:**
- **Fonts**: Inherit from VS Code editor font settings (respects user preferences and OS defaults)
- **Size**: 20% larger than base editor font (calc(var(--md-base-size) * 1.2)) for comfortable reading
- **Line height**: 1.58-1.6 for breathing room
- **Max width**: 680-740px (optimal reading length, ~80 characters)
- **Letter spacing**: Negative tracking for larger text (-0.003em to -0.022em)

**Why This Matters:**
- Users spend HOURS reading documentation
- Markdown files are documentation, not code
- Eye strain is real—optimize for long reading sessions
- Medium.com's typography isn't trendy, it's scientifically optimal

**Non-Negotiables:**
- Never sacrifice reading comfort for "fitting more on screen"
- Inherit VS Code fonts (respects user preferences, OS defaults, accessibility)
- Generous spacing (white space is a feature, not waste)
- Large, legible text (20% larger than base font, users who want small text can read source)
- Readability optimizations (line-height, letter-spacing, font-smoothing, text-rendering)

#### Headers

**Visual Hierarchy:**
- **H1-H6**: Inherit from body font, bold, size multipliers create hierarchy (2.4x, 2x, 1.6x, etc.)
- **Spacing**: More space above than below (visual grouping)
- **Line height**: Tighter for headers (1.25 for h1-h3, 1.2 for h4-h6)

**Purpose:**
- Headers create scannable structure
- Users should be able to skim and find sections quickly
- Headers are signposts, not decorations

#### Emphasis

**Formatting:**
- **Bold** should feel strong (increased weight)
- **Italic** should feel elegant (true italics, not slanted)
- **Code** should clearly stand out from prose

### 2. Tables: Clean & Professional

**Balance:**
- Tables need to be **functional** (good for data)
- But **not dominate** the reading experience
- Professional table styling with clear visual hierarchy

**Requirements:**
- Clear borders (not overly thick)
- Adequate padding (12-16px)
- Hover feedback (subtle highlight)
- Header distinction (subtle background, bold text)

### 3. Code Blocks

**Style:**
- Subtle background (not harsh gray blocks)
- Good contrast but not jarring
- Professional monospace fonts (SF Mono, Cascadia Code, Consolas)
- Syntax highlighting (GitHub-style colors)

### 4. Theme Adaptability

#### System Theme Inheritance (The "Chameleon")
**Philosophy:** Respect the user's VS Code environment

**Implementation:**
- Inherit `var(--vscode-editor-background)` and `--vscode-editor-foreground`
- Seamless integration with ANY VS Code theme (Dracula, Monokai, Solarized, etc.)
- User's chosen theme extends to markdown editing

#### Reading Modes (The "Override")
**Philosophy:** Sometimes users want specific reading conditions

**Modes:**
1. **System Mode** - Inherits VS Code theme (default)
2. **Light Mode** - Classic paper-like experience (off-white background)
3. **Dark Mode** - True dark for night reading
4. **Sepia Mode** - Warm, low-contrast for reduced eye strain

### 5. Inspiration Sources

**Best-in-Class Examples:**

| Source | What We Learn |
|--------|---------------|
| **Medium.com** | Body typography, spacing, reading flow |
| **Modern WYSIWYG editors** | Table styling, element indicators, clean UI |
| **Notion** | Contextual formatting toolbar, hover states |
| **iA Writer** | Focus mode, typography obsession |

**Design Lessons:**
- **Medium**: Prioritize readability over information density
- **Modern editors**: Clean, unobtrusive UI elements
- **Notion**: Discoverability without clutter
- **iA Writer**: Typography IS the interface

### 6. Decision Framework

**When making design decisions, ask:**

1. **Does this improve the reading experience?** ← MOST IMPORTANT
2. Does this reduce cognitive load?
3. Does this feel premium/polished?
4. Would I want to read a 10-page doc in this?
5. Does this respect the content?

**Red Flags (Avoid):**
- "Let's make the font smaller to fit more"
- "Users can just zoom in if they want"
- "Code editors use 14px, so should we"
- "White space is wasted space"
- "Tables are more important than paragraphs"

**Green Lights (Good):**
- "This feels like reading a well-designed book"
- "I could read this for hours without strain"
- "This makes the content feel important"
- "The UI disappears, content shines"

### 7. Success Metrics for Design

**How we know we're winning:**
- Users read docs without reaching for the zoom
- "This looks like a published article" reactions
- Low eye strain (can read for 30+ min comfortably)
- Users WANT to write in our editor (not just for WYSIWYG convenience)

### 8. Technical Implementation of Design

**CSS Hierarchy (Priority Order):**

1. **Base typography** (body, paragraphs) - 70% of reading time
2. **Headers** - Visual structure
3. **Tables, lists, quotes** - Supporting elements
4. **Code** - Technical content
5. **UI elements** (toolbar, indicators) - Should be subtle

**Never:**
- Sacrifice body text size for "consistency"
- Use code editor fonts for prose
- Optimize for "information density" over readability
- Ship with 14px body text

### 9. Test with Real Content

**Always test changes with:**
- A 3000+ word document
- Tables with real data (not lorem ipsum)
- Mix of code and prose
- Reading for 10+ minutes (experience eye strain if present)

---

## Development Roadmap

### Current Status: Phase 1 (MVP) ✅

**Completion:** ~85% (core features done, polish remaining)

### Phase 1: MVP (Weeks 1-6) ✅

**Goal:** Launch usable WYSIWYG editor with core features

#### Core Editor ✅
- [x] VS Code extension scaffolding
- [x] Custom Text Editor provider setup
- [x] TipTap editor integration
- [x] WebView setup
- [x] Document sync (TextDocument ↔ TipTap)

#### Basic Formatting ✅
- [x] Headers (H1-H6)
- [x] Bold, italic, strikethrough
- [x] Inline code
- [x] Code blocks with syntax highlighting
- [x] Blockquotes
- [x] Horizontal rules

#### Lists ✅
- [x] Unordered lists (bullets)
- [x] Ordered lists (numbered)
- [x] Nested lists
- [x] Task lists (checkboxes)

#### Links & Images ✅
- [x] Clickable links
- [x] Image display (local paths)
- [x] Image drag-and-drop (desktop + VS Code explorer)
- [x] Image paste from clipboard
- [x] Relative path resolution

#### Basic Tables ✅
- [x] Simple table rendering
- [x] Tab navigation between cells
- [x] Add/remove rows
- [x] Add/remove columns
- [x] Drag to resize columns
- [x] Context menu

#### UI/UX ✅
- [x] Clean, minimal interface
- [ ] Toggle WYSIWYG ↔ Source view
- [x] Cursor position preservation
- [x] Auto-save support

#### Testing & Polish ⚠️
- [ ] Unit tests for core functions
- [ ] Manual testing checklist
- [ ] Performance testing (1000+ line docs)
- [x] README documentation

**Deliverable:** Publishable MVP on VS Code Marketplace

**Timeline:** 6 weeks
**Status:** ✅ Core features complete, testing and polish remaining

---

### Phase 2: Enhanced Features (Weeks 7-14)

**Goal:** Deliver a polished, feature-rich WYSIWYG markdown editor

#### Advanced Tables
- [x] Resize columns by dragging
- [x] Table context menu
- [ ] Alignment controls (left, center, right)
- [ ] Merge cells
- [ ] Copy/paste table data
- [x] Table operations dropdown

#### Math Support (KaTeX)
- [ ] Inline math: `$...$`
- [ ] Display math: `$$...$$`
- [ ] Live LaTeX rendering
- [ ] Error handling/validation
- [ ] Equation numbering (optional)

**Status:** KaTeX library included, TipTap extension needed

#### Images Enhancement
- [ ] Image resize handles
- [x] Remote images (HTTP/HTTPS)
- [ ] Base64 embedded images
- [ ] Image zoom on click
- [ ] Alt text editing

#### Links Enhancement
- [ ] Link autocomplete (from document)
- [ ] Broken link detection
- [ ] Link validation
- [ ] Header links (#anchor)

#### Code Blocks
- [x] Language selection dropdown
- [ ] Line numbers
- [ ] Copy code button
- [x] Syntax highlighting (11+ languages)

#### Performance
- [ ] Virtual scrolling for large docs
- [x] Debounced rendering (500ms)
- [ ] Lazy image loading
- [ ] Optimize re-renders

#### Settings & UI
- [x] Theme selection (System/Light/Dark/Sepia)
- [x] Compact formatting toolbar
- [ ] Font size control (UI for existing config)
- [ ] Line height adjustment (UI for existing config)
- [ ] Enable/disable features (UI for existing config)

**Deliverable:** Feature-rich editor with industry-standard markdown editing capabilities

**Timeline:** 8 weeks
**Success Metric:** 25,000 active users, 4.5+ star rating

---

### Phase 3: Advanced Features (Weeks 15-24)

**Goal:** Advanced features with developer-focused enhancements

#### Mermaid Diagrams ✅ (Partially)
- [x] Flowcharts
- [x] Sequence diagrams
- [x] Class diagrams, Gantt charts, etc.
- [x] Toggle between code and rendered view
- [ ] Interactive editing UI
- [ ] Diagram export

#### Frontmatter Support
- [ ] YAML frontmatter parsing
- [ ] Frontmatter editor UI
- [ ] Syntax highlighting
- [ ] Autocomplete for common keys

#### Export Features
- [ ] Export to HTML
- [ ] Export to PDF
- [ ] Export to Word (DOCX)
- [ ] Custom CSS for exports
- [ ] Export preview

#### Enhanced Editing
- [ ] Find and replace
- [ ] Multi-cursor support
- [ ] Spell check integration
- [ ] Word count (live)
- [ ] Reading time estimate

#### Developer Features
- [ ] Run code blocks (JavaScript, Python)
- [ ] Inline code execution results
- [ ] Git blame in editor
- [ ] Markdown linting
- [ ] Auto-formatting

#### VS Code Integration
- [x] Command palette commands
- [x] Context menu integration
- [ ] Status bar info
- [x] Keybindings customization
- [ ] Snippets support

**Deliverable:** Advanced editor with unique developer features

**Timeline:** 10 weeks
**Success Metric:** 50,000 installs, top 100 VS Code extensions

---

### Phase 4: Polish & Scale (Weeks 25-30)

**Goal:** Production-ready, polished, community-driven

#### UI/UX Polish
- [ ] Smooth animations
- [ ] Improved hover states
- [ ] Better error messages
- [ ] Loading states
- [ ] Empty state designs
- [ ] Onboarding tutorial

#### Accessibility
- [ ] Screen reader support
- [ ] Keyboard navigation (enhance existing)
- [ ] ARIA labels
- [ ] High contrast theme support
- [ ] Accessibility audit

#### Internationalization
- [ ] i18n framework setup
- [ ] English (default)
- [ ] Spanish, French, German
- [ ] Chinese (Simplified), Hindi

#### Themes & Customization
- [ ] Multiple built-in themes
- [ ] Custom theme API
- [ ] Theme marketplace
- [ ] CSS variables for easy customization

#### Performance Optimization
- [ ] Web Workers for parsing
- [ ] Code splitting
- [ ] Lazy loading plugins
- [ ] Bundle size optimization (<5MB target)
- [ ] Startup time optimization (<500ms)

#### Testing & Quality
- [ ] 80%+ test coverage
- [ ] E2E tests for critical flows
- [ ] Performance benchmarks
- [ ] Automated visual regression tests
- [ ] CI/CD pipeline

#### Documentation
- [x] Comprehensive user guide (README)
- [ ] Video tutorials
- [ ] API documentation
- [x] Contributing guide
- [ ] Troubleshooting guide

**Deliverable:** Polished, production-ready extension

**Timeline:** 6 weeks
**Success Metric:** 100,000 installs, thriving community

---

### Post-Launch: Continuous Improvement

#### Maintenance
- Bug fixes (90% resolved within 2 weeks)
- Security updates
- VS Code API compatibility
- Dependency updates

#### Community Features
- Feature requests from GitHub issues
- Community plugin system
- Theme contributions
- Translations from community

#### Advanced Capabilities (Future)
- Collaborative editing (Live Share integration)
- Cloud sync (optional)
- Mobile companion app
- Web version (VS Code for Web support)

---

## Feature Priority Matrix

| Feature | User Value | Complexity | Priority | Status |
|---------|------------|------------|----------|--------|
| Basic WYSIWYG | ⭐⭐⭐⭐⭐ | Medium | **P0** | ✅ Done |
| Tables | ⭐⭐⭐⭐⭐ | Medium | **P0** | ✅ Done |
| Images | ⭐⭐⭐⭐⭐ | Low | **P0** | ✅ Done |
| Source toggle | ⭐⭐⭐⭐⭐ | Low | **P0** | ⏳ In Progress |
| Math (KaTeX) | ⭐⭐⭐⭐ | Medium | **P1** | ⏳ Planned |
| Code blocks | ⭐⭐⭐⭐ | Low | **P1** | ✅ Done |
| Diagrams (Mermaid) | ⭐⭐⭐ | High | **P2** | ✅ Done |
| Export PDF | ⭐⭐⭐ | Medium | **P2** | ⏳ Planned |
| Frontmatter | ⭐⭐⭐ | Low | **P2** | ⏳ Planned |
| Collaborative editing | ⭐⭐ | Very High | **P3** | ⏳ Future |

---

> **For practical development setup and workflow:** See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
> - Quick start and prerequisites
> - Development setup and project structure
> - Development workflow (branching, testing, committing)
> - Coding standards and formatting
> - Testing guidelines and checklists
> - Pull request process and templates

---

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **Major (1.0.0)**: Breaking changes
- **Minor (0.1.0)**: New features (backward-compatible)
- **Patch (0.0.1)**: Bug fixes (backward-compatible)

### Release Checklist

**Pre-Release:**
- [ ] All tests pass
- [ ] No critical bugs
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json

**Release:**
```bash
# Build release bundle
npm run build:release

# Package extension
npm run package:release

# Test .vsix file locally
# (Install in VS Code: Extensions > ... > Install from VSIX)

# Publish to marketplace with version bump
vsce publish patch  # Choose: patch, minor, or major
```

**Post-Release:**
- [ ] Create GitHub release with notes
- [ ] Announce on social media
- [ ] Update project board
- [ ] Monitor for issues

### Release Schedule

- **Patch releases**: As needed (bug fixes)
- **Minor releases**: Every 2-4 weeks (new features)
- **Major releases**: Every 6-12 months (breaking changes)

---

## AI Coding Assistant Integration

### Planning Workflow

We use a **planning-first workflow** where plans are created using any AI coding tool or manually. Plans are:
- **Public** - Available in the repository for transparency
- **Active work** - Once locked and ready, moved to `roadmap/pipeline/[name].md`
- **Completed work** - Moved to `roadmap/shipped/` when done

### Creating Plans with Your Favorite Tool

**📝 Start with the template:** Use [`roadmap/task-plan-template.md`](../roadmap/task-plan-template.md) as your starting point. It provides a structured format with hints for each section.

You can create plan files using any AI coding tool (Cursor, Antigravity, Windsurf, Claude Code, etc.) or manually:

1. **Use the template**: 
   - Prompt your AI tool: "Create a task plan using `roadmap/task-plan-template.md` for [feature name]"
   - Or copy the template and fill it in manually
   - The template includes placeholders and hints to guide you

2. **Create a markdown file**: 
   - If your tool has a plan feature (like Cursor), use it — plans are typically created in tool-specific locations (e.g., `.cursor/plans/`)
   - If your tool doesn't have a plan mode, just **prompt the AI to create a markdown file** based on the template in `roadmap/pipeline/[name].md`
   - You can also create markdown files manually using the template as a guide

3. **Plan location**: 
   - **Best practice**: Create directly in `roadmap/pipeline/` to keep everything organized
   - If created in a tool-specific location (like `.cursor/plans/`), move it when ready:
     ```bash
     git mv [source-location]/[name].md roadmap/pipeline/[name].md
     ```

4. **Move to shipped when complete**:
   ```bash
   git mv roadmap/pipeline/[name].md roadmap/shipped/
   ```

**Key point**: Don't worry if your tool doesn't have a special "plan mode" — just prompt the AI to create a markdown file using the template, or create one manually. The important part is having a well-drafted plan document following the template structure.

### AGENTS.md Standard

Our `AGENTS.md` file follows the [agents.md](https://agents.md/) standard, which is supported by many AI coding assistants (Cursor, Windsurf, Claude, etc.). The file references:
- `roadmap/pipeline/*.md` - Active implementation plans
- `roadmap/shipped/*.md` - Completed plans
- `vibe-coding-rules/` - Detailed coding guides

### Plan Lifecycle

1. **Draft** → Create plan anywhere (tool-specific location or `roadmap/pipeline/`)
2. **Ready** → Move to `roadmap/pipeline/` when locked and ready for implementation
3. **Complete** → Move to `roadmap/shipped/` when feature is done and tests pass

See [roadmap/README.md](../roadmap/README.md) for detailed planning workflow and tool-specific guidance.

Contributors using any AI coding assistant can benefit from:
- `AGENTS.md` instructions (read by most modern agents)
- `vibe-coding-rules/` coding guides (public and accessible)
- `roadmap/` planning documents (public specifications)

---

## Questions & Support

### For Contributors

- **GitHub Discussions**: General questions, ideas
- **GitHub Issues**: Bug reports, feature requests
- **Email**: support@DK-AI

### For Users

- **Documentation**: [README.md](../README.md)
- **Repository**: [kamransethi/gpt-ai-markdown-editor](https://github.com/kamransethi/gpt-ai-markdown-editor)
- **Issue Tracker**: [GitHub Issues](https://github.com/kamransethi/gpt-ai-markdown-editor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kamransethi/gpt-ai-markdown-editor/discussions)

---

## Related Documentation

**Practical Guides:**
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Developer setup, workflow, and contribution guidelines
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical architecture and implementation details
- **[BUILD.md](./BUILD.md)** - Build process and packaging
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Technical troubleshooting

**Project Documentation:**
- **[README.md](../README.md)** - User-facing documentation
- **[AGENTS.md](../AGENTS.md)** - AI coding assistant instructions
- **[roadmap/shipped/](../roadmap/shipped/)** - Shipped features (detailed plan files)

---

**Last Updated**: December 26, 2025
**Document Version**: 2.0 (Consolidated from feature-roadmap.md + DESIGN_PRINCIPLES.md)
