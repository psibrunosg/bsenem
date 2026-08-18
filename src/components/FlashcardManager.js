// src/components/FlashcardManager.js
export class FlashcardManager {
  constructor(options = {}) {
    this.cards = options.cards ?? [];
    this.subjects = options.subjects ?? [];
    this.editingCard = null;
    
    this.onSave = options.onSave ?? (() => {});
    this.onDelete = options.onDelete ?? (() => {});
    this.onImport = options.onImport ?? (() => {});
    this.onExport = options.onExport ?? (() => {});
    
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'flashcard-manager';
    
    this.element.innerHTML = `
      <div class="flashcard-manager-header">
        <h2>Gerenciar Flashcards</h2>
        <div class="flashcard-manager-actions">
          <button class="btn btn-secondary" data-action="import">
            <i data-lucide="upload" class="w-4 h-4"></i>
            Importar
          </button>
          <button class="btn btn-secondary" data-action="export">
            <i data-lucide="download" class="w-4 h-4"></i>
            Exportar
          </button>
          <button class="btn btn-primary" data-action="new">
            <i data-lucide="plus" class="w-4 h-4"></i>
            Novo Card
          </button>
        </div>
      </div>
      
      <div class="flashcard-manager-form" style="display: none;">
        <div class="flashcard-form-header">
          <h3>Novo Card</h3>
          <button class="btn btn-ghost" data-action="cancel">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        
        <div class="flashcard-form-body">
          <div class="flashcard-form-group">
            <label for="card-front">Frente</label>
            <textarea id="card-front" class="input" rows="3" placeholder="Pergunta ou conceito..."></textarea>
          </div>
          
          <div class="flashcard-form-group">
            <label for="card-back">Verso</label>
            <textarea id="card-back" class="input" rows="3" placeholder="Resposta ou definição..."></textarea>
          </div>
          
          <div class="flashcard-form-row">
            <div class="flashcard-form-group">
              <label for="card-subject">Matéria</label>
              <select id="card-subject" class="select">
                <option value="">Selecione...</option>
                ${this.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>
            
            <div class="flashcard-form-group">
              <label for="card-tags">Tags (separadas por vírgula)</label>
              <input id="card-tags" type="text" class="input" placeholder="ex: funcao, quadratica,公式">
            </div>
          </div>
        </div>
        
        <div class="flashcard-form-footer">
          <button class="btn btn-secondary" data-action="cancel">Cancelar</button>
          <button class="btn btn-primary" data-action="save">Salvar</button>
        </div>
      </div>
      
      <div class="flashcard-manager-list">
        <div class="flashcard-list-header">
          <input type="text" class="input" placeholder="Buscar cards..." data-action="search">
          <select class="select" data-action="filter-subject">
            <option value="">Todas as matérias</option>
            ${this.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        
        <div class="flashcard-list-content">
          ${this.renderCardList()}
        </div>
      </div>
      
      <input type="file" id="import-input" accept=".json" style="display: none;">
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  renderCardList(filter = '', subjectFilter = '') {
    let filteredCards = this.cards;

    if (filter) {
      const search = filter.toLowerCase();
      filteredCards = filteredCards.filter(card => 
        card.front.toLowerCase().includes(search) || 
        card.back.toLowerCase().includes(search)
      );
    }

    if (subjectFilter) {
      filteredCards = filteredCards.filter(card => card.subject === subjectFilter);
    }

    if (filteredCards.length === 0) {
      return `
        <div class="flashcard-list-empty">
          <i data-lucide="layers" class="w-12 h-12"></i>
          <p>Nenhum card encontrado</p>
        </div>
      `;
    }

    return `
      <div class="flashcard-list">
        ${filteredCards.map(card => this.renderCardItem(card)).join('')}
      </div>
    `;
  }

  renderCardItem(card) {
    const subject = this.subjects.find(s => s.id === card.subject);
    
    return `
      <div class="flashcard-item" data-card-id="${card.id}">
        <div class="flashcard-item-content">
          <div class="flashcard-item-front">${card.front}</div>
          <div class="flashcard-item-back">${card.back}</div>
        </div>
        <div class="flashcard-item-meta">
          ${subject ? `<span class="flashcard-item-subject" style="color: ${subject.color}">${subject.name}</span>` : ''}
          <span class="flashcard-item-interval">${card.interval}d</span>
          <span class="flashcard-item-ease">EF: ${card.easeFactor.toFixed(1)}</span>
        </div>
        <div class="flashcard-item-actions">
          <button class="btn btn-ghost btn-sm" data-action="edit" data-card-id="${card.id}">
            <i data-lucide="edit" class="w-4 h-4"></i>
          </button>
          <button class="btn btn-ghost btn-sm" data-action="delete" data-card-id="${card.id}">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.element.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      switch (action) {
        case 'new':
          this.showForm();
          break;
        case 'cancel':
          this.hideForm();
          break;
        case 'save':
          this.saveCard();
          break;
        case 'edit': {
          const cardId = e.target.closest('[data-card-id]')?.dataset.cardId;
          this.editCard(cardId);
          break;
        }
        case 'delete': {
          const cardId = e.target.closest('[data-card-id]')?.dataset.cardId;
          this.deleteCard(cardId);
          break;
        }
        case 'import':
          this.element.querySelector('#import-input')?.click();
          break;
        case 'export':
          this.exportCards();
          break;
      }
    });

    // Search and filter
    this.element.addEventListener('input', (e) => {
      if (e.target.dataset.action === 'search') {
        this.updateList(e.target.value);
      }
    });

    this.element.addEventListener('change', (e) => {
      if (e.target.dataset.action === 'filter-subject') {
        this.updateList('', e.target.value);
      }
    });

    // Import
    this.element.querySelector('#import-input')?.addEventListener('change', (e) => {
      this.importCards(e.target.files[0]);
    });
  }

  showForm(card = null) {
    this.editingCard = card;
    
    const form = this.element.querySelector('.flashcard-manager-form');
    const list = this.element.querySelector('.flashcard-manager-list');
    
    if (form) {
      form.style.display = 'block';
      
      const frontInput = form.querySelector('#card-front');
      const backInput = form.querySelector('#card-back');
      const subjectInput = form.querySelector('#card-subject');
      const tagsInput = form.querySelector('#card-tags');
      
      if (frontInput) frontInput.value = card?.front || '';
      if (backInput) backInput.value = card?.back || '';
      if (subjectInput) subjectInput.value = card?.subject || '';
      if (tagsInput) tagsInput.value = card?.tags?.join(', ') || '';
    }
    
    if (list) list.style.display = 'none';
  }

  hideForm() {
    this.editingCard = null;
    
    const form = this.element.querySelector('.flashcard-manager-form');
    const list = this.element.querySelector('.flashcard-manager-list');
    
    if (form) {
      form.style.display = 'none';
      form.querySelectorAll('textarea, input').forEach(el => el.value = '');
    }
    
    if (list) list.style.display = 'block';
  }

  saveCard() {
    const form = this.element.querySelector('.flashcard-manager-form');
    if (!form) return;

    const front = form.querySelector('#card-front')?.value.trim();
    const back = form.querySelector('#card-back')?.value.trim();
    const subject = form.querySelector('#card-subject')?.value;
    const tagsStr = form.querySelector('#card-tags')?.value;
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

    if (!front || !back) return;

    const cardData = { front, back, subject, tags };

    if (this.editingCard) {
      this.onSave({ ...this.editingCard, ...cardData });
    } else {
      this.onSave(cardData);
    }

    this.hideForm();
    this.updateList();
  }

  editCard(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (card) {
      this.showForm(card);
    }
  }

  deleteCard(cardId) {
    this.onDelete(cardId);
    this.updateList();
  }

  exportCards() {
    this.onExport(this.cards);
  }

  importCards(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const cards = JSON.parse(e.target.result);
        this.onImport(cards);
        this.updateList();
      } catch (err) {
        console.error('Error importing cards:', err);
      }
    };
    reader.readAsText(file);
  }

  updateList(filter = '', subjectFilter = '') {
    const listContent = this.element.querySelector('.flashcard-list-content');
    if (listContent) {
      listContent.innerHTML = this.renderCardList(filter, subjectFilter);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
  }

  setCards(cards) {
    this.cards = cards;
    this.updateList();
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
