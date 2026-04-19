/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * UI and export handlers for the markdown editor.
 * Extracted from MarkdownEditorProvider for modularity.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MessageType } from '../../shared/messageTypes';
import { toErrorMessage } from '../../shared/errorUtils';
import { type HandlerContext, type MessageRouter } from '../messageRouter';
import { resolveMediaTargetFolder } from '../utils/pathUtils';

/** Register all UI/export message handlers with the router. */
export function registerUiHandlers(router: MessageRouter): void {
  router.register(MessageType.OPEN_ATTACHMENTS_FOLDER, handleOpenAttachmentsFolder);
  router.register(MessageType.EXPORT_DOCUMENT, handleExportDocument);
  router.register(MessageType.EXPORT_TABLE_CSV, handleExportTableCsv);
  router.register(MessageType.SHOW_EMOJI_PICKER, handleShowEmojiPicker);
  router.register(MessageType.EDIT_MERMAID_SOURCE, handleEditMermaidSource);
  router.register(MessageType.UPDATE_SETTING, handleUpdateSetting);
  router.register(MessageType.OPEN_GRAPH_CHAT, handleOpenGraphChat);
}

/**
 * Handle opening the attachments folder from the toolbar
 */
export async function handleOpenAttachmentsFolder(
  _message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document } = ctx;
  const mediaFolderName = ctx.getConfig<string>('mediaPath', 'media');

  // Resolve absolute path using same logic as saving images
  const targetDir = resolveMediaTargetFolder(document, mediaFolderName, ctx.getConfig);
  if (!targetDir) {
    vscode.window.showErrorMessage('Cannot determine attachments folder location.');
    return;
  }

  try {
    // Create folder if it doesn't exist yet
    const dirUri = vscode.Uri.file(targetDir);
    try {
      await vscode.workspace.fs.stat(dirUri);
    } catch {
      // Folder doesn't exist, create it so we can open it
      await vscode.workspace.fs.createDirectory(dirUri);
    }

    // Reveal in OS completely
    await vscode.commands.executeCommand('revealFileInOS', dirUri);
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    vscode.window.showErrorMessage(`Failed to open attachments folder: ${errorMessage}`);
  }
}

/**
 * Handle document export request from webview
 */
export async function handleExportDocument(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document } = ctx;
  const format = message.format as string;
  const html = message.html as string;
  const mermaidImages = message.mermaidImages as any[];
  const title = message.title as string;

  console.log(
    '[DK-AI] handleExportDocument extension side: format=',
    format,
    'mermaidImages=',
    mermaidImages?.length || 0
  );
  if (mermaidImages && mermaidImages.length > 0) {
    mermaidImages.forEach((img, i) => {
      console.log(
        `[DK-AI]   Image ${i}: id=${img?.id}, dataUrl length=${img?.pngDataUrl?.length || 0}`
      );
    });
  }

  // Import dynamically to avoid loading heavy dependencies on startup
  const { exportDocument } = await import('../../features/documentExport');

  await exportDocument(format, html, mermaidImages, title, document);
}

export async function handleExportTableCsv(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document } = ctx;
  const csv = typeof message.csv === 'string' ? message.csv : '';
  if (!csv.trim()) {
    vscode.window.showErrorMessage('No table data available to export as CSV.');
    return;
  }

  const documentDir = vscode.Uri.joinPath(document.uri, '..');
  const defaultName = `${path.parse(document.uri.fsPath).name}-table.csv`;
  const targetUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.joinPath(documentDir, defaultName),
    filters: {
      CSV: ['csv'],
    },
    saveLabel: 'Export Table as CSV',
  });

  if (!targetUri) {
    return;
  }

  try {
    await vscode.workspace.fs.writeFile(targetUri, Buffer.from(csv, 'utf8'));
    vscode.window.showInformationMessage(`Table exported to ${path.basename(targetUri.fsPath)}`);
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    vscode.window.showErrorMessage(`Failed to export CSV: ${errorMessage}`);
  }
}

/**
 * Show a searchable emoji picker via VS Code QuickPick and insert the
 * selected emoji into the webview editor.
 */
export async function handleShowEmojiPicker(
  _message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { webview } = ctx;
  const emojis: Array<{ emoji: string; label: string }> = [
    // Smileys & People
    { emoji: '😀', label: 'grinning face' },
    { emoji: '😁', label: 'beaming face' },
    { emoji: '😂', label: 'face with tears of joy' },
    { emoji: '🤣', label: 'rolling on the floor laughing' },
    { emoji: '😃', label: 'smiley face' },
    { emoji: '😄', label: 'happy face' },
    { emoji: '😅', label: 'sweat smile' },
    { emoji: '😆', label: 'laughing squinting' },
    { emoji: '😉', label: 'winking face' },
    { emoji: '😊', label: 'smiling face with blush' },
    { emoji: '😎', label: 'cool sunglasses' },
    { emoji: '😍', label: 'heart eyes' },
    { emoji: '🥰', label: 'smiling face with hearts' },
    { emoji: '😘', label: 'face blowing a kiss' },
    { emoji: '😜', label: 'winking tongue' },
    { emoji: '🤔', label: 'thinking face' },
    { emoji: '🤗', label: 'hugging face' },
    { emoji: '🤩', label: 'star struck' },
    { emoji: '😢', label: 'crying face' },
    { emoji: '😭', label: 'loudly crying' },
    { emoji: '😤', label: 'angry huffing' },
    { emoji: '😡', label: 'pouting red face' },
    { emoji: '🤯', label: 'mind blown exploding head' },
    { emoji: '😱', label: 'screaming in fear' },
    { emoji: '😴', label: 'sleeping face' },
    { emoji: '🥳', label: 'partying face' },
    { emoji: '😇', label: 'angel halo' },
    { emoji: '🫡', label: 'saluting face' },
    // Gestures & Body
    { emoji: '👍', label: 'thumbs up' },
    { emoji: '👎', label: 'thumbs down' },
    { emoji: '👏', label: 'clapping hands' },
    { emoji: '🙌', label: 'raising hands' },
    { emoji: '🤝', label: 'handshake' },
    { emoji: '✌️', label: 'victory peace' },
    { emoji: '🤞', label: 'fingers crossed' },
    { emoji: '💪', label: 'flexed biceps strong' },
    { emoji: '👋', label: 'waving hand' },
    { emoji: '🙏', label: 'folded hands pray please' },
    { emoji: '☝️', label: 'index pointing up' },
    { emoji: '👀', label: 'eyes looking' },
    // Hearts & Emotions
    { emoji: '❤️', label: 'red heart love' },
    { emoji: '💔', label: 'broken heart' },
    { emoji: '💯', label: 'hundred points perfect' },
    { emoji: '🔥', label: 'fire hot' },
    { emoji: '✨', label: 'sparkles' },
    { emoji: '⭐', label: 'star' },
    { emoji: '🌟', label: 'glowing star' },
    { emoji: '💡', label: 'light bulb idea' },
    { emoji: '💎', label: 'gem stone diamond' },
    { emoji: '🎉', label: 'party popper celebration' },
    { emoji: '🎊', label: 'confetti ball' },
    { emoji: '🏆', label: 'trophy winner' },
    { emoji: '🥇', label: 'gold medal first place' },
    // Objects & Symbols
    { emoji: '📌', label: 'pin pushpin' },
    { emoji: '📎', label: 'paperclip' },
    { emoji: '📝', label: 'memo note writing' },
    { emoji: '📅', label: 'calendar date' },
    { emoji: '📊', label: 'bar chart statistics' },
    { emoji: '📈', label: 'chart increasing trending up' },
    { emoji: '📉', label: 'chart decreasing trending down' },
    { emoji: '🔗', label: 'link chain' },
    { emoji: '🔒', label: 'locked lock secure' },
    { emoji: '🔓', label: 'unlocked open lock' },
    { emoji: '🔑', label: 'key' },
    { emoji: '🛠️', label: 'tools hammer wrench' },
    { emoji: '⚙️', label: 'gear settings cog' },
    { emoji: '💻', label: 'laptop computer' },
    { emoji: '📱', label: 'mobile phone' },
    { emoji: '🖥️', label: 'desktop computer monitor' },
    { emoji: '📧', label: 'email e-mail' },
    { emoji: '📂', label: 'folder open file' },
    { emoji: '🗑️', label: 'wastebasket trash delete' },
    // Arrows & Indicators
    { emoji: '✅', label: 'check mark done complete' },
    { emoji: '❌', label: 'cross mark wrong cancel' },
    { emoji: '⚠️', label: 'warning caution' },
    { emoji: '❗', label: 'exclamation mark important' },
    { emoji: '❓', label: 'question mark' },
    { emoji: 'ℹ️', label: 'information source' },
    { emoji: '➡️', label: 'right arrow' },
    { emoji: '⬅️', label: 'left arrow' },
    { emoji: '⬆️', label: 'up arrow' },
    { emoji: '⬇️', label: 'down arrow' },
    { emoji: '🔄', label: 'counterclockwise arrows cycle refresh' },
    // Nature & Weather
    { emoji: '🌈', label: 'rainbow' },
    { emoji: '☀️', label: 'sun sunny' },
    { emoji: '🌙', label: 'crescent moon' },
    { emoji: '⚡', label: 'lightning bolt zap' },
    { emoji: '🌍', label: 'globe earth world' },
    { emoji: '🍀', label: 'four leaf clover luck' },
    { emoji: '🌸', label: 'cherry blossom flower' },
    // Food & Activities
    { emoji: '☕', label: 'coffee hot beverage' },
    { emoji: '🍕', label: 'pizza' },
    { emoji: '🎵', label: 'musical note music' },
    { emoji: '🎮', label: 'video game controller' },
    { emoji: '📚', label: 'books stack reading' },
    { emoji: '🚀', label: 'rocket launch' },
    { emoji: '🎯', label: 'bullseye target direct hit' },
    // Misc useful
    { emoji: '🐛', label: 'bug insect' },
    { emoji: '🏷️', label: 'label tag' },
    { emoji: '🔍', label: 'magnifying glass search' },
    { emoji: '📋', label: 'clipboard' },
    { emoji: '🧪', label: 'test tube experiment' },
    { emoji: '🧩', label: 'puzzle piece' },
    { emoji: '🗂️', label: 'card index dividers organize' },
    { emoji: '⏰', label: 'alarm clock time' },
    { emoji: '🔔', label: 'bell notification' },
    { emoji: '🚫', label: 'prohibited forbidden no' },
    { emoji: '💬', label: 'speech bubble comment' },
    { emoji: '💭', label: 'thought balloon thinking' },
  ];

  const items = emojis.map(e => ({
    label: e.emoji,
    description: e.label,
  }));

  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: 'Search for an emoji…',
    matchOnDescription: true,
  });

  if (pick) {
    webview.postMessage({ type: MessageType.INSERT_EMOJI, emoji: pick.label });
  }
}

/**
 * Open the same document in VS Code's default text editor beside the
 * WYSIWYG view, scrolled to the `` ```mermaid `` fence that contains the
 * given code.  Hides the outline pane while the source view is open and
 * restores it when the tab is closed.
 */
export async function handleEditMermaidSource(
  message: { type: string; [key: string]: unknown },
  ctx: HandlerContext
): Promise<void> {
  const { document, webview } = ctx;
  const code = ((message.code as string) || '').trim();

  // Find the line of the ```mermaid fence whose body matches the code
  const text = document.getText();
  const lines = text.split('\n');
  let targetLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^```mermaid\s*$/i.test(lines[i].trim())) {
      // Collect the fence body to match against the requested code
      let body = '';
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim().startsWith('```')) break;
        if (body) body += '\n';
        body += lines[j];
      }
      if (body.trim() === code) {
        targetLine = i;
        break;
      }
      // If code is empty or no exact match yet, use first fence
      if (!targetLine) targetLine = i;
    }
  }

  // Hide outline pane
  webview.postMessage({ type: MessageType.SET_OUTLINE_VISIBLE, visible: false });

  // Open source view scrolled to the mermaid fence
  const position = new vscode.Position(targetLine, 0);
  const selection = new vscode.Range(position, position);

  await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default', {
    viewColumn: vscode.ViewColumn.Beside,
    selection,
  });

  // Restore outline when the source editor beside is no longer visible
  const editorWatcher = vscode.window.onDidChangeVisibleTextEditors(editors => {
    const stillOpen = editors.some(
      e =>
        e.document.uri.toString() === document.uri.toString() &&
        e.viewColumn !== vscode.ViewColumn.Active
    );
    if (!stillOpen) {
      webview.postMessage({ type: MessageType.SET_OUTLINE_VISIBLE, visible: true });
      editorWatcher.dispose();
    }
  });
}

/**
 * Handle setting update request from webview
 */
export async function handleUpdateSetting(
  message: { type: string; [key: string]: unknown },
  _ctx: HandlerContext
): Promise<void> {
  const key = message.key as string;
  const value = message.value as unknown;

  try {
    const cfg = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
    await cfg.update(key, value, vscode.ConfigurationTarget.Global);
    console.log(`[DK-AI] Setting updated (vscode): ${key} = ${value}`);
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    console.error(`[DK-AI] Failed to update setting (vscode): ${errorMessage}`);
  }
}

/**
 * Handle request to open Graph Chat interface
 */
export async function handleOpenGraphChat(
  _message: { type: string; [key: string]: unknown },
  _ctx: HandlerContext
): Promise<void> {
  await vscode.commands.executeCommand('gptAiMarkdownEditor.graphChat');
}
