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
  // Get HTML content from editor
  const editorElement = editor.view.dom as HTMLElement;
  const clonedContent = editorElement.cloneNode(true) as HTMLElement;

  // Find all Mermaid diagrams - look for the split-view wrapper
  const mermaidWrappers = clonedContent.querySelectorAll('.mermaid-split-wrapper');
  const mermaidImages: ExportContent['mermaidImages'] = [];

  // Convert each Mermaid SVG to PNG
  for (let i = 0; i < mermaidWrappers.length; i++) {
    const wrapper = mermaidWrappers[i] as HTMLElement;
    const renderBlock = wrapper.querySelector('.mermaid-render-block') as HTMLElement;

    if (renderBlock) {
      const svgElement = renderBlock.querySelector('svg') as unknown as SVGSVGElement | null;

      if (svgElement) {
        try {
          // Capture the rendered dimensions from the editor display
          const renderBlockRect = renderBlock.getBoundingClientRect();
          const renderedWidth =
            renderBlockRect.width > 0 ? Math.round(renderBlockRect.width) : undefined;
          const renderedHeight =
            renderBlockRect.height > 0 ? Math.round(renderBlockRect.height) : undefined;

          // Convert SVG to PNG
          const pngDataUrl = await svgToPng(svgElement);
          const id = `mermaid-${i}`;

          mermaidImages.push({
            id,
            pngDataUrl,
            originalSvg: svgElement.outerHTML,
            width: renderedWidth,
            height: renderedHeight,
          });

          // Replace SVG with img tag in cloned content
          const imgElement = document.createElement('img');
          imgElement.src = pngDataUrl;
          imgElement.alt = `Mermaid diagram ${i + 1}`;
          imgElement.className = 'mermaid-export-image';
          imgElement.setAttribute('data-mermaid-id', id);

          // Replace the mermaid-split-wrapper with the image
          wrapper.parentNode?.replaceChild(imgElement, wrapper);
        } catch (error) {
          console.error('[DK-AI] Failed to convert Mermaid SVG to PNG:', error);
          // Keep the SVG as fallback
        }
      }
    }
  }

  // Restore raw HTML tags that were wrapped in spans/divs for the editor display.
  // This ensures things like raw <img src="..."> tags become actual DOM nodes
  // before we serialize to string, allowing PDF/DOCX exporters to process them.
  const rawHtmlNodes = clonedContent.querySelectorAll('.raw-html-tag');
  for (const el of Array.from(rawHtmlNodes)) {
    const raw = el.getAttribute('data-raw');
    if (raw) {
      try {
        el.outerHTML = raw;
      } catch (e) {
        console.warn('[DK-AI] collectExportContent: Failed to restore raw HTML', e);
      }
    }
  }

  // Normalize other images: prefer original markdown src for export so
  // PDF export (via headless Chrome) can resolve relative paths using
  // a <base> href set to the document directory. Many images in the
  // editor are rendered via webview URIs; for exports we want the
  // original markdown path (data-markdown-src) or a file:// URI.
  const otherImgs = clonedContent.querySelectorAll('img');
  for (const el of Array.from(otherImgs)) {
    try {
      const img = el as HTMLImageElement;
      const mdSrc = img.getAttribute('data-markdown-src');
      if (!mdSrc) continue;

      // Windows absolute path -> convert backslashes and use file:/// prefix
      if (/^[A-Za-z]:[\\/]/.test(mdSrc)) {
        const normalized = mdSrc.replace(/\\/g, '/');
        img.setAttribute('src', `file:///${normalized}`);
        continue;
      }

      // If the markdown src already includes a scheme (http(s)/data/file), use it as-is
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(mdSrc) || mdSrc.startsWith('data:')) {
        img.setAttribute('src', mdSrc);
        continue;
      }

      // Otherwise treat as a relative path and set it directly so the
      // exporter (which injects <base href="file://{docDir}/">) can
      // resolve the resource correctly.
      img.setAttribute('src', mdSrc);
    } catch (e) {
      // Non-fatal; continue processing other images

      console.warn('[DK-AI] collectExportContent: Failed to normalize image src', e);
    }
  }

  const finalHtml = clonedContent.innerHTML;

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
