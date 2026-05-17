/**
 * BacklinksSection — shows incoming links from other notes.
 * Phase 5: receives real data via gptAiBacklinksUpdate custom event (Foam).
 */
import React, { useState, useEffect } from 'react';

interface BacklinkEntry {
  path: string;
  title: string;
}

export function BacklinksSection(): React.ReactElement {
  const [backlinks, setBacklinks] = useState<BacklinkEntry[]>([]);

  useEffect(() => {
    function onBacklinksUpdate(event: Event) {
      const { backlinks: links } = (event as CustomEvent).detail;
      if (Array.isArray(links)) setBacklinks(links);
    }
    window.addEventListener('gptAiBacklinksUpdate', onBacklinksUpdate);
    return () => window.removeEventListener('gptAiBacklinksUpdate', onBacklinksUpdate);
  }, []);

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">
        <span className="inspector-section-title">Backlinks</span>
      </div>
      {backlinks.length === 0 ? (
        <span className="inspector-backlinks-empty">No backlinks yet</span>
      ) : (
        backlinks.map(bl => (
          <div key={bl.path} className="inspector-backlink-entry" title={bl.path}>
            {bl.title || bl.path}
          </div>
        ))
      )}
    </div>
  );
}
