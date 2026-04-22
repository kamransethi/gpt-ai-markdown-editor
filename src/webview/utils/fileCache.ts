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

  public setFiles(files: CachedFile[]) {
    this.files = files;
    this.isInitialized = true;
  }

  public search(query: string, limit: number = 10): CachedFile[] {
    if (!query) return [];
    
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
}

export const fileCache = new FileCache();
