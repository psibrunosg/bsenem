import { api as defaultApi } from '@utils/api.js';

export class LoginPage {
  constructor({ api = defaultApi, onSuccess = () => {} } = {}) {
    this.api = api;
    this.onSuccess = onSuccess;
    this.element = null;
  }

  render() {
    this.element = document.createElement('main');
    this.element.className = 'login-page';
    this.element.innerHTML = `<section class="card" aria-labelledby="login-title"><h1 id="login-title">BS Estudos</h1><p>Acesso disponível somente para usuários aprovados.</p><form novalidate><label>E-mail <input name="email" type="email" autocomplete="email" required></label><label>Senha <input name="password" type="password" autocomplete="current-password" required></label><p role="alert" hidden></p><button type="submit">Entrar</button></form></section>`;
    this.element.querySelector('form').addEventListener('submit', (event) => this.submit(event));
    return this.element;
  }

  async submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    const error = form.querySelector('[role="alert"]');
    button.disabled = true;
    error.hidden = true;
    try {
      const response = await this.api.post('/auth/login', { email: form.elements.email.value.trim(), password: form.elements.password.value });
      if (!response?.success) throw new Error();
      this.onSuccess(response.data?.user);
    } catch {
      error.textContent = 'Não foi possível entrar. Verifique seus dados.';
      error.hidden = false;
      button.disabled = false;
    }
  }

  destroy() { this.element?.remove(); }
}
