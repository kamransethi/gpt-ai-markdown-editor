/**
 * Ollama Embedding Engine
 *
 * Calls Ollama's /api/embed endpoint for vector embeddings.
 * Uses the same Ollama instance configured for the LLM provider.
 * Model files are managed by Ollama — no downloads in the extension.
 */

import * as vscode from 'vscode';

export interface EmbeddingEngine {
  /** Check if Ollama is available and the embedding model is pulled */
  isAvailable(): Promise<boolean>;
  /** Granular status: is server up? Is model installed? */
  checkStatus(): Promise<{ serverUp: boolean; modelInstalled: boolean }>;
  /** Embed a single text string */
  embed(text: string): Promise<number[]>;
  /** Embed multiple texts in batches */
  embedBatch(texts: string[]): Promise<number[][]>;
  /** Get the model's vector dimensions (determined on first call) */
  getDimensions(): number;
  /** Get the configured model name */
  getModel(): string;
}

function getOllamaConfig(): { url: string; model: string } {
  const workspaceCfg = vscode.workspace.getConfiguration('gptAiMarkdownEditor');

  const url = workspaceCfg.get<string>('ollamaEndpoint', 'http://localhost:11434');

  // Support both dotted key and legacy keys
  const model =
    workspaceCfg.get<string>('knowledgeGraph.embeddingModel', 'nomic-embed-text') ||
    workspaceCfg.get<string>('ollamaModel', 'nomic-embed-text');

  return { url, model };
}

export function createEmbeddingEngine(): EmbeddingEngine {
  let cachedDimensions = 0;

  async function checkStatus(): Promise<{
    serverUp: boolean;
    modelInstalled: boolean;
    error?: string;
  }> {
    const { url, model } = getOllamaConfig();
    const output = (() => {
      try {
        return vscode.window.createOutputChannel('FluxFlow Debug');
      } catch {
        return null;
      }
    })();

    try {
      const healthRes = await fetch(`${url}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (!healthRes.ok) {
        const body = await healthRes.text().catch(() => '');
        const err = `Ollama /api/tags returned ${healthRes.status}: ${body}`;
        output?.appendLine(err);
        console.error('[EmbeddingEngine]', err);
        return { serverUp: false, modelInstalled: false, error: err };
      }

      const data = (await healthRes.json()) as { models?: Array<{ name: string }> };
      const models = data.models ?? [];
      // Normalize: lowercase, strip :tag, trim
      const normalize = (s: string) => s.toLowerCase().replace(/:.*$/, '').trim();
      const selectedNorm = normalize(model);
      const availableNorms = models.map(m => normalize(m.name));
      const modelInstalled = availableNorms.includes(selectedNorm);

      const logMsg = [
        `[EmbeddingEngine] Checking model: ${model} | Normalized: ${selectedNorm}`,
        `[EmbeddingEngine] Available models: ${models.map(m => m.name).join(', ')}`,
        `[EmbeddingEngine] Normalized available: ${availableNorms.join(', ')}`,
        `[EmbeddingEngine] Model installed: ${modelInstalled}`,
      ].join('\n');
      output?.appendLine(logMsg);
      console.log(logMsg);

      return {
        serverUp: true,
        modelInstalled,
        error: modelInstalled ? undefined : `Model "${model}" not found in Ollama tags`,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const out = `[EmbeddingEngine] Failed to reach Ollama at ${url}: ${errMsg}`;
      output?.appendLine(out);
      console.error(out);
      return { serverUp: false, modelInstalled: false, error: out };
    }
  }

  async function isAvailable(): Promise<boolean> {
    const { serverUp, modelInstalled } = await checkStatus();
    return serverUp && modelInstalled;
  }

  function cleanForEmbedding(text: string): string {
    return text
      .replace(/<br\s*\/?>/gi, ' ') // Remove HTML line breaks
      .replace(/<mark>|<\/mark>/gi, '') // Remove highlights
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove Images (no semantic value)
      .replace(/<img.*?>/gi, '') // Remove HTML images
      .replace(
        /```mermaid[\s\S]*?```/g,
        (
          m // Simplify Mermaid
        ) => m.replace(/graph TD|sequenceDiagram/g, 'Diagram showing:')
      );
  }

  async function callEmbed(text: string): Promise<number[]> {
    const { url, model } = getOllamaConfig();
    const cleanedText = cleanForEmbedding(text);
    const safeInput = cleanedText.slice(0, 1200);

    if (safeInput.trim() === '') {
      return [];
    }

    const payload = { model, input: safeInput };
    const payloadStr = JSON.stringify(payload);

    let res: Response;
    try {
      res = await fetch(`${url}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      try {
        const out = vscode.window.createOutputChannel('FluxFlow Debug');
        out.appendLine(`[EmbeddingEngine] Embedding request error: ${errMsg}`);
        out.appendLine(`[EmbeddingEngine] Request payload: ${payloadStr}`);
        out.show(true);
      } catch {}
      throw new Error(`Embedding request failed: ${errMsg}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const errText = `Embedding request failed (${res.status}): ${body}`;
      // Log to Output channel for visibility, include request payload
      try {
        const out = vscode.window.createOutputChannel('FluxFlow Debug');
        out.appendLine(`[EmbeddingEngine] ${errText}`);
        out.appendLine(`[EmbeddingEngine] Offender pure string length: ${text.length}`);
        out.appendLine(`[EmbeddingEngine] Offender cleaned string length: ${cleanedText.length}`);
        out.appendLine(`[EmbeddingEngine] Request payload: ${payloadStr}`);
        out.show(true);
      } catch {}

      if (res.status === 404 || body.toLowerCase().includes('not found')) {
        throw new Error(
          `Embedding model "${model}" not found on server. ${errText}\nRequest: ${payloadStr}`
        );
      }
      throw new Error(`${errText}\nRequest: ${payloadStr}`);
    }

    const data = (await res.json()) as { embeddings?: number[][]; embedding?: number[] };
    let vector: number[];
    if (data.embeddings && data.embeddings.length > 0) {
      vector = data.embeddings[0];
    } else if (data.embedding && data.embedding.length > 0) {
      vector = data.embedding;
    } else {
      try {
        const out = vscode.window.createOutputChannel('FluxFlow Debug');
        out.appendLine('[EmbeddingEngine] Server returned empty embeddings');
        out.appendLine(`[EmbeddingEngine] Request payload: ${payloadStr}`);
        out.show(true);
      } catch {}
      throw new Error('Server returned empty embeddings');
    }

    // Cache dimensions from first response
    if (cachedDimensions === 0) {
      cachedDimensions = vector.length;
    }

    return vector;
  }

  async function embed(text: string): Promise<number[]> {
    return callEmbed(text);
  }

  async function embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Process sequentially ("Serial Embedding")
    const results: number[][] = [];
    for (const text of texts) {
      if (!text.trim()) {
        results.push([]);
        continue;
      }
      try {
        const vec = await callEmbed(text);
        results.push(vec);
      } catch (err) {
        console.error('[EmbeddingEngine] Batch item failed:', err);
        results.push([]);
      }
    }
    return results;
  }

  function getDimensions(): number {
    return cachedDimensions;
  }

  function getModel(): string {
    return getOllamaConfig().model;
  }

  return { isAvailable, checkStatus, embed, embedBatch, getDimensions, getModel };
}
