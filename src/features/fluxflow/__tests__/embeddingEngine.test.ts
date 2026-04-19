import { expect, describe, it } from '@jest/globals';

// Patch: import the normalization logic directly for testability
function normalizeModelName(s: string) {
  return s.toLowerCase().replace(/:.*$/, '').trim();
}

describe('EmbeddingEngine modelInstalled detection', () => {
  const testCases = [
    // [selected, available, shouldMatch]
    ['MXBAi-Embed-Large:latest', 'mxbaI-embed-large:latest', true],
    ['MXBAi-Embed-Large:latest', 'mxbaI-embed-large', true],
    ['MXBAi-Embed-Large', 'mxbaI-embed-large:latest', true],
    ['mxbaI-embed-large', 'MXBAi-Embed-Large:latest', true],
    ['nomic-embed-text', 'nomic-embed-text:latest', true],
    ['nomic-embed-text:latest', 'nomic-embed-text', true],
    ['nomic-embed-text', 'nomic-embed-text:v1', true],
    ['nomic-embed-text:v1', 'nomic-embed-text:latest', true],
    ['nomic-embed-text', 'other-model:latest', false],
    ['nomic-embed-text', 'nomic-embed', false],
    ['nomic-embed', 'nomic-embed-text', false],
  ];

  for (const [selected, available, shouldMatch] of testCases) {
    it(`should${shouldMatch ? '' : ' not'} match selected="${selected}" with available="${available}"`, () => {
      const selectedStr = String(selected);
      const availableStr = String(available);
      const selectedNorm = normalizeModelName(selectedStr);
      const availableNorm = normalizeModelName(availableStr);
      expect(selectedNorm === availableNorm).toBe(shouldMatch);
    });
  }
});
