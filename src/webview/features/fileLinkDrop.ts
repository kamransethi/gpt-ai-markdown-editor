import type { Editor } from '@tiptap/core';
import { escapeHtml } from '../utils/fileLinks';

interface VsCodeApi {
  postMessage: (message: unknown) => void;
}

type FileLike = File & { path?: string };

function isImageFileName(fileName: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff?)$/i.test(fileName);
}

function extractPathFromDataTransfer(dt: DataTransfer): { sourcePath: string; fileName: string } | null {
  const uriList = dt.getData('text/uri-list') || dt.getData('text/plain') || '';
  const firstLine = uriList
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean);

  if (firstLine && !isImageFileName(firstLine)) {
    const normalized = firstLine.startsWith('file://')
      ? decodeURIComponent(firstLine.replace('file://', ''))
      : firstLine;
    const parts = normalized.replace(/\\/g, '/').split('/');
    return {
      sourcePath: normalized,
      fileName: parts[parts.length - 1] || 'attachment',
    };
  }

  const files = Array.from(dt.files || []) as FileLike[];
  const file = files.find(candidate => !candidate.type.startsWith('image/') && !isImageFileName(candidate.name));
  if (!file) {
    return null;
  }

  return {
    sourcePath: file.path || file.name,
    fileName: file.name,
  };
}

function insertFileLink(editor: Editor, relativePath: string, text: string, insertPosition?: number) {
  const linkHtml = `<a href="${escapeHtml(relativePath)}">${escapeHtml(text)}</a>`;
  if (typeof insertPosition === 'number') {
    editor.chain().focus().insertContentAt(insertPosition, linkHtml).run();
    return;
  }

  editor.commands.insertContent(linkHtml);
}

export function setupFileLinkDrop(editor: Editor, vscodeApi: VsCodeApi): void {
  const editorElement = document.querySelector('.ProseMirror');
  if (!editorElement) {
    return;
  }

  const handleDrop = (event: Event) => {
    const dragEvent = event as DragEvent;
    const dt = dragEvent.dataTransfer;
    if (!dt) {
      return;
    }

    const extracted = extractPathFromDataTransfer(dt);
    if (!extracted) {
      return;
    }

    dragEvent.preventDefault();
    dragEvent.stopPropagation();

    const insertPosition = editor.view.posAtCoords({
      left: dragEvent.clientX,
      top: dragEvent.clientY,
    })?.pos;
    vscodeApi.postMessage({
      type: 'handleFileLinkDrop',
      sourcePath: extracted.sourcePath,
      fileName: extracted.fileName,
      insertPosition,
    });
  };

  const messageHandler = (event: MessageEvent) => {
    const message = event.data;
    if (message.type !== 'insertFileLink') {
      return;
    }

    insertFileLink(editor, message.relativePath, message.text, message.insertPosition);
  };

  editorElement.addEventListener('drop', handleDrop);
  window.addEventListener('message', messageHandler);

  editor.on('destroy', () => {
    editorElement.removeEventListener('drop', handleDrop);
    window.removeEventListener('message', messageHandler);
  });
}