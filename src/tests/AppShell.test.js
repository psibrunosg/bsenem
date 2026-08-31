import { describe, expect, it } from 'vitest';
import { AppShell } from '../components/AppShell.js';
import { Sidebar } from '../components/Sidebar.js';

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
    const app = new AppShell();
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
    const sidebar = new Sidebar();
    const routes = [...sidebar.render().querySelectorAll('[data-route]')].map((item) => item.dataset.route);

    expect(routes).not.toContain('study');
    expect(routes).not.toContain('review');
    expect(routes).not.toContain('pdf');
    expect(routes).not.toContain('stats');
  });
});
