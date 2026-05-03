# Spec 016: Show Image/Attachment Configuration During Paste & Insert

**PRD Domains**: `images`, `configuration`

## Business Problem

Users paste images and insert files via the "Insert Link" dialog without seeing which configuration settings control where these attachments will be saved. The system has two important configuration options already available:
- **Media Path Base**: Controls the storage strategy (sameNameFolder, relativeToDocument, workspaceFolder)
- **Media Path**: The subfolder name for media (only used with relativeToDocument or workspaceFolder)

However, users are unaware these settings exist or how they affect file placement, and cannot easily change them. This leads to confusion about image destination and inability to customize behavior for specific documents.

## Success Criteria

1. **Configuration UI in Paste Dialog** - When pasting images, show:
   - Dropdown to select `mediaPathBase` (with current value preselected)
   - Text input to customize `mediaPath` (with current value preselected)
   - Clear label explaining what each option does
   - Consistent sans-serif fonts throughout

2. **Persistent Settings** - User can:
   - Change configuration options directly in the dialog
   - Check "Save these settings for next time" to persist changes
   - Settings are saved to VS Code configuration (global settings)
   - Settings are preselected on next dialog opening

3. **Insert Link Dialog** - Show configuration context:
   - Display where file is being copied via info message
   - Include Media Path Base strategy in the message

4. **File Link Drop** - Same configuration display as paste dialog

5. **User Experience**:
   - Both configuration options always visible (not hidden)
   - Configuration information is concise and understandable
   - Dialog has consistent sans-serif fonts (all UI elements match)
   - No disruption to existing workflow
   - Session storage: remembers settings for current session
   - Persistent storage: saves to VS Code when "Save" checkbox is checked

## Implementation Notes

- Dialog shows both `mediaPathBase` (dropdown) and `mediaPath` (text input)
- Current settings fetched from window properties and session storage
- Session storage allows changes without affecting global settings
- When "Save these settings" is checked, settings update via `UPDATE_SETTING` messages
- Font standardization: Use `system-ui, -apple-system, 'Segoe UI', sans-serif` throughout
- Tests include new functions: `getSessionMediaPathBase()`, `setSessionMediaPathBase()`, `getSessionMediaPath()`, `setSessionMediaPath()`

## Design

The image drop/paste dialog displays:

```
📸 Save N Image(s)

┌─ Configuration (highlighted box) ─┐
│ Media Path Base (where to store):  │
│ [Dropdown with 3 options]          │
│ "Used to determine storage..."     │
│                                     │
│ Media Path (subfolder name):       │
│ [Text input field]                 │
│ "Used only with relative options" │
└─────────────────────────────────────┘

Save to folder (override):
[Text input: e.g., images]

☐ Save these settings for next time

[Cancel] [Save Images]
```

Options in mediaPathBase dropdown:
- "Same-name folder (next to document) - Recommended" (value: sameNameFolder)
- "Relative to document folder" (value: relativeToDocument)  
- "Relative to workspace root" (value: workspaceFolder)

## References

- Configuration: `package.json` lines 150-175
- Paste handler: `src/webview/features/imageDragDrop.ts`
- Image dialog: `src/webview/features/imageConfirmation.ts`
- Insert Link: `src/editor/handlers/fileHandlers.ts` (handleBrowseLocalFile)
- Path resolution: `src/editor/utils/pathUtils.ts`
- Message types: `src/shared/messageTypes.ts` (UPDATE_SETTING)

