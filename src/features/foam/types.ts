/**
 * Foam types used across the extension host.
 *
 * We re-export only what we need from foam-core to avoid importing the full
 * library in modules that don't need it.
 */

export interface FoamNote {
  /** Absolute path to the file */
  path: string;
  /** Display title (from frontmatter or first heading) */
  title: string;
  /** Raw file URI */
  uri: string;
  /** Tags extracted from frontmatter or inline #tags */
  tags: string[];
}

export interface FoamBacklink {
  /** Absolute path of the file containing the link */
  sourcePath: string;
  sourceTitle: string;
}

export interface FoamWorkspaceSnapshot {
  /** All indexed notes */
  notes: FoamNote[];
  /** Map of target path → list of source files that link to it */
  backlinks: Record<string, FoamBacklink[]>;
  /** All unique tags across the workspace */
  allTags: string[];
}
