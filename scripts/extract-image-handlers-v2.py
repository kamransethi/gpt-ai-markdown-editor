#!/usr/bin/env python3
"""Extract image handler methods from MarkdownEditorProvider.ts into a separate module.
v2: Fixed brace counting to handle TypeScript inline types in method parameters."""

import re

PROVIDER_PATH = 'src/editor/MarkdownEditorProvider.ts'
OUTPUT_PATH = 'src/editor/handlers/imageHandlers.ts'

with open(PROVIDER_PATH, 'r') as f:
    provider_lines = f.readlines()


def find_method_range(lines, signature_pattern):
    """Find method start (including JSDoc) and end (matching closing brace).
    Uses paren counting to skip past parameters before counting braces."""
    sig_line = None
    for i in range(len(lines)):
        if signature_pattern in lines[i]:
            sig_line = i
            break
    if sig_line is None:
        return None, None

    # Walk backwards from sig_line to find JSDoc start
    method_start = sig_line
    for i in range(sig_line - 1, -1, -1):
        stripped = lines[i].strip()
        if stripped.startswith('*') or stripped.startswith('/**') or stripped == '':
            method_start = i
            if stripped.startswith('/**'):
                break
        else:
            break

    # STEP 1: Find the closing ) of the parameter list using paren counting
    paren_count = 0
    found_open_paren = False
    paren_close_line = sig_line
    for i in range(sig_line, min(sig_line + 30, len(lines))):
        for ch in lines[i]:
            if ch == '(':
                paren_count += 1
                found_open_paren = True
            elif ch == ')':
                paren_count -= 1
        if found_open_paren and paren_count == 0:
            paren_close_line = i
            break

    # STEP 2: Find the opening { of the method body (on or after paren_close_line)
    body_start_line = paren_close_line
    for i in range(paren_close_line, min(paren_close_line + 5, len(lines))):
        if '{' in lines[i]:
            body_start_line = i
            break

    # STEP 3: Count braces from the body start line
    brace_count = 0
    method_end = body_start_line
    found_open = False
    for i in range(body_start_line, len(lines)):
        for ch in lines[i]:
            if ch == '{':
                brace_count += 1
                found_open = True
            elif ch == '}':
                brace_count -= 1
        if found_open and brace_count == 0:
            method_end = i
            break

    return method_start, method_end


# Methods to extract (in order)
METHODS = [
    'private handleResolveImageUri(',
    'private async handleWorkspaceImage(',
    'private async handleSaveImage(',
    'private async handleGetImageReferences(',
    'private async findImageReferences(',
    'private async updateImageReferences(',
    'private async handleCheckImageRename(',
    'private async handleRenameImage(',
    'private async handleCheckImageInWorkspace(',
    'private async handleGetImageMetadata(',
    'private async handleRevealImageInOS(',
    'private async handleRevealImageInExplorer(',
    'private async handleCopyLocalImageToWorkspace(',
]

extracted = []
for sig in METHODS:
    start, end = find_method_range(provider_lines, sig)
    if start is not None:
        raw_text = ''.join(provider_lines[start:end + 1])
        extracted.append((sig, start, end, raw_text))
        print(f"  Found '{sig.strip()}' lines {start + 1}-{end + 1} "
              f"({end - start + 1} lines)")
    else:
        print(f"  WARNING: Could not find '{sig.strip()}'")

total = sum(e[2] - e[1] + 1 for e in extracted)
print(f"\nTotal extracted: {total} lines across {len(extracted)} methods")

# ── Adapt each method ────────────────────────────────────────────

# Helpers that keep their original signature (not handlers)
HELPER_SIGS = {
    'private async findImageReferences(',
    'private async updateImageReferences(',
}

adapted_methods = []
for sig, _start, _end, text in extracted:
    # Remove 2-space class indentation
    lines = text.split('\n')
    dedented = []
    for line in lines:
        if line.startswith('  '):
            dedented.append(line[2:])
        else:
            dedented.append(line)
    text = '\n'.join(dedented)

    is_helper = sig in HELPER_SIGS

    if is_helper:
        # Just change visibility: private async → export async
        text = re.sub(r'^private async ', 'export async function ', text, count=1)
        text = re.sub(r'^private ', 'export function ', text, count=1)
    else:
        # Handler method: change signature to (message, ctx: HandlerContext)
        # 1. Change visibility
        text = re.sub(r'^(\s*)private async ', r'\1export async function ', text,
                       count=1, flags=re.MULTILINE)
        text = re.sub(r'^(\s*)private ', r'\1export function ', text,
                       count=1, flags=re.MULTILINE)

        # 2. Replace parameter list
        # Multi-line: (message: {...}, document, webview)
        text = re.sub(
            r'\(\s*\n\s*message:\s*\{[^}]+\},\s*\n'
            r'\s*document:\s*vscode\.TextDocument,\s*\n'
            r'\s*webview:\s*vscode\.Webview\s*\n\s*\)',
            '(\n  message: { type: string; [key: string]: unknown },\n'
            '  ctx: HandlerContext\n)',
            text,
        )
        # Multi-line without webview: (message: {...}, document)
        text = re.sub(
            r'\(\s*\n\s*message:\s*\{[^}]+\},\s*\n'
            r'\s*document:\s*vscode\.TextDocument\s*\n\s*\)',
            '(\n  message: { type: string; [key: string]: unknown },\n'
            '  ctx: HandlerContext\n)',
            text,
        )

        # Add destructuring line after opening {
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

    # Replace this.* references everywhere
    text = text.replace('this.getConfig.bind(this)', 'ctx.getConfig')
    text = text.replace('this.findImageReferences(', 'findImageReferences(')
    text = text.replace('this.updateImageReferences(', 'updateImageReferences(')

    # this.getConfig<T>('key', default) → ctx.getConfig<T>('key', default)
    text = re.sub(r'this\.getConfig\b', 'ctx.getConfig', text)

    adapted_methods.append(text)

# ── Build output file ─────────────────────────────────────────────

HEADER = '''\
/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Image operation handlers for the markdown editor.
 * Extracted from MarkdownEditorProvider for modularity.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { MessageType } from '../../shared/messageTypes';
import { toErrorMessage } from '../../shared/errorUtils';
import { type HandlerContext, type MessageRouter } from '../messageRouter';
import {
  getDocumentDirectory,
  getImageBasePath,
  getImageStorageBasePath,
  resolveMediaTargetFolder,
  isWithinWorkspace,
  isValidRelativePath,
  fileExists,
} from '../utils/pathUtils';
import { normalizeImagePath, buildImageFilenameForUserRename } from '../MarkdownEditorProvider';

/** Register all image-related message handlers with the router. */
export function registerImageHandlers(router: MessageRouter): void {
  router.register(MessageType.RESOLVE_IMAGE_URI, handleResolveImageUri);
  router.register(MessageType.HANDLE_WORKSPACE_IMAGE, handleWorkspaceImage);
  router.register(MessageType.SAVE_IMAGE, handleSaveImage);
  router.register(MessageType.GET_IMAGE_REFERENCES, handleGetImageReferences);
  router.register(MessageType.CHECK_IMAGE_RENAME, handleCheckImageRename);
  router.register(MessageType.RENAME_IMAGE, handleRenameImage);
  router.register(MessageType.CHECK_IMAGE_IN_WORKSPACE, handleCheckImageInWorkspace);
  router.register(MessageType.GET_IMAGE_METADATA, handleGetImageMetadata);
  router.register(MessageType.REVEAL_IMAGE_IN_OS, handleRevealImageInOS);
  router.register(MessageType.REVEAL_IMAGE_IN_EXPLORER, handleRevealImageInExplorer);
  router.register(MessageType.COPY_LOCAL_IMAGE_TO_WORKSPACE, handleCopyLocalImageToWorkspace);
}

'''

output = HEADER + '\n\n'.join(adapted_methods) + '\n'

with open(OUTPUT_PATH, 'w') as f:
    f.write(output)

final_lines = len(output.split('\n'))
print(f"\nWrote {OUTPUT_PATH} ({final_lines} lines)")
