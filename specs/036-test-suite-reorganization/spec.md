# Feature Specification: Test Suite Reorganization

**Folder**: `specs/036-test-suite-reorganization/`  
**Created**: 2026-05-02
**Status**: Draft  
**PRD Domains**: `dev-tooling`  
**Input**: User description: "Validate the test suites. I need them to be more organized into groups. For example, smoke testing on each run Feature tests organized by all the custom extensions and code... There are some missing tests as well - specially those which will benefit from robot data entry and validation of the serialized markdown file... Tests such as highlihting text, and then making some of the text within bold..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Structured Test Execution (Priority: P1)

As a developer, I want the test suites organized into logical groups (smoke, integration, extensions, e2e) so that I can easily find, run, and understand tests without sifting through a massive unorganized directory.

**Why this priority**: Organization is the foundation for a maintainable test suite and prevents tests from being ignored.

**Independent Test**: Can be fully tested by verifying the directory structure and ensuring all tests pass in their new locations without breaking imports.

**Acceptance Scenarios**:

1. **Given** the current flat `src/__tests__/webview` directory, **When** tests are reorganized into domain-specific folders, **Then** all tests can be run successfully using `npm test`.
2. **Given** a new PR, **When** CI runs, **Then** `smoke` tests are isolated and easily verifiable.

---

### User Story 2 - Automated Editor E2E Tests (Priority: P1)

As a developer, I want automated E2E tests that simulate a user actively typing and interacting with the editor (e.g., creating tables, entering text, adding bullets) so that I can catch regressions in the serialized Markdown.

**Why this priority**: Validating the actual end-to-end user experience of typing and serialization is critical for an editor application.

**Independent Test**: Can be fully tested by running the new "robot data entry" tests and verifying they accurately simulate user input and assert on the final markdown output.

**Acceptance Scenarios**:

1. **Given** the editor is open, **When** the test automatically creates a 3x3 table, enters text, and adds bullet points, **Then** the serialized Markdown exactly matches the expected table and list structure.
2. **Given** an empty document, **When** the test automatically types paragraphs, blockquotes, and adds a mermaid diagram, **Then** the serialization round trip matches expectations.

---

### User Story 3 - Inline Formatting Tests (Priority: P2)

As a developer, I want tests specifically validating inline formatting actions (highlighting text and applying bold, applying bold inside bullets) so that these suspected broken features are verified and fixed.

**Why this priority**: The user has explicitly identified these as potential regressions or areas lacking coverage.

**Independent Test**: Can be fully tested by highlighting text programmatically and applying formatting commands.

**Acceptance Scenarios**:

1. **Given** a paragraph of text, **When** a subsection is highlighted and the bold command is applied, **Then** the text within the bounds is bolded without breaking the surrounding paragraph structure.
2. **Given** a bulleted list item, **When** text inside the bullet is bolded, **Then** the markdown serializes with the list and bolding intact (`* **Bold text** inside list`).

---

### User Story 4 - Search and Knowledge Graph Testing (Priority: P2)

As a developer, I want tests for search-related functionality (creating indexes, configuration changes, Ollama integration) so that I know semantic search works reliably.

**Why this priority**: Search is a major recent addition and requires robust validation to prevent regressions when configuration changes.

**Independent Test**: Can be fully tested by validating index generation and mock semantic search responses.

**Acceptance Scenarios**:

1. **Given** a workspace with mixed file types, **When** the index is created, **Then** configured file types are included.
2. **Given** a mock Ollama endpoint, **When** a search query is executed, **Then** results are successfully parsed and returned to the UI.

### Edge Cases

- What happens when a test directory is empty during reorganization?
- How does the E2E robot handle intermittent delays in editor rendering?
- How do formatting tests behave when applying bold to an entire table cell?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support grouped test execution (e.g., running only smoke tests, or only e2e tests).
- **FR-002**: System MUST include a new E2E test suite simulating typing, table creation, and list formatting.
- **FR-003**: System MUST include inline formatting tests specifically for bolding text selections and bolding inside lists.
- **FR-004**: System MUST include search validation tests for index creation and Ollama integration configuration.
- **FR-005**: Reorganization MUST NOT remove any existing test assertions.

### Key Entities 

- **Test Suite Strategy**: The structural definition of how tests are grouped.
- **Robot Data Entry Bot**: Testing utility that simulates keystrokes and DOM interactions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing tests are moved from `src/__tests__/webview` into logical subdirectories (e.g., `smoke`, `integration`, `extensions`, `e2e`) and pass successfully.
- **SC-002**: A new automated E2E workflow is added that types at least 3 different block types (tables, text, lists) and verifies the markdown.
- **SC-003**: Inline text highlighting/bolding test cases are added and reliably pass.

## Assumptions

- We will continue to use the current Jest test runner and not migrate to Playwright/Cypress for the E2E "robot" tests, utilizing DOM simulation or VS Code extension test runner capabilities instead.
- Reorganization will be done in place without rewriting the inner logic of existing tests.
