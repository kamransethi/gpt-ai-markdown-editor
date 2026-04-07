# Implementation Plan: Default Markdown Viewer Setup

**Feature Branch**: `001-default-markdown-viewer`  
**Specification**: `specs/001-default-markdown-viewer/spec.md`  
**Planning Date**: April 5, 2026  
**Target Timeline**: 3-4 days (including TDD, review, testing)

---

## I. Technical Approach & Architecture

### Design Philosophy

This feature is a **first-time setup flow**, not editor functionality. It executes once at extension activation and stores its result permanently. Following the constitution's simplicity principle and VS Code integration paradigm:

- **When**: Activate event in `src/extension.ts` during the first ever extension load
- **How**: Use VS Code's `showInformationMessage()` with modal buttons
- **Storage**: Use `globalState` API (extension's permanent per-user storage, persists across sessions and updates)
- **Config**: Update VS Code's workspace/user `markdown.preview.defaultPreviewPane` setting when user clicks "Yes"

### System Flow

```
Extension activates
    ↓
Check globalState for prior decision (key: "defaultViewerPromptDecision")
    ├─ Value exists (Yes/No) → Skip prompt (user already decided)
    └─ Value missing → Show modal dialog
        ├─ User clicks "Yes" → Update config + Store "yes" in globalState → Continue
        ├─ User clicks "No" → Store "no" in globalState → Continue
        └─ User dismisses → Do nothing (may re-prompt on next activation)
```

### Why This Approach?

1. **Simplest solution**: One small async function in activation hook; no new state machines
2. **VS Code-native**: Uses built-in `showInformationMessage()` (no custom UI)
3. **Respects user intent**: `globalState` persists the choice forever; dismissals don't count
4. **Configuration standard**: Leverages VS Code's built-in `markdown.preview.defaultPreviewPane` setting
5. **Performance**: Dialog is fire-and-forget; adds <50ms to activation (within budget)

---

## II. Data Model

### Global State Storage

```typescript
// Extension's globalState key for default viewer prompt decision
const VIEWER_PROMPT_KEY = "defaultViewerPromptDecision";

// Possible values
type ViewerPromptChoice = "yes" | "no" | undefined;
// "yes"       → User clicked Yes; config was updated
// "no"        → User clicked No; no config changes made  
// undefined   → Not yet decided; prompt may be shown again
```

### VS Code Configuration

**Target Config**:
- Key: `markdown.preview.defaultPreviewPane`
- Value when user clicks "Yes": `"kamransethi.gpt-ai-markdown-editor"`
- Scope: User or Workspace (user should choose in the dialog; default to workspace)

---

## III. Implementation Phases

### Phase 1: Test-First (RED)

**File**: `src/__tests__/extension/defaultViewerPrompt.test.ts`  
**Responsibility**: All test cases for the feature

Create test file with failing tests covering:

1. **First activation (no prior decision)**
   - [ ] When extension activates with no `globalState` value, mock `showInformationMessage()` is called
   - [ ] Dialog shows buttons ["Yes", "No"]
   - [ ] Dialog text includes "default markdown viewer" and extension name

2. **User clicks "Yes" (happy path)**
   - [ ] `globalState.update()` stores "yes" with key `"defaultViewerPromptDecision"`
   - [ ] `vscode.workspace.getConfiguration('markdown.preview')` is updated with `defaultPreviewPane: "kamransethi.gpt-ai-markdown-editor"`
   - [ ] Update scope defaults to "workspace" (per convention)

3. **User clicks "No"**
   - [ ] `globalState.update()` stores "no"
   - [ ] No config changes occur (verify `updateConfiguration()` is NOT called)

4. **User dismisses modal** (returns undefined from `showInformationMessage()`)
   - [ ] No `globalState.update()` is called
   - [ ] No config changes occur
   - [ ] User might be prompted again on next activation

5. **Prior decision exists (memoization)**
   - [ ] If `globalState` already has "yes", dialog is NOT shown
   - [ ] If `globalState` already has "no", dialog is NOT shown
   - [ ] No dialog on subsequent activations

6. **Edge case: config already set**
   - [ ] If user clicks "Yes" but `markdown.preview.defaultPreviewPane` is already `"kamransethi.gpt-ai-markdown-editor"`, no error is thrown (idempotent)

**Mocking strategy**:
- Mock `vscode.window.showInformationMessage()` using Jest
- Mock `context.globalState`
- Mock `vscode.workspace.getConfiguration()` and `.update()`
- Inject these via a testable wrapper function or dependency injection

### Phase 2: Green Implementation

**File**: `src/extension.ts`  
**Responsibility**: Add activation hook that triggers the prompt

Create a new exported function:

```typescript
export async function showDefaultViewerPrompt(
  context: vscode.ExtensionContext
): Promise<void>
```

Logic:
1. Check `context.globalState.get("defaultViewerPromptDecision")`
2. If value exists, return early (no prompt)
3. Call `vscode.window.showInformationMessage()`
   - Message: "Would you like to set Flux Flow Markdown Editor as your default markdown viewer?"
   - Buttons: `["Yes", "No"]`
   - Modal: `true`
4. Handle response:
   - If "Yes": 
     - Call `vscode.workspace.getConfiguration("markdown.preview").update("defaultPreviewPane", "kamransethi.gpt-ai-markdown-editor", vscode.ConfigurationTarget.Workspace)`
     - Call `context.globalState.update("defaultViewerPromptDecision", "yes")`
   - If "No":
     - Call `context.globalState.update("defaultViewerPromptDecision", "no")`
   - If undefined (dismissed):
     - Do nothing

Integrate into activation:
- In `activate(context)`, after extension is ready, call `showDefaultViewerPrompt(context)` with `.catch()` error handler (fire-and-forget; does not block activation)
- Place after all essential services are initialized, so activation completes quickly

**Files to modify**:
- `src/extension.ts` — Add function + hook into `activate()`

### Phase 3: Refactor & Polish

**File**: `src/extension.ts`  
**Responsibility**: Clean code, add JSDoc, verify no side effects

1. Add JSDoc to `showDefaultViewerPrompt()` explaining:
   - What globalState key is used
   - What config is updated
   - Why modal (not notification)
   - Edge cases (dismissal behavior)

2. Extract magic strings to constants:
   - `VIEWER_PROMPT_DECISION_KEY = "defaultViewerPromptDecision"`
   - `EXTENSION_ID = "kamransethi.gpt-ai-markdown-editor"`
   - `CONFIG_KEY = "markdown.preview.defaultPreviewPane"`

3. Verify performance:
   - No blocking operations
   - Promise resolves within <100ms (including dialog wait time)
   - Tests confirm activation completes in <500ms total

4. Run full test suite:
   - `npm test` — all tests pass (new + existing)
   - No regressions

### Phase 4: Validation & Testing

**Integration test**: `src/__tests__/integration/activation.test.ts`  
**Responsibility**: Verify prompt plays well with full extension lifecycle

- [ ] Fresh install simulation: remove globalState, activate, verify prompt appears
- [ ] Update scenario: globalState has "yes", activate, verify no prompt, verify config is still set
- [ ] Workspace vs User scope: verify config update goes to workspace (or make this configurable)

**Manual test**:
- [ ] Uninstall extension
- [ ] Reinstall from VSIX
- [ ] Activate VS Code with extension enabled
- [ ] Verify modal appears with "Yes" and "No" buttons
- [ ] Click "Yes"
- [ ] Open any `.md` file, right-click → "Open Preview", verify default viewer is now the extension
- [ ] Activate extension again, verify no prompt (checked globalState)
- [ ] Test "No" path: reinstall, click "No", verify preview still uses default VS Code viewer

---

## IV. Technology Decisions & Dependencies

| Decision | Choice | Why |
|----------|--------|-----|
| **Dialog Type** | `vscode.window.showInformationMessage()` | Native VS Code widget; modal option prevents user from accessing editor while prompt is visible |
| **Persistence** | `ExtensionContext.globalState` | Built-in extension storage; survives reloads, updates, and uninstall (per VS Code docs); no file I/O |
| **Config Target** | `ConfigurationTarget.Workspace` | Sensible default; workspace settings are version-controlled (good for teams) |
| **Async Model** | Async/await with fire-and-forget | Prompt doesn't block activation; user can interact immediately |
| **Error Handling** | Silent failures + logging | If config update fails, log error but don't crash; user can set manually |

### Dependencies

- **No new npm packages** required
- Uses VS Code built-in APIs only: `vscode.window`, `vscode.workspace`, `ExtensionContext.globalState`
- Jest already in dev dependencies for testing

---

## V. Implementation Timeline

| Phase | Task | Est. Hours | Owner |
|-------|------|-----------|-------|
| **1** | Write failing tests | 2.5 | Implementation Agent |
| **2** | Implement green solution | 1.5 | Implementation Agent |
| **3** | Refactor, docs, linting | 1 | Implementation Agent |
| **4** | Integration tests + manual testing | 2 | Implementation Agent + User |
| **5** | Code review + fixes | 1 | User |
| **6** | Merge to main | 0.5 | User |
| | **Total** | **~8.5 hours** | |

**Timeline Estimate**: 3-4 calendar days (assuming 2-3 hours/day dev work + review cycles)

---

## VI. Risk Assessment

### Low-Risk Areas

1. **Simple scope**: Single feature, minimal code (expect <200 LOC including tests)
2. **Well-defined APIs**: VS Code `globalState`, `showInformationMessage()`, config APIs are stable and documented
3. **No external dependencies**: No new npm packages; no network calls
4. **Non-intrusive**: Doesn't modify editor state, undo history, or document content
5. **TDD reduces bugs**: All paths (Yes/No/dismiss/prior-decision) tested before implementation

### Potential Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| **User already has `markdown.preview.defaultPreviewPane` set** | Overwrite user's choice silently | Low | Dialog message should mention "change your setting anytime"; document in help |
| **`globalState` corrupts or clears** (VS Code bug) | User re-prompted on every activation | Very Low | Graceful fallback: if update fails, log & continue (idempotent); user can set manually |
| **User dismisses dialog repeatedly** (UX pain) | Annoying; user re-prompted on every activation | Med | Document: "click No to stop prompting"; add link to manual config in dialog text |
| **Extension ID changes** (unlikely) | Setting stores wrong value | Very Low | Hardcode extension ID as constant; verify in tests |
| **Activation hangs waiting for dialog** | Slow startup experience | Low | Use fire-and-forget with timeout; `showInformationMessage()` auto-dismisses after ~10s if no interaction |
| **Tests become flaky** (mock setup) | CI/CD failures | Low | Jest mocks are stable; use consistent mock patterns; run tests locally before commit |

### Risk Mitigation Tactics

1. **Add informative dialog text**:
   - "Would you like to set Flux Flow Markdown Editor as your default markdown viewer?"
   - Subtitle (optional): "You can change this anytime in VS Code settings (Cmd/Ctrl+comma → markdown.preview.defaultPreviewPane)."

2. **Idempotent config updates**:
   - Setting `markdown.preview.defaultPreviewPane = "kamransethi.gpt-ai-markdown-editor"` twice causes no harm

3. **Clear dismissal behavior**:
   - If user dismisses, document this clearly in the test & in comments
   - Dismissals do NOT persist; user will be re-prompted (by design)

4. **Error logging**:
   - Wrap config update in try/catch; log errors but don't throw
   - Never let this feature crash the extension

---

## VII. File Modifications Summary

### New Files

| File | Purpose |
|------|---------|
| `src/__tests__/extension/defaultViewerPrompt.test.ts` | Test suite for the feature (6+ test cases) |

### Modified Files

| File | Changes |
|------|---------|
| `src/extension.ts` | Add `showDefaultViewerPrompt()` function; call it in `activate()` |

### No Changes Required

- `package.json` — Feature uses no new commands or configurations
- `src/webview/` — No UI changes (uses native VS Code dialog)
- `src/editor/` — No editor logic changes
- Styling — No style changes

---

## VIII. Acceptance Criteria (from Spec)

### Functional

- [x] Detects first-time activation using `globalState`
- [x] Shows blocking modal with "Yes"/"No" buttons
- [x] Updates `markdown.preview.defaultPreviewPane` on "Yes"
- [x] Persists decision in `globalState` for "Yes" and "No" (not dismissals)
- [x] Skips prompt on subsequent activations (checks `globalState`)
- [x] Works across extension updates and reloads

### Quality

- [x] All tests pass (new + existing)
- [x] No regressions
- [x] Activation time remains <500ms
- [x] No new npm dependencies
- [x] Code reviewed and tested

### Success Metrics (from Spec)

- [x] SC-001: Modal appears within 2 seconds of activation
- [x] SC-002: Config set correctly when "Yes"
- [x] SC-003: No config changes on "No" or dismiss
- [x] SC-004: Never re-prompted after Yes/No
- [x] SC-005: May be re-prompted after dismiss (next activation)

---

## IX. Next Steps (for Implementation)

1. **Ready to code**: Everything above assumes TDD workflow
2. **Agent workflow**: 
   - `/speckit.tasks` to break into granular work items
   - `/speckit.implement` to execute each task
3. **Starting point**: Create `src/__tests__/extension/defaultViewerPrompt.test.ts` with failing tests
4. **Progress tracking**: Mark each test case as it passes
5. **Review gate**: Once all green, schedule user code review before merge

---

## Appendix: Reference Links

- [VS Code Extension API: globalState](https://code.visualstudio.com/api/references/vscode-api#ExtensionContext.globalState)
- [VS Code API: showInformationMessage](https://code.visualstudio.com/api/references/vscode-api#window.showInformationMessage)
- [VS Code API: getConfiguration](https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration)
- [Markdown Preview Extension Pane Setting](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/package.json)
