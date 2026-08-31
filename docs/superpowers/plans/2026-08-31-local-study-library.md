# Biblioteca Local de Estudos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a BS Estudos em uma biblioteca pessoal local, sem dados fictícios e sem envio de mídia, caminhos ou metadados de conteúdo à VPS.

**Architecture:** Um serviço cliente `LocalLibraryService` será a única porta de acesso à pasta que o usuário escolhe. Ele persiste o handle e o catálogo somente no IndexedDB, varre arquivos suportados e associa transcrições; páginas e players recebem recursos locais através de uma sessão efêmera do `AppShell`. O backend continua responsável apenas por autenticação e progresso já existente.

**Tech Stack:** JavaScript ES modules, Vite 5, Vitest 2, JSDOM 25, IndexedDB, File System Access API, PHP 8.2 e SQLite.

**Spec:** `docs/superpowers/specs/2026-08-31-local-study-library-design.md`

## Global Constraints

- O seletor de pasta exige HTTPS, clique explícito e acesso `read`; nenhum código pede ou usa acesso `readwrite`.
- Mídia, conteúdo de transcrição, títulos, caminhos absolutos, caminhos relativos e catálogo ficam somente no navegador; não entram em `api`, logs, fixtures, testes de rede ou backend.
- Não mover, renomear, apagar, criar ou modificar arquivos em `G:\Meu Drive\Estudo` ou qualquer pasta escolhida.
- Suportar `.mp4`, `.webm`, `.ogv`, `.mp3`, `.m4a`, `.wav`, `.ogg`, `.opus`, `.pdf`, `.vtt`, `.srt`, `.txt` e `.bsestudos.exam.json` conforme a especificação.
- Arquivos sem suporte são diagnosticados no cliente, mas não renderizados ou convertidos.
- Não criar conteúdo de demonstração, métricas aleatórias, perfil fictício, questões hardcoded, listas estáticas ou resultados de busca simulados.
- Alterações funcionais usam TDD: teste falha primeiro, mudança mínima, teste passa, regressão completa e commit pequeno.
- Antes de release: `npm ci`, `npm test`, `npm run test:backend`, lint PHP de todos os arquivos e `npm run build` precisam passar. Playwright executa somente contra um build local; deploy requer o contrato versionado, backup, health check e rollback definidos em `deploy/`.

---

### Task 1: Restaurar contrato reprodutível de build e testes

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `backend/tests/lint_test.php`
- Modify: `.github/workflows/deploy.yml`
- Test: `src/tests/toolchain.test.js`

**Interfaces:**
- Consumes: `vite.config.js`, testes em `src/tests/` e `backend/tests/auth_test.php`.
- Produces: os comandos `npm test`, `npm run test:backend` e `npm run build`, todos declarados no repositório.

- [ ] **Step 1: Escrever o teste de contrato do manifesto**

```js
import { describe, expect, it } from 'vitest';
import packageManifest from '../../package.json' with { type: 'json' };

describe('toolchain manifest', () => {
  it('declares reproducible verification commands', () => {
    expect(packageManifest.type).toBe('module');
    expect(packageManifest.scripts.test).toBe('vitest run');
    expect(packageManifest.scripts['test:backend']).toBe('php backend/tests/auth_test.php');
    expect(packageManifest.scripts.build).toBe('vite build');
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha inicial**

Run: `rtk npm test -- src/tests/toolchain.test.js`  
Expected: FAIL porque `package.json` não existe.

- [ ] **Step 3: Criar manifesto e lockfile compatíveis com Node 20**

Criar `package.json` com o seguinte contrato mínimo, removendo a dependência Tauri por estar fora deste roadmap:

```json
{
  "name": "bs-estudos",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:backend": "php backend/tests/auth_test.php",
    "lint:php": "php backend/tests/lint_test.php"
  },
  "devDependencies": {
    "jsdom": "^25.0.1",
    "vite": "^5.4.14",
    "vitest": "^2.1.9"
  }
}
```

Criar `backend/tests/lint_test.php` que percorre `backend/`, ignora `backend/database/`, executa `PHP_BINARY -l` para cada arquivo `.php`, imprime apenas o caminho relativo e termina com código `1` se qualquer lint falhar. Executar `rtk npm install --package-lock-only` e versionar o `package-lock.json` gerado. Em `.github/workflows/deploy.yml`, trocar `npm install` por `npm ci` e preservar as três gates `npm test`, `npm run test:backend` e `npm run build`.

- [ ] **Step 4: Executar a verificação de contrato**

Run: `rtk npm ci && rtk npm test -- src/tests/toolchain.test.js && rtk npm run test:backend && rtk npm run lint:php && rtk npm run build`  
Expected: PASS; o build cria apenas `dist/`, já ignorado pelo Git.

- [ ] **Step 5: Commit**

```bash
rtk git add package.json package-lock.json backend/tests/lint_test.php .github/workflows/deploy.yml src/tests/toolchain.test.js
rtk git commit -m "build: restore reproducible frontend checks"
```

### Task 2: Implementar o serviço de biblioteca local e o contrato de simulados

**Files:**
- Create: `src/services/LocalLibraryService.js`
- Create: `src/services/examSchema.js`
- Create: `src/tests/LocalLibraryService.test.js`
- Create: `src/tests/examSchema.test.js`
- Modify: `src/utils/idb.js`

**Interfaces:**
- Consumes: `FileSystemDirectoryHandle`, `FileSystemFileHandle` e `idb`.
- Produces: `LocalLibraryService.connect()`, `restore()`, `refresh()`, `search()`, `getItem(id)`, `createObjectUrl(item)` e `releaseObjectUrls()`.
- Produces: `validateLocalExam(input)` e `toExamPlayerQuestion(question)`.

- [ ] **Step 1: Escrever testes de catálogo e validação antes da implementação**

Criar handles falsos assíncronos e testar o contrato abaixo:

```js
const result = await service.scan(fakeDirectory({
  'UNIFATECIE': directory({
    'Modulo': directory({
      'Videos': directory({ 'Aula 01.mp4': file('video/mp4') }),
      'PDFs': directory({ 'Aula 01.pdf': file('application/pdf') }),
      'Aula 01.vtt': file('text/vtt'),
      'desktop.ini': file('text/plain')
    })
  })
}));

expect(result.items.map(({ title, resourceType }) => [title, resourceType]))
  .toEqual([['Aula 01', 'video'], ['Aula 01', 'pdf']]);
expect(result.items[0].transcript.kind).toBe('captions');
expect(result.diagnostics).toContainEqual(expect.objectContaining({ name: 'desktop.ini', code: 'ignored-system-file' }));
```

Cobrir também: áudio com `.txt`, SRT associado por nome-base e mesmo diretório, extensões não suportadas, diretório vazio, permissão `denied`, arquivo que desaparece após varredura, pesquisa sem distinção de maiúsculas e simulado com cinco opções. Para simulados inválidos, testar `schema` errado, `durationMinutes` não positivo, ID repetido e `correctOption` fora de `0..4`.

- [ ] **Step 2: Executar os testes e confirmar a falha inicial**

Run: `rtk npm test -- src/tests/LocalLibraryService.test.js src/tests/examSchema.test.js`  
Expected: FAIL porque os módulos não existem.

- [ ] **Step 3: Criar os módulos mínimos, sem tráfego de API**

Implementar `LocalLibraryService` com estas regras:

```js
const MEDIA_TYPES = new Map([
  ['mp4', 'video'], ['webm', 'video'], ['ogv', 'video'],
  ['mp3', 'audio'], ['m4a', 'audio'], ['wav', 'audio'], ['ogg', 'audio'], ['opus', 'audio'],
  ['pdf', 'pdf']
]);
const SIDECAR_TYPES = new Set(['vtt', 'srt', 'txt']);

async connect() {
  const handle = await window.showDirectoryPicker({ mode: 'read', id: 'bs-estudos-library' });
  await idb.set('local-library-handle', handle);
  return this.refresh(handle);
}
```

`scan()` deve percorrer `handle.values()` recursivamente, ignorar `desktop.ini`, `.lnk`, diretórios `cache` e nomes iniciados por `.`, derivar `area`, `collection`, `resourceType` e associar sidecars por `directoryPath + basename` exato. Persistir somente handle, identificador aleatório de biblioteca, itens e diagnósticos no IndexedDB. Não chamar `api`.

Estender `idb` com `delete(key)` e com uma atualização de versão que preserva a store `keyval`. Criar `examSchema.js` para validar exatamente o contrato do spec e adaptar cada questão para `{ id, text, answers, correctAnswer, explanation }`, sem preencher respostas ausentes.

- [ ] **Step 4: Executar testes unitários do domínio**

Run: `rtk npm test -- src/tests/LocalLibraryService.test.js src/tests/examSchema.test.js`  
Expected: PASS; nenhuma chamada de rede é criada nos testes.

- [ ] **Step 5: Commit**

```bash
rtk git add src/services/LocalLibraryService.js src/services/examSchema.js src/utils/idb.js src/tests/LocalLibraryService.test.js src/tests/examSchema.test.js
rtk git commit -m "feat: add local library catalog service"
```

### Task 3: Consolidar a tela Biblioteca e conectar a rota

**Files:**
- Modify: `src/pages/LibraryPage.js`
- Modify: `src/components/AppShell.js`
- Modify: `src/components/Sidebar.js`
- Modify: `src/main.js`
- Modify: `src/assets/styles/components/library.css`
- Modify: `src/assets/styles/main.css`
- Test: `src/tests/LibraryPage.test.js`
- Test: `src/tests/AppShell.test.js`

**Interfaces:**
- Consumes: `LocalLibraryService` e o método novo `app.openLocalResource(item)`.
- Produces: rota `library`; os métodos `AppShell.setLibraryService(service)`, `openLocalResource(item)` e `consumeLocalResource(type)`.

- [ ] **Step 1: Escrever testes de página e navegação**

```js
it('shows an honest empty state before a folder is connected', async () => {
  const page = new LibraryPage({ library: disconnectedLibrary });
  const element = await page.render();
  expect(element.textContent).toContain('Conectar pasta de estudos');
  expect(element.textContent).not.toMatch(/João|Carlos Silva|Simulado ENEM 2023/);
});

it('registers Biblioteca local as an implemented route', () => {
  const routes = routeIds(new Sidebar().render());
  expect(routes).toContain('library');
});
```

Também testar: botão chama `library.connect()` depois de clique, cancelamento `AbortError` não vira alerta de erro, permissão negada mostra reconectar, atualizar chama `refresh()`, arquivos são agrupados por área/coleção, e clicar em vídeo chama `app.openLocalResource(item)`.

- [ ] **Step 2: Executar os testes e confirmar a falha inicial**

Run: `rtk npm test -- src/tests/LibraryPage.test.js src/tests/AppShell.test.js`  
Expected: FAIL porque a rota não está registrada e a página atual contém markup quebrado e scanner próprio.

- [ ] **Step 3: Substituir a página incompleta por adaptador fino de UI**

Reescrever `LibraryPage` para usar apenas `LocalLibraryService`; remover `traverseDirectory`, arrays locais de arquivos, `setTimeout`, eventos globais `play-local-video` e `alert`. A página deve renderizar estes estados: não conectada, varrendo, vazia, pronta, permissão revogada e biblioteca indisponível.

Adicionar a rota em `main.js`, a entrada **Biblioteca local** no grupo Conteúdo do `Sidebar` e CSS em `library.css`. `AppShell` mantém o serviço e o item escolhido somente em memória:

```js
openLocalResource(item) {
  this.pendingLocalResource = item;
  this.navigate(item.resourceType === 'audio' ? 'audio' : item.resourceType === 'video' ? 'video' : 'library');
}

consumeLocalResource(type) {
  if (this.pendingLocalResource?.resourceType !== type) return null;
  const item = this.pendingLocalResource;
  this.pendingLocalResource = null;
  return item;
}
```

- [ ] **Step 4: Executar testes de rota e página**

Run: `rtk npm test -- src/tests/LibraryPage.test.js src/tests/AppShell.test.js`  
Expected: PASS; a página não contém exemplos e não acessa APIs PHP.

- [ ] **Step 5: Commit**

```bash
rtk git add src/pages/LibraryPage.js src/components/AppShell.js src/components/Sidebar.js src/main.js src/assets/styles/components/library.css src/assets/styles/main.css src/tests/LibraryPage.test.js src/tests/AppShell.test.js
rtk git commit -m "feat: add local library route"
```

### Task 4: Reproduzir mídia local, documentos e transcrições com limpeza de URLs

**Files:**
- Create: `src/services/localMediaSession.js`
- Create: `src/components/TranscriptPanel.js`
- Modify: `src/pages/VideoPage.js`
- Modify: `src/pages/AudioPage.js`
- Modify: `src/pages/LibraryPage.js`
- Modify: `src/components/VideoPlayer.js`
- Modify: `src/components/AudioPlayer.js`
- Modify: `src/components/PDFViewer.js`
- Modify: `src/assets/styles/components/audio.css`
- Modify: `src/assets/styles/components/video.css`
- Test: `src/tests/localMediaSession.test.js`
- Test: `src/tests/TranscriptPanel.test.js`
- Test: `src/tests/MediaPages.test.js`

**Interfaces:**
- Consumes: item do catálogo com handles de mídia e sidecar.
- Produces: `LocalMediaSession.open(item)`, `close()`, `captions`, `transcriptText` e `TranscriptPanel` pesquisável.

- [ ] **Step 1: Escrever testes de URL, legenda e painel**

```js
it('converts an SRT sidecar to an in-memory VTT caption URL', async () => {
  const session = await LocalMediaSession.open(itemWithSrt('00:00:01,000 --> 00:00:02,000\nOlá'));
  expect(session.captions[0]).toMatchObject({ lang: 'pt', label: 'Português', default: true });
  expect(URL.createObjectURL).toHaveBeenCalled();
});

it('filters a text transcript without changing its source', () => {
  const panel = new TranscriptPanel({ text: 'Sistema nervoso central' });
  const element = panel.render();
  panel.setQuery('nervoso');
  expect(element.textContent).toContain('Sistema nervoso central');
});
```

Cobrir também revogação de toda URL criada em `close()`, legenda VTT sem conversão, ausência de transcrição, arquivo removido antes de `getFile()`, rota de vídeo com recurso local e rota de áudio com painel `.txt`.

- [ ] **Step 2: Executar os testes e confirmar a falha inicial**

Run: `rtk npm test -- src/tests/localMediaSession.test.js src/tests/TranscriptPanel.test.js src/tests/MediaPages.test.js`  
Expected: FAIL porque a sessão e o painel não existem e as páginas usam playlists estáticas.

- [ ] **Step 3: Implementar sessão de mídia e integrar players existentes**

`LocalMediaSession.open(item)` lê o arquivo apenas quando o usuário abre o recurso, cria URL de objeto, converte SRT para uma string VTT em memória e cria URL de objeto para a legenda. A conversão aceita timestamp `HH:MM:SS,mmm` e troca a vírgula por ponto; linhas sem bloco de tempo são descartadas e registradas como diagnóstico local.

`VideoPage` consome recurso pendente de `AppShell`, passa `src`, `title` e `captions` para `VideoPlayer.setSrc()` e `setSubtitles()`, ou exibe a lista vazia sem URL externa. `AudioPage` consome áudio local, chama `AudioPlayer.setTrack()` e acrescenta `TranscriptPanel` apenas para `.txt`. `LibraryPage` abre PDF por URL de objeto em `PDFViewer` e libera a URL quando fecha o visualizador. Todos os `destroy()` chamam `session.close()`.

- [ ] **Step 4: Executar os testes de reprodução**

Run: `rtk npm test -- src/tests/localMediaSession.test.js src/tests/TranscriptPanel.test.js src/tests/MediaPages.test.js`  
Expected: PASS; testes confirmam que não existem URLs `http` ou `https` de mídia.

- [ ] **Step 5: Commit**

```bash
rtk git add src/services/localMediaSession.js src/components/TranscriptPanel.js src/pages/VideoPage.js src/pages/AudioPage.js src/pages/LibraryPage.js src/components/VideoPlayer.js src/components/AudioPlayer.js src/components/PDFViewer.js src/assets/styles/components/audio.css src/assets/styles/components/video.css src/tests/localMediaSession.test.js src/tests/TranscriptPanel.test.js src/tests/MediaPages.test.js
rtk git commit -m "feat: play local media with transcripts"
```

### Task 5: Remover todo conteúdo demonstrativo e usar apenas sessão e progresso reais

**Files:**
- Modify: `src/main.js`
- Modify: `src/components/AppShell.js`
- Modify: `src/components/Sidebar.js`
- Modify: `src/components/Header.js`
- Modify: `src/pages/DashboardPage.js`
- Modify: `src/pages/FlashcardsPage.js`
- Modify: `src/pages/ExamsPage.js`
- Modify: `src/pages/LoginPage.js`
- Test: `src/tests/bootstrap.test.js`
- Test: `src/tests/DashboardPage.test.js`
- Test: `src/tests/FlashcardsPage.test.js`
- Test: `src/tests/ExamsPage.test.js`

**Interfaces:**
- Consumes: `api.get('/auth/me')`, `api.get('/progress/dashboard')`, `api.get('/progress/heatmap')`, `LocalLibraryService` e `validateLocalExam()`.
- Produces: `bootstrapApp()` exportado por `src/main.js`; estado autenticado real ou `LoginPage`; páginas vazias quando não houver dados reais.

- [ ] **Step 1: Escrever testes negativos para dados fictícios**

```js
it('shows LoginPage instead of a fabricated profile when no token is stored', async () => {
  localStorage.removeItem('token');
  await bootstrapApp({ root: document.body, api: fakeApi });
  expect(document.body.textContent).toContain('BS Estudos');
  expect(document.body.textContent).not.toContain('João Silva');
});

it('does not create sample flashcards for a new account', async () => {
  const page = new FlashcardsPage();
  await page.render();
  expect(srsEngine.getAllCards()).toEqual([]);
});

it('does not list an exam until a valid local manifest exists', () => {
  expect(new ExamsPage({ library: emptyLibrary }).loadExams()).toEqual([]);
});
```

Adicionar testes para métricas zero, busca sem `mockResults`, painel sem `Math.random`, e perfil renderizado a partir do retorno `{ id, name, email, xp, level, streak }` de `/auth/me`.

- [ ] **Step 2: Executar os testes e confirmar a falha inicial**

Run: `rtk npm test -- src/tests/bootstrap.test.js src/tests/DashboardPage.test.js src/tests/FlashcardsPage.test.js src/tests/ExamsPage.test.js`  
Expected: FAIL porque `main.js`, `AppShell`, dashboard, flashcards e simulados ainda injetam dados demonstrativos.

- [ ] **Step 3: Implementar bootstrap real e estados vazios**

Extrair de `main.js`:

```js
export async function bootstrapApp({ root = document.getElementById('app'), api: client = api } = {}) {
  const token = localStorage.getItem('token');
  if (!token) return mountLogin(root, client);
  const response = await client.get('/auth/me');
  if (!response.success) return mountLogin(root, client);
  return mountAuthenticatedApp(root, response.data, client);
}
```

Remover o objeto `João Silva`, a lista fixa de matérias, `initSampleCards()`, `loadExams()` hardcoded, `generateSampleQuestions()`, vídeos/áudios externos e `mockResults`. `DashboardPage` usa somente respostas reais; sem resposta ou sem atividade, renderiza zero e copy de estado vazio. `ExamsPage` recebe o catálogo local e só cria `ExamPlayer` para manifestos validados. O `Sidebar` e `Header` suportam usuário nulo apenas durante bootstrap, sem valores falsos.

- [ ] **Step 4: Executar testes de remoção e regressão de autenticação**

Run: `rtk npm test -- src/tests/bootstrap.test.js src/tests/DashboardPage.test.js src/tests/FlashcardsPage.test.js src/tests/ExamsPage.test.js src/tests/AppShell.test.js`  
Expected: PASS; busca e páginas não exibem nomes, números, mídias ou questões demonstrativas.

- [ ] **Step 5: Commit**

```bash
rtk git add src/main.js src/components/AppShell.js src/components/Sidebar.js src/components/Header.js src/pages/DashboardPage.js src/pages/FlashcardsPage.js src/pages/ExamsPage.js src/pages/LoginPage.js src/tests/bootstrap.test.js src/tests/DashboardPage.test.js src/tests/FlashcardsPage.test.js src/tests/ExamsPage.test.js
rtk git commit -m "fix: remove fictitious study data"
```

### Task 6: Validar acessibilidade, segurança, documentação e release local

**Files:**
- Modify: `README.md`
- Modify: `src/assets/styles/components/library.css`
- Create: `src/tests/LibraryAccessibility.test.js`
- Create: `playwright.local.config.js`
- Create: `e2e/local-library.spec.js`
- Create: `docs/evidence/roadmap-autopilot/local-study-library/verification.md`

**Interfaces:**
- Consumes: implementação das Tasks 1–5 e a especificação aprovada.
- Produces: documentação operacional local, evidência sanitizada e gates de aceitação reproduzíveis.

- [ ] **Step 1: Escrever testes de acessibilidade e privacidade**

```js
it('keeps the folder action keyboard reachable and reports permission failure', async () => {
  const element = await new LibraryPage({ library: deniedLibrary }).render();
  const button = element.querySelector('[data-action="connect-folder"]');
  expect(button.tagName).toBe('BUTTON');
  expect(element.textContent).toContain('Conectar novamente');
});

it('never sends local metadata through the API client', async () => {
  await library.refresh();
  expect(fakeApi.calls).toEqual([]);
});
```

Cobrir foco visível, `aria-live` para varredura e erro, texto alternativo de ícones acionáveis, ordem de tabulação e estado de formato não suportado.

- [ ] **Step 2: Executar os testes e confirmar a falha inicial**

Run: `rtk npm test -- src/tests/LibraryAccessibility.test.js`  
Expected: FAIL até que os estados e atributos acessíveis estejam presentes.

- [ ] **Step 3: Implementar a camada final e atualizar documentação**

Garantir que `library.css` use foco visível, contraste consistente com os tokens existentes e `aria-live="polite"` para status de varredura. Atualizar `README.md` com: requisito de Chrome ou Edge em desktop, HTTPS, botão de seleção de pasta, tipos aceitos, convenção de arquivos lado a lado para transcrição, ausência de upload e comportamento em HD desconectado. Não incluir nomes reais de arquivos nem caminhos do usuário.

Criar `playwright.local.config.js` com `webServer.command: 'npm run dev -- --host 127.0.0.1'`, URL `http://127.0.0.1:8765` e projeto Chromium. Criar `e2e/local-library.spec.js` que substitui `window.showDirectoryPicker` antes do clique por um handle sintético e cobre login sem perfil demonstrativo, estado sem pasta, catálogo com áudio e `.txt`, legenda VTT, permissão revogada e foco por teclado.

Criar `verification.md` com SHA, comandos, códigos de saída, data, resultado e hashes de artefatos; incluir apenas dados sintéticos.

- [ ] **Step 4: Executar gates completos e Playwright local**

Run:

```bash
rtk npm ci
rtk npm test
rtk npm run test:backend
rtk npm run lint:php
rtk npm run build
rtk npx playwright test --config=playwright.local.config.js
```

Expected: todos os comandos retornam código `0`; Playwright cobre login sem dados fictícios, estado sem pasta, pasta simulada com mídia e transcrição, permissão revogada e navegação por teclado.

- [ ] **Step 5: Commit e checkpoint de release**

```bash
rtk git add README.md src/assets/styles/components/library.css src/tests/LibraryAccessibility.test.js playwright.local.config.js e2e/local-library.spec.js docs/evidence/roadmap-autopilot/local-study-library/verification.md
rtk git commit -m "docs: document local study library"
rtk git status --short --branch
```

Antes de qualquer deploy, o arbiter deve ler `deploy/`, confirmar o release anterior, criar backup verificável, construir artefato versionado, apontar `current` para a nova release, validar `https://estudos.bssaude.com.br`, testar rollback para a release anterior e registrar o resultado sanitizado. Sem esse contrato e sem autorização de deploy vigente, o estado é `BLOCKED`.

## Self-Review

- Cobertura da especificação: Tasks 2–4 implementam pasta local, organização, formatos e transcrições; Task 5 remove todos os dados fictícios e restaura sessão real; Task 6 cobre privacidade, acessibilidade e evidence; Task 1 recupera o pré-requisito de validação.
- Consistência: o catálogo é único em `LocalLibraryService`; apenas `AppShell` transporta o recurso selecionado entre páginas; `LocalMediaSession` é dono de URLs de objeto; simulados usam o schema definido no spec.
- Sem lacunas de publicação: o plano não autoriza push, deploy, segredo ou modificação da pasta de estudos; release permanece condicionado a validação e autorização explícita.
