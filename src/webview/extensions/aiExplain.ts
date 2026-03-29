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

function getVscodeApi(): any {
  return (window as any).vscode;
}

function showExplainPanel() {
  if (panelEl) {
    panelEl.style.display = 'flex';
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
      <div class="ai-explain-loading">Analyzing document...</div>
    </div>
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
}): void {
  if (!data.success || !data.explanation) {
    setExplainError(data.error || 'Could not generate explanation.');
    return;
  }

  // Render the explanation as structured HTML
  const sections = parseExplanation(data.explanation);
  setExplainContent(sections);
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

  addCommands() {
    return {
      explainDocument:
        () =>
        ({ editor }) => {
          if (isLoading) return false;
          isLoading = true;

          showExplainPanel();

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
