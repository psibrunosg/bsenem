# Desafios recorrentes deste projeto

Anotações de fricção que voltam a aparecer. Leia antes de começar uma sessão.

## Terminal (Windows + Git Bash)

- **Heredoc grande no Bash falha em silêncio.** Escrever arquivo Python longo com
  `cat > arquivo <<'PY'` já quebrou com `unexpected EOF` e deixou o arquivo
  antigo intacto — parecia que tinha funcionado. Para arquivo novo/grande use a
  ferramenta Write; deixe o heredoc para scripts curtos.
- **Acentos saem corrompidos no stdout.** O console usa cp1252, então `print` de
  texto em português vira `quest�es`. Não é o dado que está errado: confira com
  `sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')` antes de
  concluir que a extração quebrou.
- **`tempfile.TemporaryDirectory` estoura `PermissionError` no Windows** se a
  conexão SQLite não for fechada. Nos testes, sempre `try/finally: conn.close()`.

## Pipeline ENEM

- **Nunca use resposta padrão para gabarito não encontrado.** Um `gabarito.get(n, "A")`
  produziu 265 questões com resposta errada sem nenhum sinal de erro. O teste que
  pega isso é a distribuição de respostas por ano: se uma letra domina, o
  casamento prova × gabarito quebrou naquele ano.
- **Numeração do caderno varia por edição.** 2018 dia 2 numera 1–90 enquanto o
  gabarito usa 91–180. Sempre confira `min/max(original_number)` por ano/dia
  antes de confiar na área e na resposta.
- **PDF de duas colunas vaza enunciado para a alternativa A.** Consertado em
  `scripts/question_cleaner.py`, mas layouts novos podem vazar de outro jeito —
  valide com `validation_errors` antes de publicar simulado.
- **ENEM 2010 continua inutilizável** (alternativas e gabarito não são lidos).

## App

- `ExamPlayer` não renderiza imagens de questão. Questões com imagem ficam fora
  dos simulados por padrão.
- Os simulados não são carregados por `fetch`: o app lê a biblioteca local via
  File System Access API, então o usuário precisa apontar a pasta que contém
  `data/enem/simulados/`.

## Deploy / VPS

- **O workflow `deploy.yml` publica no GitHub Pages, não na VPS.** A VPS
  (`estudos.bssaude.com.br`) serve um build Vite de `/var/www/bsenem/current`
  por um mecanismo que não está no repositório. Conferir "está na VPS?" é
  comparar o bundle servido, não olhar o CI.
- **`npm run test` roda antes do build no CI.** Um único teste vermelho trava a
  publicação inteira e o site continua no ar com a versão antiga — sem nenhum
  aviso. Se o site parece desatualizado, o primeiro lugar a olhar é
  `gh run list`.
- **GitHub Pages está quebrado**: o build é publicado sem `BASE_PATH=/bsenem/`,
  então o HTML aponta para `/assets/...` e o bundle dá 404. A VPS não sofre
  disso porque serve na raiz do domínio.
- **Os simulados não chegam ao build.** O Vite só copia `public/`, e o app lê a
  biblioteca local via File System Access API. `data/enem/simulados/` só é
  acessível apontando a pasta local no app.
- `pdo_sqlite` não está instalado no PHP local (só `pdo_pgsql`), então
  `npm run test:backend` falha aqui e passa no CI. Não é bug do repositório.
