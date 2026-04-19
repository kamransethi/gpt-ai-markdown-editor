const fs = require('fs');

let code = fs.readFileSync('src/webview/editor.ts', 'utf-8');

code = code.replace(/function injectFrontmatterBlock\([\s\S]*?\n\}/, '');
code = code.replace(/function syncFrontmatterFromEditorDoc\([\s\S]*?\n\}/, '');

fs.writeFileSync('src/webview/editor.ts', code);
