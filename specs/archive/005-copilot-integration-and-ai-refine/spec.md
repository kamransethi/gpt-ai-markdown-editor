# Spec: Copilot Integration & AI Refine Improvements

**Category**: Bug Fix + Feature Requests  
**Status**: IMPLEMENTED ✅  
**Date Completed**: April 11, 2026

---

## Overview

This spec documents four feature improvements and one critical bug fix related to AI integration:

| ID    | Title                                      | Type | Status |
|-------|-------------------------------------------|------|--------|
| BUG-I | File not exposed to GitHub Copilot chat   | Bug  | ❌ FAILED |
| FR-1  | AI Refine preserves block quote formatting | Feature | ⚠️ PARTIAL |
| FR-2  | Remember last custom refinement command   | Feature | ✅ TESTED |
| FR-3  | Better UX for custom refinement dialog     | Feature | ✅ TESTED |
| FR-4  | Selected text context in Copilot          | Feature | ❌ BROKEN |

---

## BUG-I: File Not Exposed to GitHub Copilot Chat

**Status**: ❌ FAILED — Cannot Implement

### Problem

GitHub Copilot cannot discover which markdown file is currently open in the custom editor. This prevents Copilot from:
- Knowing which file the user is asking about
- Providing file-specific context in responses
- Auto-referencing the active document

**Impact**: 
- Copilot treats the custom editor as "unknown context"
- Users must use `#file:` references manually
- No implicit file awareness for AI suggestions

### Why This Cannot Be Fixed

The VS Code Custom Editor API does not expose custom editors to the Copilot @-mention system. The `stream.reference()` API only works for built-in VS Code editor providers (TextEditor, NotebookEditor, etc.). Custom editors are excluded from the Copilot discovery UI.

**Tested Approaches That Failed**:
1. `stream.reference(Uri)` — Only returns file URI for built-in editors, ignored for custom editors
2. Chat participant proposals/metadata — No mechanism to register custom editor context
3. Document symbols hack — Would require parsing, not structural integration

**Result**: Copilot shows `+` button only for native editors. Custom editors remain invisible to Copilot's UI, regardless of backend implementation.

### Proposed Workaround

Document that users should use `#file:` manual references for custom editor context. This is a VS Code platform limitation, not a bug in this extension.

---

## FR-1: AI Refine Preserves Block Quote Formatting

**Status**: ⚠️ PARTIAL — Works for quotes/alerts, not code blocks

### Problem

When using AI Refine on text inside a blockquote, the refined text loses block quote context:

**Before**:
```markdown
> Original blockquote text that needs refining
```

**User Action**: Select text, request "Make it more concise"

**Current Result** (broken):
```markdown
> > More concise version
```

**Issue**: AI adds block quote markers in response, then they get applied inside existing blockquote, creating nested `>>`.

### What Works ✅
- Blockquotes: `>` — Renders correctly as single-level quote
- GitHub alerts: `> [!NOTE]` — Wrapper detection works
- Other callout formats — Wrapper detection applied

### What Doesn't Work ❌
- Code blocks with fenced quotes
- Mixed nesting scenarios
- **See new issue**: BUG-FR1-PARTIAL (code block + AI Refine corruption)

### Expected Behavior (Partial)
- ⚠️ Refined text retains blockquote/alert formatting
- Result: `> More concise version` (not `> >`)
- ✅ Works with blockquotes and GitHub alerts

---

## FR-2: Remember Last Custom Refinement Command

**Status**: ✅ TESTED AND WORKS

### Problem

When users apply similar refinements to multiple sections, they must re-type the instruction each time:

**Current Behavior** (tedious):
1. User types: "Make it more professional"
2. Applies to section 1
3. Opens dialog for section 2 → Empty field
4. User types: "Make it more professional" again ❌

### Expected Behavior
- ✅ Dialog pre-fills with last command
- ✅ User can edit or accept
- ✅ Speeds up repetitive refinements

---

## FR-3: Better UX for Custom Refinement Dialog Shortcuts

**Status**: ✅ TESTED AND WORKS

### Problem

Current keyboard shortcuts are non-standard and confusing:

| Key | Expected | Current |
|-----|----------|---------|
| Submit | Enter | Ctrl+Enter only |
| New line | Shift+Enter | Not supported |
| Close | Esc | Has global listener |

**Issue**: Contradicts standard textarea behavior

### Expected Behavior
- ✅ Enter submits dialog
- ✅ Shift+Enter creates line break
- ✅ Escape closes dialog
- ✅ No interference with other UI elements

---

## FR-4: Selected Text Context in Copilot

**Status**: ❌ BROKEN — Linked to BUG-I

### Problem

When asking Copilot about selected text, Copilot doesn't know what's selected:

**Test Case** (fails):
```
Selected: "2 cloves garlic, minced\n1 bell pepper, diced"
Copilot: "@fluxflow Tell me about this part of the recipe"
Result: "I don't see a clear recipe reference..."
Expected: "This part contains two prepped ingredients..."
```

### Root Cause

Linked to BUG-I: Custom editor context is not exposed to Copilot. Even with selection tracking implemented, Copilot cannot receive the context because:
1. Custom editors invisible to Copilot UI
2. No way to attach selection metadata to Copilot requests
3. `stream.reference()` doesn't include selection ranges for custom editors

### Why It Fails
- ✅ Selection tracking is implemented in `activeWebview.ts`
- ❌ But Copilot never receives the reference or selection
- ❌ Platform limitation: Copilot custom context only works for built-in editors

### Proposed Workaround

Users should manually copy/paste selected text into chat when discussing specific sections.
- ✅ Copilot can reference "your selection"
- ✅ File awareness (BUG-I) enables: "Refactor this section"

---

## Implementation Notes

For detailed implementation of each fix, see [IMPLEMENTATION.md](IMPLEMENTATION.md)

For test coverage, see [TESTS.md](TESTS.md)

---

**Document Status**: Specification complete. Refer to implementation and test docs for details.
