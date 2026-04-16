/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Extension-host AI text refinement.
 * Receives requests from the webview, calls the LLM provider, and sends back refined text.
 *
 * @module aiRefine (extension host)
 */

import * as vscode from 'vscode';
import { MessageType } from '../shared/messageTypes';
import { getPromptForMode } from '../shared/aiModes';
import { createLlmProvider } from './llm/providerFactory';
import type { LlmMessage } from './llm/types';
import { getProviderAvailabilityCached } from './llm/providerAvailability';

// ── Prompts ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  'You are a writing assistant embedded in a markdown editor. ' +
  'The user will provide text and an instruction. ' +
  'Return ONLY the refined text—no explanations, no markdown code fences, no preamble. ' +
  'IMPORTANT: Do NOT add block-level markdown formatting such as `>` for blockquotes, ' +
  'callouts, or alerts. The text will be placed back into its original formatting context automatically.';

function buildUserPrompt(mode: string, text: string): string {
  if (mode.startsWith('custom:')) {
    const instruction = mode.slice('custom:'.length);
    return `Instruction: ${instruction}\n\nText:\n${text}`;
  }

  const prompt = getPromptForMode(mode);
  return `${prompt}\n\n${text}`;
}

// ── Main handler ────────────────────────────────────────────────────

/**
 * Handle an AI refine request from the webview.
 *
 * @param webview - The webview panel to send the result back to.
 * @param data - The request payload { mode, selectedText, from, to }.
 */
export async function handleAiRefineRequest(
  webview: vscode.Webview,
  data: {
    mode: string;
    selectedText: string;
    from: number;
    to: number;
  }
): Promise<void> {
  const { mode, selectedText, from, to } = data;

  try {
    // Check provider availability
    const availability = await getProviderAvailabilityCached();
    const selectedProvider = vscode.workspace
      .getConfiguration('gptAiMarkdownEditor')
      .get<string>('llmProvider', 'GitHub Copilot');

    if (selectedProvider === 'GitHub Copilot' && !availability.copilotAvailable) {
      webview.postMessage({
        type: MessageType.AI_REFINE_RESULT,
        success: false,
        error:
          'GitHub Copilot is not available. Please configure Ollama or sign up for GitHub Copilot.',
        from,
        to,
      });
      return;
    }

    if (selectedProvider === 'Ollama' && !availability.ollamaAvailable) {
      webview.postMessage({
        type: MessageType.AI_REFINE_RESULT,
        success: false,
        error:
          'Ollama is not reachable. Please ensure Ollama is running at the configured endpoint.',
        from,
        to,
      });
      return;
    }

    const provider = createLlmProvider();
    const abortController = new AbortController();

    const messages: LlmMessage[] = [
      {
        role: 'user',
        content: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(mode, selectedText)}`,
      },
    ];

    let refinedText = '';
    for await (const chunk of provider.generate(messages, abortController.signal)) {
      refinedText += chunk;
    }

    // Clean up any code fences the model might add despite instructions
    refinedText = refinedText
      .replace(/^```(?:markdown)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    webview.postMessage({
      type: MessageType.AI_REFINE_RESULT,
      success: true,
      refinedText,
      from,
      to,
    });
  } catch (error: unknown) {
    let errorMessage = 'AI refinement failed.';

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    console.error('[DK-AI] AI Refine error:', error);

    webview.postMessage({
      type: MessageType.AI_REFINE_RESULT,
      success: false,
      error: errorMessage,
      from,
      to,
    });
  }
}
