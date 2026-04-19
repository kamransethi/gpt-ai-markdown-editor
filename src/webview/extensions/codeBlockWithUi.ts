import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';

const CODE_BLOCK_LANGUAGES = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'css', label: 'CSS' },
  { value: 'html', label: 'HTML' },
  { value: 'sql', label: 'SQL' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'mermaid', label: 'Mermaid' },
];

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export const CodeBlockWithUi = CodeBlockLowlight.extend({
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let currentNode = node;

      const dom = document.createElement('div');
      dom.className = 'code-block-ui';

      const header = document.createElement('div');
      header.className = 'code-block-ui-header';

      const languageSelect = document.createElement('select');
      languageSelect.className = 'code-block-ui-language';
      languageSelect.setAttribute('aria-label', 'Code block language');
      CODE_BLOCK_LANGUAGES.forEach(language => {
        const option = document.createElement('option');
        option.value = language.value;
        option.textContent = language.label;
        languageSelect.appendChild(option);
      });
      languageSelect.value = (currentNode.attrs.language as string) || 'plaintext';

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'code-block-ui-copy';
      copyButton.textContent = 'Copy';

      const pre = document.createElement('pre');
      pre.className = 'code-block-highlighted code-block-ui-pre';

      const code = document.createElement('code');
      code.className = `language-${(currentNode.attrs.language as string) || 'plaintext'}`;
      pre.appendChild(code);

      header.appendChild(languageSelect);
      header.appendChild(copyButton);
      dom.appendChild(header);
      dom.appendChild(pre);

      languageSelect.addEventListener('change', () => {
        const pos = getPos();
        if (typeof pos !== 'number') {
          return;
        }

        const language = languageSelect.value || 'plaintext';
        const attrs = { ...currentNode.attrs, language };
        const transaction = editor.state.tr.setNodeMarkup(pos, undefined, attrs);
        editor.view.dispatch(transaction);
      });

      copyButton.addEventListener('click', async () => {
        await copyTextToClipboard(currentNode.textContent);
        copyButton.textContent = 'Copied';
        window.setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 1000);
      });

      const stopPropagation = (event: Event) => {
        event.stopPropagation();
      };

      header.addEventListener('click', stopPropagation);
      header.addEventListener('mousedown', stopPropagation);
      languageSelect.addEventListener('keydown', stopPropagation);

      return {
        dom,
        contentDOM: code,
        update: updatedNode => {
          if (updatedNode.type.name !== this.name) {
            return false;
          }

          currentNode = updatedNode;
          const nextLanguage = (updatedNode.attrs.language as string) || 'plaintext';
          languageSelect.value = nextLanguage;
          code.className = `language-${nextLanguage}`;
          return true;
        },
        stopEvent: event => {
          const target = event.target as HTMLElement | null;
          return Boolean(target?.closest('.code-block-ui-header'));
        },
      };
    };
  },
});
