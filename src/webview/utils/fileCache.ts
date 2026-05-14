/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Client-side cache for workspace files.
 * Allows for instant local fuzzy searching in the webview.
 */

export interface CachedFile {
  filename: string;
  path: string;
}

class FileCache {
  private files: CachedFile[] = [];
  private isInitialized = false;
  private refreshPromise: Promise<void> | null = null;
  private refreshResolve: (() => void) | null = null;
  private refreshTimeoutId: number | null = null;

  public setFiles(files: CachedFile[]) {
    this.files = files;
    this.isInitialized = true;
    // If a refresh was pending, resolve it now and clear timeout
    if (this.refreshResolve) {
      if (this.refreshTimeoutId) {
        clearTimeout(this.refreshTimeoutId);
        this.refreshTimeoutId = null;
      }
      this.refreshResolve();
      this.refreshResolve = null;
      this.refreshPromise = null;
    }
  }

  /**
   * Get all files (for debugging/testing)
   */
  public getAll(): CachedFile[] {
    return this.files;
  }

  public search(query: string, limit: number = 10): CachedFile[] {
    // Empty query returns all files up to limit
    if (!query) {
      return this.files.slice(0, limit);
    }

    const lowerQuery = query.toLowerCase();

    // Simple fast search: startsWith, then includes
    const results: CachedFile[] = [];
    const includesResults: CachedFile[] = [];

    for (const file of this.files) {
      const lowerName = file.filename.toLowerCase();

      if (lowerName.startsWith(lowerQuery)) {
        results.push(file);
      } else if (lowerName.includes(lowerQuery)) {
        includesResults.push(file);
      }

      if (results.length >= limit) break;
    }

    // Combine results, prioritizing startsWith
    const finalResults = [...results, ...includesResults].slice(0, limit);
    return finalResults;
  }

  public get isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Request a refresh of the workspace files from the extension.
   * This should be called when opening file/image pickers to ensure cache is current.
   * Returns a Promise that resolves when the fresh file list has been received (or after timeout).
   */
  public requestRefresh(): Promise<void> {
    // If we already have a pending refresh, return that promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Create a new pending refresh
    this.refreshPromise = new Promise(resolve => {
      let resolved = false;
      this.refreshResolve = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      // Set a timeout - if refresh takes too long, proceed anyway
      this.refreshTimeoutId = window.setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.refreshResolve = null;
          this.refreshPromise = null;
          this.refreshTimeoutId = null;
          resolve();
        }
      }, 500);

      // Dispatch a postMessage to the extension to refresh workspace files
      const vscode = (window as any).vscode;
      if (vscode) {
        vscode.postMessage({ type: 'GET_WORKSPACE_FILES' });
      } else {
        // If no vscode API available, resolve immediately
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }
    });

    return this.refreshPromise;
  }
}

export const fileCache = new FileCache();
