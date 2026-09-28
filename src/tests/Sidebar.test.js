import { describe, expect, it } from 'vitest';
import { Sidebar } from '../components/Sidebar.js';

describe('Sidebar', () => {
  it('uses an icon provided by the Lucide CDN for Flashcards', () => {
    const element = new Sidebar({ user: { id: 1, name: 'Teste', xp: 0, xpMax: 100, level: 1, streak: 0 } }).render();

    expect(element.querySelector('[data-route="flashcards"] i')?.getAttribute('data-lucide')).toBe('layers');
  });

  it('uses a finite XP target when the API profile omits the optional camel-case alias', () => {
    const element = new Sidebar({ user: { id: 1, name: 'Teste', xp: 0, level: 1, streak: 0 } }).render();

    expect(element.querySelector('.user-level').textContent).toContain('0/1000 XP');
    expect(element.querySelector('.sidebar-xp').getAttribute('aria-valuenow')).toBe('0');
  });

  it('shows simulator administration only to admins', () => {
    const regular = new Sidebar({ user: { id: 1, name: 'Aluno', role: 'student' } }).render();
    const admin = new Sidebar({ user: { id: 2, name: 'Admin', role: 'admin' } }).render();

    expect(regular.querySelector('[data-route="simulator-admin"]')).toBeNull();
    expect(admin.querySelector('[data-route="simulator-admin"]')?.textContent).toContain('Gerenciar simulados');
  });
});
