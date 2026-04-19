# Plugin System - README & Quick Start
**For Plugin Developers**

---

## What is This?

A plugin system for **Flux Flow Markdown Editor** that allows you to:
- Add toolbar buttons with icons
- Add right-click context menu items  
- Transform/replace selected text or insert at cursor
- Call external APIs (Confluence, JIRA, etc.)
- Show dialogs for user input
- Access document state

## Quick Example

```typescript
// src/plugins/confluence/plugin.ts

import { PluginManifest, PluginExecute } from '@shared/pluginAPI';
import { getPluginAPI } from '@plugins/base';

export const manifest: PluginManifest = {
  id: 'confluence',
  name: 'Confluence',
  icon: 'globe',
  tooltip: 'Fetch and insert Confluence page',
  toolbar: true,
  contextMenu: true,
};

export const execute: PluginExecute = async (opts) => {
  const api = getPluginAPI();
  
  // Show input dialog
  const result = await api.showDialog({
    title: 'Insert from Confluence',
    fields: [{
      id: 'url',
      label: 'Confluence URL',
      type: 'url',
      required: true,
    }]
  });
  
  // Fetch page
  const response = await api.fetch(result.url);
  const html = await response.text();
  
  // Convert HTML to Markdown & insert
  const markdown = convertToMarkdown(html);
  await api.insertAtCursor(markdown);
};
```

That's it! Your button appears in the toolbar automatically.

---

## File Structure

```
src/
├── plugins/                      # Your plugin directory
│   ├── confluence/
│   │   ├── plugin.ts            # Main code
│   │   ├── config.json          # Optional config
│   │   └── plugin.test.ts       # Tests
│   ├── jira/
│   │   └── plugin.ts
│   └── README.md                # Plugin development guide
├── shared/
│   ├── pluginAPI.ts             # Plugin interface (API you use)
│   └── pluginMessages.ts        # RPC message types
├── pluginManager.ts             # Auto-discovery & execution
├── pluginRuntime.ts             # API implementation
└── extension.ts                 # Registration
```

---

## Plugin API Reference

### Document Manipulation
```typescript
const text = await api.getSelectedText();
const docText = await api.getDocumentText();
await api.replaceSelection('new text');
await api.insertAtCursor('text at cursor');
const { line, character } = await api.getCursorPosition();
```

### User Dialogs
```typescript
// Input form
const result = await api.showDialog({
  title: 'My Dialog',
  fields: [
    { id: 'email', label: 'Email', type: 'text', required: true },
    { id: 'notes', label: 'Notes', type: 'textarea' }
  ]
});
// result = { email: 'user@example.com', notes: '...' }

// Dropdown picker
const item = await api.showQuickPick([
  { label: 'Option A', value: 'a' },
  { label: 'Option B', value: 'b' }
]);

// Notifications
await api.showMessage('info', 'Success!');
await api.showMessage('error', 'Something went wrong');
```

### Network
```typescript
const response = await api.fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer TOKEN' },
  body: JSON.stringify({ key: 'value' })
});

const data = await response.json();
```

### Files & Settings
```typescript
const content = await api.readFile('/path/to/file.md');
await api.writeFile('/path/to/file.md', 'new content');

const apiKey = api.getConfig('apiKey');
await api.setConfig('apiKey', 'secret-123');
```

### Logging
```typescript
api.log('info', 'Plugin started');
api.log('error', 'Failed to fetch: ' + error.message);
```

---

## How It Works

### 1. Discovery
When the extension loads, it scans `src/plugins/` for directories with `plugin.ts` files.

### 2. Registration
Each plugin's manifest is read → toolbar buttons & context menu items created automatically.

### 3. Lazy Loading
Plugin code only loads when user clicks the button.

### 4. Execution
```
User clicks button
  ↓
pluginManager.executePlugin('confluence')
  ↓
plugin.ts execute() function runs
  ↓
Plugin calls API (e.g., api.showDialog())
  ↓
Request sent to extension (Node.js side)
  ↓
Extension handles (shows dialog in webview)
  ↓
User responds
  ↓
Response sent back to plugin
  ↓
Plugin processes response
  ↓
Plugin calls api.insertAtCursor()
  ↓
Text inserted in editor
```

---

## Creating Your First Plugin

### Step 1: Create directory
```bash
mkdir src/plugins/my-plugin
touch src/plugins/my-plugin/plugin.ts
```

### Step 2: Write minimal plugin
```typescript
import { PluginManifest, PluginExecute } from '@shared/pluginAPI';
import { getPluginAPI } from '@plugins/base';

export const manifest: PluginManifest = {
  id: 'my-plugin',
  name: 'My Plugin',
  icon: 'star',
};

export const execute: PluginExecute = async (opts) => {
  const api = getPluginAPI();
  await api.insertAtCursor('Hello from my plugin!');
};
```

### Step 3: Test
1. Reload extension
2. Look for "My Plugin" button in toolbar
3. Click it

Done!

---

## Common Patterns

### Pattern 1: Input + Transform + Insert
```typescript
export const execute = async (opts) => {
  const api = getPluginAPI();
  
  // Get user input
  const prompt = await api.showDialog({
    title: 'Transform Text',
    fields: [{ id: 'instruction', label: 'How to transform?', type: 'textarea' }]
  });
  
  // Get selected text
  const selectedText = await api.getSelectedText();
  
  // Transform (call API, AI, etc.)
  const transformed = await callSomeAPI(selectedText, prompt.instruction);
  
  // Replace
  await api.replaceSelection(transformed);
};
```

### Pattern 2: API Integration
```typescript
export const execute = async (opts) => {
  const api = getPluginAPI();
  
  // Get config
  const apiKey = api.getConfig('jira_api_key');
  const baseUrl = api.getConfig('jira_base_url');
  
  if (!apiKey) {
    await api.showMessage('error', 'Configure JIRA API key in plugin settings');
    return;
  }
  
  // Make request
  const response = await api.fetch(`${baseUrl}/rest/api/3/projects`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const projects = await response.json();
  // ...
};
```

### Pattern 3: Multi-step Workflow
```typescript
export const execute = async (opts) => {
  const api = getPluginAPI();
  
  // Step 1: Select project
  const projects = await fetchProjects();
  const project = await api.showQuickPick(projects);
  
  if (!project) return; // User cancelled
  
  // Step 2: Fill in details
  const details = await api.showDialog({
    title: `Create issue in ${project.label}`,
    fields: [
      { id: 'summary', label: 'Summary', type: 'text', required: true },
      { id: 'description', label: 'Description', type: 'textarea' }
    ]
  });
  
  // Step 3: Submit
  const issue = await api.fetch(`${baseUrl}/issue`, {
    method: 'POST',
    body: JSON.stringify({ project_key: project.value, ...details })
  });
  
  // Step 4: Insert result
  const link = `[${issue.key}](${baseUrl}/browse/${issue.key})`;
  await api.insertAtCursor(link);
};
```

---

## Error Handling

Always wrap in try-catch:

```typescript
export const execute = async (opts) => {
  const api = getPluginAPI();
  
  try {
    const result = await api.showDialog({ /* ... */ });
    const response = await api.fetch(someUrl);
    // ... do work
  } catch (error) {
    api.log('error', `Plugin failed: ${error.message}`);
    await api.showMessage('error', `Error: ${error.message}`);
  }
};
```

---

## Configuration

Create `src/plugins/my-plugin/config.json`:

```json
{
  "api_key": "your-key-here",
  "base_url": "https://api.example.com",
  "timeout_ms": 5000
}
```

Access in plugin:
```typescript
const apiKey = api.getConfig('api_key');
const baseUrl = api.getConfig('base_url', 'https://default.com');
```

Write settings:
```typescript
await api.setConfig('api_key', 'new-key');
```

---

## Testing Your Plugin

```typescript
// src/plugins/my-plugin/plugin.test.ts

import { manifest, execute } from './plugin';

describe('my-plugin', () => {
  it('should have valid manifest', () => {
    expect(manifest.id).toBe('my-plugin');
    expect(manifest.name).toBeDefined();
  });
  
  it('should handle errors gracefully', async () => {
    const mockAPI = {
      insertAtCursor: jest.fn(),
      showMessage: jest.fn(),
      // ... other mocks
    };
    
    // Inject mock API
    // execute will use it
    
    await execute({});
    
    expect(mockAPI.insertAtCursor).toHaveBeenCalled();
  });
});
```

---

## Troubleshooting

### Plugin not appearing in toolbar
- Check `plugin.ts` exports `manifest` and `execute`
- Check `manifest.id` is unique (no duplicates)
- Reload extension with `Ctrl+Shift+P` → "Extension Development Host: Reload Window"

### Plugin crashes extension
- Check console for error messages
- Use try-catch in execute()
- Enable debug logging: `api.log('debug', 'trace')`

### API call returns 403/401
- Check API key in config.json
- Check authorization headers
- Use `api.log()` to debug request details

---

## Specs & Documentation

- **Main Spec**: [specs/003-plugin-system/spec.md](./spec.md)
- **Design Review**: [specs/003-plugin-system/DESIGN_REVIEW.md](./DESIGN_REVIEW.md)
- **Plugin API Types**: [src/shared/pluginAPI.ts](../../src/shared/pluginAPI.ts)

---

## What's Next?

Phase 1 (In Progress):
- ✅ Plugin discovery
- ✅ Toolbar registration
- [ ] Example plugins (Confluence, JIRA)
- [ ] Full test coverage

Phase 2 (Future):
- Plugin settings UI
- Hot reload
- Plugin enable/disable toggle

Phase 3 (Late):
- Permission model
- Sandboxing
- Plugin marketplace

---

**Questions?** Check the full [DESIGN_REVIEW.md](./DESIGN_REVIEW.md) for deep dives.
