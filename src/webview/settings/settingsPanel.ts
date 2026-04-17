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
  BROWSE_PATH: 'settings.browsePath',
  BROWSE_PATH_RESULT: 'settings.browsePathResult',
  CHECK_COPILOT_MODELS: 'settings.checkCopilotModels',
  COPILOT_MODELS_RESULT: 'settings.copilotModelsResult',
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
        title: 'Provider',
        items: [
          {
            key: 'llmProvider',
            label: 'LLM Provider',
            description: 'Backend for AI text refinement and document explanation.',
            type: 'select',
            options: [
              { value: 'GitHub Copilot', label: 'GitHub Copilot' },
              { value: 'Ollama', label: 'Ollama (local)' },
            ],
            default: 'GitHub Copilot',
          },
        ],
      },
      {
        title: 'GitHub Copilot',
        items: [
          {
            key: 'aiModel',
            label: 'Model',
            description: 'Language model for AI features. All models are free with GitHub Copilot.',
            type: 'checkable-text',
            placeholder: 'gpt-4.1',
            default: 'gpt-4.1',
            conditionalOn: { key: 'llmProvider', value: 'GitHub Copilot' },
          },
        ],
      },
      {
        title: 'Ollama',
        items: [
          {
            key: 'ollamaEndpoint',
            label: 'Server URL',
            description: 'Base URL of your Ollama server.',
            type: 'text',
            placeholder: 'http://localhost:11434',
            default: 'http://localhost:11434',
            conditionalOn: { key: 'llmProvider', value: 'Ollama' },
          },
          {
            key: 'ollamaModel',
            label: 'Text Model',
            description: 'Model for text refinement and explanation.',
            type: 'text',
            placeholder: 'llama3.2:latest',
            default: 'llama3.2:latest',
            conditionalOn: { key: 'llmProvider', value: 'Ollama' },
          },
          {
            key: 'ollamaImageModel',
            label: 'Vision Model',
            description:
              'Model for image analysis. Must be vision-capable (e.g. llava, moondream).',
            type: 'text',
            placeholder: 'llama3.2-vision:latest',
            default: 'llama3.2-vision:latest',
            conditionalOn: { key: 'llmProvider', value: 'Ollama' },
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

  // Ollama status button in sidebar (under AI nav)
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

  // Ollama connectivity check on AI page
  if (page.id === 'ai') {
    container.appendChild(renderOllamaCheck());
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

  row.appendChild(controlWrap);
  return row;
}

function renderSelect(def: SettingDef, value: string): HTMLElement {
  const select = document.createElement('select');
  select.className = 'settings-select';
  for (const opt of def.options || []) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === value) option.selected = true;
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

  group.appendChild(input);
  group.appendChild(browseBtn);
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

// ── Ollama connectivity check ──

function renderOllamaCheck(): HTMLElement {
  const wrap = el('div', 'settings-group');
  wrap.appendChild(elText('div', 'Connectivity', 'settings-group-title'));

  const row = el('div', 'settings-row');
  const labelWrap = el('div', 'settings-row-label');
  labelWrap.appendChild(elText('div', 'Ollama Server Status', 'label-text'));
  labelWrap.appendChild(
    elText('div', 'Check if your Ollama server is reachable.', 'label-description')
  );
  row.appendChild(labelWrap);

  const controlWrap = el('div', 'settings-row-control');
  const statusGroup = el('div', 'settings-input-group');

  const statusBadge = el('span', 'settings-status');
  statusBadge.id = 'ollama-status';
  statusBadge.textContent = '—';

  const checkBtn = document.createElement('button');
  checkBtn.className = 'settings-btn';
  checkBtn.textContent = 'Check';
  checkBtn.addEventListener('click', () => {
    const badge = document.getElementById('ollama-status')!;
    badge.className = 'settings-status checking';
    badge.innerHTML = '<span class="settings-status-dot"></span> Checking…';
    vscode.postMessage({ type: MSG.CHECK_OLLAMA });
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
  }
}

// ── Helpers ──

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
