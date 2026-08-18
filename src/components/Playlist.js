// src/components/Playlist.js
export class Playlist {
  constructor(options = {}) {
    this.items = options.items ?? [];
    this.currentIndex = options.currentIndex ?? 0;
    this.isPlaying = options.isPlaying ?? false;
    this.shuffle = options.shuffle ?? false;
    this.repeatMode = options.repeatMode ?? 'none'; // 'none' | 'all' | 'one'
    this.draggedItem = null;
    this.draggedIndex = -1;
    
    // Callbacks
    this.onPlay = options.onPlay ?? (() => {});
    this.onPause = options.onPause ?? (() => {});
    this.onSelect = options.onSelect ?? (() => {});
    this.onReorder = options.onReorder ?? (() => {});
    this.onRemove = options.onRemove ?? (() => {});
    this.onShuffleChange = options.onShuffleChange ?? (() => {});
    this.onRepeatChange = options.onRepeatChange ?? (() => {});
    this.onClear = options.onClear ?? (() => {});
    this.onAddItem = options.onAddItem ?? (() => {});
    
    this.element = null;
    this.keyboardHandler = this.handleKeyboard.bind(this);
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'playlist';
    this.element.tabIndex = 0;
    
    this.element.innerHTML = `
      <div class="playlist-header">
        <div class="playlist-title">
          <i data-lucide="list-music" class="w-5 h-5"></i>
          <h3>Fila de Reprodução</h3>
          <span class="playlist-count">${this.items.length} ${this.items.length === 1 ? 'item' : 'itens'}</span>
        </div>
        <div class="playlist-actions">
          <button class="playlist-btn" aria-label="Embaralhar" data-action="shuffle" title="Embaralhar (S)">
            <i data-lucide="shuffle" class="w-5 h-5 ${this.shuffle ? 'active' : ''}"></i>
          </button>
          <button class="playlist-btn" aria-label="Repetir" data-action="repeat" title="Repetir (R)">
            <i data-lucide="${this.repeatMode === 'one' ? 'repeat-1' : 'repeat'}" class="w-5 h-5 ${this.repeatMode !== 'none' ? 'active' : ''}"></i>
          </button>
          <button class="playlist-btn" aria-label="Limpar fila" data-action="clear" title="Limpar fila">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
          </button>
        </div>
      </div>
      
      <div class="playlist-content">
        ${this.items.length === 0 ? this.renderEmpty() : this.renderList()}
      </div>
      
      <div class="playlist-footer">
        <button class="playlist-add-btn" data-action="add">
          <i data-lucide="plus" class="w-5 h-5"></i>
          <span>Adicionar à fila</span>
        </button>
      </div>
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  renderEmpty() {
    return `
      <div class="playlist-empty">
        <i data-lucide="music" class="w-12 h-12"></i>
        <p>Nenhum item na fila</p>
        <p class="playlist-empty-hint">Arraste arquivos ou clique em "Adicionar" para começar</p>
      </div>
    `;
  }

  renderList() {
    return `
      <ul class="playlist-list" role="listbox" aria-label="Fila de reprodução">
        ${this.items.map((item, index) => this.renderItem(item, index)).join('')}
      </ul>
    `;
  }

  renderItem(item, index) {
    const isActive = index === this.currentIndex;
    const isPlaying = isActive && this.isPlaying;
    
    return `
      <li 
        class="playlist-item ${isActive ? 'active' : ''}" 
        data-index="${index}"
        draggable="true"
        role="option"
        aria-selected="${isActive}"
      >
        <div class="playlist-item-drag" aria-hidden="true">
          <i data-lucide="grip-vertical" class="w-4 h-4"></i>
        </div>
        
        <div class="playlist-item-number">
          ${isPlaying ? `
            <div class="playlist-item-playing">
              <span></span><span></span><span></span>
            </div>
          ` : `
            <span class="playlist-item-index">${index + 1}</span>
            <i data-lucide="play" class="w-4 h-4 playlist-item-play-icon"></i>
          `}
        </div>
        
        <div class="playlist-item-thumbnail">
          ${item.thumbnail ? `
            <img src="${item.thumbnail}" alt="" loading="lazy">
          ` : `
            <i data-lucide="${item.type === 'video' ? 'play-circle' : 'music'}" class="w-6 h-6"></i>
          `}
        </div>
        
        <div class="playlist-item-info">
          <div class="playlist-item-title">${item.title}</div>
          <div class="playlist-item-artist">${item.artist || item.subject || ''}</div>
          <div class="playlist-item-duration">${this.formatTime(item.duration)}</div>
        </div>
        
        <div class="playlist-item-actions">
          <button class="playlist-item-btn" aria-label="Opções" data-action="item-menu" data-index="${index}">
            <i data-lucide="more-vertical" class="w-4 h-4"></i>
          </button>
          <button class="playlist-item-btn playlist-item-remove" aria-label="Remover" data-action="remove" data-index="${index}">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
      </li>
    `;
  }

  bindEvents() {
    // Control events (delegated)
    this.element.addEventListener('click', (e) => this.handleClick(e));
    
    // Drag and drop
    this.element.addEventListener('dragstart', (e) => this.handleDragStart(e));
    this.element.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.element.addEventListener('dragenter', (e) => this.handleDragEnter(e));
    this.element.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    this.element.addEventListener('drop', (e) => this.handleDrop(e));
    this.element.addEventListener('dragend', (e) => this.handleDragEnd(e));
    
    // Keyboard
    this.element.addEventListener('keydown', this.keyboardHandler);
  }

  handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    switch (action) {
      case 'shuffle':
        this.toggleShuffle();
        break;
      case 'repeat':
        this.cycleRepeatMode();
        break;
      case 'clear':
        this.clearPlaylist();
        break;
      case 'add':
        this.onAddItem();
        break;
      case 'remove': {
        const index = parseInt(e.target.closest('[data-index]')?.dataset.index);
        if (!isNaN(index)) this.removeItem(index);
        break;
      }
      case 'item-menu': {
        const index = parseInt(e.target.closest('[data-index]')?.dataset.index);
        if (!isNaN(index)) this.showItemMenu(index);
        break;
      }
    }

    // Click on playlist item (not on buttons)
    const item = e.target.closest('.playlist-item');
    if (item && !action) {
      const index = parseInt(item.dataset.index);
      if (!isNaN(index)) this.selectItem(index);
    }
  }

  handleKeyboard(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectPrevious();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.togglePlayPause();
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        this.removeItem(this.currentIndex);
        break;
      case 'Home':
        e.preventDefault();
        this.selectItem(0);
        break;
      case 'End':
        e.preventDefault();
        this.selectItem(this.items.length - 1);
        break;
    }
  }

  // Drag and drop
  handleDragStart(e) {
    const item = e.target.closest('.playlist-item');
    if (!item) return;
    
    this.draggedItem = item;
    this.draggedIndex = parseInt(item.dataset.index);
    
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.draggedIndex);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  handleDragEnter(e) {
    const item = e.target.closest('.playlist-item');
    if (item && item !== this.draggedItem) {
      item.classList.add('drag-over');
    }
  }

  handleDragLeave(e) {
    const item = e.target.closest('.playlist-item');
    if (item) {
      item.classList.remove('drag-over');
    }
  }

  handleDrop(e) {
    e.preventDefault();
    
    const targetItem = e.target.closest('.playlist-item');
    if (!targetItem || targetItem === this.draggedItem) return;
    
    const targetIndex = parseInt(targetItem.dataset.index);
    if (isNaN(targetIndex)) return;
    
    this.reorderItem(this.draggedIndex, targetIndex);
  }

  handleDragEnd(e) {
    if (this.draggedItem) {
      this.draggedItem.classList.remove('dragging');
    }
    
    this.element.querySelectorAll('.playlist-item').forEach(item => {
      item.classList.remove('drag-over');
    });
    
    this.draggedItem = null;
    this.draggedIndex = -1;
  }

  // Playlist controls
  toggleShuffle() {
    this.shuffle = !this.shuffle;
    
    const btn = this.element.querySelector('[data-action="shuffle"]');
    if (btn) {
      const icon = btn.querySelector('i');
      if (icon) icon.classList.toggle('active', this.shuffle);
    }
    
    this.onShuffleChange(this.shuffle);
  }

  cycleRepeatMode() {
    const modes = ['none', 'all', 'one'];
    const currentIndex = modes.indexOf(this.repeatMode);
    this.repeatMode = modes[(currentIndex + 1) % modes.length];
    
    const btn = this.element.querySelector('[data-action="repeat"]');
    if (btn) {
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.toggle('active', this.repeatMode !== 'none');
        icon.setAttribute('data-lucide', this.repeatMode === 'one' ? 'repeat-1' : 'repeat');
        if (typeof lucide !== 'undefined') lucide.createIcons(icon.parentElement);
      }
    }
    
    this.onRepeatChange(this.repeatMode);
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.onPause();
    } else {
      this.onPlay();
    }
  }

  selectItem(index) {
    if (index < 0 || index >= this.items.length) return;
    
    this.currentIndex = index;
    this.updateActiveItem();
    this.onSelect(this.items[index], index);
  }

  selectNext() {
    let nextIndex = this.currentIndex + 1;
    
    if (this.shuffle) {
      nextIndex = Math.floor(Math.random() * this.items.length);
    }
    
    if (nextIndex >= this.items.length) {
      if (this.repeatMode === 'all') {
        nextIndex = 0;
      } else {
        return;
      }
    }
    
    this.selectItem(nextIndex);
  }

  selectPrevious() {
    let prevIndex = this.currentIndex - 1;
    
    if (prevIndex < 0) {
      if (this.repeatMode === 'all') {
        prevIndex = this.items.length - 1;
      } else {
        return;
      }
    }
    
    this.selectItem(prevIndex);
  }

  reorderItem(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    
    const item = this.items.splice(fromIndex, 1)[0];
    this.items.splice(toIndex, 0, item);
    
    // Update current index
    if (this.currentIndex === fromIndex) {
      this.currentIndex = toIndex;
    } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
      this.currentIndex--;
    } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
      this.currentIndex++;
    }
    
    this.updateList();
    this.onReorder(this.items, this.currentIndex);
  }

  removeItem(index) {
    if (index < 0 || index >= this.items.length) return;
    
    this.items.splice(index, 1);
    
    // Update current index
    if (index < this.currentIndex) {
      this.currentIndex--;
    } else if (index === this.currentIndex) {
      if (this.currentIndex >= this.items.length) {
        this.currentIndex = Math.max(0, this.items.length - 1);
      }
    }
    
    this.updateList();
    this.onRemove(index);
  }

  clearPlaylist() {
    if (this.items.length === 0) return;
    
    this.items = [];
    this.currentIndex = 0;
    this.updateList();
    this.onClear();
  }

  addItem(item, index = -1) {
    if (index === -1) {
      this.items.push(item);
    } else {
      this.items.splice(index, 0, item);
    }
    
    this.updateList();
    this.onAddItem(item, index);
  }

  // UI updates
  updateActiveItem() {
    this.element.querySelectorAll('.playlist-item').forEach((item, index) => {
      const isActive = index === this.currentIndex;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-selected', isActive);
      
      const numberEl = item.querySelector('.playlist-item-number');
      if (numberEl && isActive) {
        numberEl.innerHTML = `
          <div class="playlist-item-playing">
            <span></span><span></span><span></span>
          </div>
        `;
      } else if (numberEl && !isActive) {
        numberEl.innerHTML = `<span class="playlist-item-index">${index + 1}</span><i data-lucide="play" class="w-4 h-4 playlist-item-play-icon"></i>`;
      }
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
    
    // Scroll to active item
    const activeItem = this.element.querySelector('.playlist-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  updateList() {
    const content = this.element.querySelector('.playlist-content');
    if (content) {
      content.innerHTML = this.items.length === 0 ? this.renderEmpty() : this.renderList();
    }
    
    const count = this.element.querySelector('.playlist-count');
    if (count) {
      count.textContent = `${this.items.length} ${this.items.length === 1 ? 'item' : 'itens'}`;
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
  }

  showItemMenu(index) {
    // Placeholder for context menu
  }

  // Public API
  setItems(items) {
    this.items = items;
    this.currentIndex = 0;
    this.updateList();
  }

  setCurrentIndex(index) {
    this.selectItem(index);
  }

  setPlaying(isPlaying) {
    this.isPlaying = isPlaying;
    this.updateActiveItem();
  }

  getCurrentItem() {
    return this.items[this.currentIndex] ?? null;
  }

  getNextItem() {
    let nextIndex = this.currentIndex + 1;
    if (this.shuffle) {
      nextIndex = Math.floor(Math.random() * this.items.length);
    }
    if (nextIndex >= this.items.length) {
      if (this.repeatMode === 'all') {
        nextIndex = 0;
      } else {
        return null;
      }
    }
    return this.items[nextIndex] ?? null;
  }

  getPreviousItem() {
    let prevIndex = this.currentIndex - 1;
    if (prevIndex < 0) {
      if (this.repeatMode === 'all') {
        prevIndex = this.items.length - 1;
      } else {
        return null;
      }
    }
    return this.items[prevIndex] ?? null;
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  destroy() {
    this.element.removeEventListener('keydown', this.keyboardHandler);
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
