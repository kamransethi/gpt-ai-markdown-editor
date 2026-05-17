/**
 * Tests for the Image AI Ask feature.
 *
 * Covers: imageAsk handler, vision capability detection, provider vision methods,
 * Ollama image payload, menu rendering, and panel result handling.
 */

import { OllamaProvider } from '../../features/llm/ollamaProvider';

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a ReadableStream from Ollama-style JSON lines. */
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

// ── OllamaProvider.generateWithVision ───────────────────────────────

describe('OllamaProvider.generateWithVision', () => {
  const endpoint = 'http://localhost:11434';
  const model = 'llava:latest';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends images in the Ollama request body on the last user message', async () => {
    const provider = new OllamaProvider(endpoint, model);

    const stream = buildOllamaStream([
      { message: { content: 'I see a cat' }, done: false },
      { message: { content: '' }, done: true },
    ]);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }));

    const fakeBase64 = 'iVBORw0KGgoAAAANSUhEUg==';
    const chunks: string[] = [];
    for await (const chunk of provider.generateWithVision!(
      [
        { role: 'system', content: 'Describe this image.' },
        { role: 'user', content: 'What is this?' },
      ],
      [fakeBase64]
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['I see a cat']);

    // Verify the fetch body has images on the last user message
    const fetchCall = (globalThis.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.model).toBe('llava:latest');
    expect(body.messages).toHaveLength(2);
    // System message should NOT have images
    expect(body.messages[0].images).toBeUndefined();
    // Last user message should have images
    expect(body.messages[1].images).toEqual([fakeBase64]);
  });

  it('streams multiple chunks with images', async () => {
    const provider = new OllamaProvider(endpoint, model);

    const stream = buildOllamaStream([
      { message: { content: 'This ' }, done: false },
      { message: { content: 'is a ' }, done: false },
      { message: { content: 'diagram.' }, done: false },
      { message: { content: '' }, done: true },
    ]);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }));

    const chunks: string[] = [];
    for await (const chunk of provider.generateWithVision!(
      [{ role: 'user', content: 'Explain' }],
      ['base64data']
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['This ', 'is a ', 'diagram.']);
  });

  it('does not attach images to non-last user messages', async () => {
    const provider = new OllamaProvider(endpoint, model);

    const stream = buildOllamaStream([{ message: { content: 'ok' }, done: true }]);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200 }));

    for await (const _chunk of provider.generateWithVision!(
      [
        { role: 'user', content: 'First question' },
        { role: 'system', content: 'System note' },
        { role: 'user', content: 'Second question' },
      ],
      ['img1']
    )) {
      // consume
    }

    const fetchCall = (globalThis.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    // Only the last message (index 2, user) should have images
    expect(body.messages[0].images).toBeUndefined();
    expect(body.messages[1].images).toBeUndefined();
    expect(body.messages[2].images).toEqual(['img1']);
  });
});

// ── isVisionCapable ─────────────────────────────────────────────────

describe('isVisionCapable', () => {
  let mockGet: jest.Mock;

  beforeEach(() => {
    mockGet = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vscode = require('vscode') as any;
    vscode.workspace.getConfiguration = jest.fn(() => ({
      get: mockGet,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('returns true for GitHub Copilot provider', () => {
    mockGet.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'llmProvider') return 'GitHub Copilot';
      return defaultValue;
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isVisionCapable } = require('../../features/llm/providerFactory');
    expect(isVisionCapable()).toBe(true);
  });

  it('returns true for Ollama provider (trusts user model choice)', () => {
    mockGet.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'llmProvider') return 'Ollama';
      if (key === 'ollamaImageModel') return 'llava:13b';
      return defaultValue;
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isVisionCapable } = require('../../features/llm/providerFactory');
    expect(isVisionCapable()).toBe(true);
  });

  it('returns true for any Ollama model (user responsibility)', () => {
    mockGet.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'llmProvider') return 'Ollama';
      if (key === 'ollamaImageModel') return 'llama3.2:latest';
      return defaultValue;
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isVisionCapable } = require('../../features/llm/providerFactory');
    expect(isVisionCapable()).toBe(true);
  });

  it('returns true for gemma4 vision model', () => {
    mockGet.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'llmProvider') return 'Ollama';
      if (key === 'ollamaImageModel') return 'gemma4:e4b';
      return defaultValue;
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isVisionCapable } = require('../../features/llm/providerFactory');
    expect(isVisionCapable()).toBe(true);
  });
});

// ── Image menu rendering tests are in webview/imageAskMenu.test.ts ──
// (requires jsdom environment);

// ── MessageType constants ───────────────────────────────────────────

describe('MessageType image ask constants', () => {
  it('exports IMAGE_ASK and IMAGE_ASK_RESULT', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MessageType } = require('../../shared/messageTypes');
    expect(MessageType.IMAGE_ASK).toBe('imageAsk');
    expect(MessageType.IMAGE_ASK_RESULT).toBe('imageAskResult');
  });
});
