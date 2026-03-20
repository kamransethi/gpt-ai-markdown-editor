/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import mermaid from 'mermaid';

/**
 * Detect if editor is in dark mode by checking data-theme attribute
 */
function isDarkMode(): boolean {
  return document.body.getAttribute('data-theme') === 'dark';
}

/**
 * Read a CSS custom property, returning a fallback when the variable is
 * not yet resolved (e.g. during early module initialisation before the
 * stylesheet has loaded).  Mermaid's color parser throws on empty strings.
 */
function cssVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Initialize mermaid with theme based on VS Code theme
 */
function initializeMermaid() {
  const styles = getComputedStyle(document.documentElement);
  const dark = isDarkMode();
  const theme = dark ? 'dark' : 'default';

  // Sensible defaults when CSS variables aren't available yet
  const fb = dark
    ? { bg: '#1e1e1e', fg: '#d4d4d4', subtle: '#2d2d2d', border: '#444', focus: '#569cd6' }
    : { bg: '#ffffff', fg: '#1a1a1a', subtle: '#f7f7f7', border: '#e0e0e0', focus: '#1a73e8' };

  mermaid.initialize({
    startOnLoad: false,
    theme,
    securityLevel: 'strict',
    fontFamily: 'inherit',
    suppressErrorRendering: true,
    themeVariables: {
      background: cssVar(styles, '--md-background', fb.bg),
      primaryColor: cssVar(styles, '--md-subtle-bg', fb.subtle),
      primaryBorderColor: cssVar(styles, '--md-focus', fb.focus),
      primaryTextColor: cssVar(styles, '--md-foreground', fb.fg),
      secondaryColor: cssVar(styles, '--md-subtle-bg', fb.subtle),
      secondaryBorderColor: cssVar(styles, '--md-border', fb.border),
      tertiaryColor: cssVar(styles, '--md-subtle-bg', fb.subtle),
      tertiaryBorderColor: cssVar(styles, '--md-border', fb.border),
      lineColor: cssVar(styles, '--md-foreground', fb.fg),
      textColor: cssVar(styles, '--md-foreground', fb.fg),
      edgeLabelBackground: cssVar(styles, '--md-background', fb.bg),
      clusterBkg: cssVar(styles, '--md-subtle-bg', fb.subtle),
      clusterBorder: cssVar(styles, '--md-border', fb.border),
      actorBorder: cssVar(styles, '--md-focus', fb.focus),
      actorTextColor: cssVar(styles, '--md-foreground', fb.fg),
      actorBkg: cssVar(styles, '--md-subtle-bg', fb.subtle),
      labelBoxBkg: cssVar(styles, '--md-subtle-bg', fb.subtle),
      labelBoxBorderColor: cssVar(styles, '--md-border', fb.border),
      labelTextColor: cssVar(styles, '--md-foreground', fb.fg),
      signalColor: cssVar(styles, '--md-foreground', fb.fg),
      signalTextColor: cssVar(styles, '--md-foreground', fb.fg),
      noteBorderColor: cssVar(styles, '--md-focus', fb.focus),
      noteBkgColor: cssVar(styles, '--md-subtle-bg', fb.subtle),
      noteTextColor: cssVar(styles, '--md-foreground', fb.fg),
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

      // Compact header matching code block style
      const codeHeader = document.createElement('div');
      codeHeader.classList.add('mermaid-code-header');

      const codeTitle = document.createElement('div');
      codeTitle.classList.add('mermaid-code-title');
      codeTitle.textContent = 'Mermaid';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.classList.add('mermaid-edit-button');
      editButton.textContent = 'Edit';

      codeHeader.appendChild(codeTitle);
      codeHeader.appendChild(editButton);

      const renderBlock = document.createElement('div');
      renderBlock.classList.add('mermaid-render-block');

      container.appendChild(codeHeader);
      container.appendChild(renderBlock);

      let currentContent = node.textContent;
      let renderVersion = 0;
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

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

      // Open the same document in VS Code source view, scrolled to this mermaid block
      const openSourceEditor = () => {
        const vscodeApi = (window as any).vscode;
        if (vscodeApi) {
          vscodeApi.postMessage({
            type: 'editMermaidSource',
            code: currentContent,
          });
        }
      };

      // Header events
      codeHeader.addEventListener('click', e => e.stopPropagation());
      codeHeader.addEventListener('mousedown', e => e.stopPropagation());
      editButton.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        openSourceEditor();
      });

      // Tooltip for "Double-click to edit" hint
      const tooltip = document.createElement('div');
      tooltip.classList.add('mermaid-tooltip');
      tooltip.textContent = 'Double-click to edit';
      tooltip.style.display = 'none';
      container.appendChild(tooltip);

      // Manual selection on click
      container.addEventListener('click', () => {
        const pos = getPos();
        if (typeof pos === 'number') {
          editor.commands.setNodeSelection(pos);
        }
      });

      // Open source editor on double-click
      container.addEventListener('dblclick', e => {
        if ((e.target as HTMLElement | null)?.closest('.mermaid-code-header')) return;
        openSourceEditor();
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
            renderDiagram(currentContent);
          }
          return true;
        },
        selectNode: () => {
          container.classList.add('highlighted');
          tooltip.style.display = 'block';
        },
        deselectNode: () => {
          container.classList.remove('highlighted');
          tooltip.style.display = 'none';
        },
        stopEvent: event => {
          const target = event.target as HTMLElement | null;
          return Boolean(target?.closest('.mermaid-code-header'));
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
