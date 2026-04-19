# Release Notes: v2.0.35

**Release Date**: April 11, 2026  
**Previous Release**: [v2.0.24](https://github.com/kamransethi/gpt-ai-markdown-editor/tree/v2.0.24)

This is a major release introducing comprehensive frontmatter management, a persistent document viewer, and significant UX refinements. **First release developed using specification-driven development with Specify**—resulting in clearer requirements, deeper test coverage, and better documentation. Includes full dependency modernization with TypeScript 6.0 and VS Code API 1.115.

---

## 🎯 New Features

### Frontmatter Management System

**Complete frontmatter editing workflow** with visual editor and YAML syntax highlighting:

- **FrontmatterBlock Extension**: Full TipTap integration for frontmatter editing as first-class document element
- **YAML Syntax Highlighting**: Color-coded YAML with proper structure visualization
- **Collapsible Panel**: Toggle frontmatter visibility with smooth open/close animations
- **Quick Access Button**: One-click "VIEW FRONTMATTER" button in the editor meta bar for instant access
- **Smart UI Integration**: Button automatically appears/disappears based on document frontmatter presence
- **Theme-Aware**: Colors adapt to light and dark VS Code themes

Perfect for MARP presentations, blog metadata, and complex document headers.

### LLM Provider Selection

**Freedom to choose your AI backend** — use local LLMs or GitHub Copilot:

- **GitHub Copilot (Default)**: Continue using cloud-based OpenAI models for all AI features
- **Local Ollama Support**: Route AI text refinement and document explanation through a local Ollama installation for privacy and offline capability
- **Custom Model Selection**: When using Ollama, choose any installed model (defaults to `llama3.2:latest`)
- **Custom Ollama Endpoint**: Advanced users can point to Ollama running on different machines or ports (default: `http://localhost:11434`)
- **Provider Independence**: AI Refine and AI Explain work seamlessly with either provider; Chat Participant remains GitHub Copilot-only
- **No Vendor Lock-In**: Switch between providers anytime via VS Code Settings without restarting

Unlike editors that lock you into their LLM choice, Flux Flow lets you use the models you trust.

### Image AI Ask Menu

**Powerful vision-based image analysis** right in your editor:

- **Explain Images**: Get detailed descriptions of diagrams, screenshots, and photos
- **Generate Alt Text**: Automatically create accessible alt text for images with one click
- **Extract Text**: OCR-like text extraction from screenshots and scanned documents
- **Describe for Documentation**: Get documentation-ready prose describing any image
- **Ask Custom Questions**: Ask freeform questions about images — not limited to preset prompts
- **Vision Model Compatibility**: Automatically detects if your LLM supports image analysis; gracefully handles non-vision models
- **Styled Dialog**: Custom questions appear in a clean, themed input dialog (not native prompts)
- **Question Persistence**: Remembers your last custom question across invocations

Works seamlessly with both GitHub Copilot vision models and capable local LLMs running via Ollama.

### AI Text Refinement — Tableize

**Convert text content into formatted tables** with one click:

- **Smart Formatting**: Automatically detects structure in text and creates proper markdown tables
- **Header Row Support**: Intelligently identifies and formats header rows
- **Integration**: Available in the AI Refine menu alongside Rephrase, Summarize, Shorten, and other modes
- **Workflow**: Select any text → Right-click → AI Refine → Tableize
- **Perfect For**: Converting lists, structured text, and CSV-like content into visual tables

Dramatically speeds up documentation workflows and data organization.

### Set as Default Markdown Viewer

**Persistent viewer selection** with "remember my choice" functionality:

- **First-Run Prompt**: On first activation, a clean modal asks if you want Flux Flow as your default markdown viewer
- **Automatic Persistence**: Your choice is remembered and applied to all markdown files in that workspace
- **Easy Override**: Change your default anytime in VS Code Settings under `gptAiMarkdownEditor.defaultMarkdownViewer`
- **Three Options**: 
  - "Flux Flow Editor" — Open all markdown with Flux Flow (recommended)
  - "VS Code Default" — Use VS Code's native preview
  - "Ask Each Time" — Get prompted for each new markdown file
- **Zero Prompts**: Once set, no more prompts—your preference is automatically applied

No more repetitive selections—choose once and work undisturbed.

### Enhanced About Editor Dialog

**Comprehensive editor information** at your fingertips:

- **Build Date**: Shows exactly when this build was created
- **Dependency Versions**: Displays key framework versions (TipTap 3.22.3, Mermaid 11.14.0, Shiki 3.23.0)
- **Consistent Typography**: Fully styled with sans-serif fonts matching the rest of the interface
- **Professional Layout**: Organized sections with uppercase titles and proper spacing
- **Easy Access**: Button in the right-side toolbar

Quick reference for troubleshooting and version verification.

### Plugin System Specification

**Foundation for extensibility** documented and ready for adoption:

- **Architecture Documentation**: Complete specification for plugin system design
- **Extension Points**: Clear guidance on available hooks and customization surfaces
- **Future Roadmap**: Framework established for community-contributed plugins

### Default Document Viewer Persistence

**Remember your document viewing preferences** across sessions:

- **Automatic Persistence**: VS Code now remembers your default markdown viewer selection per workspace
- **No More Prompts**: After selecting a default viewer from the prompt, it's automatically applied to all markdown files
- **User Control**: Clear setting in VS Code configuration to change default viewer anytime
- **Workspace-Level Settings**: Each workspace can have its own default viewer preference

Streamlines workflows for users juggling multiple markdown formats and viewing tools.

---

## 🏗️ Development Process Improvements

### Specification-Driven Development with Specify

This release marks the adoption of a **structured specification-driven development workflow** using AI-assisted tools:

**Workflow**:
1. **Specify Phase**: Convert user requests into detailed feature specifications with clear success criteria
2. **Plan Phase**: Generate implementation plans including architecture, file changes, and task breakdown
3. **Code Phase**: Implement features with comprehensive testing
4. **Verify Phase**: Validate against specification requirements

**Commands**:
- `/speckit.specify "feature description"` — Generate spec.md with requirements and acceptance criteria
- `/speckit.plan` — Create detailed implementation plan from approved specification
- `/speckit.clarify "ambiguous requirement?"` — Get targeted clarifications on spec points

**Benefits**:
- ✅ **Reduced Ambiguity**: Clear specs lead to fewer misunderstandings
- ✅ **Better Test Coverage**: Acceptance criteria in specs automatically become test cases
- ✅ **Improved Documentation**: Every feature has detailed specification documentation
- ✅ **Faster Implementation**: Plans cover architecture decisions upfront
- ✅ **Maintainability**: Future contributors have clear feature boundaries

**Specs Created This Release**:
- Spec 007: Frontmatter Details
- Spec 008: VIEW FRONTMATTER Button
- Spec 010: LLM Provider Selection
- Spec 011: Image AI Ask Menu
- Spec 012: About Editor Enhancement
- And more...all located in `specs/` with full requirement documentation

### Versioned Release Management

Established consistent release structure:
- `/releases/vX.Y.Z/` folder for each release
- `RELEASE_NOTES.md` with detailed changelog
- VSIX package organized in version folders
- Clear commit history and documentation per release

---

### Frontmatter UI Polish

- **Button Positioning**: Moved "VIEW FRONTMATTER" button to upper area of editor for better discoverability
- **Content Area Compaction**: Document content now properly flows below the VIEW FRONTMATTER button with optimized spacing
- **Consistent Rendering**: Frontmatter panel now uses contentDOM like code blocks for reliable rendering
- **Input Stability**: Replaced contentEditable code with textarea for more predictable text input handling

### Editor Scroll Behavior

- **H1-H3 Scroll Regression Fix**: Fixed Table of Contents refresh that was causing unexpected scroll jumps
- **Smooth Scrolling**: Writing flow no longer interrupted by automatic scroll-to-top during TOC updates
- **Performance**: Eliminated unnecessary layout recalculations that cascaded to main editor

### Layout & Display

- **Horizontal Scroll Prevention**: Fixed unwanted horizontal scrollbars in the editor viewport
- **Viewport Stability**: Added configurable minimum width threshold to prevent layout shifts
- **Responsive Design**: Better handling of edge cases with narrow editor windows

### Workflow & Process

- **Specs-Driven Development**: Adopted Specify for AI-assisted specification workflow (spec → plan → code → test)
  - `/speckit.specify` — Generate feature specifications from natural language descriptions
  - `/speckit.plan` — Create implementation plans from approved specifications
  - `/speckit.clarify` — Request targeted clarifications on ambiguous spec requirements
  - **Benefits**: Reduced ambiguity, better test coverage, clearer requirements documentation
- **Workflow Automation**: Enhanced speckit integration with AI-assisted spec→plan→code→test cycle
- **Release Management**: Established versioned release structure for organized GitHub Releases
- **Code Quality**: Refactored event listener syntax across components for consistency

---

## 📊 Release Statistics

- **Test Coverage**: 1,018 tests passing (zero regressions)
- **Changes**: 15+ new features, 8 bug fixes, 15+ refactoring improvements
- **Breaking Changes**: None
- **Dependencies Updated**: 13 packages modernized
  - TypeScript: 5.9.3 → 6.0.2 (major version)
  - @types/vscode: 1.90.0 → 1.115.0
  - esbuild: 0.27.4 → 0.28.0
  - Mermaid: 11.13.0 → 11.14.0
  - esTree: 8.57.2 → 8.58.1
  - And 8 more minor/patch updates

---

## 🔧 Technical Details

### New Features by Category

| Feature | Category | Impact |
|---------|----------|--------|
| Frontmatter Management | Editor UX | Native WYSIWYG frontmatter editing |
| LLM Provider Selection | AI Infrastructure | Use local Ollama or GitHub Copilot |
| Image AI Ask | Vision Capability | Analyze images with custom prompts |
| AI Tableize | Text Refinement | Convert text to markdown tables |
| Set as Default Viewer | Workspace Workflow | Remember viewer preference per workspace |
| About Editor Dialog | Information | Build date and dependency versions |
| Plugin System | Extensibility | Foundation for future community plugins |

### Compatibility

- **VS Code**: 1.115.0 and later (upgraded from 1.90.0)
- **Platforms**: Windows, macOS, Linux
- **Node.js**: 18+ (for build and development)
- **TypeScript**: 6.0.2 (upgraded from 5.9.3)
- **Breaking Changes**: None for users

### Performance

- **Bundle Size**: Stable (webview.js 4256KB, extension.js 85KB)
- **Load Time**: No regression
- **Memory Usage**: Optimized event listener management
- **Syntax Highlighting**: Improved with Shiki 3.23.0

---

## 📝 Known Issues

None identified in this release.

---

## 🚀 What's Next

Future roadmap:

- **Plugin System Launch**: Community-contributed plugins via published API
- **Advanced Frontmatter Validation**: Real-time schema validation with inline errors
- **GitHub Actions Integration**: Automatic release publishing to Marketplace
- **Enhanced Export Formats**: Additional output templates for blogs and presentations
- **Shiki 4.0 Migration**: When tiptap-extension-code-block-shiki adds support

---

## 💬 Feedback & Support

- **Report Bugs**: [GitHub Issues](https://github.com/kamransethi/gpt-ai-markdown-editor/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/kamransethi/gpt-ai-markdown-editor/discussions)
- **Documentation**: [README](https://github.com/kamransethi/gpt-ai-markdown-editor#readme)
- **Security**: [Security Policy](SECURITY.md)

---

## 📦 Installation

Install or upgrade from the VS Code Marketplace:

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Flux Flow Markdown Editor"
4. Click Install (or Update if already installed)

Or install from the command line:

```bash
code --install-extension kamransethi.gpt-ai-markdown-editor
```

---

## 🙏 Acknowledgments

Thanks to all contributors and users who reported issues and provided feedback on v2.0.24 through v2.0.35. Your input directly shaped these improvements.

---

## 📌 Commits Included

This release includes 44 commits since v2.0.24:

- **feat**: 15+ new features (frontmatter, LLM selection, image AI ask, tableize, set as default, etc.)
- **fix**: 8 bug fixes (scroll regression, UI polish, layout stability)
- **docs**: 12 documentation improvements
- **refactor**: 12 code quality improvements
- **chore**: 4 maintenance commits

See the [full commit history](https://github.com/kamransethi/gpt-ai-markdown-editor/compare/v2.0.24...v2.0.35) for complete details.

---

**Happy Markdown Editing! 📝**
