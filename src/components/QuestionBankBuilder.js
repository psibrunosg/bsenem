export class QuestionBankBuilder {
  constructor({ apiClient, onStart = () => {} } = {}) {
    this.api = apiClient;
    this.onStart = onStart;
    this.selection = { track: '', subject: '', specialty: '', topic: '', questionCount: 10 };
    this.facets = { tracks: [], subjects: [], specialties: [], topics: [] };
    this.error = null;
    this.loading = false;
    this.starting = false;
    this.element = null;
  }

  render() {
    this.element = document.createElement('section');
    this.element.className = 'question-bank-builder';
    this.update();
    void this.loadFacets();
    return this.element;
  }

  async loadFacets() {
    this.loading = true;
    this.error = null;
    this.update();
    try {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(this.selection)) {
        if (key !== 'questionCount' && value) query.set(key, value);
      }
      const response = await this.api.get(`/question-bank/facets${query.size ? `?${query}` : ''}`);
      if (!response?.success || !response.data) throw new Error(response?.message || 'Não foi possível carregar o banco de questões.');
      this.facets = response.data;
    } catch (error) {
      this.error = error.message || 'Não foi possível carregar o banco de questões.';
      this.facets = { tracks: [], subjects: [], specialties: [], topics: [] };
    } finally {
      this.loading = false;
      this.update();
    }
  }

  update() {
    if (!this.element) return;
    const available = this.availableCount();
    const requiresSpecialty = this.selection.track === 'concursos' && this.selection.subject === 'conhecimentos-especificos';
    const isReady = Boolean(this.selection.track && this.selection.subject && (!requiresSpecialty || (this.selection.specialty && this.selection.topic)));
    this.element.innerHTML = `
      <div class="question-bank-heading">
        <div>
          <h2>Banco de questões</h2>
          <p>Monte uma prática com questões oficiais e correção ao final.</p>
        </div>
        ${available > 0 ? `<span class="badge badge-primary">${available} disponíveis</span>` : ''}
      </div>
      ${this.error ? `<p class="question-bank-message error" role="alert">${escapeText(this.error)}</p>` : ''}
      <div class="question-bank-fields" aria-busy="${this.loading}">
        ${this.select('track', 'Modalidade', this.facets.tracks, !this.loading, 'Escolha ENEM ou Concursos')}
        ${this.select('subject', 'Matéria', this.facets.subjects, Boolean(this.selection.track) && !this.loading, 'Escolha a matéria')}
        ${requiresSpecialty ? this.select('specialty', 'Área específica', this.facets.specialties, Boolean(this.selection.subject) && !this.loading, 'Escolha a área') : ''}
        ${requiresSpecialty ? this.select('topic', 'Subtema', this.facets.topics, Boolean(this.selection.specialty) && !this.loading, 'Escolha o subtema') : ''}
        ${this.quantitySelect(available, isReady)}
      </div>
      <div class="question-bank-actions">
        <button class="btn btn-primary" type="button" data-action="start-question-bank" ${!isReady || available < this.selection.questionCount || this.loading || this.starting ? 'disabled' : ''}>
          ${this.starting ? 'Preparando sessão...' : 'Iniciar prática'}
        </button>
        ${isReady && available < this.selection.questionCount ? `<p class="question-bank-message">Selecione uma quantidade de até ${available} questões.</p>` : ''}
      </div>
    `;
    this.bindEvents();
  }

  select(key, label, options, enabled, placeholder) {
    const selected = this.selection[key];
    return `<label class="question-bank-field"><span>${label}</span><select class="input" data-question-bank-${key} ${enabled ? '' : 'disabled'}><option value="">${placeholder}</option>${options.map((option) => `<option value="${escapeAttribute(option.slug)}" ${option.slug === selected ? 'selected' : ''}>${escapeText(option.label)} (${option.count})</option>`).join('')}</select></label>`;
  }

  quantitySelect(available, isReady) {
    const sizes = [10, 25, 50, 75, 100];
    return `<label class="question-bank-field"><span>Questões</span><select class="input" data-question-bank-question-count ${isReady ? '' : 'disabled'}>${sizes.map((size) => `<option value="${size}" ${size === this.selection.questionCount ? 'selected' : ''} ${available > 0 && size > available ? 'disabled' : ''}>${size}</option>`).join('')}</select></label>`;
  }

  bindEvents() {
    this.element.querySelector('[data-question-bank-track]')?.addEventListener('change', async (event) => {
      this.selection = { track: event.target.value, subject: '', specialty: '', topic: '', questionCount: 10 };
      await this.loadFacets();
    });
    this.element.querySelector('[data-question-bank-subject]')?.addEventListener('change', async (event) => {
      this.selection = { ...this.selection, subject: event.target.value, specialty: '', topic: '', questionCount: 10 };
      await this.loadFacets();
    });
    this.element.querySelector('[data-question-bank-specialty]')?.addEventListener('change', async (event) => {
      this.selection = { ...this.selection, specialty: event.target.value, topic: '', questionCount: 10 };
      await this.loadFacets();
    });
    this.element.querySelector('[data-question-bank-topic]')?.addEventListener('change', (event) => {
      this.selection = { ...this.selection, topic: event.target.value, questionCount: 10 };
      this.update();
    });
    this.element.querySelector('[data-question-bank-question-count]')?.addEventListener('change', (event) => {
      this.selection = { ...this.selection, questionCount: Number(event.target.value) };
      this.update();
    });
    this.element.querySelector('[data-action="start-question-bank"]')?.addEventListener('click', () => void this.start());
  }

  async start() {
    this.starting = true;
    this.error = null;
    this.update();
    try {
      const payload = {
        track: this.selection.track,
        subject: this.selection.subject,
        questionCount: this.selection.questionCount,
        ...(this.selection.specialty ? { specialty: this.selection.specialty } : {}),
        ...(this.selection.topic ? { topic: this.selection.topic } : {})
      };
      const response = await this.api.post('/question-bank/sessions', payload);
      if (!response?.success || !response.data) throw new Error(response?.message || 'Não foi possível iniciar esta prática.');
      this.onStart(response.data);
    } catch (error) {
      this.error = error.message || 'Não foi possível iniciar esta prática.';
      this.starting = false;
      this.update();
    }
  }

  availableCount() {
    if (this.selection.track === 'enem' || (this.selection.track === 'concursos' && this.selection.subject && this.selection.subject !== 'conhecimentos-especificos')) {
      return this.facets.subjects.find((item) => item.slug === this.selection.subject)?.count ?? 0;
    }
    if (this.selection.specialty && this.selection.topic) return this.facets.topics.find((item) => item.slug === this.selection.topic)?.count ?? 0;
    if (this.selection.subject === 'conhecimentos-especificos' && this.selection.specialty) return this.facets.specialties.find((item) => item.slug === this.selection.specialty)?.count ?? 0;
    return 0;
  }

  destroy() { this.element?.remove(); }
}

function escapeText(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function escapeAttribute(value) { return escapeText(value); }
