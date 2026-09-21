import { describe, expect, it, vi } from 'vitest';

vi.mock('../utils/api.js', () => ({
  api: { get: vi.fn().mockResolvedValue({ success: true, data: {} }) }
}));

import { DashboardPage } from '../pages/DashboardPage.js';

describe('Dashboard profile contract', () => {
  it('shows the persisted best streak instead of repeating the current streak', () => {
    const page = new DashboardPage({
      user: { id: 1, name: 'Bruno', level: 1, xp: 0, xpMax: 1000, streak: 2, bestStreak: 9 }
    });

    page.render();

    expect(page.streak.bestStreak).toBe(9);
  });
});
