import { Editor } from '@tiptap/core';
import { AuditIssue } from './auditDocument';

export function showAuditOverlay(editor: Editor, issues: AuditIssue[]) {
  let overlay = document.getElementById('audit-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'audit-overlay';
    overlay.className = 'audit-overlay';
    document.body.appendChild(overlay);
  }

  if (issues.length === 0) {
    overlay.innerHTML = `
      <div class="audit-overlay-backdrop"></div>
      <div class="audit-overlay-panel">
        <div class="audit-overlay-header">
          <h3 class="audit-overlay-title">Document Audit</h3>
          <button class="audit-overlay-close" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.707L8 8.707z"/>
            </svg>
          </button>
        </div>
        <div class="audit-overlay-content">
          <div class="audit-overlay-empty">
            <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" style="color: var(--vscode-charts-green); margin-bottom: 16px;">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M13.854 3.646l-7.5 7.5L3.146 8.5l.708-.708 2.5 2.5 6.792-6.792.708.708z"/>
            </svg>
            <p>No issues found!</p>
            <p class="audit-overlay-empty-hint">Your document is healthy.</p>
          </div>
        </div>
      </div>
    `;
  } else {
    overlay.innerHTML = `
      <div class="audit-overlay-backdrop"></div>
      <div class="audit-overlay-panel">
        <div class="audit-overlay-header">
          <h3 class="audit-overlay-title">Document Audit (${issues.length} issues)</h3>
          <button class="audit-overlay-close" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.707L8 8.707z"/>
            </svg>
          </button>
        </div>
        <div class="audit-overlay-list">
          ${issues.map((issue) => `
            <button class="audit-overlay-item" data-pos="${issue.pos}">
              <div class="audit-issue-type ${issue.type}">
                ${issue.type === 'link' ? '🔗' : issue.type === 'image' ? '🖼️' : '📑'}
              </div>
              <div class="audit-issue-text">
                <div class="audit-issue-message">${issue.message}</div>
                ${issue.target ? `<div class="audit-issue-target">${issue.target}</div>` : ''}
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  overlay.classList.add('visible');

  const closeBtn = overlay.querySelector('.audit-overlay-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      overlay?.classList.remove('visible');
    });
  }
  
  const backdrop = overlay.querySelector('.audit-overlay-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      overlay?.classList.remove('visible');
    });
  }

  const items = overlay.querySelectorAll('.audit-overlay-item');
  items.forEach(item => {
    item.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const posStr = btn.getAttribute('data-pos');
      if (posStr) {
        const pos = parseInt(posStr, 10);
        editor.commands.setTextSelection(pos);
        editor.commands.scrollIntoView();
      }
    });
  });
}
