/**
 * Front Matter YAML validation handler for the extension host.
 *
 * Validates front matter YAML blocks extracted from markdown documents
 * using the js-yaml library. Provides error messages and validation status
 * for the webview to handle user feedback.
 *
 * This module runs in the extension host (Node.js) and receives validation
 * requests from the webview via the message protocol.
 */

import * as yaml from 'js-yaml';

/**
 * Validation result returned from frontmatter validation.
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a YAML front matter block.
 *
 * Attempts to parse the provided YAML text using js-yaml. If parsing succeeds,
 * returns { isValid: true }. If parsing fails, captures the error message and
 * returns { isValid: false, error: <message> }.
 *
 * @param yamlText - Raw YAML text (content between --- delimiters)
 * @returns Validation result with isValid flag and optional error message
 *
 * @example
 * const result = validateFrontmatterYaml('title: "Test"\nauthor: "User"');
 * if (result.isValid) {
 *   console.log('YAML is valid');
 * } else {
 *   console.error('YAML error:', result.error);
 * }
 */
export function validateFrontmatterYaml(_yamlText: string): ValidationResult {
  try {
    // Empty YAML is valid (represents no front matter properties)
    if (!_yamlText || _yamlText.trim().length === 0) {
      return { isValid: true };
    }

    // Attempt to parse YAML
    yaml.load(_yamlText);

    // If we get here, YAML is valid
    return { isValid: true };
  } catch (error) {
    // Capture error message from js-yaml
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      isValid: false,
      error: errorMessage,
    };
  }
}

/**
 * Extracts the front matter YAML block from markdown content.
 *
 * Looks for a YAML fence block at the start of the document (--- followed by newline).
 * Returns the YAML content between the opening and closing --- delimiters.
 *
 * @param _content - Raw markdown content
 * @returns YAML block content (without delimiters), or null if no front matter found
 *
 * @example
 * const yaml = extractFrontmatterBlock('---\ntitle: "Test"\n---\n\nContent');
 * // Returns: 'title: "Test"'
 */
export function extractFrontmatterBlock(_content: string): string | null {
  // Look for --- at the very start of the document (position 0)
  // followed by a newline, then capture content until the next ---
  // This handles both:
  // - Normal: ---\nCONTENT\n---
  // - Empty: ---\n---
  const match = _content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);

  if (match) {
    // Standard case: content with newline before closing delimiter
    return match[1];
  }

  // Handle edge case: empty front matter block (---\n---)
  // Try matching without requiring newline before closing delimiter
  const emptyMatch = _content.match(/^---\n---(?:\n|$)/);
  if (emptyMatch) {
    return '';
  }

  return null;
}

/**
 * Detects whether a markdown document contains front matter.
 *
 * Checks if the document starts with a YAML fence (--- followed by newline).
 * Front matter must be at the very beginning of the document.
 *
 * @param _content - Raw markdown content
 * @returns true if document has front matter, false otherwise
 *
 * @example
 * assert(hasFrontmatter('---\ntitle: "Test"\n---\n\nContent') === true);
 * assert(hasFrontmatter('Some content\n---\ntitle: "Test"\n---') === false);
 */
export function hasFrontmatter(_content: string): boolean {
  // Check if content starts with --- followed immediately by newline
  return /^---\n/.test(_content);
}
