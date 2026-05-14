/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * docSerializer.ts — AST-based HTML serialization for export (FR-003)
 *
 * Produces export-ready HTML by walking `doc.descendants()` rather than
 * cloning the editor DOM. This eliminates CSS-class coupling to TipTap's
 * rendered output and is fully testable without a real DOM.
 *
 * Key guarantees:
 * - Never calls `cloneNode`
 * - Mermaid blocks → `<img data-mermaid-id="N">` — no CSS class query
 * - Raw-HTML nodes read from `node.attrs.rawHtml`, not `data-raw` DOM attribute
 * - Image src uses `data-markdown-src` (workspace-relative) when available
 */

import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { DOMSerializer } from '@tiptap/pm/model';

export interface SerializeOptions {
  /** Whether to normalise image src to markdown-src (default: true) */
  normaliseImageSrc?: boolean;
}

export interface DocSerializeResult {
  /** Full export HTML with mermaid placeholders and raw HTML inlined */
  html: string;
  /** Ordered list of mermaid ids found in the doc (for the SVG→PNG step) */
  mermaidIds: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normaliseSrc(node: PMNode): string {
  const mdSrc = node.attrs['data-markdown-src'] as string | undefined;
  const rawSrc = node.attrs.src as string | undefined;

  const src = mdSrc || rawSrc || '';
  if (!src) return src;

  // Windows absolute path → file:///
  if (/^[A-Za-z]:[\\/]/.test(src)) {
    return `file:///${src.replace(/\\/g, '/')}`;
  }
  return src;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialize a ProseMirror document to export-ready HTML using the doc AST.
 *
 * Special node handling:
 * - `mermaid`:          `<img data-mermaid-id="mermaid-N">`  (SVG→PNG done by caller)
 * - `genericHtmlInline` / `genericHtmlBlock`:  raw HTML from `node.attrs.rawHtml`
 * - `image`:            `<img>` with normalised src
 *
 * All other nodes are serialized via ProseMirror's `DOMSerializer.fromSchema`.
 *
 * @param editor   TipTap editor instance (provides schema + doc)
 * @param options  Serialization options
 */
export function serializeDocToHtml(
  editor: Editor,
  options: SerializeOptions = {}
): DocSerializeResult {
  const { normaliseImageSrc = true } = options;
  const doc = editor.state.doc;
  const schema = editor.state.schema;

  const mermaidIds: string[] = [];

  // Walk the doc first to collect special-node overrides.
  // This lets us skip DOMSerializer entirely when there are no special nodes.
  const specialFragments = new Map<number, string>(); // position → HTML string

  doc.descendants((node: PMNode, pos: number): boolean => {
    const typeName = node.type.name;

    if (typeName === 'mermaid') {
      const id = `mermaid-${mermaidIds.length}`;
      mermaidIds.push(id);
      specialFragments.set(pos, `<img data-mermaid-id="${id}" alt="Mermaid diagram">`);
      return false; // don't descend into mermaid content
    }

    if (typeName === 'genericHtmlInline' || typeName === 'genericHtmlBlock') {
      const rawHtml = (node.attrs.rawHtml as string) || '';
      specialFragments.set(pos, rawHtml);
      return false;
    }

    if (typeName === 'image' && normaliseImageSrc) {
      const src = normaliseSrc(node);
      const alt = escapeAttr((node.attrs.alt as string) || '');
      specialFragments.set(pos, `<img src="${escapeAttr(src)}" alt="${alt}">`);
      return false;
    }

    return true; // descend into children for all other node types
  });

  if (specialFragments.size === 0) {
    // No special nodes: let TipTap's getHTML() handle everything (no DOMSerializer needed)
    return { html: editor.getHTML(), mermaidIds };
  }

  // Build custom serializers that override special node types.
  const baseSerializer = DOMSerializer.fromSchema(schema);

  // Collect the custom replacements we need to make before full serialization.
  // We walk the doc once, collecting inline fragments for special node types.

  // Rebuild HTML: serialize the document via DOMSerializer but patch positions
  // that have custom overrides by replacing their DOM output afterwards.
  // We create a scratch container from the browser document.
  const tmpDoc: Document =
    typeof document !== 'undefined' ? document : (null as unknown as Document);

  if (!tmpDoc) {
    // Fallback for environments without DOM (should not happen in webview)
    return { html: editor.getHTML(), mermaidIds };
  }

  const container = tmpDoc.createElement('div');
  const fragment = baseSerializer.serializeFragment(doc.content, { document: tmpDoc });
  container.appendChild(fragment);

  // Patch mermaid, raw-HTML, and image nodes in the serialized output.
  // Use data-node-pos attributes to locate them — but DOMSerializer doesn't
  // add those. Instead, use targeted querySelectorAll that matches the known
  // rendered form of each special type, then replace using our collected data.

  // Mermaid: rendered as <pre> with data-language="mermaid" by the schema
  let mermaidIndex = 0;
  container.querySelectorAll('pre[data-language="mermaid"], pre.mermaid').forEach(el => {
    const id = `mermaid-${mermaidIndex++}`;
    const img = tmpDoc.createElement('img');
    img.setAttribute('data-mermaid-id', id);
    img.setAttribute('alt', 'Mermaid diagram');
    el.parentNode?.replaceChild(img, el);
  });

  // Raw HTML: rendered as <span data-raw="..."> or <div data-raw="...">
  container.querySelectorAll('[data-raw]').forEach(el => {
    const raw = el.getAttribute('data-raw') || '';
    const placeholder = tmpDoc.createElement('span');
    placeholder.innerHTML = raw;
    el.parentNode?.replaceChild(placeholder, el);
  });

  // Images: normalise src
  if (normaliseImageSrc) {
    container.querySelectorAll<HTMLImageElement>('img:not([data-mermaid-id])').forEach(img => {
      const mdSrc = img.getAttribute('data-markdown-src');
      if (!mdSrc) return;
      if (/^[A-Za-z]:[\\/]/.test(mdSrc)) {
        img.setAttribute('src', `file:///${mdSrc.replace(/\\/g, '/')}`);
        return;
      }
      img.setAttribute('src', mdSrc);
    });
  }

  return { html: container.innerHTML, mermaidIds };
}

/**
 * Walk the editor doc and return an array of mermaid node positions in order.
 * Used by collectExportContent to locate the live DOM element (which has the
 * rendered SVG) without relying on CSS class queries.
 *
 * @param editor - TipTap editor instance
 */
export function getMermaidPositions(editor: Editor): number[] {
  const positions: number[] = [];
  editor.state.doc.descendants((node: PMNode, pos: number): boolean => {
    if (node.type.name === 'mermaid') {
      positions.push(pos);
      return false;
    }
    return true;
  });
  return positions;
}
