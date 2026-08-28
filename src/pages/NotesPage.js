// src/pages/NotesPage.js
import { MarkdownEditor } from '@components/MarkdownEditor.js';

export class NotesPage {
  constructor(options = {}) {
    this.app = options.app;
    this.subjects = options.subjects ?? [];
    this.currentView = 'editor'; // 'editor' | 'list'
    
    this.editor = null;
    this.notes = this.loadNotes();
    this.currentNote = null;
    this.element = null;
  }

  loadNotes() {
    try {
      const data = localStorage.getItem('bsenem_notes');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveNotes() {
    localStorage.setItem('bsenem_notes', JSON.stringify(this.notes));
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
          <div class="notes-sidebar-header">
            <button class="btn btn-primary btn-sm" data-action="new-note">
              <i data-lucide="plus" class="w-4 h-4"></i>
              Nova Nota
            </button>
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
      <div class="notes-list-item ${this.currentNote?.id === note.id ? 'active' : ''}" data-note-id="${this.escapeHtml(note.id)}">
        <div class="notes-list-item-title">${this.escapeHtml(note.title || 'Sem título')}</div>
        <div class="notes-list-item-preview">${this.getPreview(note.content)}</div>
        <div class="notes-list-item-meta">
          <span class="notes-list-item-date">${this.formatDate(note.updatedAt)}</span>
          ${note.tags?.length ? `
            <div class="notes-list-item-tags">
              ${note.tags.slice(0, 2).map(tag => `<span class="notes-tag">${this.escapeHtml(tag)}</span>`).join('')}
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
      id: `note_${Date.now()}`,
      title: '',
      content: '',
      tags: [],
      wikiLinks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.notes.unshift(note);
    this.saveNotes();
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
    this.saveNotes();
  }

  handleSave(data) {
    if (!this.currentNote) return;

    this.currentNote.title = data.title;
    this.currentNote.content = data.content;
    this.currentNote.tags = data.tags;
    this.currentNote.wikiLinks = data.wikiLinks;
    this.currentNote.updatedAt = new Date().toISOString();

    this.saveNotes();
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
        id: `note_${Date.now()}`,
        title: target,
        content: '',
        tags: [],
        wikiLinks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.notes.unshift(newNote);
      this.saveNotes();
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
    
    const preview = plain.length > maxLength ? plain.substring(0, maxLength) + '...' : plain;
    return this.escapeHtml(preview);
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

  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  destroy() {
    this.editor?.destroy();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
