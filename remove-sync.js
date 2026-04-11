const fs = require('fs');
let code = fs.readFileSync('src/webview/editor.ts', 'utf-8');

code = code.replace(/function syncFrontmatterFromEditorDoc\([\s\S]*?\n\}/, '');
code = code.replace(/syncFrontmatterFromEditorDoc\(editor\);/g, '');

fs.writeFileSync('src/webview/editor.ts', code);
