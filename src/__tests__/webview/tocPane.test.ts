/**
 * @jest-environment jsdom
 */

import { createTocPane, type TocPaneAnchor } from '../../webview/features/tocPane';

describe('TOC left pane', () => {
  const makeAnchors = (): TocPaneAnchor[] => [
    {
      id: 'first-heading',
      textContent: 'First Heading',
      level: 1,
      itemIndex: '0',
      pos: 1,
      isActive: true,
    },
    {
      id: 'second-heading',
      textContent: 'Second Heading',
      level: 2,
      itemIndex: '1',
      pos: 24,
      isActive: false,
    },
  ];

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders anchors and emits navigate callback when clicked', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    const onNavigate = jest.fn();
    const tocPane = createTocPane({ mount, onNavigate });

    tocPane.update(makeAnchors());

    const items = mount.querySelectorAll('.toc-pane-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('First Heading');
    expect(items[0].classList.contains('is-active')).toBe(true);

    (items[1] as HTMLButtonElement).click();
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'second-heading', pos: 24 })
    );
  });

  it('toggles visibility state and class', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    const tocPane = createTocPane({ mount, onNavigate: jest.fn() });

    expect(tocPane.isVisible()).toBe(false);

    tocPane.setVisible(true);
    expect(tocPane.isVisible()).toBe(true);
    expect(mount.querySelector('.toc-pane')?.classList.contains('is-visible')).toBe(true);

    tocPane.toggle();
    expect(tocPane.isVisible()).toBe(false);
    expect(mount.querySelector('.toc-pane')?.classList.contains('is-visible')).toBe(false);
  });

  describe('filter', () => {
    function setup() {
      const mount = document.createElement('div');
      document.body.appendChild(mount);
      const onNavigate = jest.fn();
      const tocPane = createTocPane({ mount, onNavigate });
      tocPane.setVisible(true);

      const anchors: TocPaneAnchor[] = [
        {
          id: 'intro',
          textContent: 'Introduction',
          level: 1,
          itemIndex: '0',
          pos: 1,
          isActive: true,
        },
        {
          id: 'deploy',
          textContent: 'Deployment Guide',
          level: 2,
          itemIndex: '1',
          pos: 50,
          isActive: false,
        },
        {
          id: 'api',
          textContent: 'API Reference',
          level: 2,
          itemIndex: '2',
          pos: 100,
          isActive: false,
        },
        {
          id: 'deploy-prod',
          textContent: 'Production Deployment',
          level: 3,
          itemIndex: '3',
          pos: 150,
          isActive: false,
        },
      ];
      tocPane.update(anchors);

      const filterInput = mount.querySelector('.toc-pane-filter') as HTMLInputElement;
      const clearBtn = mount.querySelector('.toc-pane-filter-clear') as HTMLButtonElement;

      function typeFilter(text: string) {
        filterInput.value = text;
        filterInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      return { mount, onNavigate, tocPane, filterInput, clearBtn, typeFilter };
    }

    it('filters headings by case-insensitive substring match', () => {
      const { mount, typeFilter } = setup();

      typeFilter('deploy');
      const items = mount.querySelectorAll('.toc-pane-item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toContain('Deployment Guide');
      expect(items[1].textContent).toContain('Production Deployment');
    });

    it('shows "No matching headings" when filter produces zero results', () => {
      const { mount, typeFilter } = setup();

      typeFilter('zzzzz');
      const items = mount.querySelectorAll('.toc-pane-item');
      expect(items.length).toBe(0);
      const empty = mount.querySelector('.toc-pane-empty');
      expect(empty?.textContent).toBe('No matching headings');
    });

    it('restores all headings when filter is cleared', () => {
      const { mount, typeFilter } = setup();

      typeFilter('api');
      expect(mount.querySelectorAll('.toc-pane-item').length).toBe(1);

      typeFilter('');
      expect(mount.querySelectorAll('.toc-pane-item').length).toBe(4);
    });

    it('treats whitespace-only input as empty (shows all)', () => {
      const { mount, typeFilter } = setup();

      typeFilter('   ');
      expect(mount.querySelectorAll('.toc-pane-item').length).toBe(4);
    });

    it('shows clear button only when filter has text', () => {
      const { clearBtn, typeFilter } = setup();

      expect(clearBtn.style.display).toBe('none');
      typeFilter('api');
      expect(clearBtn.style.display).toBe('');
      typeFilter('');
      expect(clearBtn.style.display).toBe('none');
    });

    it('clear button resets filter and restores all items', () => {
      const { mount, clearBtn, typeFilter, filterInput } = setup();

      typeFilter('deploy');
      expect(mount.querySelectorAll('.toc-pane-item').length).toBe(2);

      clearBtn.click();
      expect(filterInput.value).toBe('');
      expect(mount.querySelectorAll('.toc-pane-item').length).toBe(4);
    });

    it('clears filter when pane is hidden via toggle', () => {
      const { tocPane, typeFilter, filterInput } = setup();

      typeFilter('api');
      expect(tocPane.getFilterQuery()).toBe('api');

      tocPane.toggle(); // hide
      expect(tocPane.getFilterQuery()).toBe('');
      expect(filterInput.value).toBe('');
    });

    it('Escape key clears filter', () => {
      const { mount, typeFilter, filterInput } = setup();

      typeFilter('deploy');
      expect(mount.querySelectorAll('.toc-pane-item').length).toBe(2);

      filterInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(filterInput.value).toBe('');
      expect(mount.querySelectorAll('.toc-pane-item').length).toBe(4);
    });
  });
});
