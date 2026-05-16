export type BlankLineMode = 'preserve' | 'strip';

function isFenceDelimiterLine(line: string): { marker: '`' | '~'; length: number } | null {
  const match = line.match(/^\s*([`~]{3,})/);
  if (!match) return null;
  const marker = match[1][0];
  if (marker !== '`' && marker !== '~') return null;
  return { marker, length: match[1].length };
}

/**
 * Strip extra blank lines from markdown while leaving fenced code block bodies intact.
 */
function stripExtraBlankLines(markdown: string): string {
  if (markdown.length === 0) return markdown;
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inFence = false;
  let activeFenceMarker: '`' | '~' | null = null;
  let activeFenceLength = 0;
  let blankRun = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const fence = isFenceDelimiterLine(line);
    if (fence) {
      if (!inFence) {
        inFence = true;
        activeFenceMarker = fence.marker;
        activeFenceLength = fence.length;
      } else if (
        fence.marker === activeFenceMarker &&
        fence.length >= activeFenceLength &&
        /^\s*[`~]{3,}\s*$/.test(line)
      ) {
        inFence = false;
        activeFenceMarker = null;
        activeFenceLength = 0;
      }
      out.push(line);
      blankRun = 0;
      continue;
    }

    if (inFence) {
      out.push(line);
      continue;
    }

    if (trimmed === '') {
      blankRun++;
      if (blankRun <= 1) out.push('');
    } else {
      blankRun = 0;
      out.push(line);
    }
  }

  while (out.length > 0 && out[0].trim() === '') out.shift();
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();

  const endsWithNewline = /\r?\n$/.test(markdown);
  const normalized = out.join('\n');
  return endsWithNewline ? `${normalized}\n` : normalized;
}

export function applyBlankLinePolicy(markdown: string, mode: BlankLineMode): string {
  if (mode === 'preserve') return markdown;
  return stripExtraBlankLines(markdown);
}
