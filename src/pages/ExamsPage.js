export class ExamsPage {
  constructor({ subjects = [] } = {}) {
    this.subjects = subjects;
    this.exams = [];
    this.results = [];
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'exams-page';
    this.element.innerHTML = '<div class="page-header"><h1>Simulados</h1><p>Pratique com simulados e acompanhe seu desempenho</p></div><div class="exams-list-empty"><p>Nenhum simulado disponível</p></div>';
    return this.element;
  }

  destroy() { this.element?.remove(); }
}
