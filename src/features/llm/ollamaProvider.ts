/**
 * Ollama LLM provider — streams responses from a local Ollama instance via HTTP.
 *
 * Uses the `/api/chat` endpoint with streaming JSON (newline-delimited).
 *
 * @module llm/ollamaProvider
 */

import type { LlmMessage, LlmProvider } from './types';

interface OllamaChatChunk {
  message?: { content: string };
  done: boolean;
  error?: string;
}

export class OllamaProvider implements LlmProvider {
  constructor(
    private readonly endpoint: string,
    private readonly model: string
  ) {}

  async *generate(messages: LlmMessage[], abortSignal?: AbortSignal): AsyncGenerator<string> {
    yield* this._streamChat(messages, [], abortSignal);
  }

  async *generateWithVision(
    messages: LlmMessage[],
    images: string[],
    abortSignal?: AbortSignal
  ): AsyncGenerator<string> {
    yield* this._streamChat(messages, images, abortSignal);
  }

  private async *_streamChat(
    messages: LlmMessage[],
    images: string[],
    abortSignal?: AbortSignal
  ): AsyncGenerator<string> {
    const url = `${this.endpoint.replace(/\/+$/, '')}/api/chat`;

    // Attach images to the last user message per Ollama API convention
    const ollamaMessages = messages.map((m, i) => {
      const msg: Record<string, unknown> = { role: m.role, content: m.content };
      if (images.length > 0 && m.role === 'user' && i === messages.length - 1) {
        msg.images = images;
      }
      return msg;
    });

    const body = JSON.stringify({
      model: this.model,
      messages: ollamaMessages,
      stream: true,
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: abortSignal,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      throw new Error(
        `Ollama is not reachable at ${this.endpoint}. Please start Ollama or change your LLM provider setting.`,
        { cause: error }
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 404 && text.includes('not found')) {
        throw new Error(
          `Ollama model "${this.model}" is not available. Run \`ollama pull ${this.model}\` to download it.`
        );
      }
      throw new Error(`Ollama request failed (${response.status}): ${text}`);
    }

    if (!response.body) {
      throw new Error('Ollama returned an empty response body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (abortSignal?.aborted) {
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let chunk: OllamaChatChunk;
          try {
            chunk = JSON.parse(trimmed) as OllamaChatChunk;
          } catch {
            continue;
          }

          if (chunk.error) {
            throw new Error(`Ollama error: ${chunk.error}`);
          }

          if (chunk.message?.content) {
            yield chunk.message.content;
          }

          if (chunk.done) {
            return;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
