const fs = require('fs');

let code = fs.readFileSync('src/webview/editor.ts', 'utf-8');

// Replace imports
code = code.replace(
  "import {\n  FrontmatterBlock,\n  isFrontmatterBlock,\n  extractFrontmatterText,\n} from './extensions/frontmatterPanel';",
  ""
);
code = code.replace(
  "import { FrontmatterBlock, isFrontmatterBlock, extractFrontmatterText } from './extensions/frontmatterPanel';",
  ""
);

// We'll just remove 'FrontmatterBlock' from extensions array
code = code.replace("FrontmatterBlock,\n    ];", "];");
code = code.replace("FrontmatterBlock,", "");

// Toggle
code = code.replace(
  /function toggleFrontmatterBlock\(\): void \{[\s\S]*?^\}/m,
  `function toggleFrontmatterBlock(): void { openFrontmatterEditor(); }`
);

// In updateEditorContent
code = code.replace(/if \(currentFrontmatter\) \{\s*injectFrontmatterBlock\(currentFrontmatter\);\s*\}/g, "");
code = code.replace(/injectFrontmatterBlock\(currentFrontmatter\);/g, "");

// In onUpdate 
code = code.replace("syncFrontmatterFromEditorDoc(editor);", "");

// Let's remove the function injections directly
// Instead of risky regex, let's just leave the functions injectFrontmatterBlock and syncFrontmatterFromEditorDoc dead code.

fs.writeFileSync('src/webview/editor.ts', code);
