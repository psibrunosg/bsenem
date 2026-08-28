import { describe, it, expect } from 'vitest';
import { MarkdownEditor } from '../components/MarkdownEditor.js';

describe('MarkdownEditor', () => {
  it('renders note fields as text instead of executable HTML', () => {
    const editor = new MarkdownEditor({
      title: '<img src=x onerror=alert(1)>',
      content: '</textarea><img src=x onerror=alert(1)>',
      tags: ['<img src=x onerror=alert(1)>']
    });

    const element = editor.render();

    expect(element.querySelectorAll('img')).toHaveLength(0);
    expect(element.querySelector('.editor-textarea').value).toContain('<img src=x onerror=alert(1)>');
  });

  it('does not create executable links in the Markdown preview', () => {
    const editor = new MarkdownEditor({ content: '[Abrir](javascript:alert)' });
    const element = editor.render();
    const link = element.querySelector('.editor-preview-content a');

    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('#');
  });
});
