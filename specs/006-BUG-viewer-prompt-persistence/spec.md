# Quick Bug Spec: Default Markdown Viewer Prompt Not Persisting

**Ticket**: 006-BUG-viewer-prompt-persistence  
**Severity**: High  
**Status**: Draft  
**Created**: 2026-04-11

## Problem Statement

The Default Markdown Viewer Prompt feature was added in v2.0.26 to allow users to set a default markdown viewer option. However, when users select "Yes" to make their choice the default, the preference is not saved. The prompt appears on every file open, ignoring the user's previous selection.

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

- [ ] User's default markdown viewer choice is persisted to VS Code settings
- [ ] Prompt does NOT appear on subsequent markdown file opens when default is set
- [ ] Prompt ONLY appears on first markdown file open (or if user hasn't set default)
- [ ] Default preference is stored in `gptAiMarkdownEditor.defaultMarkdownViewer` setting
- [ ] Changing default works correctly (user can override previously saved choice)
- [ ] All 828 tests pass
- [ ] No performance regression

---

## Technical Context

**Related feature**: Default Markdown Viewer Prompt (implemented in v2.0.26)  
**Suspected root cause**: Preference is not being saved to VS Code settings via `vscode.workspace.getConfiguration().update()` or equivalent persistence mechanism

**Files likely involved**:
- `src/features/defaultViewerPrompt.ts` (if exists) or similar handler
- `src/extension.ts` (command registration and execution)
- `activeWebview.ts` (webview communication)
- `MarkdownEditorProvider.ts` (provider logic)

---

## Notes for LLM

- **State management**: Check if the prompt choice is being saved to VS Code workspace settings
- **Persistence layer**: Verify `vscode.workspace.getConfiguration().update()` is called with correct scope (global vs workspace)
- **Message payload**: Check webview-to-extension message payload includes the user's choice
- **Timing**: Ensure persistence happens BEFORE prompt is dismissed (not async race condition)
- **Constraint**: Must not break existing default viewer behavior

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
