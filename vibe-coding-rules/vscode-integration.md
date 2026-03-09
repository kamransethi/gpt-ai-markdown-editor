# VS Code Integration

> Extension patterns, commands, webview communication, and architecture.
> Index: See `AGENTS.md` for canonical instructions.

---

## Extension Activation

**Principles:**
- Activate only when needed (`onCustomEditor:gptAiMarkdownEditor.editor`)
- Register commands once in `activate()`
- Clean up in `deactivate()` (dispose subscriptions)
- Keep extension.ts minimal (delegate to specialized classes)

---

## WebView Communication

**Message Protocol:**
```typescript
// Extension → WebView
webview.postMessage({
  type: 'update',
  content: markdown
});

// WebView → Extension
vscode.postMessage({
  type: 'edit',
  content: markdown
});
```

**Security:**
- Always use Content Security Policy (CSP)
- Nonce-based script injection only
- Validate all messages from webview
- Sanitize user content

---

## Commands & Shortcuts

**Registration:**
```typescript
// In package.json
"commands": [
  {
    "command": "gptAiMarkdownEditor.openFile",
    "title": "Open with Markdown for Humans",
    "category": "Markdown for Humans"  // Always categorize
  }
]

// In extension.ts
vscode.commands.registerCommand('gptAiMarkdownEditor.openFile', () => {
  // Implementation
});
```

**Keyboard Shortcuts:**
- Follow VS Code conventions (Ctrl/Cmd+B for bold, etc.)
- Don't override common shortcuts
- Add `when` clauses to limit scope
- Document all shortcuts in README

**Palette Hygiene:** Prefer toolbar/inline affordances. If palette entry needed, scope with `when: activeCustomEditorId == gptAiMarkdownEditor.editor`

---

## Configuration

**Best practices:**
```json
// package.json
"configuration": {
  "properties": {
    "gptAiMarkdownEditor.theme": {
      "type": "string",
      "enum": ["auto", "light", "dark", "sepia"],
      "default": "auto",
      "description": "Editor theme (auto follows VS Code theme)"
    }
  }
}
```

- Provide sensible defaults
- Use enums for constrained values
- Clear descriptions (users see these)
- Read config in both extension and webview

---

## Architecture Patterns

### Extension Side (Node.js Context)

**Pattern:** Thin coordinator, delegate to specialized classes

```typescript
// ✅ Good - Extension delegates to provider
export function activate(context: vscode.ExtensionContext) {
  const provider = MarkdownEditorProvider.register(context);
  context.subscriptions.push(provider);
}

// MarkdownEditorProvider handles all logic
class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  async resolveCustomTextEditor(...) {
    // Set up webview
    // Handle document sync
    // Manage lifecycle
  }
}
```

### WebView Side (Browser Context)

**Pattern:** Editor instance + feature modules

```typescript
// ✅ Good - Modular features
const editor = new Editor({
  element: document.querySelector('#editor'),
  extensions: [
    StarterKit,
    Markdown,
    TableExtensions,
    MermaidExtension,
    // Easy to add/remove
  ],
  onUpdate: handleUpdate
});

const toolbar = new BubbleMenuView(editor);
const wordCount = new WordCountFeature(editor);
```

### Communication Pattern

**Two-way message passing:**
```
Extension (Node.js) ←→ WebView (Browser)
       ↓                      ↓
  TextDocument           TipTap Editor
  (source of truth)    (user-facing UI)
```

**Key insight:** TextDocument is authoritative. WebView is a view of that document.

---

## Quick Reference: Common Patterns

### Adding Toolbar Button
**File:** `BubbleMenuView.ts`
```typescript
{ label: '≡', action: () => editor.commands.toggle(), isActive: () => editor.commands.isActive() }
```

### Creating TipTap Extension
**Dir:** `src/webview/extensions/` → Register in `editor.ts` extensions array

### Command Palette Entry
**Files:** `package.json` + `extension.ts`
1. Add to `package.json` contributes.commands
2. Register in `extension.ts` with `vscode.commands.registerCommand()`

### Webview Messaging
- Extension → Webview: `panel.webview.postMessage({ type: 'command' })`
- Webview → Extension: `vscode.postMessage({ type: 'action' })`
- **Files:** `MarkdownEditorProvider.ts`, `editor.ts`

### Config Option
**Files:** `package.json` + `MarkdownEditorProvider.ts`
1. Add to `package.json` contributes.configuration
2. Read: `vscode.workspace.getConfiguration('gptAiMarkdownEditor')`
3. Pass to webview via message
