import { ExamPlayer } from '@components/ExamPlayer.js';
import { ResultsScreen } from '@components/ResultsScreen.js';
import { toExamPlayerQuestion } from '@services/examSchema.js';
import { LocalExamAttemptService } from '@services/LocalExamAttemptService.js';
import { api as defaultApi } from '@utils/api.js';

export class ExamsPage {
  constructor({ subjects = [], user, library, attemptService = null, apiClient = defaultApi } = {}) {
    this.subjects = subjects;
    this.library = library;
    this.user = user;
    this.attemptService = attemptService;
    this.api = apiClient;
    this.errors = [];
    this.exams = this.collectExams();
    this.element = null;
    this.player = null;
    this.resultsScreen = null;
  }

  collectExams() { return (this.library?.items ?? []).filter((item) => item.resourceType === 'exam'); }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'exams-page';
    this.renderList();
    void this.loadErrors();
    return this.element;
  }

  renderList() {
    this.player?.destroy();
    this.player = null;
    this.resultsScreen?.destroy();
    this.resultsScreen = null;
    this.exams = this.collectExams();
    this.element.replaceChildren(this.header(), this.errorNotebookLink(), this.examList());
  }

  header() {
    const header = document.createElement('div');
    header.className = 'page-header';
    header.innerHTML = '<h1>Simulados</h1><p>Pratique com simulados da sua biblioteca local e revise cada resposta.</p>';
    return header;
  }

  examList() {
    const list = document.createElement('div');
    list.className = this.exams.length ? 'exams-list' : 'exams-list-empty';
    if (!this.exams.length) {
      list.textContent = 'Nenhum simulado válido foi encontrado na biblioteca local.';
      return list;
    }
    for (const item of this.exams) {
      const card = document.createElement('article');
      card.className = 'exam-list-item';
      const title = document.createElement('h2');
      title.className = 'exam-list-item-title';
      title.textContent = item.title;
      const detail = document.createElement('p');
      detail.className = 'exam-list-item-meta';
      detail.textContent = item.collection || 'Biblioteca local';
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'btn btn-primary';
      start.dataset.action = 'start-exam';
      start.dataset.examId = item.id;
      start.textContent = 'Iniciar simulado';
      start.addEventListener('click', () => this.startExam(item.id));
      card.append(title, detail, start);
      list.appendChild(card);
    }
    return list;
  }

  errorNotebookLink() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary';
    button.dataset.action = 'show-errors';
    button.textContent = `Caderno de erros (${this.errors.length})`;
    button.disabled = this.errors.length === 0;
    button.addEventListener('click', () => this.showErrors());
    return button;
  }

  async loadErrors() {
    const service = await this.ensureAttemptService();
    if (!service) return;
    this.errors = await service.listErrors();
    if (this.element && !this.player && !this.resultsScreen) this.renderList();
  }

  async ensureAttemptService() {
    if (this.attemptService) return this.attemptService;
    if (!this.user?.id || !this.library?.idb || typeof this.library.libraryId !== 'function') return null;
    const libraryId = await this.library.libraryId();
    this.attemptService = new LocalExamAttemptService({ idb: this.library.idb, userId: this.user.id, libraryId, apiClient: this.api });
    return this.attemptService;
  }

  startExam(itemId) {
    const source = this.library?.getExam?.(itemId);
    const item = this.exams.find((exam) => exam.id === itemId);
    if (!source || !item) return;
    this.player?.destroy();
    this.player = new ExamPlayer({
      exam: { id: source.id, title: source.title, subject: source.subject || item.collection || 'Biblioteca local' },
      questions: source.questions.map(toExamPlayerQuestion),
      timeLimit: source.durationMinutes,
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
      onRetry: () => this.startExam(this.exams.find((item) => item.title === results.exam.title)?.id),
      onReview: () => this.startReview(results)
    });
    this.element.replaceChildren(this.header(), this.resultsScreen.render());
    void this.recordErrors(results);
  }

  async recordErrors(results) {
    const service = await this.ensureAttemptService();
    if (!service) return;
    const errors = await service.record(results);
    this.errors = [...errors, ...this.errors];
  }

  showErrors() {
    const section = document.createElement('section');
    section.className = 'exams-error-notebook';
    const title = document.createElement('h2');
    title.textContent = 'Caderno de erros';
    section.appendChild(title);
    for (const error of this.errors) {
      const item = document.createElement('article');
      item.className = 'exam-list-item';
      const question = document.createElement('p');
      question.textContent = error.questionText || 'Questão sem enunciado';
      const source = document.createElement('small');
      source.textContent = error.examTitle;
      item.append(question, source);
      section.appendChild(item);
    }
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn btn-secondary';
    back.textContent = 'Voltar aos simulados';
    back.addEventListener('click', () => this.renderList());
    section.appendChild(back);
    this.element.replaceChildren(this.header(), section);
  }

  startReview(results) {
    const sourceItem = this.exams.find((item) => item.title === results.exam.title);
    const source = sourceItem && this.library?.getExam?.(sourceItem.id);
    if (!source) return;
    this.player = new ExamPlayer({ exam: results.exam, questions: source.questions.map(toExamPlayerQuestion) });
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
