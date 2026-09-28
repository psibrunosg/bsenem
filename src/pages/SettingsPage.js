import { api as defaultApi } from '@utils/api.js';

export class SettingsPage {
  constructor({ app, api = defaultApi } = {}) {
    this.app = app;
    this.api = api;
    this.element = null;
  }

  render() {
    this.element = document.createElement('section');
    this.element.className = 'account-page settings-page';
    this.element.innerHTML = `
      <header class="page-header"><h1>Preferências</h1><p>Ajuste a aparência e as formas de acesso deste navegador.</p></header>
      <div class="account-card account-form">
        <label>Tema
          <select class="select" name="theme">
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
            <option value="system">Usar preferência do sistema</option>
          </select>
        </label>
        <p class="account-hint">A preferência fica somente neste navegador.</p>
        <p class="account-feedback" data-theme-feedback role="status" aria-live="polite"></p>
      </div>
      <div class="account-card account-form">
        <h2>Chaves de acesso</h2>
        <p class="account-hint">Crie uma chave para entrar sem digitar sua senha. A chave será mostrada apenas uma vez.</p>
        <form data-key-form>
          <label>Nome da chave<input class="input" name="name" maxlength="80" placeholder="Notebook pessoal" required></label>
          <label>Confirme sua senha<input class="input" name="password" type="password" autocomplete="current-password" required></label>
          <label>Validade
            <select class="select" name="expires_in_days">
              <option value="30">30 dias</option><option value="90" selected>90 dias</option><option value="365">1 ano</option>
            </select>
          </label>
          <button class="btn btn-primary" type="submit">Criar chave</button>
        </form>
        <div data-key-result hidden>
          <p><strong>Copie agora:</strong></p>
          <code data-key-secret></code>
          <button class="btn btn-ghost" type="button" data-copy-key>Copiar chave</button>
        </div>
        <p class="account-feedback" data-key-feedback role="status" aria-live="polite"></p>
        <button class="btn btn-ghost" type="button" data-load-keys>Ver chaves ativas</button>
        <div data-key-list></div>
      </div>`;

    const select = this.element.querySelector('[name="theme"]');
    const saved = localStorage.getItem('theme');
    select.value = ['light', 'dark', 'system'].includes(saved) ? saved : 'system';
    select.addEventListener('change', () => {
      this.app?.setTheme(select.value);
      this.element.querySelector('[data-theme-feedback]').textContent = 'Preferência salva.';
    });

    this.element.querySelector('[data-key-form]').addEventListener('submit', (e) => this.createKey(e));
    this.element.querySelector('[data-load-keys]').addEventListener('click', () => this.loadKeys());
    this.element.querySelector('[data-copy-key]').addEventListener('click', () => this.copyKey());
    return this.element;
  }

  async createKey(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = this.element.querySelector('[data-key-feedback]');
    const response = await this.api.post('/auth/access-keys', {
      name: form.elements.name.value.trim(),
      password: form.elements.password.value,
      expires_in_days: Number(form.elements.expires_in_days.value),
    }).catch(() => null);

    if (!response?.success || !response.data?.access_key) {
      feedback.textContent = response?.message || 'Não foi possível criar a chave.';
      return;
    }

    const result = this.element.querySelector('[data-key-result]');
    result.hidden = false;
    result.querySelector('[data-key-secret]').textContent = response.data.access_key;
    feedback.textContent = 'Chave criada. Guarde-a em um gerenciador de senhas.';
    form.reset();
    await this.loadKeys();
  }

  async loadKeys() {
    const list = this.element.querySelector('[data-key-list]');
    const response = await this.api.get('/auth/access-keys').catch(() => null);
    const keys = response?.data?.access_keys || [];
    list.innerHTML = '';
    if (!keys.length) { list.textContent = 'Nenhuma chave ativa.'; return; }
    keys.forEach((key) => {
      const row = document.createElement('div');
      row.className = 'account-key-row';
      row.innerHTML = `<span><strong></strong><small></small></span><button class="btn btn-ghost" type="button">Revogar</button>`;
      row.querySelector('strong').textContent = key.name;
      row.querySelector('small').textContent = key.expires_at ? ` Expira em ${key.expires_at}` : ' Sem expiração';
      row.querySelector('button').addEventListener('click', async () => {
        await this.api.delete(`/auth/access-keys/${key.id}`);
        await this.loadKeys();
      });
      list.append(row);
    });
  }

  async copyKey() {
    const secret = this.element.querySelector('[data-key-secret]').textContent;
    if (!secret) return;
    await navigator.clipboard?.writeText(secret);
    this.element.querySelector('[data-key-feedback]').textContent = 'Chave copiada.';
  }
}
