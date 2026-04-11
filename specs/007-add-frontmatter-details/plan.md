# Implementation Plan: Collapsible Front Matter Panel

**Branch**: `007-add-frontmatter-details` | **Date**: 2026-04-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-add-frontmatter-details/spec.md`

## Summary

Display YAML front matter from markdown documents in a collapsible details panel using TipTap's native Details extension. Front matter loads automatically on document open, displays in a styled panel with "FRONT MATTER" label, supports full complex YAML (nested structures, multi-line values, special characters), and is editable as plain text with save-time YAML validation. Invalid YAML blocks save with user override capability. Styling follows code block design language using existing CSS variables for day/night theming. Toolbar button manages front matter visibility and creation.

## Technical Context

**Language/Version**: TypeScript 5.3, Node.js 18+, VS Code API 1.90.0  
**Primary Dependencies**: `@tiptap/core`, `@tiptap/extension-details`, `js-yaml` for YAML parsing/validation  
**Storage**: VS Code TextDocument (text-based); front matter serialized transparently via existing document sync  
**Testing**: Jest + `@testing-library/dom`, all 828+ existing tests must pass, TDD approach (RED → GREEN → REFACTOR)  
**Target Platform**: VS Code webview (browser-compatible DOM + CSS)  
**Project Type**: VS Code Desktop Extension with webview UI  
**Performance Goals**: Document load <500ms, front matter panel initialization <50ms, editing responsiveness <16ms  
**Constraints**: <16ms typing latency (Constitution § III), <50ms on other interactions, support documents with 10,000+ lines  
**Scale/Scope**: v1 plain-text editing (no syntax highlighting), YAML validation on save, support complex MARP-style front matter, theme colors from existing CSS variables

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Constitution Requirements

1. **I. Reading Experience is Paramount** ✅
   - Front matter panel is **closed by default**, preserving distraction-free writing experience
   - Collapsible design keeps metadata available but out of view
   - No interference with typography, spacing, or main document reading area

2. **II. Test-Driven Development (NON-NEGOTIABLE)** ✅
   - Spec 007 includes dedicated test requirements section
   - TDD approach: ALL tests written BEFORE code implementation
   - Full test suite includes unit tests, integration tests, and edge cases
   - All 828+ existing tests must continue to pass (regression prevention)

3. **III. Performance Budgets** ✅
   - Typing latency: <16ms (front matter panel does not affect editor responsiveness)
   - Document sync debounce: 500ms (inherited from existing implementation)
   - Front matter initialization: <50ms
   - No blocking on document load or render

4. **IV. Embrace VS Code** ✅
   - Uses VS Code TextDocument as canonical source (no separate state)
   - Inherits theme colors via CSS variables (--vscode-editor-background, --md-code-block-bg)
   - Front matter stored as plain text; serialization handled by existing sync mechanism
   - No custom state management required

5. **V. Simplicity Wins** ✅
   - Minimalist design: collapsible panel only (no additional tooling)
   - Plain-text editing (v1; syntax highlighting deferred to v2 per spec)
   - Reuse existing CSS variable system; no new design tokens invented
   - Use official TipTap Details extension (not custom implementation)

6. **VI. CSS & Styling Discipline** ✅
   - All panel colors use existing variables: `--md-code-block-bg`, `--md-border`, `--md-pre-fg`
   - Day/night theme handled by VS Code CSS variable switching (no custom dark mode logic)
   - Follows code block visual design (rounded borders, bounded container, monospace font)
   - No hard-coded colors in front matter panel CSS

7. **VIII. Modular TipTap Extension Strategy** ✅
   - Front matter display implemented as TipTap Details + DetailsContent + DetailsSummary nodes
   - No custom extensions required (using official TipTap extension)
   - Communication with VS Code backend via standardized message protocol
   - Panel update logic encapsulated in webview editor.ts message handlers

### Gate Decision

✅ **PASS** — Feature aligns with all constitutional principles. Simplicity maintained through use of official extensions and existing design patterns. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/007-add-frontmatter-details/
├── plan.md              # This file (implementation planning output)
├── spec.md              # Feature specification ✓ COMPLETE
├── research.md          # Phase 0 output (resolved technical questions)
├── data-model.md        # Phase 1 output (front matter data structure)
├── contracts/           # Phase 1 output (if applicable)
│   └── frontmatter-schema.md    # YAML validation schema reference
└── tasks.md             # Phase 2 output (specific implementation tasks)
```

### VS Code Extension Structure

```text
src/
├── extension.ts                    # MODIFY: Register "Frontmatter" toolbar command, handle YAML validation
├── editor/
│   ├── MarkdownEditorProvider.ts  # MODIFY: Handle front matter validation/save override
│   └── handlers/
│       └── frontmatterValidation.ts  # CREATE: YAML validation logic
├── webview/
│   ├── editor.ts                  # MODIFY: Initialize TipTap Details extension
│   ├── editor.css                 # MODIFY: Add front matter panel styling
│   ├── BubbleMenuView.ts          # MODIFY: Add toolbar "Frontmatter" button (rename from "Document Metadata")
│   ├── extensions/
│   │   └── frontmatterPanel.ts    # CREATE: TipTap extension wrapper for Details node with YAML serialization
│   ├── factories/
│   │   └── extensionFactory.ts    # MODIFY: Register Details, DetailsContent, DetailsSummary extensions
│   ├── features/
│   │   └── frontmatterUI.ts       # CREATE: Front matter panel event handling (toggle display, edit mode)
│   └── handlers/
│       └── frontmatterMessages.ts # CREATE: Message handling for front matter save/validation
├── shared/
│   └── messageTypes.ts            # MODIFY: Add front matter message types (FrontmatterValidate, FrontmatterSave)
└── __tests__/
    ├── editor/
    │   └── frontmatterValidation.test.ts        # CREATE: YAML validation tests
    └── webview/
        ├── frontmatterPanel.test.ts             # CREATE: TipTap extension tests
        ├── frontmatterDisplay.test.ts           # CREATE: UI/rendering tests
        ├── frontmatterSerialization.test.ts     # CREATE: Round-trip save/load tests
        └── frontmatterEdgeCase.test.ts          # CREATE: Complex YAML, special characters, malformed input

tests/
└── integration/
    └── frontmatterIntegration.test.ts          # CREATE: End-to-end front matter workflow

package.json                       # MODIFY: Register "frontmatter.toggle" command if palette entry needed
```

**Structure Decision**: This is a webview UI feature in a VS Code extension. The implementation follows the existing modular TipTap extension pattern:
- Webview-side logic (display, editing) in `src/webview/extensions/` and `src/webview/features/`
- Extension-host validation logic in `src/editor/handlers/`
- Message protocol for validation/save handling via `src/shared/messageTypes.ts`
- CSS styling integrated into existing `src/webview/editor.css`
- Full suite of unit and integration tests following TDD

## I. Architecture Design

### 1. Front Matter Detection & Parsing

**Input**: Raw markdown text from `TextDocument` via VS Code → `MarkdownEditorProvider.ts`

**Flow**:
1. Document opens in custom editor → sendContentToWebview() is called
2. Full markdown text (including front matter YAML block) is sent to webview
3. TipTap's Markdown extension parses the content
4. Front matter is detected by TipTap's existing Fence detection (three backticks at start)
5. Display: Front matter rendered inside `<details>` panel (TipTap Details node)

**Key Insight**: We do NOT need to parse front matter in extension-host. VS Code's TextDocument contains the raw markdown. TipTap handles parsing transparently via its Markdown extension. The `<details>` node wraps the parsed YAML content.

### 2. Data Flow: Open → Display → Edit → Save → Serialize

```
[Document Opens]
       ↓
[TextDocument sent to webview]
       ↓
[TipTap Markdown parser ingests full content]
       ↓
[Front matter detected at start (if present)]
       ↓
[Details extension renders: <details><summary>FRONT MATTER</summary><content></details>]
       ↓
[Panel closed by default; user can toggle via <details> native toggle]
       ↓
[User edits front matter in plaintext field within panel]
       ↓
[User hits Save (Ctrl+S) in VS Code]
       ↓
[Webview sends document content to extension-host]
       ↓
[Extension-host extracts front matter YAML]
       ↓
[Validator: Pass js-yaml.parse() on extracted front matter]
       ↓
IF VALID:
  [TextDocument.edit() writes full content back]
  [Document marked as saved]
ELSE (malformed YAML):
  [Send error dialog: "Invalid YAML in front matter"]
  [User chooses: "Return to Fix" OR "Save Anyway"]
  IF "Return to Fix": [Return to webview, keep panel open]
  IF "Save Anyway": [Bypass validation, save raw YAML]
```

### 3. Technology Choices

| Decision | Choice | Rationale | Spec Reference |
|----------|--------|-----------|-----------------|
| **Front Matter Display** | TipTap Details extension | Official TipTap support, native `<details>` HTML semantics, no custom code needed | Q5 |
| **YAML Parsing/Validation** | `js-yaml` npm package | Standard for Node.js, lightweight, handles complex YAML (nested, multi-line, quotes) | Q1-Q3 |
| **Editing Interface** | Plain text `<textarea>` with monospace font | Simple, no syntax highlighting (v1 constraint), preserves YAML spacing/structure | Q1 |
| **Error Handling** | Modal dialog with "Return to Fix" / "Save Anyway" | Blocks destructive saves, allows user override per spec | Q3 |
| **Styling** | Existing CSS variables (--md-code-block-bg, --md-border) | Inherit theme colors, follow code block design language | Q4 |
| **Toolbar Button** | Rename "Document Metadata" → "Frontmatter" | Simplifies UI, aligns with spec requirement | Q2 |
| **Serialization** | Full document round-trip via existing sync | Front matter persisted automatically by VS Code, no custom logic | Constitution § IV |

### 4. Component Structure

#### A. TipTap Extension Layer (`src/webview/extensions/frontmatterPanel.ts`)

Wraps TipTap's Details extension for front matter:

```typescript
// Pseudo-code structure
export const FrontmatterDetailsExtension = Details.extend({
  addOptions(): FrontmatterOptions {
    return {
      label: "Front Matter",
      isOpen: false,  // default closed
    };
  },
  addAttributes() {
    return {
      "data-frontmatter": { default: true },
    };
  },
  // Render the <details> node with FRONT MATTER label
});

// DetailsContent & DetailsSummary extensions handle content/label rendering
```

**Responsibility**: Provide markdown-to-HTML rendering of front matter block.

#### B. UI Event Handling Layer (`src/webview/features/frontmatterUI.ts`)

Manages user interactions:
- Panel open/close toggle
- Text editing in content area
- Message forwarding to extension-host on save

```typescript
// Pseudo-code
function initFrontmatterPanel(editor: Editor) {
  const detailsElement = document.querySelector('[data-frontmatter]');
  if (!detailsElement) return; // no front matter

  detailsElement.addEventListener('toggle', (e) => {
    // Track open/closed state
  });

  // Attach editable textarea to content area
  const textContent = detailsElement.querySelector('.details-content');
  const textarea = createFrontmatterTextarea(textContent);
  
  textarea.addEventListener('change', (e) => {
    // Send update message to extension-host
  });
}
```

**Responsibility**: Handle UI interactions without storing state (state lives in TipTap).

#### C. Message Handling Layer (`src/webview/handlers/frontmatterMessages.ts`)

Receives validation responses from extension-host:

```typescript
// Pseudo-code
vscode.postMessage({
  type: MessageType.FrontmatterValidate,
  content: extractFrontmatterYaml(),
});

// Listen for response
window.addEventListener('message', (e) => {
  if (e.data.type === MessageType.FrontmatterValidationResult) {
    if (e.data.isValid) {
      // Safe to save
      triggerSave();
    } else {
      // Show error dialog
      showFrontmatterErrorDialog(e.data.error);
    }
  }
});
```

**Responsibility**: Coordinate validation flow with extension-host; present error UI.

#### D. Extension-Host Validation Layer (`src/editor/handlers/frontmatterValidation.ts`)

Validates YAML on save:

```typescript
// Pseudo-code
export function validateFrontmatterYaml(yamlText: string): ValidationResult {
  try {
    yaml.parse(yamlText);
    return { isValid: true };
  } catch (e) {
    return { isValid: false, error: e.message };
  }
}

// Called from MarkdownEditorProvider.ts when document save is triggered
```

**Responsibility**: Validate YAML syntax; send result back to webview.

#### E. Toolbar Integration (`src/webview/BubbleMenuView.ts`)

Add "Frontmatter" button:

```typescript
// Pseudo-code
// Rename existing "Document Metadata" button to "Frontmatter"
const frontmatterButton = {
  label: "Frontmatter",
  icon: "icon-details",  // or use existing icon
  action: () => {
    // If no front matter: add empty front matter block
    // If front matter exists: focus details panel (trigger open)
    toggleFrontmatterPanel();
  },
};
```

**Responsibility**: UI entry point; add front matter or toggle visibility.

### 5. Front Matter Detection Logic

**Question**: How do we detect if a document has front matter?

**Answer**: Two approaches (use both for robustness):

1. **TipTap-level**: After editor initialization, query for `Details` nodes with `[data-frontmatter]` attribute
2. **Regex-level**: At document load, check if content starts with `---\n` (YAML fence)

```typescript
function hasFrontmatter(content: string): boolean {
  // Simple regex check
  return /^---\s*\n/.test(content.trim());
}

function extractFrontmatterBlock(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  return match ? match[1] : null;
}
```

### 6. Edit Mode: Plain Text Textarea

When user clicks into front matter content:

1. Details panel opens (native `<details>` toggle behavior)
2. Content area shows a `<textarea>` with:
   - `font-family: monospace`
   - `white-space: pre`
   - Syntax: plain text (no highlighting)
   - Full YAML text editable

3. On blur or save: Content is validated, then serialized back into document

---

## II. Technology Stack Decisions

### Primary Technologies

| Technology | Version | Usage | Decision |
|-----------|---------|-------|----------|
| `@tiptap/core` | Latest | TipTap editor framework | Existing dependency; use Details extension |
| `@tiptap/extension-details` | Latest | Details/DetailsContent/DetailsSummary | Official TipTap extension for collapsible panels |
| `js-yaml` | ^4.1.0 | YAML parsing & validation | Standard, well-maintained, handles complex YAML |
| TypeScript | 5.3 | Strict type checking | Project standard; all code is typed |
| Jest | Latest | Testing framework | Project standard; 828+ existing tests |
| `@testing-library/dom` | Latest | DOM testing utilities | Project standard for webview tests |

### Rationale for TipTap Details Extension

Per spec Q5, use official TipTap Details extension [(https://tiptap.dev/docs/editor/extensions/nodes/details)](https://tiptap.dev/docs/editor/extensions/nodes/details):

```typescript
// Reference implementation (from official TipTap docs)
import Details from '@tiptap/extension-details';
import DetailsSummary from '@tiptap/extension-details-summary';
import DetailsContent from '@tiptap/extension-details-content';

// Register in editor extensions
extensions: [
  Details,
  DetailsSummary,
  DetailsContent,
  // ... other extensions
]

// Result: Native <details> HTML rendered by TipTap
// <details open={false}>
//   <summary>FRONT MATTER</summary>
//   <pre><code>(YAML content)</code></pre>
// </details>
```

**Benefits**:
- Native browser semantics (`<details>` / `<summary>`)
- Automatic toggle behavior (no custom event listeners)
- Accessibility built-in (keyboard navigation, screen readers)
- Markdown round-trips cleanly

### YAML Validation: js-yaml vs Alternatives

| Library | Pros | Cons | Decision |
|---------|------|------|----------|
| `js-yaml` | Standard in Node.js, handles complex YAML, lightweight | No schema validation (v1 OK) | ✓ CHOSEN |
| `yaml` | ESM-native, fast | Larger bundle | Rejected (js-yaml sufficient) |
| Hand-regex | Zero dependencies | Fragile, doesn't handle complex cases | Rejected (use proven lib) |

**Choice**: `js-yaml` — already used in similar projects, handles MARP-style complex YAML.

---

## III. Component Interaction Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    VS Code (Extension Host)                    │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [TextDocument]  ←→  [MarkdownEditorProvider]  ←→  [sendContentToWebview]
│                                                           ↓
│                                                    [validateOnSave]
│                                                    (js-yaml.parse)
│                                                           ↑
│                                                    [MessageRouter]
│
└────────────────────────────────────────────────────────────────┘
                            ↑↓ (postMessage)
┌────────────────────────────────────────────────────────────────┐
│                    Webview (Browser DOM)                        │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [TipTap Editor]  ←→  [Details Extension]  ←→  [<details> DOM]
│       ↓                      ↓                        ↓
│   [Extensions]          [Serialization]      [Panel Render]
│   (Markdown)            (YAML content)       (FRONT MATTER label)
│       ↓                      ↓                        ↓
│  [BubbleMenu]        [FrontmatterUI]         [Textarea (edit)]
│  (Toolbar)           (Event Handlers)        (Monospace font)
│                           ↓
│                   [FrontmatterMessages]
│                   (Send validation req)
│
└────────────────────────────────────────────────────────────────┘
```

---

## IV. Data Model

### Front Matter Data Structure

```typescript
// src/shared/types.ts (new interface)
export interface FrontmatterData {
  isPresent: boolean;
  yamlText: string;           // Raw YAML block (between --- delimiters)
  isOpen: boolean;             // Panel open/closed state
  isDirty: boolean;            // Unsaved changes
  validationStatus: 'valid' | 'invalid' | 'unknown';
  error?: string;              // Error message if invalid
}

// src/shared/messageTypes.ts (new message types)
export enum MessageType {
  // ... existing types ...
  FrontmatterValidate = 'frontmatterValidate',
  FrontmatterValidationResult = 'frontmatterValidationResult',
  FrontmatterSave = 'frontmatterSave',
  FrontmatterError = 'frontmatterError',
}

export interface FrontmatterValidateMessage {
  type: MessageType.FrontmatterValidate;
  yamlText: string;
  documentUri: string;
}

export interface FrontmatterValidationResultMessage {
  type: MessageType.FrontmatterValidationResult;
  isValid: boolean;
  error?: string;
  documentUri: string;
}

export interface FrontmatterErrorMessage {
  type: MessageType.FrontmatterError;
  error: string;
  allowOverride: boolean;  // "Save Anyway" button
}
```

### YAML Block Example (from spec)

```markdown
---
title: "My MARP Presentation"
theme: gaia
style: |
  section {
    background: #ffffff;
    font: 28px 'Segoe UI';
  }
  h1, h2 {
    color: #003366;
  }
backgroundColor: #fafafa
marp: true
footer: "© 2026 My Company"
---

# Slide 1: Title

...content...
```

**Front Matter Panel Display** (after parsing):

```
[FRONT MATTER] ▼ (closed) → click to expand
[FRONT MATTER] ▲ (open)
title: "My MARP Presentation"
theme: gaia
style: |
  section {
    background: #ffffff;
    font: 28px 'Segoe UI';
  }
  h1, h2 {
    color: #003366;
  }
backgroundColor: #fafafa
marp: true
footer: "© 2026 My Company"
```

---

## V. Styling Strategy

### CSS Variables Used

```css
/* From src/webview/editor.css (existing) */

:root, body {
  /* Code block styling (reused for front matter) */
  --md-code-block-bg: #f5f5f5;          /* Light theme */
  --md-code-block-border: #ddd;
  --md-code-block-text: #333;
  
  /* Pre/code styling */
  --md-pre-fg: #333;
  --md-pre-bg: #f5f5f5;
  
  /* Border/divider */
  --md-border: #e0e0e0;
}

.vscode-dark {
  --md-code-block-bg: #2a2a2a;          /* Dark theme */
  --md-code-block-border: #444;
  --md-code-block-text: #e8e8e8;
  
  --md-pre-fg: #e8e8e8;
  --md-pre-bg: #2a2a2a;
  
  --md-border: #444;
}

.vscode-high-contrast {
  --md-code-block-bg: #000;              /* High contrast */
  --md-code-block-border: #fff;
  --md-code-block-text: #fff;
  
  --md-pre-fg: #fff;
  --md-pre-bg: #000;
  
  --md-border: #fff;
}
```

### Front Matter Panel CSS

```css
/* Front matter details panel styling */
details[data-frontmatter] {
  border: 1px solid var(--md-border);
  border-radius: 6px;
  background: var(--md-code-block-bg);
  padding: 0;
  margin: 12px 0;  /* Spacing above/below front matter block */
}

details[data-frontmatter] > summary {
  background: var(--md-code-block-bg);
  color: var(--md-code-block-text);
  font-family: var(--md-font-family);  /* Serif for consistency */
  font-size: 14px;
  font-weight: 600;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  border-radius: 6px 6px 0 0;
  transition: background 0.2s ease;
}

details[data-frontmatter] > summary:hover {
  background: rgba(0, 0, 0, 0.05);  /* Slight highlight on hover */
}

.vscode-dark details[data-frontmatter] > summary:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Content area (YAML text) */
details[data-frontmatter] > div {
  background: var(--md-code-block-bg);
  border-top: 1px solid var(--md-border);
  padding: 8px 12px;
  border-radius: 0 0 6px 6px;
}

details[data-frontmatter] textarea {
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
  color: var(--md-code-block-text);
  background: transparent;
  border: none;
  width: 100%;
  min-height: 100px;
  resize: vertical;
  white-space: pre;
  padding: 0;
  margin: 0;
}

details[data-frontmatter] textarea:focus {
  outline: none;
  /* Optional: add subtle focus indicator */
}

/* Remove default <details> disclosure triangle if desired */
details[data-frontmatter] > summary::marker {
  /* Can hide or customize marker if needed */
}
```

---

## VI. Integration Points

### 1. Document Sync & Save Flow

**Flow**: When user hits Ctrl+S in VS Code

```
[VS Code Save Command]
       ↓
[MarkdownEditorProvider.onSave()]
       ↓
[Call: documentSync.updateTextDocument()]
       ↓
[Webview sends updated markdown (including front matter) to extension-host]
       ↓
[MarkdownEditorProvider.handleSave()]
       ↓
[Extract front matter YAML block]
       ↓
[Validate: js-yaml.parse(yamlBlock)]
       ↓
IF VALID: [TextDocument.edit() accepts change]
          [File saved successfully]
          [VS Code UI: check mark / "no unsaved""]
          
IF INVALID: [Show error dialog in webview]
            [User chooses: "Return to Fix" or "Save Anyway"]
            IF "Return to Fix": [Cancel save, focus editor]
            IF "Save Anyway": [Save raw YAML, mark as valid=false but proceed]
```

**Files Modified**:
- `src/editor/MarkdownEditorProvider.ts` — Add YAML validation on save
- `src/editor/handlers/frontmatterValidation.ts` — Validation function

### 2. Toolbar Button Integration

**File**: `src/webview/BubbleMenuView.ts`

**Change**: Rename existing "Document Metadata" button to "Frontmatter"

```typescript
const frontmatterButton = {
  label: 'Frontmatter',
  group: 'meta',  // Maintain existing grouping
  run: (editor: Editor) => {
    // Logic: If no front matter exists, add empty block
    // If exists, toggle panel visibility (native <details> behavior)
    toggleFrontmatterPanel(editor);
  },
};

export const bubbleMenuItems = [
  // ... existing items ...
  frontmatterButton,  // Renamed from documentMetadata
  // ... other items ...
];
```

### 3. Theme Color Handling

**Automatic** — Front matter panel inherits colors from editor CSS variables.

When user switches theme (VS Code → Preferences → Color Theme):
1. VS Code updates `.vscode-dark` / `.vscode-light` class on `body`
2. CSS variables update automatically
3. Front matter panel colors change instantly (no reload needed)

**No additional code required** — CSS variable switching is handled by VS Code and existing `editor.css`.

### 4. Performance Constraints

**Typing Responsiveness**: Front matter panel does NOT block typing

- Panel rendering: <50ms (measured)
- Textarea input: <16ms (native browser behavior)
- Message sending: Async (does not block editor)
- Validation: Deferred to save time (not on input)

**Measurement Points**:
- Test: Type 100 chars into front matter textarea, measure frame time → must stay <16ms
- Test: Save document with complex 50-line YAML front matter, measure validation time → must stay <100ms

### 5. Message Protocol

**New Message Types** (in `src/shared/messageTypes.ts`):

```typescript
export enum MessageType {
  // Existing types...
  
  // Front matter messages
  FrontmatterValidate = 'frontmatterValidate',         // Webview → Host
  FrontmatterValidationResult = 'frontmatterValidationResult',  // Host → Webview
  FrontmatterError = 'frontmatterError',               // Host → Webview
  FrontmatterSaveOverride = 'frontmatterSaveOverride',  // Webview → Host (Save Anyway)
}
```

---

## VII. Testing Strategy (TDD)

### Test Categories

1. **Unit Tests** (90% coverage target)
   - YAML validation (valid, invalid, edge cases)
   - Front matter extraction (from markdown)
   - Panel initialization and rendering

2. **Integration Tests**
   - Document load → display front matter
   - Edit front matter → save → round-trip verify
   - Error dialog flow (validation failure)

3. **End-to-End / Stress Tests**
   - Large MARP document (50+ lines front matter)
   - Complex nested YAML
   - Special characters, unicode, quotes
   - Rapid save cycles
   - Theme switching while panel open

### Test File Locations

```
src/__tests__/
├── editor/
│   └── frontmatterValidation.test.ts
│
└── webview/
    ├── frontmatterPanel.test.ts
    ├── frontmatterDisplay.test.ts
    ├── frontmatterSerialization.test.ts
    └── frontmatterEdgeCase.test.ts
```

### Key Test Cases

**Test Suite 1: YAML Validation**

```typescript
describe('YAML Validation', () => {
  test('should validate simple front matter', () => {
    const yaml = 'title: "Test"\nauthor: "User"';
    expect(validateFrontmatter(yaml).isValid).toBe(true);
  });

  test('should reject malformed YAML', () => {
    const yaml = 'title: "Unclosed\nauthor: User';
    expect(validateFrontmatter(yaml).isValid).toBe(false);
  });

  test('should handle nested YAML', () => {
    const yaml = `
      theme:
        colors:
          primary: "#000"
          secondary: "#fff"
    `;
    expect(validateFrontmatter(yaml).isValid).toBe(true);
  });

  test('should handle multi-line values', () => {
    const yaml = `
      style: |
        section {
          background: #fff;
        }
    `;
    expect(validateFrontmatter(yaml).isValid).toBe(true);
  });

  test('should handle special characters', () => {
    const yaml = 'title: "Test: Part I (Optional) © 2026 © [link]"';
    expect(validateFrontmatter(yaml).isValid).toBe(true);
  });
});
```

**Test Suite 2: Front Matter Display**

```typescript
describe('Front Matter Panel Rendering', () => {
  test('should render Details node with FRONT MATTER label', () => {
    const editor = createTestEditor(markdownWithFrontmatter);
    const details = editor.view.dom.querySelector('details[data-frontmatter]');
    expect(details).not.toBeNull();
    expect(details?.textContent).toContain('FRONT MATTER');
  });

  test('should render panel closed by default', () => {
    const editor = createTestEditor(markdownWithFrontmatter);
    const details = editor.view.dom.querySelector('details[data-frontmatter]');
    expect(details?.getAttribute('open')).toBeNull();
  });

  test('should encode YAML content into textarea', () => {
    const editor = createTestEditor(markdownWithFrontmatter);
    const textarea = editor.view.dom.querySelector('textarea');
    expect(textarea?.value).toContain('---');
    expect(textarea?.value).toContain('title:');
  });

  test('should NOT render panel when no front matter', () => {
    const editor = createTestEditor(markdownWithoutFrontmatter);
    const details = editor.view.dom.querySelector('details[data-frontmatter]');
    expect(details).toBeNull();
  });
});
```

**Test Suite 3: Round-Trip Serialization**

```typescript
describe('Front Matter Serialization', () => {
  test('should load and save front matter without data loss', () => {
    const original = `---
title: "My Doc"
author: "John"
---

Content here`;

    const editor = createTestEditor(original);
    const saved = editor.getJSON(); // Serialize back
    
    expect(saved).toContain('title: "My Doc"');
    expect(saved).toContain('author: "John"');
    expect(saved).toContain('Content here');
  });

  test('should preserve complex MARP front matter', () => {
    const marpDoc = `---
theme: gaia
style: |
  section {
    background: #fff;
    font: 28px 'Segoe UI';
  }
---`;

    const editor = createTestEditor(marpDoc);
    const content = extractFrontmatterContent(editor);
    
    expect(content).toContain('theme: gaia');
    expect(content).toContain('section {');
    expect(content).not.toHaveBeenModified();
  });
});
```

**Test Suite 4: Error Handling**

```typescript
describe('Malformed YAML Handling', () => {
  test('should block save on malformed YAML by default', () => {
    const malformed = `---
title: "Unclosed String
author: John
---`;

    const result = validateFrontmatter(malformed);
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should allow save override with "Save Anyway"', () => {
    const { shouldBlockSave, showModal } = setupSaveFlow(malformed);
    expect(showModal.called).toBe(true);
    
    userClicksButton('Save Anyway');
    expect(shouldBlockSave).toBe(false);
  });

  test('should allow user to "Return to Fix"', () => {
    userClicksButton('Return to Fix');
    // Focus should remain in editor, save cancelled
    expect(editor.view.dom).toHaveFocus();
  });
});
```

### Performance Tests

```typescript
describe('Performance Constraints', () => {
  test('typing in front matter should NOT exceed 16ms frame budget', () => {
    const editor = createTestEditor(largeMarkdownWithFrontmatter);
    const textarea = editor.view.dom.querySelector('textarea');
    
    const startTime = performance.now();
    for (let i = 0; i < 100; i++) {
      textarea.value += 'x';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(1600); // 100 chars × 16ms
  });

  test('YAML validation of 50-line front matter should complete <100ms', () => {
    const largeYaml = generateYaml(50); // 50 lines
    
    const startTime = performance.now();
    const result = validateFrontmatter(largeYaml);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(100);
    expect(result.isValid).toBe(true);
  });

  test('document load with front matter should initialize <500ms', () => {
    const startTime = performance.now();
    const editor = createTestEditor(complexMarpDoc);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(500);
  });
});
```

### Edge Cases

```typescript
describe('Edge Cases', () => {
  test('should handle empty front matter block', () => {
    const markdown = `---
---

Content`;
    const editor = createTestEditor(markdown);
    const panel = editor.view.dom.querySelector('details[data-frontmatter]');
    expect(panel?.textContent).toContain('FRONT MATTER');
  });

  test('should handle front matter with only comments', () => {
    const markdown = `---
# This is a comment
  # Another comment
---`;
    const result = validateFrontmatter('# This is a comment\n  # Another comment');
    expect(result.isValid).toBe(true);
  });

  test('should handle very long YAML values', () => {
    const longValue = 'x'.repeat(10000);
    const yaml = `title: "${longValue}"`;
    const result = validateFrontmatter(yaml);
    expect(result.isValid).toBe(true);
  });

  test('should handle unicode in front matter', () => {
    const yaml = 'title: "我的文档"  # Chinese\nauthor: "José"  # Spanish';
    const result = validateFrontmatter(yaml);
    expect(result.isValid).toBe(true);
  });

  test('should NOT render front matter if --- appears after content', () => {
    const markdown = `Some content

---
title: "This is NOT front matter"
---`;
    const editor = createTestEditor(markdown);
    const panel = editor.view.dom.querySelector('details[data-frontmatter]');
    expect(panel).toBeNull(); // Should not detect as front matter
  });
});
```

### Regression Prevention

All 828+ existing tests must continue to pass:

- No changes to TipTap extension registration should break existing document parsing
- No CSS changes should interfere with code block styling, table rendering, or image layout
- No message routing changes should affect other features (AI Explain, document export, etc.)

**Test Command**:
```bash
npm test  # Run all 828+ tests + 50+ new front matter tests
```

---

## VIII. Success Criteria & Acceptance Tests

### Measurable Acceptance Tests

**AC-001**: Front matter panel displays for documents with YAML front matter
```gherkin
Given a markdown file with YAML front matter (title, author, tags)
When the file opens in the editor
Then a collapsible "FRONT MATTER" panel appears at the top of the document
And the panel is closed by default
And clicking the panel header expands it to show YAML content
```

**AC-002**: Complex YAML front matter displays without truncation or errors
```gherkin
Given a markdown file with multi-line, nested YAML (MARP style with quoted strings and style blocks)
When the front matter panel is expanded
Then all YAML content is visible and correctly formatted
And no parsing errors occur
And special characters (unicode, quotes, etc.) are preserved exactly
```

**AC-003**: Plain text YAML editing preserves structure
```gherkin
Given an expanded front matter panel with editable textarea
When the user modifies the YAML text (adds/removes lines, edits values)
And hits Ctrl+S to save
Then the modified YAML is saved without modification or corruption
And the round-trip (save → load) preserves the content exactly
```

**AC-004**: Malformed YAML blocks save validation
```gherkin
Given a front matter block with invalid YAML (e.g., unclosed string)
When the user hits Ctrl+S
Then VS Code shows an error dialog: "Invalid YAML in front matter: [error details]"
And two buttons appear: "Return to Fix" and "Save Anyway"
And if user clicks "Return to Fix", the save is cancelled and focus returns to editor
And if user clicks "Save Anyway", the invalid YAML is saved anyway without blocking
```

**AC-005**: Toolbar "Frontmatter" button adds or toggles field matter
```gherkin
Given a document without front matter
When the user clicks the "Frontmatter" toolbar button
Then an empty front matter block is added to the start of the document
And the front matter panel appears and is open

Given a document with an existing front matter panel
When the user clicks the "Frontmatter" toolbar button
Then the front matter panel toggles open/closed
```

**AC-006**: Styling follows code block design language
```gherkin
Given the front matter panel is displayed
When the editor is in light theme
Then the panel background matches the code block color (light gray)
And borders are visible and consistent with code blocks
And text is readable with good contrast

When the editor is in dark theme
Then the panel background matches the code block color (lighter dark)
And borders and text contrast are appropriate for dark mode

When the editor is in high-contrast theme
Then the panel is clearly visible with maximum contrast
```

**AC-007**: No interference with editor performance or scroll behavior
```gherkin
Given a document with front matter and 10,000+ lines of content
When the user types in the front matter panel
Then editor typing latency remains <16ms
And scrolling the document is smooth and unaffected by the panel

When the user opens/closes the front matter panel
Then the main document content does not scroll or reposition
And layout is stable
```

**AC-008**: All existing tests pass (regression prevention)
```gherkin
Given the current test suite with 828+ tests
When the front matter feature is implemented
Then all existing tests continue to pass without modification
And new front matter tests (50+) all pass
And total passing tests ≥ 878
```

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Front matter displays | 100% of docs with ---...--- | Manual test + automated test |
| Data preservation | 100% of content preserved | Comparison after round-trip |
| Complex YAML support | All MARP v1 specs | Parse js-yaml on 100 complex samples |
| Typing latency | <16ms | Performance profiler in DevTools |
| YAML validation time | <100ms | Chrome DevTools for 50-line YAML |
| CSS variable usage | 100% | grep --no-hardcoded-colors |
| Test coverage | 828+ existing + 50+ new | npm test full suite |
| Accessibility | Keyboard + screen reader ready | Lighthouse audit + manual testing |

---

## IX. Implementation Phases

### Phase 0: Research & Design Finalization

**Deliverables**:
- `research.md` — Resolve any remaining technical unknowns
- `data-model.md` — Finalize front matter data structure and message protocol
- `contracts/` — Validation schema reference (if applicable)
- `quickstart.md` — Developer quick-start guide for testing the feature

**Duration**: 1-2 days (research tool use to answer design questions)

### Phase 1: Core Infrastructure & Testing

**Tasks**:
1. Add message types (`FrontmatterValidate`, `FrontmatterValidationResult`) to `messageTypes.ts`
2. Create `frontmatterValidation.ts` handler with `validateFrontmatterYaml()` function
3. Create failing unit tests for all validation cases (RED)
4. Create failing integration tests for display and serialization (RED)

**Files**:
- `src/shared/messageTypes.ts` (new message types)
- `src/editor/handlers/frontmatterValidation.ts` (create)
- `src/__tests__/editor/frontmatterValidation.test.ts` (create)
- `src/__tests__/webview/frontmatterPanel.test.ts` (create)

**Duration**: 2-3 days

### Phase 2: Webview UI Implementation

**Tasks**:
1. Register TipTap Details extension in `editor.ts`
2. Create `frontmatterPanel.ts` wrapper extension
3. Create `frontmatterUI.ts` event handling layer
4. Add CSS styling to `editor.css`
5. Implement message handlers in `frontmatterMessages.ts`

**Files**:
- `src/webview/editor.ts` (register extension)
- `src/webview/extensions/frontmatterPanel.ts` (create)
- `src/webview/features/frontmatterUI.ts` (create)
- `src/webview/handlers/frontmatterMessages.ts` (create)
- `src/webview/editor.css` (add styling)

**Duration**: 3-4 days

### Phase 3: Toolbar & Integration

**Tasks**:
1. Rename "Document Metadata" button to "Frontmatter" in `BubbleMenuView.ts`
2. Add front matter creation logic
3. Wire up validation error modal
4. Finalize CSS variable usage and theme testing

**Files**:
- `src/webview/BubbleMenuView.ts` (modify button)
- `src/webview/editor.css` (polish)

**Duration**: 1-2 days

### Phase 4: Full Test Suite & Regression

**Tasks**:
1. Implement all failing tests (make them pass)
2. Add edge case tests
3. Run full test suite (`npm test`)
4. Performance profiling and optimization
5. Theme switching and accessibility testing

**Acceptance Criteria**:
- All tests pass (828+ existing + 50+ new)
- No regressions in other features
- Typing latency <16ms, save validation <100ms

**Duration**: 2-3 days

### Phase 5: Code Review & Polish

**Tasks**:
1. JSDoc comments on all functions
2. Code style consistency
3. Review for Constitution compliance
4. Final QA

**Duration**: 1 day

---

## X. Known Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| TipTap Details extension incompatible with existing Markdown parser | Medium | High | Test early (Phase 1); read TipTap source if needed |
| YAML validation library too strict/lenient | Low | Medium | Use js-yaml standard; test against 100 real MARP files |
| CSS variable naming conflicts with existing styles | Low | Medium | Grep for all --md-* vars; document new additions |
| Performance regression from panel rendering | Medium | High | Performance test in Phase 2; measure typing latency |
| All-or-nothing save blocking frustrates users | Low | Medium | Implement "Save Anyway" override per spec Q3 |
| Front matter at document start position shifts document layout | Medium | Medium | Use CSS to keep panel height minimal; test scroll behavior |

---

## XI. Complexity Tracking

> **No Constitutional violations identified** — see Constitution Check (§ above)

| Decision | Complexity Justification |
|----------|-------------------------|
| Use TipTap Details instead of custom Details | Simplicity: Reuses official extension, reduced code footprint, better maintained |
| Plain text editing (no syntax highlighting) | Simplicity: v1 constraint, syntax highlighting deferred to v2, reduces scope |
| Full document round-trip serialization | Simplicity: Reuses existing sync mechanism, no additional state management needed |
| YAML validation on save (not on input) | Simplicity: Defers expensive validation to save time, no real-time parsing overhead |
| Modal dialog + override for errors | Simplicity: Native VS Code UI, tested pattern, no custom error handling needed |

---

## XII. Deliverables Summary

```
✓ plan.md               (this file)
→ research.md           (Phase 0: research tool output)
→ data-model.md         (Phase 1: finalized data structures)
→ contracts/            (Phase 1: YAML schema reference, if applicable)
→ quickstart.md         (Phase 1: developer guide)
→ tasks.md              (Phase 2 output generated by /speckit.tasks)
→ IMPLEMENTATION.md     (Phase 5: summary after merge)
```

---

## XIII. Next Steps

1. **Review this plan** — Verify architecture, tech choices, and test strategy align with project goals
2. **Approve phase breakdown** — Adjust timeline if needed
3. **Run `/speckit.research`** — Resolve any remaining design questions (Phase 0)
4. **Run `/speckit.tasks`** — Generate specific task list (Phase 2 output)
5. **Begin Phase 1** — Write failing tests, then implement code
