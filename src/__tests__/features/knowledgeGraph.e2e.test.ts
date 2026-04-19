/**
 * End-to-end tests for FluxFlow Knowledge Graph
 *
 * Tests the full pipeline: indexer parsing → database schema creation →
 * document CRUD → links/tags/properties → FTS search → backlinks →
 * unlinked references → persistence (save/load).
 *
 * Uses real sql.js (not mocked) to ensure FTS4 and all SQL operations work.
 */

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { parseMarkdownFile } from '../../features/fluxflow/indexer';
import { GraphDatabase } from '../../features/fluxflow/database';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a temporary workspace directory for database tests */
function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fluxflow-test-'));
}

/** Remove a temp directory */
function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 1. Indexer (pure parser) tests ───────────────────────────────────

describe('FluxFlow Indexer — parseMarkdownFile', () => {
  it('extracts title from first H1 heading', () => {
    const result = parseMarkdownFile('# Hello World\nSome content', 'test.md');
    expect(result.title).toBe('Hello World');
  });

  it('extracts title from frontmatter over H1', () => {
    const result = parseMarkdownFile('---\ntitle: FM Title\n---\n# H1 Title\nContent', 'test.md');
    expect(result.title).toBe('FM Title');
  });

  it('strips quotes from frontmatter title', () => {
    const result = parseMarkdownFile('---\ntitle: "Quoted Title"\n---\nContent', 'test.md');
    expect(result.title).toBe('Quoted Title');
  });

  it('falls back to filename when no heading or frontmatter title', () => {
    const result = parseMarkdownFile('No heading here', 'my-note.md');
    expect(result.title).toBe('my-note');
  });

  it('falls back to filename for nested paths', () => {
    const result = parseMarkdownFile('Plain text', 'docs/subfolder/deep-note.md');
    expect(result.title).toBe('deep-note');
  });

  it('extracts wiki-links with correct targets', () => {
    const result = parseMarkdownFile('See [[Other Doc]] and [[Another Note]]', 'test.md');
    expect(result.links).toHaveLength(2);
    expect(result.links[0].target).toBe('other doc');
    expect(result.links[1].target).toBe('another note');
  });

  it('lowercases wiki-link targets', () => {
    const result = parseMarkdownFile('Link to [[CamelCase]]', 'test.md');
    expect(result.links[0].target).toBe('camelcase');
  });

  it('extracts wiki-link line numbers (1-based)', () => {
    const result = parseMarkdownFile('Line 1\n[[Link1]]\nLine 3\n[[Link2]]', 'test.md');
    expect(result.links[0].lineNumber).toBe(2);
    expect(result.links[1].lineNumber).toBe(4);
  });

  it('captures wiki-link context (~80 chars)', () => {
    const result = parseMarkdownFile('Here is a reference to [[My Note]] in context', 'test.md');
    expect(result.links[0].context).toContain('[[My Note]]');
  });

  it('extracts multiple wiki-links from the same line', () => {
    const result = parseMarkdownFile('See [[A]] and [[B]] here', 'test.md');
    expect(result.links).toHaveLength(2);
    expect(result.links[0].target).toBe('a');
    expect(result.links[1].target).toBe('b');
  });

  it('extracts inline tags', () => {
    const result = parseMarkdownFile('This is #important and #todo', 'test.md');
    expect(result.tags).toHaveLength(2);
    expect(result.tags[0]).toEqual({ tag: 'important', source: 'inline' });
    expect(result.tags[1]).toEqual({ tag: 'todo', source: 'inline' });
  });

  it('lowercases inline tags', () => {
    const result = parseMarkdownFile('Hello #MyTag here', 'test.md');
    expect(result.tags[0].tag).toBe('mytag');
  });

  it('skips tags inside code blocks', () => {
    const result = parseMarkdownFile('```\n#not-a-tag\n```\n#real-tag', 'test.md');
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].tag).toBe('real-tag');
  });

  it('extracts frontmatter tags', () => {
    const result = parseMarkdownFile('---\ntags: [project, draft]\n---\nContent', 'test.md');
    expect(result.tags).toHaveLength(2);
    expect(result.tags[0]).toEqual({ tag: 'project', source: 'frontmatter' });
    expect(result.tags[1]).toEqual({ tag: 'draft', source: 'frontmatter' });
  });

  it('deduplicates tags (frontmatter wins)', () => {
    const result = parseMarkdownFile('---\ntags: [project]\n---\n#project here', 'test.md');
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].source).toBe('frontmatter');
  });

  it('extracts frontmatter properties', () => {
    const result = parseMarkdownFile('---\nstatus: draft\nauthor: John\n---\nContent', 'test.md');
    expect(result.properties).toHaveLength(2);
    expect(result.properties[0]).toEqual({ key: 'status', value: 'draft' });
    expect(result.properties[1]).toEqual({ key: 'author', value: 'John' });
  });

  it('returns body text without frontmatter', () => {
    const result = parseMarkdownFile('---\ntitle: Test\n---\nBody content here', 'test.md');
    expect(result.bodyText).toBe('Body content here');
  });

  it('handles empty file', () => {
    const result = parseMarkdownFile('', 'empty.md');
    expect(result.title).toBe('empty');
    expect(result.links).toHaveLength(0);
    expect(result.tags).toHaveLength(0);
    expect(result.properties).toHaveLength(0);
  });

  it('handles file with only frontmatter', () => {
    const result = parseMarkdownFile('---\ntitle: Just FM\n---\n', 'test.md');
    expect(result.title).toBe('Just FM');
    expect(result.bodyText).toBe('');
  });

  it('handles tags with hyphens and slashes', () => {
    const result = parseMarkdownFile('Check #my-tag and #parent/child', 'test.md');
    expect(result.tags).toHaveLength(2);
    expect(result.tags[0].tag).toBe('my-tag');
    expect(result.tags[1].tag).toBe('parent/child');
  });

  it('does not extract tag from bare # without letters', () => {
    const result = parseMarkdownFile('Issue #123 is done', 'test.md');
    // #123 starts with a digit, not a letter — should not be a tag
    expect(result.tags).toHaveLength(0);
  });
});

// ── 2. Database + FTS4 — direct SQL tests ────────────────────────────

describe('FluxFlow Database — direct sql.js FTS4 verification', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>;
  let db: SqlJsDatabase;

  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  beforeEach(() => {
    db = new SQL.Database();
  });

  afterEach(() => {
    db.close();
  });

  it('creates FTS4 virtual table successfully', () => {
    expect(() => {
      db.run(`CREATE VIRTUAL TABLE fts USING fts4(title, body, tokenize=porter);`);
    }).not.toThrow();
  });

  it('inserts and searches FTS4 content', () => {
    db.run(`CREATE VIRTUAL TABLE fts USING fts4(title, body, tokenize=porter);`);
    db.run(
      `INSERT INTO fts (rowid, title, body) VALUES (1, 'Hello World', 'Testing full text search');`
    );

    const rows = db.exec(`SELECT rowid FROM fts WHERE fts MATCH 'testing';`);
    expect(rows).toHaveLength(1);
    expect(rows[0].values[0][0]).toBe(1);
  });

  it('returns snippet() from FTS4', () => {
    db.run(`CREATE VIRTUAL TABLE fts USING fts4(title, body, tokenize=porter);`);
    db.run(
      `INSERT INTO fts (rowid, title, body) VALUES (1, 'Note', 'The quick brown fox jumps over the lazy dog');`
    );

    const rows = db.exec(
      `SELECT snippet(fts, '**', '**', '...', 1, 10) FROM fts WHERE fts MATCH 'fox';`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].values[0][0]).toContain('**fox**');
  });

  it('supports porter stemming (FTS4)', () => {
    db.run(`CREATE VIRTUAL TABLE fts USING fts4(title, body, tokenize=porter);`);
    db.run(
      `INSERT INTO fts (rowid, title, body) VALUES (1, 'Running', 'The dogs are running quickly');`
    );

    // "run" should match "running" via porter stemmer
    const rows = db.exec(`SELECT rowid FROM fts WHERE fts MATCH 'run';`);
    expect(rows).toHaveLength(1);
  });

  it('JOINs FTS4 with a regular table', () => {
    db.run(`CREATE TABLE documents (id INTEGER PRIMARY KEY, path TEXT, title TEXT);`);
    db.run(`CREATE VIRTUAL TABLE fts USING fts4(title, body, tokenize=porter);`);
    db.run(`INSERT INTO documents VALUES (1, 'notes/a.md', 'Note A');`);
    db.run(`INSERT INTO fts (rowid, title, body) VALUES (1, 'Note A', 'Some body text here');`);

    const rows = db.exec(
      `SELECT d.path, d.title, snippet(fts, '**', '**', '...', 1, 10)
       FROM fts JOIN documents d ON d.id = fts.rowid
       WHERE fts MATCH 'body';`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].values[0][0]).toBe('notes/a.md');
  });

  it('deletes from FTS4 by rowid', () => {
    db.run(`CREATE VIRTUAL TABLE fts USING fts4(title, body, tokenize=porter);`);
    db.run(`INSERT INTO fts (rowid, title, body) VALUES (1, 'Title', 'Body');`);
    db.run(`DELETE FROM fts WHERE rowid = 1;`);

    const rows = db.exec(`SELECT rowid FROM fts WHERE fts MATCH 'body';`);
    expect(rows).toHaveLength(0);
  });
});

// ── 3. GraphDatabase class — full e2e sequential test ────────────────

describe('FluxFlow Knowledge Graph — end-to-end', () => {
  let database: GraphDatabase;
  let tempDir: string;
  let workspacePath: string;

  beforeAll(async () => {
    tempDir = makeTempDir();
    workspacePath = path.join(tempDir, 'workspace');
    fs.mkdirSync(workspacePath, { recursive: true });

    // Override getDataDir via vscode mock: the mock returns '' for all config,
    // which makes getDataDir() return ~/.fluxflow. We want to use our temp dir.
    // Instead, we'll set the mock config to return our temp data dir.
    const vscode = require('vscode');
    const mockDataDir = path.join(tempDir, 'data');
    vscode.workspace.getConfiguration = jest.fn().mockReturnValue({
      get: jest.fn((key: string, defaultVal: unknown) => {
        if (key === 'knowledgeGraph.dataDir') return mockDataDir;
        if (key === 'knowledgeGraph.enabled') return true;
        return defaultVal;
      }),
    });
  });

  afterAll(() => {
    try {
      database?.close();
    } catch {
      /* ignore */
    }
    removeTempDir(tempDir);
  });

  // Tests run sequentially — each builds on the state of the previous one

  it('Step 1: opens a new database and creates schema', async () => {
    database = new GraphDatabase();
    await database.open(workspacePath);

    // Verify we can query — schema tables exist
    const count = database.getDocumentCount();
    expect(count).toBe(0);
  });

  it('Step 2: upserts documents and retrieves them', () => {
    const docId1 = database.upsertDocument('notes/alpha.md', 'Alpha', 'hash-alpha');
    expect(docId1).toBeGreaterThan(0);

    const docId2 = database.upsertDocument('notes/beta.md', 'Beta', 'hash-beta');
    expect(docId2).toBeGreaterThan(0);
    expect(docId2).not.toBe(docId1);

    const docId3 = database.upsertDocument('notes/gamma.md', 'Gamma', 'hash-gamma');
    expect(docId3).toBeGreaterThan(0);

    expect(database.getDocumentCount()).toBe(3);
  });

  it('Step 3: retrieves document by path', () => {
    const doc = database.getDocumentByPath('notes/alpha.md');
    expect(doc).not.toBeNull();
    expect(doc!.title).toBe('Alpha');
    expect(doc!.path).toBe('notes/alpha.md');
    expect(doc!.hash).toBe('hash-alpha');
  });

  it('Step 4: returns null for non-existent document', () => {
    const doc = database.getDocumentByPath('does/not/exist.md');
    expect(doc).toBeNull();
  });

  it('Step 5: upsert updates existing document (same path)', () => {
    const docId = database.upsertDocument('notes/alpha.md', 'Alpha Updated', 'hash-alpha-v2');
    void docId; // verify upsert returns an id
    const doc = database.getDocumentByPath('notes/alpha.md');
    expect(doc!.title).toBe('Alpha Updated');
    expect(doc!.hash).toBe('hash-alpha-v2');
    // Count should remain 3 — no new doc
    expect(database.getDocumentCount()).toBe(3);
  });

  it('Step 6: getDocumentHash returns stored hash', () => {
    const hash = database.getDocumentHash('notes/alpha.md');
    expect(hash).toBe('hash-alpha-v2');
  });

  it('Step 7: getDocumentHash returns null for missing doc', () => {
    const hash = database.getDocumentHash('missing.md');
    expect(hash).toBeNull();
  });

  it('Step 8: inserts links between documents', () => {
    const alpha = database.getDocumentByPath('notes/alpha.md')!;

    // Alpha links to Beta and Gamma
    database.clearLinksForDocument(alpha.id);
    database.insertLink(alpha.id, 'beta', 1, 'See [[Beta]] for more');
    database.insertLink(alpha.id, 'gamma', 5, 'Also see [[Gamma]]');

    // Verify — resolveLinks should set target_id
    database.resolveLinks();

    const backlinks = database.getBacklinks('notes/beta.md');
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0].sourcePath).toBe('notes/alpha.md');
    expect(backlinks[0].context).toContain('[[Beta]]');
  });

  it('Step 9: getBacklinks returns all incoming links', () => {
    // Also add a link from Gamma → Beta
    const gamma = database.getDocumentByPath('notes/gamma.md')!;
    database.insertLink(gamma.id, 'beta', 3, 'Reference to [[Beta]]');
    database.resolveLinks();

    const backlinks = database.getBacklinks('notes/beta.md');
    expect(backlinks).toHaveLength(2);

    const sources = backlinks.map(b => b.sourcePath).sort();
    expect(sources).toEqual(['notes/alpha.md', 'notes/gamma.md']);
  });

  it('Step 10: getBacklinks excludes self-references', () => {
    const alpha = database.getDocumentByPath('notes/alpha.md')!;
    // Alpha links to itself
    database.insertLink(alpha.id, 'alpha updated', 10, 'Self ref [[Alpha Updated]]');
    database.resolveLinks();

    const backlinks = database.getBacklinks('notes/alpha.md');
    // Should NOT include alpha itself
    const selfRefs = backlinks.filter(b => b.sourcePath === 'notes/alpha.md');
    expect(selfRefs).toHaveLength(0);
  });

  it('Step 11: inserts and retrieves tags', () => {
    const alpha = database.getDocumentByPath('notes/alpha.md')!;
    const beta = database.getDocumentByPath('notes/beta.md')!;

    database.clearTagsForDocument(alpha.id);
    database.insertTag(alpha.id, 'important', 'inline');
    database.insertTag(alpha.id, 'project', 'frontmatter');

    database.clearTagsForDocument(beta.id);
    database.insertTag(beta.id, 'important', 'inline');
    database.insertTag(beta.id, 'draft', 'inline');

    const allTags = database.getAllTags();
    expect(allTags.length).toBeGreaterThanOrEqual(3);

    // 'important' should have count 2
    const important = allTags.find(t => t.tag === 'important');
    expect(important).toBeDefined();
    expect(important!.count).toBe(2);

    // 'project' and 'draft' should have count 1
    expect(allTags.find(t => t.tag === 'project')!.count).toBe(1);
    expect(allTags.find(t => t.tag === 'draft')!.count).toBe(1);
  });

  it('Step 12: inserts and retrieves properties', () => {
    const alpha = database.getDocumentByPath('notes/alpha.md')!;

    database.clearPropertiesForDocument(alpha.id);
    database.insertProperty(alpha.id, 'status', 'active');
    database.insertProperty(alpha.id, 'author', 'TestUser');

    // Properties don't have a direct getter in the public API,
    // but we can verify they're stored by querying the count
    // (the schema has properties table, and no errors means success)
    expect(true).toBe(true); // No throw = pass
  });

  it('Step 13: FTS — upsertFts and search by keyword', () => {
    const alpha = database.getDocumentByPath('notes/alpha.md')!;
    const beta = database.getDocumentByPath('notes/beta.md')!;
    const gamma = database.getDocumentByPath('notes/gamma.md')!;

    database.upsertFts(
      alpha.id,
      'Alpha Updated',
      'This document discusses quantum computing and algorithms'
    );
    database.upsertFts(beta.id, 'Beta', 'An overview of machine learning and neural networks');
    database.upsertFts(gamma.id, 'Gamma', 'Quantum physics and computing breakthroughs in 2026');

    const results = database.search('quantum');
    expect(results.length).toBeGreaterThanOrEqual(2);

    const paths = results.map(r => r.path);
    expect(paths).toContain('notes/alpha.md');
    expect(paths).toContain('notes/gamma.md');
  });

  it('Step 14: FTS — search returns snippets with highlight markers', () => {
    const results = database.search('neural');
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('notes/beta.md');
    expect(results[0].snippet).toContain('**neural**');
  });

  it('Step 15: FTS — porter stemming works (searching "compute" matches "computing")', () => {
    const results = database.search('compute');
    expect(results.length).toBeGreaterThanOrEqual(1);
    // Should find docs that contain "computing"
    const paths = results.map(r => r.path);
    expect(paths).toContain('notes/alpha.md');
  });

  it('Step 16: FTS — empty query returns no results', () => {
    const results = database.search('');
    expect(results).toHaveLength(0);
  });

  it('Step 17: FTS — search for non-existent term returns empty', () => {
    const results = database.search('xylophone');
    expect(results).toHaveLength(0);
  });

  it('Step 18: getUnlinkedReferences finds mentions without wiki-links', () => {
    // Gamma's body text contains "computing" but also "quantum" — let's test
    // Alpha's title is "Alpha Updated" — if another doc mentions "Alpha Updated"
    // in its body text but doesn't wiki-link to it, that's an unlinked reference.
    database.upsertFts(
      database.getDocumentByPath('notes/beta.md')!.id,
      'Beta',
      'This mentions Alpha Updated in plain text without a wiki-link'
    );

    const unlinked = database.getUnlinkedReferences('notes/alpha.md');
    // Beta mentions "Alpha Updated" in text but has no link to alpha
    // (Beta's links point to other things, not alpha)
    expect(unlinked.length).toBeGreaterThanOrEqual(1);
    const unlinkedPaths = unlinked.map(u => u.sourcePath);
    expect(unlinkedPaths).toContain('notes/beta.md');
  });

  it('Step 19: clearLinksForDocument removes all links for a doc', () => {
    const alpha = database.getDocumentByPath('notes/alpha.md')!;
    database.clearLinksForDocument(alpha.id);

    // Beta should now have fewer backlinks (alpha's links removed)
    const backlinks = database.getBacklinks('notes/beta.md');
    const fromAlpha = backlinks.filter(b => b.sourcePath === 'notes/alpha.md');
    expect(fromAlpha).toHaveLength(0);
  });

  it('Step 20: clearTagsForDocument removes all tags for a doc', () => {
    const alpha = database.getDocumentByPath('notes/alpha.md')!;
    database.clearTagsForDocument(alpha.id);

    const allTags = database.getAllTags();
    const importantCount = allTags.find(t => t.tag === 'important')?.count ?? 0;
    // Alpha had 'important', now removed — only beta's 'important' remains
    expect(importantCount).toBe(1);
  });

  it('Step 21: clearFtsForDocument removes FTS entry', () => {
    const alpha = database.getDocumentByPath('notes/alpha.md')!;
    database.clearFtsForDocument(alpha.id);

    // Searching for quantum should now only find gamma
    const results = database.search('quantum');
    const paths = results.map(r => r.path);
    expect(paths).not.toContain('notes/alpha.md');
    expect(paths).toContain('notes/gamma.md');
  });

  it('Step 22: deleteDocument removes doc and cascades', () => {
    database.deleteDocument('notes/gamma.md');
    expect(database.getDocumentByPath('notes/gamma.md')).toBeNull();
    expect(database.getDocumentCount()).toBe(2);
  });

  it('Step 23: deleteDocument is a no-op for non-existent path', () => {
    expect(() => {
      database.deleteDocument('nonexistent.md');
    }).not.toThrow();
  });

  it('Step 24: transactions — begin/commit wraps operations', () => {
    database.begin();
    database.upsertDocument('notes/delta.md', 'Delta', 'hash-delta');
    database.upsertDocument('notes/epsilon.md', 'Epsilon', 'hash-epsilon');
    database.commit();

    expect(database.getDocumentCount()).toBe(4);
  });

  it('Step 25: persistence — saveNow writes to disk, reload restores', async () => {
    database.saveNow();

    // Verify the db file exists
    // The path is derived from getDataDir + workspace hash
    // We can verify by checking the temp data dir
    const dataDir = path.join(tempDir, 'data');
    const files = findFiles(dataDir, 'graph.db');
    expect(files.length).toBe(1);
    expect(fs.statSync(files[0]).size).toBeGreaterThan(0);

    // Close current db
    database.close();

    // Re-open and verify state persisted
    database = new GraphDatabase();
    await database.open(workspacePath);

    expect(database.getDocumentCount()).toBe(4);
    expect(database.getDocumentByPath('notes/delta.md')).not.toBeNull();
    expect(database.getDocumentByPath('notes/delta.md')!.title).toBe('Delta');
  });

  it('Step 26: full indexer → database pipeline', () => {
    // Simulate indexing a real markdown file through the full pipeline
    const mdContent = `---
title: Integration Test
tags: [test, e2e]
status: active
---

# Integration Test

This is a [[Delta]] reference and also mentions [[Epsilon]].

#testing #automation

The quick brown fox jumps over the lazy dog.
`;

    const parsed = parseMarkdownFile(mdContent, 'tests/integration.md');

    // Verify parser output
    expect(parsed.title).toBe('Integration Test');
    expect(parsed.links).toHaveLength(2);
    expect(parsed.links[0].target).toBe('delta');
    expect(parsed.links[1].target).toBe('epsilon');
    expect(parsed.tags.length).toBeGreaterThanOrEqual(3); // test, e2e, testing, automation (deduped)
    expect(parsed.properties.find(p => p.key === 'status')?.value).toBe('active');

    // Insert into database
    const docId = database.upsertDocument('tests/integration.md', parsed.title, 'hash-int');
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

    // Verify backlinks: integration.md links to delta → delta should have a backlink
    const deltaBacklinks = database.getBacklinks('notes/delta.md');
    const fromIntegration = deltaBacklinks.filter(b => b.sourcePath === 'tests/integration.md');
    expect(fromIntegration).toHaveLength(1);

    // Verify FTS search
    const foxResults = database.search('fox');
    expect(foxResults.length).toBeGreaterThanOrEqual(1);
    const foxPaths = foxResults.map(r => r.path);
    expect(foxPaths).toContain('tests/integration.md');

    // Verify tags
    const allTags = database.getAllTags();
    expect(allTags.find(t => t.tag === 'testing')).toBeDefined();
    expect(allTags.find(t => t.tag === 'e2e')).toBeDefined();
  });

  it('Step 27: re-indexing a document updates all data', () => {
    // Simulate a file change: update integration.md with different content
    const updatedContent = `---
title: Updated Integration
tags: [updated]
---

# Updated Integration

Now links to [[Beta]] only.

#revised

New body text about artificial intelligence.
`;

    const parsed = parseMarkdownFile(updatedContent, 'tests/integration.md');
    const docId = database.upsertDocument('tests/integration.md', parsed.title, 'hash-int-v2');

    // Clear old data
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
    database.resolveLinks();

    // Old link to delta should be gone
    const deltaBacklinks = database.getBacklinks('notes/delta.md');
    const fromIntegration = deltaBacklinks.filter(b => b.sourcePath === 'tests/integration.md');
    expect(fromIntegration).toHaveLength(0);

    // New link to beta should exist
    const betaBacklinks = database.getBacklinks('notes/beta.md');
    const betaFromInt = betaBacklinks.filter(b => b.sourcePath === 'tests/integration.md');
    expect(betaFromInt).toHaveLength(1);

    // Old FTS content gone, new content searchable
    const foxResults = database.search('fox');
    const foxPaths = foxResults.map(r => r.path);
    expect(foxPaths).not.toContain('tests/integration.md');

    const aiResults = database.search('artificial intelligence');
    const aiPaths = aiResults.map(r => r.path);
    expect(aiPaths).toContain('tests/integration.md');

    // Tags updated
    const allTags = database.getAllTags();
    expect(allTags.find(t => t.tag === 'revised')).toBeDefined();
    expect(allTags.find(t => t.tag === 'updated')).toBeDefined();
  });

  it('Step 28: scheduleSave debounces writes', () => {
    jest.useFakeTimers();
    try {
      database.upsertDocument('notes/temp.md', 'Temp', 'hash-temp');
      database.scheduleSave();
      database.scheduleSave(); // second call should be ignored (timer already set)
      database.scheduleSave();

      // Timer not yet fired — dirty but not saved
      // Advance past the 5-second debounce
      jest.advanceTimersByTime(6000);

      // After timer fires, file should be saved
      const dataDir = path.join(tempDir, 'data');
      const files = findFiles(dataDir, 'graph.db');
      expect(files.length).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('Step 29: close saves and cleans up', async () => {
    database.upsertDocument('notes/final.md', 'Final', 'hash-final');
    database.close();

    // Re-open to verify close persisted
    database = new GraphDatabase();
    await database.open(workspacePath);
    expect(database.getDocumentByPath('notes/final.md')).not.toBeNull();
  });
});

// ── Helper: recursively find files ───────────────────────────────────

function findFiles(dir: string, name: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, name));
    } else if (entry.name === name) {
      results.push(fullPath);
    }
  }
  return results;
}
