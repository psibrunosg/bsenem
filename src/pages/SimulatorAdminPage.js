import { safeResourceUrl } from '../utils/html.js';

export class SimulatorAdminPage {
  constructor({ api, user } = {}) {
    this.api = api;
    this.user = user;
    this.element = null;
    this.data = null;
    this.audit = null;
    this.auditFilters = { page: 1, source: 'all', status: 'all', reference: 'all', subject: '', year: '', q: '' };
  }

  async render() {
    this.element = document.createElement('section');
    this.element.className = 'simulator-admin-page';
    this.element.innerHTML = '<div class="loading">Carregando administração de simulados...</div>';
    if (this.user?.role !== 'admin') {
      this.element.textContent = 'Acesso administrativo necessário.';
      return this.element;
    }
    await Promise.all([this.loadOverview(), this.loadAudit()]);
    this.renderContent();
    return this.element;
  }

  async loadOverview() {
    const response = await this.api.get('/admin/simulators');
    if (!response?.success) throw new Error(response?.message || 'Não foi possível carregar a administração.');
    this.data = response.data;
  }

  async loadAudit() {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(this.auditFilters)) {
      if (value !== '' && value !== 'all') query.set(key, String(value));
    }
    const response = await this.api.get('/admin/simulators/questions?' + query.toString());
    if (!response?.success) throw new Error(response?.message || 'Não foi possível carregar as questões.');
    this.audit = response.data;
  }

  renderContent() {
    const stats = this.data?.stats ?? {};
    this.element.replaceChildren();
    const header = document.createElement('header');
    header.className = 'simulator-admin-header';
    header.innerHTML = '<h1>Administração de simulados</h1><p>Audite questões, fontes, imagens e textos-base antes de publicar ou reutilizar conteúdo.</p>';

    const cards = document.createElement('div');
    cards.className = 'simulator-admin-stats';
    for (const [label, value] of [
      ['Questões publicadas', stats.published_questions ?? 0],
      ['ENEM válidas', stats.valid_enem ?? 0],
      ['ENEM pendentes', stats.pending_enem ?? 0],
      ['Simulados publicados', stats.published_catalogs ?? 0],
      ['Textos-base cadastrados', stats.reference_groups ?? 0],
    ]) cards.appendChild(this.statCard(label, value));

    this.element.append(header, cards, this.auditSection(), this.referenceBuilder(), this.groupList());
  }

  statCard(label, value) {
    const card = document.createElement('article');
    card.className = 'simulator-admin-stat';
    const number = document.createElement('strong');
    number.textContent = String(value);
    const text = document.createElement('span');
    text.textContent = label;
    card.append(number, text);
    return card;
  }

  auditSection() {
    const section = document.createElement('section');
    section.className = 'simulator-admin-section simulator-audit-section';
    const heading = document.createElement('div');
    heading.className = 'simulator-admin-section-heading';
    heading.innerHTML = '<div><h2>Auditoria do banco de questões</h2><p>Revise o conteúdo exatamente como está armazenado, incluindo origem, imagens, pendências e texto-base.</p></div>';

    const form = document.createElement('form');
    form.className = 'simulator-audit-filters';
    form.innerHTML = `
      <input class="input" name="q" type="search" placeholder="Buscar no enunciado ou ID" value="${this.auditFilters.q}">
      <select class="input" name="source"><option value="all">Todas as fontes</option><option value="enem">ENEM</option><option value="concursos">Concursos</option></select>
      <select class="input" name="status"><option value="all">Todos os status</option><option value="valid">Válidas</option><option value="pending">Pendentes</option></select>
      <select class="input" name="reference"><option value="all">Todos os textos-base</option><option value="linked">Com texto-base</option><option value="unlinked">Sem texto-base</option></select>
      <select class="input" name="subject"><option value="">Todas as matérias</option></select>
      <select class="input" name="year"><option value="">Todos os anos</option></select>
      <button class="btn btn-primary" type="submit">Filtrar</button>
    `;
    form.elements.source.value = this.auditFilters.source;
    form.elements.status.value = this.auditFilters.status;
    form.elements.reference.value = this.auditFilters.reference;
    for (const subject of this.audit?.filters?.subjects ?? []) form.elements.subject.add(new Option(subject, subject));
    for (const year of this.audit?.filters?.years ?? []) form.elements.year.add(new Option(String(year), String(year)));
    form.elements.subject.value = this.auditFilters.subject;
    form.elements.year.value = this.auditFilters.year;
    form.addEventListener('submit', (event) => this.applyAuditFilters(event));

    const summary = document.createElement('div');
    summary.className = 'simulator-audit-summary';
    const pagination = this.audit?.pagination ?? { total: 0, page: 1, pages: 1 };
    summary.textContent = `${pagination.total} questão(ões) encontradas · página ${pagination.page} de ${pagination.pages}`;

    const list = document.createElement('div');
    list.className = 'simulator-audit-list';
    for (const question of this.audit?.items ?? []) list.appendChild(this.auditCard(question));
    if (!list.childElementCount) list.textContent = 'Nenhuma questão encontrada para estes filtros.';

    section.append(heading, form, summary, list, this.auditPagination());
    return section;
  }

  auditCard(question) {
    const card = document.createElement('article');
    card.className = 'simulator-audit-card';
    const header = document.createElement('div');
    header.className = 'simulator-audit-card-header';
    const title = document.createElement('strong');
    title.textContent = [question.id, question.subject, question.topic].filter(Boolean).join(' · ');
    const badges = document.createElement('div');
    badges.className = 'simulator-audit-badges';
    badges.append(this.badge(question.source === 'enem' ? 'ENEM' : 'Concurso'));
    badges.append(this.badge(question.status === 'valid' ? 'Válida' : 'Pendente', question.status));
    if (question.reference) badges.append(this.badge('Texto-base vinculado', 'reference'));
    header.append(title, badges);

    const meta = document.createElement('div');
    meta.className = 'simulator-audit-meta';
    const sourceParts = [];
    if (question.year) sourceParts.push(String(question.year));
    if (question.day) sourceParts.push('Dia ' + question.day);
    if (question.question_number) sourceParts.push('Questão ' + question.question_number);
    if (question.source_page) sourceParts.push('p. ' + question.source_page);
    if (question.provider) sourceParts.push(question.provider);
    meta.textContent = sourceParts.join(' · ') || 'Metadados de origem indisponíveis';

    if (question.pending_reason) {
      const warning = document.createElement('div');
      warning.className = 'simulator-audit-warning';
      warning.textContent = 'Pendência: ' + question.pending_reason;
      card.append(header, meta, warning);
    } else {
      card.append(header, meta);
    }

    if (question.reference) {
      const reference = document.createElement('div');
      reference.className = 'simulator-audit-reference';
      reference.textContent = 'Texto-base: ' + question.reference.title;
      card.appendChild(reference);
    }

    const statement = document.createElement('p');
    statement.className = 'simulator-audit-statement';
    statement.textContent = question.statement;
    card.appendChild(statement);

    if (question.images?.length) {
      const images = document.createElement('div');
      images.className = 'simulator-audit-images';
      for (const [index, source] of question.images.entries()) {
        const img = document.createElement('img');
        img.src = safeResourceUrl(source);
        img.alt = 'Imagem da questão ' + (index + 1);
        images.appendChild(img);
      }
      card.appendChild(images);
    }

    const options = document.createElement('ol');
    options.className = 'simulator-audit-options';
    for (const key of ['A', 'B', 'C', 'D', 'E']) {
      const item = document.createElement('li');
      item.dataset.option = key;
      if (question.correct_option === key) item.classList.add('correct');
      item.textContent = key + ') ' + (question.options?.[key] || '[alternativa vazia]');
      options.appendChild(item);
    }
    card.appendChild(options);

    const source = document.createElement('div');
    source.className = 'simulator-audit-source';
    if (question.source_pdf) source.appendChild(this.metaSpan('PDF', question.source_pdf));
    if (question.source_pages?.length) source.appendChild(this.metaSpan('Páginas', question.source_pages.join(', ')));
    const sourceMeta = question.source_meta ?? {};
    if (sourceMeta.organization) source.appendChild(this.metaSpan('Órgão', sourceMeta.organization));
    if (sourceMeta.board) source.appendChild(this.metaSpan('Banca', sourceMeta.board));
    if (sourceMeta.discipline) source.appendChild(this.metaSpan('Disciplina', sourceMeta.discipline));
    if (sourceMeta.target_role) source.appendChild(this.metaSpan('Cargo', sourceMeta.target_role));
    card.appendChild(source);

    return card;
  }

  badge(text, tone = '') {
    const badge = document.createElement('span');
    badge.className = 'simulator-audit-badge ' + tone;
    badge.textContent = text;
    return badge;
  }

  metaSpan(label, value) {
    const span = document.createElement('span');
    span.textContent = label + ': ' + value;
    return span;
  }

  auditPagination() {
    const wrapper = document.createElement('div');
    wrapper.className = 'simulator-audit-pagination';
    const pagination = this.audit?.pagination ?? { page: 1, pages: 1 };
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'btn btn-secondary';
    previous.textContent = 'Anterior';
    previous.disabled = pagination.page <= 1;
    previous.addEventListener('click', () => this.changeAuditPage(pagination.page - 1));
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn-secondary';
    next.textContent = 'Próxima';
    next.disabled = pagination.page >= pagination.pages;
    next.addEventListener('click', () => this.changeAuditPage(pagination.page + 1));
    wrapper.append(previous, next);
    return wrapper;
  }

  async applyAuditFilters(event) {
    event.preventDefault();
    const form = event.currentTarget;
    this.auditFilters = {
      ...this.auditFilters,
      page: 1,
      q: form.elements.q.value.trim(),
      source: form.elements.source.value,
      status: form.elements.status.value,
      reference: form.elements.reference.value,
      subject: form.elements.subject.value,
      year: form.elements.year.value,
    };
    await this.loadAudit();
    this.renderContent();
  }

  async changeAuditPage(page) {
    this.auditFilters.page = page;
    await this.loadAudit();
    this.renderContent();
  }

  referenceBuilder() {
    const section = document.createElement('section');
    section.className = 'simulator-admin-section';
    const title = document.createElement('h2');
    title.textContent = 'Revisar dependências de texto-base';
    const help = document.createElement('p');
    help.textContent = 'A lista abaixo é apenas uma triagem automática. Selecione questões que realmente dependem do mesmo texto e cadastre a referência completa.';

    const form = document.createElement('form');
    form.className = 'simulator-reference-form';
    form.innerHTML = `
      <label>Título do texto-base<input class="input" name="title" maxlength="180" required></label>
      <label>Texto-base<textarea class="input" name="body" rows="8" maxlength="20000" required></textarea></label>
      <div class="simulator-reference-candidates"></div>
      <div class="simulator-reference-feedback" role="status"></div>
      <button type="submit" class="btn btn-primary">Criar grupo de referência</button>
    `;

    const list = form.querySelector('.simulator-reference-candidates');
    for (const candidate of this.data?.reference_candidates ?? []) list.appendChild(this.candidateRow(candidate));
    if (!list.childElementCount) list.textContent = 'Nenhuma questão foi sinalizada automaticamente nesta amostra.';
    form.addEventListener('submit', (event) => this.createReferenceGroup(event));
    section.append(title, help, form);
    return section;
  }

  candidateRow(candidate) {
    const label = document.createElement('label');
    label.className = 'simulator-reference-candidate';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'question_id';
    checkbox.value = candidate.id;
    const content = document.createElement('span');
    const meta = document.createElement('strong');
    meta.textContent = [candidate.subject, candidate.topic, candidate.id].filter(Boolean).join(' · ');
    const preview = document.createElement('span');
    preview.textContent = candidate.statement_preview;
    content.append(meta, preview);
    label.append(checkbox, content);
    return label;
  }

  async createReferenceGroup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = form.querySelector('.simulator-reference-feedback');
    const questionIds = [...form.querySelectorAll('[name="question_id"]:checked')].map((input) => input.value);
    feedback.textContent = 'Salvando...';
    const response = await this.api.post('/admin/simulators/reference-groups', {
      title: form.elements.title.value.trim(),
      body: form.elements.body.value.trim(),
      question_ids: questionIds,
    }).catch((error) => ({ success: false, message: error?.message }));
    if (!response?.success) {
      feedback.textContent = response?.message || 'Não foi possível criar o grupo.';
      return;
    }
    await Promise.all([this.loadOverview(), this.loadAudit()]);
    this.renderContent();
  }

  groupList() {
    const section = document.createElement('section');
    section.className = 'simulator-admin-section';
    const title = document.createElement('h2');
    title.textContent = 'Textos-base cadastrados';
    section.appendChild(title);
    const groups = this.data?.reference_groups ?? [];
    if (!groups.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Nenhum texto-base cadastrado ainda.';
      section.appendChild(empty);
      return section;
    }
    const list = document.createElement('div');
    list.className = 'simulator-reference-groups';
    for (const group of groups) {
      const row = document.createElement('article');
      row.className = 'simulator-reference-group';
      const heading = document.createElement('strong');
      heading.textContent = group.title;
      const meta = document.createElement('span');
      meta.textContent = `${group.question_count} questão(ões) · ${group.review_status}`;
      row.append(heading, meta);
      list.appendChild(row);
    }
    section.appendChild(list);
    return section;
  }

  destroy() {
    this.element?.remove();
  }
}
