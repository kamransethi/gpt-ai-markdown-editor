# Plan 016: Show Image/Attachment Configuration During Paste & Insert

## Overview
Enhance image paste/drop dialog to show and allow editing both configuration options (mediaPathBase and mediaPath) with persistent storage to VS Code settings.

## Implementation Steps

### 1. Update imageConfirmation.ts
- Add session storage for mediaPathBase and mediaPath
- Update `confirmImageDrop()` to:
  - Show dropdown for mediaPathBase selection
  - Show text input for mediaPath customization
  - Display current values preselected
  - Return mediaPathBase and mediaPath in options
  - Apply consistent sans-serif font throughout
  - Add checkbox "Save these settings for next time"

### 2. Update imageDragDrop.ts
- Handle new mediaPathBase and mediaPath fields from confirmImageDrop
- Send UPDATE_SETTING messages when user checks "Save these settings"
- Send separate messages for each setting (mediaPathBase, mediaPath)
- Include proper gptAiMarkdownEditor config keys

### 3. Update fileHandlers.ts
- Already updated in previous commit to show config in success message
- Message format: "Copied to [location] (Media Path Base: [strategy])"

### 4. Add Tests
- Import new session config functions in test file
- Add tests for getSessionMediaPathBase(), setSessionMediaPathBase()
- Add tests for getSessionMediaPath(), setSessionMediaPath()
- Tests verify storage, retrieval, and multiple values

### 5. Update Spec
- Document both configuration options in dialog
- Explain persistent storage behavior
- Include font standardization requirement

## Files Modified
1. `src/webview/features/imageConfirmation.ts` - Main dialog enhancements
2. `src/webview/features/imageDragDrop.ts` - Config change handling
3. `src/__tests__/webview/imageConfirmation.test.ts` - New tests
4. `specs/016-attachment_image_config/spec.md` - Updated spec

## UI Improvements
- Consistent sans-serif fonts: `system-ui, -apple-system, 'Segoe UI', sans-serif`
- Configuration box with highlighted background
- Clear labels for each configuration option
- Font sizes and weights consistent across all elements

## Testing
✅ Build completes successfully
✅ All tests pass (22 passed, 25 todo)
✅ No regressions
