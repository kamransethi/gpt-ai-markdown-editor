/**
 * Copyright (c) 2025-2026 GPT-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import mermaid from 'mermaid';

/**
 * Detect if VS Code is in dark mode by checking CSS variables
 */
function isDarkMode(): boolean {
  // Check for manual theme override first
  const override = document.body.getAttribute('data-theme-override');
  if (override === 'dark') return true;
  if (override === 'light') return false;

  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue('--vscode-editor-background')
    .trim();
  if (!bg) return false;

  const hex = bg.replace('#', '');
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }
  return false;
}

/**
 * Initialize mermaid with theme based on VS Code theme
 */
function initializeMermaid() {
  const styles = getComputedStyle(document.documentElement);
  const theme = isDarkMode() ? 'dark' : 'default';
  mermaid.initialize({
    startOnLoad: false,
    theme,
    securityLevel: 'strict',
    fontFamily: 'inherit',
    suppressErrorRendering: true,
    themeVariables: {
      background: styles.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e',
      primaryColor:
        styles.getPropertyValue('--vscode-editorWidget-background').trim() || '#252526',
      primaryBorderColor: styles.getPropertyValue('--vscode-focusBorder').trim() || '#3794ff',
      primaryTextColor: styles.getPropertyValue('--vscode-editor-foreground').trim() || '#cccccc',
      secondaryColor:
        styles.getPropertyValue('--vscode-editorWidget-background').trim() || '#252526',
      secondaryBorderColor:
        styles.getPropertyValue('--vscode-editorWidget-border').trim() || '#444444',
      tertiaryColor:
        styles.getPropertyValue('--vscode-editorWidget-background').trim() || '#252526',
      tertiaryBorderColor:
        styles.getPropertyValue('--vscode-editorWidget-border').trim() || '#444444',
      lineColor: styles.getPropertyValue('--vscode-editor-foreground').trim() || '#cccccc',
      textColor: styles.getPropertyValue('--vscode-editor-foreground').trim() || '#cccccc',
      edgeLabelBackground:
        styles.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e',
      clusterBkg:
        styles.getPropertyValue('--vscode-editorWidget-background').trim() || '#252526',
      clusterBorder: styles.getPropertyValue('--vscode-editorWidget-border').trim() || '#444444',
      actorBorder: styles.getPropertyValue('--vscode-focusBorder').trim() || '#3794ff',
      actorTextColor: styles.getPropertyValue('--vscode-editor-foreground').trim() || '#cccccc',
      actorBkg:
        styles.getPropertyValue('--vscode-editorWidget-background').trim() || '#252526',
      labelBoxBkg:
        styles.getPropertyValue('--vscode-editorWidget-background').trim() || '#252526',
      labelBoxBorderColor:
        styles.getPropertyValue('--vscode-editorWidget-border').trim() || '#444444',
      labelTextColor: styles.getPropertyValue('--vscode-editor-foreground').trim() || '#cccccc',
      signalColor: styles.getPropertyValue('--vscode-editor-foreground').trim() || '#cccccc',
      signalTextColor: styles.getPropertyValue('--vscode-editor-foreground').trim() || '#cccccc',
      noteBorderColor: styles.getPropertyValue('--vscode-focusBorder').trim() || '#3794ff',
      noteBkgColor:
        styles.getPropertyValue('--vscode-editorWidget-background').trim() || '#252526',
      noteTextColor: styles.getPropertyValue('--vscode-editor-foreground').trim() || '#cccccc',
    },
  });
}

initializeMermaid();
window.addEventListener('focus', initializeMermaid);

/**
 * Remove orphan mermaid elements injected into body during render errors.
 */
function cleanupOrphanMermaidElements(id: string) {
  const orphan = document.getElementById(id);
  if (orphan && !orphan.closest('.mermaid-split-wrapper')) orphan.remove();

  const dOrphan = document.getElementById('d' + id);
  if (dOrphan && !dOrphan.closest('.mermaid-split-wrapper')) dOrphan.remove();

  document.querySelectorAll('body > svg[id^="mermaid-"]').forEach(el => {
    if (!el.closest('.mermaid-split-wrapper')) el.remove();
  });
  document.querySelectorAll('body > div[id^="dmermaid-"]').forEach(el => {
    if (!el.closest('.mermaid-split-wrapper')) el.remove();
  });
}

// Global queue to prevent concurrent mermaid renders mutating the DOM
let mermaidRenderQueue = Promise.resolve();

export const Mermaid = Node.create({
  name: 'mermaid',

  priority: 200,

  group: 'block',

  content: 'text*',

  marks: '',

  code: true,

  defining: true,

  isolating: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      language: {
        default: 'mermaid',
        parseHTML: element => element.getAttribute('data-language'),
        renderHTML: attributes => ({
          'data-language': attributes.language,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'pre[data-language="mermaid"]',
        preserveWhitespace: 'full',
      },
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (element: HTMLElement) => {
          const code = element.querySelector('code');
          if (!code) return false;
          if (code.classList.contains('language-mermaid')) return {};
          if (code.getAttribute('data-language') === 'mermaid') return {};
          return false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'pre',
      mergeAttributes(HTMLAttributes, { 'data-language': 'mermaid', class: 'mermaid-diagram' }),
      ['code', { class: 'language-mermaid' }, 0],
    ];
  },

  markdownTokenName: 'code',

  parseMarkdown: (token, helpers) => {
    const language = (token.lang || '').toLowerCase();
    const isMermaidFence =
      token.type === 'code' &&
      token.codeBlockStyle !== 'indented' &&
      (language === 'mermaid' || token.raw?.startsWith('```mermaid'));

    if (!isMermaidFence) {
      return [];
    }

    const text = token.text ?? '';
    const content = text ? [helpers.createTextNode(text)] : [];

    return helpers.createNode('mermaid', { language: 'mermaid' }, content);
  },

  renderMarkdown: (node, helpers) => {
    const language = (node.attrs?.language as string) || 'mermaid';
    const body = helpers.renderChildren(node.content || [], '\n').replace(/\s+$/, '');
    const content = body.length > 0 ? body : '';
    return `\`\`\`${language}\n${content}\n\`\`\``;
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement('div');
      container.classList.add('mermaid-split-wrapper');

      const codeBlock = document.createElement('div');
      codeBlock.classList.add('mermaid-code-block');

      const codeHeader = document.createElement('div');
      codeHeader.classList.add('mermaid-code-header');

      const codeTitle = document.createElement('div');
      codeTitle.classList.add('mermaid-code-title');
      codeTitle.textContent = 'Mermaid';

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.classList.add('mermaid-close-button');
      closeButton.textContent = 'Close';

      codeHeader.appendChild(codeTitle);
      codeHeader.appendChild(closeButton);
      codeBlock.appendChild(codeHeader);

      const textarea = document.createElement('textarea');
      textarea.classList.add('mermaid-textarea');
      textarea.spellcheck = false;
      textarea.value = node.textContent;
      codeBlock.appendChild(textarea);

      const renderBlock = document.createElement('div');
      renderBlock.classList.add('mermaid-render-block');

      container.appendChild(codeBlock);
      container.appendChild(renderBlock);

      let currentContent = node.textContent;
      let renderVersion = 0;
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let isEditing = false;

      const setEditing = (nextEditing: boolean) => {
        isEditing = nextEditing;
        container.classList.toggle('is-editing', nextEditing);
      };

      const renderDiagram = async (code: string) => {
        const content = code.trim();
        const thisVersion = ++renderVersion;

        if (!content) {
          renderBlock.innerHTML =
            '<div class="mermaid-placeholder">Empty Mermaid diagram. Type code to render.</div>';
          return;
        }

        try {
          await mermaid.parse(content);
        } catch (parseError) {
          if (thisVersion !== renderVersion) return;
          const errorMsg =
            parseError instanceof Error ? parseError.message : 'Invalid diagram syntax';
          renderBlock.innerHTML = `<div class="mermaid-error">Diagram Error: ${errorMsg}</div>`;
          return;
        }

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

        mermaidRenderQueue = mermaidRenderQueue
          .then(async () => {
            try {
              if (thisVersion !== renderVersion) return;
              renderBlock.innerHTML = '';
              initializeMermaid();
              const { svg, bindFunctions } = await mermaid.render(id, content);
              if (thisVersion !== renderVersion) return;
              renderBlock.innerHTML = svg;
              if (bindFunctions) {
                bindFunctions(renderBlock);
              }
            } catch (error) {
              if (thisVersion !== renderVersion) return;
              console.error('Mermaid rendering error:', error);
              const errorMsg = error instanceof Error ? error.message : 'Invalid diagram syntax';
              renderBlock.innerHTML = `<div class="mermaid-error">Diagram Error: ${errorMsg}</div>`;
            } finally {
              cleanupOrphanMermaidElements(id);
            }
          })
          .catch(err => {
            console.error('Mermaid queue error:', err);
          });
      };

      // Commit textarea content back to the ProseMirror document
      const commitContent = () => {
        const newCode = textarea.value;
        if (newCode === currentContent) return;
        currentContent = newCode;

        const pos = getPos();
        if (typeof pos !== 'number') return;

        const { tr } = editor.state;
        const textContent = newCode.length > 0 ? editor.schema.text(newCode) : undefined;
        const newNode = node.type.create(node.attrs, textContent);
        tr.replaceWith(pos, pos + node.nodeSize, newNode);
        editor.view.dispatch(tr);
      };

      const enterEditMode = () => {
        tooltip.style.display = 'none';
        container.classList.remove('highlighted');
        setEditing(true);
        textarea.value = currentContent;
        setTimeout(() => textarea.focus(), 10);
      };

      const exitEditMode = () => {
        commitContent();
        setEditing(false);
      };

      // Live preview while typing in textarea
      textarea.addEventListener('input', () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          renderDiagram(textarea.value);
        }, 400);
      });

      // Stop events from bubbling to the editor
      textarea.addEventListener('keydown', e => {
        e.stopPropagation();
        // Escape keeps the editor open and restores focus inside the embedded textarea.
        if (e.key === 'Escape') {
          e.preventDefault();
          textarea.focus();
        }
      });
      textarea.addEventListener('click', e => e.stopPropagation());
      textarea.addEventListener('mousedown', e => e.stopPropagation());
      textarea.addEventListener('focus', e => e.stopPropagation());
      textarea.addEventListener('paste', e => e.stopPropagation());
      textarea.addEventListener('copy', e => e.stopPropagation());
      textarea.addEventListener('cut', e => e.stopPropagation());

      codeHeader.addEventListener('click', e => e.stopPropagation());
      codeHeader.addEventListener('mousedown', e => e.stopPropagation());
      closeButton.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        exitEditMode();
      });

      // Tooltip for "Double-click to edit" hint
      const tooltip = document.createElement('div');
      tooltip.classList.add('mermaid-tooltip');
      tooltip.textContent = 'Double-click to edit';
      tooltip.style.display = 'none';
      container.appendChild(tooltip);

      // Manual selection on click
      container.addEventListener('click', () => {
        if (isEditing) return;
        const pos = getPos();
        if (typeof pos === 'number') {
          editor.commands.setNodeSelection(pos);
        }
      });

      // Toggle split-view on double-click (but not on textarea)
      container.addEventListener('dblclick', e => {
        if ((e.target as HTMLElement | null)?.closest('.mermaid-code-block')) return;
        if (!isEditing) {
          enterEditMode();
        }
      });

      const themeChangeListener = () => {
        renderDiagram(currentContent);
      };
      window.addEventListener('gptAiThemeChanged', themeChangeListener);

      renderDiagram(currentContent);

      return {
        dom: container,
        update: updatedNode => {
          if (updatedNode.type.name !== 'mermaid') return false;
          if (currentContent !== updatedNode.textContent) {
            currentContent = updatedNode.textContent;
            // Only update textarea if not actively editing
            if (!isEditing && document.activeElement !== textarea) {
              textarea.value = currentContent;
            }
            renderDiagram(currentContent);
          }
          return true;
        },
        selectNode: () => {
          if (!container.classList.contains('is-editing')) {
            container.classList.add('highlighted');
            tooltip.style.display = 'block';
          }
        },
        deselectNode: () => {
          container.classList.remove('highlighted');
          tooltip.style.display = 'none';
        },
        stopEvent: event => {
          const target = event.target as HTMLElement | null;
          return Boolean(target?.closest('.mermaid-code-block'));
        },
        destroy: () => {
          renderVersion++;
          if (debounceTimer) clearTimeout(debounceTimer);
          window.removeEventListener('gptAiThemeChanged', themeChangeListener);
        },
      };
    };
  },
});
