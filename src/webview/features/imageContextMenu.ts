/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import type { Editor } from '@tiptap/core';
import { MenuBuilder } from '../utils/menuBuilder';
import { modSymbol as mod } from '../utils/platform';
import { MessageType } from '../../shared/messageTypes';
import { showImageRenameDialog } from './imageRenameDialog';
import { showImageAskLoading } from '../extensions/aiExplain';

interface ImageContextMenuController {
  element: HTMLElement;
  show: (x: number, y: number, img: HTMLImageElement, contextPos: number, isExternal: boolean) => void;
  hide: () => void;
  destroy: () => void;
}

/** Last custom image question, persisted across dialog invocations. */
let lastCustomQuestion = '';

function addItemIcon(button: HTMLButtonElement, codiconClass: string): void {
  const icon = document.createElement('span');
  icon.className = `context-menu-item-icon codicon ${codiconClass}`;
  icon.setAttribute('aria-hidden', 'true');
  button.prepend(icon);
}

function getImagePath(img: HTMLImageElement | null): string {
  if (!img) return '';
  return img.getAttribute('data-markdown-src') || img.getAttribute('src') || '';
}

function withCacheBust(src: string, timestamp: number): string {
  try {
    const url = new URL(src);
    url.searchParams.set('t', String(timestamp));
    return url.toString();
  } catch {
    const cleaned = src.replace(/[?&]t=\d+/g, '');
    const separator = cleaned.includes('?') ? '&' : '?';
    return `${cleaned}${separator}t=${timestamp}`;
  }
}

function showCustomAskDialog(
  imageSrc: string,
  imageAlt: string,
  vscodeApi: unknown,
  onCloseMenu: () => void
): void {
  onCloseMenu();

  const overlay = document.createElement('div');
  overlay.className = 'ai-refine-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'ai-refine-dialog';

  const title = document.createElement('div');
  title.className = 'ai-refine-dialog-title';
  title.textContent = 'Ask about image';
  dialog.appendChild(title);

  const description = document.createElement('div');
  description.className = 'ai-refine-dialog-description';
  description.textContent = 'Ask a question about this image:';
  dialog.appendChild(description);

  const input = document.createElement('textarea');
  input.className = 'ai-refine-dialog-input';
  input.placeholder = 'e.g., What does this diagram explain?';
  input.rows = 3;
  if (lastCustomQuestion) {
    input.value = lastCustomQuestion;
  }
  dialog.appendChild(input);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'ai-refine-dialog-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ai-refine-dialog-btn ai-refine-dialog-btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => overlay.remove();

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'ai-refine-dialog-btn ai-refine-dialog-btn-submit';
  submitBtn.textContent = 'Ask';
  submitBtn.onclick = () => {
    const question = input.value.trim();
    if (!question) return;

    lastCustomQuestion = question;
    overlay.remove();

    showImageAskLoading('custom');
    if (vscodeApi && typeof (vscodeApi as any).postMessage === 'function') {
      (vscodeApi as any).postMessage({
        type: MessageType.IMAGE_ASK,
        action: 'custom',
        imageSrc,
        imageAlt,
        customPrompt: question,
      });
    }
  };

  buttonRow.appendChild(cancelBtn);
  buttonRow.appendChild(submitBtn);
  dialog.appendChild(buttonRow);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitBtn.click();
    }
  });

  requestAnimationFrame(() => input.focus());
}

function sendImageAsk(
  askAction: 'explain' | 'extractText',
  img: HTMLImageElement | null,
  vscodeApi: unknown
): void {
  if (!img) return;

  const imageSrc = getImagePath(img);
  const imageAlt = img.getAttribute('alt') || '';

  showImageAskLoading(askAction);
  if (vscodeApi && typeof (vscodeApi as any).postMessage === 'function') {
    (vscodeApi as any).postMessage({
      type: MessageType.IMAGE_ASK,
      action: askAction,
      imageSrc,
      imageAlt,
    });
  }
}

function addAskSubmenu(
  mb: MenuBuilder,
  getCurrentImg: () => HTMLImageElement | null,
  vscodeApi: unknown
): void {
  mb.addSubmenuTrigger('Ask the image [AI]', submenu => {
    const createAskItem = (
      label: string,
      codiconClass: string,
      action: () => void,
      danger: boolean = false
    ) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `context-menu-item${danger ? ' context-menu-danger' : ''}`;
      item.setAttribute('role', 'menuitem');

      const icon = document.createElement('span');
      icon.className = `context-menu-item-icon codicon ${codiconClass}`;
      icon.setAttribute('aria-hidden', 'true');
      item.appendChild(icon);

      const text = document.createElement('span');
      text.className = 'context-menu-label';
      text.textContent = label;
      item.appendChild(text);

      item.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        action();
        mb.hide();
      };

      submenu.appendChild(item);
    };

    createAskItem('Custom (Ask a Question)', 'codicon-question', () => {
      const img = getCurrentImg();
      if (!img) return;
      const imageSrc = getImagePath(img);
      const imageAlt = img.getAttribute('alt') || '';
      showCustomAskDialog(imageSrc, imageAlt, vscodeApi, () => mb.hide());
    });

    createAskItem('Explain', 'codicon-comment-discussion', () => {
      sendImageAsk('explain', getCurrentImg(), vscodeApi);
    });

    createAskItem('Extract Text', 'codicon-file-text', () => {
      sendImageAsk('extractText', getCurrentImg(), vscodeApi);
    });
  });
}

export function isExternalImage(src: string): boolean {
  return src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:');
}

export function createImageContextMenu(editor: Editor, vscodeApi: unknown): ImageContextMenuController {
  const localMenu = new MenuBuilder('context-menu image-context-menu', 'Image context menu');
  const externalMenu = new MenuBuilder('context-menu image-context-menu', 'Image context menu');

  let contextPos: number | null = null;
  let currentImg: HTMLImageElement | null = null;
  let activeMenu: MenuBuilder | null = null;

  const restoreContextSelection = () => {
    if (contextPos == null) return;

    try {
      const maxPos = editor.state.doc.content.size;
      const safePos = Math.min(contextPos, maxPos);
      editor.chain().focus().setNodeSelection(safePos).run();
    } catch {
      try {
        editor.view.focus();
      } catch {
        // ignore
      }
    }
  };

  const runClipboardAction = (command: 'cut' | 'copy' | 'paste') => {
    document.execCommand(command);
  };

  const cutBtn = localMenu.addItem('Cut', () => runClipboardAction('cut'), { shortcut: `${mod}X` });
  addItemIcon(cutBtn, 'codicon-cut');
  const copyBtn = localMenu.addItem('Copy', () => runClipboardAction('copy'), { shortcut: `${mod}C` });
  addItemIcon(copyBtn, 'codicon-copy');
  const pasteBtn = localMenu.addItem('Paste', () => runClipboardAction('paste'), { shortcut: `${mod}V` });
  addItemIcon(pasteBtn, 'codicon-clippy');
  const deleteBtn = localMenu.addItem(
    'Delete',
    () => editor.chain().focus().deleteSelection().run(),
    { className: 'context-menu-danger' }
  );
  addItemIcon(deleteBtn, 'codicon-trash');

  localMenu.addSeparator();
  localMenu.addSectionLabel('EDIT');

  const renameBtn = localMenu.addItem('Rename', () => {
    if (!currentImg) return;
    showImageRenameDialog(currentImg, vscodeApi as any);
  });
  addItemIcon(renameBtn, 'codicon-edit');

  const replaceBtn = localMenu.addItem('Replace...', () => {
    if (!currentImg) return;

    try {
      (window as any)._pendingImageReplaceTarget = currentImg;
    } catch {
      (window as any)._pendingImageReplaceTarget = currentImg;
    }

    if (vscodeApi && typeof (vscodeApi as any).postMessage === 'function') {
      (vscodeApi as any).postMessage({ type: MessageType.BROWSE_LOCAL_FILE });
    }
  });
  addItemIcon(replaceBtn, 'codicon-repo-push');

  const revertBtn = localMenu.addItem('Revert to original size', () => {
    editor.commands.updateAttributes('image', { width: null, height: null });
  });
  addItemIcon(revertBtn, 'codicon-refresh');

  const refreshBtn = localMenu.addItem('Refresh', () => {
    if (!currentImg) return;

    const timestamp = Date.now();

    // Prefer refreshing the currently resolved image URI to avoid breaking
    // relative markdown paths (which require webview URI resolution).
    const currentSrc = currentImg.getAttribute('src') || '';

    const wrapper = currentImg.closest('.image-wrapper');
    wrapper?.classList.remove('image-missing');
    currentImg.setAttribute('data-loading', 'true');

    if (currentSrc) {
      currentImg.src = withCacheBust(currentSrc, timestamp);
      return;
    }

    const markdownPath = getImagePath(currentImg);
    const resolver = (window as any).resolveImagePath;
    if (markdownPath && typeof resolver === 'function') {
      void resolver(markdownPath)
        .then((resolved: string) => {
          if (!currentImg) return;
          currentImg.src = withCacheBust(resolved, timestamp);
        })
        .catch(() => {
          wrapper?.classList.add('image-missing');
          currentImg?.removeAttribute('data-loading');
        });
      return;
    }

    if (markdownPath) {
      currentImg.src = withCacheBust(markdownPath, timestamp);
    }
  });
  addItemIcon(refreshBtn, 'codicon-sync');

  localMenu.addSeparator();
  localMenu.addSectionLabel('REVEAL');

  const openFinderBtn = localMenu.addItem('Open in Finder/Explorer', () => {
    const imagePath = getImagePath(currentImg);
    if (!imagePath) return;
    if (vscodeApi && typeof (vscodeApi as any).postMessage === 'function') {
      (vscodeApi as any).postMessage({ type: MessageType.REVEAL_IMAGE_IN_OS, imagePath });
    }
  });
  addItemIcon(openFinderBtn, 'codicon-folder-opened');

  const showWorkspaceBtn = localMenu.addItem('Show in Workspace', () => {
    const imagePath = getImagePath(currentImg);
    if (!imagePath) return;
    if (vscodeApi && typeof (vscodeApi as any).postMessage === 'function') {
      (vscodeApi as any).postMessage({ type: MessageType.REVEAL_IMAGE_IN_EXPLORER, imagePath });
    }
  });
  addItemIcon(showWorkspaceBtn, 'codicon-list-tree');

  localMenu.addSeparator();
  addAskSubmenu(localMenu, () => currentImg, vscodeApi);

  const extCutBtn = externalMenu.addItem('Cut', () => runClipboardAction('cut'), {
    shortcut: `${mod}X`,
  });
  addItemIcon(extCutBtn, 'codicon-cut');
  const extCopyBtn = externalMenu.addItem('Copy', () => runClipboardAction('copy'), {
    shortcut: `${mod}C`,
  });
  addItemIcon(extCopyBtn, 'codicon-copy');
  const extPasteBtn = externalMenu.addItem('Paste', () => runClipboardAction('paste'), {
    shortcut: `${mod}V`,
  });
  addItemIcon(extPasteBtn, 'codicon-clippy');
  const extDeleteBtn = externalMenu.addItem(
    'Delete',
    () => editor.chain().focus().deleteSelection().run(),
    { className: 'context-menu-danger' }
  );
  addItemIcon(extDeleteBtn, 'codicon-trash');

  externalMenu.addSeparator();
  addAskSubmenu(externalMenu, () => currentImg, vscodeApi);

  localMenu.onBeforeAction = restoreContextSelection;
  externalMenu.onBeforeAction = restoreContextSelection;

  localMenu.mount();
  externalMenu.mount();

  const show = (
    x: number,
    y: number,
    img: HTMLImageElement,
    imagePos: number,
    external: boolean
  ) => {
    currentImg = img;
    contextPos = imagePos;

    localMenu.hide();
    externalMenu.hide();

    activeMenu = external ? externalMenu : localMenu;
    activeMenu.show(x, y);
  };

  const hide = () => {
    localMenu.hide();
    externalMenu.hide();
    contextPos = null;
    currentImg = null;
    activeMenu = null;
  };

  return {
    element: localMenu.element,
    show,
    hide,
    destroy: () => {
      localMenu.destroy();
      externalMenu.destroy();
    },
  };
}
