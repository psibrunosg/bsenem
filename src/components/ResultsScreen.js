// src/components/ResultsScreen.js
import { escapeHtml } from '../utils/html.js';

/**
 * Presents a result already calculated and persisted by the server.
 * It never records attempts on its own.
 */
export class ResultsScreen {
  constructor({ result = null, session = null, onReview = () => {}, onRetry = () => {}, onBack = () => {} } = {}) {
    this.result = result;
    this.session = session;

    this.onReview = onReview;
    this.onRetry = onRetry;
    this.onBack = onBack;

    this.element = null;
  }

  render() {
    if (!this.result || !this.session) {
      return this.renderEmpty();
    }

    this.element = document.createElement('div');
    this.element.className = 'results-screen';

    const { correct, incorrect, unanswered, score } = this.result;
    const total = this.session.questions?.length ?? correct + incorrect + unanswered;
    const scoreLabel = `${Math.round(score)}%`;
    const scope = [this.session.subject, this.session.topic].filter(Boolean).join(' · ');

    this.element.innerHTML = `
      <div class="results-header">
        <h2 class="results-title">Resultado</h2>
        <p class="results-subtitle"></p>
      </div>

      <div class="results-score">
        <p class="results-score-value"></p>
        <p class="results-score-label"></p>
      </div>

      <div class="results-stats">
        ${stat('correct', 'success', 'check-circle', correct, 'Corretas')}
        ${stat('incorrect', 'error', 'x-circle', incorrect, 'Erradas')}
        ${stat('unanswered', 'secondary', 'circle-dashed', unanswered, 'Sem resposta')}
        ${stat('time', 'info', 'clock', formatTime(this.session.elapsed_seconds ?? 0), 'Tempo usado')}
      </div>

      <div class="results-details">
        <h3>Resumo por questão</h3>
        <ol class="results-question-list"></ol>
      </div>

      <div class="results-actions">
        <button type="button" class="btn btn-secondary" data-action="back">
          <i data-lucide="arrow-left" class="w-4 h-4"></i>
          Voltar aos simulados
        </button>
        <button type="button" class="btn btn-secondary" data-action="retry">
          <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          Praticar de novo
        </button>
        <button type="button" class="btn btn-primary" data-action="review">
          Revisar respostas
          <i data-lucide="eye" class="w-4 h-4"></i>
        </button>
      </div>
    `;

    this.element.querySelector('.results-subtitle').textContent = scope || 'Simulado';
    this.element.querySelector('.results-score-value').textContent = scoreLabel;
    this.element.querySelector('.results-score-label').textContent = `${correct} de ${total} corretas`;
    this.element.querySelector('.results-question-list').append(...this.questionItems());

    this.bindEvents();

    return this.element;
  }

  questionItems() {
    const answers = new Map((this.session.answers ?? []).map((answer) => [answer.question_id, answer]));
    return (this.session.questions ?? []).map((question, i) => {
      const answer = answers.get(question.id);
      const state = !answer?.selected_option ? 'unanswered' : answer.is_correct ? 'correct' : 'wrong';
      const item = document.createElement('li');
      item.className = `results-question-item ${state}`;
      const number = document.createElement('span');
      number.className = 'results-question-number';
      number.textContent = String(i + 1);
      const status = document.createElement('span');
      status.className = 'results-question-status';
      status.textContent = STATE_LABELS[state];
      item.append(number, status);
      if (answer?.flagged) {
        const flag = document.createElement('span');
        flag.className = 'results-question-flag';
        flag.textContent = 'Marcada';
        item.appendChild(flag);
      }
      return item;
    });
  }

  renderEmpty() {
    this.element = document.createElement('div');
    this.element.className = 'results-screen empty';
    this.element.innerHTML = `
      <div class="results-empty">
        <i data-lucide="clipboard-x" class="w-16 h-16"></i>
        <h3>Nenhum resultado disponível</h3>
        <p>Conclua um simulado para ver seu resultado.</p>
      </div>
    `;
    return this.element;
  }

  bindEvents() {
    this.element.addEventListener('click', (event) => {
      switch (event.target.closest('[data-action]')?.dataset.action) {
        case 'review':
          this.onReview();
          break;
        case 'retry':
          this.onRetry();
          break;
        case 'back':
          this.onBack();
          break;
        default:
      }
    });
  }

  destroy() {
    this.element?.remove();
  }
}

const STATE_LABELS = { correct: 'Correta', wrong: 'Errada', unanswered: 'Sem resposta' };

function stat(key, tone, icon, value, label) {
  return `
    <div class="results-stat ${tone}" data-stat="${key}">
      <i data-lucide="${icon}" class="w-6 h-6"></i>
      <div class="results-stat-info">
        <span class="results-stat-value">${escapeHtml(String(value))}</span>
        <span class="results-stat-label">${label}</span>
      </div>
    </div>
  `;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
