/**
 * Copyright (c) 2025-2026 GPT-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

export type TocPaneAnchor = {
  id: string;
  textContent: string;
  level: number;
  itemIndex: number | string;
  pos: number;
  isActive: boolean;
};

type TocPaneOptions = {
  mount: HTMLElement;
  onNavigate: (anchor: TocPaneAnchor) => void;
};

type TocPaneController = {
  update: (anchors: TocPaneAnchor[]) => void;
  setVisible: (visible: boolean) => void;
  toggle: () => void;
  isVisible: () => boolean;
  destroy: () => void;
};

function renderTocItems(
  listEl: HTMLElement,
  anchors: TocPaneAnchor[],
  onNavigate: (anchor: TocPaneAnchor) => void
): void {
  listEl.innerHTML = '';

  if (anchors.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'toc-pane-empty';
    empty.textContent = 'No headings yet';
    listEl.appendChild(empty);
    return;
  }

  anchors.forEach(anchor => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `toc-pane-item toc-pane-level-${Math.max(1, Math.min(anchor.level, 6))}`;
    if (anchor.isActive) {
      item.classList.add('is-active');
    }

    item.setAttribute('title', anchor.textContent || '(Untitled)');
    item.setAttribute('data-id', anchor.id);
    item.setAttribute('data-pos', String(anchor.pos));

    const text = document.createElement('span');
    text.className = 'toc-pane-item-text';
    text.textContent = anchor.textContent || '(Untitled)';

    item.appendChild(text);
    item.addEventListener('click', () => onNavigate(anchor));

    listEl.appendChild(item);
  });

  const activeItem = listEl.querySelector('.toc-pane-item.is-active') as HTMLElement | null;
  if (activeItem !== null && typeof activeItem.scrollIntoView === 'function') {
    activeItem.scrollIntoView({ block: 'nearest' });
  }
}

export function createTocPane({ mount, onNavigate }: TocPaneOptions): TocPaneController {
  const pane = document.createElement('aside');
  pane.className = 'toc-pane';
  pane.setAttribute('aria-label', 'Table of contents');

  const header = document.createElement('div');
  header.className = 'toc-pane-header';
  header.textContent = 'Contents';

  const list = document.createElement('div');
  list.className = 'toc-pane-list';

  pane.appendChild(header);
  pane.appendChild(list);
  mount.appendChild(pane);

  let visible = false;

  return {
    update: (anchors: TocPaneAnchor[]) => {
      renderTocItems(list, anchors, onNavigate);
    },
    setVisible: (nextVisible: boolean) => {
      visible = nextVisible;
      pane.classList.toggle('is-visible', visible);
      mount.classList.toggle('toc-pane-visible', visible);
    },
    toggle: () => {
      visible = !visible;
      pane.classList.toggle('is-visible', visible);
      mount.classList.toggle('toc-pane-visible', visible);
    },
    isVisible: () => visible,
    destroy: () => {
      pane.remove();
    },
  };
}
