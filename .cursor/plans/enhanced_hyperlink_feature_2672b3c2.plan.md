---
name: Enhanced Hyperlink Feature
overview: Enhance the link dialog to support local file linking with autocomplete and heading links within the current document, using radio buttons to switch between URL, File, and Headings modes.
todos:
  - id: "1"
    content: Add radio button group UI (URL, File, Headings) to linkDialog.ts, positioned below URL input field
    status: pending
  - id: "2"
    content: Implement mode switching logic - show/hide filter checkboxes, change placeholder text, toggle autocomplete behavior
    status: pending
    dependencies:
      - "1"
  - id: "3"
    content: Add file type filter checkboxes (All, MD, Images, Code, Config) with exclusive All behavior, only visible in File mode
    status: pending
    dependencies:
      - "1"
  - id: "4"
    content: Implement state persistence for filter checkboxes using localStorage
    status: pending
    dependencies:
      - "3"
  - id: "5"
    content: Create autocomplete dropdown component with CSS styling and keyboard navigation (arrows, Enter, Esc)
    status: pending
    dependencies:
      - "1"
  - id: "6"
    content: Implement file search message handler in MarkdownEditorProvider.ts using workspace.findFiles()
    status: pending
  - id: "7"
    content: Add file extension category mapping and filtering logic in extension
    status: pending
    dependencies:
      - "6"
  - id: "8"
    content: Implement debounced file search in webview (300ms) with message passing to extension
    status: pending
    dependencies:
      - "5"
      - "6"
  - id: "9"
    content: Add heading extraction using buildOutlineFromEditor() when Headings mode selected
    status: pending
    dependencies:
      - "1"
      - "5"
  - id: "10"
    content: Implement GFM-style slug generation utility function with duplicate handling
    status: pending
    dependencies:
      - "9"
  - id: "11"
    content: Add CSS styling for radio buttons, checkboxes, autocomplete dropdown, and path truncation with ellipsis
    status: pending
    dependencies:
      - "1"
      - "3"
      - "5"
  - id: "12"
    content: Wire up message handling in editor.ts to pass vscode API to linkDialog functions
    status: pending
    dependencies:
      - "6"
  - id: "13"
    content: Write unit tests for slug generation (special chars, duplicates, edge cases)
    status: pending
    dependencies:
      - "10"
  - id: "14"
    content: Write unit tests for file filtering logic (categories, exclusive All behavior)
    status: pending
    dependencies:
      - "7"
  - id: "15"
    content: "Manual testing: large workspace, special characters, duplicate headings, mode switching, persistence"
    status: pending
    dependencies:
      - "1"
      - "2"
      - "3"
      - "4"
      - "5"
      - "8"
      - "9"
      - "10"
      - "11"
      - "12"
---

# Enhanced Hyperlink Feature - Local Files & Headings

## Overview

Enhance the existing link dialog (`src/webview/features/linkDialog.ts`) to support:

1. **Local file linking** with fuzzy search autocomplete
2. **Heading links** within the current document (H1-H6)
3. **File type filtering** with checkboxes (MD, Images, Code, Config)
4. **Radio button mode selection** (URL, File, Headings) positioned at bottom

## Key Decisions

- **Radio buttons**: Text-only, horizontal, positioned below URL input
- **File search**: Show full path, truncate with CSS ellipsis, tooltip for full path
- **Headings display**: Flat list with format "Introduction : H1"
- **Slug generation**: GFM-style (lowercase, hyphens, handle duplicates)
- **File filtering**: Checkboxes (All, MD, Images, Code, Config) - exclusive "All", default all checked, persists selection
- **Filter visibility**: Only shown when "File" type is selected

## UX Wireframes & Visual States

### Wireframe 1: Default State (URL Mode)

```
┌─────────────────────────────────────────────────────┐
│ Insert Link                                    [×]    │
├─────────────────────────────────────────────────────┤
│ Link Text: [comprehensive________________]            │
│                                                       │
│ URL: [https://example.com________________]            │
│      (placeholder: "https://example.com")            │
│                                                       │
│ Type:  (●) URL  ( ) File  ( ) Headings               │
│                                                       │
│ [Remove Link]              [Cancel]  [OK]             │
└─────────────────────────────────────────────────────┘
```

**Visual Hints:**

- URL input has standard URL placeholder
- No autocomplete dropdown visible
- Radio buttons at bottom, URL selected (filled circle)
- Filter checkboxes hidden

### Wireframe 2: File Mode (No Search Yet)

```
┌─────────────────────────────────────────────────────┐
│ Insert Link                                    [×]    │
├─────────────────────────────────────────────────────┤
│ Link Text: [comprehensive________________]            │
│                                                       │
│ URL: [________________________________]              │
│      (placeholder: "Start typing to search files...")│
│                                                       │
│ Filter: ☑ All  ☑ MD  ☑ Images  ☑ Code  ☑ Config     │
│                                                       │
│ Type:  ( ) URL  (●) File  ( ) Headings               │
│                                                       │
│ [Remove Link]              [Cancel]  [OK]             │
└─────────────────────────────────────────────────────┘
```

**Visual Hints:**

- Placeholder changes to file search hint
- Filter checkboxes appear (all checked by default)
- File radio button selected
- No autocomplete dropdown until user types

### Wireframe 3: File Mode (With Autocomplete)

```
┌─────────────────────────────────────────────────────┐
│ Insert Link                                    [×]    │
├─────────────────────────────────────────────────────┤
│ Link Text: [comprehensive________________]            │
│                                                       │
│ URL: [getting-started.md________________]             │
│      ┌───────────────────────────────────────────┐  │
│      │ 📄 getting-started.md                     │  │
│      │    docs/getting-started.md                 │  │
│      │ 📄 getting-started-v2.md                  │  │
│      │    guides/getting-started-v2.md            │  │
│      │ 📄 getting-started-guide.md                │  │
│      │    wiki/getting-started-guide.md           │  │
│      └───────────────────────────────────────────┘  │
│                                                       │
│ Filter: ☑ All  ☑ MD  ☑ Images  ☑ Code  ☑ Config     │
│                                                       │
│ Type:  ( ) URL  (●) File  ( ) Headings               │
│                                                       │
│ [Remove Link]              [Cancel]  [OK]             │
└─────────────────────────────────────────────────────┘
```

**Visual Hints:**

- Autocomplete dropdown appears below URL field
- Each item shows: file icon (📄), filename, full path (truncated if needed)
- First item highlighted (keyboard navigation ready)
- Path truncation: if path > available width, show ellipsis (...)
- Hover on truncated path shows tooltip with full path
- Max 15-20 results shown, scrollable if more

### Wireframe 4: File Mode (Filtered - MD Only)

```
┌─────────────────────────────────────────────────────┐
│ Insert Link                                    [×]    │
├─────────────────────────────────────────────────────┤
│ Link Text: [comprehensive________________]            │
│                                                       │
│ URL: [readme________________]                        │
│      ┌───────────────────────────────────────────┐  │
│      │ 📄 readme.md                             │  │
│      │    README.md                              │  │
│      │ 📄 readme-guide.md                        │  │
│      │    docs/readme-guide.md                   │  │
│      └───────────────────────────────────────────┘  │
│                                                       │
│ Filter: ☐ All  ☑ MD  ☐ Images  ☐ Code  ☐ Config     │
│                                                       │
│ Type:  ( ) URL  (●) File  ( ) Headings               │
│                                                       │
│ [Remove Link]              [Cancel]  [OK]             │
└─────────────────────────────────────────────────────┘
```

**Visual Hints:**

- "All" unchecked, "MD" checked
- Only .md files shown in autocomplete
- Other checkboxes enabled (can select multiple)
- If "All" checked, other checkboxes disabled

### Wireframe 5: Headings Mode

```
┌─────────────────────────────────────────────────────┐
│ Insert Link                                    [×]    │
├─────────────────────────────────────────────────────┤
│ Link Text: [comprehensive________________]            │
│                                                       │
│ URL: [________________________________]              │
│      ┌───────────────────────────────────────────┐  │
│      │ 📌 Introduction : H1                    │  │
│      │ 📌 Getting Started : H2                  │  │
│      │ 📌 Installation : H3                     │  │
│      │ 📌 Usage : H2                            │  │
│      │ 📌 API Reference : H1                    │  │
│      │ 📌 Authentication : H2                   │  │
│      └───────────────────────────────────────────┘  │
│                                                       │
│ Type:  ( ) URL  ( ) File  (●) Headings               │
│                                                       │
│ [Remove Link]              [Cancel]  [OK]             │
└─────────────────────────────────────────────────────┘
```

**Visual Hints:**

- Filter checkboxes hidden (only in File mode)
- Autocomplete shows immediately (no typing needed)
- Format: "Heading Text : H1" (heading text, colon, space, level)
- Heading icon (📌) for visual distinction
- Flat list (no hierarchy indentation)
- Selecting inserts `#heading-slug` format

### Wireframe 6: Long Path Truncation

```
┌─────────────────────────────────────────────────────┐
│ URL: [very-long-filename.md________________]         │
│      ┌───────────────────────────────────────────┐  │
│      │ 📄 very-long-filename.md                 │  │
│      │    src/components/features/.../file.md   │  │
│      │    (tooltip on hover: full path)          │  │
│      └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Visual Hints:**

- Path truncated with ellipsis (...) when too long
- Truncation calculated dynamically based on dropdown width
- CSS `text-overflow: ellipsis` handles truncation
- `title` attribute on path element shows full path on hover
- Dropdown width: max 520px (matches dialog width)

## Detailed UX Behavior

### Radio Button Behavior

**Default State:**

- URL mode selected on dialog open
- URL input focused if no text selected
- URL input selected/focused if editing existing link

**Mode Switching:**

- Clicking radio button immediately switches mode
- URL field cleared when switching modes (fresh start)
- Placeholder text updates immediately
- Filter checkboxes show/hide with animation (fade in/out, ~150ms)
- Autocomplete dropdown closes when switching modes

**Visual States:**

- Selected: Filled circle (●), uses VS Code theme color
- Unselected: Empty circle (○), muted color
- Hover: Slight background highlight
- Focus: Keyboard focus ring (accessibility)

### Filter Checkbox Behavior

**Exclusive "All" Logic:**

- When "All" is checked: Other checkboxes disabled (grayed out)
- When "All" is unchecked: Other checkboxes enabled
- Checking any other checkbox: Automatically unchecks "All"
- Unchecking all other checkboxes: Automatically checks "All"

**Default State:**

- All checkboxes checked on first use
- Restore from localStorage on subsequent opens
- If localStorage empty/null: Default to all checked

**Visual States:**

- Checked: Checkmark visible, uses VS Code theme color
- Unchecked: Empty box, muted color
- Disabled: Grayed out, not clickable
- Hover: Background highlight (only when enabled)

### Autocomplete Dropdown Behavior

**Appearance:**

- Appears below URL input field
- Max width: 520px (matches dialog width)
- Max height: 300px (scrollable if more results)
- Background: VS Code editor widget background
- Border: 1px solid panel border color
- Shadow: Subtle drop shadow for depth

**File Results Display:**

- Icon: 📄 (file icon) - 16px, left-aligned
- Filename: Bold, primary text color
- Path: Muted color, smaller font size, below filename
- Spacing: 8px between items
- Padding: 8px vertical, 12px horizontal per item

**Heading Results Display:**

- Icon: 📌 (pin/heading icon) - 16px, left-aligned
- Format: "Heading Text : H1" (heading text bold, level muted)
- Spacing: Same as file results

**Keyboard Navigation:**

- Arrow Down: Move to next item (wraps to top)
- Arrow Up: Move to previous item (wraps to bottom)
- Enter: Select highlighted item, insert into URL field, close dropdown
- Esc: Close dropdown, return focus to URL input
- Tab: Close dropdown, move to next field
- Click outside: Close dropdown

**Mouse Interaction:**

- Hover: Highlight item (background color change)
- Click: Select item, insert into URL field, close dropdown
- Scroll: If results exceed max height, show scrollbar

**Search Behavior (File Mode):**

- Trigger: User types in URL field
- Debounce: 300ms delay before searching
- Minimum query: Search after 1 character typed
- Results limit: Max 15-20 items
- Matching: Case-insensitive, substring match on filename and path
- Empty state: Show "No files found" message

**Heading Behavior (Headings Mode):**

- Show immediately: No typing required
- Filter as you type: If user types, filter headings by text
- Format on insert: `#heading-slug` (GFM-style slug)
- Empty state: Show "No headings in document" if document has no headings

### Path Truncation Details

**CSS Implementation:**

```css
.autocomplete-item-path {
  max-width: calc(100% - 60px); /* Leave space for icon + padding */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Dynamic Calculation:**

- Measure dropdown container width
- Subtract icon width (16px) + padding (24px) + margin (20px) = ~60px
- Apply max-width to path element
- Browser handles ellipsis automatically

**Tooltip:**

- Add `title` attribute with full path
- Browser shows native tooltip on hover
- Tooltip appears after ~500ms hover delay

### Placeholder Text by Mode

- **URL Mode**: `"https://example.com"`
- **File Mode**: `"Start typing to search files..."`
- **Headings Mode**: `"Select a heading from the list below"` (or empty, since dropdown shows immediately)

### Error States

**No Files Found:**

- Show message in dropdown: "No files found matching 'query'"
- Style: Muted text, centered, padding 16px
- Suggestion: "Try adjusting your filters"

**No Headings:**

- Show message: "No headings in this document"
- Style: Same as no files found
- Suggestion: "Add headings using the toolbar"

**Search Error:**

- Show message: "Error searching files. Please try again."
- Log error to console
- Allow user to retry

## Technical Architecture

### Message Flow

```
Webview (linkDialog.ts)
  ↓ User types in File mode
  ↓ Debounced search (300ms)
  ↓ postMessage({ type: 'searchFiles', query, filters })
  ↓
Extension (MarkdownEditorProvider.ts)
  ↓ Handle searchFiles message
  ↓ vscode.workspace.findFiles() with filters
  ↓ Return filtered results
  ↓
Webview
  ↓ Display in autocomplete dropdown
  ↓ User selects file
  ↓ Insert relative path into URL field
```

### File Indexing Strategy

- **Lazy indexing**: Index files on first keystroke in File mode
- **Caching**: Cache file list in extension, refresh on workspace changes
- **Performance**: Use `workspace.findFiles()` with exclude patterns (node_modules, .git, etc.)

### Heading Extraction

- **Source**: Use existing `buildOutlineFromEditor()` from `src/webview/utils/outline.ts`
- **Slug generation**: GFM-style algorithm (lowercase, hyphens, handle duplicates)
- **Format**: Current document headings use `#heading-slug` format

## Implementation Details

### Files to Modify

1. **`src/webview/features/linkDialog.ts`**

   - Add radio button group (URL, File, Headings)
   - Add file type filter checkboxes (shown only in File mode)
   - Add autocomplete dropdown component
   - Implement heading extraction and display
   - Add slug generation utility
   - Handle mode switching and state persistence

2. **`src/editor/MarkdownEditorProvider.ts`**

   - Add `handleSearchFiles()` message handler
   - Implement file search with `workspace.findFiles()`
   - Apply file extension filters based on categories
   - Return relative paths from workspace root

3. **`src/webview/editor.ts`**

   - Wire up new message types for file search
   - Pass vscode API to linkDialog functions

4. **CSS styling** (in `src/webview/editor.css` or inline)

   - Style radio button group
   - Style filter checkboxes
   - Style autocomplete dropdown
   - Path truncation with CSS ellipsis

### File Extension Categories

- **MD**: `.md`, `.markdown`
- **Images**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp`, `.ico`
- **Code**: `.js`, `.ts`, `.jsx`, `.tsx`, `.py`, `.java`, `.cpp`, `.c`, `.h`, `.go`, `.rs`, `.rb`, `.php`, `.swift`, `.kt`, `.cs`, `.sh`, `.bash`, `.zsh`, `.fish`
- **Config**: `.json`, `.xml`, `.yaml`, `.yml`, `.toml`, `.ini`, `.conf`, `.config`, `.properties`

### Slug Generation Algorithm

```typescript
function generateHeadingSlug(text: string, existingSlugs: Set<string>): string {
  let slug = text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  let finalSlug = slug;
  let counter = 1;
  while (existingSlugs.has(finalSlug)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }
  
  return finalSlug;
}
```

### State Persistence

- Store filter checkbox state in `localStorage` (key: `markdownForHumans.linkFileFilters`)
- Restore on dialog open
- Default: All checkboxes checked

## UX Flow

### Flow 1: Linking to Local File

1. User opens link dialog (Cmd/Ctrl+K L)
2. Dialog shows with URL mode selected (default)
3. User selects "File" radio button
4. Filter checkboxes appear below URL field
5. User types in URL field → autocomplete dropdown appears
6. User selects file from dropdown
7. Relative path inserted into URL field
8. User clicks OK → link created

### Flow 2: Linking to Heading

1. User opens link dialog
2. User selects "Headings" radio button
3. Autocomplete dropdown shows headings from current document
4. Format: "Introduction : H1", "Getting Started : H2"
5. User selects heading
6. Slug inserted as `#introduction` or `#getting-started`
7. User clicks OK → link created

### Flow 3: File Type Filtering

1. User in File mode
2. User unchecks "All" checkbox
3. Other checkboxes become enabled
4. User checks "MD" and "Images"
5. Autocomplete only shows .md and image files
6. Selection persists for next dialog open

## Performance Considerations

- **Debounce file search**: 300ms delay on typing
- **Limit results**: Show max 15-20 files in dropdown
- **Cache file list**: Store in extension, invalidate on file system changes
- **Lazy heading extraction**: Extract only when Headings mode selected

## Testing Requirements

- Unit tests for slug generation (duplicates, special chars)
- Unit tests for file filtering logic
- Integration tests for message passing (webview ↔ extension)
- Manual testing: Large workspace (1000+ files), special characters in filenames, duplicate headings

## Out of Scope

- Cross-file heading links (future enhancement)
- WikiLinks syntax (separate feature)
- File watchers for real-time updates (use existing VS Code events)
- Advanced fuzzy matching library (start with simple string matching)