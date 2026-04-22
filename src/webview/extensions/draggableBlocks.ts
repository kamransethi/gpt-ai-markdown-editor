/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state';
import { type EditorView } from '@tiptap/pm/view';
import { Node as ProsemirrorNode } from '@tiptap/pm/model';

// ─── Type augmentation ────────────────────────────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    draggableBlocks: {
      moveBlockUp: () => ReturnType;
      moveBlockDown: () => ReturnType;
    };
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const draggableBlocksPluginKey = new PluginKey<null>('draggableBlocks');
const BLOCK_DRAG_MIME = 'application/md4h-block-drag';
const AUTO_SCROLL_THRESHOLD = 80;
const AUTO_SCROLL_MAX_SPEED = 14;

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'codeBlock',
  'blockquote',
  'table',
  'horizontalRule',
  'image',
  'mermaid',
  'mathBlock',
  'githubAlert',
  'indentedImageCodeBlock',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isDraggableBlock(node: ProsemirrorNode): boolean {
  if (!BLOCK_TYPES.has(node.type.name)) return false;
  // Skip empty paragraphs — including the trailing-node placeholder that TipTap
  // auto-appends when the document ends in a non-paragraph block.
  if (node.type.name === 'paragraph' && node.content.size === 0) return false;
  return true;
}

function topLevelBlockAt(
  view: EditorView,
  pos: number
): { node: ProsemirrorNode; pos: number; index: number } | null {
  const $pos = view.state.doc.resolve(Math.max(0, Math.min(pos, view.state.doc.content.size - 1)));
  for (let d = $pos.depth; d >= 1; d--) {
    if ($pos.node(d - 1).type.name === 'doc' && $pos.node(d).isBlock) {
      return {
        node: $pos.node(d),
        pos: $pos.before(d),
        index: $pos.index(d - 1),
      };
    }
  }
  return null;
}

/**
 * Y-axis-based top-level block lookup. Walks the doc's top-level children,
 * inspecting each one's DOM bounding rect. Returns the block whose vertical
 * range contains clientY (a "hit"), otherwise the nearest block by Y distance.
 *
 * Needed because posAtCoords() returns null when the cursor is over NodeView
 * content the editor treats as opaque (e.g. Mermaid SVGs, or the gap between
 * two stacked NodeViews) — so both the drag handle and the drop indicator
 * lose their reference block.
 */
function findBlockByClientY(
  view: EditorView,
  clientY: number
): { node: ProsemirrorNode; pos: number; dom: HTMLElement; hit: boolean } | null {
  const doc = view.state.doc;
  let pos = 0;
  let closest: {
    node: ProsemirrorNode;
    pos: number;
    dom: HTMLElement;
    dist: number;
  } | null = null;

  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const blockPos = pos;
    pos += node.nodeSize;
    const dom = view.nodeDOM(blockPos) as HTMLElement | null;
    if (!dom || typeof dom.getBoundingClientRect !== 'function') continue;
    const rect = dom.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return { node, pos: blockPos, dom, hit: true };
    }
    const dist = clientY < rect.top ? rect.top - clientY : clientY - rect.bottom;
    if (!closest || dist < closest.dist) {
      closest = { node, pos: blockPos, dom, dist };
    }
  }

  return closest ? { ...closest, hit: false } : null;
}

function computeDropTarget(
  view: EditorView,
  clientX: number,
  clientY: number,
  draggedPos: number
): { insertPos: number } {
  const editorRect = view.dom.getBoundingClientRect();

  // Primary path: posAtCoords → top-level block. Works reliably for regular
  // text/heading/list content.
  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (coords) {
    const block = topLevelBlockAt(view, coords.pos);
    if (block) {
      const domNode = view.nodeDOM(block.pos) as HTMLElement | null;
      if (domNode) {
        const rect = domNode.getBoundingClientRect();
        const insertPos =
          clientY < rect.top + rect.height / 2 ? block.pos : block.pos + block.node.nodeSize;
        return { insertPos };
      }
    }
  }

  // Fallback: Y-based block lookup — used when posAtCoords returns null over
  // NodeView content (Mermaid SVGs) or in the gap between two stacked NodeViews.
  const hit = findBlockByClientY(view, clientY);
  if (hit) {
    const rect = hit.dom.getBoundingClientRect();
    const insertPos = clientY < rect.top + rect.height / 2 ? hit.pos : hit.pos + hit.node.nodeSize;
    return { insertPos };
  }

  if (clientY <= editorRect.top) return { insertPos: 0 };
  if (clientY >= editorRect.bottom) return { insertPos: view.state.doc.content.size };
  return { insertPos: draggedPos };
}

// ─── Drag-handle overlay controller ──────────────────────────────────────────

class DragHandleController {
  private readonly view: EditorView;
  private readonly handle: HTMLElement;
  private readonly indicator: HTMLElement;

  private hoveredBlock: { node: ProsemirrorNode; pos: number; index: number } | null = null;
  private _handleBlock: { node: ProsemirrorNode; pos: number; index: number } | null = null;
  private _hideTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private isDragging = false;
  private draggedPos = -1;
  private dropInsertPos = -1;
  private scrollRafId: number | null = null;
  private _autoScrollSpeed = 0;

  private readonly _onMouseMove: (e: MouseEvent) => void;
  private readonly _onMouseLeave: (e: MouseEvent) => void;
  private readonly _onDragStart: (e: DragEvent) => void;
  private readonly _onDragOver: (e: DragEvent) => void;
  private readonly _onDrop: (e: DragEvent) => void;
  private readonly _onDragEnd: (e: DragEvent) => void;
  private readonly _onHandleMouseEnter: (e: MouseEvent) => void;
  private readonly _onHandleMouseLeave: (e: MouseEvent) => void;

  constructor(_editor: Editor, view: EditorView) {
    this.view = view;

    this.handle = document.createElement('div');
    this.handle.className = 'drag-block-handle';
    this.handle.setAttribute('draggable', 'true');
    this.handle.setAttribute('role', 'button');
    this.handle.setAttribute('aria-label', 'Drag to move block');
    this.handle.setAttribute('title', 'Drag to move block');
    this.handle.innerHTML = `<svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true"><circle cx="3" cy="3" r="1.8"/><circle cx="9" cy="3" r="1.8"/><circle cx="3" cy="9" r="1.8"/><circle cx="9" cy="9" r="1.8"/><circle cx="3" cy="15" r="1.8"/><circle cx="9" cy="15" r="1.8"/></svg>`;
    document.body.appendChild(this.handle);

    this.indicator = document.createElement('div');
    this.indicator.className = 'drag-block-indicator';
    document.body.appendChild(this.indicator);

    this._onMouseMove = this.onMouseMove.bind(this);
    this._onMouseLeave = this.onMouseLeave.bind(this);
    this._onDragStart = this.onDragStart.bind(this);
    this._onDragOver = this.onDragOver.bind(this);
    this._onDrop = this.onDrop.bind(this);
    this._onDragEnd = this.onDragEnd.bind(this);
    this._onHandleMouseEnter = this.onHandleMouseEnter.bind(this);
    this._onHandleMouseLeave = this.onHandleMouseLeave.bind(this);

    view.dom.addEventListener('mousemove', this._onMouseMove);
    view.dom.addEventListener('mouseleave', this._onMouseLeave);
    this.handle.addEventListener('mouseenter', this._onHandleMouseEnter);
    this.handle.addEventListener('mouseleave', this._onHandleMouseLeave);
    this.handle.addEventListener('dragstart', this._onDragStart);
    document.addEventListener('dragover', this._onDragOver, { capture: true, passive: false });
    document.addEventListener('drop', this._onDrop, { capture: true });
    document.addEventListener('dragend', this._onDragEnd, { capture: true });
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isDragging) return;
    if (this._hideTimeoutId !== null) {
      clearTimeout(this._hideTimeoutId);
      this._hideTimeoutId = null;
    }

    let block: { node: ProsemirrorNode; pos: number; index: number } | null = null;
    const coords = this.view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (coords) {
      block = topLevelBlockAt(this.view, coords.pos);
    }
    // Fallback for NodeViews (Mermaid, etc.) where posAtCoords may fail over
    // opaque content — so the handle still works when hovering a diagram.
    if (!block) {
      const hit = findBlockByClientY(this.view, e.clientY);
      if (hit && hit.hit) {
        block = { node: hit.node, pos: hit.pos, index: -1 };
      }
    }

    if (!block || !isDraggableBlock(block.node)) {
      this.hideHandle();
      return;
    }
    this.hoveredBlock = block;
    this._handleBlock = block;
    this.positionHandle(block.pos);
  }

  private onMouseLeave(e: MouseEvent): void {
    if (this.isDragging) return;
    if (e.relatedTarget instanceof Node && this.handle.contains(e.relatedTarget)) return;
    if (this._hideTimeoutId !== null) clearTimeout(this._hideTimeoutId);
    this._hideTimeoutId = setTimeout(() => {
      this._hideTimeoutId = null;
      if (!this.isDragging) this.hideHandle();
    }, 150);
  }

  private onHandleMouseEnter(): void {
    if (this._hideTimeoutId !== null) {
      clearTimeout(this._hideTimeoutId);
      this._hideTimeoutId = null;
    }
    if (!this.hoveredBlock && this._handleBlock) {
      this.hoveredBlock = this._handleBlock;
    }
  }

  private onHandleMouseLeave(e: MouseEvent): void {
    if (this.isDragging || e.buttons !== 0) return;
    if (e.relatedTarget instanceof Node && this.view.dom.contains(e.relatedTarget)) return;
    this.hideHandle();
  }

  private positionHandle(blockPos: number): void {
    const domNode = this.view.nodeDOM(blockPos) as HTMLElement | null;
    if (!domNode) {
      this.hideHandle();
      return;
    }
    const editorRect = this.view.dom.getBoundingClientRect();
    const nodeRect = domNode.getBoundingClientRect();
    const centreY = Math.min(
      Math.max(nodeRect.top + nodeRect.height / 2, editorRect.top),
      editorRect.bottom
    );
    const left = editorRect.left - 32;
    const top = centreY - 16;
    this.handle.style.left = `${left}px`;
    this.handle.style.top = `${top}px`;
    this.handle.style.display = 'flex';
  }

  private hideHandle(): void {
    this.handle.style.display = 'none';
    this.hoveredBlock = null;
  }

  private onDragStart(e: DragEvent): void {
    const block = this.hoveredBlock ?? this._handleBlock;
    if (!block) {
      e.preventDefault();
      return;
    }
    this.isDragging = true;
    this.draggedPos = block.pos;
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;opacity:0;';
    document.body.appendChild(ghost);
    if (e.dataTransfer) {
      e.dataTransfer.setDragImage(ghost, 0, 0);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.clearData();
      e.dataTransfer.setData(BLOCK_DRAG_MIME, String(this.draggedPos));
    }
    setTimeout(() => ghost.remove(), 0);
    const blockDom = this.view.nodeDOM(this.draggedPos) as HTMLElement | null;
    if (blockDom) blockDom.classList.add('drag-block-dragging');
    this.handle.classList.add('drag-block-handle--active');
  }

  private onDragOver(e: DragEvent): void {
    if (!this.isDragging) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const { insertPos } = computeDropTarget(this.view, e.clientX, e.clientY, this.draggedPos);
    this.dropInsertPos = insertPos;
    this.positionIndicator(e.clientY, insertPos);
    this.maybeAutoScroll(e.clientY);
  }

  private positionIndicator(clientY: number, insertPos: number): void {
    if (insertPos === -1) {
      this.indicator.style.display = 'none';
      return;
    }
    const editorRect = this.view.dom.getBoundingClientRect();
    let indicatorY = clientY;
    const block = topLevelBlockAt(this.view, Math.max(0, insertPos - 1));
    if (block) {
      const blockDom = this.view.nodeDOM(block.pos) as HTMLElement | null;
      if (blockDom) {
        const rect = blockDom.getBoundingClientRect();
        indicatorY = insertPos <= block.pos + 1 ? rect.top : rect.bottom;
      }
    }
    this.indicator.style.left = `${editorRect.left}px`;
    this.indicator.style.width = `${editorRect.width}px`;
    this.indicator.style.top = `${indicatorY}px`;
    this.indicator.style.display = 'block';
  }

  private maybeAutoScroll(clientY: number): void {
    const vh = window.innerHeight;
    const distTop = clientY;
    const distBottom = vh - clientY;
    let speed = 0;
    if (distTop < AUTO_SCROLL_THRESHOLD) {
      speed = -Math.round(AUTO_SCROLL_MAX_SPEED * (1 - distTop / AUTO_SCROLL_THRESHOLD));
    } else if (distBottom < AUTO_SCROLL_THRESHOLD) {
      speed = Math.round(AUTO_SCROLL_MAX_SPEED * (1 - distBottom / AUTO_SCROLL_THRESHOLD));
    }
    this._autoScrollSpeed = speed;
    if (speed !== 0 && this.scrollRafId === null) {
      const scroll = () => {
        if (this._autoScrollSpeed === 0) {
          this.scrollRafId = null;
          return;
        }
        window.scrollBy(0, this._autoScrollSpeed);
        this.scrollRafId = requestAnimationFrame(scroll);
      };
      this.scrollRafId = requestAnimationFrame(scroll);
    } else if (speed === 0) {
      this.stopAutoScroll();
    }
  }

  private stopAutoScroll(): void {
    if (this.scrollRafId !== null) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = null;
    }
  }

  private onDrop(e: DragEvent): void {
    if (!this.isDragging || !e.dataTransfer?.types.includes(BLOCK_DRAG_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    this.stopAutoScroll();

    const { state } = this.view;
    const draggedNode = state.doc.resolve(this.draggedPos).nodeAfter;
    if (draggedNode && this.dropInsertPos !== -1) {
      const draggedSize = draggedNode.nodeSize;
      if (
        this.dropInsertPos !== this.draggedPos &&
        this.dropInsertPos !== this.draggedPos + draggedSize
      ) {
        const tr = state.tr;
        const content = state.doc.slice(this.draggedPos, this.draggedPos + draggedSize);
        tr.insert(this.dropInsertPos, content.content);
        const mappedDragPos = tr.mapping.map(this.draggedPos);
        tr.delete(mappedDragPos, mappedDragPos + draggedSize);
        this.view.dispatch(tr);
      }
    }
    this.endDrag();
  }

  private onDragEnd(): void {
    this.stopAutoScroll();
    this.endDrag();
  }

  private endDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this._hideTimeoutId !== null) {
      clearTimeout(this._hideTimeoutId);
      this._hideTimeoutId = null;
    }
    const blockDom = this.view.nodeDOM(this.draggedPos) as HTMLElement | null;
    if (blockDom) blockDom.classList.remove('drag-block-dragging');
    this.draggedPos = -1;
    this.dropInsertPos = -1;
    this._handleBlock = null;
    this.hoveredBlock = null;
    this.indicator.style.display = 'none';
    this.handle.classList.remove('drag-block-handle--active');
  }

  destroy(): void {
    this.stopAutoScroll();
    if (this._hideTimeoutId !== null) clearTimeout(this._hideTimeoutId);
    this.view.dom.removeEventListener('mousemove', this._onMouseMove);
    this.view.dom.removeEventListener('mouseleave', this._onMouseLeave);
    document.removeEventListener('dragover', this._onDragOver, { capture: true });
    document.removeEventListener('drop', this._onDrop, { capture: true });
    document.removeEventListener('dragend', this._onDragEnd, { capture: true });
    this.handle.remove();
    this.indicator.remove();
  }
}

// ─── Extension ────────────────────────────────────────────────────────────────

export const DraggableBlocks = Extension.create({
  name: 'draggableBlocks',

  addCommands() {
    return {
      moveBlockUp:
        () =>
        ({ state, dispatch }) => {
          const { $from } = state.selection;
          let startNode: ProsemirrorNode | null = null;
          let startPos = -1;
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).isBlock && d === 1) {
              startNode = $from.node(d);
              startPos = $from.before(d);
              break;
            }
          }
          if (!startNode || startPos === -1) return false;

          const $sp = state.doc.resolve(startPos);
          const index = $sp.index();
          if (index === 0) return false;

          const prevNode = $sp.parent.child(index - 1);
          // Treat empty paragraphs (including TipTap's trailing-node placeholder)
          // as non-movable neighbors — otherwise Alt+↑ can drift past the boundary.
          if (!isDraggableBlock(prevNode)) return false;
          const prevPos = startPos - prevNode.nodeSize;

          if (dispatch) {
            const tr = state.tr;
            const fromOffset = state.selection.from - startPos;
            const toOffset = state.selection.to - startPos;
            const content = state.doc.slice(startPos, startPos + startNode.nodeSize);

            tr.delete(startPos, startPos + startNode.nodeSize);
            tr.insert(prevPos, content.content);

            // FIX: Removed 'any' cast by defining constructor shape
            const SelectionClass = state.selection.constructor as typeof Selection & {
              create: (doc: ProsemirrorNode, from: number, to: number) => Selection;
            };

            tr.setSelection(
              SelectionClass.create(tr.doc, prevPos + fromOffset, prevPos + toOffset)
            );
            dispatch(tr.scrollIntoView());
          }
          return true;
        },

      moveBlockDown:
        () =>
        ({ state, dispatch }) => {
          const { $from } = state.selection;
          let startNode: ProsemirrorNode | null = null;
          let startPos = -1;
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).isBlock && d === 1) {
              startNode = $from.node(d);
              startPos = $from.before(d);
              break;
            }
          }
          if (!startNode || startPos === -1) return false;

          const $sp = state.doc.resolve(startPos);
          const index = $sp.index();
          if (index === $sp.parent.childCount - 1) return false;

          const nextNode = $sp.parent.child(index + 1);
          // Treat empty paragraphs (including TipTap's trailing-node placeholder)
          // as non-movable neighbors — otherwise Alt+↓ would keep moving past
          // the visible end of the document as new trailing nodes are appended.
          if (!isDraggableBlock(nextNode)) return false;

          if (dispatch) {
            const tr = state.tr;
            const fromOffset = state.selection.from - startPos;
            const toOffset = state.selection.to - startPos;
            const content = state.doc.slice(startPos, startPos + startNode.nodeSize);

            tr.delete(startPos, startPos + startNode.nodeSize);
            const insertPos = startPos + nextNode.nodeSize;
            tr.insert(insertPos, content.content);

            // FIX: Removed 'any' cast by defining constructor shape
            const SelectionClass = state.selection.constructor as typeof Selection & {
              create: (doc: ProsemirrorNode, from: number, to: number) => Selection;
            };

            tr.setSelection(
              SelectionClass.create(tr.doc, insertPos + fromOffset, insertPos + toOffset)
            );
            dispatch(tr.scrollIntoView());
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Alt-ArrowUp': () => this.editor.commands.moveBlockUp(),
      'Alt-ArrowDown': () => this.editor.commands.moveBlockDown(),
    };
  },

  addProseMirrorPlugins() {
    const editorRef = this.editor;
    return [
      new Plugin({
        key: draggableBlocksPluginKey,
        props: {
          handleDrop(_view, event): boolean {
            return !!event.dataTransfer?.types.includes(BLOCK_DRAG_MIME);
          },
        },
        view(editorView) {
          const controller = new DragHandleController(editorRef, editorView);
          return {
            destroy() {
              controller.destroy();
            },
          };
        },
      }),
    ];
  },
});
