import { api as defaultApi } from '@utils/api.js';

export class LoginPage {
  constructor({ api = defaultApi, onSuccess = () => {} } = {}) {
    this.api = api;
    this.onSuccess = onSuccess;
    this.element = null;
    this.resetToken = new URLSearchParams(window.location.search).get('reset_token') || '';
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
        </aside>
        <section class="login-panel" aria-labelledby="login-title">
          <div class="login-card" data-view="password"></div>
        </section>
      </section>`;
    this.resetToken ? this.renderReset() : this.renderPassword();
    return this.element;
  }

  card() { return this.element.querySelector('.login-card'); }

  renderPassword() {
    const card = this.card();
    card.innerHTML = `
      <p class="login-kicker">Acesso privado</p><h1 id="login-title">Bem-vindo de volta</h1>
      <p class="login-intro">Entre com os dados aprovados para continuar seus estudos.</p>
      <form class="login-form" data-form="password" novalidate>
        <label class="login-field"><span>E-mail</span><input class="input" name="email" type="email" autocomplete="email" required></label>
        <label class="login-field"><span>Senha</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
        <p class="login-alert" role="alert" hidden></p>
        <button class="btn btn-primary btn-lg btn-full login-submit" type="submit">Entrar no ambiente</button>
      </form>
      <button class="btn btn-ghost btn-full" type="button" data-action="access-key">Entrar com chave de acesso</button>
      <button class="btn btn-ghost btn-full" type="button" data-action="forgot">Esqueci minha senha</button>
      <p class="login-security">Acesso disponível somente para usuários aprovados.</p>`;
    card.querySelector('form').addEventListener('submit', (e) => this.submitPassword(e));
    card.querySelector('[data-action="access-key"]').addEventListener('click', () => this.renderAccessKey());
    card.querySelector('[data-action="forgot"]').addEventListener('click', () => this.renderForgot());
  }

  renderAccessKey() {
    const card = this.card();
    card.innerHTML = `
      <p class="login-kicker">Chave local</p><h1 id="login-title">Entrar com chave de acesso</h1>
      <p class="login-intro">Use uma chave criada anteriormente nas suas preferências.</p>
      <form class="login-form" novalidate>
        <label class="login-field"><span>Chave</span><input class="input" name="access_key" type="password" autocomplete="off" placeholder="bse_..." required></label>
        <p class="login-alert" role="alert" hidden></p>
        <button class="btn btn-primary btn-lg btn-full" type="submit">Entrar com chave</button>
      </form>
      <button class="btn btn-ghost btn-full" type="button" data-action="back">Voltar para senha</button>`;
    card.querySelector('form').addEventListener('submit', (e) => this.submitAccessKey(e));
    card.querySelector('[data-action="back"]').addEventListener('click', () => this.renderPassword());
  }

  renderForgot() {
    const card = this.card();
    card.innerHTML = `
      <p class="login-kicker">Recuperar acesso</p><h1 id="login-title">Redefinir senha</h1>
      <p class="login-intro">Informe seu e-mail. Se ele estiver cadastrado, enviaremos um link temporário.</p>
      <form class="login-form" novalidate>
        <label class="login-field"><span>E-mail</span><input class="input" name="email" type="email" autocomplete="email" required></label>
        <p class="login-alert" role="status" hidden></p>
        <button class="btn btn-primary btn-lg btn-full" type="submit">Enviar link</button>
      </form>
      <button class="btn btn-ghost btn-full" type="button" data-action="back">Voltar</button>`;
    card.querySelector('form').addEventListener('submit', (e) => this.submitForgot(e));
    card.querySelector('[data-action="back"]').addEventListener('click', () => this.renderPassword());
  }

  renderReset() {
    const card = this.card();
    card.innerHTML = `
      <p class="login-kicker">Nova senha</p><h1 id="login-title">Crie uma nova senha</h1>
      <form class="login-form" novalidate>
        <label class="login-field"><span>Nova senha</span><input class="input" name="password" type="password" autocomplete="new-password" minlength="8" required></label>
        <label class="login-field"><span>Confirmar senha</span><input class="input" name="confirm" type="password" autocomplete="new-password" minlength="8" required></label>
        <p class="login-alert" role="alert" hidden></p>
        <button class="btn btn-primary btn-lg btn-full" type="submit">Salvar nova senha</button>
      </form>`;
    card.querySelector('form').addEventListener('submit', (e) => this.submitReset(e));
  }

  async submitPassword(event) {
    event.preventDefault();
    const f = event.currentTarget;
    await this.submit(f, () => this.api.post('/auth/login', { email: f.elements.email.value.trim(), password: f.elements.password.value }), 'Não foi possível entrar. Verifique seus dados.');
  }

  async submitAccessKey(event) {
    event.preventDefault();
    const f = event.currentTarget;
    await this.submit(f, () => this.api.post('/auth/access-key-login', { access_key: f.elements.access_key.value.trim() }), 'Chave inválida, expirada ou revogada.');
  }

  async submitForgot(event) {
    event.preventDefault();
    const f = event.currentTarget;
    const status = f.querySelector('[role="status"]');
    const response = await this.api.post('/auth/forgot-password', { email: f.elements.email.value.trim() }).catch(() => null);
    status.textContent = response?.message || 'Se o e-mail estiver cadastrado, você receberá instruções.';
    status.hidden = false;
  }

  async submitReset(event) {
    event.preventDefault();
    const f = event.currentTarget;
    const alert = f.querySelector('[role="alert"]');
    if (f.elements.password.value !== f.elements.confirm.value) {
      alert.textContent = 'As senhas não coincidem.'; alert.hidden = false; return;
    }
    const response = await this.api.post('/auth/reset-password', { token: this.resetToken, password: f.elements.password.value }).catch(() => null);
    if (!response?.success) { alert.textContent = response?.message || 'Não foi possível redefinir a senha.'; alert.hidden = false; return; }
    history.replaceState({}, '', window.location.pathname);
    this.resetToken = '';
    this.renderPassword();
  }

  async submit(form, request, errorMessage) {
    const button = form.querySelector('button[type="submit"]');
    const error = form.querySelector('[role="alert"]');
    button.disabled = true; error.hidden = true;
    try {
      const response = await request();
      if (!response?.success) throw new Error();
      this.onSuccess(response.data?.user);
    } catch {
      error.textContent = errorMessage; error.hidden = false; button.disabled = false;
    }
  }

  destroy() { this.element?.remove(); }
}
