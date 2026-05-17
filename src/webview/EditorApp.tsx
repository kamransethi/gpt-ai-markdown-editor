/**
 * EditorApp — top-level React component for editor-side panels.
 *
 * Manages the Inspector panel open/close state and receives frontmatter
 * updates broadcast by editor.ts via custom DOM events.
 */
import React, { useState, useEffect } from 'react';
import { InspectorPanel } from './inspector/InspectorPanel';

function restoreInspectorState(): boolean {
  try {
    return localStorage.getItem('gptAiInspectorOpen') !== 'false';
  } catch {
    return false;
  }
}

export function EditorApp(): React.ReactElement {
  const [inspectorOpen, setInspectorOpen] = useState(restoreInspectorState);
  const [frontmatter, setFrontmatter] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);

  // Listen for frontmatter updates broadcast by editor.ts
  useEffect(() => {
    function onFrontmatterSync(event: Event) {
      const { frontmatter: fm, wordCount: wc } = (event as CustomEvent).detail;
      setFrontmatter(fm ?? null);
      if (typeof wc === 'number') setWordCount(wc);
    }
    window.addEventListener('gptAiFrontmatterSync', onFrontmatterSync);
    return () => window.removeEventListener('gptAiFrontmatterSync', onFrontmatterSync);
  }, []);

  // Listen for word count updates from editor.ts
  useEffect(() => {
    function onWordCount(event: Event) {
      const { wordCount: wc } = (event as CustomEvent).detail;
      if (typeof wc === 'number') setWordCount(wc);
    }
    window.addEventListener('gptAiWordCountUpdate', onWordCount);
    return () => window.removeEventListener('gptAiWordCountUpdate', onWordCount);
  }, []);

  // Listen for toggle commands (Cmd+Shift+I keyboard shortcut or toolbar button)
  useEffect(() => {
    function onToggle() {
      setInspectorOpen(prev => {
        const next = !prev;
        try {
          localStorage.setItem('gptAiInspectorOpen', String(next));
        } catch {
          // storage unavailable
        }
        return next;
      });
    }
    window.addEventListener('gptAiToggleInspector', onToggle);
    return () => window.removeEventListener('gptAiToggleInspector', onToggle);
  }, []);

  function handleToggle() {
    setInspectorOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('gptAiInspectorOpen', String(next));
      } catch {
        // storage unavailable
      }
      return next;
    });
  }

  return (
    <InspectorPanel
      isOpen={inspectorOpen}
      onToggle={handleToggle}
      frontmatter={frontmatter}
      wordCount={wordCount}
    />
  );
}
