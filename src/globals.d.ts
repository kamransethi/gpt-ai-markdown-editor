// Global type definitions for VS Code Webview API

/**
 * A standard interface for the VS Code Webview API.
 * This is provided by the un-mocked VS Code extension host environment.
 */
interface WebviewApi<StateType> {
  postMessage(message: unknown): void;
  getState(): StateType | undefined;
  setState(newState: StateType): void;
}

/**
 * Global function available in VS Code webviews to acquire the API instance.
 * Warning: this function can only be called once per webview!
 */
declare function acquireVsCodeApi<StateType = unknown>(): WebviewApi<StateType>;

// Third-party modules without TypeScript declarations
declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';
  export function gfm(service: TurndownService): void;
  export function tables(service: TurndownService): void;
  export function strikethrough(service: TurndownService): void;
  export function taskListItems(service: TurndownService): void;
}
