/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * @file exportContent.ts - Extract and prepare content for export
 * @description Collects HTML content from the editor and converts Mermaid SVGs
 * to PNG images for high-quality export to PDF/Word.
 */

import { Editor } from '@tiptap/core';
import { getMermaidPositions, serializeDocToHtml } from './docSerializer';

/**
 * Export content data structure
 */
export interface ExportContent {
  html: string;
  mermaidImages: Array<{
    id: string;
    pngDataUrl: string;
    originalSvg: string;
    width?: number; // Rendered width in pixels
    height?: number; // Rendered height in pixels
  }>;
}

/**
 * Collect HTML content and Mermaid diagrams from the editor
 *
 * @param editor - TipTap editor instance
 * @returns Export-ready content with HTML and Mermaid PNGs
 */
export async function collectExportContent(editor: Editor): Promise<ExportContent> {
  const mermaidImages: ExportContent['mermaidImages'] = [];

  // FR-003: use AST serialization — no cloneNode, no CSS-class queries.
  // serializeDocToHtml walks doc.descendants() and:
  //   - emits <img data-mermaid-id="N"> placeholders for mermaid nodes
  //   - reads node.attrs.rawHtml for raw-HTML inline/block nodes
  //   - normalises image src from data-markdown-src attrs
  const { html: serializedHtml, mermaidIds } = serializeDocToHtml(editor);

  // Convert mermaid diagrams to PNG.
  // Use getMermaidPositions() + editor.view.nodeDOM(pos) to locate the live
  // rendered SVG by document position — avoids CSS class coupling.
  const mermaidPositions = getMermaidPositions(editor);
  for (let i = 0; i < mermaidIds.length; i++) {
    const id = mermaidIds[i];
    const pos = mermaidPositions[i];

    if (pos === undefined) continue;

    const domNode = editor.view.nodeDOM(pos);
    const renderBlock = (domNode instanceof HTMLElement)
      ? domNode.querySelector('.mermaid-render-block') as HTMLElement | null
      : null;

    if (!renderBlock) continue;

    const svgElement = renderBlock.querySelector('svg') as unknown as SVGSVGElement | null;
    if (!svgElement) continue;

    try {
      const renderBlockRect = renderBlock.getBoundingClientRect();
      const renderedWidth =
        renderBlockRect.width > 0 ? Math.round(renderBlockRect.width) : undefined;
      const renderedHeight =
        renderBlockRect.height > 0 ? Math.round(renderBlockRect.height) : undefined;

      const pngDataUrl = await svgToPng(svgElement);

      mermaidImages.push({
        id,
        pngDataUrl,
        originalSvg: svgElement.outerHTML,
        width: renderedWidth,
        height: renderedHeight,
      });
    } catch (error) {
      console.error('[DK-AI] Failed to convert Mermaid SVG to PNG:', error);
    }
  }

  // Replace <img data-mermaid-id="N"> placeholders with PNG data URLs
  let finalHtml = serializedHtml;
  for (const entry of mermaidImages) {
    finalHtml = finalHtml.replace(
      new RegExp(`<img data-mermaid-id="${entry.id}"[^>]*>`, 'g'),
      `<img src="${entry.pngDataUrl}" alt="Mermaid diagram" class="mermaid-export-image" data-mermaid-id="${entry.id}">`
    );
  }

  return {
    html: finalHtml,
    mermaidImages,
  };
}

/**
 * Convert SVG element to PNG data URL, preserving aspect ratio and sans-serif font
 *
 * @param svgElement - SVG DOM element
 * @returns PNG image as data URL
 */
async function svgToPng(svgElement: SVGSVGElement): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Get SVG dimensions - try viewBox first as it has correct aspect ratio
      let width = 800;
      let height = 600;

      if (svgElement.viewBox?.baseVal) {
        width = svgElement.viewBox.baseVal.width;
        height = svgElement.viewBox.baseVal.height;
      } else if (svgElement.width?.baseVal?.value && svgElement.height?.baseVal?.value) {
        width = svgElement.width.baseVal.value;
        height = svgElement.height.baseVal.value;
      } else {
        const bbox = svgElement.getBoundingClientRect();
        if (bbox.width > 0 && bbox.height > 0) {
          width = bbox.width;
          height = bbox.height;
        }
      }

      // Clone SVG and force sans-serif font to prevent inheriting serif from export document
      const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
      const sansSerifFont =
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
      svgClone.style.fontFamily = sansSerifFont;

      // Also set font-family on any text elements to ensure they don't inherit serif
      const textElements = svgClone.querySelectorAll('text, tspan, g');
      textElements.forEach(el => {
        (el as HTMLElement).style.fontFamily = sansSerifFont;
      });

      // Create canvas with proper dimensions (high DPI)
      const scale = 2; // 2x for high quality
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Scale context for high quality rendering
      ctx.scale(scale, scale);

      // White background for PDFs
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Convert SVG to image using data URL (avoids canvas tainting from blob URLs)
      // Use the cloned SVG with sans-serif font forced
      const svgData = new XMLSerializer().serializeToString(svgClone);
      const encodedSvgData = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);

      const img = new Image();
      img.onload = () => {
        // Draw the image at exact dimensions to preserve aspect ratio
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to PNG
        const pngDataUrl = canvas.toDataURL('image/png');
        resolve(pngDataUrl);
      };

      img.onerror = () => {
        reject(new Error('Failed to load SVG as image'));
      };

      img.src = encodedSvgData;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get document title from editor content
 * Looks for first H1 heading, falls back to filename
 *
 * @param editor - TipTap editor instance
 * @returns Document title
 */
export function getDocumentTitle(editor: Editor): string {
  // Find first H1 heading
  const firstHeading = editor.view.dom.querySelector('h1');
  if (firstHeading && firstHeading.textContent) {
    return firstHeading.textContent.trim();
  }

  // Fallback to "Untitled Document"
  return 'Untitled Document';
}
