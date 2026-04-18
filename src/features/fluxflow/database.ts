/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import initSqlJs, { Database } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import type { GraphDocument, BacklinkEntry, SearchResult } from './types';

const SCHEMA_VERSION = 1;

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  path        TEXT    NOT NULL UNIQUE,
  title       TEXT    NOT NULL DEFAULT '',
  hash        TEXT    NOT NULL DEFAULT '',
  indexed_at  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id   INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_title TEXT   NOT NULL,
  target_id   INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  line_number INTEGER NOT NULL DEFAULT 0,
  context     TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id      INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag         TEXT    NOT NULL,
  source      TEXT    NOT NULL DEFAULT 'inline'
);

CREATE TABLE IF NOT EXISTS properties (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id      INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  key         TEXT    NOT NULL,
  value       TEXT    NOT NULL DEFAULT ''
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(
  title,
  body,
  content='',
  tokenize='porter unicode61'
);

CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_id);
CREATE INDEX IF NOT EXISTS idx_links_target_title ON links(target_title);
CREATE INDEX IF NOT EXISTS idx_tags_doc ON tags(doc_id);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
CREATE INDEX IF NOT EXISTS idx_properties_doc ON properties(doc_id);
CREATE INDEX IF NOT EXISTS idx_properties_key ON properties(key);
`;

function getDataDir(): string {
  const custom = vscode.workspace
    .getConfiguration('gptAiMarkdownEditor')
    .get<string>('knowledgeGraph.dataDir', '');
  if (custom) {
    return custom.startsWith('~') ? path.join(os.homedir(), custom.slice(1)) : custom;
  }
  return path.join(os.homedir(), '.fluxflow');
}

function getWorkspaceHash(workspacePath: string): string {
  return crypto.createHash('sha256').update(workspacePath).digest('hex').slice(0, 16);
}

export class GraphDatabase {
  private db: Database | null = null;
  private dbPath: string = '';
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty: boolean = false;

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

  close(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.saveNow();
    this.db?.close();
    this.db = null;
  }

  private initSchema(): void {
    if (!this.db) return;
    const result = this.db.exec('PRAGMA user_version;');
    const currentVersion = (result[0]?.values[0]?.[0] as number) ?? 0;

    if (currentVersion < SCHEMA_VERSION) {
      for (const statement of SCHEMA_DDL.split(';')) {
        const trimmed = statement.trim();
        if (trimmed) {
          this.db.run(trimmed + ';');
        }
      }
      this.db.run(`PRAGMA user_version = ${SCHEMA_VERSION};`);
      this.dirty = true;
    }
  }

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

  // --- Document operations ---

  upsertDocument(relativePath: string, title: string, hash: string): number {
    this.db!.run(
      `INSERT INTO documents (path, title, hash, indexed_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET title=excluded.title, hash=excluded.hash, indexed_at=excluded.indexed_at`,
      [relativePath, title, hash, Date.now()]
    );
    const rows = this.db!.exec('SELECT id FROM documents WHERE path = ?', [relativePath]);
    this.dirty = true;
    return rows[0].values[0][0] as number;
  }

  getDocumentByPath(relativePath: string): GraphDocument | null {
    const rows = this.db!.exec(
      'SELECT id, path, title, hash, indexed_at FROM documents WHERE path = ?',
      [relativePath]
    );
    if (!rows.length || !rows[0].values.length) return null;
    const r = rows[0].values[0];
    return {
      id: r[0] as number,
      path: r[1] as string,
      title: r[2] as string,
      hash: r[3] as string,
      indexedAt: r[4] as number,
    };
  }

  deleteDocument(relativePath: string): void {
    const doc = this.getDocumentByPath(relativePath);
    if (!doc) return;
    // FTS cleanup first (not cascaded automatically)
    this.clearFtsForDocument(doc.id);
    this.db!.run('DELETE FROM documents WHERE id = ?', [doc.id]);
    this.dirty = true;
  }

  getDocumentHash(relativePath: string): string | null {
    const rows = this.db!.exec('SELECT hash FROM documents WHERE path = ?', [relativePath]);
    if (!rows.length || !rows[0].values.length) return null;
    return rows[0].values[0][0] as string;
  }

  getDocumentCount(): number {
    const rows = this.db!.exec('SELECT COUNT(*) FROM documents');
    return rows[0].values[0][0] as number;
  }

  // --- Link operations ---

  clearLinksForDocument(docId: number): void {
    this.db!.run('DELETE FROM links WHERE source_id = ?', [docId]);
  }

  insertLink(sourceId: number, targetTitle: string, lineNumber: number, context: string): void {
    this.db!.run(
      'INSERT INTO links (source_id, target_title, line_number, context) VALUES (?, ?, ?, ?)',
      [sourceId, targetTitle, lineNumber, context]
    );
  }

  resolveLinks(): void {
    this.db!.run(
      `UPDATE links SET target_id = (
        SELECT d.id FROM documents d WHERE LOWER(d.title) = links.target_title
        LIMIT 1
      ) WHERE target_id IS NULL`
    );
  }

  getBacklinks(docPath: string): BacklinkEntry[] {
    const doc = this.getDocumentByPath(docPath);
    if (!doc) return [];

    const titleLower = doc.title.toLowerCase();
    const rows = this.db!.exec(
      `SELECT DISTINCT d.path, d.title, l.context, l.line_number
       FROM links l
       JOIN documents d ON d.id = l.source_id
       WHERE (l.target_title = ? OR l.target_id = ?)
         AND d.id != ?
       ORDER BY d.path`,
      [titleLower, doc.id, doc.id]
    );

    if (!rows.length) return [];
    return rows[0].values.map(row => ({
      sourcePath: row[0] as string,
      sourceTitle: row[1] as string,
      context: row[2] as string,
      lineNumber: row[3] as number,
    }));
  }

  getUnlinkedReferences(docPath: string): BacklinkEntry[] {
    const doc = this.getDocumentByPath(docPath);
    if (!doc || !doc.title) return [];

    const titleLower = doc.title.toLowerCase();
    // Escape FTS5 special characters
    const safeTitle = doc.title.replace(/['"^*(){}[\]]/g, '').trim();
    if (!safeTitle) return [];

    try {
      const rows = this.db!.exec(
        `SELECT d.path, d.title, '' as context, 0 as line_number
         FROM fts
         JOIN documents d ON d.id = fts.rowid
         WHERE fts MATCH ?
           AND d.id != ?
           AND d.id NOT IN (
             SELECT source_id FROM links WHERE target_title = ? OR target_id = ?
           )
         LIMIT 50`,
        [`"${safeTitle}"`, doc.id, titleLower, doc.id]
      );

      if (!rows.length) return [];
      return rows[0].values.map(row => ({
        sourcePath: row[0] as string,
        sourceTitle: row[1] as string,
        context: row[2] as string,
        lineNumber: row[3] as number,
      }));
    } catch {
      // FTS query can fail on unusual input — return empty
      return [];
    }
  }

  // --- Tag operations ---

  clearTagsForDocument(docId: number): void {
    this.db!.run('DELETE FROM tags WHERE doc_id = ?', [docId]);
  }

  insertTag(docId: number, tag: string, source: 'inline' | 'frontmatter'): void {
    this.db!.run('INSERT INTO tags (doc_id, tag, source) VALUES (?, ?, ?)', [docId, tag, source]);
  }

  getAllTags(): Array<{ tag: string; count: number }> {
    const rows = this.db!.exec(
      'SELECT tag, COUNT(*) as cnt FROM tags GROUP BY tag ORDER BY cnt DESC'
    );
    if (!rows.length) return [];
    return rows[0].values.map(row => ({
      tag: row[0] as string,
      count: row[1] as number,
    }));
  }

  // --- Property operations ---

  clearPropertiesForDocument(docId: number): void {
    this.db!.run('DELETE FROM properties WHERE doc_id = ?', [docId]);
  }

  insertProperty(docId: number, key: string, value: string): void {
    this.db!.run('INSERT INTO properties (doc_id, key, value) VALUES (?, ?, ?)', [
      docId,
      key,
      value,
    ]);
  }

  // --- FTS operations ---

  clearFtsForDocument(docId: number): void {
    try {
      this.db!.run('DELETE FROM fts WHERE rowid = ?', [docId]);
    } catch {
      // FTS contentless tables may not support direct DELETE — ignore
    }
  }

  upsertFts(docId: number, title: string, body: string): void {
    // For contentless FTS5, we use INSERT OR REPLACE via rowid
    try {
      this.db!.run('DELETE FROM fts WHERE rowid = ?', [docId]);
    } catch {
      // ignore
    }
    this.db!.run('INSERT INTO fts (rowid, title, body) VALUES (?, ?, ?)', [docId, title, body]);
  }

  search(query: string): SearchResult[] {
    const safeQuery = query.replace(/['"]/g, '').trim();
    if (!safeQuery) return [];

    try {
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
    } catch {
      return [];
    }
  }

  // --- Transaction helpers ---

  begin(): void {
    this.db!.run('BEGIN TRANSACTION;');
  }

  commit(): void {
    this.db!.run('COMMIT;');
    this.dirty = true;
  }
}
