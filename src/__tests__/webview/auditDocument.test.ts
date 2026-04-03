/**
 * @jest-environment jsdom
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  AuditIssue,
  AuditIssueType,
  runAudit,
  auditPluginKey,
} from '../../webview/features/auditDocument';

describe('Audit Document Feature', () => {
  let editor: Editor;

  beforeEach(() => {
    document.body.innerHTML = '<div id="editor"></div>';
    editor = new Editor({
      element: document.getElementById('editor') as HTMLElement,
      extensions: [StarterKit],
      content: '<p>Test content</p>',
    });
  });

  afterEach(() => {
    if (editor) {
      editor.destroy();
    }
  });

  it('should run an audit on the document', async () => {
    // Initially this will fail because the function will just throw or not have the correct output
    const results = await runAudit(editor);
    expect(results).toBeDefined();
    // Assuming runAudit returns an array of issues
    expect(Array.isArray(results)).toBe(true);
  });
});
