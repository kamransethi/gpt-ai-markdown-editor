/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/** A document indexed in the graph */
export interface GraphDocument {
  id: number;
  path: string;
  title: string;
  hash: string;
  indexedAt: number;
}

/** Result of parsing a single markdown file */
export interface ParsedDocument {
  title: string;
  links: Array<{ target: string; lineNumber: number; context: string }>;
  tags: Array<{ tag: string; source: 'inline' | 'frontmatter' }>;
  properties: Array<{ key: string; value: string }>;
  bodyText: string;
}

/** A backlink result for display */
export interface BacklinkEntry {
  sourcePath: string;
  sourceTitle: string;
  context: string;
  lineNumber: number;
}

/** A search result */
export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
}
