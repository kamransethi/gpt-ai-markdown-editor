#!/usr/bin/env python3
"""Remove file/navigation and UI/export handler methods from MarkdownEditorProvider.ts.
Uses the improved brace counting with column tracking."""

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

    method_start = sig_line
    for i in range(sig_line - 1, -1, -1):
        stripped = lines[i].strip()
        if stripped.startswith('*') or stripped.startswith('/**') or stripped == '':
            method_start = i
            if stripped.startswith('/**'):
                break
        else:
            break

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

    body_start_line = paren_close_line
    body_start_col = 0
    found_body_start = False
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


# All methods to remove (file handlers + UI handlers)
METHODS = [
    # File handlers
    'private async handleOpenFileAtLocation(message: {',
    'private async handleSearchFiles(',
    'private async handleGetFileHeadings(',
    'private async handleOpenExternalLink(message: {',
    'private async handleOpenImage(',
    'private async handleOpenFileLink(',
    'private async handleBrowseLocalFile(',
    'private async handleFileLinkDrop(',
    # UI handlers
    'private async handleOpenAttachmentsFolder(document:',
    'private async handleExportDocument(',
    'private async handleExportTableCsv(',
    'private async handleShowEmojiPicker(webview:',
    'private async handleEditMermaidSource(',
    'private async handleUpdateSetting(',
]

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

total_removed = 0
for start, end in ranges_to_remove:
    extra_end = end + 1
    while extra_end < len(lines) and lines[extra_end].strip() == '':
        extra_end += 1
    if extra_end > end + 1:
        extra_end -= 1

    del lines[start:extra_end]
    removed = extra_end - start
    total_removed += removed

with open(PROVIDER_PATH, 'w') as f:
    f.writelines(lines)

print(f"\nRemoved {total_removed} lines. New file: {len(lines)} lines")
