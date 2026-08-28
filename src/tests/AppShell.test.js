import { describe, expect, it } from 'vitest';
import { AppShell } from '../components/AppShell.js';
import { Sidebar } from '../components/Sidebar.js';

class DashboardRoute {
  render() {
    const element = document.createElement('section');
    element.textContent = 'Dashboard carregado';
    return element;
  }
}

describe('AppShell', () => {
  it('renders the requested initial route after routes are registered', () => {
    const app = new AppShell();
    const element = app.render();
    app.registerRoute('dashboard', DashboardRoute);

    app.start('dashboard');

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
