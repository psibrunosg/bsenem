import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../pages/LoginPage.js';

describe('LoginPage', () => {
  it('renders controlled private access with recovery and access-key options', () => {
    const element = new LoginPage({ api: { post: vi.fn() } }).render();

    expect(element.textContent).toContain('E-mail');
    expect(element.textContent).toContain('Senha');
    expect(element.textContent).toContain('Entrar');
    expect(element.textContent).toContain('usuários aprovados');
    expect(element.textContent).toContain('Esqueci minha senha');
    expect(element.textContent).toContain('Entrar com chave de acesso');
    expect(element.textContent).not.toContain('Registre-se');
    expect(element.innerHTML).not.toContain('turnstile');
  });

  it('switches to the access-key login form', () => {
    const element = new LoginPage({ api: { post: vi.fn() } }).render();
    element.querySelector('[data-action="access-key"]').click();

    expect(element.textContent).toContain('Entrar com chave de acesso');
    expect(element.querySelector('[name="access_key"]')).not.toBeNull();
  });

  it('renders the branded private-access layout', () => {
    const element = new LoginPage({ api: { post: vi.fn() } }).render();
    expect(element.classList.contains('login-page')).toBe(true);
    expect(element.querySelector('.login-brand')).not.toBeNull();
    expect(element.querySelector('.login-panel')).not.toBeNull();
    expect(element.querySelector('.login-form')).not.toBeNull();
  });
});
