/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Shared UI component for TipTap suggestions.
 * Handles rendering, positioning, and keyboard navigation.
 */

export interface SuggestionItem {
  title: string;
  description: string;
  icon: string;
  [key: string]: any;
}

export class SuggestionList {
  private popupEl: HTMLElement | null = null;
  private selectedIndex = 0;
  private items: SuggestionItem[] = [];
  private onSelect: (item: any) => void;

  constructor(onSelect: (item: any) => void) {
    this.onSelect = onSelect;
  }

  public mount(props: any) {
    this.popupEl = document.createElement('div');
    this.popupEl.className = 'slash-command-menu';
    this.popupEl.setAttribute('role', 'listbox');
    document.body.appendChild(this.popupEl);

    this.items = props.items;
    this.render();
    this.position(props.clientRect?.());
  }

  public update(props: any) {
    this.items = props.items;
    this.render();
    this.position(props.clientRect?.());
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    if (event.key === 'ArrowDown') {
      this.selectedIndex = (this.selectedIndex + 1) % (this.items.length || 1);
      this.updateSelection();
      return true;
    }
    if (event.key === 'ArrowUp') {
      this.selectedIndex = (this.selectedIndex - 1 + (this.items.length || 1)) % (this.items.length || 1);
      this.updateSelection();
      return true;
    }
    if (event.key === 'Enter') {
      const item = this.items[this.selectedIndex];
      if (item) {
        this.onSelect(item);
        return true;
      }
    }
    if (event.key === 'Escape') {
      this.destroy();
      return true;
    }
    return false;
  }

  public destroy() {
    this.popupEl?.remove();
    this.popupEl = null;
  }

  private render() {
    if (!this.popupEl) return;
    this.popupEl.innerHTML = '';
    this.selectedIndex = 0;

    if (this.items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'slash-command-empty';
      empty.textContent = 'No matching items';
      this.popupEl.appendChild(empty);
      return;
    }

    this.items.forEach((item, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slash-command-item';
      if (i === 0) btn.classList.add('is-selected');
      btn.setAttribute('role', 'option');

      btn.innerHTML = `
        <span class="slash-command-icon">${item.icon}</span>
        <span class="slash-command-text">
          <span class="slash-command-title">${item.title}</span>
          <span class="slash-command-desc">${item.description}</span>
        </span>
      `;

      btn.addEventListener('click', () => this.onSelect(item));
      btn.addEventListener('mouseenter', () => {
        this.popupEl?.querySelectorAll('.slash-command-item').forEach(el => el.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        this.selectedIndex = i;
      });

      this.popupEl!.appendChild(btn);
    });
  }

  private updateSelection() {
    const allBtns = this.popupEl?.querySelectorAll('.slash-command-item');
    if (!allBtns) return;
    allBtns.forEach((el, i) => {
      el.classList.toggle('is-selected', i === this.selectedIndex);
      if (i === this.selectedIndex) {
        (el as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    });
  }

  private position(coords: any) {
    if (!coords || !this.popupEl) return;
    
    const { left, bottom, top } = coords;
    const popupHeight = this.popupEl.clientHeight || 350;
    const viewportHeight = window.innerHeight;
    
    if (bottom + popupHeight > viewportHeight && top - popupHeight > 0) {
      this.popupEl.style.top = `${top - popupHeight}px`;
    } else {
      this.popupEl.style.top = `${bottom + 4}px`;
    }
    this.popupEl.style.left = `${left}px`;
  }
}
