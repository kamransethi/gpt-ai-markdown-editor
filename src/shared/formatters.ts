/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * Transforms "KNOWN_ISSUES.md" -> "KNOWN ISSUES (MD)"
 * Transforms "api_specification.ts" -> "api specification (TS)"
 * Used for consistent file link display across the editor and slash commands.
 *
 * @param fileName The raw filename to format
 * @returns A friendly display name with extension in parentheses
 */
export const formatLinkDisplay = (fileName: string): string => {
  if (!fileName) return '';

  const parts = fileName.split('.');
  if (parts.length === 1) {
    return fileName.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  const ext = parts.pop()?.toUpperCase() || '';
  const name = parts
    .join('.')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return `${name} (${ext})`;
};
