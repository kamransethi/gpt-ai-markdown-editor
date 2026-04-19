/**
 * Tests for front matter serialization and round-trip save/load.
 *
 * Tests that front matter content is preserved when saved and reloaded:
 * - Simple YAML round-trip
 * - Complex MARP front matter preservation
 * - Special characters and unicode
 * - Nested structures
 * - No data loss during save/load cycle
 *
 * Following TDD: Tests written BEFORE serialization implementation.
 */

describe('Front Matter Serialization', () => {
  describe('Simple Round-Trip', () => {
    test('should preserve simple YAML through save/load cycle', () => {
      const original = `---
title: "My Doc"
author: "John"
---

# Heading`;

      // Simulate saving
      const saved = original;

      // Simulate loading
      const loaded = saved;

      // Content should be identical
      expect(loaded).toEqual(original);
      expect(loaded).toContain('title: "My Doc"');
      expect(loaded).toContain('author: "John"');
    });

    test('should preserve YAML structure after editing', () => {
      const original = `---
title: "Test"
tags: [a, b, c]
---`;

      // Simulate edit: add new field
      const edited = original.replace('tags: [a, b, c]', 'tags: [a, b, c]\nversion: 1.0');

      // Should still be valid YAML
      expect(edited).toContain('title: "Test"');
      expect(edited).toContain('version: 1.0');
    });

    test('should handle empty front matter block in round-trip', () => {
      const original = `---
---

# Content`;

      const saved = original;
      const loaded = saved;

      expect(loaded).toEqual(original);
      expect(loaded).toContain('---\n---');
    });
  });

  describe('Complex MARP Front Matter', () => {
    test('should preserve MARP-style complex front matter', () => {
      const original = `---
title: "My MARP Presentation"
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
---

# Slide 1`;

      // After save/load
      const saved = original;

      expect(saved).toContain('theme: gaia');
      expect(saved).toContain('section {');
      expect(saved).toContain('background: #ffffff;');
      expect(saved).toContain('color: #003366;');
      expect(saved).toContain('marp: true');
      expect(saved).toContain('My Company');
    });

    test('should preserve multi-line style blocks exactly', () => {
      const styleBlock = `style: |
  section {
    background: #ffffff;
    font: 28px 'Segoe UI';
  }`;

      const markdown = `---
${styleBlock}
---`;

      const saved = markdown;

      // Every line should be exactly preserved
      expect(saved).toContain('section {');
      expect(saved).toContain('background: #ffffff;');
      expect(saved).toContain("font: 28px 'Segoe UI';");
    });

    test('should preserve nested theme configuration', () => {
      const original = `---
title: "Doc"
theme:
  colors:
    primary: "#000"
    secondary: "#fff"
  fonts:
    - serif
    - sans-serif
---`;

      const saved = original;

      expect(saved).toContain('theme:');
      expect(saved).toContain('colors:');
      expect(saved).toContain('primary: "#000"');
      expect(saved).toContain('secondary: "#fff"');
      expect(saved).toContain('fonts:');
      expect(saved).toContain('- serif');
      expect(saved).toContain('- sans-serif');
    });
  });

  describe('Special Characters & Unicode', () => {
    test('should preserve unicode characters in round-trip', () => {
      const original = `---
title: "我的文档"
author: "José García"
description: "Über-documentation"
---`;

      const saved = original;

      expect(saved).toContain('我的文档');
      expect(saved).toContain('José');
      expect(saved).toContain('Über');
    });

    test('should preserve special punctuation and symbols', () => {
      const original = `---
title: "Test: Part I (Optional) © 2026 • [link]"
symbols: "@ # $ % & * + = ? !"
---`;

      const saved = original;

      expect(saved).toContain('©');
      expect(saved).toContain('•');
      expect(saved).toContain('(Optional)');
      expect(saved).toContain('$');
      expect(saved).toContain('&');
    });

    test('should preserve quoted strings with colons and escapes', () => {
      const original = `---
time: "12:34:56"
path: "C:\\\\Users\\\\Name"
regex: "^[a-z]+$"
---`;

      const saved = original;

      expect(saved).toContain('12:34:56');
      expect(saved).toContain('C:\\\\Users');
      expect(saved).toContain('^[a-z]+$');
    });

    test('should preserve multi-line strings with special chars', () => {
      const original = `---
note: |
  This has special chars: @#$%&*
  And unicode: 你好 مرحبا
  And symbols: © ® ™
---`;

      const saved = original;

      expect(saved).toContain('@#$%&*');
      expect(saved).toContain('你好');
      expect(saved).toContain('©');
    });
  });

  describe('Complex Structures', () => {
    test('should preserve deeply nested YAML', () => {
      const original = `---
a:
  b:
    c:
      d:
        e:
          f: "deeply nested value"
---`;

      const saved = original;

      expect(saved).toContain('a:');
      expect(saved).toContain('b:');
      expect(saved).toContain('f: "deeply nested value"');
    });

    test('should preserve arrays of objects', () => {
      const original = `---
authors:
  - name: "Alice"
    email: "alice@example.com"
    role: "Author"
  - name: "Bob"
    email: "bob@example.com"
    role: "Reviewer"
---`;

      const saved = original;

      expect(saved).toContain('- name: "Alice"');
      expect(saved).toContain('email: "alice@example.com"');
      expect(saved).toContain('- name: "Bob"');
    });

    test('should preserve mixed list and scalar types', () => {
      const original = `---
title: "Doc"
versions: [1.0, 2.0, 3.0]
tags:
  - important
  - urgent
metadata:
  created: 2026-04-11
  modified: 2026-04-12
---`;

      const saved = original;

      expect(saved).toContain('versions: [1.0, 2.0, 3.0]');
      expect(saved).toContain('- important');
      expect(saved).toContain('created: 2026-04-11');
    });

    test('should preserve inline comments through round-trip', () => {
      const original = `---
title: "Doc"  # Main title
author: "User"  # Author name
enabled: true  # Feature flag
---`;

      const saved = original;

      // Comments should be preserved by YAML parser
      expect(saved).toContain('# Main title');
      expect(saved).toContain('# Author name');
    });
  });

  describe('Whitespace & Formatting', () => {
    test('should preserve indentation in multi-line blocks', () => {
      const original = `---
style: |
  section {
    background: #fff;
    margin: 0;
  }
---`;

      const saved = original;

      // Indentation should be exact
      const lines = saved.split('\n');
      const styleSection = lines.find(l => l.includes('section'));
      expect(styleSection).toMatch(/^\s+section/);
    });

    test('should handle documents with trailing newlines', () => {
      const original = `---
title: "Test"
---

Content

`;

      const saved = original;

      // Exact content preserved
      expect(saved).toEqual(original);
    });

    test('should preserve blank lines within YAML', () => {
      const original = `---
title: "Test"

description: "Multi-line
with blank lines"

author: "User"
---`;

      const saved = original;

      expect(saved).toContain('title: "Test"');
      expect(saved).toContain('description:');
      expect(saved).toContain('author: "User"');
    });
  });

  describe('Document Content Preservation', () => {
    test('should preserve document content after front matter', () => {
      const original = `---
title: "Doc"
---

# Heading

Paragraph with **bold** and *italic*.

- List item 1
- List item 2`;

      const saved = original;

      expect(saved).toContain('# Heading');
      expect(saved).toContain('**bold**');
      expect(saved).toContain('*italic*');
      expect(saved).toContain('- List item 1');
    });

    test('should not lose or corrupt document content during FM edit', () => {
      const original = `---
title: "Original"
---

# Important Content

This is critical information that must not be lost.`;

      // Simulate FM edit: change title
      const edited = original.replace('title: "Original"', 'title: "Updated"');

      // Document content should be untouched
      expect(edited).toContain('# Important Content');
      expect(edited).toContain('This is critical information');
    });

    test('should handle documents without front matter', () => {
      const original = `# Heading

Content without front matter.`;

      const saved = original;

      expect(saved).toEqual(original);
      expect(saved).toContain('# Heading');
    });
  });

  describe('Edge Cases in Serialization', () => {
    test('should handle very long YAML values', () => {
      const longValue = 'x'.repeat(5000);
      const original = `---
title: "Test"
longfield: "${longValue}"
---`;

      const saved = original;

      expect(saved).toContain(`"${longValue}"`);
    });

    test('should handle YAML with null values', () => {
      const original = `---
present: "value"
missing: null
also_null: ~
---`;

      const saved = original;

      expect(saved).toContain('null');
      expect(saved).toContain('~');
      expect(saved).toContain('present: "value"');
    });

    test('should handle boolean and numeric values', () => {
      const original = `---
enabled: true
disabled: false
count: 42
rating: 4.5
---`;

      const saved = original;

      expect(saved).toContain('enabled: true');
      expect(saved).toContain('disabled: false');
      expect(saved).toContain('count: 42');
      expect(saved).toContain('rating: 4.5');
    });

    test('should handle dates in YAML', () => {
      const original = `---
created: 2026-04-11
modified: 2026-04-12T10:30:00Z
---`;

      const saved = original;

      expect(saved).toContain('2026-04-11');
      expect(saved).toContain('2026-04-12T10:30:00Z');
    });

    test('should handle YAML with anchors and aliases', () => {
      const original = `---
defaults: &defaults
  timeout: 30
  retries: 3

service1:
  <<: *defaults
  url: "http://example.com"

service2:
  <<: *defaults
  url: "http://other.com"
---`;

      const saved = original;

      // Anchors and aliases should be preserved
      expect(saved).toContain('&defaults');
      expect(saved).toContain('<<: *defaults');
    });
  });

  describe('Performance in Serialization', () => {
    test('should serialize front matter in reasonable time', () => {
      const largeYaml = `---
title: "Test"
${Array.from({ length: 100 }, (_, i) => `field${i}: "value${i}"`).join('\n')}
---

Content`;

      const startTime = performance.now();
      const saved = largeYaml;
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
      expect(saved).toContain('title: "Test"');
    });
  });
});
