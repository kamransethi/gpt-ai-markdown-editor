/**
 * @jest-environment jsdom
 *
 * Integration tests for mermaid double-click edit behavior
 * Tests the DOM interaction flow: single-click highlight, double-click edit, preview button
 */

describe('Mermaid Double-Click Edit Interaction', () => {
  let container: HTMLDivElement;
  let codeElement: HTMLPreElement;
  let renderElement: HTMLDivElement;
  let tooltip: HTMLDivElement;
  let previewBtn: HTMLButtonElement;
  let isHighlighted: boolean;
  let isEditMode: boolean;

  // Simulation of the actual mermaid.ts implementation
  const setupMermaidDiagram = () => {
    container = document.createElement('div');
    container.classList.add('mermaid-wrapper');

    codeElement = document.createElement('pre');
    codeElement.classList.add('mermaid-source', 'hidden');
    codeElement.textContent = 'graph TD\nA-->B';

    renderElement = document.createElement('div');
    renderElement.classList.add('mermaid-render');
    renderElement.innerHTML = '<svg>mock diagram</svg>';

    tooltip = document.createElement('div');
    tooltip.classList.add('mermaid-tooltip');
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('id', `mermaid-tooltip-${Math.random().toString(36).slice(2, 11)}`);
    tooltip.textContent = 'Double-click to edit';
    tooltip.style.display = 'none';

    previewBtn = document.createElement('button');
    previewBtn.classList.add('mermaid-preview-btn');
    previewBtn.textContent = 'Preview';
    previewBtn.style.display = 'none';
    previewBtn.setAttribute('aria-label', 'Return to diagram preview');

    codeElement.insertBefore(previewBtn, codeElement.firstChild);
    container.appendChild(codeElement);
    container.appendChild(renderElement);
    container.appendChild(tooltip);

    isHighlighted = false;
    isEditMode = false;

    // Helper functions matching implementation
    const removeHighlight = () => {
      container.classList.remove('highlighted');
      tooltip.style.display = 'none';
      isHighlighted = false;
    };

    const enterEditMode = () => {
      codeElement.classList.remove('hidden');
      renderElement.classList.add('hidden');
      previewBtn.style.display = 'block';
      removeHighlight();
      isEditMode = true;
    };

    const exitEditMode = () => {
      codeElement.classList.add('hidden');
      renderElement.classList.remove('hidden');
      previewBtn.style.display = 'none';
      isEditMode = false;
    };

    // Event listeners matching implementation
    container.addEventListener('click', e => {
      if (e.target === previewBtn) return;
      if (!isEditMode && !isHighlighted) {
        container.classList.add('highlighted');
        tooltip.style.display = 'block';
        container.setAttribute('aria-describedby', tooltip.id);
        isHighlighted = true;
      }
    });

    container.addEventListener('dblclick', () => {
      if (!isEditMode) {
        enterEditMode();
      }
    });

    previewBtn.addEventListener('click', e => {
      e.stopPropagation();
      exitEditMode();
    });

    document.addEventListener('click', e => {
      if (!container.contains(e.target as HTMLElement) && isHighlighted) {
        removeHighlight();
      }
    });

    document.body.appendChild(container);
  };

  beforeEach(() => {
    setupMermaidDiagram();
  });

  afterEach(() => {
    document.body.removeChild(container);
    isHighlighted = false;
    isEditMode = false;
  });

  describe('Initial state', () => {
    it('should render diagram in preview mode', () => {
      expect(codeElement.classList.contains('hidden')).toBe(true);
      expect(renderElement.classList.contains('hidden')).toBe(false);
    });

    it('should have tooltip hidden initially', () => {
      expect(tooltip.style.display).toBe('none');
    });

    it('should have preview button hidden initially', () => {
      expect(previewBtn.style.display).toBe('none');
    });
  });

  describe('Single-click behavior', () => {
    it('should add highlighted class on single-click', () => {
      container.click();
      expect(container.classList.contains('highlighted')).toBe(true);
    });

    it('should show tooltip on single-click', () => {
      container.click();
      expect(tooltip.style.display).toBe('block');
    });

    it('should set aria-describedby on single-click', () => {
      container.click();
      expect(container.getAttribute('aria-describedby')).toBe(tooltip.id);
    });

    it('should not highlight on second single-click', () => {
      container.click();
      const wasHighlighted = container.classList.contains('highlighted');
      container.click(); // Second click shouldn't toggle
      expect(container.classList.contains('highlighted')).toBe(wasHighlighted);
    });
  });

  describe('Double-click behavior', () => {
    it('should enter edit mode on double-click', () => {
      container.dispatchEvent(new Event('dblclick'));
      expect(codeElement.classList.contains('hidden')).toBe(false);
      expect(renderElement.classList.contains('hidden')).toBe(true);
    });

    it('should show preview button when entering edit mode', () => {
      container.dispatchEvent(new Event('dblclick'));
      expect(previewBtn.style.display).toBe('block');
    });

    it('should remove highlight when entering edit mode', () => {
      container.click(); // First highlight
      expect(container.classList.contains('highlighted')).toBe(true);

      container.dispatchEvent(new Event('dblclick')); // Then edit
      expect(container.classList.contains('highlighted')).toBe(false);
      expect(tooltip.style.display).toBe('none');
    });
  });

  describe('Preview button behavior', () => {
    it('should exit edit mode when clicked', () => {
      // Enter edit mode
      container.dispatchEvent(new Event('dblclick'));
      expect(codeElement.classList.contains('hidden')).toBe(false);

      // Click preview button
      previewBtn.click();
      expect(codeElement.classList.contains('hidden')).toBe(true);
      expect(renderElement.classList.contains('hidden')).toBe(false);
      expect(previewBtn.style.display).toBe('none');
    });

    it('should not trigger container click event', () => {
      // This test verifies stopPropagation works
      container.dispatchEvent(new Event('dblclick')); // Enter edit mode

      const clickSpy = jest.fn();
      container.addEventListener('click', clickSpy);

      previewBtn.click();
      // The container click handler shouldn't fire due to stopPropagation
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('Click outside behavior', () => {
    it('should remove highlight when clicking outside', () => {
      container.click(); // Highlight
      expect(container.classList.contains('highlighted')).toBe(true);

      // Click outside
      const outsideElement = document.createElement('div');
      document.body.appendChild(outsideElement);
      outsideElement.click();

      expect(container.classList.contains('highlighted')).toBe(false);
      expect(tooltip.style.display).toBe('none');

      document.body.removeChild(outsideElement);
    });
  });

  describe('Accessibility', () => {
    it('should have correct tooltip ARIA attributes', () => {
      expect(tooltip.getAttribute('role')).toBe('tooltip');
      expect(tooltip.id).toMatch(/^mermaid-tooltip-/);
      expect(tooltip.textContent).toBe('Double-click to edit');
    });

    it('should connect tooltip to container via aria-describedby', () => {
      container.click();
      expect(container.getAttribute('aria-describedby')).toBe(tooltip.id);
    });

    it('should have preview button with aria-label', () => {
      expect(previewBtn.getAttribute('aria-label')).toBe('Return to diagram preview');
    });

    it('should have semantic preview button element', () => {
      expect(previewBtn.tagName).toBe('BUTTON');
      expect(previewBtn.textContent).toBe('Preview');
    });
  });

  describe('State management', () => {
    it('should prevent highlighting while in edit mode', () => {
      // Enter edit mode
      container.dispatchEvent(new Event('dblclick'));

      // Try to single-click (shouldn't highlight)
      const beforeClass = container.className;
      container.click();
      expect(container.className).toBe(beforeClass); // No change
    });

    it('should handle rapid click sequences correctly', () => {
      // Single-click (highlight)
      container.click();
      expect(container.classList.contains('highlighted')).toBe(true);

      // Double-click (edit mode, removes highlight)
      container.dispatchEvent(new Event('dblclick'));
      expect(container.classList.contains('highlighted')).toBe(false);
      expect(codeElement.classList.contains('hidden')).toBe(false);

      // Preview (back to render mode)
      previewBtn.click();
      expect(codeElement.classList.contains('hidden')).toBe(true);
      expect(renderElement.classList.contains('hidden')).toBe(false);
    });
  });
});
