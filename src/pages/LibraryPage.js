import { PDFViewer } from '@components/PDFViewer.js';
import { confirmModal } from '@components/Modal.js';
import { LocalMediaSession } from '@services/localMediaSession.js';
import { CourseTree } from '@components/CourseTree.js';
import { renderLessonCard, renderMaterialCard } from '@components/LessonCard.js';
import { buildCourseCatalog } from '@services/courseCatalog.js';

export class LibraryPage {
  constructor(options = {}) {
    this.app = options.app;
    this.library = options.library;
    this.confirmReset = options.confirmReset ?? (() => confirmModal(
      'A pasta e o catálogo salvos neste navegador serão removidos. Seus arquivos originais não serão apagados.',
      { title: 'Resetar biblioteca?', confirmText: 'Resetar biblioteca', cancelText: 'Cancelar', danger: true }
    ));
    this.items = this.library?.items ?? [];
    this.catalog = this.library?.catalog ?? buildCourseCatalog(this.items);
    this.selectedNodeId = firstModuleId(this.catalog.courses);
    this.typeFilter = 'all';
    this.expandedNodeIds = expandedNodeIds(this.catalog.courses);
    this.state = !this.library ? 'unavailable' : this.items.length ? 'ready' : 'disconnected';
    this.element = null;
    this.pdfViewer = null;
    this.session = null;
  }

  async render() {
    this.element = document.createElement('section');
    this.element.className = 'library-page';
    this.element.addEventListener('click', (event) => this.handleClick(event));
    this.update();
    const item = this.app?.consumeLocalResource?.('pdf');
    if (item) await this.openPdf(item);
    return this.element;
  }

  async openPdf(item) {
    try {
      this.session = await LocalMediaSession.open(item, this.library);
      this.pdfViewer = new PDFViewer({ title: item.title });
      this.element.querySelector('.library-content').appendChild(this.pdfViewer.render());
      this.pdfViewer.setSrc(this.session.src);
    } catch (error) {
      const message = document.createElement('p');
      message.className = 'library-state';
      message.textContent = error.message;
      this.element.querySelector('.library-content').appendChild(message);
    }
  }

  async handleClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'connect') await this.load('connect');
    if (action === 'refresh') await this.load('refresh');
    if (action === 'change-folder') await this.load('connect');
    if (action === 'reset-library') await this.reset();
    const filter = event.target.closest('[data-library-filter]')?.dataset.libraryFilter;
    if (filter) {
      this.typeFilter = filter;
      this.update();
    }
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
      this.catalog = result?.catalog ?? this.library.catalog ?? buildCourseCatalog(this.items);
      this.reconcileSelection();
      this.state = this.items.length ? 'ready' : 'empty';
    } catch (error) {
      if (error?.name === 'AbortError') this.state = previousState;
      else this.state = error?.code === 'permission-denied' ? 'revoked' : 'unavailable';
    }
    this.update();
  }

  async reset() {
    if (!this.library?.reset || !(await this.confirmReset())) return;
    this.pdfViewer?.destroy();
    this.session?.close();
    this.pdfViewer = null;
    this.session = null;
    await this.library.reset();
    this.items = [];
    this.catalog = buildCourseCatalog([]);
    this.selectedNodeId = null;
    this.expandedNodeIds = new Set();
    this.state = 'disconnected';
    this.update();
  }

  update() {
    this.element.replaceChildren();
    const header = document.createElement('header');
    header.className = 'page-header';
    const title = document.createElement('h1');
    title.textContent = 'Biblioteca local';
    const description = document.createElement('p');
    description.textContent = 'Seus materiais permanecem na pasta escolhida neste dispositivo.';
    header.append(title, description);
    const content = document.createElement('div');
    content.className = 'library-content';
    content.appendChild(this.content());
    this.element.append(header, content);
  }

  content() {
    if (this.state === 'scanning') return message('Atualizando biblioteca…', { status: true });
    if (this.state === 'disconnected') return this.stateCard('Conectar pasta de estudos', 'Escolha uma pasta para listar materiais locais.', 'Conectar pasta');
    if (this.state === 'revoked') return this.stateCard('Permissão revogada', 'Reconecte a pasta para continuar acessando seus materiais.', 'Reconectar');
    if (this.state === 'unavailable') return this.stateCard('Biblioteca indisponível', 'Não foi possível acessar a biblioteca local neste momento.', 'Tentar novamente');
    const wrapper = document.createElement('div');
    wrapper.className = 'library-ready';
    wrapper.appendChild(this.controls());
    if (this.state === 'empty') {
      wrapper.appendChild(message('Nenhum material compatível foi encontrado nesta pasta.'));
      return wrapper;
    }
    wrapper.appendChild(this.libraryLayout());
    return wrapper;
  }

  stateCard(title, description, label) {
    const card = document.createElement('div');
    card.className = 'library-state library-state-card';
    const heading = document.createElement('h2');
    heading.textContent = title;
    const copy = document.createElement('p');
    copy.textContent = description;
    const button = document.createElement('button');
    button.className = 'btn btn-primary';
    button.dataset.action = 'connect';
    button.textContent = label;
    card.append(heading, copy, button);
    return card;
  }

  controls() {
    const controls = document.createElement('div');
    controls.className = 'library-controls';
    const status = document.createElement('span');
    status.textContent = 'Biblioteca conectada';
    const actions = document.createElement('div');
    actions.className = 'library-control-actions';
    for (const [action, label, className] of [
      ['change-folder', 'Trocar pasta', 'btn btn-secondary'],
      ['refresh', 'Atualizar', 'btn btn-secondary'],
      ['reset-library', 'Resetar biblioteca', 'btn btn-ghost']
    ]) {
      const button = document.createElement('button');
      button.className = className;
      button.dataset.action = action;
      button.textContent = label;
      actions.appendChild(button);
    }
    controls.append(status, actions);
    return controls;
  }

  libraryLayout() {
    const layout = document.createElement('div');
    layout.className = 'course-library-layout';
    const tree = new CourseTree({
      courses: this.catalog.courses,
      selectedNodeId: this.selectedNodeId,
      expandedNodeIds: this.expandedNodeIds,
      onSelect: (id) => this.selectNode(id),
      onToggle: (id, expanded) => this.toggleNode(id, expanded)
    });
    layout.appendChild(tree.render());
    layout.appendChild(this.selectedModuleContent());
    return layout;
  }

  selectedModuleContent() {
    const content = document.createElement('section');
    content.className = 'course-library-selection';
    const selected = findNode(this.catalog.courses, this.selectedNodeId);
    const heading = document.createElement('h2');
    heading.textContent = selected ? `${selected.course.title} / ${selected.node.title}` : 'Conteúdos';
    const filters = document.createElement('div');
    filters.className = 'library-type-filters';
    filters.setAttribute('aria-label', 'Filtrar materiais');
    for (const [filter, label] of [['all', 'Todos'], ['video', 'Vídeos'], ['audio', 'Áudios'], ['pdf', 'PDFs']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-secondary library-type-filter';
      button.dataset.libraryFilter = filter;
      button.setAttribute('aria-pressed', String(this.typeFilter === filter));
      button.textContent = label;
      filters.appendChild(button);
    }
    const cards = document.createElement('div');
    cards.className = 'lesson-card-grid';
    const entries = selected ? filteredEntries(selected.node, this.typeFilter) : [];
    for (const lesson of entries.lessons || []) cards.appendChild(renderLessonCard({ lesson, onOpenId: (id) => this.openResource(id) }));
    for (const material of entries.materials || []) cards.appendChild(renderMaterialCard({ item: material, onOpenId: (id) => this.openResource(id) }));
    content.append(heading, filters);
    if (cards.childElementCount) content.appendChild(cards);
    else content.appendChild(message(`Não há ${filterLabel(this.typeFilter)} neste módulo. Escolha outro filtro para ver os demais materiais.`));
    return content;
  }

  selectNode(id) {
    const selected = findNode(this.catalog.courses, id);
    if (!selected) return;
    this.selectedNodeId = selected.node ? id : firstModuleId(selected.course.modules);
    this.update();
  }

  toggleNode(id, expanded) {
    if (expanded) this.expandedNodeIds.add(id);
    else this.expandedNodeIds.delete(id);
  }

  openResource(id) {
    const item = this.items.find((candidate) => candidate.id === id);
    if (item) this.app?.openLocalResource?.(item);
  }

  reconcileSelection() {
    const selected = findNode(this.catalog.courses, this.selectedNodeId);
    if (!selected?.node) this.selectedNodeId = firstModuleId(this.catalog.courses);
    this.expandedNodeIds = expandedNodeIds(this.catalog.courses, this.expandedNodeIds);
  }

  destroy() {
    this.pdfViewer?.destroy();
    this.session?.close();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

function message(text, { status = false } = {}) {
  const element = document.createElement('p');
  element.className = 'library-state';
  if (status) element.setAttribute('role', 'status');
  element.textContent = text;
  return element;
}

function expandedNodeIds(courses, previous = new Set()) {
  const ids = new Set(previous);
  for (const course of courses) {
    ids.add(course.id);
    addModuleIds(course.modules, ids);
  }
  return ids;
}

function addModuleIds(modules, ids) {
  for (const module of modules) {
    ids.add(module.id);
    addModuleIds(module.children || [], ids);
  }
}

function firstModuleId(courses) {
  for (const course of courses || []) {
    const id = firstModuleId(course.modules);
    if (id) return id;
  }
  for (const module of courses || []) {
    if (module.lessons?.length || module.materials?.length) return module.id;
    const id = firstModuleId(module.children);
    if (id) return id;
  }
  return null;
}

function findNode(courses, id) {
  for (const course of courses || []) {
    if (course.id === id) return { course };
    const node = findModule(course.modules, id);
    if (node) return { course, node };
  }
  return null;
}

function findModule(modules, id) {
  for (const module of modules || []) {
    if (module.id === id) return module;
    const found = findModule(module.children, id);
    if (found) return found;
  }
  return null;
}

function filteredEntries(module, type) {
  const lessons = (module.lessons || []).filter((lesson) => type === 'all' || lesson[type]);
  const materials = type === 'all' || type === 'pdf' ? module.materials || [] : [];
  return { lessons, materials };
}

function filterLabel(type) {
  return ({ all: 'materiais', video: 'vídeos', audio: 'áudios', pdf: 'PDFs' })[type] || 'materiais';
}
