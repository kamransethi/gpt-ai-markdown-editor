/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as path from 'path';
import type { ParsedDocument } from './types';

const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;
const INLINE_TAG_REGEX = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;

/**
 * Extract YAML frontmatter from markdown content.
 */
function parseFrontmatter(content: string): {
  properties: Array<{ key: string; value: string }>;
  tags: string[];
  body: string;
} {
  const properties: Array<{ key: string; value: string }> = [];
  const tags: string[] = [];

  if (!content.startsWith('---')) {
    return { properties, tags, body: content };
  }

  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { properties, tags, body: content };
  }

  const yamlBlock = content.slice(4, endIndex).trim();
  const body = content.slice(endIndex + 4).trim();

  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const rawValue = line.slice(colonIdx + 1).trim();

    if (key === 'tags') {
      const cleaned = rawValue.replace(/[[\]]/g, '');
      for (const t of cleaned.split(',')) {
        const tag = t.trim().toLowerCase().replace(/^#/, '');
        if (tag) tags.push(tag);
      }
    } else {
      properties.push({ key, value: rawValue });
    }
  }

  return { properties, tags, body };
}

/**
 * Parse a markdown file and extract all graph-relevant data.
 */
export function parseMarkdownFile(content: string, filePath: string): ParsedDocument {
  const { properties, tags: fmTags, body } = parseFrontmatter(content);

  // Extract title: frontmatter title → first H1 → filename
  let title = '';
  const titleProp = properties.find(p => p.key === 'title');
  if (titleProp) {
    title = titleProp.value.replace(/^["']|["']$/g, '');
  }
  if (!title) {
    const h1Match = body.match(/^#\s+(.+)$/m);
    if (h1Match) {
      title = h1Match[1].trim();
    }
  }
  if (!title) {
    title = path.basename(filePath, path.extname(filePath));
  }

  // Extract wiki-links [[target]]
  const links: ParsedDocument['links'] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    WIKI_LINK_REGEX.lastIndex = 0;
    while ((match = WIKI_LINK_REGEX.exec(line)) !== null) {
      const target = match[1].trim();
      if (!target) continue;

      const start = Math.max(0, match.index - 40);
      const end = Math.min(line.length, match.index + match[0].length + 40);
      const context =
        (start > 0 ? '...' : '') + line.slice(start, end).trim() + (end < line.length ? '...' : '');

      links.push({
        target: target.toLowerCase(),
        lineNumber: i + 1,
        context,
      });
    }
  }

  // Extract inline #tags (skip code fences)
  const inlineTags: ParsedDocument['tags'] = [];
  let inCodeBlock = false;
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    let match: RegExpExecArray | null;
    INLINE_TAG_REGEX.lastIndex = 0;
    while ((match = INLINE_TAG_REGEX.exec(line)) !== null) {
      inlineTags.push({ tag: match[1].toLowerCase(), source: 'inline' });
    }
  }

  // Combine and deduplicate tags
  const allTags: ParsedDocument['tags'] = [
    ...fmTags.map(tag => ({ tag, source: 'frontmatter' as const })),
    ...inlineTags,
  ];
  const seen = new Set<string>();
  const dedupedTags = allTags.filter(t => {
    if (seen.has(t.tag)) return false;
    seen.add(t.tag);
    return true;
  });

  return {
    title,
    links,
    tags: dedupedTags,
    properties,
    bodyText: body,
  };
}
