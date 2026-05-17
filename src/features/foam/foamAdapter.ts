/**
 * FoamAdapter — lightweight workspace indexer for the Graph Chat feature.
 *
 * Indexes markdown (and optionally other configured) files in the VS Code
 * workspace using foam-core's markdown parser for link/tag extraction.
 *
 * We intentionally avoid foam's full `bootstrap()` (which requires VS Code-
 * specific adapters) and instead drive parsing directly from our own file
 * listing so we stay in control of which file types are indexed.
 */

import * as vscode from 'vscode';
import type { FoamNote, FoamBacklink, FoamWorkspaceSnapshot } from './types';

const WIKILINK_RE = /\[\[([^\]|#]+?)(?:[|#][^\]]*?)?\]\]/g;
const TAG_RE = /#([\w/-]+)/g;

// ── Public API ────────────────────────────────────────────────────────────

export interface FoamAdapterOptions {
  /** Glob patterns to include (relative to workspace root). Defaults to ['**\/*.md']. */
  includeGlobs?: string[];
  /** Glob patterns to exclude (defaults to node_modules and .git). */
  excludeGlobs?: string[];
}

let _snapshot: FoamWorkspaceSnapshot | null = null;
let _watcher: vscode.FileSystemWatcher | undefined;

/**
 * Bootstrap the adapter: index all configured files and set up a file watcher
 * to keep the index up to date. Returns the initial snapshot.
 */
export async function initFoamAdapter(
  options: FoamAdapterOptions = {},
  onUpdate?: (snapshot: FoamWorkspaceSnapshot) => void
): Promise<FoamWorkspaceSnapshot> {
  const includeGlobs = options.includeGlobs ?? ['**/*.md'];
  const excludeGlobs = options.excludeGlobs ?? [
    '**/node_modules/**',
    '**/.git/**',
    '**/.vscode/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/.specify/**',
    '**/specs/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/.next/**',
  ];

  _snapshot = await buildSnapshot(includeGlobs, excludeGlobs);

  // Set up file watcher for live updates
  _watcher?.dispose();
  const watchGlob = `**/{${includeGlobs.map(g => g.replace('**/', '')).join(',')}}`;
  _watcher = vscode.workspace.createFileSystemWatcher(watchGlob);

  async function refresh() {
    _snapshot = await buildSnapshot(includeGlobs, excludeGlobs);
    onUpdate?.(_snapshot);
  }

  _watcher.onDidChange(refresh);
  _watcher.onDidCreate(refresh);
  _watcher.onDidDelete(refresh);

  return _snapshot;
}

/** Return the most recent workspace snapshot (or null if not yet initialized). */
export function getFoamSnapshot(): FoamWorkspaceSnapshot | null {
  return _snapshot;
}

/** Dispose the file watcher (call when the extension deactivates). */
export function disposeFoamAdapter(): void {
  _watcher?.dispose();
  _watcher = undefined;
  _snapshot = null;
}

/** Get backlinks for a specific file path. */
export function getBacklinks(filePath: string): FoamBacklink[] {
  if (!_snapshot) return [];
  return _snapshot.backlinks[filePath] ?? [];
}

/**
 * Manually rebuild the workspace snapshot without resetting the file watcher.
 * Use when files have been created/deleted outside VS Code (e.g., git checkout).
 */
export async function reindexWorkspace(): Promise<void> {
  if (!_snapshot) return; // not yet initialized
  const includeGlobs = ['**/*.md'];
  const excludeGlobs = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.vscode/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/.specify/**',
    '**/specs/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/.next/**',
  ];
  _snapshot = await buildSnapshot(includeGlobs, excludeGlobs);
}

// ── Internal ──────────────────────────────────────────────────────────────

async function buildSnapshot(
  includeGlobs: string[],
  excludeGlobs: string[]
): Promise<FoamWorkspaceSnapshot> {
  // Collect all matching files
  const uriSets = await Promise.all(
    includeGlobs.map(glob => vscode.workspace.findFiles(glob, `{${excludeGlobs.join(',')}}`))
  );
  const uris = uriSets.flat();

  // Parse each file to extract title, tags, and wikilinks
  const notes: FoamNote[] = [];
  const outboundLinks: Map<string, string[]> = new Map(); // sourcePath → [targetTitles]

  await Promise.all(
    uris.map(async uri => {
      try {
        const content = await readFile(uri);
        const note = parseNote(uri, content);
        notes.push(note);

        // Record outbound wikilinks
        const links = extractWikilinks(content);
        if (links.length > 0) {
          outboundLinks.set(uri.fsPath, links);
        }
      } catch {
        // Skip unreadable files silently
      }
    })
  );

  // Build backlinks index using multi-strategy resolution
  const backlinks: Record<string, FoamBacklink[]> = {};
  for (const [sourcePath, links] of outboundLinks) {
    const sourceNote = notes.find(n => n.path === sourcePath);
    for (const link of links) {
      const targetNote = resolveNote(notes, link);
      if (targetNote) {
        if (!backlinks[targetNote.path]) backlinks[targetNote.path] = [];
        backlinks[targetNote.path].push({
          sourcePath,
          sourceTitle: sourceNote?.title ?? sourcePath.split('/').pop() ?? sourcePath,
        });
      }
    }
  }

  // Collect all tags
  const tagSet = new Set<string>();
  for (const note of notes) {
    for (const tag of note.tags) tagSet.add(tag);
  }

  return { notes, backlinks, allTags: [...tagSet].sort() };
}

function parseNote(uri: vscode.Uri, content: string): FoamNote {
  const path = uri.fsPath;
  const filename = (path.split('/').pop() ?? path).replace(/\.md$/i, '');
  const title = extractTitle(content) ?? filename;
  const tags = extractTags(content);
  const aliases = extractAliases(content);
  return { path, filename, title, uri: uri.toString(), tags, aliases };
}

// ── Tolaria-inspired 5-strategy wikilink resolution ───────────────────────

/**
 * Resolve a wikilink target to a FoamNote using 5 strategies (in priority order):
 * 1. Path-suffix match  (e.g. "docs/adr/foo" matches ".../docs/adr/foo.md")
 * 2. Filename stem      (e.g. "my-note" matches "my-note.md")
 * 3. Alias             (from frontmatter aliases: field)
 * 4. Exact title match
 * 5. Humanized title   ("my-note" → "my note" title comparison)
 */
function resolveNote(notes: FoamNote[], rawTarget: string): FoamNote | undefined {
  const target = rawTarget.includes('|') ? rawTarget.split('|')[0] : rawTarget;
  const norm = target.toLowerCase();
  const lastSegment = norm.includes('/') ? (norm.split('/').pop() ?? norm) : norm;
  const pathSuffix = norm.includes('/') ? `/${norm}.md` : null;
  const humanized = lastSegment.replace(/-/g, ' ');

  return (
    // 1. Path-suffix match
    (pathSuffix ? notes.find(n => n.path.toLowerCase().endsWith(pathSuffix)) : undefined) ??
    // 2. Filename stem match
    notes.find(
      n => n.filename.toLowerCase() === norm || n.filename.toLowerCase() === lastSegment
    ) ??
    // 3. Alias match
    notes.find(n =>
      n.aliases.some(a => a.toLowerCase() === norm || a.toLowerCase() === lastSegment)
    ) ??
    // 4. Exact title match
    notes.find(n => n.title.toLowerCase() === norm || n.title.toLowerCase() === lastSegment) ??
    // 5. Humanized title
    (humanized !== norm ? notes.find(n => n.title.toLowerCase() === humanized) : undefined)
  );
}

function extractTitle(content: string): string | null {
  // Try frontmatter title first
  const fmMatch = content.match(/^---[\s\S]*?^title:\s*["']?(.+?)["']?\s*$/m);
  if (fmMatch) return fmMatch[1].trim();
  // Fall back to first H1
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  return null;
}

function extractAliases(content: string): string[] {
  const aliases: string[] = [];
  // aliases: [a, b] inline array
  const inlineMatch = content.match(/^aliases:\s*\[([^\]]+)\]/m);
  if (inlineMatch) {
    aliases.push(
      ...inlineMatch[1]
        .split(',')
        .map(a => a.trim().replace(/["']/g, ''))
        .filter(Boolean)
    );
  }
  // aliases:\n  - value list
  const fmEnd = content.indexOf('\n---\n', 4);
  const fmSection = fmEnd > -1 ? content.slice(0, fmEnd) : '';
  const aliasesListStart = fmSection.search(/^aliases:\s*$/m);
  if (aliasesListStart > -1) {
    const afterKey = fmSection.slice(aliasesListStart);
    const items = [...afterKey.matchAll(/^ {2}-\s+(.+)$/gm)];
    aliases.push(...items.map(m => m[1].trim()));
  }
  return [...new Set(aliases)];
}

function extractTags(content: string): string[] {
  const tags: string[] = [];
  // Frontmatter tags array: tags: [a, b, c] or tags:\n  - a
  const fmTagsMatch = content.match(/^tags:\s*\[([^\]]+)\]/m);
  if (fmTagsMatch) {
    tags.push(...fmTagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, '')));
  }
  const fmTagsList = [...content.matchAll(/^ {2}- (.+)$/gm)];
  if (fmTagsList.length > 0) {
    tags.push(...fmTagsList.map(m => m[1].trim()));
  }
  // Inline #tags (outside code blocks — simple heuristic)
  const bodyStart = content.indexOf('\n---\n', 4);
  const body = bodyStart > -1 ? content.slice(bodyStart) : content;
  for (const match of body.matchAll(TAG_RE)) {
    tags.push(match[1]);
  }
  return [...new Set(tags)];
}

function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  for (const match of content.matchAll(WIKILINK_RE)) {
    links.push(match[1].trim());
  }
  return links;
}

async function readFile(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString('utf-8');
}
