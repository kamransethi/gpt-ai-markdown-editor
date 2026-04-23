/**
 * Central message type constants for webview ↔ extension communication.
 *
 * Both the extension host and the webview import from this single source of truth
 * to avoid magic strings and catch typos at compile time.
 *
 * Convention: UPPER_SNAKE_CASE key → camelCase string value (matches existing wire format).
 */
export const MessageType = {
  // ── Editor lifecycle ──
  READY: 'ready',
  UPDATE: 'update',
  EDIT: 'edit',
  SAVE: 'save',
  SAVE_AND_EDIT: 'saveAndEdit',
  SAVED: 'saved',
  SELECTION_CHANGE: 'selectionChange',

  // ── Settings & theme ──
  SETTINGS_UPDATE: 'settingsUpdate',
  UPDATE_THEME_OVERRIDE: 'updateThemeOverride',
  UPDATE_SETTING: 'updateSetting',

  // ── Outline & TOC ──
  OUTLINE_UPDATED: 'outlineUpdated',
  SET_OUTLINE_VISIBLE: 'setOutlineVisible',
  NAVIGATE_TO_HEADING: 'navigateToHeading',
  TOGGLE_TOC_OUTLINE_VIEW: 'toggleTocOutlineView',

  // ── Image operations ──
  SAVE_IMAGE: 'saveImage',
  IMAGE_SAVED: 'imageSaved',
  IMAGE_ERROR: 'imageError',
  HANDLE_WORKSPACE_IMAGE: 'handleWorkspaceImage',
  INSERT_WORKSPACE_IMAGE: 'insertWorkspaceImage',
  RESOLVE_IMAGE_URI: 'resolveImageUri',
  IMAGE_URI_RESOLVED: 'imageUriResolved',
  CHECK_IMAGE_IN_WORKSPACE: 'checkImageInWorkspace',
  IMAGE_WORKSPACE_CHECK: 'imageWorkspaceCheck',
  COPY_LOCAL_IMAGE_TO_WORKSPACE: 'copyLocalImageToWorkspace',
  LOCAL_IMAGE_COPIED: 'localImageCopied',
  LOCAL_IMAGE_COPY_ERROR: 'localImageCopyError',
  RENAME_IMAGE: 'renameImage',
  IMAGE_RENAMED: 'imageRenamed',
  CHECK_IMAGE_RENAME: 'checkImageRename',
  IMAGE_RENAME_CHECK: 'imageRenameCheck',
  GET_IMAGE_REFERENCES: 'getImageReferences',
  IMAGE_REFERENCES: 'imageReferences',
  GET_IMAGE_METADATA: 'getImageMetadata',
  IMAGE_METADATA: 'imageMetadata',
  REVEAL_IMAGE_IN_OS: 'revealImageInOS',
  REVEAL_IMAGE_IN_EXPLORER: 'revealImageInExplorer',

  // ── File operations ──
  SEARCH_FILES: 'searchFiles',
  FILE_SEARCH_RESULTS: 'fileSearchResults',
  GET_FILE_HEADINGS: 'getFileHeadings',
  FILE_HEADINGS_RESULT: 'fileHeadingsResult',
  GET_MARKDOWN_FILES: 'getMarkdownFiles',
  MARKDOWN_FILES_RESULT: 'markdownFilesResult',
  GET_WORKSPACE_FILES: 'getWorkspaceFiles',
  WORKSPACE_FILES_RESULT: 'workspaceFilesResult',
  SAVE_AND_OPEN_FILE: 'saveAndOpenFile',
  BROWSE_LOCAL_FILE: 'browseLocalFile',
  LOCAL_FILE_SELECTED: 'localFileSelected',
  INSERT_FILE_LINK: 'insertFileLink',
  SAVE_FILES: 'saveFiles',
  FILES_SAVED: 'filesSaved',
  FILE_SAVE_ERROR: 'fileSaveError',
  HANDLE_FILE_LINK_DROP: 'handleFileLinkDrop',
  OPEN_FILE_AT_LOCATION: 'openFileAtLocation',
  OPEN_FILE_LINK: 'openFileLink',
  OPEN_EXTERNAL_LINK: 'openExternalLink',
  OPEN_IMAGE: 'openImage',
  OPEN_IMAGE_PICKER: 'openImagePicker',
  OPEN_DRAWIO_FILE: 'openDrawioFile',

  // ── UI commands ──
  OPEN_SOURCE_VIEW: 'openSourceView',
  OPEN_EXTENSION_SETTINGS: 'openExtensionSettings',
  OPEN_ATTACHMENTS_FOLDER: 'openAttachmentsFolder',
  SHOW_EMOJI_PICKER: 'showEmojiPicker',
  INSERT_EMOJI: 'insertEmoji',

  // ── Export ──
  EXPORT_DOCUMENT: 'exportDocument',
  EXPORT_RESULT: 'exportResult',
  EXPORT_TABLE_CSV: 'exportTableCsv',

  // ── Errors & logging ──
  SHOW_ERROR: 'showError',
  SHOW_INFO: 'showInfo',
  WEBVIEW_LOG: 'webviewLog',

  // ── AI ──
  AI_REFINE: 'aiRefine',
  AI_REFINE_RESULT: 'aiRefineResult',
  AI_EXPLAIN: 'aiExplain',
  AI_EXPLAIN_RESULT: 'aiExplainResult',
  GET_AI_PROMPTS: 'getAiPrompts',
  AI_PROMPTS: 'aiPrompts',
  IMAGE_ASK: 'imageAsk',
  IMAGE_ASK_RESULT: 'imageAskResult',

  // ── Front Matter ──
  FRONTMATTER_VALIDATE: 'frontmatterValidate',
  FRONTMATTER_VALIDATION_RESULT: 'frontmatterValidationResult',
  FRONTMATTER_ERROR: 'frontmatterError',
  FRONTMATTER_SAVE_OVERRIDE: 'frontmatterSaveOverride',

  // ── Mermaid ──
  EDIT_MERMAID_SOURCE: 'editMermaidSource',

  // ── Knowledge Graph ──
  OPEN_GRAPH_CHAT: 'openGraphChat',
} as const;

/** Union of all valid message type string values. */
export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];
