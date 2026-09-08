import { ExamPlayer } from '@components/ExamPlayer.js';
import { ResultsScreen } from '@components/ResultsScreen.js';
import { toExamPlayerQuestion } from '@services/examSchema.js';

export class ExamsPage {
  constructor({ subjects = [], library } = {}) {
    this.subjects = subjects;
    this.library = library;
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
    return this.element;
  }

  renderList() {
    this.player?.destroy();
    this.player = null;
    this.resultsScreen?.destroy();
    this.resultsScreen = null;
    this.exams = this.collectExams();
    this.element.replaceChildren(this.header(), this.examList());
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
