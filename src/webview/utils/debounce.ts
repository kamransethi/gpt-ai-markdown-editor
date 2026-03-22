/**
 * Generic debounce and throttle utilities with cancellation support.
 */

/** A debounced function with a cancel method to clear the pending timer. */
export interface Cancellable {
  cancel(): void;
}

/**
 * Debounce a no-arg function using setTimeout.
 * Returns a wrapper that delays invocation until `delayMs` has elapsed since the last call.
 */
export function debounce(fn: () => void, delayMs: number): (() => void) & Cancellable {
  let timer: number | null = null;

  const debounced = () => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      timer = null;
      fn();
    }, delayMs);
  };

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}

/**
 * Throttle a no-arg function to fire at most once per animation frame.
 */
export function rafThrottle(fn: () => void): (() => void) & Cancellable {
  let rafId: number | null = null;

  const throttled = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      rafId = null;
      fn();
    });
  };

  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  return throttled;
}
