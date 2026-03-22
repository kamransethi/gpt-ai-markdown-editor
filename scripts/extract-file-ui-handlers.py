#!/usr/bin/env python3
"""Extract file/navigation and UI/export handler methods from MarkdownEditorProvider.ts.
Generates src/editor/handlers/fileHandlers.ts and src/editor/handlers/uiHandlers.ts."""

import re
import os as os_module

PROVIDER_PATH = 'src/editor/MarkdownEditorProvider.ts'

with open(PROVIDER_PATH, 'r') as f:
    provider_lines = f.readlines()

print(f"Provider file: {len(provider_lines)} lines\n")


def find_method_range(lines, signature_pattern):
    """Find method start (including JSDoc) and end (matching closing brace)."""
    sig_line = None
    for i in range(len(lines)):
        if signature_pattern in lines[i]:
            sig_line = i
            break
    if sig_line is None:
        return None, None

    # Walk backwards to find JSDoc start
    method_start = sig_line
    for i in range(sig_line - 1, -1, -1):
        stripped = lines[i].strip()
        if stripped.startswith('*') or stripped.startswith('/**') or stripped == '':
            method_start = i
            if stripped.startswith('/**'):
                break
        else:
            break

    # Find closing ) of parameter list using paren counting,
    # AND track the exact column position of the closing )
    paren_count = 0
    found_open_paren = False
    paren_close_line = sig_line
    paren_close_col = 0
    found_close = False
    for i in range(sig_line, min(sig_line + 30, len(lines))):
        for j, ch in enumerate(lines[i]):
            if ch == '(':
                paren_count += 1
                found_open_paren = True
            elif ch == ')':
                paren_count -= 1
            if found_open_paren and paren_count == 0:
                paren_close_line = i
                paren_close_col = j
                found_close = True
                break
        if found_close:
            break

    # Find the opening { of the method body AFTER the closing )
    # Only look at characters AFTER paren_close_col on the paren_close_line,
    # then full subsequent lines
    body_start_line = paren_close_line
    body_start_col = 0
    found_body_start = False
    # Check rest of paren_close_line
    rest_of_line = lines[paren_close_line][paren_close_col:]
    brace_pos = rest_of_line.find('{')
    if brace_pos >= 0:
        body_start_line = paren_close_line
        body_start_col = paren_close_col + brace_pos
        found_body_start = True
    else:
        for i in range(paren_close_line + 1, min(paren_close_line + 5, len(lines))):
            brace_pos = lines[i].find('{')
            if brace_pos >= 0:
                body_start_line = i
                body_start_col = brace_pos
                found_body_start = True
                break

    if not found_body_start:
        return method_start, paren_close_line

    # Count braces from the body start {, starting AFTER body_start_col
    brace_count = 0
    method_end = body_start_line
    found_open = False
    for i in range(body_start_line, len(lines)):
        start_col = body_start_col if i == body_start_line else 0
        for j in range(start_col, len(lines[i])):
            ch = lines[i][j]
            if ch == '{':
                brace_count += 1
                found_open = True
            elif ch == '}':
                brace_count -= 1
        if found_open and brace_count == 0:
            method_end = i
            break

    return method_start, method_end


def extract_and_adapt(lines, methods_spec):
    """Extract methods and adapt them to standalone functions with HandlerContext."""
    adapted = []
    for sig, handler_type in methods_spec:
        start, end = find_method_range(lines, sig)
        if start is None:
            print(f"  WARNING: Could not find '{sig.strip()}'")
            continue
        count = end - start + 1
        print(f"  Found '{sig.strip()}' lines {start+1}-{end+1} ({count} lines)")

        raw_text = ''.join(lines[start:end + 1])

        # Dedent (remove 2-space class method indentation)
        text_lines = raw_text.split('\n')
        dedented = []
        for line in text_lines:
            if line.startswith('  '):
                dedented.append(line[2:])
            else:
                dedented.append(line)
        text = '\n'.join(dedented)

        # Change visibility: private [async] → export [async] function
        text = re.sub(r'^(\s*)private async ', r'\1export async function ', text,
                       count=1, flags=re.MULTILINE)
        text = re.sub(r'^(\s*)private ', r'\1export function ', text,
                       count=1, flags=re.MULTILINE)

        if handler_type == 'standard':
            # Standard: (message, document, webview) → (message, ctx)
            text = re.sub(
                r'\(\s*\n\s*message:\s*\{[^}]+\},\s*\n'
                r'\s*document:\s*vscode\.TextDocument,\s*\n'
                r'\s*webview:\s*vscode\.Webview\s*\n\s*\)',
                '(\n  message: { type: string; [key: string]: unknown },\n'
                '  ctx: HandlerContext\n)',
                text,
            )
            # (message: {...}, document)
            text = re.sub(
                r'\(\s*\n\s*message:\s*\{[^}]+\},\s*\n'
                r'\s*document:\s*vscode\.TextDocument\s*\n\s*\)',
                '(\n  message: { type: string; [key: string]: unknown },\n'
                '  ctx: HandlerContext\n)',
                text,
            )
            # (message: {...}, webview)
            text = re.sub(
                r'\(\s*\n\s*message:\s*\{[^}]+\},\s*\n'
                r'\s*webview:\s*vscode\.Webview\s*\n\s*\)',
                '(\n  message: { type: string; [key: string]: unknown },\n'
                '  ctx: HandlerContext\n)',
                text,
            )
            # Message-only with inline type: (message: { type: string; [key: string]: unknown }):
            text = re.sub(
                r'\(message:\s*\{\s*\n\s*type:\s*string;\s*\n\s*\[key:\s*string\]:\s*unknown;\s*\n\s*\}\)',
                '(\n  message: { type: string; [key: string]: unknown },\n  ctx: HandlerContext\n)',
                text,
            )
            # Message-only with _webview
            text = re.sub(
                r'\(\s*\n\s*message:\s*\{[^}]+\},\s*\n'
                r'\s*_webview:\s*vscode\.Webview\s*\n\s*\)',
                '(\n  message: { type: string; [key: string]: unknown },\n'
                '  ctx: HandlerContext\n)',
                text,
            )

            # Add destructuring
            m = re.search(r'\)\s*:\s*(void|Promise<void>)\s*\{', text)
            if m:
                insert_pos = m.end()
                body = text[insert_pos:]
                needs_doc = bool(re.search(r'\bdocument[.\[,;\)]', body))
                needs_wv = bool(re.search(r'\bwebview[.\[,;\)]', body))
                parts = []
                if needs_doc:
                    parts.append('document')
                if needs_wv:
                    parts.append('webview')
                if parts:
                    destr = f"\n  const {{ {', '.join(parts)} }} = ctx;"
                    text = text[:insert_pos] + destr + text[insert_pos:]

        elif handler_type == 'doc_only':
            # (document: vscode.TextDocument) → (_message, ctx)
            text = re.sub(
                r'\(document:\s*vscode\.TextDocument\)',
                '(\n  _message: { type: string; [key: string]: unknown },\n  ctx: HandlerContext\n)',
                text,
            )
            m = re.search(r'\)\s*:\s*(void|Promise<void>)\s*\{', text)
            if m:
                insert_pos = m.end()
                text = text[:insert_pos] + "\n  const { document } = ctx;" + text[insert_pos:]

        elif handler_type == 'doc_webview':
            # (document, webview) → (_message, ctx)
            text = re.sub(
                r'\(\s*\n\s*document:\s*vscode\.TextDocument,\s*\n'
                r'\s*webview:\s*vscode\.Webview\s*\n\s*\)',
                '(\n  _message: { type: string; [key: string]: unknown },\n'
                '  ctx: HandlerContext\n)',
                text,
            )
            m = re.search(r'\)\s*:\s*(void|Promise<void>)\s*\{', text)
            if m:
                insert_pos = m.end()
                text = text[:insert_pos] + "\n  const { document, webview } = ctx;" + text[insert_pos:]

        elif handler_type == 'webview_only':
            # (webview: vscode.Webview) → (_message, ctx)
            text = re.sub(
                r'\(webview:\s*vscode\.Webview\)',
                '(\n  _message: { type: string; [key: string]: unknown },\n  ctx: HandlerContext\n)',
                text,
            )
            m = re.search(r'\)\s*:\s*(void|Promise<void>)\s*\{', text)
            if m:
                insert_pos = m.end()
                text = text[:insert_pos] + "\n  const { webview } = ctx;" + text[insert_pos:]

        # Replace this.* references
        text = text.replace('this.getConfig.bind(this)', 'ctx.getConfig')
        text = re.sub(r'this\.getConfig\b', 'ctx.getConfig', text)

        adapted.append(text)

    return adapted


# ── FILE HANDLERS ──────────────────────────────────────────

FILE_METHODS = [
    ('private async handleOpenFileAtLocation(message: {', 'standard'),
    ('private async handleSearchFiles(', 'standard'),
    ('private async handleGetFileHeadings(', 'standard'),
    ('private async handleOpenExternalLink(message: {', 'standard'),
    ('private async handleOpenImage(', 'standard'),
    ('private async handleOpenFileLink(', 'standard'),
    ('private async handleBrowseLocalFile(', 'doc_webview'),
    ('private async handleFileLinkDrop(', 'standard'),
]

print("=== FILE HANDLERS ===")
file_adapted = extract_and_adapt(provider_lines, FILE_METHODS)

file_header = '''\
/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * File and navigation handlers for the markdown editor.
 * Extracted from MarkdownEditorProvider for modularity.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MessageType } from '../../shared/messageTypes';
import { toErrorMessage } from '../../shared/errorUtils';
import { type HandlerContext, type MessageRouter } from '../messageRouter';
import {
  getRelativePath,
  formatFileLinkLabel,
  isWithinWorkspace,
  resolveMediaTargetFolder,
  createUniqueTargetFile,
} from '../utils/pathUtils';

/** Register all file/navigation message handlers with the router. */
export function registerFileHandlers(router: MessageRouter): void {
  router.register(MessageType.OPEN_FILE_AT_LOCATION, handleOpenFileAtLocation);
  router.register(MessageType.SEARCH_FILES, handleSearchFiles);
  router.register(MessageType.GET_FILE_HEADINGS, handleGetFileHeadings);
  router.register(MessageType.OPEN_EXTERNAL_LINK, handleOpenExternalLink);
  router.register(MessageType.OPEN_IMAGE, handleOpenImage);
  router.register(MessageType.OPEN_FILE_LINK, handleOpenFileLink);
  router.register(MessageType.BROWSE_LOCAL_FILE, handleBrowseLocalFile);
  router.register(MessageType.HANDLE_FILE_LINK_DROP, handleFileLinkDrop);
}

'''

file_output = file_header + '\n\n'.join(file_adapted) + '\n'

os_module.makedirs('src/editor/handlers', exist_ok=True)
with open('src/editor/handlers/fileHandlers.ts', 'w') as f:
    f.write(file_output)
print(f"\nWrote src/editor/handlers/fileHandlers.ts ({len(file_output.splitlines())} lines)\n")


# ── UI/EXPORT HANDLERS ──────────────────────────────────────────

UI_METHODS = [
    ('private async handleOpenAttachmentsFolder(document:', 'doc_only'),
    ('private async handleExportDocument(', 'standard'),
    ('private async handleExportTableCsv(', 'standard'),
    ('private async handleShowEmojiPicker(webview:', 'webview_only'),
    ('private async handleEditMermaidSource(', 'standard'),
    ('private async handleUpdateSetting(', 'standard'),
]

print("=== UI/EXPORT HANDLERS ===")
ui_adapted = extract_and_adapt(provider_lines, UI_METHODS)

ui_header = '''\
/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * UI and export handlers for the markdown editor.
 * Extracted from MarkdownEditorProvider for modularity.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MessageType } from '../../shared/messageTypes';
import { toErrorMessage } from '../../shared/errorUtils';
import { type HandlerContext, type MessageRouter } from '../messageRouter';
import { resolveMediaTargetFolder } from '../utils/pathUtils';

/** Register all UI/export message handlers with the router. */
export function registerUiHandlers(router: MessageRouter): void {
  router.register(MessageType.OPEN_ATTACHMENTS_FOLDER, handleOpenAttachmentsFolder);
  router.register(MessageType.EXPORT_DOCUMENT, handleExportDocument);
  router.register(MessageType.EXPORT_TABLE_CSV, handleExportTableCsv);
  router.register(MessageType.SHOW_EMOJI_PICKER, handleShowEmojiPicker);
  router.register(MessageType.EDIT_MERMAID_SOURCE, handleEditMermaidSource);
  router.register(MessageType.UPDATE_SETTING, handleUpdateSetting);
}

'''

ui_output = ui_header + '\n\n'.join(ui_adapted) + '\n'

with open('src/editor/handlers/uiHandlers.ts', 'w') as f:
    f.write(ui_output)
print(f"\nWrote src/editor/handlers/uiHandlers.ts ({len(ui_output.splitlines())} lines)\n")
