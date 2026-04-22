import { formatLinkDisplay } from '../../shared/formatters';

export function formatFileLinkLabel(fileName: string): string {
  return formatLinkDisplay(fileName) || 'Attachment';
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
