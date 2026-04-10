# Plugin System Specification
**Flux Flow Markdown Editor - Plugin Architecture**

**Version:** 1.0  
**Date:** April 10, 2026  
**Author:** DK-AI  
**Status:** Design Review Pending  

---

## 1. Overview

### 1.1 Goal
Enable third-party plugins to extend the markdown editor with custom functionality, specifically:
- Toolbar actions (buttons with icons)
- Context menu items (right-click)
- Text transformations (replace/insert)
- API integrations (Confluence, JIRA, etc.)
- User dialogs for configuration

### 1.2 Example Use Cases
1. **Confluence Plugin**: Show dialog → user enters URL → fetch page → insert HTML/Markdown at cursor
2. **JIRA Plugin**: Show project selector → create ticket → insert ticket link at cursor
3. **Template Plugin**: Pre-defined snippets → insert at cursor with placeholder substitution
4. **AI Transform Plugin**: Select text → send to AI → replace with result

### 1.3 Non-Goals
- Plugin versioning/dependency management
- Plugin marketplace/registry
- Plugin auto-updates
- Complex sandboxing (trust-based for MVP)
- Plugin persistence across editor sessions

---

## 2. Architecture

### 2.1 System Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Extension Process (Node.js)                            │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ PluginManager                                    │  │ │
│  │  │ • Discovery (scan ./plugins)                     │  │ │
│  │  │ • Lifecycle (load/unload)                        │  │ │
│  │  │ • Toolbar registration                           │  │ │
│  │  │ • Context menu hook                              │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                      ↕ (IPC)                             │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ Plugin Runtime API (Extension Side)              │  │ │
│  │  │ • fetch(url, opts) → async                       │  │ │
│  │  │ • showInputDialog(opts)                          │  │ │
│  │  │ • readFile(path)                                 │  │ │
│  │  │ • Settings API                                   │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Webview (Browser Context - JavaScript)                 │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ Plugin Runtime API (Webview Side)                │  │ │
│  │  │ • getSelectedText() → string                     │  │ │
│  │  │ • replaceSelection(text)                         │  │ │
│  │  │ • insertAtCursor(text)                           │  │ │
│  │  │ • getCursorPosition() → {line, pos}              │  │ │
│  │  │ • showDialog({ title, fields })                 │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Plugin Execution Flow

```
User clicks toolbar button "Confluence"
         ↓
PluginManager.executePlugin('confluence', { trigger: 'toolbar' })
         ↓
confluence/plugin.ts → execute()
         ↓
Plugin calls: await pluginAPI.showInputDialog({ prompt: "URL" })
         ↓
Extension sends message to webview → Dialog shown in editor
         ↓
User enters URL → sends response back to extension
         ↓
Plugin receives URL, calls: fetch('https://...')
         ↓
Extension handles HTTP request, returns content
         ↓
Plugin transforms content to Markdown
         ↓
Plugin calls: pluginAPI.insertAtCursor(markdown)
         ↓
Extension sends message to webview → inserts text
         ↓
Webview updates editor, user sees content inserted
```

### 2.3 Component Responsibilities

| Component | Responsibility |
|-----------|---|
| **PluginManager** | Discovery, loading, toolbar/context registration, lifecycle |
| **PluginRuntime** | API surface (extension-side RPC handlers) |
| **Plugin** | Business logic (API calls, text transformation) |
| **WebviewPluginAPI** | Document manipulation in editor (selection, insertion) |
| **MessageRouter** | Routes plugin RPC calls between extension ↔ webview |

---

## 3. File Structure

```
src/
├── plugins/                          # Plugin directory (scanned at startup)
│   ├── confluence/
│   │   ├── plugin.ts                 # Main plugin code
│   │   └── config.json               # Optional configuration template
│   ├── jira/
│   │   ├── plugin.ts
│   │   └── config.json
│   └── README.md                     # Plugin development guide
├── shared/
│   ├── pluginAPI.ts                  # Plugin interface (types)
│   ├── pluginMessages.ts             # Message types for plugin RPC
│   └── messageTypes.ts               # (existing, extend as needed)
├── pluginManager.ts                  # Discovery & lifecycle
├── pluginRuntime.ts                  # Extension-side RPC handlers
├── editor/
│   ├── handlers/
│   │   ├── imageHandlers.ts          # (existing)
│   │   ├── pluginHandlers.ts         # NEW: Webview-side plugin API
│   │   └── ...
│   └── messageRouter.ts              # (existing, register plugin handlers)
├── extension.ts                      # (existing, initialize PluginManager)
└── ...
```

---

## 4. Plugin API Specification

### 4.1 Plugin Interface

```typescript
// src/shared/pluginAPI.ts

export interface PluginManifest {
  /** Unique plugin identifier (kebab-case) */
  id: string;
  
  /** Display name shown in toolbar/menu */
  name: string;
  
  /** Icon name (VS Code icon, or file path) */
  icon?: string;
  
  /** Menu item label (if different from name) */
  label?: string;
  
  /** Tooltip on hover */
  tooltip?: string;
  
  /** Show in toolbar? Default: true */
  toolbar?: boolean;
  
  /** Show in context menu? Default: true */
  contextMenu?: boolean;
}

export interface PluginContext {
  /** Plugin's own directory path */
  pluginDir: string;
  
  /** Extension's settings directory ~/.editor */
  settingsDir: string;
  
  /** Current document language (e.g., 'markdown') */
  language: string;
  
  /** Full document path if available */
  documentPath?: string;
}

/**
 * Plugin entry point. Must export this function.
 * Called once on extension activation.
 */
export type PluginActivate = (
  context: PluginContext,
  api: PluginAPI
) => void | Promise<void>;

/**
 * Plugin execution. Called when user clicks toolbar/menu.
 * Can be async (progress indicator shown).
 */
export type PluginExecute = (opts: {
  selectedText?: string;
  cursorPosition?: { line: number; character: number };
  documentPath?: string;
}) => Promise<void>;

export interface PluginAPI {
  // ============ Document Manipulation ============
  
  /** Get currently selected text in editor */
  getSelectedText(): Promise<string>;
  
  /**
   * Replace currently selected text with new text.
   * If nothing selected, inserts at cursor.
   */
  replaceSelection(text: string): Promise<void>;
  
  /**
   * Insert text at current cursor position.
   * Does not replace anything.
   */
  insertAtCursor(text: string): Promise<void>;
  
  /**
   * Get current cursor position {line (0-based), character (0-based)}
   */
  getCursorPosition(): Promise<{ line: number; character: number }>;
  
  /**
   * Get full document text
   */
  getDocumentText(): Promise<string>;
  
  // ============ User Interaction ============
  
  /**
   * Show a modal dialog with input fields.
   * Returns user's responses or throws if cancelled.
   */
  showDialog(opts: {
    title: string;
    fields: DialogField[];
  }): Promise<Record<string, string>>;
  
  /**
   * Show a quick-pick dropdown (single selection)
   */
  showQuickPick(items: QuickPickItem[]): Promise<QuickPickItem | undefined>;
  
  /**
   * Show info/warning/error notification
   */
  showMessage(type: 'info' | 'warning' | 'error', message: string): Promise<void>;
  
  // ============ HTTP & Network ============
  
  /**
   * Make HTTP request. Runs in extension context (full network access).
   * Handles CORS by proxying through extension.
   */
  fetch(url: string, opts?: FetchOptions): Promise<Response>;
  
  // ============ File System ============
  
  /**
   * Read file from disk
   */
  readFile(path: string): Promise<string>;
  
  /**
   * Write file to disk
   */
  writeFile(path: string, content: string): Promise<void>;
  
  // ============ Settings ============
  
  /**
   * Get plugin setting (reads from config.json or default)
   */
  getConfig(key: string, defaultValue?: unknown): unknown;
  
  /**
   * Set plugin setting (writes to config.json)
   */
  setConfig(key: string, value: unknown): Promise<void>;
  
  // ============ AI Features ============
  
  /**
   * Call the editor's AI refine feature
   */
  aiRefine(text: string, instruction: string): Promise<string>;
  
  /**
   * Call the editor's AI explain feature
   */
  aiExplain(text: string): Promise<string>;
  
  // ============ Logging ============
  
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
}

export interface DialogField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'password' | 'url';
  required?: boolean;
  placeholder?: string;
  default?: string;
}

export interface QuickPickItem {
  label: string;
  description?: string;
  value: string;
}

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}
```

### 4.2 Plugin Template

```typescript
// src/plugins/confluence/plugin.ts

import { 
  PluginActivate, 
  PluginExecute, 
  PluginAPI,
  PluginManifest,
  PluginContext
} from '@shared/pluginAPI';

export const manifest: PluginManifest = {
  id: 'confluence',
  name: 'Confluence',
  icon: 'globe',
  tooltip: 'Insert Confluence page at cursor',
  toolbar: true,
  contextMenu: true,
};

export const activate: PluginActivate = (context, api) => {
  api.log('info', `Confluence plugin activated from ${context.pluginDir}`);
};

export const execute: PluginExecute = async (opts) => {
  const api = getPluginAPI(); // How to access? See Section 4.3
  
  try {
    // Show input dialog
    const result = await api.showDialog({
      title: 'Insert from Confluence',
      fields: [
        {
          id: 'url',
          label: 'Confluence Page URL',
          type: 'url',
          required: true,
          placeholder: 'https://wiki.example.com/pages/viewpage.action?pageId=123'
        }
      ]
    });
    
    const url = result.url;
    
    // Fetch content
    const response = await api.fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Parse HTML → Markdown (TBD: use turndown library)
    const markdown = await parseConfluenceHtml(html);
    
    // Insert into document
    if (opts.selectedText) {
      await api.replaceSelection(markdown);
    } else {
      await api.insertAtCursor(markdown);
    }
    
    await api.showMessage('info', 'Confluence content inserted');
  } catch (error) {
    api.log('error', `Confluence plugin error: ${error.message}`);
    await api.showMessage('error', `Error: ${error.message}`);
  }
};

async function parseConfluenceHtml(html: string): Promise<string> {
  // TODO: Implement HTML → Markdown conversion
  // Use turndown.js or similar
  return html;
}
```

### 4.3 Plugin API Injection Strategy

**Problem**: How does `plugin.ts` access `PluginAPI`?

**Solutions Evaluated**:
1. **Global namespace** (`window.pluginAPI`) - ❌ Couples plugin to runtime
2. **Dependency injection at execute time** - ✅ Clean, testable
3. **Module-level injection** - ⚠️ Requires build-time setup

**Solution (Option 2)**:
```typescript
// src/plugins/base.ts - Helper for all plugins

import { PluginAPI } from '@shared/pluginAPI';

let _apiInstance: PluginAPI | null = null;

export function _injectAPI(api: PluginAPI): void {
  _apiInstance = api;
}

export function getPluginAPI(): PluginAPI {
  if (!_apiInstance) {
    throw new Error('Plugin API not initialized. This is likely a plugin bug.');
  }
  return _apiInstance;
}
```

Then in PluginManager:
```typescript
export async function executePlugin(pluginId: string) {
  const plugin = loadedPlugins.get(pluginId);
  _injectAPI(pluginAPI); // Inject before execute
  await plugin.execute(opts);
}
```

---

## 5. Plugin Discovery & Lifecycle

### 5.1 Discovery

**When**: Extension activation  
**Where**: `src/plugins/` directory

```typescript
// src/pluginManager.ts

export class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  
  async discoverPlugins(pluginsDir: string): Promise<void> {
    const entries = fs.readdirSync(pluginsDir);
    
    for (const entry of entries) {
      const pluginPath = path.join(pluginsDir, entry);
      const stat = fs.statSync(pluginPath);
      
      if (!stat.isDirectory()) continue;
      
      try {
        const pluginModule = require(path.join(pluginPath, 'plugin.ts'));
        
        if (!pluginModule.manifest) {
          console.warn(`[Plugin] ${entry}: missing manifest export`);
          continue;
        }
        
        if (!pluginModule.execute || !pluginModule.activate) {
          console.warn(`[Plugin] ${entry}: missing execute/activate exports`);
          continue;
        }
        
        this.plugins.set(pluginModule.manifest.id, {
          id: pluginModule.manifest.id,
          manifest: pluginModule.manifest,
          activate: pluginModule.activate,
          execute: pluginModule.execute,
          path: pluginPath,
          loaded: false,
        });
        
        console.log(`[Plugin] Discovered: ${pluginModule.manifest.id}`);
      } catch (error) {
        console.error(`[Plugin] Failed to load ${entry}:`, error.message);
      }
    }
  }
  
  /**
   * Lazy-load: activate plugin on first use
   */
  async executePlugin(
    pluginId: string,
    opts: ExecuteOptions,
    api: PluginAPI
  ): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
    
    // Lazy-load on first use
    if (!plugin.loaded) {
      await plugin.activate(
        { pluginDir: plugin.path, /*...*/ },
        api
      );
      plugin.loaded = true;
    }
    
    // Execute plugin main logic
    _injectAPI(api); // Inject API before execute
    await plugin.execute(opts);
  }
  
  getAvailablePlugins(): PluginManifest[] {
    return Array.from(this.plugins.values()).map(p => p.manifest);
  }
}
```

### 5.2 Toolbar & Context Menu Registration

**When**: After discovering plugins  
**Where**: `MarkdownEditorProvider.ts` (registers with VS Code)

```typescript
// In MarkdownEditorProvider.register()

const pluginManager = new PluginManager();
await pluginManager.discoverPlugins(pluginsDir);

// Register each plugin's toolbar button
const plugins = pluginManager.getAvailablePlugins();
for (const manifest of plugins) {
  if (manifest.toolbar !== false) {
    // Register as custom editor toolbar action
    vscode.commands.registerCommand(
      `extension.plugin.execute.${manifest.id}`,
      async () => {
        const api = createPluginAPI(/* ... */);
        await pluginManager.executePlugin(manifest.id, {}, api);
      }
    );
  }
}

// Add to package.json contributions
// (See Section 6.1)
```

### 5.3 Configuration Management

**File**: `src/plugins/[plugin]/config.json`

```json
{
  "confluence": {
    "baseUrl": "https://wiki.company.com",
    "username": "user@example.com",
    "apiKey": "secret-key-here"
  }
}
```

**API**:
```typescript
export class PluginConfigManager {
  static read(pluginId: string): Record<string, unknown> {
    const configPath = path.join(SETTINGS_DIR, 'plugin-config.json');
    if (!fs.existsSync(configPath)) return {};
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config[pluginId] || {};
  }
  
  static write(pluginId: string, values: Record<string, unknown>): void {
    const configPath = path.join(SETTINGS_DIR, 'plugin-config.json');
    const config = this.read(pluginId);
    config[pluginId] = values;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
}

// In PluginAPI:
getConfig: (key: string, defaultValue?: unknown) => {
  const config = PluginConfigManager.read(manifest.id);
  return config[key] ?? defaultValue;
}
```

---

## 6. Integration Points

### 6.1 Extension Manifest (`package.json`)

```json
{
  "contributes": {
    "commands": [
      {
        "command": "extension.plugin.execute.confluence",
        "title": "Confluence: Insert Page",
        "icon": "$(globe)"
      },
      {
        "command": "extension.plugin.execute.jira",
        "title": "JIRA: Create Ticket",
        "icon": "$(bug)"
      }
    ],
    "menus": {
      "editor/context": [
        {
          "command": "extension.plugin.execute.confluence",
          "when": "resourceLangId == markdown"
        },
        {
          "command": "extension.plugin.execute.jira",
          "when": "resourceLangId == markdown"
        }
      ],
      "editor/title": [
        {
          "command": "extension.plugin.execute.confluence",
          "when": "resourceLangId == markdown",
          "group": "1_modification"
        }
      ]
    }
  }
}
```

### 6.2 Message Types

```typescript
// src/shared/pluginMessages.ts

export const PLUGIN_MESSAGE_TYPES = {
  // Webview → Extension
  PLUGIN_GET_SELECTION: 'plugin:getSelection',
  PLUGIN_REPLACE_SELECTION: 'plugin:replaceSelection',
  PLUGIN_INSERT_AT_CURSOR: 'plugin:insertAtCursor',
  PLUGIN_SHOW_DIALOG: 'plugin:showDialog',
  PLUGIN_FETCH: 'plugin:fetch',
  PLUGIN_GET_CONFIG: 'plugin:getConfig',
  PLUGIN_SET_CONFIG: 'plugin:setConfig',
  PLUGIN_SHOW_MESSAGE: 'plugin:showMessage',
  
  // Extension → Webview
  PLUGIN_DIALOG_RESPONSE: 'plugin:dialogResponse',
};

export interface PluginDialogRequest {
  title: string;
  fields: DialogField[];
  requestId: string;
}

export interface PluginFetchRequest {
  url: string;
  options?: FetchOptions;
  requestId: string;
}
```

---

## 7. Implementation Phases

### Phase 1: Core (Week 1-2)
- ✅ Define PluginAPI interface
- ✅ Implement PluginManager discovery
- ✅ Implement PluginRuntime (extension-side API)
- ✅ Add message handlers for basic operations
- ✅ Example: confluence plugin (fetch + insert)

**Deliverables**: Users can write & load plugins  
**Test**: Load 2 example plugins, execute them

### Phase 2: UX Polish (Week 2-3)
- Toolbar button auto-registration
- Context menu integration
- Progress indicators for long-running plugins
- Settings UI (plugin config)
- Error banners + retry

**Deliverables**: Plugins appear in UI automatically  
**Test**: End-to-end user flow

### Phase 3: Advanced (Week 3-4)
- Plugin disable/enable toggle
- Hot reload (watch plugins directory)
- Plugin permissions model
- Sandboxing (isolated context)
- Plugin versioning + dependency management

**Deliverables**: Production-ready plugin system  
**Test**: Stress test with 10+ plugins

---

## 8. Example Plugins

### 8.1 Confluence Plugin

```typescript
// src/plugins/confluence/plugin.ts

export const manifest = {
  id: 'confluence',
  name: 'Confluence',
  icon: 'globe',
  tooltip: 'Fetch and insert Confluence page content',
};

export const execute = async (opts) => {
  const api = getPluginAPI();
  
  const result = await api.showDialog({
    title: 'Insert from Confluence',
    fields: [{
      id: 'url',
      label: 'Page URL',
      type: 'url',
      required: true,
    }]
  });
  
  const response = await api.fetch(result.url, {
    headers: {
      Authorization: `Bearer ${api.getConfig('apiKey')}`
    }
  });
  
  const html = await response.text();
  const markdown = turndownService.turndown(html);
  
  await api.insertAtCursor(markdown);
};
```

### 8.2 JIRA Plugin

```typescript
// src/plugins/jira/plugin.ts

export const manifest = {
  id: 'jira',
  name: 'JIRA',
  icon: 'bug',
  tooltip: 'Create JIRA ticket from selection',
};

export const execute = async (opts) => {
  const api = getPluginAPI();
  
  // Show project picker
  const projects = await fetchJiraProjects();
  const project = await api.showQuickPick(
    projects.map(p => ({ label: p.name, value: p.key }))
  );
  
  // Show ticket creation form
  const result = await api.showDialog({
    title: 'Create JIRA Ticket',
    fields: [
      { id: 'summary', label: 'Summary', type: 'text', required: true },
      { id: 'description', label: 'Description', type: 'textarea' },
      { id: 'assignee', label: 'Assignee', type: 'text' },
    ]
  });
  
  // Create ticket
  const ticket = await api.fetch('https://jira.company.com/rest/api/3/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: '...' },
    body: JSON.stringify({
      fields: {
        project: { key: project.value },
        summary: result.summary,
        description: result.description,
        assignee: { name: result.assignee },
      }
    })
  });
  
  // Insert link
  const ticketUrl = `https://jira.company.com/browse/${ticket.key}`;
  await api.insertAtCursor(`[${ticket.key}](${ticketUrl})`);
};
```

---

## 9. Error Handling

### 9.1 Plugin Load Errors
- Plugin fails to require → logged, skipped
- Missing manifest/execute → logged, skipped
- execute() throws → caught, user shown error message

### 9.2 API Errors
- Network errors → propagated to plugin with error message
- Dialog cancelled → returns undefined (plugin handles)
- Sandbox violations → rejected with permission error

### 9.3 User Feedback
```typescript
await api.showMessage('error', 'Failed to load Confluence page: 403 Forbidden');
```

---

## 10. Security Considerations (Phase 3)

### 10.1 Trust Model (MVP)
- Plugins are code files in the repo → assumed trusted
- No permission prompts
- Full API access by default

### 10.2 Sandbox Model (Future)
- Each plugin runs in Worker thread with limited API
- Permission manifest (`plugin.json`):
  ```json
  {
    "permissions": ["network", "filesystem", "dialog"]
  }
  ```
- Plugin API calls rejected if permission missing

### 10.3 Network Security
- CORS requests proxied through extension (safe)
- HTTPS enforced for external APIs
- Credentials stored in config, not in source

---

## 11. Testing Strategy

### 11.1 Unit Tests
```typescript
// src/__tests__/plugins/pluginManager.test.ts
test('discovers plugins from directory', async () => {
  const manager = new PluginManager();
  await manager.discoverPlugins(testPluginsDir);
  expect(manager.getAvailablePlugins().length).toBeGreaterThan(0);
});

test('executes plugin with API', async () => {
  const mockAPI = createMockPluginAPI();
  await manager.executePlugin('confluence', {}, mockAPI);
  expect(mockAPI.insertAtCursor).toHaveBeenCalled();
});
```

### 11.2 Integration Tests
```typescript
test('e2e: confluence plugin fetches and inserts', async () => {
  // Mock fetch
  mockFetch.get('https://confluence...', { body: '<html>...' });
  
  // Execute plugin
  await pluginManager.executePlugin('confluence', {}, realAPI);
  
  // Verify document updated
  expect(webview.documentText).toContain('Confluence Page Title');
});
```

### 11.3 Plugin Template Test
Every plugin should include `plugin.test.ts`:
```typescript
describe('confluence plugin', () => {
  it('should have valid manifest', () => {
    expect(manifest.id).toBeDefined();
    expect(manifest.name).toBeDefined();
  });
  
  it('should handle network errors gracefully', async () => {
    mockAPI.fetch.mockRejectedValue(new Error('Network error'));
    await execute({});
    expect(mockAPI.showMessage).toHaveBeenCalledWith('error', expect.any(String));
  });
});
```

---

## 12. API Compatibility & Versioning

### 12.1 Semantic Versioning
- Plugin API version in `src/shared/pluginAPI.ts`: `export const PLUGIN_API_VERSION = '1.0.0'`
- Plugin declares: `export const requiredApiVersion = '1.0.0'`
- On activate: check version compatibility

### 12.2 Breaking Changes
- API v1.x → v2.x requires plugin recompile
- Deprecation: mark old methods with `@deprecated`
- Shim layer: provide backward compatibility

---

## 13. Documentation

### 13.1 For Plugin Developers
- `src/plugins/README.md` - Getting started guide
- Plugin template - minimal example
- API reference - full PluginAPI documentation
- Example plugins - Confluence, JIRA with comments

### 13.2 For Extension Maintainers
- This spec
- Architecture diagrams
- Message flow docs
- Testing guide

---

## 14. Known Limitations & Future Work

### 14.1 MVP Limitations
- ❌ No plugin conflict resolution (duplicate IDs)
- ❌ No plugin lifecycle hooks (onSave, onClose, etc.)
- ❌ No plugin-to-plugin communication
- ❌ No plugin UI components (custom panels, sidebars)
- ❌ Single-threaded execution (plugins block each other)

### 14.2 Future Enhancements
- Plugin marketplace (registry)
- Auto-update mechanism
- Plugin dependencies
- Custom VS Code views/panels
- Async execution queue (don't block UI)
- Plugin configuration UI (schema-driven forms)

---

## 15. Success Criteria

✅ **Must Have**:
- [ ] Plugins discoverable in `src/plugins/` directory
- [ ] Toolbar buttons appear automatically
- [ ] Context menu items appear automatically
- [ ] Confluence plugin works end-to-end
- [ ] JIRA plugin works end-to-end
- [ ] Plugin errors logged, not crash extension

✅ **Should Have**:
- [ ] Settings UI for plugin configuration
- [ ] Progress indicators for long operations
- [ ] Plugin enable/disable toggle
- [ ] Comprehensive plugin template

✅ **Nice to Have**:
- [ ] Hot reload (watch plugins directory)
- [ ] Plugin version check on load
- [ ] Permission model (future)

---

## 16. Questions for Review

1. **Plugin distribution**: Should plugins be shipped in repo or installed separately?
2. **Configuration**: Is file-based config enough or need GUI?
3. **Async execution**: Should multiple plugins run in parallel or queue sequentially?
4. **Permissions**: Worth implementing in Phase 1 or defer to Phase 3?
5. **Hot reload**: Essential feature or nice-to-have?

---

**Document Status**: Ready for technical review & validation by advanced LLM
