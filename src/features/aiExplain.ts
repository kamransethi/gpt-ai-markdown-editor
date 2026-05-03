/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Extension-host AI Explain.
 * Takes document text and produces a simplified, structured explanation
 * similar to browser reading/summary modes (Edge, Chrome).
 *
 * @module aiExplain (extension host)
 */

import * as vscode from 'vscode';
import { MessageType } from '../shared/messageTypes';
import { createLlmProvider, getModelDisplayName } from './llm/providerFactory';
import type { LlmMessage } from './llm/types';
import { getProviderAvailabilityCached } from './llm/providerAvailability';
import { getPromptById } from './aiPrompts';

/** Abort controller for the in-flight AI explain stream. Replaced on each new request. */
let currentExplainAbort: AbortController | null = null;

/**
 * Abort any in-flight AI explain stream.
 */
export function stopAiExplainRequest(): void {
  if (currentExplainAbort) {
    currentExplainAbort.abort();
    currentExplainAbort = null;
  }
}

/**
 * Handle an AI explain request from the webview.
 */
export async function handleAiExplainRequest(
  webview: vscode.Webview,
  data: { documentText: string; actionId?: string }
): Promise<void> {
  const { documentText, actionId } = data;

  try {
    // Check provider availability
    const availability = await getProviderAvailabilityCached();
    const selectedProvider = vscode.workspace
      .getConfiguration('gptAiMarkdownEditor')
      .get<string>('llmProvider', 'GitHub Copilot');

    if (selectedProvider === 'GitHub Copilot' && !availability.copilotAvailable) {
      webview.postMessage({
        type: MessageType.AI_EXPLAIN_RESULT,
        success: false,
        error:
          'GitHub Copilot is not available. Please configure Ollama or sign up for GitHub Copilot.',
      });
      return;
    }

    if (selectedProvider === 'Ollama' && !availability.ollamaAvailable) {
      webview.postMessage({
        type: MessageType.AI_EXPLAIN_RESULT,
        success: false,
        error:
          'Ollama is not reachable. Please ensure Ollama is running at the configured endpoint.',
      });
      return;
    }

    // Truncate very long documents to avoid token limits
    const maxChars = 15000;
    const text =
      documentText.length > maxChars
        ? documentText.slice(0, maxChars) + '\n\n[Document truncated for analysis]'
        : documentText;

    let sysPrompt = 'You are a document analysis assistant embedded in a markdown editor.';
    let taskPrompt = 'Provide a clear analysis of the document.';

    if (actionId) {
      const p = await getPromptById(actionId);
      if (p) {
        if (p.systemPrompt) sysPrompt = p.systemPrompt;
        taskPrompt = p.prompt;
      }
    }

    const provider = createLlmProvider();
    const modelName = getModelDisplayName();
    const abortController = new AbortController();
    currentExplainAbort = abortController;

    const messages: LlmMessage[] = [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: `Document content:\n\n${text}\n\nTask: ${taskPrompt}` },
    ];

    const MAX_RESPONSE_CHARS = 4000;
    let result = '';
    for await (const chunk of provider.generate(messages, abortController.signal)) {
      if (abortController.signal.aborted) break;
      result += chunk;
      webview.postMessage({
        type: MessageType.AI_EXPLAIN_CHUNK,
        text: chunk,
        fullText: result,
      });
      if (result.length >= MAX_RESPONSE_CHARS) {
        abortController.abort();
        break;
      }
    }

    webview.postMessage({
      type: MessageType.AI_EXPLAIN_DONE,
      fullText: result.trim(),
      modelName,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[DK-AI] AI Explain error:', errMsg);

    webview.postMessage({
      type: MessageType.AI_EXPLAIN_RESULT,
      success: false,
      error: `AI Explain failed: ${errMsg}`,
    });
  }
}
