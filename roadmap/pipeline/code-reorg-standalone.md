# Code Reorganization: Standalone App Readiness

**Date:** 2026-01-14  
**Status:** Phase 1 complete (analysis + bridge interface)

## Current Architecture

```
src/
├── extension.ts              ← VS Code entry point
├── activeWebview.ts          ← VS Code panel tracking
├── editor/
│   ├── MarkdownEditorProvider.ts  ← VS Code custom editor (host)
│   ├── imageResize.ts             ← Image resizing (host-side)
│   └── utils.ts                   ← Host utilities
├── features/                 ← VS Code host features
│   ├── documentExport.ts
│   ├── imageResize.ts
│   ├── outlineView.ts
│   └── wordCount.ts
└── webview/                  ← STANDALONE-READY (this is the app)
    ├── editor.ts             ← Main entry point
    ├── editor.css            ← All styles (deterministic, no VS Code vars)
    ├── BubbleMenuView.ts     ← Toolbar
    ├── hostBridge.ts         ← NEW: Host communication abstraction
    ├── extensions/           ← TipTap extensions (16 files)
    ├── features/             ← UI features (16 files)
    └── utils/                ← Pure utilities (14 files)
```

## Coupling Analysis

**Coupling points**: 24 `vscode.postMessage()` calls across 4 webview files  
**Cross-boundary imports**: ZERO (webview never imports from editor/)  
**CSS coupling**: ZERO `var(--vscode-*)` references (all replaced with `--md-*`)

### Message Types (webview → host)

| Category | Types | Standalone Impact |
|----------|-------|-------------------|
| Document sync | `saveAndEdit`, `edit` | Need File API or localStorage |
| Image ops | `resolveImageUri`, `getImageReferences`, `checkImageRename` | Need local file handling |
| File search | `searchFiles`, `getFileHeadings`, `browseLocalFile` | Need file picker API |
| Navigation | `openSourceView`, `openExtensionSettings`, `openExternalLink`, `openFileLink` | Window.open or routing |
| Clipboard | `copyToClipboard`, `copyAsMarkdownLink` | navigator.clipboard API |
| UI feedback | `showInfo`, `showError` | Toast notifications |
| Diagnostics | `webviewLog`, `selectionChange`, `outlineUpdated` | Console / internal |
| Export | `exportDocument` | Client-side PDF generation |
| Init | `ready` | App initialization |

## Completed Steps

- [x] **Theme independence**: All `var(--vscode-*)` replaced with deterministic `--md-*` variables
- [x] **Dark/light toggle**: Uses `body[data-theme="dark"]` attribute (no VS Code classes)
- [x] **Host bridge interface**: `src/webview/hostBridge.ts` created with `HostBridge` interface
- [x] **Zero cross-boundary imports**: Webview code is already isolated

## Remaining Steps for Standalone

### Phase 2: Migrate to HostBridge (incremental)
- [ ] Replace `window.vscode.postMessage()` calls in `editor.ts` with bridge
- [ ] Replace references in `linkDialog.ts`, `BubbleMenuView.ts`, `customImageMessagePlugin.ts`
- [ ] Create `StandaloneBridge` implementation (uses File API, localStorage, etc.)

### Phase 3: Standalone Entry Point
- [ ] Create `src/webview/standalone.ts` entry point (alternative to VS Code webview)
- [ ] Add esbuild config for standalone bundle
- [ ] HTML template without VS Code webview scaffolding

### Phase 4: Feature Parity
- [ ] Implement file save/load via File System Access API
- [ ] Client-side PDF export (html2pdf.js or similar)
- [ ] Local storage for preferences/settings
- [ ] Toast notification system (replace VS Code notifications)

## Key Decision

The webview is already the app. The VS Code extension is just a thin host wrapper.
No major restructuring needed — just swap the communication layer.
