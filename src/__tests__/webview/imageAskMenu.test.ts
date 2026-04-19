/**
 * @jest-environment jsdom
 */

/**
 * Tests for the Image AI Ask menu rendering.
 * Validates the Ask section appears with correct items and icons.
 */

import { createImageMenu } from '../../webview/features/imageMenu';

describe('Image menu Ask section', () => {
  it('renders Ask section with all 5 menu items', () => {
    const menu = createImageMenu(true);

    const labels = Array.from(menu.querySelectorAll('.menu-section-label')).map(
      el => el.textContent
    );
    expect(labels).toContain('Ask');

    const actions = Array.from(menu.querySelectorAll('.menu-item')).map(el =>
      el.getAttribute('data-action')
    );
    expect(actions).toContain('askExplain');
    expect(actions).toContain('askAltText');
    expect(actions).toContain('askExtractText');
    expect(actions).toContain('askDescribe');
    expect(actions).toContain('askCustom');
  });

  it('renders Ask section even for external images (no Reveal)', () => {
    const menu = createImageMenu(false);

    const labels = Array.from(menu.querySelectorAll('.menu-section-label')).map(
      el => el.textContent
    );
    expect(labels).not.toContain('Reveal');
    expect(labels).toContain('Ask');
  });

  it('includes correct icons for Ask menu items', () => {
    const menu = createImageMenu(true);

    const explainIcon = menu.querySelector('[data-action="askExplain"] .menu-icon');
    expect(explainIcon?.classList.contains('codicon-comment-discussion')).toBe(true);

    const altTextIcon = menu.querySelector('[data-action="askAltText"] .menu-icon');
    expect(altTextIcon?.classList.contains('codicon-accessibility')).toBe(true);

    const extractIcon = menu.querySelector('[data-action="askExtractText"] .menu-icon');
    expect(extractIcon?.classList.contains('codicon-file-text')).toBe(true);

    const describeIcon = menu.querySelector('[data-action="askDescribe"] .menu-icon');
    expect(describeIcon?.classList.contains('codicon-book')).toBe(true);

    const customIcon = menu.querySelector('[data-action="askCustom"] .menu-icon');
    expect(customIcon?.classList.contains('codicon-question')).toBe(true);
  });

  it('has Edit section in all menus', () => {
    const localMenu = createImageMenu(true);
    const externalMenu = createImageMenu(false);

    const localLabels = Array.from(localMenu.querySelectorAll('.menu-section-label')).map(
      el => el.textContent
    );
    const externalLabels = Array.from(externalMenu.querySelectorAll('.menu-section-label')).map(
      el => el.textContent
    );

    expect(localLabels).toContain('Edit');
    expect(externalLabels).toContain('Edit');
  });

  it('local menu has Edit + Reveal + Ask sections', () => {
    const menu = createImageMenu(true);

    const labels = Array.from(menu.querySelectorAll('.menu-section-label')).map(
      el => el.textContent
    );
    expect(labels).toEqual(['Edit', 'Reveal', 'Ask']);
  });

  it('external menu has Edit + Ask sections only', () => {
    const menu = createImageMenu(false);

    const labels = Array.from(menu.querySelectorAll('.menu-section-label')).map(
      el => el.textContent
    );
    expect(labels).toEqual(['Edit', 'Ask']);
  });
});
