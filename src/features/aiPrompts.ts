import * as vscode from 'vscode';
import * as fs from 'fs/promises';

export interface CustomPrompt {
  id: string;
  label: string;
  prompt: string;
  systemPrompt?: string;
  type?: 'explain' | 'inline';
}

const DEFAULT_PROMPTS: CustomPrompt[] = [
  {
    id: 'summary',
    label: 'Generate Summary',
    type: 'explain',
    prompt:
      'Produce a clear, structured summary that helps the reader quickly understand the content. Use this format:\n# Summary\nA 2-3 sentence overview.\n\n## Key Points\n- Bullet point for each major concept.\n\nKeep it concise (under 500 words). Do NOT include markdown code fences.',
    systemPrompt:
      'You are a document analysis assistant embedded in a markdown editor. The user will give you the full text of a technical document.',
  },
  {
    id: 'score_requirements',
    label: 'Score Quality as Requirements',
    type: 'explain',
    prompt:
      'You are an expert Product Manager. Review this document and score it out of 10 based on clarity, testability, and completeness. List missing edge cases and ambiguites.',
    systemPrompt: 'You are a document analysis assistant embedded in a markdown editor.',
  },
  {
    id: 'improve',
    label: 'Recommend 5 Ways to Improve',
    type: 'explain',
    prompt:
      'Analyze this document and output exactly 5 highly actionable recommendations to improve structure, tone, and clarity. Format as a bulleted list.',
    systemPrompt: 'You are a document analysis assistant embedded in a markdown editor.',
  },
  {
    id: 'acceptance_criteria',
    label: 'Check acceptance criteria & recommend changes',
    type: 'explain',
    prompt:
      'Analyze the acceptance criteria in this document. Identify any ambiguities, suggest improvements, and draft missing negative test cases.',
    systemPrompt: 'You are a document analysis assistant embedded in a markdown editor.',
  },
];

export async function getCustomPrompts(): Promise<CustomPrompt[]> {
  const customFile = vscode.workspace
    .getConfiguration('gptAiMarkdownEditor')
    .get<string>('customPromptsFile', '');

  if (!customFile) {
    return DEFAULT_PROMPTS;
  }

  try {
    const content = await fs.readFile(customFile, 'utf8');
    const parsed = JSON.parse(content) as CustomPrompt[];

    if (Array.isArray(parsed)) {
      return parsed; // User overrides EVERYTHING if they provide a file
    }
  } catch (error) {
    console.error('[DK-AI] Failed to read custom AI prompts JSON:', error);
  }

  // Fallback to default
  return DEFAULT_PROMPTS;
}

export async function getPromptById(id: string): Promise<CustomPrompt | undefined> {
  const prompts = await getCustomPrompts();
  return prompts.find(p => p.id === id);
}
