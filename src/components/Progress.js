// src/components/Progress.js
export class Progress {
  constructor(options = {}) {
    this.value = options.value ?? 0;
    this.min = options.min ?? 0;
    this.max = options.max ?? 100;
    this.size = options.size ?? 'md'; // sm, md, lg
    this.variant = options.variant ?? 'default'; // default, success, warning, error, info
    this.showLabel = options.showLabel ?? false;
    this.label = options.label ?? null;
    this.labelFormatter = options.labelFormatter ?? ((v, min, max) => `${Math.round((v - min) / (max - min) * 100)}%`);
    this.striped = options.striped ?? false;
    this.animated = options.animated ?? false;
    this.id = options.id ?? `progress-${Math.random().toString(36).substr(2, 9)}`;
    this.element = null;
  }

  render() {
    const percentage = Math.max(0, Math.min(100, ((this.value - this.min) / (this.max - this.min)) * 100));

    this.element = document.createElement('div');
    this.element.className = `progress progress-${this.size} ${this.striped ? 'progress-striped' : ''} ${this.animated ? 'progress-animated' : ''}`;
    
    this.element.innerHTML = `
      ${this.label || this.showLabel ? `
        <div class="progress-label">
          ${this.label ? `<span class="progress-label-text">${this.escapeHtml(this.label)}</span>` : ''}
          ${this.showLabel ? `<span class="progress-label-value" id="${this.id}-value">${this.escapeHtml(this.labelFormatter(this.value, this.min, this.max))}</span>` : ''}
        </div>
      ` : ''}
      <div class="progress-track" role="progressbar" aria-valuenow="${this.value}" aria-valuemin="${this.min}" aria-valuemax="${this.max}" aria-label="${this.escapeHtml(this.label ?? 'Progresso')}" id="${this.id}">
        <div class="progress-fill progress-${this.variant}" style="width: ${percentage}%"></div>
      </div>
    `;

    return this.element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setValue(value) {
    this.value = Math.max(this.min, Math.min(this.max, value));
    const percentage = Math.max(0, Math.min(100, ((this.value - this.min) / (this.max - this.min)) * 100));
    
    const fill = this.element.querySelector('.progress-fill');
    const track = this.element.querySelector('.progress-track');
    const valueEl = this.element.querySelector('.progress-label-value');
    
    if (fill) fill.style.width = `${percentage}%`;
    if (track) track.setAttribute('aria-valuenow', this.value);
    if (valueEl) valueEl.textContent = this.labelFormatter(this.value, this.min, this.max);
  }

  getValue() {
    return this.value;
  }

  setMin(min) {
    this.min = min;
    const track = this.element.querySelector('.progress-track');
    if (track) track.setAttribute('aria-valuemin', min);
    this.setValue(this.value); // Recalculate percentage
  }

  setMax(max) {
    this.max = max;
    const track = this.element.querySelector('.progress-track');
    if (track) track.setAttribute('aria-valuemax', max);
    this.setValue(this.value); // Recalculate percentage
  }

  setRange(min, max) {
    this.min = min;
    this.max = max;
    const track = this.element.querySelector('.progress-track');
    if (track) {
      track.setAttribute('aria-valuemin', min);
      track.setAttribute('aria-valuemax', max);
    }
    this.setValue(this.value);
  }

  setLabel(label) {
    this.label = label;
    const labelEl = this.element.querySelector('.progress-label-text');
    if (labelEl) labelEl.textContent = label;
  }

  setShowLabel(show) {
    this.showLabel = show;
    this.rebuild();
  }

  setStriped(striped) {
    this.striped = striped;
    this.element.classList.toggle('progress-striped', striped);
  }

  setAnimated(animated) {
    this.animated = animated;
    this.element.classList.toggle('progress-animated', animated);
  }

  setVariant(variant) {
    this.variant = variant;
    const fill = this.element.querySelector('.progress-fill');
    if (fill) {
      fill.className = `progress-fill progress-${variant}`;
    }
  }

  rebuild() {
    const parent = this.element.parentNode;
    if (parent) {
      this.element.remove();
      parent.appendChild(this.render());
    }
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

// Circular progress
export class CircularProgress {
  constructor(options = {}) {
    this.value = options.value ?? 0;
    this.min = options.min ?? 0;
    this.max = options.max ?? 100;
    this.size = options.size ?? 120; // pixels
    this.strokeWidth = options.strokeWidth ?? 8;
    this.variant = options.variant ?? 'default'; // default, success, warning, error, info
    this.showValue = options.showValue ?? true;
    this.label = options.label ?? null;
    this.labelFormatter = options.labelFormatter ?? ((v, min, max) => `${Math.round((v - min) / (max - min) * 100)}%`);
    this.cap = options.cap ?? 'round'; // butt, round, square
    this.trackColor = options.trackColor ?? null;
    this.element = null;
  }

  render() {
    const percentage = Math.max(0, Math.min(100, ((this.value - this.min) / (this.max - this.min)) * 100));
    const radius = (this.size - this.strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    const svgStyles = `
      width: ${this.size}px;
      height: ${this.size}px;
      transform: rotate(-90deg);
    `;

    this.element = document.createElement('div');
    this.element.className = 'circular-progress';
    this.element.style.width = `${this.size}px`;
    this.element.style.height = `${this.size}px`;
    
    this.element.innerHTML = `
      <svg class="circular-progress-svg" viewBox="0 0 ${this.size} ${this.size}" style="${svgStyles}" aria-hidden="true">
        <circle
          class="circular-progress-track"
          cx="${this.size / 2}"
          cy="${this.size / 2}"
          r="${radius}"
          stroke-width="${this.strokeWidth}"
          fill="none"
          ${this.trackColor ? `stroke="${this.trackColor}"` : ''}
        />
        <circle
          class="circular-progress-fill circular-progress-${this.variant}"
          cx="${this.size / 2}"
          cy="${this.size / 2}"
          r="${radius}"
          stroke-width="${this.strokeWidth}"
          stroke-linecap="${this.cap}"
          fill="none"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"
          style="transition: stroke-dashoffset 0.5s ease-out;"
        />
      </svg>
      ${this.showValue || this.label ? `
        <div class="circular-progress-content">
          ${this.showValue ? `<span class="circular-progress-value">${this.escapeHtml(this.labelFormatter(this.value, this.min, this.max))}</span>` : ''}
          ${this.label ? `<span class="circular-progress-label">${this.escapeHtml(this.label)}</span>` : ''}
        </div>
      ` : ''}
    `;

    return this.element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setValue(value) {
    this.value = Math.max(this.min, Math.min(this.max, value));
    const percentage = Math.max(0, Math.min(100, ((this.value - this.min) / (this.max - this.min)) * 100));
    const radius = (this.size - this.strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    const fill = this.element.querySelector('.circular-progress-fill');
    const valueEl = this.element.querySelector('.circular-progress-value');
    
    if (fill) fill.style.strokeDashoffset = offset;
    if (valueEl) valueEl.textContent = this.labelFormatter(this.value, this.min, this.max);
  }

  getValue() {
    return this.value;
  }

  setLabel(label) {
    this.label = label;
    const labelEl = this.element.querySelector('.circular-progress-label');
    if (labelEl) labelEl.textContent = label;
    else if (label && this.element) {
      const content = this.element.querySelector('.circular-progress-content');
      if (content) {
        content.insertAdjacentHTML('beforeend', `<span class="circular-progress-label">${this.escapeHtml(label)}</span>`);
      }
    }
  }

  setVariant(variant) {
    this.variant = variant;
    const fill = this.element.querySelector('.circular-progress-fill');
    if (fill) {
      fill.className = `circular-progress-fill circular-progress-${variant}`;
    }
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

// Step progress (for wizards, onboarding)
export class StepProgress {
  constructor(options = {}) {
    this.steps = options.steps ?? []; // [{ label, description, icon, completed, current, error }]
    this.currentStep = options.currentStep ?? 0;
    this.orientation = options.orientation ?? 'horizontal'; // horizontal, vertical
    this.clickable = options.clickable ?? false;
    this.onStepClick = options.onStepClick ?? (() => {});
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = `step-progress step-progress-${this.orientation}`;
    this.element.setAttribute('role', 'navigation');
    this.element.setAttribute('aria-label', 'Progresso das etapas');

    this.element.innerHTML = `
      <ol class="step-progress-list">
        ${this.steps.map((step, index) => `
          <li class="step-progress-item ${index < this.currentStep ? 'completed' : ''} ${index === this.currentStep ? 'current' : ''} ${step.error ? 'error' : ''} ${this.clickable ? 'clickable' : ''}" 
              data-step="${index}"
              ${this.clickable ? 'role="button" tabindex="0"' : ''}>
            <div class="step-progress-marker" aria-hidden="true">
              ${step.icon ? `<i data-lucide="${step.icon}" class="w-4 h-4"></i>` : ''}
              ${index < this.currentStep && !step.icon ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}
              ${index === this.currentStep && !step.icon ? `<span class="step-progress-dot"></span>` : ''}
            </div>
            <div class="step-progress-content">
              <span class="step-progress-label">${this.escapeHtml(step.label)}</span>
              ${step.description ? `<span class="step-progress-description">${this.escapeHtml(step.description)}</span>` : ''}
            </div>
            ${index < this.steps.length - 1 ? '<div class="step-progress-line" aria-hidden="true"></div>' : ''}
          </li>
        `).join('')}
      </ol>
    `;

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
    if (!this.clickable) return;

    this.element.querySelectorAll('.step-progress-item.clickable').forEach(item => {
      item.addEventListener('click', () => {
        const step = parseInt(item.dataset.step);
        if (step <= this.currentStep + 1) { // Can only go to next or previous
          this.onStepClick(step, this);
        }
      });

      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
    });
  }

  setCurrentStep(step) {
    this.currentStep = Math.max(0, Math.min(this.steps.length - 1, step));
    this.rebuild();
  }

  setSteps(steps) {
    this.steps = steps;
    this.rebuild();
  }

  completeStep(step) {
    if (step < this.steps.length) {
      this.steps[step].completed = true;
      this.rebuild();
    }
  }

  setStepError(step, error = true) {
    if (step < this.steps.length) {
      this.steps[step].error = error;
      this.rebuild();
    }
  }

  rebuild() {
    const parent = this.element.parentNode;
    if (parent) {
      this.element.remove();
      parent.appendChild(this.render());
    }
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}