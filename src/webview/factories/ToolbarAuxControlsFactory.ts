import type { Editor } from '@tiptap/core';
import { MessageType } from '../../shared/messageTypes';

const REPO_URL = 'https://github.com/kamransethi/gpt-ai-markdown-editor';

/**
 * Builds right-side toolbar controls and about dialog wiring.
 */
export class ToolbarAuxControlsFactory {
  static appendTo(toolbar: HTMLElement, editor: Editor): void {
    const themeToggleGroup = document.createElement('div');
    themeToggleGroup.className = 'toolbar-group toolbar-theme-toggle-group toolbar-no-overflow';
    themeToggleGroup.style.marginLeft = 'auto';

    const themeToggleBtn = document.createElement('button');
    themeToggleBtn.type = 'button';
    themeToggleBtn.className = 'toolbar-button theme-toggle';
    themeToggleBtn.setAttribute('data-tooltip', 'Toggle light/dark theme');
    themeToggleBtn.setAttribute('aria-label', 'Toggle light/dark theme');
    themeToggleBtn.onmousedown = e => e.preventDefault();

    const isCurrentThemeDark = (): boolean => {
      const override = (window as any).gptAiCurrentThemeOverride;
      if (override) return override === 'dark';
      return (
        document.body.getAttribute('data-theme') === 'dark' ||
        document.body.classList.contains('vscode-dark')
      );
    };

    const updateThemeIcon = () => {
      themeToggleBtn.innerHTML = '';
      const icon = document.createElement('span');
      icon.className = 'toolbar-icon';
      const dark = isCurrentThemeDark();
      icon.innerHTML = dark
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      themeToggleBtn.appendChild(icon);
    };

    updateThemeIcon();

    themeToggleBtn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      const newTheme = isCurrentThemeDark() ? 'light' : 'dark';

      if (typeof (window as any).gptAiApplyTheme === 'function') {
        (window as any).gptAiApplyTheme(newTheme);
      }

      const vscodeApi = (window as any).vscode;
      if (vscodeApi && typeof vscodeApi.postMessage === 'function') {
        vscodeApi.postMessage({ type: MessageType.UPDATE_THEME_OVERRIDE, theme: newTheme });
      }
      updateThemeIcon();
    };

    const onThemeChanged = () => updateThemeIcon();
    window.addEventListener('gptAiThemeChanged', onThemeChanged);

    const helpBtn = document.createElement('button');
    helpBtn.type = 'button';
    helpBtn.className = 'toolbar-button help-about-button';
    helpBtn.setAttribute('data-tooltip', 'About this editor');
    helpBtn.setAttribute('aria-label', 'About this editor');
    helpBtn.onmousedown = e => e.preventDefault();
    const helpIcon = document.createElement('span');
    helpIcon.className = 'toolbar-icon';
    helpIcon.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    helpBtn.appendChild(helpIcon);
    helpBtn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      ToolbarAuxControlsFactory.showAboutModal();
    };

    themeToggleGroup.appendChild(helpBtn);
    themeToggleGroup.appendChild(themeToggleBtn);
    toolbar.appendChild(themeToggleGroup);

    editor.on('destroy', () => {
      window.removeEventListener('gptAiThemeChanged', onThemeChanged);
    });
  }

  private static showAboutModal(): void {
    document.querySelector('.about-modal-overlay')?.remove();

    const version = document.body.getAttribute('data-extension-version') || 'unknown';

    const overlay = document.createElement('div');
    overlay.className = 'about-modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'about-modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', 'About Flux Flow Markdown Editor');

    dialog.innerHTML = `
      <div class="about-modal-header">
        <h2 class="about-modal-title">Flux Flow Markdown Editor</h2>
        <button class="about-modal-close" aria-label="Close" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="about-modal-body">
        <div class="about-modal-version">
          <span class="about-modal-label">Version</span>
          <span class="about-modal-value">${version}</span>
        </div>
        <div class="about-modal-version">
          <span class="about-modal-label">Publisher</span>
          <span class="about-modal-value">DK-AI</span>
        </div>
        <div class="about-modal-version">
          <span class="about-modal-label">License</span>
          <span class="about-modal-value">MIT</span>
        </div>
        <div class="about-modal-divider"></div>
        <div class="about-modal-links">
          <a class="about-modal-link" data-url="${REPO_URL}#readme">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            Documentation
          </a>
          <a class="about-modal-link" data-url="${REPO_URL}/blob/main/CHANGELOG.md">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Changelog
          </a>
          <a class="about-modal-link" data-url="${REPO_URL}/blob/main/FEATURES.md">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Features
          </a>
          <a class="about-modal-link" data-url="${REPO_URL}/issues">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Report an Issue
          </a>
          <a class="about-modal-link" data-url="${REPO_URL}/discussions">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Community Discussions
          </a>
        </div>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    dialog.querySelectorAll('.about-modal-link[data-url]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const url = (link as HTMLElement).getAttribute('data-url');
        if (url) {
          const vscodeApi = (window as any).vscode;
          if (vscodeApi && typeof vscodeApi.postMessage === 'function') {
            vscodeApi.postMessage({ type: MessageType.OPEN_EXTERNAL_LINK, url });
          }
        }
      });
    });

    const close = () => overlay.remove();
    overlay.querySelector('.about-modal-close')!.addEventListener('click', close);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  }
}
