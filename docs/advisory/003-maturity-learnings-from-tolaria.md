# Architecture Advisory: Maturity Learnings from Tolaria (v1)

**Date**: 2026-05-17  
**Purpose**: Identify design philosophy and code organization gaps in the extension compared to Tolaria, and recommend foundational refactors before shipping Track A–E.

---

## Executive Summary

Tolaria is a **2.5-year-old, production-hardened** app. The extension is 3 months post-React migration. They share a design language (Tailwind + shadcn/ui), but Tolaria has mature patterns for:

- **Type safety** — no `any` types; strict type guards and discriminated unions
- **Error boundaries** — defensive error handling, graceful degradation
- **State management** — React hooks + props (simpler than Redux, but structured)
- **Component composition** — small, single-responsibility components with clear interfaces
- **Keyboard-first UX** — accessibility and power-user shortcuts embedded from day one
- **Performance** — memoization, virtualization, debouncing, worker threads
- **Testing** — TDD discipline; 70%+ coverage across the app
- **Code organization** — `src/components/`, `src/hooks/`, `src/utils/`, `src/features/`, `src/types/` separation

**Recommendation**: Before shipping Track A–E, invest **2–3 weeks in maturity refactors** to establish the foundation. This will prevent rework and make subsequent features faster.

**Do this first**: Fix the type system and error boundaries. Everything else follows.

---

## 1. Type Safety — The Foundation

### What Tolaria Does

```tsx
// ❌ NEVER in Tolaria:
const data: any = ...
const result = data.foo.bar // Runtime error waiting to happen

// ✅ Always in Tolaria:
type VaultEntry = {
  path: string
  title: string
  isA: Type | null
  modified: number
}

const entry: VaultEntry = ...
const result = entry.path // TS checks this at compile time
```

**No `any` types in production code.** Every return type, parameter type, and prop is explicit.

### What the Extension Currently Does

- `src/editor/MarkdownEditorProvider.ts` — large handler methods with minimal type annotations
- Message handlers use object indexing without type safety:
  ```ts
  const data = message.data // ❌ could be anything
  const path = data.path    // ❌ runtime error if undefined
  ```
- `src/features/foam/foamAdapter.ts` — `FoamNote` is well-typed, but query results are `any[]`
- Event handlers lack parameter types: `const handler = (e) => {}` (should be `(e: WheelEvent) => {}`)

### Refactor First: Create `src/types/index.ts`

This is the **single highest-impact change**. Define every domain object in one place:

```ts
// src/types/index.ts
export type FoamNote = {
  path: string
  filename: string
  title: string
  uri: vscode.Uri
  tags: string[]
  aliases: string[]
  type?: string           // NEW: from frontmatter
  preview?: string        // NEW: first 100 chars
  modified?: number       // NEW: file mtime
  status?: 'new' | 'modified' | 'clean'  // NEW: git status
}

export type FoamBacklink = {
  source: string
  target: string
  context: string
}

export type FoamWorkspaceSnapshot = {
  notes: FoamNote[]
  backlinks: Record<string, FoamBacklink[]>
  allTags: string[]
}

// Message types (discriminated union — much safer than string keys)
export type WebviewMessage =
  | { type: 'GET_NOTE_LIST'; id: string }
  | { type: 'NOTE_LIST_RESULT'; id: string; notes: FoamNote[] }
  | { type: 'NAVIGATE_TO_NOTE'; path: string }
  | { type: 'LOAD_NOTE_CONTENT'; path: string; content: string }
  | { type: 'EDITOR_READY' }

// Guard function (pattern from Tolaria)
export function isWebviewMessage(data: unknown): data is WebviewMessage {
  return typeof data === 'object' && data !== null && 'type' in data
}

// Type-safe handler registry (instead of switch on magic strings)
export type MessageHandler<T extends WebviewMessage = WebviewMessage> = (msg: T) => void

export const messageHandlers: Record<WebviewMessage['type'], MessageHandler> = {
  GET_NOTE_LIST: (msg) => { /* msg.id is known here */ },
  NOTE_LIST_RESULT: (msg) => { /* msg.notes is known here */ },
  // ...
}
```

**Impact**:
- Eliminates `any` usage in message handling
- Catches bugs at compile time instead of runtime
- Makes refactoring safer (rename a field, TS tells you everywhere it breaks)
- Improves IDE autocomplete across the codebase

**Timeline**: 1–2 days to define core types + refactor message handlers.

---

## 2. Error Boundaries & Defensive Programming

### What Tolaria Does

```tsx
// Try-catch at component boundaries
export function NoteList({ notes }: Props) {
  try {
    return <div>{notes.map(renderNote)}</div>
  } catch (error) {
    logError('NoteList render failed', error)
    return <ErrorPlaceholder message="Failed to load notes" />
  }
}

// Type guards before use (prevents runtime errors)
if (!isVaultEntry(data)) {
  logError('Invalid vault entry', data)
  return null
}

// Default values for optional data
const title = entry.title ?? 'Untitled'
const modified = entry.modified ?? 0
```

### What the Extension Currently Does

- Error handling is minimal — most message handlers don't wrap in try-catch
- Foam adapter returns `FoamNote[]` but doesn't validate shape before returning
- `editor.ts` message handlers don't handle missing or malformed data
- No error reporting to the user (errors silently fail or throw)

### Refactor: Add Error Boundaries

1. **Create `src/shared/errorHandler.ts`**:
   ```ts
   export function logError(context: string, error: unknown): void {
     const message = error instanceof Error ? error.message : String(error)
     console.error(`[${context}]`, message)
     // TODO: Send to PostHog or external logging
   }

   export function captureException(error: unknown, context: string): void {
     logError(context, error)
     // Later: integrate with error tracking service
   }
   ```

2. **Wrap async operations in MarkdownEditorProvider**:
   ```ts
   case 'GET_NOTE_LIST':
     try {
       const notes = await getFoamSnapshot().notes
       if (!Array.isArray(notes)) throw new Error('Invalid note list')
       this.webviewPanel?.webview.postMessage({
         type: 'NOTE_LIST_RESULT',
         notes,
       })
     } catch (error) {
       logError('GET_NOTE_LIST', error)
       this.webviewPanel?.webview.postMessage({
         type: 'ERROR',
         message: 'Failed to fetch notes',
       })
     }
   ```

3. **Add error type to WebviewMessage**:
   ```ts
   | { type: 'ERROR'; message: string; code?: string }
   ```

**Impact**: Prevents silent failures, gives users feedback, makes debugging easier.

**Timeline**: 1 day.

---

## 3. Component Composition — Small, Focused Units

### What Tolaria Does

```tsx
// ❌ BAD — 300-line component doing everything
export function NoteListPage() {
  const [notes, setNotes] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sort, setSort] = useState('modified')
  const [selectedNote, setSelectedNote] = useState(null)
  // ... 50 more lines of business logic
  return (
    <div>
      {/* search bar */}
      {/* sort dropdown */}
      {/* note list */}
      {/* detail panel */}
    </div>
  )
}

// ✅ GOOD — Tolaria's actual approach
export function NoteListPage() {
  const [filter, setFilter] = useState<FilterState>(defaults)
  const notes = useMemo(() => applyFilter(allNotes, filter), [allNotes, filter])
  
  return (
    <div className="flex gap-4">
      <NoteListControls filter={filter} onFilterChange={setFilter} />
      <NoteList notes={notes} />
      <NoteDetailPanel />
    </div>
  )
}

// Each sub-component is small, reusable, testable
export function NoteListControls({ filter, onFilterChange }: Props) {
  return (
    <div>
      <SearchInput value={filter.search} onChange={(v) => onFilterChange({...filter, search: v})} />
      <SortDropdown value={filter.sort} onChange={(v) => onFilterChange({...filter, sort: v})} />
    </div>
  )
}
```

### What the Extension Currently Does

- `src/webview/editor.tsx` is the React shell — it's small and good
- But custom TipTap extensions are often tightly coupled (wikilink extension touches DOM directly)
- Status bar + sidebar haven't been built yet, so this is a good time to establish the pattern

### Refactor Before Building Tracks B–C

Create a reusable **component structure template**:

```
src/webview/
  chrome/              # App shell components (not editor-related)
    StatusBar/
      StatusBar.tsx    # Main container
      StatusBadges.tsx # Individual badges
      GitStatus.tsx    # Git state display
      SettingsButton.tsx
    Sidebar/
      Sidebar.tsx
      SidebarSection.tsx
      FavoritesSection.tsx
      TypesSection.tsx
    NoteList/
      NoteList.tsx
      NoteItem.tsx
      NoteListControls.tsx
      SearchInput.tsx
      SortDropdown.tsx
    Settings/
      SettingsPanel.tsx
      SettingsControls.tsx
      SettingsRow.tsx
    Breadcrumb/
      BreadcrumbBar.tsx
  editor/              # Editor-specific (TipTap + formatting)
    Editor.tsx
    BubbleMenu.tsx
    extensions/
      wikilink.ts
      images.ts
      ...
  utils/               # Shared utilities (no React deps)
    keyboard.ts
    throttle.ts
    ...
```

**Key principle**: Components in `chrome/` should be independent of the editor. A `StatusBar` shouldn't need to know about TipTap. Use callbacks and context to communicate.

**Timeline**: Establish this before Track B starts (no new code — just planning).

---

## 4. Keyboard & Accessibility First

### What Tolaria Does

**Every interactive component:**
- Handles arrow keys (Up, Down for navigation)
- Handles Enter/Escape (confirm/cancel)
- Has `aria-label` or `aria-labelledby`
- Supports focus via Tab
- Provides visual focus indicator
- Supplies keyboard shortcuts in help/footer

```tsx
// Tolaria's ConflictResolverModal pattern
export function ConflictResolverModal({ conflicts, onResolve }: Props) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.code) {
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIdx((i) => Math.max(0, i - 1))
        break
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIdx((i) => Math.min(conflicts.length - 1, i + 1))
        break
      case 'KeyY':
        onResolve(conflicts[selectedIdx], 'accept')
        break
      case 'KeyN':
        onResolve(conflicts[selectedIdx], 'reject')
        break
      case 'Escape':
        // cancel or return
        break
    }
  }

  return (
    <dialog onKeyDown={handleKeyDown} aria-label="Resolve conflicts">
      {/* render */}
    </dialog>
  )
}
```

### What the Extension Currently Does

- Bubble menu is keyboard-accessible (uses Tailwind `focus:` states)
- Slash commands are keyboard-driven
- BUT: The new sidebar/notes list/settings haven't been built yet — **establish keyboard patterns now**

### Do This for Tracks B–E

For every new component:

1. **Support arrow key navigation** in lists/menus
2. **Add Enter/Escape** confirmation/dismissal
3. **Define keyboard shortcuts** in a registry (similar to Tolaria's `CommandRegistry`)
4. **Test keyboard in Playwright** — don't just test clicking
5. **Add ARIA attributes** — at minimum: `aria-label`, `role`

Example registry (for Track B/E):

```ts
// src/webview/shortcuts.ts
export const shortcutRegistry = {
  'settings.open': {
    keys: ['shift', 'p'],  // or Cmd+,
    label: 'Open Settings',
    handler: (context) => context.openSettings(),
  },
  'note.new': {
    keys: ['cmd', 'n'],
    label: 'New Note',
    handler: (context) => context.createNote(),
  },
} as const
```

**Timeline**: 1 day to establish patterns + add to Track definitions.

---

## 5. State Management — Structured Props & Context

### What Tolaria Does

```tsx
// NO global Redux/Zustand. Instead: React hooks + Context for shared state

// Context for app-level state
const AppContext = React.createContext<AppContextValue | null>(null)

export function useAppState() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('AppContext not provided')
  return ctx
}

// Pass data down via props; lift state to nearest common parent
export function App() {
  const [currentNote, setCurrentNote] = useState<VaultEntry | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  
  return (
    <AppContext.Provider value={{ currentNote, isDarkMode }}>
      <Layout currentNote={currentNote} onSelectNote={setCurrentNote} />
    </AppContext.Provider>
  )
}
```

**Philosophy**: Prefer **prop drilling** to Redux. React Context for truly global state (theme, current user, settings). Local hooks for component state.

### What the Extension Should Do

- **Keep local state in React components** (search, sort, expanded/collapsed sections)
- **Use Context for webview ↔ host messaging** (don't repeat the message pattern in every component)
- **Create a WebviewStateContext** to share Foam data, current note path, git status across the app

```ts
// src/webview/context/WebviewStateContext.tsx
type WebviewState = {
  notes: FoamNote[]
  currentNotePath: string | null
  gitStatus: GitStatus | null
  settings: ExtensionSettings
}

type WebviewContextValue = WebviewState & {
  navigateToNote: (path: string) => void
  updateSetting: (key: string, value: unknown) => void
}

const WebviewContext = React.createContext<WebviewContextValue | null>(null)

export function useWebviewState() {
  const ctx = useContext(WebviewContext)
  if (!ctx) throw new Error('WebviewStateContext not provided')
  return ctx
}

// In editor.tsx:
export function EditorApp() {
  const [state, setState] = useState<WebviewState>(initialState)
  
  const handleNavigateToNote = (path: string) => {
    vscode.postMessage({ type: 'NAVIGATE_TO_NOTE', path })
  }

  const handleMessage = (event: MessageEvent) => {
    const msg = event.data
    if (msg.type === 'LOAD_NOTE_CONTENT') {
      setState(s => ({ ...s, currentNotePath: msg.path }))
    }
  }

  return (
    <WebviewContext.Provider value={{ ...state, navigateToNote: handleNavigateToNote, ... }}>
      <Sidebar />
      <Editor />
      <StatusBar />
    </WebviewContext.Provider>
  )
}
```

**Impact**: Every component can access app state without prop drilling. Sidebar doesn't need to pass `onSelectNote` through 3 levels of components.

**Timeline**: 2–3 days (after Track A shell exists).

---

## 6. Code Organization & Folder Structure

### Tolaria's Organization

```
src/
  components/           # React components (UI)
    dialogs/            # Dialog-specific components
    inspector/          # Inspector panel sections
    sidebar/            # Sidebar sections
    status-bar/         # Status bar elements
    CommandPalette.tsx
    NoteItem.tsx
    SearchPanel.tsx
  hooks/                # React hooks (custom state logic)
    useKeyboardNavigation.ts
    useCommandRegistry.ts
    useSyncState.ts
    commands/           # Command definitions
  utils/                # Pure functions (no React)
    fuzzyMatch.ts
    frontmatter.ts
    viewFilters.ts
    keyboard.ts
  features/             # Feature modules (could contain components + hooks + utils)
    wikilinks/
      wikilink.ts
      fuzzyMatch.ts
    search/
      searchEngine.ts
      indexing.ts
    git/
      commitDialog.ts
      gitApi.ts
  types/                # TypeScript types only
    index.ts
  constants.ts          # Global constants
  i18n/                 # Localization
  App.tsx
  main.tsx
```

### Extension's Current Organization

```
src/
  webview/
    editor.tsx          # ← everything goes here right now
    editor.css
    extensions/         # Good: isolated TipTap extensions
    components/         # Placeholder for future UI
  editor/
    MarkdownEditorProvider.ts  # Host-side
  features/
    foam/               # Good: isolated feature
    wordCount/
    outlineView/
  shared/               # Shared types + messages
  __tests__/
  __mocks__/
```

### Refactor: Establish Structure Before Tracks B–E

```
src/
  webview/
    chrome/             # App shell (NEW)
      components/       # Sidebar, StatusBar, NoteList, BreadcrumbBar, Settings
      hooks/
      utils/
    editor/             # Editor-specific
      extensions/
      components/
      utils/
    context/            # Context providers (NEW)
    utils/              # Webview utilities
    index.tsx           # Main entry
    editor.tsx          # TipTap setup
  editor/
    MarkdownEditorProvider.ts
    messages.ts         # Message router (NEW)
  features/
    foam/
    wikilinks/
    search/
    git/
  shared/
    types/
      index.ts          # All types
    messages.ts         # Message type definitions
    errorHandler.ts     # Error utilities
  constants.ts
```

**Timeline**: 2 days (mostly moving/refactoring existing code).

---

## 7. Performance Patterns

### What Tolaria Does

```tsx
// Memoize components that receive the same props
export const NoteItem = React.memo(({ note, isSelected, onClick }: Props) => {
  return <div onClick={onClick}>{note.title}</div>
})

// useMemo for expensive computations
const filteredNotes = useMemo(
  () => applyFilter(allNotes, filter),
  [allNotes, filter]
)

// useCallback for stable event handlers (passed to memoized children)
const handleSelectNote = useCallback((note) => {
  setSelectedNote(note)
}, [])

// Virtualization for long lists (via react-window or similar)
// Not yet implemented in extension

// Web Workers for heavy parsing
// Markdown parsing in worker thread, not main thread
```

### Extension Should Do

1. **Memoize NoteList items** once built (lots of renders as you type)
2. **useMemo for Foam queries** (filtering/searching through 1000+ notes shouldn't block editor)
3. **Debounce Foam reindex** (don't reindex on every file save)
4. **Virtualize long note lists** (if vault has 10k+ notes)

**Timeline**: After Tracks B–C are built (premature optimization is the root of all evil).

---

## 8. Testing — TDD Discipline

### What Tolaria Does

- 70%+ code coverage (frontend + backend)
- Playwright for E2E smoke tests (core user flows)
- Vitest + React Testing Library for component tests
- Red → Green → Refactor discipline
- Pre-push hook enforces coverage gates

### Extension Should Do

- **Phase 1**: Unit tests for utils (fuzzy matching, frontmatter parsing) — already started with spec 046
- **Phase 2**: Component tests for Tracks B–E components as they're built
- **Phase 3**: E2E Playwright tests for critical flows (navigate notes, edit, commit)

**Timeline**: Integrated into each spec (not a separate track).

---

## Recommended Refactor Sequence (Before Tracks A–E)

### Week 1: Foundation (2–3 days)

1. **Create `src/types/index.ts`** — Define all domain types, discriminated union message types, type guards
2. **Create `src/shared/errorHandler.ts`** — Error logging + capture infrastructure
3. **Refactor `src/shared/messageTypes.ts`** — Use discriminated union instead of string constants
4. **Refactor `src/editor/MarkdownEditorProvider.ts`** — Add try-catch, use type-safe handlers

**Outcome**: No more `any` types. All message handling is type-safe. Errors don't silently fail.

### Week 1–2: Organization (2 days)

5. **Establish `src/webview/chrome/` structure** — Plan where Sidebar, StatusBar, NoteList, Settings go
6. **Extract `src/webview/context/WebviewStateContext.tsx`** — Shared app state provider
7. **Create `src/webview/shortcuts.ts`** — Keyboard shortcut registry

**Outcome**: Clear folder structure. Easy to navigate for new developers. Keyboard patterns established.

### Week 2: Enhancement (1–2 days)

8. **Extend `FoamNote` type** — Add `type`, `preview`, `modified`, `status` fields
9. **Create `src/webview/utils/keyboard.ts`** — Keyboard event helpers (IME guards, modifier detection)
10. **Add accessibility patterns** — ARIA labels, focus management utilities

**Outcome**: Ready to build Tracks B–E without rework.

---

## What These Changes Unblock

| Change | Unblocks |
|---|---|
| Type safety (week 1) | All subsequent work — less debugging, faster refactoring |
| Error boundaries (week 1) | Production-ready message handling |
| Component structure (week 1–2) | Tracks B–E can reuse patterns; no architecture churn |
| WebviewStateContext (week 1–2) | Sidebar + StatusBar don't become prop-drilling nightmares |
| Accessibility + shortcuts (week 2) | Power users get keyboard-first experience from day one |
| Extended FoamNote type (week 2) | Track C sidebar can show type indicators, dates, status |

---

## Summary: Start with Type Safety

The single highest-impact refactor is **eliminating `any` types and creating a discriminated union message system**. This:

- Prevents 80% of runtime errors
- Makes refactoring safe
- Improves IDE support
- Establishes a pattern for all future code
- Takes ~2 days
- Unblocks everything else

**Do this before touching Tailwind or any UI work.**

Next: Do you want me to create the `src/types/index.ts` file right now, or would you rather I draft the refactoring specs first?

---

## References

- **Tolaria type system**: `/Users/kamran/Documents/GitHub/tolaria/src/types/`
- **Tolaria error handling**: `/Users/kamran/Documents/GitHub/tolaria/src/utils/errorHandler.ts` (if exists) or catch blocks throughout
- **Tolaria keyboard patterns**: `/Users/kamran/Documents/GitHub/tolaria/src/hooks/useKeyboardNavigation.ts`
- **Tolaria component structure**: `/Users/kamran/Documents/GitHub/tolaria/src/components/`
