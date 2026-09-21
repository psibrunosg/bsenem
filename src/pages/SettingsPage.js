export class SettingsPage {
  constructor({ app } = {}) {
    this.app = app;
    this.element = null;
  }

  render() {
    this.element = document.createElement('section');
    this.element.className = 'account-page settings-page';
    this.element.innerHTML = `
      <header class="page-header"><h1>Preferências</h1><p>Ajuste a aparência deste navegador.</p></header>
      <div class="account-card account-form">
        <label>Tema
          <select class="select" name="theme">
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
            <option value="system">Usar preferência do sistema</option>
          </select>
        </label>
        <p class="account-hint">A preferência fica somente neste navegador.</p>
        <p class="account-feedback" role="status" aria-live="polite"></p>
      </div>`;
    const select = this.element.querySelector('[name="theme"]');
    const saved = localStorage.getItem('theme');
    select.value = ['light', 'dark', 'system'].includes(saved) ? saved : 'system';
    select.addEventListener('change', () => {
      this.app?.setTheme(select.value);
      this.element.querySelector('[role="status"]').textContent = 'Preferência salva.';
    });
    return this.element;
  }
}
