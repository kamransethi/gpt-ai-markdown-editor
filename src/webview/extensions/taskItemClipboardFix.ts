/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { TaskItem } from '@tiptap/extension-list';

/**
 * TaskItem clipboard fix.
 *
 * TipTap's TaskItem `renderHTML` produces this DOM structure:
 *
 *   <li data-type="taskItem" data-checked="true">
 *     <label><input type="checkbox" checked><span></span></label>
 *     <div><p>Actual content here</p></div>
 *   </li>
 *
 * The `<div>` (slot `0`) is the content hole. However, TaskItem's default
 * `parseHTML` rule is simply `{ tag: 'li[data-type="taskItem"]', priority: 51 }`
 * with NO `contentElement`. This means ProseMirror's DOMParser processes ALL
 * children of `<li>` as content — including the `<label>` (with `<input>` and
 * `<span>`) — when parsing clipboard HTML during paste.
 *
 * In Chrome/Electron (the VS Code webview runtime), this causes the `<label>`
 * and `<div>` structural tags to leak into the parsed content as literal text,
 * producing corrupted markdown like `- [x] <label>\n  <div>` instead of
 * `- [x] Completed task`.
 *
 * Fix: add `contentElement` to the parseHTML rule so ProseMirror only
 * reads content from the `<div>` child, matching the renderHTML structure.
 */
export const TaskItemClipboardFix = TaskItem.extend({
  parseHTML() {
    return [
      {
        tag: `li[data-type="${this.name}"]`,
        priority: 51,
        contentElement: (node: HTMLElement) => {
          // TipTap's renderHTML places content inside <div>.
          // Use it when present; fall back to entire node for non-TipTap HTML.
          return node.querySelector(':scope > div') || node;
        },
      },
    ];
  },

  renderMarkdown(node, h) {
    const checked = node.attrs?.checked;
    return `- [${checked ? 'x' : ' '}] ${h.renderChildren(node)}`;
  },
});
