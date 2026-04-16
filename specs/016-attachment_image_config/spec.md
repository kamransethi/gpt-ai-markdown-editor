# Spec 016: Show Image/Attachment Configuration During Paste & Insert

## Business Problem

Users paste images and insert files via the "Insert Link" dialog without seeing which configuration settings control where these attachments will be saved. The system has two important configuration options already available:
- **Media Path Base**: Controls the storage strategy (sameNameFolder, relativeToDocument, workspaceFolder)
- **Media Path**: The subfolder name for media (only used with relativeToDocument or workspaceFolder)

However, users are unaware these settings exist or how they affect file placement, leading to confusion about image destination.

## Success Criteria

1. **Image Paste Dialog** - When pasting images, show:
   - Current `mediaPathBase` setting value
   - Current `mediaPath` setting value (when applicable)
   - Clear explanation of where images will be saved (e.g., "relative to document in 'media' folder")

2. **Insert Link Dialog** - When selecting files via "Browse Local File":
   - Show where the file will be copied (same location info as paste dialog)
   - Display after successful copy confirmation

3. **File Link Drop** - When dragging/dropping files:
   - Show configuration info in the same way as paste dialog
   - Help users understand the target location

4. **User Experience**:
   - Configuration info is always visible, not hidden behind extra clicks
   - Information is concise and easy to understand
   - No disruption to existing workflow

## Implementation Notes

- Configuration fetched from VS Code settings via existing `getConfig()` API
- `getDefaultImagePath()` in `imageConfirmation.ts` already calculates folder
- Update `confirmImageDrop()` dialog to display config details
- Update `handleBrowseLocalFile()` success message to mention config
- Message passed to webview should include config info for consistency

## Design

The image drop/paste dialog should display:
```
📸 Save N Image(s)

Configuration:
  Strategy: [sameNameFolder | relativeToDocument | workspaceFolder]
  Folder: [calculated path or folder name]

Save to folder:
[input field with default]
☐ Remember this choice
```

Example outputs:
- **sameNameFolder**: "📁 Saves to same-name folder next to your document (recommended)"
- **relativeToDocument**: "📁 Saves to document folder → media subfolder" 
- **workspaceFolder**: "📁 Saves to workspace root → media subfolder"

## References

- Configuration: `package.json` lines 150-175
- Paste handler: `src/webview/features/imageDragDrop.ts`
- Image dialog: `src/webview/features/imageConfirmation.ts`
- Insert Link: `src/editor/handlers/fileHandlers.ts` (handleBrowseLocalFile)
- Path resolution: `src/editor/utils/pathUtils.ts` (resolveMediaTargetFolder, getImageStorageBasePath)
