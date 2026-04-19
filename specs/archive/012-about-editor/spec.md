# Feature Specification: About Editor Dialog

**Folder**: `specs/012-about-editor/`  
**Created**: April 11, 2026  
**Status**: Draft  

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Version Check (Priority: P1)

A user wants to quickly see what version of the AI Markdown Editor they're using. They click the help/about button in the toolbar and are presented with a clear, accessible dialog showing the current version and build date.

**Why this priority**: Version information is critical for troubleshooting, bug reporting, and feature requests. Users need this immediately without searching documentation.

**Independent Test**: Can be fully tested by clicking the toolbar help button and verifying the dialog displays the version number and build date in the expected format.

**Acceptance Scenarios**:

1. **Given** the editor is open, **When** user clicks the help/about button, **Then** an About Editor dialog appears with title "About"
2. **Given** the About dialog is displayed, **When** user observes content, **Then** version is shown as "2.0.30" and build date is in locale format (e.g., "Apr 11, 2026")
3. **Given** the About dialog is displayed, **When** user presses Escape, **Then** dialog closes

---

### User Story 2 - View Publisher & License (Priority: P1)

A user needs to understand the licensing and publisher of the extension. They open the About dialog and immediately see that it's published by DK-AI under the MIT license.

**Why this priority**: License and publisher information is essential for legal compliance and establishing trust.

**Independent Test**: Can be fully tested by opening the About dialog and confirming publisher name and license type are correctly displayed.

**Acceptance Scenarios**:

1. **Given** the About dialog is open, **When** user reads the content, **Then** publisher "DK-AI" is displayed
2. **Given** the About dialog is open, **When** user reads the content, **Then** license "MIT" is displayed

---

### User Story 3 - Check Dependencies (Priority: P2)

A user has encountered an issue and wants to verify that they have the correct versions of dependent libraries. They open the About dialog and see a DEPENDENCIES section listing TipTap and Mermaid versions.

**Why this priority**: Dependency information helps users troubleshoot issues specific to certain library versions and aids in bug reports.

**Independent Test**: Can be fully tested by opening the About dialog and verifying the DEPENDENCIES section displays both TipTap (3.22.3) and Mermaid (11.13.0) versions.

**Acceptance Scenarios**:

1. **Given** the About dialog is open, **When** user scrolls to DEPENDENCIES section, **Then** section title "DEPENDENCIES" is displayed in uppercase
2. **Given** the DEPENDENCIES section is displayed, **When** user reads the content, **Then** TipTap version "3.22.3" is shown
3. **Given** the DEPENDENCIES section is displayed, **When** user reads the content, **Then** Mermaid version "11.13.0" is shown

---

### User Story 4 - Access Documentation & Resources (Priority: P2)

A user wants to read the documentation or view the changelog without opening a file browser. They open the About dialog and see clickable links to Documentation, Changelog, Features, Issue Reporting, and Community Discussions.

**Why this priority**: Providing quick access to resources improves user experience and encourages engagement with documentation, reducing support burden.

**Independent Test**: Can be fully tested by opening the About dialog and verifying all five resource links are present and clickable.

**Acceptance Scenarios**:

1. **Given** the About dialog is open, **When** user looks for resource links, **Then** link to Documentation (README) is present and clickable
2. **Given** the About dialog is open, **When** user looks for resource links, **Then** link to Changelog is present and clickable
3. **Given** the About dialog is open, **When** user looks for resource links, **Then** link to Features is present and clickable
4. **Given** the About dialog is open, **When** user looks for resource links, **Then** link to "Report an Issue" is present and clickable
5. **Given** the About dialog is open, **When** user looks for resource links, **Then** link to "Community Discussions" is present and clickable

---

### Edge Cases

- What happens if the version number hasn't been updated in package.json? (System shows what's in package.json - documentation should emphasize keeping it current)
- How does the dialog behave if opened multiple times? (Each opening should display current information)
- What if a user has an older version before this feature was added? (N/A - feature is new)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: About Editor dialog MUST display when user clicks the help/about button in the toolbar
- **FR-002**: Dialog MUST display the extension version (e.g., "2.0.30") derived from package.json
- **FR-003**: Dialog MUST display the build date in locale format (MMM DD, YYYY - e.g., "Apr 11, 2026")
- **FR-004**: Dialog MUST show publisher name "DK-AI"
- **FR-005**: Dialog MUST show license type "MIT"
- **FR-006**: Dialog MUST include a DEPENDENCIES section with section title in uppercase
- **FR-007**: Dialog MUST display TipTap dependency version "3.22.3"
- **FR-008**: Dialog MUST display Mermaid dependency version "11.13.0"
- **FR-009**: Dialog MUST include clickable links to: Documentation (README), Changelog, Features, Report an Issue, and Community Discussions
- **FR-010**: Dialog MUST use sans-serif fonts (var(--md-font-sans)) throughout
- **FR-011**: Dialog MUST display section titles (ABOUT, DEPENDENCIES) in uppercase
- **FR-012**: Dialog MUST render as a styled overlay modal with semi-transparent background
- **FR-013**: Dialog MUST include a visible close button
- **FR-014**: Dialog MUST include a title bar that clearly identifies the dialog as "About"
- **FR-015**: Dialog MUST support keyboard navigation - Escape key MUST close the dialog
- **FR-016**: Dialog MUST be centered on screen or positioned consistently with other dialogs in the application

### Key Entities

- **About Dialog**: Modal overlay component that displays editor metadata and links
  - Title: identifies as "About" dialog
  - Version: string, formatted from package.json
  - Build Date: date string in locale format
  - Publisher: string "DK-AI"
  - License: string "MIT"
  - Dependencies: list of name-version pairs
  - Resource Links: list of URL references

## Success Criteria *(mandatory)*

1. **Users can access editor information** - 100% of common user queries about version/license/dependencies are answerable from the About dialog within 5 seconds
2. **Quick resource access** - Users can navigate to any of the 5 resource links within 3 clicks
3. **Professional presentation** - Dialog styling is consistent with the rest of the editor UI (uses same font family, color scheme, spacing patterns)
4. **Keyboard accessibility** - Dialog can be completely operated with keyboard (Escape to close, Tab to navigate links)
5. **Information accuracy** - All displayed information (version, dependencies) matches source files (package.json) exactly
6. **User task completion** - Users completing the task "check if extension version is compatible" succeed on first attempt without external documentation

## Design Considerations

- **Modal Styling**: Should follow existing modal/dialog patterns in the application; use semi-transparent overlay and centered positioning
- **Font Consistency**: Use `var(--md-font-sans)` to ensure visual consistency with rest of editor
- **Link Styling**: Links should be distinguishable (color, underline) and indicate interactivity
- **Content Organization**: Clear section headers (ABOUT, DEPENDENCIES) help users scan content quickly
- **Close Mechanism**: Both close button and Escape key should work for intuitive dismissal

## Assumptions

- Build date will be the date the extension is built/packaged (current date when build occurs)
- All dependency versions (TipTap 3.22.3, Mermaid 11.13.0) are current as of April 2026
- Links to resources point to GitHub repository pages or project documentation
- The extension is published in VS Code Marketplace under publisher DK-AI
- Modal implementation can reuse existing UI component patterns from the codebase
