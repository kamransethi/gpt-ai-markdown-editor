/**
 * HTML / CSS generation for PDF export.
 *
 * @module exportStyles
 */

/**
 * Build complete HTML document for PDF export with styling.
 */
export function buildExportHTML(
  contentHtml: string,
  theme: string,
  _format: 'pdf' | 'html'
): string {
  const styles = getExportStyles(theme);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        ${styles}
      </style>
    </head>
    <body>
      <div class="content">
        ${contentHtml}
      </div>
    </body>
    </html>
  `;
}

/**
 * Get CSS styles for exported documents.
 */
export function getExportStyles(theme: string): string {
  const baseStyles = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Charter', 'Georgia', 'Cambria', 'Times New Roman', serif;
      font-size: 16px;
      line-height: 1.6;
      color: ${theme === 'light' ? '#1a1a1a' : '#e0e0e0'};
      background: ${theme === 'light' ? '#ffffff' : '#1e1e1e'};
    }

    .content {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    h1, h2, h3, h4, h5, h6 {
      font-weight: 600;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      line-height: 1.3;
    }

    h1 { font-size: 2.5em; margin-top: 0; }
    h2 { font-size: 2em; }
    h3 { font-size: 1.5em; }
    h4 { font-size: 1.25em; }
    h5 { font-size: 1.1em; }
    h6 { font-size: 1em; }

    p {
      margin-bottom: 0.9em;
    }

    code {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      background: ${theme === 'light' ? '#f5f5f5' : '#2d2d2d'};
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }

    pre {
      background: ${theme === 'light' ? '#f5f5f5' : '#2d2d2d'};
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin-bottom: 1em;
    }

    pre code {
      background: none;
      padding: 0;
    }

    blockquote {
      border-left: 4px solid ${theme === 'light' ? '#ddd' : '#444'};
      padding-left: 16px;
      margin: 1em 0;
      color: ${theme === 'light' ? '#666' : '#aaa'};
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }

    th, td {
      border: 1px solid ${theme === 'light' ? '#ddd' : '#444'};
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background: ${theme === 'light' ? '#f5f5f5' : '#2d2d2d'};
      font-weight: 600;
    }

    ul, ol {
      margin-left: 1.4em;
      margin-bottom: 0.5em;
    }

    li {
      margin-bottom: 0.25em;
    }

    li p {
      margin-bottom: 0.2em;
    }

    img, .mermaid-export-image {
      max-width: 100%;
      height: auto;
      margin: 1em 0;
    }

    a {
      color: ${theme === 'light' ? '#0066cc' : '#4dabf7'};
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }
  `;

  return baseStyles;
}
