/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Unified AI Explanation Panel — shared component for both document analysis
 * (text operations) and image analysis (image ask) results.
 *
 * Responsibilities:
 * - Render AI responses as formatted markdown (tables, lists, headings, code)
 * - Provide streaming handler with incremental re-rendering per chunk
 * - Manage panel title, footer model name, and action buttons
 *
 * Uses markdown-it (already in project dependencies) for HTML rendering.
 * Per clarification Session 2026-05-03: LLM output is trusted; no sanitization applied.
 *
 * @module aiExplain-unified
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MarkdownIt = require('markdown-it') as typeof import('markdown-it');

/** Singleton markdown-it instance configured for GFM-style tables. */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
});

/**
 * Render a markdown string to safe HTML using markdown-it.
 * Tables, headings, lists, bold, italic, and code blocks are all supported.
 */
export function renderMarkdown(text: string): string {
  return md.render(text);
}

/**
 * Truncate text to at most 4,000 characters, breaking on a word boundary
 * (does not cut in the middle of a word).
 */
export function truncateTo4K(text: string): string {
  const MAX = 4000;
  if (text.length <= MAX) return text;
  const slice = text.slice(0, MAX);
  // Walk back to the last whitespace to avoid mid-word cuts
  const lastSpace = slice.lastIndexOf(' ');
  return lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
}

/** Shared panel element — one instance for all AI operations. */
let panelEl: HTMLElement | null = null;

/** Get or return the shared panel element. */
export function getPanelEl(): HTMLElement | null {
  return panelEl;
}

/** Set the shared panel element (called from aiExplain.ts when panel is created). */
export function setPanelEl(el: HTMLElement): void {
  panelEl = el;
}

/** Clear reference when panel is destroyed. */
export function clearPanelEl(): void {
  panelEl = null;
}

/**
 * Update the panel title text.
 */
export function setTitle(titleText: string): void {
  const title = panelEl?.querySelector('.ai-explain-title');
  if (title) title.textContent = titleText;
}

/**
 * Update the footer with the model display name.
 */
export function setFooterModel(modelName: string): void {
  const footer = panelEl?.querySelector('.ai-explain-footer');
  if (footer) footer.textContent = modelName;
}

/**
 * Set the panel body HTML content directly.
 */
export function setBodyContent(html: string): void {
  const body = panelEl?.querySelector('.ai-explain-body');
  if (body) body.innerHTML = html;
}

/**
 * Show a loading spinner in the panel body.
 */
export function showLoadingState(message = 'Analyzing\u2026'): void {
  setBodyContent(
    `<div class="ai-explain-loading"><div class="ai-explain-spinner"></div><span>${message}</span></div>`
  );
}

/**
 * Show an error message in the panel body.
 */
export function showErrorState(message: string): void {
  setBodyContent(`<div class="ai-explain-error">${message}</div>`);
}

/**
 * Show or hide the stop button.
 */
export function setStopButtonVisible(visible: boolean): void {
  const stopBtn = panelEl?.querySelector<HTMLElement>('.ai-explain-stop');
  if (stopBtn) stopBtn.style.display = visible ? 'inline-flex' : 'none';
}

/** Tracks a pending requestAnimationFrame for chunk rendering. */
let pendingFrame: number | null = null;

/**
 * Create a streaming handler for incremental chunk rendering.
 * Re-renders markdown on each chunk via requestAnimationFrame batching.
 *
 * @param onComplete - Optional callback invoked when streaming finishes or errors.
 */
export function createStreamingHandler(onComplete?: () => void): {
  onChunk: (fullText: string) => void;
  onDone: (fullText: string) => void;
  onError: (message: string) => void;
} {
  let latestFullText = '';

  function scheduleRender(): void {
    if (pendingFrame !== null) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null;
      setBodyContent(
        `<div class="ai-explain-markdown">${renderMarkdown(latestFullText)}</div>`
      );
    });
  }

  return {
    onChunk(fullText: string): void {
      latestFullText = fullText;
      scheduleRender();
    },

    onDone(fullText: string): void {
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
        pendingFrame = null;
      }
      setBodyContent(
        `<div class="ai-explain-markdown">${renderMarkdown(fullText.trim())}</div>`
      );
      setStopButtonVisible(false);
      onComplete?.();
    },

    onError(message: string): void {
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
        pendingFrame = null;
      }
      showErrorState(message);
      setStopButtonVisible(false);
      onComplete?.();
    },
  };
}

/** Remove any existing actions bar from the panel. */
export function removeActionsBar(): void {
  panelEl?.querySelector('.ai-explain-actions')?.remove();
}

/** Stored raw response text for copy/insert operations. */
let lastResponseText = '';

/** Update the stored last response text. */
export function setLastResponseText(text: string): void {
  lastResponseText = text;
}

/** Get the stored last response text. */
export function getLastResponseText(): string {
  return lastResponseText;
}

/**
 * Add context-specific action buttons (Copy, Insert Below, Apply Alt Text) to the panel.
 * @param action - The AI ask action type: 'summary' | 'explain' | 'altText' | 'extractText' | 'describe' | 'custom'
 * @param editorRef - The TipTap editor instance for insert operations.
 */
export function showActions(action: string, editorRef: any): void {
  removeActionsBar();
  if (!panelEl) return;

  const bar = document.createElement('div');
  bar.className = 'ai-explain-actions';

  // Copy — always present
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

  // Insert Below — for extractText, describe, and summary
  if (action === 'extractText' || action === 'describe' || action === 'summary') {
    const insertBtn = document.createElement('button');
    insertBtn.type = 'button';
    insertBtn.className = 'ai-explain-action-btn ai-explain-action-primary';
    insertBtn.textContent = 'Insert Below';
    insertBtn.addEventListener('click', () => {
      if (editorRef) {
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
