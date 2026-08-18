// src/components/Radio.js
export class Radio {
  constructor(options = {}) {
    this.checked = options.checked ?? false;
    this.disabled = options.disabled ?? false;
    this.label = options.label ?? null;
    this.description = options.description ?? null;
    this.name = options.name ?? '';
    this.value = options.value ?? '';
    this.id = options.id ?? `radio-${Math.random().toString(36).substr(2, 9)}`;
    this.required = options.required ?? false;
    this.onChange = options.onChange ?? (() => {});
    this.element = null;
    this.inputElement = null;
  }

  render() {
    this.element = document.createElement('label');
    this.element.className = `radio ${this.disabled ? 'disabled' : ''}`;
    
    this.element.innerHTML = `
      <input
        type="radio"
        id="${this.id}"
        name="${this.escapeHtml(this.name)}"
        class="radio-input"
        ${this.checked ? 'checked' : ''}
        ${this.disabled ? 'disabled' : ''}
        ${this.required ? 'required' : ''}
        value="${this.escapeHtml(this.value)}"
        aria-describedby="${this.description ? `${this.id}-desc` : ''}"
        data-action="radio"
      >
      <span class="radio-circle" aria-hidden="true">
        <span class="radio-dot"></span>
      </span>
      ${this.label || this.description ? `
        <div class="radio-content">
          ${this.label ? `<span class="radio-label">${this.escapeHtml(this.label)}</span>` : ''}
          ${this.description ? `<span class="radio-description">${this.escapeHtml(this.description)}</span>` : ''}
        </div>
      ` : ''}
      ${this.description ? `<span id="${this.id}-desc" class="sr-only">${this.escapeHtml(this.description)}</span>` : ''}
    `;

    this.inputElement = this.element.querySelector('.radio-input');
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
      this.onChange(this.value, this);
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

  setDisabled(disabled) {
    this.disabled = disabled;
    if (this.inputElement) this.inputElement.disabled = disabled;
    this.element.classList.toggle('disabled', disabled);
  }

  setLabel(label) {
    this.label = label;
    const labelEl = this.element.querySelector('.radio-label');
    if (labelEl) labelEl.textContent = label;
  }

  setDescription(description) {
    this.description = description;
    const descEl = this.element.querySelector('.radio-description');
    if (descEl) descEl.textContent = description;
  }

  focus() {
    this.inputElement?.focus();
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

// Radio group helper
export class RadioGroup {
  constructor(options = {}) {
    this.name = options.name ?? `radiogroup-${Math.random().toString(36).substr(2, 9)}`;
    this.options = options.options ?? []; // [{ value, label, description, disabled }]
    this.value = options.value ?? '';
    this.required = options.required ?? false;
    this.orientation = options.orientation ?? 'vertical'; // vertical, horizontal
    this.onChange = options.onChange ?? (() => {});
    this.radios = [];
    this.element = null;
  }

  render() {
    this.element = document.createElement('fieldset');
    this.element.className = `radio-group radio-group-${this.orientation}`;
    this.element.setAttribute('role', 'radiogroup');
    this.element.setAttribute('aria-required', this.required);

    this.element.innerHTML = `
      <legend class="radio-group-legend">${this.escapeHtml(this.name)}</legend>
      <div class="radio-group-options"></div>
    `;

    const optionsContainer = this.element.querySelector('.radio-group-options');
    
    this.options.forEach(opt => {
      const radio = new Radio({
        name: this.name,
        value: opt.value,
        label: opt.label,
        description: opt.description,
        disabled: opt.disabled,
        checked: this.value === opt.value,
        onChange: (value, rd) => this.handleChange(value, rd)
      });
      
      this.radios.push({ radio, value: opt.value });
      optionsContainer.appendChild(radio.render());
    });

    return this.element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  handleChange(value, radio) {
    this.value = value;
    this.radios.forEach(({ radio: r, value: v }) => {
      r.setChecked(v === value);
    });
    this.onChange(this.value, this);
  }

  getValue() {
    return this.value;
  }

  setValue(value) {
    this.value = value;
    this.radios.forEach(({ radio, value: v }) => {
      radio.setChecked(v === value);
    });
  }

  setOptions(options) {
    this.options = options;
    // Re-render would be needed
  }

  setDisabled(disabled) {
    this.radios.forEach(({ radio }) => radio.setDisabled(disabled));
  }

  destroy() {
    this.radios.forEach(({ radio }) => radio.destroy());
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}