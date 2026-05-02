import { looksLikeMarkdown, markdownToHtml } from '../../webview/utils/pasteHandler';
import { EPIC_READER_FRIENDLY_MD } from '../fixtures/epicReaderFriendly';

describe('Reader-friendly epic fixture', () => {
  it('is detected as markdown', () => {
    expect(looksLikeMarkdown(EPIC_READER_FRIENDLY_MD)).toBe(true);
  });

  it('contains the expected 4-image run in markdown source', () => {
    const imageLines = EPIC_READER_FRIENDLY_MD.split('\n').filter(line =>
      line.startsWith('![image](')
    );

    expect(imageLines).toHaveLength(4);
    expect(imageLines[0]?.endsWith('  ')).toBe(true);
    expect(imageLines[1]?.endsWith('  ')).toBe(true);
    expect(imageLines[2]?.endsWith('  ')).toBe(true);
    expect(imageLines[3]?.endsWith('  ')).toBe(false);
  });

  it('contains GitHub alert markers in markdown source', () => {
    expect(EPIC_READER_FRIENDLY_MD).toContain('> [!IMPORTANT]');
    expect(EPIC_READER_FRIENDLY_MD).toContain('> [!NOTE]');
  });

  it('renders headings, images, and alert blockquotes in markdownToHtml', () => {
    const html = markdownToHtml(EPIC_READER_FRIENDLY_MD);

    expect(html).toContain('<h1>');
    expect(html).toContain('Epic: Reader');

    expect(html).toContain('<h2>');
    expect(html).toContain('1. Problem Statement');

    expect(html).toContain('./images/1.png');
    expect(html).toContain('./images/2.png');
    expect(html).toContain('./images/3.png');
    expect(html).toContain('./images/4.png');

    const imageCount = (html.match(/<img\b/g) || []).length;
    expect(imageCount).toBe(4);

    // With breaks: true, and/or trailing two spaces, newlines should become <br>
    expect(html).toContain('<br');

    expect(html).toContain('<blockquote>');
    expect(html).toContain('[!IMPORTANT]');
    expect(html).toContain('[!NOTE]');
    expect(html).toContain('<strong>Narrative</strong>');
  });
});
