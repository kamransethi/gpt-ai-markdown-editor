/**
 * Settings Panel — Webview entry point
 *
 * Renders a multi-page settings UI that reads/writes VS Code configuration
 * via messaging to the extension host.
 */

import './settingsPanel.css';

// ── Types ──

interface SettingsData {
  [key: string]: unknown;
}

interface VsCodeApi {
  postMessage(msg: Record<string, unknown>): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// ── Constants ──

const MSG = {
  GET_ALL_SETTINGS: 'settings.getAllSettings',
  ALL_SETTINGS_DATA: 'settings.allSettingsData',
  UPDATE_SETTING: 'updateSetting',
  CHECK_OLLAMA: 'settings.checkOllama',
  OLLAMA_STATUS: 'settings.ollamaStatus',
  FETCH_OLLAMA_MODELS: 'settings.fetchOllamaModels',
  OLLAMA_MODELS_RESULT: 'settings.ollamaModelsResult',
  BROWSE_PATH: 'settings.browsePath',
  BROWSE_PATH_RESULT: 'settings.browsePathResult',
  OPEN_FILE: 'settings.openFile',
  CHECK_COPILOT_MODELS: 'settings.checkCopilotModels',
  COPILOT_MODELS_RESULT: 'settings.copilotModelsResult',
  GRAPH_GET_STATS: 'graph.getStats',
  GRAPH_STATS_RESULT: 'graph.statsResult',
  GRAPH_REBUILD: 'graph.rebuild',
  GRAPH_REBUILD_RESULT: 'graph.rebuildResult',
  THEME_UPDATE: 'theme.update',
} as const;

// ── State ──

const vscode = acquireVsCodeApi();
let currentPage = 'editor';
let settings: SettingsData = {};

// ── Page definitions ──

interface SettingDef {
  key: string;
  label: string;
  description: string;
  type: 'select' | 'toggle' | 'text' | 'number' | 'slider' | 'path' | 'checkable-text';
  options?: { value: string; label: string }[];
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  pathType?: 'file' | 'folder';
  filters?: Record<string, string[]>;
  conditionalOn?: { key: string; value: unknown };
  hideBrowse?: boolean;
  /** Actual default path used by Open button when input is empty (not shown as placeholder text) */
  defaultPath?: string;
}

interface SettingGroup {
  title: string;
  items: SettingDef[];
}

interface PageDef {
  id: string;
  label: string;
  icon: string;
  title: string;
  description: string;
  groups: SettingGroup[];
}

const pages: PageDef[] = [
  {
    id: 'editor',
    label: 'Editor',
    icon: '✏️',
    title: 'Editor',
    description: 'Appearance, layout, and editor behavior.',
    groups: [
      {
        title: 'Appearance',
        items: [
          {
            key: 'themeOverride',
            label: 'Theme',
            description: 'Editor color theme, independent of VS Code theme.',
            type: 'select',
            options: [
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ],
            default: 'light',
          },
          {
            key: 'editorZoomLevel',
            label: 'Zoom Level',
            description: 'Scale the editor content (0.7× to 1.5×).',
            type: 'slider',
            min: 0.7,
            max: 1.5,
            step: 0.05,
            default: 1,
          },
          {
            key: 'editorWidth',
            label: 'Content Width',
            description: 'Maximum content width in pixels.',
            type: 'slider',
            min: 800,
            max: 2560,
            step: 40,
            default: 1920,
          },
          {
            key: 'showSelectionToolbar',
            label: 'Selection Toolbar',
            description: 'Show a floating formatting toolbar when text is selected (beta).',
            type: 'toggle',
            default: false,
          },
        ],
      },
      {
        title: 'Behavior',
        items: [
          {
            key: 'defaultMarkdownViewer',
            label: 'Default Viewer',
            description: 'Which editor opens .md files by default.',
            type: 'select',
            options: [
              { value: 'dk-ai', label: 'Flux Flow' },
              { value: 'vscode', label: 'VS Code Default' },
            ],
            default: 'dk-ai',
          },
          {
            key: 'tocMaxDepth',
            label: 'Table of Contents Depth',
            description: 'Maximum heading level shown in the outline (1–6).',
            type: 'slider',
            min: 1,
            max: 6,
            step: 1,
            default: 3,
          },
          {
            key: 'preserveHtmlComments',
            label: 'Preserve HTML Comments',
            description: 'Keep HTML comments intact during editing and save.',
            type: 'toggle',
            default: true,
          },
          {
            key: 'developerMode',
            label: 'Developer Mode',
            description: 'Show detailed runtime errors and diagnostic logging.',
            type: 'toggle',
            default: true,
          },
        ],
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    icon: '🤖',
    title: 'AI & Language Models',
    description: 'Configure AI text refinement, explanation, and image analysis.',
    groups: [
      {
        title: 'GitHub Copilot',
        items: [
          {
            key: 'aiModel',
            label: 'GitHub Copilot',
            description: 'Language model for AI features. All models are free with GitHub Copilot.',
            type: 'checkable-text',
            placeholder: 'gpt-4.1',
            default: 'gpt-4.1',
          },
        ],
      },
      {
        title: 'Local AI',
        items: [
          {
            key: 'ollamaEndpoint',
            label: 'Server URL',
            description: 'Base URL of your local AI server.',
            type: 'text',
            placeholder: 'http://localhost:11434',
            default: 'http://localhost:11434',
          },
          {
            key: 'ollamaModel',
            label: 'Text Model',
            description: 'Model for text refinement and explanation.',
            type: 'select',
            options: [],
            placeholder: 'llama3.2:latest',
            default: 'llama3.2:latest',
          },
          {
            key: 'ollamaImageModel',
            label: 'Vision Model',
            description:
              'Model for image analysis. Must be vision-capable (e.g. llava, moondream).',
            type: 'select',
            options: [],
            placeholder: 'llama3.2-vision:latest',
            default: 'llama3.2-vision:latest',
          },
          {
            key: 'knowledgeGraph.embeddingModel',
            label: 'Embedding Model',
            description:
              'Model used for vector embeddings. Must be installed on your local AI server.',
            type: 'select',
            options: [
              { value: 'Disabled', label: 'Disabled' },
              { value: 'nomic-embed-text', label: 'nomic-embed-text' },
            ],
            placeholder: 'nomic-embed-text',
            default: 'nomic-embed-text',
          },
        ],
      },
      {
        title: 'LLM Provider',
        items: [
          {
            key: 'llmProvider',
            label: 'Text',
            description: 'Backend for AI text refinement and document explanation.',
            type: 'select',
            options: [
              { value: 'GitHub Copilot', label: 'GitHub Copilot' },
              { value: 'Ollama', label: 'Local AI' },
            ],
            default: 'GitHub Copilot',
          },
          {
            key: 'llmVisionProvider',
            label: 'Vision',
            description: 'Backend for image analysis and multimodal features.',
            type: 'select',
            options: [
              { value: 'Disabled', label: 'Disabled' },
              { value: 'Ollama', label: 'Local AI' },
            ],
            default: 'Ollama',
          },
        ],
      },
      {
        title: 'Custom Prompts',
        items: [
          {
            key: 'customPromptsFile',
            label: 'Custom AI Prompts File',
            description:
              'Optional path to a JSON file containing custom "Ask AI" and "AI Summary" dropdown prompts.',
            type: 'path',
            placeholder: 'Select a JSON file...',
            default: '',
            pathType: 'file',
            filters: { 'JSON Files': ['json'] },
          },
        ],
      },
    ],
  },
  {
    id: 'media',
    label: 'Media',
    icon: '🖼️',
    title: 'Media & Attachments',
    description: 'Where images and files are stored when pasted or dropped.',
    groups: [
      {
        title: 'Image Storage',
        items: [
          {
            key: 'mediaPathBase',
            label: 'Storage Location',
            description: 'Base directory strategy for saved media files.',
            type: 'select',
            options: [
              { value: 'sameNameFolder', label: 'Same-name folder (doc-name/)' },
              { value: 'relativeToDocument', label: 'Relative to document' },
              { value: 'workspaceFolder', label: 'Workspace root' },
            ],
            default: 'sameNameFolder',
          },
          {
            key: 'mediaPath',
            label: 'Subfolder Name',
            description:
              'Subfolder for media files. Only used with "Relative to document" or "Workspace root".',
            type: 'text',
            placeholder: 'media',
            default: 'media',
          },
          {
            key: 'imageResize.skipWarning',
            label: 'Skip Resize Warning',
            description: "Don't show warning dialog when resizing images.",
            type: 'toggle',
            default: false,
          },
        ],
      },
    ],
  },
  {
    id: 'export',
    label: 'Export',
    icon: '📤',
    title: 'Export',
    description: 'PDF and DOCX export tool paths.',
    groups: [
      {
        title: 'PDF Export',
        items: [
          {
            key: 'chromePath',
            label: 'Chrome / Chromium Path',
            description:
              'Path to Chrome or Chromium for PDF rendering. Leave empty to auto-detect.',
            type: 'path',
            placeholder: 'Auto-detect',
            default: '',
            pathType: 'file',
          },
        ],
      },
      {
        title: 'DOCX Export',
        items: [
          {
            key: 'pandocPath',
            label: 'Pandoc Path',
            description: 'Path to the Pandoc binary. Leave empty to auto-detect.',
            type: 'path',
            placeholder: 'Auto-detect',
            default: '',
            pathType: 'file',
          },
          {
            key: 'pandocTemplatePath',
            label: 'Pandoc Template',
            description: 'Optional .docx/.dotx template for DOCX export styling.',
            type: 'path',
            placeholder: 'None',
            default: '',
            pathType: 'file',
            filters: { 'Word Templates': ['docx', 'dotx'] },
          },
        ],
      },
    ],
  },
  {
    id: 'graph',
    label: 'Graph (beta)',
    icon: '🕸️',
    title: 'Knowledge Graph',
    description:
      'Hybrid search (FTS + semantic), backlinks, and AI chat. Semantic search requires a local AI server with an embedding model.',
    groups: [
      {
        title: 'Feature',
        items: [
          {
            key: 'knowledgeGraph.enabled',
            label: 'Enable Knowledge Graph',
            description:
              'Index your markdown workspace for hybrid search, backlinks, and AI chat. Reload window after changing.',
            type: 'toggle',
            default: false,
          },
        ],
      },
      {
        title: 'Storage',
        items: [
          {
            key: 'knowledgeGraph.dataDir',
            label: 'Data Directory',
            description:
              'Where the graph database and vector store are persisted. Defaults to ~/.fluxflow. Supports ~ expansion.',
            type: 'path',
            placeholder: '~/.fluxflow',
            defaultPath: '~/.fluxflow',
            default: '',
            pathType: 'folder',
            hideBrowse: true,
            conditionalOn: { key: 'knowledgeGraph.enabled', value: true },
          },
        ],
      },
      {
        title: 'RAG — Retrieval',
        items: [
          {
            key: 'knowledgeGraph.rag.topK',
            label: 'Max Documents Retrieved',
            description:
              'How many documents the hybrid search returns as candidates. Higher = more context, but slower and may dilute relevance.',
            type: 'slider',
            min: 1,
            max: 30,
            step: 1,
            default: 8,
            conditionalOn: { key: 'knowledgeGraph.enabled', value: true },
          },
          {
            key: 'knowledgeGraph.rag.charsPerDoc',
            label: 'Characters Per Document',
            description:
              'Max characters extracted from each document section. Higher = richer context, uses more of the LLM context window.',
            type: 'slider',
            min: 200,
            max: 6000,
            step: 250,
            default: 2500,
            conditionalOn: { key: 'knowledgeGraph.enabled', value: true },
          },
          {
            key: 'knowledgeGraph.rag.ftsSnippetTokens',
            label: 'FTS Snippet Tokens',
            description:
              'Number of tokens in the FTS preview snippet used for relevance scoring. Affects search result quality.',
            type: 'slider',
            min: 10,
            max: 64,
            step: 2,
            default: 40,
            conditionalOn: { key: 'knowledgeGraph.enabled', value: true },
          },
        ],
      },
      {
        title: 'RAG — Chat',
        items: [
          {
            key: 'knowledgeGraph.rag.historyTurns',
            label: 'History Turns',
            description:
              'How many past conversation exchanges (user + assistant pairs) to include in the LLM prompt.',
            type: 'slider',
            min: 0,
            max: 10,
            step: 1,
            default: 4,
            conditionalOn: { key: 'knowledgeGraph.enabled', value: true },
          },
        ],
      },
    ],
  },
];

// ── Render ──

function render(): void {
  const root = document.getElementById('settings-root')!;
  root.innerHTML = '';
  root.className = 'settings-root';

  // Sidebar
  const sidebar = el('div', 'settings-sidebar');
  sidebar.appendChild(elText('div', 'Settings', 'settings-sidebar-title'));

  for (const page of pages) {
    const nav = el('div', `settings-nav-item${page.id === currentPage ? ' active' : ''}`);
    nav.dataset.page = page.id;
    nav.appendChild(elText('span', page.icon, 'settings-nav-icon'));
    nav.appendChild(elText('span', page.label));
    nav.addEventListener('click', () => switchPage(page.id));
    sidebar.appendChild(nav);
  }

  // Status button in sidebar (under AI nav)
  root.appendChild(sidebar);

  // Content
  const content = el('div', 'settings-content');
  for (const page of pages) {
    content.appendChild(renderPage(page));
  }
  root.appendChild(content);
}

function renderPage(page: PageDef): HTMLElement {
  const container = el('div', `settings-page${page.id === currentPage ? ' active' : ''}`);
  container.id = `page-${page.id}`;

  container.appendChild(elText('h1', page.title, 'settings-page-title'));
  container.appendChild(elText('p', page.description, 'settings-page-description'));

  for (const group of page.groups) {
    container.appendChild(renderGroup(group, page.id));
  }

  // Local AI connectivity check on AI page
  if (page.id === 'ai') {
    container.appendChild(renderLocalAiCheck());
  }

  // Graph actions and stats on graph page
  if (page.id === 'graph') {
    container.appendChild(renderGraphActions());
  }

  return container;
}

function renderGroup(group: SettingGroup, _pageId: string): HTMLElement {
  const section = el('div', 'settings-group');
  section.appendChild(elText('div', group.title, 'settings-group-title'));

  for (const item of group.items) {
    section.appendChild(renderSettingRow(item));
  }
  return section;
}

function renderSettingRow(def: SettingDef): HTMLElement {
  const row = el('div', 'settings-row');

  // Conditional visibility
  if (def.conditionalOn) {
    const depValue = settings[def.conditionalOn.key];
    if (depValue !== def.conditionalOn.value) {
      row.classList.add('settings-conditional', 'hidden');
    } else {
      row.classList.add('settings-conditional');
    }
    row.dataset.conditionalKey = def.conditionalOn.key;
    row.dataset.conditionalValue = String(def.conditionalOn.value);
  }

  // Label
  const labelWrap = el('div', 'settings-row-label');
  labelWrap.appendChild(elText('div', def.label, 'label-text'));
  labelWrap.appendChild(elText('div', def.description, 'label-description'));
  row.appendChild(labelWrap);

  // Control
  const controlWrap = el('div', 'settings-row-control');
  const currentValue = settings[def.key] ?? def.default;

  switch (def.type) {
    case 'select':
      controlWrap.appendChild(renderSelect(def, currentValue as string));
      break;
    case 'toggle':
      controlWrap.appendChild(renderToggle(def, currentValue as boolean));
      break;
    case 'text':
      controlWrap.appendChild(renderTextInput(def, currentValue as string));
      break;
    case 'number':
      controlWrap.appendChild(renderNumberInput(def, currentValue as number));
      break;
    case 'slider':
      controlWrap.appendChild(renderSlider(def, currentValue as number));
      break;
    case 'path':
      controlWrap.appendChild(renderPathInput(def, currentValue as string));
      break;
    case 'checkable-text':
      controlWrap.appendChild(renderCheckableTextInput(def, currentValue as string));
      break;
  }

  // Add refresh button next to Server URL or Embedding Model
  if (def.key === 'ollamaEndpoint') {
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'settings-btn';
    refreshBtn.textContent = 'Refresh Models';
    refreshBtn.style.marginLeft = '8px';
    refreshBtn.addEventListener('click', () => {
      refreshBtn.textContent = 'Loading…';
      refreshBtn.disabled = true;
      vscode.postMessage({ type: MSG.CHECK_OLLAMA });
      vscode.postMessage({ type: MSG.FETCH_OLLAMA_MODELS });
      // Re-enable after 3s as fallback
      setTimeout(() => {
        refreshBtn.textContent = 'Refresh Models';
        refreshBtn.disabled = false;
      }, 3000);
    });
    controlWrap.appendChild(refreshBtn);
  }

  row.appendChild(controlWrap);
  return row;
}

function renderSelect(def: SettingDef, value: string): HTMLElement {
  const select = document.createElement('select');
  select.className = 'settings-select';
  select.dataset.settingKey = def.key;

  const staticOptions = def.options || [];
  if (staticOptions.length > 0) {
    // Static options (e.g. LLM Provider)
    for (const opt of staticOptions) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === value) option.selected = true;
      select.appendChild(option);
    }
  } else if (value) {
    // Dynamic select with no options yet — show current value
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    updateSetting(def.key, select.value);
  });
  return select;
}

function renderToggle(def: SettingDef, value: boolean): HTMLElement {
  const label = document.createElement('label');
  label.className = 'settings-toggle';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!value;
  input.addEventListener('change', () => {
    updateSetting(def.key, input.checked);
  });
  const track = el('span', 'toggle-track');
  const thumb = el('span', 'toggle-thumb');
  label.appendChild(input);
  label.appendChild(track);
  label.appendChild(thumb);
  return label;
}

function renderTextInput(def: SettingDef, value: string): HTMLElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'settings-input';
  input.value = value || '';
  input.placeholder = def.placeholder || '';
  let debounceTimer: ReturnType<typeof setTimeout>;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateSetting(def.key, input.value);
    }, 400);
  });
  return input;
}

function renderNumberInput(def: SettingDef, value: number): HTMLElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'settings-input';
  input.value = String(value ?? def.default ?? 0);
  if (def.min !== undefined) input.min = String(def.min);
  if (def.max !== undefined) input.max = String(def.max);
  if (def.step !== undefined) input.step = String(def.step);
  input.addEventListener('change', () => {
    updateSetting(def.key, parseFloat(input.value));
  });
  return input;
}

function renderSlider(def: SettingDef, value: number): HTMLElement {
  const wrap = el('div', 'settings-slider-wrap');
  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'settings-slider';
  input.min = String(def.min ?? 0);
  input.max = String(def.max ?? 100);
  input.step = String(def.step ?? 1);
  input.value = String(value ?? def.default ?? 0);

  const valueLabel = elText('span', formatSliderValue(def, value), 'settings-slider-value');

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    valueLabel.textContent = formatSliderValue(def, v);
  });
  input.addEventListener('change', () => {
    updateSetting(def.key, parseFloat(input.value));
  });

  wrap.appendChild(input);
  wrap.appendChild(valueLabel);
  return wrap;
}

function formatSliderValue(def: SettingDef, value: number): string {
  if (def.key === 'editorZoomLevel') return `${Math.round(value * 100)}%`;
  if (def.key === 'editorWidth') return `${value}px`;
  if (def.key === 'tocMaxDepth') return `H${value}`;
  return String(value);
}

function renderPathInput(def: SettingDef, value: string): HTMLElement {
  const group = el('div', 'settings-input-group');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'settings-input';
  input.value = value || '';
  input.placeholder = def.placeholder || '';

  let debounceTimer: ReturnType<typeof setTimeout>;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateSetting(def.key, input.value);
    }, 400);
  });

  if (!def.hideBrowse) {
    const browseBtn = document.createElement('button');
    browseBtn.className = 'settings-btn';
    browseBtn.textContent = 'Browse…';
    browseBtn.addEventListener('click', () => {
      pendingBrowseKey = def.key;
      pendingBrowseInput = input;
      vscode.postMessage({
        type: MSG.BROWSE_PATH,
        settingKey: def.key,
        pathType: def.pathType || 'file',
        filters: def.filters,
      });
    });
    group.appendChild(browseBtn);
  }

  const openBtn = document.createElement('button');
  openBtn.className = 'settings-btn';
  openBtn.textContent = 'Open';
  // For folder paths, always enable (fall back to placeholder default when empty)
  const isFolder = def.pathType === 'folder';
  openBtn.disabled = !isFolder && !input.value;
  openBtn.addEventListener('click', () => {
    const filePath = input.value || def.defaultPath || '';
    if (!filePath) return;
    vscode.postMessage({
      type: MSG.OPEN_FILE,
      filePath,
      pathType: def.pathType || 'file',
    });
  });

  // Enable/disable Open button based on input value (files only)
  if (!isFolder) {
    input.addEventListener('input', () => {
      openBtn.disabled = !input.value;
    });
  }

  group.appendChild(input);
  group.appendChild(openBtn);
  return group;
}

function renderCheckableTextInput(def: SettingDef, value: string): HTMLElement {
  const group = el('div', 'settings-input-group');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'settings-input';
  input.value = value || '';
  input.placeholder = def.placeholder || '';

  let debounceTimer: ReturnType<typeof setTimeout>;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateSetting(def.key, input.value);
    }, 400);
  });

  const checkBtn = document.createElement('button');
  checkBtn.className = 'settings-btn';
  checkBtn.textContent = 'Check';
  checkBtn.addEventListener('click', () => {
    pendingCheckButton = checkBtn;
    const originalText = checkBtn.textContent;
    checkBtn.textContent = 'Checking…';
    checkBtn.disabled = true;
    vscode.postMessage({
      type: MSG.CHECK_COPILOT_MODELS,
      currentModel: input.value,
    });
    // Restore button after timeout (in case we don't get a response)
    setTimeout(() => {
      if (checkBtn === pendingCheckButton) {
        checkBtn.textContent = originalText;
        checkBtn.disabled = false;
      }
    }, 5000);
  });

  group.appendChild(input);
  group.appendChild(checkBtn);
  return group;
}

let pendingBrowseKey: string | null = null;
let pendingBrowseInput: HTMLInputElement | null = null;
let pendingCheckButton: HTMLButtonElement | null = null;

// ── Graph actions & stats ──

function renderGraphActions(): HTMLElement {
  const wrap = el('div', 'settings-group');

  // Conditional visibility for actions
  const isEnabled = !!settings['knowledgeGraph.enabled'];
  if (!isEnabled) {
    wrap.classList.add('settings-conditional', 'hidden');
  } else {
    wrap.classList.add('settings-conditional');
  }
  wrap.dataset.conditionalKey = 'knowledgeGraph.enabled';
  wrap.dataset.conditionalValue = 'true';

  wrap.appendChild(elText('div', 'Index Actions', 'settings-group-title'));

  // ── Search Mode / Status ──
  const statusRow = el('div', 'settings-row');
  const statusLabel = el('div', 'settings-row-label');
  statusLabel.appendChild(elText('div', 'Search Mode', 'label-text'));

  const embeddingModel = settings['knowledgeGraph.embeddingModel'];
  const isSemantic = embeddingModel && embeddingModel !== 'Disabled';

  statusLabel.appendChild(
    elText(
      'div',
      isSemantic
        ? 'Hybrid Mode: Lexical + Semantic search enabled.'
        : 'Lexical Only: Semantic search is disabled.',
      'label-description'
    )
  );
  statusRow.appendChild(statusLabel);

  const statusControl = el('div', 'settings-row-control');
  const modeBadge = el('span', `graph-phase-badge ${isSemantic ? 'phase-ready' : 'phase-idle'}`);
  modeBadge.textContent = isSemantic ? 'Hybrid' : 'Lexical Only';
  statusControl.appendChild(modeBadge);
  statusRow.appendChild(statusControl);
  wrap.appendChild(statusRow);

  // ── Stats row ──
  const statsRow = el('div', 'settings-row');
  const statsLabel = el('div', 'settings-row-label');
  const statsLabelTitle = el('div', 'label-text');
  statsLabelTitle.style.display = 'flex';
  statsLabelTitle.style.alignItems = 'center';
  statsLabelTitle.appendChild(document.createTextNode('Index Stats'));
  const phaseBadge = el('span', 'graph-phase-badge phase-idle');
  phaseBadge.id = 'graph-phase-badge';
  phaseBadge.textContent = 'Idle';
  statsLabelTitle.appendChild(phaseBadge);
  statsLabel.appendChild(statsLabelTitle);
  statsLabel.appendChild(
    elText('div', 'Monitor indexing and vectorization progress.', 'label-description')
  );
  statsRow.appendChild(statsLabel);

  const statsControl = el('div', 'settings-row-control');
  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'settings-btn';
  refreshBtn.textContent = 'Refresh';
  refreshBtn.addEventListener('click', () => {
    refreshBtn.textContent = 'Loading…';
    refreshBtn.disabled = true;
    vscode.postMessage({ type: MSG.GRAPH_GET_STATS });
  });
  statsControl.appendChild(refreshBtn);
  statsRow.appendChild(statsControl);
  wrap.appendChild(statsRow);

  // ── Progress & Details container ──
  const detailsRow = el('div', 'settings-row');
  detailsRow.style.flexDirection = 'column';
  detailsRow.style.alignItems = 'flex-start';
  detailsRow.style.borderBottom = 'none';
  detailsRow.style.paddingTop = '0';

  const progressContainer = el('div', 'graph-progress-container');
  progressContainer.id = 'graph-progress-container';
  progressContainer.style.width = '100%';
  detailsRow.appendChild(progressContainer);

  const chipsContainer = el('div', 'graph-summary-chips');
  chipsContainer.id = 'graph-summary-chips';
  detailsRow.appendChild(chipsContainer);

  wrap.appendChild(detailsRow);

  // ── Rebuild row ──
  const rebuildRow = el('div', 'settings-row');
  const rebuildLabel = el('div', 'settings-row-label');
  rebuildLabel.appendChild(elText('div', 'Rebuild Index', 'label-text'));
  rebuildLabel.appendChild(
    elText(
      'div',
      'Re-scan all workspace .md files and update the search index.',
      'label-description'
    )
  );
  rebuildRow.appendChild(rebuildLabel);

  const rebuildControl = el('div', 'settings-row-control');
  const rebuildGroup = el('div', 'settings-input-group');

  const rebuildStatus = el('span', 'settings-status');
  rebuildStatus.id = 'graph-rebuild-status';
  rebuildStatus.style.fontSize = '12px';

  const rebuildBtn = document.createElement('button');
  rebuildBtn.className = 'settings-btn';
  rebuildBtn.textContent = 'Rebuild Index';
  rebuildBtn.addEventListener('click', () => {
    rebuildBtn.textContent = 'Rebuilding…';
    rebuildBtn.disabled = true;
    rebuildStatus.textContent = '';
    vscode.postMessage({ type: MSG.GRAPH_REBUILD });
  });

  rebuildGroup.appendChild(rebuildStatus);
  rebuildGroup.appendChild(rebuildBtn);
  rebuildControl.appendChild(rebuildGroup);
  rebuildRow.appendChild(rebuildControl);
  wrap.appendChild(rebuildRow);

  // Request stats on initial render
  setTimeout(() => vscode.postMessage({ type: MSG.GRAPH_GET_STATS }), 100);

  return wrap;
}

// ── Local AI connectivity check ──

function renderLocalAiCheck(): HTMLElement {
  const wrap = el('div', 'settings-group');
  wrap.appendChild(elText('div', 'Connectivity', 'settings-group-title'));

  // Server status row
  const row = el('div', 'settings-row');
  const labelWrap = el('div', 'settings-row-label');
  labelWrap.appendChild(elText('div', 'Server Status', 'label-text'));
  labelWrap.appendChild(
    elText(
      'div',
      'Check if your local AI server is reachable and refresh available models.',
      'label-description'
    )
  );
  row.appendChild(labelWrap);

  const controlWrap = el('div', 'settings-row-control');
  const statusGroup = el('div', 'settings-input-group');

  const statusBadge = el('span', 'settings-status');
  statusBadge.id = 'ollama-status';
  statusBadge.textContent = '—';

  const checkBtn = document.createElement('button');
  checkBtn.className = 'settings-btn';
  checkBtn.textContent = 'Check & Refresh Models';
  checkBtn.addEventListener('click', () => {
    const badge = document.getElementById('ollama-status')!;
    badge.className = 'settings-status checking';
    badge.innerHTML = '<span class="settings-status-dot"></span> Checking…';
    vscode.postMessage({ type: MSG.CHECK_OLLAMA });
    vscode.postMessage({ type: MSG.FETCH_OLLAMA_MODELS });
  });

  statusGroup.appendChild(statusBadge);
  statusGroup.appendChild(checkBtn);
  controlWrap.appendChild(statusGroup);
  row.appendChild(controlWrap);
  wrap.appendChild(row);

  return wrap;
}

// ── Navigation ──

function switchPage(pageId: string): void {
  currentPage = pageId;
  // Update nav
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.classList.toggle('active', (item as HTMLElement).dataset.page === pageId);
  });
  // Update pages
  document.querySelectorAll('.settings-page').forEach(page => {
    page.classList.toggle('active', page.id === `page-${pageId}`);
  });
}

// ── Messaging ──

function updateSetting(key: string, value: unknown): void {
  settings[key] = value;
  vscode.postMessage({ type: MSG.UPDATE_SETTING, key, value });

  // Update conditional visibility
  updateConditionalRows(key);
}

function updateConditionalRows(changedKey: string): void {
  document.querySelectorAll<HTMLElement>('.settings-conditional').forEach(row => {
    if (row.dataset.conditionalKey === changedKey) {
      const shouldShow = String(settings[changedKey]) === row.dataset.conditionalValue;
      row.classList.toggle('hidden', !shouldShow);
    }
  });
}

function handleMessage(event: MessageEvent): void {
  const msg = event.data;
  switch (msg.type) {
    case MSG.ALL_SETTINGS_DATA:
      settings = msg.settings || {};
      render();
      break;

    case MSG.OLLAMA_STATUS: {
      const badge = document.getElementById('ollama-status');
      if (!badge) break;
      if (msg.available) {
        badge.className = 'settings-status online';
        badge.innerHTML = '<span class="settings-status-dot"></span> Connected';
      } else {
        badge.className = 'settings-status offline';
        badge.innerHTML = '<span class="settings-status-dot"></span> Unreachable';
      }
      break;
    }

    case MSG.OLLAMA_MODELS_RESULT: {
      if (msg.error) break;
      const models = msg.models as string[];
      // Update all dynamic model selects (ollamaModel, ollamaImageModel)
      const modelKeys = ['ollamaModel', 'ollamaImageModel', 'knowledgeGraph.embeddingModel'];
      for (const key of modelKeys) {
        const select = document.querySelector<HTMLSelectElement>(
          `select[data-setting-key="${key}"]`
        );
        if (!select) continue;
        const currentValue = (settings[key] as string) || select.value;
        select.innerHTML = '';
        // Add fetched models as options
        for (const m of models) {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          if (m === currentValue) opt.selected = true;
          select.appendChild(opt);
        }
        // If current value not in list, add it at the top
        if (currentValue && !models.includes(currentValue)) {
          const opt = document.createElement('option');
          opt.value = currentValue;
          opt.textContent = `${currentValue} (not installed)`;
          opt.selected = true;
          select.insertBefore(opt, select.firstChild);
        }
      }
      break;
    }

    case MSG.BROWSE_PATH_RESULT:
      if (msg.settingKey && msg.path) {
        settings[msg.settingKey] = msg.path;
        // If we still have the input reference, update it directly
        if (pendingBrowseKey === msg.settingKey && pendingBrowseInput) {
          pendingBrowseInput.value = msg.path;
          pendingBrowseInput = null;
          pendingBrowseKey = null;
        } else {
          // Re-render as fallback
          render();
        }
      }
      break;

    case MSG.COPILOT_MODELS_RESULT: {
      if (pendingCheckButton) {
        const originalText = 'Check';
        pendingCheckButton.textContent = originalText;
        pendingCheckButton.disabled = false;
      }

      if (msg.available && msg.models && msg.models.length > 0) {
        const message = `✅ Found ${msg.models.length} available Copilot models: ${msg.models.join(', ')}`;
        vscode.postMessage({ type: 'showInfo', message });
      } else if (msg.error) {
        const message = `❌ Could not check Copilot models: ${msg.error}`;
        vscode.postMessage({ type: 'showError', message });
      } else {
        const message =
          '⚠️ No Copilot models available. Please check your GitHub Copilot subscription.';
        vscode.postMessage({ type: 'showError', message });
      }
      break;
    }

    case MSG.GRAPH_STATS_RESULT: {
      const phaseBadge = document.getElementById('graph-phase-badge');
      const progressContainer = document.getElementById('graph-progress-container');
      const chipsContainer = document.getElementById('graph-summary-chips');
      const refreshBtn = document.querySelector(
        '.settings-row-control .settings-btn'
      ) as HTMLButtonElement | null;

      if (refreshBtn) {
        refreshBtn.textContent = 'Refresh';
        refreshBtn.disabled = false;
      }

      if (msg.error) {
        if (progressContainer) {
          progressContainer.innerHTML = `<div class="settings-status offline">⚠️ ${msg.error}</div>`;
        }
        break;
      }

      const {
        phase,
        docCount,
        tagCount,
        dbSizeKb,
        chunkCount,
        vectorCount,
        embeddingModel,
        embeddingStatus,
        indexDone,
        indexTotal,
        embedDone,
        embedTotal,
      } = msg;

      // Update Phase Badge
      if (phaseBadge) {
        phaseBadge.className = `graph-phase-badge phase-${phase}`;
        phaseBadge.textContent = phase.charAt(0).toUpperCase() + phase.slice(1);
      }

      // Update Progress Bars
      if (progressContainer) {
        progressContainer.innerHTML = '';

        if (
          phase === 'indexing' ||
          (phase === 'idle' && indexTotal > 0 && indexDone < indexTotal)
        ) {
          progressContainer.appendChild(
            renderProgressSegment('Indexing Workspace', indexDone, indexTotal, 'files')
          );
        }

        if (
          phase === 'embedding' ||
          (phase === 'ready' && embedTotal > 0 && embedDone < embedTotal)
        ) {
          progressContainer.appendChild(
            renderProgressSegment('Vectorizing Chunks', embedDone, embedTotal, 'chunks')
          );
        }

        // Show "Initialising" if phase is idle and counts are zero
        if (phase === 'idle' && docCount === 0 && indexTotal === 0) {
          const initMsg = el('div', 'settings-status checking');
          initMsg.textContent = '⏳ Initialising Knowledge Graph...';
          progressContainer.appendChild(initMsg);
        }
      }

      // Update Summary Chips
      if (chipsContainer) {
        chipsContainer.innerHTML = '';
        if (docCount > 0 || vectorCount > 0) {
          chipsContainer.appendChild(renderChip(`${docCount} Documents`));
          chipsContainer.appendChild(renderChip(`${tagCount} Tags`));
          chipsContainer.appendChild(renderChip(`${chunkCount} Chunks`));
          if (dbSizeKb > 0) chipsContainer.appendChild(renderChip(`${dbSizeKb} KB`));

          if (embeddingStatus === 'ready' && embeddingModel) {
            chipsContainer.appendChild(renderChip(`🔍 ${vectorCount} Vectors (${embeddingModel})`));
          } else if (embeddingStatus === 'model-missing') {
            chipsContainer.appendChild(renderChip(`⚠️ Model missing: ${embeddingModel}`));
          } else if (embeddingStatus === 'server-unavailable') {
            chipsContainer.appendChild(renderChip(`⚠️ AI Server unreachable`));
          }
        }
      }

      // Auto-poll if not ready (fallback to push channel)
      if (phase !== 'ready' && phase !== 'idle') {
        setTimeout(() => vscode.postMessage({ type: MSG.GRAPH_GET_STATS }), 3000);
      } else if (phase === 'idle' && docCount === 0) {
        // Still initialising database
        setTimeout(() => vscode.postMessage({ type: MSG.GRAPH_GET_STATS }), 2000);
      }
      break;
    }

    case MSG.GRAPH_REBUILD_RESULT: {
      const rebuildBtn = document
        .getElementById('graph-rebuild-status')
        ?.parentElement?.querySelector('button') as HTMLButtonElement | null;
      const rebuildStatus = document.getElementById('graph-rebuild-status');
      if (rebuildBtn) {
        rebuildBtn.textContent = 'Rebuild Index';
        rebuildBtn.disabled = false;
      }
      if (rebuildStatus) {
        rebuildStatus.textContent = msg.error
          ? `❌ ${msg.error as string}`
          : `✅ ${msg.docCount as number} docs in ${msg.elapsedS as string}s`;
      }
      // Refresh stats after rebuild
      vscode.postMessage({ type: MSG.GRAPH_GET_STATS });
      break;
    }

    case MSG.THEME_UPDATE: {
      const theme = msg.theme as string;
      document.documentElement.setAttribute('data-theme', theme);
      break;
    }
  }
}

// ── Helpers ──

function renderProgressSegment(
  label: string,
  done: number,
  total: number,
  unit: string
): HTMLElement {
  const segment = el('div', 'graph-progress-segment');

  const meta = el('div', 'graph-progress-meta');
  meta.appendChild(elText('span', label));

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  meta.appendChild(elText('span', `${done} / ${total} ${unit} (${pct}%)`));
  segment.appendChild(meta);

  const track = el('div', 'graph-progress-track');
  const fill = el('div', 'graph-progress-fill');
  fill.style.width = `${pct}%`;
  track.appendChild(fill);
  segment.appendChild(track);

  return segment;
}

function renderChip(text: string): HTMLElement {
  return elText('div', text, 'graph-chip');
}

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function elText(tag: string, text: string, className?: string): HTMLElement {
  const e = el(tag, className);
  e.textContent = text;
  return e;
}

// ── Init ──

window.addEventListener('message', handleMessage);

document.addEventListener('DOMContentLoaded', () => {
  // Apply theme from body attribute (set by extension HTML template)
  const theme = document.body.getAttribute('data-theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);

  render();
  vscode.postMessage({ type: MSG.GET_ALL_SETTINGS });
});
