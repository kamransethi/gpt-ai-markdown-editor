/**
 * Path-Containment / Path-Traversal Defense Tests
 *
 * These tests guard the security boundary used by image rename, resize, and
 * file-link handlers. The handlers receive paths from messages whose ultimate
 * source is the markdown content the user opened — which can be hostile.
 *
 * Without containment checks, a malicious markdown file with
 * `![pet](../../../../etc/passwd)` (or any traversal payload) lets a single
 * user click ("Rename image…", "Resize image…") rename / overwrite files
 * completely outside the workspace. See SECURITY review §H1, §H2.
 *
 * Contract:
 *   isPathContainedWithin(target, root)
 *     - returns TRUE iff `target` is `root` itself or strictly inside `root`
 *     - returns FALSE for any path that escapes `root` via `..`, absolute
 *       paths to other roots, symlink-style "looks-similar" prefixes
 *       (e.g. /workspace-evil for root /workspace), or by drive-letter on Win
 *     - operates on already-resolved absolute paths (caller is responsible
 *       for path.resolve() before calling)
 */

import * as path from 'path';
import { isPathContainedWithin } from '../../editor/MarkdownEditorProvider';

describe('isPathContainedWithin (path-traversal defense)', () => {
  const ROOT = path.resolve('/tmp/workspace');

  describe('legitimate paths inside the root', () => {
    it('accepts the root itself', () => {
      expect(isPathContainedWithin(ROOT, ROOT)).toBe(true);
    });

    it('accepts a direct child file', () => {
      expect(isPathContainedWithin(path.join(ROOT, 'image.png'), ROOT)).toBe(true);
    });

    it('accepts a deeply nested file', () => {
      expect(isPathContainedWithin(path.join(ROOT, 'a', 'b', 'c', 'image.png'), ROOT)).toBe(true);
    });

    it('accepts a path with redundant segments that resolve inside', () => {
      const wobbly = path.resolve(ROOT, 'a', '..', 'b', 'image.png');
      expect(isPathContainedWithin(wobbly, ROOT)).toBe(true);
    });
  });

  describe('attack: traversal via "../" sequences', () => {
    it('rejects "../etc/passwd" attack', () => {
      const attack = path.resolve(ROOT, '..', '..', '..', 'etc', 'passwd');
      expect(isPathContainedWithin(attack, ROOT)).toBe(false);
    });

    it('rejects an absolute path outside the root', () => {
      expect(isPathContainedWithin('/etc/passwd', ROOT)).toBe(false);
    });

    it('rejects a path under the user home', () => {
      expect(isPathContainedWithin('/Users/victim/.ssh/id_ed25519', ROOT)).toBe(false);
    });

    it('rejects ".." resolving to the parent of root', () => {
      expect(isPathContainedWithin(path.dirname(ROOT), ROOT)).toBe(false);
    });
  });

  describe('attack: prefix-confusion (the classic startsWith bug)', () => {
    /**
     * The naive check `target.startsWith(root)` mis-classifies sibling
     * directories whose names *begin with* the root's name. This is the
     * bug we are explicitly defending against.
     */
    it('rejects a sibling whose name shares the root prefix', () => {
      // /tmp/workspace-evil starts with /tmp/workspace, but is NOT inside it
      const sibling = path.resolve('/tmp/workspace-evil/file.png');
      expect(isPathContainedWithin(sibling, ROOT)).toBe(false);
    });

    it('rejects a sibling whose name extends the root by characters', () => {
      const sibling = path.resolve('/tmp/workspaceX/file.png');
      expect(isPathContainedWithin(sibling, ROOT)).toBe(false);
    });
  });

  describe('inputs', () => {
    it('returns false for empty target', () => {
      expect(isPathContainedWithin('', ROOT)).toBe(false);
    });

    it('returns false for empty root', () => {
      expect(isPathContainedWithin('/tmp/workspace/x', '')).toBe(false);
    });
  });
});
