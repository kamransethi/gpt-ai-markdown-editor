/**
 * Front Matter Panel Extension
 *
 * Integrates TipTap Details extension for collapsible front matter display.
 * Enables users to view and edit YAML front matter in a clean, collapsible panel
 * at the top of markdown documents.
 */

import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details';
import { Placeholder } from '@tiptap/extensions';
import { Node } from '@tiptap/pm/model';

/**
 * Configure Details extension with persisted open/closed state
 */
export const FrontmatterDetails = Details.configure({
  persist: true,
  HTMLAttributes: {
    class: 'frontmatter-details',
    'data-type': 'frontmatter',
    role: 'region',
    'aria-label': 'Document front matter',
  },
});

/**
 * Configure DetailsSummary with FRONT MATTER label
 */
export const FrontmatterSummary = DetailsSummary.extend({
  parseHTML() {
    return [
      {
        tag: 'summary[data-type="frontmatter"]',
      },
      {
        tag: 'summary',
        getAttrs(node) {
          return node.classList?.contains('frontmatter-summary') ? {} : false;
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'summary',
      { ...HTMLAttributes, class: 'frontmatter-summary' },
      ['span', { class: 'frontmatter-label' }, 'FRONT MATTER'],
    ];
  },
});

/**
 * Configure DetailsContent for front matter YAML
 */
export const FrontmatterContent = DetailsContent.configure({
  HTMLAttributes: {
    class: 'frontmatter-content',
    'data-type': 'frontmatter-content',
  },
});

/**
 * Add placeholder text for empty front matter content
 */
export const FrontmatterPlaceholder = Placeholder.configure({
  includeChildren: true,
  placeholder: ({ node }) => {
    if (node.type.name === 'detailsSummary') {
      return ''; // Summary has explicit content
    }

    if (node.type.name === 'detailsContent') {
      // Show placeholder for front matter content blocks
      return 'Enter front matter YAML...';
    }

    return '';
  },
});

/**
 * Helper: Check if a node is a front matter block
 */
export function isFrontmatterNode(node: Node): boolean {
  return node.type.name === 'details' && node.attrs.class?.includes('frontmatter-details');
}

/**
 * Helper: Get front matter content as text
 */
export function getFrontmatterContent(node: Node): string {
  let content = '';

  node.descendants((child: Node) => {
    if (child.type.name === 'detailsContent') {
      child.descendants((textNode: Node) => {
        if (textNode.isText) {
          content += textNode.text || '';
        }
      });
    }
  });

  return content;
}

/**
 * Helper: Create a front matter details block
 */
export function createFrontmatterBlock(yaml: string = ''): string {
  return `<details class="frontmatter-details" data-type="frontmatter" open>
  <summary class="frontmatter-summary" data-type="frontmatter"><span class="frontmatter-label">FRONT MATTER</span></summary>
  <div class="frontmatter-content" data-type="frontmatter-content"><pre><code>${escapeHtml(yaml)}</code></pre></div>
</details>`;
}

/**
 * Helper: Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

export default {
  FrontmatterDetails,
  FrontmatterSummary,
  FrontmatterContent,
  FrontmatterPlaceholder,
};
