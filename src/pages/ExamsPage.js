import { ExamPlayer } from '@components/ExamPlayer.js';
import { ResultsScreen } from '@components/ResultsScreen.js';
import { SimulatorApiService } from '@services/SimulatorApiService.js';
import { overviewViewModel } from '@services/simulatorViewModel.js';
import { api as defaultApi } from '@utils/api.js';
import { renderIcons } from '@utils/icons.js';

const PRACTICE_QUESTION_COUNT = 10;
const CUSTOM_DEFAULT_COUNT = 20;
const CUSTOM_MAX_COUNT = 200;
const CATALOG_GROUPS = [['enem', 'ENEM'], ['concursos', 'Concursos']];

export class ExamsPage {
  constructor({ apiClient = defaultApi, user } = {}) {
    this.user = user;
    this.service = new SimulatorApiService(apiClient);
    this.view = null;
    this.loadError = null;
    this.actionError = null;
    this.pending = false;
    this.mode = 'home';
    this.player = null;
    this.results = null;
    this.sessionOrigins = new Map();
    this.element = null;
  }

  async render() {
    this.element = document.createElement('div');
    this.element.className = 'exams-page';
    this.element.addEventListener('click', (event) => this.handleClick(event));
    await this.load();
    return this.element;
  }

  async load({ isRefresh = false } = {}) {
    if (!isRefresh && this.mode === 'home') this.renderLoading();
    try {
      const [catalog, overview] = await Promise.all([this.service.catalog(), this.service.overview()]);
      this.view = overviewViewModel({ subjects: catalog.subjects, catalogs: catalog.catalogs, ...overview });
      this.loadError = null;
      this.actionError = null;
    } catch (error) {
      this.loadError = error;
      if (!this.view) {
        if (this.mode === 'home') this.renderLoadFailure();
        return;
      }
    }
    this.update();
  }

  renderLoading() {
    if (!this.element) return;
    const status = document.createElement('p');
    status.className = 'simulators-status';
    status.setAttribute('role', 'status');
    status.textContent = 'Carregando seus simulados…';
    this.element.replaceChildren(this.header(), status);
  }

  renderLoadFailure() {
    const message = document.createElement('div');
    message.className = 'simulators-error';
    message.setAttribute('role', 'alert');
    const text = document.createElement('p');
    text.textContent = this.loadError?.message || 'Não foi possível carregar os simulados agora.';
    message.append(text, this.retryButton());
    this.element.replaceChildren(this.header(), message);
  }

  update() {
    if (this.mode !== 'home' || !this.view) return;
    const nodes = [this.header()];
    if (this.loadError) nodes.push(this.retryBanner());
    if (this.actionError) nodes.push(this.actionErrorBanner());
    nodes.push(this.hero(), this.masteryMap());
    if (this.view.resume) nodes.push(this.resumeRow());
    nodes.push(this.catalogList(), this.customBuilder());
    this.element.replaceChildren(...nodes);
  }

  header() {
    const header = document.createElement('div');
    header.className = 'page-header';
    const title = document.createElement('h1');
    title.textContent = 'Simulados';
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Pratique um pouco a cada visita e acompanhe onde melhorar.';
    header.append(title, subtitle);
    return header;
  }

  retryBanner() {
    const banner = document.createElement('div');
    banner.className = 'simulators-retry-banner';
    banner.setAttribute('role', 'alert');
    const text = document.createElement('span');
    text.textContent = 'Não foi possível atualizar agora. Os dados exibidos podem estar desatualizados.';
    banner.append(text, this.retryButton());
    return banner;
  }

  actionErrorBanner() {
    const banner = document.createElement('div');
    banner.className = 'simulators-action-error';
    banner.setAttribute('role', 'alert');
    banner.textContent = this.actionError;
    return banner;
  }

  retryButton() {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-secondary';
    retry.dataset.action = 'retry';
    retry.textContent = 'Tentar novamente';
    return retry;
  }

  hero() {
    const { hero } = this.view;
    const section = document.createElement('section');
    section.className = `simulators-hero simulators-hero-${hero.kind}`;
    const title = document.createElement('h2');
    title.textContent = hero.title;
    const description = document.createElement('p');
    description.textContent = hero.description;
    section.append(title, description);

    if (hero.kind === 'choose-subject') {
      section.appendChild(this.subjectChooser(hero.subjects));
    }

    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'btn btn-primary simulators-hero-cta';
    cta.dataset.action = heroAction(hero.kind);
    cta.textContent = hero.ctaLabel;
    cta.disabled = Boolean(hero.ctaDisabled);
    section.appendChild(cta);
    return section;
  }

  subjectChooser(subjects) {
    const wrapper = document.createElement('div');
    wrapper.className = 'simulators-subject-chooser';
    const label = document.createElement('label');
    label.htmlFor = 'simulators-subject-select';
    label.textContent = 'Matéria';
    const select = document.createElement('select');
    select.id = 'simulators-subject-select';
    select.className = 'select';
    select.dataset.field = 'subject';
    for (const subject of subjects) {
      const option = document.createElement('option');
      option.value = subject.key;
      option.textContent = `${subject.label} (${subject.available})`;
      select.appendChild(option);
    }
    wrapper.append(label, select);
    return wrapper;
  }

  masteryMap() {
    const section = document.createElement('section');
    section.className = 'simulators-mastery';
    const title = document.createElement('h2');
    title.textContent = 'Onde melhorar agora';
    section.appendChild(title);

    if (this.view.mastery.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'simulators-mastery-empty';
      empty.textContent = 'O mapa aparece aqui depois de respostas suficientes em cada matéria.';
      section.appendChild(empty);
      return section;
    }

    const note = document.createElement('p');
    note.className = 'simulators-mastery-note';
    note.textContent = 'Considera até as últimas 30 respostas concluídas nos últimos 90 dias.';
    section.appendChild(note);

    const table = document.createElement('table');
    table.className = 'simulators-mastery-table';
    const head = document.createElement('thead');
    head.innerHTML = '<tr><th scope="col">Matéria</th><th scope="col">Questões avaliadas</th><th scope="col">Aproveitamento</th><th scope="col">Estado</th></tr>';
    const body = document.createElement('tbody');
    for (const row of this.view.mastery) {
      const tr = document.createElement('tr');
      tr.className = `simulators-mastery-row simulators-mastery-row-${row.status}`;
      const subject = document.createElement('td');
      subject.textContent = row.subject;
      const answered = document.createElement('td');
      answered.dataset.label = 'Questões avaliadas';
      answered.textContent = String(row.answeredCount);
      const accuracy = document.createElement('td');
      accuracy.dataset.label = 'Aproveitamento';
      accuracy.textContent = row.accuracyLabel;
      const status = document.createElement('td');
      status.dataset.label = 'Estado';
      status.textContent = row.statusLabel;
      tr.append(subject, answered, accuracy, status);
      body.appendChild(tr);
    }
    table.append(head, body);
    section.appendChild(table);
    return section;
  }

  resumeRow() {
    const { resume, otherActiveCount } = this.view;
    const section = document.createElement('section');
    section.className = 'simulators-resume';
    const title = document.createElement('h2');
    title.textContent = 'Continuar seu simulado';
    const detail = document.createElement('p');
    const scope = resume.topic ? `${resume.subject} · ${resume.topic}` : resume.subject;
    detail.textContent = `${scope} · ${resume.answeredCount} de ${resume.questionLimit} respondidas · ${formatDuration(resume.remainingSeconds)} restantes`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary';
    button.dataset.action = 'resume';
    button.dataset.sessionId = resume.id;
    button.textContent = resume.ctaLabel;
    section.append(title, detail, button);
    if (otherActiveCount > 0) {
      const other = document.createElement('p');
      other.className = 'simulators-resume-other';
      const noun = otherActiveCount > 1 ? 'outras sessões' : 'outra sessão';
      other.textContent = `+${otherActiveCount} ${noun} em andamento.`;
      section.appendChild(other);
    }
    return section;
  }

  catalogList() {
    const section = document.createElement('section');
    section.className = 'exams-catalog';
    const title = document.createElement('h2');
    title.textContent = 'Simulados completos';
    section.appendChild(title);
    if (this.view.catalogs.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'simulators-mastery-empty';
      empty.textContent = 'Ainda não há simulados completos publicados.';
      section.appendChild(empty);
      return section;
    }
    for (const [category, label] of CATALOG_GROUPS) {
      const entries = this.view.catalogs.filter((catalog) => catalog.category === category);
      if (entries.length === 0) continue;
      const group = document.createElement('section');
      group.className = 'exams-catalog-group';
      const heading = document.createElement('h3');
      heading.textContent = label;
      const list = document.createElement('div');
      list.className = 'exams-list';
      list.append(...entries.map((catalog) => this.catalogCard(catalog)));
      group.append(heading, list);
      section.appendChild(group);
    }
    return section;
  }

  catalogCard(catalog) {
    const card = document.createElement('article');
    card.className = 'exam-list-item';
    const info = document.createElement('div');
    info.className = 'exam-list-item-info';
    const title = document.createElement('h4');
    title.className = 'exam-list-item-title';
    title.textContent = catalog.title;
    const meta = document.createElement('p');
    meta.className = 'exam-list-item-meta';
    const duration = catalog.duration_minutes ? ` · ${catalog.duration_minutes} min` : '';
    meta.textContent = `${catalog.question_count} questões${duration}`;
    info.append(title, meta);
    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'btn btn-secondary';
    start.dataset.action = 'start-catalog';
    start.dataset.catalogId = catalog.id;
    start.setAttribute('aria-label', `Iniciar ${catalog.title}`);
    start.textContent = 'Iniciar';
    card.append(info, start);
    return card;
  }

  customBuilder() {
    const section = document.createElement('section');
    section.className = 'simulator-builder';
    const title = document.createElement('h2');
    title.textContent = 'Monte seu simulado';
    const description = document.createElement('p');
    description.textContent = 'Escolha uma ou mais matérias e a quantidade. Só entram questões validadas das matérias escolhidas.';
    section.append(title, description);
    if (this.view.subjects.length === 0) return section;

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'simulator-builder-fields';
    const legend = document.createElement('legend');
    legend.className = 'sr-only';
    legend.textContent = 'Matérias';
    fieldset.appendChild(legend);
    for (const subject of this.view.subjects) {
      const label = document.createElement('label');
      label.className = 'simulator-subject-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = subject.key;
      input.dataset.field = 'custom-subject';
      const text = document.createElement('span');
      text.textContent = `${subject.label} (${subject.available})`;
      label.append(input, text);
      fieldset.appendChild(label);
    }

    const countLabel = document.createElement('label');
    countLabel.className = 'simulator-count-label';
    const countText = document.createElement('span');
    countText.textContent = 'Quantidade de questões';
    const count = document.createElement('input');
    count.type = 'number';
    count.min = '1';
    count.max = String(CUSTOM_MAX_COUNT);
    count.value = String(CUSTOM_DEFAULT_COUNT);
    count.className = 'input simulator-question-count';
    count.dataset.field = 'custom-count';
    countLabel.append(countText, count);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary';
    button.dataset.action = 'build-custom';
    button.textContent = 'Montar simulado';
    section.append(fieldset, countLabel, button);
    return section;
  }

  async handleClick(event) {
    const button = event.target.closest('[data-action]');
    if (this.mode !== 'home' || !button || button.disabled || this.pending) return;

    switch (button.dataset.action) {
      case 'retry':
        await this.load({ isRefresh: Boolean(this.view) });
        return;
      case 'start-practice':
        await this.createSession({ kind: 'practice', count: PRACTICE_QUESTION_COUNT });
        return;
      case 'choose-subject': {
        const select = this.element.querySelector('[data-field="subject"]');
        if (!select?.value) return;
        await this.createSession({ kind: 'practice', count: PRACTICE_QUESTION_COUNT, subjects: [select.value] });
        return;
      }
      case 'start-catalog':
        await this.createSession({ kind: 'catalog', catalog_id: button.dataset.catalogId });
        return;
      case 'build-custom':
        await this.buildCustomSession();
        return;
      case 'resume':
        await this.resumeSession(button.dataset.sessionId);
        return;
      default:
    }
  }

  async buildCustomSession() {
    const subjects = [...this.element.querySelectorAll('[data-field="custom-subject"]:checked')].map((input) => input.value);
    const count = Number(this.element.querySelector('[data-field="custom-count"]')?.value);
    if (subjects.length === 0) {
      this.showActionError('Escolha ao menos uma matéria.');
      return;
    }
    if (!Number.isInteger(count) || count < 1 || count > CUSTOM_MAX_COUNT) {
      this.showActionError(`Escolha entre 1 e ${CUSTOM_MAX_COUNT} questões.`);
      return;
    }
    await this.createSession({ kind: 'custom', subjects, count });
  }

  showActionError(message) {
    this.actionError = message;
    this.update();
  }

  async createSession(payload) {
    this.pending = true;
    this.actionError = null;
    try {
      const { session } = await this.service.createSession(payload);
      this.sessionOrigins.set(session.id, payload);
      this.openPlayer(session);
    } catch (error) {
      this.actionError = error.message;
      this.update();
    } finally {
      this.pending = false;
    }
  }

  async resumeSession(sessionId) {
    this.pending = true;
    this.actionError = null;
    try {
      const { session } = await this.service.session(sessionId);
      this.openPlayer(session);
    } catch (error) {
      this.actionError = error.message;
      this.update();
    } finally {
      this.pending = false;
    }
  }

  openPlayer(session) {
    this.showFlow('player', new ExamPlayer({
      session,
      onProgressSaved: (progress, requestOptions) => this.service.saveProgress(session.id, progress, requestOptions),
      onComplete: () => this.completeSession(session.id),
      onExit: () => this.returnHome(),
    }));
  }

  async completeSession(sessionId) {
    const { session, result } = await this.service.complete(sessionId);
    this.showResult(session, result);
    this.load({ isRefresh: true });
  }

  showResult(session, result) {
    this.showFlow('result', new ResultsScreen({
      session,
      result,
      onReview: () => this.showFlow('review', new ExamPlayer({ session, onExit: () => this.showResult(session, result) })),
      onRetry: () => this.retry(session),
      onBack: () => this.returnHome(),
    }));
  }

  showFlow(mode, component) {
    this.clearFlow();
    this.mode = mode;
    if (component instanceof ExamPlayer) this.player = component;
    else this.results = component;
    this.element.replaceChildren(component.render());
    renderIcons(this.element);
    this.player?.start();
  }

  /** Opens a new session like the finished one; the finished one stays immutable. */
  retry(session) {
    this.returnHome({ refresh: false });
    const origin = this.sessionOrigins.get(session.id);
    if (origin) {
      this.createSession(origin);
    } else if (session.kind !== 'catalog' && session.subject) {
      this.createSession({ kind: session.kind, count: session.question_limit, subjects: [session.subject] });
    }
  }

  returnHome({ refresh = true } = {}) {
    this.clearFlow();
    this.mode = 'home';
    if (!this.view) {
      this.load();
      return;
    }
    this.update();
    if (refresh) this.load({ isRefresh: true });
  }

  clearFlow() {
    this.player?.destroy();
    this.results?.destroy();
    this.player = null;
    this.results = null;
  }

  destroy() {
    this.clearFlow();
    this.element?.remove();
  }
}

function heroAction(kind) {
  if (kind === 'recommended') return 'start-practice';
  if (kind === 'choose-subject') return 'choose-subject';
  return 'browse-catalog';
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
