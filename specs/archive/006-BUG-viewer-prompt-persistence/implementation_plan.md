# Implementation Plan: Default Markdown Viewer Prompt Persistence

**Spec**: 006-BUG-viewer-prompt-persistence  
**Status**: Ready for Code Implementation  
**Created**: 2026-04-11

---

## 1. Analysis Summary

### Problem
Two failures when user selects "Yes" to make DK-AI the default markdown viewer:
1. **Persistence**: Choice is not saved to extension settings (prompt appears every time)
2. **Application**: Even if saved, the default is not applied (markdown files don't auto-open with DK-AI)

### Root Causes
- Missing `vscode.workspace.getConfiguration().update()` call in prompt handler (persistence layer)
- Missing logic in `MarkdownEditorProvider` to check and apply the saved default (application layer)

### Impact
- Users cannot set a default markdown viewer
- Feature from v2.0.26 is broken, making the extension less user-friendly

---

## 2. Architecture Approach

### Data Flow (After Fix)

```
User selects "Yes" in prompt
        ↓
Webview sends message to extension
        ↓
Extension persists to settings: 
  gptAiMarkdownEditor.defaultMarkdownViewer = "dk-ai"
        ↓
User opens new markdown file
        ↓
MarkdownEditorProvider checks settings
        ↓
IF default = "dk-ai" THEN use DK-AI editor
        ↓
File opens with DK-AI (NO prompt appears)
```

### Storage Strategy
- **Setting Key**: `gptAiMarkdownEditor.defaultMarkdownViewer`
- **Possible Values**: `"dk-ai"`, `"vscode"`, `null` (not set)
- **Scope**: Global (user preference applies across all workspaces)

---

## 3. Files to Modify

| File | Change | Reason |
|------|--------|--------|
| `src/features/defaultViewerPrompt.ts` | Add persistence on "Yes" → save to settings | Persistence layer |
| `src/extension.ts` | Handle message from prompt, call settings update | Message routing |
| `src/editor/MarkdownEditorProvider.ts` | Check saved default before opening file | Application layer |
| `package.json` | Define config schema for `defaultMarkdownViewer` | Settings registration |
| `src/__tests__/extension/defaultViewerPrompt.test.ts` | Add tests for persistence + application | Test coverage |

---

## 4. Task Breakdown

### Phase 1: Define Settings Schema (1 hour)

**Task 1.1**: Update `package.json` to register the setting

```json
{
  "contributes": {
    "configuration": [
      {
        "title": "DK-AI Markdown Editor",
        "properties": {
          "gptAiMarkdownEditor.defaultMarkdownViewer": {
            "type": "string",
            "enum": ["dk-ai", "vscode"],
            "default": null,
            "description": "Default markdown viewer preference",
            "scope": "window"
          }
        }
      }
    ]
  }
}
```

**Acceptance**: 
- Setting registered in VS Code
- Users can view/change in Settings UI
- Default is `null` (not set)

---

### Phase 2: Add Persistence Layer (2 hours)

**Task 2.1**: Update `src/features/defaultViewerPrompt.ts` to save choice

Current flow (broken):
```typescript
// Somewhere in prompt handler
if (userSelectedYes) {
  // Currently just dismisses prompt (no persistence)
}
```

Fixed flow:
```typescript
if (userSelectedYes) {
  // Persist to settings
  await vscode.workspace.getConfiguration().update(
    'gptAiMarkdownEditor.defaultMarkdownViewer',
    'dk-ai',
    vscode.ConfigurationTarget.Global
  );
  // Then dismiss
}
```

**Acceptance**:
- When user clicks "Yes", setting is saved
- `getConfiguration('gptAiMarkdownEditor.defaultMarkdownViewer')` returns `'dk-ai'`
- Persists across editor restarts

**Task 2.2**: Add test for persistence

```typescript
test('should persist default viewer choice to settings', async () => {
  // Mock settings API
  mockGetConfiguration().update.expect('gptAiMarkdownEditor.defaultMarkdownViewer', 'dk-ai');
  
  // Simulate user clicking "Yes"
  handlePromptResponse('yes');
  
  // Verify update was called
  expect(mockGetConfiguration().update).toHaveBeenCalledWith(
    'gptAiMarkdownEditor.defaultMarkdownViewer',
    'dk-ai',
    ConfigurationTarget.Global
  );
});
```

---

### Phase 3: Add Application Layer (2 hours)

**Task 3.1**: Update `MarkdownEditorProvider.ts` to apply the default

Location: Where markdown files are opened/routed to an editor

Before (broken):
```typescript
// In MarkdownEditorProvider
openCustomDocument(uri, openContext, token) {
  // Opens file, but always shows prompt regardless of setting
}
```

After (fixed):
```typescript
// Check stored default first
const defaultViewer = vscode.workspace.getConfiguration()
  .get('gptAiMarkdownEditor.defaultMarkdownViewer');

if (defaultViewer === 'dk-ai') {
  // Use DK-AI editor (don't show prompt)
  return this.openWithDkAi(uri);
} else if (defaultViewer === 'vscode') {
  // Use VS Code default (don't open custom editor)
  return this.openWithVsCode(uri);
} else {
  // Not set, show prompt
  return this.showPromptAndDecide(uri);
}
```

**Acceptance**:
- When default is "dk-ai", markdown files open with DK-AI
- No prompt appears
- When default is "vscode", files use VS Code default (not custom editor)
- When default is `null`, prompt appears

**Task 3.2**: Add test for application

```typescript
test('should use saved default when opening markdown file', async () => {
  // Set default to 'dk-ai'
  mockGetConfiguration().get.return('dk-ai');
  
  // Open markdown file
  const provider = new MarkdownEditorProvider();
  await provider.openCustomDocument(uri);
  
  // Verify DK-AI editor was used (not prompt)
  expect(showPromptCalled).toBe(false);
  expect(dkAiEditorUsed).toBe(true);
});
```

---

### Phase 4: Integration & Edge Cases (1 hour)

**Task 4.1**: Handle changing the default

Scenario: User had default="dk-ai", wants to change to "vscode"
- When user changes setting in VS Code Settings UI, should immediately apply to new files
- Previous files in DK-AI editor stay open (no disruption)

Test:
```typescript
test('should apply new default on subsequent file opens', async () => {
  // Set default to 'dk-ai', open file
  setDefault('dk-ai');
  openMarkdownFile(); // Opens with DK-AI
  
  // Change default to 'vscode'
  setDefault('vscode');
  
  // Open new file
  openNewMarkdownFile(); // Should open with VS Code default
});
```

**Task 4.2**: Edge case - setting is corrupted or has invalid value

```typescript
const defaultViewer = vscode.workspace.getConfiguration()
  .get('gptAiMarkdownEditor.defaultMarkdownViewer');

// Only accept known values
if (!['dk-ai', 'vscode'].includes(defaultViewer)) {
  // Fall back to prompt if invalid
  return this.showPromptAndDecide(uri);
}
```

---

## 5. Testing Strategy

### Test Cases

1. **Persistence Tests** (unit)
   - ✅ User clicks "Yes" → setting saved
   - ✅ User clicks "No" → setting not saved
   - ✅ Persisted value survives editor restart

2. **Application Tests** (integration)
   - ✅ Default = "dk-ai" → file opens with DK-AI, no prompt
   - ✅ Default = "vscode" → file opens with VS Code, no custom editor
   - ✅ Default = null → prompt appears

3. **Changing Default Tests**
   - ✅ Change from "dk-ai" to "vscode" → new files use new default
   - ✅ Change from null to "dk-ai" → new files use DK-AI

4. **Edge Cases**
   - ✅ Invalid setting value → fall back to prompt
   - ✅ Both settings missing → show prompt
   - ✅ Concurrent file opens with different defaults

5. **Regression Tests**
   - ✅ All 828 existing tests pass
   - ✅ No performance degradation (<16ms for file open)

### Test Files
- `src/__tests__/extension/defaultViewerPrompt.test.ts` (persistence)
- `src/__tests__/editor/MarkdownEditorProvider.test.ts` (application)
- Updated: `src/__tests__/webview/` (if webview involved)

---

## 6. Implementation Workflow (TDD)

### Step 1: Write failing tests
```bash
npm test -- defaultViewerPrompt.test.ts
# Expected: FAIL (methods don't exist yet)
```

### Step 2: Implement persistence layer
- Add `updateDefaultViewer()` function
- Call from prompt handler on "Yes"
- Tests for persistence pass ✅

### Step 3: Write application tests
```bash
npm test -- MarkdownEditorProvider.test.ts
# Expected: FAIL (logic doesn't exist yet)
```

### Step 4: Implement application layer
- Add default check in `MarkdownEditorProvider`
- Route based on saved default
- Tests for application pass ✅

### Step 5: Run full test suite
```bash
npm test
# Expected: All 828 tests pass ✅
```

---

## 7. Success Criteria

✅ When user selects "Yes", preference is saved to extension settings  
✅ Subsequent markdown file opens automatically use the saved default  
✅ Prompt does NOT appear when default is set  
✅ User can change default (and it takes effect immediately)  
✅ Invalid settings fall back to prompt  
✅ All 828 tests pass  
✅ No performance regression (<16ms file open time)  
✅ Feature is intuitive (no hidden behavior)

---

## 8. Estimated Effort

| Phase | Effort | Status |
|-------|--------|--------|
| Phase 1: Settings Schema | 1 hour | Ready |
| Phase 2: Persistence Layer | 2 hours | Ready |
| Phase 3: Application Layer | 2 hours | Ready |
| Phase 4: Integration & Edge Cases | 1 hour | Ready |
| **Total** | **6 hours** | Ready for code |

---

## 9. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Settings API changes between VS Code versions | Low | Medium | Use stable API, test with min supported version |
| Performance regression on file open | Low | High | Benchmark before/after, settings lookup should be <1ms |
| Users confused by behavior change | Low | Medium | Clear documentation, intuitive defaults |
| Existing tests break | Low | High | Run full test suite after each phase |

---

## 10. Ready for Code

✅ **All ambiguities resolved**  
✅ **Architecture defined**  
✅ **Tasks broken down into phases**  
✅ **Testing strategy clear**  

**Next step**: LLM writes code (TDD: tests first, then implementation)  
**Status**: READY FOR IMPLEMENTATION
