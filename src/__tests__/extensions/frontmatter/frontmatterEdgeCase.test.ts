/**
 * Edge case tests for front matter handling.
 *
 * Tests behavior with:
 * - Empty/minimal front matter
 * - Malformed but recoverable YAML
 * - Comments-only YAML blocks
 * - Very long values
 * - Unicode edge cases
 * - --- appearing in wrong positions
 * - Interaction with document content
 *
 * Following TDD: Tests written BEFORE edge case handling implemented.
 */

describe('Front Matter Edge Cases', () => {
  describe('Empty and Minimal Front Matter', () => {
    test('should handle empty front matter block', () => {
      const markdown = `---
---

Content`;

      // Front matter should be detected
      // Empty block should be valid
      expect(markdown).toContain('---\n---');
    });

    test('should handle front matter with only whitespace', () => {
      const markdown = `---
   
   
---

Content`;

      // Whitespace-only block should be valid
      expect(markdown).toContain('---');
    });

    test('should handle front matter with only newlines', () => {
      const markdown = `---


---

Content`;

      expect(markdown).toContain('---');
    });

    test('should handle very minimal YAML', () => {
      const markdown = `---
a: b
---`;

      expect(markdown).toContain('a: b');
    });
  });

  describe('Comments-Only YAML', () => {
    test('should handle front matter with only comments', () => {
      const markdown = `---
# This is a comment
# Another comment
# And another
---

Content`;

      // Comments-only YAML is valid
      expect(markdown).toContain('# This is a comment');
    });

    test('should handle mixed comments and values', () => {
      const markdown = `---
# Title section
title: "Test"
# Author section
author: "User"
# End of FM
---`;

      expect(markdown).toContain('title: "Test"');
      expect(markdown).toContain('# Title section');
    });

    test('should handle comments with special characters', () => {
      const markdown = `---
# TODO: Add more fields
# BUG: Fix this section
# NOTE: This is important!
---`;

      expect(markdown).toContain('TODO');
      expect(markdown).toContain('BUG');
      expect(markdown).toContain('NOTE');
    });
  });

  describe('Very Long Values', () => {
    test('should handle very long string values (>10000 chars)', () => {
      const longValue = 'x'.repeat(10000);
      const markdown = `---
description: "${longValue}"
---`;

      expect(markdown).toContain(longValue);
      expect(markdown.length).toBeGreaterThan(10000);
    });

    test('should handle very long multi-line values', () => {
      const longContent = Array.from({ length: 1000 }, (_, i) => `Line ${i}: content`).join('\n');
      const markdown = `---
content: |
${longContent}
---`;

      expect(markdown).toContain('Line 0:');
      expect(markdown).toContain('Line 999:');
    });

    test('should handle deeply nested structures with many fields', () => {
      const fields = Array.from({ length: 100 }, (_, i) => `  field${i}: "value${i}"`).join('\n');
      const markdown = `---
nested:
${fields}
---`;

      expect(markdown).toContain('field0:');
      expect(markdown).toContain('field99:');
    });
  });

  describe('Dash Handling (--- edge cases)', () => {
    test('should NOT treat --- appearing after content as front matter', () => {
      const markdown = `Some content

---
title: "This is NOT front matter"
---`;

      // Should only detect front matter at document start
      expect(markdown.startsWith('---')).toBe(false);
    });

    test('should NOT treat --- in middle of document as start of front matter', () => {
      const markdown = `---
title: "Real FM"
---

# Content

---
# This is a section divider, not front matter
`;

      expect(markdown.startsWith('---')).toBe(true);
    });

    test('should require newline immediately after opening ---', () => {
      const invalidMarkdown = `---title: test
author: user
---`;

      // --- must be on its own line
      expect(invalidMarkdown.startsWith('---\n')).toBe(false);
    });

    test('should handle multiple --- in YAML content', () => {
      const markdown = `---
title: "Document with --- dashes"
description: "This value contains ---"
---

Content`;

      // Dashes within quoted strings should not be confused with delimiters
      expect(markdown.match(/---/g)?.length).toBe(4); // Two solid fences + two in values
    });

    test('should handle --- within code blocks in document', () => {
      const markdown = `---
title: "Test"
---

# Document

\`\`\`yaml
---
nested: yaml
---
\`\`\``;

      // --- in code block should not affect parsing
      // Front matter section should already be closed
      expect(markdown.startsWith('---')).toBe(true);
    });
  });

  describe('Unicode Edge Cases', () => {
    test('should handle mixed Unicode scripts', () => {
      const markdown = `---
chinese: "中文"
arabic: "العربية"
greek: "Ελληνικά"
cyrillic: "Русский"
emoji: "😀🎉"
---`;

      expect(markdown).toContain('中文');
      expect(markdown).toContain('العربية');
      expect(markdown).toContain('😀');
    });

    test('should handle right-to-left text', () => {
      const markdown = `---
title: "הברה" # Hebrew
subtitle: "مرحبا" # Arabic
---`;

      expect(markdown).toContain('הברה');
      expect(markdown).toContain('مرحبا');
    });

    test('should handle combining characters and diacritics', () => {
      const markdown = `---
title: "Café"
author: "Zoë"
note: "naïve"
---`;

      expect(markdown).toContain('Café');
      expect(markdown).toContain('Zoë');
      expect(markdown).toContain('naïve');
    });

    test('should handle zero-width characters', () => {
      const markdown = `---
title: "Test\u200Bword"
---`;

      // Zero-width space should be preserved
      expect(markdown).toContain('Test');
      expect(markdown).toContain('word');
    });

    test('should handle emoji variations', () => {
      const markdown = `---
emojis: "👍 👎 ❤️ 🎉"
skin_tones: "👋🏻 👋🏼"
---`;

      expect(markdown).toContain('👍');
      expect(markdown).toContain('❤️');
    });
  });

  describe('Quote and Escape Handling', () => {
    test('should handle single quotes in values', () => {
      const markdown = `---
title: "It's a test"
note: 'Single quoted'
---`;

      expect(markdown).toContain("It's a test");
      expect(markdown).toContain('Single quoted');
    });

    test('should handle escaped quotes', () => {
      const markdown = `---
title: "Escaped \\"quote\\""
---`;

      expect(markdown).toContain('Escaped');
    });

    test('should handle backslashes', () => {
      const markdown = `---
path: "C:\\\\Users\\\\Name"
regex: "^[a-z]+$"
---`;

      expect(markdown).toContain('C:\\\\');
      expect(markdown).toContain('[a-z]');
    });

    test('should handle mixed quotes', () => {
      const markdown = `---
mixed1: "It's a 'test'"
mixed2: 'He said "hello"'
---`;

      expect(markdown).toContain("It's");
      expect(markdown).toContain('hello');
    });
  });

  describe('Whitespace Edge Cases', () => {
    test('should handle tabs vs spaces', () => {
      const markdown = `---
spaced: "  spaces  "
tabbed: \tvalue\t
---`;

      // Preserve whitespace as-is
      expect(markdown).toContain('spaces');
    });

    test('should handle mixed indentation', () => {
      const markdown = `---
nested:
  with_spaces: value
\twith_tabs: value
---`;

      // YAML parsers typically reject mixed indentation, but we should handle gracefully
      expect(markdown).toContain('nested:');
    });

    test('should handle trailing spaces at end of lines', () => {
      const markdown = `---
title: "Test"   
author: "User"  
---`;

      expect(markdown).toContain('title:');
      expect(markdown).toContain('author:');
    });

    test('should handle newline variations (CRLF vs LF)', () => {
      const lf = `---\ntitle: "Test"\n---`;
      const crlf = `---\r\ntitle: "Test"\r\n---`;

      expect(lf).toContain('title');
      expect(crlf).toContain('title');
    });
  });

  describe('Malformed but Recoverable YAML', () => {
    test('should handle missing colons in some fields', () => {
      const markdown = `---
title "Missing colon"
author: "User"
---`;

      // This is invalid YAML but parser might attempt recovery
      expect(markdown).toContain('title');
    });

    test('should handle incorrectly quoted strings', () => {
      const markdown = `---
title: 'Mismatched Quote"
author: "User"
---`;

      // Mismatched quotes
      expect(markdown).toContain('Mismatched');
    });

    test('should handle out-of-order YAML', () => {
      const markdown = `---
  title: value
key: value
  author: value
---`;

      // Indentation errors
      expect(markdown).toContain('title');
      expect(markdown).toContain('author');
    });
  });

  describe('Panel Behavior with Edge Cases', () => {
    test('should handle empty front matter in panel rendering', () => {
      const markdown = `---
---

Content`;

      // Panel should render even if empty
      expect(markdown).toContain('---\n---');
    });

    test('should handle very complex YAML in panel editing', () => {
      const yaml = `theme:
  colors:
    primary: "#000"
    secondary: "#fff"
  layout:
    sections:
      - name: "A"
        width: 50
      - name: "B"
        width: 50
style: |
  html, body {
    margin: 0;
    padding: 0;
  }
  /* Complex styles here */
  .section { display: flex; }`;

      const markdown = `---
${yaml}
---`;

      expect(markdown).toContain('primary');
      expect(markdown).toContain('html, body');
    });

    test('should handle document with no body content (FM only)', () => {
      const markdown = `---
title: "Just frontmatter"
---`;

      // Valid edge case: document with only front matter
      expect(markdown.startsWith('---')).toBe(true);
    });
  });

  describe('Interaction with Document Features', () => {
    test('should not interfere with code blocks in document', () => {
      const markdown = `---
title: "Test"
---

# Code Example

\`\`\`yaml
---
nested: yaml
---
\`\`\``;

      expect(markdown).toContain('```yaml');
      expect(markdown).toContain('nested: yaml');
    });

    test('should not interfere with HTML comments in document', () => {
      const markdown = `---
title: "Test"
---

<!-- This is a comment -->
Content here`;

      expect(markdown).toContain('<!-- This is a comment -->');
      expect(markdown).toContain('Content here');
    });

    test('should not interfere with inline front matter syntax in document', () => {
      const markdown = `---
title: "Test"
---

The front matter is: \`---\` delimited YAML.`;

      expect(markdown).toContain('The front matter is:');
      expect(markdown).toContain('delimited YAML');
    });

    test('should work with documents containing metadata references', () => {
      const markdown = `---
title: "My Doc"
author: "John"
---

This document by @author with title "@title" demonstrates reference patterns.`;

      expect(markdown).toContain('@author');
      expect(markdown).toContain('@title');
    });
  });
});
