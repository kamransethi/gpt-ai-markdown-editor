/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/** A document indexed in the graph */
export interface GraphDocument {
  id: number;
  path: string;
  title: string;
  hash: string;
  indexedAt: number;
}

/** Result of parsing a single markdown file */
export interface ParsedDocument {
  title: string;
  links: Array<{ target: string; lineNumber: number; context: string }>;
  tags: Array<{ tag: string; source: 'inline' | 'frontmatter' }>;
  properties: Array<{ key: string; value: string }>;
  bodyText: string;
}

/** A backlink result for display */
export interface BacklinkEntry {
  sourcePath: string;
  sourceTitle: string;
  context: string;
  lineNumber: number;
}

/** A search result */
export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
}

// ── Phase 2: Semantic / Hybrid RAG types ──

/** A chunk produced by hierarchical markdown splitting */
export interface Chunk {
  id: number;
  docId: number;
  /** Heading breadcrumb, e.g. "Architecture > Database > Schema" */
  headerPath: string;
  /** The chunk text content */
  content: string;
  /** Approximate token count */
  tokenCount: number;
}

/** Result from vector similarity search */
export interface VectorSearchResult {
  chunkId: number;
  docId: number;
  score: number;
  headerPath: string;
  content: string;
}

/** Unified result after RRF reranking */
export interface HybridSearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
  /** Where this result came from */
  sources: Array<'fts' | 'vector' | 'graph'>;
}

/** Configuration for the embedding provider */
export interface EmbeddingConfig {
  /** Ollama base URL (default: http://localhost:11434) */
  ollamaUrl: string;
  /** Embedding model name (default: nomic-embed-text) */
  model: string;
  /** Vector dimensions (determined by model) */
  dimensions: number;
}
