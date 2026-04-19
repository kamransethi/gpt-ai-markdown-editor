/**
 * RAG Chat Orchestrator — builds context from hybrid search, streams LLM answers.
 *
 * Flow:
 *  1. Parse user query for prefix filters (tag:, property:, in:)
 *  2. Hybrid search: parallel FTS + semantic → graph expansion → RRF reranking
 *  3. Read actual file sections from disk for rich context
 *  4. Build system prompt with document excerpts
 *  5. Stream LLM response
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { GraphDatabase } from './database';
import type { SearchResult } from './types';
import type { VectorStore } from './vectorStore';
import type { EmbeddingEngine } from './embeddingEngine';
import type { LlmMessage } from '../llm/types';
import { createLlmProvider } from '../llm/providerFactory';
import { hybridSearch } from './hybridSearch';

// ── RAG config helpers ──

function getRagConfig(): {
  topK: number;
  charsPerDoc: number;
  ftsSnippetTokens: number;
  historyTurns: number;
} {
  const cfg = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
  return {
    topK: cfg.get<number>('knowledgeGraph.rag.topK', 8),
    charsPerDoc: cfg.get<number>('knowledgeGraph.rag.charsPerDoc', 2500),
    ftsSnippetTokens: cfg.get<number>('knowledgeGraph.rag.ftsSnippetTokens', 40),
    historyTurns: cfg.get<number>('knowledgeGraph.rag.historyTurns', 4),
  };
}

// ── Types ──

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Source documents shown with the assistant reply */
  sources?: SourceDoc[];
  /** True while streaming is active */
  streaming?: boolean;
}

export interface SourceDoc {
  path: string;
  title: string;
  snippet: string;
}

export interface ParsedQuery {
  /** The cleaned search text (prefix filters removed) */
  searchText: string;
  /** Tag filter extracted from "tag:xyz" */
  tags: string[];
  /** Property filters extracted from "property:key=value" */
  properties: Array<{ key: string; value: string }>;
  /** Path prefix filter extracted from "in:path" */
  pathPrefix: string | null;
}

// ── Query parsing ──

export function parseQuery(raw: string): ParsedQuery {
  const tags: string[] = [];
  const properties: Array<{ key: string; value: string }> = [];
  let pathPrefix: string | null = null;

  // Extract tag:xxx
  const cleaned = raw
    .replace(/\btag:(\S+)/gi, (_, tag) => {
      tags.push(tag.toLowerCase());
      return '';
    })
    // Extract property:key=value
    .replace(/\bproperty:(\S+?)=(\S+)/gi, (_, key, value) => {
      properties.push({ key, value });
      return '';
    })
    // Extract in:path/prefix
    .replace(/\bin:(\S+)/gi, (_, p) => {
      pathPrefix = p;
      return '';
    })
    .trim();

  return { searchText: cleaned, tags, properties, pathPrefix };
}

// ── Context building ──

/**
 * Search the knowledge graph and return matching source documents.
 * Applies prefix filters (tag, property, path) when present.
 */
export function searchContext(
  db: GraphDatabase,
  parsed: ParsedQuery,
  topK = 8,
  ftsSnippetTokens = 40
): SourceDoc[] {
  if (!parsed.searchText) return [];

  let results: SearchResult[] = db.search(parsed.searchText, ftsSnippetTokens);

  // Apply path prefix filter
  if (parsed.pathPrefix) {
    const prefix = parsed.pathPrefix.toLowerCase();
    results = results.filter(r => r.path.toLowerCase().startsWith(prefix));
  }

  return results.slice(0, topK).map(r => ({
    path: r.path,
    title: r.title,
    snippet: r.snippet,
  }));
}

/**
 * For each source doc, try to read the actual file from disk and extract
 * a larger section around the matching content. Falls back to the FTS snippet.
 */
export function enrichWithFileSections(
  sources: SourceDoc[],
  workspacePath: string,
  maxCharsPerDoc = 2500
): string {
  const sections: string[] = [];

  for (const src of sources) {
    const fullPath = path.join(workspacePath, src.path);
    let content: string | null = null;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      // File may have been deleted since indexing — use snippet
    }

    if (content) {
      // Find the section most relevant to the snippet keywords
      const excerpt = extractRelevantSection(content, src.snippet, maxCharsPerDoc);
      sections.push(`### ${src.title} (${src.path})\n${excerpt}`);
    } else {
      sections.push(`### ${src.title} (${src.path})\n${src.snippet}`);
    }
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Extract the most relevant section from file content based on snippet keywords.
 * Tries to find the heading-delimited section that contains the most keyword hits.
 */
function extractRelevantSection(content: string, snippet: string, maxChars: number): string {
  // Split snippet into meaningful keywords (strip FTS highlight markers)
  const cleanSnippet = snippet.replace(/\*\*/g, '').replace(/\.\.\./g, '');
  const keywords = cleanSnippet
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);

  if (!keywords.length) {
    return content.slice(0, maxChars);
  }

  // Split into heading-based sections
  const sections = content.split(/^(?=#{1,4}\s)/m);

  // Score each section by keyword hits
  let bestSection = sections[0] || '';
  let bestScore = 0;

  for (const section of sections) {
    const lower = section.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSection = section;
    }
  }

  // Trim to max chars, trying to end at a line boundary
  if (bestSection.length > maxChars) {
    const cut = bestSection.lastIndexOf('\n', maxChars);
    bestSection = bestSection.slice(0, cut > maxChars / 2 ? cut : maxChars) + '\n...';
  }

  return bestSection.trim();
}

// ── System prompt ──

const SYSTEM_PROMPT = `You are a workspace knowledge assistant for a markdown-based knowledge base.
Answer the user's question using ONLY the document excerpts provided below.
Rules:
- Cite document paths when referencing information, e.g. (src/auth/login.md)
- If the provided excerpts do not contain enough information, say so clearly
- Be thorough and accurate — correctness matters more than brevity
- Use markdown formatting in your response
- When describing how something works, include relevant details from the source documents`;

export function buildMessages(
  query: string,
  documentContext: string,
  history: ChatMessage[],
  historyTurns = 4
): LlmMessage[] {
  const messages: LlmMessage[] = [];

  // System message with document context
  messages.push({
    role: 'system',
    content: `${SYSTEM_PROMPT}\n\n## Workspace Documents\n\n${documentContext}`,
  });

  // Include recent history for multi-turn context (pairs of user+assistant = historyTurns exchanges)
  const recentHistory = history.slice(-(historyTurns * 2));
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  // Current query
  messages.push({ role: 'user', content: query });

  return messages;
}

// ── Streaming orchestrator ──

export interface StreamEvent {
  type: 'sources' | 'chunk' | 'done' | 'error';
  sources?: SourceDoc[];
  text?: string;
  fullText?: string;
  error?: string;
}

/**
 * Main RAG pipeline: hybrid search → enrich → stream LLM answer.
 * Yields events that the chat panel forwards to the webview.
 */
export async function* streamAnswer(
  db: GraphDatabase,
  workspacePath: string,
  query: string,
  history: ChatMessage[],
  abortSignal?: AbortSignal,
  vectorStore?: VectorStore | null,
  embeddingEngine?: EmbeddingEngine | null
): AsyncGenerator<StreamEvent> {
  // 1. Parse query for filters
  const parsed = parseQuery(query);
  const { topK, charsPerDoc, ftsSnippetTokens, historyTurns } = getRagConfig();

  // 2. Hybrid search (FTS + semantic + graph expansion + RRF)
  let sources: SourceDoc[];
  if (vectorStore && embeddingEngine && vectorStore.count > 0) {
    // Full hybrid pipeline
    const hybridResults = await hybridSearch(
      parsed.searchText || query,
      db,
      vectorStore,
      embeddingEngine,
      { topK, ftsSnippetTokens }
    );

    // Apply path prefix filter if present
    let filtered = hybridResults;
    if (parsed.pathPrefix) {
      const prefix = parsed.pathPrefix.toLowerCase();
      filtered = filtered.filter(r => r.path.toLowerCase().startsWith(prefix));
    }

    sources = filtered.map(r => ({
      path: r.path,
      title: r.title,
      snippet: r.snippet,
    }));
  } else {
    // Fallback to FTS-only search
    sources = searchContext(db, parsed, topK, ftsSnippetTokens);
  }

  // Yield sources immediately so the UI can show them before LLM responds
  yield { type: 'sources', sources };

  if (sources.length === 0) {
    yield {
      type: 'done',
      fullText:
        'No matching documents found in the workspace index. Try different search terms, or ensure the Knowledge Graph index is built.',
    };
    return;
  }

  // 3. Read full file sections for rich context
  const documentContext = enrichWithFileSections(sources, workspacePath, charsPerDoc);

  // 4. Build LLM messages
  const messages = buildMessages(query, documentContext, history, historyTurns);

  // 5. Stream response from LLM
  const provider = createLlmProvider();
  let fullText = '';

  try {
    for await (const chunk of provider.generate(messages, abortSignal)) {
      if (abortSignal?.aborted) break;
      fullText += chunk;
      yield { type: 'chunk', text: chunk, fullText };
    }
    yield { type: 'done', fullText };
  } catch (err: unknown) {
    if (abortSignal?.aborted) {
      yield { type: 'done', fullText };
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    yield { type: 'error', error: message };
  }
}
