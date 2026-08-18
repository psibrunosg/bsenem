// src/components/Input.js
export class Input {
  constructor(options = {}) {
    this.type = options.type ?? 'text'; // text, email, password, number, search, tel, url
    this.value = options.value ?? '';
    this.placeholder = options.placeholder ?? '';
    this.label = options.label ?? null;
    this.name = options.name ?? null;
    this.id = options.id ?? `input-${Math.random().toString(36).substr(2, 9)}`;
    this.required = options.required ?? false;
    this.disabled = options.disabled ?? false;
    this.readOnly = options.readOnly ?? false;
    this.error = options.error ?? null;
    this.helperText = options.helperText ?? null;
    this.leftIcon = options.leftIcon ?? null;
    this.rightIcon = options.rightIcon ?? null;
    this.leftElement = options.leftElement ?? null;
    this.rightElement = options.rightElement ?? null;
    this.onChange = options.onChange ?? (() => {});
    this.onBlur = options.onBlur ?? (() => {});
    this.onFocus = options.onFocus ?? (() => {});
    this.onKeyDown = options.onKeyDown ?? (() => {});
    this.autoComplete = options.autoComplete ?? 'off';
    this.maxLength = options.maxLength ?? null;
    this.min = options.min ?? null;
    this.max = options.max ?? null;
    this.step = options.step ?? null;
    this.pattern = options.pattern ?? null;
    this.inputMode = options.inputMode ?? null;
    this.element = null;
    this.inputElement = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'input-wrapper';
    
    const hasLabel = !!this.label;
    const hasError = !!this.error;
    const hasHelper = !!this.helperText && !hasError;

    this.element.innerHTML = `
      ${hasLabel ? `<label for="${this.id}" class="input-label">${this.label}${this.required ? ' <span class="text-error" aria-hidden="true">*</span>' : ''}</label>` : ''}
      <div class="input-group" ${this.leftIcon || this.leftElement ? 'data-has-left="true"' : ''} ${this.rightIcon || this.rightElement ? 'data-has-right="true"' : ''}>
        ${this.leftElement ? `<span class="input-adornment input-adornment-left">${this.leftElement}</span>` : ''}
        ${this.leftIcon ? `<i data-lucide="${this.leftIcon}" class="input-icon input-icon-left" aria-hidden="true"></i>` : ''}
        <input
          type="${this.type}"
          id="${this.id}"
          name="${this.name ?? ''}"
          value="${this.escapeHtml(this.value)}"
          placeholder="${this.escapeHtml(this.placeholder)}"
          class="input ${hasError ? 'input-error' : ''}"
          ${this.disabled ? 'disabled' : ''}
          ${this.readOnly ? 'readonly' : ''}
          ${this.required ? 'required' : ''}
          ${this.maxLength ? `maxlength="${this.maxLength}"` : ''}
          ${this.min !== null ? `min="${this.min}"` : ''}
          ${this.max !== null ? `max="${this.max}"` : ''}
          ${this.step !== null ? `step="${this.step}"` : ''}
          ${this.pattern ? `pattern="${this.pattern}"` : ''}
          ${this.inputMode ? `inputmode="${this.inputMode}"` : ''}
          autocomplete="${this.autoComplete}"
          aria-invalid="${hasError}"
          aria-describedby="${hasError ? `${this.id}-error` : hasHelper ? `${this.id}-helper` : ''}"
          data-action="input"
        >
        ${this.rightIcon ? `<i data-lucide="${this.rightIcon}" class="input-icon input-icon-right" aria-hidden="true"></i>` : ''}
        ${this.rightElement ? `<span class="input-adornment input-adornment-right">${this.rightElement}</span>` : ''}
      </div>
      ${hasError ? `<p id="${this.id}-error" class="input-error-message" role="alert"><i data-lucide="alert-circle" class="w-3 h-3" aria-hidden="true"></i> ${this.escapeHtml(this.error)}</p>` : ''}
      ${hasHelper ? `<p id="${this.id}-helper" class="input-helper-text">${this.escapeHtml(this.helperText)}</p>` : ''}
    `;

    this.inputElement = this.element.querySelector('input');
    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  bindEvents() {
    this.inputElement.addEventListener('input', (e) => {
      this.value = e.target.value;
      this.onChange(e, this);
    });

    this.inputElement.addEventListener('blur', (e) => {
      this.onBlur(e, this);
    });

    this.inputElement.addEventListener('focus', (e) => {
      this.onFocus(e, this);
    });

    this.inputElement.addEventListener('keydown', (e) => {
      this.onKeyDown(e, this);
    });
  }

  // Public methods
  setValue(value) {
    this.value = value ?? '';
    if (this.inputElement) this.inputElement.value = this.value;
  }

  getValue() {
    return this.inputElement?.value ?? this.value;
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
    if (!this.inputElement) return;
    
    const hasError = !!this.error;
    const wrapper = this.element;
    
    this.inputElement.classList.toggle('input-error', hasError);
    this.inputElement.setAttribute('aria-invalid', hasError);
    this.inputElement.setAttribute('aria-describedby', hasError ? `${this.id}-error` : '');

    // Remove existing error/helper
    const existingError = wrapper.querySelector('.input-error-message');
    const existingHelper = wrapper.querySelector('.input-helper-text');
    existingError?.remove();
    existingHelper?.remove();

    // Add new error or helper
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

  setHelperText(text) {
    this.helperText = text;
    this.updateErrorState();
  }

  setDisabled(disabled) {
    this.disabled = disabled;
    if (this.inputElement) this.inputElement.disabled = disabled;
  }

  setReadOnly(readOnly) {
    this.readOnly = readOnly;
    if (this.inputElement) this.inputElement.readOnly = readOnly;
  }

  setPlaceholder(placeholder) {
    this.placeholder = placeholder;
    if (this.inputElement) this.inputElement.placeholder = placeholder;
  }

  focus() {
    this.inputElement?.focus();
  }

  blur() {
    this.inputElement?.blur();
  }

  select() {
    this.inputElement?.select();
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

// Textarea component
export class Textarea {
  constructor(options = {}) {
    this.value = options.value ?? '';
    this.placeholder = options.placeholder ?? '';
    this.label = options.label ?? null;
    this.name = options.name ?? null;
    this.id = options.id ?? `textarea-${Math.random().toString(36).substr(2, 9)}`;
    this.required = options.required ?? false;
    this.disabled = options.disabled ?? false;
    this.readOnly = options.readOnly ?? false;
    this.error = options.error ?? null;
    this.helperText = options.helperText ?? null;
    this.rows = options.rows ?? 4;
    this.cols = options.cols ?? null;
    this.maxLength = options.maxLength ?? null;
    this.resize = options.resize ?? 'vertical'; // none, vertical, horizontal, both
    this.autoResize = options.autoResize ?? false;
    this.onChange = options.onChange ?? (() => {});
    this.onBlur = options.onBlur ?? (() => {});
    this.onFocus = options.onFocus ?? (() => {});
    this.element = null;
    this.textareaElement = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'input-wrapper';
    
    const hasLabel = !!this.label;
    const hasError = !!this.error;
    const hasHelper = !!this.helperText && !hasError;

    this.element.innerHTML = `
      ${hasLabel ? `<label for="${this.id}" class="input-label">${this.label}${this.required ? ' <span class="text-error" aria-hidden="true">*</span>' : ''}</label>` : ''}
      <div class="input-group">
        <textarea
          id="${this.id}"
          name="${this.name ?? ''}"
          class="input textarea ${hasError ? 'input-error' : ''}"
          placeholder="${this.escapeHtml(this.placeholder)}"
          rows="${this.rows}"
          ${this.cols ? `cols="${this.cols}"` : ''}
          ${this.disabled ? 'disabled' : ''}
          ${this.readOnly ? 'readonly' : ''}
          ${this.required ? 'required' : ''}
          ${this.maxLength ? `maxlength="${this.maxLength}"` : ''}
          style="resize: ${this.resize};"
          aria-invalid="${hasError}"
          aria-describedby="${hasError ? `${this.id}-error` : hasHelper ? `${this.id}-helper` : ''}"
          data-action="textarea"
        >${this.escapeHtml(this.value)}</textarea>
      </div>
      ${hasError ? `<p id="${this.id}-error" class="input-error-message" role="alert"><i data-lucide="alert-circle" class="w-3 h-3" aria-hidden="true"></i> ${this.escapeHtml(this.error)}</p>` : ''}
      ${hasHelper ? `<p id="${this.id}-helper" class="input-helper-text">${this.escapeHtml(this.helperText)}</p>` : ''}
    `;

    this.textareaElement = this.element.querySelector('textarea');
    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  bindEvents() {
    this.textareaElement.addEventListener('input', (e) => {
      this.value = e.target.value;
      this.onChange(e, this);
      
      if (this.autoResize) {
        this.textareaElement.style.height = 'auto';
        this.textareaElement.style.height = `${this.textareaElement.scrollHeight}px`;
      }
    });

    this.textareaElement.addEventListener('blur', (e) => this.onBlur(e, this));
    this.textareaElement.addEventListener('focus', (e) => this.onFocus(e, this));
  }

  setValue(value) {
    this.value = value ?? '';
    if (this.textareaElement) {
      this.textareaElement.value = this.value;
      if (this.autoResize) {
        this.textareaElement.style.height = 'auto';
        this.textareaElement.style.height = `${this.textareaElement.scrollHeight}px`;
      }
    }
  }

  getValue() {
    return this.textareaElement?.value ?? this.value;
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
    if (!this.textareaElement) return;
    
    const hasError = !!this.error;
    const wrapper = this.element;
    
    this.textareaElement.classList.toggle('input-error', hasError);
    this.textareaElement.setAttribute('aria-invalid', hasError);
    this.textareaElement.setAttribute('aria-describedby', hasError ? `${this.id}-error` : '');

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

  setHelperText(text) {
    this.helperText = text;
    this.updateErrorState();
  }

  setDisabled(disabled) {
    this.disabled = disabled;
    if (this.textareaElement) this.textareaElement.disabled = disabled;
  }

  focus() {
    this.textareaElement?.focus();
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

// Label component
export class Label {
  constructor(options = {}) {
    this.text = options.text ?? '';
    this.htmlFor = options.htmlFor ?? null;
    this.required = options.required ?? false;
    this.size = options.size ?? 'md'; // sm, md, lg
    this.weight = options.weight ?? 'medium'; // normal, medium, semibold
    this.element = null;
  }

  render() {
    this.element = document.createElement('label');
    if (this.htmlFor) this.element.htmlFor = this.htmlFor;
    this.element.className = `input-label input-label-${this.size} font-${this.weight}`;
    this.element.innerHTML = `${this.escapeHtml(this.text)}${this.required ? ' <span class="text-error" aria-hidden="true">*</span>' : ''}`;
    return this.element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setText(text) {
    this.text = text;
    if (this.element) this.element.innerHTML = `${this.escapeHtml(text)}${this.required ? ' <span class="text-error" aria-hidden="true">*</span>' : ''}`;
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}