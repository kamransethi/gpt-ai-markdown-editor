/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Extension-host AI text refinement using the VS Code Language Model API (vscode.lm).
 * Receives requests from the webview, calls the LM, and sends back refined text.
 *
 * @module aiRefine (extension host)
 */

import * as vscode from 'vscode';
import { MessageType } from '../shared/messageTypes';

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

  const modePrompts: Record<string, string> = {
    rephrase: 'Rephrase the following text while preserving its meaning:',
    shorten: 'Make the following text more concise without losing key information:',
    formal: 'Rewrite the following text in a more formal, professional tone:',
    casual: 'Rewrite the following text in a more casual, conversational tone:',
    bulletize: 'Convert the following text into a bulleted list (use markdown - bullets):',
    summarize: 'Summarize the following text in 1-3 sentences:',
  };

  const prompt = modePrompts[mode] || `Refine the following text (${mode}):`;
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
    // Read the configured model family
    const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
    const modelFamily = config.get<string>('aiModel', 'gpt-4.1');

    // Select an available language model
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: modelFamily,
    });

    let model = models[0];

    // Fallback: try any copilot model if gpt-4.1 not available
    if (!model) {
      const fallbackModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      model = fallbackModels[0];
    }

    if (!model) {
      webview.postMessage({
        type: MessageType.AI_REFINE_RESULT,
        success: false,
        error:
          'No language model available. Please ensure GitHub Copilot is installed and signed in.',
        from,
        to,
      });
      return;
    }

    // Build messages
    const messages = [
      vscode.LanguageModelChatMessage.User(
        `${SYSTEM_PROMPT}\n\n${buildUserPrompt(mode, selectedText)}`
      ),
    ];

    // Send the request
    const response = await model.sendRequest(
      messages,
      {},
      new vscode.CancellationTokenSource().token
    );

    // Collect the streamed response
    let refinedText = '';
    for await (const chunk of response.text) {
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

    if (error instanceof vscode.LanguageModelError) {
      if (error.code === 'NoPermissions') {
        errorMessage = 'Copilot access denied. Please check your GitHub Copilot subscription.';
      } else if (error.code === 'NotFound') {
        errorMessage = 'No suitable language model found.';
      } else {
        errorMessage = `Language model error: ${error.message}`;
      }
    } else if (error instanceof Error) {
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
