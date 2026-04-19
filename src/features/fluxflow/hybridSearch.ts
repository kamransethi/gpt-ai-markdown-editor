/**
 * Hybrid Search with Reciprocal Rank Fusion (RRF)
 *
 * 4-Stage Retrieval Pipeline:
 *   Stage 1: Parallel lexical (FTS4) + semantic (vector) search
 *   Stage 2: Graph expansion — top results → query links table → inject neighbor docs
 *   Stage 3: RRF reranking: score(d) = Σ 1/(k + rank(d)), k=60
 *   Stage 4: Context assembly with wiki-link references
 */

import type { GraphDatabase } from './database';
import type { VectorStore } from './vectorStore';
import type { EmbeddingEngine } from './embeddingEngine';
import type { HybridSearchResult, VectorSearchResult } from './types';

const RRF_K = 60;

export interface HybridSearchOptions {
  topK?: number;
  ftsSnippetTokens?: number;
  graphExpansionDepth?: number;
}

interface RankedDoc {
  path: string;
  title: string;
  docId: number;
  snippet: string;
  score: number;
  sources: Set<'fts' | 'vector' | 'graph'>;
}

/**
 * Execute the 4-stage hybrid search pipeline.
 * Falls back gracefully: if embeddings aren't available, uses FTS only.
 */
export async function hybridSearch(
  query: string,
  db: GraphDatabase,
  vectorStore: VectorStore | null,
  embeddingEngine: EmbeddingEngine | null,
  options: HybridSearchOptions = {}
): Promise<HybridSearchResult[]> {
  const { topK = 8, ftsSnippetTokens = 40, graphExpansionDepth = 3 } = options;

  // ── Stage 1: Parallel lexical + semantic search ──
  const [ftsResults, vectorResults] = await Promise.all([
    Promise.resolve(ftsSearch(db, query, topK * 2, ftsSnippetTokens)),
    semanticSearch(query, vectorStore, embeddingEngine, db, topK * 2),
  ]);

  // Build unified document map
  const docMap = new Map<string, RankedDoc>();

  // Add FTS results with rank scores
  for (let rank = 0; rank < ftsResults.length; rank++) {
    const r = ftsResults[rank];
    const doc = docMap.get(r.path) ?? createRankedDoc(r.path, r.title, r.docId, r.snippet);
    doc.score += 1 / (RRF_K + rank + 1);
    doc.sources.add('fts');
    if (!doc.snippet && r.snippet) doc.snippet = r.snippet;
    docMap.set(r.path, doc);
  }

  // Add vector results with rank scores
  for (let rank = 0; rank < vectorResults.length; rank++) {
    const r = vectorResults[rank];
    const existing = docMap.get(r.path);
    const doc = existing ?? createRankedDoc(r.path, r.title, r.docId, r.snippet);
    doc.score += 1 / (RRF_K + rank + 1);
    doc.sources.add('vector');
    if (!doc.snippet && r.snippet) doc.snippet = r.snippet;
    docMap.set(r.path, doc);
  }

  // ── Stage 2: Graph expansion ──
  // Take top N results by current score, find their linked documents
  const sorted = [...docMap.values()].sort((a, b) => b.score - a.score);
  const topDocIds = sorted
    .slice(0, graphExpansionDepth)
    .map(d => d.docId)
    .filter(id => id > 0);

  const expandedDocIds = new Set<number>();
  for (const docId of topDocIds) {
    const linked = db.getLinkedDocIds(docId);
    for (const lid of linked) {
      expandedDocIds.add(lid);
    }
  }

  // Add expanded docs that aren't already in results
  const existingDocIds = new Set([...docMap.values()].map(d => d.docId));
  for (const expandedId of expandedDocIds) {
    if (existingDocIds.has(expandedId)) continue;
    const doc = db.getDocumentById(expandedId);
    if (!doc) continue;
    const ranked = createRankedDoc(doc.path, doc.title, doc.id, '');
    // Graph expansion gets a small boost (equivalent to being ranked ~15th in a list)
    ranked.score += 1 / (RRF_K + 15);
    ranked.sources.add('graph');
    docMap.set(doc.path, ranked);
  }

  // ── Stage 3: RRF reranking (already computed incrementally) ──
  const finalResults = [...docMap.values()].sort((a, b) => b.score - a.score);

  // ── Stage 4: Return top-K ──
  return finalResults.slice(0, topK).map(d => ({
    path: d.path,
    title: d.title,
    snippet: d.snippet,
    score: d.score,
    sources: [...d.sources],
  }));
}

// ── Internal helpers ──

interface FtsResult {
  path: string;
  title: string;
  docId: number;
  snippet: string;
}

function ftsSearch(
  db: GraphDatabase,
  query: string,
  limit: number,
  snippetTokens: number
): FtsResult[] {
  const raw = db.search(query, snippetTokens, limit);
  return raw.map(r => {
    const doc = db.getDocumentByPath(r.path);
    return {
      path: r.path,
      title: r.title,
      docId: doc?.id ?? 0,
      snippet: r.snippet,
    };
  });
}

interface SemanticResult {
  path: string;
  title: string;
  docId: number;
  snippet: string;
}

async function semanticSearch(
  query: string,
  vectorStore: VectorStore | null,
  embeddingEngine: EmbeddingEngine | null,
  db: GraphDatabase,
  topK: number
): Promise<SemanticResult[]> {
  if (!vectorStore || !embeddingEngine || vectorStore.count === 0) return [];

  try {
    const queryVector = new Float32Array(await embeddingEngine.embed(query));
    const results: VectorSearchResult[] = vectorStore.search(queryVector, topK);

    // Enrich results with document info from DB
    const enriched: SemanticResult[] = [];
    for (const r of results) {
      if (r.score < 0.3) continue; // Filter low-quality matches
      const chunk = db.getChunkById(r.chunkId);
      if (!chunk) continue;
      const doc = db.getDocumentById(chunk.docId);
      if (!doc) continue;

      enriched.push({
        path: doc.path,
        title: doc.title,
        docId: doc.id,
        snippet: truncateSnippet(chunk.content, 200),
      });
    }
    return enriched;
  } catch (err) {
    console.error('[FluxFlow] Semantic search failed:', err);
    return [];
  }
}

function createRankedDoc(path: string, title: string, docId: number, snippet: string): RankedDoc {
  return { path, title, docId, snippet, score: 0, sources: new Set() };
}

function truncateSnippet(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.lastIndexOf(' ', maxLen);
  return text.slice(0, cut > maxLen / 2 ? cut : maxLen) + '...';
}
