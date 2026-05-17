/**
 * ChatApp — Tolaria-inspired AI panel for the Graph Chat webview.
 *
 * Manages all state and message protocol, renders the full chat UI:
 *  - Header with model label
 *  - Scrollable message history
 *  - Source cards
 *  - Composer input
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

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

interface SourceDoc {
  path: string;
  title: string;
  snippet: string;
}

interface MessageEntry {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceDoc[];
  error?: string;
}

interface VsCodeApi {
  postMessage(msg: Record<string, unknown>): void;
}

interface Props {
  vscode: VsCodeApi;
}

export function ChatApp({ vscode }: Props): React.ReactElement {
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [modelName, setModelName] = useState('');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Request model name on mount
  useEffect(() => {
    vscode.postMessage({ type: MSG.GET_MODEL_NAME });
  }, [vscode]);

  // Handle messages from the extension host
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data as { type: string; [key: string]: unknown };
      switch (msg.type) {
        case MSG.SOURCES: {
          const sources = msg.sources as SourceDoc[];
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') {
              next[next.length - 1] = { ...last, sources };
            }
            return next;
          });
          break;
        }
        case MSG.CHUNK: {
          const fullText = msg.fullText as string;
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') {
              next[next.length - 1] = { ...last, content: fullText };
            }
            return next;
          });
          break;
        }
        case MSG.DONE: {
          const fullText = msg.fullText as string;
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') {
              next[next.length - 1] = { ...last, content: fullText };
            }
            return next;
          });
          setIsStreaming(false);
          break;
        }
        case MSG.ERROR: {
          const error = msg.error as string;
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') {
              next[next.length - 1] = { ...last, error };
            }
            return next;
          });
          setIsStreaming(false);
          break;
        }
        case MSG.MODEL_NAME:
          setModelName(msg.modelName as string);
          break;
        case MSG.THEME_UPDATE: {
          const theme = msg.theme as string;
          document.body.dataset.theme = theme === 'dark' ? 'dark' : 'light';
          break;
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: MessageEntry = { role: 'user', content: text };
    const assistantMsg: MessageEntry = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setInput('');

    vscode.postMessage({ type: MSG.SEND, text });
  }, [input, isStreaming, vscode]);

  const stopStreaming = useCallback(() => {
    vscode.postMessage({ type: MSG.STOP });
  }, [vscode]);

  function openFile(path: string) {
    vscode.postMessage({ type: MSG.OPEN_FILE, path });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Header */}
      <div className="chat-header">
        <span className="chat-header-title">Graph Chat</span>
        {modelName && <span className="chat-model-label">{modelName}</span>}
      </div>

      {/* Message History */}
      <div className="chat-messages">
        {!hasMessages && (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">💬</div>
            <div className="chat-welcome-title">Ask anything about your notes</div>
            <div className="chat-welcome-hint">
              Graph Chat searches your workspace to answer questions.
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble
            key={idx}
            message={msg}
            isLast={idx === messages.length - 1}
            isStreaming={isStreaming && idx === messages.length - 1}
            onOpenFile={openFile}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
            disabled={isStreaming}
            rows={1}
            aria-label="Chat input"
          />
          {isStreaming ? (
            <button className="chat-stop-btn" onClick={stopStreaming} title="Stop generating">
              ⏹
            </button>
          ) : (
            <button
              className="chat-send-btn"
              onClick={sendMessage}
              disabled={!input.trim()}
              title="Send message"
            >
              ↑
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── MessageBubble ──────────────────────────────────────────────────────────

interface BubbleProps {
  message: MessageEntry;
  isLast: boolean;
  isStreaming: boolean;
  onOpenFile: (path: string) => void;
}

function MessageBubble({
  message,
  isLast,
  isStreaming,
  onOpenFile,
}: BubbleProps): React.ReactElement {
  const isUser = message.role === 'user';

  return (
    <div
      className={`chat-msg ${isUser ? 'chat-msg-user' : `chat-msg-assistant${isLast && isStreaming ? ' streaming' : ''}`}`}
    >
      {message.error ? (
        <div className="chat-error">
          <strong>Error:</strong> {message.error}
        </div>
      ) : (
        <div
          className="chat-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
        />
      )}

      {message.sources && message.sources.length > 0 && (
        <div className="chat-sources">
          <div className="chat-sources-title">Sources</div>
          <div className="chat-sources-list">
            {message.sources.map(src => (
              <SourceCard key={src.path} source={src} onOpen={onOpenFile} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SourceCard ─────────────────────────────────────────────────────────────

interface SourceCardProps {
  source: SourceDoc;
  onOpen: (path: string) => void;
}

function SourceCard({ source, onOpen }: SourceCardProps): React.ReactElement {
  return (
    <button className="chat-source-item" onClick={() => onOpen(source.path)} title={source.path}>
      <div className="chat-source-title">{source.title || source.path.split('/').pop()}</div>
      {source.snippet && <div className="chat-source-snippet">{source.snippet}</div>}
    </button>
  );
}

// ── Minimal markdown renderer ──────────────────────────────────────────────

function renderMarkdown(text: string): string {
  if (!text) return '';
  // Simple inline rendering — the existing chatWebview.ts used a similar approach.
  // Full marked rendering is loaded by the extension host before content arrives.
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}
