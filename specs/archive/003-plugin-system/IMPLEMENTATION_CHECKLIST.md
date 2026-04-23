# Plugin System - Implementation Checklist

**Use this as a roadmap for implementation**

**Target**: 2-3 weeks for Phase 1 (MVP)

---

## Phase 1: Core Plugin System (MVP)

### NEW Files to Create

#### 1. Plugin Interface &amp; Types

- `src/shared/pluginAPI.ts` (400 lines)
  - Define `PluginManifest`, `PluginContext`, `PluginAPI` interfaces
  - Define `PluginActivate`, `PluginExecute` function types
  - Export all types used by plugins
- `src/shared/pluginMessages.ts` (80 lines)
  - Message type constants for plugin RPC
  - Message interfaces for dialog, fetch, etc.

#### 2. Plugin Runtime &amp; Manager

- `src/pluginManager.ts` (300 lines)
  - `PluginManager` class
  - `discoverPlugins()` - scan directory, load manifests
  - `executePlugin()` - lazy load, call activate, call execute
  - `getAvailablePlugins()` - return list for UI registration
  - Error handling for broken plugins
- `src/pluginRuntime.ts` (250 lines)
  - `createPluginAPI()` factory function
  - Implement all PluginAPI methods
  - HTTP client wrapper (fetch)
  - File system wrapper (readFile, writeFile)
  - Settings manager integration
- `src/plugins/base.ts` (30 lines)
  - `_injectAPI()` function
  - `getPluginAPI()` function
  - Module-level API store

#### 3. Plugin Handlers (Webview RPC)

- `src/editor/handlers/pluginHandlers.ts` (200 lines)
  - Register message handlers in messageRouter
  - `PLUGIN_GET_SELECTION` handler
  - `PLUGIN_REPLACE_SELECTION` handler
  - `PLUGIN_INSERT_AT_CURSOR` handler
  - `PLUGIN_SHOW_DIALOG` handler
  - Others...

#### 4. Plugin Configuration

- `src/pluginConfig.ts` (80 lines)
  - `PluginConfigManager` class
  - Read from `~/.editor/plugin-config.json`
  - Write/update methods
  - Encryption helpers (optional for MVP)

#### 5. Example Plugins

- `src/plugins/confluence/plugin.ts` (120 lines)
  - Implement full Confluence workflow
  - Fetch page, convert HTML → Markdown, insert
- `src/plugins/confluence/config.json` (example)
  ```json
  {
    "baseUrl": "https://confluence.yourcompany.com",
    "username": "user@company.com",
    "apiKey": "YOUR_API_KEY_HERE"
  }
  ```
- `src/plugins/jira/plugin.ts` (150 lines)
  - JIRA project selector
  - Issue creation form
  - Insert link to created ticket
- `src/plugins/jira/config.json` (example)
- `src/plugins/template/plugin.ts` (80 lines)
  - Insert pre-defined Markdown snippets
  - Simple example for new plugin developers
- `src/plugins/README.md` (plugin developer guide, see README.md in this directory)

#### 6. Tests

- `src/__tests__/plugins/pluginManager.test.ts` (150 lines)
  - Test discovery (valid/invalid plugins)
  - Test lazy loading
  - Test execution
  - Test error handling
- `src/__tests__/plugins/pluginRuntime.test.ts` (100 lines)
  - Test API methods (mock webview)
  - Test HTTP client
  - Test config persistence
- `src/__tests__/plugins/confluence/plugin.test.ts` (80 lines)
- `src/__tests__/plugins/jira/plugin.test.ts` (80 lines)
- `src/__tests__/editor/handlers/pluginHandlers.test.ts` (100 lines)

#### 7. Build &amp; Build Files

- Build script additions (scripts/build-plugins.js)
  - esbuild plugins with TypeScript support
  - Output to src/plugins/[name]/dist/plugin.js
  - Watch mode for dev
- Update `package.json`
  - Add build-plugins script
  - Add dependencies (turndown, other plugin libs)

---

### MODIFIED Files

#### 1. Extension Entry Point

- `src/extension.ts`
  - Add `const pluginManager = new PluginManager()`
  - Call `await pluginManager.discoverPlugins()`
  - Register all discovered plugins as VS Code commands
  - Add to subscriptions

#### 2. Editor Provider

- `src/editor/MarkdownEditorProvider.ts`
  - Register toolbar buttons for each plugin
  - Pass pluginManager reference to handlers
  - Handle plugin errors gracefully

#### 3. Message Router

- `src/editor/messageRouter.ts`
  - Register plugin handlers (no changes, just new handlers added)

#### 4. Handler Registration

- `src/editor/handlers/uiHandlers.ts` or new file
  - Import and register pluginHandlers

#### 5. VS Code Manifest (package.json)

- Add `commands` for each plugin toolbar button
- Add `menus.editor/context` for context menu items
- Add `menus.editor/title` for toolbar
- Add plugin-related configuration options (future)

#### 6. Test Setup

- Update `src/__tests__/setup.ts` if needed
  - Mock plugin filesystem operations
  - Mock HTTP client

---

## Dependencies to Add

```json
{
  "dependencies": {
    "turndown": "^7.x",              // HTML to Markdown conversion
    "uuid": "^9.x"                   // Generate request IDs
  },
  "devDependencies": {
    "@types/turndown": "^5.x",
    "esbuild": "^0.21.x"             // Already present, ensure up to date
  }
}
```

---

## File Size Estimates


| File                   | Size             | Priority |
| ---------------------- | ---------------- | -------- |
| `pluginAPI.ts`         | 400 lines        | HIGH     |
| `pluginManager.ts`     | 300 lines        | HIGH     |
| `pluginRuntime.ts`     | 250 lines        | HIGH     |
| `pluginHandlers.ts`    | 200 lines        | HIGH     |
| `confluence/plugin.ts` | 120 lines        | MEDIUM   |
| `jira/plugin.ts`       | 150 lines        | MEDIUM   |
| `template/plugin.ts`   | 80 lines         | MEDIUM   |
| Tests                  | 600 lines        | MEDIUM   |
| **Total New**          | **~2,500 lines** |          |


**Modified**: ~100 lines across 5 files

---

## Implementation Order (Recommended)

### Week 1: Foundations

1. ✅ Define PluginAPI interface (`pluginAPI.ts`)
2. ✅ Implement PluginManager (`pluginManager.ts`)
3. ✅ Implement PluginRuntime (`pluginRuntime.ts`)
4. ✅ Hook into extension.ts &amp; MarkdownEditorProvider.ts
5. ⏳ Write unit tests for 1 &amp; 2

### Week 2: Integration &amp; Examples

1. ✅ Implement pluginHandlers (webview RPC)
2. ✅ Implement example plugins (Confluence, JIRA, Template)
3. ✅ Build script for plugins
4. ✅ Fix integration issues
5. ⏳ E2E tests (user clicks button → content inserted)

### Week 3: Polish &amp; Docs

1. ✅ Plugin configuration system
2. ✅ Error handling improvements
3. ✅ Plugin developer guide (README.md)
4. ✅ Code comments &amp; inline documentation
5. ✅ Demo &amp; validation

---

## Testing Checklist

### Unit Tests

- Plugin discovery (finds valid, skips invalid)
- Plugin loading (requires correct exports)
- Plugin execution (calls activate, calls execute)
- Lazy loading (plugin only loads on first use)
- API methods (each individually testable with mocks)
- Error handling (plugin crash logged, not crashes extension)

### Integration Tests

- Message routing (request → response correlation)
- Document manipulation (selection, insertion, replacement)
- Dialog display &amp; response handling
- HTTP requests (mocked, timeout handling)
- File operations (read/write)
- Settings persistence

### E2E Tests

- User clicks toolbar button → plugin executes
- Plugin shows dialog → user enters data → data used
- Plugin makes HTTP call → receives response → content inserted
- Plugin errors → error message shown, extension continues
- Multiple plugins loaded → no conflicts

### Stress Tests

- 5 plugins loading simultaneously
- Large document (10k lines) + plugin bulk edits
- Network timeout (fetch hangs 30 seconds)
- Rapid successive plugin clicks

---

## Dependency Injection &amp; API Access Flow

### Option A (Recommended): Module-level injection

```
extension.ts
  → pluginManager.executePlugin(id)
    → _injectAPI(api)
    → plugin.execute()
      → getPluginAPI()
        → accesses injected instance
```

**Pros**: Simple, decoupled from constructor  
**Cons**: Global state

### Option B (Alternative): Constructor injection

```
class PluginExecutor {
  constructor(private api: PluginAPI) {}
  
  async execute() {
    this.api.insertAtCursor(...)
  }
}
```

**Decision for MVP**: Go with Option A (less refactoring)

---

## Git Commit Strategy

**Suggested commits**:

1. `feat: define plugin API interfaces`
2. `feat: implement PluginManager discovery & lifecycle`
3. `feat: implement PluginRuntime API`
4. `feat: add plugin message handlers to messageRouter`
5. `feat: implement Confluence plugin (example)`
6. `feat: implement JIRA plugin (example)`
7. `chore: add plugin build script`
8. `test: comprehensive plugin system tests`
9. `docs: plugin developer guide`

---

## Validation Checklist

Before moving to Phase 2, validate:

- All unit tests passing (100% coverage for plugin code)
- E2E test: Confluence plugin works end-to-end
- E2E test: JIRA plugin works end-to-end
- Plugin file changes persist across reloads
- Plugin errors don't crash extension
- Extension startup time &lt; +100ms due to plugins
- Documentation complete &amp; reviewed
- Code reviewed by team lead(s)

---

## Known Unknowns (Clarify Before Starting)

1. **Build System**: Are plugins built at extension build time or runtime?
2. **Plugin Location**: Should be relative to `src/plugins/` or configurable?
3. **Dependency**: Can plugins have npm dependencies? If so, how installed?
4. **Telemetry**: Should plugin usage be tracked?
5. **Security**: Any plugins to be explicitly blocked/denied?

---

## Success Criteria (Definition of Done)

✅ **Minimum**:

- Plugin discovery working
- Toolbar buttons appear
- Example plugin executes successfully
- Tests passing

✅ **Target**:

- 3 working example plugins
- Full test coverage
- Documentation complete
- No extension performance impact

✅ **Stretch**:

- Hot reload on plugin file changes
- Plugin enable/disable toggle
- Settings UI

---

**Ready to implement?** Use this checklist and cross off items as you go.

Mark incomplete items as `[ ]`, in-progress as `[🔄]`, and done as `[✅]`.