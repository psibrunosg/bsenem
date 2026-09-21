import { ExamPlayer } from '@components/ExamPlayer.js';
import { ResultsScreen } from '@components/ResultsScreen.js';
import { toExamPlayerQuestion } from '@services/examSchema.js';
import { api as defaultApi } from '@utils/api.js';

export class ExamsPage {
  constructor({ apiClient = defaultApi } = {}) {
    this.api = apiClient;
    this.catalogs = [];
    this.subjects = [];
    this.selectedSubjects = new Set();
    this.element = null;
    this.player = null;
    this.resultsScreen = null;
    this.activeExam = null;
    this.activeKind = null;
    this.error = null;
  }

  async render() {
    this.element = document.createElement('div');
    this.element.className = 'exams-page';
    await this.loadCatalog();
    this.renderList();
    return this.element;
  }

  async loadCatalog() {
    const response = await this.api.get('/simulators/catalog');
    if (!response?.success) {
      this.error = response?.message || 'Não foi possível carregar os simulados.';
      return;
    }
    this.catalogs = response.data?.catalogs ?? [];
    this.subjects = response.data?.subjects ?? [];
  }

  header() {
    const header = document.createElement('div');
    header.className = 'page-header';
    header.innerHTML = '<h1>Simulados</h1><p>Escolha um simulado pronto ou monte o seu por matéria e quantidade de questões.</p>';
    return header;
  }

  renderList() {
    this.player?.destroy();
    this.player = null;
    this.resultsScreen?.destroy();
    this.resultsScreen = null;
    this.activeExam = null;
    this.activeKind = null;
    const content = document.createElement('div');
    content.className = 'exams-content';
    if (this.error) {
      const message = document.createElement('p');
      message.className = 'exams-list-empty';
      message.textContent = this.error;
      content.appendChild(message);
    } else content.append(this.customBuilder(), this.catalogList());
    this.element.replaceChildren(this.header(), content);
  }

  customBuilder() {
    const section = document.createElement('section');
    section.className = 'simulator-builder';
    section.innerHTML = '<div><h2>Monte seu simulado</h2><p>Selecionamos somente questões validadas nas matérias escolhidas.</p></div>';
    const fields = document.createElement('div');
    fields.className = 'simulator-builder-fields';
    for (const subject of this.subjects) {
      const label = document.createElement('label');
      label.className = 'simulator-subject-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = subject.subject;
      input.checked = this.selectedSubjects.has(subject.subject);
      input.addEventListener('change', () => input.checked
        ? this.selectedSubjects.add(subject.subject)
        : this.selectedSubjects.delete(subject.subject));
      const text = document.createElement('span');
      text.textContent = `${subject.subject} (${subject.question_count})`;
      label.append(input, text);
      fields.appendChild(label);
    }
    const amount = document.createElement('input');
    amount.type = 'number';
    amount.min = '1';
    amount.max = '200';
    amount.value = '20';
    amount.className = 'simulator-question-count';
    amount.setAttribute('aria-label', 'Quantidade de questões');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary';
    button.dataset.action = 'generate-exam';
    button.textContent = 'Gerar simulado';
    button.addEventListener('click', () => this.generate(Number(amount.value), button));
    section.append(fields, amount, button);
    return section;
  }

  catalogList() {
    const wrapper = document.createElement('section');
    wrapper.className = 'exams-catalog';
    wrapper.innerHTML = '<h2>Simulados prontos</h2>';
    if (!this.catalogs.length) {
      const empty = document.createElement('p');
      empty.className = 'exams-list-empty';
      empty.textContent = 'Ainda não há simulados publicados.';
      wrapper.appendChild(empty);
      return wrapper;
    }
    for (const category of ['enem', 'concursos']) {
      const entries = this.catalogs.filter((catalog) => catalog.category === category);
      if (!entries.length) continue;
      const group = document.createElement('section');
      group.className = 'exams-catalog-group';
      const heading = document.createElement('h3');
      heading.textContent = category === 'enem' ? 'ENEM' : 'Concursos';
      const list = document.createElement('div');
      list.className = 'exams-list';
      for (const catalog of entries) list.appendChild(this.catalogCard(catalog));
      group.append(heading, list);
      wrapper.appendChild(group);
    }
    return wrapper;
  }

  catalogCard(catalog) {
    const card = document.createElement('article');
    card.className = 'exam-list-item';
    const info = document.createElement('div');
    info.className = 'exam-list-item-info';
    const title = document.createElement('h3');
    title.className = 'exam-list-item-title';
    title.textContent = catalog.title;
    const detail = document.createElement('p');
    detail.className = 'exam-list-item-meta';
    detail.textContent = `${catalog.question_count} questões · ${catalog.subject}`;
    info.append(title, detail);
    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'btn btn-secondary';
    start.dataset.action = 'start-catalog-exam';
    start.textContent = 'Iniciar';
    start.addEventListener('click', () => this.startCatalog(catalog.id, start));
    card.append(info, start);
    return card;
  }

  async startCatalog(id, button) {
    button.disabled = true;
    const response = await this.api.get(`/simulators/catalog/${encodeURIComponent(id)}`);
    button.disabled = false;
    if (!response?.success || !response.data?.exam) return this.fail(response?.message || 'Não foi possível abrir o simulado.');
    this.startExam(response.data.exam, 'catalog');
  }

  async generate(questionCount, button) {
    if (!this.selectedSubjects.size) return this.fail('Escolha pelo menos uma matéria para gerar o simulado.');
    button.disabled = true;
    const response = await this.api.post('/simulators/generate', { subjects: [...this.selectedSubjects], question_count: questionCount });
    button.disabled = false;
    if (!response?.success || !response.data?.exam) return this.fail(response?.message || 'Não foi possível gerar o simulado.');
    this.startExam(response.data.exam, 'generated');
  }

  fail(message) {
    this.error = message;
    this.renderList();
  }

  startExam(exam, kind) {
    this.player?.destroy();
    this.activeExam = exam;
    this.activeKind = kind;
    this.player = new ExamPlayer({
      exam: { id: exam.id, title: exam.title, subject: exam.subject },
      questions: exam.questions.map(toExamPlayerQuestion),
      timeLimit: exam.durationMinutes,
      onComplete: (results) => this.showResults(results)
    });
    this.element.replaceChildren(this.header(), this.player.render());
    this.player.start();
  }

  showResults(results) {
    this.player?.destroy();
    this.player = null;
    this.resultsScreen = new ResultsScreen({
      results,
      persistAttempt: false,
      onBack: () => this.renderList(),
      onRetry: () => this.startExam(this.activeExam, this.activeKind),
      onReview: () => this.startReview(results)
    });
    this.element.replaceChildren(this.header(), this.resultsScreen.render());
    void this.recordAttempt(results);
  }

  async recordAttempt(results) {
    if (!this.activeExam || !this.activeKind) return;
    const root = this.activeKind === 'catalog' ? 'catalog' : 'generated';
    await this.api.post(`/simulators/${root}/${encodeURIComponent(this.activeExam.id)}/attempt`, {
      score: results.score,
      total_questions: results.totalQuestions,
      time_spent: results.totalTime,
      answers: results.questionResults
    });
  }

  startReview(results) {
    if (!this.activeExam) return;
    this.player = new ExamPlayer({ exam: results.exam, questions: this.activeExam.questions.map(toExamPlayerQuestion) });
    this.player.answers = Object.fromEntries(results.questionResults
      .filter((result) => result.selectedAnswer !== undefined)
      .map((result) => [result.questionId, result.selectedAnswer]));
    this.player.setReviewMode(true);
    this.element.replaceChildren(this.header(), this.player.render());
  }

  destroy() {
    this.player?.destroy();
    this.resultsScreen?.destroy();
    this.element?.remove();
  }
}
