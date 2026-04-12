/**
 * Copyright (c) 2025-2026 DK-AI
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
  getFilterQuery: () => string;
};

function renderTocItems(
  listEl: HTMLElement,
  anchors: TocPaneAnchor[],
  onNavigate: (anchor: TocPaneAnchor) => void,
  emptyMessage = 'No headings yet'
): void {
  listEl.innerHTML = '';

  if (anchors.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'toc-pane-empty';
    empty.textContent = emptyMessage;
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

  // Scroll the active item into view within the list container only.
  // We avoid element.scrollIntoView() because it can bubble up and scroll the body.
  const activeItem = listEl.querySelector('.toc-pane-item.is-active') as HTMLElement | null;
  if (activeItem) {
    const itemTop = activeItem.offsetTop - listEl.offsetTop;
    const itemBottom = itemTop + activeItem.offsetHeight;
    if (itemTop < listEl.scrollTop) {
      listEl.scrollTop = itemTop;
    } else if (itemBottom > listEl.scrollTop + listEl.clientHeight) {
      listEl.scrollTop = itemBottom - listEl.clientHeight;
    }
  }
}

export function createTocPane({ mount, onNavigate }: TocPaneOptions): TocPaneController {
  const pane = document.createElement('aside');
  pane.className = 'toc-pane';
  pane.setAttribute('aria-label', 'Table of contents');

  // Resize handle on the left edge
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'toc-pane-resize-handle';

  const header = document.createElement('div');
  header.className = 'toc-pane-header';

  // Filter input replaces the static "Contents" title
  const filterInput = document.createElement('input');
  filterInput.type = 'text';
  filterInput.className = 'toc-pane-filter';
  filterInput.placeholder = 'Filter\u2026';
  filterInput.setAttribute('aria-label', 'Filter headings');

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'toc-pane-filter-clear';
  clearBtn.title = 'Clear filter';
  clearBtn.setAttribute('aria-label', 'Clear filter');
  clearBtn.innerHTML = '&times;';
  clearBtn.style.display = 'none';

  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.className = 'toc-pane-collapse-btn';
  collapseBtn.title = 'Hide outline pane';
  collapseBtn.setAttribute('aria-label', 'Hide outline pane');
  collapseBtn.innerHTML = '&rsaquo;&rsaquo;';
  collapseBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('toggleTocPane'));
  });

  header.appendChild(filterInput);
  header.appendChild(clearBtn);
  header.appendChild(collapseBtn);

  const list = document.createElement('div');
  list.className = 'toc-pane-list';

  pane.appendChild(resizeHandle);
  pane.appendChild(header);
  pane.appendChild(list);
  mount.appendChild(pane);

  // Filter state
  let filterQuery = '';
  let lastAnchors: TocPaneAnchor[] = [];

  function applyFilter() {
    const q = filterQuery.trim().toLowerCase();
    const filtered =
      q.length === 0
        ? lastAnchors
        : lastAnchors.filter(a => (a.textContent || '').toLowerCase().includes(q));
    const emptyMsg = q.length > 0 ? 'No matching headings' : 'No headings yet';
    renderTocItems(list, filtered, onNavigate, emptyMsg);
  }

  filterInput.addEventListener('input', () => {
    filterQuery = filterInput.value;
    clearBtn.style.display = filterQuery.length > 0 ? '' : 'none';
    applyFilter();
  });

  clearBtn.addEventListener('click', () => {
    filterQuery = '';
    filterInput.value = '';
    clearBtn.style.display = 'none';
    applyFilter();
    filterInput.focus();
  });

  // Keyboard navigation from the filter input
  filterInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      filterQuery = '';
      filterInput.value = '';
      clearBtn.style.display = 'none';
      applyFilter();
      filterInput.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = list.querySelector('.toc-pane-item') as HTMLElement | null;
      if (first) first.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const first = list.querySelector('.toc-pane-item') as HTMLElement | null;
      if (first) first.click();
    }
  });

  // Resize logic
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startWidth = pane.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  const onMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    // Dragging left increases width, dragging right decreases
    const delta = startX - e.clientX;
    const newWidth = Math.max(180, Math.min(500, startWidth + delta));
    pane.style.width = `${newWidth}px`;
  };

  const onMouseUp = () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  let visible = false;

  return {
    update: (anchors: TocPaneAnchor[]) => {
      lastAnchors = anchors;
      applyFilter();
    },
    setVisible: (nextVisible: boolean) => {
      visible = nextVisible;
      pane.classList.toggle('is-visible', visible);
      mount.classList.toggle('toc-pane-visible', visible);
      if (!visible) {
        filterQuery = '';
        filterInput.value = '';
        clearBtn.style.display = 'none';
      }
    },
    toggle: () => {
      visible = !visible;
      pane.classList.toggle('is-visible', visible);
      mount.classList.toggle('toc-pane-visible', visible);
      if (!visible) {
        filterQuery = '';
        filterInput.value = '';
        clearBtn.style.display = 'none';
      }
    },
    isVisible: () => visible,
    getFilterQuery: () => filterQuery,
    destroy: () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      pane.remove();
    },
  };
}
