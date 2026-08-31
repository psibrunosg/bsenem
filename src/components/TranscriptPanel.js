export class TranscriptPanel {
  constructor({ text = '' } = {}) { this.text = text; this.query = ''; this.element = null; }
  render() {
    this.element = document.createElement('section');
    this.element.className = 'transcript-panel';
    this.element.innerHTML = '<label>Transcrição <input type="search" placeholder="Buscar na transcrição"></label><div class="transcript-results"></div>';
    this.element.querySelector('input').addEventListener('input', (event) => this.setQuery(event.target.value));
    this.update();
    return this.element;
  }
  setQuery(query) { this.query = String(query || '').trim(); this.update(); }
  update() {
    if (!this.element) return;
    const term = this.query.toLocaleLowerCase();
    const lines = this.text.split(/\n+/).filter((line) => !term || line.toLocaleLowerCase().includes(term));
    this.element.querySelector('.transcript-results').textContent = lines.length ? lines.join('\n') : 'Nenhum trecho encontrado.';
  }
}
