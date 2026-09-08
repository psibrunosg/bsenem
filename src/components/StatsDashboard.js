// src/components/StatsDashboard.js
export class StatsDashboard {
  constructor(options = {}) {
    const defaults = {
      totalStudyTime: 0,
      sessionsToday: 0,
      cardsReviewed: 0,
      accuracy: 0,
      streak: 0,
      level: 1,
      xp: 0,
      weeklyGoal: 7,
      weeklyCompleted: 0,
      subjectPerformance: [],
      recentActivity: []
    };
    this.stats = { ...defaults, ...(options.stats ?? {}) };
    
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'stats-dashboard';
    
    this.element.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card primary">
          <div class="stat-card-icon">
            <i data-lucide="clock" class="w-6 h-6"></i>
          </div>
          <div class="stat-card-content">
            <span class="stat-card-value">${this.formatTime(this.stats.totalStudyTime)}</span>
            <span class="stat-card-label">Tempo total de estudo</span>
          </div>
        </div>
        
        <div class="stat-card success">
          <div class="stat-card-icon">
            <i data-lucide="calendar" class="w-6 h-6"></i>
          </div>
          <div class="stat-card-content">
            <span class="stat-card-value">${this.stats.sessionsToday}</span>
            <span class="stat-card-label">Sessões hoje</span>
          </div>
        </div>
        
        <div class="stat-card info">
          <div class="stat-card-icon">
            <i data-lucide="layers" class="w-6 h-6"></i>
          </div>
          <div class="stat-card-content">
            <span class="stat-card-value">${this.stats.cardsReviewed}</span>
            <span class="stat-card-label">Cards revisados</span>
          </div>
        </div>
        
        <div class="stat-card warning">
          <div class="stat-card-icon">
            <i data-lucide="target" class="w-6 h-6"></i>
          </div>
          <div class="stat-card-content">
            <span class="stat-card-value">${this.stats.accuracy}%</span>
            <span class="stat-card-label">Precisão</span>
          </div>
        </div>
      </div>
      
      <div class="stats-sections">
        <div class="stats-section">
          <h3 class="stats-section-title">Meta Semanal</h3>
          <div class="weekly-progress">
            <div class="weekly-dots">
              ${this.renderWeeklyDots()}
            </div>
            <span class="weekly-text">${this.stats.weeklyCompleted} de ${this.stats.weeklyGoal} dias</span>
          </div>
        </div>
        
        <div class="stats-section">
          <h3 class="stats-section-title">Atividade por Matéria</h3>
          <div class="subject-stats">
            ${this.renderSubjectStats()}
          </div>
        </div>
        
        <div class="stats-section">
          <h3 class="stats-section-title">Atividade Recente</h3>
          <div class="recent-activity">
            ${this.renderRecentActivity()}
          </div>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
    return this.element;
  }

  renderWeeklyDots() {
    const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
    const today = new Date().getDay();
    
    return days.map((day, i) => {
      const isCompleted = i < this.stats.weeklyCompleted;
      const isToday = i === today;
      
      return `
        <div class="weekly-dot ${isCompleted ? 'completed' : ''} ${isToday ? 'today' : ''}">
          <span class="weekly-dot-day">${day}</span>
          <div class="weekly-dot-circle"></div>
        </div>
      `;
    }).join('');
  }

  renderSubjectStats() {
    const subjects = Array.isArray(this.stats.subjectPerformance) ? this.stats.subjectPerformance : [];
    if (!subjects.length) return '<p class="stats-empty">Ainda não há sessões vinculadas a uma matéria.</p>';
    return subjects.map((subject, index) => {
      const progress = Math.max(0, Math.min(100, Math.round(Number(subject.progress ?? subject.accuracy ?? 0))));
      const color = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'][index % 5];
      return `
      <div class="subject-stat">
        <div class="subject-stat-info">
          <span class="subject-stat-name">${this.escapeHtml(subject.name)}</span>
          <span class="subject-stat-percent">${progress}%</span>
        </div>
        <div class="subject-stat-bar">
          <div class="subject-stat-fill" style="width: ${progress}%; background: ${color}"></div>
        </div>
      </div>
    `;
    }).join('');
  }

  renderRecentActivity() {
    const activities = Array.isArray(this.stats.recentActivity) ? this.stats.recentActivity : [];
    if (!activities.length) return '<p class="stats-empty">Nenhuma atividade registrada ainda.</p>';
    return activities.map((activity) => `
      <div class="activity-item">
        <div class="activity-icon">
          <i data-lucide="${activity.icon}" class="w-4 h-4"></i>
        </div>
        <div class="activity-content">
          <span class="activity-text">${this.escapeHtml(activityLabel(activity))}</span>
          <span class="activity-time">${this.escapeHtml(activityTime(activity))}</span>
        </div>
      </div>
    `).join('');
  }

  formatTime(minutes) {
    minutes = Number.isFinite(Number(minutes)) ? Math.max(0, Number(minutes)) : 0;
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }

  updateStats(stats) {
    this.stats = { ...this.stats, ...stats };
    const oldElement = this.element;
    const newElement = this.render();
    if (oldElement?.isConnected) oldElement.replaceWith(newElement);
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }

  escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value ?? '');
    return element.innerHTML;
  }
}

function activityLabel(activity) {
  const labels = { video: 'Assistiu aula', audio: 'Ouviu áudio', flashcards: 'Revisou flashcards', notes: 'Editou anotação', exam: 'Concluiu simulado', pomodoro: 'Concluiu Pomodoro' };
  return `${labels[activity.type] ?? 'Registrou estudo'}${activity.subject ? `: ${activity.subject}` : ''}`;
}

function activityTime(activity) {
  const minutes = Math.round(Number(activity.duration ?? 0) / 60);
  return minutes > 0 ? `${minutes} min` : 'Agora';
}
