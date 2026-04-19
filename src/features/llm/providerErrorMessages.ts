/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';
import type { Environment, ProviderAvailability } from './providerAvailability';

/**
 * Error context for provider failures
 */
export interface ProviderErrorContext {
  availability: ProviderAvailability;
  attemptedProvider: 'copilot' | 'ollama';
  feature: string; // e.g., 'Chat Participant', 'AI Refine', 'AI Explain'
}

/**
 * Generate a user-friendly error message based on availability and environment
 */
export function generateProviderErrorMessage(context: ProviderErrorContext): string {
  const { availability, attemptedProvider, feature } = context;
  const { copilotAvailable, ollamaAvailable, environment } = availability;

  // If user tried Copilot but it's not available
  if (attemptedProvider === 'copilot' && !copilotAvailable) {
    // Ollama is available as a fallback
    if (ollamaAvailable) {
      return generateOllamaDetectedMessage(feature, environment);
    }

    // No Ollama - provide setup instructions
    return generateSetupInstructionsMessage(feature, environment);
  }

  // If user tried Ollama but it's not available
  if (attemptedProvider === 'ollama' && !ollamaAvailable) {
    return generateOllamaUnavailableMessage(feature, environment);
  }

  // Fallback generic message
  return `Unable to use ${feature}: no LLM provider available. Please configure Ollama or sign up for GitHub Copilot.`;
}

/**
 * Message shown when Copilot is unavailable but Ollama is detected
 */
function generateOllamaDetectedMessage(feature: string, _environment: Environment): string {
  return (
    `**${feature} requires an LLM provider**\n\n` +
    `✅ **Ollama detected** on your system!\n\n` +
    `Would you like to switch to the Ollama provider? This will let you use ${feature} with your local Ollama instance.\n\n` +
    `[Switch to Ollama](command:gptAiMarkdownEditor.switchToOllamaProvider)  |  ` +
    `[Setup Copilot](https://github.com/login/device)  |  ` +
    `[Learn More](https://github.com/kamransethi/gpt-ai-markdown-editor#ai-features)`
  );
}

/**
 * Message shown when no providers are available
 */
function generateSetupInstructionsMessage(feature: string, environment: Environment): string {
  const setupGuide =
    environment === 'cursor'
      ? setupGuideCursor(feature)
      : environment === 'windsurf'
        ? setupGuideWindsurf(feature)
        : setupGuideVscode(feature);

  return setupGuide;
}

/**
 * Setup guide for VS Code
 */
function setupGuideVscode(feature: string): string {
  return (
    `**${feature} requires an LLM provider**\n\n` +
    `You have two options:\n\n` +
    `**Option 1: Use GitHub Copilot** (Free with GitHub subscription)\n` +
    `- [Sign up for GitHub Copilot](https://github.com/login/device)\n` +
    `- Install [GitHub Copilot Extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)\n` +
    `- Return to VS Code and restart the extension\n\n` +
    `**Option 2: Use Ollama** (Free, runs locally on your machine)\n` +
    `- [Download and install Ollama](https://ollama.ai)\n` +
    `- Run \`ollama run llama3.2\` in your terminal\n` +
    `- Open Settings → Search "LLM Provider" → Set to "Ollama"\n` +
    `- Return and try ${feature} again\n\n` +
    `[GitHub Copilot Docs](https://github.com/features/copilot) | ` +
    `[Ollama Docs](https://github.com/ollama/ollama)`
  );
}

/**
 * Setup guide for Cursor
 */
function setupGuideCursor(feature: string): string {
  return (
    `**${feature} requires an LLM provider**\n\n` +
    `In Cursor, you can use:\n\n` +
    `**Option 1: GitHub Copilot** (if available in your Cursor build)\n` +
    `- [Sign up for GitHub Copilot](https://github.com/login/device)\n` +
    `- Follow Cursor documentation to enable Copilot\n\n` +
    `**Option 2: Use Ollama** (Recommended for Cursor)\n` +
    `- [Download and install Ollama](https://ollama.ai)\n` +
    `- Run \`ollama run llama3.2\` in your terminal\n` +
    `- In Cursor Settings → Search "LLM Provider" → Set to "Ollama"\n` +
    `- Return and try ${feature} again\n\n` +
    `[Cursor Docs](https://cursor.com/docs) | ` +
    `[Ollama Docs](https://github.com/ollama/ollama)`
  );
}

/**
 * Setup guide for Windsurf
 */
function setupGuideWindsurf(feature: string): string {
  return (
    `**${feature} requires an LLM provider**\n\n` +
    `In Windsurf, you can use:\n\n` +
    `**Option 1: GitHub Copilot** (if available in your Windsurf build)\n` +
    `- [Sign up for GitHub Copilot](https://github.com/login/device)\n` +
    `- Follow Windsurf documentation to enable Copilot\n\n` +
    `**Option 2: Use Ollama** (Recommended for Windsurf)\n` +
    `- [Download and install Ollama](https://ollama.ai)\n` +
    `- Run \`ollama run llama3.2\` in your terminal\n` +
    `- In Windsurf Settings → Search "LLM Provider" → Set to "Ollama"\n` +
    `- Return and try ${feature} again\n\n` +
    `[Windsurf Docs](https://codeium.com/windsurf) | ` +
    `[Ollama Docs](https://github.com/ollama/ollama)`
  );
}

/**
 * Message shown when Ollama is configured but unavailable
 */
function generateOllamaUnavailableMessage(feature: string, _environment: Environment): string {
  return (
    `**Ollama is not reachable**\n\n` +
    `${feature} couldn't reach Ollama at the configured endpoint.\n\n` +
    `**Make sure Ollama is running:**\n` +
    `1. Run \`ollama serve\` in your terminal\n` +
    `2. Verify Ollama is running at http://localhost:11434\n` +
    `3. Try the feature again\n\n` +
    `**If Ollama is on a different machine/port:**\n` +
    `- Open Settings → Search "Ollama Endpoint"\n` +
    `- Update to your Ollama server address (e.g., \`http://192.168.1.100:11434\`)\n\n` +
    `[Ollama Troubleshooting](https://github.com/ollama/ollama#troubleshooting)`
  );
}

/**
 * Show error dialog with setup instructions
 */
export async function showProviderError(context: ProviderErrorContext): Promise<void> {
  const message = generateProviderErrorMessage(context);

  // Show as information message with markdown formatting
  await vscode.window.showInformationMessage(message, {
    modal: false,
    detail: `Feature: ${context.feature}\nAttempted Provider: ${context.attemptedProvider}`,
  });
}

/**
 * Handle provider error and suggest switching to Ollama if available
 */
export async function handleProviderError(context: ProviderErrorContext): Promise<boolean> {
  const { availability, attemptedProvider } = context;

  // If trying Copilot and Ollama is available, offer to switch
  if (attemptedProvider === 'copilot' && availability.ollamaAvailable) {
    const choice = await vscode.window.showWarningMessage(
      `GitHub Copilot is not available, but Ollama is detected. Switch to Ollama provider?`,
      { modal: true },
      'Yes, switch to Ollama',
      'No, show setup instructions'
    );

    if (choice === 'Yes, switch to Ollama') {
      await vscode.workspace
        .getConfiguration('gptAiMarkdownEditor')
        .update('llmProvider', 'Ollama', vscode.ConfigurationTarget.Global);
      return true; // Provider switched, retry
    }
  }

  // Show detailed setup instructions
  await showProviderError(context);
  return false; // Could not retry
}
