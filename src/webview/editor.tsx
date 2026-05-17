/**
 * Editor entry point — React shell over the existing TipTap editor core.
 *
 * 1. Imports editor.ts as a side effect (bootstraps TipTap + VS Code bridge)
 * 2. Mounts a React tree on #react-inspector for new UI panels (Inspector, etc.)
 */
// CSS imports must live in the entry point so esbuild extracts them to webview.css.
// Importing them only from editor.ts (a side-effect import) causes esbuild to drop
// them from the CSS output chunk.
import 'prosemirror-tables/style/tables.css';
import './editor.css';
import './codicon.css';
import './editor'; // side-effect: bootstraps TipTap into #editor
import React from 'react';
import ReactDOM from 'react-dom/client';
import { EditorApp } from './EditorApp';

const inspectorRoot = document.getElementById('react-inspector');
if (inspectorRoot) {
  try {
    ReactDOM.createRoot(inspectorRoot).render(
      <React.StrictMode>
        <EditorApp />
      </React.StrictMode>
    );
  } catch (e) {
    console.error('[Inspector] React mount failed:', e);
  }
}
