import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../pages/LoginPage.js';

describe('LoginPage', () => {
  it('renders only controlled private access login', () => {
    const element = new LoginPage({ api: { post: vi.fn() } }).render();

    expect(element.textContent).toContain('E-mail');
    expect(element.textContent).toContain('Senha');
    expect(element.textContent).toContain('Entrar');
    expect(element.textContent).toContain('usuários aprovados');
    expect(element.textContent).not.toContain('Registre-se');
    expect(element.textContent).not.toContain('Esqueci minha senha');
    expect(element.innerHTML).not.toContain('turnstile');
    expect(document.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();
  });

  it('renders the branded private-access layout', () => {
    const element = new LoginPage({ api: { post: vi.fn() } }).render();

    expect(element.classList.contains('login-page')).toBe(true);
    expect(element.querySelector('.login-brand')).not.toBeNull();
    expect(element.querySelector('.login-panel')).not.toBeNull();
    expect(element.querySelector('.login-form')).not.toBeNull();
    expect(element.querySelector('.login-submit')).not.toBeNull();
  });
});
