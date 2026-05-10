# Feature Specification: Offline Spell Check

**Folder**: `specs/042-offline-spell-check/`
**Created**: 2026-05-10
**Status**: Draft
**Input**: High-Performance Offline Spell Check — Microsoft Word-style, 100% offline, Markdown-aware, non-blocking, with user dictionary.

## User Scenarios & Testing

### User Story 1 — Misspelled words are underlined as I type (Priority: P1)

A user types normally in the editor. Words that are not in the English dictionary are underlined with a red wavy line within half a second of stopping. The underlines never appear inside code blocks, inline code, or YAML frontmatter.

**Why this priority**: This is the core visible value of the feature. Without it, nothing else matters.

**Independent Test**: Open any document, type a misspelled word such as "teh", wait 400ms. A red wavy underline appears under "teh". Type inside a fenced code block — no underlines appear.

**Acceptance Scenarios**:

1. **Given** a document is open and the spell checker is enabled, **When** the user types "teh " and pauses for 400ms, **Then** "teh" receives a red wavy underline.
2. **Given** the cursor is inside the misspelled word, **When** the user is actively typing, **Then** no underline appears for that word until the cursor leaves it.
3. **Given** a fenced code block with `npm instal`, **When** the document loads, **Then** no red underline appears inside the code block.
4. **Given** inline code `` `variabel` ``, **When** rendered, **Then** no underline appears on `variabel`.
5. **Given** a YAML frontmatter block with `titl: My Post`, **When** the document loads, **Then** no underline appears on `titl`.

---

### User Story 2 — Right-click an error to get correction suggestions (Priority: P1)

A user right-clicks a red-underlined word. The context menu shows up to 3 spelling suggestions at the top, followed by "Add to Dictionary" and "Ignore". Clicking a suggestion replaces the word and can be undone with Ctrl+Z.

**Why this priority**: Without corrections the feature is detection-only, which has no user value for fixing errors.

**Independent Test**: Type "teh", wait for underline, right-click. The context menu shows "the" as the first suggestion. Click "the". The word is replaced and Ctrl+Z restores "teh".

**Acceptance Scenarios**:

1. **Given** a word with a red underline, **When** the user right-clicks it, **Then** the context menu opens instantly (no visible delay) showing up to 3 suggestions.
2. **Given** the spell-check context menu is open, **When** the user clicks a suggestion, **Then** the word is replaced via a standard editor transaction undoable with Ctrl+Z.
3. **Given** the spell-check context menu is open, **When** the user clicks "Add to Dictionary", **Then** the underline disappears and the word is never flagged again across editor restarts.
4. **Given** the spell-check context menu is open, **When** the user clicks "Ignore", **Then** the underline disappears for the duration of the current session only.

---

### User Story 3 — Contractions and smart quotes are not false positives (Priority: P2)

The editor automatically converts straight apostrophes to curly/smart quotes. The spell checker must still correctly recognise words like "don't", "isn't", and "you're" as valid English words.

**Why this priority**: False positives on every contraction would make the feature unusable in practice.

**Independent Test**: Type "don't isn't you're" and wait 400ms. No underlines appear on any of these words.

**Acceptance Scenarios**:

1. **Given** the editor converts `'` to U+2019 (right single quotation mark), **When** the user types a valid contraction such as "don't", **Then** no red underline appears.

---

### User Story 4 — User can manually edit the personal dictionary (Priority: P3)

A user runs the command "Open User Dictionary" from the Command Palette. The personal dictionary file opens in a standard VS Code text editor tab. After saving changes, the spell checker immediately re-checks the open document using the updated word list — without restarting VS Code.

**Why this priority**: Power users need a bulk-edit path; one-word-at-a-time "Add to Dictionary" is insufficient for domain-specific glossaries.

**Independent Test**: Add the word "microservices" to the dictionary file via the command, save the file. The word "microservices" stops triggering an underline in the open document within 2 seconds.

**Acceptance Scenarios**:

1. **Given** the command `gptAiMarkdownEditor.openUserDictionary` is invoked, **When** executed, **Then** the personal dictionary file opens in a VS Code text editor tab.
2. **Given** the dictionary file is open and the user adds a new word and saves, **When** the file is saved, **Then** the active editor re-checks the document and removes underlines for the newly added word.
3. **Given** the dictionary file does not exist yet, **When** the command is invoked, **Then** an empty file is created and opened.

---

### Edge Cases

- What happens when the dictionary files cannot be fetched at startup? → The feature silently disables itself; no underlines appear and no errors are shown to the user.
- What happens on a 50,000-word document? → The initial scan runs in the background without blocking typing or scrolling.
- What if the user disables the feature in settings while a document is open? → All existing underlines are removed immediately.
- What happens if a word is split across a formatting boundary (e.g., part is bold)? → Each fragment is checked independently; known limitation, no partial-word underlines.
- What happens with URLs and wiki-links? → They are excluded from scanning; no underlines on URLs, email addresses, or `[[...]]` wiki-links.

## Requirements

### Functional Requirements

- **FR-001**: The spell checker MUST operate entirely offline with zero network calls after initial setup.
- **FR-002**: The system MUST underline misspelled words with a red wavy line within 500ms of the user stopping typing.
- **FR-003**: The system MUST NOT flag any text inside code blocks, inline code spans, or YAML frontmatter as misspelled.
- **FR-004**: The system MUST NOT flag URLs, email addresses, or `[[wiki-link]]` syntax as misspelled.
- **FR-005**: The system MUST normalise smart apostrophes (U+2018, U+2019) to ASCII `'` before spell-checking, so contractions are not false positives.
- **FR-006**: The context menu on a misspelled word MUST display up to 3 spelling suggestions instantly (pre-computed, no UI blocking).
- **FR-007**: Clicking a suggestion MUST replace the word via a standard editor transaction that is reversible with Ctrl+Z.
- **FR-008**: The user MUST be able to add a word to a persistent personal dictionary via the context menu "Add to Dictionary" action.
- **FR-009**: Words in the personal dictionary MUST never be flagged as misspelled, and this MUST survive editor restarts.
- **FR-010**: The user MUST be able to manually edit the personal dictionary via `gptAiMarkdownEditor.openUserDictionary`.
- **FR-011**: When the personal dictionary file is saved externally, the active editor MUST re-check the document automatically.
- **FR-012**: The spell checker MUST be configurable via `gptAiMarkdownEditor.spellCheck.enabled` (default: true).
- **FR-013**: Disabling the feature via settings MUST remove all active underlines immediately.
- **FR-014**: The initial full-document scan MUST run without blocking the UI thread.
- **FR-015**: Surgical re-scans MUST target only the changed paragraphs, not the whole document.

### Key Entities

- **SpellError**: A detected misspelling — its document position range, the misspelled word, and pre-computed suggestions.
- **UserDictionary**: A persistent plain-text file, one word per line, stored in VS Code global storage. Survives restarts. Editable via VS Code's built-in text editor.
- **SpellCheckPlugin**: The ProseMirror plugin that owns the DecorationSet and drives scanning debounce logic.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Misspelled words are underlined within 500ms of the user stopping typing on documents of any size.
- **SC-002**: A 50,000-word document is fully scanned in the background without any observable typing latency.
- **SC-003**: The spell-check context menu opens instantly — zero perceptible delay — because suggestions are pre-computed.
- **SC-004**: Zero red underlines ever appear inside code blocks, inline code, or YAML frontmatter.
- **SC-005**: Every contraction in standard English (don't, isn't, you're, etc.) passes without a false positive.
- **SC-006**: Added words persist across VS Code restarts and across multiple open documents.
- **SC-007**: Word replacements from the context menu are fully reversible with a single Ctrl+Z.

## Assumptions

- The initial release ships one locale only: `en-US`. The `gptAiMarkdownEditor.spellCheck.language` setting is present but only `en-US` files are bundled. A missing locale falls back to `en-US` silently.
- Words split across formatting marks (e.g., part bold, part plain) are each checked as independent fragments. This is an accepted trade-off for implementation simplicity.
- The personal dictionary file is stored at `context.globalStorageUri + '/user_dictionary.dic'`. It does not need to be in the webview's `localResourceRoots`; the extension host reads it and sends its contents to the webview via message.
- nspell (JavaScript Hunspell) is the chosen engine. It is pure JavaScript and compatible with VS Code's webview sandbox.
- `Intl.Segmenter` is available in VS Code's Electron/Chromium runtime and is the chosen word-boundary strategy.
