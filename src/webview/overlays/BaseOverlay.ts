/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * BaseOverlay.ts — Shared overlay lifecycle management (FR-005)
 *
 * Provides a reusable open/close contract for modal overlays (table insert,
 * search, TOC). Key behaviours:
 *
 * - `open(element, triggerEl?)`: Appends `element` to `document.body`, adds the
 *   `'visible'` CSS class, captures focus trigger for restoration, registers a
 *   document-level Escape handler, and pushes `this` onto the module-level
 *   `overlayStack`.
 *
 * - `close()`: Removes the `'visible'` class, pops from `overlayStack`, removes
 *   the Escape handler, and returns focus to the captured trigger element.
 *
 * - `overlayStack`: Module-level array so that nested overlays close in LIFO
 *   order when Escape is pressed.
 *
 * Usage:
 * ```ts
 * const myOverlay = new BaseOverlay();
 *
 * function showMyOverlay(triggerEl?: HTMLElement) {
 *   myOverlay.open(overlayElement, triggerEl);
 * }
 *
 * function hideMyOverlay() {
 *   myOverlay.close();
 * }
 * ```
 */

/** Module-level stack of open overlays — topmost is the active one. */
export const overlayStack: BaseOverlay[] = [];

export class BaseOverlay {
  /** The overlay element currently managed by this instance. */
  private _element: HTMLElement | null = null;

  /** Element that had focus before the overlay opened — restored on close. */
  private _triggerEl: Element | null = null;

  /** Bound Escape handler kept for removal. */
  private _onKeyDown: ((e: KeyboardEvent) => void) | null = null;

  /** Whether this overlay is currently open. */
  get isOpen(): boolean {
    return this._element !== null && this._element.classList.contains('visible');
  }

  /**
   * Open the overlay.
   *
   * @param element    The overlay root element to show.
   * @param triggerEl  Optional element to return focus to on close.
   *                   Defaults to `document.activeElement` at call time.
   */
  open(element: HTMLElement, triggerEl?: Element | null): void {
    this._element = element;
    this._triggerEl = triggerEl ?? document.activeElement;

    // Attach to body if not already present
    if (!document.body.contains(element)) {
      document.body.appendChild(element);
    }

    // Make visible
    element.classList.add('visible');

    // Register document-level Escape handler
    this._onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only close if we are the topmost overlay
        if (overlayStack[overlayStack.length - 1] === this) {
          e.stopPropagation();
          this.close();
        }
      }
    };
    document.addEventListener('keydown', this._onKeyDown, true);

    // Push onto stack
    overlayStack.push(this);
  }

  /**
   * Close the overlay and return focus to the trigger element.
   */
  close(): void {
    if (!this._element) return;

    this._element.classList.remove('visible');

    // Remove Escape handler
    if (this._onKeyDown) {
      document.removeEventListener('keydown', this._onKeyDown, true);
      this._onKeyDown = null;
    }

    // Pop from stack (handles nested overlays correctly)
    const idx = overlayStack.lastIndexOf(this);
    if (idx !== -1) {
      overlayStack.splice(idx, 1);
    }

    // Return focus to trigger
    if (this._triggerEl && typeof (this._triggerEl as HTMLElement).focus === 'function') {
      (this._triggerEl as HTMLElement).focus();
    }

    this._element = null;
    this._triggerEl = null;
  }
}
