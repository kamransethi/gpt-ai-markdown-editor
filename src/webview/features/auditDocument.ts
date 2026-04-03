import { Editor, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type AuditIssueType = 'link' | 'image' | 'heading';

export interface AuditIssue {
  type: AuditIssueType;
  message: string;
  pos: number;
  nodeSize: number;
  target: string;
}

export async function runAudit(editor: Editor): Promise<AuditIssue[]> {
  // Clear existing decorations while auditing
  editor.view.dispatch(editor.state.tr.setMeta(auditPluginKey, []));

  const issues: AuditIssue[] = [];
  const { doc } = editor.state;

  const existingSlugs = new Set<string>();
  const fileChecks: Promise<void>[] = [];
  const headingLinks: { slug: string; pos: number; nodeSize: number }[] = [];

  doc.descendants((node) => {
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
      } else if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
        fileChecks.push(
          checkFileExistence(src).then((exists) => {
            if (!exists) {
              issues.push({
                type: 'image',
                message: `Image file not found: ${src}`,
                pos,
                nodeSize: node.nodeSize,
                target: src,
              });
            }
          })
        );
      } else if (src.startsWith('http://') || src.startsWith('https://')) {
        fileChecks.push(
          checkUrlStatus(src).then((ok) => {
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
        } else if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
          fileChecks.push(
            checkFileExistence(href).then((exists) => {
              if (!exists) {
                issues.push({
                  type: 'link',
                  message: `Linked file not found: ${href}`,
                  pos,
                  nodeSize: node.nodeSize,
                  target: href,
                });
              }
            })
          );
        } else if (href.startsWith('http://') || href.startsWith('https://')) {
           fileChecks.push(
            checkUrlStatus(href).then((ok) => {
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

  headingLinks.forEach((link) => {
    if (!existingSlugs.has(link.slug)) {
      issues.push({
        type: 'heading',
        message: `Heading anchor not found: #${link.slug}`,
        pos: link.pos,
        nodeSize: link.nodeSize,
        target: link.slug,
      });
    }
  });

  return issues;
}

const auditCheckCallbacks = new Map<string, (exists: boolean) => void>();

export function handleAuditCheckResult(requestId: string, exists: boolean) {
  const cb = auditCheckCallbacks.get(requestId);
  if (cb) {
    cb(exists);
    auditCheckCallbacks.delete(requestId);
  }
}

function checkFileExistence(relativePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const vscodeApi = (window as any).vscode;
    if (!vscodeApi) {
      resolve(true); 
      return;
    }
    const requestId = `audit-check-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    auditCheckCallbacks.set(requestId, resolve);
    
    setTimeout(() => {
        if (auditCheckCallbacks.has(requestId)) {
            auditCheckCallbacks.delete(requestId);
            resolve(true);
        }
    }, 5000);

    vscodeApi.postMessage({
      type: 'auditCheckFile',
      requestId,
      relativePath,
    });
  });
}

function checkUrlStatus(url: string): Promise<boolean> {
  return fetch(url, { method: 'HEAD', mode: 'no-cors' })
    .then((res) => {
        return res.status === 200 || res.status === 0;
    })
    .catch(() => false);
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
            title: issue.message
          });
        });
        return DecorationSet.create(tr.doc, decos);
      }
      return old.map(tr.mapping, tr.doc);
    }
  },
  props: {
    decorations(state) {
      return this.getState(state);
    }
  }
});

export const DocumentAuditExtension = Extension.create({
  name: 'documentAudit',
  addProseMirrorPlugins() {
    return [auditPlugin];
  }
});
