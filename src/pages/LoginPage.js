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
    this.element.innerHTML = `
      <section class="login-shell" aria-label="Acesso ao BS Estudos">
        <aside class="login-brand" aria-label="BS Estudos">
          <div class="login-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none"><path d="M12 8.5h18.5A5.5 5.5 0 0 1 36 14v23.5H17.5A5.5 5.5 0 0 0 12 43V8.5Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M36 37.5H17.5A5.5 5.5 0 0 0 12 43m8-24h9m-9 7h9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
          </div>
          <p class="login-brand-name">BS Estudos</p>
          <p class="login-brand-kicker">Seu espaço de preparação</p>
          <h2>Estudo claro, no seu ritmo.</h2>
          <p class="login-brand-copy">Organize conteúdos, registre o que aprendeu e avance com tranquilidade.</p>
          <ul class="login-brand-points" aria-label="Recursos disponíveis">
            <li>Conteúdos organizados</li>
            <li>Revisões e anotações</li>
            <li>Progresso no seu tempo</li>
          </ul>
        </aside>
        <section class="login-panel" aria-labelledby="login-title">
          <div class="login-card">
            <p class="login-kicker">Acesso privado</p>
            <h1 id="login-title">Bem-vindo de volta</h1>
            <p class="login-intro">Entre com os dados aprovados para continuar seus estudos.</p>
            <form class="login-form" novalidate>
              <label class="login-field"><span>E-mail</span><input class="input" name="email" type="email" autocomplete="email" placeholder="voce@exemplo.com" required></label>
              <label class="login-field"><span>Senha</span><input class="input" name="password" type="password" autocomplete="current-password" placeholder="Sua senha" required></label>
              <p class="login-alert" role="alert" hidden></p>
              <button class="btn btn-primary btn-lg btn-full login-submit" type="submit">Entrar no ambiente</button>
            </form>
            <p class="login-security">Acesso disponível somente para usuários aprovados.</p>
          </div>
        </section>
      </section>`;
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
