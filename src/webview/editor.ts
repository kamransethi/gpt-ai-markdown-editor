/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

// CSS imports are in editor.tsx (the esbuild entry point) to avoid duplication.
// Do NOT import .css files here — editor.tsx already imports them.

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit, Table, TableCell } from '@tiptap/extension-table';
import { CellSelection } from 'prosemirror-tables';
import { TableOfContents, type TableOfContentData } from '@tiptap/extension-table-of-contents';
import { BulletList, ListKit, TaskList } from '@tiptap/extension-list';
import Link from '@tiptap/extension-link';
import { BubbleMenu as BubbleMenuExtension } from '@tiptap/extension-bubble-menu';
import { FloatingMenu as FloatingMenuExtension } from '@tiptap/extension-floating-menu';
import Focus from '@tiptap/extension-focus';
import FileHandler from '@tiptap/extension-file-handler';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { marked as markedInstance, Marked } from 'marked';
import { CustomImage } from './extensions/customImage';
import { CodeBlockWithUi } from './extensions/codeBlockShikiWithUi';
import { common, createLowlight } from 'lowlight';
import { Mermaid } from './extensions/mermaid';
import { IndentedImageCodeBlock } from './extensions/indentedImageCodeBlock';
import { SpaceFriendlyImagePaths } from './extensions/spaceFriendlyImagePaths';
import { TabIndentation } from './extensions/tabIndentation';
import { GitHubAlerts } from './extensions/githubAlerts';
import { ImageBoundaryNav } from './extensions/imageBoundaryNav';
import { OrderedListMarkdownFix } from './extensions/orderedListMarkdownFix';
import { TaskItemClipboardFix } from './extensions/taskItemClipboardFix';
import { GenericHTMLInline, GenericHTMLBlock } from './extensions/htmlPreservation';
import {
  HtmlCommentInline,
  HtmlCommentBlock,
  setPreserveHtmlComments,
} from './extensions/htmlComment';
import {
  createFloatingFormattingBar,
  createEmptyLineMenu,
  createFormattingToolbar,
  setEditorZoom,
  updateToolbarStates,
} from './BubbleMenuView';
import { createContextMenu } from './features/contextMenu';
import { createTableContextMenu } from './features/tableContextMenu';
import { createImageContextMenu, isExternalImage } from './features/imageContextMenu';
import { tryShowSpellMenu } from './features/spellCheckMenu';
import { handleAiRefineResult } from './features/aiRefine';
import { TextColorMark, CustomTextStyle } from './extensions/textColor';
import { getEditorMarkdownForSync } from './utils/markdownSerialization';
import {
  setupImageDragDrop,
  hasPendingImageSaves,
  getPendingImageCount,
  imageDragDropHandler,
  imagePasteHandler,
} from './features/imageDragDrop';
import { ImageUploadPlugin } from './extensions/imageUploadPlugin';
import { setupFileLinkDrop } from './features/fileLinkDrop';
import { renderTableToMarkdownWithBreaks } from './utils/tableMarkdownSerializer';
import { createTocPane, type TocPaneAnchor } from './features/tocPane';
import { setupClipboardHandlers } from './features/clipboardHandling';
import { createKeydownHandler } from './features/keyboardShortcuts';
import { createLinkClickHandler } from './features/linkHandling';
import { SearchAndReplace } from './extensions/searchAndReplace';
import { CommandRegistry } from './extensions/CommandRegistry';
import { TableBulletListSmart } from './extensions/tableBulletListSmart';
import { fileCache } from './utils/fileCache';
import {
  AiExplain,
  handleAiExplainResult,
  handleAiExplainChunk,
  handleAiExplainDone,
  handleImageAskResult,
} from './extensions/aiExplain';
import { SpellCheck, initSpellCheck, reloadUserWords } from './extensions/spellCheck';
import { getCurrentTableMatrix, serializeTableMatrix } from './utils/tableClipboard';
import { shouldAutoLink } from './utils/linkValidation';
import { buildOutlineFromEditor } from './utils/outline';
import { scrollToHeading } from './utils/scrollToHeading';
import { WikiLink, WikiLinkSuggest, wikilinkMarkedExtension, updateCachedNoteList } from './extensions/wikilink';
import { devLog } from './utils/devLog';
import { collectExportContent, getDocumentTitle } from './utils/exportContent';
import { MessageType } from '../shared/messageTypes';
import { toErrorMessage } from '../shared/errorUtils';
import { debounce, rafThrottle } from './utils/debounce';
import * as YAML from 'js-yaml';
import { closeAllDropdowns } from './BubbleMenuView';

/**
 * Tags that TipTap handles natively — never strip these.
 */
const KNOWN_HTML_TAGS = new Set([
  'br',
  'p',
  'div',
  'span',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'ins',
  'sub',
  'sup',
  'code',
  'pre',
  'blockquote',
  'a',
  'img',
  'mark',
]);

function isLocalFileHref(href: string): boolean {
  return Boolean(href) && !/^(https?:|mailto:|#)/i.test(href);
}

function getLinkHrefAtCursor(editor: Editor): string | null {
  const { state } = editor;
  const { selection } = state;
  if (!selection.empty) return null;

  const docSize = state.doc.content.size;
  const probePositions = [selection.from, Math.max(0, selection.from - 1)].filter(
    (pos, idx, arr) => pos <= docSize && arr.indexOf(pos) === idx
  );

  for (const pos of probePositions) {
    const marks = state.doc.resolve(pos).marks();
    const linkMark = marks.find(mark => mark.type.name === 'link');
    const href = linkMark?.attrs?.href;
    if (typeof href === 'string' && href.length > 0) {
      return href;
    }
  }

  return null;
}

function updateActiveLinkPreview(editor: Editor): void {
  const root = editor.view.dom as HTMLElement;

  root.querySelectorAll('a.markdown-link.link-edit-preview').forEach(link => {
    link.classList.remove('link-edit-preview');
    link.removeAttribute('data-link-href');
  });

  const href = getLinkHrefAtCursor(editor);
  if (!href || !isLocalFileHref(href)) return;

  const { selection } = editor.state;
  const probePositions = [selection.from, Math.max(0, selection.from - 1)].filter(
    (pos, idx, arr) => arr.indexOf(pos) === idx
  );

  for (const pos of probePositions) {
    try {
      const domAtPos = editor.view.domAtPos(pos);
      const node = domAtPos.node;
      const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
      const linkEl = element?.closest?.('a.markdown-link') as HTMLAnchorElement | null;
      if (linkEl) {
        linkEl.classList.add('link-edit-preview');
        linkEl.setAttribute('data-link-href', href);
        break;
      }
    } catch {
      // Ignore transient DOM mapping errors while the view is updating.
    }
  }
}

/**
 * Strip unknown HTML tags from a string, keeping text content.
 * Converts `<mark>` → `==` for native Highlight support.
 */
function stripUnknownHtml(raw: string): string {
  const result = raw.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\/?>/g, (tag, tagName) => {
    return KNOWN_HTML_TAGS.has(tagName.toLowerCase()) ? tag : '';
  });
  return result;
}

/**
 * Pre-process markdown content using `marked`'s AST to safely strip unknown
 * HTML tags while NEVER touching content inside code blocks or inline code spans.
 *
 * IMPORTANT: If content starts with YAML frontmatter (---), skip preprocessing
 * entirely since `marked` does not understand YAML frontmatter and will corrupt it.
 * TipTap's Markdown extension handles frontmatter natively, so pass it through unchanged.
 *
 * The previous regex-based approach was fragile with nested backticks, escaped
 * characters, and indented code blocks. Using `marked.lexer()` leverages the
 * same parser TipTap uses, so code boundary detection is 100% accurate.
 */
function preprocessMarkdownContent(content: string): string {
  // If content starts with YAML frontmatter, skip preprocessing
  // marked.lexer() doesn't understand YAML frontmatter and will corrupt it
  if (content.trim().startsWith('---')) {
    return content;
  }

  const tokens = markedInstance.lexer(content);
  return reconstructFromTokens(tokens);
}

/**
 * Recursively reconstruct markdown from a token tree, stripping unknown HTML
 * only from non-code tokens. Code tokens (`code`, `codespan`) are returned
 * verbatim via `token.raw`.
 */
function reconstructFromTokens(
  tokens: Array<{ type: string; raw: string; tokens?: unknown[]; items?: unknown[] }>
): string {
  return tokens
    .map(token => {
      // Code tokens: return raw content completely untouched
      if (token.type === 'code' || token.type === 'codespan') {
        return token.raw;
      }

      // HTML tokens (inline or block): strip unknown tags
      if (token.type === 'html') {
        return stripUnknownHtml(token.raw);
      }

      // Tokens with children: we must reconstruct from children to
      // preserve the tree walk, but keep the token's own raw prefix/suffix
      if (token.tokens && Array.isArray(token.tokens)) {
        const childrenOutput = reconstructFromTokens(
          token.tokens as Array<{ type: string; raw: string; tokens?: unknown[] }>
        );
        // For top-level block tokens (paragraph, heading, etc.) the raw includes
        // trailing newlines — we need to preserve those but swap inner content
        const rawInner = (token.tokens as Array<{ raw: string }>).map(t => t.raw).join('');
        return token.raw.replace(rawInner, childrenOutput);
      }

      // List items have `items` instead of `tokens`
      if (token.items && Array.isArray(token.items)) {
        const itemsOutput = reconstructFromTokens(
          token.items as Array<{ type: string; raw: string; tokens?: unknown[] }>
        );
        const rawInner = (token.items as Array<{ raw: string }>).map(i => i.raw).join('');
        return token.raw.replace(rawInner, itemsOutput);
      }

      // Leaf tokens (text, space, etc.): return raw
      return token.raw;
    })
    .join('');
}

// VS Code API type definitions
type VsCodeApi = {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const acquireVsCodeApi: () => VsCodeApi;

// Extended window interface for DK-AI globals
declare global {
  interface Window {
    vscode?: VsCodeApi;
    resolveImagePath?: (relativePath: string) => Promise<string>;
    getImageReferences?: (imagePath: string) => Promise<unknown>;
    checkImageRename?: (oldPath: string, newName: string) => Promise<unknown>;
    setupImageResize?: (
      img: HTMLImageElement,
      editorInstance?: Editor,
      vscodeApi?: VsCodeApi
    ) => void;
    skipResizeWarning?: boolean;
    imagePath?: string;
    imagePathBase?: string;
    _imageCacheBust?: Map<string, number>;
    _workspaceCheckCallbacks?: Map<string, (result: unknown) => void>;
    gptaiDeveloperMode?: boolean;
  }
}

import { initAiPrompts } from './features/aiPromptsLoader';
import { getActiveBridge } from './hostBridge';

// Initialize bridge lazily — getActiveBridge() is called inside event handlers
// and functions, never at module scope, so standalone.ts can call setBridge()
// before any bridge method is first invoked.
// window.vscode is set by the active bridge's factory for backward-compat with
// BubbleMenuView.ts and frontmatterUI.ts which use getActiveBridge().postMessage().
initAiPrompts();

/**
 * Mirror webview diagnostics into extension-host logs for easier alpha troubleshooting.
 */
function reportWebviewIssue(level: 'error' | 'warn' | 'info', message: string, details?: unknown) {
  try {
    getActiveBridge().postMessage({
      type: MessageType.WEBVIEW_LOG,
      level,
      message,
      details,
    });
  } catch (error) {
    console.error('[DK-AI] Failed to forward webview issue to extension host:', error);
  }
}

const userErrorCooldownMs = 5000;
const lastUserErrorAt = new Map<string, number>();

function isDeveloperModeEnabled(): boolean {
  return window.gptaiDeveloperMode !== false;
}

function showRuntimeErrorToUser(code: string, baseMessage: string, error?: unknown) {
  const now = Date.now();
  const last = lastUserErrorAt.get(code) ?? 0;
  if (now - last < userErrorCooldownMs) {
    return;
  }
  lastUserErrorAt.set(code, now);

  const errorText =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error ?? '');
  const message =
    isDeveloperModeEnabled() && errorText ? `${baseMessage} (${errorText})` : baseMessage;

  getActiveBridge().postMessage({
    type: MessageType.SHOW_ERROR,
    message,
  });
}

let editor: Editor | null = null;
let isUpdating = false; // Prevent feedback loops
let formattingToolbar: HTMLElement;
let editorMetaBar: HTMLElement | null = null;
let floatingFormattingBar: HTMLElement | null = null;
let floatingBarController: ReturnType<typeof createFloatingFormattingBar> | null = null;
let floatingMenuElement: HTMLElement | null = null;
let textContextMenuCtrl: ReturnType<typeof createContextMenu> | null = null;
let tableContextMenuCtrl: ReturnType<typeof createTableContextMenu> | null = null;
let imageContextMenuCtrl: ReturnType<typeof createImageContextMenu> | null = null;
let tocPaneController: ReturnType<typeof createTocPane> | null = null;
let tocAnchors: TocPaneAnchor[] = [];
let tocMaxDepth = 3;
let showSelectionToolbar = false;
let compressTables = false;
let trimBlankLines = false;
// Dirty state tracking — true when webview has unsaved edits
let docDirty = false;
// Guard: suppress floating bar until first real user interaction
let editorFullyInitialized = false;

function getActiveTocHeadingId(anchors: TocPaneAnchor[]): string | null {
  if (anchors.length === 0) {
    return null;
  }

  // Keep marker below the sticky top toolbar for expected active heading behavior.
  const toolbar = document.querySelector('.formatting-toolbar');
  const toolbarOffset = toolbar ? toolbar.getBoundingClientRect().height + 24 : 72;
  const scrollMarker = window.scrollY + toolbarOffset;
  let activeId: string | null = null;

  for (const anchor of anchors) {
    const headingElement = document.getElementById(anchor.id);
    if (!headingElement) {
      continue;
    }

    if (headingElement.offsetTop <= scrollMarker) {
      activeId = anchor.id;
    } else {
      break;
    }
  }

  return activeId ?? anchors[0].id;
}

function refreshTocPaneSelection() {
  if (!tocPaneController) {
    return;
  }

  const filtered = tocAnchors.filter(a => a.level <= tocMaxDepth);
  const activeId = getActiveTocHeadingId(filtered);
  tocPaneController.update(
    filtered.map(anchor => ({
      ...anchor,
      isActive: activeId !== null && anchor.id === activeId,
    }))
  );
}

function formatLastUpdated(timestamp: number): string {
  if (timestamp === 0) return '';
  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return formatter.format(date);
}

function calculateReadingTime(words: number): string {
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

function updateEditorMetaBar(currentEditor: Editor | null) {
  if (!editorMetaBar || !currentEditor) {
    return;
  }

  // Find or create the stats text span (separate from buttons)
  let statsSpan = editorMetaBar.querySelector('.editor-meta-stats') as HTMLSpanElement | null;
  if (!statsSpan) {
    statsSpan = document.createElement('span');
    statsSpan.className = 'editor-meta-stats';
    // Insert at the beginning, before any buttons
    editorMetaBar.insertBefore(statsSpan, editorMetaBar.firstChild);
  }

  const words = currentEditor.storage.characterCount?.words?.() ?? 0;
  const readingTime = calculateReadingTime(words);
  const lastUpdated = formatLastUpdated(lastUserEditTime);

  if (lastUpdated) {
    statsSpan.textContent = `Updated: ${lastUpdated}  •  ${words} words  •  ${readingTime}`;
  } else {
    statsSpan.textContent = `${words} words  •  ${readingTime}`;
  }
}

const scheduleTocPaneSelectionRefresh = rafThrottle(refreshTocPaneSelection);

function setDocDirty(dirty: boolean) {
  docDirty = dirty;
  (window as any).__docDirty = dirty;
  window.dispatchEvent(new CustomEvent('documentDirtyChange', { detail: { dirty } }));
  updateToolbarStates();
}
let updateTimeout: number | null = null;
let lastUserEditTime = 0; // Track when user last edited
let fileModifiedTime = 0; // File modification time from disk (set by extension)
let pendingInitialContent: string | null = null; // Content from host before editor is ready
let hasSentReadySignal = false;
let isDomReady = document.readyState !== 'loading';

// Hash-based sync deduplication (replaces unreliable ignoreNextUpdate boolean)
let lastSentContentHash: string | null = null;
let lastSentTimestamp = 0;

// Store frontmatter separately to preserve it during TipTap parsing
let currentFrontmatter: string | null = null;

/**
 * Extract YAML frontmatter from markdown content.
 * Matches: --- YAML content --- optionally followed by newline(s) then other content
 */
function extractAndStoreFrontmatter(markdown: string): {
  content: string;
  frontmatter: string | null;
} {
  if (!markdown.startsWith('---')) {
    return { content: markdown, frontmatter: null };
  }

  // Match: ^--- then newline, then any content, then newline ---
  // Supports LF (\n), CRLF (\r\n)
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return { content: markdown, frontmatter: null };
  }

  const frontmatter = match[1];
  const contentStartIdx = match[0].length;
  const content = markdown.substring(contentStartIdx);

  return { content, frontmatter };
}

/**
 * Restore frontmatter to the beginning of markdown content
 */
function restoreFrontmatter(markdown: string, frontmatter: string | null): string {
  if (!frontmatter) {
    return markdown;
  }
  // Trim leading newlines from markdown to ensure only 1 blank line after closing ---
  const trimmedMarkdown = markdown.replace(/^\n+/, '');
  return `---\n${frontmatter}\n---\n${trimmedMarkdown}`;
}

/**
 * Parse YAML frontmatter text into key-value pairs.
 * Handles simple scalar assignments: `key: value` and `key : value` (spaces around colon).
 * Values containing colons (e.g. URLs) are handled by splitting only on the first colon.
 * Lines without a colon are skipped.
 */
function parseFrontmatterPairs(frontmatter: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).trim();
    const value = line.substring(colonIdx + 1).trim();
    if (!key) continue;
    pairs.push([key, value]);
  }
  return pairs;
}

/**
 * Update the VIEW FRONTMATTER button in the editor meta bar.
 * Shows as a tiny link in the upper right when frontmatter is present.
 */
/**
 * Update the VIEW FRONTMATTER button in the editor meta bar.
 * Shows as a tiny link in the upper right when frontmatter is present.
 */
function updateFrontmatterViewButton(frontmatter: string | null): void {
  const metaBar = editorMetaBar as HTMLElement | null;
  if (!metaBar) {
    console.log('[DK-AI] updateFrontmatterViewButton: editorMetaBar not found');
    return;
  }

  // Remove any existing frontmatter button
  const existing = metaBar.querySelector('.frontmatter-view-btn');
  if (existing) {
    existing.remove();
  }

  // Only show button if frontmatter exists
  if (!frontmatter || !frontmatter.trim()) {
    console.log('[DK-AI] updateFrontmatterViewButton: no frontmatter to show');
    return;
  }

  console.log('[DK-AI] updateFrontmatterViewButton: creating button for frontmatter');

  // Create the button
  const button = document.createElement('button');
  button.className = 'frontmatter-view-btn';
  button.textContent = 'VIEW FRONTMATTER';
  button.title = 'Click to edit document front matter';
  button.type = 'button';

  // Wire click handler
  button.addEventListener('click', async e => {
    e.preventDefault();
    e.stopPropagation();
    await openFrontmatterEditor();
  });

  // Add to meta bar
  metaBar.appendChild(button);
  console.log('[DK-AI] updateFrontmatterViewButton: button added to meta bar', {
    metaBar,
    button,
    buttonText: button.textContent,
  });
}

/**
 * Update the frontmatter panel above the editor with key-value badges.
 * Panel is always hidden — metadata is edited via the View menu instead.
 * @deprecated Frontmatter panel is no longer displayed. Use View > Display > Edit Document Metadata instead.
 */
function updateFrontmatterPanel(frontmatter: string | null): void {
  const panel = document.getElementById('frontmatter-panel');
  if (!panel) return;
  const inner = panel.querySelector('.frontmatter-panel-inner') as HTMLElement | null;
  if (!inner) return;

  // Always keep the panel hidden — frontmatter is now accessed via View menu
  panel.style.display = 'none';
  inner.innerHTML = '';

  // Update the VIEW FRONTMATTER button
  updateFrontmatterViewButton(frontmatter);

  // Broadcast to React Inspector
  window.dispatchEvent(new CustomEvent('gptAiFrontmatterSync', { detail: { frontmatter } }));
}

/**
 * Inject a `frontmatterBlock` TipTap node at position 0 containing the given
 * YAML text inside a codeBlock child.  Call this after `setContent()` whenever
 * the document has YAML front matter.
 *
 * The block renders as a `<details class="frontmatter-details">` element.
 * Its `renderMarkdown` returns '' so it is invisible to the serializer;
 * `restoreFrontmatter()` prepends the YAML block on every save.
 */

/**
 * Read the current YAML text from the `frontmatterBlock` node (if present) and
 * update the module-level `currentFrontmatter` variable.  Called from `onUpdate`
 * so that edits the user makes inside the block are persisted to the file on save.
 */

/**
 * Simple hash function (djb2 algorithm) for content deduplication
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
  }
  return hash.toString(36);
}

/**
 * Generate short request IDs used to correlate save logs between webview and extension host.
 */
function createRequestId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const signalReady = () => {
  if (hasSentReadySignal) return;
  getActiveBridge().postMessage({ type: MessageType.READY });
  hasSentReadySignal = true;
};

/**
 * Explicitly request a fresh document/settings sync from extension host.
 * Used as a recovery path when webview is visible but editor DOM is blank.
 */
function requestHostResync(reason: string) {
  console.warn('[DK-AI][RECOVERY] Requesting host resync:', reason);
  getActiveBridge().postMessage({ type: MessageType.READY });
}

function isEditorDomBlank(): boolean {
  const root = document.querySelector('#editor') as HTMLElement | null;
  if (!root) return true;
  if (!root.querySelector('.ProseMirror')) return true;
  if (editor && editor.state.doc.content.size > 0) return false;
  const proseMirrorText = root.textContent?.trim() || '';
  return proseMirrorText.length === 0;
}

function scheduleBlankEditorRecovery(trigger: string) {
  setTimeout(() => {
    if (document.visibilityState !== 'visible') return;
    if (!isEditorDomBlank()) return;

    console.warn('[DK-AI][RECOVERY] Blank editor detected after', trigger);
    requestHostResync(`blank-editor-${trigger}`);
  }, 120);
}

/**
 * Track content we're about to send to prevent echo updates
 */
const trackSentContent = (content: string) => {
  lastSentContentHash = hashString(content);
  lastSentTimestamp = Date.now();
};

const pushOutlineUpdate = () => {
  if (!editor) return;
  try {
    const outline = buildOutlineFromEditor(editor);
    getActiveBridge().postMessage({ type: MessageType.OUTLINE_UPDATED, outline });
  } catch (error) {
    console.warn('[DK-AI] Failed to build outline:', error);
  }
};

const scheduleOutlineUpdate = debounce(pushOutlineUpdate, 250);

/**
 * Immediately send update (used for save shortcuts)
 */
function immediateUpdate() {
  if (!editor) return;
  saveDocument();
}

/**
 * Explicitly save the document — sends content to extension and triggers VS Code save.
 * This is the ONLY path through which webview edits reach the file system.
 */
function saveDocument() {
  if (!editor) return;

  try {
    // Clear any pending debounced update
    if (updateTimeout) {
      clearTimeout(updateTimeout);
      updateTimeout = null;
    }

    const markdown = getEditorMarkdownForSync(editor, { compressTables, trimBlankLines });
    const plainTextLength = editor.getText().trim().length;
    const saveRequestId = createRequestId('save');
    const contentHash = hashString(markdown);

    if (markdown.length === 0 && plainTextLength > 0) {
      const details = {
        requestId: saveRequestId,
        plainTextLength,
        docSize: editor.state.doc.content.size,
      };
      console.error(
        '[DK-AI] Serialization produced empty markdown for non-empty document',
        details
      );
      reportWebviewIssue(
        'error',
        '[SAVE] Serialization produced empty markdown for non-empty document; save blocked to prevent data loss',
        details
      );
      showRuntimeErrorToUser(
        'save-serialization-empty',
        'Save blocked: serialization returned empty output for a non-empty document. Please share editor logs with support.'
      );
      return;
    }

    trackSentContent(restoreFrontmatter(markdown, currentFrontmatter));

    devLog(
      `[DK-AI][SAVE][${saveRequestId}] Dispatching saveAndEdit (len=${markdown.length}, hash=${contentHash})`
    );

    // Send combined edit and save to avoid race conditions
    getActiveBridge().postMessage({
      type: MessageType.SAVE_AND_EDIT,
      content: restoreFrontmatter(markdown, currentFrontmatter),
      requestId: saveRequestId,
    });
    // Let the VS Code side send the 'saved' event to clear the dirty state
  } catch (error) {
    console.error('[DK-AI] Error saving document:', error);
    reportWebviewIssue('error', '[SAVE] Exception while preparing save payload', {
      error: toErrorMessage(error),
    });
    showRuntimeErrorToUser(
      'save-exception',
      'Save failed while preparing document content.',
      error
    );
  }
}

// Expose saveDocument globally for toolbar button
(window as any).saveDocument = saveDocument;

/**
 * Open the frontmatter editor modal.
 * Called by the toolbar button.
 */
async function openFrontmatterEditor(): Promise<void> {
  try {
    // Lazy-load the modal module to avoid circular dependencies
    const { showFrontmatterModal } = await import('./features/frontmatterModal');

    await showFrontmatterModal(currentFrontmatter, (newFrontmatter: string) => {
      // Update the stored frontmatter
      currentFrontmatter = newFrontmatter || null;

      // Update the panel UI
      updateFrontmatterPanel(currentFrontmatter);

      // Trigger a document edit to mark as dirty and sync
      if (editor) {
        const markdown = getEditorMarkdownForSync(editor, { compressTables, trimBlankLines });
        const withFrontmatter = restoreFrontmatter(markdown, currentFrontmatter);

        // Send the update to VS Code
        getActiveBridge().postMessage({
          type: MessageType.EDIT,
          content: withFrontmatter,
        });
        trackSentContent(withFrontmatter);
      }
    });
  } catch (error) {
    console.error('[DK-AI] Error opening frontmatter editor:', error);
    showRuntimeErrorToUser('frontmatter-editor-error', 'Failed to open frontmatter editor.');
  }
}

// Expose globally for toolbar button
(window as any).openFrontmatterEditor = openFrontmatterEditor;

// Allow React Inspector to open the frontmatter modal via custom event
window.addEventListener('gptAiOpenFrontmatterEditor', () => {
  void openFrontmatterEditor();
});

/**
 * Show or create the inline frontmatter block in the editor.
 * Called by the toolbar "Frontmatter" button in BubbleMenuView.ts.
 */
function toggleFrontmatterBlock(): void {
  openFrontmatterEditor();
}

// Expose globally for toolbar button
(window as any).toggleFrontmatterBlock = toggleFrontmatterBlock;

/**
 * Debounced update sending edits to VS Code
 * This ensures the VS Code TextDocument is marked dirty and can be saved naturally
 */
function debouncedUpdate(markdown: string) {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }

  updateTimeout = window.setTimeout(() => {
    try {
      devLog(`[DK-AI] debouncedUpdate firing for ${markdown.length} chars...`);
      if (editor && markdown.length === 0 && editor.getText().trim().length > 0) {
        const details = {
          plainTextLength: editor.getText().trim().length,
          docSize: editor.state.doc.content.size,
        };
        console.error(
          '[DK-AI] Debounced sync produced empty markdown for non-empty document',
          details
        );
        reportWebviewIssue(
          'error',
          '[SYNC] Debounced sync produced empty markdown for non-empty document; sync skipped',
          details
        );
        showRuntimeErrorToUser(
          'sync-serialization-empty',
          'Auto-sync skipped because serialization returned empty output for non-empty content.'
        );
        updateTimeout = null;
        return;
      }
      // Check if any images are currently being saved
      if (hasPendingImageSaves()) {
        const count = getPendingImageCount();
        devLog(`[DK-AI] Delaying document sync - ${count} image(s) still being saved`);
        // Re-queue the update
        debouncedUpdate(markdown);
        return;
      }

      getActiveBridge().postMessage({
        type: MessageType.EDIT,
        content: restoreFrontmatter(markdown, currentFrontmatter),
      });
      updateTimeout = null;
      trackSentContent(restoreFrontmatter(markdown, currentFrontmatter));
    } catch (error) {
      console.error('[DK-AI] Error in debounced update:', error);
    }
  }, 300);
}

/**
 * Initialize TipTap editor with error handling
 */
function initializeEditor(initialContent: string) {
  try {
    if (editor) {
      console.warn('[DK-AI] Editor already initialized, skipping re-init');
      return;
    }

    const editorElement = document.querySelector('#editor') as HTMLElement;
    if (!editorElement) {
      console.error('[DK-AI] Editor element not found');
      return;
    }

    const body = document.body;
    let layout = body.querySelector('.editor-layout') as HTMLElement | null;
    if (!layout) {
      layout = document.createElement('div');
      layout.className = 'editor-layout';

      const tocMount = document.createElement('div');
      tocMount.className = 'toc-pane-mount';

      const editorSurface = document.createElement('div');
      editorSurface.className = 'editor-surface';

      body.appendChild(layout);
      layout.appendChild(tocMount);
      layout.appendChild(editorSurface);

      editorMetaBar = document.createElement('div');
      editorMetaBar.className = 'editor-meta-bar';
      editorSurface.appendChild(editorMetaBar);

      editorSurface.appendChild(editorElement);
    } else if (!editorMetaBar) {
      editorMetaBar = layout.querySelector('.editor-meta-bar') as HTMLElement | null;
      if (!editorMetaBar) {
        const editorSurface = layout.querySelector('.editor-surface') as HTMLElement | null;
        if (editorSurface) {
          editorMetaBar = document.createElement('div');
          editorMetaBar.className = 'editor-meta-bar';
          editorSurface.appendChild(editorMetaBar);
        }
      }
    }

    const tocMount = layout.querySelector('.toc-pane-mount') as HTMLElement;

    if (!floatingBarController) {
      floatingBarController = createFloatingFormattingBar(() => editor);
      floatingFormattingBar = floatingBarController.element;
      // Start hidden — the BubbleMenu plugin will show it when shouldShow returns true
      floatingFormattingBar.style.visibility = 'hidden';
      floatingFormattingBar.style.opacity = '0';
      document.body.appendChild(floatingFormattingBar);
    }

    if (!floatingMenuElement) {
      floatingMenuElement = createEmptyLineMenu(() => editor);
      document.body.appendChild(floatingMenuElement);
    }

    devLog('[DK-AI] Initializing editor...');

    const normalizeExtensionPluginList = (extension: any) => {
      if (!extension || typeof extension.extend !== 'function') return extension;

      return extension.extend({
        addProseMirrorPlugins(this: any) {
          const baseResult = this.parent?.();

          if (baseResult == null) return [];
          if (Array.isArray(baseResult)) return baseResult;

          console.warn(
            '[DK-AI] Normalized non-array plugin return for extension:',
            extension.name || this.name || 'unknown'
          );
          return [baseResult];
        },
      });
    };

    const rawExtensions = [
      // Mermaid must be before CodeBlockShiki to intercept mermaid code blocks
      Mermaid,
      // Must be before CodeBlockShiki to intercept indented "code" tokens containing images
      IndentedImageCodeBlock,
      // Fallback: treat standalone image lines with spaces in the path as images.
      SpaceFriendlyImagePaths,
      // GitHubAlerts must be before StarterKit to intercept alert blockquotes
      GitHubAlerts,
      Highlight.extend({
        // Disable ==text== markdown tokenizer — only <mark> HTML is supported.
        // Any ==text== in a document should be treated as plain text.
        markdownTokenizer: undefined,
        addInputRules() {
          return [];
        },
        addPasteRules() {
          return [];
        },
        renderMarkdown(node: any, h: any) {
          return `<mark>${h.renderChildren(node)}</mark>`;
        },
      }).configure({
        HTMLAttributes: {
          class: 'highlight',
        },
      }),
      Typography,
      Placeholder.configure({
        placeholder: 'Start writing markdown...',
        emptyEditorClass: 'is-editor-empty',
        emptyNodeClass: 'is-empty',
        showOnlyCurrent: false,
      }),
      CharacterCount,
      GenericHTMLInline,
      GenericHTMLBlock,
      HtmlCommentInline,
      HtmlCommentBlock,
      CustomTextStyle,
      TextColorMark,
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        paragraph: true,
        codeBlock: false, // Disable default CodeBlock, using CodeBlockWithUi instead
        // ListKit is registered separately to support task lists; disable StarterKit's list
        // extensions to avoid duplicate names (which can break markdown parsing, e.g. `1)` lists).
        bulletList: false,
        orderedList: false,
        listItem: false,
        taskList: false,
        taskItem: false,
        listKeymap: false,
        // Disable StarterKit's Link - we configure our own with shouldAutoLink validation
        link: false,
        // In Tiptap v3, 'history' was renamed to 'undoRedo'
        undoRedo: {
          depth: 100,
        },
      } as any),
      CodeBlockWithUi.configure({
        lowlight: createLowlight(common),
        defaultLanguage: 'plaintext',
        HTMLAttributes: {
          class: 'code-block-highlighted',
        },
      }),
      WikiLink,
      WikiLinkSuggest,
      Markdown.configure({
        // Pass a fresh isolated Marked instance to prevent marked@17 inline token
        // corruption. When the taskList block tokenizer (from @tiptap/extension-list)
        // calls lexer.inlineTokens() internally, it corrupts the global marked singleton's
        // inline tokenizer state. All subsequent tokens (tables, blockquotes, bullet lists)
        // end up with empty tokens:[]. Using a fresh instance scopes the tokenizer
        // registration and lexer state to this instance, preventing cross-contamination.
        // The Marked class instance satisfies all properties actually used by MarkdownManager
        // (setOptions, use, lexer, Lexer) but TypeScript doesn't see it as typeof marked
        // because marked is typed as a function+namespace, not a class instance.
        marked: (() => {
          const m = new Marked();
          m.use({ extensions: [wikilinkMarkedExtension] });
          return m;
        })() as unknown as typeof markedInstance,
        markedOptions: {
          gfm: true, // GitHub Flavored Markdown for tables, task lists
          breaks: true, // Preserve single newlines as <br>
        },
      }),
      // Custom Table extension that handles <br> correctly and
      // teaches ProseMirror's DOMParser to look inside <thead>/<tbody>/<tfoot>
      // for content rows (browsers auto-insert <tbody> during DOM parsing,
      // which would otherwise cause literal "<tbody>" text in cells).
      // Table registration: we extend the base Table node for custom
      // markdown serialization and HTML parsing.
      Table.extend({
        renderMarkdown(node, h) {
          return renderTableToMarkdownWithBreaks(node, h);
        },
        parseHTML() {
          return [
            {
              tag: 'table',
              contentElement(node: HTMLElement) {
                node.querySelectorAll(':scope > colgroup').forEach(el => el.remove());
                const sections = node.querySelectorAll(
                  ':scope > thead, :scope > tbody, :scope > tfoot'
                );
                for (const section of Array.from(sections)) {
                  while (section.firstChild) {
                    node.insertBefore(section.firstChild, section);
                  }
                  section.remove();
                }
                return node;
              },
            },
          ];
        },
      }).configure({
        resizable: true,
        HTMLAttributes: {
          class: 'markdown-table',
        },
      }),
      // Use TableKit only for row and header registration.
      // We disable its 'table' and 'tableCell' node to avoid duplicate registration.
      TableKit.configure({
        table: false,
        tableCell: false,
      }),
      TableCell.extend({
        content: 'block+',
      }),
      BulletList.extend({
        addInputRules() {
          return [];
        },
      }),
      ListKit.configure({
        bulletList: false,
        orderedList: false,
        taskList: false, // Registered separately below with custom HTMLAttributes
        taskItem: false, // Replaced by TaskItemClipboardFix below
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItemClipboardFix.configure({ nested: true }),
      OrderedListMarkdownFix,
      TabIndentation, // Enable Tab/Shift+Tab for list indentation
      ImageBoundaryNav, // Handle Enter key around images at boundaries
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'markdown-link',
        },
        shouldAutoLink,
      }).extend({
        // Override inclusive: the default returns `this.options.autolink` (true),
        // which makes the mark extend when typing at the boundary (BUG-B4).
        // Setting to false ensures typed characters after a link don't get absorbed.
        inclusive() {
          return false;
        },
      }),
      CustomImage.configure({
        allowBase64: true, // Allow base64 for preview
        HTMLAttributes: {
          class: 'markdown-image',
        },
      }),
      ImageUploadPlugin,
      BubbleMenuExtension.configure({
        element: floatingFormattingBar as HTMLElement,
        shouldShow: ({ editor: currentEditor, state }) => {
          // Respect configuration toggle
          if (!showSelectionToolbar) return false;
          // Suppress during initial editor creation to prevent flash
          if (!editorFullyInitialized) return false;
          const { from, to, empty } = state.selection;
          // Never show when selection is empty or collapsed
          if (empty || from === to) return false;
          // Don't show for node selections (images, code blocks, etc.)
          if (state.selection.constructor.name === 'NodeSelection') return false;
          // Don't show for cell selections (grids of cells)
          if (state.selection instanceof CellSelection) return false;
          return currentEditor.isEditable;
        },
        options: {
          placement: 'top',
          offset: 8,
          shift: { padding: 8 },
        },
        updateDelay: 100,
      }),
      TableOfContents.configure({
        anchorTypes: ['heading'],
        scrollParent: () => window,
        onUpdate: (anchors: TableOfContentData) => {
          if (!tocPaneController) return;

          const normalizedAnchors: TocPaneAnchor[] = anchors.map(anchor => ({
            id: anchor.id,
            textContent: anchor.textContent,
            level: anchor.originalLevel || anchor.level,
            itemIndex: anchor.itemIndex,
            pos: anchor.pos,
            isActive: anchor.isActive,
          }));

          tocAnchors = normalizedAnchors;
          scheduleTocPaneSelectionRefresh();
        },
      }),
      SearchAndReplace,
      CommandRegistry,
      TableBulletListSmart,
      AiExplain,
      SpellCheck,
      // Focus — adds .has-focus CSS class to the shallowest focused block node
      Focus.configure({ className: 'has-focus', mode: 'shallowest' }),
      // FloatingMenu — shows an action bar on empty lines
      FloatingMenuExtension.configure({
        element: floatingMenuElement as HTMLElement,
        shouldShow: ({ editor: currentEditor, state }) => {
          const { $from, empty } = state.selection;
          if (!empty || !currentEditor.isEditable) return false;
          const parent = $from.parent;
          return parent.type.name === 'paragraph' && parent.content.size === 0;
        },
      }),
      // FileHandler — intercepts dropped .md files and inserts their content
      FileHandler.configure({
        allowedMimeTypes: ['text/plain', 'text/markdown'],
        onDrop: (currentEditor, files, pos) => {
          for (const file of files) {
            const name = file.name.toLowerCase();
            if (!name.endsWith('.md') && !name.endsWith('.markdown')) continue;
            const reader = new FileReader();
            reader.onload = () => {
              const content = reader.result as string;
              currentEditor.chain().focus().insertContentAt(pos, content).run();
            };
            reader.readAsText(file);
          }
        },
      }),
      // Front matter support with collapsible details panel
    ];

    const extensions = rawExtensions.map(normalizeExtensionPluginList);

    const editorInstance = new Editor({
      element: editorElement,
      extensions,
      // Don't pass content here - we'll set it after init with contentType: 'markdown'
      editorProps: {
        attributes: {
          class: 'markdown-editor',
          spellcheck: 'true',
        },
        // Route file/image drops and pastes through the image drop handler (FR-004).
        // Returns true when the handler owns the event (prevents ProseMirror default).
        handleDrop: (view, event, slice, moved) => imageDragDropHandler(view, event, slice, moved),
        handlePaste: (view, event, slice) => imagePasteHandler(view, event, slice),
      },
      onUpdate: ({ editor: _editor }) => {
        if (isUpdating) return;

        try {
          // Track when user last edited
          lastUserEditTime = Date.now();

          // Mark document dirty (don't auto-send to extension)
          if (!docDirty) {
            setDocDirty(true);
          }

          scheduleOutlineUpdate();
          updateEditorMetaBar(_editor);

          // Sync front matter from the inline details block (if the user edited it)

          const markdown = getEditorMarkdownForSync(_editor, { compressTables, trimBlankLines });
          devLog(`[DK-AI] onUpdate: markdown serialized (len=${markdown.length})`);
          debouncedUpdate(markdown);
        } catch (error) {
          console.error('[DK-AI] Error in onUpdate:', error);
        }
      },
      onSelectionUpdate: ({ editor }) => {
        try {
          const { from, to, empty } = editor.state.selection;
          // Send position for outline tracking + selected text for Copilot/external access
          const selectedText = empty ? '' : editor.state.doc.textBetween(from, to, '\n\n', '\n');
          getActiveBridge().postMessage({
            type: MessageType.SELECTION_CHANGE,
            pos: from,
            from,
            to,
            selectedText,
          });
          updateActiveLinkPreview(editor);
        } catch (error) {
          console.warn('[DK-AI] Selection update failed:', error);
        }
      },
      onFocus: () => {
        // Signal focus to enable focus-requiring toolbar buttons
        window.dispatchEvent(new CustomEvent('editorFocusChange', { detail: { focused: true } }));
      },
      onBlur: () => {
        // Focus change is handled via relatedTarget in editorDom listener to allow toolbar interaction
      },
      onCreate: () => {
        devLog('[DK-AI] Editor created successfully');
        updateEditorMetaBar(editorInstance);
      },
      onDestroy: () => {
        devLog('[DK-AI] Editor destroyed');
      },
    });

    editor = editorInstance;
    floatingBarController?.refresh();
    updateEditorMetaBar(editorInstance);

    tocPaneController = createTocPane({
      mount: tocMount,
      onNavigate: anchor => {
        scrollToHeading(editorInstance, anchor.pos);
        scheduleTocPaneSelectionRefresh();
      },
    });
    // Restore outline pane visibility from persisted state (default: visible)
    const savedOutlineVisible = localStorage.getItem('gptAiOutlinePaneVisible');
    tocPaneController.setVisible(savedOutlineVisible !== 'false');

    const onWindowScroll = () => {
      scheduleTocPaneSelectionRefresh();
    };

    const onWindowResize = () => {
      scheduleTocPaneSelectionRefresh();
    };

    window.addEventListener('scroll', onWindowScroll, { passive: true });
    window.addEventListener('resize', onWindowResize);

    // Set initial content as markdown (Tiptap v3 requires explicit contentType)
    if (initialContent) {
      // Extract and store frontmatter before passing to TipTap.
      // TipTap would interpret `key: value\n---` as a setext H2 heading otherwise.
      const { content, frontmatter } = extractAndStoreFrontmatter(initialContent);
      if (frontmatter) {
        currentFrontmatter = frontmatter;
        updateFrontmatterPanel(frontmatter);
      }

      // Seed the "Updated" timestamp with the file's modification time (or now if not available)
      lastUserEditTime = fileModifiedTime || Date.now();

      // Prevent onUpdate from firing during initialization
      isUpdating = true;
      editor.commands.setContent(preprocessMarkdownContent(content), {
        contentType: 'markdown',
      });
      // Inject front matter as a collapsible atom block at the top

      isUpdating = false;

      // Refresh meta bar now that we have both the timestamp and correct word count
      updateEditorMetaBar(editorInstance);
    }

    // Create and insert formatting toolbar at top
    formattingToolbar = createFormattingToolbar(editorInstance);
    const editorContainer = document.querySelector('.editor-layout') as HTMLElement;
    if (editorContainer && editorContainer.parentElement) {
      editorContainer.parentElement.insertBefore(formattingToolbar, editorContainer);
    }

    window.addEventListener('aiPromptsLoaded', () => {
      if (formattingToolbar && formattingToolbar.parentElement) {
        const h = formattingToolbar.getBoundingClientRect().height;
        const next = createFormattingToolbar(editorInstance);
        formattingToolbar.parentElement.replaceChild(next, formattingToolbar);
        formattingToolbar = next;
        document.documentElement.style.setProperty('--toolbar-height', `${h}px`);
      }
    });

    // Publish toolbar height as CSS variable so the TOC pane can track it
    requestAnimationFrame(() => {
      if (formattingToolbar) {
        const h = formattingToolbar.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--toolbar-height', `${h}px`);
      }
    });

    // Track editor focus state for toolbar and keep toolbar enabled while interacting with it
    const editorDom = editorInstance.view.dom;
    editorDom.addEventListener('focus', () => {
      window.dispatchEvent(new CustomEvent('editorFocusChange', { detail: { focused: true } }));
    });
    editorDom.addEventListener('blur', (event: FocusEvent) => {
      const relatedTarget = event.relatedTarget as HTMLElement | null;
      const stayingInToolbar = Boolean(
        relatedTarget &&
        (relatedTarget === editorDom ||
          formattingToolbar?.contains(relatedTarget) ||
          relatedTarget.closest('.emoji-picker-overlay') ||
          relatedTarget.closest('.toolbar-color-menu'))
      );

      if (stayingInToolbar) {
        return;
      }

      // relatedTarget can be null; wait a tick to see where focus actually lands
      setTimeout(() => {
        const activeElement = document.activeElement as HTMLElement | null;
        if (
          activeElement &&
          (activeElement === editorDom ||
            formattingToolbar?.contains(activeElement) ||
            activeElement.closest('.emoji-picker-overlay') ||
            activeElement.closest('.toolbar-color-menu'))
        ) {
          return;
        }
        window.dispatchEvent(new CustomEvent('editorFocusChange', { detail: { focused: false } }));
      }, 0);
    });

    // Create context menus
    textContextMenuCtrl = createContextMenu(editorInstance);
    tableContextMenuCtrl = createTableContextMenu(editorInstance);
    imageContextMenuCtrl = createImageContextMenu(editorInstance, (window as any).vscode);

    // Setup image drag & drop handling
    setupImageDragDrop(editorInstance, (window as any).vscode);
    setupFileLinkDrop(editorInstance, (window as any).vscode);

    // Initial outline push
    pushOutlineUpdate();
    try {
      const { from } = editorInstance.state.selection;
      getActiveBridge().postMessage({ type: MessageType.SELECTION_CHANGE, pos: from });
    } catch (error) {
      console.warn('[DK-AI] Initial selection sync failed:', error);
    }

    // Store handler references for cleanup on editor destroy
    const contextMenuHandler = (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement;
        const imageEl = target.closest('img.markdown-image') as HTMLImageElement | null;
        const tableCell = target.closest('td, th');

        // Hide both menus first
        textContextMenuCtrl?.hide();
        tableContextMenuCtrl?.hide();
        imageContextMenuCtrl?.hide();

        if (imageEl && target.closest('.ProseMirror')) {
          e.preventDefault();
          const pos = editorInstance.view.posAtDOM(imageEl, 0);
          const imagePath =
            imageEl.getAttribute('data-markdown-src') || imageEl.getAttribute('src') || '';
          imageContextMenuCtrl?.show(
            e.clientX,
            e.clientY,
            imageEl,
            pos,
            isExternalImage(imagePath)
          );
        } else if (tableCell && editorInstance.isActive('table')) {
          e.preventDefault();
          const hit = editorInstance.view.posAtCoords({ left: e.clientX, top: e.clientY });
          const pos = hit ? hit.pos : editorInstance.state.selection.from;
          tableContextMenuCtrl?.show(e.clientX, e.clientY, pos);
        } else if (target.closest('.ProseMirror')) {
          // Check for spell-error decoration first
          if (tryShowSpellMenu(e, editorInstance, (window as any).vscode)) {
            return; // Spell menu shown — skip generic context menu
          }
          e.preventDefault();
          textContextMenuCtrl?.show(e.clientX, e.clientY);
        }
      } catch (error) {
        console.error('[DK-AI] Error in context menu:', error);
      }
    };

    const documentClickHandler = () => {
      textContextMenuCtrl?.hide();
      tableContextMenuCtrl?.hide();
      imageContextMenuCtrl?.hide();
    };

    // Handle keyboard shortcuts
    const keydownHandler = createKeydownHandler({
      getEditor: () => editor,
      immediateUpdate,
    });

    // Register handlers
    document.addEventListener('contextmenu', contextMenuHandler);
    document.addEventListener('click', documentClickHandler);
    document.addEventListener('keydown', keydownHandler);

    // Add link click handler: click = edit dialog, Ctrl/Cmd+click = navigate
    const handleLinkClick = createLinkClickHandler(() => editorInstance, (window as any).vscode);

    // Add click handler to editor DOM
    editorInstance.view.dom.addEventListener('click', handleLinkClick);

    // Clean up listeners when editor is destroyed to prevent memory leaks
    editorInstance.on('destroy', () => {
      document.removeEventListener('contextmenu', contextMenuHandler);
      document.removeEventListener('click', documentClickHandler);
      document.removeEventListener('keydown', keydownHandler);
      editorInstance.view.dom.removeEventListener('click', handleLinkClick);
      cleanupClipboard();
      window.removeEventListener('scroll', onWindowScroll);
      window.removeEventListener('resize', onWindowResize);
      scheduleTocPaneSelectionRefresh.cancel();
      scheduleOutlineUpdate.cancel();
      tocAnchors = [];
      floatingBarController?.destroy();
      floatingFormattingBar?.remove();
      floatingBarController = null;
      floatingFormattingBar = null;
      textContextMenuCtrl?.destroy();
      textContextMenuCtrl = null;
      tableContextMenuCtrl?.destroy();
      tableContextMenuCtrl = null;
      imageContextMenuCtrl?.destroy();
      imageContextMenuCtrl = null;
      tocPaneController?.destroy();
      tocPaneController = null;
      // Clean up custom event listeners registered at module scope
      for (const [eventName, handler] of customEventCleanup) {
        window.removeEventListener(eventName, handler);
      }
      devLog('[DK-AI] Editor destroyed, global listeners cleaned up');
    });

    devLog('[DK-AI] Editor initialization complete');
    // Allow floating bar to show after init settles (prevents flash on open)
    setTimeout(() => {
      editorFullyInitialized = true;
      // Request bulk file list for slash command cache
      getActiveBridge().postMessage({ type: MessageType.GET_WORKSPACE_FILES });
    }, 400);
  } catch (error) {
    console.error('[DK-AI] Fatal error initializing editor:', error);
    showRuntimeErrorToUser('editor-init-fatal', 'Editor failed to initialize.', error);
    const editorElement = document.querySelector('#editor') as HTMLElement;
    if (editorElement) {
      editorElement.innerHTML = `
        <div style="color: red; padding: 20px; font-family: monospace;">
          <h3>Error Loading Editor</h3>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
          <p>Please check the Debug Console for details.</p>
        </div>
      `;
    }
  }
}

/**
 * Helper to apply all webview configuration settings from extension messages.
 */
function applyWebviewSettings(message: any) {
  if (typeof message.skipResizeWarning === 'boolean') {
    (window as any).skipResizeWarning = message.skipResizeWarning;
  }
  if (typeof message.imagePath === 'string') {
    (window as any).imagePath = message.imagePath;
  }
  if (typeof message.mediaPath === 'string') {
    (window as any).mediaPath = message.mediaPath;
  }
  if (typeof message.mediaPathBase === 'string') {
    (window as any).mediaPathBase = message.mediaPathBase;
  }
  if (typeof message.imagePathBase === 'string') {
    (window as any).imagePathBase = message.imagePathBase;
  }
  if (typeof message.developerMode === 'boolean') {
    window.gptaiDeveloperMode = message.developerMode;
  }

  if (typeof message.tocMaxDepth === 'number') {
    tocMaxDepth = message.tocMaxDepth;
    scheduleTocPaneSelectionRefresh();
  }

  if (typeof message.preserveHtmlComments === 'boolean') {
    setPreserveHtmlComments(message.preserveHtmlComments);
  }

  if (typeof message.editorWidth === 'number') {
    // Set the CSS custom property for editor max-width
    // The value is in pixels 800–2560px range (enforced at VS Code settings level)
    document.documentElement.style.setProperty('--md-editor-width', `${message.editorWidth}px`);
  }

  if (typeof message.showSelectionToolbar === 'boolean') {
    showSelectionToolbar = message.showSelectionToolbar;
    // Immediately hide the floating toolbar when the setting is turned off,
    // rather than waiting for the next selection change to re-evaluate shouldShow.
    if (!showSelectionToolbar && floatingFormattingBar) {
      floatingFormattingBar.style.visibility = 'hidden';
      floatingFormattingBar.style.opacity = '0';
      floatingFormattingBar.remove();
    }
  }

  if (typeof message.editorZoomLevel === 'number') {
    setEditorZoom(message.editorZoomLevel, false);
  }

  if (typeof message.modelDisplayName === 'string') {
    (window as any).__dkAiModelDisplayName = message.modelDisplayName;
  }

  if (typeof message.imageModelDisplayName === 'string') {
    (window as any).__dkAiImageModelDisplayName = message.imageModelDisplayName;
  }

  if (message.themeOverride) {
    if (typeof (window as any).gptAiApplyTheme === 'function') {
      (window as any).gptAiApplyTheme(message.themeOverride);
    }
    window.dispatchEvent(new CustomEvent('themeChange'));
  }

  if (typeof message.knowledgeGraphEnabled === 'boolean') {
    (window as any).knowledgeGraphEnabled = message.knowledgeGraphEnabled;
  }

  if (typeof message.compressTables === 'boolean') {
    compressTables = message.compressTables;
  }
  if (typeof message.trimBlankLines === 'boolean') {
    trimBlankLines = message.trimBlankLines;
  }
}

/**
 * Handle messages from extension
 */
window.addEventListener('message', (event: MessageEvent) => {
  try {
    const message = event.data;

    switch (message.type) {
      case MessageType.UPDATE: {
        applyWebviewSettings(message);

        // Store the file's modification time from the extension
        if (message.fileModifiedTime) {
          fileModifiedTime = message.fileModifiedTime;
        }

        // Initialize editor with first payload to seed undo history correctly
        if (!editor) {
          if (isDomReady) {
            initializeEditor(message.content);
          } else {
            pendingInitialContent = message.content;
          }
          return;
        }

        updateEditorContent(message.content);
        break;
      }
      case MessageType.SETTINGS_UPDATE: {
        applyWebviewSettings(message);
        break;
      }

      case MessageType.NAVIGATE_TO_HEADING: {
        if (!editor) return;
        const pos = message.pos as number;
        scrollToHeading(editor, pos);
        break;
      }
      case MessageType.FILE_SEARCH_RESULTS: {
        import('./features/linkDialog').then(({ handleFileSearchResults }) => {
          const results = message.results as Array<{ filename: string; path: string }>;
          const requestId = message.requestId as number;
          handleFileSearchResults(results, requestId);
        });
        break;
      }
      case MessageType.FILE_HEADINGS_RESULT: {
        import('./features/linkDialog').then(({ handleFileHeadingsResult }) => {
          const headings = message.headings as Array<{ text: string; level: number; slug: string }>;
          const requestId = message.requestId as number;
          handleFileHeadingsResult(headings, requestId);
        });
        break;
      }
      case MessageType.MARKDOWN_FILES_RESULT: {
        // Populate the save button dropdown with markdown files
        const files = (message.files as Array<{ name: string; path: string }>) || [];
        const dropdownMenu = (window as any).__saveDropdownMenu as HTMLElement;

        if (dropdownMenu) {
          // Find and remove existing markdown file items (after "Quick Open" label)
          const quickOpenLabel = Array.from(
            dropdownMenu.querySelectorAll('.toolbar-dropdown-section-label')
          ).find(el => el.textContent === 'Quick Open');

          if (quickOpenLabel) {
            // Remove all items after the "Quick Open" label
            let next = quickOpenLabel.nextElementSibling;
            while (next && !next.classList.contains('toolbar-dropdown-section-label')) {
              const toRemove = next;
              next = next.nextElementSibling;
              toRemove.remove();
            }

            // Add file items
            files.forEach(file => {
              const fileItem = document.createElement('button');
              fileItem.type = 'button';
              fileItem.className = 'toolbar-dropdown-item';
              fileItem.title = file.name;
              fileItem.setAttribute('aria-label', file.name);

              // Format display name: remove .md, replace underscores/hyphens with spaces, capitalize words
              const displayName = file.name
                .replace(/\.md$/i, '') // Remove .md extension
                .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');

              fileItem.textContent = displayName;
              fileItem.onclick = e => {
                e.preventDefault();
                e.stopPropagation();
                getActiveBridge().postMessage({
                  type: MessageType.SAVE_AND_OPEN_FILE,
                  filePath: file.path,
                });
                // Close dropdown
                closeAllDropdowns();
              };
              dropdownMenu.appendChild(fileItem);
            });
          }
        }
        break;
      }
      case MessageType.EXPORT_RESULT:
        if (message.success) {
          getActiveBridge().postMessage({
            type: MessageType.SHOW_INFO,
            message: 'Document exported successfully!',
          });
        } else {
          getActiveBridge().postMessage({
            type: MessageType.SHOW_ERROR,
            message: `Export failed: ${message.error}`,
          });
        }
        break;
      case MessageType.FOAM_BACKLINKS_UPDATE:
        window.dispatchEvent(
          new CustomEvent('gptAiBacklinksUpdate', { detail: { backlinks: message.backlinks } })
        );
        break;
      case MessageType.NOTE_LIST_RESULT:
        if (Array.isArray(message.notes)) {
          updateCachedNoteList(message.notes);
        }
        break;
      case MessageType.SAVED:
        if (typeof message.requestId === 'string') {
          devLog(`[DK-AI][SAVE][${message.requestId}] Received "saved" signal from extension`);
        } else {
          devLog('[DK-AI] Received "saved" signal from extension');
        }
        setDocDirty(false);
        break;
      case MessageType.AI_REFINE_RESULT:
        if (editor) {
          handleAiRefineResult(editor, message as any);
        }
        break;
      case MessageType.AI_EXPLAIN_RESULT:
        handleAiExplainResult(message as any);
        break;
      case MessageType.AI_EXPLAIN_CHUNK:
        handleAiExplainChunk(message as any);
        break;
      case MessageType.AI_EXPLAIN_DONE:
        handleAiExplainDone(message as any);
        break;
      case MessageType.AI_PROMPTS:
        (window as any).handleAiPromptsResult?.(message.prompts);
        break;
      case MessageType.IMAGE_ASK_RESULT:
        handleImageAskResult(message as any);
        break;
      case MessageType.WORKSPACE_FILES_RESULT:
        if (message.results) {
          fileCache.setFiles(message.results);
        }
        break;
      case MessageType.INSERT_EMOJI:
        if (editor && typeof message.emoji === 'string') {
          editor.chain().focus().insertContent(message.emoji).run();
        }
        break;
      case MessageType.SET_OUTLINE_VISIBLE:
        if (tocPaneController && typeof message.visible === 'boolean') {
          // When restoring (visible=true), respect the user's persisted preference
          const targetVisible = message.visible
            ? localStorage.getItem('gptAiOutlinePaneVisible') !== 'false'
            : false;
          tocPaneController.setVisible(targetVisible);
        }
        break;
      case MessageType.IMAGE_URI_RESOLVED:
        // Handled by the custom image message plugin; ignore here to avoid log noise.
        break;
      case MessageType.FRONTMATTER_VALIDATE:
        // Validate YAML front matter on save
        if (!editor) break;
        try {
          const yaml = message.yaml || '';
          const parsed = YAML.load(yaml);
          getActiveBridge().postMessage({
            type: MessageType.FRONTMATTER_VALIDATION_RESULT,
            success: true,
            yaml,
            parsed,
            timestamp: Date.now(),
          });
        } catch (error) {
          const err = error as Error;
          getActiveBridge().postMessage({
            type: MessageType.FRONTMATTER_VALIDATION_RESULT,
            success: false,
            yaml: message.yaml || '',
            error: err.message,
            errorLine: (err as any).mark?.line || 0,
            timestamp: Date.now(),
          });
        }
        break;
      case MessageType.FRONTMATTER_SAVE_OVERRIDE:
        // Handle user's decision on malformed YAML save
        if (message.override === 'save-anyway') {
          // Proceed with save despite validation error
          if (editor) {
            const markdown = getEditorMarkdownForSync(editor, { compressTables, trimBlankLines });
            getActiveBridge().postMessage({
              type: MessageType.UPDATE,
              content: markdown,
              override: true,
            });
          }
        } else if (message.override === 'return-to-fix') {
          // User wants to return to editor (no action needed)
          getActiveBridge().postMessage({
            type: MessageType.READY,
          });
        }
        break;
      case MessageType.FRONTMATTER_ERROR:
        // Display front matter validation error dialog
        devLog('[DK-AI] Front matter error:', message.error);
        break;
      case MessageType.SPELL_INIT:
        void initSpellCheck(
          message as unknown as { affUrl: string; dicUrl: string; userWords: string[] }
        );
        break;
      case MessageType.SPELL_RELOAD:
        reloadUserWords((message.userWords as string[]) ?? []);
        break;
      default:
        console.warn('[DK-AI] Unknown message type:', message.type);
    }
  } catch (error) {
    console.error('[DK-AI] Error handling message:', error);
  }
});

/**
 * Update editor content from document with cursor preservation
 */
function updateEditorContent(markdown: string) {
  if (!editor) {
    console.error('[DK-AI] Editor not initialized');
    return;
  }

  try {
    // Hash-based deduplication: skip if this is content we just sent
    const incomingHash = hashString(markdown);
    if (incomingHash === lastSentContentHash) {
      // Also check timestamp to allow legitimate identical content after a delay
      const timeSinceLastSend = Date.now() - lastSentTimestamp;
      if (timeSinceLastSend < 2000) {
        devLog('[DK-AI] Ignoring update (matches content we just sent)');
        return;
      }
    }

    // Don't update if user edited recently (within 2 seconds)
    const timeSinceLastEdit = Date.now() - lastUserEditTime;
    if (timeSinceLastEdit < 2000) {
      devLog(`[DK-AI] Skipping update - user recently edited (${timeSinceLastEdit}ms ago)`);
      return;
    }

    isUpdating = true;

    const startTime = performance.now();
    const docSize = markdown.length;

    devLog(`[DK-AI] Updating content (${docSize} chars)...`);

    // Always extract frontmatter from incoming content — TipTap must never see it because
    // `key: value\n---` is interpreted as a setext H2 heading (markdown spec).
    // Only update currentFrontmatter if frontmatter was found; don't clobber the stored
    // value with null on echo updates that arrive without the frontmatter block.
    const { content: incomingBody, frontmatter: extractedFrontmatter } =
      extractAndStoreFrontmatter(markdown);
    if (extractedFrontmatter) {
      currentFrontmatter = extractedFrontmatter;
      updateFrontmatterPanel(extractedFrontmatter);
    }

    // Compare body content only (both without frontmatter) to avoid spurious re-renders
    // caused by the frontmatter block that TipTap never serializes back.
    const currentMarkdown = getEditorMarkdownForSync(editor, { compressTables, trimBlankLines });
    if (currentMarkdown === incomingBody) {
      devLog('[DK-AI] Update skipped (content unchanged)');
      return;
    }

    // Save cursor position
    const { from, to } = editor.state.selection;
    devLog(`[DK-AI] Saving cursor position: ${from}-${to}`);

    // Set content (without frontmatter, so TipTap doesn't render it as setext H2)
    editor.commands.setContent(preprocessMarkdownContent(incomingBody), {
      contentType: 'markdown',
    });

    // Inject front matter as a collapsible atom block at the top

    // Restore cursor position
    try {
      editor.commands.setTextSelection({ from, to });
      devLog(`[DK-AI] Restored cursor position: ${from}-${to}`);
    } catch {
      devLog('[DK-AI] Could not restore cursor position (document too short)');
      // If exact position fails, move to end of document
      const endPos = editor.state.doc.content.size;
      editor.commands.setTextSelection(Math.min(from, endPos));
    }

    pushOutlineUpdate();

    const duration = performance.now() - startTime;
    devLog(`[DK-AI] Content updated in ${duration.toFixed(2)}ms`);

    if (duration > 1000) {
      console.warn(`[DK-AI] Slow update: ${duration.toFixed(2)}ms for ${docSize} chars`);
    }
  } catch (error) {
    console.error('[DK-AI] Error updating content:', error);
    console.error('[DK-AI] Document size:', markdown.length, 'chars');
  } finally {
    isUpdating = false;
  }
}

// Initialize when DOM is ready and content is available
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    isDomReady = true;
    signalReady();

    if (!editor && pendingInitialContent !== null) {
      initializeEditor(pendingInitialContent);
      pendingInitialContent = null;
    }
  });
} else {
  isDomReady = true;
  signalReady();
  if (!editor && pendingInitialContent !== null) {
    initializeEditor(pendingInitialContent);
    pendingInitialContent = null;
  }
}

// Recovery hooks: if the webview is reclaimed from hidden state and appears blank,
// request host re-sync rather than leaving user with an empty editor.
window.addEventListener('focus', () => {
  scheduleBlankEditorRecovery('focus');
});
window.addEventListener('pageshow', () => {
  scheduleBlankEditorRecovery('pageshow');
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    scheduleBlankEditorRecovery('visible');
  }
});

// Handle custom event for TOC pane toggle from toolbar button
const handleToggleTocPane = () => {
  if (!editor || !tocPaneController) {
    return;
  }
  tocPaneController.toggle();
  localStorage.setItem('gptAiOutlinePaneVisible', String(tocPaneController.isVisible()));
  updateToolbarStates();
};
window.addEventListener('toggleTocPane', handleToggleTocPane);
// Backward compatibility for older toolbar event name
window.addEventListener('toggleTocOutline', handleToggleTocPane);

// Set up clipboard handlers (copy, paste, copyAsMarkdown)
const cleanupClipboard = setupClipboardHandlers(() => editor);

const handleExportTableCsv = () => {
  if (!editor) {
    return;
  }

  const matrix = getCurrentTableMatrix(editor.state);
  if (!matrix) {
    getActiveBridge().postMessage({
      type: MessageType.SHOW_ERROR,
      message: 'Place the cursor inside a table before exporting CSV.',
    });
    return;
  }

  getActiveBridge().postMessage({
    type: MessageType.EXPORT_TABLE_CSV,
    csv: serializeTableMatrix(matrix, ','),
  });
};
window.addEventListener('exportTableCsv', handleExportTableCsv);

// Handle open source view from toolbar button
const handleOpenSourceView = () => {
  devLog('[DK-AI] Opening source view...');
  getActiveBridge().postMessage({ type: MessageType.OPEN_SOURCE_VIEW });
};
window.addEventListener('openSourceView', handleOpenSourceView);

// Handle settings button from toolbar -> open VS Code settings UI
const handleOpenExtensionSettings = () => {
  getActiveBridge().postMessage({ type: MessageType.OPEN_EXTENSION_SETTINGS });
};
window.addEventListener('openExtensionSettings', handleOpenExtensionSettings);

// Handle setting updates from toolbar (e.g., zoom level persistence)
const handleUpdateSetting = (event: Event) => {
  const detail = (event as CustomEvent).detail;
  if (detail?.key && detail?.value !== undefined) {
    getActiveBridge().postMessage({
      type: MessageType.UPDATE_SETTING,
      key: detail.key,
      value: detail.value,
    });
  }
};
window.addEventListener('updateSetting', handleUpdateSetting);

// Handle attachments button from toolbar -> open attachments folder in OS explorer
const handleOpenAttachmentsFolder = () => {
  getActiveBridge().postMessage({ type: MessageType.OPEN_ATTACHMENTS_FOLDER });
};
window.addEventListener('openAttachmentsFolder', handleOpenAttachmentsFolder);

// Handle export document from toolbar button
const handleExportDocument = async (event: Event) => {
  if (!editor) return;

  const customEvent = event as CustomEvent;
  const format = customEvent.detail?.format || 'pdf';

  devLog(`[DK-AI] Exporting document as ${format}...`);

  try {
    // Collect content and convert Mermaid to PNG
    const exportData = await collectExportContent(editor);
    const title = getDocumentTitle(editor);

    // Send to extension for export
    getActiveBridge().postMessage({
      type: MessageType.EXPORT_DOCUMENT,
      format,
      html: exportData.html,
      mermaidImages: exportData.mermaidImages,
      title,
    });
  } catch (error) {
    console.error('[DK-AI] Export failed:', error);
    getActiveBridge().postMessage({
      type: MessageType.SHOW_ERROR,
      message: 'Failed to prepare document for export. See console for details.',
    });
  }
};
window.addEventListener('exportDocument', handleExportDocument);

/**
 * Collect all named custom-event listeners for cleanup on editor destroy.
 */
const customEventCleanup: Array<[string, EventListener]> = [
  ['toggleTocPane', handleToggleTocPane],
  ['toggleTocOutline', handleToggleTocPane],
  ['exportTableCsv', handleExportTableCsv],
  ['openSourceView', handleOpenSourceView],
  ['openExtensionSettings', handleOpenExtensionSettings],
  ['updateSetting', handleUpdateSetting as EventListener],
  ['openAttachmentsFolder', handleOpenAttachmentsFolder],
  ['exportDocument', handleExportDocument as EventListener],
];

// Global error handler
window.addEventListener('error', event => {
  console.error('[DK-AI] Uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', event => {
  console.error('[DK-AI] Unhandled promise rejection:', event.reason);
});

// Testing hooks (not used in production UI)
export const __testing = {
  setMockEditor(mockEditor: any) {
    editor = mockEditor;
  },
  updateEditorContentForTests(markdown: string) {
    return updateEditorContent(markdown);
  },
  trackSentContentForTests(content: string) {
    trackSentContent(content);
  },
  getLastSentContentHash() {
    return lastSentContentHash;
  },
  resetSyncState() {
    lastSentContentHash = null;
    lastSentTimestamp = 0;
  },
  resetFrontmatterForTests() {
    currentFrontmatter = null;
  },
  extractAndStoreFrontmatterForTests(markdown: string) {
    return extractAndStoreFrontmatter(markdown);
  },
  restoreFrontmatterForTests(markdown: string, frontmatter: string | null) {
    return restoreFrontmatter(markdown, frontmatter);
  },
  parseFrontmatterPairsForTests(frontmatter: string) {
    return parseFrontmatterPairs(frontmatter);
  },
};
