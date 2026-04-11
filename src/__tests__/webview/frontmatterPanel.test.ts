/** @jest-environment jsdom */
/**
 * Real TipTap editor tests for FrontmatterBlock:
 *  - Node can be inserted into a document
 *  - NodeView renders .frontmatter-block DOM with header + content
 *  - Content starts hidden (collapsed)
 *  - Clicking header toggles visibility
 *  - _fmToggle / _fmOpen / _fmIsOpen helpers work
 *  - update() re-renders yaml text from new attrs
 *  - extractFrontmatterText reads yaml from node attrs
 *  - isFrontmatterBlock type guard
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  FrontmatterBlock,
  isFrontmatterBlock,
  extractFrontmatterText,
} from '../../webview/extensions/frontmatterPanel';

function createEditor(): Editor {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return new Editor({
    element: el,
    extensions: [StarterKit.configure({ codeBlock: false }), FrontmatterBlock],
  });
}

function insertFrontmatterBlock(editor: Editor, yaml: string) {
  editor.commands.insertContentAt(0, {
    type: 'frontmatterBlock',
    content: yaml ? [{ type: 'text', text: yaml }] : [],
  });
}

describe('FrontmatterBlock extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createEditor();
  });

  afterEach(() => {
    editor.destroy();
  });

  // ── Node schema ─────────────────────────────────────────────────────────────

  it('can insert a frontmatterBlock node', () => {
    insertFrontmatterBlock(editor, 'title: Test\n');
    const firstNode = editor.state.doc.firstChild;
    expect(firstNode?.type.name).toBe('frontmatterBlock');
  });

  it('stores yaml text as node text content', () => {
    insertFrontmatterBlock(editor, 'marp: true\ntheme: gaia\n');
    const node = editor.state.doc.firstChild!;
    expect(node.textContent).toBe('marp: true\ntheme: gaia\n');
  });

  // ── Helper exports ──────────────────────────────────────────────────────────

  it('isFrontmatterBlock returns true for frontmatterBlock node', () => {
    insertFrontmatterBlock(editor, 'x: 1');
    expect(isFrontmatterBlock(editor.state.doc.firstChild)).toBe(true);
  });

  it('isFrontmatterBlock returns false for other nodes', () => {
    expect(isFrontmatterBlock(null)).toBe(false);
    expect(isFrontmatterBlock(undefined)).toBe(false);
  });

  it('extractFrontmatterText reads yaml from node textContent', () => {
    insertFrontmatterBlock(editor, 'key: value\n');
    const node = editor.state.doc.firstChild!;
    expect(extractFrontmatterText(node)).toBe('key: value\n');
  });

  it('extractFrontmatterText returns empty string for empty yaml', () => {
    insertFrontmatterBlock(editor, '');
    const node = editor.state.doc.firstChild!;
    expect(extractFrontmatterText(node)).toBe('');
  });

  // ── NodeView DOM ─────────────────────────────────────────────────────────────

  it('NodeView renders .frontmatter-block element', () => {
    insertFrontmatterBlock(editor, 'title: Hi');
    const block = document.querySelector('.frontmatter-block');
    expect(block).not.toBeNull();
  });

  it('NodeView renders .frontmatter-block-header', () => {
    insertFrontmatterBlock(editor, 'title: Hi');
    const header = document.querySelector('.frontmatter-block-header');
    expect(header).not.toBeNull();
  });

  it('NodeView renders FRONT MATTER label text', () => {
    insertFrontmatterBlock(editor, 'title: Hi');
    const label = document.querySelector('.frontmatter-label');
    expect(label?.textContent).toBe('FRONT MATTER');
  });

  it('NodeView renders yaml in code element', () => {
    insertFrontmatterBlock(editor, 'marp: true\n');
    const code = document.querySelector('.frontmatter-block code');
    expect(code?.textContent).toBe('marp: true\n');
  });

  it('content starts hidden (collapsed)', () => {
    insertFrontmatterBlock(editor, 'x: 1');
    const content = document.querySelector('.frontmatter-content-wrap') as HTMLElement;
    expect(content?.style.display).toBe('none');
  });

  it('triangle starts pointing right (collapsed)', () => {
    insertFrontmatterBlock(editor, 'x: 1');
    const triangle = document.querySelector('.frontmatter-triangle') as HTMLElement;
    expect(triangle?.style.transform).toBe('');
  });

  // ── Toggle behaviour ─────────────────────────────────────────────────────────

  it('clicking header reveals content', () => {
    insertFrontmatterBlock(editor, 'x: 1');
    const header = document.querySelector('.frontmatter-block-header') as HTMLElement;
    const content = document.querySelector('.frontmatter-content-wrap') as HTMLElement;
    header.click();
    expect(content.style.display).toBe('');
  });

  it('clicking header twice hides content again', () => {
    insertFrontmatterBlock(editor, 'x: 1');
    const header = document.querySelector('.frontmatter-block-header') as HTMLElement;
    const content = document.querySelector('.frontmatter-content-wrap') as HTMLElement;
    header.click();
    header.click();
    expect(content.style.display).toBe('none');
  });

  it('_fmToggle helper toggles visibility', () => {
    insertFrontmatterBlock(editor, 'x: 1');
    const block = document.querySelector('.frontmatter-block') as any;
    const content = document.querySelector('.frontmatter-content-wrap') as HTMLElement;
    block._fmToggle();
    expect(content.style.display).toBe('');
    block._fmToggle();
    expect(content.style.display).toBe('none');
  });

  it('_fmOpen(true) reveals content', () => {
    insertFrontmatterBlock(editor, 'x: 1');
    const block = document.querySelector('.frontmatter-block') as any;
    const content = document.querySelector('.frontmatter-content-wrap') as HTMLElement;
    block._fmOpen(true);
    expect(content.style.display).toBe('');
  });

  it('_fmIsOpen() reflects current state', () => {
    insertFrontmatterBlock(editor, 'x: 1');
    const block = document.querySelector('.frontmatter-block') as any;
    expect(block._fmIsOpen()).toBe(false);
    block._fmOpen(true);
    expect(block._fmIsOpen()).toBe(true);
  });

  // ── update() ─────────────────────────────────────────────────────────────────

  it('update() re-renders yaml when attrs change', () => {
    insertFrontmatterBlock(editor, 'old: value');
    let nodePos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'frontmatterBlock' && nodePos === -1) {
        nodePos = pos;
      }
    });
    editor.view.dispatch(editor.state.tr.replaceWith(
      nodePos + 1,
      nodePos + 1 + editor.state.doc.nodeAt(nodePos)!.content.size,
      editor.state.schema.text('new: value')
    ));
    const code = document.querySelector('.frontmatter-block code');
    expect(code?.textContent).toBe('new: value');
  });
});
