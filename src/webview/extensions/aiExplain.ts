/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * AI Explain extension – generates a simplified summary/explanation of the
 * current document similar to browser reading modes (Edge/Chrome).
 * Sends the document text to the extension host which calls the VS Code LM API.
 *
 * Streaming results are received as AI_EXPLAIN_CHUNK messages and rendered
 * incrementally via the unified aiExplain-unified component.
 *
 * @module aiExplain
 */

import { Extension } from '@tiptap/core';
import { MessageType } from '../../shared/messageTypes';
import {
  createStreamingHandler,
  getPanelEl,
  setPanelEl,
  setTitle,
  setFooterModel,
  showLoadingState,
  showErrorState,
  setStopButtonVisible,
  setLastResponseText,
  showActions,
  removeActionsBar,
  renderMarkdown,
} from './aiExplain-unified';

let isLoading = false;
/** Reference to the TipTap editor for document mutations (set by the extension). */
let editorRef: any = null;
/** Active streaming handler — replaced on each new request. */
let activeStreamHandler: ReturnType<typeof createStreamingHandler> | null = null;

function getVscodeApi(): any {
  return (window as any).vscode;
}

/**
 * Read the current model display name from the webview's config bridge.
 */
function getCurrentModelName(): string {
  return (window as any).__dkAiModelDisplayName ?? '';
}

function getCurrentImageModelName(): string {
  return (window as any).__dkAiImageModelDisplayName ?? '';
}

function showExplainPanel() {
  const modelName = getCurrentModelName();
  let panelEl = getPanelEl();

  if (panelEl) {
    panelEl.style.display = 'flex';
    showLoadingState('Analyzing document\u2026');
    if (modelName) setFooterModel(modelName);
    return;
  }

  panelEl = document.createElement('div');
  panelEl.className = 'ai-explain-panel';

  panelEl.innerHTML = `
    <div class="ai-explain-header">
      <span class="ai-explain-title">AI Summary</span>
      <button type="button" class="ai-explain-stop" title="Stop" style="display:none">&#x25A0;</button>
      <button type="button" class="ai-explain-close" title="Close">&times;</button>
    </div>
    <div class="ai-explain-body">
      <div class="ai-explain-loading">
        <div class="ai-explain-spinner"></div>
        <span>Analyzing document\u2026</span>
      </div>
    </div>
    <div class="ai-explain-footer">${modelName}</div>
  `;

  document.body.appendChild(panelEl);
  setPanelEl(panelEl);

  panelEl.querySelector('.ai-explain-close')?.addEventListener('click', () => {
    hideExplainPanel();
  });

  panelEl.querySelector('.ai-explain-stop')?.addEventListener('click', () => {
    // Abort in-flight stream
    getVscodeApi()?.postMessage({ type: MessageType.AI_EXPLAIN_STOP });
    if (activeStreamHandler) {
      const currentText =
        panelEl?.querySelector('.ai-explain-markdown')?.textContent ?? '';
      activeStreamHandler.onDone(currentText);
      activeStreamHandler = null;
    }
    setStopButtonVisible(false);
    isLoading = false;
  });
}

function hideExplainPanel() {
  const panelEl = getPanelEl();
  if (panelEl) panelEl.style.display = 'none';
}

/** Action labels for the panel title. */
const IMAGE_ASK_TITLES: Record<string, string> = {
  explain: 'Explain Image',
  altText: 'Generate Alt Text',
  extractText: 'Extract Text',
  describe: 'Describe Image',
  custom: 'Ask About Image',
};

/**
 * Show the explain panel in image-ask mode with a loading spinner.
 */
export function showImageAskLoading(action: string): void {
  showExplainPanel();
  setTitle(IMAGE_ASK_TITLES[action] || 'Image Analysis');
  showLoadingState('Analyzing image\u2026');
  setFooterModel(getCurrentImageModelName());
  removeActionsBar();

  // Prepare a streaming handler for the image result
  activeStreamHandler = createStreamingHandler(() => {
    isLoading = false;
  });
}

/**
 * Handle an IMAGE_ASK_RESULT message from the extension host.
 */
export function handleImageAskResult(data: {
  success: boolean;
  action: string;
  response?: string;
  error?: string;
  modelName?: string;
}): void {
  if (data.modelName) setFooterModel(data.modelName);

  if (!data.success || !data.response) {
    activeStreamHandler?.onError(data.error || 'Could not analyze image.');
    activeStreamHandler = null;
    isLoading = false;
    return;
  }

  setLastResponseText(data.response);
  // Image results arrive as a single payload — render directly
  activeStreamHandler?.onDone(data.response);
  activeStreamHandler = null;

  showActions(data.action, editorRef);
}

/**
 * Handle the AI_EXPLAIN_CHUNK message — incremental text chunk from extension host.
 */
export function handleAiExplainChunk(data: { text: string; fullText: string }): void {
  if (!activeStreamHandler) return;
  setStopButtonVisible(true);
  activeStreamHandler.onChunk(data.fullText);
}

/**
 * Handle the AI_EXPLAIN_DONE message — stream complete.
 */
export function handleAiExplainDone(data: { fullText: string; modelName?: string }): void {
  if (data.modelName) setFooterModel(data.modelName);
  setLastResponseText(data.fullText);
  activeStreamHandler?.onDone(data.fullText);
  activeStreamHandler = null;
  isLoading = false;
  showActions('summary', editorRef);
}

/**
 * Handle the legacy AI_EXPLAIN_RESULT message (error path only going forward).
 */
export function handleAiExplainResult(data: {
  success: boolean;
  explanation?: string;
  error?: string;
  modelName?: string;
}): void {
  if (data.modelName) setFooterModel(data.modelName);

  if (!data.success || !data.explanation) {
    activeStreamHandler?.onError(data.error || 'Could not generate explanation.');
    if (!activeStreamHandler) showErrorState(data.error || 'Could not generate explanation.');
    activeStreamHandler = null;
    isLoading = false;
    return;
  }

  // Fallback: non-streaming result (render immediately)
  setLastResponseText(data.explanation);
  const html = `<div class="ai-explain-markdown">${renderMarkdown(data.explanation)}</div>`;
  const body = getPanelEl()?.querySelector('.ai-explain-body');
  if (body) body.innerHTML = html;
  isLoading = false;
  showActions('summary', editorRef);
}

export const AiExplain = Extension.create({
  name: 'aiExplain',

  onCreate() {
    editorRef = this.editor;
  },

  addCommands() {
    return {
      explainDocument:
        () =>
        ({ editor }) => {
          if (isLoading) return false;
          isLoading = true;

          showExplainPanel();
          setTitle('AI Summary');
          setStopButtonVisible(false);
          removeActionsBar();

          // Get full document text
          const docText = editor.state.doc.textContent;
          if (!docText.trim()) {
            showErrorState('Document is empty.');
            isLoading = false;
            return false;
          }

          // Set up streaming handler before sending request
          activeStreamHandler = createStreamingHandler(() => {
            isLoading = false;
          });

          const vscode = getVscodeApi();
          if (!vscode) {
            activeStreamHandler.onError('VS Code API not available.');
            activeStreamHandler = null;
            isLoading = false;
            return false;
          }

          vscode.postMessage({
            type: MessageType.AI_EXPLAIN,
            documentText: docText,
          });

          return true;
        },
    };
  },
});

export default AiExplain;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiExplain: {
      explainDocument: () => ReturnType;
    };
  }
}
