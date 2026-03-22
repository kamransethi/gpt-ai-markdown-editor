/**
 * Shared error utilities used across extension host and webview.
 */

/**
 * Extract a human-readable message from an unknown error value.
 * Handles Error instances, strings, and other thrown values.
 */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
