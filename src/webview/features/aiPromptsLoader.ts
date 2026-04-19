import { MessageType } from '../../shared/messageTypes';

let cachedPrompts: any[] = [];

export function getCachedAiPrompts(): any[] {
  return cachedPrompts;
}

export function initAiPrompts(): void {
  const vscodeApi = (window as any).vscode;
  if (vscodeApi) {
    vscodeApi.postMessage({ type: MessageType.GET_AI_PROMPTS });
  }

  (window as any).handleAiPromptsResult = (prompts: any[]) => {
    cachedPrompts = prompts || [];
    window.dispatchEvent(new CustomEvent('aiPromptsLoaded'));
  };
}
