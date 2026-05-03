# Spec 020: File Drag & Drop into Editor

**Status:** Implemented  
**PRD Domains**: `editor-core`, `images`  
**Version:** 2.0.37  
**Date:** April 16, 2026

---

## Problem Statement

The editor already supports dragging image files directly onto the canvas — they are embedded as inline images with a base64 preview while the file is saved to the workspace. However, non-image files (PDFs, Word docs, spreadsheets, ZIPs, audio, video, etc.) are silently ignored on drop.

Users frequently want to attach supporting documents to their notes and want the fastest possible path: **drag the file in, get a markdown link, move on**. Opening a file browser dialog or typing paths manually breaks the writing flow.

---

## Goals

1. Accept **any file type** when dropped onto the editor canvas.
2. Reuse the existing image drop UX — same path configuration dialog, same media folder settings — so there is no new mental model to learn.
3. Save dropped files to the configured workspace media folder (same collision-safe logic as images).
4. Insert markdown links at the drop cursor position as a **bulleted list** — one item per file.
5. Pure image drops remain **completely unchanged** in behaviour.

---

## Non-Goals

- No file-type blocking / whitelisting (accept everything).
- No in-editor preview of non-image files (only a link).
- No paste support for non-image files (paste is images-only; non-image files rarely end up on the clipboard as binary).
- No drag from VS Code Explorer (that path already has its own handler in `fileLinkDrop.ts`).

---

## Drop Modes

### Image Mode (existing, unchanged)
- Triggered when **all** dropped files are images (`image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`).
- Shows the existing "Save X Image(s)" dialog with thumbnail-free path config.
- Inserts inline `![alt](./path)` nodes with a base64 preview while saving.
- Large-image resize dialog (`hugeImageDialog`) still shown when applicable.

### File Mode (new)
- Triggered when **any** dropped file is not an image — even if images are also present.
- All files in the drop (images included) are handled as plain files in this mode.
- Shows the new "Save X File(s)" dialog.
- Files are saved to the media folder and inserted as a bulleted markdown link list at the drop position.

**Rationale for "all or nothing":** splitting a mixed drop into two separate insert operations (inline images + bullet list) at the same cursor position produces confusing output. A single bulleted list for the whole drop is cleaner and predictable.

---

## Dialog — File Mode

The confirmation dialog mirrors the image drop dialog structure exactly. Fields are identical; only labels differ.

| Element | Value |
|---------|-------|
| Title | `📎 Save X File(s)` |
| Body | Scrollable list of filenames with per-type emoji icons |
| Path Base label | `Media Path Base (where to store):` |
| Path label | `Media Path (subfolder name):` |
| Remember checkbox | `Save these settings for next time` |
| Cancel button | `Cancel` |
| Save button | `Save File(s)` / `Save Files` |

### File Icons (by extension)

| Icon | Types |
|------|-------|
| 📄 | pdf |
| 📝 | doc, docx, txt, md |
| 📊 | xls, xlsx, ppt, pptx, csv |
| 📋 | json, xml |
| 🌐 | html, htm |
| 🗜 | zip, tar, gz, rar, 7z |
| 🎵 | mp3, wav |
| 🎬 | mp4, mov, avi, mkv |
| 🖼 | png, jpg, jpeg, gif, svg, webp |
| 📎 | anything else |

### Path Settings

The dialog reads and writes the same session-scoped `mediaPathBase` / `mediaPath` values used by the image drop dialog (`imageConfirmation.ts`). Changing settings in one dialog is reflected in the other within the same session.

**Options for Media Path Base:**

| Option | Meaning |
|--------|---------|
| `sameNameFolder` (default) | Folder with the same name as the document, next to the document |
| `relativeToDocument` | Subfolder of the document's directory |
| `workspaceFolder` | Subfolder of the workspace root |

---

## Inserted Markdown

After all files are saved, a GitHub-Flavored Markdown bulleted list is inserted at the drop cursor position:

```markdown
- [report.pdf](./media/report.pdf)
- [budget.xlsx](./media/budget.xlsx)
- [notes.docx](./media/notes.docx)
```

- Link text = the saved filename (with extension).
- Link href = relative path from the document to the saved file.
- Paths always start with `./` for portability in git repositories.
- Relative paths are computed from the markdown file's directory (not the workspace root).

---

## File Saving

Files are saved via the extension host (Node.js) using VS Code's file system API. The webview cannot write files directly.

### Collision Safety
If a file with the same name already exists in the target folder, a numeric suffix is appended:
- `report.pdf` → `report-2.pdf` → `report-3.pdf` …

This is identical to the collision-safe behaviour for images.

### Transport
File binary data is serialised as a `number[]` (from `Uint8Array`) in the `SAVE_FILES` message. This matches the existing `SAVE_IMAGE` approach and avoids Blob/File object serialisation issues across the webview boundary.

---

## Architecture

### Message Flow

```
[Webview] drop event
    │
    ├── pure images? → existing image flow (SAVE_IMAGE × N)
    │
    └── any non-image? → File mode
          │
          ├── confirmFileDrop(files) → user fills dialog
          │
          ├── encode each file → Uint8Array → number[]
          │
          └── postMessage(SAVE_FILES, { requestId, files[], targetFolder })
                    │
              [Extension: handleSaveFiles()]
                    │
                    ├── resolveMediaTargetFolder()
                    ├── createDirectory()
                    ├── createUniqueTargetFile() × N
                    ├── writeFile() × N
                    └── postMessage(FILES_SAVED, { requestId, savedFiles[] })
                              │
                    [Webview: handleImageMessage()]
                              │
                              └── insertContentAt(pos, <ul>…</ul>)
```

### Message Types

| Constant | Wire value | Direction | Purpose |
|----------|-----------|-----------|---------|
| `SAVE_FILES` | `saveFiles` | webview → extension | Send binary file data + target folder |
| `FILES_SAVED` | `filesSaved` | extension → webview | Return saved relative paths |
| `FILE_SAVE_ERROR` | `fileSaveError` | extension → webview | Report save failure |

### Key Files

| File | Role |
|------|------|
| `src/webview/features/fileDropConfirmation.ts` | Dialog UI for file drops |
| `src/webview/features/imageDragDrop.ts` | Drop routing, `handleFileDrop()`, `FILES_SAVED` message handler |
| `src/editor/handlers/fileHandlers.ts` | `handleSaveFiles()` — copies files, sends paths back |
| `src/shared/messageTypes.ts` | `SAVE_FILES`, `FILES_SAVED`, `FILE_SAVE_ERROR` |

### Drop Routing Logic (imageDragDrop.ts)

```typescript
const allFiles = Array.from(dt.files);
const nonImageFiles = allFiles.filter(f => !isImageFile(f));

if (nonImageFiles.length > 0) {
  e.stopImmediatePropagation(); // prevent fileLinkDrop.ts double-handling
  await handleFileDrop(allFiles, editor, vscodeApi, e);
  return;
}

// fall through to pure-image path (unchanged)
```

`stopImmediatePropagation()` is required because `fileLinkDrop.ts` also listens on the same `drop` event and would otherwise intercept the drop for single non-image files.

### Shared Utilities (no duplication)

`handleSaveFiles()` directly calls the same helpers already used by `handleBrowseLocalFile()` and `handleFileLinkDrop()`:

- `resolveMediaTargetFolder(document, folderName, getConfig)` — honours `mediaPathBase` setting
- `createUniqueTargetFile(dirUri, fileName)` — collision-safe file naming
- `vscode.workspace.fs.writeFile()` — write binary

---

## Session State

Drop position is tracked in a `Map<requestId, insertPos>` (`pendingFileDropPositions`) in the webview, keyed by a randomly generated `requestId`. This mirrors the `pendingImageSaves` Set used for images.

The `requestId` round-trips through the extension in `SAVE_FILES` → `FILES_SAVED` so the correct insertion position is recovered even if multiple drops are in flight simultaneously.

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| User cancels dialog | No files saved, nothing inserted |
| Single non-image file dropped | "Save 1 File" dialog, one bullet link inserted |
| Mixed images + PDFs dropped | File mode for all; images saved as files (no inline preview) |
| File already exists in target folder | Saved as `name-2.ext`, link uses new name |
| Extension cannot determine target directory | Error notification, `FILE_SAVE_ERROR` sent, nothing inserted |
| Drop outside editor (window-level) | `blockWindowDrop` guard prevents VS Code from opening a new window |

---

## Testing

### Manual Test Cases

1. **Single PDF drop** → dialog appears, "Save 1 File", confirm → bullet `- [file.pdf](./media/file.pdf)` at cursor
2. **Multiple non-image files** → "Save 3 Files", all listed with icons, confirm → 3-item bullet list
3. **Mixed drop (image + PDF)** → File mode triggered, image saved as file (not inline), bullet list for both
4. **Pure image drop** → unchanged — image confirmation dialog, inline image inserted
5. **Cancel** → nothing saved or inserted
6. **Duplicate filename** → second save produces `name-2.ext`, both links distinct
7. **Change Media Path Base** → files saved to correct folder, link path reflects new base

### Regression: Pure Image Drop
Verified that dropping `.png` / `.jpg` files still:
- Shows "Save X Image(s)" dialog
- Inserts base64 preview immediately
- Replaces with relative path on `IMAGE_SAVED`
- Triggers `hugeImageDialog` for oversized images

---

## Success Criteria

✅ Any file type accepted on drop  
✅ File mode activated when any non-image is present  
✅ Correct dialog title and button ("File" vs "Files")  
✅ File icons per type in the file list  
✅ Files saved to configured media folder  
✅ Collision-safe naming (no silent overwrites)  
✅ Bulleted markdown link list inserted at drop position  
✅ Relative paths with `./` prefix  
✅ Pure image drops unaffected  
✅ 1023 tests passing (no regressions)  
✅ Build clean (debug + release)  

---

## Related Specifications

- **Spec 016:** Attachment image config — media path base and subfolder settings
- **Spec 019:** HTML `<br>` optimisation — same markdown output discipline
- **Spec 011:** Image AI ask — image handling architecture
