// src/pages/ExamsPage.js
import { ExamPlayer } from '@components/ExamPlayer.js';
import { ResultsScreen } from '@components/ResultsScreen.js';

export class ExamsPage {
  constructor(options = {}) {
    this.app = options.app;
    this.subjects = options.subjects ?? [];
    this.currentView = 'list'; // 'list' | 'exam' | 'results'
    
    this.examPlayer = null;
    this.resultsScreen = null;
    this.currentExam = null;
    this.element = null;
    
    this.exams = this.loadExams();
    this.results = this.loadResults();
  }

  loadExams() {
    // Sample exams
    return [
      {
        id: 'exam_1',
        title: 'Simulado ENEM - Ciências da Natureza',
        subject: 'Geral',
        timeLimit: 90,
        questions: this.generateSampleQuestions('natureza', 10)
      },
      {
        id: 'exam_2',
        title: 'Matemática - Funções',
        subject: 'Matemática',
        timeLimit: 60,
        questions: this.generateSampleQuestions('matematica', 8)
      },
      {
        id: 'exam_3',
        title: 'Português - Interpretação de Texto',
        subject: 'Língua Portuguesa',
        timeLimit: 45,
        questions: this.generateSampleQuestions('portugues', 6)
      }
    ];
  }

  generateSampleQuestions(topic, count) {
    const questions = {
      natureza: [
        {
          id: 'q1',
          text: 'Qual é a unidade de medida de força no Sistema Internacional?',
          answers: ['Joule', 'Newton', 'Pascal', 'Watt'],
          correctAnswer: 1,
          explanation: 'O Newton (N) é a unidade de medida de força no SI, definida como a força necessária para acelerar 1 kg a 1 m/s².',
          source: 'Física Clássica'
        },
        {
          id: 'q2',
          text: 'Qual organela é responsável pela respiração celular?',
          answers: ['Ribossomo', 'Lisossomo', 'Mitocôndria', 'Complexo de Golgi'],
          correctAnswer: 2,
          explanation: 'A mitocôndria é conhecida como a "usina de energia" da célula, pois é onde ocorre a respiração celular aeróbica.'
        },
        {
          id: 'q3',
          text: 'A água é formada por quais elementos?',
          answers: ['Carbono e Oxigênio', 'Hidrogênio e Oxigênio', 'Nitrogênio e Hidrogênio', 'Oxigênio e Carbono'],
          correctAnswer: 1,
          explanation: 'A água (H₂O) é composta por dois átomos de hidrogênio e um átomo de oxigênio.'
        },
        {
          id: 'q4',
          text: 'Qual é a velocidade da luz no vácuo?',
          answers: ['300.000 km/s', '150.000 km/s', '450.000 km/s', '600.000 km/s'],
          correctAnswer: 0,
          explanation: 'A velocidade da luz no vácuo é aproximadamente 300.000 km/s (299.792 km/s).'
        },
        {
          id: 'q5',
          text: 'Qual gas é essencial para a fotossíntese?',
          answers: ['Oxigênio', 'Nitrogênio', 'Gás Carbônico', 'Hidrogênio'],
          correctAnswer: 2,
          explanation: 'O gás carbônico (CO₂) é absorvido pelas plantas durante a fotossíntese para produzir glicose.'
        }
      ],
      matematica: [
        {
          id: 'm1',
          text: 'Qual é o valor de x na equação 2x + 5 = 15?',
          answers: ['x = 3', 'x = 5', 'x = 7', 'x = 10'],
          correctAnswer: 1,
          explanation: '2x + 5 = 15 → 2x = 10 → x = 5'
        },
        {
          id: 'm2',
          text: 'Qual é a raiz quadrada de 144?',
          answers: ['10', '11', '12', '14'],
          correctAnswer: 2,
          explanation: '√144 = 12, pois 12 × 12 = 144.'
        },
        {
          id: 'm3',
          text: 'Em um triângulo retângulo com catetos 3 e 4, qual é a hipotenusa?',
          answers: ['5', '6', '7', '12'],
          correctAnswer: 0,
          explanation: 'Pelo Teorema de Pitágoras: c² = 3² + 4² = 9 + 16 = 25, logo c = 5.'
        }
      ],
      portugues: [
        {
          id: 'p1',
          text: 'Qual é o sujeito da frase: "Choveu muito ontem"?',
          answers: ['Sujeito simples', 'Sujeito composto', 'Sujeito inexistente', 'Sujeito oculto'],
          correctAnswer: 2,
          explanation: 'O verbo "chover" é verbo impessoal, não admitindo sujeito. Trata-se de frase sem sujeito.'
        },
        {
          id: 'p2',
          text: 'Qual palavra está escrita corretamente?',
          answers: ['Prodúcto', 'Produto', 'Próduto', 'Produdo'],
          correctAnswer: 1,
          explanation: 'A grafia correta é "produto", sem acento, pois é palavra proparoxítona terminada em "o".'
        }
      ]
    };

    const topicQuestions = questions[topic] || questions.natureza;
    return topicQuestions.slice(0, count);
  }

  loadResults() {
    try {
      const data = localStorage.getItem('bsenem_exam_results');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveResults() {
    localStorage.setItem('bsenem_exam_results', JSON.stringify(this.results));
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'exams-page';
    
    this.element.innerHTML = `
      <div class="page-header">
        <h1>Simulados</h1>
        <p>Pratique com simulados e acompanhe seu desempenho</p>
      </div>
      
      <div class="exams-content">
        <div class="exams-list-container">
          <div class="exams-list-header">
            <h2>Simulados Disponíveis</h2>
          </div>
          <div class="exams-list">
            ${this.renderExamsList()}
          </div>
        </div>
        
        <div class="exam-player-container" style="display: none;"></div>
      </div>
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  renderExamsList() {
    if (this.exams.length === 0) {
      return `
        <div class="exams-list-empty">
          <i data-lucide="clipboard-list" class="w-12 h-12"></i>
          <p>Nenhum simulado disponível</p>
        </div>
      `;
    }

    return this.exams.map(exam => `
      <div class="exam-list-item" data-exam-id="${exam.id}">
        <div class="exam-list-item-icon">
          <i data-lucide="clipboard-check" class="w-8 h-8"></i>
        </div>
        <div class="exam-list-item-info">
          <h3 class="exam-list-item-title">${exam.title}</h3>
          <div class="exam-list-item-meta">
            <span><i data-lucide="book-open" class="w-4 h-4"></i> ${exam.subject}</span>
            <span><i data-lucide="help-circle" class="w-4 h-4"></i> ${exam.questions.length} questões</span>
            <span><i data-lucide="clock" class="w-4 h-4"></i> ${exam.timeLimit} min</span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" data-action="start-exam" data-exam-id="${exam.id}">
          Iniciar
          <i data-lucide="play" class="w-4 h-4"></i>
        </button>
      </div>
    `).join('');
  }

  bindEvents() {
    this.element.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      switch (action) {
        case 'start-exam': {
          const examId = e.target.closest('[data-exam-id]')?.dataset.examId;
          this.startExam(examId);
          break;
        }
      }
    });
  }

  startExam(examId) {
    const exam = this.exams.find(e => e.id === examId);
    if (!exam) return;

    this.currentExam = exam;
    this.currentView = 'exam';

    const listContainer = this.element.querySelector('.exams-list-container');
    const playerContainer = this.element.querySelector('.exam-player-container');

    if (listContainer) listContainer.style.display = 'none';
    if (playerContainer) {
      playerContainer.style.display = 'block';
      playerContainer.innerHTML = '';

      this.examPlayer = new ExamPlayer({
        exam,
        questions: exam.questions,
        timeLimit: exam.timeLimit,
        onComplete: (results) => this.handleExamComplete(results)
      });

      playerContainer.appendChild(this.examPlayer.render());
      this.examPlayer.start();
    }
  }

  handleExamComplete(results) {
    this.results.unshift(results);
    this.saveResults();

    this.currentView = 'results';
    this.showResults(results);
  }

  showResults(results) {
    const playerContainer = this.element.querySelector('.exam-player-container');
    if (!playerContainer) return;

    if (this.examPlayer) {
      this.examPlayer.destroy();
    }

    this.resultsScreen = new ResultsScreen({
      results,
      onReview: () => this.reviewExam(results),
      onRetry: () => this.retryExam(results.exam),
      onBack: () => this.backToList()
    });

    playerContainer.innerHTML = '';
    playerContainer.appendChild(this.resultsScreen.render());
  }

  reviewExam(results) {
    // Show exam in review mode
    const playerContainer = this.element.querySelector('.exam-player-container');
    if (!playerContainer) return;

    if (this.resultsScreen) {
      this.resultsScreen.destroy();
    }

    this.examPlayer = new ExamPlayer({
      exam: results.exam,
      questions: results.exam.questions,
      timeLimit: null,
      onComplete: () => this.backToList()
    });

    playerContainer.innerHTML = '';
    playerContainer.appendChild(this.examPlayer.render());
    
    // Apply saved answers
    results.questionResults.forEach(result => {
      if (result.selectedAnswer !== undefined) {
        this.examPlayer.answers[result.questionId] = result.selectedAnswer;
      }
      if (result.flagged) {
        this.examPlayer.flagged.add(result.questionId);
      }
    });

    this.examPlayer.setReviewMode(true);
  }

  retryExam(exam) {
    this.startExam(exam.id);
  }

  backToList() {
    this.currentView = 'list';
    
    const listContainer = this.element.querySelector('.exams-list-container');
    const playerContainer = this.element.querySelector('.exam-player-container');

    if (this.examPlayer) {
      this.examPlayer.destroy();
      this.examPlayer = null;
    }
    if (this.resultsScreen) {
      this.resultsScreen.destroy();
      this.resultsScreen = null;
    }

    if (listContainer) listContainer.style.display = 'block';
    if (playerContainer) {
      playerContainer.style.display = 'none';
      playerContainer.innerHTML = '';
    }
  }

  destroy() {
    this.examPlayer?.destroy();
    this.resultsScreen?.destroy();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
