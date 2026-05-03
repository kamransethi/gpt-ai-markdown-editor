# Spec 024: FluxFlow Stable Config Folder (`~/.fluxflow`)

**Status:** 🔲 Not Started  
**PRD Domains**: `configuration`, `knowledge-graph`  
**Date:** April 18, 2026  
**Version:** 2.1.x  
**Implementation Complexity:** Medium  
**Estimated Effort:** 3–5 hours  

---

## Quick Summary For AI Implementation

This spec formalises `~/.fluxflow/` as the single stable home for all Flux Flow user data that must survive extension reinstalls, VS Code reinstalls, and machine migrations.

**What is already implemented (do not re-implement):**
- `~/.fluxflow/workspaces/{hash}/graph.db` – SQLite via sql.js (Knowledge Graph)
- `knowledgeGraph.dataDir` VS Code setting – override for data directory
- `customPromptsFile` VS Code setting – arbitrary path to a single prompts JSON file
- Workspace hash via SHA-256 of workspace path (first 16 hex chars)
- GraphDatabase auto-save every 5 seconds

**What this spec adds:**
1. Promote `knowledgeGraph.dataDir` to a top-level `gptAiMarkdownEditor.dataDir` setting; all subsystems read from one place
2. Formalise `prompts/` subfolder replacing the single-file `customPromptsFile` setting
3. Write `workspaces/{hash}/meta.json` alongside the existing graph.db
4. Create `cache/` directory for ephemeral data (thumbnails etc.)
5. Add full `contributes.configuration` schema to `package.json`

---

## Directory Layout

```
~/.fluxflow/
│
├── config.json                   # Portable settings export (LLM provider, theme, etc.)
│
├── prompts/
│   ├── default.json              # Built-in prompts — written by extension on first run
│   └── *.json                    # Additional user prompt sets (all merged at runtime)
│
├── workspaces/
│   └── {sha256-of-path[0:16]}/
│       ├── meta.json             # Workspace name, path, last opened timestamp
│       ├── graph.db              # SQLite — wiki-link graph (ALREADY EXISTS)
│       └── search.db             # SQLite — full-text search (future; reserve the name)
│
└── cache/                        # Ephemeral — safe to delete
    └── thumbnails/
```

---

## 1. Top-Level `dataDir` Setting

### Problem
`knowledgeGraph.dataDir` is scoped to one subsystem. The prompts folder, future cache, and config.json all need the same root path.

### Change
Add `gptAiMarkdownEditor.dataDir` as the canonical data root, used by every subsystem.  
Keep `knowledgeGraph.dataDir` reading as a **migration fallback** only (read it if `dataDir` is empty, then ignore it going forward).

```jsonc
// package.json → contributes.configuration.properties
"gptAiMarkdownEditor.dataDir": {
  "type": "string",
  "default": "",
  "markdownDescription": "Root directory for Flux Flow user data (prompts, knowledge graph, cache). Defaults to `~/.fluxflow`. Supports `~` prefix. Useful for pointing at a Dropbox/iCloud folder for cross-machine sync.",
  "order": 10
}
```

### Shared helper — `src/features/fluxflow/dataDir.ts` (new file)

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export function getFluxFlowDataDir(): string {
  const cfg = vscode.workspace.getConfiguration('gptAiMarkdownEditor');

  // New top-level setting
  const explicit = cfg.get<string>('dataDir', '');
  if (explicit) {
    return explicit.startsWith('~') ? path.join(os.homedir(), explicit.slice(1)) : explicit;
  }

  // Migration fallback: honour the old knowledgeGraph.dataDir if set
  const legacy = cfg.get<string>('knowledgeGraph.dataDir', '');
  if (legacy) {
    return legacy.startsWith('~') ? path.join(os.homedir(), legacy.slice(1)) : legacy;
  }

  return path.join(os.homedir(), '.fluxflow');
}
```

Update `src/features/fluxflow/database.ts` to call `getFluxFlowDataDir()` instead of its local `getDataDir()`.

---

## 2. Prompts Folder

### Problem
`customPromptsFile` points to a single file at an arbitrary path. The user either gets built-in defaults or completely overrides them — there is no layering. The file is not easily discoverable or git-trackable.

### New Behaviour

| Scenario | Result |
|---|---|
| `{dataDir}/prompts/default.json` does not exist | Extension writes it with the 4 built-in prompts on first run |
| `{dataDir}/prompts/default.json` exists | Extension reads it (user may have edited the built-ins) |
| Additional `*.json` files in `prompts/` | Prompts from all files are merged (by `id`); later files win on conflict |
| `customPromptsFile` setting still set | Honoured as a migration path; its prompts are appended last |

### File format (unchanged)
Each JSON file is an array of `CustomPrompt` objects (same interface as today).

### Changes to `src/features/aiPrompts.ts`

Replace the single-file load with a folder scan:

```typescript
import { getFluxFlowDataDir } from './fluxflow/dataDir';

async function getPromptsFromDataDir(): Promise<CustomPrompt[]> {
  const promptsDir = path.join(getFluxFlowDataDir(), 'prompts');
  await ensureDefaultPrompts(promptsDir);          // write default.json if missing

  const files = await fs.readdir(promptsDir).catch(() => [] as string[]);
  const jsonFiles = files.filter(f => f.endsWith('.json')).sort();

  const merged = new Map<string, CustomPrompt>();
  for (const file of jsonFiles) {
    const raw = await fs.readFile(path.join(promptsDir, file), 'utf8').catch(() => '[]');
    const arr = JSON.parse(raw) as CustomPrompt[];
    if (Array.isArray(arr)) arr.forEach(p => merged.set(p.id, p));
  }
  return [...merged.values()];
}
```

`ensureDefaultPrompts` writes `default.json` using `DEFAULT_PROMPTS` only if the file does not already exist — never overwrites.

### Setting deprecation
`gptAiMarkdownEditor.customPromptsFile` stays in `package.json` as deprecated (markdownDescription notes it is replaced by the `prompts/` folder) but continues to work as a migration path for one release cycle.

---

## 3. Workspace `meta.json`

Write a human-readable JSON file alongside `graph.db` when a workspace is first opened.

**Path:** `{dataDir}/workspaces/{hash}/meta.json`

```json
{
  "workspacePath": "/Users/alice/projects/my-notes",
  "workspaceName": "my-notes",
  "hash": "a3f9c2b1d4e87601",
  "firstOpened": "2026-04-18T10:00:00.000Z",
  "lastOpened": "2026-04-18T14:32:00.000Z"
}
```

**Rules:**
- Written once (`firstOpened`) and updated (`lastOpened`) on every workspace open
- Never deleted by the extension
- `workspaceName` is `path.basename(workspacePath)`

**Where to add:** in `GraphDatabase.open()` after the database is initialised.

---

## 4. `config.json` — Portable Settings Export

`~/.fluxflow/config.json` stores a machine-independent snapshot of key settings. It is **read-only from the extension's perspective at startup** — VS Code settings always win if both are present. Its purpose is dotfiles backup and onboarding a new machine.

```json
{
  "version": 1,
  "llmProvider": "openai",
  "aiModel": "gpt-4o",
  "themeOverride": "dark",
  "editorZoomLevel": 1,
  "updatedAt": "2026-04-18T14:32:00.000Z"
}
```

**Fields exported:** `llmProvider`, `aiModel`, `ollamaModel`, `ollamaEndpoint`, `themeOverride`, `editorZoomLevel`.

**Write trigger:** Updated whenever the user saves settings from the Settings panel.  
**Read behaviour:** On extension activation, if a VS Code setting is at its default value AND `config.json` has a non-default value for that key, apply the config.json value (one-time import on a fresh install).

**Implementation:** Add a `syncConfigJson(context)` call in `SettingsPanel.ts` after each successful settings update, and an `importConfigJson()` call in the extension activation path before the webview loads.

---

## 5. `cache/` Directory

Reserved for ephemeral data. Create the directory at `{dataDir}/cache/thumbnails/` on first run.

**Rules:**
- Extension never reads from `cache/` for correctness — losing it is safe
- Document clearly in `README.md` that `~/.fluxflow/cache/` is safe to delete
- No automatic cleanup logic in this spec (future spec)

---

## 6. `package.json` — `contributes.configuration` Schema

Add a full schema. This enables IntelliSense, descriptions, and type validation in VS Code settings UI.

Below is the complete list of settings that need schema entries. They currently work at runtime but have no schema (no type, no description, no default shown in UI).

```jsonc
"contributes": {
  "configuration": {
    "title": "Flux Flow Markdown Editor",
    "properties": {
      // ── Data ──────────────────────────────────────────────────────────────
      "gptAiMarkdownEditor.dataDir": {
        "type": "string", "default": "",
        "markdownDescription": "Root directory for Flux Flow user data. Defaults to `~/.fluxflow`. Supports `~`.",
        "order": 10
      },

      // ── Editor ────────────────────────────────────────────────────────────
      "gptAiMarkdownEditor.themeOverride": {
        "type": "string", "default": "light",
        "enum": ["light", "dark", "system"],
        "description": "Force a specific editor theme independent of VS Code's theme.",
        "order": 20
      },
      "gptAiMarkdownEditor.editorZoomLevel": {
        "type": "number", "default": 1, "minimum": 0.5, "maximum": 3,
        "description": "Editor font zoom level (0.5 – 3).",
        "order": 21
      },
      "gptAiMarkdownEditor.editorWidth": {
        "type": "number", "default": 800, "minimum": 400,
        "description": "Max editor content width in pixels.",
        "order": 22
      },
      "gptAiMarkdownEditor.showSelectionToolbar": {
        "type": "boolean", "default": true,
        "description": "Show floating formatting toolbar when text is selected.",
        "order": 23
      },
      "gptAiMarkdownEditor.defaultMarkdownViewer": {
        "type": "boolean", "default": false,
        "description": "Open .md files with Flux Flow by default instead of VS Code's built-in preview.",
        "order": 24
      },
      "gptAiMarkdownEditor.tocMaxDepth": {
        "type": "number", "default": 3, "minimum": 1, "maximum": 6,
        "description": "Maximum heading depth shown in the Table of Contents panel.",
        "order": 25
      },
      "gptAiMarkdownEditor.preserveHtmlComments": {
        "type": "boolean", "default": true,
        "description": "Preserve <!-- HTML comments --> when round-tripping Markdown.",
        "order": 26
      },
      "gptAiMarkdownEditor.developerMode": {
        "type": "boolean", "default": false,
        "description": "Enable developer tools and verbose console logging.",
        "order": 27
      },

      // ── AI / LLM ──────────────────────────────────────────────────────────
      "gptAiMarkdownEditor.llmProvider": {
        "type": "string", "default": "openai",
        "enum": ["openai", "anthropic", "ollama", "copilot"],
        "description": "LLM provider used for AI features.",
        "order": 30
      },
      "gptAiMarkdownEditor.aiModel": {
        "type": "string", "default": "gpt-4o",
        "description": "Model name for the selected LLM provider.",
        "order": 31
      },
      "gptAiMarkdownEditor.ollamaModel": {
        "type": "string", "default": "llama3",
        "description": "Ollama model name for text generation.",
        "order": 32
      },
      "gptAiMarkdownEditor.ollamaImageModel": {
        "type": "string", "default": "llava",
        "description": "Ollama model name for image analysis.",
        "order": 33
      },
      "gptAiMarkdownEditor.ollamaEndpoint": {
        "type": "string", "default": "http://localhost:11434",
        "description": "Ollama API endpoint URL.",
        "order": 34
      },
      "gptAiMarkdownEditor.customPromptsFile": {
        "type": "string", "default": "",
        "markdownDescription": "**Deprecated.** Path to a JSON file with custom AI prompts. Use the `prompts/` folder in your data directory instead (`~/.fluxflow/prompts/`).",
        "order": 35
      },

      // ── Media ─────────────────────────────────────────────────────────────
      "gptAiMarkdownEditor.mediaPathBase": {
        "type": "string", "default": "workspace",
        "enum": ["workspace", "file"],
        "description": "Base for resolving relative media paths: workspace root or the markdown file's directory.",
        "order": 40
      },
      "gptAiMarkdownEditor.mediaPath": {
        "type": "string", "default": "media",
        "description": "Relative path (from mediaPathBase) where media files are stored.",
        "order": 41
      },
      "gptAiMarkdownEditor.imageResize.skipWarning": {
        "type": "boolean", "default": false,
        "description": "Skip the confirmation dialog when resizing images.",
        "order": 42
      },

      // ── External tools ────────────────────────────────────────────────────
      "gptAiMarkdownEditor.chromePath": {
        "type": "string", "default": "",
        "description": "Path to Chromium/Chrome executable used for PDF export.",
        "order": 45
      },
      "gptAiMarkdownEditor.pandocPath": {
        "type": "string", "default": "pandoc",
        "description": "Path to the pandoc executable.",
        "order": 46
      },
      "gptAiMarkdownEditor.pandocTemplatePath": {
        "type": "string", "default": "",
        "description": "Path to a custom pandoc template file.",
        "order": 47
      },

      // ── Knowledge Graph ───────────────────────────────────────────────────
      "gptAiMarkdownEditor.knowledgeGraph.enabled": {
        "type": "boolean", "default": false,
        "markdownDescription": "**Knowledge Graph (Experimental):** Enable wiki-link indexing, backlinks panel, and full-text search across all Markdown files in the workspace. Requires window reload.",
        "order": 50
      },
      "gptAiMarkdownEditor.knowledgeGraph.dataDir": {
        "type": "string", "default": "",
        "markdownDescription": "**Deprecated.** Use `gptAiMarkdownEditor.dataDir` instead.",
        "order": 51
      },
      "gptAiMarkdownEditor.knowledgeGraph.rag.topK": {
        "type": "number", "default": 5, "minimum": 1, "maximum": 50,
        "description": "Number of top documents returned by RAG context retrieval.",
        "order": 52
      },
      "gptAiMarkdownEditor.knowledgeGraph.rag.charsPerDoc": {
        "type": "number", "default": 2000, "minimum": 200,
        "description": "Maximum characters per document included in RAG context.",
        "order": 53
      },
      "gptAiMarkdownEditor.knowledgeGraph.rag.ftsSnippetTokens": {
        "type": "number", "default": 64, "minimum": 16,
        "description": "Number of tokens in each FTS snippet.",
        "order": 54
      },
      "gptAiMarkdownEditor.knowledgeGraph.rag.historyTurns": {
        "type": "number", "default": 4, "minimum": 1, "maximum": 20,
        "description": "Number of conversation history turns included in RAG prompts.",
        "order": 55
      }
    }
  }
}
```

---

## 7. Files to Create / Modify

| File | Action | Notes |
|---|---|---|
| `src/features/fluxflow/dataDir.ts` | **Create** | Shared `getFluxFlowDataDir()` helper |
| `src/features/fluxflow/database.ts` | **Modify** | Use `getFluxFlowDataDir()` instead of local `getDataDir()` |
| `src/features/fluxflow/database.ts` | **Modify** | Write `meta.json` in `open()` |
| `src/features/aiPrompts.ts` | **Modify** | Load from `{dataDir}/prompts/*.json` folder |
| `src/editor/SettingsPanel.ts` | **Modify** | Write `config.json` on settings save; import on activation |
| `package.json` | **Modify** | Add `contributes.configuration` schema |

---

## 8. Implementation Notes

### Critical: Settings Panel Must Receive Graph Callbacks from Both Entry Points

The Settings Panel can be opened from two places:

1. **Via extension command** (`extension.ts` line ~241) — correctly passes callbacks:
   ```typescript
   const graphCbs = FluxFlowGraph.getGraphCallbacks();
   openSettingsPanel(context, graphCbs ? { graph: graphCbs } : undefined);
   ```

2. **From markdown editor webview** (`src/editor/MarkdownEditorProvider.ts` line ~493) — **must also pass callbacks**:
   ```typescript
   import { getGraphCallbacks } from '../features/fluxflow/index';
   
   case MessageType.OPEN_EXTENSION_SETTINGS: {
     const graphCbs = getGraphCallbacks();
     openSettingsPanel(this.context, graphCbs ? { graph: graphCbs } : undefined);
     break;
   }
   ```

**Why this matters:** If the editor path calls `openSettingsPanel(this.context)` without callbacks, the Settings Panel will not have access to `graphCallbacks`, causing all Knowledge Graph operations (stats display, rebuild, refresh) to fail with "Knowledge Graph is not active" error — even if KG is actually active. The webview shows this error because `SettingsPanel.ts` checks `if (!graphCallbacks)` before responding to stats/rebuild requests.

**Always ensure both entry points to Settings Panel pass callbacks consistently.**

---

## 9. Acceptance Scenarios

1. **Given** a fresh install with no `~/.fluxflow/` directory, **When** the extension activates, **Then** `~/.fluxflow/prompts/default.json` and `~/.fluxflow/cache/thumbnails/` are created automatically.

2. **Given** no `dataDir` setting, **When** the Knowledge Graph opens a workspace, **Then** `graph.db` and `meta.json` are created at `~/.fluxflow/workspaces/{hash}/`.

3. **Given** `gptAiMarkdownEditor.dataDir` is set to `~/Dropbox/fluxflow`, **When** any subsystem calls `getFluxFlowDataDir()`, **Then** it returns the Dropbox path (not `~/.fluxflow`).

4. **Given** a `prompts/` folder with `default.json` and `work.json`, **When** the AI prompts menu opens, **Then** it shows prompts from both files merged, with `work.json` overriding any duplicate IDs from `default.json`.

5. **Given** the user edits `~/.fluxflow/prompts/default.json`, **When** the extension starts, **Then** it reads the edited file rather than overwriting it with built-ins.

6. **Given** the user has `customPromptsFile` set to an old path, **When** prompts load, **Then** those prompts are appended (migration compatibility).

7. **Given** VS Code settings have all values at their defaults and `~/.fluxflow/config.json` has `"llmProvider": "ollama"`, **When** the extension activates on a fresh VS Code install, **Then** `llmProvider` is pre-populated to `"ollama"` without the user needing to configure it again.

8. **Given** the settings panel saves a change, **When** `config.json` is written, **Then** it is valid JSON containing the exported keys and an `updatedAt` timestamp.

9. **Given** `knowledgeGraph.dataDir` is set but `dataDir` is empty, **When** `getFluxFlowDataDir()` is called, **Then** it returns the `knowledgeGraph.dataDir` value (migration fallback).

---

## 10. Out of Scope

- Automatic migration of `graph.db` from old `knowledgeGraph.dataDir` to new `dataDir`
- UI for browsing or editing files in the data directory from within VS Code
- `search.db` as a separate file (reserved name, not implemented yet)
- Cache auto-cleanup
- Encryption of config.json
- Multi-machine sync via iCloud/Dropbox (the `dataDir` setting enables this but setup is manual)
