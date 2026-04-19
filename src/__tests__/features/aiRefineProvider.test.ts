/**
 * Tests for AI Refine and AI Explain integration with the provider abstraction.
 *
 * Verifies that both features correctly route through createLlmProvider()
 * and handle results/errors from both provider types.
 */

import { handleAiRefineRequest } from '../../features/aiRefine';
import { handleAiExplainRequest } from '../../features/aiExplain';
import * as providerFactory from '../../features/llm/providerFactory';

// Mock the provider factory
jest.mock('../../features/llm/providerFactory');

// Mock provider availability — assume Copilot is available so tests reach the provider
jest.mock('../../features/llm/providerAvailability', () => ({
  getProviderAvailabilityCached: jest.fn().mockResolvedValue({
    copilotAvailable: true,
    ollamaAvailable: true,
    environment: 'vscode',
  }),
}));

const mockProviderFactory = jest.mocked(providerFactory);

const mockWebview = {
  postMessage: jest.fn(),
};

describe('aiRefine with provider abstraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends refined text back to webview on success', async () => {
    const { createLlmProvider } = mockProviderFactory;

    async function* mockGenerate() {
      yield 'Refined ';
      yield 'text here';
    }

    createLlmProvider.mockReturnValue({
      generate: mockGenerate,
    });

    await handleAiRefineRequest(mockWebview as any, {
      mode: 'rephrase',
      selectedText: 'Original text',
      from: 0,
      to: 13,
    });

    expect(mockWebview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'aiRefineResult',
        success: true,
        refinedText: 'Refined text here',
        from: 0,
        to: 13,
      })
    );
  });

  it('strips markdown code fences from response', async () => {
    const { createLlmProvider } = mockProviderFactory;

    async function* mockGenerate() {
      yield '```markdown\nClean text\n```';
    }

    createLlmProvider.mockReturnValue({
      generate: mockGenerate,
    });

    await handleAiRefineRequest(mockWebview as any, {
      mode: 'rephrase',
      selectedText: 'Original',
      from: 0,
      to: 8,
    });

    expect(mockWebview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        refinedText: 'Clean text',
      })
    );
  });

  it('sends error back to webview on provider failure', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createLlmProvider } = require('../../features/llm/providerFactory');

    async function* mockGenerate() {
      throw new Error('Ollama is not reachable at http://localhost:11434');
      yield ''; // unreachable, satisfies generator type
    }

    createLlmProvider.mockReturnValue({
      generate: mockGenerate,
    });

    await handleAiRefineRequest(mockWebview as any, {
      mode: 'shorten',
      selectedText: 'Long text',
      from: 0,
      to: 9,
    });

    expect(mockWebview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'aiRefineResult',
        success: false,
        error: 'Ollama is not reachable at http://localhost:11434',
      })
    );
  });

  it('handles custom mode prompts', async () => {
    const { createLlmProvider } = mockProviderFactory;

    let capturedMessages: any[] = [];
    async function* mockGenerate(messages: any[]) {
      capturedMessages = messages;
      yield 'Custom result';
    }

    createLlmProvider.mockReturnValue({
      generate: mockGenerate,
    });

    await handleAiRefineRequest(mockWebview as any, {
      mode: 'custom:Make it funny',
      selectedText: 'Boring text',
      from: 0,
      to: 11,
    });

    expect(capturedMessages[0].content).toContain('Make it funny');
    expect(capturedMessages[0].content).toContain('Boring text');
    expect(mockWebview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, refinedText: 'Custom result' })
    );
  });
});

describe('aiExplain with provider abstraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends explanation back to webview on success', async () => {
    const { createLlmProvider } = mockProviderFactory;

    async function* mockGenerate() {
      yield '# Summary\n';
      yield 'This is a summary.';
    }

    createLlmProvider.mockReturnValue({
      generate: mockGenerate,
    });

    await handleAiExplainRequest(mockWebview as any, {
      documentText: 'Some document about TypeScript.',
    });

    expect(mockWebview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'aiExplainResult',
        success: true,
        explanation: '# Summary\nThis is a summary.',
      })
    );
  });

  it('sends error back to webview on provider failure for explain', async () => {
    const { createLlmProvider } = mockProviderFactory;

    async function* mockGenerate() {
      throw new Error('Ollama model "bad:model" is not available');
      yield ''; // unreachable, satisfies generator type
    }

    createLlmProvider.mockReturnValue({
      generate: mockGenerate,
    });

    await handleAiExplainRequest(mockWebview as any, {
      documentText: 'Document text',
    });

    expect(mockWebview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'aiExplainResult',
        success: false,
        error: expect.stringContaining('Ollama model "bad:model" is not available'),
      })
    );
  });

  it('truncates documents over 15000 characters', async () => {
    const { createLlmProvider } = mockProviderFactory;

    let capturedMessages: any[] = [];
    async function* mockGenerate(messages: any[]) {
      capturedMessages = messages;
      yield 'Summary of long doc';
    }

    createLlmProvider.mockReturnValue({
      generate: mockGenerate,
    });

    const longText = 'A'.repeat(20000);
    await handleAiExplainRequest(mockWebview as any, {
      documentText: longText,
    });

    // The user message should contain truncated text
    const userMessage = capturedMessages.find((m: any) => m.role === 'user');
    expect(userMessage.content).toContain('[Document truncated for analysis]');
    expect(userMessage.content.length).toBeLessThan(20000);
  });

  it('passes system and user messages to provider', async () => {
    const { createLlmProvider } = mockProviderFactory;

    let capturedMessages: any[] = [];
    async function* mockGenerate(messages: any[]) {
      capturedMessages = messages;
      yield 'Result';
    }

    createLlmProvider.mockReturnValue({
      generate: mockGenerate,
    });

    await handleAiExplainRequest(mockWebview as any, {
      documentText: 'Short doc',
    });

    expect(capturedMessages).toHaveLength(2);
    expect(capturedMessages[0].role).toBe('system');
    expect(capturedMessages[1].role).toBe('user');
    expect(capturedMessages[1].content).toContain('Short doc');
  });
});
