#!/usr/bin/env python3
"""Replace all var(--vscode-*) references in source files with deterministic color system variables."""
import re
import sys
import glob

# Files to process
files = glob.glob('src/**/*.ts', recursive=True) + glob.glob('src/**/*.css', recursive=True)
files = [f for f in files if '__tests__' not in f and '__mocks__' not in f]

replacements = [
    # Nested fallback patterns (most specific first)
    (r'var\(--vscode-editorWidget-background,\s*var\(--vscode-editor-background\)\)', 'var(--md-subtle-bg)'),
    (r'var\(--vscode-editor-background,\s*var\(--md-background\)\)', 'var(--md-background)'),
    (r'var\(--vscode-list-inactiveSelectionBackground,\s*var\(--md-hover-bg\)\)', 'var(--md-hover-bg)'),
    (r'var\(--vscode-list-inactiveSelectionForeground,\s*var\(--md-foreground\)\)', 'var(--md-foreground)'),
    (r'var\(--vscode-input-placeholderForeground,\s*var\(--md-muted\)\)', 'var(--md-input-placeholder)'),
    (r'var\(--vscode-input-border,\s*var\(--md-border\)\)', 'var(--md-border)'),
    (r'var\(--vscode-editor-foreground,\s*var\(--md-foreground\)\)', 'var(--md-foreground)'),
    (r'var\(--vscode-widget-border,\s*var\(--md-border\)\)', 'var(--md-border)'),
    (r'var\(--vscode-panel-border,\s*var\(--md-border\)\)', 'var(--md-border)'),
    (r'var\(--vscode-foreground,\s*var\(--md-foreground\)\)', 'var(--md-foreground)'),
    # Patterns with literal fallbacks
    (r'var\(--vscode-inputValidation-warningBorder\)', 'var(--md-border)'),
    (r'var\(--vscode-inputValidation-warningBackground,\s*transparent\)', 'transparent'),
    (r'var\(--vscode-textBlockQuote-background\)', 'var(--md-quote-bg)'),
    (r'var\(--vscode-textBlockQuote-border\)', 'var(--md-quote-border)'),
    (r'var\(--vscode-input-border\)', 'var(--md-border)'),
    # Simple direct replacements
    (r'var\(--vscode-widget-shadow\)', 'var(--md-shadow-color)'),
    (r'var\(--vscode-editor-background\)', 'var(--md-background)'),
    (r'var\(--vscode-editor-foreground\)', 'var(--md-foreground)'),
    (r'var\(--vscode-foreground\)', 'var(--md-foreground)'),
    (r'var\(--vscode-focusBorder\)', 'var(--md-focus)'),
    (r'var\(--vscode-textLink-foreground\)', 'var(--md-link-fg)'),
    (r'var\(--vscode-descriptionForeground\)', 'var(--md-muted)'),
    (r'var\(--vscode-dropdown-background\)', 'var(--md-dropdown-bg)'),
    (r'var\(--vscode-dropdown-foreground\)', 'var(--md-dropdown-fg)'),
    (r'var\(--vscode-dropdown-border\)', 'var(--md-dropdown-border)'),
    (r'var\(--vscode-button-background\)', 'var(--md-button-bg)'),
    (r'var\(--vscode-button-foreground\)', 'var(--md-button-fg)'),
    (r'var\(--vscode-button-hoverBackground\)', 'var(--md-button-hover-bg)'),
    (r'var\(--vscode-button-secondaryBackground\)', 'var(--md-button-secondary-bg)'),
    (r'var\(--vscode-button-secondaryForeground\)', 'var(--md-button-secondary-fg)'),
    (r'var\(--vscode-errorForeground\)', 'var(--md-error-fg)'),
    (r'var\(--vscode-input-background\)', 'var(--md-input-bg)'),
    (r'var\(--vscode-input-foreground\)', 'var(--md-input-fg)'),
    (r'var\(--vscode-input-placeholderForeground\)', 'var(--md-input-placeholder)'),
    (r'var\(--vscode-list-activeSelectionBackground\)', 'var(--md-menu-selection-bg)'),
    (r'var\(--vscode-list-hoverBackground\)', 'var(--md-hover-bg)'),
    (r'var\(--vscode-menu-background\)', 'var(--md-menu-bg)'),
    (r'var\(--vscode-menu-foreground\)', 'var(--md-menu-fg)'),
    (r'var\(--vscode-menu-border\)', 'var(--md-menu-border)'),
    (r'var\(--vscode-menu-selectionBackground\)', 'var(--md-menu-selection-bg)'),
    (r'var\(--vscode-menu-selectionForeground\)', 'var(--md-menu-selection-fg)'),
    (r'var\(--vscode-menu-separatorBackground\)', 'var(--md-menu-separator)'),
    (r'var\(--vscode-editorWidget-background\)', 'var(--md-subtle-bg)'),
    (r'var\(--vscode-editorWidget-border\)', 'var(--md-border)'),
    (r'var\(--vscode-panel-border\)', 'var(--md-border)'),
    (r'var\(--vscode-editor-font-family,\s*monospace\)', 'var(--md-mono-font)'),
    (r'var\(--vscode-editor-font-family\)', 'var(--md-mono-font)'),
    (r'var\(--vscode-font-family\)', 'var(--md-font-family)'),
]

total_replaced = 0
for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 'var(--vscode-' not in content:
        continue
    
    original = content
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
    
    if content != original:
        count = original.count('var(--vscode-') - content.count('var(--vscode-')
        total_replaced += count
        print(f"  {filepath}: replaced {count} references")
        with open(filepath, 'w') as f:
            f.write(content)
    
    remaining = len(re.findall(r'var\(--vscode-', content))
    if remaining > 0:
        for m in re.finditer(r'var\(--vscode-[^)]+\)', content):
            line_num = content[:m.start()].count('\n') + 1
            print(f"    REMAINING L{line_num}: {m.group()}")

print(f"\nTotal replaced: {total_replaced}")
