// src/pages/NotesPage.js
import { MarkdownEditor } from '@components/MarkdownEditor.js';

import { api } from '@utils/api.js';

export class NotesPage {
  constructor(options = {}) {
    this.app = options.app;
    this.subjects = options.subjects ?? [];
    this.currentView = 'editor'; // 'editor' | 'list'
    
    this.editor = null;
    this.notes = [];
    this.currentNote = null;
    this.element = null;
  }

  async loadNotes() {
    try {
      const res = await api.get('/notes');
      if (res.success) {
        this.notes = res.data;
        this.updateNotesList();
      }
    } catch (e) {
      console.error('Failed to load notes', e);
    }
  }

  async saveNotes(note) {
    try {
      if (note.isNew) {
        const res = await api.post('/notes', note);
        if (res.success) {
          note.id = res.data.id;
          delete note.isNew;
        }
      } else {
        await api.put(\`/notes/\${note.id}\`, note);
      }
    } catch (e) {
      console.error('Failed to save note', e);
    }
  }

  async generateFlashcards() {
    if (!this.currentNote || this.currentNote.isNew) {
      alert('Salve a anotação primeiro antes de gerar flashcards!');
      return;
    }
    
    // Create an overlay spinner
    const btn = this.element.querySelector('[data-action="ai-flashcards"]');
    if (btn) btn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border-color: var(--orange-500); border-top-color: transparent;"></div>';
    
    try {
      const res = await api.post(/notes/\/flashcards);
      if (res.success) {
        alert(res.data.message || 'Flashcards gerados com sucesso!');
      } else {
        alert(res.error || 'Erro ao gerar flashcards.');
      }
    } catch (e) {
      alert('Erro de conexão.');
    } finally {
      if (btn) btn.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4"></i>';
      if (typeof lucide !== 'undefined') lucide.createIcons(btn.parentElement);
    }
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'notes-page';
    
    this.element.innerHTML = `
      <div class="page-header">
        <h1>Anotações</h1>
        <p>Crie e organize suas notas em Markdown</p>
      </div>
      
      <div class="notes-layout">
        <div class="notes-sidebar">
          <div class="notes-sidebar-header" style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-primary btn-sm" data-action="new-note" style="flex: 1;">
                <i data-lucide="plus" class="w-4 h-4"></i> Nova
              </button>
              <button class="btn btn-secondary btn-sm" data-action="feynman-challenge" style="flex: 1;" title="Método Feynman">
                <i data-lucide="brain" class="w-4 h-4"></i> Feynman
              </button>
            </div>
            <input type="text" class="input" placeholder="Buscar notas..." data-action="search">
          </div>
          
          <div class="notes-list">
            ${this.renderNotesList()}
          </div>
        </div>
        
        <div class="notes-editor-container">
          ${this.currentNote ? '' : this.renderEmptyState()}
        </div>
      </div>
    `;

    if (this.currentNote) {
      this.initEditor();
    }

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    this.loadNotes();

    return this.element;
  }

  renderEmptyState() {
    return `
      <div class="notes-empty">
        <i data-lucide="file-text" class="w-16 h-16"></i>
        <h3>Selecione uma nota ou crie uma nova</h3>
        <p>Suas anotações ficam salvas localmente no navegador.</p>
      </div>
    `;
  }

  renderNotesList(filter = '') {
    let filteredNotes = this.notes;

    if (filter) {
      const search = filter.toLowerCase();
      filteredNotes = filteredNotes.filter(note => 
        note.title.toLowerCase().includes(search) || 
        note.content.toLowerCase().includes(search) ||
        note.tags?.some(tag => tag.toLowerCase().includes(search))
      );
    }

    if (filteredNotes.length === 0) {
      return `
        <div class="notes-list-empty">
          <p>Nenhuma nota encontrada</p>
        </div>
      `;
    }

    return filteredNotes.map(note => `
      <div class="notes-list-item ${this.currentNote?.id === note.id ? 'active' : ''}" data-note-id="${note.id}">
        <div class="notes-list-item-title">${note.title || 'Sem título'}</div>
        <div class="notes-list-item-preview">${this.getPreview(note.content)}</div>
        <div class="notes-list-item-meta">
          <span class="notes-list-item-date">${this.formatDate(note.updatedAt)}</span>
          ${note.tags?.length ? `
            <div class="notes-list-item-tags">
              ${note.tags.slice(0, 2).map(tag => `<span class="notes-tag">${tag}</span>`).join('')}
              ${note.tags.length > 2 ? `<span class="notes-tag more">+${note.tags.length - 2}</span>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  initEditor() {
    const container = this.element.querySelector('.notes-editor-container');
    if (!container) return;

    this.editor = new MarkdownEditor({
      onAIFlashcards: () => this.generateFlashcards(),

      title: this.currentNote.title,
      content: this.currentNote.content,
      tags: this.currentNote.tags || [],
      onChange: (content) => this.handleContentChange(content),
      onSave: (data) => this.handleSave(data),
      onLinkClick: (target) => this.handleLinkClick(target)
    });

    container.innerHTML = '';
    container.appendChild(this.editor.render());
  }

  bindEvents() {
    this.element.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      switch (action) {
        case 'new-note':
          this.createNote();
          break;
        case 'feynman-challenge':
          this.createFeynmanNote();
          break;
      }

      // Note selection
      const noteItem = e.target.closest('.notes-list-item');
      if (noteItem) {
        const noteId = noteItem.dataset.noteId;
        this.selectNote(noteId);
      }
    });

    // Search
    const searchInput = this.element.querySelector('[data-action="search"]');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.updateNotesList(e.target.value);
      });
    }
  }

  createNote() {
    const note = {
      id: `temp_${Date.now()}`,
      title: 'Nova Nota',
      content: '',
      tags: [],
      wikiLinks: [],
      isNew: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.notes.unshift(note);
    this.saveNotes(note);
    this.selectNote(note.id);
    this.updateNotesList();
  }

  createFeynmanNote() {
    const feynmanTemplate = `# Método Feynman: [Tema Aqui]

## 1. O Conceito (Simplifique)
*Explique o conceito como se estivesse ensinando para uma criança de 12 anos. Evite jargões.*
> Escreva aqui...

## 2. A Analogia
*Crie uma analogia do dia a dia para fixar.*
> Isso é como quando...

## 3. Identificação de Lacunas
*O que ficou confuso na sua própria explicação?*
- [ ] Ponto que preciso revisar: ...

## 4. Revisão (Simplifique mais)
*Reescreva a explicação de forma ainda mais clara.*
> Nova explicação...
`;

    const note = {
      id: \`temp_\${Date.now()}\`,
      title: 'Novo Desafio Feynman',
      content: feynmanTemplate,
      tags: ['feynman'],
      wikiLinks: [],
      isNew: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.notes.unshift(note);
    this.saveNotes(note);
    this.selectNote(note.id);
    this.updateNotesList();
  }

  selectNote(noteId) {
    this.currentNote = this.notes.find(n => n.id === noteId) || null;
    
    // Update list selection
    this.element.querySelectorAll('.notes-list-item').forEach(item => {
      item.classList.toggle('active', item.dataset.noteId === noteId);
    });

    // Initialize editor
    this.initEditor();
  }

  handleContentChange(content) {
    if (!this.currentNote) return;
    
    this.currentNote.content = content;
    this.currentNote.updatedAt = new Date().toISOString();
    this.saveNotes(this.currentNote);
  }

  handleSave(data) {
    if (!this.currentNote) return;

    this.currentNote.title = data.title;
    this.currentNote.content = data.content;
    this.currentNote.tags = data.tags;
    this.currentNote.wikiLinks = data.wikiLinks;
    this.currentNote.updatedAt = new Date().toISOString();

    this.saveNotes(this.currentNote);
    this.updateNotesList();
    
    // Show success feedback
    this.showToast('Nota salva com sucesso!');
  }

  handleLinkClick(target) {
    // Try to find note by title
    const note = this.notes.find(n => 
      n.title.toLowerCase() === target.toLowerCase()
    );

    if (note) {
      this.selectNote(note.id);
    } else {
      // Create new note with this title
      const newNote = {
        id: `temp_${Date.now()}`,
        title: target,
        content: '',
        tags: [],
        wikiLinks: [],
        isNew: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.notes.unshift(newNote);
      this.saveNotes(newNote);
      this.selectNote(newNote.id);
      this.updateNotesList();
    }
  }

  updateNotesList(filter = '') {
    const list = this.element.querySelector('.notes-list');
    if (list) {
      list.innerHTML = this.renderNotesList(filter);
    }
  }

  getPreview(content, maxLength = 80) {
    if (!content) return 'Nota vazia...';
    
    // Remove markdown syntax for preview
    const plain = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
    
    return plain.length > maxLength ? plain.substring(0, maxLength) + '...' : plain;
  }

  formatDate(dateStr) {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) return 'Agora';
    
    // Less than 1 hour
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
    
    // Less than 24 hours
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
    
    // Less than 7 days
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d atrás`;
    
    // Otherwise
    return date.toLocaleDateString('pt-BR');
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    }, 10);
  }

  destroy() {
    this.editor?.destroy();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}


