// src/components/StatsDashboard.js
export class StatsDashboard {
  constructor(options = {}) {
    this.stats = options.stats ?? {
      totalStudyTime: 0,
      sessionsToday: 0,
      cardsReviewed: 0,
      accuracy: 0,
      streak: 0,
      level: 1,
      xp: 0,
      weeklyGoal: 7,
      weeklyCompleted: 0
    };
    
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
          <h3 class="stats-section-title">Desempenho por Matéria</h3>
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
    const subjects = [
      { name: 'Matemática', progress: 75, color: '#3b82f6' },
      { name: 'Português', progress: 60, color: '#10b981' },
      { name: 'História', progress: 45, color: '#f59e0b' },
      { name: 'Biologia', progress: 80, color: '#ec4899' },
      { name: 'Física', progress: 55, color: '#06b6d4' }
    ];

    return subjects.map(subject => `
      <div class="subject-stat">
        <div class="subject-stat-info">
          <span class="subject-stat-name">${subject.name}</span>
          <span class="subject-stat-percent">${subject.progress}%</span>
        </div>
        <div class="subject-stat-bar">
          <div class="subject-stat-fill" style="width: ${subject.progress}%; background: ${subject.color}"></div>
        </div>
      </div>
    `).join('');
  }

  renderRecentActivity() {
    const activities = [
      { type: 'flashcard', text: 'Revisou 15 cards de Biologia', time: '2h atrás', icon: 'layers' },
      { type: 'exam', text: 'Completou simulado de Matemática', time: '5h atrás', icon: 'clipboard-check' },
      { type: 'note', text: 'Criou anotação sobre Funções', time: 'Ontem', icon: 'file-text' },
      { type: 'video', text: 'Assistiu aula de História', time: 'Ontem', icon: 'play-circle' }
    ];

    return activities.map(activity => `
      <div class="activity-item">
        <div class="activity-icon">
          <i data-lucide="${activity.icon}" class="w-4 h-4"></i>
        </div>
        <div class="activity-content">
          <span class="activity-text">${activity.text}</span>
          <span class="activity-time">${activity.time}</span>
        </div>
      </div>
    `).join('');
  }

  formatTime(minutes) {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }

  updateStats(stats) {
    this.stats = { ...this.stats, ...stats };
    const newElement = this.render();
    this.element.replaceWith(newElement);
    this.element = newElement;
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
