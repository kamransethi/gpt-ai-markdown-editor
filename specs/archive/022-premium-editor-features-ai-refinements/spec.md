# Spec 022: Premium Editor Features &amp; AI Refinements

**Status:** ✅ Implemented &amp; Shipped  
**PRD Domains**: `ai-features`, `editor-core`  
**Date:** April 18, 2026  
**Version:** 2.0.30+  
**Implementation Complexity:** Medium-High  
**Estimated Effort:** 4 hours  

## Quick Summary For AI Implementation

This spec documents four interconnected features that enable users to customize AI actions and improve document navigation. An AI agent implementing this should:

1. Install the drag handle library and update extensions
2. Create two new cache/loader files (backend + frontend)
3. Add message types and handlers for IPC communication
4. Update settings UI with file browser and open button
5. Modify AI dropdown menu to show custom prompts
6. Wire up dynamic prompt selection in backend

**All files are small and focused; no major refactoring needed.**

## Overview &amp; Architecture

This spec documents the implementation of premium editor features inspired by Novel.sh and enhanced AI command architecture:

1. **Global Drag Handles** — Notion-style block dragging via `tiptap-extension-global-drag-handle`
2. **Custom AI Prompts System** — JSON-based configurable prompts for document-level AI actions
3. **Document-Wide AI Commands** — Top toolbar menu with dynamic custom prompts
4. **Settings File Management** — Browse/open JSON prompts files from VS Code settings
5. **Dynamic Prompt Selection** — Backend routes to correct system prompts based on actionId

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Complete Architecture](#complete-architecture)
3. [File-by-File Implementation](#file-by-file-implementation)
4. [New Files to Create](#new-files-to-create)
5. [Step-by-Step Implementation](#step-by-step-implementation)
6. [Code Examples](#code-examples)
7. [Testing Guide](#testing-guide)

---

## Quick Reference

### Dependencies to Install

```bash
npm install tiptap-extension-global-drag-handle@0.1.18
```

### New Files

- `src/features/aiPrompts.ts` (~150 lines)
- `src/webview/features/aiPromptsLoader.ts` (~20 lines)

### Modified Files


| File                                        | Change Type         | Lines |
| ------------------------------------------- | ------------------- | ----- |
| `package.json`                              | Add setting         | +8    |
| `src/shared/messageTypes.ts`                | Add message types   | +3    |
| `src/editor/SettingsPanel.ts`               | Add handler + key   | +30   |
| `src/webview/settings/settingsPanel.ts`     | Add UI + button     | +50   |
| `src/webview/extensions/draggableBlocks.ts` | Replace impl        | ~20   |
| `src/webview/extensions/aiExplain.ts`       | Accept actionId     | +10   |
| `src/features/aiExplain.ts`                 | Load custom prompts | +20   |
| `src/webview/BubbleMenuView.ts`             | AI dropdown menu    | +30   |
| `src/webview/editor.ts`                     | Init + handlers     | +15   |


### Message Flow Summary

```
User opens AI Actions menu
  ↓ BubbleMenuView.items() called
  ↓ getCachedAiPrompts() returns custom prompts
  ↓ Custom prompts filtered by type='document'
  ↓ User clicks custom prompt
  ↓ postMessage(AI_EXPLAIN, actionId=prompt.id)
  ↓ Backend: getPromptById(actionId) → custom system+task prompts
  ↓ LLM streams response back as AI_EXPLAIN_RESULT chunks
  ↓ Result displays in AI Summary panel
```

---

## Complete Architecture

### System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                  VS Code Extension Host                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  package.json                                                 │
│  └─ "customPromptsFile" setting in configuration schema      │
│                                                               │
│  SettingsPanel.ts (new handler)                              │
│  ├─ MSG.OPEN_FILE case → vscode.window.showTextDocument()   │
│  └─ Handles BROWSE_PATH → returns file path to webview      │
│                                                               │
│  aiPrompts.ts (NEW FILE)                                      │
│  ├─ Loads JSON from customPromptsFile config path           │
│  ├─ Caches in memory                                         │
│  ├─ Watches file for changes (500ms debounce)              │
│  ├─ Export: getCustomPrompts() → Promise<any[]>            │
│  └─ Export: getPromptById(id) → any | null                 │
│                                                               │
│  MarkdownEditorProvider.ts (existing)                         │
│  └─ Handles GET_AI_PROMPTS → imports aiPrompts module       │
│     ├─ Calls getCustomPrompts()                             │
│     ├─ Returns via postMessage(AI_PROMPTS, [...])           │
│                                                               │
│  aiExplain.ts (updated)                                       │
│  ├─ handleAiExplainRequest() now accepts optional actionId  │
│  ├─ If actionId: getPromptById(actionId) for custom system  │
│  ├─ Streams response back via AI_EXPLAIN_RESULT              │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                           ↕ IPC (postMessage)
                    (see Message Types section)
┌──────────────────────────────────────────────────────────────┐
│                    Webview (Browser)                         │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  settingsPanel.ts (webview)                                   │
│  ├─ renderPathInput() creates: input + Browse + Open buttons │
│  ├─ Browse button: postMessage(BROWSE_PATH)                  │
│  ├─ Open button: postMessage(OPEN_FILE, filePath)            │
│  ├─ Listen: BROWSE_PATH_RESULT → update input value         │
│  └─ Listen: UPDATE_SETTING → write to vscode config         │
│                                                               │
│  aiPromptsLoader.ts (NEW FILE)                                │
│  ├─ initAiPrompts() → postMessage(GET_AI_PROMPTS)           │
│  ├─ handleAiPromptsResult() → cache in memory               │
│  ├─ Export: getCachedAiPrompts() → any[]                    │
│  └─ Fire 'aiPromptsLoaded' event after cache updates        │
│                                                               │
│  editor.ts (main entry)                                       │
│  ├─ On vscode API ready: initAiPrompts()                    │
│  ├─ Listen: AI_PROMPTS → call handleAiPromptsResult()       │
│  ├─ Listen: 'aiPromptsLoaded' → trigger toolbar rebuild     │
│  ├─ Register: AiExplain extension                            │
│  └─ Register: DraggableBlocks extension                      │
│                                                               │
│  BubbleMenuView.ts (toolbar)                                 │
│  ├─ AI Actions dropdown                                       │
│  │  ├─ icon: sparkle (✨) on button ONLY                     │
│  │  ├─ items: () → dynamic function (re-evaluated each open) │
│  │  ├─ Call: getCachedAiPrompts()                           │
│  │  ├─ Filter: p.type === 'document'                        │
│  │  ├─ Build: items = [Generate Summary, ...customPrompts]  │
│  │  └─ No icons on menu items                               │
│  └─ On item click: postMessage(AI_EXPLAIN, actionId)        │
│                                                               │
│  aiExplain.ts (webview extension)                            │
│  ├─ explainDocument(actionId?) command                      │
│  ├─ If no actionId: default summary                         │
│  ├─ If actionId: use custom system prompt                   │
│  └─ Stream response from backend                            │
│                                                               │
│  draggableBlocks.ts (webview extension)                      │
│  ├─ Import GlobalDragHandle from library                    │
│  ├─ Configure and export as extension                       │
│  └─ Registered in editor.ts extensions array               │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### IPC Message Types (add to src/shared/messageTypes.ts)

```typescript
export const MessageType = {
  // ... existing types ...
  
  // NEW TYPES:
  GET_AI_PROMPTS: 'getAiPrompts',           // webview→host: request prompts
  AI_PROMPTS: 'aiPrompts',                  // host→webview: send prompts list
  OPEN_FILE: 'settings.openFile',           // webview→host: open file in editor
  
  // EXISTING (unchanged):
  AI_EXPLAIN: 'aiExplain',                  // webview→host: with optional actionId
  AI_EXPLAIN_RESULT: 'aiExplainResult',     // host→webview: stream chunks
};
```

### Configuration Schema (add to package.json)

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "gptAiMarkdownEditor.customPromptsFile": {
          "type": "string",
          "default": "",
          "description": "Optional path to a JSON file containing custom 'Ask AI' dropdown prompts."
        }
      }
    }
  }
}
```

---

## File-by-File Implementation

### 1. NEW FILE: `src/features/aiPrompts.ts`

**Purpose:** Load and cache custom prompts from JSON file

**Full Implementation:**

```typescript
/**
 * Custom AI Prompts Loader
 * 
 * Loads prompts from a user-configured JSON file with file watching.
 * Caches prompts in memory for quick access.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_SECTION = 'gptAiMarkdownEditor';
let cachedPrompts: any[] = [];
let fileWatcher: fs.FSWatcher | null = null;
let lastWatchTime = 0;

/**
 * Load custom prompts from configured JSON file
 * Returns empty array if not configured or file doesn't exist
 */
export async function getCustomPrompts(): Promise<any[]> {
  try {
    const configPath = vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .get<string>('customPromptsFile');
    
    if (!configPath) {
      console.log('[DK-AI] No custom prompts file configured');
      return [];
    }

    const expandedPath = expandPath(configPath);
    
    if (!fs.existsSync(expandedPath)) {
      console.warn(`[DK-AI] Custom prompts file not found: ${expandedPath}`);
      return [];
    }

    const content = fs.readFileSync(expandedPath, 'utf-8');
    const data = JSON.parse(content);
    
    cachedPrompts = Array.isArray(data.prompts) ? data.prompts : [];
    console.log(`[DK-AI] Loaded ${cachedPrompts.length} custom prompts`);
    
    setupFileWatcher(expandedPath);
    return cachedPrompts;
  } catch (error) {
    console.error('[DK-AI] Failed to load custom prompts:', error);
    cachedPrompts = [];
    return [];
  }
}

/**
 * Get prompt by ID from cache
 */
export function getPromptById(id: string): any | null {
  const prompt = cachedPrompts.find((p: any) => p.id === id);
  if (!prompt) {
    console.warn(`[DK-AI] Prompt not found: ${id}`);
  }
  return prompt || null;
}

/**
 * Watch file for changes and reload prompts
 */
function setupFileWatcher(filePath: string): void {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }

  try {
    fileWatcher = fs.watch(filePath, (eventType) => {
      // Debounce rapid changes (500ms)
      const now = Date.now();
      if (now - lastWatchTime < 500) {
        return;
      }
      lastWatchTime = now;

      console.log('[DK-AI] Custom prompts file changed, reloading...');
      getCustomPrompts().catch(console.error);
    });
  } catch (error) {
    console.warn('[DK-AI] Failed to setup file watcher:', error);
  }
}

/**
 * Expand ~ and environment variables in path
 */
function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(require('os').homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Cleanup on extension deactivation
 */
export function cleanup(): void {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
}
```

### 2. NEW FILE: `src/webview/features/aiPromptsLoader.ts`

**Purpose:** Cache prompts on webview side

**Full Implementation:**

```typescript
/**
 * Frontend AI Prompts Loader
 * 
 * Maintains cached copy of prompts from backend.
 * Fires event when prompts are updated.
 */

import { MessageType } from '../../shared/messageTypes';

let cachedPrompts: any[] = [];

/**
 * Get currently cached prompts
 */
export function getCachedAiPrompts(): any[] {
  return cachedPrompts;
}

/**
 * Request prompts from backend and setup listener
 */
export function initAiPrompts(): void {
  const vscodeApi = (window as any).vscode;
  if (!vscodeApi) {
    console.warn('[DK-AI] vscode API not available');
    return;
  }

  console.log('[DK-AI] Requesting AI prompts from backend');
  vscodeApi.postMessage({ type: MessageType.GET_AI_PROMPTS });

  // Setup handler for AI_PROMPTS response
  (window as any).handleAiPromptsResult = (prompts: any[]) => {
    cachedPrompts = prompts || [];
    console.log(`[DK-AI] Cached ${cachedPrompts.length} AI prompts`);
    
    // Notify listeners that prompts have been loaded
    window.dispatchEvent(new CustomEvent('aiPromptsLoaded'));
  };
}
```

### 3. MODIFY: `src/shared/messageTypes.ts`

Add these three lines to the MessageType object:

```typescript
GET_AI_PROMPTS: 'getAiPrompts',
AI_PROMPTS: 'aiPrompts',
OPEN_FILE: 'settings.openFile',
```

### 4. MODIFY: `src/editor/SettingsPanel.ts`

**Add to SETTING_KEYS array:**

```typescript
const SETTING_KEYS = [
  'themeOverride',
  'editorZoomLevel',
  'editorWidth',
  // ... existing ...
  'customPromptsFile',  // ← ADD THIS
];
```

**Add to MSG object:**

```typescript
const MSG = {
  // ... existing ...
  OPEN_FILE: 'settings.openFile',  // ← ADD THIS
} as const;
```

**Add handler in message case statement (after BROWSE_PATH case):**

```typescript
case MSG.OPEN_FILE: {
  const filePath = msg.filePath as string;
  if (!filePath) {
    vscode.window.showErrorMessage('No file path configured');
    break;
  }
  try {
    const uri = vscode.Uri.file(filePath);
    await vscode.window.showTextDocument(uri);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to open file: ${errMsg}`);
  }
  break;
}
```

### 5. MODIFY: `src/webview/settings/settingsPanel.ts`

**Add to MSG object:**

```typescript
const MSG = {
  // ... existing ...
  OPEN_FILE: 'settings.openFile',  // ← ADD THIS
} as const;
```

**Add Custom Prompts section to settings panel config:**

Find the settings array in `getSettingsPanelConfig()` and add:

```typescript
{
  title: 'Custom Prompts',
  items: [
    {
      key: 'customPromptsFile',
      label: 'Custom AI Prompts File',
      description: 'Optional path to a JSON file containing custom "Ask AI" dropdown prompts.',
      type: 'path',
      placeholder: 'Select a JSON file...',
      default: '',
      pathType: 'file',
      filters: { 'JSON Files': ['json'] }
    },
  ],
},
```

**Update renderPathInput() function:**

Replace the entire function with:

```typescript
function renderPathInput(def: SettingDef, value: string): HTMLElement {
  const group = el('div', 'settings-input-group');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'settings-input';
  input.value = value || '';
  input.placeholder = def.placeholder || '';

  // Update setting on input (debounced)
  let debounceTimer: ReturnType<typeof setTimeout>;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateSetting(def.key, input.value);
    }, 400);
  });

  // Browse button
  const browseBtn = document.createElement('button');
  browseBtn.className = 'settings-btn';
  browseBtn.textContent = 'Browse…';
  browseBtn.addEventListener('click', () => {
    pendingBrowseKey = def.key;
    pendingBrowseInput = input;
    vscode.postMessage({
      type: MSG.BROWSE_PATH,
      settingKey: def.key,
      pathType: def.pathType || 'file',
      filters: def.filters,
    });
  });

  // Open button (NEW)
  const openBtn = document.createElement('button');
  openBtn.className = 'settings-btn';
  openBtn.textContent = 'Open';
  openBtn.disabled = !input.value;  // Disabled if no path
  openBtn.addEventListener('click', () => {
    vscode.postMessage({
      type: MSG.OPEN_FILE,
      filePath: input.value,
    });
  });

  // Enable/disable Open button based on input value
  input.addEventListener('input', () => {
    openBtn.disabled = !input.value;
  });

  group.appendChild(input);
  group.appendChild(browseBtn);
  group.appendChild(openBtn);  // NEW
  return group;
}
```

### 6. MODIFY: `src/webview/extensions/draggableBlocks.ts`

Replace entire file with:

```typescript
/**
 * Draggable Blocks Extension
 * 
 * Provides Notion-style drag handles for all block types using
 * the tiptap-extension-global-drag-handle library.
 */

import GlobalDragHandle from 'tiptap-extension-global-drag-handle';

export const DraggableBlocks = GlobalDragHandle.configure({
  dragHandleWidth: 24,
});
```

### 7. MODIFY: `src/webview/extensions/aiExplain.ts`

Update the `explainDocument` command to accept optional `actionId`:

```typescript
export const AiExplain = Command.create({
  name: 'explainDocument',
  run({ editor, commands }) {
    return ({ actionId }: { actionId?: string } = {}) => {
      const documentText = editor.getText();
      if (!documentText.trim()) {
        return;
      }

      const vscodeApi = (window as any).vscode;
      if (!vscodeApi) {
        console.error('[DK-AI] vscode API not available');
        return;
      }

      vscodeApi.postMessage({
        type: MessageType.AI_EXPLAIN,
        content: documentText,
        actionId,  // ← PASS ACTIONID
      });
    };
  },
});
```

### 8. MODIFY: `src/features/aiExplain.ts`

Update the handler to load custom prompts:

```typescript
export async function handleAiExplainRequest(
  webview: vscode.Webview,
  data: {
    content: string;
    actionId?: string;
  },
  document?: vscode.TextDocument
): Promise<void> {
  const { content, actionId } = data;

  try {
    // Load system and task prompts
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    let taskPrompt = DEFAULT_TASK_PROMPT;

    if (actionId) {
      const { getPromptById } = await import('./aiPrompts');
      const customPrompt = getPromptById(actionId);
      
      if (customPrompt) {
        systemPrompt = customPrompt.systemPrompt;
        taskPrompt = customPrompt.taskPrompt;
        console.log(`[DK-AI] Using custom prompt: ${actionId}`);
      } else {
        console.warn(`[DK-AI] Prompt not found: ${actionId}`);
      }
    }

    // Stream response
    const stream = await getLmStream(systemPrompt, taskPrompt, content);
    
    let fullText = '';
    for await (const chunk of stream) {
      fullText += chunk;
      webview.postMessage({
        type: MessageType.AI_EXPLAIN_RESULT,
        success: true,
        content: fullText,
        chunk,
      });
    }
  } catch (error) {
    console.error('[DK-AI] AI Explain error:', error);
    webview.postMessage({
      type: MessageType.AI_EXPLAIN_RESULT,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
```

### 9. MODIFY: `src/webview/BubbleMenuView.ts`

**Add import at top:**

```typescript
import { getCachedAiPrompts } from './features/aiPromptsLoader';
```

**Replace AI Actions dropdown in toolbar items:**

```typescript
{
  type: 'dropdown',
  label: '',
  title: 'AI Actions',
  icon: { name: 'sparkle', fallback: '✨' },  // Only on button
  requiresFocus: false,
  isActive: () => false,
  isEnabled: () => true,
  items: () => {
    const prompts = getCachedAiPrompts();
    const items: ToolbarDropdownItem[] = [
      {
        label: 'Generate Summary',
        // NO ICON - menu items have no icons
        action: () => editor.commands.explainDocument(),
      },
    ];
    
    // Add custom document-level prompts
    if (prompts && prompts.length > 0) {
      const documentPrompts = prompts.filter((p: any) => p.type === 'document');
      if (documentPrompts.length > 0) {
        items.push({ isSeparator: true });
        documentPrompts.forEach((prompt: any) => {
          items.push({
            label: prompt.label,
            // NO ICON - menu items have no icons
            action: () => editor.commands.explainDocument(prompt.id),
          });
        });
      }
    }
    
    return items;
  },
},
```

### 10. MODIFY: `src/webview/editor.ts`

**Add import:**

```typescript
import { initAiPrompts } from './features/aiPromptsLoader';
import { DraggableBlocks } from './extensions/draggableBlocks';
```

**In editor initialization (after vscode API is ready), add:**

```typescript
initAiPrompts();

// Listen for prompts loaded event and rebuild toolbar
window.addEventListener('aiPromptsLoaded', () => {
  console.log('[DK-AI] Prompts loaded, rebuilding toolbar');
  // Trigger toolbar rebuild
  (window as any).dispatchEvent(new Event('toolbarNeedsRebuild'));
});
```

**Add to extensions array in createEditor():**

```typescript
extensions: [
  // ... existing extensions ...
  DraggableBlocks,  // ← ADD THIS
]
```

**Add message handler (in the message switch statement):**

```typescript
case MessageType.AI_PROMPTS:
  if (window.handleAiPromptsResult) {
    window.handleAiPromptsResult(message.prompts);
  }
  break;
```

### 11. MODIFY: `src/editor/MarkdownEditorProvider.ts`

**Add handler for GET_AI_PROMPTS:**

Find the message routing switch statement and add:

```typescript
case MessageType.GET_AI_PROMPTS:
  import('../features/aiPrompts').then(m => m.getCustomPrompts().then(prompts => {
    webview.postMessage({
      type: MessageType.AI_PROMPTS,
      prompts
    });
  })).catch(err => {
    console.error('[DK-AI] Failed to get prompts:', err);
    webview.postMessage({
      type: MessageType.AI_PROMPTS,
      prompts: []
    });
  });
  break;
```

### 12. MODIFY: `package.json`

Add to `contributes.configuration.properties`:

```json
"gptAiMarkdownEditor.customPromptsFile": {
  "type": "string",
  "default": "",
  "description": "Optional path to a JSON file containing custom 'Ask AI' dropdown prompts."
}
```

---

## Step-by-Step Implementation

### Step 1: Install Dependency

```bash
npm install tiptap-extension-global-drag-handle@0.1.18
```

### Step 2: Update Message Types (5 min)

- Edit `src/shared/messageTypes.ts`
- Add 3 new message type constants

### Step 3: Create New Files (30 min)

- Create `src/features/aiPrompts.ts` (copy from implementation guide)
- Create `src/webview/features/aiPromptsLoader.ts` (copy from implementation guide)

### Step 4: Update Settings Panel Backend (15 min)

- Add to `src/editor/SettingsPanel.ts`:
  - MSG.OPEN_FILE constant
  - OPEN_FILE handler
  - 'customPromptsFile' to SETTING_KEYS

### Step 5: Update Settings UI Webview (20 min)

- Add to `src/webview/settings/settingsPanel.ts`:
  - MSG.OPEN_FILE constant
  - Custom Prompts section to panel config
  - Open button to renderPathInput()

### Step 6: Update Drag Handles (10 min)

- Replace `src/webview/extensions/draggableBlocks.ts`
- Import GlobalDragHandle, export configured extension

### Step 7: Wire Up Editor (20 min)

- Update `src/webview/editor.ts`:
  - Import aiPromptsLoader and DraggableBlocks
  - Call initAiPrompts() on startup
  - Add message handlers
  - Register DraggableBlocks extension

### Step 8: Update AI Explain (15 min)

- Modify `src/webview/extensions/aiExplain.ts` to accept actionId
- Modify `src/features/aiExplain.ts` to load custom prompts

### Step 9: Update Toolbar (20 min)

- Modify `src/webview/BubbleMenuView.ts`:
  - Import getCachedAiPrompts
  - Replace AI Actions dropdown with dynamic items

### Step 10: Update Message Router (5 min)

- Add GET_AI_PROMPTS handler to `src/editor/MarkdownEditorProvider.ts`

### Step 11: Update Package Config (3 min)

- Add customPromptsFile to `package.json` configuration schema

### Step 12: Build &amp; Test (30 min)

```bash
npm run build:debug
# Test each feature manually
```

**Total Time:** ~3-4 hours

---

## Code Examples

### Example: Custom Prompts JSON File

```json
{
  "prompts": [
    {
      "id": "req-score",
      "label": "Score Requirements",
      "type": "document",
      "systemPrompt": "You are a requirements analyst. Analyze documents for completeness, clarity, and testability.",
      "taskPrompt": "Rate this requirements document 0-100 on completeness, clarity, and testability. List gaps and improvements needed.",
      "description": "Scores requirements document quality"
    },
    {
      "id": "test-criteria",
      "label": "Generate Test Scenarios",
      "type": "document",
      "systemPrompt": "You are a QA engineer. Create comprehensive test scenarios in Given/When/Then format.",
      "taskPrompt": "Based on this document, generate at least 10 testable acceptance criteria in Given/When/Then format.",
      "description": "Creates test acceptance criteria"
    },
    {
      "id": "improve-clarity",
      "label": "Improve Clarity",
      "type": "document",
      "systemPrompt": "You are a technical writing expert. Improve clarity without changing meaning.",
      "taskPrompt": "Rewrite this document to be clearer and more concise while preserving all technical information.",
      "description": "Improves document readability"
    },
    {
      "id": "exec-summary",
      "label": "Executive Summary",
      "type": "document",
      "systemPrompt": "You are a business analyst writing for C-level executives.",
      "taskPrompt": "Write a one-paragraph executive summary. Focus on business impact and key decisions needed.",
      "description": "Creates executive summary"
    }
  ]
}
```

### Example: User Settings

```json
{
  "gptAiMarkdownEditor.customPromptsFile": "/Users/john/Documents/ai-prompts.json",
  "gptAiMarkdownEditor.llmProvider": "GitHub Copilot"
}
```

---

## Testing Guide

### Unit Tests (Recommended)

```typescript
// Test: aiPrompts.ts loading
describe('aiPrompts', () => {
  it('should load valid JSON prompts', async () => {
    // Create temp JSON file
    // Set config path
    // Call getCustomPrompts()
    // Assert correct prompts returned
  });

  it('should return empty on missing file', async () => {
    // Set config to invalid path
    // Call getCustomPrompts()
    // Assert empty array returned
  });

  it('should get prompt by ID', () => {
    // Set cache
    // Call getPromptById(id)
    // Assert correct prompt returned
  });
});

// Test: aiPromptsLoader.ts
describe('aiPromptsLoader', () => {
  it('should cache prompts', () => {
    handleAiPromptsResult([{id: 'test', ...}]);
    assert(getCachedAiPrompts().length === 1);
  });

  it('should fire aiPromptsLoaded event', (done) => {
    window.addEventListener('aiPromptsLoaded', done);
    handleAiPromptsResult([...]);
  });
});
```

### Manual Test Checklist

**Setup:**

- Settings panel opens without errors
- Custom Prompts section visible
- Browse button clickable

**File Selection:**

- Browse button opens file picker
- File picker filters to .json files
- Selected file path shows in input
- Open button becomes enabled

**Prompt Loading:**

- Open valid JSON file → prompts appear in dropdown
- Open invalid JSON → error in console, dropdown shows only Generate Summary
- Edit JSON file → changes appear in dropdown (within ~500ms)

**AI Actions Dropdown:**

- Button has sparkle icon
- Menu items have no icons
- Generate Summary always present
- Custom prompts list below separator
- Each prompt has correct label

**Custom Prompt Execution:**

- Click custom prompt → AI Summary panel opens
- Correct action ID sent to backend
- Response streams back correctly
- No errors in console

**Drag Handles:**

- Hover over paragraph → drag handle appears
- Hover over heading → drag handle appears
- Hover over code block → drag handle appears
- Drag and drop reorders content correctly

---

## Known Limitations

- **Relative Paths:** Only absolute paths supported; ~ expansion available
- **File Watcher:** 500ms debounce; rapid file changes may be missed
- **Error Recovery:** Invalid JSON clears cache; no auto-repair
- **Concurrent Instances:** Multiple VS Code instances may have stale cached prompts
- **UI Feedback:** No loading indicator during prompt fetch

---

## Future Enhancements

1. Support `type: "inline"` for selected-text custom actions
2. Built-in prompt template library
3. Prompt versioning and history
4. Prompt sharing/export
5. Keyboard shortcuts for favorite prompts
6. Prompt analytics and usage tracking

---

## References

- [Novel.sh Editor](https://novel.sh)
- [TipTap Global Drag Handle](https://github.com/raine/tiptap-extension-global-drag-handle)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Prosemirror](https://prosemirror.net/)