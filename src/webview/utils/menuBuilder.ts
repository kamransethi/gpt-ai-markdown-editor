/**
 * Shared context menu builder used by both text and table context menus.
 * Encapsulates menu DOM creation, item builders, submenu management,
 * viewport clamping, and show/hide/destroy lifecycle.
 *
 * @module menuBuilder
 */

// ── Types ───────────────────────────────────────────────────────────

export interface MenuController {
  element: HTMLElement;
  show: (x: number, y: number) => void;
  hide: () => void;
  destroy: () => void;
}

export interface MenuItemOpts {
  shortcut?: string;
  enabledFn?: () => boolean;
  className?: string;
}

export interface SubmenuTriggerOpts {
  enabledFn?: () => boolean;
  badge?: string;
}

export interface IconButton {
  icon: string;
  title: string;
  action: () => void;
}

// ── Viewport clamping ───────────────────────────────────────────────

/** Clamp menu position to keep it within the viewport */
export function clampPosition(
  x: number,
  y: number,
  menu: HTMLElement
): { left: number; top: number } {
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x;
  let top = y;
  if (left + rect.width > vw - 8) left = vw - rect.width - 8;
  if (top + rect.height > vh - 8) top = vh - rect.height - 8;
  if (left < 4) left = 4;
  if (top < 4) top = 4;
  return { left, top };
}

// ── MenuBuilder ─────────────────────────────────────────────────────

/**
 * Builds a context menu with items, separators, submenus, icon button rows,
 * and manages the show/hide/destroy lifecycle.
 */
export class MenuBuilder {
  readonly element: HTMLElement;

  private activeSubmenu: HTMLElement | null = null;
  private submenuTimeout: ReturnType<typeof setTimeout> | null = null;
  private enabledFns = new Map<HTMLButtonElement, () => boolean>();
  private onDocClick: (() => void) | null = null;
  private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

  /** Optional hook called by items before executing their action */
  onBeforeAction: (() => void) | null = null;

  constructor(className: string, ariaLabel: string) {
    const menu = document.createElement('div');
    menu.className = className;
    menu.style.display = 'none';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', ariaLabel);
    menu.onmousedown = e => {
      e.preventDefault();
      e.stopPropagation();
    };
    this.element = menu;
  }

  /** Add a menu item button. Returns the button element. */
  addItem(label: string, action: () => void, opts?: MenuItemOpts): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'context-menu-item' + (opts?.className ? ` ${opts.className}` : '');
    btn.setAttribute('role', 'menuitem');

    const labelEl = document.createElement('span');
    labelEl.className = 'context-menu-label';
    labelEl.textContent = label;
    btn.appendChild(labelEl);

    if (opts?.shortcut) {
      const shortcutEl = document.createElement('span');
      shortcutEl.className = 'context-menu-shortcut';
      shortcutEl.textContent = opts.shortcut;
      btn.appendChild(shortcutEl);
    }

    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled) return;
      this.onBeforeAction?.();
      action();
      this.hide();
    };

    if (opts?.enabledFn) this.enabledFns.set(btn, opts.enabledFn);
    this.element.appendChild(btn);
    return btn;
  }

  /** Add a visual separator */
  addSeparator(): void {
    const sep = document.createElement('div');
    sep.className = 'context-menu-separator';
    sep.setAttribute('role', 'separator');
    this.element.appendChild(sep);
  }

  /** Add a non-interactive section label */
  addSectionLabel(text: string): void {
    const label = document.createElement('div');
    label.className = 'context-menu-section-label';
    label.textContent = text;
    this.element.appendChild(label);
  }

  /** Add a row of small icon buttons (Google Docs INSERT/DELETE style) */
  addButtonRow(buttons: IconButton[]): void {
    const row = document.createElement('div');
    row.className = 'context-menu-button-row';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'context-menu-icon-btn';
      btn.title = b.title;
      btn.setAttribute('aria-label', b.title);
      btn.innerHTML = b.icon;
      btn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this.onBeforeAction?.();
        b.action();
        this.hide();
      };
      row.appendChild(btn);
    });
    this.element.appendChild(row);
  }

  /** Add a submenu trigger with hover-based reveal */
  addSubmenuTrigger(
    label: string,
    buildSubmenu: (submenu: HTMLElement) => void,
    opts?: SubmenuTriggerOpts
  ): HTMLButtonElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'context-menu-submenu-wrapper';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'context-menu-item context-menu-submenu-trigger';
    btn.setAttribute('role', 'menuitem');
    btn.setAttribute('aria-haspopup', 'true');

    const labelEl = document.createElement('span');
    labelEl.className = 'context-menu-label';
    labelEl.textContent = label;
    btn.appendChild(labelEl);

    if (opts?.badge) {
      const badgeEl = document.createElement('span');
      badgeEl.className = 'context-menu-badge';
      badgeEl.textContent = opts.badge;
      btn.appendChild(badgeEl);
    }

    const arrow = document.createElement('span');
    arrow.className = 'context-menu-arrow';
    arrow.textContent = '▸';
    btn.appendChild(arrow);

    const submenu = document.createElement('div');
    submenu.className = 'context-menu-submenu';
    submenu.style.display = 'none';
    submenu.setAttribute('role', 'menu');
    buildSubmenu(submenu);

    wrapper.appendChild(btn);
    wrapper.appendChild(submenu);

    wrapper.addEventListener('mouseenter', () => {
      if (this.submenuTimeout) clearTimeout(this.submenuTimeout);
      if (btn.disabled) return;
      this.closeSubmenu();
      submenu.style.display = 'block';
      this.activeSubmenu = submenu;
      const wrapperRect = wrapper.getBoundingClientRect();
      const subWidth = submenu.offsetWidth || 200;
      if (wrapperRect.right + subWidth > window.innerWidth - 8) {
        submenu.style.left = 'auto';
        submenu.style.right = '100%';
      } else {
        submenu.style.left = '100%';
        submenu.style.right = 'auto';
      }
    });

    wrapper.addEventListener('mouseleave', () => {
      this.submenuTimeout = setTimeout(() => {
        submenu.style.display = 'none';
        if (this.activeSubmenu === submenu) this.activeSubmenu = null;
      }, 150);
    });

    if (opts?.enabledFn) this.enabledFns.set(btn, opts.enabledFn);
    this.element.appendChild(wrapper);
    return btn;
  }

  /** Refresh enabled/disabled states of all tracked buttons */
  refreshEnabledStates(): void {
    this.enabledFns.forEach((fn, btn) => {
      const enabled = fn();
      btn.disabled = !enabled;
      btn.classList.toggle('disabled', !enabled);
    });
  }

  /** Show the menu at viewport coordinates */
  show(x: number, y: number): void {
    this.refreshEnabledStates();
    this.element.style.display = 'block';
    requestAnimationFrame(() => {
      const pos = clampPosition(x, y, this.element);
      this.element.style.left = `${pos.left}px`;
      this.element.style.top = `${pos.top}px`;
    });
  }

  /** Hide the menu */
  hide(): void {
    this.closeSubmenu();
    this.element.style.display = 'none';
  }

  /** Attach to the DOM and start listening for outside-click and Escape */
  mount(): void {
    document.body.appendChild(this.element);

    this.onDocClick = () => this.hide();
    document.addEventListener('click', this.onDocClick);

    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.element.style.display !== 'none') {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.onKeyDown);
  }

  /** Remove from the DOM and clean up listeners */
  destroy(): void {
    if (this.onDocClick) document.removeEventListener('click', this.onDocClick);
    if (this.onKeyDown) document.removeEventListener('keydown', this.onKeyDown);
    this.element.remove();
  }

  private closeSubmenu(): void {
    if (this.activeSubmenu) {
      this.activeSubmenu.style.display = 'none';
      this.activeSubmenu = null;
    }
  }
}
