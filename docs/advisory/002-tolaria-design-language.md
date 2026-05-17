# Architecture Advisory: Adopting Tolaria Design Language (v2 — revised after clarification)

**Date**: 2026-05-17 (updated)  
**Authored by**: Architecture Agent  
**Tolaria source**: `/Users/kamran/Documents/GitHub/tolaria`  
**Extension source**: `/Users/kamran/Documents/GitHub/gpt-ai-markdown-editor`

---

## Executive Summary

After clarification, the user's intent is a **complete architectural pivot**: transform the extension from a per-file custom editor into a full writing app — sidebar | notes list | editor | status bar — all inside one webview, with VS Code acting as a host shell rather than a navigator. This matches Tolaria's architecture precisely, built within VS Code's constraints.

This is 8–12 weeks of coordinated work across seven specs (Tracks A–G). The individual tracks are sound; the risk is sequencing them correctly so the intermediate states remain shippable.

**Important**: This advisory assumes the **foundational refactors from `003-maturity-learnings-from-tolaria.md` are complete** (type safety, error boundaries, folder structure, WebviewStateContext, keyboard patterns). Do 003 first (1–2 weeks), then start Track A.

**Verdict**: Proceed. This is the right long-term direction. Complete 003 for the foundation, then start with the Tailwind/CSS foundation (Track A), then layer in the app shell restructure, then Tracks B → G.

---

## Revised User Requirements

| Topic | Decision |
|---|---|
| Layout | Full app inside the webview: sidebar \| notes list \| editor. VS Code Explorer replaced. |
| Sidebar | Adapt Tolaria components with identical behavior (dnd-kit reorder, collapse, context menus) |
| Status bar | Custom bar at **bottom of the webview** (not VS Code native status bar) |
| Tailwind | **Full migration** — migrate existing `editor.css` to Tailwind |
| Font default | Keep Charter/Georgia serif as default; add Inter as a user-selectable option in settings |
| Top menu | Keep existing right-aligned formatting toolbar. Add Tolaria-style breadcrumb/title bar on the left. |
| Icons | `@phosphor-icons/react` throughout, tree-shaken by esbuild |
| Git | Inside the webview status bar. Extension host bridges to VS Code Git API. || Settings | React modal overlay inside the webview (not a separate VS Code tab). Opened from ⚙ in status bar. Live-update pattern (no Save button). |
---

## The Architectural Pivot

### What the Extension Is Today

```
VS Code opens notes.md
  → CustomEditorProvider renders webview
    → TipTap editor fills the entire webview
```

The webview is just an editor. There is no app chrome, no navigation, no file list.

### What It Needs to Become

```
VS Code opens notes.md  (or user runs "Flux Flow: Open App")
  → Singleton WebviewPanel renders full Tolaria layout:
        [Sidebar] | [Notes List] | [Editor]
        [Status Bar: Docs | Night | ⚙ | ·· Changes · Commit · Synced · History]
```

The webview becomes the primary interface. VS Code is a shell. File I/O still goes through the extension host (VS Code TextDocument), but all navigation happens inside the webview.

### Key Technical Challenge: Multi-Note Navigation

The current custom editor is bound to ONE document per webview. If we show a notes list inside the webview, clicking a note must use **in-place navigation**:

1. Webview sends `NAVIGATE_TO_NOTE { path }` to host
2. Host reads the file, sends `LOAD_NOTE_CONTENT { content, path }` back
3. Webview loads the content into TipTap — no new VS Code tab opens
4. Host calls `openTextDocument(path)` in the background to track dirty state

**Recommended approach**: A **singleton custom panel** (like VS Code's Settings editor — opens once, persists, stays in the same tab when you switch notes).

- `vscode.window.createWebviewPanel(...)` opened via command `Flux Flow: Open App`
- Navigation between notes is internal to the webview
- The extension host routes saves to the correct TextDocument based on the currently displayed note path
- Individual `.md` files can still be opened directly (for quick edits), but the App panel is the primary writing interface

---

## Track A — Tailwind + CSS Token Migration (Foundation — Start Here)

**Prerequisites**: Complete all steps in `003-maturity-learnings-from-tolaria.md` first:
- ✅ Type safety: `src/types/index.ts` created
- ✅ Error boundaries: `src/shared/errorHandler.ts` created
- ✅ Folder structure: `src/webview/chrome/` established
- ✅ State management: `WebviewStateContext` created
- ✅ FoamNote extended with `type`, `preview`, `modified`, `status`

**What**: Introduce Tailwind CSS into the webview bundle. Migrate `editor.css` (~4,700 lines) to Tailwind utility classes. Replace `--md-*` variables with Tolaria's semantic token hierarchy mapped to `--vscode-*` variables.

**Why first**: All subsequent tracks (sidebar, notes list, status bar) will be built with Tailwind + shadcn/ui. The CSS foundation must exist before layering new components.

**How**:

1. Add Tailwind v4 to esbuild — cleanest with `@tailwindcss/postcss` via esbuild's CSS transform:
   ```js
   // scripts/build-webview.js — add PostCSS step
   // Tailwind v4: @import "tailwindcss" in the CSS entry file
   ```

2. CSS variable bridge (new `src/webview/theme.css`):
   ```css
   @import "tailwindcss";

   :root {
     --surface-app:     var(--vscode-editor-background);
     --surface-sidebar: var(--vscode-sideBar-background, #F7F6F3);
     --text-primary:    var(--vscode-foreground);
     --text-secondary:  var(--vscode-descriptionForeground);
     --border-default:  var(--vscode-panel-border);
     --accent-blue:     var(--vscode-button-background);
     --state-hover:     var(--vscode-list-hoverBackground);
     --state-selected:  var(--vscode-list-activeSelectionBackground);
   }
   .vscode-dark { color-scheme: dark; }
   ```

3. Extend Tailwind config to use these as theme tokens — same pattern Tolaria uses for `bg-surface-sidebar`, `text-primary`, etc.

4. Migrate `editor.css` section by section to Tailwind. Convert each section, verify visually, remove old CSS.

**Font**: `--md-font-family` becomes a `fluxflow.editorFont` VS Code setting. Default: `'Charter', 'Georgia', serif`. Option: `'Inter', sans-serif`. UI chrome always Inter.

**Constitution amendment** (before changing font default): `docs(constitution): amend v2.1.0 — editor prose font is user-configurable; Charter/Georgia remains default; Inter added as option`.

**Cost**: 3–5 days for setup + token migration. Full `editor.css` migration: 2–3 weeks (done incrementally alongside other tracks).

---

## Track B — Git Status Bar (Inside Webview)

**What**: A fixed `<div>` at the bottom of the editor webview, identical to Tolaria's status bar. Shows: Docs count | Night mode | ⚙ Settings (left) · N Changes | Commit | Synced Last | History (right).

**How the data flows**:

```
Webview mounts StatusBar component
  → sends STATUS_BAR_GIT_REQUEST to host
Host reads VS Code Git API:
  repo.state.workingTreeChanges.length → "N changes"
  repo.state.HEAD.ahead/behind        → sync status
  repo.state.HEAD.name                → branch
  → sends STATUS_BAR_GIT_STATE { changes, syncStatus, branch } back
Webview renders badges
```

Git state updates: `repo.state.onDidChange()` fires → host pushes new state to webview.

**Commit button** → webview sends `GIT_COMMIT_REQUEST { message }` → host executes VS Code's `git.commitAll` command or opens a modal inside the webview (adapted from Tolaria's `CommitDialog.tsx`).

**Night mode toggle** → sends `TOGGLE_NIGHT_MODE` → host executes `workbench.action.toggleLightDarkThemes`.

**History** → sends `OPEN_GIT_TIMELINE` → host executes `git.openTimeline` on the current file.

**Adapt from Tolaria**:
- `src/components/StatusBar.tsx` → `src/webview/chrome/StatusBar.tsx`
- `src/components/status-bar/StatusBarBadges.tsx` → adapted (remove Tauri-specific parts)
- Message types added to `src/shared/messageTypes.ts`

**Cost**: 3–4 days (after Track A Tailwind is in place).

---

## Track C — Full App Layout: Sidebar + Notes List (Inside Webview)

**What**: Restructure the webview from "editor only" to the full Tolaria layout: `sidebar | notes list | editor`. Sidebar has Favorites, Views, Types, Folders sections. Notes list shows NoteItem cards (title, status dot, preview, created/modified dates) with search and sort controls.

**Architecture**: Singleton custom panel (see "The Architectural Pivot" above).

### What Can Be Adapted from Tolaria

| Tolaria component | Adaptation needed | Complexity |
|---|---|---|
| `Sidebar.tsx` | Replace `VaultEntry`/`ViewFile` types with Foam adapter types | Medium |
| `SidebarSections.tsx` | Keep structure, replace data sources | Medium |
| `FavoritesSection.tsx` | Replace with VS Code workspace state bookmarks | Medium |
| `NoteList.tsx` + `NoteItem.tsx` | Replace VaultEntry with FoamNote, VS Code file URI | Low |
| `SortDropdown.tsx` | Copy directly — UI only | Very Low |
| `SearchPanel.tsx` | Adapt query to Foam adapter workspace search | Medium |
| `FolderTree.tsx` | Replace with `vscode.workspace.workspaceFolders` tree | Medium |
| `SidebarGroupHeader.tsx` | Copy directly | Very Low |

**"Can you just copy it in?"**: The component structure and visuals can be adapted, but ~15 files need data model translation — Tolaria's `VaultEntry` maps to `FoamNote`, Tolaria's `ViewFile` maps to VS Code file URIs, and Tolaria's Rust/Tauri backend calls become message-passing to the VS Code extension host. Budget 1–2 hours per component for adaptation.

### Dependencies to Add

| Package | Why | License | Bundle impact |
|---|---|---|---|
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag reorder for sidebar sections and favorites | MIT | ~30KB gzip |
| `@phosphor-icons/react` | Icon system throughout | MIT | ~10KB gzip (tree-shaken) |
| `@radix-ui/*` (via shadcn/ui) | Tooltip, Button, Dialog, Popover | MIT | ~40KB gzip (tree-shaken) |

Add all three to `THIRD_PARTY_LICENSES.md` when installed.

### Data Model Translation

| Tolaria field | Extension equivalent | Source |
|---|---|---|
| `entry.path` | `note.path` | Foam adapter |
| `entry.title` | `note.title` | Foam adapter |
| `entry.isA` (type) | `note.type` (from frontmatter) | Foam adapter — add `type` field |
| `entry.favorite` | `workspaceState.favorites[]` | VS Code workspace state |
| `entry.modified` | `vscode.workspace.fs.stat().mtime` | VS Code FS API |
| `entry.status` (new/modified/clean) | `repo.state.workingTreeChanges` | VS Code Git API |
| `entry.preview` | first 100 chars of prose | Foam adapter — add `preview` field |

The Foam adapter needs two new fields: `type` and `preview`. Small additions.

**Cost**: 4–6 weeks (largest track). Start with Notes List only, then add sidebar sections incrementally.

---

## Track D — Breadcrumb Bar (Top Left, Tolaria-Style)

**What**: A Tolaria-style breadcrumb/title bar at the top-left of the editor area showing: note title, type indicator, path, Archive/Delete actions. The **existing right-aligned formatting toolbar is unchanged** — it stays exactly as it is.

**Adapt from Tolaria**: `BreadcrumbBar.tsx` → `src/webview/chrome/BreadcrumbBar.tsx`. Remove Share button (not applicable in VS Code). The result is a left-side header + right-side formatting toolbar, like Tolaria.

**Cost**: 2 days (after Track A layout shell exists).

---

## Track E — Settings Panel (Tolaria-Style Modal, Inside Webview)

**Current state**: The settings panel from spec 017 was never built — there is no `src/editor/SettingsPanel.ts` or `src/webview/settings/settingsPanel.ts` in the codebase. This means it can be built fresh in React, matching Tolaria's design exactly.

**What**: A React modal overlay inside the editor webview, opened from the `⚙` icon in the webview status bar (Track B). Replaces any future VS Code WebviewPanel approach for settings.

**Tolaria's pattern** (`src/components/SettingsPanel.tsx`):
- `min(960px, 100vw-48px)` centered dialog, `86vh` max-height
- `SettingsHeader` (title + X close button) → shadcn `Tabs` nav → settings sections → `SettingsFooter` (Save / Cancel)
- `SettingsControls.tsx`: reusable `SettingsRow`, `SettingsGroup`, `SettingsSection`, `SelectControl`, `SwitchControl`, `TextInputControl`

**What can be copied nearly verbatim from Tolaria**:

| Tolaria file | Extension target | Adaptation needed |
|---|---|---|
| `src/components/SettingsControls.tsx` | `src/webview/chrome/settings/SettingsControls.tsx` | None — pure UI, no Tauri deps |
| `src/components/SettingsFooter.tsx` | `src/webview/chrome/settings/SettingsFooter.tsx` | Replace `onSave` to post `updateSetting` messages |
| `src/components/SettingsBodyNav.tsx` | `src/webview/chrome/settings/SettingsBodyNav.tsx` | Replace section IDs with extension categories |

**Extension-specific settings categories** (not Tolaria's — different product):

| Tab | Settings |
|---|---|
| Editor | Theme override, zoom level, editor width, TOC depth, blank line mode, font choice (Charter/Georgia vs. Inter) |
| AI / LLM | Provider (Copilot/Ollama), model, Ollama endpoint + model |
| Media | Image path, image path base, resize warning |
| Export | Chrome path, Pandoc path, Pandoc template |
| Advanced | Developer mode, preserve HTML comments |

**Save pattern**: Tolaria batches changes and saves on "Save" click. In VS Code, `vscode.workspace.getConfiguration().update()` is live. Two options:
- **Live** (simpler): each control change posts `updateSetting` to host → immediate effect, no Save button needed
- **Draft** (like Tolaria): hold changes in React state, post all on Save → safer for settings that restart behavior

Recommendation: **Live mode** for VS Code (no Save button) — matches VS Code's own Settings editor behavior.

**Message flow**:
```
Webview mounts SettingsPanel modal
  → sends SETTINGS_GET_ALL to host
Host reads vscode.workspace.getConfiguration()
  → sends SETTINGS_ALL_DATA { editor: {...}, ai: {...}, ... }
User changes a toggle
  → webview sends SETTINGS_UPDATE { key: 'gptAiMarkdownEditor.editorFont', value: 'Inter' }
Host: config.update(key, value, Global)
  → sends SETTINGS_UPDATED { key, value } back
Webview updates local state
```

**Adapt from Tolaria** (in terms of visual structure, not settings content):
- `SettingsPanel.tsx` → `src/webview/chrome/settings/SettingsPanel.tsx`
- Use shadcn `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- Use `SettingsGroup` + `SettingsRow` + `SettingsControls` (copied from Tolaria)
- Modal overlay: `fixed inset-0 flex items-center justify-center bg-black/40 z-50`

**Cost**: 3–4 days (after Track A Tailwind + shadcn/ui is in place and after Track B status bar has the ⚙ trigger).

---

## Track F — Enhanced Inspector Panels (Properties, Backlinks, Git History)

**Current state**: The extension has a flat backlinks sidebar. Tolaria's inspector panels are modular, tabbed components that can show metadata, relationships, history, and git status in a collapsible right panel.

**What**: Transform the backlinks panel into a full **Inspector Panel** system with multiple tabs:

| Tab | Content | Source |
|---|---|---|
| **Properties** | Frontmatter, file size, created/modified dates, word count | Foam adapter + VS Code FS API |
| **Backlinks** | Incoming wikilinks (current backlinks) | Foam adapter |
| **Relationships** | Outgoing wikilinks (this note links to...) | Foam adapter |
| **Git History** | File history, last commit, blame info | VS Code Git API + commits list |
| **Tags** | All tags in this note, click to filter | Foam adapter |

**Adapt from Tolaria**:
- `src/components/inspector/PropertiesPanel.tsx` — metadata display pattern
- `src/components/inspector/BacklinksPanel.tsx` — backlink list rendering
- `src/components/inspector/GitHistoryPanel.tsx` — git timeline UI
- Use shadcn `Tabs` for tab navigation
- Collapsible header (toggle visibility of entire panel)
- Resize handle (draggable right edge to expand/contract panel width)

**Architecture**: Inspector lives as `src/webview/chrome/InspectorPanel.tsx` on the right side of the layout:
```
[Sidebar] | [Editor] | [Inspector Tabs]
```
Wire into WebviewStateContext so it updates reactively with current note changes.

**Message flow**:
```
User selects a note
  → WebviewStateContext updates currentNotePath
  → Inspector tabs re-render with new note's:
    - Frontmatter (from Foam adapter)
    - Backlinks (from Foam adapter)
    - Git history (from host via GIT_GET_FILE_HISTORY message)
```

**Dependencies**: None new — use Foam adapter + shadcn Tabs + existing git messaging.

**Cost**: 3–4 days (after Track C notes list is working; can run in parallel with Track D/E).

---

## Track G — Command Palette Integration (Fuzzy Search + Global Commands)

**Current state**: The extension has slash commands (`/`) inside the editor. Tolaria has a full command palette (Cmd+K) with fuzzy search, grouping, and keyboard navigation.

**What**: Add a global **Command Palette** accessible via Cmd+K (or Ctrl+K on Windows/Linux):

| Command Category | Examples |
|---|---|
| **Navigation** | Go to note, Go to tag, Go to recent, Search vault |
| **Note actions** | New note, Archive note, Duplicate note, Delete note |
| **Formatting** | Bold, Italic, Code, Link (same as `/` commands) |
| **Git** | Commit, Push, Pull, View history |
| **Settings** | Open settings, Toggle night mode, Change font |
| **View** | Toggle sidebar, Toggle inspector, Focus editor |

**Fuzzy search**: Type "bnew" → matches "Bold, New note" → user presses arrow to select → Enter executes.

**Adapt from Tolaria**:
- `src/components/CommandPalette.tsx` — full palette UI
- `src/utils/fuzzyMatch.ts` — fuzzy scoring algorithm (copy directly — no deps)
- `src/hooks/useCommandRegistry.ts` — command registration pattern
- Keyboard navigation: Arrow Up/Down, Enter to execute, Escape to dismiss
- Grouping by category (Navigation · Note Actions · Formatting · etc.)

**Architecture**: 
```tsx
export const commandRegistry = {
  'note.new': {
    label: 'New Note',
    category: 'Note Actions',
    keys: ['cmd', 'shift', 'n'],
    execute: (context) => context.createNote(),
  },
  'note.archive': {
    label: 'Archive Note',
    category: 'Note Actions',
    execute: (context) => context.archiveCurrentNote(),
  },
  'git.commit': {
    label: 'Git Commit',
    category: 'Git',
    keys: ['cmd', 'shift', 'c'],
    execute: (context) => context.openCommitDialog(),
  },
  // ... 20+ commands
} as const
```

The palette opens as a modal overlay (similar to Settings panel), memoized for performance, keyboard-first.

**Integration with slash commands**: Slash commands (`/bold`, `/link`) stay in the editor for quick formatting. Command palette is for app-level actions (navigation, note creation, git operations, settings).

**Message flow**:
```
User presses Cmd+K
  → CommandPalette modal opens
User types "arc"
  → Palette fuzzy-filters commands → "Archive Note" highlighted
User presses Enter
  → Palette sends COMMAND_EXECUTE { commandId: 'note.archive' } to host
Host performs action (delete/move file) + sends confirmation back
```

**Dependencies**: None new — use fuzzy match algorithm from Tolaria, shadcn Dialog.

**Cost**: 2–3 days (can run in parallel with Tracks D–F).

---

## Patterns to Adapt from Tolaria

Beyond full components, Tolaria has utility patterns and hooks worth adopting:

### Keyboard Event Handling

**Files**: `src/hooks/useKeyboardNavigation.ts`, `src/utils/keyboard.ts`

**What to adapt**:
```tsx
// IME composition guards — prevents keyboard shortcuts during IME input
export function useKeyboardShortcut(key: string, handler: () => void) {
  const isComposing = useRef(false)
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isComposing.current) return
      if (e.key === key && e.ctrlKey) {
        e.preventDefault()
        handler()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('compositionstart', () => { isComposing.current = true })
    window.addEventListener('compositionend', () => { isComposing.current = false })
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('compositionstart', () => {})
      window.removeEventListener('compositionend', () => {})
    }
  }, [key, handler])
}

// Modifier detection (platform-aware)
export function isCmdOrCtrl(e: KeyboardEvent): boolean {
  return process.platform === 'darwin' ? e.metaKey : e.ctrlKey
}
```

**Implement in**: `src/webview/utils/keyboard.ts` (new file)

**Use case**: Command palette shortcuts, focus trap in settings modal, editor hotkeys.

### Toast Notification System

**Files**: `src/components/Toast.tsx`

**What to adapt**:
```tsx
type ToastMessage = {
  id: string
  message: string
  duration?: number // ms, default 2000
  type?: 'success' | 'error' | 'info'
}

export function Toast({ message, type = 'info', onDismiss }: Props) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => onDismiss(message.id), message.duration ?? 2000)
    return () => clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div className={`fixed bottom-4 right-4 px-4 py-2 rounded text-white
      ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'}
      animate-in fade-in duration-300`}>
      {message.message}
    </div>
  )
}
```

**Implement in**: `src/webview/components/Toast.tsx` + integrate into `WebviewStateContext`

**Use case**: Feedback on note save, git commit success, settings updated, wikilink resolution.

### Dialog/Modal Templates

**Files**: `src/components/dialogs/`

**Patterns to adopt**:
```tsx
// Focus return after modal close
const returnFocusRef = useRef<HTMLElement | null>(null)
useEffect(() => {
  returnFocusRef.current = document.activeElement as HTMLElement
}, [])

const handleClose = () => {
  onClose()
  setTimeout(() => returnFocusRef.current?.focus(), 0)
}

// Keyboard shortcuts in dialogs
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    handleSubmit()
  }
  if (e.key === 'Escape') {
    handleClose()
  }
}
```

**Use in**: Settings modal, Commit dialog, Create note dialog, Delete confirmation.

### Frontmatter Parsing & Validation

**Files**: `src/utils/frontmatter.ts`

**What to adapt**:
```tsx
export type Frontmatter = {
  title?: string
  type?: string
  tags?: string[]
  _created?: number
  _modified?: number
  _archived?: boolean
}

export function parseFrontmatter(content: string): { fm: Frontmatter; body: string } {
  const fmRegex = /^---\n([\s\S]*?)\n---\n/
  const match = content.match(fmRegex)
  
  if (!match) return { fm: {}, body: content }
  
  const fmText = match[1]
  const fm = YAML.parse(fmText) as Frontmatter
  const body = content.slice(match[0].length)
  
  return { fm, body }
}

export function validateFrontmatter(fm: unknown): fm is Frontmatter {
  if (typeof fm !== 'object' || fm === null) return false
  const obj = fm as Record<string, unknown>
  
  return (
    (obj.title === undefined || typeof obj.title === 'string') &&
    (obj.type === undefined || typeof obj.type === 'string') &&
    (obj.tags === undefined || (Array.isArray(obj.tags) && obj.tags.every(t => typeof t === 'string'))) &&
    (obj._created === undefined || typeof obj._created === 'number')
  )
}
```

**Implement in**: Extend `src/features/foam/foamAdapter.ts` with these utilities.

**Use case**: Foam adapter parses frontmatter for type, tags, created/modified dates. Properties panel displays parsed FM.

### Memoization & Performance Guards

**Files**: Tolaria uses `React.memo`, `useMemo`, `useCallback` throughout.

**Patterns**:
```tsx
// Memoize list items to prevent re-render on every keystroke
export const NoteItem = React.memo(({ note, isSelected, onClick }: Props) => {
  return <div onClick={onClick}>{note.title}</div>
}, (prev, next) => {
  // Custom equality — only re-render if note.path or isSelected changes
  return prev.note.path === next.note.path && prev.isSelected === next.isSelected
})

// useMemo for expensive filters
const filteredNotes = useMemo(
  () => notes.filter(n => n.title.toLowerCase().includes(search.toLowerCase())),
  [notes, search]
)

// useCallback for handlers passed to memoized children
const handleSelect = useCallback((noteId: string) => {
  setSelectedNoteId(noteId)
}, []) // No deps — handler is stable
```

**Implement**: As components are built in Tracks B–G, apply these patterns. Don't optimize prematurely, but do measure.

---

```bash
npm install @phosphor-icons/react
```

Import individual icons only — **never the barrel import**:

```tsx
// ✅ Correct — tree-shaken by esbuild
import { FileText, Plus, MagnifyingGlass, GearSix } from '@phosphor-icons/react'

// ❌ Wrong — includes entire icon library (~2MB)
import * as Icons from '@phosphor-icons/react'
```

esbuild's `treeShaking: true` (already set in `scripts/build-webview.js`) handles the rest. Verify after first build:

```bash
node scripts/build-webview.js && du -sh dist/webview.js
```

---

## Reusable Code from Tolaria

| Tolaria file | What to adapt | Extension target |
|---|---|---|
| `src/index.css` — CSS token block | Semantic token names (`--surface-*`, `--text-*`, etc.) | `src/webview/theme.css` |
| `src/components/StatusBar.tsx` | Git badges, commit button, night mode toggle | `src/webview/chrome/StatusBar.tsx` |
| `src/components/NoteItem.tsx` | Card layout: title + status dot + preview + date | `src/webview/chrome/NoteItem.tsx` |
| `src/components/CommitDialog.tsx` | Two-button (Commit / Commit & Push) dialog UX | `src/webview/chrome/CommitDialog.tsx` |
| `src/components/BreadcrumbBar.tsx` | Title bar layout, action overflow | `src/webview/chrome/BreadcrumbBar.tsx` |
| `src/components/Sidebar.tsx` + sections | Full sidebar, adapted data model | `src/webview/chrome/Sidebar.tsx` |
| `src/components/inspector/` | PropertiesPanel, BacklinksPanel, GitHistoryPanel tabs | `src/webview/chrome/inspector/` |
| `src/components/CommandPalette.tsx` | Fuzzy search, grouping, keyboard nav | `src/webview/chrome/CommandPalette.tsx` |
| `src/utils/fuzzyMatch.ts` | Fuzzy matching algorithm | `src/webview/utils/fuzzyMatch.ts` |
| `src/hooks/useKeyboardNavigation.ts` | Arrow key nav, focus management | `src/webview/utils/keyboard.ts` |
| `src/utils/frontmatter.ts` | Frontmatter parsing + validation | Extend `src/features/foam/foamAdapter.ts` |
| `src/components/Editor.css` — `.wikilink` | Dotted underline, hover pattern | `src/webview/editor.css` (spec 046) |
| `src/components/SettingsControls.tsx` | SettingsRow, SettingsGroup, SelectControl, Switch, TextInput | `src/webview/chrome/settings/SettingsControls.tsx` |
| `src/components/SettingsFooter.tsx` | Footer layout pattern | `src/webview/chrome/settings/SettingsFooter.tsx` |
| `src/components/SettingsBodyNav.tsx` | Tab nav layout | `src/webview/chrome/settings/SettingsBodyNav.tsx` |

---

## Risks

### R1 — Multi-note navigation + VS Code dirty state (HIGH)
When the webview loads different files internally (no new VS Code tabs), VS Code's dirty-state tracking (dot on the tab) must still work. The host must call `openTextDocument()` for each file and route `DOCUMENT_CHANGE` to the correct document. This is the highest-complexity part of Track C.

### R2 — Tailwind v4 + `--vscode-*` variable coexistence (MEDIUM)
Tailwind v4 generates CSS from utility classes. The `--vscode-*` variables are injected at runtime into the webview. The Tailwind config must define all theme tokens as `var(--vscode-*)` fallbacks. Test all Tailwind components in both light and dark VS Code themes before shipping any track.

### R3 — Tolaria component adaptation scope (MEDIUM)
~15 component files need data model translation. None can be copied verbatim. Budget 1–2 hours per component. Do not start until the `FoamNote` type is extended with `type` and `preview` fields.

### R4 — shadcn/ui initialization in the webview (LOW)
shadcn/ui assumes a project-level `components.json`. In the webview: manually copy component source into `src/webview/components/ui/`. Add `src/webview/lib/utils.ts` with the `cn()` helper. Do NOT use the shadcn CLI inside the extension repo.

### R5 — Font setting = constitution amendment (PROCESS)
The default font stays Charter/Georgia. Adding Inter as a user option requires constitution amendment `v2.1.0` **before** any CSS change. Create the amendment commit first, then add the setting.

### R6 — Settings panel scope creep (MEDIUM)
The extension currently has ~15 settings across Editor, AI, Media, Export tabs (from spec 017). All must migrate into the modal. Budget 1–2 hours per tab for validation. Do not add new settings categories during Track E implementation — keep scope to "rehost existing settings in Tolaria UX".

### R7 — Inspector panel resize + responsive layout (MEDIUM)
The right inspector panel must be resizable (draggable edge), collapsible (hide completely), and responsive (collapse to mobile view). Coordinate width changes with editor TipTap layout. Add to WebviewStateContext for persistence across note switches.

### R8 — Command palette performance (LOW)
With 50+ commands, the palette must maintain sub-100ms fuzzy search. Memoize command filtering. Test with slow machines.

### R9 — Keyboard shortcut collisions (MEDIUM)
Cmd+K (command palette), Cmd+, (settings, native VS Code), Cmd+N (new note), etc. must not conflict with VS Code's native shortcuts or TipTap editor shortcuts. Document the shortcut registry in the advisory when implemented.

---

## Specs to Create

| Spec | Track | First step |
|---|---|---|
| `specs/047-tailwind-css-migration/` | A | Tailwind setup + token bridge |
| `specs/048-webview-app-shell/` | C (foundation) | Singleton panel + layout |
| `specs/049-notes-sidebar-panel/` | C (full) | Notes list → sidebar sections |
| `specs/050-webview-status-bar/` | B | StatusBar component + git messages |
| `specs/051-breadcrumb-bar/` | D | BreadcrumbBar component |
| `specs/052-settings-panel/` | E | Settings modal + SettingsControls components |
| `specs/053-inspector-panels/` | F | Properties, Backlinks, Git History tabs |
| `specs/054-command-palette/` | G | Fuzzy search command palette + registry |

## Recommended Sequencing

**PHASE 0 — Foundational Refactors (from 003-maturity-learnings-from-tolaria.md):**
```
Week 1:     Type safety, error boundaries, message types
Week 1–2:   Code organization, WebviewStateContext, keyboard patterns
Week 2:     Extend FoamNote, keyboard utils, accessibility patterns
```

**PHASE 1–2 — Architectural Transformation (Tracks A–G from this advisory):**
```
Week 3–4:   Track A — Tailwind setup + CSS token migration + font setting
Week 5:     Track D — Breadcrumb bar (uses Tailwind)
Week 6–7:   Track B — Status bar + git integration (inside webview)
Week 8–13:  Track C — Singleton shell + sidebar + notes list + multi-note nav
Week 14:    Track E — Settings panel modal (depends on Track B for ⚙ trigger)
Week 15:    Track F — Inspector panels: Properties + Backlinks + Git History (right side)
Week 16:    Track G — Command palette: Cmd+K fuzzy search + command registry
```

**Total**: ~16 weeks (2 weeks foundation + 14 weeks transformation)

Do not start Track C before Track A's layout shell is stable.

---

> **Would you like me to:**  
> (a) Draft the spec for `047-tailwind-css-migration`?  
> (b) Draft the spec for `048-webview-app-shell` (singleton panel + layout)?  
> (c) Draft the spec for `050-webview-status-bar` (git status bar inside the webview)?  
> (d) Draft the constitution amendment for the configurable font setting?  
> (e) Draft the spec for `052-settings-panel` (Tolaria-style modal + SettingsControls)?  
> (f) Draft the spec for `053-inspector-panels` (Properties, Backlinks, Git History tabs)?  
> (g) Draft the spec for `054-command-palette` (fuzzy search command palette)?

