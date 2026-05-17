/**
 * FrontmatterSection — shows parsed YAML frontmatter key/value pairs in the Inspector.
 * Provides an "Edit" button that opens the existing frontmatter modal in editor.ts.
 */
import React, { useMemo } from 'react';

interface Props {
  frontmatter: string | null;
  onEdit: () => void;
}

function parseFrontmatter(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Simple line-by-line YAML key: value parser (no nested objects)
  for (const line of raw.split('\n')) {
    const match = line.match(/^([^:#]+):\s*(.*)$/);
    if (match) {
      result[match[1].trim()] = match[2].trim();
    }
  }
  return result;
}

export function FrontmatterSection({ frontmatter, onEdit }: Props): React.ReactElement {
  const fields = useMemo(() => {
    if (!frontmatter) return null;
    return parseFrontmatter(frontmatter);
  }, [frontmatter]);

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">
        <span className="inspector-section-title">Front Matter</span>
        <button className="inspector-section-action" onClick={onEdit} title="Edit front matter">
          Edit
        </button>
      </div>

      {!fields || Object.keys(fields).length === 0 ? (
        <span className="inspector-fm-empty">No front matter</span>
      ) : (
        Object.entries(fields).map(([key, value]) => (
          <div key={key} className="inspector-fm-field">
            <span className="inspector-fm-key">{key}:</span>
            <span className="inspector-fm-value">{value || <em>empty</em>}</span>
          </div>
        ))
      )}
    </div>
  );
}
