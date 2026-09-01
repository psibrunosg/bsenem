// src/pages/DashboardPage.js
import { HeatmapCalendar } from '@components/HeatmapCalendar.js';
import { XPBar } from '@components/XPBar.js';
import { StreakCounter } from '@components/StreakCounter.js';
import { StatsDashboard } from '@components/StatsDashboard.js';

import { api } from '@utils/api.js';

export class DashboardPage {
  constructor(options = {}) {
    this.app = options.app;
    this.user = options.user;
    
    this.heatmap = null;
    this.xpBar = null;
    this.streak = null;
    this.stats = null;
    this.element = null;
    
    this.activityData = {};
    this.dashboardData = null;
  }

  async loadActivityData() {
    try {
      const res = await api.get('/progress/heatmap');
      if (res.success) {
        this.activityData = res.data;
        if (this.heatmap) {
          this.heatmap.updateData(this.activityData);
        }
      }
      
      const resDash = await api.get('/progress/dashboard');
      if (resDash.success) {
        this.dashboardData = resDash.data;
        // Optionally update components with real stats
        // this.stats.updateStats(this.getUserStats());
      }
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    }
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'dashboard-page';
    
    this.element.innerHTML = `
      <div class="page-header">
        <h1>Dashboard</h1>
        <p>Bem-vindo de volta, ${this.user.name}!</p>
      </div>
      
      <div class="dashboard-top-section">
        <div class="dashboard-xp-container"></div>
        <div class="dashboard-streak-container"></div>
      </div>
      
      <div class="dashboard-heatmap-container"></div>
      
      <div class="dashboard-stats-container"></div>
    `;

    this.initComponents();
    this.loadActivityData();
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
    const dashboard = this.dashboardData ?? {};
    const flashcards = dashboard.flashcards ?? {};
    const totalStudyTime = Number(dashboard.total_study_minutes ?? 0);
    const today = dashboard.today ?? {};
    const sessionsToday = Number(today.study_minutes ?? 0);
    const totalReviews = Number(flashcards.total_reviews ?? 0);
    
    return {
      totalStudyTime,
      sessionsToday,
      cardsReviewed: totalReviews,
      accuracy: totalReviews ? Math.round(Number(flashcards.correct_reviews ?? 0) / totalReviews * 100) : 0,
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

  destroy() {
    this.heatmap?.destroy();
    this.xpBar?.destroy();
    this.streak?.destroy();
    this.stats?.destroy();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
