// src/components/ExamPlayer.js
import { QuestionCard } from './QuestionCard.js';

export class ExamPlayer {
  constructor(options = {}) {
    this.exam = options.exam ?? null;
    this.questions = options.questions ?? [];
    this.currentIndex = 0;
    this.answers = {};
    this.flagged = new Set();
    this.startTime = null;
    this.endTime = null;
    this.isReviewing = false;
    this.timeLimit = options.timeLimit ?? null; // minutes
    
    this.onComplete = options.onComplete ?? (() => {});
    this.onTimeUpdate = options.onTimeUpdate ?? (() => {});
    this.onProgress = options.onProgress ?? (() => {});
    
    this.element = null;
    this.questionCard = null;
    this.timerInterval = null;
  }

  render() {
    if (!this.exam || this.questions.length === 0) {
      return this.renderEmpty();
    }

    this.element = document.createElement('div');
    this.element.className = 'exam-player';
    
    this.element.innerHTML = `
      <div class="exam-header">
        <div class="exam-info">
          <h2 class="exam-title">${this.exam.title}</h2>
          <p class="exam-subject">${this.exam.subject}</p>
        </div>
        <div class="exam-timer">
          <i data-lucide="clock" class="w-5 h-5"></i>
          <span class="exam-time">${this.timeLimit ? this.formatTime(this.timeLimit * 60) : '--:--'}</span>
        </div>
      </div>
      
      <div class="exam-progress">
        <div class="exam-progress-bar">
          <div class="exam-progress-fill" style="width: ${this.getProgressPercent()}%"></div>
        </div>
        <div class="exam-progress-info">
          <span>Questão ${this.currentIndex + 1} de ${this.questions.length}</span>
          <span class="exam-answered">${this.getAnsweredCount()} respondidas</span>
        </div>
      </div>
      
      <div class="exam-question-container"></div>
      
      <div class="exam-navigation">
        <button class="btn btn-secondary" data-action="prev" ${this.currentIndex === 0 ? 'disabled' : ''}>
          <i data-lucide="arrow-left" class="w-4 h-4"></i>
          Anterior
        </button>
        
        <div class="exam-question-dots">
          ${this.questions.map((q, i) => `
            <button class="exam-dot ${i === this.currentIndex ? 'active' : ''} ${
              this.answers[q.id] !== undefined ? 'answered' : ''
            } ${this.flagged.has(q.id) ? 'flagged' : ''}" 
                    data-index="${i}" 
                    title="Questão ${i + 1}">
              ${i + 1}
            </button>
          `).join('')}
        </div>
        
        ${this.currentIndex < this.questions.length - 1 ? `
          <button class="btn btn-primary" data-action="next">
            Próxima
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
          </button>
        ` : `
          <button class="btn btn-success" data-action="finish">
            Finalizar
            <i data-lucide="check" class="w-4 h-4"></i>
          </button>
        `}
      </div>
    `;

    this.renderCurrentQuestion();
    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  renderEmpty() {
    this.element = document.createElement('div');
    this.element.className = 'exam-player empty';
    this.element.innerHTML = `
      <div class="exam-empty">
        <i data-lucide="clipboard-list" class="w-16 h-16"></i>
        <h3>Nenhum simulado disponível</h3>
        <p>Crie um simulado ou selecione um existente para começar.</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
    return this.element;
  }

  renderCurrentQuestion() {
    const container = this.element.querySelector('.exam-question-container');
    if (!container) return;

    const question = this.questions[this.currentIndex];
    
    this.questionCard = new QuestionCard({
      question,
      index: this.currentIndex,
      total: this.questions.length,
      selectedAnswer: this.answers[question.id],
      isReviewing: this.isReviewing,
      onAnswer: (questionId, answerIndex) => this.handleAnswer(questionId, answerIndex),
      onFlag: (questionId, flagged) => this.handleFlag(questionId, flagged)
    });

    container.innerHTML = '';
    container.appendChild(this.questionCard.render());
  }

  bindEvents() {
    this.element.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      switch (action) {
        case 'prev':
          this.prevQuestion();
          break;
        case 'next':
          this.nextQuestion();
          break;
        case 'finish':
          this.finish();
          break;
      }

      // Question dots
      const dot = e.target.closest('.exam-dot');
      if (dot) {
        const index = parseInt(dot.dataset.index);
        this.goToQuestion(index);
      }
    });
  }

  start() {
    this.startTime = new Date();
    this.currentIndex = 0;
    
    if (this.timeLimit) {
      this.startTimer();
    }
    
    this.updateProgress();
  }

  startTimer() {
    let remaining = this.timeLimit * 60;
    
    this.timerInterval = setInterval(() => {
      remaining--;
      
      const timeEl = this.element?.querySelector('.exam-time');
      if (timeEl) {
        timeEl.textContent = this.formatTime(remaining);
      }
      
      this.onTimeUpdate(remaining);
      
      if (remaining <= 0) {
        this.finish();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  goToQuestion(index) {
    if (index < 0 || index >= this.questions.length) return;
    
    this.currentIndex = index;
    this.renderCurrentQuestion();
    this.updateNavigation();
    this.updateDots();
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.goToQuestion(this.currentIndex - 1);
    }
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.goToQuestion(this.currentIndex + 1);
    }
  }

  handleAnswer(questionId, answerIndex) {
    this.answers[questionId] = answerIndex;
    this.updateProgress();
    this.updateDots();
  }

  handleFlag(questionId, flagged) {
    if (flagged) {
      this.flagged.add(questionId);
    } else {
      this.flagged.delete(questionId);
    }
    this.updateDots();
  }

  finish() {
    this.stopTimer();
    this.endTime = new Date();
    
    const results = this.calculateResults();
    this.onComplete(results);
  }

  calculateResults() {
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;

    const questionResults = this.questions.map(question => {
      const answer = this.answers[question.id];
      const isCorrect = answer === question.correctAnswer;
      
      if (answer === undefined) {
        unanswered++;
      } else if (isCorrect) {
        correct++;
      } else {
        incorrect++;
      }

      return {
        questionId: question.id,
        selectedAnswer: answer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        flagged: this.flagged.has(question.id)
      };
    });

    const totalTime = Math.floor((this.endTime - this.startTime) / 1000);
    const score = (correct / this.questions.length) * 100;

    return {
      exam: this.exam,
      totalQuestions: this.questions.length,
      correct,
      incorrect,
      unanswered,
      score: Math.round(score),
      totalTime,
      questionResults,
      startTime: this.startTime,
      endTime: this.endTime
    };
  }

  updateProgress() {
    const fill = this.element?.querySelector('.exam-progress-fill');
    const answered = this.element?.querySelector('.exam-answered');
    
    if (fill) fill.style.width = `${this.getProgressPercent()}%`;
    if (answered) answered.textContent = `${this.getAnsweredCount()} respondidas`;
    
    this.onProgress(this.currentIndex, this.questions.length);
  }

  updateNavigation() {
    const prevBtn = this.element?.querySelector('[data-action="prev"]');
    const nextBtn = this.element?.querySelector('[data-action="next"]');
    const finishBtn = this.element?.querySelector('[data-action="finish"]');
    
    if (prevBtn) prevBtn.disabled = this.currentIndex === 0;
    
    if (this.currentIndex === this.questions.length - 1) {
      if (nextBtn) nextBtn.style.display = 'none';
      if (finishBtn) finishBtn.style.display = 'flex';
    } else {
      if (nextBtn) nextBtn.style.display = 'flex';
      if (finishBtn) finishBtn.style.display = 'none';
    }
  }

  updateDots() {
    this.element?.querySelectorAll('.exam-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === this.currentIndex);
      dot.classList.toggle('answered', this.answers[this.questions[i].id] !== undefined);
      dot.classList.toggle('flagged', this.flagged.has(this.questions[i].id));
    });
  }

  getProgressPercent() {
    return this.questions.length > 0 
      ? (Object.keys(this.answers).length / this.questions.length) * 100 
      : 0;
  }

  getAnsweredCount() {
    return Object.keys(this.answers).length;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  setReviewMode(isReviewing) {
    this.isReviewing = isReviewing;
    this.renderCurrentQuestion();
  }

  destroy() {
    this.stopTimer();
    this.questionCard?.destroy();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
