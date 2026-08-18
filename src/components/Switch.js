// src/components/Switch.js
export class Switch {
  constructor(options = {}) {
    this.checked = options.checked ?? false;
    this.disabled = options.disabled ?? false;
    this.label = options.label ?? null;
    this.description = options.description ?? null;
    this.name = options.name ?? null;
    this.id = options.id ?? `switch-${Math.random().toString(36).substr(2, 9)}`;
    this.value = options.value ?? 'on';
    this.size = options.size ?? 'md'; // sm, md, lg
    this.onChange = options.onChange ?? (() => {});
    this.element = null;
    this.inputElement = null;
  }

  render() {
    this.element = document.createElement('label');
    this.element.className = `switch switch-${this.size} ${this.disabled ? 'disabled' : ''}`;
    
    this.element.innerHTML = `
      <input
        type="checkbox"
        id="${this.id}"
        name="${this.name ?? ''}"
        class="switch-input"
        ${this.checked ? 'checked' : ''}
        ${this.disabled ? 'disabled' : ''}
        value="${this.escapeHtml(this.value)}"
        aria-describedby="${this.description ? `${this.id}-desc` : ''}"
        data-action="switch"
      >
      <span class="switch-slider" aria-hidden="true">
        <span class="switch-thumb"></span>
      </span>
      ${this.label || this.description ? `
        <div class="switch-content">
          ${this.label ? `<span class="switch-label">${this.escapeHtml(this.label)}</span>` : ''}
          ${this.description ? `<span class="switch-description">${this.escapeHtml(this.description)}</span>` : ''}
        </div>
      ` : ''}
      ${this.description ? `<span id="${this.id}-desc" class="sr-only">${this.escapeHtml(this.description)}</span>` : ''}
    `;

    this.inputElement = this.element.querySelector('.switch-input');
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

  setDisabled(disabled) {
    this.disabled = disabled;
    if (this.inputElement) this.inputElement.disabled = disabled;
    this.element.classList.toggle('disabled', disabled);
  }

  setLabel(label) {
    this.label = label;
    const labelEl = this.element.querySelector('.switch-label');
    if (labelEl) labelEl.textContent = label;
  }

  setDescription(description) {
    this.description = description;
    const descEl = this.element.querySelector('.switch-description');
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