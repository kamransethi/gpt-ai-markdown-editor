/**
 * Hierarchical Markdown Chunker
 *
 * Splits markdown content into chunks based on heading structure (H1–H3).
 * Each chunk includes the heading breadcrumb path and parent document context.
 * Uses markdown-it (already a project dependency) for reliable heading detection
 * that respects code fences and other block-level constructs.
 */

import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: true });

export interface RawChunk {
  headerPath: string;
  content: string;
  tokenCount: number;
}

const MAX_CHUNK_TOKENS = 400;
const MIN_CHUNK_TOKENS = 30;

/**
 * Estimate token count safely for dense technical markdown.
 * 1 token ≈ 2.5 characters in dense technical text.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.5);
}

/**
 * Split markdown into hierarchical chunks by headings (H1–H3).
 *
 * @param content Raw markdown content (body only — frontmatter already stripped)
 * @param title Document title (used as root heading context)
 * @param properties Frontmatter properties to prepend as context
 * @returns Array of chunks with header paths and content
 */
export function chunkMarkdown(
  content: string,
  title: string,
  properties: Array<{ key: string; value: string }> = [],
  maxCharsPerChunk = 2500
): RawChunk[] {
  const tokens = md.parse(content, {});
  const lines = content.split('\n');

  // Build a property preamble so each chunk carries document context
  let preamble = '';
  if (properties.length > 0) {
    const propLines = properties
      .filter(p => p.key !== 'title')
      .slice(0, 5) // limit to avoid bloating chunks
      .map(p => `${p.key}: ${p.value}`);
    if (propLines.length) {
      preamble = propLines.join('\n') + '\n\n';
    }
  }

  // Collect heading positions from markdown-it tokens
  interface HeadingMark {
    level: number;
    text: string;
    lineStart: number; // 0-based line number where heading starts
  }

  const headings: HeadingMark[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type === 'heading_open' && tok.map) {
      const level = parseInt(tok.tag.slice(1), 10);
      if (level <= 3) {
        // Next token is the inline content of the heading
        const inlineTok = tokens[i + 1];
        const text = inlineTok?.content ?? '';
        headings.push({ level, text, lineStart: tok.map[0] });
      }
    }
  }

  // Build chunks from heading-delimited sections
  const chunks: RawChunk[] = [];
  const headingStack: string[] = []; // tracks current heading hierarchy

  if (headings.length === 0) {
    const text = (preamble + content).trim();
    if (text) {
      chunks.push({
        headerPath: title,
        content: text,
        tokenCount: estimateTokens(text),
      });
    }
  } else {
    // Content before first heading
    if (headings[0].lineStart > 0) {
      const preContent = lines.slice(0, headings[0].lineStart).join('\n').trim();
      if (preContent && estimateTokens(preContent) >= MIN_CHUNK_TOKENS) {
        chunks.push({
          headerPath: title,
          content: preamble + preContent,
          tokenCount: estimateTokens(preamble + preContent),
        });
      }
    }

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const nextLineStart = i + 1 < headings.length ? headings[i + 1].lineStart : lines.length;
      const sectionContent = lines.slice(heading.lineStart, nextLineStart).join('\n').trim();

      // Update heading stack based on level
      while (headingStack.length >= heading.level) {
        headingStack.pop();
      }
      headingStack.push(heading.text);

      const headerPath = [title, ...headingStack].join(' > ');
      const fullContent = preamble + sectionContent;
      const tokenCount = estimateTokens(fullContent);

      if (tokenCount < MIN_CHUNK_TOKENS) {
        // Merge tiny chunks with the previous chunk if possible
        if (chunks.length > 0) {
          const prev = chunks[chunks.length - 1];
          prev.content += '\n\n' + sectionContent;
          prev.tokenCount = estimateTokens(prev.content);
          continue;
        }
      }

      if (tokenCount > MAX_CHUNK_TOKENS || fullContent.length > maxCharsPerChunk) {
        // Split oversized chunks by paragraphs
        const paragraphs = sectionContent.split(/\n\n+/);
        let buffer = preamble;
        let bufferTokens = estimateTokens(preamble);

        for (const para of paragraphs) {
          const paraTokens = estimateTokens(para);
          const wouldBe =
            buffer + (buffer.endsWith('\n\n') || buffer === preamble ? '' : '\n\n') + para;
          if (
            (bufferTokens + paraTokens > MAX_CHUNK_TOKENS && bufferTokens > MIN_CHUNK_TOKENS) ||
            (wouldBe.length > maxCharsPerChunk && bufferTokens > MIN_CHUNK_TOKENS)
          ) {
            chunks.push({
              headerPath,
              content: buffer.trim(),
              tokenCount: bufferTokens,
            });
            buffer = preamble + para;
            bufferTokens = estimateTokens(buffer);
          } else {
            buffer += (buffer.endsWith('\n\n') || buffer === preamble ? '' : '\n\n') + para;
            bufferTokens += paraTokens;
          }
        }
        if (buffer.trim() && estimateTokens(buffer) >= MIN_CHUNK_TOKENS) {
          chunks.push({
            headerPath,
            content: buffer.trim(),
            tokenCount: estimateTokens(buffer),
          });
        }
      } else {
        chunks.push({ headerPath, content: fullContent, tokenCount });
      }
    }
  }

  // Ensure no chunk exceeds maxCharsPerChunk — split further if necessary
  const finalChunks: RawChunk[] = [];
  for (const c of chunks) {
    if (c.content.length <= maxCharsPerChunk) {
      finalChunks.push(c);
      continue;
    }

    // Split by paragraphs first
    const paras = c.content.split(/\n\n+/);
    let buf = '';
    for (const p of paras) {
      if ((buf + '\n\n' + p).trim().length > maxCharsPerChunk) {
        if (buf) {
          finalChunks.push({
            headerPath: c.headerPath,
            content: buf.trim(),
            tokenCount: estimateTokens(buf),
          });
          buf = p;
          // If single paragraph itself too large, split by characters
          if (buf.length > maxCharsPerChunk) {
            let start = 0;
            while (start < buf.length) {
              const slice = buf.slice(start, start + maxCharsPerChunk);
              finalChunks.push({
                headerPath: c.headerPath,
                content: slice.trim() + (start + maxCharsPerChunk < buf.length ? '\n...' : ''),
                tokenCount: estimateTokens(slice),
              });
              start += maxCharsPerChunk;
            }
            buf = '';
          }
        } else {
          // buf empty but paragraph too long
          let start = 0;
          while (start < p.length) {
            const slice = p.slice(start, start + maxCharsPerChunk);
            finalChunks.push({
              headerPath: c.headerPath,
              content: slice.trim() + (start + maxCharsPerChunk < p.length ? '\n...' : ''),
              tokenCount: estimateTokens(slice),
            });
            start += maxCharsPerChunk;
          }
        }
      } else {
        buf = buf ? buf + '\n\n' + p : p;
      }
    }
    if (buf)
      finalChunks.push({
        headerPath: c.headerPath,
        content: buf.trim(),
        tokenCount: estimateTokens(buf),
      });
  }

  return finalChunks;
}
