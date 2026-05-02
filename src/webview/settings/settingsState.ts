/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Settings State Model (FR-001)
 *
 * Provides a typed state interface and pure functions for managing settings
 * panel state. The settings panel reads exclusively from this object when
 * rendering — no DOM queries for state retrieval.
 */

/**
 * Typed settings state for the settings panel.
 *
 * All keys are optional: `createDefaultState()` provides safe defaults and
 * `applyConfiguration()` merges extension config on top without overwriting
 * keys that are absent from the incoming partial payload.
 */
export interface SettingsState {
  // Editor appearance
  themeOverride?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  editorWidth?: number;
  showWordCount?: boolean;
  showLineCount?: boolean;
  editorZoom?: number;

  // Editor behavior
  autoSave?: boolean;
  autoSaveDelay?: number;
  spellCheck?: boolean;
  showSelectionToolbar?: boolean;
  compressTables?: boolean;
  trimBlankLines?: boolean;

  // AI provider settings
  aiProvider?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  copilotModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  ollamaEndpoint?: string;
  ollamaModel?: string;
  ollamaImageModel?: string;
  azureOpenAiApiKey?: string;
  azureOpenAiEndpoint?: string;
  azureOpenAiDeployment?: string;

  // Media settings
  mediaPath?: string;
  mediaPathBase?: string;

  // Knowledge graph settings
  'knowledgeGraph.enabled'?: boolean;
  'knowledgeGraph.embeddingProvider'?: string;
  'knowledgeGraph.embeddingModel'?: string;

  // Allow arbitrary extension config keys not yet typed above
  [key: string]: unknown;
}

/**
 * Returns a new state object with safe defaults for every known key.
 * Used to render the panel before actual configuration is loaded (prevents
 * blank/broken UI on first render).
 */
export function createDefaultState(): SettingsState {
  return {
    themeOverride: 'auto',
    fontFamily: 'default',
    fontSize: 14,
    lineHeight: 1.5,
    editorWidth: 800,
    showWordCount: true,
    showLineCount: false,
    editorZoom: 1,
    autoSave: true,
    autoSaveDelay: 1000,
    spellCheck: true,
    showSelectionToolbar: true,
    compressTables: false,
    trimBlankLines: false,
    aiProvider: 'copilot',
    copilotModel: 'gpt-4o',
    ollamaEndpoint: 'http://localhost:11434',
    mediaPath: 'assets',
    mediaPathBase: 'relative',
    'knowledgeGraph.enabled': false,
    'knowledgeGraph.embeddingProvider': 'ollama',
  };
}

/**
 * Merges a partial configuration payload received from the extension host on
 * top of an existing state object. Keys present in `config` override their
 * counterparts in `state`; keys absent from `config` are preserved unchanged.
 *
 * Returns a new object — does not mutate `state`.
 *
 * @param state   Current settings state (may be defaults or previously applied config)
 * @param config  Partial configuration received from the extension host
 */
export function applyConfiguration(
  state: SettingsState,
  config: Record<string, unknown>
): SettingsState {
  return { ...state, ...config };
}
