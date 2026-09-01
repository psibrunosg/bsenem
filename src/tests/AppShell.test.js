import { describe, expect, it } from 'vitest';
import { AppShell } from '../components/AppShell.js';
import { Sidebar } from '../components/Sidebar.js';
const user = { id: 1, name: 'Teste', email: 'teste@example.test', level: 1, xp: 0, xpMax: 1000, streak: 0 };

class DashboardRoute {
  async render() {
    await Promise.resolve();
    const element = document.createElement('section');
    element.textContent = 'Dashboard carregado';
    return element;
  }
}

describe('AppShell', () => {
  it('returns a promise that resolves after the requested initial route is mounted', async () => {
    const app = new AppShell({ user });
    const element = app.render();
    app.registerRoute('dashboard', DashboardRoute);

    const routePromise = app.start('dashboard');

    expect(routePromise).toBeInstanceOf(Promise);
    expect(element.querySelector('.app-content').textContent).not.toContain('Dashboard carregado');
    await routePromise;

    expect(element.querySelector('.app-content').textContent).toContain('Dashboard carregado');
  });
});

describe('Sidebar', () => {
  it('does not expose routes without an implemented page', () => {
    const sidebar = new Sidebar({ user });
    const routes = [...sidebar.render().querySelectorAll('[data-route]')].map((item) => item.dataset.route);

    expect(routes).not.toContain('study');
    expect(routes).not.toContain('review');
    expect(routes).not.toContain('pdf');
    expect(routes).not.toContain('stats');
  });

  it('registers Biblioteca local as an implemented route', () => {
    const routes = [...new Sidebar({ user }).render().querySelectorAll('[data-route]')].map((item) => item.dataset.route);

    expect(routes).toContain('library');
  });
});

describe('local resource bridge', () => {
  it('keeps a selected resource in memory until its matching player consumes it', () => {
    const app = new AppShell({ user });
    app.render();
    const video = { id: 'video-1', resourceType: 'video' };

    app.openLocalResource(video);

    expect(app.currentRoute).toBe('video');
    expect(app.consumeLocalResource('audio')).toBeNull();
    expect(app.consumeLocalResource('video')).toBe(video);
    expect(app.consumeLocalResource('video')).toBeNull();
  });

  it('destroys the active local-media route before mounting another route', async () => {
    const revokeObjectURL = vi.fn();
    const app = new AppShell({ user });
    const oldRoute = { render: vi.fn(() => document.createElement('section')), destroy: vi.fn(() => revokeObjectURL('blob:local')) };
    class MediaRoute { constructor() { return oldRoute; } }
    class NextRoute { render() { return document.createElement('section'); } }
    app.render();
    app.registerRoute('video', MediaRoute);
    app.registerRoute('dashboard', NextRoute);

    await app.renderRoute('video');
    await app.renderRoute('dashboard');

    expect(oldRoute.destroy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local');
  });
});
