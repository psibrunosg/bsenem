// src/components/MarkdownEditor.js
export class MarkdownEditor {
  constructor(options = {}) {
    this.content = options.content ?? '';
    this.title = options.title ?? '';
    this.tags = options.tags ?? [];
    this.wikiLinks = options.wikiLinks ?? [];
    
    this.onChange = options.onChange ?? (() => {});
    this.onSave = options.onSave ?? (() => {});
    this.onAIFlashcards = options.onAIFlashcards ?? (() => {});
    this.onLinkClick = options.onLinkClick ?? (() => {});
    
    this.element = null;
    this.previewMode = false;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'markdown-editor';
    
    this.element.innerHTML = `
      <div class="editor-header">
        <input type="text" class="editor-title-input" value="${this.escapeHtml(this.title)}" placeholder="Título da nota...">
        <div class="editor-actions">
          <button class="editor-action-btn" data-action="ai-flashcards" title="Gerar Flashcards (IA)" style="color: var(--orange-500);">
            <i data-lucide="sparkles" class="w-4 h-4"></i>
          </button>
          <button class="editor-action-btn" data-action="save" title="Salvar (Ctrl+S)">
            <i data-lucide="save" class="w-4 h-4"></i>
          </button>
          <button class="editor-action-btn" data-action="toggle-preview" title="Preview (Ctrl+P)">
            <i data-lucide="eye" class="w-4 h-4"></i>
          </button>
          <button class="editor-action-btn" data-action="fullscreen" title="Tela cheia">
            <i data-lucide="maximize" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
      
      <div class="editor-toolbar">
        <button class="toolbar-btn" data-action="bold" title="Negrito (Ctrl+B)">
          <i data-lucide="bold" class="w-4 h-4"></i>
        </button>
        <button class="toolbar-btn" data-action="italic" title="Itálico (Ctrl+I)">
          <i data-lucide="italic" class="w-4 h-4"></i>
        </button>
        <button class="toolbar-btn" data-action="strikethrough" title="Tachado">
          <i data-lucide="strikethrough" class="w-4 h-4"></i>
        </button>
        <span class="toolbar-separator"></span>
        <button class="toolbar-btn" data-action="h1" title="Título 1">
          <span class="toolbar-label">H1</span>
        </button>
        <button class="toolbar-btn" data-action="h2" title="Título 2">
          <span class="toolbar-label">H2</span>
        </button>
        <button class="toolbar-btn" data-action="h3" title="Título 3">
          <span class="toolbar-label">H3</span>
        </button>
        <span class="toolbar-separator"></span>
        <button class="toolbar-btn" data-action="ul" title="Lista">
          <i data-lucide="list" class="w-4 h-4"></i>
        </button>
        <button class="toolbar-btn" data-action="ol" title="Lista numerada">
          <i data-lucide="list-ordered" class="w-4 h-4"></i>
        </button>
        <button class="toolbar-btn" data-action="checklist" title="Checklist">
          <i data-lucide="check-square" class="w-4 h-4"></i>
        </button>
        <span class="toolbar-separator"></span>
        <button class="toolbar-btn" data-action="code" title="Código">
          <i data-lucide="code" class="w-4 h-4"></i>
        </button>
        <button class="toolbar-btn" data-action="codeblock" title="Bloco de código">
          <i data-lucide="terminal" class="w-4 h-4"></i>
        </button>
        <button class="toolbar-btn" data-action="quote" title="Citação">
          <i data-lucide="quote" class="w-4 h-4"></i>
        </button>
        <span class="toolbar-separator"></span>
        <button class="toolbar-btn" data-action="link" title="Link">
          <i data-lucide="link" class="w-4 h-4"></i>
        </button>
        <button class="toolbar-btn" data-action="image" title="Imagem">
          <i data-lucide="image" class="w-4 h-4"></i>
        </button>
        <button class="toolbar-btn" data-action="wikilink" title="Wiki-link [[...]]">
          <span class="toolbar-label">[[]]</span>
        </button>
        <span class="toolbar-separator"></span>
        <button class="toolbar-btn" data-action="table" title="Tabela">
          <i data-lucide="table" class="w-4 h-4"></i>
        </button>
        <button class="toolbar-btn" data-action="hr" title="Linha horizontal">
          <i data-lucide="minus" class="w-4 h-4"></i>
        </button>
      </div>
      
      <div class="editor-body">
        <div class="editor-write-mode">
          <textarea class="editor-textarea" placeholder="Escreva sua nota em Markdown...">${this.escapeHtml(this.content)}</textarea>
        </div>
        <div class="editor-preview-mode" style="display: none;">
          <div class="editor-preview-content markdown-body"></div>
        </div>
      </div>
      
      <div class="editor-footer">
        <div class="editor-tags">
          <i data-lucide="tag" class="w-4 h-4"></i>
          <div class="editor-tags-list">
            ${this.tags.map(tag => `
              <span class="editor-tag">
                ${this.escapeHtml(tag)}
                <button class="editor-tag-remove" data-tag="${this.escapeHtml(tag)}">&times;</button>
              </span>
            `).join('')}
          </div>
          <input type="text" class="editor-tag-input" placeholder="Adicionar tag...">
        </div>
        <div class="editor-info">
          <span class="editor-word-count">0 palavras</span>
          <span class="editor-char-count">0 caracteres</span>
        </div>
      </div>
    `;

    this.bindEvents();
    this.updatePreview();
    this.updateCounts();

    return this.element;
  }

  bindEvents() {
    // Toolbar actions
    this.element.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      switch (action) {
        case 'bold':
          this.insertFormat('**', '**');
          break;
        case 'italic':
          this.insertFormat('*', '*');
          break;
        case 'strikethrough':
          this.insertFormat('~~', '~~');
          break;
        case 'h1':
          this.insertLineStart('# ');
          break;
        case 'h2':
          this.insertLineStart('## ');
          break;
        case 'h3':
          this.insertLineStart('### ');
          break;
        case 'ul':
          this.insertLineStart('- ');
          break;
        case 'ol':
          this.insertLineStart('1. ');
          break;
        case 'checklist':
          this.insertLineStart('- [ ] ');
          break;
        case 'code':
          this.insertFormat('`', '`');
          break;
        case 'codeblock':
          this.insertFormat('```\n', '\n```');
          break;
        case 'quote':
          this.insertLineStart('> ');
          break;
        case 'link':
          this.insertFormat('[', '](url)');
          break;
        case 'image':
          this.insertFormat('![alt](', ')');
          break;
        case 'wikilink':
          this.insertFormat('[[', ']]');
          break;
        case 'table':
          this.insertTable();
          break;
        case 'hr':
          this.insertText('\n---\n');
          break;
        case 'save':
          this.handleSave();
          break;
        case 'toggle-preview':
          this.togglePreview();
          break;
        case 'fullscreen':
          this.toggleFullscreen();
          break;
      }
    });

    // Textarea input
    const textarea = this.element.querySelector('.editor-textarea');
    if (textarea) {
      textarea.addEventListener('input', () => {
        this.content = textarea.value;
        this.updatePreview();
        this.updateCounts();
        this.onChange(this.content);
      });

      // Keyboard shortcuts
      textarea.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
          switch (e.key.toLowerCase()) {
            case 's':
              e.preventDefault();
              this.handleSave();
              break;
            case 'p':
              e.preventDefault();
              this.togglePreview();
              break;
            case 'b':
              e.preventDefault();
              this.insertFormat('**', '**');
              break;
            case 'i':
              e.preventDefault();
              this.insertFormat('*', '*');
              break;
          }
        }
      });

      // Wiki-link detection
      textarea.addEventListener('input', (e) => {
        this.detectWikiLinks(textarea.value);
      });
    }

    // Tag input
    const tagInput = this.element.querySelector('.editor-tag-input');
    if (tagInput) {
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const tag = tagInput.value.trim().replace(',', '');
          if (tag && !this.tags.includes(tag)) {
            this.tags.push(tag);
            this.updateTags();
          }
          tagInput.value = '';
        }
      });
    }

    // Tag removal
    this.element.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.editor-tag-remove');
      if (removeBtn) {
        const tag = removeBtn.dataset.tag;
        this.tags = this.tags.filter(t => t !== tag);
        this.updateTags();
      }
    });

    // Wiki-link clicks
    this.element.addEventListener('click', (e) => {
      const link = e.target.closest('.wiki-link');
      if (link) {
        e.preventDefault();
        this.onLinkClick(link.dataset.target);
      }
    });
  }

  insertFormat(before, after) {
    const textarea = this.element.querySelector('.editor-textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    
    textarea.value = textarea.value.substring(0, start) + before + selected + after + textarea.value.substring(end);
    textarea.selectionStart = start + before.length;
    textarea.selectionEnd = start + before.length + selected.length;
    textarea.focus();
    
    this.content = textarea.value;
    this.updatePreview();
  }

  insertLineStart(prefix) {
    const textarea = this.element.querySelector('.editor-textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
    
    textarea.value = textarea.value.substring(0, lineStart) + prefix + textarea.value.substring(lineStart);
    textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
    textarea.focus();
    
    this.content = textarea.value;
    this.updatePreview();
  }

  insertText(text) {
    const textarea = this.element.querySelector('.editor-textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(start);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
    
    this.content = textarea.value;
    this.updatePreview();
  }

  insertTable() {
    const table = `
| Coluna 1 | Coluna 2 | Coluna 3 |
|----------|----------|----------|
| Célula 1 | Célula 2 | Célula 3 |
`;
    this.insertText(table);
  }

  togglePreview() {
    this.previewMode = !this.previewMode;
    
    const writeMode = this.element.querySelector('.editor-write-mode');
    const previewMode = this.element.querySelector('.editor-preview-mode');
    const toggleBtn = this.element.querySelector('[data-action="toggle-preview"]');
    
    if (writeMode) writeMode.style.display = this.previewMode ? 'none' : 'block';
    if (previewMode) previewMode.style.display = this.previewMode ? 'block' : 'none';
    
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', this.previewMode);
    }
    
    if (this.previewMode) {
      this.updatePreview();
    }
  }

  toggleFullscreen() {
    this.element.classList.toggle('fullscreen');
  }

  updatePreview() {
    const preview = this.element.querySelector('.editor-preview-content');
    if (!preview) return;

    let html = this.markdownToHtml(this.content);
    
    // Process wiki-links
    html = html.replace(/\[\[([^\]]+)\]\]/g, '<span class="wiki-link" data-target="$1">$1</span>');
    
    preview.innerHTML = html || '<p class="preview-placeholder">Nada para visualizar...</p>';
  }

  markdownToHtml(text) {
    if (!text) return '';

    let html = this.escapeHtml(text)
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
      // Headers
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Strikethrough
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      // Code
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Blockquotes
      .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
      // Lists
      .replace(/^- \[ \] (.*$)/gm, '<li class="task-item"><input type="checkbox" disabled> $1</li>')
      .replace(/^- \[x\] (.*$)/gm, '<li class="task-item"><input type="checkbox" checked disabled> $1</li>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
      // Images
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => `<img src="${this.safeUrl(url)}" alt="${alt}">`)
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => `<a href="${this.safeUrl(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`)
      // Horizontal rules
      .replace(/^---$/gm, '<hr>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
  }

  safeUrl(url) {
    const normalized = String(url).trim();
    if (normalized.startsWith('/') || normalized.startsWith('./') || normalized.startsWith('../')) {
      return normalized;
    }

    try {
      const parsed = new URL(normalized);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '#';
    } catch {
      return '#';
    }
  }

  detectWikiLinks(text) {
    const regex = /\[\[([^\]]+)\]\]/g;
    const links = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      links.push(match[1]);
    }
    
    this.wikiLinks = links;
  }

  updateTags() {
    const tagsList = this.element.querySelector('.editor-tags-list');
    if (!tagsList) return;

    tagsList.innerHTML = this.tags.map(tag => `
      <span class="editor-tag">
        ${this.escapeHtml(tag)}
        <button class="editor-tag-remove" data-tag="${this.escapeHtml(tag)}">&times;</button>
      </span>
    `).join('');
  }

  updateCounts() {
    const textarea = this.element.querySelector('.editor-textarea');
    const wordCount = this.element.querySelector('.editor-word-count');
    const charCount = this.element.querySelector('.editor-char-count');
    
    if (!textarea) return;

    const text = textarea.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    
    if (wordCount) wordCount.textContent = `${words} palavras`;
    if (charCount) charCount.textContent = `${chars} caracteres`;
  }

  handleSave() {
    const title = this.element.querySelector('.editor-title-input')?.value || '';
    this.onSave({
      title,
      content: this.content,
      tags: this.tags,
      wikiLinks: this.wikiLinks
    });
  }

  setTitle(title) {
    this.title = title;
    const titleInput = this.element.querySelector('.editor-title-input');
    if (titleInput) titleInput.value = title;
  }

  setContent(content) {
    this.content = content;
    const textarea = this.element.querySelector('.editor-textarea');
    if (textarea) textarea.value = content;
    this.updatePreview();
    this.updateCounts();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}


