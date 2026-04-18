# Spec 023: FluxFlow Knowledge Graph — Phase 1: Foundation

**Status:** 🔲 Not Started  
**Date:** April 18, 2026  
**Version:** 2.1.0  
**Implementation Complexity:** High  
**Estimated Effort:** 8–12 hours  

---

## Quick Summary For AI Implementation

This spec adds a **Knowledge Graph** system to Flux Flow Markdown Editor. When enabled via a feature flag, it indexes all `.md` files in the workspace, extracts `[[wiki-links]]`, `#tags`, and YAML frontmatter, stores everything in a SQLite database (via `sql.js` WASM), and provides a **Backlinks** sidebar panel showing which documents reference the currently open file. A full-text search command is also included.

An AI agent implementing this should:

1. Install `sql.js` dependency and update the esbuild build script to copy the WASM file
2. Add feature flag settings to `package.json`
3. Create 7 new files under `src/features/fluxflow/`
4. Register one new TreeView, three new commands, and the file watcher in `extension.ts`
5. All code runs on the **extension host** (Node.js) — no webview changes needed

**No existing files are refactored. This is purely additive.**

---

## Table of Contents

1. [Feature Flag Configuration](#1-feature-flag-configuration)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Directory Layout](#3-data-directory-layout)
4. [SQLite Schema](#4-sqlite-schema)
5. [Dependency: sql.js](#5-dependency-sqljs)
6. [Build Script Changes](#6-build-script-changes)
7. [New Files to Create](#7-new-files-to-create)
8. [Modified Files](#8-modified-files)
9. [File-by-File Implementation](#9-file-by-file-implementation)
10. [Integration: extension.ts](#10-integration-extensionts)
11. [Step-by-Step Implementation Order](#11-step-by-step-implementation-order)
12. [Testing Guide](#12-testing-guide)

---

## 1. Feature Flag Configuration

Add these settings to `package.json` → `contributes.configuration.properties`:

```jsonc
"gptAiMarkdownEditor.knowledgeGraph.enabled": {
  "type": "boolean",
  "default": false,
  "markdownDescription": "**Knowledge Graph (Experimental)**: Enable wiki-link indexing, backlinks panel, and full-text search across all markdown files in the workspace. Requires reload after changing.",
  "order": 50
},
"gptAiMarkdownEditor.knowledgeGraph.dataDir": {
  "type": "string",
  "default": "",
  "markdownDescription": "Custom directory for Knowledge Graph data. Defaults to `~/.fluxflow`. Data persists across extension reinstalls.",
  "order": 51
}
```

### Behavior

- When `knowledgeGraph.enabled` is `false` (default): no indexing, no file watcher, no backlinks view, no commands registered. Zero performance impact.
- When `knowledgeGraph.enabled` is `true`: the full graph system activates on extension startup.
- Changing the setting requires a VS Code reload (window.reload). Show an info message with a "Reload" button when the setting changes.
- The `dataDir` setting allows overriding the default `~/.fluxflow` storage location (e.g., for team-shared NAS paths or cloud-synced directories).

### Reading the Feature Flag

```typescript
function isKnowledgeGraphEnabled(): boolean {
  return vscode.workspace.getConfiguration('gptAiMarkdownEditor')
    .get<boolean>('knowledgeGraph.enabled', false);
}
```

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   extension.ts                       │
│  if (knowledgeGraph.enabled) {                       │
│    FluxFlowGraph.initialize(context)                 │
│  }                                                   │
└──────────────┬──────────────────────────────────────-┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│              src/features/fluxflow/index.ts           │
│  • Reads settings                                    │
│  • Opens/creates database                            │
│  • Runs initial full index                           │
│  • Starts file watcher                               │
│  • Registers backlinks TreeView                      │
│  • Registers commands                                │
└──┬──────────┬──────────┬───────────┬────────────────-┘
   │          │          │           │
   ▼          ▼          ▼           ▼
database.ts indexer.ts watcher.ts backlinksView.ts
```

**Data flow:**

1. **Startup**: `indexer.ts` scans all `.md` files → parses each → inserts into `database.ts`
2. **File save**: `watcher.ts` detects change → re-indexes that single file via `indexer.ts`
3. **File delete**: `watcher.ts` detects deletion → removes from `database.ts`
4. **User opens a file**: `backlinksView.ts` queries `database.ts` for incoming links → displays in TreeView
5. **User runs search**: Quick Pick UI queries FTS5 via `database.ts` → shows results

---

## 3. Data Directory Layout

```
~/.fluxflow/                              # Default, configurable via setting
  config.json                              # Future: global config
  workspaces/
    {workspace-hash}/                      # SHA-256(workspace folder path), first 16 chars
      graph.db                             # Serialized sql.js database file
```

### Workspace Hash

```typescript
import * as crypto from 'crypto';

function getWorkspaceHash(workspacePath: string): string {
  return crypto.createHash('sha256').update(workspacePath).digest('hex').slice(0, 16);
}
```

### Path Resolution

```typescript
import * as os from 'os';
import * as path from 'path';

function getDataDir(): string {
  const custom = vscode.workspace.getConfiguration('gptAiMarkdownEditor')
    .get<string>('knowledgeGraph.dataDir', '');
  if (custom) {
    // Expand ~ to home directory
    return custom.startsWith('~') ? path.join(os.homedir(), custom.slice(1)) : custom;
  }
  return path.join(os.homedir(), '.fluxflow');
}

function getDbPath(workspacePath: string): string {
  const dataDir = getDataDir();
  const hash = getWorkspaceHash(workspacePath);
  return path.join(dataDir, 'workspaces', hash, 'graph.db');
}
```

---

## 4. SQLite Schema

The database uses 5 tables. All IDs are auto-increment integers. `documents.path` stores workspace-relative paths (forward slashes).

```sql
-- Schema version tracking
PRAGMA user_version = 1;

-- Core document table
CREATE TABLE IF NOT EXISTS documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  path        TEXT    NOT NULL UNIQUE,       -- workspace-relative, forward slashes
  title       TEXT    NOT NULL DEFAULT '',    -- first H1 or filename
  hash        TEXT    NOT NULL DEFAULT '',    -- SHA-256 of file content (skip unchanged files)
  indexed_at  INTEGER NOT NULL DEFAULT 0     -- Unix timestamp ms
);

-- Wiki-links: [[target]] found in source document
CREATE TABLE IF NOT EXISTS links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id   INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_title TEXT   NOT NULL,              -- raw text inside [[ ]], lowercased
  target_id   INTEGER REFERENCES documents(id) ON DELETE SET NULL,  -- resolved doc, nullable
  line_number INTEGER NOT NULL DEFAULT 0,
  context     TEXT    NOT NULL DEFAULT ''     -- surrounding ~80 chars for preview
);

-- Tags: #tag or frontmatter tags
CREATE TABLE IF NOT EXISTS tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id      INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag         TEXT    NOT NULL,              -- lowercased, no # prefix
  source      TEXT    NOT NULL DEFAULT 'inline'  -- 'inline' or 'frontmatter'
);

-- Frontmatter properties (key-value from YAML)
CREATE TABLE IF NOT EXISTS properties (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id      INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  key         TEXT    NOT NULL,
  value       TEXT    NOT NULL DEFAULT ''
);

-- Full-text search (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(
  title,
  body,
  content='',                               -- contentless: we manage content ourselves
  tokenize='porter unicode61'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_id);
CREATE INDEX IF NOT EXISTS idx_links_target_title ON links(target_title);
CREATE INDEX IF NOT EXISTS idx_tags_doc ON tags(doc_id);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
CREATE INDEX IF NOT EXISTS idx_properties_doc ON properties(doc_id);
CREATE INDEX IF NOT EXISTS idx_properties_key ON properties(key);
```

### Key Queries

**Get backlinks for a document:**

```sql
SELECT d.path, d.title, l.context, l.line_number
FROM links l
JOIN documents d ON d.id = l.source_id
WHERE l.target_title = ?   -- lowercased title of current doc
   OR l.target_id = ?      -- resolved document ID
ORDER BY d.path;
```

**Full-text search:**

```sql
SELECT d.path, d.title, snippet(fts, 1, '<b>', '</b>', '...', 20) as snippet
FROM fts
JOIN documents d ON d.id = fts.rowid
WHERE fts MATCH ?
ORDER BY rank
LIMIT 50;
```

**Unlinked references (docs that mention a title but don't wiki-link it):**

```sql
SELECT d.path, d.title
FROM fts
JOIN documents d ON d.id = fts.rowid
WHERE fts MATCH ?
  AND d.id NOT IN (
    SELECT source_id FROM links WHERE target_title = ?
  )
  AND d.id != ?
LIMIT 50;
```

---

## 5. Dependency: sql.js

### Why sql.js over better-sqlite3


| Criterion          | sql.js                       | better-sqlite3                       |
| ------------------ | ---------------------------- | ------------------------------------ |
| **Bundling**       | Pure WASM, trivial to bundle | Native C++ .node binary, complex     |
| **Cross-platform** | Works everywhere (WASM)      | Needs per-platform prebuilds         |
| **esbuild**        | Copy .wasm to dist/          | Must externalize + ship node_modules |
| **FTS5**           | Included in default build    | Included                             |
| **Performance**    | ~3-5x slower                 | Fastest                              |
| **Memory**         | Entire DB in memory          | File-backed, memory-efficient        |


For our use case (hundreds to low thousands of files, &lt;50MB index), sql.js is more than adequate and dramatically simpler to ship.

### Install

```bash
npm install sql.js
npm install --save-dev @types/sql.js
```

### Initialization Pattern

```typescript
import initSqlJs, { Database } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';

let db: Database | null = null;

async function openDatabase(dbPath: string): Promise<Database> {
  const SQL = await initSqlJs({
    // Point to the WASM file copied into dist/
    locateFile: (file: string) => path.join(__dirname, file),
  });

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL-like behavior and foreign keys
  db.run('PRAGMA foreign_keys = ON;');

  return db;
}
```

### Persistence Pattern

sql.js runs in-memory. We must explicitly save to disk:

```typescript
function saveDatabase(db: Database, dbPath: string): void {
  const data = db.export();                      // Returns Uint8Array
  const buffer = Buffer.from(data);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, buffer);
}
```

**When to save:**

- After full re-index completes
- After each incremental file update (debounced — save at most once per 5 seconds)
- On extension deactivation

---

## 6. Build Script Changes

### File: `scripts/build-extension.js`

After the existing `copyPandocLuaFilters()` call, add a function to copy the sql.js WASM file:

```javascript
function copySqlJsWasm() {
  const wasmSrc = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const wasmDest = path.join(__dirname, '..', 'dist', 'sql-wasm.wasm');
  if (fs.existsSync(wasmSrc)) {
    fs.copyFileSync(wasmSrc, wasmDest);
  } else {
    console.warn('⚠️  sql-wasm.wasm not found — Knowledge Graph features will not work');
  }
}
```

Call `copySqlJsWasm()` right after `copyPandocLuaFilters()` in both the one-time build and watch paths.

### .vscodeignore

Ensure `dist/sql-wasm.wasm` is NOT ignored (it needs to ship in the VSIX). Add to `.vscodeignore` if it has a `dist/**` ignore pattern:

```
!dist/sql-wasm.wasm
```

---

## 7. New Files to Create


| File                                     | Purpose                                                  | ~Lines |
| ---------------------------------------- | -------------------------------------------------------- | ------ |
| `src/features/fluxflow/types.ts`         | Shared TypeScript interfaces                             | ~60    |
| `src/features/fluxflow/database.ts`      | SQLite wrapper: open, close, save, schema, all queries   | ~250   |
| `src/features/fluxflow/indexer.ts`       | Parse markdown: extract links, tags, frontmatter, title  | ~200   |
| `src/features/fluxflow/watcher.ts`       | File system watcher: incremental re-index on save/delete | ~80    |
| `src/features/fluxflow/backlinksView.ts` | TreeDataProvider for Backlinks sidebar panel             | ~150   |
| `src/features/fluxflow/commands.ts`      | Command handlers: rebuild index, search, toggle          | ~100   |
| `src/features/fluxflow/index.ts`         | Barrel: initialize(), deactivate(), exports              | ~100   |


**Total new code: ~940 lines**

---

## 8. Modified Files


| File                         | Change                                         | ~Lines Changed |
| ---------------------------- | ---------------------------------------------- | -------------- |
| `package.json`               | Add 2 settings, 3 commands, 1 view, sql.js dep | +50            |
| `scripts/build-extension.js` | Copy WASM file to dist/                        | +12            |
| `src/extension.ts`           | Import + conditional init + deactivate call    | +15            |


---

## 9. File-by-File Implementation

### 9.1 `src/features/fluxflow/types.ts`

```typescript
/**
 * Knowledge Graph types for FluxFlow
 */

/** A document indexed in the graph */
export interface GraphDocument {
  id: number;
  path: string;          // workspace-relative, forward slashes
  title: string;         // first H1 heading or filename without extension
  hash: string;          // SHA-256 of file content
  indexedAt: number;      // Unix ms
}

/** A wiki-link extracted from a document */
export interface GraphLink {
  sourceId: number;
  targetTitle: string;   // lowercased text inside [[...]]
  targetId: number | null;
  lineNumber: number;
  context: string;       // ~80 char surrounding text
}

/** A tag found in a document */
export interface GraphTag {
  docId: number;
  tag: string;           // lowercased, no # prefix
  source: 'inline' | 'frontmatter';
}

/** A frontmatter property */
export interface GraphProperty {
  docId: number;
  key: string;
  value: string;
}

/** Result of parsing a single markdown file */
export interface ParsedDocument {
  title: string;
  links: Array<{ target: string; lineNumber: number; context: string }>;
  tags: Array<{ tag: string; source: 'inline' | 'frontmatter' }>;
  properties: Array<{ key: string; value: string }>;
  bodyText: string;       // full text content for FTS
}

/** A backlink result for display */
export interface BacklinkEntry {
  sourcePath: string;
  sourceTitle: string;
  context: string;
  lineNumber: number;
}

/** A search result */
export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
}
```

---

### 9.2 `src/features/fluxflow/database.ts`

This file manages the entire SQLite lifecycle. Key exports:

```typescript
export class GraphDatabase {
  private db: Database | null = null;
  private dbPath: string = '';
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty: boolean = false;

  /** Open or create the database for a workspace */
  async open(workspacePath: string): Promise<void>;

  /** Close and save the database */
  close(): void;

  /** Run the schema DDL (idempotent) */
  private initSchema(): void;

  /** Save to disk (debounced) */
  scheduleSave(): void;

  /** Force save to disk immediately */
  saveNow(): void;

  // --- Document operations ---

  /** Upsert a document. Returns the document ID. */
  upsertDocument(relativePath: string, title: string, hash: string): number;

  /** Get a document by path */
  getDocumentByPath(relativePath: string): GraphDocument | null;

  /** Get a document by ID */
  getDocumentById(id: number): GraphDocument | null;

  /** Delete a document and all its links/tags/properties (CASCADE) */
  deleteDocument(relativePath: string): void;

  /** Get stored hash for a file (to skip unchanged files) */
  getDocumentHash(relativePath: string): string | null;

  // --- Link operations ---

  /** Remove all links for a source document (before re-indexing) */
  clearLinksForDocument(docId: number): void;

  /** Insert a link */
  insertLink(sourceId: number, targetTitle: string, lineNumber: number, context: string): void;

  /** Resolve target_id for all unresolved links */
  resolveLinks(): void;

  /** Get all backlinks pointing to a document */
  getBacklinks(docPath: string): BacklinkEntry[];

  /** Get unlinked references (FTS matches minus linked ones) */
  getUnlinkedReferences(docTitle: string, docId: number): BacklinkEntry[];

  // --- Tag operations ---

  /** Remove all tags for a document */
  clearTagsForDocument(docId: number): void;

  /** Insert a tag */
  insertTag(docId: number, tag: string, source: 'inline' | 'frontmatter'): void;

  /** Get all unique tags in the workspace */
  getAllTags(): Array<{ tag: string; count: number }>;

  // --- Property operations ---

  /** Remove all properties for a document */
  clearPropertiesForDocument(docId: number): void;

  /** Insert a property */
  insertProperty(docId: number, key: string, value: string): void;

  // --- FTS operations ---

  /** Remove FTS entry for a document */
  clearFtsForDocument(docId: number): void;

  /** Insert or replace FTS content */
  upsertFts(docId: number, title: string, body: string): void;

  /** Full-text search. Returns up to 50 results. */
  search(query: string): SearchResult[];

  // --- Bulk operations ---

  /** Begin a transaction */
  begin(): void;

  /** Commit a transaction */
  commit(): void;

  /** Get total document count */
  getDocumentCount(): number;
}
```

#### Critical Implementation Details

`**open()` method:**

```typescript
async open(workspacePath: string): Promise<void> {
  const dataDir = getDataDir();
  const hash = getWorkspaceHash(workspacePath);
  this.dbPath = path.join(dataDir, 'workspaces', hash, 'graph.db');

  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(__dirname, file),
  });

  if (fs.existsSync(this.dbPath)) {
    const buffer = fs.readFileSync(this.dbPath);
    this.db = new SQL.Database(buffer);
  } else {
    this.db = new SQL.Database();
  }

  this.db.run('PRAGMA foreign_keys = ON;');
  this.initSchema();
}
```

`**upsertDocument()` method:**

```typescript
upsertDocument(relativePath: string, title: string, hash: string): number {
  this.db!.run(
    `INSERT INTO documents (path, title, hash, indexed_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET title=?, hash=?, indexed_at=?`,
    [relativePath, title, hash, Date.now(), title, hash, Date.now()]
  );
  const result = this.db!.exec('SELECT last_insert_rowid()');
  // If it was an UPDATE, last_insert_rowid won't change — look up by path
  const rows = this.db!.exec('SELECT id FROM documents WHERE path = ?', [relativePath]);
  return rows[0].values[0][0] as number;
}
```

`**getBacklinks()` method:**

```typescript
getBacklinks(docPath: string): BacklinkEntry[] {
  // First get the doc's title and ID
  const doc = this.getDocumentByPath(docPath);
  if (!doc) return [];

  const titleLower = doc.title.toLowerCase();
  const rows = this.db!.exec(
    `SELECT DISTINCT d.path, d.title, l.context, l.line_number
     FROM links l
     JOIN documents d ON d.id = l.source_id
     WHERE l.target_title = ? OR l.target_id = ?
     ORDER BY d.path`,
    [titleLower, doc.id]
  );

  if (!rows.length) return [];
  return rows[0].values.map(row => ({
    sourcePath: row[0] as string,
    sourceTitle: row[1] as string,
    context: row[2] as string,
    lineNumber: row[3] as number,
  }));
}
```

`**search()` method:**

```typescript
search(query: string): SearchResult[] {
  // Escape special FTS5 characters and add * for prefix matching
  const safeQuery = query.replace(/['"]/g, '').trim();
  if (!safeQuery) return [];

  const rows = this.db!.exec(
    `SELECT d.path, d.title, snippet(fts, 1, '**', '**', '...', 20) as snippet
     FROM fts
     JOIN documents d ON d.id = fts.rowid
     WHERE fts MATCH ?
     ORDER BY rank
     LIMIT 50`,
    [safeQuery]
  );

  if (!rows.length) return [];
  return rows[0].values.map(row => ({
    path: row[0] as string,
    title: row[1] as string,
    snippet: row[2] as string,
  }));
}
```

`**scheduleSave()` — debounced disk write:**

```typescript
scheduleSave(): void {
  this.dirty = true;
  if (this.saveTimer) return;
  this.saveTimer = setTimeout(() => {
    this.saveNow();
    this.saveTimer = null;
  }, 5000);
}

saveNow(): void {
  if (!this.db || !this.dirty) return;
  const data = this.db.export();
  const buffer = Buffer.from(data);
  fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
  fs.writeFileSync(this.dbPath, buffer);
  this.dirty = false;
}
```

`**close()` method:**

```typescript
close(): void {
  if (this.saveTimer) {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
  this.saveNow();
  this.db?.close();
  this.db = null;
}
```

---

### 9.3 `src/features/fluxflow/indexer.ts`

Parses a single markdown file and extracts all graph data. **Does not import sql.js or database.ts** — it's a pure parser that returns a `ParsedDocument`.

Key export:

```typescript
export function parseMarkdownFile(content: string, filePath: string): ParsedDocument;
```

#### Implementation

```typescript
import * as path from 'path';
import { ParsedDocument } from './types';

const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;
const INLINE_TAG_REGEX = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
const HEADING_REGEX = /^(#{1,6})\s+(.+)$/gm;

/**
 * Extract YAML frontmatter from markdown content.
 * Returns { properties, tags, bodyWithoutFrontmatter }.
 */
function parseFrontmatter(content: string): {
  properties: Array<{ key: string; value: string }>;
  tags: string[];
  body: string;
} {
  const properties: Array<{ key: string; value: string }> = [];
  const tags: string[] = [];

  // Check for YAML frontmatter delimiters
  if (!content.startsWith('---')) {
    return { properties, tags, body: content };
  }

  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { properties, tags, body: content };
  }

  const yamlBlock = content.slice(4, endIndex).trim();
  const body = content.slice(endIndex + 4).trim();

  // Simple line-by-line YAML parser (no dependency needed)
  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const rawValue = line.slice(colonIdx + 1).trim();

    if (key === 'tags') {
      // Handle both [tag1, tag2] and "tag1, tag2" formats
      const cleaned = rawValue.replace(/[\[\]]/g, '');
      for (const t of cleaned.split(',')) {
        const tag = t.trim().toLowerCase().replace(/^#/, '');
        if (tag) tags.push(tag);
      }
    } else {
      properties.push({ key, value: rawValue });
    }
  }

  return { properties, tags, body };
}

/**
 * Parse a markdown file and extract all graph-relevant data.
 *
 * @param content  Raw file content
 * @param filePath Workspace-relative path (e.g. "docs/notes.md")
 * @returns ParsedDocument with title, links, tags, properties, bodyText
 */
export function parseMarkdownFile(content: string, filePath: string): ParsedDocument {
  const { properties, tags: fmTags, body } = parseFrontmatter(content);

  // Extract title: first H1, or frontmatter title, or filename
  let title = '';
  const titleProp = properties.find(p => p.key === 'title');
  if (titleProp) {
    title = titleProp.value.replace(/^["']|["']$/g, '');
  }
  if (!title) {
    const h1Match = body.match(/^#\s+(.+)$/m);
    if (h1Match) {
      title = h1Match[1].trim();
    }
  }
  if (!title) {
    title = path.basename(filePath, path.extname(filePath));
  }

  // Extract wiki-links [[target]]
  const links: ParsedDocument['links'] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    WIKI_LINK_REGEX.lastIndex = 0;
    while ((match = WIKI_LINK_REGEX.exec(line)) !== null) {
      const target = match[1].trim();
      if (!target) continue;

      // Build ~80 char context window around the match
      const start = Math.max(0, match.index - 40);
      const end = Math.min(line.length, match.index + match[0].length + 40);
      const context = (start > 0 ? '...' : '') +
        line.slice(start, end).trim() +
        (end < line.length ? '...' : '');

      links.push({
        target: target.toLowerCase(),
        lineNumber: i + 1,
        context,
      });
    }
  }

  // Extract inline #tags (not inside code blocks or links)
  const inlineTags: ParsedDocument['tags'] = [];
  for (const line of lines) {
    // Skip code fences and HTML
    if (line.trimStart().startsWith('```') || line.trimStart().startsWith('<')) continue;

    let match: RegExpExecArray | null;
    INLINE_TAG_REGEX.lastIndex = 0;
    while ((match = INLINE_TAG_REGEX.exec(line)) !== null) {
      inlineTags.push({ tag: match[1].toLowerCase(), source: 'inline' });
    }
  }

  // Combine frontmatter tags + inline tags (deduplicated)
  const allTags: ParsedDocument['tags'] = [
    ...fmTags.map(tag => ({ tag, source: 'frontmatter' as const })),
    ...inlineTags,
  ];
  const seen = new Set<string>();
  const dedupedTags = allTags.filter(t => {
    if (seen.has(t.tag)) return false;
    seen.add(t.tag);
    return true;
  });

  return {
    title,
    links,
    tags: dedupedTags,
    properties,
    bodyText: body,
  };
}
```

---

### 9.4 `src/features/fluxflow/watcher.ts`

Watches for file changes and triggers incremental re-indexing.

```typescript
import * as vscode from 'vscode';

export class FluxFlowWatcher implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | null = null;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private onFileChanged: (uri: vscode.Uri) => void,
    private onFileDeleted: (uri: vscode.Uri) => void,
  ) {}

  start(): void {
    // Watch all .md files in the workspace
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*.md');

    this.disposables.push(
      this.watcher.onDidChange(uri => this.onFileChanged(uri)),
      this.watcher.onDidCreate(uri => this.onFileChanged(uri)),
      this.watcher.onDidDelete(uri => this.onFileDeleted(uri)),
    );

    this.disposables.push(this.watcher);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    this.watcher = null;
  }
}
```

---

### 9.5 `src/features/fluxflow/backlinksView.ts`

A VS Code TreeDataProvider that shows backlinks for the currently active document.

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { BacklinkEntry } from './types';

type BacklinksSupplier = (docPath: string) => BacklinkEntry[];
type UnlinkedSupplier = (docPath: string) => BacklinkEntry[];

class BacklinkTreeItem extends vscode.TreeItem {
  constructor(
    public readonly entry: BacklinkEntry,
    private workspacePath: string,
  ) {
    super(entry.sourceTitle || path.basename(entry.sourcePath));
    this.description = entry.sourcePath;
    this.tooltip = entry.context;
    this.iconPath = new vscode.ThemeIcon('references');
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [
        vscode.Uri.file(path.join(workspacePath, entry.sourcePath)),
      ],
    };
    this.contextValue = 'backlink';
  }
}

class SectionItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly children: BacklinkTreeItem[],
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'section';
    this.iconPath = new vscode.ThemeIcon(
      label.startsWith('Linked') ? 'link' : 'search'
    );
  }
}

type TreeItem = SectionItem | BacklinkTreeItem;

export class BacklinksViewProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private currentDocPath: string | null = null;
  private getBacklinks: BacklinksSupplier;
  private getUnlinked: UnlinkedSupplier;
  private workspacePath: string;

  constructor(
    workspacePath: string,
    getBacklinks: BacklinksSupplier,
    getUnlinked: UnlinkedSupplier,
  ) {
    this.workspacePath = workspacePath;
    this.getBacklinks = getBacklinks;
    this.getUnlinked = getUnlinked;
  }

  /** Called when the active editor changes */
  updateActiveDocument(docPath: string | null): void {
    this.currentDocPath = docPath;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    // Top-level: return sections
    if (!element) {
      if (!this.currentDocPath) {
        return [];
      }

      const linked = this.getBacklinks(this.currentDocPath)
        .map(e => new BacklinkTreeItem(e, this.workspacePath));
      const unlinked = this.getUnlinked(this.currentDocPath)
        .map(e => new BacklinkTreeItem(e, this.workspacePath));

      const sections: SectionItem[] = [];
      sections.push(
        new SectionItem(`Linked References (${linked.length})`, linked)
      );
      sections.push(
        new SectionItem(`Unlinked References (${unlinked.length})`, unlinked)
      );
      return sections;
    }

    // Section level: return backlinks
    if (element instanceof SectionItem) {
      return element.children;
    }

    return [];
  }
}
```

---

### 9.6 `src/features/fluxflow/commands.ts`

Command handlers for the palette and keyboard shortcuts.

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import type { GraphDatabase } from './database';
import type { SearchResult } from './types';

/**
 * Register all FluxFlow Knowledge Graph commands.
 * Returns disposables to push into context.subscriptions.
 */
export function registerFluxFlowCommands(
  db: GraphDatabase,
  workspacePath: string,
  rebuildFn: () => Promise<void>,
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // Rebuild Index command
  disposables.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.knowledgeGraph.rebuildIndex', async () => {
      const start = Date.now();
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Knowledge Graph: Rebuilding index...',
          cancellable: false,
        },
        async () => {
          await rebuildFn();
        },
      );
      const count = db.getDocumentCount();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      vscode.window.showInformationMessage(
        `Knowledge Graph: Indexed ${count} documents in ${elapsed}s`
      );
    })
  );

  // Search command
  disposables.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.knowledgeGraph.search', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search across all markdown files',
        placeHolder: 'Enter search terms...',
      });
      if (!query) return;

      const results: SearchResult[] = db.search(query);
      if (results.length === 0) {
        vscode.window.showInformationMessage(`No results for "${query}"`);
        return;
      }

      const picked = await vscode.window.showQuickPick(
        results.map(r => ({
          label: r.title,
          description: r.path,
          detail: r.snippet,
          result: r,
        })),
        { placeHolder: `${results.length} results for "${query}"` },
      );

      if (picked) {
        const uri = vscode.Uri.file(path.join(workspacePath, picked.result.path));
        await vscode.commands.executeCommand('vscode.open', uri);
      }
    })
  );

  // Show Graph Stats command
  disposables.push(
    vscode.commands.registerCommand('gptAiMarkdownEditor.knowledgeGraph.stats', () => {
      const count = db.getDocumentCount();
      const tags = db.getAllTags();
      const topTags = tags.slice(0, 10).map(t => `#${t.tag} (${t.count})`).join(', ');
      vscode.window.showInformationMessage(
        `Knowledge Graph: ${count} documents, ${tags.length} unique tags. Top: ${topTags || 'none'}`
      );
    })
  );

  return disposables;
}
```

---

### 9.7 `src/features/fluxflow/index.ts`

The main orchestrator. Single entry point for `extension.ts`.

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { GraphDatabase } from './database';
import { parseMarkdownFile } from './indexer';
import { FluxFlowWatcher } from './watcher';
import { BacklinksViewProvider } from './backlinksView';
import { registerFluxFlowCommands } from './commands';

let database: GraphDatabase | null = null;
let watcher: FluxFlowWatcher | null = null;
let backlinksView: BacklinksViewProvider | null = null;
let disposables: vscode.Disposable[] = [];

/**
 * Initialize the Knowledge Graph system.
 * Call from extension.ts activate() when the feature flag is enabled.
 */
export async function initialize(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;

  const workspacePath = workspaceFolder.uri.fsPath;

  // 1. Open database
  database = new GraphDatabase();
  await database.open(workspacePath);

  // 2. Register Backlinks TreeView
  backlinksView = new BacklinksViewProvider(
    workspacePath,
    (docPath) => database!.getBacklinks(docPath),
    (docPath) => database!.getUnlinkedReferences(docPath),
  );

  const treeView = vscode.window.createTreeView('gptAiMarkdownEditorBacklinks', {
    treeDataProvider: backlinksView,
    showCollapseAll: true,
  });
  disposables.push(treeView);

  // 3. Track active editor to update backlinks
  disposables.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (!backlinksView) return;
      if (editor && editor.document.uri.scheme === 'file' &&
          editor.document.languageId === 'markdown') {
        const relPath = path.relative(workspacePath, editor.document.uri.fsPath)
          .split(path.sep).join('/');
        backlinksView.updateActiveDocument(relPath);
      } else {
        backlinksView.updateActiveDocument(null);
      }
    })
  );

  // Also update when custom editor becomes active
  disposables.push(
    vscode.window.onDidChangeVisibleTextEditors(() => {
      // For custom editors, we'll listen to a webview message or 
      // use the active document URI command
      const uri = vscode.window.activeTextEditor?.document.uri;
      if (uri && uri.scheme === 'file' && uri.fsPath.endsWith('.md')) {
        const relPath = path.relative(workspacePath, uri.fsPath)
          .split(path.sep).join('/');
        backlinksView?.updateActiveDocument(relPath);
      }
    })
  );

  // 4. Register commands
  const cmdDisposables = registerFluxFlowCommands(
    database,
    workspacePath,
    () => fullIndex(workspacePath),
  );
  disposables.push(...cmdDisposables);

  // 5. Start file watcher
  watcher = new FluxFlowWatcher(
    // onFileChanged
    (uri) => {
      const relPath = path.relative(workspacePath, uri.fsPath)
        .split(path.sep).join('/');
      indexSingleFile(workspacePath, relPath);
    },
    // onFileDeleted
    (uri) => {
      const relPath = path.relative(workspacePath, uri.fsPath)
        .split(path.sep).join('/');
      database?.deleteDocument(relPath);
      database?.scheduleSave();
      backlinksView?.updateActiveDocument(backlinksView['currentDocPath']);
    },
  );
  watcher.start();
  disposables.push(watcher);

  // 6. Run initial full index
  await fullIndex(workspacePath);

  // 7. Listen for setting changes (prompt reload)
  disposables.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('gptAiMarkdownEditor.knowledgeGraph.enabled')) {
        vscode.window.showInformationMessage(
          'Knowledge Graph setting changed. Reload window to apply.',
          'Reload'
        ).then(action => {
          if (action === 'Reload') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
        });
      }
    })
  );

  const count = database.getDocumentCount();
  console.log(`[FluxFlow] Knowledge Graph initialized: ${count} documents indexed`);
}

/**
 * Full re-index of all .md files in the workspace.
 */
async function fullIndex(workspacePath: string): Promise<void> {
  if (!database) return;

  const files = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');

  database.begin();
  try {
    for (const fileUri of files) {
      const relPath = path.relative(workspacePath, fileUri.fsPath)
        .split(path.sep).join('/');
      const content = await fs.promises.readFile(fileUri.fsPath, 'utf-8');

      // Skip unchanged files (compare content hash)
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const existingHash = database.getDocumentHash(relPath);
      if (existingHash === hash) continue;

      const parsed = parseMarkdownFile(content, relPath);
      const docId = database.upsertDocument(relPath, parsed.title, hash);

      // Clear old data for this doc
      database.clearLinksForDocument(docId);
      database.clearTagsForDocument(docId);
      database.clearPropertiesForDocument(docId);
      database.clearFtsForDocument(docId);

      // Insert new data
      for (const link of parsed.links) {
        database.insertLink(docId, link.target, link.lineNumber, link.context);
      }
      for (const tag of parsed.tags) {
        database.insertTag(docId, tag.tag, tag.source);
      }
      for (const prop of parsed.properties) {
        database.insertProperty(docId, prop.key, prop.value);
      }
      database.upsertFts(docId, parsed.title, parsed.bodyText);
    }

    // Resolve wiki-link targets to document IDs
    database.resolveLinks();
    database.commit();
  } catch (err) {
    // Rollback on error — sql.js doesn't have explicit rollback,
    // but commit() won't be called, so changes are discarded on next load
    console.error('[FluxFlow] Index error:', err);
    throw err;
  }

  database.saveNow();
}

/**
 * Re-index a single file (incremental update).
 */
function indexSingleFile(workspacePath: string, relPath: string): void {
  if (!database) return;

  const absPath = path.join(workspacePath, relPath);
  if (!fs.existsSync(absPath)) return;

  const content = fs.readFileSync(absPath, 'utf-8');
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const existingHash = database.getDocumentHash(relPath);
  if (existingHash === hash) return;

  const parsed = parseMarkdownFile(content, relPath);
  const docId = database.upsertDocument(relPath, parsed.title, hash);

  database.clearLinksForDocument(docId);
  database.clearTagsForDocument(docId);
  database.clearPropertiesForDocument(docId);
  database.clearFtsForDocument(docId);

  for (const link of parsed.links) {
    database.insertLink(docId, link.target, link.lineNumber, link.context);
  }
  for (const tag of parsed.tags) {
    database.insertTag(docId, tag.tag, tag.source);
  }
  for (const prop of parsed.properties) {
    database.insertProperty(docId, prop.key, prop.value);
  }
  database.upsertFts(docId, parsed.title, parsed.bodyText);
  database.resolveLinks();
  database.scheduleSave();

  // Refresh backlinks view
  if (backlinksView) {
    backlinksView.updateActiveDocument(backlinksView['currentDocPath']);
  }
}

/**
 * Clean up on extension deactivation.
 */
export function deactivate(): void {
  for (const d of disposables) {
    d.dispose();
  }
  disposables = [];
  watcher = null;
  backlinksView = null;
  database?.close();
  database = null;
}
```

---

## 10. Integration: extension.ts

### Changes Required

**Add import at top (after existing imports):**

```typescript
import * as FluxFlowGraph from './features/fluxflow/index';
```

**In `activate()`, after the existing outline tree view registration, add:**

```typescript
// Initialize Knowledge Graph if enabled
const knowledgeGraphEnabled = vscode.workspace.getConfiguration('gptAiMarkdownEditor')
  .get<boolean>('knowledgeGraph.enabled', false);
if (knowledgeGraphEnabled) {
  FluxFlowGraph.initialize(context).catch(err => {
    console.error('[FluxFlow] Failed to initialize Knowledge Graph:', err);
  });
}
```

**Update `deactivate()` from empty to:**

```typescript
export function deactivate() {
  FluxFlowGraph.deactivate();
}
```

---

## 11. Step-by-Step Implementation Order

Execute these steps in order. Each step should build and run successfully.

### Step 1: Install dependency

```bash
cd /Users/kamran/Documents/GitHub/gpt-ai-markdown-editor
npm install sql.js
npm install --save-dev @types/sql.js
```

### Step 2: Update `scripts/build-extension.js`

Add `copySqlJsWasm()` function and call it after `copyPandocLuaFilters()`.

### Step 3: Update `package.json` — settings

Add the two `knowledgeGraph.*` settings to `contributes.configuration.properties`.

### Step 4: Update `package.json` — commands

Add to `contributes.commands`:

```jsonc
{
  "command": "gptAiMarkdownEditor.knowledgeGraph.rebuildIndex",
  "title": "Knowledge Graph: Rebuild Index",
  "category": "Flux Flow"
},
{
  "command": "gptAiMarkdownEditor.knowledgeGraph.search",
  "title": "Knowledge Graph: Search All Documents",
  "category": "Flux Flow"
},
{
  "command": "gptAiMarkdownEditor.knowledgeGraph.stats",
  "title": "Knowledge Graph: Show Stats",
  "category": "Flux Flow"
}
```

### Step 5: Update `package.json` — view

Add to `contributes.views.explorer`:

```jsonc
{
  "id": "gptAiMarkdownEditorBacklinks",
  "name": "Flux Flow: Backlinks",
  "when": "gptAiMarkdownEditor.knowledgeGraph.enabled",
  "icon": "$(references)"
}
```

The `when` clause uses a context key. Set it in `extension.ts`:

```typescript
vscode.commands.executeCommand('setContext', 'gptAiMarkdownEditor.knowledgeGraph.enabled', true);
```

### Step 6: Create `src/features/fluxflow/types.ts`

Copy exactly from Section 9.1.

### Step 7: Create `src/features/fluxflow/database.ts`

Implement the `GraphDatabase` class from Section 9.2. This is the largest file (~250 lines).

### Step 8: Create `src/features/fluxflow/indexer.ts`

Copy from Section 9.3. This is a pure function with no external dependencies beyond Node.js.

### Step 9: Create `src/features/fluxflow/watcher.ts`

Copy from Section 9.4.

### Step 10: Create `src/features/fluxflow/backlinksView.ts`

Copy from Section 9.5.

### Step 11: Create `src/features/fluxflow/commands.ts`

Copy from Section 9.6.

### Step 12: Create `src/features/fluxflow/index.ts`

Copy from Section 9.7. This wires everything together.

### Step 13: Update `src/extension.ts`

Add import, conditional initialization, and deactivation call per Section 10.

### Step 14: Build and test

```bash
npm run build:debug
```

### Step 15: Manual testing

1. Open VS Code Settings, enable `Knowledge Graph: Enabled`
2. Reload window
3. Check "Flux Flow: Backlinks" panel appears in Explorer sidebar
4. Create two .md files with `[[wiki-links]]` between them
5. Open one — verify backlinks appear for the other
6. Run "Knowledge Graph: Search All Documents" from command palette
7. Run "Knowledge Graph: Show Stats"
8. Run "Knowledge Graph: Rebuild Index"

---

## 12. Testing Guide

### Unit Tests to Write

`**src/__tests__/fluxflow/indexer.test.ts`:**

```typescript
import { parseMarkdownFile } from '../../features/fluxflow/indexer';

describe('parseMarkdownFile', () => {
  it('extracts title from H1', () => {
    const result = parseMarkdownFile('# Hello World\nSome content', 'test.md');
    expect(result.title).toBe('Hello World');
  });

  it('extracts title from frontmatter', () => {
    const result = parseMarkdownFile('---\ntitle: My Title\n---\nContent', 'test.md');
    expect(result.title).toBe('My Title');
  });

  it('falls back to filename for title', () => {
    const result = parseMarkdownFile('No heading here', 'my-note.md');
    expect(result.title).toBe('my-note');
  });

  it('extracts wiki-links', () => {
    const result = parseMarkdownFile('See [[Other Doc]] and [[Another]]', 'test.md');
    expect(result.links).toHaveLength(2);
    expect(result.links[0].target).toBe('other doc');
    expect(result.links[1].target).toBe('another');
  });

  it('extracts inline tags', () => {
    const result = parseMarkdownFile('This is #important and #todo', 'test.md');
    expect(result.tags).toHaveLength(2);
    expect(result.tags[0].tag).toBe('important');
    expect(result.tags[0].source).toBe('inline');
  });

  it('extracts frontmatter tags', () => {
    const result = parseMarkdownFile('---\ntags: [project, draft]\n---\nContent', 'test.md');
    expect(result.tags).toHaveLength(2);
    expect(result.tags[0].tag).toBe('project');
    expect(result.tags[0].source).toBe('frontmatter');
  });

  it('deduplicates tags', () => {
    const result = parseMarkdownFile('---\ntags: [project]\n---\n#project here', 'test.md');
    expect(result.tags).toHaveLength(1);
  });

  it('extracts frontmatter properties', () => {
    const result = parseMarkdownFile('---\nstatus: draft\nauthor: John\n---\n', 'test.md');
    expect(result.properties).toHaveLength(2);
    expect(result.properties[0]).toEqual({ key: 'status', value: 'draft' });
  });

  it('captures wiki-link context', () => {
    const result = parseMarkdownFile('Here is a reference to [[My Note]] in context', 'test.md');
    expect(result.links[0].context).toContain('[[My Note]]');
  });

  it('handles empty file', () => {
    const result = parseMarkdownFile('', 'empty.md');
    expect(result.title).toBe('empty');
    expect(result.links).toHaveLength(0);
    expect(result.tags).toHaveLength(0);
  });

  it('extracts line numbers for links', () => {
    const result = parseMarkdownFile('Line 1\n[[Link1]]\nLine 3\n[[Link2]]', 'test.md');
    expect(result.links[0].lineNumber).toBe(2);
    expect(result.links[1].lineNumber).toBe(4);
  });
});
```

### Manual Test Checklist

- Feature flag OFF → no backlinks panel, no commands registered, no console errors
- Feature flag ON + reload → backlinks panel appears in Explorer
- Create `a.md` with `[[b]]`, create `b.md` → open `b.md` → see `a.md` in backlinks
- Edit `a.md` to remove `[[b]]` → save → backlinks for `b.md` update (empty)
- Delete `a.md` → backlinks clear, no errors
- Command palette: "Knowledge Graph: Search" → enter term → results appear
- Command palette: "Knowledge Graph: Rebuild Index" → notification with count
- Command palette: "Knowledge Graph: Show Stats" → notification with stats
- Reopen VS Code → database persists at `~/.fluxflow/workspaces/{hash}/graph.db`
- Workspace with 100+ .md files → indexes within seconds, no UI freeze
- Frontmatter tags appear in graph stats
- Unlinked references: doc title mentioned as plain text in another doc shows under "Unlinked References"

---

## Appendix: Future Phases (Not in This Spec)

- **Phase 2**: Property filter commands, tag browser TreeView, rich search webview
- **Phase 3**: D3-force graph visualization webview (global + local neighborhood)
- **Phase 4**: AI context injection (pass backlinks to AI prompts)
- **Phase 5**: Multi-format indexing (.docx, .xlsx, .pptx)