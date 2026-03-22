/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * Link click handling for the markdown editor webview.
 * Handles click = edit dialog, Ctrl/Cmd+click = navigate.
 */

import type { Editor } from '@tiptap/core';
import { showLinkDialog } from '../features/linkDialog';
import { buildOutlineFromEditor } from '../utils/outline';
import { scrollToHeading } from '../utils/scrollToHeading';
import { MessageType } from '../../shared/messageTypes';

/**
 * Generate a URL-safe slug from heading text, ensuring uniqueness.
 */
function generateHeadingSlug(text: string, existingSlugs: Set<string>): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  let finalSlug = slug;
  let counter = 1;
  while (existingSlugs.has(finalSlug)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  existingSlugs.add(finalSlug);
  return finalSlug;
}

/**
 * Create a link click handler for the editor DOM.
 *
 * - Regular click → open link editor dialog
 * - Ctrl/Cmd+click → navigate to the link target
 *
 * @param getEditor - Getter for the current editor instance.
 * @param vscodeApi - VS Code webview API for posting messages.
 * @returns The click handler function.
 */
export function createLinkClickHandler(
  getEditor: () => Editor | null,
  vscodeApi: { postMessage: (msg: any) => void }
): (e: MouseEvent) => void {
  return (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest('.markdown-link') as HTMLAnchorElement;
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    e.preventDefault();
    e.stopPropagation();

    const editor = getEditor();

    // Ctrl+click (or Cmd+click on Mac) = navigate to link target
    if (e.ctrlKey || e.metaKey) {
      navigateToLink(href, editor, vscodeApi);
      return;
    }

    // Regular click = open link editor dialog
    if (editor) {
      showLinkDialog(editor);
    }
  };
}

/**
 * Navigate to a link target (used by Ctrl/Cmd+click).
 */
function navigateToLink(
  href: string,
  editor: Editor | null,
  vscodeApi: { postMessage: (msg: any) => void }
) {
  // External URLs
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
    vscodeApi.postMessage({ type: MessageType.OPEN_EXTERNAL_LINK, url: href });
    return;
  }

  // Anchor links (heading links)
  if (href.startsWith('#')) {
    const slug = href.slice(1);
    if (editor) {
      const outline = buildOutlineFromEditor(editor);
      const existingSlugs = new Set<string>();
      const headingMap = new Map<string, number>();
      outline.forEach(entry => {
        const headingSlug = generateHeadingSlug(entry.text, existingSlugs);
        headingMap.set(headingSlug, entry.pos);
      });
      const headingPos = headingMap.get(slug);
      if (headingPos !== undefined) {
        scrollToHeading(editor, headingPos);
      }
    }
    return;
  }

  // Image files
  if (/\.(png|jpe?g|gif|svg|webp|bmp|ico|tiff?)$/i.test(href)) {
    vscodeApi.postMessage({ type: MessageType.OPEN_IMAGE, path: href });
    return;
  }

  // Local file links
  vscodeApi.postMessage({ type: MessageType.OPEN_FILE_LINK, path: href });
}
