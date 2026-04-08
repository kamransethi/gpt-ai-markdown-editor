import { Editor, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type AuditIssueType = 'link' | 'image' | 'heading';

/** File type filter hint passed to the extension when opening a file picker */
export type AuditFileType = 'image' | 'any';

export interface AuditIssue {
  type: AuditIssueType;
  message: string;
  pos: number;
  nodeSize: number;
  target: string;
  suggestions?: string[];
}

export interface FileCheckResult {
  exists: boolean;
  suggestions?: string[];
}

// Levenshtein distance for fuzzy matching
function getLevenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function findBestMatches(target: string, candidates: string[], maxDistance: number = 3): string[] {
  const matches = candidates
    .map(c => ({ candidate: c, distance: getLevenshteinDistance(target, c) }))
    .filter(x => x.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .map(x => x.candidate);

  // For headings, also try some intelligent transformations
  if (matches.length === 0 && target.length > 3) {
    const transformedCandidates: string[] = [];

    // Try removing common prefixes/suffixes that might have changed
    const prefixes = ['the-', 'a-', 'an-', 'my-', 'our-', 'your-'];
    const suffixes = ['-section', '-part', '-chapter', '-guide'];

    for (const prefix of prefixes) {
      if (target.startsWith(prefix)) {
        const withoutPrefix = target.slice(prefix.length);
        transformedCandidates.push(withoutPrefix);
      }
    }

    for (const suffix of suffixes) {
      if (target.endsWith(suffix)) {
        const withoutSuffix = target.slice(0, -suffix.length);
        transformedCandidates.push(withoutSuffix);
      }
    }

    // Try normalizing spaces and case
    const normalizedTarget = target.toLowerCase().replace(/[-_\s]+/g, '-');
    transformedCandidates.push(normalizedTarget);

    // Find matches for transformed versions
    for (const transformed of transformedCandidates) {
      const transformedMatches = candidates
        .map(c => ({ candidate: c, distance: getLevenshteinDistance(transformed, c) }))
        .filter(x => x.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance)
        .map(x => x.candidate);

      matches.push(...transformedMatches);
    }
  }

  // Remove duplicates and limit results
  return Array.from(new Set(matches)).slice(0, 5);
}

export async function runAudit(editor: Editor): Promise<AuditIssue[]> {
  // Clear existing decorations while auditing
  editor.view.dispatch(editor.state.tr.setMeta(auditPluginKey, []));

  const issues: AuditIssue[] = [];
  const { doc } = editor.state;

  const existingSlugs = new Set<string>();
  const fileChecks: Promise<void>[] = [];
  const headingLinks: { slug: string; pos: number; nodeSize: number }[] = [];

  doc.descendants(node => {
    if (node.type.name === 'heading') {
      const text = node.textContent;
      generateHeadingSlug(text, existingSlugs);
    }
  });

  doc.descendants((node, pos) => {
    if (node.type.name === 'image' || node.type.name === 'customImage') {
      const src = node.attrs.src;
      if (!src) {
        issues.push({
          type: 'image',
          message: 'Image has no source path.',
          pos,
          nodeSize: node.nodeSize,
          target: '',
        });
      } else if (
        !src.startsWith('http://') &&
        !src.startsWith('https://') &&
        !src.startsWith('data:')
      ) {
        fileChecks.push(
          checkFileExistence(src).then(result => {
            if (!result.exists) {
              issues.push({
                type: 'image',
                message: `Image file not found: ${src}`,
                pos,
                nodeSize: node.nodeSize,
                target: src,
                suggestions: result.suggestions,
              });
            }
          })
        );
      } else if (src.startsWith('http://') || src.startsWith('https://')) {
        fileChecks.push(
          checkUrlStatus(src).then(ok => {
            if (!ok) {
              issues.push({
                type: 'image',
                message: `Broken image URL: ${src}`,
                pos,
                nodeSize: node.nodeSize,
                target: src,
              });
            }
          })
        );
      }
    }

    if (node.marks && node.marks.length > 0) {
      const linkMark = node.marks.find((m: any) => m.type.name === 'link');
      if (linkMark) {
        const href = linkMark.attrs.href;
        if (!href) {
          issues.push({
            type: 'link',
            message: 'Link is empty.',
            pos,
            nodeSize: node.nodeSize,
            target: '',
          });
        } else if (href.startsWith('#')) {
          headingLinks.push({ slug: href.slice(1), pos, nodeSize: node.nodeSize });
        } else if (
          !href.startsWith('http://') &&
          !href.startsWith('https://') &&
          !href.startsWith('mailto:')
        ) {
          fileChecks.push(
            checkFileExistence(href).then(result => {
              if (!result.exists) {
                issues.push({
                  type: 'link',
                  message: `Linked file not found: ${href}`,
                  pos,
                  nodeSize: node.nodeSize,
                  target: href,
                  suggestions: result.suggestions,
                });
              }
            })
          );
        } else if (href.startsWith('http://') || href.startsWith('https://')) {
          fileChecks.push(
            checkUrlStatus(href).then(ok => {
              if (!ok) {
                issues.push({
                  type: 'link',
                  message: `Broken link URL: ${href}`,
                  pos,
                  nodeSize: node.nodeSize,
                  target: href,
                });
              }
            })
          );
        }
      }
    }
  });

  await Promise.all(fileChecks);

  headingLinks.forEach(link => {
    if (!existingSlugs.has(link.slug)) {
      const suggestions = findBestMatches(link.slug, Array.from(existingSlugs));
      issues.push({
        type: 'heading',
        message: `Heading anchor not found: #${link.slug}`,
        pos: link.pos,
        nodeSize: link.nodeSize,
        target: link.slug,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      });
    }
  });

  return issues;
}

const auditCheckCallbacks = new Map<string, (result: FileCheckResult) => void>();
const auditUrlCheckCallbacks = new Map<string, (reachable: boolean) => void>();

export function handleAuditCheckResult(requestId: string, exists: boolean, suggestions?: string[]) {
  const cb = auditCheckCallbacks.get(requestId);
  if (cb) {
    cb({ exists, suggestions });
    auditCheckCallbacks.delete(requestId);
  }
}

export function handleAuditUrlCheckResult(requestId: string, reachable: boolean) {
  const cb = auditUrlCheckCallbacks.get(requestId);
  if (cb) {
    cb(reachable);
    auditUrlCheckCallbacks.delete(requestId);
  }
}

// --- File picker (Browse button) request/response ----------------------------

/**
 * Callbacks awaiting a 'auditPickFileResult' response from the extension host.
 * Key: requestId, Value: resolve function
 */
const auditPickFileCallbacks = new Map<string, (path: string | null) => void>();

/**
 * Open a file picker dialog in the extension host and return the selected path
 * relative to the document, or null if the user cancelled.
 *
 * @param fileType - Filter hint: 'image' shows only image files, 'any' shows all files.
 * @returns Relative path chosen by the user, or null on cancel.
 */
export function requestFilePickerForIssue(fileType: AuditFileType): Promise<string | null> {
  return new Promise(resolve => {
    const vscodeApi = (window as any).vscode;
    if (!vscodeApi) {
      resolve(null);
      return;
    }
    const requestId = `audit-pick-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    auditPickFileCallbacks.set(requestId, resolve);

    // 30 second timeout – file picker is user-driven so it needs a longer window
    setTimeout(() => {
      if (auditPickFileCallbacks.has(requestId)) {
        auditPickFileCallbacks.delete(requestId);
        resolve(null);
      }
    }, 30000);

    vscodeApi.postMessage({
      type: 'auditPickFile',
      requestId,
      fileType,
    });
  });
}

/**
 * Called by the webview message handler when the extension replies with the
 * user's file selection (or null for cancel).
 *
 * @param requestId - Must match the id from requestFilePickerForIssue.
 * @param selectedPath - Relative path chosen, or null if cancelled.
 */
export function handleAuditPickFileResult(requestId: string, selectedPath: string | null): void {
  const cb = auditPickFileCallbacks.get(requestId);
  if (cb) {
    cb(selectedPath);
    auditPickFileCallbacks.delete(requestId);
  }
}

function checkFileExistence(relativePath: string): Promise<FileCheckResult> {
  return new Promise(resolve => {
    const vscodeApi = (window as any).vscode;
    if (!vscodeApi) {
      resolve({ exists: true });
      return;
    }
    const requestId = `audit-check-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    auditCheckCallbacks.set(requestId, resolve);

    setTimeout(() => {
      if (auditCheckCallbacks.has(requestId)) {
        auditCheckCallbacks.delete(requestId);
        resolve({ exists: false });
      }
    }, 2000);

    vscodeApi.postMessage({
      type: 'auditCheckFile',
      requestId,
      relativePath,
    });
  });
}

function checkUrlStatus(url: string): Promise<boolean> {
  const vscodeApi = (window as any).vscode;
  if (!vscodeApi) {
    // In the webview itself we cannot reliably inspect status due to CORS.
    // Treat as unreachable to avoid false positives.
    return Promise.resolve(false);
  }

  return new Promise(resolve => {
    const requestId = `audit-url-check-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    auditUrlCheckCallbacks.set(requestId, resolve);

    // Timeout fallback if extension host does not respond.
    const timeout = setTimeout(() => {
      if (auditUrlCheckCallbacks.has(requestId)) {
        auditUrlCheckCallbacks.delete(requestId);
        resolve(false);
      }
    }, 2000);

    vscodeApi.postMessage({
      type: 'auditCheckUrl',
      requestId,
      url,
    });

    // Ensure callback cleanup resets timer when called.
    const originalCallback = auditUrlCheckCallbacks.get(requestId);
    if (originalCallback) {
      auditUrlCheckCallbacks.set(requestId, (reachable: boolean) => {
        clearTimeout(timeout);
        originalCallback(reachable);
      });
    }
  });
}

function generateHeadingSlug(text: string, existingSlugs: Set<string>): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  let finalSlug = slug;
  let counter = 1;
  while (existingSlugs.has(finalSlug)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  existingSlugs.add(finalSlug);
  return finalSlug;
}

export const auditPluginKey = new PluginKey('auditDocument');

const auditPlugin = new Plugin({
  key: auditPluginKey,
  state: {
    init() {
      return DecorationSet.empty;
    },
    apply(tr, old) {
      const issues = tr.getMeta(auditPluginKey);
      if (issues) {
        const decos = issues.map((issue: AuditIssue) => {
          return Decoration.inline(issue.pos, issue.pos + issue.nodeSize, {
            class: 'validation-error-highlight',
            title: issue.message,
          });
        });
        return DecorationSet.create(tr.doc, decos);
      }
      return old.map(tr.mapping, tr.doc);
    },
  },
  props: {
    decorations(state) {
      return this.getState(state);
    },
  },
});

export const DocumentAuditExtension = Extension.create({
  name: 'documentAudit',
  addProseMirrorPlugins() {
    return [auditPlugin];
  },
});
