# Plugin System - Architecture Quick Reference
**Visual Guide & Cheat Sheet**

---

## System Component Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                     VS Code Extension Host                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              EXTENSION PROCESS (Node.js)                 │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ PluginManager                                      │  │  │
│  │  │  • discoverPlugins()                               │  │  │
│  │  │  • executePlugin(id) → lazy load + run             │  │  │
│  │  │  • getAvailablePlugins()                           │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ PluginAPI (RPC Handlers)                           │  │  │
│  │  │  • fetch() - HTTP proxy                            │  │  │
│  │  │  • readFile(), writeFile()                         │  │  │
│  │  │  • getConfig(), setConfig()                        │  │  │
│  │  │  • showDialog(), showMessage()                     │  │  │
│  │  │  • (calls back to webview via postMessage)         │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  [IPC Message Bus]                                        │  │
│  │  Request:  plugin:replaceSelection → {requestId}         │  │
│  │  Response: plugin:response → {requestId, result}         │  │
│  │                                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              WEBVIEW PROCESS (Browser/JS)                │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Plugin Message Handlers                            │  │  │
│  │  │  • getSelectedText() → scans Tiptap editor         │  │  │
│  │  │  • replaceSelection() → Tiptap transaction         │  │  │
│  │  │  • insertAtCursor() → Tiptap transaction           │  │  │
│  │  │  • showDialog() → prompt user, return input        │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Tiptap Editor (Vue)                                │  │  │
│  │  │  • Document state                                  │  │  │
│  │  │  • Selection state                                 │  │  │
│  │  │  • Transaction queue                               │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              TOOLBAR & CONTEXT MENU (VS Code UI)         │  │
│  │              • Confluence [globe icon]                   │  │
│  │              • JIRA [bug icon]                           │  │
│  │              • Template [box icon]                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

---

## Plugin Execution Flow (State Machine)

```
┌─────────────────────────────────────────────────────────────┐
│ IDLE: User sees toolbar buttons                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
               ┌───────────────────┐
               │ User clicks       │
               │ "Confluence"      │
               └────────┬──────────┘
                        │
                        ↓
        ┌───────────────────────────────────┐
        │ PluginManager.executePlugin()     │
        │ • Get plugin from cache           │
        │ • Check if loaded                 │
        └────────┬──────────────────────────┘
                 │
           ┌─────▼─────┐
           │ Loaded?   │
           └─┬───────┬─┘
             │       │
        YES  │       │ NO
             │       ├──────────────────┐
             │       │                  ↓
             │       │    ┌────────────────────────────┐
             │       │    │ Load & Call activate()     │
             │       │    │ Mark loaded=true           │
             │       │    └───────┬────────────────────┘
             │       │            │
             └───┬───┴────────────┬┘
                 │ (always)       │
                 ↓
        ┌────────────────────────┐
        │ _injectAPI(api)        │
        │ plugin.execute({...})  │
        └─────────┬──────────────┘
                  │
                  ↓
        ┌────────────────────────────┐
        │ Plugin code runs:          │
        │                            │
        │ await api.showDialog()     │ ─┐
        │    ↓                       │  │ Sends: plugin:showDialog
        │    ↑                       │  │ Receives: {field: value}
        │ await api.fetch()          │ ─┐ Sends: plugin:fetch
        │    ↓                       │  │ Receives: Response
        │    ↑                       │  │
        │ await api.insertAtCursor() │ ─┐ Sends: plugin:insertAtCursor
        │    ↓                       │  │
        │    ↑                       │  │
        │ ...                        │  │
        └─────────┬──────────────────┘  │
                  │ (via RPC)           │
                  │◄──────────────────┬─┘
                  │ Each call waits    │
                  │ for response       │
                  ↓
        ┌────────────────────────┐
        │ Plugin completes       │
        │ (success or error)     │
        └────────┬───────────────┘
                 │
                 ↓
        ┌────────────────────────┐
        │ Plugin result shown to │
        │ user (message or data) │
        └────────┬───────────────┘
                 │
                 ↓
        ┌────────────────────────┐
        │ IDLE (ready for next)  │
        └────────────────────────┘
```

---

## RPC Message Protocol

### Request (Webview → Extension)
```
{
  "type": "plugin:replaceSelection",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "text": "new text",
  ... // type-specific fields
}
```

### Response (Extension → Webview)
```
{
  "type": "plugin:response",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "result": undefined,
  "error": null
}
```

### Error Response
```
{
  "type": "plugin:response",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "result": null,
  "error": { "message": "Failed to fetch URL" }
}
```

---

## File Organization (Tree)

```
src/
├── plugins/                          ← User plugins live here
│   ├── confluence/
│   │   ├── plugin.ts                 ← Main plugin code
│   │   ├── config.json               ← API keys, URLs
│   │   └── plugin.test.ts            ← Unit tests
│   ├── jira/
│   │   ├── plugin.ts
│   │   ├── config.json
│   │   └── plugin.test.ts
│   ├── template/
│   │   └── plugin.ts                 ← Simple example
│   └── README.md                     ← Plugin dev guide
│
├── shared/
│   ├── pluginAPI.ts                  ← Plugin interface (what plugins import)
│   ├── pluginMessages.ts             ← RPC message types
│   └── messageTypes.ts               ← (existing)
│
├── pluginManager.ts                  ← Discovery, lifecycle, registry
├── pluginRuntime.ts                  ← RPC handler implementations
├── pluginConfig.ts                   ← Config file management
│
├── editor/
│   ├── handlers/
│   │   ├── pluginHandlers.ts         ← NEW: Register RPC handlers
│   │   ├── imageHandlers.ts          ← (existing)
│   │   ├── fileHandlers.ts           ← (existing)
│   │   └── uiHandlers.ts             ← (existing)
│   ├── messageRouter.ts              ← Routes messages to handlers
│   └── MarkdownEditorProvider.ts     ← Registers toolbar buttons
│
├── extension.ts                      ← Initializes PluginManager
│
└── __tests__/
    ├── plugins/
    │   ├── pluginManager.test.ts
    │   ├── pluginRuntime.test.ts
    │   └── confluence/plugin.test.ts
    └── editor/handlers/
        └── pluginHandlers.test.ts
```

---

## PluginAPI Method Reference

### Document
| Method | Returns | Async | Use Case |
|--------|---------|-------|----------|
| `getSelectedText()` | `string` | ✅ | Get user's current selection |
| `replaceSelection(text)` | `void` | ✅ | Replace selection with new text |
| `insertAtCursor(text)` | `void` | ✅ | Insert text at cursor (no replace) |
| `getCursorPosition()` | `{line, char}` | ✅ | Current cursor location |
| `getDocumentText()` | `string` | ✅ | Entire document content |

### Dialogs
| Method | Input | Returns | Async |
|--------|-------|---------|-------|
| `showDialog({title, fields})` | Dialog config | `Record<string,string>` | ✅ |
| `showQuickPick(items)` | Array of items | `Item\|undefined` | ✅ |
| `showMessage(type, msg)` | type, message | `void` | ✅ |

### Network & Files
| Method | Input | Returns | Async |
|--------|-------|---------|-------|
| `fetch(url, opts)` | URL, options | `Response` | ✅ |
| `readFile(path)` | File path | `string` | ✅ |
| `writeFile(path, content)` | Path, content | `void` | ✅ |

### Settings & AI
| Method | Input | Returns | Async |
|--------|-------|---------|-------|
| `getConfig(key, default)` | string, default | `unknown` | ❌ |
| `setConfig(key, value)` | string, value | `void` | ✅ |
| `aiRefine(text, instruction)` | text, instruction | `string` | ✅ |
| `aiExplain(text)` | text | `string` | ✅ |

### Logging
| Method | Input | Returns |
|--------|-------|---------|
| `log(level, msg)` | 'debug'\|'info'\|'warn'\|'error', message | `void` |

---

## Plugin Manifest Structure

```typescript
export const manifest: PluginManifest = {
  // Required
  id: 'confluence',                          // Kebab-case, unique
  name: 'Confluence',                        // Display name
  
  // Optional
  icon?: 'globe' | 'bug' | 'star' | ...,    // VS Code icon
  tooltip?: 'Fetch Confluence page',         // Hover text
  label?: 'Insert from Wiki',                // Menu/button label
  toolbar?: true,                            // Show in toolbar?
  contextMenu?: true,                        // Show in context menu?
};
```

---

## Plugin Lifecycle

```
Discovery (extension.ts)
  ↓
  Scan src/plugins/ for directories with plugin.ts
  ↓
  Load manifest + functions (don't call yet)
  ↓
  Store in pluginManager.plugins Map
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Lazy boundary ━━━━━━

User clicks toolbar button
  ↓
First use: Call activate(context, api)
  ↓
Every use: Inject API, call execute(opts)
  ↓
Plugin runs until completion or error
  ↓
Results applied to document
  ↓
Plugin remains in memory until extension unloads
```

---

## Configuration File Structure

**Location**: `~/.editor/plugin-config.json`

```json
{
  "confluence": {
    "baseUrl": "https://confluence.company.com",
    "username": "user@example.com",
    "apiKey": "xxxxxxxxxxxxx"
  },
  "jira": {
    "baseUrl": "https://jira.company.com",
    "apiKey": "xxxxxxxxxxxxx"
  },
  "custom-plugin": {
    "setting1": "value1",
    "setting2": 123
  }
}
```

Access in plugin:
```typescript
const apiKey = api.getConfig('apiKey');           // Read
await api.setConfig('apiKey', 'new-value');       // Write
```

---

## Message Flow Example: Insert from Confluence

```
User clicks "Confluence" button in toolbar
        ↓
PluginManager.executePlugin('confluence', {}, pluginAPI)
        ↓
confluence/plugin.ts execute() starts
        ↓
api.showDialog({title: 'Insert from Confluence', ...})
        ├─ Create promise with requestId: 'req-001'
        ├─ Send: {type: 'plugin:showDialog', requestId: 'req-001', ...}
        │
        └─ WEBVIEW receives message
           ├─ Render dialog UI
           ├─ User enters URL + clicks OK
           ├─ Send: {type: 'plugin:response', requestId: 'req-001', result: {url: '...'}}
           │
           └─ EXTENSION receives response
              ├─ Find promise for 'req-001'
              ├─ Resolve promise with result
              │
              └─ plugin code continues...
                 const result = result of promise
                 const url = result.url
        ↓
api.fetch('https://confluence...')
        ├─ Create promise with requestId: 'req-002'
        ├─ Send: {type: 'plugin:fetch', requestId: 'req-002', url: '...'}
        │
        └─ EXTENSION receives
           ├─ Makes HTTP request
           ├─ Gets response
           ├─ Send: {type: 'plugin:response', requestId: 'req-002', result: Response}
           │
           └─ plugin code receives response
              const html = await response.text()
        ↓
Convert HTML to Markdown
        ↓
api.insertAtCursor(markdown)
        ├─ Create promise with requestId: 'req-003'
        ├─ Send: {type: 'plugin:insertAtCursor', requestId: 'req-003', text: '...'}}
        │
        └─ WEBVIEW receives
           ├─ Update Tiptap editor
           ├─ Send: {type: 'plugin:response', requestId: 'req-003', result: undefined}
           │
           └─ EXTENSION receives
              ├─ Resolve promise
              │
              └─ plugin code continues
                 (edit complete)
        ↓
Plugin shows success message
        ↓
Document now contains Confluence content!
```

---

## Error Handling Flow

```
Plugin throws error
        ↓
try-catch in pluginManager.executePlugin()
        ↓
Log error: api.log('error', 'Plugin failed: ...')
        ↓
Show user message: api.showMessage('error', 'Error: ...')
        ↓
Extension continues (not crashed)
        ↓
User can click button again or try different plugin
```

---

## Deployment & Distribution (Phases)

### Phase 1 (Current)
- Plugins bundled in extension source
- Auto-discovered on startup
- Manual edit config.json

### Phase 2 (Future)
- Plugin settings UI
- Hot reload on file changes
- Enable/disable toggle

### Phase 3 (Future)
- Plugin marketplace registry
- One-click install from marketplace
- Auto-updates
- Permission model
- Sandboxing

---

## Testing Pyramid

```
                    /\
                   /  \
                  /  E2E \                  ← Run full plugin flow
                 /        \                 ← Confluence + JIRA end-to-end
                /──────────\
               /            \
              / Integration   \             ← Test RPC + document ops
             /                \             ← Message routing, handlers
            /──────────────────\
           /                    \
          /      Unit Tests       \         ← PluginManager, PluginAPI
         /                        \         ← Individual methods
        /──────────────────────────\
```

---

## Version Control & Git

```
git commit -m "feat: define plugin API interfaces"
git commit -m "feat: implement PluginManager discovery"
git commit -m "feat: implement PluginRuntime handlers"
git commit -m "feat: add plugin RPC message handlers"
git commit -m "feat: implement example plugins (confluence, jira)"
git commit -m "test: add plugin system comprehensive tests"
git commit -m "docs: plugin developer guide"
```

---

## Key Files to Review

Before implementation starts, review:
1. ✅ [./spec.md](./spec.md) - Full 16-section spec
2. ✅ [./DESIGN_REVIEW.md](./DESIGN_REVIEW.md) - Critical questions
3. ✅ [./README.md](./README.md) - Plugin dev perspective
4. ✅ [./IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) - Task breakdown
5. ✅ [THIS FILE] - Quick reference

---

**Status**: Ready for advanced LLM review  
**Next**: Hand to AI with IMPLEMENTATION_CHECKLIST.md
