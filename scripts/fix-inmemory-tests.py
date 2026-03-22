#!/usr/bin/env python3
"""Update inMemoryFiles.test.ts to use extracted image handler functions."""

import re

FILE_PATH = 'src/__tests__/editor/inMemoryFiles.test.ts'

with open(FILE_PATH, 'r') as f:
    content = f.read()

# 1. Replace getProviderInternals().handleResolveImageUri(\n  message,\n  document ...\n  mockWebview\n)
# Pattern: getProviderInternals().handleResolveImageUri(\n        message,\n        document as unknown as vscode.TextDocument,\n        mockWebview\n      )
content = re.sub(
    r'getProviderInternals\(\)\.handleResolveImageUri\(\s*\n(\s*)message,\s*\n\s*document as unknown as vscode\.TextDocument,\s*\n\s*mockWebview\s*\n\s*\)',
    r'imageHandlers.handleResolveImageUri(\n\1message,\n\1makeCtx(document as unknown as vscode.TextDocument)\n      )',
    content
)

# 2. Replace await getProviderInternals().handleSaveImage(\n  {...}\n  document ...\n  mockWebview\n)
# These have the message object inline or as variable
content = re.sub(
    r'(await )?getProviderInternals\(\)\.handleSaveImage\(',
    r'\1imageHandlers.handleSaveImage(',
    content
)

# 3. Replace await getProviderInternals().handleCopyLocalImageToWorkspace(
content = re.sub(
    r'(await )?getProviderInternals\(\)\.handleCopyLocalImageToWorkspace\(',
    r'\1imageHandlers.handleCopyLocalImageToWorkspace(',
    content
)

# 4. Replace getProviderInternals().handleWorkspaceImage(
content = re.sub(
    r'getProviderInternals\(\)\.handleWorkspaceImage\(',
    'imageHandlers.handleWorkspaceImage(',
    content
)

# 5. Replace await getProviderInternals().handleCheckImageInWorkspace(
content = re.sub(
    r'(await )?getProviderInternals\(\)\.handleCheckImageInWorkspace\(',
    r'\1imageHandlers.handleCheckImageInWorkspace(',
    content
)

# Now replace the argument pattern: for image handler calls, replace
# (message-obj, document-expr, mockWebview) → (message-obj, makeCtx(document-expr))
# for handleSaveImage, handleCopyLocalImageToWorkspace, handleWorkspaceImage, handleCheckImageInWorkspace

# These have patterns like:
#   imageHandlers.handleSaveImage(
#     { ... },
#     document as unknown as vscode.TextDocument,
#     mockWebview
#   )
# Need to become:
#   imageHandlers.handleSaveImage(
#     { ... },
#     makeCtx(document as unknown as vscode.TextDocument)
#   )

# Strategy: Find each imageHandlers.handle* call and fix the last two args
# Match: document-expr,\n        mockWebview\n      )
# Replace with: makeCtx(document-expr)\n      )

# Pattern for "document as unknown as vscode.TextDocument,\n        mockWebview"
content = re.sub(
    r'(document as unknown as vscode\.TextDocument),\s*\n\s*mockWebview',
    r'makeCtx(\1)',
    content
)

# Also match "document as unknown as vscode.TextDocument,\n            mockWebview" (deeper indent)
# The above regex should handle it since \s* matches any whitespace

with open(FILE_PATH, 'w') as f:
    f.write(content)

# Verify no remaining getProviderInternals().handle calls
remaining = re.findall(r'getProviderInternals\(\)\.(handle)', content)
print(f"Remaining getProviderInternals().handle* calls: {len(remaining)}")

# Count imageHandlers calls
img_calls = re.findall(r'imageHandlers\.(handle\w+)', content)
print(f"imageHandlers.handle* calls: {len(img_calls)}")
for call in img_calls:
    print(f"  {call}")
