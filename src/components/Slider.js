// src/components/Slider.js
export class Slider {
  constructor(options = {}) {
    this.value = options.value ?? 0;
    this.min = options.min ?? 0;
    this.max = options.max ?? 100;
    this.step = options.step ?? 1;
    this.disabled = options.disabled ?? false;
    this.label = options.label ?? null;
    this.showValue = options.showValue ?? false;
    this.valueFormatter = options.valueFormatter ?? ((v) => v);
    this.name = options.name ?? null;
    this.id = options.id ?? `slider-${Math.random().toString(36).substr(2, 9)}`;
    this.onChange = options.onChange ?? (() => {});
    this.onInput = options.onInput ?? (() => {});
    this.element = null;
    this.inputElement = null;
    this.isDragging = false;
  }

  render() {
    const percentage = ((this.value - this.min) / (this.max - this.min)) * 100;

    this.element = document.createElement('div');
    this.element.className = `slider ${this.disabled ? 'disabled' : ''}`;
    
    this.element.innerHTML = `
      ${this.label ? `<label for="${this.id}" class="slider-label">${this.escapeHtml(this.label)}</label>` : ''}
      <div class="slider-track-wrapper" data-action="track">
        <div class="slider-track" style="--slider-progress: ${percentage}%"></div>
        <div class="slider-fill" style="width: ${percentage}%"></div>
        <input
          type="range"
          id="${this.id}"
          name="${this.name ?? ''}"
          class="slider-input"
          min="${this.min}"
          max="${this.max}"
          step="${this.step}"
          value="${this.value}"
          ${this.disabled ? 'disabled' : ''}
          aria-valuemin="${this.min}"
          aria-valuemax="${this.max}"
          aria-valuenow="${this.value}"
          data-action="input"
        >
        <div class="slider-thumb" style="left: ${percentage}%"></div>
      </div>
      ${this.showValue ? `<output class="slider-value" for="${this.id}">${this.escapeHtml(this.valueFormatter(this.value))}</output>` : ''}
    `;

    this.inputElement = this.element.querySelector('.slider-input');
    this.bindEvents();

    return this.element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  bindEvents() {
    const trackWrapper = this.element.querySelector('[data-action="track"]');
    const thumb = this.element.querySelector('.slider-thumb');
    const fill = this.element.querySelector('.slider-fill');
    const valueOutput = this.element.querySelector('.slider-value');

    // Input events
    this.inputElement.addEventListener('input', (e) => {
      this.value = parseFloat(e.target.value);
      this.updateVisuals();
      this.onInput(this.value, this);
    });

    this.inputElement.addEventListener('change', (e) => {
      this.value = parseFloat(e.target.value);
      this.onChange(this.value, this);
    });

    // Click on track
    trackWrapper.addEventListener('click', (e) => {
      if (this.disabled) return;
      if (e.target === this.inputElement || e.target === thumb) return;
      
      const rect = trackWrapper.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.setValueFromPercentage(percentage);
    });

    // Drag thumb
    thumb.addEventListener('mousedown', (e) => {
      if (this.disabled) return;
      e.preventDefault();
      this.startDrag(e.clientX);
    });

    thumb.addEventListener('touchstart', (e) => {
      if (this.disabled) return;
      this.startDrag(e.touches[0].clientX);
    }, { passive: true });

    // Keyboard support
    this.inputElement.addEventListener('keydown', (e) => {
      if (this.disabled) return;
      let newValue = this.value;
      const step = this.step;
      
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          newValue = Math.min(this.max, this.value + step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          newValue = Math.max(this.min, this.value - step);
          break;
        case 'Home':
          e.preventDefault();
          newValue = this.min;
          break;
        case 'End':
          e.preventDefault();
          newValue = this.max;
          break;
        case 'PageUp':
          e.preventDefault();
          newValue = Math.min(this.max, this.value + step * 10);
          break;
        case 'PageDown':
          e.preventDefault();
          newValue = Math.max(this.min, this.value - step * 10);
          break;
      }
      
      if (newValue !== this.value) {
        this.setValue(newValue);
      }
    });
  }

  startDrag(clientX) {
    this.isDragging = true;
    this.element.classList.add('dragging');
    
    const moveHandler = (e) => {
      if (!this.isDragging) return;
      const trackWrapper = this.element.querySelector('[data-action="track"]');
      const rect = trackWrapper.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      this.setValueFromPercentage(percentage);
    };

    const upHandler = () => {
      this.isDragging = false;
      this.element.classList.remove('dragging');
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
      document.removeEventListener('touchmove', moveHandler);
      document.removeEventListener('touchend', upHandler);
      this.onChange(this.value, this);
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
    document.addEventListener('touchmove', moveHandler, { passive: true });
    document.addEventListener('touchend', upHandler);
  }

  setValueFromPercentage(percentage) {
    const rawValue = this.min + percentage * (this.max - this.min);
    const steppedValue = Math.round(rawValue / this.step) * this.step;
    const clampedValue = Math.max(this.min, Math.min(this.max, steppedValue));
    this.setValue(clampedValue);
  }

  updateVisuals() {
    const percentage = ((this.value - this.min) / (this.max - this.min)) * 100;
    const thumb = this.element.querySelector('.slider-thumb');
    const fill = this.element.querySelector('.slider-fill');
    const track = this.element.querySelector('.slider-track');
    const valueOutput = this.element.querySelector('.slider-value');

    if (thumb) thumb.style.left = `${percentage}%`;
    if (fill) fill.style.width = `${percentage}%`;
    if (track) track.style.setProperty('--slider-progress', `${percentage}%`);
    if (valueOutput) valueOutput.textContent = this.valueFormatter(this.value);
    
    this.inputElement.value = this.value;
    this.inputElement.setAttribute('aria-valuenow', this.value);
  }

  setValue(value) {
    this.value = Math.max(this.min, Math.min(this.max, value));
    this.updateVisuals();
  }

  getValue() {
    return this.value;
  }

  setDisabled(disabled) {
    this.disabled = disabled;
    this.inputElement.disabled = disabled;
    this.element.classList.toggle('disabled', disabled);
  }

  setRange(min, max) {
    this.min = min;
    this.max = max;
    this.inputElement.min = min;
    this.inputElement.max = max;
    this.inputElement.setAttribute('aria-valuemin', min);
    this.inputElement.setAttribute('aria-valuemax', max);
    this.updateVisuals();
  }

  setStep(step) {
    this.step = step;
    this.inputElement.step = step;
  }

  setValueFormatter(formatter) {
    this.valueFormatter = formatter;
    const valueOutput = this.element.querySelector('.slider-value');
    if (valueOutput) valueOutput.textContent = this.valueFormatter(this.value);
  }

  focus() {
    this.inputElement?.focus();
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}