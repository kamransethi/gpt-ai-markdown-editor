/**
 * Developer-mode gated logging utility.
 *
 * When `gptaiDeveloperMode` is false, all debug logging is suppressed.
 * Errors and warnings always log regardless of the setting.
 *
 * @module devLog
 */

function isDevMode(): boolean {
  try {
    return typeof window !== 'undefined' && window.gptaiDeveloperMode !== false;
  } catch {
    return false;
  }
}

/** Debug-level log — suppressed when Developer Mode is off. */
export function devLog(...args: unknown[]): void {
  if (isDevMode()) {
    console.log(...args);
  }
}
