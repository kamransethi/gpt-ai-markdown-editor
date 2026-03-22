#!/usr/bin/env python3
"""Script to refactor MarkdownEditorProvider.ts to use extracted path utilities."""

import re
import sys

filepath = 'src/editor/MarkdownEditorProvider.ts'
with open(filepath, 'r') as f:
    content = f.read()

original_len = len(content.split('\n'))
print(f"Original file: {original_len} lines")

# 1. Add import for pathUtils (after the existing errorUtils import)
old_import = "import { toErrorMessage } from '../shared/errorUtils';"
new_import = """import { toErrorMessage } from '../shared/errorUtils';
import {
  type ConfigGetter,
  getDocumentDirectory,
  getWorkspaceFolderPath,
  getImageBasePath,
  getImageStorageBasePath,
  resolveMediaTargetFolder,
  isValidRelativePath,
  isWithinWorkspace,
  getRelativePath,
  formatFileLinkLabel,
  fileExists,
  createUniqueTargetFile,
} from './utils/pathUtils';"""

if old_import not in content:
    print("ERROR: Could not find errorUtils import to add pathUtils import after")
    sys.exit(1)

content = content.replace(old_import, new_import, 1)
print("Added pathUtils import")

# 2. Replace pure function call sites (just remove `this.` prefix)
pure_fns = [
    'fileExists',
    'getDocumentDirectory',
    'getWorkspaceFolderPath',
    'getImageBasePath',
    'isValidRelativePath',
    'isWithinWorkspace',
    'getRelativePath',
    'formatFileLinkLabel',
    'createUniqueTargetFile',
]
for fn in pure_fns:
    count = content.count(f'this.{fn}(')
    content = content.replace(f'this.{fn}(', f'{fn}(')
    print(f"  Replaced {count} occurrences of this.{fn}(")

# 3. Replace config-dependent call sites
count1 = content.count('this.getImageStorageBasePath(document)')
content = content.replace(
    'this.getImageStorageBasePath(document)',
    'getImageStorageBasePath(document, this.getConfig.bind(this))'
)
print(f"  Replaced {count1} occurrences of this.getImageStorageBasePath(document)")

count2 = len(re.findall(r'this\.resolveMediaTargetFolder\(document, \w+\)', content))
content = re.sub(
    r'this\.resolveMediaTargetFolder\(document, (\w+)\)',
    r'resolveMediaTargetFolder(document, \1, this.getConfig.bind(this))',
    content
)
print(f"  Replaced {count2} occurrences of this.resolveMediaTargetFolder(document, ...)")

# 4. Remove method definitions
lines = content.split('\n')

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

    # Walk forwards to find matching brace
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

methods_to_remove = [
    'private getRelativePath(fileUri:',
    'private isWithinWorkspace(sourcePath:',
    'private isValidRelativePath(relativePath:',
    'private async createUniqueTargetFile(',
    'private formatFileLinkLabel(fileName:',
    'private resolveMediaTargetFolder(',
    'private getImageStorageBasePath(document:',
    'private getImageBasePath(document:',
    'private getWorkspaceFolderPath(document:',
    'private getDocumentDirectory(document:',
    'private async fileExists(uri:',
]

# Find all ranges first
ranges = []
for sig in methods_to_remove:
    start, end = find_method_range(lines, sig)
    if start is not None:
        ranges.append((start, end, sig))
        print(f"  Found '{sig}' at lines {start+1}-{end+1}")
    else:
        print(f"  WARNING: Could not find '{sig}'")

# Sort ranges by start line descending (remove from bottom to preserve indices)
ranges.sort(key=lambda r: r[0], reverse=True)

# Remove methods
total_removed = 0
for start, end, sig in ranges:
    # Also remove blank line after the method if there is one
    if end + 1 < len(lines) and lines[end + 1].strip() == '':
        end += 1
    count = end - start + 1
    del lines[start:end + 1]
    total_removed += count
    print(f"  Removed '{sig.split('(')[0].strip()}' ({count} lines)")

content = '\n'.join(lines)

with open(filepath, 'w') as f:
    f.write(content)

final_len = len(lines)
print(f"\nResult: {original_len} -> {final_len} lines ({total_removed} lines removed, {final_len - original_len + total_removed} lines added)")
print("Done!")
