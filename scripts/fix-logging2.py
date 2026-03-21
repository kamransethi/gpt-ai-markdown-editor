#!/usr/bin/env python3
"""Replace console.log with devLog in remaining webview files."""
import os

BASE = '/Users/kamran/Documents/GitHub/gpt-ai-markdown-editor'

files_and_anchors = {
    'src/webview/features/imageDragDrop.ts': "import type { Editor } from '@tiptap/core';",
    'src/webview/features/linkDialog.ts': None,  # need to find
    'src/webview/utils/markdownSerialization.ts': None,
    'src/webview/utils/copyMarkdown.ts': None,
    'src/webview/hostBridge.ts': None,
}

for relpath, anchor in files_and_anchors.items():
    fpath = os.path.join(BASE, relpath)
    with open(fpath, 'r') as f:
        content = f.read()
    
    count = content.count('console.log(')
    if count == 0:
        print(f'{relpath}: no console.log found, skipping')
        continue
    
    new_content = content.replace('console.log(', 'devLog(')
    
    if "import { devLog }" not in new_content:
        # Find the last import line to insert after
        lines = new_content.split('\n')
        last_import_idx = -1
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import_idx = i
        if last_import_idx >= 0:
            # Determine relative path depth
            depth = relpath.count('/') - 2  # src/webview/ is depth 0
            prefix = '../' * depth if depth > 0 else './'
            import_line = f"import {{ devLog }} from '{prefix}utils/devLog';"
            lines.insert(last_import_idx + 1, import_line)
            new_content = '\n'.join(lines)
    
    with open(fpath, 'w') as f:
        f.write(new_content)
    print(f'{relpath}: replaced {count} console.log calls')
