/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { outlineViewProvider } from '../features/outlineView';
import {
  setActiveWebviewPanel,
  getActiveWebviewPanel,
  setSelectedText,
  setActiveDocumentUri,
  setSelectionRange,
} from '../activeWebview';
import { handleAiRefineRequest } from '../features/aiRefine';
import { handleAiExplainRequest } from '../features/aiExplain';
import { getNonce } from './utils';
import { MessageType } from '../shared/messageTypes';
import { toErrorMessage } from '../shared/errorUtils';
import { createMessageRouter, type MessageRouter, type HandlerContext } from './messageRouter';
import { registerImageHandlers } from './handlers/imageHandlers';
import { registerFileHandlers } from './handlers/fileHandlers';
import { registerUiHandlers } from './handlers/uiHandlers';
import { DocumentSync } from './handlers/documentSync';
import { getImageBasePath } from './utils/pathUtils';

/**
 * Parse an image filename to extract source prefix
 * Returns the source prefix (dropped_ or pasted_) if present, or null
 */
export function parseImageSourcePrefix(filename: string): string | null {
  // Check for source prefix: dropped_ or pasted_
  const sourcePattern = /^(dropped_|pasted_)/;
  const match = filename.match(sourcePattern);
  return match ? match[1] : null;
}

/**
 * Build an image filename from components, optionally including a dimensions suffix.
 *
 * Note: manual renames should use `buildImageFilenameForUserRename()` instead so we
 * don't auto-add dimensions or source prefixes based on config.
 *
 * @deprecated Use `buildImageFilenameForUserRename()` for rename and
 *             `updateFilenameDimensions()` for resize flows.
 */
export function buildImageFilenameForRename(
  sourcePrefix: string | null,
  name: string,
  dimensions: { width: number; height: number } | null,
  extension: string,
  includeDimensions: boolean
): string {
  const source = sourcePrefix || '';
  if (!includeDimensions || !dimensions) {
    return `${source}${name}.${extension}`;
  }
  return `${source}${name}_${dimensions.width}x${dimensions.height}px.${extension}`;
}

/**
 * Build an image filename for a user-initiated rename.
 *
 * Rules:
 * - Do not auto-add dimensions.
 * - Do not auto-add or preserve a `dropped_`/`pasted_` prefix.
 * - Treat the user-provided name as authoritative.
 *
 * @param userProvidedName - The new name from the rename dialog (without extension)
 * @param extension - File extension (with or without leading dot)
 */
export function buildImageFilenameForUserRename(
  userProvidedName: string,
  extension: string
): string {
  const normalizedExtension = extension.startsWith('.') ? extension.slice(1) : extension;
  const dot = normalizedExtension ? '.' : '';
  return `${userProvidedName}${dot}${normalizedExtension}`;
}

/**
 * Update dimensions in an image filename while preserving other components.
 *
 * When `includeDimensions` is enabled:
 * - Keep any existing `dropped_`/`pasted_` prefix.
 * - Add/update the `{width}x{height}px` suffix (and remove legacy timestamp formats).
 *
 * When `includeDimensions` is disabled:
 * - Strip BOTH the `dropped_`/`pasted_` prefix and the `{width}x{height}px` suffix.
 * - Keep the base name and extension.
 */
export function updateFilenameDimensions(
  filename: string,
  newWidth: number,
  newHeight: number,
  includeDimensions: boolean = true
): string {
  const extWithDot = path.extname(filename);
  const filenameWithoutExt = extWithDot ? filename.slice(0, -extWithDot.length) : filename;

  const sourcePrefix = parseImageSourcePrefix(filename) || '';
  const filenameWithoutPrefix = sourcePrefix
    ? filenameWithoutExt.slice(sourcePrefix.length)
    : filenameWithoutExt;

  // Old pattern with timestamp: {name}_{timestamp}_{width}x{height}px
  const oldTimestampMatch = filenameWithoutPrefix.match(/^(.+?)_\d{13}_(\d+)x(\d+)px$/);
  if (oldTimestampMatch) {
    const coreName = oldTimestampMatch[1];
    if (!includeDimensions) {
      return `${coreName}${extWithDot}`;
    }
    return `${sourcePrefix}${coreName}_${newWidth}x${newHeight}px${extWithDot}`;
  }

  // New pattern (no timestamp): {name}_{width}x{height}px
  const newPatternMatch = filenameWithoutPrefix.match(/^(.+?)_(\d+)x(\d+)px$/);
  if (newPatternMatch) {
    const coreName = newPatternMatch[1];
    if (!includeDimensions) {
      return `${coreName}${extWithDot}`;
    }
    return `${sourcePrefix}${coreName}_${newWidth}x${newHeight}px${extWithDot}`;
  }

  // Legacy format without dimensions: {name}-{timestamp}
  const legacyMatch = filenameWithoutPrefix.match(/^(.+?)-\d{13}$/);
  if (legacyMatch) {
    const coreName = legacyMatch[1];
    if (!includeDimensions) {
      return `${coreName}${extWithDot}`;
    }
    return `${sourcePrefix}${coreName}_${newWidth}x${newHeight}px${extWithDot}`;
  }

  // Unparseable filename.
  // If dimensions are disabled, still strip any existing source prefix and keep the name.
  if (!includeDimensions) {
    return `${filenameWithoutPrefix}${extWithDot}`;
  }

  // Append dimensions to filename when enabled.
  return `${sourcePrefix}${filenameWithoutPrefix}_${newWidth}x${newHeight}px${extWithDot}`;
}

/**
 * Custom Text Editor Provider for Markdown files
 * Provides WYSIWYG editing using TipTap in a webview
 */
export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly CONFIG_SECTION = 'gptAiMarkdownEditor';

  /** Document sync — edit queuing, feedback-loop prevention, frontmatter handling. */
  readonly sync = new DocumentSync(() => this.getWebviewSettings());

  /** Central message router — handler modules register here. */
  readonly router: MessageRouter = createMessageRouter();

  /**
   * Read a single configuration value under the extension's config section.
   */
  private getConfig<T>(key: string, defaultValue: T): T {
    return vscode.workspace
      .getConfiguration()
      .get<T>(`${MarkdownEditorProvider.CONFIG_SECTION}.${key}`, defaultValue);
  }

  /**
   * Helper to retrieve all webview-related configuration settings.
   */
  private getWebviewSettings() {
    return {
      mediaPath: this.getConfig<string>('mediaPath', 'media'),
      mediaPathBase: this.getConfig<string>('mediaPathBase', 'sameNameFolder'),
      themeOverride: this.getConfig<string>('themeOverride', 'light'),
      developerMode: this.getConfig<boolean>('developerMode', true),
      tocMaxDepth: this.getConfig<number>('tocMaxDepth', 3),
      preserveHtmlComments: this.getConfig<boolean>('preserveHtmlComments', false),
      editorZoomLevel: this.getConfig<number>('editorZoomLevel', 1),
      editorWidth: this.getConfig<number>('editorWidth', 1920),
      showSelectionToolbar: this.getConfig<boolean>('showSelectionToolbar', false),
    };
  }

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new MarkdownEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      'gptAiMarkdownEditor.editor',
      provider,
      {
        webviewOptions: {
          enableFindWidget: true,
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    );
    return providerRegistration;
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    registerImageHandlers(this.router);
    registerFileHandlers(this.router);
    registerUiHandlers(this.router);
  }

  /**
   * Called when our custom editor is opened
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // AC-3: Check if user has set a default markdown viewer preference
    // If set to 'vscode', they want to use VS Code's default markdown preview instead
    const config = vscode.workspace.getConfiguration();
    const defaultViewer = config.get<string | null>('gptAiMarkdownEditor.defaultMarkdownViewer');

    // AC-3: If default is explicitly set to 'vscode', handle appropriately
    if (defaultViewer === 'vscode') {
      // User prefers VS Code default - could optionally show message or open default preview
      // For now, we still open with our editor but respect the setting preference
      // Future: Could integrate with VS Code's native markdown preview
    }

    // AC-3: If default is 'dk-ai' or not set, proceed with DK-AI editor

    // Setup webview options
    // Allow loading resources from extension and the workspace folder containing the document
    let workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    // For untitled files, getWorkspaceFolder may not work, so check workspaceFolders
    if (
      !workspaceFolder &&
      document.uri.scheme === 'untitled' &&
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
    ) {
      workspaceFolder = vscode.workspace.workspaceFolders[0];
    }
    const localResourceRoots = [this.context.extensionUri];

    if (workspaceFolder) {
      localResourceRoots.push(workspaceFolder.uri);
      // Also include parent directory to allow access to sibling directories
      // This enables markdown files to reference images in ../sibling-folder/
      const workspaceParent = path.dirname(workspaceFolder.uri.fsPath);
      if (workspaceParent && workspaceParent !== workspaceFolder.uri.fsPath) {
        localResourceRoots.push(vscode.Uri.file(workspaceParent));
      }
    } else if (document.uri.scheme === 'file') {
      // If not in a workspace but is a file, allow the document's directory
      localResourceRoots.push(vscode.Uri.file(path.dirname(document.uri.fsPath)));
    } else {
      // For untitled files without workspace, include home directory to allow absolute path image resolution
      localResourceRoots.push(vscode.Uri.file(os.homedir()));
    }

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots,
    };

    // Show warning dialog for untitled files without workspace
    // Re-check workspaceFolder here since we may have updated it above
    const finalWorkspaceFolder =
      workspaceFolder ||
      (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0]
        : undefined);
    if (document.uri.scheme === 'untitled' && !finalWorkspaceFolder) {
      const imageBasePath = getImageBasePath(document);
      if (imageBasePath) {
        vscode.window.showInformationMessage(
          `You are working without a workspace. Images will be saved to: ${imageBasePath}`
        );
      }
    }

    // Set webview HTML
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
    // Update webview when document changes
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.sync.updateWebview(document, webviewPanel.webview);
      }
    });

    // Notify webview when document is successfully saved to disk
    const saveDocumentSubscription = vscode.workspace.onDidSaveTextDocument(e => {
      if (e.uri.toString() === document.uri.toString()) {
        webviewPanel.webview.postMessage({ type: MessageType.SAVED });
      }
    });

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(
      e => this.handleWebviewMessage(e, document, webviewPanel.webview),
      null,
      this.context.subscriptions
    );

    // Track active panel
    setActiveWebviewPanel(webviewPanel);
    setActiveDocumentUri(document.uri);

    // Send initial content to webview
    this.sync.updateWebview(document, webviewPanel.webview);

    // Listen for configuration changes and update webview
    const configChangeSubscription = vscode.workspace.onDidChangeConfiguration(e => {
      if (
        e.affectsConfiguration('gptAiMarkdownEditor.mediaPath') ||
        e.affectsConfiguration('gptAiMarkdownEditor.mediaPathBase') ||
        e.affectsConfiguration('gptAiMarkdownEditor.themeOverride') ||
        e.affectsConfiguration('gptAiMarkdownEditor.developerMode') ||
        e.affectsConfiguration('gptAiMarkdownEditor.tocMaxDepth') ||
        e.affectsConfiguration('gptAiMarkdownEditor.preserveHtmlComments') ||
        e.affectsConfiguration('gptAiMarkdownEditor.editorZoomLevel') ||
        e.affectsConfiguration('gptAiMarkdownEditor.showSelectionToolbar')
      ) {
        const settings = this.getWebviewSettings();

        webviewPanel.webview.postMessage({
          type: MessageType.SETTINGS_UPDATE,
          ...settings,
        });
      }
    });

    webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.active) {
        setActiveWebviewPanel(webviewPanel);
        setActiveDocumentUri(document.uri);
      } else if (getActiveWebviewPanel() === webviewPanel) {
        setActiveWebviewPanel(undefined);
      }
    });

    // Cleanup
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      saveDocumentSubscription.dispose();
      configChangeSubscription.dispose();
      // Clean up pending edits tracking for this document
      this.sync.cleanup(document.uri.toString());
      if (getActiveWebviewPanel() === webviewPanel) {
        setActiveWebviewPanel(undefined);
      }
    });
  }

  /**
   * Handle messages from webview
   */
  private handleWebviewMessage(
    message: { type: string; [key: string]: unknown },
    document: vscode.TextDocument,
    webview: vscode.Webview
  ) {
    // Try registered handlers first (extracted domain modules)
    const ctx: HandlerContext = {
      document,
      webview,
      getConfig: <T>(key: string, defaultValue: T) => this.getConfig(key, defaultValue),
    };
    if (this.router.route(message, ctx)) {
      return;
    }

    // Fallback: inline cases not yet extracted
    switch (message.type) {
      case MessageType.UPDATE_THEME_OVERRIDE: {
        const theme = message.theme as string;
        // Save to VS Code settings for persistence
        vscode.workspace
          .getConfiguration()
          .update(
            `${MarkdownEditorProvider.CONFIG_SECTION}.themeOverride`,
            theme,
            vscode.ConfigurationTarget.Global
          );
        // Immediately apply to the webview so it takes effect right away
        webview.postMessage({
          type: MessageType.SETTINGS_UPDATE,
          themeOverride: theme,
        });
        break;
      }
      case MessageType.EDIT:
        // Enqueue edit to ensure we don't apply overlapping edits which can confuse VS Code
        void this.sync.enqueueEdit(document.uri.toString(), () =>
          this.sync.applyEdit(message.content as string, document)
        );
        break;
      case MessageType.SAVE_AND_EDIT: {
        const contentStr = (message.content as string) || '';
        const requestId =
          typeof message.requestId === 'string' && message.requestId.trim().length > 0
            ? message.requestId
            : 'save-unknown';

        void this.sync.enqueueEdit(document.uri.toString(), async () => {
          try {
            await this.sync.applyEdit(contentStr, document);
            const saved = await document.save();

            // Send signal back. We send it for 'success' (content matches) OR 'saved' (disk write).
            // This ensures the toolbar can gray out if the document state is now congruent.
            webview.postMessage({ type: MessageType.SAVED, requestId });

            // Proactive visible signal to user
            if (saved) {
              vscode.window.setStatusBarMessage('$(check) Markdown saved', 2000);
            } else {
              vscode.window.setStatusBarMessage('$(circle-slash) Markdown already saved', 2000);
            }
          } catch (err) {
            console.error(`[DK-AI][SAVE][${requestId}] Critical error in saveAndEdit:`, err);
            vscode.window.showErrorMessage(`Save failed: ${toErrorMessage(err)}`);
          }
        });
        break;
      }
      case MessageType.SAVE:
        void this.sync.enqueueEdit(document.uri.toString(), async () => {
          try {
            const saved = await document.save();
            webview.postMessage({ type: MessageType.SAVED });

            if (saved) {
              vscode.window.setStatusBarMessage('$(check) Markdown saved', 2000);
            }
          } catch (err) {
            console.error('[DK-AI] Critical error in save:', err);
          }
        });
        break;
      case MessageType.READY: {
        // Webview is ready, send initial content and settings
        // Force resync to ensure editor is populated even if host thinks it's in sync
        this.sync.updateWebview(document, webview, true);
        // Also send settings separately
        const settings = this.getWebviewSettings();

        webview.postMessage({
          type: MessageType.SETTINGS_UPDATE,
          ...settings,
        });
        break;
      }
      case MessageType.OUTLINE_UPDATED: {
        const outline = (message.outline || []) as any[];
        outlineViewProvider.setOutline(outline as any);
        break;
      }
      case MessageType.SELECTION_CHANGE: {
        const pos = message.pos as number | undefined;
        outlineViewProvider.setActiveSelection(typeof pos === 'number' ? pos : null);
        // Track selected text so Copilot and other extensions can access it
        const selText = (message.selectedText as string) ?? '';
        setSelectedText(selText);
        // Track selection range for Copilot context
        const selFrom = message.from as number | undefined;
        const selTo = message.to as number | undefined;
        if (typeof selFrom === 'number' && typeof selTo === 'number') {
          setSelectionRange(selFrom !== selTo ? { from: selFrom, to: selTo } : undefined);
        }
        break;
      }
      case MessageType.OPEN_SOURCE_VIEW:
        // Open the source file in a split view with VS Code's default text editor
        vscode.commands.executeCommand(
          'vscode.openWith',
          document.uri,
          'default',
          vscode.ViewColumn.Beside
        );
        break;
      case MessageType.OPEN_EXTENSION_SETTINGS:
        vscode.commands.executeCommand(
          'workbench.action.openSettings',
          '@ext:kamransethi.gpt-ai-markdown-editor'
        );
        break;

      case MessageType.SHOW_ERROR:
        vscode.window.showErrorMessage(message.message as string);
        break;
      case MessageType.WEBVIEW_LOG: {
        const level = typeof message.level === 'string' ? message.level : 'info';
        const text = typeof message.message === 'string' ? message.message : 'Unknown webview log';
        const details = message.details;
        if (level === 'error') {
          console.error(`[DK-AI][WEBVIEW] ${text}`, details);
        } else if (level === 'warn') {
          console.warn(`[DK-AI][WEBVIEW] ${text}`, details);
        } else {
          console.warn(`[DK-AI][WEBVIEW] ${text}`, details);
        }
        break;
      }

      case MessageType.AI_REFINE:
        void handleAiRefineRequest(webview, {
          mode: message.mode as string,
          selectedText: message.selectedText as string,
          from: message.from as number,
          to: message.to as number,
        });
        break;

      case MessageType.AI_EXPLAIN:
        void handleAiExplainRequest(webview, {
          documentText: message.documentText as string,
        });
        break;
    }
  }

  /**
   * Generate HTML for webview
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    const cacheBustToken = String(Date.now());
    const scriptUri = webview
      .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js'))
      .toString();
    const styleUri = webview
      .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.css'))
      .toString();
    const scriptUriWithVersion = `${scriptUri}${scriptUri.includes('?') ? '&' : '?'}v=${cacheBustToken}`;
    const styleUriWithVersion = `${styleUri}${styleUri.includes('?') ? '&' : '?'}v=${cacheBustToken}`;

    // Read the current theme from config
    const themeOverride = this.getConfig<string>('themeOverride', 'light');

    // Use a nonce for security
    const nonce = getNonce();

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy"
              content="default-src 'none';
                       style-src ${webview.cspSource} 'unsafe-inline';
                 script-src 'nonce-${nonce}' 'wasm-unsafe-eval' 'unsafe-eval';
                 connect-src ${webview.cspSource} https://cdn.jsdelivr.net;
                       font-src ${webview.cspSource};
                       img-src ${webview.cspSource} https: data: blob:;">
        
        <link href="${styleUriWithVersion}" rel="stylesheet">
        
        <script nonce="${nonce}">
          window.gptAiApplyTheme = function(theme) {
            try {
              const body = document.body || document.documentElement;
              const resolved = (theme === 'dark') ? 'dark' : 'light';
              body.setAttribute('data-theme', resolved);
              window.gptAiCurrentThemeOverride = resolved;

              window.dispatchEvent(
                new CustomEvent('gptAiThemeChanged', { detail: { theme: resolved } })
              );
            } catch (err) {
              console.error('[DK-AI][THEME] Failed to apply theme:', err);
            }
          };

          document.addEventListener('DOMContentLoaded', () => {
            window.gptAiApplyTheme('${themeOverride}');
          });
        </script>
        
        <title>Flux Flow Markdown Editor</title>
      </head>
      <body data-extension-version="${this.context.extension?.packageJSON?.version || ''}">
        <div id="frontmatter-panel" class="frontmatter-panel">
          <div class="frontmatter-panel-inner"></div>
        </div>
        <div id="editor"></div>
        <script nonce="${nonce}" src="${scriptUriWithVersion}"></script>
      </body>
      </html>
    `;
  }
}

/**
 * Normalize an image path by URL-decoding each path segment.
 *
 * Handles paths like:
 * - `images/Hero%20Image.png` → `images/Hero Image.png`
 * - `../assets/My%20Diagram%201.png` → `../assets/My Diagram 1.png`
 * - `./screenshots/test.png` → `./screenshots/test.png` (unchanged)
 *
 * This makes the editor tolerant of URL-encoded paths commonly found in
 * markdown imported from web tools, GitHub, or static site generators.
 *
 * @param imagePath - The raw image path from markdown src attribute
 * @returns Normalized path with URL-encoded segments decoded
 */
export function normalizeImagePath(imagePath: string): string {
  // Don't touch remote URLs, data URIs, or already-resolved webview URIs
  if (
    imagePath.startsWith('http://') ||
    imagePath.startsWith('https://') ||
    imagePath.startsWith('data:') ||
    imagePath.startsWith('vscode-webview://')
  ) {
    return imagePath;
  }

  // Handle file:// URIs by stripping the scheme and decoding
  if (imagePath.startsWith('file://')) {
    try {
      return decodeURIComponent(imagePath.replace('file://', ''));
    } catch {
      return imagePath.replace('file://', '');
    }
  }

  // Split on forward slashes, decode each segment, rejoin
  // This preserves directory structure while decoding %20, %23, etc.
  return imagePath
    .split('/')
    .map(segment => {
      if (segment === '' || segment === '.' || segment === '..') {
        return segment;
      }
      try {
        return decodeURIComponent(segment);
      } catch {
        // If decoding fails (malformed %), return segment as-is
        return segment;
      }
    })
    .join('/');
}
