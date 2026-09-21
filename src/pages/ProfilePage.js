import { api as defaultApi } from '../utils/api.js';
import { normalizeUserProfile } from '../utils/user.js';

export class ProfilePage {
  constructor({ user, app, api = defaultApi } = {}) {
    this.user = normalizeUserProfile(user);
    this.app = app;
    this.api = api;
    this.element = null;
  }

  render() {
    this.element = document.createElement('section');
    this.element.className = 'account-page profile-page';
    this.element.innerHTML = `
      <header class="page-header"><h1>Perfil</h1><p>Gerencie os dados visíveis da sua conta.</p></header>
      <div class="account-card">
        <div class="account-summary">
          <div class="account-avatar" aria-hidden="true"></div>
          <div><strong class="account-name"></strong><span class="account-level"></span></div>
        </div>
        <form class="account-form" novalidate>
          <label>Nome<input class="input" name="name" maxlength="80" required></label>
          <label>E-mail<input class="input" name="email" type="email" readonly></label>
          <div class="account-metrics" aria-label="Resumo da conta">
            <span><strong>${this.user.xp}</strong> XP</span>
            <span><strong>${this.user.streak}</strong> dias de sequência</span>
            <span><strong>${this.user.bestStreak}</strong> melhor sequência</span>
          </div>
          <p class="account-feedback" role="status" aria-live="polite"></p>
          <button class="btn btn-primary" type="submit">Salvar perfil</button>
        </form>
      </div>`;

    this.element.querySelector('.account-avatar').textContent = this.user.name.charAt(0).toUpperCase();
    this.element.querySelector('.account-name').textContent = this.user.name;
    this.element.querySelector('.account-level').textContent = `Nível ${this.user.level}`;
    this.element.querySelector('[name="name"]').value = this.user.name;
    this.element.querySelector('[name="email"]').value = this.user.email;
    this.element.querySelector('form').addEventListener('submit', (event) => this.submit(event));
    return this.element;
  }

  async submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const feedback = form.querySelector('[role="status"]');
    const name = form.elements.name.value.trim();
    if (!name) {
      feedback.textContent = 'Informe um nome.';
      return false;
    }

    button.disabled = true;
    const response = await this.api.put('/auth/profile', { name }).catch(() => null);
    button.disabled = false;
    if (!response?.success || !response.data?.user) {
      feedback.textContent = 'Não foi possível atualizar o perfil.';
      return false;
    }

    this.user = normalizeUserProfile(response.data.user);
    this.app?.setUser(this.user);
    this.element.querySelector('.account-avatar').textContent = this.user.name.charAt(0).toUpperCase();
    this.element.querySelector('.account-name').textContent = this.user.name;
    feedback.textContent = 'Perfil atualizado com sucesso.';
    return true;
  }
}
