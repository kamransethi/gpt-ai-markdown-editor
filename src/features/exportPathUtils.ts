/**
 * Image / markdown path resolution utilities for document export.
 *
 * Pure functions — no VS Code API dependency.
 *
 * @module exportPathUtils
 */

import * as path from 'path';

/**
 * Resolve relative image paths in markdown to absolute paths.
 */
export function resolveMarkdownImagePaths(markdown: string, baseDir: string): string {
  const imgRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+("[^"]*"))?\)/g;

  return markdown.replace(imgRegex, (match, alt, url, title) => {
    let imgUrl = url;
    const imgTitle = title ? ` ${title}` : '';

    if (
      imgUrl.startsWith('http://') ||
      imgUrl.startsWith('https://') ||
      imgUrl.startsWith('data:') ||
      imgUrl.startsWith('file://') ||
      path.isAbsolute(imgUrl)
    ) {
      return match;
    }

    try {
      imgUrl = decodeURIComponent(imgUrl);
    } catch {
      // Ignore decoding errors
    }

    const absolutePath = path.join(baseDir, imgUrl);
    return `![${alt}](${absolutePath}${imgTitle})`;
  });
}

/**
 * Resolve relative image paths in HTML to absolute paths.
 */
export function resolveHtmlImagePaths(html: string, baseDir: string): string {
  const imgRegex = /<img[^>]+src=(['"])(.*?)\1/g;

  return html.replace(imgRegex, (match, quote, url) => {
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:') ||
      url.startsWith('file://') ||
      path.isAbsolute(url)
    ) {
      return match;
    }

    try {
      url = decodeURIComponent(url);
    } catch {
      // Ignore
    }

    const absolutePath = path.join(baseDir, url);
    return match.replace(`src=${quote}${url}${quote}`, `src=${quote}${absolutePath}${quote}`);
  });
}

/**
 * Converts HTML `<img>` tags to Pandoc-compatible markdown image syntax.
 */
export function convertHtmlImagesToMarkdown(markdown: string, baseDir: string): string {
  const imgTagRegex = /<img\s+([^>]*?)\s*\/?>/gi;

  return markdown.replace(imgTagRegex, (_match, attrsStr: string) => {
    const srcMatch = attrsStr.match(/src=(['"])(.*?)\1/);
    if (!srcMatch) return _match;

    let src = srcMatch[2];
    const altMatch = attrsStr.match(/alt=(['"])(.*?)\1/);
    const widthMatch = attrsStr.match(/width=["']?(\d+%?)["']?/);
    const heightMatch = attrsStr.match(/height=["']?(\d+%?)["']?/);

    const alt = altMatch ? altMatch[2] : '';

    if (
      !src.startsWith('http://') &&
      !src.startsWith('https://') &&
      !src.startsWith('data:') &&
      !src.startsWith('file://') &&
      !path.isAbsolute(src)
    ) {
      try {
        src = decodeURIComponent(src);
      } catch {
        // Ignore decoding errors
      }
      src = path.join(baseDir, src);
    }

    let mdImage = `![${alt}](${src})`;

    const attrs: string[] = [];
    if (widthMatch) attrs.push(`width=${widthMatch[1]}px`);
    if (heightMatch) attrs.push(`height=${heightMatch[1]}px`);
    if (attrs.length > 0) {
      mdImage += `{ ${attrs.join(' ')} }`;
    }

    return mdImage;
  });
}
