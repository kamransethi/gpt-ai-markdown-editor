/**
 * Graph Chat Orchestrator — powered by Foam indexing.
 *
 * Placeholder implementation. Will be refactored to use Foam's
 * FoamWorkspace and link graph for context building.
 *
 * Flow (planned):
 *  1. Use Foam workspace to search for related notes
 *  2. Build RAG context from related documents
 *  3. Stream LLM response
 */

import * as vscode from 'vscode';
import type { LlmMessage } from '../llm/types';
import { createLlmProvider } from '../llm/providerFactory';

// ── Types ──

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceDoc[];
  streaming?: boolean;
}

export interface SourceDoc {
  path: string;
  title: string;
  snippet: string;
}

export interface StreamEvent {
  type: 'sources' | 'chunk' | 'done' | 'error';
  sources?: SourceDoc[];
  text?: string;
  fullText?: string;
  error?: string;
}

/**
 * Stream an answer from the LLM based on workspace context.
 *
 * @param workspacePath  Path to the workspace
 * @param query          User question
 * @param history        Conversation history for multi-turn context
 * @param signal         AbortSignal for cancellation
 */
export async function* streamAnswer(
  workspacePath: string,
  query: string,
  history: ChatMessage[],
  signal: AbortSignal
): AsyncGenerator<StreamEvent> {
  try {
    // TODO: Integrate Foam to find related notes
    // For now, just stream a placeholder response

    const cfg = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
    cfg.get<number>('knowledgeGraph.rag.topK', 8); // reserved for Foam RAG integration

    // Build initial message to LLM
    const systemPrompt = `You are a helpful assistant that answers questions about the user's notes.
Use the provided context to answer questions accurately. If you don't know the answer from the context, say so.`;

    const llmProvider = createLlmProvider();
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: query },
    ];

    // Stream the response
    let fullText = '';
    for await (const chunk of llmProvider.streamText(messages, signal)) {
      fullText += chunk;
      yield {
        type: 'chunk',
        text: chunk,
        fullText,
      };
    }

    yield {
      type: 'done',
      fullText,
    };
  } catch (err) {
    if (signal.aborted) return;
    yield {
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
