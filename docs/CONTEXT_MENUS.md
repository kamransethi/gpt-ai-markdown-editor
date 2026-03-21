# Menu Behaviors — Close on Click / Esc Key Reference

> **Purpose:** Document all popup/dropdown menus and their dismiss behaviors for review.
>
> **Columns:**
> - **Menu** — Which menu/toolbar this item belongs to
> - **Menu Item** — Specific item or action
> - **Close on Click** — Whether clicking this item closes the menu
> - **Close on Esc** — Whether pressing Escape closes the menu
> - **Changed (Y/N)** — For user to mark if behavior needs changing
> - **Notes** — Additional info

---

## 1. Main Toolbar (Header bar)

| Menu Item                       | Close on Click | Close on Esc | Changed | Notes                                             |
| ------------------------------- | -------------- | ------------ | ------- | ------------------------------------------------- |
| Save                            | N/A (button)   | N/A          |         | Direct action, no dropdown                        |
| Undo                            | N/A (button)   | N/A          |         | Direct action, no dropdown                        |
| Bold                            | N/A (button)   | N/A          |         | Direct toggle, no dropdown                        |
| Italic                          | N/A (button)   | N/A          |         | Direct toggle, no dropdown                        |
| Underline                       | N/A (button)   | N/A          |         | Direct toggle, no dropdown                        |
| Highlight                       | N/A (button)   | N/A          |         | Direct toggle, no dropdown                        |
| Strikethrough                   | N/A (button)   | N/A          |         | Direct toggle, no dropdown                        |
| Inline Code                     | N/A (button)   | N/A          |         | Direct toggle, no dropdown                        |
| **Text Color — Primary**        | N/A (toggle)   | N/A          |         | Toggles current color on/off, no dropdown opened  |
| **Text Color — Caret ▾**        | Opens menu     | Yes          |         | Opens color swatch picker                         |
| Text Color — Swatch             | Yes            | Yes          |         | Picks color and closes menu                       |
| **Headings ▾**                  | Opens menu     | Yes          |         | Opens heading dropdown                            |
| Heading 1–6                     | Yes            | Yes          |         | Toggles heading and closes dropdown               |
| **Lists ▾**                     | Opens menu     | Yes          |         | Opens lists dropdown                              |
| Bullet list                     | Yes            | Yes          |         | Toggles and closes                                |
| Numbered list                   | Yes            | Yes          |         | Toggles and closes                                |
| Task list                       | Yes            | Yes          |         | Toggles and closes                                |
| Table bullet                    | Yes            | Yes          |         | Toggles and closes                                |
| **Blocks ▾**                    | Opens menu     | Yes          |         | Opens blockquote/alert dropdown                   |
| Block quote                     | Yes            | Yes          |         | Toggles and closes                                |
| Alert icon buttons (N/T/I/W/C)  | Yes            | Yes          |         | Toggles alert type and closes                     |
| Remove alert                    | Yes            | Yes          |         | Removes alert and closes                          |
| **Insert ▾**                    | Opens menu     | Yes          |         | Opens insert dropdown                             |
| Insert/edit link                | Yes            | Yes          |         | Opens link dialog, closes dropdown                |
| Insert image                    | Yes            | Yes          |         | Opens image dialog, closes dropdown               |
| Insert emoji                    | Yes            | Yes          |         | Opens emoji picker, closes dropdown               |
| Code block items                | Yes            | Yes          |         | Inserts code block, closes dropdown               |
| Mermaid items                   | Yes            | Yes          |         | Inserts diagram, closes dropdown                  |
| **Table ▾**                     | Opens menu     | Yes          |         | Opens table dropdown                              |
| Insert table                    | Yes            | Yes          |         | Opens table size dialog, closes dropdown          |
| Add/move/delete row/col         | Yes            | Yes          |         | Executes action and closes                        |
| Export table as CSV             | Yes            | Yes          |         | Exports and closes                                |
| Sort ascending/descending       | Yes            | Yes          |         | Sorts and closes                                  |
| Delete table                    | Yes            | Yes          |         | Deletes table and closes                          |
| **View ▾**                      | Opens menu     | Yes          |         | Opens view dropdown                               |
| Toggle outline pane             | Yes            | Yes          |         | Toggles outline and closes                        |
| Open source view                | Yes            | Yes          |         | Opens source view and closes                      |
| Copy selection as Markdown      | Yes            | Yes          |         | Copies and closes                                 |
| Configuration                   | Yes            | Yes          |         | Opens settings and closes                         |
| Zoom widget (−/+)               | No             | Yes          |         | Stays open for repeated zoom adjustments          |
| **Export ▾**                    | Opens menu     | Yes          |         | Opens export dropdown                             |
| Export as PDF                   | Yes            | Yes          |         | Triggers export and closes                        |
| Export as Word                  | Yes            | Yes          |         | Triggers export and closes                        |
| **Overflow ⋯**                  | Opens menu     | Yes          |         | Shows overflowed toolbar items                    |

---

## 2. Editor Context Menu (Right-click — outside table)

| Menu Item                       | Close on Click | Close on Esc | Changed | Notes                                             |
| ------------------------------- | -------------- | ------------ | ------- | ------------------------------------------------- |
| Cut                             | Yes            | Yes          |         | Clipboard cut                                     |
| Copy                            | Yes            | Yes          |         | Clipboard copy                                    |
| Paste                           | Yes            | Yes          |         | Clipboard paste                                   |
| Paste without formatting        | Yes            | Yes          |         | Plain-text paste                                  |
| Delete                          | Yes            | Yes          |         | Deletes selection                                 |
| **Refine the selected text ▸** | Opens submenu  | Yes          |         | AI refine submenu                                 |
| Custom…                         | Yes            | Yes          |         | Opens custom refine input and closes              |
| Rephrase / Shorten / etc.       | Yes            | Yes          |         | Triggers AI refine and closes                     |
| Insert Emoji                    | Yes            | Yes          |         | Attempts to open OS emoji picker                  |
| Insert Link                     | Yes            | Yes          |         | Opens link dialog and closes                      |
| Clear Formatting                | Yes            | Yes          |         | Clears marks and closes                           |

---

## 3. Table Context Menu (Right-click — inside table)

| Menu Item                       | Close on Click | Close on Esc | Changed | Notes                                             |
| ------------------------------- | -------------- | ------------ | ------- | ------------------------------------------------- |
| Cut                             | Yes            | Yes          |         | Clipboard cut                                     |
| Copy                            | Yes            | Yes          |         | Clipboard copy                                    |
| Paste                           | Yes            | Yes          |         | Clipboard paste                                   |
| Delete                          | Yes            | Yes          |         | Deletes selection                                 |
| Insert row above (icon)         | Yes            | Yes          |         | Icon button row                                   |
| Insert row below (icon)         | Yes            | Yes          |         | Icon button row                                   |
| Insert column left (icon)       | Yes            | Yes          |         | Icon button row                                   |
| Insert column right (icon)      | Yes            | Yes          |         | Icon button row                                   |
| Move row up (icon)              | Yes            | Yes          |         | Icon button row                                   |
| Move row down (icon)            | Yes            | Yes          |         | Icon button row                                   |
| Move column left (icon)         | Yes            | Yes          |         | Icon button row                                   |
| Move column right (icon)        | Yes            | Yes          |         | Icon button row                                   |
| Insert Link                     | Yes            | Yes          |         | Opens link dialog and closes                      |
| Delete row (icon)               | Yes            | Yes          |         | Icon button, danger style                         |
| Delete column (icon)            | Yes            | Yes          |         | Icon button, danger style                         |
| Delete table (icon)             | Yes            | Yes          |         | Icon button, danger style                         |
| **Sort table ▸**                | Opens submenu  | Yes          |         | Sort submenu                                      |
| Sort ascending (A → Z)          | Yes            | Yes          |         | Sorts and closes                                  |
| Sort descending (Z → A)         | Yes            | Yes          |         | Sorts and closes                                  |
| Export Table as CSV             | Yes            | Yes          |         | Exports and closes                                |

---

## 4. Selection Hover Menu (Floating formatting bar — BubbleMenu)

| Menu Item                       | Close on Click | Close on Esc | Changed | Notes                                             |
| ------------------------------- | -------------- | ------------ | ------- | ------------------------------------------------- |
| Bold                            | No             | No*          |         | Toggles formatting, keeps bar open for chaining   |
| Italic                          | No             | No*          |         | Toggles formatting, keeps bar open                |
| Highlight                       | No             | No*          |         | Toggles formatting, keeps bar open                |
| Text Color — Primary            | No             | No*          |         | Toggles current color                             |
| Text Color — Caret ▾            | Opens sub-menu | Esc*         |         | Opens color swatch picker within floating bar     |
| Text Color — Swatch             | Yes (sub-menu) | Esc*         |         | Picks color, closes color picker (not whole bar)  |
| Strikethrough                   | No             | No*          |         | Toggles formatting, keeps bar open                |
| Underline                       | No             | No*          |         | Toggles formatting, keeps bar open                |
| Inline Code                     | No             | No*          |         | Toggles formatting, keeps bar open                |
| Text Style ▾ (Paragraph/H1-H3) | Opens sub-menu | Esc*         |         | Opens heading picker within floating bar          |
| Heading item                    | Yes (sub-menu) | Esc*         |         | Sets heading, closes heading picker (not bar)     |
| Link                            | No             | No*          |         | Opens link dialog (bar stays open)                |
| Clear formatting                | No             | No*          |         | Clears marks, keeps bar open                      |
| **Dismiss (×)**                 | Yes            | —            |         | Collapses selection, hides bubble menu entirely   |

> **\* Note on Esc behavior:** The floating bar is controlled by TipTap's BubbleMenu extension. It hides when the selection is collapsed or the cursor moves. Pressing Escape in the editor collapses the selection, which causes the bar to auto-hide. The bar does NOT have explicit Esc key handling — it relies on selection state.

---

## General Behaviors

| Behavior                  | Description                                                                     |
| ------------------------- | ------------------------------------------------------------------------------- |
| Click outside menu        | All dropdowns/context menus close on outside click                              |
| Esc key                   | Closes the topmost open dropdown/context menu                                   |
| Dropdown inside overflow  | Dropdown buttons inside the `⋯` overflow menu keep overflow open when clicked   |
| Floating bar visibility   | Only appears when text is actively selected (not on node selections or empty)   |

---

*Last updated: 2026-03-20*
