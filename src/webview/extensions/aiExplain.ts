/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * AI Explain extension – generates a simplified summary/explanation of the
 * current document similar to browser reading modes (Edge/Chrome).
 * Sends the document text to the extension host which calls the VS Code LM API.
 *
 * @module aiExplain
 */

import { Extension } from '@tiptap/core';
import { MessageType } from '../../shared/messageTypes';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiExplain: {
      explainDocument: () => ReturnType;
    };
  }
}

let panelEl: HTMLElement | null = null;
let isLoading = false;
/** Stored raw response text for copy/insert operations. */
let lastResponseText: string = '';
/** Reference to the TipTap editor for document mutations (set by the extension). */
let editorRef: any = null;

function getVscodeApi(): any {
  return (window as any).vscode;
}

/**
 * Read the current model display name from the webview's config bridge.
 * Falls back to empty string if not available.
 */
function getCurrentModelName(): string {
  return (window as any).__dkAiModelDisplayName ?? '';
}

function getCurrentImageModelName(): string {
  return (window as any).__dkAiImageModelDisplayName ?? '';
}

function showExplainPanel() {
  const modelName = getCurrentModelName();

  if (panelEl) {
    panelEl.style.display = 'flex';
    // Reset body to loading state for new request
    const body = panelEl.querySelector('.ai-explain-body');
    if (body) {
      body.innerHTML =
        '<div class="ai-explain-loading"><div class="ai-explain-spinner"></div><span>Analyzing document\u2026</span></div>';
    }
    // Show model immediately, will be overwritten by result if different
    const footer = panelEl.querySelector('.ai-explain-footer');
    if (footer && modelName) footer.textContent = modelName;
    return;
  }

  panelEl = document.createElement('div');
  panelEl.className = 'ai-explain-panel';

  panelEl.innerHTML = `
    <div class="ai-explain-header">
      <span class="ai-explain-title">AI Summary</span>
      <button type="button" class="ai-explain-close" title="Close">&times;</button>
    </div>
    <div class="ai-explain-body">
      <div class="ai-explain-loading">
        <div class="ai-explain-spinner"></div>
        <span>Analyzing document…</span>
      </div>
    </div>
    <div class="ai-explain-footer">${modelName}</div>
  `;

  document.body.appendChild(panelEl);

  panelEl.querySelector('.ai-explain-close')?.addEventListener('click', () => {
    hideExplainPanel();
  });
}

function hideExplainPanel() {
  if (panelEl) panelEl.style.display = 'none';
}

function setExplainContent(html: string) {
  const body = panelEl?.querySelector('.ai-explain-body');
  if (body) body.innerHTML = html;
  isLoading = false;
}

function setModelName(modelName: string) {
  const footer = panelEl?.querySelector('.ai-explain-footer');
  if (footer) footer.textContent = modelName;
}

function setExplainError(message: string) {
  setExplainContent(`<div class="ai-explain-error">${message}</div>`);
}

/**
 * Handle the explain result message from the extension host.
 */
export function handleAiExplainResult(data: {
  success: boolean;
  explanation?: string;
  error?: string;
  modelName?: string;
}): void {
  if (data.modelName) {
    setModelName(data.modelName);
  }

  if (!data.success || !data.explanation) {
    setExplainError(data.error || 'Could not generate explanation.');
    return;
  }

  // Render the explanation as structured HTML
  const sections = parseExplanation(data.explanation);
  setExplainContent(sections);
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

  // Update title
  const title = panelEl?.querySelector('.ai-explain-title');
  if (title) title.textContent = IMAGE_ASK_TITLES[action] || 'Image Analysis';

  // Show spinner
  const body = panelEl?.querySelector('.ai-explain-body');
  if (body) {
    body.innerHTML =
      '<div class="ai-explain-loading"><div class="ai-explain-spinner"></div><span>Analyzing image\u2026</span></div>';
  }

  // Show image model name immediately in footer
  const footer = panelEl?.querySelector('.ai-explain-footer');
  if (footer) footer.textContent = getCurrentImageModelName();
  removeActionsBar();
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
  if (data.modelName) {
    setModelName(data.modelName);
  }

  if (!data.success || !data.response) {
    setExplainError(data.error || 'Could not analyze image.');
    isLoading = false;
    return;
  }

  lastResponseText = data.response;

  // Render response
  const html = parseExplanation(data.response);
  setExplainContent(html);

  // Add action buttons based on the ask action type
  addActionsBar(data.action);
}

/** Remove any existing actions bar. */
function removeActionsBar(): void {
  panelEl?.querySelector('.ai-explain-actions')?.remove();
}

/** Add context-specific action buttons below the body. */
function addActionsBar(action: string): void {
  removeActionsBar();
  if (!panelEl) return;

  const bar = document.createElement('div');
  bar.className = 'ai-explain-actions';

  // Copy button — always present
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'ai-explain-action-btn';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(lastResponseText).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 1500);
    });
  });
  bar.appendChild(copyBtn);

  // Insert Below — for extractText and describe
  if (action === 'extractText' || action === 'describe') {
    const insertBtn = document.createElement('button');
    insertBtn.type = 'button';
    insertBtn.className = 'ai-explain-action-btn ai-explain-action-primary';
    insertBtn.textContent = 'Insert Below';
    insertBtn.addEventListener('click', () => {
      if (editorRef) {
        // Insert a new paragraph after the current selection/cursor position
        editorRef
          .chain()
          .focus()
          .insertContentAt(editorRef.state.selection.to, {
            type: 'paragraph',
            content: [{ type: 'text', text: lastResponseText }],
          })
          .run();
        insertBtn.textContent = 'Inserted!';
        setTimeout(() => {
          insertBtn.textContent = 'Insert Below';
        }, 1500);
      }
    });
    bar.appendChild(insertBtn);
  }

  // Apply Alt Text — for altText action
  if (action === 'altText') {
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'ai-explain-action-btn ai-explain-action-primary';
    applyBtn.textContent = 'Apply Alt Text';
    applyBtn.addEventListener('click', () => {
      if (editorRef) {
        editorRef.commands.updateAttributes('image', { alt: lastResponseText.trim() });
        applyBtn.textContent = 'Applied!';
        setTimeout(() => {
          applyBtn.textContent = 'Apply Alt Text';
        }, 1500);
      }
    });
    bar.appendChild(applyBtn);
  }

  // Insert before footer
  const footer = panelEl.querySelector('.ai-explain-footer');
  if (footer) {
    panelEl.insertBefore(bar, footer);
  } else {
    panelEl.appendChild(bar);
  }
}

/**
 * Parse the AI response into structured HTML sections.
 * Handles markdown-like formatting: ## headings, - bullets, **bold**.
 */
function parseExplanation(text: string): string {
  const lines = text.split('\n');
  let html = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      html += '<br/>';
      continue;
    }

    if (trimmed.startsWith('## ')) {
      html += `<h3 class="ai-explain-section-title">${escapeHtml(trimmed.slice(3))}</h3>`;
    } else if (trimmed.startsWith('# ')) {
      html += `<h2 class="ai-explain-section-title">${escapeHtml(trimmed.slice(2))}</h2>`;
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const content = trimmed.slice(2);
      html += `<div class="ai-explain-bullet">• ${formatInline(content)}</div>`;
    } else {
      html += `<p class="ai-explain-para">${formatInline(trimmed)}</p>`;
    }
  }

  return html;
}

function formatInline(text: string): string {
  let result = escapeHtml(text);
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/`(.+?)`/g, '<code>$1</code>');
  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

          // Ensure title says "AI Summary" for document explain
          const title = panelEl?.querySelector('.ai-explain-title');
          if (title) title.textContent = 'AI Summary';
          removeActionsBar();

          // Get full document text
          const docText = editor.state.doc.textContent;
          if (!docText.trim()) {
            setExplainError('Document is empty.');
            return false;
          }

          // Send to extension host
          const vscode = getVscodeApi();
          if (!vscode) {
            setExplainError('VS Code API not available.');
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
