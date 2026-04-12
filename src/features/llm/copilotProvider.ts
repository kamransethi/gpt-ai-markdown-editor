/**
 * Copilot LLM provider — wraps the VS Code Language Model API.
 *
 * @module llm/copilotProvider
 */

import * as vscode from 'vscode';
import type { LlmMessage, LlmProvider } from './types';

/** Models known to support vision inputs. */
const VISION_MODELS = ['gpt-4o', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4-turbo'];

export class CopilotProvider implements LlmProvider {
  async *generate(messages: LlmMessage[], abortSignal?: AbortSignal): AsyncGenerator<string> {
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
      throw new Error(
        'No language model available. Please ensure GitHub Copilot is installed and signed in.'
      );
    }

    const lmMessages = messages.map(m => vscode.LanguageModelChatMessage.User(m.content));

    const tokenSource = new vscode.CancellationTokenSource();
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => tokenSource.cancel(), { once: true });
    }

    const response = await model.sendRequest(lmMessages, {}, tokenSource.token);

    for await (const chunk of response.text) {
      if (abortSignal?.aborted) {
        break;
      }
      yield chunk;
    }
  }

  async *generateWithVision(
    messages: LlmMessage[],
    images: string[],
    abortSignal?: AbortSignal
  ): AsyncGenerator<string> {
    const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
    let modelFamily = config.get<string>('aiModel', 'gpt-4.1');

    // Ensure a vision-capable model is used
    if (!VISION_MODELS.includes(modelFamily)) {
      modelFamily = 'gpt-4.1';
    }

    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: modelFamily,
    });

    let model = models[0];

    if (!model) {
      // Fallback: try any copilot model
      const fallbackModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      model = fallbackModels[0];
    }

    if (!model) {
      throw new Error(
        'No language model available. Please ensure GitHub Copilot is installed and signed in.'
      );
    }

    // Build messages with image content parts.
    // The multi-part API (LanguageModelTextPart/LanguageModelDataPart) is available
    // in newer VS Code versions. We use dynamic access to avoid compile-time errors
    // with older @types/vscode.
    const vsAny = vscode as any;
    const lmMessages: vscode.LanguageModelChatMessage[] = [];
    for (const m of messages) {
      if (m.role === 'user' && images.length > 0 && vsAny.LanguageModelTextPart) {
        const parts: any[] = [];
        for (const imageBase64 of images) {
          const buffer = Buffer.from(imageBase64, 'base64');
          parts.push(new vsAny.LanguageModelDataPart('image/png', buffer));
        }
        parts.push(new vsAny.LanguageModelTextPart(m.content));
        lmMessages.push(vsAny.LanguageModelChatMessage.User(parts));
      } else {
        lmMessages.push(vscode.LanguageModelChatMessage.User(m.content));
      }
    }

    const tokenSource = new vscode.CancellationTokenSource();
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => tokenSource.cancel(), { once: true });
    }

    const response = await model.sendRequest(lmMessages, {}, tokenSource.token);

    for await (const chunk of response.text) {
      if (abortSignal?.aborted) {
        break;
      }
      yield chunk;
    }
  }
}
