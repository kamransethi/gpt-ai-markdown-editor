/**
 * Unit tests for hostBridge.ts — bridge factory and adapter behaviour.
 *
 * These tests use jsdom (via jest testEnvironment override below) to simulate
 * a browser environment including localStorage and window.
 *
 * @jest-environment jsdom
 */

// Re-import the module fresh before each test by resetting modules.
// This is needed because _activeBridge is module-level state.
beforeEach(() => {
  jest.resetModules();
  // Ensure no stale window.vscode shim or acquireVsCodeApi between tests
  delete (window as any).vscode;
  delete (window as any).acquireVsCodeApi;
  localStorage.clear();
});

describe('setBridge / getActiveBridge', () => {
  it('returns the bridge registered via setBridge()', async () => {
    const { setBridge, getActiveBridge } = await import('./hostBridge');

    const mockBridge = {
      postMessage: jest.fn(),
      onMessage: jest.fn(),
      requestInitialContent: jest.fn().mockResolvedValue('mock content'),
    };

    setBridge(mockBridge);
    expect(getActiveBridge()).toBe(mockBridge);
  });

  it('falls back to createVsCodeBridge() when acquireVsCodeApi exists', async () => {
    // Provide a fake VS Code API before importing the module
    const fakeVscode = {
      postMessage: jest.fn(),
      getState: jest.fn().mockReturnValue({}),
      setState: jest.fn(),
    };
    (window as any).acquireVsCodeApi = jest.fn().mockReturnValue(fakeVscode);

    const { getActiveBridge } = await import('./hostBridge');
    const bridge = getActiveBridge();

    expect(bridge).toBeDefined();
    expect((window as any).vscode).toBe(fakeVscode);
  });

  it('falls back to no-op bridge when acquireVsCodeApi is absent', async () => {
    // acquireVsCodeApi is already deleted in beforeEach
    const { getActiveBridge } = await import('./hostBridge');
    const bridge = getActiveBridge();

    // Should not throw
    expect(() => bridge.postMessage({ type: 'test' })).not.toThrow();
  });
});

describe('createNoOpBridge', () => {
  it('postMessage does not throw', async () => {
    const { createNoOpBridge } = await import('./hostBridge');
    const bridge = createNoOpBridge();
    expect(() => bridge.postMessage({ type: 'anyEvent' })).not.toThrow();
  });

  it('requestInitialContent resolves to empty string', async () => {
    const { createNoOpBridge } = await import('./hostBridge');
    const bridge = createNoOpBridge();
    await expect(bridge.requestInitialContent()).resolves.toBe('');
  });
});

describe('createWebMockAdapter', () => {
  it('returns STANDALONE_MOCK_CONTENT when localStorage is empty', async () => {
    const { createWebMockAdapter } = await import('./hostBridge');
    const bridge = createWebMockAdapter();
    const content = await bridge.requestInitialContent();
    expect(content).toContain('Welcome to Standalone Mode');
  });

  it('returns saved content from localStorage when present', async () => {
    localStorage.setItem('gptai-standalone-content', '# My Saved Note');

    const { createWebMockAdapter } = await import('./hostBridge');
    const bridge = createWebMockAdapter();
    const content = await bridge.requestInitialContent();
    expect(content).toBe('# My Saved Note');
  });

  it('saves content to localStorage when postMessage type is saveAndEdit', async () => {
    const { createWebMockAdapter } = await import('./hostBridge');
    const bridge = createWebMockAdapter();

    bridge.postMessage({ type: 'saveAndEdit', content: '# Updated content' });

    expect(localStorage.getItem('gptai-standalone-content')).toBe('# Updated content');
  });

  it('saves content to localStorage when postMessage type is edit', async () => {
    const { createWebMockAdapter } = await import('./hostBridge');
    const bridge = createWebMockAdapter();

    bridge.postMessage({ type: 'edit', content: '# Edited content' });

    expect(localStorage.getItem('gptai-standalone-content')).toBe('# Edited content');
  });

  it('does not write to localStorage for unrecognised message types', async () => {
    const { createWebMockAdapter } = await import('./hostBridge');
    const bridge = createWebMockAdapter();

    bridge.postMessage({ type: 'someOtherType', content: 'should not save' });

    expect(localStorage.getItem('gptai-standalone-content')).toBeNull();
  });

  it('sets window.vscode shim on creation', async () => {
    const { createWebMockAdapter } = await import('./hostBridge');
    createWebMockAdapter();
    expect((window as any).vscode).toBeDefined();
    expect(typeof (window as any).vscode.postMessage).toBe('function');
  });
});
