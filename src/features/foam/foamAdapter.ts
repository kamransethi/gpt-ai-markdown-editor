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
  const excludeGlobs = options.excludeGlobs ?? ['**/node_modules/**', '**/.git/**'];

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

  // Build title → path index for resolving wikilinks
  const titleToPath = new Map<string, string>();
  const fileNameToPath = new Map<string, string>();
  for (const note of notes) {
    if (note.title) titleToPath.set(note.title.toLowerCase(), note.path);
    const stem = note.path.split('/').pop()?.replace(/\.md$/i, '').toLowerCase();
    if (stem) fileNameToPath.set(stem, note.path);
  }

  // Build backlinks index
  const backlinks: Record<string, FoamBacklink[]> = {};
  for (const [sourcePath, links] of outboundLinks) {
    const sourceNote = notes.find(n => n.path === sourcePath);
    for (const link of links) {
      const targetPath =
        titleToPath.get(link.toLowerCase()) ?? fileNameToPath.get(link.toLowerCase());
      if (targetPath) {
        if (!backlinks[targetPath]) backlinks[targetPath] = [];
        backlinks[targetPath].push({
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
  const title = extractTitle(content) ?? uri.fsPath.split('/').pop()?.replace(/\.md$/i, '') ?? '';
  const tags = extractTags(content);
  return { path, title, uri: uri.toString(), tags };
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
