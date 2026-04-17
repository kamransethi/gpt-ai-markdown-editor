# Spec 021 — Double-Click `.drawio.svg` Images to Open in Draw.io

## Problem

Embedded `.drawio.svg` diagrams are displayed as images in the editor. There is no quick way to open one for editing; the user has to switch to the file explorer and double-click from there.

## Goal

Double-clicking a `.drawio.svg` image inside the editor should open the underlying file for editing, using whatever VS Code has registered as the default handler for that file type (typically the Draw.io Integration extension when installed, or the built-in SVG/text viewer otherwise).

## Success Criteria

- Double-clicking any displayed image whose name ends with `.drawio.svg` opens the file via `vscode.open`.
- Single-click behaviour (node selection) is unchanged.
- If the Draw.io Integration extension (`hediet.vscode-drawio`) is installed, the file opens in the diagram editor — identical to opening from the VS Code file explorer.
- If the extension is not installed, VS Code falls back to its default handler (SVG preview or text editor) without showing an error — consistent with standard VS Code file opening behaviour.
- Only local/relative paths are handled; `http://`, `https://`, and `data:` URLs are ignored.

## Behaviour

| Condition | Result |
|-----------|--------|
| `.drawio.svg`, Draw.io extension installed | Opens in Draw.io diagram editor |
| `.drawio.svg`, Draw.io extension not installed | Opens with VS Code default (SVG/text viewer) |
| `.drawio.svg`, external URL (`http://…`) | No action |
| Any other image type | No action |

## Implementation

### Webview side — `src/webview/extensions/customImage.ts`

A `dblclick` listener is added to the image `wrapper` element inside the TipTap custom node view. On fire:

1. Read `markdown-src` attribute (the original relative path from the markdown source). Fall back to `src` attribute if absent.
2. Skip if the path starts with `http://`, `https://`, or `data:`.
3. Skip if the path does not end with `.drawio.svg` (case-insensitive).
4. Post `{ type: MessageType.OPEN_DRAWIO_FILE, path: rawSrc }` to the extension host via `vscodeApi.postMessage`.

`e.preventDefault()` and `e.stopPropagation()` are called only after the path is confirmed to be a valid local `.drawio.svg` path, so normal click/selection handling for other images is unaffected.

### Extension host — `src/editor/handlers/fileHandlers.ts`

`handleOpenDrawioFile` is registered for `MessageType.OPEN_DRAWIO_FILE`. It:

1. Normalises the relative path (strips leading `./`).
2. Resolves to an absolute path relative to the current document's directory.
3. Verifies the file exists via `vscode.workspace.fs.stat`; on failure retries from workspace root.
4. Calls `vscode.commands.executeCommand('vscode.open', uri)` — VS Code routes to the registered custom editor for `.drawio.svg` automatically.

### Message type — `src/shared/messageTypes.ts`

```
OPEN_DRAWIO_FILE: 'openDrawioFile'
```

## Design Decisions

- **`vscode.open` not `vscode.openWith`** — `vscode.openWith(uri, 'hediet.vscode-drawio')` causes a blank editor because the Draw.io extension's internal custom editor view type differs from its package ID. `vscode.open` lets VS Code use the registered mapping, matching file-explorer behaviour.
- **No install-gating** — The extension does not check whether Draw.io is installed before opening. If it is, the diagram editor appears; if not, VS Code's fallback is perfectly usable. This keeps the code simple and avoids an unnecessary round-trip to `vscode.extensions.getExtension`.
- **`markdown-src` as source of truth** — The `src` attribute on the TipTap image node holds a webview-resolved URI (e.g., a `vscode-webview-resource:` blob), not the original relative path. `markdown-src` preserves the path as written in the markdown file and is the correct value to send to the extension host for resolution.
