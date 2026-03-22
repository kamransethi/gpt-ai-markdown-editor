#!/usr/bin/env python3
"""Extract image handler methods from MarkdownEditorProvider.ts into a separate module."""

import re

provider_path = 'src/editor/MarkdownEditorProvider.ts'
output_path = 'src/editor/handlers/imageHandlers.ts'

with open(provider_path, 'r') as f:
    provider_lines = f.readlines()

provider_content = ''.join(provider_lines)

# Define the methods to extract (with their approximate signatures)
methods_to_extract = [
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

def find_method_range(lines, signature_pattern):
    """Find method start (including JSDoc) and end (matching closing brace)."""
    sig_line = None
    for i in range(len(lines)):
        if signature_pattern in lines[i]:
            sig_line = i
            break
    if sig_line is None:
        return None, None

    method_start = sig_line
    for i in range(sig_line - 1, -1, -1):
        stripped = lines[i].strip()
        if stripped.startswith('*') or stripped.startswith('/**') or stripped == '':
            method_start = i
            if stripped.startswith('/**'):
                break
        else:
            break

    brace_count = 0
    method_end = sig_line
    found_open = False
    for i in range(sig_line, len(lines)):
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

# Extract methods
extracted_methods = []
for sig in methods_to_extract:
    start, end = find_method_range(provider_lines, sig)
    if start is not None:
        method_text = ''.join(provider_lines[start:end+1])
        extracted_methods.append((sig, start, end, method_text))
        print(f"Found '{sig.strip()}' at lines {start+1}-{end+1}")
    else:
        print(f"WARNING: Could not find '{sig.strip()}'")

# Now adapt each method:
# 1. Remove 'private' and 'private async' 
# 2. Add 'export function' or 'export async function'
# 3. Change parameters from (message, document, webview) to (message, ctx: HandlerContext)
# 4. Replace document -> ctx.document, webview -> ctx.webview inside bodies
# 5. Replace this.getConfig -> ctx.getConfig
# 6. Replace this.findImageReferences -> findImageReferences
# 7. Replace this.updateImageReferences -> updateImageReferences

adapted_methods = []
for sig, start, end, text in extracted_methods:
    # Remove leading whitespace (class method indentation - 2 spaces)
    lines = text.split('\n')
    adapted_lines = []
    for line in lines:
        if line.startswith('  '):
            adapted_lines.append(line[2:])
        else:
            adapted_lines.append(line)
    text = '\n'.join(adapted_lines)
    
    # Replace 'private async' with 'export async function', 'private' with 'export function'
    text = text.replace('private async ', 'export async function ')
    text = text.replace('private ', 'export function ')
    
    # Check if this is a handler method (takes message, document, webview)
    is_handler = 'handleResolve' in sig or 'handleWorkspace' in sig or 'handleSave' in sig or \
                 'handleGet' in sig or 'handleCheck' in sig or 'handleRename' in sig or \
                 'handleReveal' in sig or 'handleCopy' in sig
    
    is_helper = 'findImageReferences(' in sig or 'updateImageReferences(' in sig
    
    if is_handler:
        # Replace parameter signatures - adapt to HandlerContext
        # Pattern: (message: ..., document: vscode.TextDocument, webview: vscode.Webview): ReturnType
        text = re.sub(
            r'\(\s*message:\s*\{[^}]+\},\s*document:\s*vscode\.TextDocument,\s*webview:\s*vscode\.Webview\s*\)',
            '(\n  message: { type: string; [key: string]: unknown },\n  ctx: HandlerContext\n)',
            text
        )
        # Pattern without webview: (message: ..., document: vscode.TextDocument): ReturnType
        text = re.sub(
            r'\(\s*message:\s*\{[^}]+\},\s*document:\s*vscode\.TextDocument\s*\)',
            '(\n  message: { type: string; [key: string]: unknown },\n  ctx: HandlerContext\n)',
            text
        )
        
        # Add destructuring at the start of function body
        # Find the first { after the function signature
        brace_pos = text.find('{')
        if brace_pos != -1:
            # Check what we need
            needs_webview = 'webview.' in text or 'webview,' in text 
            needs_document = 'document.' in text or 'document,' in text or 'document)' in text
            
            destructure_parts = []
            if needs_document:
                destructure_parts.append('document')
            if needs_webview:
                destructure_parts.append('webview')
            
            if destructure_parts:
                destructure = f"\n  const {{ {', '.join(destructure_parts)} }} = ctx;"
                text = text[:brace_pos+1] + destructure + text[brace_pos+1:]
    
    # Replace this.getConfig references
    text = text.replace('this.getConfig.bind(this)', 'ctx.getConfig')
    text = text.replace("this.getConfig<string>('mediaPath', 'media')", "ctx.getConfig<string>('mediaPath', 'media')")
    
    # Replace this.findImageReferences and this.updateImageReferences
    text = text.replace('this.findImageReferences(', 'findImageReferences(')
    text = text.replace('this.updateImageReferences(', 'updateImageReferences(')
    
    adapted_methods.append(text)

# Build the output file
header = '''/**
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

'''

# Build register function
register_fn = '''
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

output = header + register_fn + '\n' + '\n\n'.join(adapted_methods) + '\n'

# Write
import os as os_module
os_module.makedirs(os_module.path.dirname(output_path), exist_ok=True)
with open(output_path, 'w') as f:
    f.write(output)

print(f"\nWrote {output_path} ({len(output.split(chr(10)))} lines)")
print("Now need to: remove methods from provider, update switch cases")
