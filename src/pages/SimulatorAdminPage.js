export class SimulatorAdminPage {
  constructor({ api, user } = {}) {
    this.api = api;
    this.user = user;
    this.element = null;
    this.data = null;
  }

  async render() {
    this.element = document.createElement('section');
    this.element.className = 'simulator-admin-page';
    this.element.innerHTML = '<div class="loading">Carregando administração de simulados...</div>';
    if (this.user?.role !== 'admin') {
      this.element.textContent = 'Acesso administrativo necessário.';
      return this.element;
    }

    await this.load();
    return this.element;
  }

  async load() {
    const response = await this.api.get('/admin/simulators');
    if (!response?.success) throw new Error(response?.message || 'Não foi possível carregar a administração.');
    this.data = response.data;
    this.renderContent();
  }
  renderContent() {
    const stats = this.data?.stats ?? {};
    this.element.replaceChildren();

    const header = document.createElement('header');
    header.className = 'simulator-admin-header';
    header.innerHTML = '<h1>Administração de simulados</h1><p>Audite o banco, textos-base e publicação sem alterar o gabarito das questões oficiais.</p>';

    const cards = document.createElement('div');
    cards.className = 'simulator-admin-stats';
    for (const [label, value] of [
      ['Questões publicadas', stats.published_questions ?? 0],
      ['ENEM válidas', stats.valid_enem ?? 0],
      ['ENEM pendentes', stats.pending_enem ?? 0],
      ['Simulados publicados', stats.published_catalogs ?? 0],
      ['Textos-base cadastrados', stats.reference_groups ?? 0],
    ]) cards.appendChild(this.statCard(label, value));

    this.element.append(header, cards, this.referenceBuilder(), this.groupList());
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
    feedback.textContent = 'Texto-base vinculado com sucesso.';
    await this.load();
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
