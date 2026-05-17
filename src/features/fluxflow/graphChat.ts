/**
 * Graph Chat Orchestrator — powered by Foam indexing + RAG.
 *
 * Flow:
 *  1. Query Foam snapshot for related notes (keyword/title match)
 *  2. Build RAG context from top-K note snippets
 *  3. Stream LLM response with source attribution
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import type { LlmMessage } from '../llm/types';
import { createLlmProvider } from '../llm/providerFactory';
import { getFoamSnapshot } from '../foam/foamAdapter';

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
    const cfg = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
    const topK = cfg.get<number>('knowledgeGraph.rag.topK', 8);

    // ── RAG: find relevant notes ──────────────────────────────────────────
    const sources: SourceDoc[] = [];
    const snapshot = getFoamSnapshot();
    if (snapshot && snapshot.notes.length > 0) {
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

      const scored = snapshot.notes
        .map(note => {
          let score = 0;
          const haystack =
            `${note.title} ${note.tags.join(' ')} ${note.aliases.join(' ')}`.toLowerCase();
          for (const word of queryWords) {
            if (haystack.includes(word)) score += 2;
          }
          return { note, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      for (const { note } of scored) {
        try {
          const content = fs.readFileSync(note.path, 'utf-8');
          // Extract up to 500 chars of body (skip frontmatter)
          const bodyStart = content.indexOf('\n---\n', 4);
          const body = bodyStart > -1 ? content.slice(bodyStart + 5) : content;
          const snippet = body.trim().slice(0, 500).replace(/\n+/g, ' ').trim();
          sources.push({ path: note.path, title: note.title, snippet });
        } catch {
          // Skip unreadable files
        }
      }
    }

    // Emit sources first so the UI can display them while streaming
    if (sources.length > 0) {
      yield { type: 'sources', sources };
    }

    // ── Build system prompt with RAG context ─────────────────────────────
    let systemPrompt = `You are a helpful assistant that answers questions about the user's notes.\nUse the provided context to answer questions accurately. If you don't know the answer from the context, say so.`;
    if (sources.length > 0) {
      const contextBlock = sources.map(s => `### ${s.title}\n${s.snippet}`).join('\n\n');
      systemPrompt += `\n\n## Relevant Notes\n\n${contextBlock}`;
    }

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
      yield { type: 'chunk', text: chunk, fullText };
    }

    yield { type: 'done', fullText };
  } catch (err) {
    if (signal.aborted) return;
    yield {
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
