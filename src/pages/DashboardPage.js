// src/pages/DashboardPage.js
import { HeatmapCalendar } from '@components/HeatmapCalendar.js';
import { XPBar } from '@components/XPBar.js';
import { StreakCounter } from '@components/StreakCounter.js';
import { StatsDashboard } from '@components/StatsDashboard.js';
import { LocalLearningAnalyticsService } from '@services/LocalLearningAnalyticsService.js';

import { api } from '@utils/api.js';

export class DashboardPage {
  constructor(options = {}) {
    this.app = options.app;
    this.user = options.user;
    this.library = options.library ?? null;
    this.analyticsFactory = options.analyticsFactory ?? ((serviceOptions) => new LocalLearningAnalyticsService(serviceOptions));
    this.localAnalyticsService = null;
    this.localAnalyticsFingerprint = null;
    this.localAnalyticsLibraryId = null;
    this.localAnalyticsBridge = { recordRange: (event) => this.recordLocalRange(event) };
    
    this.heatmap = null;
    this.xpBar = null;
    this.streak = null;
    this.stats = null;
    this.element = null;
    
    this.activityData = {};
    this.dashboardData = null;
    this.localSummary = unavailableLocalSummary();
    this.dataSources = {
      account: { status: 'loading', data: null },
      local: { status: 'loading', data: null }
    };
  }

  async loadActivityData() {
    const [accountResult, localResult] = await Promise.allSettled([
      this.loadAccountData(),
      this.loadLocalData()
    ]);
    this.dataSources.account = accountResult.status === 'fulfilled'
      ? accountResult.value
      : { status: 'error', data: null, error: accountResult.reason };
    this.dataSources.local = localResult.status === 'fulfilled'
      ? localResult.value
      : { status: 'error', data: unavailableLocalSummary('local-error') };

    if (this.dataSources.account.status === 'ready' || this.dataSources.account.status === 'partial') {
      if (this.dataSources.account.sources.heatmap === 'ready') this.activityData = this.dataSources.account.data.heatmap;
      if (this.dataSources.account.sources.dashboard === 'ready') this.dashboardData = this.dataSources.account.data.dashboard;
      this.heatmap?.updateData(this.activityData);
    }
    this.localSummary = this.dataSources.local.data;
    this.stats?.updateStats(this.getUserStats());
    return this.dataSources;
  }

  async loadAccountData() {
    const [heatmapResult, dashboardResult] = await Promise.allSettled([
      api.get('/progress/heatmap'),
      api.get('/progress/dashboard')
    ]);
    const heatmapReady = heatmapResult.status === 'fulfilled' && heatmapResult.value?.success;
    const dashboardReady = dashboardResult.status === 'fulfilled' && dashboardResult.value?.success;
    const readyCount = Number(Boolean(heatmapReady)) + Number(Boolean(dashboardReady));
    return {
      status: readyCount === 2 ? 'ready' : readyCount === 1 ? 'partial' : 'error',
      data: {
        heatmap: heatmapReady ? heatmapResult.value.data ?? {} : {},
        dashboard: dashboardReady ? dashboardResult.value.data ?? {} : {}
      },
      sources: {
        heatmap: heatmapReady ? 'ready' : 'error',
        dashboard: dashboardReady ? 'ready' : 'error'
      }
    };
  }

  async loadLocalData() {
    if (!this.user?.id || !this.library || typeof this.library.libraryId !== 'function') {
      return { status: 'unavailable', data: unavailableLocalSummary() };
    }
    this.library.learningAnalytics = this.localAnalyticsBridge;
    const service = await this.ensureLocalAnalyticsService();
    if (!service) return { status: 'unavailable', data: unavailableLocalSummary() };
    const summary = await service.getSummary();
    const status = summary.status?.code === 'ready' ? 'ready' : 'degraded';
    return { status, data: summary };
  }

  async recordLocalRange(event) {
    const service = await this.ensureLocalAnalyticsService();
    if (!service) return unavailableLocalSummary();
    return service.recordRange(event);
  }

  async ensureLocalAnalyticsService() {
    if (!this.user?.id || !this.library || typeof this.library.libraryId !== 'function') return null;
    if (this.library.idb?.get && !await this.library.idb.get('local-library-handle')) return null;
    const libraryId = await this.library.libraryId();
    if (!libraryId) return null;
    const fingerprint = catalogFingerprint(this.library.catalog);
    if (this.localAnalyticsService
      && this.localAnalyticsFingerprint === fingerprint
      && this.localAnalyticsLibraryId === libraryId) return this.localAnalyticsService;
    this.localAnalyticsService = this.analyticsFactory({
      idb: this.library.idb,
      userId: this.user.id,
      libraryId,
      libraryFingerprint: fingerprint
    });
    this.localAnalyticsFingerprint = fingerprint;
    this.localAnalyticsLibraryId = libraryId;
    return this.localAnalyticsService;
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
    const sessionsToday = Number(today.sessions_count ?? 0);
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
      weeklyCompleted: this.getWeeklyCompleted(),
      subjectPerformance: (dashboard.subject_activity ?? []).map((subject) => ({
        name: subject.name,
        minutes: Number(subject.duration_seconds ?? 0) / 60,
        progress: Number(subject.progress ?? 0)
      })),
      recentActivity: (dashboard.recent_sessions ?? []).map((session) => ({
        type: session.type,
        subject: session.subject_name,
        duration: Number(session.duration ?? 0),
        startedAt: session.started_at
      }))
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

function unavailableLocalSummary(code = 'library-unavailable') {
  const message = code === 'library-unavailable'
    ? 'Dados da biblioteca estarão disponíveis após conectar uma pasta.'
    : 'Os dados locais não puderam ser carregados. Verifique o armazenamento deste navegador.';
  return {
    totalMinutes: 0,
    todayMinutes: 0,
    performance: [],
    recent: [],
    status: { code, persistent: false, message }
  };
}

function catalogFingerprint(catalog) {
  const lessons = [...(catalog?.lessons?.values?.() || [])]
    .map((lesson) => `${lesson.id}:${mediaFingerprint(lesson.video)}:${mediaFingerprint(lesson.audio)}`)
    .sort()
    .join('|');
  let hash = 2166136261;
  for (let index = 0; index < lessons.length; index += 1) {
    hash ^= lessons.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `catalog-v1:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function mediaFingerprint(item) {
  if (!item) return '-';
  return JSON.stringify([
    item.relativePath || '',
    item.resourceType || '',
    item.extension || '',
    finiteMetadata(item.size),
    finiteMetadata(item.modifiedAt)
  ]);
}

function finiteMetadata(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : '';
}
