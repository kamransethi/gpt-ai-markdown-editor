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
});
