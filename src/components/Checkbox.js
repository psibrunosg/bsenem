// src/components/Checkbox.js
export class Checkbox {
  constructor(options = {}) {
    this.checked = options.checked ?? false;
    this.indeterminate = options.indeterminate ?? false;
    this.disabled = options.disabled ?? false;
    this.label = options.label ?? null;
    this.description = options.description ?? null;
    this.name = options.name ?? null;
    this.value = options.value ?? 'on';
    this.id = options.id ?? `checkbox-${Math.random().toString(36).substr(2, 9)}`;
    this.required = options.required ?? false;
    this.onChange = options.onChange ?? (() => {});
    this.element = null;
    this.inputElement = null;
  }

  render() {
    this.element = document.createElement('label');
    this.element.className = `checkbox ${this.disabled ? 'disabled' : ''} ${this.indeterminate ? 'indeterminate' : ''}`;
    
    this.element.innerHTML = `
      <input
        type="checkbox"
        id="${this.id}"
        name="${this.name ?? ''}"
        class="checkbox-input"
        ${this.checked ? 'checked' : ''}
        ${this.disabled ? 'disabled' : ''}
        ${this.required ? 'required' : ''}
        value="${this.escapeHtml(this.value)}"
        aria-describedby="${this.description ? `${this.id}-desc` : ''}"
        data-action="checkbox"
      >
      <span class="checkbox-box" aria-hidden="true">
        <svg class="checkbox-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <svg class="checkbox-indeterminate" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </span>
      ${this.label || this.description ? `
        <div class="checkbox-content">
          ${this.label ? `<span class="checkbox-label">${this.escapeHtml(this.label)}</span>` : ''}
          ${this.description ? `<span class="checkbox-description">${this.escapeHtml(this.description)}</span>` : ''}
        </div>
      ` : ''}
      ${this.description ? `<span id="${this.id}-desc" class="sr-only">${this.escapeHtml(this.description)}</span>` : ''}
    `;

    this.inputElement = this.element.querySelector('.checkbox-input');
    this.bindEvents();

    return this.element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  bindEvents() {
    this.inputElement.addEventListener('change', (e) => {
      this.checked = e.target.checked;
      this.indeterminate = false;
      this.element.classList.remove('indeterminate');
      this.onChange(this.checked, this);
    });

    // Keyboard support
    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (!this.disabled) {
          e.preventDefault();
          this.inputElement.click();
        }
      }
    });
  }

  setChecked(checked) {
    this.checked = checked;
    if (this.inputElement) this.inputElement.checked = checked;
  }

  getChecked() {
    return this.inputElement?.checked ?? this.checked;
  }

  setIndeterminate(indeterminate) {
    this.indeterminate = indeterminate;
    if (this.inputElement) this.inputElement.indeterminate = indeterminate;
    this.element.classList.toggle('indeterminate', indeterminate);
  }

  setDisabled(disabled) {
    this.disabled = disabled;
    if (this.inputElement) this.inputElement.disabled = disabled;
    this.element.classList.toggle('disabled', disabled);
  }

  setLabel(label) {
    this.label = label;
    const labelEl = this.element.querySelector('.checkbox-label');
    if (labelEl) labelEl.textContent = label;
  }

  setDescription(description) {
    this.description = description;
    const descEl = this.element.querySelector('.checkbox-description');
    if (descEl) descEl.textContent = description;
  }

  toggle() {
    this.setChecked(!this.checked);
  }

  focus() {
    this.inputElement?.focus();
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

// Checkbox group helper
export class CheckboxGroup {
  constructor(options = {}) {
    this.name = options.name ?? '';
    this.options = options.options ?? []; // [{ value, label, description, disabled }]
    this.value = options.value ?? []; // array of selected values
    this.required = options.required ?? false;
    this.orientation = options.orientation ?? 'vertical'; // vertical, horizontal
    this.onChange = options.onChange ?? (() => {});
    this.checkboxes = [];
    this.element = null;
  }

  render() {
    this.element = document.createElement('fieldset');
    this.element.className = `checkbox-group checkbox-group-${this.orientation}`;
    if (this.required) this.element.setAttribute('aria-required', 'true');

    this.element.innerHTML = `
      <legend class="checkbox-group-legend">${this.escapeHtml(this.name)}</legend>
      <div class="checkbox-group-options"></div>
    `;

    const optionsContainer = this.element.querySelector('.checkbox-group-options');
    
    this.options.forEach(opt => {
      const checkbox = new Checkbox({
        name: this.name,
        value: opt.value,
        label: opt.label,
        description: opt.description,
        disabled: opt.disabled,
        checked: this.value.includes(opt.value),
        onChange: (checked, cb) => this.handleChange(checked, cb, opt.value)
      });
      
      this.checkboxes.push({ checkbox, value: opt.value });
      optionsContainer.appendChild(checkbox.render());
    });

    return this.element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  handleChange(checked, checkbox, value) {
    if (checked) {
      this.value = [...this.value, value];
    } else {
      this.value = this.value.filter(v => v !== value);
    }
    this.onChange(this.value, this);
  }

  getValue() {
    return this.value;
  }

  setValue(values) {
    this.value = Array.isArray(values) ? values : [];
    this.checkboxes.forEach(({ checkbox, value }) => {
      checkbox.setChecked(this.value.includes(value));
    });
  }

  setOptions(options) {
    this.options = options;
    // Re-render would be needed
  }

  setDisabled(disabled) {
    this.checkboxes.forEach(({ checkbox }) => checkbox.setDisabled(disabled));
  }

  destroy() {
    this.checkboxes.forEach(({ checkbox }) => checkbox.destroy());
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}