/** NoteInfoSection — shows word count and other note statistics. */
import React from 'react';

interface Props {
  wordCount: number;
}

export function NoteInfoSection({ wordCount }: Props): React.ReactElement {
  return (
    <div className="inspector-section">
      <div className="inspector-section-header">
        <span className="inspector-section-title">Note Info</span>
      </div>
      <div className="inspector-info-row">
        <span className="inspector-info-label">Word count</span>
        <span className="inspector-info-value">{wordCount.toLocaleString()}</span>
      </div>
    </div>
  );
}
