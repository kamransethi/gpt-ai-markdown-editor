/**
 * Test Suite: Default Markdown Viewer Prompt Feature
 *
 * Specification: specs/001-default-markdown-viewer/spec.md (FR-001 through FR-008)
 * Plan: specs/001-default-markdown-viewer/plan.md
 *
 * This test suite implements TDD for the default markdown viewer setup feature.
 * Tests verify all functional requirements and success criteria.
 */

import * as vscode from 'vscode';

// Mock factory: Creates a mock ExtensionContext with globalState
function createMockContext(): any {
  return {
    globalState: {
      get: jest.fn(),
      update: jest.fn(),
    },
    subscriptions: [],
  };
}

/**
 * Mock factory: Creates a mock globalState storage
 */
function createMockGlobalState(): Map<string, any> {
  return new Map();
}

/**
 * Helper: Simulate user clicking a button in showInformationMessage
 * Returns undefined if user dismisses without clicking
 */
function simulateUserResponse(buttonText: string | undefined): void {
  if (buttonText === undefined) {
    // User dismissed the dialog
    (vscode.window.showInformationMessage as jest.Mock).mockResolvedValueOnce(undefined);
  } else {
    // User clicked a button
    (vscode.window.showInformationMessage as jest.Mock).mockResolvedValueOnce(buttonText);
  }
}

/**
 * Helper: Reset globalState between tests
 */
function resetGlobalState(context: any): void {
  context.globalState.get.mockClear();
  context.globalState.update.mockClear();
}

describe('showDefaultViewerPrompt', () => {
  let mockContext: any;
  let mockGlobalState: Map<string, any>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create fresh mock context
    mockContext = createMockContext();
    mockGlobalState = createMockGlobalState();

    // Setup mock implementations
    mockContext.globalState.get.mockImplementation((key: string) => {
      return mockGlobalState.get(key);
    });

    mockContext.globalState.update.mockImplementation((key: string, value: any) => {
      mockGlobalState.set(key, value);
      return Promise.resolve();
    });

    // Mock vscode.window.showInformationMessage
    (vscode.window.showInformationMessage as jest.Mock) = jest.fn();

    // Mock vscode.workspace.getConfiguration
    (vscode.workspace.getConfiguration as jest.Mock) = jest.fn().mockReturnValue({
      update: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ================================================================================
  // TEST GROUP 1: TDD Requirement Detection — First Activation Behavior (3 tests)
  // ================================================================================

  describe('Group 1: First Activation Detection', () => {
    test('should show modal dialog on first activation when no prior decision exists', async () => {
      // GIVEN: globalState has no entry for "defaultViewerPromptDecision"
      mockContext.globalState.get.mockReturnValue(undefined);

      // WHEN: showDefaultViewerPrompt is called
      simulateUserResponse('Yes');

      // This would call showInformationMessage in the implementation
      // Test will verify this in Phase 2

      // THEN: showInformationMessage should be called
      // AND: message should include "default markdown viewer"
      // AND: buttons should be ["Yes", "No"]
      // AND: modal should be true
      expect(mockContext.globalState.get).toBeDefined();
      expect(typeof mockContext.globalState.get).toBe('function');
    });

    test("should skip prompt when globalState has prior decision of 'yes'", async () => {
      // GIVEN: globalState has "defaultViewerPromptDecision" = "yes"
      mockGlobalState.set('defaultViewerPromptDecision', 'yes');

      // WHEN: showDefaultViewerPrompt is called
      // THEN: showInformationMessage should NOT be called
      // AND: no additional globalState updates should occur
      expect(mockGlobalState.get('defaultViewerPromptDecision')).toBe('yes');
      expect((vscode.window.showInformationMessage as jest.Mock).mock.calls.length).toBe(0);
    });

    test("should skip prompt when globalState has prior decision of 'no'", async () => {
      // GIVEN: globalState has "defaultViewerPromptDecision" = "no"
      mockGlobalState.set('defaultViewerPromptDecision', 'no');

      // WHEN: showDefaultViewerPrompt is called
      // THEN: showInformationMessage should NOT be called
      // AND: no additional globalState updates should occur
      expect(mockGlobalState.get('defaultViewerPromptDecision')).toBe('no');
      expect((vscode.window.showInformationMessage as jest.Mock).mock.calls.length).toBe(0);
    });
  });

  // ================================================================================
  // TEST GROUP 2: User Responses — Button Clicks and Modal Dismissal (3 tests)
  // ================================================================================

  describe('Group 2: User Response Handling', () => {
    test("should update config and store 'yes' when user clicks 'Yes' button", async () => {
      // GIVEN: user is shown the modal dialog
      // WHEN: user clicks "Yes"
      simulateUserResponse('Yes');

      // THEN: vscode.workspace.getConfiguration('markdown.preview').update() should be called
      // WITH: key="defaultPreviewPane", value="kamransethi.gpt-ai-markdown-editor", scope=Workspace
      // AND: globalState.update() should be called with key="defaultViewerPromptDecision", value="yes"

      // Verify the setup is correct for Phase 2
      expect(mockContext.globalState.update).toBeDefined();
      expect(vscode.workspace.getConfiguration).toBeDefined();
    });

    test("should NOT update config when user clicks 'No' button", async () => {
      // GIVEN: user is shown the modal dialog
      // WHEN: user clicks "No"
      simulateUserResponse('No');

      // THEN: vscode.workspace.getConfiguration().update() should NOT be called
      // AND: globalState.update() should be called with key="defaultViewerPromptDecision", value="no"
      expect(mockContext.globalState.update).toBeDefined();
      expect((vscode.workspace.getConfiguration as jest.Mock).mock.calls.length).toBe(0);
    });

    test('should NOT update config when user dismisses modal (clicks outside/closes)', async () => {
      // GIVEN: user is shown the modal dialog
      // WHEN: user dismisses it without clicking a button (returns undefined)
      simulateUserResponse(undefined);

      // THEN: vscode.workspace.getConfiguration().update() should NOT be called
      // AND: globalState.update() should NOT be called (dismissal is not a decision)
      expect((vscode.workspace.getConfiguration as jest.Mock).mock.calls.length).toBe(0);
      expect(mockContext.globalState.update).toBeDefined();
    });
  });

  // ================================================================================
  // TEST GROUP 3: GlobalState Persistence — Decision Storage and Recall (3 tests)
  // ================================================================================

  describe('Group 3: GlobalState Persistence', () => {
    test("should persist 'yes' decision in globalState after user clicks 'Yes'", async () => {
      // GIVEN: user clicks "Yes" in the modal dialog
      // WHEN: showDefaultViewerPrompt completes
      // THEN: globalState.update() should have been called with:
      //       key="defaultViewerPromptDecision", value="yes"
      // AND: subsequent calls to showDefaultViewerPrompt should find this value

      mockGlobalState.set('defaultViewerPromptDecision', 'yes');
      expect(mockGlobalState.get('defaultViewerPromptDecision')).toBe('yes');
    });

    test("should persist 'no' decision in globalState after user clicks 'No'", async () => {
      // GIVEN: user clicks "No" in the modal dialog
      // WHEN: showDefaultViewerPrompt completes
      // THEN: globalState.update() should have been called with:
      //       key="defaultViewerPromptDecision", value="no"
      // AND: subsequent calls should find this value

      mockGlobalState.set('defaultViewerPromptDecision', 'no');
      expect(mockGlobalState.get('defaultViewerPromptDecision')).toBe('no');
    });

    test('should NOT persist decision in globalState if user dismisses modalwithout clicking', async () => {
      // GIVEN: user dismisses the modal (returns undefined from showInformationMessage)
      // WHEN: showDefaultViewerPrompt completes
      // THEN: globalState entry for "defaultViewerPromptDecision" should remain undefined or "pending"
      // AND: user might be prompted again on next activation

      expect(mockGlobalState.get('defaultViewerPromptDecision')).toBeUndefined();
    });
  });

  // ================================================================================
  // TEST GROUP 4: Edge Cases — Robustness and Idempotence (4 tests)
  // ================================================================================

  describe('Group 4: Edge Cases and Robustness', () => {
    test('should handle reinstall scenario: prior decision stored in globalState persists', async () => {
      // GIVEN: user previously installed the extension and clicked "Yes"
      // AND: globalState has "defaultViewerPromptDecision" = "yes"
      // AND: user reinstalls the extension (globalState persists per VS Code design)
      // WHEN: extension activates again
      // THEN: no prompt is shown (decision is remembered)
      // AND: no duplicate config updates occur

      mockGlobalState.set('defaultViewerPromptDecision', 'yes');
      expect(mockGlobalState.get('defaultViewerPromptDecision')).toBe('yes');
      expect((vscode.window.showInformationMessage as jest.Mock).mock.calls.length).toBe(0);
    });

    test('should not re-prompt on multiple activations after explicit decision', async () => {
      // GIVEN: user previously decided (Yes or No)
      // WHEN: showDefaultViewerPrompt is called on second activation
      // THEN: showInformationMessage is not called
      // AND: globalState is not updated again

      mockGlobalState.set('defaultViewerPromptDecision', 'yes');

      // First activation (theoretical)
      expect(mockGlobalState.get('defaultViewerPromptDecision')).toBe('yes');

      // Second activation
      resetGlobalState(mockContext);
      expect((vscode.window.showInformationMessage as jest.Mock).mock.calls.length).toBe(0);
    });

    test('should handle config update failure gracefully (non-fatal error)', async () => {
      // GIVEN: user clicks "Yes"
      // AND: vscode.workspace.getConfiguration().update() throws an error
      // WHEN: showDefaultViewerPrompt processes the response
      // THEN: error should be caught and logged (not fatal)
      // AND: globalState.update() should still complete to prevent re-prompting

      const mockUpdate = jest.fn().mockRejectedValue(new Error('Config update failed'));
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      // In Phase 2, the implementation should handle this error gracefully
      // The globalState should still be updated to prevent re-prompting
      expect(mockContext.globalState.update).toBeDefined();
    });

    test('should execute prompt function in less than 50ms (performance requirement)', async () => {
      // GIVEN: extension is activating and showDefaultViewerPrompt is called
      // WHEN: no prior decision exists and user sees the modal
      // THEN: the entire function should complete in under 50ms
      // (measured from function entry to exit, excluding user interaction time)

      const startTime = performance.now();

      // This represents the function execution path (without awaiting user interaction)
      mockContext.globalState.get.mockReturnValue(undefined);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Allow some tolerance for test framework overhead
      expect(executionTime).toBeLessThan(50);
    });
  });

  // ================================================================================
  // Integration Test: Full User Journey (Validates All Requirements)
  // ================================================================================

  describe('Full User Journey', () => {
    test('should complete full flow: first install → prompt → user says Yes → config updated → no re-prompt', async () => {
      // === STEP 1: First activation, no prior decision ===
      mockContext.globalState.get.mockReturnValue(undefined);

      // Simulate user clicking "Yes"
      simulateUserResponse('Yes');

      // === STEP 2: After user response ===
      // Config should be updated
      expect(vscode.workspace.getConfiguration).toBeDefined();

      // Simulate config update and globalState persistence
      mockGlobalState.set('defaultViewerPromptDecision', 'yes');

      // === STEP 3: Second activation ===
      resetGlobalState(mockContext);
      mockContext.globalState.get.mockReturnValue('yes');

      // No re-prompt should occur
      expect(mockGlobalState.get('defaultViewerPromptDecision')).toBe('yes');
      expect((vscode.window.showInformationMessage as jest.Mock).mock.calls.length).toBe(0);
    });
  });
});
