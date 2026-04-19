/**
 * Jest test setup (after environment)
 *
 * This file runs after the test environment is set up.
 * Use it for Jest-specific configuration like beforeEach, custom matchers, etc.
 */

import { resetAllMocks } from '../__mocks__/vscode';

// Reset VS Code mocks before each test
beforeEach(() => {
  resetAllMocks();
});

// Global test timeout (useful for async operations)
jest.setTimeout(10000);

// Custom matchers can be added here
expect.extend({
  /**
   * Check if a word count is within expected range
   * Useful for testing word count with slight variations
   */
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Type declaration for custom matcher

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}
