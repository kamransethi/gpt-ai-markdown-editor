# Quick Bug Spec: Default Markdown Viewer Prompt Not Persisting

**Ticket**: 006-BUG-viewer-prompt-persistence  
**Severity**: High  
**Status**: Draft  
**Created**: 2026-04-11

## Problem Statement

The Default Markdown Viewer Prompt feature was added in v2.0.26 to allow users to set a default markdown viewer option. However, when users select "Yes" to make their choice the default, **two failures occur**: (1) The preference is not saved to VS Code settings, so the prompt appears on every file open, and (2) Even if the editor is selected, it does not become the default viewer for markdown files — the setting is not applied.

---

## Clarifications

### Session 2026-04-11

- Q: Editor is not becoming default even when user chooses to make it default. 
  → A: **Confirmed**: Two separate failures — (1) preference not saved, (2) even if saved, editor not applied as default viewer.

- Q: What should "default markdown viewer" mean when user selects "Yes"?
  → A: **Option B (Internal Preference)**: Store preference internally in extension settings (`gptAiMarkdownEditor.defaultMarkdownViewer`). When opening a markdown file, automatically use DK-AI editor if available. Does NOT modify VS Code's global default – keeps user's VS Code settings unchanged.

---

## Reproduction Steps

1. Open a markdown file in VS Code with the DK-AI Markdown Editor extension
2. Trigger the "Default Markdown Viewer Prompt" (appears on first markdown file open or via command palette)
3. Select "Yes" to make this the default choice
4. Close the file and open another markdown file
5. Observe: The prompt appears again instead of using the saved default

**Observable behavior**: Prompt appears repeatedly; user choice not remembered  
**Expected behavior**: After user selects "Yes" to make default, prompt should not appear again. Subsequent files should use the saved preference.

---

## Acceptance Criteria

- [ ] User's default markdown viewer choice is persisted to extension storage
- [ ] Prompt does NOT appear on subsequent markdown file opens when default is set
- [ ] When default is set to DK-AI, markdown files automatically open with DK-AI editor
- [ ] When default is set to DK-AI, the DK-AI editor becomes the active editor (not just custom editor, but actual default)
- [ ] Default preference is stored in `gptAiMarkdownEditor.defaultMarkdownViewer` setting
- [ ] Changing default works correctly (user can override previously saved choice)
- [ ] All 828 tests pass
- [ ] No performance regression

---

## Technical Context

**Related feature**: Default Markdown Viewer Prompt (implemented in v2.0.26)  
**Root causes** (two separate issues):
  1. Preference is not being saved to extension settings (missing persistence call)
  2. Even if saved, the default is not being applied when opening markdown files (missing application logic)

**Files likely involved**:
- `src/features/defaultViewerPrompt.ts` (if exists) or similar handler — where user choice is handled but not persisted
- `src/extension.ts` (command registration, setting up the default) — missing logic to apply the default
- `MarkdownEditorProvider.ts` (provider logic) — needs to check default when opening markdown files
- `activeWebview.ts` (webview communication) — message passing for default setting

---

## Notes for LLM

**Fix 1 - Persistence**: 
- When user selects "Yes" in the prompt, save to extension settings via `vscode.workspace.getConfiguration().update('gptAiMarkdownEditor.defaultMarkdownViewer', userChoice, true)`
- Ensure persistence completes BEFORE prompt is dismissed (not async without await)

**Fix 2 - Application**:
- When opening a markdown file via MarkdownEditorProvider, check if `gptAiMarkdownEditor.defaultMarkdownViewer` setting exists
- If set to DK-AI, ensure this editor handles the file (force activation or routing logic)
- Verify that subsequent markdown files automatically use the saved default WITHOUT showing the prompt

**Testing**:
- Unit test: Mock settings API, verify `update()` is called with correct parameters
- Integration test: Set default, close/open file, verify DK-AI editor is used and prompt doesn't appear
- Edge case: Change default from one option to another
- Verify all 828 tests still pass

**Constraints**:
- Must not break existing markdown viewer behavior
- Must not modify VS Code's global default (only extension-internal setting)
- Performance: Setting/retrieving preference must be <5ms

---

## Testing Strategy

1. **Unit test**: Mock VS Code settings API and verify `update()` is called with correct parameters
2. **Integration test**: Simulate user selecting default, close/open new file, verify prompt doesn't appear
3. **Edge case**: Test changing default (user previously set A, now wants B)
4. **Regression**: Verify all existing tests still pass

---

## Success Metrics

✅ When user selects "Yes" to make default, prompt is dismissed  
✅ Subsequent markdown file opens use saved default without prompting  
✅ User can override default by accessing the prompt again (via command or settings)  
✅ Zero disruption to existing markdown viewer workflow
