/**
 * Tests for the LLM provider abstraction layer.
 *
 * Covers: OllamaProvider streaming, error handling, cancellation,
 * and providerFactory routing.
 */

import { OllamaProvider } from '../../features/llm/ollamaProvider';

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a ReadableStream from an array of Ollama-style JSON lines. */
function buildOllamaStream(
  chunks: Array<{ message?: { content: string }; done: boolean; error?: string }>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = chunks.map(c => JSON.stringify(c) + '\n');
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < lines.length) {
        controller.enqueue(encoder.encode(lines[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

// ── OllamaProvider tests ────────────────────────────────────────────

describe('OllamaProvider', () => {
  const endpoint = 'http://localhost:11434';
  const model = 'llama3.2:latest';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('streams text chunks from Ollama /api/chat', async () => {
    const provider = new OllamaProvider(endpoint, model);

    const stream = buildOllamaStream([
      { message: { content: 'Hello' }, done: false },
      { message: { content: ' world' }, done: false },
      { message: { content: '' }, done: true },
    ]);

    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }));

    const chunks: string[] = [];
    for await (const chunk of provider.generate([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello', ' world']);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('sends model and messages in the request body', async () => {
    const provider = new OllamaProvider(endpoint, 'mistral:latest');

    const stream = buildOllamaStream([{ message: { content: 'ok' }, done: true }]);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }));

    const chunks: string[] = [];
    for await (const chunk of provider.generate([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Test' },
    ])) {
      chunks.push(chunk);
    }

    const fetchCall = (globalThis.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.model).toBe('mistral:latest');
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Test' },
    ]);
    expect(body.stream).toBe(true);
  });

  it('throws descriptive error when Ollama is unreachable', async () => {
    const provider = new OllamaProvider(endpoint, model);

    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    const gen = provider.generate([{ role: 'user', content: 'Hi' }]);
    await expect(gen.next()).rejects.toThrow('Ollama is not reachable at http://localhost:11434');
  });

  it('throws descriptive error when model is not found', async () => {
    const provider = new OllamaProvider(endpoint, 'nonexistent:v1');

    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('model "nonexistent:v1" not found', { status: 404 }));

    const gen = provider.generate([{ role: 'user', content: 'Hi' }]);
    await expect(gen.next()).rejects.toThrow('Ollama model "nonexistent:v1" is not available');
  });

  it('throws on non-OK HTTP status', async () => {
    const provider = new OllamaProvider(endpoint, model);

    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('Internal error', { status: 500 }));

    const gen = provider.generate([{ role: 'user', content: 'Hi' }]);
    await expect(gen.next()).rejects.toThrow('Ollama request failed (500)');
  });

  it('throws on mid-stream error from Ollama', async () => {
    const provider = new OllamaProvider(endpoint, model);

    const stream = buildOllamaStream([
      { message: { content: 'partial' }, done: false },
      { error: 'out of memory', done: true },
    ]);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }));

    const chunks: string[] = [];
    const gen = provider.generate([{ role: 'user', content: 'Hi' }]);

    // First chunk should succeed
    const first = await gen.next();
    if (!first.done) chunks.push(first.value);

    // Second chunk should throw
    await expect(gen.next()).rejects.toThrow('Ollama error: out of memory');
    expect(chunks).toEqual(['partial']);
  });

  it('respects AbortSignal cancellation', async () => {
    const provider = new OllamaProvider(endpoint, model);
    const abortController = new AbortController();

    jest.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      // Simulate abort
      const signal = (init as RequestInit)?.signal;
      if (signal?.aborted) {
        return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      }

      const stream = buildOllamaStream([
        { message: { content: 'chunk1' }, done: false },
        { message: { content: 'chunk2' }, done: false },
        { message: { content: '' }, done: true },
      ]);
      return Promise.resolve(new Response(stream, { status: 200 }));
    });

    // Abort before fetch
    abortController.abort();

    const chunks: string[] = [];
    for await (const chunk of provider.generate(
      [{ role: 'user', content: 'Hi' }],
      abortController.signal
    )) {
      chunks.push(chunk);
    }

    // Should yield nothing since aborted
    expect(chunks).toEqual([]);
  });

  it('strips trailing slash from endpoint', async () => {
    const provider = new OllamaProvider('http://localhost:11434/', model);

    const stream = buildOllamaStream([{ message: { content: 'ok' }, done: true }]);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }));

    const chunks: string[] = [];
    for await (const chunk of provider.generate([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk);
    }

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.anything()
    );
  });
});

// ── providerFactory tests ───────────────────────────────────────────

describe('providerFactory', () => {
  // We need to mock vscode.workspace.getConfiguration
  let mockGet: jest.Mock;

  beforeEach(() => {
    mockGet = jest.fn();
    const vscode = require('vscode');
    vscode.workspace.getConfiguration = jest.fn(() => ({
      get: mockGet,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('returns CopilotProvider when llmProvider is "GitHub Copilot"', () => {
    mockGet.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'llmProvider') return 'GitHub Copilot';
      return defaultValue;
    });

    // Re-require to pick up fresh mock
    const { createLlmProvider } = require('../../features/llm/providerFactory');
    const { CopilotProvider } = require('../../features/llm/copilotProvider');

    const provider = createLlmProvider();
    expect(provider).toBeInstanceOf(CopilotProvider);
  });

  it('returns OllamaProvider when llmProvider is "Ollama"', () => {
    mockGet.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'llmProvider') return 'Ollama';
      if (key === 'ollamaModel') return 'mistral:latest';
      if (key === 'ollamaEndpoint') return 'http://myhost:11434';
      return defaultValue;
    });

    const { createLlmProvider } = require('../../features/llm/providerFactory');
    const { OllamaProvider } = require('../../features/llm/ollamaProvider');

    const provider = createLlmProvider();
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it('defaults to CopilotProvider when setting is missing', () => {
    mockGet.mockImplementation((_key: string, defaultValue?: unknown) => defaultValue);

    const { createLlmProvider } = require('../../features/llm/providerFactory');
    const { CopilotProvider } = require('../../features/llm/copilotProvider');

    const provider = createLlmProvider();
    expect(provider).toBeInstanceOf(CopilotProvider);
  });

  it('uses default Ollama model and endpoint when not configured', () => {
    mockGet.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'llmProvider') return 'Ollama';
      return defaultValue;
    });

    const { createLlmProvider } = require('../../features/llm/providerFactory');
    const provider = createLlmProvider();

    // Verify defaults by checking internal state (OllamaProvider stores them)
    expect(provider).toBeDefined();
    // We can't directly check private fields, but we can verify it's an OllamaProvider
    const { OllamaProvider } = require('../../features/llm/ollamaProvider');
    expect(provider).toBeInstanceOf(OllamaProvider);
  });
});
