# Knowledge Graph

## Overview

The knowledge graph domain describes Flux Flow’s semantic workspace search and graph capabilities. It covers how markdown content is indexed, how semantic search is performed, and how graph and chat flows use that metadata to help users find and reuse information.

## User Scenarios

1. **Workspace indexing**: Given a markdown workspace, when semantic indexing runs, then document content is analyzed and stored for retrieval.
2. **Semantic search**: Given a user query, when the search engine executes, then it returns relevant markdown content using both semantic and lexical matches.
3. **Knowledge graph chat**: Given a user engaging with the graph experience, when they ask a question, then the system uses indexed content to provide contextual answers.
4. **Respect user settings**: Given a user chooses their graph or LLM provider config, when graph features are used, then those settings are applied consistently.

## Functional Requirements

- **KG-001**: The system MUST index workspace markdown content for improved search and graph retrieval.
- **KG-002**: The system MUST combine semantic and lexical search signals for relevant result ranking.
- **KG-003**: The system MUST support knowledge graph chat flows that reference workspace documents.
- **KG-004**: The system SHOULD respect the user’s configured LLM provider and graph settings.
- **KG-005**: The system SHOULD support workspace metadata such as links and tags in the indexed graph.

## Business Rules

- Knowledge graph results MUST be rooted in workspace content and not invent unrelated information.
- Search ranking SHALL balance semantic relevance with exact keyword matches.
- The graph feature SHALL honor user privacy and configuration settings for data storage.
- Graph chat responses SHALL cite or link back to the source document content when available.

## Out of Scope

- External knowledge bases or non-workspace document indexing.
- Full enterprise knowledge management features beyond the workspace scope.
- Provider-specific AI reasoning beyond the aggregated knowledge search experience.

## Spec History

<!-- AUTO-GENERATED: do not edit manually -->
| Spec | Summary | Date |
|------|---------|------|
| [023-knowledge-graph-phase1](../../specs/archive/023-knowledge-graph-phase1/) | Introduce workspace semantic indexing and hybrid search for Flux Flow content | — |
| [024-fluxflow-config-folder](../../specs/archive/024-fluxflow-config-folder/) | Store knowledge graph data and cache in a stable config folder | — |
| [027-graph-bug-fixes](../../specs/archive/027-graph-bug-fixes/) | Fix provider selection and search mode bugs in graph features | — |

## Pending Review

<!-- Items here need a human to update prose sections above -->
- [ ] Confirm if KG-003 should include specific behavior for result reranking and citation generation.
