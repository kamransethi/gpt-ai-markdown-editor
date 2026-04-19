/**
 * Link autolink validation utility
 *
 * Prevents bare file extensions (like .MD, .txt) and filename patterns
 * from being auto-linked when typing.
 */

/**
 * Determines if a URL should be auto-linked when typed.
 * Rejects bare extensions and common document filenames without protocols.
 *
 * @param url - The URL string detected by linkifyjs
 * @returns true if the URL should be auto-linked, false otherwise
 */
export function shouldAutoLink(url: string): boolean {
  // Reject bare extensions like ".MD", ".txt", ".pdf"
  if (/^\.[a-zA-Z0-9]+$/i.test(url)) {
    return false;
  }

  // Reject filename patterns like "readme.MD", "file.txt" without protocol
  // Allow real URLs with protocols or paths
  const hasProtocol = /^(https?|ftp|mailto):/i.test(url);
  const hasPath = url.includes('/');

  if (!hasProtocol && !hasPath) {
    // Reject common document extensions being auto-linked
    const docExtensions = /\.(md|txt|pdf|doc|docx|xls|xlsx|ppt|pptx|csv|json|xml|yaml|yml)$/i;
    if (docExtensions.test(url)) {
      return false;
    }
  }

  return true;
}
