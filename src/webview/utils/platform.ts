/**
 * Platform detection utilities for keyboard shortcut labels and platform-specific behavior.
 *
 * @module platform
 */

/** Whether the current platform is macOS */
export const isMac: boolean = navigator.platform.toLowerCase().includes('mac');

/** Shortcut modifier symbol: '⌘' on macOS, 'Ctrl+' elsewhere */
export const modSymbol: string = isMac ? '⌘' : 'Ctrl+';

/** Shortcut modifier label: 'Cmd' on macOS, 'Ctrl' elsewhere */
export const modLabel: string = isMac ? 'Cmd' : 'Ctrl';
