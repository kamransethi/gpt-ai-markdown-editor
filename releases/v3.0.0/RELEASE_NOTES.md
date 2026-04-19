# Release Notes — v3.0.0

Date: 2026-04-19

## Highlights

- **Knowledge Graph beta**: Workspace-wide markdown indexing, backlinks, hybrid search, and AI-powered graph chat.
- **Backlinks Explorer**: View file backlinks and unlinked references in a dedicated tree view.
- **Graph Chat**: Ask questions of your indexed workspace and get answers based on the markdown graph.
- **Configurable graph storage**: Use `knowledgeGraph.dataDir` to persist graph data and vector storage in a custom folder, defaulting to `~/.fluxflow`.
- **TipTap upgrade**: Moved the editor core and extensions to the latest TipTap 3.22.x line for improved markdown serialization and table compatibility.

## What’s new

- Added Knowledge Graph beta support for markdown workspaces.
- Added local graph database persistence and configurable storage folder.
- Added hybrid search support combining fast text search with semantic retrieval when a local embedding server is available.
- Added RAG settings for `topK`, chunk sizing, and embedding model selection.
- Added Graph Chat UI integrated into the editor.
- Upgraded TipTap to a newer 3.22.x release, including table and markdown pipeline stability improvements.

## Notes

- Semantic search requires a local AI embedding server and a supported embedding model.
- The graph database directory defaults to `~/.fluxflow` but can be customized in settings.
- This major release marks the transition to the new graph-oriented feature set and a refreshed editor baseline.
