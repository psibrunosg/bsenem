const TYPE_LABELS = { all: 'Todos', video: 'Vídeos', pdf: 'PDFs', audio: 'Áudios', document: 'Documentos', other: 'Outros' };

export class StudyLibraryPage {
  constructor(options = {}) {
    this.api = options.api;
    this.path = '';
    this.query = '';
    this.type = '';
    this.page = 1;
    this.activeItem = null;
    this.data = { items: [], children: [], types: {}, institution_sections: [] };
    this.pagination = { total: 0, page: 1, total_pages: 1 };
    this.element = null;
  }

  async render() {
    this.element = document.createElement('section');
    this.element.className = 'study-library-page';
    this.element.addEventListener('click', (event) => this.handleClick(event));
    this.element.addEventListener('submit', (event) => this.handleSubmit(event));
    await this.load();
    return this.element;
  }

  async load() {
    this.renderLoading();
    const params = new URLSearchParams({ page: String(this.page), per_page: '48' });
    if (this.path) params.set('path', this.path);
    if (this.query) params.set('q', this.query);
    if (this.type) params.set('type', this.type);
    const response = await this.api.get(`/study-library?${params}`);
    if (!response?.success) throw new Error(response?.message || 'Não foi possível carregar a biblioteca.');
    this.data = response.data;
    this.pagination = response.pagination;
    this.update();
  }

  renderLoading() {
    if (!this.element) return;
    this.element.replaceChildren(message('Carregando sua biblioteca…', 'status'));
  }

  update() {
    this.element.replaceChildren();
    const header = document.createElement('header');
    header.className = 'page-header';
    const title = document.createElement('h1');
    title.textContent = 'Biblioteca de estudos';
    const description = document.createElement('p');
    description.textContent = `${this.pagination.total.toLocaleString('pt-BR')} materiais organizados por instituição e curso.`;
    header.append(title, description);
    this.element.append(header);
    if (this.activeItem) this.element.appendChild(this.player());
    if (!this.path && !this.query && !this.type && this.data.institution_sections?.length) {
      this.element.appendChild(this.institutionGalleries());
    }
    this.element.append(this.controls(), this.breadcrumbs(), this.children(), this.items());
  }

  institutionGalleries() {
    const wrapper = document.createElement('div');
    wrapper.className = 'institution-galleries';
    for (const section of this.data.institution_sections) {
      const gallery = document.createElement('section');
      gallery.className = 'institution-gallery';
      const header = document.createElement('header');
      const title = document.createElement('h2');
      title.textContent = section.label;
      const actions = document.createElement('div');
      actions.className = 'institution-gallery-actions';
      const all = document.createElement('button');
      all.className = 'institution-gallery-all';
      all.dataset.path = section.path;
      all.textContent = 'Ver todos';
      for (const [direction, label] of [['previous', 'Anterior'], ['next', 'Próximo']]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'institution-gallery-scroll';
        button.dataset.galleryScroll = direction;
        button.setAttribute('aria-label', `${label} formação de ${section.label}`);
        button.textContent = direction === 'previous' ? '←' : '→';
        actions.appendChild(button);
      }
      actions.appendChild(all);
      header.append(title, actions);
      const rail = document.createElement('div');
      rail.className = 'institution-gallery-rail';
      section.entries.forEach((entry, index) => rail.appendChild(this.institutionCard(entry, index)));
      gallery.append(header, rail);
      wrapper.appendChild(gallery);
    }
    return wrapper;
  }

  institutionCard(entry, index) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'institution-gallery-card';
    card.dataset.path = entry.path;
    const cover = document.createElement('span');
    cover.className = 'institution-gallery-cover';
    cover.dataset.cover = String(index % 5);
    cover.setAttribute('aria-hidden', 'true');
    const kind = document.createElement('span');
    kind.className = 'institution-gallery-kind';
    kind.textContent = entry.kind;
    const title = document.createElement('strong');
    title.textContent = entry.label;
    card.append(cover, kind, title);
    return card;
  }

  controls() {
    const form = document.createElement('form');
    form.className = 'study-library-controls';
    form.dataset.action = 'search';
    const input = document.createElement('input');
    input.className = 'input';
    input.name = 'q';
    input.type = 'search';
    input.value = this.query;
    input.placeholder = 'Buscar aula, PDF ou tema';
    input.setAttribute('aria-label', 'Buscar na biblioteca');
    const select = document.createElement('select');
    select.className = 'select';
    select.name = 'type';
    for (const [type, label] of Object.entries(TYPE_LABELS)) {
      const option = document.createElement('option');
      option.value = type === 'all' ? '' : type;
      option.selected = option.value === this.type;
      const count = type === 'all' ? this.pagination.total : this.data.types[type] || 0;
      option.textContent = `${label} (${count.toLocaleString('pt-BR')})`;
      select.appendChild(option);
    }
    const submit = document.createElement('button');
    submit.className = 'btn btn-primary';
    submit.type = 'submit';
    submit.textContent = 'Buscar';
    form.append(input, select, submit);
    const wrapper = document.createElement('div');
    const shortcuts = document.createElement('div');
    shortcuts.className = 'study-library-type-shortcuts';
    shortcuts.setAttribute('aria-label', 'Acesso rápido por formato');
    for (const [type, label] of [['', 'Todos os materiais'], ['video', 'Aulas em vídeo'], ['pdf', 'PDFs'], ['document', 'Documentos']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-secondary';
      button.dataset.type = type;
      button.setAttribute('aria-pressed', String(this.type === type));
      button.textContent = label;
      shortcuts.appendChild(button);
    }
    wrapper.append(form, shortcuts);
    return wrapper;
  }

  breadcrumbs() {
    const nav = document.createElement('nav');
    nav.className = 'study-library-breadcrumbs';
    nav.setAttribute('aria-label', 'Caminho da biblioteca');
    const all = document.createElement('button');
    all.className = 'btn btn-ghost';
    all.dataset.path = '';
    all.textContent = 'Biblioteca';
    nav.appendChild(all);
    const segments = this.path ? this.path.split(' / ') : [];
    segments.forEach((segment, index) => {
      const separator = document.createElement('span');
      separator.textContent = '/';
      const button = document.createElement('button');
      button.className = 'btn btn-ghost';
      button.dataset.path = segments.slice(0, index + 1).join(' / ');
      button.textContent = segment;
      nav.append(separator, button);
    });
    return nav;
  }

  children() {
    const section = document.createElement('section');
    section.className = 'study-library-children';
    for (const child of this.data.children) {
      const button = document.createElement('button');
      button.className = 'study-library-folder';
      button.dataset.path = child.path;
      const label = document.createElement('strong');
      label.textContent = child.label;
      const count = document.createElement('span');
      count.textContent = `${child.count.toLocaleString('pt-BR')} materiais`;
      button.append(label, count);
      section.appendChild(button);
    }
    return section;
  }

  items() {
    const section = document.createElement('section');
    section.className = 'study-library-items';
    if (!this.data.items.length) {
      section.appendChild(message('Nenhum material encontrado com estes filtros.'));
      return section;
    }
    const list = document.createElement('div');
    list.className = 'study-library-grid';
    for (const item of this.data.items) list.appendChild(this.item(item));
    section.appendChild(list);
    if (this.pagination.total_pages > 1) section.appendChild(this.paginationControls());
    return section;
  }

  item(item) {
    const url = safeDriveUrl(item.direct_url);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'study-library-item';
    if (url) {
      card.dataset.libraryItem = String(item.id);
    } else {
      card.disabled = true;
    }
    const cover = document.createElement('span');
    cover.className = 'study-library-item-cover';
    cover.dataset.type = item.item_type;
    const type = document.createElement('span');
    type.className = 'study-library-item-type';
    type.textContent = item.item_type === 'video' ? 'Videoaula' : TYPE_LABELS[item.item_type] || 'Material';
    cover.appendChild(type);
    const name = document.createElement('h2');
    name.textContent = item.name;
    const path = document.createElement('p');
    path.textContent = item.catalog_path;
    const action = document.createElement('span');
    action.className = 'study-library-item-action';
    action.textContent = url ? 'Abrir no BS Estudos →' : 'Link indisponível';
    card.append(cover, name, path, action);
    return card;
  }

  player() {
    const item = this.activeItem;
    const player = document.createElement('section');
    player.className = 'study-library-player';
    const header = document.createElement('header');
    const title = document.createElement('h2');
    title.textContent = item.name;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn-secondary';
    close.dataset.action = 'close-player';
    close.textContent = 'Fechar';
    header.append(title, close);
    const preview = previewUrl(item.direct_url);
    if (preview) {
      const frame = document.createElement('iframe');
      frame.src = preview;
      frame.title = item.name;
      frame.allow = 'autoplay; fullscreen';
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      player.append(header, frame);
    } else {
      player.append(header, message('Este formato não permite prévia incorporada. Use o link externo abaixo.'));
    }
    const external = document.createElement('a');
    external.href = item.direct_url;
    external.target = '_blank';
    external.rel = 'noopener noreferrer';
    external.className = 'study-library-player-external';
    external.textContent = 'Abrir no Drive em outra aba';
    player.appendChild(external);
    return player;
  }

  paginationControls() {
    const nav = document.createElement('nav');
    nav.className = 'study-library-pagination';
    const previous = document.createElement('button');
    previous.className = 'btn btn-secondary';
    previous.disabled = this.page <= 1;
    previous.dataset.page = String(this.page - 1);
    previous.textContent = 'Anterior';
    const state = document.createElement('span');
    state.textContent = `Página ${this.page} de ${this.pagination.total_pages}`;
    const next = document.createElement('button');
    next.className = 'btn btn-secondary';
    next.disabled = this.page >= this.pagination.total_pages;
    next.dataset.page = String(this.page + 1);
    next.textContent = 'Próxima';
    nav.append(previous, state, next);
    return nav;
  }

  async handleSubmit(event) {
    if (event.target.dataset.action !== 'search') return;
    event.preventDefault();
    this.query = event.target.elements.q.value.trim();
    this.type = event.target.elements.type.value;
    this.page = 1;
    await this.load();
  }

  async handleClick(event) {
    const playerAction = event.target.closest('[data-action="close-player"]');
    if (playerAction) {
      this.activeItem = null;
      this.update();
      return;
    }
    const itemButton = event.target.closest('[data-library-item]');
    if (itemButton) {
      this.activeItem = this.data.items.find((item) => String(item.id) === itemButton.dataset.libraryItem) || null;
      this.update();
      return;
    }
    const scrollButton = event.target.closest('[data-gallery-scroll]');
    if (scrollButton) {
      const gallery = scrollButton.closest('.institution-gallery');
      const rail = gallery?.querySelector('.institution-gallery-rail');
      const direction = scrollButton.dataset.galleryScroll === 'previous' ? -1 : 1;
      rail?.scrollBy({ left: direction * Math.max(280, rail.clientWidth * 0.8), behavior: 'smooth' });
      return;
    }
    const typeButton = event.target.closest('[data-type]');
    if (typeButton) {
      this.type = typeButton.dataset.type;
      this.page = 1;
      await this.load();
      return;
    }
    const button = event.target.closest('[data-path], [data-page]');
    if (!button || button.disabled) return;
    if (button.dataset.path !== undefined) {
      this.path = button.dataset.path;
      this.page = 1;
    } else {
      this.page = Number(button.dataset.page);
    }
    await this.load();
  }
}

function safeDriveUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

function previewUrl(value) {
  const url = safeDriveUrl(value);
  if (!url) return null;
  const driveFile = url.match(/^https:\/\/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (driveFile) return `https://drive.google.com/file/d/${driveFile[1]}/preview`;
  const driveOpen = new URL(url).searchParams.get('id');
  if (new URL(url).hostname === 'drive.google.com' && driveOpen) return `https://drive.google.com/file/d/${driveOpen}/preview`;
  const googleDoc = url.match(/^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([^/?#]+)/);
  if (googleDoc) return `https://docs.google.com/${googleDoc[1]}/d/${googleDoc[2]}/preview`;
  return null;
}

function message(text, role = '') {
  const element = document.createElement('p');
  element.className = 'study-library-message';
  if (role) element.setAttribute('role', role);
  element.textContent = text;
  return element;
}
