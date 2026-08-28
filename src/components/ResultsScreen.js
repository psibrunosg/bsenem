// src/components/ResultsScreen.js
import { XPAnimation } from './XPAnimation.js';
import { api } from '../utils/api.js';

export class ResultsScreen {
  constructor(options = {}) {
    this.results = options.results ?? null;
    
    this.onReview = options.onReview ?? (() => {});
    this.onRetry = options.onRetry ?? (() => {});
    this.onBack = options.onBack ?? (() => {});
    
    this.element = null;
    
    if (this.results) {
      this.saveExamAttempt();
    }
  }

  async saveExamAttempt() {
    try {
      await api.post('/exams/attempt', {
        exam_id: this.results.exam?.id,
        score: Math.round(this.results.score),
        answers: this.results.questionResults,
        time_spent: this.results.totalTime || 0
      });
    } catch (e) {
      console.error('Failed to save exam attempt', e);
    }
  }

  render() {
    if (!this.results) {
      return this.renderEmpty();
    }

    this.element = document.createElement('div');
    this.element.className = 'results-screen';

    const { 
      exam, 
      totalQuestions, 
      correct, 
      incorrect, 
      unanswered, 
      score, 
      totalTime 
    } = this.results;

    const scoreClass = score >= 70 ? 'success' : score >= 50 ? 'warning' : 'error';
    const scoreEmoji = score >= 90 ? '🏆' : score >= 70 ? '🎉' : score >= 50 ? '📚' : '💪';

    this.element.innerHTML = `
      <div class="results-header">
        <div class="results-emoji">${scoreEmoji}</div>
        <h2 class="results-title">Resultado do Simulado</h2>
        <p class="results-subtitle">${exam?.title || 'Simulado'}</p>
      </div>
      
      <div class="results-score">
        <div class="results-score-circle ${scoreClass}">
          <span class="results-score-value">${score}</span>
          <span class="results-score-unit">%</span>
        </div>
        <p class="results-score-label">Pontuação</p>
      </div>
      
      <div class="results-stats">
        <div class="results-stat success">
          <i data-lucide="check-circle" class="w-6 h-6"></i>
          <div class="results-stat-info">
            <span class="results-stat-value">${correct}</span>
            <span class="results-stat-label">Corretas</span>
          </div>
        </div>
        
        <div class="results-stat error">
          <i data-lucide="x-circle" class="w-6 h-6"></i>
          <div class="results-stat-info">
            <span class="results-stat-value">${incorrect}</span>
            <span class="results-stat-label">Erradas</span>
          </div>
        </div>
        
        <div class="results-stat secondary">
          <i data-lucide="circle-dashed" class="w-6 h-6"></i>
          <div class="results-stat-info">
            <span class="results-stat-value">${unanswered}</span>
            <span class="results-stat-label">Não respondidas</span>
          </div>
        </div>
        
        <div class="results-stat info">
          <i data-lucide="clock" class="w-6 h-6"></i>
          <div class="results-stat-info">
            <span class="results-stat-value">${this.formatTime(totalTime)}</span>
            <span class="results-stat-label">Tempo total</span>
          </div>
        </div>
      </div>
      
      <div class="results-details">
        <h3>Resumo por Questão</h3>
        <div class="results-question-list">
          ${this.results.questionResults.map((result, i) => `
            <div class="results-question-item ${result.isCorrect ? 'correct' : (result.selectedAnswer !== undefined ? 'wrong' : 'unanswered')}">
              <span class="results-question-number">${i + 1}</span>
              <span class="results-question-status">
                ${result.isCorrect ? '✓' : (result.selectedAnswer !== undefined ? '✗' : '—')}
              </span>
              ${result.flagged ? '<span class="results-question-flag">🚩</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
      
      ${incorrect > 0 ? `
        <div class="results-recommendations" style="margin-top: 24px; padding: 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--color-error); border-radius: var(--radius-lg);">
          <h3 style="color: var(--color-error); margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="alert-triangle" class="w-5 h-5"></i>
            Recomendações de Estudo
          </h3>
          <p style="margin-bottom: 12px; font-size: 0.95em;">Com base nos seus erros, recomendamos revisar os tópicos deste simulado antes de tentar novamente.</p>
          <button class="btn btn-primary btn-sm" data-action="go-to-video" style="width: 100%;">
            <i data-lucide="play-circle" class="w-4 h-4"></i> Assistir Aula de Revisão
          </button>
        </div>
      ` : ''}
      
      <div class="results-actions">
        <button class="btn btn-secondary" data-action="back">
          <i data-lucide="arrow-left" class="w-4 h-4"></i>
          Voltar
        </button>
        <button class="btn btn-secondary" data-action="retry">
          <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          Tentar novamente
        </button>
        <button class="btn btn-primary" data-action="review">
          Revisar respostas
          <i data-lucide="eye" class="w-4 h-4"></i>
        </button>
      </div>
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  renderEmpty() {
    this.element = document.createElement('div');
    this.element.className = 'results-screen empty';
    this.element.innerHTML = `
      <div class="results-empty">
        <i data-lucide="clipboard-x" class="w-16 h-16"></i>
        <h3>Nenhum resultado disponível</h3>
        <p>Complete um simulado para ver seus resultados.</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
    return this.element;
  }

  bindEvents() {
    this.element.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      switch (action) {
        case 'review':
          this.onReview();
          break;
        case 'retry':
          this.onRetry();
          break;
        case 'back':
          this.onBack();
          break;
        case 'go-to-video':
          // Navigate to video route
          window.location.hash = '#video';
          break;
      }
    });
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
