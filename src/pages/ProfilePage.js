import { api as defaultApi } from '../utils/api.js';
import { normalizeUserProfile } from '../utils/user.js';
import { renderIcons } from '../utils/icons.js';

export class ProfilePage {
  constructor({ user, app, api = defaultApi } = {}) {
    this.user = normalizeUserProfile(user);
    this.app = app;
    this.api = api;
    this.element = null;
  }

  render() {
    this.element = document.createElement('section');
    this.element.className = 'profile-page';
    this.element.innerHTML = `
      <header class="profile-hero">
        <div class="profile-hero-main">
          <div class="profile-avatar" aria-hidden="true"></div>
          <div class="profile-identity">
            <span class="profile-eyebrow">Seu espaço de estudo</span>
            <h1 class="profile-name"></h1>
            <p class="profile-email"></p>
            <div class="profile-level-row">
              <span class="profile-level-badge"></span>
              <span class="profile-member-since"></span>
            </div>
          </div>
        </div>
        <button class="btn btn-ghost profile-settings-link" type="button" data-action="settings">
          <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
          Preferências
        </button>
      </header>

      <section class="profile-progress-card" aria-label="Progresso de nível">
        <div class="profile-progress-copy">
          <div>
            <span class="profile-section-kicker">Evolução</span>
            <h2>Rumo ao próximo nível</h2>
          </div>
          <strong class="profile-xp-label"></strong>
        </div>
        <div class="profile-progress-track" aria-hidden="true">
          <div class="profile-progress-fill"></div>
        </div>
        <p class="profile-progress-hint"></p>
      </section>

      <div class="profile-metric-grid" aria-label="Resumo do perfil">
        <article class="profile-metric-card">
          <span class="profile-metric-icon"><i data-lucide="flame" class="w-5 h-5"></i></span>
          <div><strong>${this.user.streak}</strong><span>Sequência atual</span></div>
        </article>
        <article class="profile-metric-card">
          <span class="profile-metric-icon"><i data-lucide="trophy" class="w-5 h-5"></i></span>
          <div><strong>${this.user.bestStreak}</strong><span>Melhor sequência</span></div>
        </article>
        <article class="profile-metric-card">
          <span class="profile-metric-icon"><i data-lucide="sparkles" class="w-5 h-5"></i></span>
          <div><strong>${this.user.xp}</strong><span>XP acumulado</span></div>
        </article>
      </div>

      <div class="profile-content-grid">
        <section class="profile-panel">
          <div class="profile-panel-heading">
            <div><span class="profile-section-kicker">Conta</span><h2>Dados pessoais</h2></div>
            <p>Essas informações identificam você dentro do BS Estudos.</p>
          </div>
          <form class="account-form profile-form" novalidate>
            <label>Nome<input class="input" name="name" maxlength="80" required></label>
            <label>E-mail<input class="input" name="email" type="email" readonly></label>
            <p class="account-feedback" role="status" aria-live="polite"></p>
            <button class="btn btn-primary" type="submit">Salvar alterações</button>
          </form>
        </section>

        <aside class="profile-panel profile-shortcuts">
          <div class="profile-panel-heading">
            <div><span class="profile-section-kicker">Atalhos</span><h2>Continue estudando</h2></div>
          </div>
          <button type="button" data-action="dashboard">
            <span><i data-lucide="layout-dashboard" class="w-5 h-5"></i></span>
            <div><strong>Voltar à Dashboard</strong><small>Veja seu ritmo e atividade recente</small></div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
          </button>
          <button type="button" data-action="flashcards">
            <span><i data-lucide="layers-3" class="w-5 h-5"></i></span>
            <div><strong>Revisar flashcards</strong><small>Retome uma revisão curta</small></div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
          </button>
          <button type="button" data-action="exams">
            <span><i data-lucide="clipboard-check" class="w-5 h-5"></i></span>
            <div><strong>Abrir simulados</strong><small>Treine com questões e provas</small></div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
          </button>
        </aside>
      </div>`;

    this.refreshProfileUI();
    this.bindEvents();
    renderIcons(this.element);
    return this.element;
  }

  bindEvents() {
    this.element.querySelector('form').addEventListener('submit', (event) => this.submit(event));
    this.element.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => this.app?.navigate(button.dataset.action));
    });
  }

  refreshProfileUI() {
    const initial = (this.user.name || '?').trim().charAt(0).toUpperCase();
    const currentLevelXp = this.user.xp % this.user.xpMax;
    const percent = Math.min(100, Math.max(0, currentLevelXp / this.user.xpMax * 100));
    const remaining = Math.max(0, this.user.xpMax - currentLevelXp);

    this.element.querySelector('.profile-avatar').textContent = initial;
    this.element.querySelector('.profile-name').textContent = this.user.name;
    this.element.querySelector('.profile-email').textContent = this.user.email || '';
    this.element.querySelector('.profile-level-badge').textContent = `Nível ${this.user.level}`;
    this.element.querySelector('.profile-member-since').textContent = formatMemberSince(this.user.created_at);
    this.element.querySelector('.profile-xp-label').textContent = `${currentLevelXp} / ${this.user.xpMax} XP`;
    this.element.querySelector('.profile-progress-fill').style.width = `${percent}%`;
    this.element.querySelector('.profile-progress-hint').textContent = remaining
      ? `Faltam ${remaining} XP para o nível ${this.user.level + 1}.`
      : 'Próximo nível ao alcance.';
    this.element.querySelector('[name="name"]').value = this.user.name;
    this.element.querySelector('[name="email"]').value = this.user.email || '';
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
    this.refreshProfileUI();
    feedback.textContent = 'Perfil atualizado com sucesso.';
    return true;
  }
}

function formatMemberSince(value) {
  if (!value) return 'Conta ativa';
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return 'Conta ativa';
  return `Desde ${date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`;
}
