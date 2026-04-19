# 017 - Custom Configuration Panel for Flux Flow

**Status:** Implemented ✅  
**Date:** April 2026  
**Version:** 2.0.37+

---

## Problem Statement

VS Code's built-in settings interface is designed for alphabetically-organized, generic settings. Flux Flow's configuration needs are:
- **Organized by function**, not alphabetically (Editor settings, AI/LLM settings, Media handling, Export options)
- **Contextual help**, with descriptions explaining what each setting does
- **Dynamic UI controls** that adapt based on the LLM provider selected (Copilot vs Ollama)
- **Provider detection**, discovering available Copilot models in real-time via VS Code's LM API
- **Connectivity feedback**, showing whether Ollama is online/offline
- **File path browsing**, with system dialogs for Chrome/Pandoc paths instead of raw input

The built-in VS Code settings panel fails all these requirements, forcing users to either:
- Guess at configuration options
- Edit JSON manually (high friction)
- Use hardcoded defaults (limiting)

## Requirements

### Functional Requirements

1. **Custom Settings Panel UI**
   - Panel opens from "Preferences > Configuration" button in toolbar
   - Non-modal, resizable, floatable webview panel
   - Closes without affecting main editor

2. **Settings Organization (19 total)**
   - **Editor Tab:** themeOverride, editorZoomLevel, editorWidth, showSelectionToolbar, defaultMarkdownViewer, tocMaxDepth, preserveHtmlComments, developerMode
   - **AI/LLM Tab:** llmProvider (Copilot/Ollama), aiModel (dynamic text + Check button), ollamaModel, ollamaImageModel, ollamaEndpoint
   - **Media Tab:** mediaPathBase, mediaPath, imageResize.skipWarning
   - **Export Tab:** chromePath, pandocPath, pandocTemplatePath

3. **Control Types**
   - **Toggle switches** (boolean settings) with track/thumb animation
   - **Dropdown menus** (predefined options)
   - **Text inputs** (free-form text, e.g., model names)
   - **Sliders** (numeric ranges)
   - **Path inputs** (with "Browse" button opening system file dialogs)
   - **Checkable text inputs** (text + checkbox, e.g., skip image resize warnings)

4. **Conditional Visibility**
   - Ollama-specific settings (ollamaModel, ollamaImageModel, ollamaEndpoint) only visible when llmProvider = "ollama"
   - Copilot-specific settings (aiModel Check button) only visible when llmProvider = "copilot"

5. **Dynamic Copilot Model Discovery**
   - User clicks "Check" button → queries vscode.lm.selectChatModels({vendor: 'copilot'})
   - Shows available models in info message
   - Prevents hardcoding model names (always stays current)

6. **Ollama Connectivity Status**
   - Status badge shows online/offline/checking state
   - Dot indicator: green (online), red (offline), yellow (checking)
   - User can manually check status via button

7. **Settings Persistence**
   - All changes written immediately to VS Code global settings
   - Uses vscode.workspace.getConfiguration('gptAiMarkdownEditor').update(key, value, ConfigurationTarget.Global)
   - Survives extension reload, VS Code restart

8. **Theming Support**
   - Light/dark theme detection via VS Code CSS variables
   - CSS variables: --settings-bg, --settings-text, --settings-accent, --settings-border
   - Smooth transitions between themes

### Non-Functional Requirements

1. **Performance**
   - Settings panel loads in <100ms
   - File dialogs respond within <500ms
   - No blocking operations on main thread

2. **Accessibility**
   - All controls labeled and aria-accessible
   - Keyboard navigation support (Tab, Enter, Arrow keys)
   - Color contrast WCAG AA compliant

3. **Error Handling**
   - File path browsing errors show user-friendly messages
   - Ollama connectivity failures don't crash the panel
   - Invalid settings gracefully fall back to defaults

---

## Technical Architecture

### Files

**Extension Side:**
- `src/editor/SettingsPanel.ts` (~210 lines) - WebviewPanel provider
- `src/editor/messageRouter.ts` - Routes settings messages from webview to handlers

**Webview Side:**
- `src/webview/settings/settingsPanel.ts` (~830 lines) - Main UI and state management
- `src/webview/settings/settingsPanel.css` (~280 lines) - Styling with theme support
- `src/webview/editor.ts` - Webview message listeners

**Build:**
- `scripts/build-webview.js` - Entry point for settingsPanel.ts → dist/settings.js + dist/settings.css

### Message Flow

```
[Webview: Settings Panel]
              ↓
    vscode.postMessage({type, ...payload})
              ↓
[Extension: onDidReceiveMessage in SettingsPanel.ts]
              ↓
[MessageRouter: Handles GET_ALL_SETTINGS, UPDATE_SETTING, etc.]
              ↓
[Handler: Reads/writes config, runs checks, opens dialogs]
              ↓
webview.postMessage({type, ...payload})  [Response]
              ↓
[Webview: Message listener updates UI state]
```

### Message Types

| Type | Direction | Payload | Purpose |
|------|-----------|---------|---------|
| GET_ALL_SETTINGS | WV→EXT | none | Request current setting values |
| ALL_SETTINGS_DATA | EXT→WV | {[key]: value} | Response with 19 settings |
| UPDATE_SETTING | WV→EXT | {key, value} | Write single setting to config |
| CHECK_OLLAMA | WV→EXT | none | Test Ollama connectivity |
| OLLAMA_STATUS | EXT→WV | {online: bool} | Ollama connectivity result |
| BROWSE_PATH | WV→EXT | {browseFor: string} | Open file dialog |
| BROWSE_PATH_RESULT | EXT→WV | {path: string} | Selected file path |
| CHECK_COPILOT_MODELS | WV→EXT | none | Query available Copilot models |
| COPILOT_MODELS_RESULT | EXT→WV | {models: string[]} | List of available model IDs |

### UI Layout

```
┌─────────────────────────────────────────┐
│  Flux Flow Configuration                │  [×]
├─────────┬───────────────────────────────┤
│ EDITOR  │ [Editor Settings Content]     │
│ AI      │                               │
│ MEDIA   │ • Setting 1: [Control]        │
│ EXPORT  │ • Setting 2: [Control]        │
│         │ • Setting 3: [Control]        │
└─────────┴───────────────────────────────┘
```

**Sidebar:** 200px fixed width, vertical tabs  
**Content:** Responsive, scrollable, padding 20px  
**Controls:** Full-width with consistent spacing

---

## Implementation Details

### Settings Panel (src/webview/settings/settingsPanel.ts)

**Key State Variables:**
- `currentPage: string` - Active tab (editor, ai, media, export)
- `settings: Record<string, unknown>` - All 19 settings
- `pendingBrowseKey: string | null` - Which setting is waiting for file dialog
- `pendingCheckButton: string | null` - Which Ollama check is in progress

**Key Functions:**
- `render()` - Renders entire panel with sidebar + current page content
- `renderPage(page)` - Renders tab content with grouped settings
- `renderSettingRow(def)` - Renders label + appropriate control
- `renderSelect()`, `renderToggle()`, `renderTextInput()`, `renderSlider()`, `renderPathInput()`, `renderCheckableTextInput()` - Control type renderers
- `postMessage(type, payload)` - Posts to extension via hostBridge

**Conditional Visibility Logic:**
```typescript
renderSettingRow(def) {
  if (def.visibleWhen && !def.visibleWhen(this.settings)) {
    return null; // Hidden
  }
  // Render normally
}
```

Example:
```typescript
{
  key: 'ollamaModel',
  visibleWhen: (settings) => settings.llmProvider === 'ollama'
}
```

### Settings Panel Provider (src/editor/SettingsPanel.ts)

**Key Function:** `openSettingsPanel(context: ExtensionContext)`
- Creates WebviewPanel with custom URI
- Generates HTML with proper CSP (content security policy)
- Injects dist/settings.js + dist/settings.css
- Registers message handler

**Message Handlers:**
- `GET_ALL_SETTINGS` → reads all 19 keys via getConfiguration(), sends ALL_SETTINGS_DATA
- `UPDATE_SETTING` → writes key via update(key, value, Global), returns new value
- `CHECK_OLLAMA` → calls isOllamaAvailable(), sends OLLAMA_STATUS
- `BROWSE_PATH` → opens vscode.window.showOpenDialog(), sends BROWSE_PATH_RESULT
- `CHECK_COPILOT_MODELS` → calls vscode.lm.selectChatModels({vendor:'copilot'}), sends model list

### Build Integration

**scripts/build-webview.js:**
```javascript
{
  in: 'src/webview/settings/settingsPanel.ts',
  out: 'settings'
}
```

Produces:
- `dist/settings.js` - Minified webview code
- `dist/settings.css` - Minified styles (includes fonts)

### Styling (src/webview/settings/settingsPanel.css)

**CSS Variables:**
```css
--settings-bg: #ffffff;
--settings-text: #333333;
--settings-accent: #007acc;
--settings-border: #d0d0d0;
--settings-input-bg: #f3f3f3;
```

**Theme Detection:**
```css
[data-theme="dark"] {
  --settings-bg: #1e1e1e;
  --settings-text: #e0e0e0;
  /* ... etc */
}
```

**Key Components:**
- `.settings-sidebar` - Fixed 200px, scrollable tab list
- `.settings-page` - Content area, min-height 400px
- `.settings-row` - Each setting, flex row with label + control
- `.settings-row-control` - Control container, aligned right
- `.toggle-switch` - Animated toggle (track + thumb)
- `.toolbar-slider` - Numeric slider with value label
- `.status-badge` - Online/offline indicator with dot

---

## Requirements Met

### Feature Completeness
- ✅ 19 settings organized into 4 semantic tabs
- ✅ 6 control types (toggle, select, text, slider, path, checkable)
- ✅ Conditional visibility based on provider
- ✅ Dynamic Copilot model discovery
- ✅ Ollama connectivity status checking
- ✅ File path browsing with system dialogs
- ✅ Settings persistence to global config
- ✅ Light/dark theme support

### Code Quality
- ✅ Clean separation: extension logic vs webview UI
- ✅ Type-safe message routing
- ✅ No hardcoded values (all from config)
- ✅ CSS variables for theming (maintainable)
- ✅ Error handling with user-friendly messages

### UX Polish
- ✅ Immediate visual feedback on toggles
- ✅ Status badges for async operations
- ✅ Descriptive labels and help text
- ✅ Organized, scannable layout
- ✅ No modal blocking; works alongside editor

---

## Success Criteria

| Criterion | Status |
|-----------|--------|
| All 19 settings visible and editable in panel | ✅ |
| Settings persist across VS Code restarts | ✅ |
| Copilot models discovered dynamically (no hardcoding) | ✅ |
| Ollama connectivity detected and displayed | ✅ |
| Toggles align properly (no overflow) | ✅ |
| File dialogs open and select paths correctly | ✅ |
| Theme switches without reloading panel | ✅ |
| 1023 unit tests passing | ✅ |
| Build produces clean dist/settings.js + .css | ✅ |

---

## Future Enhancements

1. **Settings Export/Import**
   - "Download settings as JSON" button
   - "Import settings from JSON" upload

2. **Validation Rules**
   - Numeric range validation (e.g., zoom 50-200%)
   - Pattern matching for URLs (Ollama endpoint)
   - File existence checks before save

3. **Search/Filter**
   - Search box across all settings
   - Quick filter by keyword

4. **Preset Profiles**
   - Save/load named setting profiles
   - "Work", "Distraction-free", "AI-heavy" presets

5. **Settings History**
   - Undo/redo for setting changes
   - Show what changed and when

---

## Testing Strategy

**Unit Tests:** All 19 settings and control types covered  
**Integration Tests:** Message routing (GET_SETTINGS → UPDATE_SETTING → verification)  
**Manual Tests:** Theme switching, path dialogs, Ollama connectivity check

**Test Coverage Areas:**
- [ ] All settings read correctly on panel load
- [ ] All settings update correctly when changed
- [ ] Ollama check returns online/offline status
- [ ] Copilot model check returns available models
- [ ] Path dialogs open and return selected paths
- [ ] Conditional visibility hides/shows correctly
- [ ] Theme variables apply on demand
- [ ] Error messages display for invalid operations

---

## Related Commits

- `feat(015)`: Settings panel UI and state management
- `fix(017)`: Toggle alignment and dynamic Copilot models
- `feat(017)`: Route toolbar "Configuration" button to panel
- `chore`: Remove marketplace-assets folder

---

## References

- VS Code Settings API: https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration
- VS Code LM API: https://code.visualstudio.com/api/references/vscode-api#lm.selectChatModels
- WebviewPanel API: https://code.visualstudio.com/api/references/vscode-api#WebviewPanel
