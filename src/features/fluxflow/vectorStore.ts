/**
 * Flat Vector Store with Cosine Similarity
 *
 * Stores embeddings as a flat Float32Array for brute-force cosine similarity.
 * Efficient for <5K chunks (typical workspace). Zero external dependencies.
 * Persists to ~/.fluxflow/workspaces/{hash}/vectors.bin
 *
 * Binary format:
 *   [4 bytes: dimensions (uint32)]
 *   [4 bytes: count (uint32)]
 *   Repeated count times:
 *     [4 bytes: chunkId (int32)]
 *     [4 bytes: docId (int32)]
 *     [dimensions * 4 bytes: vector (float32)]
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDataDir, getWorkspaceHash } from './database';
import type { VectorSearchResult } from './types';

export interface VectorEntry {
  chunkId: number;
  docId: number;
  vector: Float32Array;
}

export class VectorStore {
  private entries: VectorEntry[] = [];
  private dimensions: number = 0;
  private storePath: string = '';
  private dirty: boolean = false;

  /** Initialize the store for a workspace. Loads persisted vectors if present. */
  open(workspacePath: string, dimensions: number): void {
    const dataDir = getDataDir();
    const hash = getWorkspaceHash(workspacePath);
    this.storePath = path.join(dataDir, 'workspaces', hash, 'vectors.bin');
    this.dimensions = dimensions;
    this.load();
  }

  /** Add or replace a vector for a chunk. */
  upsert(chunkId: number, docId: number, vector: Float32Array): void {
    const idx = this.entries.findIndex(e => e.chunkId === chunkId);
    if (idx >= 0) {
      this.entries[idx] = { chunkId, docId, vector };
    } else {
      this.entries.push({ chunkId, docId, vector });
    }
    this.dirty = true;
  }

  /** Remove all vectors for a document. */
  removeByDocId(docId: number): void {
    const before = this.entries.length;
    this.entries = this.entries.filter(e => e.docId !== docId);
    if (this.entries.length !== before) {
      this.dirty = true;
    }
  }

  /** Remove a specific chunk's vector. */
  removeByChunkId(chunkId: number): void {
    const before = this.entries.length;
    this.entries = this.entries.filter(e => e.chunkId !== chunkId);
    if (this.entries.length !== before) {
      this.dirty = true;
    }
  }

  /** Search for the top-K most similar vectors to the query. */
  search(queryVector: Float32Array, topK: number): VectorSearchResult[] {
    if (this.entries.length === 0 || this.dimensions === 0) return [];

    // Compute cosine similarity for all entries
    const scored: Array<{ entry: VectorEntry; score: number }> = [];
    for (const entry of this.entries) {
      const score = cosineSimilarity(queryVector, entry.vector);
      scored.push({ entry, score });
    }

    // Sort descending by score and return top K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(s => ({
      chunkId: s.entry.chunkId,
      docId: s.entry.docId,
      score: s.score,
      headerPath: '', // Caller fills from DB
      content: '', // Caller fills from DB
    }));
  }

  /** Number of stored vectors. */
  get count(): number {
    return this.entries.length;
  }

  /** Check if any vectors exist for a given chunk. */
  hasChunk(chunkId: number): boolean {
    return this.entries.some(e => e.chunkId === chunkId);
  }

  /** Get all chunk IDs that have vectors. */
  getEmbeddedChunkIds(): Set<number> {
    return new Set(this.entries.map(e => e.chunkId));
  }

  /** Persist to disk. */
  save(): void {
    if (!this.dirty || !this.storePath) return;
    const count = this.entries.length;
    // Header: 8 bytes (dims + count) + per-entry: 8 + dims*4
    const entryBytes = 8 + this.dimensions * 4;
    const buffer = Buffer.alloc(8 + count * entryBytes);

    buffer.writeUInt32LE(this.dimensions, 0);
    buffer.writeUInt32LE(count, 4);

    let offset = 8;
    for (const entry of this.entries) {
      buffer.writeInt32LE(entry.chunkId, offset);
      buffer.writeInt32LE(entry.docId, offset + 4);
      offset += 8;
      for (let i = 0; i < this.dimensions; i++) {
        buffer.writeFloatLE(entry.vector[i], offset);
        offset += 4;
      }
    }

    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, buffer);
    this.dirty = false;
  }

  /** Clear all vectors and delete the persisted file. */
  clear(): void {
    this.entries = [];
    this.dirty = false;
    try {
      if (this.storePath && fs.existsSync(this.storePath)) {
        fs.unlinkSync(this.storePath);
      }
    } catch {
      /* ignore */
    }
  }

  private load(): void {
    if (!this.storePath || !fs.existsSync(this.storePath)) return;

    try {
      const buffer = fs.readFileSync(this.storePath);
      if (buffer.length < 8) return;

      const fileDims = buffer.readUInt32LE(0);
      const count = buffer.readUInt32LE(4);

      // If dimensions changed (different model), discard old vectors
      if (fileDims !== this.dimensions) {
        console.log(
          `[FluxFlow] Vector dimensions changed (${fileDims}→${this.dimensions}), clearing vector store`
        );
        return;
      }

      const entryBytes = 8 + fileDims * 4;
      if (buffer.length < 8 + count * entryBytes) return;

      let offset = 8;
      for (let i = 0; i < count; i++) {
        const chunkId = buffer.readInt32LE(offset);
        const docId = buffer.readInt32LE(offset + 4);
        offset += 8;
        const vector = new Float32Array(fileDims);
        for (let j = 0; j < fileDims; j++) {
          vector[j] = buffer.readFloatLE(offset);
          offset += 4;
        }
        this.entries.push({ chunkId, docId, vector });
      }
    } catch (err) {
      console.error('[FluxFlow] Failed to load vector store:', err);
      this.entries = [];
    }
  }
}

/** Cosine similarity between two vectors. */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
