/**
 * Provider factory — reads VS Code settings and returns the appropriate LLM provider.
 *
 * Fresh instance per call (no caching) so setting changes take effect immediately.
 *
 * @module llm/providerFactory
 */

import * as vscode from 'vscode';
import type { LlmProvider } from './types';
import { CopilotProvider } from './copilotProvider';
import { OllamaProvider } from './ollamaProvider';

export function createLlmProvider(): LlmProvider {
  const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
  const provider = config.get<string>('llmProvider', 'GitHub Copilot');

  if (provider === 'Ollama') {
    const model = config.get<string>('ollamaModel', 'llama3.2:latest');
    const endpoint = config.get<string>('ollamaEndpoint', 'http://localhost:11434');
    return new OllamaProvider(endpoint, model);
  }

  return new CopilotProvider();
}

/**
 * Return the display name of the currently configured model.
 */
export function getModelDisplayName(): string {
  const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
  const provider = config.get<string>('llmProvider', 'GitHub Copilot');

  if (provider === 'Ollama') {
    return config.get<string>('ollamaModel', 'llama3.2:latest');
  }

  return config.get<string>('aiModel', 'gpt-4.1');
}

/** Ollama models known to support vision inputs. */
const OLLAMA_VISION_MODELS = ['llava', 'bakllava', 'llama3.2-vision', 'moondream', 'minicpm-v'];

/**
 * Check if the currently configured provider/model supports vision (image) inputs.
 * For Copilot: most modern models support vision — return true.
 * For Ollama: check if the model name starts with a known vision model prefix.
 */
export function isVisionCapable(): boolean {
  const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
  const provider = config.get<string>('llmProvider', 'GitHub Copilot');

  if (provider === 'Ollama') {
    const model = config.get<string>('ollamaModel', 'llama3.2:latest').toLowerCase();
    return OLLAMA_VISION_MODELS.some(prefix => model.startsWith(prefix));
  }

  // Copilot models (gpt-4o, gpt-4.1, etc.) generally support vision
  return true;
}
