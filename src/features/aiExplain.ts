/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Extension-host AI Explain using the VS Code Language Model API.
 * Takes document text and produces a simplified, structured explanation
 * similar to browser reading/summary modes (Edge, Chrome).
 *
 * @module aiExplain (extension host)
 */

import * as vscode from 'vscode';
import { MessageType } from '../shared/messageTypes';

const SYSTEM_PROMPT =
  'You are a document analysis assistant embedded in a markdown editor. ' +
  'The user will give you the full text of a technical document. ' +
  'Produce a clear, structured summary that helps the reader quickly understand the content. ' +
  'Use this format:\n' +
  '# Summary\nA 2-3 sentence overview of what the document is about.\n\n' +
  '## Key Points\n- Bullet point for each major concept or takeaway\n\n' +
  '## Technical Details\n- Bullet points explaining technical terms or concepts ' +
  'in simple language\n\n' +
  'Keep the explanation concise (under 500 words). ' +
  'Use **bold** for important terms. ' +
  'Do NOT include markdown code fences around the output. ' +
  'Write as if explaining to a competent developer who is new to this specific topic.';

/**
 * Handle an AI explain request from the webview.
 */
export async function handleAiExplainRequest(
  webview: vscode.Webview,
  data: { documentText: string }
): Promise<void> {
  const { documentText } = data;

  // Truncate very long documents to avoid token limits
  const maxChars = 15000;
  const text =
    documentText.length > maxChars
      ? documentText.slice(0, maxChars) + '\n\n[Document truncated for analysis]'
      : documentText;

  try {
    const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
    const modelFamily = config.get<string>('aiModel', 'gpt-4.1');

    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: modelFamily,
    });

    let model = models[0];

    if (!model) {
      const fallbackModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      model = fallbackModels[0];
    }

    if (!model) {
      webview.postMessage({
        type: MessageType.AI_EXPLAIN_RESULT,
        success: false,
        error: 'No AI model available. Ensure GitHub Copilot is active.',
      });
      return;
    }

    const messages = [
      vscode.LanguageModelChatMessage.User(SYSTEM_PROMPT),
      vscode.LanguageModelChatMessage.User(`Document content:\n\n${text}`),
    ];

    const response = await model.sendRequest(
      messages,
      {},
      new vscode.CancellationTokenSource().token
    );

    let result = '';
    for await (const chunk of response.text) {
      result += chunk;
    }

    webview.postMessage({
      type: MessageType.AI_EXPLAIN_RESULT,
      success: true,
      explanation: result.trim(),
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
