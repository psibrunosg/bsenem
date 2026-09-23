import { ExamPlayer } from '@components/ExamPlayer.js';
import { ResultsScreen } from '@components/ResultsScreen.js';
import { SimulatorApiService } from '@services/SimulatorApiService.js';
import { overviewViewModel } from '@services/simulatorViewModel.js';
import { api as defaultApi } from '@utils/api.js';
import { renderIcons } from '@utils/icons.js';

const PRACTICE_QUESTION_COUNT = 10;

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
      this.view = overviewViewModel({ subjects: catalog.subjects, ...overview });
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
    nodes.push(this.catalogAccess());
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

  catalogAccess() {
    const section = document.createElement('section');
    section.className = 'simulators-catalog';
    const title = document.createElement('h2');
    title.textContent = 'Praticar outra matéria';
    section.appendChild(title);
    if (this.view.subjects.length === 0) {
      return section;
    }
    const list = document.createElement('div');
    list.className = 'simulators-catalog-list';
    for (const subject of this.view.subjects) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-secondary';
      button.dataset.action = 'browse-subject';
      button.dataset.subject = subject.key;
      button.textContent = `${subject.label} (${subject.available})`;
      list.appendChild(button);
    }
    section.appendChild(list);
    return section;
  }

  async handleClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled || this.pending) return;

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
      case 'browse-subject':
        await this.createSession({ kind: 'custom', count: PRACTICE_QUESTION_COUNT, subjects: [button.dataset.subject] });
        return;
      case 'resume':
        await this.resumeSession(button.dataset.sessionId);
        return;
      default:
    }
  }

  async createSession(payload) {
    this.pending = true;
    this.actionError = null;
    try {
      const { session } = await this.service.createSession(payload);
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

  retry(session) {
    this.returnHome({ refresh: false });
    const kind = session.kind === 'practice' ? 'practice' : 'custom';
    if (!session.subject) return;
    this.createSession({ kind, count: session.question_limit, subjects: [session.subject] });
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
