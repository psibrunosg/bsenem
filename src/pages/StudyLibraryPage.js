const TYPE_LABELS = { all: 'Todos', video: 'Vídeos', pdf: 'PDFs', audio: 'Áudios', document: 'Documentos', other: 'Outros' };
const CONTENT_MODES = {
  all: { title: 'Biblioteca de estudos', eyebrow: 'Conteúdo BS Estudos', type: '', noun: 'materiais', icon: 'library-big' },
  video: { title: 'Biblioteca de aulas', eyebrow: 'Aulas BS Estudos', type: 'video', noun: 'videoaulas', icon: 'play-circle' },
  audio: { title: 'Biblioteca de áudios', eyebrow: 'Áudios BS Estudos', type: 'audio', noun: 'áudios', icon: 'headphones' },
  document: { title: 'Biblioteca de documentos', eyebrow: 'Documentos BS Estudos', type: 'document', noun: 'documentos', icon: 'files' }
};

export class StudyLibraryPage {
  constructor(options = {}) {
    this.api = options.api;
    this.app = options.app;
    this.user = options.user;
    this.contentMode = options.contentMode || 'all';
    this.path = '';
    this.query = '';
    this.type = this.mode().type;
    this.page = 1;
    this.activeItem = null;
    this.data = { items: [], children: [], types: {}, institution_sections: [] };
    this.pagination = { total: 0, page: 1, total_pages: 1 };
    this.element = null;
  }

  mode() {
    return CONTENT_MODES[this.contentMode] || CONTENT_MODES.all;
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
    const loading = document.createElement('div');
    loading.className = 'study-library-loading';
    loading.innerHTML = '<span class="study-library-loading-mark" aria-hidden="true"></span><strong>Organizando sua biblioteca…</strong><small>Isso leva só alguns instantes.</small>';
    this.element.replaceChildren(loading);
  }

  update() {
    this.element.replaceChildren();
    this.element.appendChild(this.hero());
    this.element.appendChild(this.controls());

    const recent = this.recentItem();
    if (!this.path && !this.query && recent) this.element.appendChild(this.resumeSection(recent));
    if (this.activeItem) this.element.appendChild(this.player());

    if (!this.path && !this.query && this.data.institution_sections?.length) {
      this.element.appendChild(this.institutionGalleries());
    }

    if (this.path) this.element.appendChild(this.breadcrumbs());
    this.element.appendChild(this.children());
    this.element.appendChild(this.items());
    this.refreshIcons();
  }

  hero() {
    const mode = this.mode();
    const root = !this.path && !this.query;
    const hero = document.createElement('section');
    hero.className = `study-library-hero${root ? '' : ' is-compact'}`;

    const copy = document.createElement('div');
    copy.className = 'study-library-hero-copy';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'study-library-eyebrow';
    eyebrow.textContent = mode.eyebrow;
    const title = document.createElement('h1');
    title.textContent = this.path ? this.path.split(' / ').at(-1) : mode.title;
    const description = document.createElement('p');
    if (this.query) {
      description.textContent = `${this.pagination.total.toLocaleString('pt-BR')} resultados para “${this.query}”.`;
    } else if (this.path) {
      description.textContent = `${this.pagination.total.toLocaleString('pt-BR')} ${mode.noun} nesta coleção.`;
    } else {
      description.textContent = `Encontre suas formações, escolha uma trilha e continue estudando sem perder tempo procurando conteúdo.`;
    }
    copy.append(eyebrow, title, description);

    const summary = document.createElement('div');
    summary.className = 'study-library-hero-summary';
    summary.append(
      this.heroMetric(mode.icon, this.pagination.total.toLocaleString('pt-BR'), mode.noun),
      this.heroMetric('layout-grid', String(this.programCount()), 'coleções'),
      this.heroMetric('folder-tree', String(this.data.children?.length || 0), 'pastas')
    );

    const art = document.createElement('div');
    art.className = 'study-library-hero-art';
    art.setAttribute('aria-hidden', 'true');
    art.append(icon('book-open-check'), icon('sparkles'));
    summary.appendChild(art);
    hero.append(copy, summary);
    return hero;
  }

  heroMetric(iconName, value, label) {
    const metric = document.createElement('div');
    metric.className = 'study-library-hero-metric';
    const iconWrap = document.createElement('span');
    iconWrap.appendChild(icon(iconName));
    const text = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = value;
    const small = document.createElement('small');
    small.textContent = label;
    text.append(strong, small);
    metric.append(iconWrap, text);
    return metric;
  }

  programCount() {
    const sections = this.data.institution_sections || [];
    return sections.reduce((total, section) => total + (section.entries?.length || 0), 0);
  }

  controls() {
    const shell = document.createElement('section');
    shell.className = 'study-library-toolbar';
    const form = document.createElement('form');
    form.className = 'study-library-controls';
    form.dataset.action = 'search';

    const search = document.createElement('label');
    search.className = 'study-library-search';
    search.appendChild(icon('search'));
    const input = document.createElement('input');
    input.name = 'q';
    input.type = 'search';
    input.value = this.query;
    input.placeholder = this.contentMode === 'video' ? 'Buscar aula ou tema' : 'Buscar na biblioteca';
    input.setAttribute('aria-label', 'Buscar na biblioteca');
    search.appendChild(input);

    const submit = document.createElement('button');
    submit.className = 'btn btn-primary';
    submit.type = 'submit';
    submit.append(icon('search'), document.createTextNode('Buscar'));
    form.append(search, submit);

    const context = document.createElement('div');
    context.className = 'study-library-toolbar-context';
    const pill = document.createElement('span');
    pill.className = 'study-library-mode-pill';
    pill.append(icon(this.mode().icon), document.createTextNode(this.mode().noun));
    context.appendChild(pill);
    if (this.query) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'btn btn-ghost';
      clear.dataset.action = 'clear-search';
      clear.append(icon('x'), document.createTextNode('Limpar busca'));
      context.appendChild(clear);
    }
    shell.append(form, context);
    return shell;
  }

  resumeSection(item) {
    const section = document.createElement('section');
    section.className = 'study-library-resume';
    const heading = this.sectionHeading('Retomar', 'Continue de onde parou');
    section.appendChild(heading);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'study-library-resume-card';
    card.dataset.recentItem = 'true';
    card.dataset.visual = visualTheme(`${item.name} ${item.catalog_path || ''}`);

    const visual = document.createElement('span');
    visual.className = 'study-library-resume-visual';
    const play = document.createElement('span');
    play.className = 'study-library-resume-play';
    play.appendChild(icon('play'));
    visual.appendChild(play);

    const body = document.createElement('span');
    body.className = 'study-library-resume-body';
    const kicker = document.createElement('small');
    kicker.textContent = 'Última aula acessada';
    const title = document.createElement('strong');
    title.textContent = item.name;
    const path = document.createElement('span');
    path.textContent = item.catalog_path || 'Sua biblioteca';
    body.append(kicker, title, path);

    const action = document.createElement('span');
    action.className = 'study-library-resume-action';
    action.append(document.createTextNode('Continuar'), icon('arrow-right'));
    card.append(visual, body, action);
    section.appendChild(card);
    return section;
  }

  institutionGalleries() {
    const wrapper = document.createElement('div');
    wrapper.className = 'institution-galleries';
    for (const section of this.data.institution_sections) {
      const gallery = document.createElement('section');
      gallery.className = 'institution-gallery';

      const header = document.createElement('header');
      const headingCopy = document.createElement('div');
      const kicker = document.createElement('span');
      kicker.className = 'study-library-section-kicker';
      kicker.textContent = 'Formação';
      const title = document.createElement('h2');
      title.textContent = section.label;
      const subtitle = document.createElement('p');
      const count = section.entries?.reduce((sum, entry) => sum + Number(entry.count || 0), 0) || 0;
      subtitle.textContent = `${section.entries?.length || 0} coleções · ${count.toLocaleString('pt-BR')} ${this.mode().noun}`;
      headingCopy.append(kicker, title, subtitle);

      const actions = document.createElement('div');
      actions.className = 'institution-gallery-actions';
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'institution-gallery-all';
      all.dataset.path = section.path;
      all.append(document.createTextNode('Ver tudo'), icon('arrow-right'));
      actions.appendChild(all);
      for (const [direction, label, iconName] of [['previous', 'Anterior', 'chevron-left'], ['next', 'Próximo', 'chevron-right']]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'institution-gallery-scroll';
        button.dataset.galleryScroll = direction;
        button.setAttribute('aria-label', `${label} formação de ${section.label}`);
        button.appendChild(icon(iconName));
        actions.appendChild(button);
      }
      header.append(headingCopy, actions);

      const rail = document.createElement('div');
      rail.className = 'institution-gallery-rail';
      section.entries.forEach((entry) => rail.appendChild(this.institutionCard(entry)));
      gallery.append(header, rail);
      wrapper.appendChild(gallery);
    }
    return wrapper;
  }

  institutionCard(entry) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'institution-gallery-card';
    card.dataset.path = entry.path;
    card.dataset.visual = visualTheme(`${entry.label} ${entry.path}`);

    const cover = document.createElement('span');
    cover.className = 'institution-gallery-cover';
    const art = document.createElement('span');
    art.className = 'institution-gallery-art';
    art.appendChild(icon(iconForTheme(card.dataset.visual)));
    const mark = document.createElement('span');
    mark.className = 'institution-gallery-mark';
    mark.textContent = initials(entry.label);
    cover.append(art, mark);

    const body = document.createElement('span');
    body.className = 'institution-gallery-body';
    const kind = document.createElement('span');
    kind.className = 'institution-gallery-kind';
    kind.textContent = entry.kind;
    const title = document.createElement('strong');
    title.textContent = entry.label;
    const meta = document.createElement('span');
    meta.className = 'institution-gallery-meta';
    meta.append(icon(this.mode().icon), document.createTextNode(`${Number(entry.count || 0).toLocaleString('pt-BR')} ${this.mode().noun}`));
    const action = document.createElement('span');
    action.className = 'institution-gallery-card-action';
    action.appendChild(icon('arrow-up-right'));
    body.append(kind, title, meta);
    card.append(cover, body, action);
    return card;
  }

  sectionHeading(kickerText, titleText) {
    const header = document.createElement('header');
    header.className = 'study-library-section-heading';
    const copy = document.createElement('div');
    const kicker = document.createElement('span');
    kicker.className = 'study-library-section-kicker';
    kicker.textContent = kickerText;
    const title = document.createElement('h2');
    title.textContent = titleText;
    copy.append(kicker, title);
    header.appendChild(copy);
    return header;
  }

  breadcrumbs() {
    const nav = document.createElement('nav');
    nav.className = 'study-library-breadcrumbs';
    nav.setAttribute('aria-label', 'Caminho da biblioteca');
    const all = document.createElement('button');
    all.className = 'study-library-breadcrumb';
    all.dataset.path = '';
    all.append(icon('home'), document.createTextNode('Biblioteca'));
    nav.appendChild(all);
    const segments = this.path ? this.path.split(' / ') : [];
    segments.forEach((segment, index) => {
      const separator = icon('chevron-right');
      separator.classList.add('study-library-breadcrumb-separator');
      const button = document.createElement('button');
      button.className = 'study-library-breadcrumb';
      button.dataset.path = segments.slice(0, index + 1).join(' / ');
      button.textContent = segment;
      nav.append(separator, button);
    });
    return nav;
  }

  children() {
    const section = document.createElement('section');
    section.className = 'study-library-children-section';
    let children = this.data.children || [];
    if (!this.path && this.data.institution_sections?.length) {
      children = children.filter((child) => child.label.toLocaleLowerCase('pt-BR') !== 'instituições');
    }
    if (!children.length) {
      section.hidden = true;
      return section;
    }

    section.appendChild(this.sectionHeading(this.path ? 'Navegar' : 'Biblioteca', this.path ? 'Coleções desta área' : 'Outras coleções'));
    const grid = document.createElement('div');
    grid.className = 'study-library-children';
    for (const child of children) {
      const button = document.createElement('button');
      button.className = 'study-library-folder';
      button.dataset.path = child.path;
      button.dataset.visual = visualTheme(`${child.label} ${child.path}`);

      const visual = document.createElement('span');
      visual.className = 'study-library-folder-visual';
      visual.appendChild(icon(iconForTheme(button.dataset.visual)));
      const body = document.createElement('span');
      body.className = 'study-library-folder-body';
      const label = document.createElement('strong');
      label.textContent = child.label;
      const count = document.createElement('span');
      count.textContent = `${Number(child.count || 0).toLocaleString('pt-BR')} ${this.mode().noun}`;
      body.append(label, count);
      const arrow = document.createElement('span');
      arrow.className = 'study-library-folder-arrow';
      arrow.appendChild(icon('arrow-right'));
      button.append(visual, body, arrow);
      grid.appendChild(button);
    }
    section.appendChild(grid);
    return section;
  }

  items() {
    const section = document.createElement('section');
    section.className = 'study-library-items';
    if (!this.data.items.length) {
      if (this.data.children?.length) {
        section.hidden = true;
        return section;
      }
      section.appendChild(message(`Nenhum ${this.contentMode === 'document' ? 'documento' : 'material'} encontrado neste caminho.`));
      return section;
    }

    section.appendChild(this.sectionHeading(this.contentMode === 'video' ? 'Aulas' : 'Conteúdo', this.contentMode === 'video' ? 'Aulas desta coleção' : 'Materiais desta coleção'));
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
    card.dataset.visual = visualTheme(`${item.name} ${item.catalog_path || ''}`);
    if (url) card.dataset.libraryItem = String(item.id);
    else card.disabled = true;

    const cover = document.createElement('span');
    cover.className = 'study-library-item-cover';
    cover.dataset.type = item.item_type;
    const art = document.createElement('span');
    art.className = 'study-library-item-art';
    art.appendChild(icon(item.item_type === 'video' ? 'play' : iconForType(item.item_type)));
    const type = document.createElement('span');
    type.className = 'study-library-item-type';
    type.textContent = item.item_type === 'video' ? 'Videoaula' : TYPE_LABELS[item.item_type] || 'Material';
    cover.append(art, type);

    const body = document.createElement('span');
    body.className = 'study-library-item-body';
    const name = document.createElement('strong');
    name.className = 'study-library-item-title';
    name.textContent = item.name;
    const path = document.createElement('span');
    path.className = 'study-library-item-path';
    path.textContent = compactPath(item.catalog_path);
    const action = document.createElement('span');
    action.className = 'study-library-item-action';
    action.append(document.createTextNode(url ? (item.item_type === 'video' ? 'Assistir aula' : 'Abrir material') : 'Link indisponível'), icon(url ? 'arrow-right' : 'link-2-off'));
    body.append(name, path, action);
    card.append(cover, body);
    return card;
  }

  player() {
    const item = this.activeItem;
    const player = document.createElement('section');
    player.className = 'study-library-player';
    const header = document.createElement('header');
    const copy = document.createElement('div');
    const kicker = document.createElement('span');
    kicker.className = 'study-library-section-kicker';
    kicker.textContent = item.item_type === 'video' ? 'Reproduzindo agora' : 'Visualizando agora';
    const title = document.createElement('h2');
    title.textContent = item.name;
    copy.append(kicker, title);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn-secondary';
    close.dataset.action = 'close-player';
    close.append(icon('x'), document.createTextNode('Fechar'));
    header.append(copy, close);

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
    external.append(icon('external-link'), document.createTextNode('Abrir no Drive em outra aba'));
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
    previous.append(icon('chevron-left'), document.createTextNode('Anterior'));
    const state = document.createElement('span');
    state.textContent = `Página ${this.page} de ${this.pagination.total_pages}`;
    const next = document.createElement('button');
    next.className = 'btn btn-secondary';
    next.disabled = this.page >= this.pagination.total_pages;
    next.dataset.page = String(this.page + 1);
    next.append(document.createTextNode('Próxima'), icon('chevron-right'));
    nav.append(previous, state, next);
    return nav;
  }

  async handleSubmit(event) {
    if (event.target.dataset.action !== 'search') return;
    event.preventDefault();
    this.query = event.target.elements.q.value.trim();
    this.type = this.mode().type;
    this.path = '';
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
    const clearSearch = event.target.closest('[data-action="clear-search"]');
    if (clearSearch) {
      this.query = '';
      this.path = '';
      this.page = 1;
      await this.load();
      return;
    }
    const recentButton = event.target.closest('[data-recent-item]');
    if (recentButton) {
      const recent = this.recentItem();
      if (recent) {
        this.activeItem = recent;
        this.update();
        this.scrollToPlayer();
      }
      return;
    }
    const itemButton = event.target.closest('[data-library-item]');
    if (itemButton) {
      this.activeItem = this.data.items.find((item) => String(item.id) === itemButton.dataset.libraryItem) || null;
      if (this.activeItem) this.rememberItem(this.activeItem);
      this.update();
      this.scrollToPlayer();
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
    const button = event.target.closest('[data-path], [data-page]');
    if (!button || button.disabled) return;
    if (button.dataset.path !== undefined) {
      this.path = button.dataset.path;
      this.query = '';
      this.page = 1;
    } else {
      this.page = Number(button.dataset.page);
    }
    await this.load();
  }

  rememberItem(item) {
    if (!safeDriveUrl(item?.direct_url)) return;
    try {
      localStorage.setItem(this.recentStorageKey(), JSON.stringify({
        id: item.id,
        name: item.name,
        direct_url: item.direct_url,
        catalog_path: item.catalog_path || '',
        item_type: item.item_type || this.mode().type || 'other'
      }));
    } catch {}
  }

  recentItem() {
    try {
      const raw = localStorage.getItem(this.recentStorageKey());
      const item = raw ? JSON.parse(raw) : null;
      return item && safeDriveUrl(item.direct_url) && item.name ? item : null;
    } catch {
      return null;
    }
  }

  recentStorageKey() {
    return `bsestudos:study-library:recent:${this.contentMode}`;
  }

  scrollToPlayer() {
    requestAnimationFrame(() => {
      const player = this.element.querySelector('.study-library-player');
      if (typeof player?.scrollIntoView === 'function') player.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  refreshIcons() {
    queueMicrotask(() => {
      if (this.element?.isConnected && typeof lucide !== 'undefined') lucide.createIcons();
    });
  }
}

function icon(name) {
  const element = document.createElement('i');
  element.dataset.lucide = name;
  element.setAttribute('aria-hidden', 'true');
  return element;
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
  const parsed = new URL(url);
  const driveOpen = parsed.searchParams.get('id');
  if (parsed.hostname === 'drive.google.com' && driveOpen) return `https://drive.google.com/file/d/${driveOpen}/preview`;
  const googleDoc = url.match(/^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([^/?#]+)/);
  if (googleDoc) return `https://docs.google.com/${googleDoc[1]}/d/${googleDoc[2]}/preview`;
  return null;
}

function visualTheme(value = '') {
  const text = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/(terapia|psic|dbt|tcc|comport|pbe|mindful|aceitacao|transdiagn|cognitiv|esquema)/.test(text)) return 'psychology';
  if (/(nutri|aliment|dieta|metabol|saude|medic)/.test(text)) return 'health';
  if (/(bio|genet|neuro|anatom|fisiolog|celul)/.test(text)) return 'science';
  if (/(matem|fisic|quim|estat|calculo|algebra)/.test(text)) return 'stem';
  if (/(hist|geo|soci|filos|human)/.test(text)) return 'humanities';
  if (/(enem|descomplica|redacao|portugues|linguagem)/.test(text)) return 'exam';
  return 'study';
}

function iconForTheme(theme) {
  return {
    psychology: 'brain-circuit',
    health: 'heart-pulse',
    science: 'dna',
    stem: 'sigma',
    humanities: 'landmark',
    exam: 'graduation-cap',
    study: 'book-open'
  }[theme] || 'book-open';
}

function iconForType(type) {
  return { pdf: 'file-text', document: 'files', audio: 'headphones', other: 'paperclip' }[type] || 'file';
}

function initials(value = '') {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'BS';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function compactPath(value = '') {
  const segments = value.split(' / ').filter(Boolean);
  return segments.slice(-2).join(' · ') || 'Biblioteca BS Estudos';
}
function message(text, role = '') {
  const element = document.createElement('p');
  element.className = 'study-library-message';
  if (role) element.setAttribute('role', role);
  element.textContent = text;
  return element;
}
