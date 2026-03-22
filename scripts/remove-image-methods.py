#!/usr/bin/env python3
"""Remove extracted image handler methods from MarkdownEditorProvider.ts.
Uses the same fixed brace counting as extract-image-handlers-v2.py."""

PROVIDER_PATH = 'src/editor/MarkdownEditorProvider.ts'

with open(PROVIDER_PATH, 'r') as f:
    lines = f.readlines()

print(f"Provider file: {len(lines)} lines")


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

    # Find closing ) of parameter list using paren counting
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

    # Find the opening { of the method body
    body_start_line = paren_close_line
    for i in range(paren_close_line, min(paren_close_line + 5, len(lines))):
        if '{' in lines[i]:
            body_start_line = i
            break

    # Count braces from the body start line
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


# Methods to remove (same list as extraction)
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

# Find all ranges to remove
ranges_to_remove = []
for sig in METHODS:
    start, end = find_method_range(lines, sig)
    if start is not None:
        print(f"  Remove '{sig.strip()}' lines {start+1}-{end+1} ({end-start+1} lines)")
        ranges_to_remove.append((start, end))
    else:
        print(f"  WARNING: Could not find '{sig.strip()}'")

# Sort ranges by start line (descending) to remove from bottom up
ranges_to_remove.sort(key=lambda r: r[0], reverse=True)

# Remove ranges
total_removed = 0
for start, end in ranges_to_remove:
    # Also remove the blank line after the method if it exists
    extra_end = end + 1
    while extra_end < len(lines) and lines[extra_end].strip() == '':
        extra_end += 1
    # Keep one blank line
    if extra_end > end + 1:
        extra_end -= 1

    del lines[start:extra_end]
    removed = extra_end - start
    total_removed += removed

with open(PROVIDER_PATH, 'w') as f:
    f.writelines(lines)

print(f"\nRemoved {total_removed} lines. New file: {len(lines)} lines")
