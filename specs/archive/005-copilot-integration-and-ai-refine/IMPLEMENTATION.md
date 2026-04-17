# Implementation: Copilot Integration & AI Refine Improvements

**Related Spec**: [spec.md](spec.md)  
**Date Implemented**: April 11, 2026  
**Status**: All 5 items complete ✅

---

## BUG-I: File Not Exposed to GitHub Copilot Chat

### Architecture Overview

Added document URI tracking layer to expose active custom editor context to Copilot.

```
VS Code Extension
├── MarkdownEditorProvider
│   └── SELECTION_CHANGE message → setActiveDocumentUri()
├── activeWebview.ts (NEW)
│   ├── setActiveDocumentUri() [exported]
│   └── getActiveDocumentUri() [exported]
└── extension.ts (ENHANCED)
    ├── getActiveDocumentUri command (NEW)
    └── Chat participant uses getActiveDocumentUri()
```

### Files Modified

**1. `src/activeWebview.ts` - Document URI Tracking Module**

```typescript
let activeDocumentUri: vscode.Uri | undefined;

export function setActiveDocumentUri(uri: vscode.Uri | undefined) {
  activeDocumentUri = uri;
}

export function getActiveDocumentUri(): vscode.Uri | undefined {
  return activeDocumentUri;
}
```

**2. `src/editor/MarkdownEditorProvider.ts` - Call Tracking**

In `resolveCustomTextEditor()` method (around line 285):
```typescript
// Track active panel
setActiveWebviewPanel(webviewPanel);
setActiveDocumentUri(document.uri);  // ← NEW: Track document URI
```

In `onDidChangeViewState()` handler (around line 314):
```typescript
webviewPanel.onDidChangeViewState(() => {
  if (webviewPanel.active) {
    setActiveWebviewPanel(webviewPanel);
    setActiveDocumentUri(document.uri);  // ← NEW: Update when activated
  } else if (getActiveWebviewPanel() === webviewPanel) {
    setActiveWebviewPanel(undefined);
  }
});
```

**3. `src/extension.ts` - Command & Chat Integration**

Add import at top:
```typescript
import { getActiveWebviewPanel, getSelectedText, getActiveDocumentUri } from './activeWebview';
```

Add new command (around line 204):
```typescript
// Expose the active document URI so Copilot and other extensions can discover the file
context.subscriptions.push(
  vscode.commands.registerCommand('gptAiMarkdownEditor.getActiveDocumentUri', () => {
    return getActiveDocumentUri()?.toString();
  })
);
```

Enhance chat participant (around line 219):
```typescript
// First, try the explicitly tracked active document URI
const activeUri = getActiveDocumentUri();
if (activeUri) {
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.uri.toString() === activeUri.toString() && !doc.isClosed) {
      docContent = doc.getText();
      docUri = doc.uri;
      break;
    }
  }
}

// Fallback: find any open markdown document
if (!docContent) {
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId === 'markdown' && !doc.isClosed) {
      docContent = doc.getText();
      docUri = doc.uri;
      break;
    }
  }
}

// Reference the active file so Copilot knows the context
if (docUri) {
  stream.reference(docUri);  // ← KEY: tells Copilot this is the file
}
```

---

## FR-1: AI Refine Preserves Block Quote Formatting

### Problem Analysis

The AI model suggests adding markdown formatting to responses. When applied inside a blockquote:
- AI response: `> More concise version`
- Applied inside blockquote: `> [> More concise version]` → renders as `> > ...` (double nested)

### Solution: Two-Part Fix

**Part 1: System Prompt (`src/features/aiRefine.ts`)**

Find the `SYSTEM_PROMPT` constant (around line 14):

**Before**:
```typescript
const SYSTEM_PROMPT =
  'You are a writing assistant embedded in a markdown editor. ' +
  'The user will provide text and an instruction. ' +
  'Return ONLY the refined text—no explanations, no markdown code fences, no preamble.';
```

**After**:
```typescript
const SYSTEM_PROMPT =
  'You are a writing assistant embedded in a markdown editor. ' +
  'The user will provide text and an instruction. ' +
  'Return ONLY the refined text—no explanations, no markdown code fences, no preamble. ' +
  'IMPORTANT: Do NOT add block-level markdown formatting such as `>` for blockquotes, ' +
  'callouts, or alerts. The text will be placed back into its original formatting context automatically.';
```

**Part 2: Wrapper Detection (`src/webview/features/aiRefine.ts`)**

In `handleAiRefineResult()` function (around line 60), replace the text insertion logic:

**Before**:
```typescript
editor
  .chain()
  .focus()
  .insertContentAt({ from: safeFrom, to: safeTo }, data.refinedText, {
    contentType: 'markdown',
  })
  .run();
```

**After**:
```typescript
// Check if the selection is inside a wrapper node (blockquote, alert/callout)
// so we can preserve the parent formatting context
const $from = editor.state.doc.resolve(safeFrom);
let insideWrapper = false;
for (let depth = $from.depth; depth > 0; depth--) {
  const nodeName = $from.node(depth).type.name;
  if (nodeName === 'blockquote' || nodeName === 'callout' || nodeName === 'alert') {
    insideWrapper = true;
    break;
  }
}

if (insideWrapper) {
  // Use selection-based replacement: set selection, delete, then insertContent
  // insertContent at cursor position respects the parent node context
  editor
    .chain()
    .focus()
    .setTextSelection({ from: safeFrom, to: safeTo })
    .deleteSelection()
    .insertContent(data.refinedText, {
      parseOptions: { preserveWhitespace: false },
    })
    .run();
} else {
  editor
    .chain()
    .focus()
    .insertContentAt({ from: safeFrom, to: safeTo }, data.refinedText, {
      contentType: 'markdown',
    })
    .run();
}
```

**Rationale**: 
- When inside a wrapper, `insertContent()` at cursor respects parent node
- When not inside wrapper, direct `insertContentAt()` works as before

---

## FR-2: Remember Last Custom Refinement Command

### File: `src/webview/features/aiRefine.ts`

**Step 1**: Add module-level state (around line 16):

```typescript
/** Last custom refinement command, persisted across dialog invocations. */
let lastCustomCommand = '';
```

**Step 2**: In `showCustomRefineInput()` function, find where textarea is created (around line 110):

**Before**:
```typescript
const input = document.createElement('textarea');
input.className = 'ai-refine-dialog-input';
input.placeholder = 'e.g., Make it sound more professional…';
input.rows = 3;
dialog.appendChild(input);
```

**After**:
```typescript
const input = document.createElement('textarea');
input.className = 'ai-refine-dialog-input';
input.placeholder = 'e.g., Make it sound more professional…';
input.rows = 3;
// Pre-fill with last custom command if available
if (lastCustomCommand) {
  input.value = lastCustomCommand;
}
dialog.appendChild(input);
```

**Step 3**: In submit button handler (around line 135):

**Before**:
```typescript
submitBtn.onclick = () => {
  const customInstruction = input.value.trim();
  if (!customInstruction) return;
  overlay.remove();
  requestAiRefine(`custom:${customInstruction}`, selectedText, from, to);
};
```

**After**:
```typescript
submitBtn.onclick = () => {
  const customInstruction = input.value.trim();
  if (!customInstruction) return;
  lastCustomCommand = customInstruction;  // ← Save for next dialog
  overlay.remove();
  requestAiRefine(`custom:${customInstruction}`, selectedText, from, to);
};
```

---

## FR-3: Better UX for Custom Refinement Dialog Shortcuts

### File: `src/webview/features/aiRefine.ts`

In `showCustomRefineInput()` function, find the keyboard handling code (around line 145):

**Before**:
```typescript
// Handle Escape
const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    overlay.remove();
    editor.commands.focus();
    document.removeEventListener('keydown', onKeyDown);
  }
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    submitBtn.click();
    document.removeEventListener('keydown', onKeyDown);
  }
};
document.addEventListener('keydown', onKeyDown);
```

**After**:
```typescript
// Handle keyboard shortcuts on the textarea
input.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    overlay.remove();
    editor.commands.focus();
  } else if (e.key === 'Enter' && !e.shiftKey) {
    // Enter submits; Shift+Enter allows line breaks
    e.preventDefault();
    submitBtn.click();
  }
});
```

**Key Changes**:
- Moved from global `document` listener to `input` element listener
- Enter doesn't require Ctrl/Cmd modifier
- Shift+Enter allowed for line breaks
- No need to manually remove listener (garbage collected when overlay removed)

---

## FR-4: Selected Text Context in Copilot

### Files Modified

**1. `src/activeWebview.ts` - Add selection range tracking**

```typescript
/** Selection range (ProseMirror positions) for the active editor. */
let currentSelectionRange: { from: number; to: number } | undefined;

/** Update the selection range (ProseMirror positions). */
export function setSelectionRange(range: { from: number; to: number } | undefined) {
  currentSelectionRange = range;
}

/** Get the current selection range. */
export function getSelectionRange(): { from: number; to: number } | undefined {
  return currentSelectionRange;
}
```

**2. `src/editor/MarkdownEditorProvider.ts` - Track selection on SELECTION_CHANGE**

Add import:
```typescript
import { setActiveWebviewPanel, getActiveWebviewPanel, setSelectedText, setActiveDocumentUri, setSelectionRange } from '../activeWebview';
```

In message handler, find `MessageType.SELECTION_CHANGE` case (around line 441):

**Before**:
```typescript
case MessageType.SELECTION_CHANGE: {
  const pos = message.pos as number | undefined;
  outlineViewProvider.setActiveSelection(typeof pos === 'number' ? pos : null);
  // Track selected text so Copilot and other extensions can access it
  const selText = (message.selectedText as string) ?? '';
  setSelectedText(selText);
  break;
}
```

**After**:
```typescript
case MessageType.SELECTION_CHANGE: {
  const pos = message.pos as number | undefined;
  outlineViewProvider.setActiveSelection(typeof pos === 'number' ? pos : null);
  // Track selected text so Copilot and other extensions can access it
  const selText = (message.selectedText as string) ?? '';
  setSelectedText(selText);
  // Track selection range for Copilot context
  const selFrom = message.from as number | undefined;
  const selTo = message.to as number | undefined;
  if (typeof selFrom === 'number' && typeof selTo === 'number') {
    setSelectionRange(selFrom !== selTo ? { from: selFrom, to: selTo } : undefined);
  }
  break;
}
```

**3. `src/extension.ts` - Include in chat context**

Already done if you completed FR-4 implementation. The selected text is already included via `getSelectedText()`:

```typescript
// Include currently selected text if any
const selText = getSelectedText();
if (selText?.trim()) {
  stream.text(`\n\nCurrently selected text:\n${selText}`);
}
```

---

## Verification

### Build & Tests
```bash
npm run build:debug
# ✅ Extension build complete
# ✅ Webview build complete

npm test
# ✅ Test Suites: 1 skipped, 66 passed, 66 of 67 total
# ✅ Tests: 27 skipped, 97 todo, 828 passed, 952 total
```

### Manual Testing

**BUG-I**: 
- Open markdown file in custom editor
- Switch to Copilot chat
- Verify context includes the file

**FR-1**:
- Select text in blockquote
- Request AI refine with "Make this shorter"
- Verify result maintains blockquote (no `>>`)

**FR-2**:
- Request AI refine with custom command "Make professional"
- Refine another section
- Dialog should pre-fill with "Make professional"

**FR-3**:
- Open AI refine custom dialog
- Type multi-line command with Shift+Enter
- Verify line breaks work
- Press Enter (no Ctrl needed) to submit
- Press Escape to close

**FR-4**:
- Select text in editor
- Open Copilot chat
- Verify selected text appears in chat context

---

**Implementation Status**: Complete ✅
