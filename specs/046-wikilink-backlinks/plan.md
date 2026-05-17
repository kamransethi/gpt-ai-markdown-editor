# Implementation Plan: WikiLink Autocomplete & Backlinks

**Spec**: [spec.md](spec.md)  
**Created**: 2026-05-16  
**Status**: Ready to implement

---

## Problem Summary

The `WikiLink` TipTap extension (`src/webview/extensions/wikilink.ts`) is fully written but **never registered** in the editor. As a result:

1. `[[...]]` syntax is not parsed when opening documents — wikilinks appear as plain text
2. Typing `[[` shows no autocomplete dropdown
3. The Backlinks panel shows "No backlinks yet" even when links exist (wikilinks aren't indexed by Foam because they can't be seen as real links)
4. There is no manual reindex command

---

## Architecture

### Data Flow

```
[User types `[[`]
       │
       ▼
WikiLinkSuggest plugin (new)
       │ sends GET_NOTE_LIST to host
       ▼
MarkdownEditorProvider (host)
       │ reads FoamSnapshot.notes[]
       │ sends NOTE_LIST_RESULT back
       ▼
Suggestion dropdown rendered in webview
       │ user selects
       ▼
TipTap inserts WikiLink node → [[Target]] in markdown

[User opens file]
       │
       ▼
READY message sent to host
       │
       ▼
MarkdownEditorProvider sends FOAM_BACKLINKS_UPDATE  ← FIX: add this to READY handler
       │
       ▼
BacklinksSection.tsx renders incoming links
```

### Files to Change

| File | Change |
|------|--------|
| `src/shared/messageTypes.ts` | Add `GET_NOTE_LIST`, `NOTE_LIST_RESULT`, `FOAM_REINDEX` message types |
| `src/webview/extensions/wikilink.ts` | Add `WikiLinkSuggest` extension using `@tiptap/suggestion` |
| `src/webview/editor.ts` | Import + register `WikiLink` and `WikiLinkSuggest`; pass `wikilinkMarkedExtension` to Marked instance |
| `src/editor/MarkdownEditorProvider.ts` | Send `FOAM_BACKLINKS_UPDATE` on READY; handle `GET_NOTE_LIST`; handle `FOAM_REINDEX` |
| `src/features/foam/foamAdapter.ts` | Export `reindexWorkspace()` function for manual refresh |

---

## Implementation Steps

### Step 1 — Add Message Types (`src/shared/messageTypes.ts`)

Add to the `MessageType` constant:

```ts
GET_NOTE_LIST: 'getNoteList',          // Webview → Host: {}
NOTE_LIST_RESULT: 'noteListResult',    // Host → Webview: { notes: { title: string, filename: string, path: string }[] }
FOAM_REINDEX: 'foamReindex',           // Webview → Host: {} (manual trigger)
```

### Step 2 — WikiLinkSuggest Extension (`src/webview/extensions/wikilink.ts`)

Create a `WikiLinkSuggest` TipTap extension using `@tiptap/suggestion`. It:

- Triggers on `[[` (char: `[`, startWith: `[[`)  
- On activate: sends `GET_NOTE_LIST` to host, waits for `NOTE_LIST_RESULT`
- Renders a suggestion list using a positioned `<div>` attached to the body
- On item select: calls `command({ id, label })` which inserts a `WikiLink` node via `insertContent`
- The dropdown is styled with existing CSS vars for consistency

**Note list caching**: Cache the note list in module scope and refresh it when `NOTE_LIST_RESULT` is received. This avoids a round-trip on every keystroke — only one fetch per dropdown open.

Implementation pattern (matches TipTap suggestion API for v3):

```ts
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

export const WikiLinkSuggest = Extension.create({
  name: 'wikilinkSuggest',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '[[',
        pluginKey: new PluginKey('wikilinkSuggest'),
        command({ editor, range, props }) {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'wikilink',
              attrs: { target: props.id, label: null },
            })
            .run();
        },
        items({ query }) {
          return getCachedNoteList()
            .filter(n =>
              n.title.toLowerCase().includes(query.toLowerCase()) ||
              n.filename.toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, 20);
        },
        render() {
          return buildSuggestionRenderer();
        },
      }),
    ];
  },
});
```

The `buildSuggestionRenderer()` creates a simple popup `<div>` with keyboard navigation support (ArrowUp/ArrowDown/Enter/Escape).

### Step 3 — Register in `editor.ts`

1. Import `WikiLink`, `WikiLinkSuggest`, and `wikilinkMarkedExtension` from `./extensions/wikilink`
2. Create the Marked instance with the wikilink extension registered:

```ts
const markedWithWikilinks = new Marked();
markedWithWikilinks.use({ extensions: [wikilinkMarkedExtension] });

// Then in rawExtensions:
Markdown.configure({
  marked: markedWithWikilinks as unknown as typeof markedInstance,
  markedOptions: { gfm: true, breaks: true },
}),
```

3. Add to `rawExtensions` array (before `Markdown`):

```ts
WikiLink,
WikiLinkSuggest,
```

4. Register the `NOTE_LIST_RESULT` message handler to update the cached note list:

```ts
case MessageType.NOTE_LIST_RESULT:
  updateCachedNoteList(message.notes);
  break;
```

### Step 4 — Extension Host: Backlinks on READY + Note List Handler (`MarkdownEditorProvider.ts`)

In the `READY` case, add backlink dispatch after `updateWebview`:

```ts
case MessageType.READY: {
  this.sync.updateWebview(document, webview, true);
  const settings = this.getWebviewSettings();
  webview.postMessage({ type: MessageType.SETTINGS_UPDATE, ...settings });
  void sendSpellInit(webview, this.context);

  // ← NEW: send initial backlinks
  const backlinks = getBacklinks(document.uri.fsPath);
  void webview.postMessage({ type: MessageType.FOAM_BACKLINKS_UPDATE, backlinks });
  break;
}
```

Add new case for note list:

```ts
case MessageType.GET_NOTE_LIST: {
  const snapshot = getFoamSnapshot();
  const notes = (snapshot?.notes ?? []).map(n => ({
    title: n.title,
    filename: n.filename,
    path: n.path,
  }));
  void webview.postMessage({ type: MessageType.NOTE_LIST_RESULT, notes });
  break;
}
```

Add reindex case:

```ts
case MessageType.FOAM_REINDEX: {
  await reindexWorkspace();
  const backlinks = getBacklinks(document.uri.fsPath);
  void webview.postMessage({ type: MessageType.FOAM_BACKLINKS_UPDATE, backlinks });
  break;
}
```

### Step 5 — `reindexWorkspace()` in `foamAdapter.ts`

Export a function that rebuilds the snapshot without resetting the watcher:

```ts
export async function reindexWorkspace(): Promise<void> {
  if (!_snapshot) return; // not yet initialized
  const includeGlobs = ['**/*.md'];
  const excludeGlobs = ['**/node_modules/**', '**/.git/**'];
  _snapshot = await buildSnapshot(includeGlobs, excludeGlobs);
}
```

---

## CSS — Wikilink Styling

Add to `src/webview/editor.css`:

```css
/* WikiLink nodes */
.wikilink {
  color: var(--vscode-textLink-foreground);
  text-decoration: none;
  cursor: pointer;
  border-bottom: 1px dashed var(--vscode-textLink-foreground);
}
.wikilink:hover {
  text-decoration: underline;
}
```

And for the suggestion dropdown:

```css
/* WikiLink suggestion dropdown */
.wikilink-dropdown {
  position: absolute;
  z-index: 1000;
  background: var(--vscode-dropdown-background);
  border: 1px solid var(--vscode-widget-border);
  border-radius: 4px;
  max-height: 240px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.wikilink-dropdown-item {
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--vscode-foreground);
}
.wikilink-dropdown-item.selected,
.wikilink-dropdown-item:hover {
  background: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}
.wikilink-dropdown-empty {
  padding: 8px 12px;
  color: var(--vscode-disabledForeground);
  font-style: italic;
}
```

---

## Testing Plan

### Playwright Tests (`src/__tests__/playwright/`)

Create `tests/wikilink/wikilink-autocomplete.spec.ts`:

- **Test 1**: Type `[[` → dropdown appears
- **Test 2**: Type `[[Note` → dropdown filters
- **Test 3**: Press Escape → dropdown closes, no insertion
- **Test 4**: Select item from dropdown → `[[NoteTitle]]` inserted
- **Test 5**: Open file with `[[Target]]` → renders as `.wikilink` element
- **Test 6**: Backlinks appear on file open (no tab switch needed)
- **Test 7**: Round-trip: save file with wikilink → verify `[[...]]` preserved
- **Test 8**: Reindex command → new note appears in dropdown

### Unit Tests

No new unit tests required — the TipTap extension behavior is covered by Playwright tests. `foamAdapter.ts`'s `reindexWorkspace` function is a thin wrapper and is covered by the existing adapter tests.

---

## Risk / Notes

- **`@tiptap/suggestion` v3 API**: The API for `Suggestion` from `@tiptap/suggestion` in TipTap 3.x uses a `render()` function that returns `{ onStart, onUpdate, onKeyDown, onExit }`. This is the same as v2 but ensure imports are from `@tiptap/suggestion` (already installed at `^3.23.2`).
- **Marked instance isolation**: The existing comment in `editor.ts` explains why a fresh `Marked` instance is used. We must call `.use()` on that same instance, not on the global `marked` singleton.
- **Backlinks on first load**: Currently backlinks are only sent on `onDidChangeViewState` (tab activate). Adding to `READY` handler fixes first-load population.
