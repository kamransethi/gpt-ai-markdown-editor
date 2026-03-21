import sys

files = [
    ('src/webview/extensions/tabIndentation.ts', "import { Extension } from '@tiptap/core';"),
    ('src/webview/extensions/imageEnterSpacing.ts', "import { Extension } from '@tiptap/core';"),
    ('src/webview/features/tableContextMenu.ts', "import { modSymbol as mod } from '../utils/platform';"),
]

for path, anchor_import in files:
    with open(path, 'r') as f:
        content = f.read()
    count = content.count('console.log(')
    if count == 0:
        print(f'{path}: no console.log found')
        continue
    new_content = content.replace('console.log(', 'devLog(')
    # Add import for devLog if not already present
    if "import { devLog }" not in new_content:
        new_content = new_content.replace(
            anchor_import,
            anchor_import + "\nimport { devLog } from '../utils/devLog';",
            1
        )
    with open(path, 'w') as f:
        f.write(new_content)
    print(f'{path}: replaced {count} console.log calls')
