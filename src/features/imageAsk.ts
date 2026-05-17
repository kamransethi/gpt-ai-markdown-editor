/**
 * Copyright (c) 2025-2026 DK-AI
 *
 * Extension-host Image AI Ask handler.
 * Receives an image path/URL + action from the webview, loads the image,
 * sends it to the vision-capable LLM, and streams the response back.
 *
 * @module imageAsk (extension host)
 */

import * as vscode from 'vscode';
import { MessageType } from '../shared/messageTypes';
import { createImageLlmProvider, getImageModelDisplayName } from './llm/providerFactory';
import type { LlmMessage } from './llm/types';
import { getProviderAvailabilityCached } from './llm/providerAvailability';

export type ImageAskAction = 'explain' | 'altText' | 'extractText' | 'describe' | 'custom';

const ACTION_PROMPTS: Record<Exclude<ImageAskAction, 'custom'>, string> = {
  explain:
    'Explain this image in detail. Describe what it shows, its purpose, and any key information visible. ' +
    'Write clearly for someone who cannot see the image.',
  altText:
    'Generate a concise, descriptive alt text for this image suitable for use in an HTML alt attribute. ' +
    'Keep it under 125 characters. Return ONLY the alt text string, nothing else.',
  extractText:
    'Extract all visible text from this image. Preserve the original formatting as much as possible — ' +
    'use code blocks for code, preserve line breaks, and maintain table structures. ' +
    'Return only the extracted text, no commentary.',
  describe:
    'Write a documentation-quality paragraph describing this image. ' +
    'The description should be suitable for inclusion in technical documentation alongside the image. ' +
    'Be precise and informative, describing diagrams, charts, or UI elements shown.',
};

const SYSTEM_PROMPT =
  'You are a vision assistant embedded in a markdown editor. ' +
  'The user will show you an image along with a specific instruction. ' +
  'Follow the instruction precisely. Be concise and helpful.';

/** Maximum image size in bytes before we skip (4 MB base64 ≈ 3 MB raw). */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * Load image data as base64 from a workspace-relative path or absolute URI.
 */
async function loadLocalImage(imagePath: string, document: vscode.TextDocument): Promise<string> {
  // Handle webview URIs by attempting to fetch them directly
  if (imagePath.startsWith('vscode-webview://')) {
    try {
      const response = await fetch(imagePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch webview image (${response.status})`);
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        throw new Error(
          `Image is too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). ` +
            'Please use an image under 4 MB.'
        );
      }
      console.log('[DK-AI] Image Ask: Loaded webview image, size:', buffer.byteLength, 'bytes');
      return Buffer.from(buffer).toString('base64');
    } catch (err) {
      console.error('[DK-AI] Image Ask: Failed to load webview image:', err);
      throw new Error(
        `Unable to load webview image. This can happen if the image is still being uploaded. ` +
          `Please wait for the image to fully load before analyzing it.`,
        { cause: err }
      );
    }
  }

  const docDir = vscode.Uri.joinPath(document.uri, '..');
  // Try workspace-relative first, then absolute
  let imageUri: vscode.Uri;
  if (imagePath.startsWith('/') || /^[a-zA-Z]:/.test(imagePath)) {
    imageUri = vscode.Uri.file(imagePath);
  } else {
    imageUri = vscode.Uri.joinPath(docDir, imagePath);
  }

  console.log('[DK-AI] Image Ask: Loading local image from:', imageUri.toString());
  const data = await vscode.workspace.fs.readFile(imageUri);
  if (data.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image is too large (${(data.byteLength / 1024 / 1024).toFixed(1)} MB). ` +
        'Please use an image under 4 MB.'
    );
  }
  console.log('[DK-AI] Image Ask: Loaded local image, size:', data.byteLength, 'bytes');
  return Buffer.from(data).toString('base64');
}

/**
 * Fetch an external image URL and return base64.
 */
async function fetchExternalImage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url} (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image is too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). ` +
        'Please use an image under 4 MB.'
    );
  }
  return Buffer.from(buffer).toString('base64');
}

export interface ImageAskRequest {
  action: ImageAskAction;
  imageSrc: string;
  imageAlt?: string;
  customPrompt?: string;
}

/**
 * Handle an image AI ask request from the webview.
 */
export async function handleImageAskRequest(
  webview: vscode.Webview,
  data: ImageAskRequest,
  document: vscode.TextDocument
): Promise<void> {
  try {
    // Check provider availability first
    const availability = await getProviderAvailabilityCached();
    const selectedProvider = vscode.workspace
      .getConfiguration('gptAiMarkdownEditor')
      .get<string>('llmProvider', 'GitHub Copilot');

    // Log current settings for diagnostics
    const visionProvider = vscode.workspace
      .getConfiguration('gptAiMarkdownEditor')
      .get<string>('llmVisionProvider', 'Ollama');
    const ollamaImageModel = vscode.workspace
      .getConfiguration('gptAiMarkdownEditor')
      .get<string>('ollamaImageModel', 'llama3.2-vision:latest');
    console.log(
      '[DK-AI] Image Ask: Vision settings - Provider:',
      visionProvider,
      'Model:',
      ollamaImageModel
    );

    if (selectedProvider === 'GitHub Copilot' && !availability.copilotAvailable) {
      webview.postMessage({
        type: MessageType.IMAGE_ASK_RESULT,
        success: false,
        action: data.action,
        error:
          'GitHub Copilot is not available. Please configure Ollama with a vision model or sign up for GitHub Copilot.',
      });
      return;
    }

    if (selectedProvider === 'Ollama' && !availability.ollamaAvailable) {
      webview.postMessage({
        type: MessageType.IMAGE_ASK_RESULT,
        success: false,
        action: data.action,
        error:
          'Ollama is not reachable. Please ensure Ollama is running at the configured endpoint.',
      });
      return;
    }

    // Note: isVisionCapable() now trusts user's model choice.
    // If user configures a non-vision model, they'll get an error from Ollama itself.

    // Load image data
    let imageBase64: string;
    const src = data.imageSrc;
    console.log('[DK-AI] Image Ask: Received imageSrc:', src);
    console.log('[DK-AI] Image Ask: Action:', data.action);

    if (src.startsWith('data:')) {
      // Data URI — extract base64 portion
      const match = src.match(/^data:[^;]+;base64,(.+)$/);
      if (!match) {
        throw new Error('Invalid data URI for image.');
      }
      imageBase64 = match[1];
      console.log('[DK-AI] Image Ask: Extracted base64 from data URI, length:', imageBase64.length);
    } else if (src.startsWith('http://') || src.startsWith('https://')) {
      imageBase64 = await fetchExternalImage(src);
      console.log('[DK-AI] Image Ask: Fetched external image, base64 length:', imageBase64.length);
    } else {
      console.log('[DK-AI] Image Ask: Loading as local image');
      imageBase64 = await loadLocalImage(src, document);
      console.log('[DK-AI] Image Ask: Converted to base64, length:', imageBase64.length);
    }

    // Sanity check: image data should not be empty
    if (!imageBase64 || imageBase64.length === 0) {
      throw new Error('Image data is empty. The image may not have loaded correctly.');
    }

    if (imageBase64.length < 100) {
      console.warn(
        '[DK-AI] Image Ask: Warning - Image data very small (',
        imageBase64.length,
        'bytes). May be invalid.'
      );
    }

    // Build prompt
    let userPrompt: string;
    if (data.action === 'custom') {
      userPrompt = data.customPrompt || 'Describe this image.';
    } else {
      userPrompt = ACTION_PROMPTS[data.action];
    }

    if (data.action === 'altText' && data.imageAlt) {
      userPrompt += `\n\nThe image currently has this alt text: "${data.imageAlt}". Improve upon it if needed.`;
    }

    const provider = createImageLlmProvider();
    const modelName = getImageModelDisplayName();
    const abortController = new AbortController();
    console.log('[DK-AI] Image Ask: Using provider:', modelName);

    const messages: LlmMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    // Use vision-capable generation
    if (!provider.generateWithVision) {
      throw new Error('The configured LLM provider does not support vision inputs.');
    }

    console.log(
      '[DK-AI] Image Ask: Starting vision generation with',
      imageBase64.length,
      'char base64'
    );
    let result = '';
    for await (const chunk of provider.generateWithVision(
      messages,
      [imageBase64],
      abortController.signal
    )) {
      result += chunk;
    }

    console.log('[DK-AI] Image Ask: Vision generation complete, result length:', result.length);
    webview.postMessage({
      type: MessageType.IMAGE_ASK_RESULT,
      success: true,
      action: data.action,
      response: result.trim(),
      modelName,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[DK-AI] Image Ask error:', errMsg);

    webview.postMessage({
      type: MessageType.IMAGE_ASK_RESULT,
      success: false,
      action: data.action,
      error: `Image analysis failed: ${errMsg}`,
    });
  }
}
