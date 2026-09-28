// src/components/QuestionCard.js
import { escapeHtml, safeResourceUrl } from '../utils/html.js';

function renderImages(images, altPrefix) {
  if (!Array.isArray(images) || images.length === 0) return '';
  return `<div class="question-images">${images.map((src, index) => `
    <img src="${safeResourceUrl(src)}" alt="${escapeHtml(altPrefix)} ${index + 1}">
  `).join('')}</div>`;
}

export class QuestionCard {
  constructor(options = {}) {
    this.question = options.question ?? null;
    this.index = options.index ?? 0;
    this.total = options.total ?? 0;
    this.selectedAnswer = options.selectedAnswer ?? null;
    this.isReviewing = options.isReviewing ?? false;
    this.showExplanation = options.showExplanation ?? false;
    
    this.onAnswer = options.onAnswer ?? (() => {});
    this.onFlag = options.onFlag ?? (() => {});
    
    this.element = null;
  }

  render() {
    if (!this.question) return this.renderEmpty();

    this.element = document.createElement('div');
    this.element.className = 'question-card';
    this.element.tabIndex = 0;

    const isCorrect = this.selectedAnswer !== null && 
      this.selectedAnswer === this.question.correctAnswer;
    const isWrong = this.selectedAnswer !== null && 
      this.selectedAnswer !== this.question.correctAnswer;

    this.element.innerHTML = `
      <div class="question-header">
        <span class="question-number">Questão ${this.index + 1} de ${this.total}</span>
        <div class="question-actions">
          <button type="button" class="question-flag-btn ${this.question.flagged ? 'flagged' : ''}"
                  data-action="flag"
                  aria-pressed="${this.question.flagged ? 'true' : 'false'}"
                  aria-label="Marcar para revisar (F)"
                  ${this.isReviewing ? 'disabled' : ''}>
            <i data-lucide="flag" class="w-4 h-4"></i>
          </button>
          <button class="question-explanation-btn" data-action="toggle-explanation">
            <i data-lucide="help-circle" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
      
      <div class="question-content">
        ${this.question.reference ? `
          <section class="question-reference" aria-label="Texto de referência">
            <div class="question-reference-label">Texto de referência</div>
            ${this.question.reference.title ? `<h3 class="question-reference-title">${escapeHtml(this.question.reference.title)}</h3>` : ''}
            <p class="question-reference-body">${escapeHtml(this.question.reference.body)}</p>
            ${renderImages(this.question.reference.images, 'Imagem do texto de referência')}
          </section>
        ` : ''}
        <p class="question-text">${escapeHtml(this.question.text)}</p>
        ${renderImages(this.question.images ?? (this.question.image ? [this.question.image] : []), 'Imagem da questão')}
        ${this.question.code ? `
          <pre class="question-code"><code>${escapeHtml(this.question.code)}</code></pre>
        ` : ''}
      </div>
      
      <div class="question-answers">
        ${this.question.answers.map((answer, i) => `
          <button type="button" class="question-answer ${this.selectedAnswer === i ? 'selected' : ''} ${
            this.isReviewing ? (i === this.question.correctAnswer ? 'correct' : (this.selectedAnswer === i ? 'wrong' : '')) : ''
          }" 
                  data-answer="${i}"
                  ${this.isReviewing ? 'disabled' : ''}>
            <span class="question-answer-letter">${String.fromCharCode(65 + i)}</span>
            <span class="question-answer-text">${escapeHtml(answer)}</span>
            ${this.isReviewing && i === this.question.correctAnswer ? `
              <i data-lucide="check" class="w-4 h-4 answer-icon"></i>
              <span class="sr-only">Resposta correta</span>
            ` : ''}
            ${this.isReviewing && this.selectedAnswer === i && i !== this.question.correctAnswer ? `
              <i data-lucide="x" class="w-4 h-4 answer-icon"></i>
              <span class="sr-only">Sua resposta, incorreta</span>
            ` : ''}
          </button>
        `).join('')}
      </div>
      
      ${this.showExplanation ? `
        <div class="question-explanation">
          <div class="question-explanation-header">
            <i data-lucide="lightbulb" class="w-5 h-5"></i>
            <span>Explicação</span>
          </div>
          <p class="question-explanation-text">${escapeHtml(this.question.explanation || 'Nenhuma explicação disponível.')}</p>
          ${this.question.source ? `
            <p class="question-explanation-source">Fonte: ${escapeHtml(this.question.source)}</p>
          ` : ''}
        </div>
      ` : ''}
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  renderEmpty() {
    this.element = document.createElement('div');
    this.element.className = 'question-card empty';
    this.element.innerHTML = `
      <div class="question-empty">
        <i data-lucide="help-circle" class="w-12 h-12"></i>
        <p>Nenhuma questão disponível</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
    return this.element;
  }

  bindEvents() {
    // Answer selection
    this.element.addEventListener('click', (e) => {
      const answerBtn = e.target.closest('[data-answer]');
      if (answerBtn && !this.isReviewing) {
        const answerIndex = parseInt(answerBtn.dataset.answer);
        this.selectAnswer(answerIndex);
      }

      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'flag') {
        this.toggleFlag();
      }
      if (action === 'toggle-explanation') {
        this.toggleExplanation();
      }
    });

    // Keyboard navigation
    this.element.addEventListener('keydown', (e) => {
      if (this.isReviewing) return;

      switch (e.key) {
        case 'a':
        case 'A':
          this.selectAnswer(0);
          break;
        case 'b':
        case 'B':
          this.selectAnswer(1);
          break;
        case 'c':
        case 'C':
          this.selectAnswer(2);
          break;
        case 'd':
        case 'D':
          this.selectAnswer(3);
          break;
        case 'e':
        case 'E':
          if (this.question.answers.length > 4) {
            this.selectAnswer(4);
          }
          break;
        case 'f':
        case 'F':
          this.toggleFlag();
          break;
      }
    });
  }

  selectAnswer(index) {
    if (this.isReviewing) return;
    
    this.selectedAnswer = index;
    this.element.querySelectorAll('.question-answer').forEach((btn, i) => {
      btn.classList.toggle('selected', i === index);
    });
    
    this.onAnswer(this.question.id, index);
  }

  toggleFlag() {
    if (this.isReviewing) return;
    this.question.flagged = !this.question.flagged;
    const flagBtn = this.element.querySelector('.question-flag-btn');
    if (flagBtn) {
      flagBtn.classList.toggle('flagged', this.question.flagged);
      flagBtn.setAttribute('aria-pressed', String(this.question.flagged));
    }
    this.onFlag(this.question.id, this.question.flagged);
  }

  toggleExplanation() {
    this.showExplanation = !this.showExplanation;
    
    let explanationEl = this.element.querySelector('.question-explanation');
    
    if (this.showExplanation && !explanationEl) {
      explanationEl = document.createElement('div');
      explanationEl.className = 'question-explanation';
      explanationEl.innerHTML = `
        <div class="question-explanation-header">
          <i data-lucide="lightbulb" class="w-5 h-5"></i>
          <span>Explicação</span>
        </div>
        <p class="question-explanation-text">${escapeHtml(this.question.explanation || 'Nenhuma explicação disponível.')}</p>
        ${this.question.source ? `
          <p class="question-explanation-source">Fonte: ${escapeHtml(this.question.source)}</p>
        ` : ''}
      `;
      this.element.appendChild(explanationEl);
      if (typeof lucide !== 'undefined') lucide.createIcons(explanationEl);
    } else if (!this.showExplanation && explanationEl) {
      explanationEl.remove();
    }
  }

  setQuestion(question, index, total) {
    this.question = question;
    this.index = index;
    this.total = total;
    this.selectedAnswer = null;
    this.showExplanation = false;
    
    // Re-render
    const parent = this.element?.parentNode;
    if (parent) {
      const newElement = this.render();
      parent.replaceChild(newElement, this.element);
    }
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
