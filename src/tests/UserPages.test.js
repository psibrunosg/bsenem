import { describe, expect, it, vi } from 'vitest';
import { Header } from '../components/Header.js';
import { ProfilePage } from '../pages/ProfilePage.js';
import { SettingsPage } from '../pages/SettingsPage.js';
import { HelpPage } from '../pages/HelpPage.js';

const user = {
  id: 1,
  name: 'Bruno',
  email: 'bruno@example.test',
  level: 2,
  xp: 120,
  xpMax: 1000,
  streak: 3,
  bestStreak: 8,
};

describe('authenticated user pages', () => {
  it('updates the current profile and refreshes the shell user', async () => {
    const updated = { ...user, name: 'Bruno atualizado' };
    const api = { put: vi.fn().mockResolvedValue({ success: true, data: { user: updated } }) };
    const app = { setUser: vi.fn() };
    const page = new ProfilePage({ user, app, api });
    const element = page.render();
    element.querySelector('[name="name"]').value = updated.name;

    element.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(api.put).toHaveBeenCalledWith('/auth/profile', { name: updated.name }));
    await vi.waitFor(() => expect(app.setUser).toHaveBeenCalledWith(updated));

    expect(element.querySelector('[role="status"]').textContent).toContain('Perfil atualizado');
    expect(element.querySelector('[name="email"]').readOnly).toBe(true);
  });

  it('applies a selected theme through the application shell', () => {
    const app = { setTheme: vi.fn() };
    const element = new SettingsPage({ app }).render();
    const select = element.querySelector('[name="theme"]');
    select.value = 'dark';

    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(app.setTheme).toHaveBeenCalledWith('dark');
    expect(element.querySelector('[role="status"]').textContent).toContain('Preferência salva');
  });

  it('provides useful private-beta and keyboard guidance', () => {
    const element = new HelpPage().render();

    expect(element.textContent).toContain('beta privada');
    expect(element.textContent).toContain('Biblioteca local');
    expect(element.textContent).toContain('Ctrl + K');
  });

  it('routes the header settings control to preferences', () => {
    const onUserMenuAction = vi.fn();
    const element = new Header({ user, onUserMenuAction }).render();

    element.querySelector('[data-action="settings"]').click();

    expect(onUserMenuAction).toHaveBeenCalledWith('preferences');
  });
});
