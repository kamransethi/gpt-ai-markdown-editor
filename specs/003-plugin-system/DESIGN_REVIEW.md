# Plugin System - Design Review Document
**For Technical Validation & Improvement**

**Version:** 1.0  
**Date:** April 10, 2026  
**Purpose:** Critical review points, potential issues, and design alternatives

---

## 1. Design Review Checklist

### 1.1 Architecture Questions

#### Q: Is the hybrid extension/webview execution model robust?
**Current Design**: 
- Extension side: discovers plugins, handles HTTP/file system
- Webview side: manipulates document, shows dialogs
- Communication: async RPC via message passing

**Concerns**:
- Message ordering: What if multiple plugin requests fire simultaneously?
- Error propagation: If extension crashes, webview gets broken promise
- Timeout handling: What if fetch takes 30 seconds?

**Questions for Validator**:
- Should we implement a queue/priority system for concurrent plugin calls?
- Need explicit timeout handling for all async operations?
- Should there be a heartbeat check between extension ↔ webview?

---

#### Q: Plugin discovery via fs.readdirSync() - thread-safe?
**Current Design**: 
- On extension activate, scan `src/plugins/` synchronously
- Load plugin.ts via `require()`

**Concerns**:
- No hot-reload (file changes not detected)
- TypeScript files need compilation first (.ts → .js)
- Plugin load errors crash entire manager?

**Questions for Validator**:
- Should plugins be pre-built (esbuilt .js files) or just .ts?
- Is synchronous discovery acceptable for extension startup?
- How to handle transient file system errors during discovery?

---

#### Q: Dependency Injection via module-level `_injectAPI()` - testable?
**Current Design**:
```typescript
let _apiInstance: PluginAPI | null = null;

export function _injectAPI(api: PluginAPI): void {
  _apiInstance = api;
}
```

**Concerns**:
- Global state is hard to test
- Plugin `activate()` might store references to old API after reload
- What if multiple plugins load simultaneously?

**Questions for Validator**:
- Would passing API as parameter to `execute()` be better?
- Should activate/execute be class methods instead of functions?
- How to handle plugin state between reloads?

---

### 1.2 API Coverage Questions

#### Q: Is the PluginAPI surface complete?
**Currently Includes**:
- Document manipulation (getSelection, replaceSelection, insertAtCursor)
- User interaction (showDialog, showQuickPick, showMessage)
- Network (fetch)
- File system (readFile, writeFile)
- Settings (getConfig, setConfig)
- AI features (aiRefine, aiExplain)

**Potentially Missing**:
- Batch operations (replace multiple selections)
- Document events (onSelectionChange, onDocumentChange)
- Formatting rules (detect markdown syntax for list/table insertion)
- External commands (run shell commands, other extensions)
- Transactional edits (undo/redo grouping)
- Cursor manipulation (setSelection, gotoLine)

**Questions for Validator**:
- Which missing features are must-haves?
- Should document events be part of MVP?
- Can plugins call other VS Code extension APIs?

---

#### Q: Error handling strategy - too generic?
**Current Design**:
```typescript
try {
  await plugin.execute(opts);
} catch (error) {
  await api.showMessage('error', error.message);
}
```

**Concerns**:
- Swallows stack traces (hard to debug)
- Doesn't distinguish between plugin bugs vs. API errors
- No retry mechanism for transient failures

**Questions for Validator**:
- Should we log full error context to a debug log?
- Retry policy: should fetch() automatically retry on network errors?
- How to surface plugin bugs vs. config issues (e.g., bad API key)?

---

### 1.3 Security Questions

#### Q: Trust model insufficient for community plugins?
**Current Design**: 
- Plugins are code in repo → assumed trusted
- Full API access (no permissions)
- No sandboxing

**Concerns**:
- If community contributes plugins, what prevents malicious code?
- API keys in config.json stored as plain text
- Plugins can't be revoked without new extension version

**Questions for Validator**:
- Is plain-text config acceptable or need encryption?
- Should MVP include basic permission model?
- What's the audit trail for plugin changes?

---

#### Q: Network security - CORS proxying safe?
**Current Design**:
- All fetch() requests proxied through extension
- Extension has full network access

**Concerns**:
- Plugins could use fetch() to exfiltrate data
- No request validation before proxying
- Extension's IP becomes origin (site might throttle/block)

**Questions for Validator**:
- Should there be a list of allowed hosts?
- How to handle authentication (Bearer tokens)?
- Should headers be sanitized?

---

## 2. Implementation Concerns

### 2.1 TypeScript Compilation
**Issue**: `require(plugin.ts)` won't work - TS needs compilation

**Solutions**:
1. **Pre-build plugins** (esbuild in build script)
   - Pro: Fast load time, single .js file
   - Con: Extra build step, source maps needed for debugging

2. **Use ts-node** in extension 
   - Pro: Load .ts directly
   - Con: Adds runtime overhead, dependency bloat

3. **Plugin packages** (.js in npm)
   - Pro: Better distribution
   - Con: Different from bundled approach

**Recommendation**: Pre-built .js files in Phase 1, packages in Phase 2+

---

### 2.2 Message Router Integration
**Issue**: How to route plugin RPC messages?

**Current Handlers**:
```typescript
// messageRouter.ts in extension
router.register('plugin:replaceSelection', (msg, ctx) => {
  // What goes here?
});
```

**Design**:
```typescript
// Each plugin request gets a requestId
// Extension receives: {type: 'plugin:replaceSelection', requestId: '123', text: '...'}
// Extension processes, sends response: {type: 'plugin:response', requestId: '123', result: undefined}
// Webview correlates response to originating Promise

// Pseudocode:
const pendingRequests = new Map<string, (result) => void>();

webview.onDidReceiveMessage((msg) => {
  if (msg.type === 'plugin:response') {
    const resolve = pendingRequests.get(msg.requestId);
    resolve?.(msg.result);
  }
});

async function sendMessage(msg): Promise<any> {
  const requestId = uuid();
  msg.requestId = requestId;
  return new Promise((resolve) => {
    pendingRequests.set(requestId, resolve);
    webview.postMessage(msg);
  });
}
```

**Concern**: What if webview crashes before responding?  
**Solution**: Timeout + cleanup

---

### 2.3 Plugin Configuration Persistence

**Issue**: Where does user configure plugins (API keys, etc.)?

**Current Design**: File-based `plugin-config.json`

**Better Options**:
1. **VS Code workspace settings** (`.vscode/settings.json`)
   - Pro: User-friendly, integrates with VS Code UI
   - Con: Settings exposed in repo if committed

2. **User data directory** (`~/.editor/plugin-config.json`)
   - Pro: Machine-local, secure
   - Con: Manual editing required

3. **Settings UI inside editor**
   - Pro: Discoverable
   - Con: Requires plugin introspection (schema)

**Recommendation**: Start with user data directory, add UI in Phase 2

---

## 3. Alternative Designs Considered

### 3.1 Alternative: Plugin as Custom VS Code Command

**Design**: Instead of plugin system, just encourage extension via custom commands

```json
{
  "commands": [
    {
      "command": "extension.confluence.insert",
      "title": "Confluence: Insert Page"
    }
  ]
}
```

**Pros**:
- No new infrastructure
- Plugins are just `src/commands/`
- Built-in VS Code command palette

**Cons**:
- No lazy loading (all commands load on startup)
- No dialog/fetch helpers (plugins reimplement)
- Configuration scattered across package.json

**Verdict**: Too rigid. Plugin system better for third-party extensibility.

---

### 3.2 Alternative: Plugins as VS Code Extensions

**Design**: Make plugin SDK so third-party can write VS Code extensions

```typescript
// third-party/confluence-extension/extension.ts
import { MarkdownEditorAPI } from 'flux-flow-plugin-sdk';

export function activate(api: MarkdownEditorAPI) {
  api.registerPluginCommand({
    id: 'confluence',
    execute: async () => { /*...*/ }
  });
}
```

**Pros**:
- Full VS Code API access
- Npm distribution
- Visual Studio Marketplace

**Cons**:
- Complex setup (separate extension)
- Dependency management nightmare
- Overkill for simple plugins

**Verdict**: Good for Phase 3+, start with bundled plugins

---

### 3.3 Alternative: Plugin Sandboxing via Web Worker

**Design**: Run plugins in isolated web worker thread

```typescript
const worker = new Worker('plugin-runtime.js');
worker.postMessage({ cmd: 'execute', plugin: 'confluence' });
worker.onmessage = (evt) => {
  if (evt.data.type === 'api-call') {
    // Handle API call from worker
  }
};
```

**Pros**:
- True isolation (can't modify globals)
- Easy permission control
- Natural async boundary

**Cons**:
- Slow IPC overhead
- Worker setup complexity
- Debugging harder

**Verdict**: Overkill for MVP, consider Phase 3

---

## 4. Potential Issues & Mitigations

### Issue 4.1: Plugin Conflicts
**Problem**: Two plugins register same command ID

**Current Handling**: Silent overwrite (warning in console)

**Better**:
```typescript
if (handlers.has(type)) {
  vscode.window.showErrorMessage(
    `Plugin conflict: two plugins registered "${type}". 
     Disable one in your plugins/ directory.`
  );
  return false; // Fail loudly
}
```

---

### Issue 4.2: Memory Leaks from Plugin References
**Problem**: If plugin holds reference to API instance, persists after disable

**Current Handling**: No unload mechanism

**Better**:
```typescript
export interface LoadedPlugin {
  // ...
  unload?: () => Promise<void>; // Optional cleanup hook
}

async function unloadPlugin(id: string) {
  const plugin = this.plugins.get(id);
  await plugin.unload?.();
  plugin.loaded = false;
}
```

---

### Issue 4.3: Race Conditions in Document Edits
**Problem**: Two plugins try to replace same selection simultaneously

**Current Handling**: Last write wins

**Better**:
```typescript
// Implement operation sequencing / document versioning
// Each edit includes expectedDocumentVersion
// Reject if document changed since plugin started
```

---

### Issue 4.4: Plugin Initialization Order
**Problem**: Plugin A depends on output of Plugin B

**Current Handling**: No dependency system

**Better**: Defer to Phase 3, document for plugin authors

---

## 5. Performance Considerations

### 5.1 Extension Startup Impact
- Plugin discovery: ~100ms for 10 plugins
- Plugin activation: Deferred (lazy), only on first use

**Mitigation**: Do discovery async, don't block extension activation

---

### 5.2 Message Passing Overhead
- Each API call = 2 messages (request + response)
- High-frequency operations (document scan) could be slow

**Mitigation**: 
- Batch API: `getDocumentLines(start, end)` instead of line-by-line
- Cache: Plugin can fetch once and manipulate locally

---

### 5.3 Memory Usage
- Each plugin instance in memory (even if not active)

**Mitigation**: Unload plugins not used (Phase 3)

---

## 6. Testing Recommendations

### 6.1 Critical Tests
- ✅ Plugin discovery (valid/invalid plugins)
- ✅ Lazy loading (plugin only loaded on first execute)
- ✅ Message routing (request → response correlation)
- ✅ API injection (mock API works)
- ✅ Error handling (plugin crash doesn't crash extension)
- ✅ Concurrent plugin execution (multiple plugins at once)
- ✅ Configuration persistence

### 6.2 Integration Tests
- ✅ E2E Confluence plugin (fetch → insert)
- ✅ E2E JIRA plugin (dialog → create → insert)
- ✅ Plugin calling AI features (refine/explain)

### 6.3 Stress Tests
- 10 plugins loading simultaneously
- 1000-line document with plugin performing bulk edits
- Network timeout during fetch

---

## 7. Roadmap Questions

### Q1: Should MVP include hot-reload?
**Pros**: Faster dev iteration  
**Cons**: Complex (file watcher, unload logic)  
**Recommendation**: Phase 2 (not MVP)

---

### Q2: Should MVP include permission model?
**Pros**: Security by default  
**Cons**: Added complexity, slows down Phase 1  
**Recommendation**: Phase 3 (for community plugins)

---

### Q3: Should Confluence/JIRA be bundled or examples?
**Pros (bundled)**: Users get value immediately  
**Cons (bundled)**: Maintenance burden, API key management  
**Recommendation**: Start as examples in Phase 1, optionally ship in Phase 2

---

## 8. Questions for Validator

### High Priority
1. Does the RPC message protocol handle concurrency?
2. Is dependency injection pattern suitable or should we use class instances?
3. Should plugin API versioning be included in MVP?
4. How to handle plugin crashes/hangs?

### Medium Priority
5. Are example plugins realistic enough?
6. Missing critical API surface?
7. Configuration approach secure enough?
8. Hot-reload worth adding to MVP?

### Low Priority
9. Should plugins be packaged as npm modules?
10. Future plugin marketplace strategy?

---

## 9. Success Metrics

**Phase 1 Complete When**:
- [ ] 3 example plugins working (Confluence, JIRA, Template)
- [ ] Plugin discovery automation test passing
- [ ] E2E test successful (user clicks button → content inserted)
- [ ] Error handling tested (plugin crash handled gracefully)
- [ ] Documentation complete (plugin developer guide)

---

**This document awaits technical review by advanced LLM.**  
**Please validate architecture, identify missing pieces, and suggest improvements.**
