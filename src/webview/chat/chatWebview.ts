/**
 * Graph Chat — Webview entry point
 *
 * Renders a chat interface for RAG queries against the knowledge graph.
 * Communicates with the extension host via postMessage.
 */

import './chatWebview.css';

// ── Types ──

interface SourceDoc {
  path: string;
  title: string;
  snippet: string;
}

interface VsCodeApi {
  postMessage(msg: Record<string, unknown>): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// ── Constants ──

const MSG = {
  SEND: 'chat.send',
  STOP: 'chat.stop',
  OPEN_FILE: 'chat.openFile',
  GET_MODEL_NAME: 'chat.getModelName',
  SOURCES: 'chat.sources',
  CHUNK: 'chat.chunk',
  DONE: 'chat.done',
  ERROR: 'chat.error',
  MODEL_NAME: 'chat.modelName',
  THEME_UPDATE: 'theme.update',
} as const;

// ── State ──

const vscode = acquireVsCodeApi();
let isStreaming = false;
let modelName = '';

interface MessageEntry {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceDoc[];
  error?: string;
}

const messages: MessageEntry[] = [];

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  const initialTheme = document.body.dataset.theme || 'light';
  setTheme(initialTheme);
  render();
  vscode.postMessage({ type: MSG.GET_MODEL_NAME });
});

window.addEventListener('message', event => {
  const msg = event.data;
  switch (msg.type) {
    case MSG.SOURCES:
      handleSources(msg.sources as SourceDoc[]);
      break;
    case MSG.CHUNK:
      handleChunk(msg.fullText as string);
      break;
    case MSG.DONE:
      handleDone(msg.fullText as string);
      break;
    case MSG.ERROR:
      handleError(msg.error as string);
      break;
    case MSG.MODEL_NAME:
      modelName = msg.modelName as string;
      updateModelLabel();
      break;
    case MSG.THEME_UPDATE:
      setTheme(msg.theme as string);
      break;
  }
});

// ── Message handlers ──

function handleSources(sources: SourceDoc[]): void {
  // Attach sources to the current assistant message
  const last = messages[messages.length - 1];
  if (last && last.role === 'assistant') {
    last.sources = sources;
    renderMessages();
  }
}

function handleChunk(fullText: string): void {
  const last = messages[messages.length - 1];
  if (last && last.role === 'assistant') {
    last.content = fullText;
    renderMessages();
    scrollToBottom();
  }
}

function handleDone(fullText: string): void {
  const last = messages[messages.length - 1];
  if (last && last.role === 'assistant') {
    last.content = fullText;
  }
  isStreaming = false;
  renderMessages();
  updateInputState();
  scrollToBottom();
}

function handleError(error: string): void {
  const last = messages[messages.length - 1];
  if (last && last.role === 'assistant') {
    last.error = error;
    last.content = last.content || '';
  }
  isStreaming = false;
  renderMessages();
  updateInputState();
  scrollToBottom();
}

// ── Actions ──

function sendMessage(): void {
  const input = document.getElementById('chat-input') as HTMLTextAreaElement;
  const query = input.value.trim();
  if (!query || isStreaming) return;

  // Add user message
  messages.push({ role: 'user', content: query });

  // Add placeholder assistant message
  messages.push({ role: 'assistant', content: '' });

  isStreaming = true;
  input.value = '';
  input.style.height = 'auto';
  renderMessages();
  updateInputState();
  scrollToBottom();

  vscode.postMessage({ type: MSG.SEND, query });
}

function stopStreaming(): void {
  vscode.postMessage({ type: MSG.STOP });
  isStreaming = false;
  updateInputState();
}

function openFile(filePath: string): void {
  vscode.postMessage({ type: MSG.OPEN_FILE, filePath });
}

// ── Rendering ──

function render(): void {
  const root = document.getElementById('chat-root')!;
  root.innerHTML = '';

  // Header
  const header = el('div', 'chat-header');
  header.appendChild(elText('span', 'Graph Chat', 'chat-header-title'));
  const modelLabel = el('span', 'chat-model-label');
  modelLabel.id = 'model-label';
  header.appendChild(modelLabel);
  root.appendChild(header);

  // Messages container
  const messagesContainer = el('div', 'chat-messages');
  messagesContainer.id = 'chat-messages';

  // Welcome message
  const welcome = el('div', 'chat-welcome');
  welcome.innerHTML = `
    <div class="chat-welcome-icon">🔍</div>
    <div class="chat-welcome-title">Knowledge Graph Chat</div>
    <div class="chat-welcome-hint">Ask questions about your workspace using natural language.</div>
    <div class="chat-welcome-examples">
      <div class="chat-example" data-query="How does the authentication system work?">How does the authentication system work?</div>
      <div class="chat-example" data-query="What modules depend on the database?">What modules depend on the database?</div>
      <div class="chat-example" data-query="tag:api explain the API endpoints">tag:api explain the API endpoints</div>
    </div>
  `;
  messagesContainer.appendChild(welcome);
  root.appendChild(messagesContainer);

  // Add click handlers for examples
  messagesContainer.querySelectorAll('.chat-example').forEach(ex => {
    ex.addEventListener('click', () => {
      const input = document.getElementById('chat-input') as HTMLTextAreaElement;
      input.value = (ex as HTMLElement).dataset.query || '';
      input.focus();
    });
  });

  // Input area
  const inputArea = el('div', 'chat-input-area');

  const inputWrap = el('div', 'chat-input-wrap');
  const textarea = document.createElement('textarea');
  textarea.id = 'chat-input';
  textarea.className = 'chat-input';
  textarea.placeholder = 'Ask about your workspace...';
  textarea.rows = 1;
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  });
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  inputWrap.appendChild(textarea);

  const btnGroup = el('div', 'chat-btn-group');

  const sendBtn = document.createElement('button');
  sendBtn.id = 'send-btn';
  sendBtn.className = 'chat-send-btn';
  sendBtn.textContent = 'Send';
  sendBtn.addEventListener('click', sendMessage);
  btnGroup.appendChild(sendBtn);

  const stopBtn = document.createElement('button');
  stopBtn.id = 'stop-btn';
  stopBtn.className = 'chat-stop-btn hidden';
  stopBtn.textContent = 'Stop';
  stopBtn.addEventListener('click', stopStreaming);
  btnGroup.appendChild(stopBtn);

  inputWrap.appendChild(btnGroup);
  inputArea.appendChild(inputWrap);

  const hint = elText(
    'div',
    'Shift+Enter for new line · Supports tag: property: in: filters',
    'chat-input-hint'
  );
  inputArea.appendChild(hint);

  root.appendChild(inputArea);
}

function renderMessages(): void {
  const container = document.getElementById('chat-messages')!;

  // Show welcome only when no messages
  const welcome = container.querySelector('.chat-welcome') as HTMLElement | null;
  if (welcome) {
    welcome.style.display = messages.length === 0 ? '' : 'none';
  }

  // Sync message elements
  const existing = container.querySelectorAll('.chat-msg');
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    let msgEl = existing[i] as HTMLElement | undefined;

    if (!msgEl) {
      msgEl = el('div', `chat-msg chat-msg-${msg.role}`);
      container.appendChild(msgEl);
    }

    renderMessageContent(msgEl, msg);
  }

  // Remove extra elements
  while (container.querySelectorAll('.chat-msg').length > messages.length) {
    const last = container.querySelector('.chat-msg:last-of-type');
    if (last) last.remove();
    else break;
  }
}

function renderMessageContent(el: HTMLElement, msg: MessageEntry): void {
  if (msg.role === 'user') {
    el.className = 'chat-msg chat-msg-user';
    el.textContent = msg.content;
    return;
  }

  // Assistant message
  el.className = `chat-msg chat-msg-assistant${isStreaming && msg === messages[messages.length - 1] ? ' streaming' : ''}`;

  let html = '';

  // Sources panel
  if (msg.sources && msg.sources.length > 0) {
    html += '<div class="chat-sources">';
    html += `<div class="chat-sources-title">📄 ${msg.sources.length} source${msg.sources.length !== 1 ? 's' : ''} found</div>`;
    html += '<div class="chat-sources-list">';
    for (const src of msg.sources) {
      const safeTitle = escHtml(src.title);
      const safePath = escHtml(src.path);
      const safeSnippet = escHtml(src.snippet);
      html += `<div class="chat-source-item" data-path="${safePath}">`;
      html += `<div class="chat-source-title">${safeTitle}</div>`;
      html += `<div class="chat-source-path">${safePath}</div>`;
      html += `<div class="chat-source-snippet">${safeSnippet}</div>`;
      html += '</div>';
    }
    html += '</div></div>';
  }

  // Content
  if (msg.content) {
    html += `<div class="chat-content">${renderMarkdown(msg.content)}</div>`;
  } else if (!msg.error) {
    html += '<div class="chat-content"><span class="chat-typing">Thinking...</span></div>';
  }

  // Error
  if (msg.error) {
    html += `<div class="chat-error">${escHtml(msg.error)}</div>`;
  }

  el.innerHTML = html;

  // Attach click handlers to source items
  el.querySelectorAll('.chat-source-item').forEach(item => {
    item.addEventListener('click', () => {
      const p = (item as HTMLElement).dataset.path;
      if (p) openFile(p);
    });
  });
}

function updateInputState(): void {
  const sendBtn = document.getElementById('send-btn');
  const stopBtn = document.getElementById('stop-btn');
  const input = document.getElementById('chat-input') as HTMLTextAreaElement | null;

  if (sendBtn) sendBtn.classList.toggle('hidden', isStreaming);
  if (stopBtn) stopBtn.classList.toggle('hidden', !isStreaming);
  if (input) {
    input.disabled = isStreaming;
    if (!isStreaming) input.focus();
  }
}

function updateModelLabel(): void {
  const label = document.getElementById('model-label');
  if (label) label.textContent = modelName;
}

function scrollToBottom(): void {
  const container = document.getElementById('chat-messages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// ── Markdown rendering (lightweight) ──

function renderMarkdown(text: string): string {
  let html = escHtml(text);

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    return `<pre><code class="lang-${escHtml(lang)}">${code}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Headings (### only within content)
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // File references like (src/foo.ts)
  html = html.replace(
    /\(([a-zA-Z0-9_./-]+\.[a-zA-Z]{1,5})\)/g,
    '(<span class="chat-file-ref" data-path="$1">$1</span>)'
  );

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = `<p>${html}</p>`;

  return html;
}

function setTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
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

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
