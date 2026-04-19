/** @jest-environment jsdom */

/**
 * Integration test for task list copy-paste round-trip.
 *
 * Reproduces the bug where copying task list items from the WYSIWYG editor
 * and pasting them produces `<label>` and `<div>` literal text instead of
 * the actual task content. Root cause: TaskItem's parseHTML rule lacks
 * `contentElement`, so ProseMirror's DOMParser includes <label> and <div>
 * structural elements as content when re-parsing clipboard HTML.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { ListKit } from '@tiptap/extension-list';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import { MarkdownParagraph } from '../../webview/extensions/markdownParagraph';
import { OrderedListMarkdownFix } from '../../webview/extensions/orderedListMarkdownFix';
import { TaskItemClipboardFix } from '../../webview/extensions/taskItemClipboardFix';

function createTestEditor(): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);

  return new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        paragraph: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        taskList: false,
        taskItem: false,
        listKeymap: false,
        undoRedo: { depth: 100 },
      } as any),
      MarkdownParagraph,
      Markdown.configure({
        markedOptions: { gfm: true, breaks: true },
      }),
      ListKit.configure({
        orderedList: false,
        taskItem: false, // Replaced by TaskItemClipboardFix
      }),
      TaskItemClipboardFix.configure({ nested: true }),
      OrderedListMarkdownFix,
    ],
    editorProps: {
      attributes: { class: 'markdown-editor' },
    },
  });
}

describe('Task list copy-paste round-trip', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('should round-trip task list markdown through the editor', () => {
    editor = createTestEditor();
    const taskMd = '- [x] Completed task\n- [ ] Incomplete task\n- [ ] Third task';

    editor.commands.setContent(taskMd, { contentType: 'markdown' });
    const markdown = editor.getMarkdown();

    expect(markdown).toContain('- [x] Completed task');
    expect(markdown).toContain('- [ ] Incomplete task');
    expect(markdown).toContain('- [ ] Third task');
    expect(markdown).not.toContain('<label>');
    expect(markdown).not.toContain('<div>');
  });

  it('should NOT produce <label> or <div> text in task item serialization', () => {
    editor = createTestEditor();
    const taskMd = '- [x] Completed task\n- [ ] Incomplete task';

    editor.commands.setContent(taskMd, { contentType: 'markdown' });

    // Get the JSON and verify task items have correct content
    const json = editor.getJSON();
    const taskItems: any[] = [];
    const walk = (node: any) => {
      if (node.type === 'taskItem') taskItems.push(node);
      if (node.content) node.content.forEach(walk);
    };
    walk(json);

    expect(taskItems.length).toBe(2);

    // First task item should have paragraph with "Completed task"
    const firstContent = taskItems[0].content?.[0]?.content?.[0]?.text;
    expect(firstContent).toBe('Completed task');
    expect(taskItems[0].attrs?.checked).toBe(true);

    // Second task item should have paragraph with "Incomplete task"
    const secondContent = taskItems[1].content?.[0]?.content?.[0]?.text;
    expect(secondContent).toBe('Incomplete task');
    expect(taskItems[1].attrs?.checked).toBe(false);
  });

  it('should correctly parse TipTap task item HTML back via DOMParser (clipboard round-trip)', () => {
    editor = createTestEditor();

    // This is the HTML that TipTap's renderHTML generates for task items
    // (what ProseMirror puts on the clipboard when you copy)
    const clipboardHtml = `
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="true">
          <label><input type="checkbox" checked="checked"><span></span></label>
          <div><p>Completed task</p></div>
        </li>
        <li data-type="taskItem" data-checked="false">
          <label><input type="checkbox"><span></span></label>
          <div><p>Incomplete task</p></div>
        </li>
      </ul>
    `;

    // Parse this HTML using ProseMirror's DOMParser (same as paste)
    const domNode = document.createElement('div');
    domNode.innerHTML = clipboardHtml;
    const doc = ProseMirrorDOMParser.fromSchema(editor.schema).parse(domNode);

    // Convert back to JSON and then serialize to markdown
    const json = doc.toJSON();
    const markdown = (editor as any).markdown.serialize(json);

    expect(markdown).toContain('- [x] Completed task');
    expect(markdown).toContain('- [ ] Incomplete task');
    expect(markdown).not.toContain('<label>');
    expect(markdown).not.toContain('<div>');
  });

  it('should handle task items with formatted content in clipboard HTML', () => {
    editor = createTestEditor();

    const clipboardHtml = `
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false">
          <label><input type="checkbox"><span></span></label>
          <div><p>Task with <strong>bold</strong> text</p></div>
        </li>
      </ul>
    `;

    const domNode = document.createElement('div');
    domNode.innerHTML = clipboardHtml;
    const doc = ProseMirrorDOMParser.fromSchema(editor.schema).parse(domNode);
    const json = doc.toJSON();
    const markdown = (editor as any).markdown.serialize(json);

    expect(markdown).toContain('- [ ]');
    expect(markdown).toContain('bold');
    expect(markdown).not.toContain('<label>');
    expect(markdown).not.toContain('<div>');
  });

  it('should produce correct HTML with data-type attributes', () => {
    editor = createTestEditor();
    editor.commands.setContent('- [x] Test task\n- [ ] Another task', { contentType: 'markdown' });

    const html = editor.getHTML();

    // The renderHTML should include data-type for proper clipboard roundtrip
    expect(html).toContain('data-type="taskItem"');
    expect(html).toContain('data-checked');
    // Content should be inside <div> wrapper (the content hole)
    expect(html).toContain('<div><p>Test task</p></div>');
  });

  it('should correctly parse full document with mixed content including task lists', () => {
    editor = createTestEditor();

    // Simulate the exact content from test_source.md task list section
    const fullMd = [
      '## 3. Lists and Tasks',
      '',
      '### Task List',
      '',
      '- [x] Completed task',
      '- [ ] Incomplete task',
      '- [ ] Task with *formatting*',
    ].join('\n');

    editor.commands.setContent(fullMd, { contentType: 'markdown' });
    const markdown = editor.getMarkdown();

    expect(markdown).toContain('- [x] Completed task');
    expect(markdown).toContain('- [ ] Incomplete task');
    expect(markdown).toContain('- [ ] Task with');
    expect(markdown).not.toContain('<label>');
    expect(markdown).not.toContain('<div>');
  });

  it('should handle clipboard HTML round-trip via parseSlice (simulating actual paste)', () => {
    editor = createTestEditor();

    // Set content first to establish the editor schema
    editor.commands.setContent('- [x] Original', { contentType: 'markdown' });

    // Simulate clipboard HTML (what ProseMirror DOMSerializer produces)
    const clipboardHtml = `
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="true">
          <label><input type="checkbox" checked="checked"><span></span></label>
          <div><p>Completed task</p></div>
        </li>
        <li data-type="taskItem" data-checked="false">
          <label><input type="checkbox"><span></span></label>
          <div><p>Incomplete task</p></div>
        </li>
        <li data-type="taskItem" data-checked="false">
          <label><input type="checkbox"><span></span></label>
          <div><p>Third task</p></div>
        </li>
      </ul>
    `;

    // Use parseSlice (what ProseMirror's clipboard handler actually uses)
    const domNode = document.createElement('div');
    domNode.innerHTML = clipboardHtml;
    const parser = ProseMirrorDOMParser.fromSchema(editor.schema);
    const slice = parser.parseSlice(domNode);

    // Verify the slice content doesn't contain <label> or <div> as text
    const sliceJson = slice.content.toJSON();
    const jsonStr = JSON.stringify(sliceJson);
    expect(jsonStr).not.toContain('"<label>"');
    expect(jsonStr).not.toContain('"<div>"');

    // Verify actual content is preserved
    expect(jsonStr).toContain('Completed task');
    expect(jsonStr).toContain('Incomplete task');
    expect(jsonStr).toContain('Third task');
  });
});
