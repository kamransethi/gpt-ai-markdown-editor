/** @jest-environment jsdom */

import { formatFileLinkLabel, isPotentialFileDropPath } from '../../webview/utils/fileLinks';

describe('fileLinks utilities', () => {
  it('formats underscored filenames into readable labels', () => {
    expect(formatFileLinkLabel('My_File_Name.csv')).toBe('My File Name (CSV)');
  });

  it('formats hyphenated filenames into readable labels', () => {
    expect(formatFileLinkLabel('My-File-Name.csv')).toBe('My File Name (CSV)');
  });

  it('handles filenames without extensions', () => {
    expect(formatFileLinkLabel('release_notes')).toBe('Release Notes');
  });

  it('detects file URIs and absolute file paths', () => {
    expect(isPotentialFileDropPath('file:///Users/test/Notes/file.pdf')).toBe(true);
    expect(isPotentialFileDropPath('/Users/test/Notes/file.pdf')).toBe(true);
    expect(isPotentialFileDropPath('C:\\Users\\test\\file.pdf')).toBe(true);
  });

  it('does not treat plain text as a file path', () => {
    expect(isPotentialFileDropPath('just some text')).toBe(false);
  });
});