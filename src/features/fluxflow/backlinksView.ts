/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { BacklinkEntry } from './types';

type BacklinksSupplier = (docPath: string) => BacklinkEntry[];

class BacklinkTreeItem extends vscode.TreeItem {
  constructor(
    public readonly entry: BacklinkEntry,
    workspacePath: string
  ) {
    super(entry.sourceTitle || path.basename(entry.sourcePath));
    this.description = entry.sourcePath;
    this.tooltip = entry.context || entry.sourcePath;
    this.iconPath = new vscode.ThemeIcon('references');
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [vscode.Uri.file(path.join(workspacePath, entry.sourcePath))],
    };
    this.contextValue = 'backlink';
  }
}

class SectionItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly children: BacklinkTreeItem[]
  ) {
    super(
      label,
      children.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.contextValue = 'section';
    this.iconPath = new vscode.ThemeIcon(label.startsWith('Linked') ? 'link' : 'search');
  }
}

type TreeItem = SectionItem | BacklinkTreeItem;

export class BacklinksViewProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  currentDocPath: string | null = null;
  private getBacklinks: BacklinksSupplier;
  private getUnlinked: BacklinksSupplier;
  private workspacePath: string;

  constructor(
    workspacePath: string,
    getBacklinks: BacklinksSupplier,
    getUnlinked: BacklinksSupplier
  ) {
    this.workspacePath = workspacePath;
    this.getBacklinks = getBacklinks;
    this.getUnlinked = getUnlinked;
  }

  updateActiveDocument(docPath: string | null): void {
    this.currentDocPath = docPath;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      if (!this.currentDocPath) return [];

      const linked = this.getBacklinks(this.currentDocPath).map(
        e => new BacklinkTreeItem(e, this.workspacePath)
      );
      const unlinked = this.getUnlinked(this.currentDocPath).map(
        e => new BacklinkTreeItem(e, this.workspacePath)
      );

      return [
        new SectionItem(`Linked References (${linked.length})`, linked),
        new SectionItem(`Unlinked References (${unlinked.length})`, unlinked),
      ];
    }

    if (element instanceof SectionItem) {
      return element.children;
    }

    return [];
  }
}
