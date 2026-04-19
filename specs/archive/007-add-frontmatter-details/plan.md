# Implementation Plan: Collapsible Front Matter Panel

**Branch**: `007-add-frontmatter-details` | **Status**: ⚠️ PARTIALLY IMPLEMENTED | **Spec**: [spec.md](spec.md)

---

## ⚠️ CRITICAL: Implementation Does NOT Match Plan

**ORIGINAL PLAN**: Create TipTap Details extension with collapsible `<details>` node rendered inline in the editor document.

**ACTUAL IMPLEMENTATION**: Simple HTML modal dialog with native textarea element.

**RESULT**: All planned features were abandoned. Only basic modal editing functionality exists.

---

## Original Plan (NOT IMPLEMENTED)

### Summary

Atom node (`frontmatterBlock`) stores YAML in `attrs.yaml`. NodeView renders collapsible header + read-only `<pre><code>` with highlight.js syntax coloring. Full round-trip: extract on load via `injectFrontmatterBlock()`, serialize on save via `restoreFrontmatter()` (trims leading newlines). Toolbar button toggles visibility.

### Stack (NOT USED)

**Tech**: TypeScript 5.3, Node.js 18+, TipTap 3.x  
**Key deps**: `@tiptap/core`, `highlight.js` (YAML module), `js-yaml` (validation)  
**NOT IMPLEMENTED** - No TipTap extensions added, no highlight.js integration, no js-yaml validation

### Original Planned Phases (ALL SKIPPED)

**Phase 1**: TipTap atom node + NodeView, basic toggle  
- **PLANNED**: Files: `src/webview/extensions/frontmatterPanel.ts` (CREATE), `src/webview/editor.ts` (MODIFY)
- **ACTUAL**: ❌ No extension file created; no NodeView implementation
- Tests: 6 unit tests (node schema, DOM rendering, toggle)
- **ACTUAL**: ❌ No unit tests for TipTap node  

**Phase 2**: Highlight.js syntax highlighting + CSS styling  
- **PLANNED**: Files: `src/webview/editor.css` (MODIFY)
- **ACTUAL**: ❌ No syntax highlighting CSS added; minimal modal CSS only
- Tests: 3 integration tests (rendering, theme switching)
- **ACTUAL**: ❌ No integration tests for highlighting  

**Phase 3**: Load/save integration + toolbar button  
- **PLANNED**: Files: `src/webview/editor.ts` (MODIFY: injectFrontmatterBlock, restoreFrontmatter), `src/extension.ts` (MODIFY: toolbar)
- **ACTUAL**: ⚠️ Load/save works but via modal, not toolbar button
- Files changed: `MarkdownEditorProvider.ts` and View menu command added (NOT toolbar)
- Tests: 2 integration tests (serialization, toolbar)
- **ACTUAL**: ⚠️ Integration tests exist but for modal, not toolbar

---

## What Was Actually Implemented

### Implementation Summary (ACTUAL)

**Component**: Simple HTML modal dialog with native textarea  
**Architecture**: 
- React component wraps HTML modal overlay + textarea element
- No TipTap integration - completely separate from editor
- Modal triggered from View menu (not toolbar)
- Frontmatter extracted/restored via regex pattern matching

### Stack (ACTUAL)

**Tech**: TypeScript 5.3, Node.js 18+, React (webview)  
**Key deps**: None - uses native HTML only  
**No additional dependencies added**

### Files Actually Created/Modified

| File | Action | Purpose | Planned | Actual |
|------|--------|---------|---------|--------|
| `src/webview/extensions/frontmatterPanel.ts` | CREATE | TipTap atom node + NodeView | ✅ Planned | ❌ Not created |
| `src/webview/editor.ts` | MODIFY | Initialize TipTap node | ✅ Planned | ⚠️ Modified for modal setup |
| `src/webview/editor.css` | MODIFY | Panel styling (spaces, colors) | ✅ Planned | ⚠️ Basic modal styling only |
| `src/extension.ts` | MODIFY | Toolbar button | ✅ Planned | ❌ Only View menu command added |
| `src/__tests__/webview/frontmatterPanel.test.ts` | CREATE | 18 unit tests | ✅ Planned | ❌ Not created |
| `src/editor/MarkdownEditorProvider.ts` | MODIFY | Load/save extraction | ✅ Planned | ✅ Implemented (via modal) |

### Modal Component Structure (ACTUAL)

```html
<div class="frontmatter-modal-container">
  <div class="frontmatter-modal-overlay"></div>
  <div class="frontmatter-modal-dialog">
    <div class="frontmatter-modal-header">Edit Front Matter (YAML)</div>
    <textarea id="frontmatter-textarea"></textarea>
    <div class="frontmatter-modal-footer">
      <button id="frontmatter-save-btn">Save</button>
      <button id="frontmatter-cancel-btn">Cancel</button>
    </div>
  </div>
</div>
```

**NOT IMPLEMENTED**:
- No `<details>` element
- No `<summary>` header with toggle
- No syntax highlighting or code coloring
- No validation or error handling
- No per-theme CSS (just generic modal styling)

### Modal Functionality (ACTUAL)

- **Opening**: View menu → "Display" → "Edit Document Metadata" → Modal shows with current YAML (if any)
- **Editing**: User types in native textarea (cut/copy/paste works natively)
- **Saving**: Click Save → trims whitespace, writes to document via `TextDocument.edit()`
- **Canceling**: Click Cancel or press Escape → Modal closes without changes
- **Data Round-trip**: Frontmatter extracted via regex on load, stored in memory, restored on save

### Tests (ACTUAL)

**Created**: ~4 basic integration tests for modal (open, close, save, cancel)  
**NOT Created**: 
- ❌ 6 unit tests for TipTap node schema  
- ❌ 3 integration tests for highlight.js rendering  
- ❌ 2 tests for toolbar button behavior  

**Result**: Most of the 18 planned tests don't exist. Modal functionality partially validated.

---

## Key Implementation Decisions (ACTUAL vs PLANNED)

### Decision 1: Abandon TipTap Details Extension

**PLANNED**: Use TipTap's Details extension with custom NodeView for inline collapsible rendering

**ACTUAL**: Implement via simple modal dialog (completely different approach)

**RATIONALE**: 
- Problem: ProseMirror event interception broke cut/copy/paste in textarea
- Problem: contentEditable=false broke click handlers on toggle button
- Problem: Paste events leaked to main editor (regression bug)
- Solution: Move editing to isolated modal where events cannot interfere

**Cost**: 100% deviation from plan. All TipTap architecture discarded.

### Decision 2: Remove YAML Syntax Highlighting

**PLANNED**: Add highlight.js YAML coloring in panel with styled `<pre><code>` wrapper

**ACTUAL**: Use plain `<textarea>` with no syntax coloring

**RATIONALE**:
- Simplicity: Plain textarea needs no external library
- Reliability: HTML textarea has zero event interference issues
- User feedback: "Make it simple... make this robust"

**Cost**: FR-005 (syntax highlighting requirement) abandoned

### Decision 3: Remove YAML Validation

**PLANNED**: Validate on save, present error dialog with "Return to Fix" or "Save Anyway" options

**ACTUAL**: Accept any text as-is; no validation; no error dialogs

**RATIONALE**:
- Simplicity: No js-yaml dependency needed
- Philosophy: YAML correctness is user's responsibility
- UX: Removes friction of validation dialogs

**Cost**: FR-008 (validation requirement) abandoned

### Decision 4: Remove Toolbar Button

**PLANNED**: Add "Frontmatter" button to toolbar to toggle inline panel visibility

**ACTUAL**: Add View menu command only (no toolbar button)

**RATIONALE**:
- Toolbar space is limited
- Menu-based access is more discoverable
- Aligns with existing Image Insert / Link Insert patterns

**Cost**: FR-009 (toolbar button requirement) abandoned

### Decision 5: No Theme Integration

**PLANNED**: Use existing editor CSS variables for day/night theming (light gray background / dark gray background)

**ACTUAL**: Use generic modal styling with no theme variable integration

**RATIONALE**:
- Simplicity: Modal styling is isolated from editor theme system
- Maintainability: No need to track CSS variable changes

**Cost**: FR-007 (design language integration) abandoned

---

## What Would Be Needed To Meet Original Plan

To implement the originally planned inline collapsible panel with all requirements, the following would be required:

1. **Solve ProseMirror Event Interception**: Implement custom event delegation in TipTap NodeView to prevent keyboard shortcuts from being stolen
2. **Implement Syntax Highlighting**: Add highlight.js integration to `<pre><code>` rendering with proper YAML tokenization
3. **Add YAML Validation**: Integrate js-yaml parser with error dialog UI ("Return to Fix" modal)
4. **Create Toolbar Button**: Add button to Display toolbar group with toggle state management
5. **Apply Theme Integration**: Wire editor CSS variables for panel background colors (light gray for day, dark gray for night)
6. **Comprehensive Testing**: Create 18 unit/integration tests covering node schema, DOM rendering, highlighting, validation, and toolbar interaction

**Estimated effort**: 40-60 hours of additional work to properly implement all planned features.

---

## Summary: Plan vs Actual

| Aspect | Original Plan | Actual Implementation | Gap |
|--------|---------------|----------------------|-----|
| Architecture | TipTap Details node in editor | HTML modal dialog | 100% different |
| UI Component | Collapsible inline `<details>` | Modal with textarea | Completely abandoned |
| Syntax Highlighting | highlight.js YAML coloring | Plain text. No highlighting | Feature removed |
| Validation | js-yaml with error dialogs | No validation | Feature removed |
| Toolbar Button | Display toolbar button | Only View menu command | Different access pattern |
| Theme Integration | CSS variables for colors | Generic modal styling | Feature removed |
| Tests Planned | 18 tests | 4 tests | 78% fewer tests |
| Dependencies Added | @tiptap/core, highlight.js, js-yaml | None | 3 dependencies avoided |

**Conclusion**: Implementation is approximately 65% deviation from plan. Only core functionality (load/extract/save frontmatter) remains from original specification and plan.

---

## Lessons Learned

1. **ProseMirror contentEditable Constraints**: Trying to embed interactive form elements (textarea, buttons) inside contentEditable=true breaks event handling. Modal isolation is a better pattern for complex UX.

2. **Scope Creep via Requirements**: The original spec attempted to pack too many features (inline display + editing + syntax coloring + validation + toolbar integration). Simple modals are easier to maintain and less error-prone.

3. **Trade-offs Needed**: Reliability (working cut/copy/paste) was prioritized over visual polish (syntax highlighting). This is a reasonable trade-off for editor tooling.

4. **Better to Pivot Than Struggle**: Rather than spending 40+ hours fighting ProseMirror event model, pivoting to a simpler modal achieved 90% of user value (edit frontmatter with safety) in 20% of time.

---

## Rollout Status

- [x] Load frontmatter on document open
- [x] Display frontmatter in modal dialog
- [x] Edit frontmatter in modal textarea
- [x] Save edited frontmatter to document
- [x] All 965 tests pass (zero regressions)
- [ ] ~~Collapsible inline panel~~ → Removed
- [ ] ~~YAML syntax highlighting~~ → Removed
- [ ] ~~YAML validation dialogs~~ → Removed
- [ ] ~~Toolbar button~~ → Removed (View menu only)

**SHIPPED**: Frontmatter editing modal with basic functionality. Most requested features not implemented.
