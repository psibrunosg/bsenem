// src/components/ExamPlayer.js
import { QuestionCard } from './QuestionCard.js';
import { renderIcons } from '../utils/icons.js';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'];
const SAVE_DELAY_MS = 500;
const TIME_SAVE_INTERVAL_SECONDS = 30;
const KIND_TITLES = { practice: 'Prática', custom: 'Simulado personalizado', catalog: 'Simulado' };

/**
 * Plays a remote simulator session. Restores the persisted draft, saves progress
 * through onProgressSaved and delegates completion to onComplete; it never
 * calculates the result. A completed session opens read-only for review.
 */
export class ExamPlayer {
  constructor({ session = null, onProgressSaved = async () => {}, onComplete = async () => {}, onExit = () => {} } = {}) {
    this.session = session;
    this.questions = (session?.questions ?? []).map(toCardQuestion);
    this.isReviewing = session?.status === 'completed';
    this.answers = {};
    this.flagged = new Set();
    for (const answer of session?.answers ?? []) {
      const index = OPTION_KEYS.indexOf(answer.selected_option);
      if (index >= 0) this.answers[answer.question_id] = index;
      if (answer.flagged) this.flagged.add(answer.question_id);
    }
    this.currentIndex = Math.min(Math.max(session?.current_position ?? 0, 0), Math.max(this.questions.length - 1, 0));
    this.timeLimit = session?.time_limit_seconds ?? 0;
    this.baselineElapsed = session?.elapsed_seconds ?? 0;
    this.resumedAt = null;
    this.lastSavedElapsed = this.baselineElapsed;

    this.onProgressSaved = onProgressSaved;
    this.onComplete = onComplete;
    this.onExit = onExit;

    this.element = null;
    this.questionCard = null;
    this.timerInterval = null;
    this.saveTimeout = null;
    this.saveChain = Promise.resolve(true);
    this.finishing = false;
    this.destroyed = false;
    this.handlePageHidden = (event) => {
      if (this.finishing || this.destroyed) return;
      if (event.type === 'pagehide' || document.visibilityState === 'hidden') this.flush({ keepalive: true });
    };
  }

  render() {
    if (this.questions.length === 0) {
      return this.renderEmpty();
    }

    this.element = document.createElement('div');
    this.element.className = `exam-player${this.isReviewing ? ' exam-player-review' : ''}`;
    const total = this.questions.length;

    this.element.innerHTML = `
      <div class="exam-header">
        <div class="exam-info">
          <h2 class="exam-title"></h2>
          <p class="exam-subject"></p>
        </div>
        <div class="exam-header-actions">
          ${this.isReviewing ? '' : `
            <div class="exam-timer" aria-label="Tempo restante">
              <i data-lucide="clock" class="w-5 h-5"></i>
              <span class="exam-time">${formatTime(this.remainingSeconds())}</span>
            </div>
          `}
          <button type="button" class="btn btn-secondary btn-sm" data-action="exit">
            ${this.isReviewing ? 'Voltar ao resultado' : 'Salvar e sair'}
          </button>
        </div>
      </div>

      <div class="exam-alert-slot"></div>

      <div class="exam-progress">
        <progress class="exam-progress-bar" max="${total}" value="${this.getAnsweredCount()}"></progress>
        <div class="exam-progress-info">
          <span class="exam-position"></span>
          <span class="exam-answered">${this.getAnsweredCount()} respondidas</span>
        </div>
      </div>

      <div class="exam-question-container"></div>

      <div class="exam-navigation">
        <button type="button" class="btn btn-secondary" data-action="prev">
          <i data-lucide="arrow-left" class="w-4 h-4"></i>
          Anterior
        </button>

        <div class="exam-question-dots">
          ${this.questions.map((_, i) => `
            <button type="button" class="exam-dot" data-index="${i}" aria-label="Questão ${i + 1}">${i + 1}</button>
          `).join('')}
        </div>

        <button type="button" class="btn btn-primary" data-action="next">
          Próxima
          <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </button>
        ${this.isReviewing ? '' : `
          <button type="button" class="btn btn-success" data-action="finish">
            Finalizar
            <i data-lucide="check" class="w-4 h-4"></i>
          </button>
        `}
      </div>
    `;

    this.element.querySelector('.exam-title').textContent = this.isReviewing
      ? 'Revisão'
      : KIND_TITLES[this.session.kind] ?? 'Simulado';
    this.element.querySelector('.exam-subject').textContent = [this.session.subject, this.session.topic]
      .filter(Boolean)
      .join(' · ');

    this.renderCurrentQuestion();
    this.updateNavigation();
    this.updateDots();
    this.bindEvents();

    return this.element;
  }

  renderEmpty() {
    this.element = document.createElement('div');
    this.element.className = 'exam-player empty';
    this.element.innerHTML = `
      <div class="exam-empty">
        <i data-lucide="clipboard-list" class="w-16 h-16"></i>
        <h3>Sessão sem questões</h3>
        <p>Não foi possível carregar as questões desta sessão.</p>
        <button type="button" class="btn btn-secondary" data-action="exit">Voltar</button>
      </div>
    `;
    this.element.querySelector('[data-action="exit"]').addEventListener('click', () => this.onExit());
    return this.element;
  }

  renderCurrentQuestion() {
    const container = this.element?.querySelector('.exam-question-container');
    if (!container) return;

    const hadFocus = container.contains(document.activeElement);
    const question = this.questions[this.currentIndex];
    this.questionCard?.destroy();
    this.questionCard = new QuestionCard({
      question: { ...question, flagged: this.flagged.has(question.id) },
      index: this.currentIndex,
      total: this.questions.length,
      selectedAnswer: this.answers[question.id] ?? null,
      isReviewing: this.isReviewing,
      onAnswer: (questionId, answerIndex) => this.handleAnswer(questionId, answerIndex),
      onFlag: (questionId, flagged) => this.handleFlag(questionId, flagged),
    });

    container.replaceChildren(this.questionCard.render());
    renderIcons(container);
    if (hadFocus) this.questionCard.element.focus();
  }

  bindEvents() {
    this.element.addEventListener('click', (event) => {
      const dot = event.target.closest('.exam-dot');
      if (dot) {
        this.goToQuestion(Number(dot.dataset.index));
        return;
      }

      switch (event.target.closest('[data-action]')?.dataset.action) {
        case 'prev':
          this.prevQuestion();
          break;
        case 'next':
          this.nextQuestion();
          break;
        case 'finish':
          this.finish();
          break;
        case 'retry-save':
          this.flush();
          break;
        case 'exit':
          this.exit();
          break;
        default:
      }
    });
  }

  start() {
    if (this.isReviewing || this.questions.length === 0) return;
    this.resumedAt = Date.now();
    window.addEventListener('pagehide', this.handlePageHidden);
    document.addEventListener('visibilitychange', this.handlePageHidden);
    if (this.remainingSeconds() <= 0) {
      this.finish();
      return;
    }
    this.startTimer();
  }

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => this.tick(), 1000);
  }

  tick() {
    const remaining = this.remainingSeconds();
    const timeEl = this.element?.querySelector('.exam-time');
    if (timeEl) timeEl.textContent = formatTime(remaining);

    if (remaining <= 0) {
      this.finish();
    } else if (this.elapsedSeconds() - this.lastSavedElapsed >= TIME_SAVE_INTERVAL_SECONDS) {
      this.scheduleSave();
    }
  }

  stopTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  }

  elapsedSeconds() {
    const inTab = this.resumedAt === null ? 0 : Math.floor((Date.now() - this.resumedAt) / 1000);
    return Math.min(this.baselineElapsed + inTab, this.timeLimit);
  }

  remainingSeconds() {
    return Math.max(0, this.timeLimit - this.elapsedSeconds());
  }

  goToQuestion(index) {
    if (index < 0 || index >= this.questions.length || index === this.currentIndex) return;

    this.currentIndex = index;
    this.renderCurrentQuestion();
    this.updateNavigation();
    this.updateDots();
    this.scheduleSave();
  }

  prevQuestion() {
    this.goToQuestion(this.currentIndex - 1);
  }

  nextQuestion() {
    this.goToQuestion(this.currentIndex + 1);
  }

  handleAnswer(questionId, answerIndex) {
    if (this.isReviewing) return;
    this.answers[questionId] = answerIndex;
    this.updateProgress();
    this.updateDots();
    this.scheduleSave();
  }

  handleFlag(questionId, flagged) {
    if (this.isReviewing) return;
    if (flagged) {
      this.flagged.add(questionId);
    } else {
      this.flagged.delete(questionId);
    }
    this.updateDots();
    this.scheduleSave();
  }

  scheduleSave() {
    if (this.isReviewing || this.finishing || this.destroyed) return;
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  /**
   * Sends the full draft now; saves run in order so the last snapshot wins.
   * requestOptions ({ keepalive }) lets the save outlive a page being unloaded.
   */
  flush(requestOptions) {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = null;
    if (this.isReviewing) return Promise.resolve(true);

    const progress = this.progressPayload();
    this.saveChain = this.saveChain.then(async () => {
      try {
        await (requestOptions ? this.onProgressSaved(progress, requestOptions) : this.onProgressSaved(progress));
        this.lastSavedElapsed = progress.elapsed_seconds;
        this.showAlert(null);
        return true;
      } catch (error) {
        this.showAlert(error?.message || 'Não foi possível salvar seu progresso.', 'retry-save', 'Tentar salvar novamente');
        return false;
      }
    });
    return this.saveChain;
  }

  progressPayload() {
    return {
      position: this.currentIndex,
      elapsed_seconds: this.elapsedSeconds(),
      answers: this.questions.map((question) => ({
        question_id: question.id,
        selected_option: OPTION_KEYS[this.answers[question.id]] ?? null,
        flagged: this.flagged.has(question.id),
      })),
    };
  }

  async finish() {
    if (this.isReviewing || this.finishing || this.destroyed) return;
    this.finishing = true;
    this.stopTimer();

    if (!(await this.flush())) {
      this.resumeAfterFailure();
      return;
    }
    try {
      await this.onComplete();
    } catch (error) {
      this.showAlert(error?.message || 'Não foi possível concluir o simulado.', 'finish', 'Tentar concluir novamente');
      this.resumeAfterFailure();
    }
  }

  resumeAfterFailure() {
    this.finishing = false;
    if (!this.destroyed && this.remainingSeconds() > 0) this.startTimer();
  }

  async exit() {
    if (this.isReviewing) {
      this.onExit();
      return;
    }
    if (this.finishing) return;
    if (await this.flush()) this.onExit();
  }

  showAlert(message, action, label) {
    const slot = this.element?.querySelector('.exam-alert-slot');
    if (!slot) return;
    if (!message) {
      slot.replaceChildren();
      return;
    }

    const alert = document.createElement('div');
    alert.className = 'exam-alert';
    alert.setAttribute('role', 'alert');
    const text = document.createElement('span');
    text.textContent = message;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary btn-sm';
    button.dataset.action = action;
    button.textContent = label;
    alert.append(text, button);
    slot.replaceChildren(alert);
  }

  updateProgress() {
    const bar = this.element?.querySelector('.exam-progress-bar');
    const answered = this.element?.querySelector('.exam-answered');
    if (bar) bar.value = this.getAnsweredCount();
    if (answered) answered.textContent = `${this.getAnsweredCount()} respondidas`;
  }

  updateNavigation() {
    const isLast = this.currentIndex === this.questions.length - 1;
    const position = this.element?.querySelector('.exam-position');
    const prevBtn = this.element?.querySelector('[data-action="prev"]');
    const nextBtn = this.element?.querySelector('[data-action="next"]');
    const finishBtn = this.element?.querySelector('.exam-navigation [data-action="finish"]');

    if (position) position.textContent = `Questão ${this.currentIndex + 1} de ${this.questions.length}`;
    if (prevBtn) prevBtn.disabled = this.currentIndex === 0;
    if (nextBtn) nextBtn.hidden = isLast;
    if (finishBtn) finishBtn.hidden = !isLast;
  }

  updateDots() {
    this.element?.querySelectorAll('.exam-dot').forEach((dot, i) => {
      const id = this.questions[i].id;
      dot.classList.toggle('active', i === this.currentIndex);
      dot.classList.toggle('answered', this.answers[id] !== undefined);
      dot.classList.toggle('flagged', this.flagged.has(id));
      const states = [this.answers[id] !== undefined ? 'respondida' : 'sem resposta'];
      if (this.flagged.has(id)) states.push('marcada para revisar');
      dot.setAttribute('aria-label', `Questão ${i + 1}, ${states.join(', ')}`);
      if (i === this.currentIndex) {
        dot.setAttribute('aria-current', 'step');
      } else {
        dot.removeAttribute('aria-current');
      }
    });
  }

  getAnsweredCount() {
    return Object.keys(this.answers).length;
  }

  destroy() {
    const pendingDraft = !this.isReviewing && !this.finishing && !this.destroyed && this.resumedAt !== null
      && (this.saveTimeout !== null || this.elapsedSeconds() !== this.lastSavedElapsed);
    this.stopTimer();
    window.removeEventListener('pagehide', this.handlePageHidden);
    document.removeEventListener('visibilitychange', this.handlePageHidden);
    if (pendingDraft) this.flush();
    this.destroyed = true;
    this.questionCard?.destroy();
    this.element?.remove();
  }
}

function toCardQuestion(question) {
  const correctIndex = OPTION_KEYS.indexOf(question.correct_option);
  return {
    id: question.id,
    text: question.statement,
    answers: OPTION_KEYS.map((key) => question.options?.[key] ?? ''),
    correctAnswer: correctIndex >= 0 ? correctIndex : null,
  };
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
