export function formatFileLinkLabel(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return 'Attachment';
  }

  const extensionMatch = trimmed.match(/\.([^.]+)$/);
  const extension = extensionMatch ? extensionMatch[1].toUpperCase() : '';
  const baseName = extensionMatch ? trimmed.slice(0, -(extensionMatch[0].length)) : trimmed;

  const normalizedBase = baseName
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());

  return extension ? `${normalizedBase} (${extension})` : normalizedBase;
}

export function isPotentialFileDropPath(value: string): boolean {
  const candidate = value.trim();
  if (!candidate) {
    return false;
  }

  return (
    candidate.startsWith('file://') ||
    /^([A-Za-z]:\\|\\\\|\/)/.test(candidate) ||
    candidate.startsWith('./') ||
    candidate.startsWith('../')
  );
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}