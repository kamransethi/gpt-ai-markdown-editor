/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * DraggableBlocks TipTap extension.
 *
 * Provides:
 * - Floating six-dot (⣿) drag handle in the left gutter, appearing on block hover.
 * - `moveBlockUp` / `moveBlockDown` commands (also bound to Alt+↑ / Alt+↓).
 * - Blue drop-indicator line shown while dragging.
 * - Auto-scroll when dragging near the viewport edges.
 * - Invalid-drop detection (e.g. dropping inside a code block turns the line red).
 * - Single undoable transaction for every drag-drop or keyboard move.
 *
 * ## Architecture: DOM overlay
 * The handle and drop-indicator are absolutely-positioned `<div>` elements
 * appended to `document.body`. This avoids ALL parent overflow/clip issues and
 * works regardless of the editor's margin/padding. Positions are computed via
 * `getBoundingClientRect()` and converted to `position: fixed` coordinates.
 *
 * ## Drag conflict resolution
 * ProseMirror registers its internal `drop` handler when the view is created,
 * before our plugin runs. To prevent ProseMirror from misinterpreting our block
 * drag as a text drag, we:
 *  1. Use Plugin `props.handleDrop` to return `true` for our MIME type so PM
 *     skips its own drop logic.
 *  2. Listen for `drop` on `document` in **capture phase** so our handler fires
 *     before any bubble-phase handlers inside `view.dom`.
 */

import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { type EditorView } from '@tiptap/pm/view';
import { Node as ProsemirrorNode } from '@tiptap/pm/model';

// ─── Type augmentation ────────────────────────────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    draggableBlocks: {
      /**
       * Move the currently selected top-level block one position up.
       * Returns `false` if the block is already first.
       */
      moveBlockUp: () => ReturnType;
      /**
       * Move the currently selected top-level block one position down.
       * Returns `false` if the block is already last.
       */
      moveBlockDown: () => ReturnType;
    };
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const draggableBlocksPluginKey = new PluginKey<null>('draggableBlocks');

/** Custom MIME type used to detect our own block drags. */
const BLOCK_DRAG_MIME = 'application/md4h-block-drag';

/** Distance from viewport edge (px) that triggers auto-scroll on the html element. */
const AUTO_SCROLL_THRESHOLD = 80;
/** Max pixels per animation frame for auto-scroll. */
const AUTO_SCROLL_MAX_SPEED = 14;

/** Top-level node types that are draggable as whole blocks. */
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

/** Node types where dropping is forbidden (dropping inside them is invalid). */
// const FORBIDDEN_DROP_TYPES = new Set(['codeBlock', 'mathBlock']);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Walk up the resolve path to find the child-of-doc block at a given pos.
 */
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

/** Check if `pos` sits inside a node type that forbids drops. */
// function isInsideForbiddenNode(view: EditorView, pos: number): boolean {
//   if (pos < 0 || pos >= view.state.doc.content.size) return false;
//   const $pos = view.state.doc.resolve(pos);
//   for (let d = $pos.depth; d >= 1; d--) {
//     if (FORBIDDEN_DROP_TYPES.has($pos.node(d).type.name)) return true;
//   }
//   return false;
// }

/**
 * Given a clientY, compute the best insert position (before/after a block)
 * and whether the drop is valid.
 */
function computeDropTarget(
  view: EditorView,
  clientX: number,
  clientY: number,
  draggedPos: number
): { insertPos: number; valid: boolean } {
  const editorRect = view.dom.getBoundingClientRect();

  let coords = view.posAtCoords({ left: clientX, top: clientY });

  if (!coords) {
    if (clientY <= editorRect.top) {
      return { insertPos: 0, valid: true };
    }
    if (clientY >= editorRect.bottom) {
      return { insertPos: view.state.doc.content.size, valid: true };
    }
    coords = view.posAtCoords({ left: editorRect.left + editorRect.width / 2, top: clientY });
    if (!coords) return { insertPos: draggedPos, valid: false };
  }

  const { pos } = coords;

  // if (isInsideForbiddenNode(view, pos)) {
  //   return { insertPos: -1, valid: false };
  // }

  const block = topLevelBlockAt(view, pos);
  
  if (!block) {
    const isTopHalf = clientY < editorRect.top + editorRect.height / 2;
    return { insertPos: isTopHalf ? 0 : view.state.doc.content.size, valid: true };
  }

  const domNode = view.nodeDOM(block.pos) as HTMLElement | null;
  if (!domNode) return { insertPos: block.pos, valid: true };

  const rect = domNode.getBoundingClientRect();
  const insertPos = clientY < rect.top + rect.height / 2
    ? block.pos
    : block.pos + block.node.nodeSize;

  return { insertPos, valid: true };
}

// ─── Drag-handle overlay controller ──────────────────────────────────────────

/**
 * Manages the drag handle element and drop indicator as fixed-positioned body
 * children — completely immune to parent overflow/clip/margin constraints.
 */
class DragHandleController {
  private readonly view: EditorView;

  /** The six-dot handle element (fixed, outside ProseMirror DOM) */
  private readonly handle: HTMLElement;
  /** The drop-indicator line (fixed, outside ProseMirror DOM) */
  private readonly indicator: HTMLElement;

  /** Block currently under the mouse */
  private hoveredBlock: { node: ProsemirrorNode; pos: number; index: number } | null = null;
  /**
   * Last block the handle was positioned over. Unlike hoveredBlock, this is
   * NOT cleared when the handle hides — it persists so that dragstart can
   * still reference the correct block even if the mouse crossed the gap
   * between the editor and handle and briefly cleared hoveredBlock.
   */
  private _handleBlock: { node: ProsemirrorNode; pos: number; index: number } | null = null;
  /** Pending setTimeout id for the deferred hideHandle call. */
  private _hideTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Drag state
  private isDragging = false;
  private draggedPos = -1;
  private dropInsertPos = -1;
  private dropValid = true;
  private scrollRafId: number | null = null;
  /** Current auto-scroll speed (read by the rAF loop so speed updates live). */
  private _autoScrollSpeed = 0;

  // Bound listeners (kept for cleanup)
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

    // ── Handle (fixed-positioned, appended to body) ────────────────────────
    this.handle = document.createElement('div');
    this.handle.className = 'drag-block-handle';
    this.handle.setAttribute('draggable', 'true');
    this.handle.setAttribute('aria-label', 'Drag to reorder block');
    this.handle.setAttribute('title', 'Drag to reorder block');
    // Two columns × three rows of dots = 6 dots. viewBox: 14×20 px.
    this.handle.innerHTML = `<svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true" style="pointer-events: none;">
      <circle cx="3" cy="3"  r="1.8"/>
      <circle cx="9" cy="3"  r="1.8"/>
      <circle cx="3" cy="9"  r="1.8"/>
      <circle cx="9" cy="9"  r="1.8"/>
      <circle cx="3" cy="15" r="1.8"/>
      <circle cx="9" cy="15" r="1.8"/>
    </svg>`;
    document.body.appendChild(this.handle);

    // ── Drop indicator (fixed-positioned, appended to body) ───────────────
    this.indicator = document.createElement('div');
    this.indicator.className = 'drag-block-indicator';
    document.body.appendChild(this.indicator);

    // ── Bind listeners ─────────────────────────────────────────────────────
    this._onMouseMove = this.onMouseMove.bind(this);
    this._onMouseLeave = this.onMouseLeave.bind(this);
    this._onDragStart = this.onDragStart.bind(this);
    this._onDragOver = this.onDragOver.bind(this);
    this._onDrop = this.onDrop.bind(this);
    this._onDragEnd = this.onDragEnd.bind(this);
    this._onHandleMouseEnter = this.onHandleMouseEnter.bind(this);
    this._onHandleMouseLeave = this.onHandleMouseLeave.bind(this);

    // Mouse tracking: on the editor DOM so we can resolve ProseMirror positions
    view.dom.addEventListener('mousemove', this._onMouseMove);
    view.dom.addEventListener('mouseleave', this._onMouseLeave);

    // Keep handle alive when mouse is over it
    this.handle.addEventListener('mouseenter', this._onHandleMouseEnter);
    this.handle.addEventListener('mouseleave', this._onHandleMouseLeave);

    // Drag start: on the handle itself
    this.handle.addEventListener('dragstart', this._onDragStart);

    // Drag over + drop + end: on DOCUMENT in CAPTURE phase
    document.addEventListener('dragover', this._onDragOver, { capture: true, passive: false });
    document.addEventListener('drop',    this._onDrop,    { capture: true });
    document.addEventListener('dragend', this._onDragEnd, { capture: true });
    this.handle.addEventListener('dragend', this._onDragEnd);
  }

  // ── Mouse tracking ─────────────────────────────────────────────────────────

  private onMouseMove(e: MouseEvent): void {
    if (this.isDragging) return;

    // Cancel any pending deferred hide — mouse is back over the editor.
    if (this._hideTimeoutId !== null) {
      clearTimeout(this._hideTimeoutId);
      this._hideTimeoutId = null;
    }

    const coords = this.view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (!coords) { this.hideHandle(); return; }

    const block = topLevelBlockAt(this.view, coords.pos);
    if (!block || !BLOCK_TYPES.has(block.node.type.name)) {
      this.hideHandle();
      return;
    }

    this.hoveredBlock = block;
    this._handleBlock  = block; // persist even if hoveredBlock is later cleared
    this.positionHandle(block.pos);
  }

  private onMouseLeave(e: MouseEvent): void {
    if (this.isDragging) return;

    // Direct transition to the handle — cancel any pending hide and keep state.
    if (e.relatedTarget instanceof Node && this.handle.contains(e.relatedTarget)) {
      return;
    }

    // Defer the hide by a short interval. If the mouse crosses the small gap
    // between the editor and the handle, `mouseenter` on the handle will cancel
    // this timeout before it fires, so the handle stays visible and hoveredBlock
    // remains set. Without the delay, a slow mouse crossing the gap would cause
    // relatedTarget = body → hideHandle() → hoveredBlock cleared → dragstart fails.
    this._hideTimeoutId = setTimeout(() => {
      this._hideTimeoutId = null;
      if (!this.isDragging) this.hideHandle();
    }, 150);
  }

  // Add these alongside your other event handler methods (e.g., below onMouseLeave)
  
  private onHandleMouseEnter(_e: MouseEvent): void {
    // Cancel any pending deferred hide (mouse crossed the gap successfully).
    if (this._hideTimeoutId !== null) {
      clearTimeout(this._hideTimeoutId);
      this._hideTimeoutId = null;
    }
    // If the gap crossing cleared hoveredBlock, restore it from the persisted
    // _handleBlock so dragstart still has the correct block reference.
    if (!this.hoveredBlock && this._handleBlock) {
      this.hoveredBlock = this._handleBlock;
    }
  }

  private onHandleMouseLeave(e: MouseEvent): void {
    if (this.isDragging) return;
    // Mouse button is held → a drag is being initiated. Don't hide: dragstart
    // will fire momentarily and needs hoveredBlock to be intact.
    if (e.buttons !== 0) return;
    // If moving back to editor, don't hide
    if (e.relatedTarget instanceof Node && this.view.dom.contains(e.relatedTarget)) {
      return;
    }
    this.hideHandle();
  }

  /**
   * Position the handle fixed, to the left of the ProseMirror content area.
   * Uses getBoundingClientRect() so it's independent of parent margins/padding.
   */
  private positionHandle(blockPos: number): void {
    const domNode = this.view.nodeDOM(blockPos) as HTMLElement | null;
    if (!domNode) { this.hideHandle(); return; }

    const editorRect = this.view.dom.getBoundingClientRect();
    const nodeRect   = domNode.getBoundingClientRect();

    // Centre vertically on the first line of the block, clamp within editor
    const centreY = Math.min(
      Math.max(nodeRect.top + nodeRect.height / 2, editorRect.top),
      editorRect.bottom
    );

    const HANDLE_W = 28;
    const HANDLE_H = 32;
    const GAP      = 4; // gap between handle right edge and content left edge

    // fixed coordinates
    const left = editorRect.left - GAP - HANDLE_W;
    const top  = centreY - HANDLE_H / 2;

    this.handle.style.left    = `${left}px`;
    this.handle.style.top     = `${top}px`;
    this.handle.style.display = 'flex';
  }

  private hideHandle(): void {
    this.handle.style.display = 'none';
    this.hoveredBlock = null;
  }

  // ── Drag start ─────────────────────────────────────────────────────────────

  private onDragStart(e: DragEvent): void {
    // hoveredBlock may have been cleared by a mouseleave that fired before
    // dragstart (e.g. Chrome fires mouseleave on the dragged element as the
    // drag begins). Fall back to _handleBlock which is not cleared on hide.
    const block = this.hoveredBlock ?? this._handleBlock;
    if (!block) { e.preventDefault(); return; }

    this.isDragging      = true;
    this.draggedPos      = block.pos;

    // Invisible ghost (the indicator line acts as visual feedback instead)
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
    document.body.appendChild(ghost);
    if (e.dataTransfer) {
      e.dataTransfer.setDragImage(ghost, 0, 0);
      e.dataTransfer.effectAllowed = 'move';
      // Clear any text to prevent ProseMirror treating this as a text drag
      e.dataTransfer.clearData();
      e.dataTransfer.setData(BLOCK_DRAG_MIME, String(this.draggedPos));
    }
    setTimeout(() => ghost.remove(), 0);

    // Dim the dragged block so user has visual feedback
    const blockDom = this.view.nodeDOM(this.draggedPos) as HTMLElement | null;
    if (blockDom) blockDom.classList.add('drag-block-dragging');

    this.handle.classList.add('drag-block-handle--active');
  }

  // ── Drag over: update indicator ────────────────────────────────────────────

  private onDragOver(e: DragEvent): void {
    // Only handle our own block drags
    if (!this.isDragging) return;

    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';


    const { insertPos, valid } = computeDropTarget(this.view, e.clientX, e.clientY, this.draggedPos);
    this.dropInsertPos = insertPos;
    this.dropValid     = valid;

    this.positionIndicator(e.clientY, insertPos, valid);
    this.maybeAutoScroll(e.clientY);
  }

  /** Position the fixed indicator line at the computed drop boundary. */
  private positionIndicator(clientY: number, insertPos: number, valid: boolean): void {
    if (insertPos === -1) {
      this.indicator.style.display = 'none';
      return;
    }

    const editorRect = this.view.dom.getBoundingClientRect();

    // Try to snap to the exact gap between blocks
    let indicatorY = clientY;
    const block = topLevelBlockAt(this.view, Math.max(0, insertPos - 1));
    if (block) {
      const blockDom = this.view.nodeDOM(block.pos) as HTMLElement | null;
      if (blockDom) {
        const rect = blockDom.getBoundingClientRect();
        indicatorY = insertPos <= block.pos + 1 ? rect.top : rect.bottom;
      }
    }

    this.indicator.style.left    = `${editorRect.left}px`;
    this.indicator.style.width   = `${editorRect.width}px`;
    this.indicator.style.top     = `${indicatorY}px`;
    this.indicator.style.display = 'block';
    this.indicator.classList.toggle('drag-block-indicator--invalid', !valid);
  }

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  private maybeAutoScroll(clientY: number): void {
    const vh = window.innerHeight;
    const distTop    = clientY;
    const distBottom = vh - clientY;

    let speed = 0;
    if (distTop < AUTO_SCROLL_THRESHOLD) {
      speed = -Math.round(AUTO_SCROLL_MAX_SPEED * (1 - distTop / AUTO_SCROLL_THRESHOLD));
    } else if (distBottom < AUTO_SCROLL_THRESHOLD) {
      speed = Math.round(AUTO_SCROLL_MAX_SPEED * (1 - distBottom / AUTO_SCROLL_THRESHOLD));
    }

    // Write speed to instance field so the rAF loop always reads the latest
    // value (instead of capturing a stale closure value on first start).
    this._autoScrollSpeed = speed;

    if (speed !== 0) {
      if (this.scrollRafId === null) {
        const scroll = () => {
          if (this._autoScrollSpeed === 0) {
            this.scrollRafId = null;
            return;
          }
          window.scrollBy(0, this._autoScrollSpeed);
          this.scrollRafId = requestAnimationFrame(scroll);
        };
        this.scrollRafId = requestAnimationFrame(scroll);
      }
    } else {
      this.stopAutoScroll();
    }
  }

  private stopAutoScroll(): void {
    if (this.scrollRafId !== null) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = null;
    }
  }

  // ── Drop ──────────────────────────────────────────────────────────────────

  private onDrop(e: DragEvent): void {
    if (!this.isDragging) return;
    // Ignore drops from other drag sources (e.g. image file drags)
    if (!e.dataTransfer?.types.includes(BLOCK_DRAG_MIME)) return;

    e.preventDefault();
    e.stopPropagation();
    this.stopAutoScroll();

    const { state } = this.view;
    const draggedNode = state.doc.resolve(this.draggedPos).nodeAfter;

    if (draggedNode && this.dropInsertPos !== -1 && this.dropValid) {
      const draggedSize = draggedNode.nodeSize;

      // Prevent unnecessary transactions if dropping in the exact same place
      if (
        this.dropInsertPos !== this.draggedPos && 
        this.dropInsertPos !== this.draggedPos + draggedSize
      ) {
        const tr = state.tr;
        const content = state.doc.slice(this.draggedPos, this.draggedPos + draggedSize);

        // 1. INSERT FIRST: This guarantees the document never temporarily shrinks
        // into an invalid schema state (which would ruin our coordinates).
        tr.insert(this.dropInsertPos, content.content);

        // 2. MAP: Let ProseMirror calculate where our original block moved to
        // as a result of the insertion we just made above it.
        const mappedDragPos = tr.mapping.map(this.draggedPos);

        // 3. DELETE: Safely remove the original block using its newly mapped position.
        tr.delete(mappedDragPos, mappedDragPos + draggedSize);

        this.view.dispatch(tr);
      }
    }

    this.endDrag();
  }

  // ── Drag end ──────────────────────────────────────────────────────────────

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

    this.draggedPos    = -1;
    this.dropInsertPos = -1;
    this.dropValid     = true;

    this.indicator.style.display = 'none';
    this.indicator.classList.remove('drag-block-indicator--invalid');
    this.handle.classList.remove('drag-block-handle--active');
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy(): void {
    this.stopAutoScroll();

    if (this._hideTimeoutId !== null) {
      clearTimeout(this._hideTimeoutId);
      this._hideTimeoutId = null;
    }

    this.view.dom.removeEventListener('mousemove', this._onMouseMove);
    this.view.dom.removeEventListener('mouseleave', this._onMouseLeave);
    this.handle.removeEventListener('dragstart', this._onDragStart);
    document.removeEventListener('dragover', this._onDragOver, { capture: true });
    document.removeEventListener('drop',    this._onDrop,    { capture: true });
    document.removeEventListener('dragend', this._onDragEnd, { capture: true });
    this.handle.removeEventListener('dragend', this._onDragEnd);

    // Remove the custom mouseleave listener if it was named, but since we used arrow fn, 
    // it will be cleaned up when the handle is removed from DOM.
    // For completeness, we should have used a named function, but the handle is destroyed anyway.

    this.handle.remove();
    this.indicator.remove();
  }
}

// ─── Extension ────────────────────────────────────────────────────────────────

export const DraggableBlocks = Extension.create({
  name: 'draggableBlocks',

  addOptions() {
    return {};
  },

  // ── Commands ────────────────────────────────────────────────────────────────

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

          const $sp    = state.doc.resolve(startPos);
          const index  = $sp.index();
          if (index === 0) return false;

          const prevNode = $sp.parent.child(index - 1);
          const prevPos  = startPos - prevNode.nodeSize;

          if (dispatch) {
            const tr = state.tr;
            
            // 1. Calculate relative cursor offsets before doing anything
            const fromOffset = state.selection.from - startPos;
            const toOffset = state.selection.to - startPos;

            // 2. Perform the swap
            const content = state.doc.slice(startPos, startPos + startNode.nodeSize);
            tr.delete(startPos, startPos + startNode.nodeSize);
            tr.insert(prevPos, content.content);

            // 3. Manually recreate the selection at the new coordinates
            const SelectionClass = state.selection.constructor as any;
            tr.setSelection(SelectionClass.create(tr.doc, prevPos + fromOffset, prevPos + toOffset));
            
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

          const $sp   = state.doc.resolve(startPos);
          const index = $sp.index();
          if (index === $sp.parent.childCount - 1) return false;

          const nextNode = $sp.parent.child(index + 1);

          if (dispatch) {
            const tr = state.tr;
            
            // 1. Calculate relative cursor offsets before doing anything
            const fromOffset = state.selection.from - startPos;
            const toOffset = state.selection.to - startPos;

            // 2. Perform the swap
            const content = state.doc.slice(startPos, startPos + startNode.nodeSize);
            tr.delete(startPos, startPos + startNode.nodeSize);
            
            const insertPos = startPos + nextNode.nodeSize;
            tr.insert(insertPos, content.content);

            // 3. Manually recreate the selection at the new coordinates
            const SelectionClass = state.selection.constructor as any;
            tr.setSelection(SelectionClass.create(tr.doc, insertPos + fromOffset, insertPos + toOffset));
            
            dispatch(tr.scrollIntoView());
          }
          return true;
        },
    };
  },

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  addKeyboardShortcuts() {
    return {
      'Alt-ArrowUp':   () => this.editor.commands.moveBlockUp(),
      'Alt-ArrowDown': () => this.editor.commands.moveBlockDown(),
    };
  },

  // ── ProseMirror plugin ─────────────────────────────────────────────────────

  addProseMirrorPlugins() {
    const editorRef = this.editor;

    return [
      new Plugin({
        key: draggableBlocksPluginKey,

        props: {
          /**
           * Intercept drops that originated from our handle, preventing ProseMirror
           * from treating them as text-selection moves.
           */
          handleDrop(_view, event): boolean {
            if (event.dataTransfer?.types.includes(BLOCK_DRAG_MIME)) {
              // Signal: we own this drop. Our document-level capture listener handles it.
              return true;
            }
            return false;
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
