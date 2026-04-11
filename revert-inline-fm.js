const fs = require('fs');

let code = fs.readFileSync('src/webview/editor.ts', 'utf-8');

// Replace `toggleFrontmatterBlock` definition
code = code.replace(
  /function toggleFrontmatterBlock\(\): void \{[\s\S]*?\n\}/,
  `function toggleFrontmatterBlock(): void {
  openFrontmatterEditor();
}`
);

// Remove `injectFrontmatterBlock(currentFrontmatter);`
code = code.replace(/if \(currentFrontmatter\) \{\s*injectFrontmatterBlock\(currentFrontmatter\);\s*\}/g, '');
code = code.replace(/injectFrontmatterBlock\(currentFrontmatter\);/g, '');

fs.writeFileSync('src/webview/editor.ts', code);
