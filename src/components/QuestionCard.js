// src/components/QuestionCard.js
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
          <button class="question-flag-btn ${this.question.flagged ? 'flagged' : ''}" 
                  data-action="flag" 
                  title="${this.question.flagged ? 'Desmarcar' : 'Marcar para revisar'}">
            <i data-lucide="flag" class="w-4 h-4"></i>
          </button>
          <button class="question-explanation-btn" data-action="toggle-explanation">
            <i data-lucide="help-circle" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
      
      <div class="question-content">
        <p class="question-text">${this.question.text}</p>
        ${this.question.image ? `
          <div class="question-image">
            <img src="${this.question.image}" alt="Imagem da questão">
          </div>
        ` : ''}
        ${this.question.code ? `
          <pre class="question-code"><code>${this.question.code}</code></pre>
        ` : ''}
      </div>
      
      <div class="question-answers">
        ${this.question.answers.map((answer, i) => `
          <button class="question-answer ${this.selectedAnswer === i ? 'selected' : ''} ${
            this.isReviewing ? (i === this.question.correctAnswer ? 'correct' : (this.selectedAnswer === i ? 'wrong' : '')) : ''
          }" 
                  data-answer="${i}"
                  ${this.isReviewing ? 'disabled' : ''}>
            <span class="question-answer-letter">${String.fromCharCode(65 + i)}</span>
            <span class="question-answer-text">${answer}</span>
            ${this.isReviewing && i === this.question.correctAnswer ? `
              <i data-lucide="check" class="w-4 h-4 answer-icon"></i>
            ` : ''}
            ${this.isReviewing && this.selectedAnswer === i && i !== this.question.correctAnswer ? `
              <i data-lucide="x" class="w-4 h-4 answer-icon"></i>
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
          <p class="question-explanation-text">${this.question.explanation || 'Nenhuma explicação disponível.'}</p>
          ${this.question.source ? `
            <p class="question-explanation-source">Fonte: ${this.question.source}</p>
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
    this.question.flagged = !this.question.flagged;
    const flagBtn = this.element.querySelector('.question-flag-btn');
    if (flagBtn) {
      flagBtn.classList.toggle('flagged', this.question.flagged);
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
        <p class="question-explanation-text">${this.question.explanation || 'Nenhuma explicação disponível.'}</p>
        ${this.question.source ? `
          <p class="question-explanation-source">Fonte: ${this.question.source}</p>
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
