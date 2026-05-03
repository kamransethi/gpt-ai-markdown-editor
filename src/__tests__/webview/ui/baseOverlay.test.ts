/**
 * @jest-environment jsdom
 *
 * FR-005: BaseOverlay Framework
 *
 * Validates the open/close lifecycle, focus restoration, and overlayStack
 * management in BaseOverlay.ts.
 */

import { BaseOverlay, overlayStack } from '../../../webview/overlays/BaseOverlay';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOverlayEl(id = 'test-overlay'): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  return el;
}

// Reset overlayStack between tests
afterEach(() => {
  overlayStack.length = 0;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FR-005: BaseOverlay', () => {
  it('open() appends element to document.body and adds visible class', () => {
    const overlay = new BaseOverlay();
    const el = makeOverlayEl();

    overlay.open(el);

    expect(document.body.contains(el)).toBe(true);
    expect(el.classList.contains('visible')).toBe(true);
    expect(overlay.isOpen).toBe(true);

    overlay.close();
  });

  it('close() removes visible class and is no longer open', () => {
    const overlay = new BaseOverlay();
    const el = makeOverlayEl();

    overlay.open(el);
    overlay.close();

    expect(el.classList.contains('visible')).toBe(false);
    expect(overlay.isOpen).toBe(false);
  });

  it('close() returns focus to the trigger element', () => {
    const overlay = new BaseOverlay();
    const el = makeOverlayEl();

    // Create a focusable trigger
    const trigger = document.createElement('button');
    trigger.textContent = 'Trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    overlay.open(el, trigger);
    overlay.close();

    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });

  it('overlayStack tracks nested overlays in LIFO order', () => {
    const o1 = new BaseOverlay();
    const o2 = new BaseOverlay();
    const el1 = makeOverlayEl('overlay-1');
    const el2 = makeOverlayEl('overlay-2');

    o1.open(el1);
    o2.open(el2);

    expect(overlayStack).toHaveLength(2);
    expect(overlayStack[overlayStack.length - 1]).toBe(o2);

    o2.close();
    expect(overlayStack).toHaveLength(1);
    expect(overlayStack[0]).toBe(o1);

    o1.close();
    expect(overlayStack).toHaveLength(0);
  });

  it('Escape key closes the topmost overlay', () => {
    const overlay = new BaseOverlay();
    const el = makeOverlayEl();

    overlay.open(el);
    expect(overlay.isOpen).toBe(true);

    // Dispatch an Escape keydown event at document level
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escapeEvent);

    expect(overlay.isOpen).toBe(false);
  });
});
