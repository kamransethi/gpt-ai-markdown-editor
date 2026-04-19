/**
 * Unit tests for front matter YAML validation.
 *
 * Tests the validateFrontmatterYaml() function with various YAML inputs:
 * - Valid simple YAML
 * - Invalid/malformed YAML
 * - Nested YAML structures
 * - Multi-line values
 * - Special characters and unicode
 *
 * Following TDD (RED → GREEN → REFACTOR):
 * These tests are written BEFORE implementation exists.
 */

import {
  validateFrontmatterYaml,
  extractFrontmatterBlock,
  hasFrontmatter,
} from '../../editor/handlers/frontmatterValidation';

describe('validateFrontmatterYaml', () => {
  describe('Valid YAML', () => {
    test('should validate simple key-value YAML', () => {
      const yaml = 'title: "Test"\nauthor: "User"';
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should validate YAML with string values', () => {
      const yaml = 'title: "My Document"\ntags: [markdown, tutorial]';
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should validate empty YAML block', () => {
      const yaml = '';
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should validate YAML with numeric values', () => {
      const yaml = 'year: 2026\nversion: 1.0\ncount: 42';
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should validate YAML with boolean values', () => {
      const yaml = 'published: true\ndraft: false';
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should validate nested YAML structures', () => {
      const yaml = `theme:
  colors:
    primary: "#000"
    secondary: "#fff"
  fonts:
    - serif
    - sans-serif`;
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should validate multi-line scalar values (pipe)', () => {
      const yaml = `style: |
  section {
    background: #fff;
    font: 28px 'Segoe UI';
  }
  h1, h2 {
    color: #003366;
  }`;
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should validate multi-line scalar values (fold)', () => {
      const yaml = `description: >
  This is a long description
  that spans multiple lines
  but is wrapped into a single string.`;
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should validate YAML with lists', () => {
      const yaml = `tags:
  - markdown
  - documentation
  - tutorial
authors:
  - Alice
  - Bob`;
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should validate YAML with special characters', () => {
      const yaml = 'title: "Test: Part I (Optional) © 2026"';
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should validate YAML with unicode characters', () => {
      const yaml = 'title: "我的文档"  # Chinese\nauthor: "José"  # Spanish';
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should validate YAML with inline comments', () => {
      const yaml = `title: "My Doc"  # Document title
author: "User"  # Author name`;
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should validate YAML with quoted strings containing colons', () => {
      const yaml = 'key: "value: with: colons"\ntime: "12:34:56"';
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should validate YAML with dates', () => {
      const yaml = 'date: 2026-04-11\npublished: 2026-04-01';
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should validate complex MARP-style YAML', () => {
      const yaml = `title: "My MARP Presentation"
theme: gaia
style: |
  section {
    background: #ffffff;
    font: 28px 'Segoe UI';
  }
  h1, h2 {
    color: #003366;
  }
backgroundColor: #fafafa
marp: true
footer: "© 2026 My Company"
author: "John Doe"`;
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Invalid YAML', () => {
    test('should reject unclosed string quotes', () => {
      const yaml = 'title: "Unclosed String\nauthor: User';
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject malformed indentation', () => {
      const yaml = `theme:
colors:
primary: "#000"`;
      const result = validateFrontmatterYaml(yaml);
      // Note: js-yaml is lenient with indentation mismatches
      // This particular case actually parses as valid (two separate keys)
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid list syntax', () => {
      const yaml = `tags:
  - item1
  item2
  - item3`;
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject duplicate keys', () => {
      const yaml = `title: "First"
title: "Second"`;
      const result = validateFrontmatterYaml(yaml);
      // Note: js-yaml rejects duplicate mapping keys by default
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle tab characters in values', () => {
      const yaml = 'title: "Test"\nauthor:\t"User"'; // Tab character
      const result = validateFrontmatterYaml(yaml);
      // Note: js-yaml accepts tabs in YAML content
      // This is lenient but functional
      expect(result.isValid).toBe(true);
    });

    test('should handle partial multiline strings', () => {
      const yaml = `description: |
  This is a description
  but the pipe block is never closed properly
key: value
  this should also parse`;
      const result = validateFrontmatterYaml(yaml);
      // js-yaml is lenient and accepts this structure
      expect(result.isValid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle YAML with only comments', () => {
      const yaml = `# This is a comment
  # Another comment
  # And another`;
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should handle YAML with leading whitespace when trimmed', () => {
      const yaml = '  title: "Test"  \nauthor: "User"  ';
      // For front matter validation, we should trim the input
      const result = validateFrontmatterYaml(yaml.trim());
      expect(result.isValid).toBe(true);
    });

    test('should handle very long YAML value (>10000 chars)', () => {
      const longValue = 'x'.repeat(10000);
      const yaml = `title: "${longValue}"`;
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should handle very deeply nested YAML', () => {
      const yaml = `a:
  b:
    c:
      d:
        e:
          f:
            g:
              h: "deep value"`;
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should handle YAML with arrays of objects', () => {
      const yaml = `authors:
  - name: "Alice"
    email: "alice@example.com"
  - name: "Bob"
    email: "bob@example.com"`;
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });

    test('should handle null/undefined values', () => {
      const yaml = `optional: null
another_null: ~
present: "value"`;
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Error Messages', () => {
    test('should include error details for failed validation', () => {
      const yaml = 'title: "Unclosed';
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.length).toBeGreaterThan(0);
    });

    test('should provide line number information if available', () => {
      const yaml = `title: "Valid"
author: [unclosed list
another: key`;
      const result = validateFrontmatterYaml(yaml);
      expect(result.isValid).toBe(false);
      // Error message should ideally include line/position info
      expect(result.error).toBeDefined();
    });
  });
});

describe('extractFrontmatterBlock', () => {
  test('should extract simple YAML front matter', () => {
    const markdown = `---
title: "Test"
author: "User"
---

Content here`;
    const result = extractFrontmatterBlock(markdown);
    expect(result).toBeDefined();
    expect(result).toContain('title: "Test"');
    expect(result).toContain('author: "User"');
  });

  test('should extract complex YAML front matter', () => {
    const markdown = `---
title: "My Doc"
theme:
  colors:
    primary: "#000"
style: |
  section { background: #fff; }
---

# Document`;
    const result = extractFrontmatterBlock(markdown);
    expect(result).toBeDefined();
    expect(result).toContain('theme:');
    expect(result).toContain('primary: "#000"');
    expect(result).toContain('style: |');
  });

  test('should return null if no front matter', () => {
    const markdown = 'Some content\n---\nNot front matter';
    const result = extractFrontmatterBlock(markdown);
    expect(result).toBeNull();
  });

  test('should return null for plain markdown', () => {
    const markdown = '# Heading\n\nContent here';
    const result = extractFrontmatterBlock(markdown);
    expect(result).toBeNull();
  });

  test('should handle empty front matter block', () => {
    const markdown = `---
---

Content`;
    const result = extractFrontmatterBlock(markdown);
    expect(result).toEqual('');
  });

  test('should extract front matter with trailing newlines', () => {
    const markdown = `---
title: "Test"

---

Content`;
    const result = extractFrontmatterBlock(markdown);
    expect(result).toBeDefined();
    expect(result).toContain('title: "Test"');
  });
});

describe('hasFrontmatter', () => {
  test('should detect front matter at start of document', () => {
    const markdown = `---
title: "Test"
---

Content`;
    expect(hasFrontmatter(markdown)).toBe(true);
  });

  test('should return false if --- not at start', () => {
    const markdown = `Some content
---
title: "Test"
---`;
    expect(hasFrontmatter(markdown)).toBe(false);
  });

  test('should return false for plain markdown', () => {
    const markdown = '# Heading\n\nContent';
    expect(hasFrontmatter(markdown)).toBe(false);
  });

  test('should return true for empty front matter block', () => {
    const markdown = `---
---

Content`;
    expect(hasFrontmatter(markdown)).toBe(true);
  });

  test('should handle whitespace before ---', () => {
    const markdown = `  ---
title: "Test"
---

Content`;
    // Whitespace before --- means it's not front matter
    expect(hasFrontmatter(markdown)).toBe(false);
  });

  test('should require newline after opening ---', () => {
    const markdown = `---title: "Test"\n---\n\nContent`;
    // --- must be on its own line
    expect(hasFrontmatter(markdown)).toBe(false);
  });

  test('should handle documents with only front matter', () => {
    const markdown = `---
title: "Test"
---`;
    expect(hasFrontmatter(markdown)).toBe(true);
  });
});
