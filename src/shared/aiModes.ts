/**
 * AI Refine mode definitions — single source of truth.
 *
 * Consumed by both the webview (context menu) and the extension host (prompt builder).
 *
 * @module aiModes
 */

export interface AiRefineMode {
  /** Display label shown in the context menu. */
  label: string;
  /** Machine key sent over the wire and used to look up the prompt. */
  mode: string;
  /** Prompt prefix sent to the language model (extension-host only). */
  prompt: string;
}

/** Visual separator sentinel used only by the context-menu renderer.  */
export interface AiRefineSeparator {
  separator: true;
}

export type AiRefineMenuItem = AiRefineMode | AiRefineSeparator;

export function isSeparator(item: AiRefineMenuItem): item is AiRefineSeparator {
  return 'separator' in item && item.separator === true;
}

/**
 * The custom-instruction entry shown at the top of the submenu.
 * Its `mode` value is only a placeholder — the actual wire value
 * is `custom:<user instruction>`.
 */
export const CUSTOM_REFINE_ENTRY: AiRefineMode = {
  label: 'Custom…',
  mode: 'custom',
  prompt: '', // prompt is built dynamically from user input
};

/**
 * Built-in refine modes with their prompts.
 */
export const AI_REFINE_MODES: readonly AiRefineMode[] = [
  {
    label: 'Rephrase',
    mode: 'rephrase',
    prompt: 'Rephrase the following text while preserving its meaning:',
  },
  {
    label: 'Shorten',
    mode: 'shorten',
    prompt: 'Make the following text more concise without losing key information:',
  },
  {
    label: 'More Formal',
    mode: 'formal',
    prompt: 'Rewrite the following text in a more formal, professional tone:',
  },
  {
    label: 'More Casual',
    mode: 'casual',
    prompt: 'Rewrite the following text in a more casual, conversational tone:',
  },
  {
    label: 'Bulletize',
    mode: 'bulletize',
    prompt: 'Convert the following text into a bulleted list (use markdown - bullets):',
  },
  {
    label: 'Summarize',
    mode: 'summarize',
    prompt: 'Summarize the following text in 1-3 sentences:',
  },
] as const;

/**
 * Ordered menu items for the context-menu AI-Refine submenu.
 * Custom entry → separator → built-in modes.
 */
export function getRefineMenuItems(): AiRefineMenuItem[] {
  return [CUSTOM_REFINE_ENTRY, { separator: true } as AiRefineSeparator, ...AI_REFINE_MODES];
}

/**
 * Look up the prompt for a given mode key.
 * Returns a generic fallback for unknown modes.
 */
export function getPromptForMode(mode: string): string {
  const found = AI_REFINE_MODES.find(m => m.mode === mode);
  return found?.prompt ?? `Refine the following text (${mode}):`;
}
