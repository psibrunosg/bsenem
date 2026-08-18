// src/components/Select.js
export class Select {
  constructor(options = {}) {
    this.value = options.value ?? '';
    this.placeholder = options.placeholder ?? 'Selecione...';
    this.label = options.label ?? null;
    this.name = options.name ?? null;
    this.id = options.id ?? `select-${Math.random().toString(36).substr(2, 9)}`;
    this.required = options.required ?? false;
    this.disabled = options.disabled ?? false;
    this.error = options.error ?? null;
    this.helperText = options.helperText ?? null;
    this.options = options.options ?? []; // [{ value, label, disabled, group }]
    this.multiple = options.multiple ?? false;
    this.searchable = options.searchable ?? false;
    this.clearable = options.clearable ?? false;
    this.onChange = options.onChange ?? (() => {});
    this.onBlur = options.onBlur ?? (() => {});
    this.onFocus = options.onFocus ?? (() => {});
    this.onOpen = options.onOpen ?? (() => {});
    this.onClose = options.onClose ?? (() => {});
    this.element = null;
    this.selectElement = null;
    this.dropdownElement = null;
    this.isOpen = false;
    this.highlightedIndex = -1;
    this.filteredOptions = [...this.options];
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'select-wrapper';
    
    const hasLabel = !!this.label;
    const hasError = !!this.error;
    const hasHelper = !!this.helperText && !hasError;
    const displayValue = this.getDisplayValue();

    this.element.innerHTML = `
      ${hasLabel ? `<label for="${this.id}" class="input-label">${this.label}${this.required ? ' <span class="text-error" aria-hidden="true">*</span>' : ''}</label>` : ''}
      <div class="select-trigger-wrapper">
        <button
          type="button"
          id="${this.id}"
          class="select-trigger ${hasError ? 'input-error' : ''} ${this.disabled ? 'disabled' : ''} ${this.isOpen ? 'open' : ''}"
          aria-haspopup="listbox"
          aria-expanded="${this.isOpen}"
          aria-controls="${this.id}-options"
          aria-describedby="${hasError ? `${this.id}-error` : hasHelper ? `${this.id}-helper` : ''}"
          ${this.disabled ? 'disabled' : ''}
          data-action="trigger"
        >
          <span class="select-value ${this.value ? '' : 'placeholder'}">${this.escapeHtml(displayValue || this.placeholder)}</span>
          ${this.clearable && this.value && !this.disabled ? `
            <button type="button" class="select-clear" aria-label="Limpar seleção" data-action="clear">
              <i data-lucide="x" class="w-4 h-4" aria-hidden="true"></i>
            </button>
          ` : ''}
          <i data-lucide="chevron-down" class="select-chevron w-4 h-4" aria-hidden="true"></i>
        </button>
        <div 
          id="${this.id}-options" 
          class="select-dropdown" 
          role="listbox" 
          aria-label="${this.escapeHtml(this.label ?? 'Opções')}"
          style="display: ${this.isOpen ? 'block' : 'none'};"
        >
          ${this.searchable ? `
            <div class="select-search">
              <i data-lucide="search" class="w-4 h-4" aria-hidden="true"></i>
              <input type="search" class="input" placeholder="Buscar..." aria-label="Buscar opções" data-action="search">
            </div>
          ` : ''}
          <div class="select-options" role="presentation"></div>
          ${this.value && !this.multiple ? `
            <div class="select-footer">
              <button type="button" class="btn btn-ghost btn-sm btn-full" data-action="clear-all">Limpar seleção</button>
            </div>
          ` : ''}
        </div>
      </div>
      ${hasError ? `<p id="${this.id}-error" class="input-error-message" role="alert"><i data-lucide="alert-circle" class="w-3 h-3" aria-hidden="true"></i> ${this.escapeHtml(this.error)}</p>` : ''}
      ${hasHelper ? `<p id="${this.id}-helper" class="input-helper-text">${this.escapeHtml(this.helperText)}</p>` : ''}
      ${this.multiple && this.name ? `<input type="hidden" name="${this.name}" value="${this.escapeHtml(JSON.stringify(this.getSelectedValues()))}">` : ''}
      ${!this.multiple && this.name ? `<input type="hidden" name="${this.name}" value="${this.escapeHtml(this.value)}">` : ''}
    `;

    this.selectElement = this.element.querySelector('.select-trigger');
    this.dropdownElement = this.element.querySelector('.select-dropdown');
    this.bindEvents();
    this.renderOptions();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  getDisplayValue() {
    if (!this.value) return '';
    const option = this.options.find(o => o.value === this.value);
    return option ? option.label : this.value;
  }

  getSelectedValues() {
    if (this.multiple && Array.isArray(this.value)) {
      return this.value;
    }
    return this.value ? [this.value] : [];
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  bindEvents() {
    // Trigger click
    this.selectElement.addEventListener('click', (e) => {
      if (this.disabled) return;
      
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'clear') {
        e.stopPropagation();
        this.clearValue();
        return;
      }
      if (action === 'clear-all') {
        e.stopPropagation();
        this.clearValue();
        return;
      }
      
      this.toggle();
    });

    // Search input
    const searchInput = this.element.querySelector('[data-action="search"]');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterOptions(e.target.value);
      });
      searchInput.addEventListener('click', (e) => e.stopPropagation());
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          this.close();
        }
      });
    }

    // Keyboard navigation
    this.selectElement.addEventListener('keydown', (e) => {
      if (this.disabled) return;
      
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!this.isOpen) this.open();
          else this.selectHighlighted();
          break;
        case 'Escape':
          this.close();
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!this.isOpen) this.open();
          else this.highlightNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (this.isOpen) this.highlightPrev();
          break;
        case 'Tab':
          this.close();
          break;
        case 'Home':
          e.preventDefault();
          this.highlightFirst();
          break;
        case 'End':
          e.preventDefault();
          this.highlightLast();
          break;
      }
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.element.contains(e.target)) {
        this.close();
      }
    });

    // Option clicks (delegated)
    this.dropdownElement.addEventListener('click', (e) => {
      const option = e.target.closest('[data-value]');
      if (option) {
        const value = option.dataset.value;
        this.selectValue(value);
      }
    });
  }

  renderOptions() {
    const optionsContainer = this.element.querySelector('.select-options');
    if (!optionsContainer) return;

    // Group options
    const groups = this.groupOptions(this.filteredOptions);
    
    optionsContainer.innerHTML = Object.entries(groups).map(([groupName, options]) => `
      ${groupName ? `<div class="select-optgroup"><span class="select-optgroup-label">${this.escapeHtml(groupName)}</span></div>` : ''}
      ${options.map((opt, idx) => `
        <div 
          class="select-option ${opt.disabled ? 'disabled' : ''} ${this.isSelected(opt.value) ? 'selected' : ''} ${idx === this.highlightedIndex ? 'highlighted' : ''}"
          role="option"
          aria-selected="${this.isSelected(opt.value)}"
          aria-disabled="${opt.disabled}"
          data-value="${this.escapeHtml(opt.value)}"
          data-index="${idx}"
        >
          ${opt.icon ? `<i data-lucide="${opt.icon}" class="w-4 h-4" aria-hidden="true"></i>` : ''}
          <span class="select-option-label">${this.escapeHtml(opt.label)}</span>
          ${this.isSelected(opt.value) && !this.multiple ? `<i data-lucide="check" class="w-4 h-4 text-orange-500" aria-hidden="true"></i>` : ''}
        </div>
      `).join('')}
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons(optionsContainer);
  }

  groupOptions(options) {
    const groups = {};
    options.forEach(opt => {
      const group = opt.group ?? '';
      if (!groups[group]) groups[group] = [];
      groups[group].push(opt);
    });
    return groups;
  }

  filterOptions(query) {
    const searchTerm = query.toLowerCase().trim();
    if (!searchTerm) {
      this.filteredOptions = [...this.options];
    } else {
      this.filteredOptions = this.options.filter(opt => 
        opt.label.toLowerCase().includes(searchTerm) ||
        opt.value.toLowerCase().includes(searchTerm)
      );
    }
    this.highlightedIndex = 0;
    this.renderOptions();
  }

  isSelected(value) {
    if (this.multiple && Array.isArray(this.value)) {
      return this.value.includes(value);
    }
    return this.value === value;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    if (this.disabled || this.isOpen) return;
    this.isOpen = true;
    this.highlightedIndex = this.getSelectedIndex() ?? 0;
    this.selectElement.classList.add('open');
    this.selectElement.setAttribute('aria-expanded', 'true');
    this.dropdownElement.style.display = 'block';
    this.renderOptions();
    this.scrollToHighlighted();
    this.onOpen(this);
    
    // Focus search input if searchable
    const searchInput = this.element.querySelector('[data-action="search"]');
    searchInput?.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.selectElement.classList.remove('open');
    this.selectElement.setAttribute('aria-expanded', 'false');
    this.dropdownElement.style.display = 'none';
    this.onClose(this);
  }

  selectValue(value) {
    const option = this.options.find(o => o.value === value);
    if (!option || option.disabled) return;

    let newValue;
    if (this.multiple) {
      const currentValues = Array.isArray(this.value) ? this.value : (this.value ? [this.value] : []);
      newValue = currentValues.includes(value) 
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
    } else {
      newValue = value;
    }

    this.value = newValue;
    this.updateTrigger();
    this.updateHiddenInput();
    this.onChange(this.value, this);
    
    if (!this.multiple) {
      this.close();
    } else {
      this.renderOptions();
    }
  }

  selectHighlighted() {
    const options = this.filteredOptions;
    if (options[this.highlightedIndex]) {
      this.selectValue(options[this.highlightedIndex].value);
    }
  }

  clearValue() {
    this.value = this.multiple ? [] : '';
    this.updateTrigger();
    this.updateHiddenInput();
    this.renderOptions();
    this.onChange(this.value, this);
  }

  updateTrigger() {
    const valueEl = this.selectElement.querySelector('.select-value');
    const clearBtn = this.selectElement.querySelector('.select-clear');
    
    if (valueEl) {
      const displayValue = this.getDisplayValue();
      valueEl.textContent = displayValue || this.placeholder;
      valueEl.classList.toggle('placeholder', !displayValue);
    }
    
    if (clearBtn) {
      clearBtn.style.display = this.value && !this.disabled ? 'flex' : 'none';
    }
  }

  updateHiddenInput() {
    const hiddenInput = this.element.querySelector('input[type="hidden"]');
    if (hiddenInput) {
      hiddenInput.value = this.multiple 
        ? JSON.stringify(this.getSelectedValues())
        : this.value;
    }
  }

  getSelectedIndex() {
    if (!this.value) return -1;
    const selectedValue = this.multiple ? this.value[0] : this.value;
    return this.filteredOptions.findIndex(o => o.value === selectedValue);
  }

  highlightNext() {
    if (this.highlightedIndex < this.filteredOptions.length - 1) {
      this.highlightedIndex++;
      this.renderOptions();
      this.scrollToHighlighted();
    }
  }

  highlightPrev() {
    if (this.highlightedIndex > 0) {
      this.highlightedIndex--;
      this.renderOptions();
      this.scrollToHighlighted();
    }
  }

  highlightFirst() {
    this.highlightedIndex = 0;
    this.renderOptions();
    this.scrollToHighlighted();
  }

  highlightLast() {
    this.highlightedIndex = this.filteredOptions.length - 1;
    this.renderOptions();
    this.scrollToHighlighted();
  }

  scrollToHighlighted() {
    const highlighted = this.element.querySelector('.select-option.highlighted');
    if (highlighted) {
      highlighted.scrollIntoView({ block: 'nearest' });
    }
  }

  // Public methods
  setValue(value) {
    this.value = value;
    this.updateTrigger();
    this.updateHiddenInput();
    this.renderOptions();
  }

  getValue() {
    return this.value;
  }

  setOptions(options) {
    this.options = options;
    this.filteredOptions = [...options];
    this.renderOptions();
  }

  addOption(option) {
    this.options.push(option);
    this.filteredOptions = [...this.options];
    this.renderOptions();
  }

  removeOption(value) {
    this.options = this.options.filter(o => o.value !== value);
    this.filteredOptions = this.filteredOptions.filter(o => o.value !== value);
    if (this.multiple) {
      this.value = this.value.filter(v => v !== value);
    } else if (this.value === value) {
      this.value = '';
    }
    this.updateTrigger();
    this.updateHiddenInput();
    this.renderOptions();
  }

  setError(error) {
    this.error = error;
    this.updateErrorState();
  }

  clearError() {
    this.error = null;
    this.updateErrorState();
  }

  updateErrorState() {
    const hasError = !!this.error;
    this.selectElement.classList.toggle('input-error', hasError);
    this.selectElement.setAttribute('aria-invalid', hasError);
    this.selectElement.setAttribute('aria-describedby', hasError ? `${this.id}-error` : '');

    const wrapper = this.element;
    const existingError = wrapper.querySelector('.input-error-message');
    const existingHelper = wrapper.querySelector('.input-helper-text');
    existingError?.remove();
    existingHelper?.remove();

    if (hasError) {
      const errorEl = document.createElement('p');
      errorEl.id = `${this.id}-error`;
      errorEl.className = 'input-error-message';
      errorEl.setAttribute('role', 'alert');
      errorEl.innerHTML = `<i data-lucide="alert-circle" class="w-3 h-3" aria-hidden="true"></i> ${this.escapeHtml(this.error)}`;
      wrapper.appendChild(errorEl);
    } else if (this.helperText) {
      const helperEl = document.createElement('p');
      helperEl.id = `${this.id}-helper`;
      helperEl.className = 'input-helper-text';
      helperEl.textContent = this.helperText;
      wrapper.appendChild(helperEl);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons(wrapper);
  }

  setDisabled(disabled) {
    this.disabled = disabled;
    this.selectElement.disabled = disabled;
    this.selectElement.classList.toggle('disabled', disabled);
  }

  focus() {
    this.selectElement?.focus();
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}