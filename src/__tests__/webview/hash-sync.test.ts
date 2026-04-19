/**
 * @jest-environment jsdom
 */

/**
 * Tests for hash-based sync deduplication
 * Verifies the hash function and deduplication logic used to prevent
 * feedback loops when syncing content between editor and VS Code.
 *
 * Note: These tests use a standalone implementation of the hash function
 * to avoid loading the full editor module which has many side effects.
 */

// Standalone implementation of the djb2 hash (same as in editor.ts)
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
  }
  return hash.toString(36);
}

describe('hash-based sync deduplication', () => {
  // Simulated sync state (mirrors editor.ts implementation)
  let lastSentContentHash: string | null = null;
  let lastSentTimestamp = 0;

  const trackSentContent = (content: string) => {
    lastSentContentHash = hashString(content);
    lastSentTimestamp = Date.now();
  };

  const getLastSentContentHash = () => lastSentContentHash;

  const resetSyncState = () => {
    lastSentContentHash = null;
    lastSentTimestamp = 0;
  };

  const shouldSkipUpdate = (incomingContent: string): boolean => {
    const incomingHash = hashString(incomingContent);
    const timeSinceLastSend = Date.now() - lastSentTimestamp;
    return incomingHash === lastSentContentHash && timeSinceLastSend < 2000;
  };

  beforeEach(() => {
    resetSyncState();
  });

  describe('hashString function', () => {
    it('generates consistent hashes for same content', () => {
      const hash1 = hashString('hello world');
      const hash2 = hashString('hello world');
      expect(hash1).toBe(hash2);
    });

    it('generates different hashes for different content', () => {
      const hash1 = hashString('content A');
      const hash2 = hashString('content B');
      expect(hash1).not.toBe(hash2);
    });

    it('handles empty strings', () => {
      const hash = hashString('');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('handles unicode content', () => {
      const hash = hashString('Hello 世界 🌍');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  describe('trackSentContent', () => {
    it('stores hash of sent content', () => {
      expect(getLastSentContentHash()).toBeNull();

      trackSentContent('hello world');

      expect(getLastSentContentHash()).not.toBeNull();
      expect(typeof getLastSentContentHash()).toBe('string');
    });

    it('updates hash when tracking new content', () => {
      trackSentContent('content A');
      const hashA = getLastSentContentHash();

      trackSentContent('content B');
      const hashB = getLastSentContentHash();

      expect(hashA).not.toBe(hashB);
    });
  });

  describe('resetSyncState', () => {
    it('clears the stored hash', () => {
      trackSentContent('some content');
      expect(getLastSentContentHash()).not.toBeNull();

      resetSyncState();

      expect(getLastSentContentHash()).toBeNull();
    });
  });

  describe('shouldSkipUpdate', () => {
    it('returns true when content matches recently sent hash', () => {
      trackSentContent('new content');

      // Same content should be skipped (within 2s window)
      expect(shouldSkipUpdate('new content')).toBe(true);
    });

    it('returns false when content differs from sent hash', () => {
      trackSentContent('content A');

      // Different content should not be skipped
      expect(shouldSkipUpdate('content B')).toBe(false);
    });

    it('returns false when no content was tracked', () => {
      resetSyncState();

      // No tracked content - should not skip
      expect(shouldSkipUpdate('any content')).toBe(false);
    });
  });
});
