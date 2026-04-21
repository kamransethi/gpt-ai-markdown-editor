# Fix: Git Diff View Broken When Extension Is Set as Default Editor

## Problem

When **Markdown for Humans** is set as the default editor for `.md` files, opening a Markdown file from the VS Code Source Control (Git) sidebar no longer shows the standard line-by-line diff. Instead, both panes render the full WYSIWYG Markdown view — making it impossible to review changes effectively.

---

## Root Causes

### 1. `CustomTextEditorProvider` cannot participate in VS Code’s diff editor

VS Code’s Git diff editor is a native text diff widget that requires **two plain text documents** — one per pane. A `CustomTextEditorProvider` creates an independent webview panel. It cannot be slotted into either pane of a diff editor. When VS Code routes a `.md` file through our custom editor during a diff, it renders the full WYSIWYG view in place of the expected text comparison.

### 2. `workbench.editorAssociations` overrides the `package.json` scheme filter

`package.json` correctly restricts the custom editor selector to `file://` and `untitled://` URI schemes only:

```json
"selector": [
  { "filenamePattern": "*.md", "scheme": "file" },
  { "filenamePattern": "*.md", "scheme": "untitled" }
]
```

However, when a user clicks **"Set as Default Editor"**, VS Code writes the following into user settings:

```json
"workbench.editorAssociations": {
  "*.md": "markdownForHumans.editor"
}
```

This glob pattern has **no scheme constraint** and silently overrides the `package.json` filter — causing VS Code to route `git://` URIs (the "original" left pane of the diff) through our editor too.

### 3. `resolveCustomTextEditor` has no context guards

`src/editor/MarkdownEditorProvider.ts` — the method `resolveCustomTextEditor` — assumes every invocation is for a regular, editable file. It never checks:

- Whether `document.uri.scheme` is `git`, `vscode-git`, or another read-only scheme.
- Whether the document is currently being displayed as part of a diff tab (detectable via `vscode.window.tabGroups` + `vscode.TabInputTextDiff`).

### 4. `supportsMultipleEditorsPerDocument: false` blocks graceful fallback

With this registration option, VS Code can only maintain one custom editor instance per document. This prevents VS Code from simultaneously rendering the custom editor AND the built-in diff editor for the same file — so VS Code degrades to showing both diff panes as rendered Markdown instead of a proper diff.

---

## Fix Plan

### Files to Modify

| File | Change |
|------|--------|
| `src/editor/MarkdownEditorProvider.ts` | Add URI scheme guard + diff-tab guard at the top of `resolveCustomTextEditor`; add `getFallbackDiffHtml()` private helper; handle new `openWithTextEditor` webview message in `handleWebviewMessage` |

### Step-by-step Approach

#### Step 1 — URI scheme guard (top of `resolveCustomTextEditor`)

Reject any URI scheme that is not `file` or `untitled`. Render a fallback webview:

```typescript
const SUPPORTED_SCHEMES = new Set([‘file’, ‘untitled’]);
if (!SUPPORTED_SCHEMES.has(document.uri.scheme)) {
  webviewPanel.webview.html = this.getFallbackDiffHtml(
    ‘This file is from a read-only source (scheme: ‘ + document.uri.scheme + ‘).’,
    document.uri
  );
  return;
}
```

#### Step 2 — Diff-tab context guard (immediately after scheme guard)

Use `vscode.window.tabGroups` to detect if the document is part of an active diff tab:

```typescript
const isDiffTab = vscode.window.tabGroups.all.some(group =>
  group.tabs.some(tab => {
    const input = tab.input;
    if (input instanceof vscode.TabInputTextDiff) {
      const docStr = document.uri.toString();
      return (
        input.modified.toString() === docStr ||
        input.original.toString() === docStr
      );
    }
    return false;
  })
);

if (isDiffTab) {
  webviewPanel.webview.html = this.getFallbackDiffHtml(
    ‘Git Diff view is not supported in the Markdown for Humans visual editor.’,
    document.uri
  );
  return;
}
```

#### Step 3 — `getFallbackDiffHtml()` private helper

Minimal VS Code-themed HTML with an "Open in Text Editor" button. The button posts `{ type: ‘openWithTextEditor’, uri }` to the extension host.

#### Step 4 — Handle `openWithTextEditor` message in `handleWebviewMessage`

```typescript
case ‘openWithTextEditor’: {
  const targetUri = vscode.Uri.parse(e.uri as string);
  await vscode.commands.executeCommand(‘vscode.openWith’, targetUri, ‘default’);
  break;
}
```

### Expected Outcome

| Scenario | Before fix | After fix |
|----------|-----------|-----------|
| Open `.md` diff from Source Control sidebar | Both panes show rendered Markdown (broken) | Standard line-by-line text diff |
| Open `.md` file normally from Explorer | WYSIWYG editor | WYSIWYG editor (unchanged) |
| `git://` URI routed to custom editor via `workbench.editorAssociations` | Broken WYSIWYG in diff pane | Fallback webview with "Open in Text Editor" button |

---

## Verification Plan

### Manual Verification
1. Set the extension as the default `.md` editor (right-click → Open With → Configure Default Editor).
2. Modify a committed `.md` file.
3. Open **Source Control** sidebar → click the file under **Changes**.
4. **Expected:** Standard side-by-side text diff with line-level highlighting appears. No WYSIWYG rendering in either pane.
5. If the fallback webview does appear, click "Open in Text Editor" — it should open the file in VS Code’s built-in text editor.

### Regression Check
- Open any `.md` file from the Explorer — WYSIWYG editor must still load normally.

### Compile Check
```bash
npm run compile
npm run lint
```
Expected: zero errors, zero warnings.
