export class HelpPage {
  render() {
    const element = document.createElement('section');
    element.className = 'account-page help-page';
    element.innerHTML = `
      <header class="page-header"><h1>Ajuda</h1><p>Orientações rápidas para usar o BS Estudos.</p></header>
      <div class="help-grid">
        <article class="account-card"><h2>Acesso</h2><p>O BS Estudos está em beta privada. Contas e redefinições de senha são gerenciadas pelo administrador.</p></article>
        <article class="account-card"><h2>Biblioteca local</h2><p>Escolha uma pasta no seu computador para estudar vídeos, áudios, PDFs e simulados. Os arquivos não são enviados ao servidor.</p></article>
        <article class="account-card"><h2>Atalhos</h2><dl class="shortcut-list"><div><dt>Ctrl + K</dt><dd>Abrir busca e comandos</dd></div><div><dt>Ctrl + B</dt><dd>Alternar menu lateral</dd></div><div><dt>Espaço</dt><dd>Reproduzir ou pausar mídia</dd></div></dl></article>
      </div>`;
    return element;
  }
}
