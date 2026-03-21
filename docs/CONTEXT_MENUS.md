# Menu Behaviors — Close on Click / Esc Key Reference

**Purpose:** Document all popup/dropdown menus and their dismiss behaviors for review.  
**Columns:**

- **Menu** — Which menu/toolbar this item belongs to  
**Menu Item** — Specific item or action
- **Close on Click** — Whether clicking this item closes the menu
- **Close on Esc** — Whether pressing Escape closes the menu  
**Changed (Y/N)** — For user to mark if behavior needs changing
- **Notes** — Additional info

---

## 1. Main Toolbar (Header bar)

Items appear left-to-right. The **Theme Toggle** (sun/moon) is pinned far-right and never overflows. All other groups move into the **Overflow (⋯)** menu when the window is too narrow.

### Group 1 — Document


| Menu Item | Close on Click | Close on Esc | Changed | Notes                                          |
| --------- | -------------- | ------------ | ------- | ---------------------------------------------- |
| Save      | N/A (button)   | N/A          |         | Disabled when document is clean; direct action |
| Undo      | N/A (button)   | N/A          |         | Disabled when nothing to undo; `requiresFocus` |


### Group 2 — Inline Marks


| Menu Item                | Close on Click | Close on Esc | Changed | Notes                                            |
| ------------------------ | -------------- | ------------ | ------- | ------------------------------------------------ |
| Bold                     | N/A (button)   | N/A          |         | Toggle; `requiresFocus`                          |
| Italic                   | N/A (button)   | N/A          |         | Toggle; `requiresFocus`                          |
| Underline                | N/A (button)   | N/A          |         | Toggle; `requiresFocus`                          |
| Highlight                | N/A (button)   | N/A          |         | Toggle; `requiresFocus`                          |
| Strikethrough            | N/A (button)   | N/A          |         | Toggle; `requiresFocus`                          |
| Inline Code              | N/A (button)   | N/A          |         | Toggle; `requiresFocus`                          |
| **Text Color — Primary** | N/A (toggle)   | N/A          |         | Applies/removes stored color; no dropdown opened |
| **Text Color — Caret ▾** | Opens menu     | Yes          |         | Opens color swatch picker                        |
| Text Color — Default     | Yes            | Yes          |         | Removes color and closes menu                    |
| Text Color — Red         | Yes            | Yes          |         | `#e81123`; applies and closes menu               |
| Text Color — Orange      | Yes            | Yes          |         | `#ea5a00`; applies and closes menu               |
| Text Color — Yellow      | Yes            | Yes          |         | `#fce100`; applies and closes menu               |
| Text Color — Green       | Yes            | Yes          |         | `#107c10`; applies and closes menu               |
| Text Color — Blue        | Yes            | Yes          |         | `#0078d4`; applies and closes menu               |
| Text Color — Purple      | Yes            | Yes          |         | `#8e562e`; applies and closes menu               |
| Text Color — Pink        | Yes            | Yes          |         | `#c239b3`; applies and closes menu               |
| **Headings ▾**           | Opens menu     | Yes          |         | `requiresFocus`; disabled inside table           |
| Heading 1                | Yes            | Yes          |         | Toggles and closes dropdown                      |
| Heading 2                | Yes            | Yes          |         | Toggles and closes dropdown                      |
| Heading 3                | Yes            | Yes          |         | Toggles and closes dropdown                      |
| Heading 4                | Yes            | Yes          |         | Toggles and closes dropdown                      |
| Heading 5                | Yes            | Yes          |         | Toggles and closes dropdown                      |
| Heading 6                | Yes            | Yes          |         | Toggles and closes dropdown                      |
| Insert/edit link         | N/A (button)   | N/A          |         | Opens link dialog; shortcut `Cmd/Ctrl+K`         |
| Insert image             | N/A (button)   | N/A          |         | Opens image insert dialog                        |
| Insert emoji             | N/A (button)   | N/A          |         | Posts `showEmojiPicker` to extension host        |


### Group 3 — Block / Structure


| Menu Item                    | Close on Click | Close on Esc | Changed | Notes                                                      |
| ---------------------------- | -------------- | ------------ | ------- | ---------------------------------------------------------- |
| **Lists ▾**                  | Opens menu     | Yes          |         | `requiresFocus`                                            |
| Bullet list                  | Yes            | Yes          |         | Disabled inside table; toggles and closes                  |
| Numbered list                | Yes            | Yes          |         | Disabled inside table; toggles and closes                  |
| Task list                    | Yes            | Yes          |         | Disabled inside table; toggles and closes                  |
| Table bullet                 | Yes            | Yes          |         | **Only enabled inside table**; toggles `- ` prefix; closes |
| **Block formatting ▾**       | Opens menu     | Yes          |         | `requiresFocus`; disabled inside table                     |
| Block quote                  | Yes            | Yes          |         | Toggles and closes                                         |
| Alert — Note (ℹ)             | Yes            | Yes          |         | Icon button in horizontal row; toggles and closes          |
| Alert — Tip (💡)             | Yes            | Yes          |         | Icon button in horizontal row; toggles and closes          |
| Alert — Important (📢)       | Yes            | Yes          |         | Icon button in horizontal row; toggles and closes          |
| Alert — Warning (⚠)          | Yes            | Yes          |         | Icon button in horizontal row; toggles and closes          |
| Alert — Caution (🛑)         | Yes            | Yes          |         | Icon button in horizontal row; toggles and closes          |
| Remove alert                 | Yes            | Yes          |         | Shown only when a GitHub alert is active; danger style     |
| **Code blocks & diagrams ▾** | Opens menu     | Yes          |         | `requiresFocus`; all items disabled inside table           |
| Plain text (code block)      | Yes            | Yes          |         | Inserts code block and closes                              |
| TypeScript (code block)      | Yes            | Yes          |         | Inserts code block and closes                              |
| Python (code block)          | Yes            | Yes          |         | Inserts code block and closes                              |
| JSON (code block)            | Yes            | Yes          |         | Inserts code block and closes                              |
| Mermaid (empty)              | Yes            | Yes          |         | Inserts empty Mermaid block and closes                     |
| Mermaid flowchart            | Yes            | Yes          |         | Inserts flowchart template and closes                      |
| **Table ▾**                  | Opens menu     | Yes          |         | `requiresFocus`                                            |
| Insert table                 | Yes            | Yes          |         | Disabled when already in table; opens table size dialog    |
| *(Shared table ops widget)*  | Yes            | Yes          |         | Inline ops block (see §5); only enabled when in a table    |


### Group 4 — View


| Menu Item                  | Close on Click | Close on Esc | Changed | Notes                                          |
| -------------------------- | -------------- | ------------ | ------- | ---------------------------------------------- |
| **View ▾**                 | Opens menu     | Yes          |         | No `requiresFocus`                             |
| Toggle outline pane        | Yes            | Yes          |         | Toggles outline and closes                     |
| Open source view           | Yes            | Yes          |         | Opens source view and closes                   |
| Copy selection as Markdown | Yes            | Yes          |         | Copies selection as raw Markdown and closes    |
| Configuration              | Yes            | Yes          |         | Opens extension settings and closes            |
| Zoom widget (−/+/value)    | No             | Yes          |         | Custom widget; stays open for repeated adjusts |


### Group 5 — Export


| Menu Item      | Close on Click | Close on Esc | Changed | Notes                      |
| -------------- | -------------- | ------------ | ------- | -------------------------- |
| **Export ▾**   | Opens menu     | Yes          |         | No `requiresFocus`         |
| Export as PDF  | Yes            | Yes          |         | Triggers export and closes |
| Export as Word | Yes            | Yes          |         | Triggers export and closes |


### Pinned (far-right, never overflows)


| Menu Item           | Close on Click | Close on Esc | Changed | Notes                              |
| ------------------- | -------------- | ------------ | ------- | ---------------------------------- |
| Theme toggle (☀/🌙) | N/A (button)   | N/A          |         | Toggles light/dark; always visible |


### Overflow (⋯)


| Menu Item      | Close on Click | Close on Esc | Changed | Notes                                                        |
| -------------- | -------------- | ------------ | ------- | ------------------------------------------------------------ |
| **Overflow ⋯** | Opens menu     | Yes          |         | Shows toolbar groups that don't fit; click outside closes it |
| *(items)*      | —              | —            |         | Same items/behaviors as their non-overflowed equivalents     |


> **Toolbar dropdown close behavior:** Opening a second dropdown closes the first. Clicking outside the toolbar closes all open dropdowns. There is no explicit per-dropdown Esc handler — the editor-level Esc collapses the selection.

---

## 2. Editor Context Menu (Right-click — outside table)


| Menu Item                      | Close on Click | Close on Esc | Changed | Notes                                            |
| ------------------------------ | -------------- | ------------ | ------- | ------------------------------------------------ |
| Cut                            | Yes            | Yes          |         | `⌘X`; disabled if no selection                   |
| Copy                           | Yes            | Yes          |         | `⌘C`; disabled if no selection                   |
| Paste                          | Yes            | Yes          |         | `⌘V`; always enabled                             |
| Paste without formatting       | Yes            | Yes          |         | `⌘⇧V`; plain-text paste via clipboard API        |
| **Delete**                     | Yes            | Yes          |         | Danger style; disabled if no selection           |
| **Refine the selected text ▸** | Opens submenu  | Yes          |         | Disabled if no selection; shows AI badge         |
| → Custom…                      | Yes            | Yes          |         | Opens custom refine input dialog and closes menu |
| → Rephrase                     | Yes            | Yes          |         | Triggers AI refine and closes                    |
| → Shorten                      | Yes            | Yes          |         | Triggers AI refine and closes                    |
| → More Formal                  | Yes            | Yes          |         | Triggers AI refine and closes                    |
| → More Casual                  | Yes            | Yes          |         | Triggers AI refine and closes                    |
| → Bulletize                    | Yes            | Yes          |         | Triggers AI refine and closes                    |
| → Summarize                    | Yes            | Yes          |         | Triggers AI refine and closes                    |
| Insert Emoji                   | Yes            | Yes          |         | Attempts native OS emoji picker                  |
| Insert Link                    | Yes            | Yes          |         | `⌘K`; opens link dialog and closes               |
| Clear Formatting               | Yes            | Yes          |         | `⌘\`; `clearNodes()` + `unsetAllMarks()`         |


> **Close behavior:** Clicking any item closes the menu. Clicking outside closes the menu. Esc closes the menu. Opening either context menu (table or non-table) hides the other.

---

## 3. Table Context Menu (Right-click — inside table)


| Menu Item                  | Close on Click | Close on Esc | Changed | Notes                                          |
| -------------------------- | -------------- | ------------ | ------- | ---------------------------------------------- |
| Cut                        | Yes            | Yes          |         | `⌘X`                                           |
| Copy                       | Yes            | Yes          |         | `⌘C`                                           |
| Paste                      | Yes            | Yes          |         | `⌘V`                                           |
| **Delete**                 | Yes            | Yes          |         | Danger style                                   |
| Insert row above (icon)    | Yes            | Yes          |         | INSERT section; icon button row                |
| Insert row below (icon)    | Yes            | Yes          |         | INSERT section; icon button row                |
| Insert column left (icon)  | Yes            | Yes          |         | INSERT section; icon button row                |
| Insert column right (icon) | Yes            | Yes          |         | INSERT section; icon button row                |
| Move row up (icon)         | Yes            | Yes          |         | MOVE section; icon button row                  |
| Move row down (icon)       | Yes            | Yes          |         | MOVE section; icon button row                  |
| Move column left (icon)    | Yes            | Yes          |         | MOVE section; icon button row                  |
| Move column right (icon)   | Yes            | Yes          |         | MOVE section; icon button row                  |
| Delete row (icon)          | Yes            | Yes          |         | DELETE section; danger style                   |
| Delete column (icon)       | Yes            | Yes          |         | DELETE section; danger style                   |
| Delete table (icon)        | Yes            | Yes          |         | DELETE section; most destructive; danger style |
| Sort ascending (A → Z)     | Yes            | Yes          |         | SORT section; text item with icon              |
| Sort descending (Z → A)    | Yes            | Yes          |         | SORT section; text item with icon              |
| Export table as CSV        | Yes            | Yes          |         | EXPORT section                                 |
| Insert Link                | Yes            | Yes          |         | `⌘K`; opens link dialog and closes             |


> **Close behavior:** Same as editor context menu — click item, click outside, or Esc all close the menu.

---

## 4. Selection Hover Menu (Floating formatting bar — BubbleMenu)

Appears above an active text selection. Shared control order matches the header toolbar.


| Menu Item                          | Close on Click | Close on Esc | Changed | Notes                                              |
| ---------------------------------- | -------------- | ------------ | ------- | -------------------------------------------------- |
| Bold                               | No             | No*          |         | Toggle; keeps bar open for chaining                |
| Italic                             | No             | No*          |         | Toggle; keeps bar open                             |
| Highlight                          | No             | No*          |         | Toggle; keeps bar open                             |
| **Text Color — Primary**           | No             | No*          |         | Toggles stored color; keeps bar open               |
| **Text Color — Caret ▾**           | Opens sub-menu | Esc*         |         | Opens color swatch picker within floating bar      |
| Text Color — Swatch                | Yes (sub-menu) | Esc*         |         | Applies color; closes swatch menu (bar stays open) |
| Strikethrough                      | No             | No*          |         | Toggle; keeps bar open                             |
| Underline                          | No             | No*          |         | Toggle; keeps bar open                             |
| Inline Code                        | No             | No*          |         | Toggle; keeps bar open                             |
| **Text Style ▾** (Paragraph/H1–H3) | Opens sub-menu | Esc*         |         | Opens heading picker within floating bar           |
| → Paragraph                        | Yes (sub-menu) | Esc*         |         | Sets paragraph; closes heading menu (bar stays)    |
| → Heading 1                        | Yes (sub-menu) | Esc*         |         | Sets H1; closes heading menu (bar stays)           |
| → Heading 2                        | Yes (sub-menu) | Esc*         |         | Sets H2; closes heading menu (bar stays)           |
| → Heading 3                        | Yes (sub-menu) | Esc*         |         | Sets H3; closes heading menu (bar stays)           |
| Insert link                        | No             | No*          |         | Opens link dialog; bar stays open                  |
| Clear formatting                   | No             | No*          |         | `unsetAllMarks()`; keeps bar open                  |
| **Dismiss (×)**                    | Yes            | —            |         | Collapses selection to `to`; hides bar entirely    |


> ** Note on Esc behavior:** The floating bar hides when the selection collapses. Pressing Esc in the editor (handled in `editor.ts`) collapses the selection, which causes TipTap's BubbleMenu to auto-hide. The bar does NOT have its own dedicated Esc handler; it relies on selection state.

---

## 5. Shared Table Ops (inline widget — used in Table ▾ dropdown and Table context menu)

Same widget rendered in both the toolbar **Table ▾** dropdown and the **Table context menu**. All items close whichever parent they're inside.


| Section | Item                    | Notes                          |
| ------- | ----------------------- | ------------------------------ |
| INSERT  | Insert row above        | Icon button row                |
| INSERT  | Insert row below        | Icon button row                |
| INSERT  | Insert column left      | Icon button row                |
| INSERT  | Insert column right     | Icon button row                |
| MOVE    | Move row up             | Icon button row                |
| MOVE    | Move row down           | Icon button row                |
| MOVE    | Move column left        | Icon button row                |
| MOVE    | Move column right       | Icon button row                |
| DELETE  | Delete row              | Danger style; icon button row  |
| DELETE  | Delete column           | Danger style; icon button row  |
| DELETE  | Delete table            | Most destructive; danger style |
| SORT    | Sort ascending (A → Z)  | Text item with icon            |
| SORT    | Sort descending (Z → A) | Text item with icon            |
| EXPORT  | Export table as CSV     |                                |


---

## General Behaviors


| Behavior                | Description                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Click outside menu      | All dropdowns and context menus close on outside click                                   |
| Esc key                 | Closes the topmost open dropdown/context menu; in the editor, collapses selection too    |
| Opening a new dropdown  | Automatically closes any other open toolbar dropdown                                     |
| Overflow (⋯) dropdown   | Dropdowns inside overflow keep the overflow panel open when clicked                      |
| Floating bar visibility | Only appears when text is actively selected (not on node selections or empty selections) |
| Two context menus       | Opening either context menu (table or non-table) closes the other                        |


---

*Last updated: 2026-03-21*