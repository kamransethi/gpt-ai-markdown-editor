/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';

export class FluxFlowWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  constructor(
    private onFileChanged: (uri: vscode.Uri) => void,
    private onFileDeleted: (uri: vscode.Uri) => void
  ) {}

  start(): void {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');

    this.disposables.push(
      watcher.onDidChange(uri => this.onFileChanged(uri)),
      watcher.onDidCreate(uri => this.onFileChanged(uri)),
      watcher.onDidDelete(uri => this.onFileDeleted(uri)),
      watcher
    );
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
