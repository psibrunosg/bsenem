// src/pages/DashboardPage.js
import { HeatmapCalendar } from '@components/HeatmapCalendar.js';
import { XPBar } from '@components/XPBar.js';
import { StreakCounter } from '@components/StreakCounter.js';
import { StatsDashboard } from '@components/StatsDashboard.js';

export class DashboardPage {
  constructor(options = {}) {
    this.app = options.app;
    this.user = options.user ?? { level: 1, xp: 0, xpMax: 1000, streak: 0 };
    
    this.heatmap = null;
    this.xpBar = null;
    this.streak = null;
    this.stats = null;
    this.element = null;
    
    this.activityData = this.loadActivityData();
  }

  loadActivityData() {
    try {
      const data = localStorage.getItem('bsenem_activity');
      return data ? JSON.parse(data) : this.generateSampleData();
    } catch {
      return this.generateSampleData();
    }
  }

  generateSampleData() {
    const data = {};
    const today = new Date();
    
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Random activity (more recent = more likely)
      const random = Math.random();
      if (random > 0.4) {
        data[dateStr] = Math.floor(Math.random() * 15) + 1;
      }
    }
    
    return data;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'dashboard-page';
    
    this.element.innerHTML = `
      <div class="page-header">
        <h1>Dashboard</h1>
        <p>Bem-vindo de volta, ${this.app?.user?.name || 'Estudante'}!</p>
      </div>
      
      <div class="dashboard-top-section">
        <div class="dashboard-xp-container"></div>
        <div class="dashboard-streak-container"></div>
      </div>
      
      <div class="dashboard-heatmap-container"></div>
      
      <div class="dashboard-stats-container"></div>
    `;

    this.initComponents();
    return this.element;
  }

  initComponents() {
    // XP Bar
    const xpContainer = this.element.querySelector('.dashboard-xp-container');
    if (xpContainer) {
      this.xpBar = new XPBar({
        currentXP: this.user.xp,
        maxXP: this.user.xpMax,
        level: this.user.level,
        onLevelUp: (level) => this.handleLevelUp(level)
      });
      xpContainer.appendChild(this.xpBar.render());
    }

    // Streak Counter
    const streakContainer = this.element.querySelector('.dashboard-streak-container');
    if (streakContainer) {
      this.streak = new StreakCounter({
        streak: this.user.streak,
        bestStreak: this.user.streak,
        hasStudiedToday: this.hasStudiedToday(),
        onFreeze: () => this.handleFreeze()
      });
      streakContainer.appendChild(this.streak.render());
    }

    // Heatmap Calendar
    const heatmapContainer = this.element.querySelector('.dashboard-heatmap-container');
    if (heatmapContainer) {
      this.heatmap = new HeatmapCalendar({
        data: this.activityData,
        onDayClick: (date, value) => this.handleDayClick(date, value)
      });
      heatmapContainer.appendChild(this.heatmap.render());
    }

    // Stats Dashboard
    const statsContainer = this.element.querySelector('.dashboard-stats-container');
    if (statsContainer) {
      this.stats = new StatsDashboard({
        stats: this.getUserStats()
      });
      statsContainer.appendChild(this.stats.render());
    }
  }

  getUserStats() {
    const totalStudyTime = Object.values(this.activityData).reduce((sum, val) => sum + val * 5, 0);
    const today = new Date().toISOString().split('T')[0];
    const sessionsToday = this.activityData[today] || 0;
    
    return {
      totalStudyTime,
      sessionsToday,
      cardsReviewed: Math.floor(Math.random() * 50) + 10,
      accuracy: Math.floor(Math.random() * 30) + 70,
      streak: this.user.streak,
      level: this.user.level,
      xp: this.user.xp,
      weeklyGoal: 7,
      weeklyCompleted: this.getWeeklyCompleted()
    };
  }

  getWeeklyCompleted() {
    let count = 0;
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      if (this.activityData[dateStr]) {
        count++;
      }
    }
    
    return count;
  }

  hasStudiedToday() {
    const today = new Date().toISOString().split('T')[0];
    return !!this.activityData[today];
  }

  handleLevelUp(level) {
    console.log('Level up!', level);
  }

  handleFreeze() {
    console.log('Freeze used');
  }

  handleDayClick(date, value) {
    console.log('Day clicked:', date, value);
  }

  recordActivity() {
    const today = new Date().toISOString().split('T')[0];
    this.activityData[today] = (this.activityData[today] || 0) + 1;
    
    localStorage.setItem('bsenem_activity', JSON.stringify(this.activityData));
    
    if (this.heatmap) {
      this.heatmap.updateData(this.activityData);
    }
    
    if (this.streak && !this.hasStudiedToday()) {
      this.streak.incrementStreak();
    }
  }

  destroy() {
    this.heatmap?.destroy();
    this.xpBar?.destroy();
    this.streak?.destroy();
    this.stats?.destroy();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
