/**
 * InspectorPanel — Properties side panel for the editor.
 *
 * Displays:
 *  - Frontmatter key/value summary
 *  - Note info (word count)
 *  - (Phase 5) Backlinks
 *  - (Phase 5) Tags
 *
 * Communication:
 *  - Receives frontmatter via props (broadcast by editor.ts as gptAiFrontmatterSync)
 *  - Opens frontmatter modal via gptAiOpenFrontmatterEditor custom event
 */
import React from 'react';
import './InspectorPanel.css';
import { FrontmatterSection } from './FrontmatterSection';
import { NoteInfoSection } from './NoteInfoSection';
import { BacklinksSection } from './BacklinksSection';

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  frontmatter: string | null;
  wordCount: number;
}

export function InspectorPanel({
  isOpen,
  onToggle,
  frontmatter,
  wordCount,
}: Props): React.ReactElement | null {
  if (!isOpen) {
    return (
      <button
        className="inspector-tab-btn"
        onClick={onToggle}
        title="Open Properties Panel"
        aria-label="Open Properties Panel"
      >
        <span className="inspector-tab-icon">❱</span>
      </button>
    );
  }

  function handleEditFrontmatter() {
    // Trigger the existing frontmatter modal in editor.ts
    window.dispatchEvent(new CustomEvent('gptAiOpenFrontmatterEditor'));
  }

  return (
    <aside className="inspector-panel" role="complementary" aria-label="Properties Panel">
      <div className="inspector-header">
        <span className="inspector-title">Properties</span>
        <button
          className="inspector-close-btn"
          onClick={onToggle}
          title="Close Properties Panel"
          aria-label="Close Properties Panel"
        >
          ✕
        </button>
      </div>

      <div className="inspector-content">
        <FrontmatterSection frontmatter={frontmatter} onEdit={handleEditFrontmatter} />
        <NoteInfoSection wordCount={wordCount} />
        <BacklinksSection />
      </div>
    </aside>
  );
}
