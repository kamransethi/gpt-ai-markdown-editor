import { Editor } from '@tiptap/core';
import { MessageType } from '../../shared/messageTypes';

/**
 * VS Code API type
 */
interface VsCodeApi {
  postMessage: (message: unknown) => void;
}

/**
 * Open native VS Code file picker for images via the extension host.
 * This ensures workspace-aware behavior (relative paths vs copying).
 */
export async function showImagePicker(editor: Editor, vscodeApi: VsCodeApi): Promise<void> {
  // Get current cursor position to ensure images are inserted where they should be
  const pos = editor.state.selection.from;

  vscodeApi.postMessage({
    type: MessageType.OPEN_IMAGE_PICKER,
    insertPosition: pos,
  });
}
