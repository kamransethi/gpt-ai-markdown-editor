import { OllamaProvider } from '../../features/llm/ollamaProvider';
import { FluxFlowWatcher } from '../../features/fluxflow/watcher';
import type { LlmMessage } from '../../features/llm/types';
import * as vscode from 'vscode';

describe('Search and LLM Integration Tests', () => {
  describe('OllamaProvider Search Integration', () => {
    let originalFetch: typeof global.fetch;

    beforeAll(() => {
      originalFetch = global.fetch;
    });

    afterAll(() => {
      global.fetch = originalFetch;
    });

    it('streams responses correctly from mocked Ollama endpoint', async () => {
      const provider = new OllamaProvider('http://localhost:11434', 'test-model');

      // Mock the fetch response with a ReadableStream
      global.fetch = jest.fn().mockImplementation(() => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ message: { content: 'Mocked ' }, done: false }) + '\n'
              )
            );
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ message: { content: 'response' }, done: true }) + '\n'
              )
            );
            controller.close();
          },
        });

        return Promise.resolve(new Response(stream, { status: 200 }));
      });

      const messages: LlmMessage[] = [{ role: 'user', content: 'hello' }];
      const chunks: string[] = [];

      for await (const chunk of provider.generate(messages)) {
        chunks.push(chunk);
      }

      expect(chunks.join('')).toBe('Mocked response');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"model":"test-model"'),
        })
      );
    });

    it('handles 404 model not found errors gracefully', async () => {
      const provider = new OllamaProvider('http://localhost:11434', 'missing-model');

      global.fetch = jest.fn().mockImplementation(() => {
        const resp = new Response('model not found', { status: 404 });
        // The ollamaProvider calls response.text() which is fine, Response handles it natively
        return Promise.resolve(resp);
      });

      const messages: LlmMessage[] = [{ role: 'user', content: 'hello' }];

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of provider.generate(messages)) {
          // stream
        }
      }).rejects.toThrow(/missing-model.*is not available/);
    });
  });

  describe('FluxFlowWatcher Configuration Tests', () => {
    it('sets up watchers for all provided file patterns', () => {
      vscode.workspace.createFileSystemWatcher = jest.fn();
      const createFileSystemWatcherMock = vscode.workspace.createFileSystemWatcher as jest.Mock;

      const mockDisposable = { dispose: jest.fn() };
      const watcherObj = {
        onDidChange: jest.fn().mockReturnValue(mockDisposable),
        onDidCreate: jest.fn().mockReturnValue(mockDisposable),
        onDidDelete: jest.fn().mockReturnValue(mockDisposable),
        dispose: jest.fn(),
      };
      createFileSystemWatcherMock.mockReturnValue(watcherObj as any);

      const patterns = ['**/*.md', '**/*.csv'];
      const watcher = new FluxFlowWatcher(patterns, jest.fn(), jest.fn());

      watcher.start();

      expect(createFileSystemWatcherMock).toHaveBeenCalledTimes(2);
      expect(createFileSystemWatcherMock).toHaveBeenCalledWith('**/*.md');
      expect(createFileSystemWatcherMock).toHaveBeenCalledWith('**/*.csv');

      watcher.dispose();
      createFileSystemWatcherMock.mockRestore();
    });
  });
});
