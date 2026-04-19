import * as vscode from 'vscode';
import packageJson from '../../../package.json';
import { SETTING_KEYS, handleSettingsMessage } from '../../editor/SettingsPanel';

describe('Settings persistence coverage', () => {
  let mockConfig: { get: jest.Mock; update: jest.Mock };
  let panel: { webview: { postMessage: jest.Mock } };

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
      update: jest.fn().mockResolvedValue(undefined),
    };

    (vscode.workspace.getConfiguration as jest.Mock) = jest.fn().mockReturnValue(mockConfig);

    panel = {
      webview: {
        postMessage: jest.fn(),
      },
    };
  });

  test('all SettingsPanel keys are registered in package.json configuration', () => {
    const properties = packageJson.contributes?.configuration?.properties ?? {};
    const registeredKeys = Object.keys(properties)
      .filter(key => key.startsWith('gptAiMarkdownEditor.'))
      .map(key => key.replace(/^gptAiMarkdownEditor\./, ''));

    const missingKeys = SETTING_KEYS.filter(key => !registeredKeys.includes(key));

    expect(missingKeys).toEqual([]);
    expect(registeredKeys).toEqual(expect.arrayContaining(SETTING_KEYS));
  });

  test('GET_ALL_SETTINGS loads every known setting key', async () => {
    await handleSettingsMessage({ type: 'settings.getAllSettings' }, panel as any);

    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('gptAiMarkdownEditor');
    expect(mockConfig.get).toHaveBeenCalledTimes(SETTING_KEYS.length);

    const loadedKeys = mockConfig.get.mock.calls.map(call => call[0]);
    expect(loadedKeys).toEqual(expect.arrayContaining(SETTING_KEYS));

    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'settings.allSettingsData',
      })
    );

    const posted = panel.webview.postMessage.mock.calls[0][0];
    expect(posted.settings).toBeDefined();
    expect(Object.keys(posted.settings)).toEqual(expect.arrayContaining(SETTING_KEYS));
  });

  test.each(SETTING_KEYS)('UPDATE_SETTING persists setting key %s', async key => {
    const value = key.includes('enabled') || key === 'showSelectionToolbar' ? false : 'test-value';

    await handleSettingsMessage({ type: 'updateSetting', key, value }, panel as any);

    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('gptAiMarkdownEditor');
    expect(mockConfig.update).toHaveBeenCalledWith(key, value, vscode.ConfigurationTarget.Global);
  });
});
