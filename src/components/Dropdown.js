// src/components/Dropdown.js
export class Dropdown {
  constructor(options = {}) {
    this.trigger = options.trigger ?? null; // HTMLElement or selector
    this.items = options.items ?? []; // [{ label, icon, action, disabled, divider, shortcut, danger }]
    this.position = options.position ?? 'bottom'; // bottom, top, left, right
    this.align = options.align ?? 'start'; // start, center, end
    this.width = options.width ?? 'auto'; // auto, same, min-content
    this.closeOnClick = options.closeOnClick ?? true;
    this.closeOnEscape = options.closeOnEscape ?? true;
    this.onSelect = options.onSelect ?? (() => {});
    this.element = null;
    this.dropdownElement = null;
    this.isOpen = false;
    this.boundToggle = this.toggle.bind(this);
    this.boundClose = this.close.bind(this);
    this.boundDocumentClick = this.handleDocumentClick.bind(this);
  }

  render() {
    this.dropdownElement = document.createElement('div');
    this.dropdownElement.className = `dropdown dropdown-${this.position} dropdown-align-${this.align}`;
    this.dropdownElement.setAttribute('role', 'menu');
    this.dropdownElement.style.display = 'none';
    
    this.dropdownElement.innerHTML = `
      <div class="dropdown-arrow" aria-hidden="true"></div>
      <div class="dropdown-content" role="none">
        ${this.items.map((item, index) => this.renderItem(item, index)).join('')}
      </div>
    `;

    if (this.trigger) {
      this.attach(this.trigger);
    }

    document.body.appendChild(this.dropdownElement);
    return this.dropdownElement;
  }

  renderItem(item, index) {
    if (item.divider) {
      return `<div class="dropdown-divider" role="separator"></div>`;
    }

    if (item.header) {
      return `<div class="dropdown-header">${this.escapeHtml(item.header)}</div>`;
    }

    return `
      <button
        type="button"
        class="dropdown-item ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''}"
        role="menuitem"
        tabindex="-1"
        data-action="${this.escapeHtml(item.action ?? index)}"
        ${item.disabled ? 'disabled' : ''}
        aria-disabled="${item.disabled}"
      >
        ${item.icon ? `<i data-lucide="${item.icon}" class="w-4 h-4" aria-hidden="true"></i>` : ''}
        <span class="dropdown-item-label">${this.escapeHtml(item.label)}</span>
        ${item.shortcut ? `<span class="dropdown-item-shortcut">${this.escapeHtml(item.shortcut)}</span>` : ''}
      </button>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  attach(trigger) {
    if (typeof trigger === 'string') {
      trigger = document.querySelector(trigger);
    }
    if (!trigger) return;

    this.trigger = trigger;
    this.trigger.addEventListener('click', this.boundToggle);
    this.trigger.setAttribute('aria-haspopup', 'menu');
    this.trigger.setAttribute('aria-expanded', 'false');
  }

  detach() {
    if (this.trigger) {
      this.trigger.removeEventListener('click', this.boundToggle);
      this.trigger.removeAttribute('aria-haspopup');
      this.trigger.removeAttribute('aria-expanded');
      this.trigger = null;
    }
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    if (this.isOpen || !this.trigger) return;
    
    this.isOpen = true;
    this.trigger.setAttribute('aria-expanded', 'true');
    this.dropdownElement.style.display = 'block';
    this.positionDropdown();
    
    requestAnimationFrame(() => {
      this.dropdownElement.classList.add('open');
    });

    document.addEventListener('click', this.boundDocumentClick);
    document.addEventListener('keydown', this.boundClose);
    
    // Focus first item
    const firstItem = this.dropdownElement.querySelector('[role="menuitem"]:not(.disabled)');
    firstItem?.focus();
  }

  close() {
    if (!this.isOpen) return;
    
    this.isOpen = false;
    if (this.trigger) this.trigger.setAttribute('aria-expanded', 'false');
    this.dropdownElement.classList.remove('open');
    
    setTimeout(() => {
      if (!this.isOpen) this.dropdownElement.style.display = 'none';
    }, 200);

    document.removeEventListener('click', this.boundDocumentClick);
    document.removeEventListener('keydown', this.boundClose);
  }

  positionDropdown() {
    if (!this.trigger || !this.dropdownElement) return;

    const triggerRect = this.trigger.getBoundingClientRect();
    const dropdownRect = this.dropdownElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 8;

    let top, left;

    // Calculate position based on this.position
    switch (this.position) {
      case 'bottom':
        top = triggerRect.bottom + 4;
        break;
      case 'top':
        top = triggerRect.top - dropdownRect.height - 4;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - dropdownRect.height) / 2;
        left = triggerRect.left - dropdownRect.width - 4;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - dropdownRect.height) / 2;
        left = triggerRect.right + 4;
        break;
    }

    // Calculate horizontal alignment for bottom/top
    if (this.position === 'bottom' || this.position === 'top') {
      switch (this.align) {
        case 'start':
          left = triggerRect.left;
          break;
        case 'center':
          left = triggerRect.left + (triggerRect.width - dropdownRect.width) / 2;
          break;
        case 'end':
          left = triggerRect.right - dropdownRect.width;
          break;
      }
    }

    // Handle width
    if (this.width === 'same') {
      this.dropdownElement.style.width = `${triggerRect.width}px`;
    } else if (this.width === 'min-content') {
      this.dropdownElement.style.width = 'min-content';
    }

    // Prevent viewport overflow
    if (left < padding) left = padding;
    if (left + dropdownRect.width > viewportWidth - padding) {
      left = viewportWidth - dropdownRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + dropdownRect.height > viewportHeight - padding) {
      top = viewportHeight - dropdownRect.height - padding;
    }

    this.dropdownElement.style.top = `${top + window.scrollY}px`;
    this.dropdownElement.style.left = `${left + window.scrollX}px`;

    // Update arrow position
    const arrow = this.dropdownElement.querySelector('.dropdown-arrow');
    if (arrow && (this.position === 'bottom' || this.position === 'top')) {
      const arrowLeft = triggerRect.left + triggerRect.width / 2 - left;
      arrow.style.left = `${Math.max(8, Math.min(dropdownRect.width - 8, arrowLeft))}px`;
      arrow.style.bottom = this.position === 'bottom' ? 'auto' : '-4px';
      arrow.style.top = this.position === 'bottom' ? '-4px' : 'auto';
    }
  }

  handleDocumentClick(e) {
    if (this.trigger?.contains(e.target)) return;
    if (this.dropdownElement.contains(e.target)) return;
    this.close();
  }

  handleKeydown(e) {
    if (!this.isOpen) return;

    const items = this.dropdownElement.querySelectorAll('[role="menuitem"]:not(.disabled)');
    const currentIndex = Array.from(items).findIndex(item => item === document.activeElement);

    if (e.key === 'Escape') {
      this.close();
      this.trigger?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % items.length;
      items[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + items.length) % items.length;
      items[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      document.activeElement?.click();
    } else if (e.key === 'Tab') {
      this.close();
    }
  }

  // Item click handler (delegated)
  bindEvents() {
    this.dropdownElement.addEventListener('click', (e) => {
      const item = e.target.closest('[role="menuitem"]');
      if (!item || item.disabled) return;

      const action = item.dataset.action;
      this.onSelect(action, item, this);
      
      if (this.closeOnClick) this.close();
    });

    this.dropdownElement.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  setItems(items) {
    this.items = items;
    const content = this.dropdownElement.querySelector('.dropdown-content');
    if (content) {
      content.innerHTML = items.map((item, index) => this.renderItem(item, index)).join('');
      if (typeof lucide !== 'undefined') lucide.createIcons(content);
    }
  }

  addItem(item) {
    this.items.push(item);
    this.setItems(this.items);
  }

  removeItem(action) {
    this.items = this.items.filter(i => i.action !== action);
    this.setItems(this.items);
  }

  destroy() {
    this.detach();
    document.removeEventListener('click', this.boundDocumentClick);
    document.removeEventListener('keydown', this.boundClose);
    if (this.dropdownElement?.parentNode) this.dropdownElement.parentNode.removeChild(this.dropdownElement);
  }
}