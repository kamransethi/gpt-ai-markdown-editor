/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

// Import CSS files (esbuild will bundle these)
import 'prosemirror-tables/style/tables.css';
import './editor.css';
import './codicon.css';

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit, Table } from '@tiptap/extension-table';
import { TableOfContents, type TableOfContentData } from '@tiptap/extension-table-of-contents';
import { ListKit } from '@tiptap/extension-list';
import Link from '@tiptap/extension-link';
import { BubbleMenu as BubbleMenuExtension } from '@tiptap/extension-bubble-menu';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import DragHandle from '@tiptap/extension-drag-handle';
import { marked as markedInstance, Marked } from 'marked';
import { CustomImage } from './extensions/customImage';
import CodeBlockShiki from 'tiptap-extension-code-block-shiki';
import { Mermaid } from './extensions/mermaid';
import { IndentedImageCodeBlock } from './extensions/indentedImageCodeBlock';
import { SpaceFriendlyImagePaths } from './extensions/spaceFriendlyImagePaths';
import { TabIndentation } from './extensions/tabIndentation';
import { GitHubAlerts } from './extensions/githubAlerts';
import { ImageEnterSpacing } from './extensions/imageEnterSpacing';
import { MarkdownParagraph } from './extensions/markdownParagraph';
import { OrderedListMarkdownFix } from './extensions/orderedListMarkdownFix';
import { TaskItemClipboardFix } from './extensions/taskItemClipboardFix';
import { TableCellEnterHandler } from './extensions/tableCellEnterHandler';
import { GenericHTMLInline, GenericHTMLBlock } from './extensions/htmlPreservation';
import {
  HtmlCommentInline,
  HtmlCommentBlock,
  setPreserveHtmlComments,
} from './extensions/htmlComment';
import {
  createFloatingFormattingBar,
  createFormattingToolbar,
  setEditorZoom,
  updateToolbarStates,
} from './BubbleMenuView';
import { createContextMenu } from './features/contextMenu';
import { createTableContextMenu } from './features/tableContextMenu';
import { handleAiRefineResult } from './features/aiRefine';
import { TextColorMark, CustomTextStyle } from './extensions/textColor';
import { getEditorMarkdownForSync } from './utils/markdownSerialization';
import {
  setupImageDragDrop,
  hasPendingImageSaves,
  getPendingImageCount,
} from './features/imageDragDrop';
import { setupFileLinkDrop } from './features/fileLinkDrop';
import { renderTableToMarkdownWithBreaks } from './utils/tableMarkdownSerializer';
import { createTocPane, type TocPaneAnchor } from './features/tocPane';
import { setupClipboardHandlers } from './features/clipboardHandling';
import { createKeydownHandler } from './features/keyboardShortcuts';
import { createLinkClickHandler } from './features/linkHandling';
import { SearchAndReplace } from './extensions/searchAndReplace';
import { SlashCommand } from './extensions/slashCommand';
import { AiExplain, handleAiExplainResult } from './extensions/aiExplain';
import { DraggableBlocks } from './extensions/draggableBlocks';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import { getCurrentTableMatrix, serializeTableMatrix } from './utils/tableClipboard';
import { shouldAutoLink } from './utils/linkValidation';
import { buildOutlineFromEditor } from './utils/outline';
import { scrollToHeading } from './utils/scrollToHeading';
import { devLog } from './utils/devLog';
import { collectExportContent, getDocumentTitle } from './utils/exportContent';
import { MessageType } from '../shared/messageTypes';
import { toErrorMessage } from '../shared/errorUtils';
import { debounce, rafThrottle } from './utils/debounce';

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

/**
 * Strip unknown HTML tags from a string, keeping text content.
 * Converts `<mark>` → `==` for native Highlight support.
 */
function stripUnknownHtml(raw: string): string {
  let result = raw.replace(/<mark>/gi, '==').replace(/<\/mark>/gi, '==');
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\/?>/g, (tag, tagName) => {
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

const vscode = acquireVsCodeApi();

// Make vscode API available globally for toolbar buttons
window.vscode = vscode;

/**
 * Mirror webview diagnostics into extension-host logs for easier alpha troubleshooting.
 */
function reportWebviewIssue(level: 'error' | 'warn' | 'info', message: string, details?: unknown) {
  try {
    vscode.postMessage({
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

  vscode.postMessage({
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
let textContextMenuCtrl: ReturnType<typeof createContextMenu> | null = null;
let tableContextMenuCtrl: ReturnType<typeof createTableContextMenu> | null = null;
let tocPaneController: ReturnType<typeof createTocPane> | null = null;
let tocAnchors: TocPaneAnchor[] = [];
let tocMaxDepth = 3;
let highlightSyntax: 'obsidian' | 'github' = 'obsidian';
let showSelectionToolbar = false;
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

function updateEditorMetaBar(currentEditor: Editor | null) {
  if (!editorMetaBar || !currentEditor) {
    return;
  }

  const words = currentEditor.storage.characterCount?.words?.() ?? 0;
  const characters = currentEditor.storage.characterCount?.characters?.() ?? 0;
  editorMetaBar.textContent = `${words} words  •  ${characters} characters`;
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
  return `---\n${frontmatter}\n---\n${markdown}`;
}

/**
 * Safely escape text for HTML insertion to prevent XSS.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
}

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
  vscode.postMessage({ type: MessageType.READY });
  hasSentReadySignal = true;
};

/**
 * Explicitly request a fresh document/settings sync from extension host.
 * Used as a recovery path when webview is visible but editor DOM is blank.
 */
function requestHostResync(reason: string) {
  console.warn('[DK-AI][RECOVERY] Requesting host resync:', reason);
  vscode.postMessage({ type: MessageType.READY });
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
    vscode.postMessage({ type: MessageType.OUTLINE_UPDATED, outline });
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

    const markdown = getEditorMarkdownForSync(editor);
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
    vscode.postMessage({
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
        const markdown = getEditorMarkdownForSync(editor);
        const withFrontmatter = restoreFrontmatter(markdown, currentFrontmatter);

        // Send the update to VS Code
        vscode.postMessage({
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

      vscode.postMessage({
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
      editorSurface.appendChild(editorElement);

      editorMetaBar = document.createElement('div');
      editorMetaBar.className = 'editor-meta-bar';
      editorSurface.appendChild(editorMetaBar);
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
        renderMarkdown(node: any, h: any) {
          const open = highlightSyntax === 'github' ? '<mark>' : '==';
          const close = highlightSyntax === 'github' ? '</mark>' : '==';
          return `${open}${h.renderChildren(node)}${close}`;
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
      DragHandle.configure({
        render() {
          const element = document.createElement('div');
          element.classList.add('custom-drag-handle');
          element.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';
          return element;
        },
      }),
      GlobalDragHandle.configure({
        dragHandleWidth: 20,
      }),
      CustomTextStyle,
      TextColorMark,
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        paragraph: false, // Disable default paragraph, using MarkdownParagraph instead
        codeBlock: false, // Disable default CodeBlock, using CodeBlockShiki instead
        // ListKit is registered separately to support task lists; disable StarterKit's list
        // extensions to avoid duplicate names (which can break markdown parsing, e.g. `1)` lists).
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        // Disable StarterKit's Link - we configure our own with shouldAutoLink validation
        link: false,
        // In Tiptap v3, 'history' was renamed to 'undoRedo'
        undoRedo: {
          depth: 100,
        },
      }),
      MarkdownParagraph, // Custom paragraph with empty-paragraph filtering in renderMarkdown
      CodeBlockShiki.configure({
        defaultTheme: 'github-dark',
        themes: {
          light: 'github-light',
          dark: 'github-dark',
        },
        defaultLanguage: null,
        HTMLAttributes: {
          class: 'code-block-highlighted',
        },
      }),
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
        marked: new Marked() as unknown as typeof markedInstance,
        markedOptions: {
          gfm: true, // GitHub Flavored Markdown for tables, task lists
          breaks: true, // Preserve single newlines as <br>
        },
      }),
      // Custom Table extension that handles <br /> correctly and
      // teaches ProseMirror's DOMParser to look inside <thead>/<tbody>/<tfoot>
      // for content rows (browsers auto-insert <tbody> during DOM parsing,
      // which would otherwise cause literal "<tbody>" text in cells).
      Table.extend({
        renderMarkdown(node, h) {
          return renderTableToMarkdownWithBreaks(node, h);
        },
        parseHTML() {
          return [
            {
              tag: 'table',
              // Browsers auto-insert <tbody> when parsing <table> HTML via
              // innerHTML. ProseMirror's DOMParser has no rule for these
              // section wrappers so they'd leak as literal text.  Unwrap them
              // before ProseMirror reads children of the <table> element.
              contentElement(node: HTMLElement) {
                // Remove <colgroup> — only contains <col> styling hints,
                // no content for ProseMirror. Would leak as literal text.
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
      // Still use TableKit for rows and cells, but disable its internal table
      // to avoid duplicate registration of the 'table' node
      TableKit.configure({
        table: false,
      }),
      ListKit.configure({
        orderedList: false,
        taskItem: false, // Replaced by TaskItemClipboardFix below
      }),
      TaskItemClipboardFix.configure({ nested: true }),
      OrderedListMarkdownFix,
      TabIndentation, // Enable Tab/Shift+Tab for list indentation
      ImageEnterSpacing, // Handle Enter key around images and gap cursor
      TableCellEnterHandler, // Make Enter in table cells insert <br /> instead of new paragraph
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'markdown-link',
        },
        shouldAutoLink,
      }),
      CustomImage.configure({
        allowBase64: true, // Allow base64 for preview
        HTMLAttributes: {
          class: 'markdown-image',
        },
      }),
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
      SlashCommand,
      AiExplain,
      DraggableBlocks, // Custom extension for block drag handles and highlighting
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
        // Prevent default image drop handling - let our custom handler manage it
        handleDrop: (_view, event, _slice, _moved) => {
          const dt = event.dataTransfer;

          if (!dt) return false;

          // Case 1: Actual image files (from desktop/finder)
          if (dt.files && dt.files.length > 0) {
            return true; // Prevent default, our DOM handlers will manage file drops
          }

          // Case 2: VS Code file explorer drops (passes URI as text)
          // Check for text/uri-list or text/plain containing image paths
          const uriList = dt.getData('text/uri-list') || dt.getData('text/plain') || '';
          if (uriList) {
            const isFilePath =
              uriList.startsWith('file://') || /^(\.?\.\/|[A-Za-z]:\\|\/)/.test(uriList);
            if (isFilePath) {
              // This is a file path drop from VS Code - prevent TipTap's default
              // Our DOM handlers will process it
              return true;
            }
          }

          return false; // Allow default for non-image drops
        },
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

          const markdown = getEditorMarkdownForSync(_editor);
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
          vscode.postMessage({
            type: MessageType.SELECTION_CHANGE,
            pos: from,
            from,
            to,
            selectedText,
          });
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

      // Prevent onUpdate from firing during initialization
      isUpdating = true;
      editor.commands.setContent(preprocessMarkdownContent(content), {
        contentType: 'markdown',
      });
      isUpdating = false;
    }

    // Create and insert formatting toolbar at top
    formattingToolbar = createFormattingToolbar(editorInstance);
    const editorContainer = document.querySelector('.editor-layout') as HTMLElement;
    if (editorContainer && editorContainer.parentElement) {
      editorContainer.parentElement.insertBefore(formattingToolbar, editorContainer);
    }

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

    // Setup image drag & drop handling
    setupImageDragDrop(editorInstance, vscode);
    setupFileLinkDrop(editorInstance, vscode);

    // Initial outline push
    pushOutlineUpdate();
    try {
      const { from } = editorInstance.state.selection;
      vscode.postMessage({ type: MessageType.SELECTION_CHANGE, pos: from });
    } catch (error) {
      console.warn('[DK-AI] Initial selection sync failed:', error);
    }

    // Store handler references for cleanup on editor destroy
    const contextMenuHandler = (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement;
        const tableCell = target.closest('td, th');

        // Hide both menus first
        textContextMenuCtrl?.hide();
        tableContextMenuCtrl?.hide();

        if (tableCell && editorInstance.isActive('table')) {
          e.preventDefault();
          const hit = editorInstance.view.posAtCoords({ left: e.clientX, top: e.clientY });
          const pos = hit ? hit.pos : editorInstance.state.selection.from;
          tableContextMenuCtrl?.show(e.clientX, e.clientY, pos);
        } else if (target.closest('.ProseMirror')) {
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
    const handleLinkClick = createLinkClickHandler(() => editorInstance, vscode);

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

  if (typeof message.highlightSyntax === 'string') {
    highlightSyntax = message.highlightSyntax as 'obsidian' | 'github';
  }

  if (typeof message.preserveHtmlComments === 'boolean') {
    setPreserveHtmlComments(message.preserveHtmlComments);
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

  if (message.themeOverride) {
    if (typeof (window as any).gptAiApplyTheme === 'function') {
      (window as any).gptAiApplyTheme(message.themeOverride);
    }
    window.dispatchEvent(new CustomEvent('themeChange'));
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
      case MessageType.EXPORT_RESULT:
        if (message.success) {
          vscode.postMessage({
            type: MessageType.SHOW_INFO,
            message: 'Document exported successfully!',
          });
        } else {
          vscode.postMessage({
            type: MessageType.SHOW_ERROR,
            message: `Export failed: ${message.error}`,
          });
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
    const currentMarkdown = getEditorMarkdownForSync(editor);
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
    vscode.postMessage({
      type: MessageType.SHOW_ERROR,
      message: 'Place the cursor inside a table before exporting CSV.',
    });
    return;
  }

  vscode.postMessage({
    type: MessageType.EXPORT_TABLE_CSV,
    csv: serializeTableMatrix(matrix, ','),
  });
};
window.addEventListener('exportTableCsv', handleExportTableCsv);

// Handle open source view from toolbar button
const handleOpenSourceView = () => {
  devLog('[DK-AI] Opening source view...');
  vscode.postMessage({ type: MessageType.OPEN_SOURCE_VIEW });
};
window.addEventListener('openSourceView', handleOpenSourceView);

// Handle settings button from toolbar -> open VS Code settings UI
const handleOpenExtensionSettings = () => {
  vscode.postMessage({ type: MessageType.OPEN_EXTENSION_SETTINGS });
};
window.addEventListener('openExtensionSettings', handleOpenExtensionSettings);

// Handle setting updates from toolbar (e.g., zoom level persistence)
const handleUpdateSetting = (event: Event) => {
  const detail = (event as CustomEvent).detail;
  if (detail?.key && detail?.value !== undefined) {
    vscode.postMessage({ type: MessageType.UPDATE_SETTING, key: detail.key, value: detail.value });
  }
};
window.addEventListener('updateSetting', handleUpdateSetting);

// Handle attachments button from toolbar -> open attachments folder in OS explorer
const handleOpenAttachmentsFolder = () => {
  vscode.postMessage({ type: MessageType.OPEN_ATTACHMENTS_FOLDER });
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
    vscode.postMessage({
      type: MessageType.EXPORT_DOCUMENT,
      format,
      html: exportData.html,
      mermaidImages: exportData.mermaidImages,
      title,
    });
  } catch (error) {
    console.error('[DK-AI] Export failed:', error);
    vscode.postMessage({
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
