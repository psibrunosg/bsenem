import { afterEach, describe, expect, it } from 'vitest';
import { StatsDashboard } from '../components/StatsDashboard.js';

describe('StatsDashboard', () => {
  afterEach(() => document.body.replaceChildren());

  it('renders only the supplied factual subject and activity data', () => {
    const dashboard = new StatsDashboard({
      stats: {
        subjectPerformance: [{ name: 'Anatomia', minutes: 80, progress: 40 }],
        recentActivity: [{ type: 'video', subject: 'Anatomia', duration: 1800, startedAt: '2026-09-08T12:00:00Z' }]
      }
    });
    const element = dashboard.render();

    expect(element.textContent).toContain('Anatomia');
    expect(element.textContent).not.toContain('Matemática');
    expect(element.querySelectorAll('.subject-stat')).toHaveLength(1);
    expect(element.querySelectorAll('.activity-item')).toHaveLength(1);
  });

  it('updates the visible mounted dashboard instead of detaching it', () => {
    const dashboard = new StatsDashboard({ stats: { totalStudyTime: 0 } });
    document.body.appendChild(dashboard.render());

    dashboard.updateStats({ totalStudyTime: 120 });

    expect(document.body.querySelector('.stat-card-value').textContent).toBe('2h');
  });
});
