/**
 * LLM provider abstraction types.
 *
 * Defines the common interface that both the Copilot and Ollama providers implement.
 *
 * @module llm/types
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmProvider {
  /**
   * Send messages to the LLM and stream back text chunks.
   * The returned async generator yields string chunks as they arrive.
   * @param messages - The messages to send.
   * @param abortSignal - Optional signal to cancel the request.
   */
  generate(messages: LlmMessage[], abortSignal?: AbortSignal): AsyncGenerator<string>;

  /**
   * Send messages with images to a vision-capable LLM and stream back text chunks.
   * @param messages - The messages to send.
   * @param images - Base64-encoded image data strings (without data URI prefix).
   * @param abortSignal - Optional signal to cancel the request.
   */
  generateWithVision?(
    messages: LlmMessage[],
    images: string[],
    abortSignal?: AbortSignal
  ): AsyncGenerator<string>;
}
