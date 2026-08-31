export class LibraryPage {
  constructor(options = {}) {
    this.app = options.app;
    this.library = options.library;
    this.items = this.library?.items ?? [];
    this.state = !this.library ? 'unavailable' : this.items.length ? 'ready' : 'disconnected';
    this.element = null;
  }

  async render() {
    this.element = document.createElement('section');
    this.element.className = 'library-page';
    this.element.addEventListener('click', (event) => this.handleClick(event));
    this.update();
    return this.element;
  }

  async handleClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'connect') await this.load('connect');
    if (action === 'refresh') await this.load('refresh');
    const id = event.target.closest('[data-resource-id]')?.dataset.resourceId;
    if (id) this.app?.openLocalResource?.(this.items.find((item) => item.id === id));
  }

  async load(method) {
    if (!this.library?.[method]) {
      this.state = 'unavailable';
      this.update();
      return;
    }
    const previousState = this.state;
    this.state = 'scanning';
    this.update();
    try {
      const result = await this.library[method]();
      this.items = result?.items ?? this.library.items ?? [];
      this.state = this.items.length ? 'ready' : 'empty';
    } catch (error) {
      if (error?.name === 'AbortError') this.state = previousState;
      else this.state = error?.code === 'permission-denied' ? 'revoked' : 'unavailable';
    }
    this.update();
  }

  update() {
    this.element.innerHTML = `
      <header class="page-header">
        <h1>Biblioteca local</h1>
        <p>Seus materiais permanecem na pasta escolhida neste dispositivo.</p>
      </header>
      <div class="library-content">${this.content()}</div>
    `;
  }

  content() {
    if (this.state === 'scanning') return '<p class="library-state" role="status">Atualizando biblioteca…</p>';
    if (this.state === 'disconnected') return this.stateCard('Conectar pasta de estudos', 'Escolha uma pasta para listar materiais locais.', 'Conectar pasta');
    if (this.state === 'revoked') return this.stateCard('Permissão revogada', 'Reconecte a pasta para continuar acessando seus materiais.', 'Reconectar');
    if (this.state === 'unavailable') return this.stateCard('Biblioteca indisponível', 'Não foi possível acessar a biblioteca local neste momento.', 'Tentar novamente');
    if (this.state === 'empty') return `${this.controls()}<p class="library-state">Nenhum material compatível foi encontrado nesta pasta.</p>`;
    return `${this.controls()}<div class="library-groups">${this.groups()}</div>`;
  }

  stateCard(title, description, label) {
    return `<div class="library-state library-state-card"><h2>${title}</h2><p>${description}</p><button class="btn btn-primary" data-action="connect">${label}</button></div>`;
  }

  controls() {
    return '<div class="library-controls"><span>Biblioteca conectada</span><button class="btn btn-secondary" data-action="refresh">Atualizar</button></div>';
  }

  groups() {
    const groups = new Map();
    for (const item of this.items) {
      const area = item.area || 'Sem área';
      const collection = item.collection || 'Sem coleção';
      const key = `${area}\u0000${collection}`;
      if (!groups.has(key)) groups.set(key, { area, collection, items: [] });
      groups.get(key).items.push(item);
    }
    return [...groups.values()].map(({ area, collection, items }) => `
      <section class="library-group"><h2>${escape(area)}</h2><h3>${escape(collection)}</h3>
        <div class="library-items">${items.map((item) => `<button class="library-item" data-resource-id="${escape(item.id)}"><span>${escape(item.title)}</span><small>${escape(item.resourceType)}</small></button>`).join('')}</div>
      </section>
    `).join('');
  }
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
