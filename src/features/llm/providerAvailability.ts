/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as vscode from 'vscode';

/**
 * Environment where the extension is running
 */
export type Environment = 'vscode' | 'cursor' | 'windsurf' | 'unknown';

/**
 * Provider availability state
 */
export interface ProviderAvailability {
  copilotAvailable: boolean;
  ollamaAvailable: boolean;
  environment: Environment;
}

/**
 * Detect the current environment (VS Code, Cursor, Windsurf, etc.)
 */
export function detectEnvironment(): Environment {
  // Check for environment indicators
  const env = process.env;

  // Cursor IDE sets specific environment variables
  if (env.CURSOR_DIRECTORY) {
    return 'cursor';
  }

  // Windsurf detection - check for windsurf-specific markers
  if (env.WINDSURF_DIR || env.WINDSURF_WORKSPACE) {
    return 'windsurf';
  }

  // Check vscode command line argument in process title/argv
  // Cursor and Windsurf run as VS Code, so we need to detect via other means
  const appName = (vscode as any).appRoot || '';
  if (appName.toLowerCase().includes('cursor')) {
    return 'cursor';
  }
  if (appName.toLowerCase().includes('windsurf')) {
    return 'windsurf';
  }

  return 'vscode';
}

/**
 * Check if GitHub Copilot is available by attempting to select chat models
 */
export async function isCopilotAvailable(): Promise<boolean> {
  try {
    if (!vscode.lm) {
      return false;
    }

    const models = await vscode.lm.selectChatModels();
    return models && models.length > 0;
  } catch {
    // Copilot not available or error accessing models
    return false;
  }
}

/**
 * Check if Ollama is reachable at the configured endpoint
 * Uses a non-blocking HEAD request with 2-second timeout
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const config = vscode.workspace.getConfiguration('gptAiMarkdownEditor');
    const ollamaEndpoint = config.get<string>('ollamaEndpoint') || 'http://localhost:11434';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${ollamaEndpoint}/api/tags`, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    // Timeout, network error, or other failure means Ollama is not available
    return false;
  }
}

/**
 * Get current provider availability state
 * Checks both Copilot and Ollama, detects environment
 */
export async function getProviderAvailability(): Promise<ProviderAvailability> {
  const [copilotAvailable, ollamaAvailable] = await Promise.all([
    isCopilotAvailable(),
    isOllamaAvailable(),
  ]);

  return {
    copilotAvailable,
    ollamaAvailable,
    environment: detectEnvironment(),
  };
}

/**
 * Cache for provider availability to avoid excessive checks
 * Invalidates every 30 seconds
 */
let cachedAvailability: ProviderAvailability | null = null;
let cacheExpiry: number = 0;

/**
 * Get provider availability with caching (30-second TTL)
 */
export async function getProviderAvailabilityCached(): Promise<ProviderAvailability> {
  const now = Date.now();
  if (cachedAvailability && now < cacheExpiry) {
    return cachedAvailability;
  }

  cachedAvailability = await getProviderAvailability();
  cacheExpiry = now + 30000; // 30-second cache
  return cachedAvailability;
}

/**
 * Invalidate the provider availability cache
 */
export function invalidateProviderCache(): void {
  cachedAvailability = null;
  cacheExpiry = 0;
}
