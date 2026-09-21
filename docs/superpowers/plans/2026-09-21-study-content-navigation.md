# Navegação de conteúdo por instituição Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma navegação remota e autenticada por instituição, formação, módulo e formato de conteúdo, removendo a Biblioteca local da experiência.

**Architecture:** `StudyLibraryController` passa a responder um modo de conteúdo por rota e não envia materiais enquanto existirem filhos no caminho. Uma única página de catálogo recebe a configuração de rota para Biblioteca de estudos, Videoaulas, Áudios e Documentos; a sidebar apenas aponta cada aba para essa configuração.

**Tech Stack:** PHP 8.2, SQLite, JavaScript ES modules, Vitest, CSS, links diretos do Google Drive.

**Spec:** `docs/superpowers/specs/2026-09-21-study-content-navigation-design.md`

## Global Constraints

- Usar somente `study_library_items` e os links diretos já importados; não baixar arquivos do Drive.
- Exigir autenticação em toda leitura do catálogo remoto.
- Remover Biblioteca local do menu e das rotas registradas, sem apagar serviços locais usados por testes ou funcionalidades fora deste escopo.
- Não misturar PDFs em Videoaulas ou Áudios.
- Não carregar itens terminais enquanto o caminho tiver filhos.
- Criar testes antes de alterar código de produção.

## Review Focus

- Um caminho com módulos e vídeos próprios deve mostrar módulos, nunca vídeos antecipados; testar no endpoint.
- A aba Documentos deve incluir `pdf` e `document`, mas excluir vídeo e áudio; testar no endpoint.
- Uma aba de mídia vazia deve renderizar uma mensagem clara, sem voltar a mostrar todos os formatos; testar no componente.
- As setas devem mover somente o trilho da instituição acionada; testar no DOM.
- Um link Drive inválido continua desabilitado e nunca cria `iframe`; preservar o teste existente.

---

### Task 1: Contrato do catálogo por tipo e nível

**Files:**
- Modify: `backend/controllers/StudyLibraryController.php`
- Modify: `backend/tests/study_library_api_test.php`

**Interfaces:**
- Consumes: `GET /api/study-library?path=&type=&page=&per_page=`.
- Produces: `data.children`, `data.items`, `data.types` e `pagination`; `items` é vazio quando `children` não é vazio.

- [ ] **Step 1: Write the failing API tests**

Adicionar uma árvore de teste com os caminhos `Instituições / Faculdade Metropolitana / TCC / Módulo 1`, um vídeo e um PDF no mesmo módulo e um documento em outro módulo. Cobrir:

```php
putenv('TEST_URI=/api/study-library?path=Institui%C3%A7%C3%B5es%20%2F%20Faculdade%20Metropolitana%20%2F%20TCC&type=video');
include __DIR__ . '/../api/index.php';
expectLibraryApi($payload['data']['children'][0]['label'] === 'Módulo 1', 'TCC exposes its modules first');
expectLibraryApi($payload['data']['items'] === [], 'TCC does not leak terminal videos before a module is selected');
```

Criar requisições equivalentes para `type=document` e `type=video` no módulo, verificando que Documento retorna PDF/documento e Videoaulas retorna apenas vídeo.

- [ ] **Step 2: Run the API test to verify it fails**

Run: `php backend/tests/study_library_api_test.php`

Expected: FAIL porque o controlador atual devolve itens junto com filhos e não reconhece o grupo `document`.

- [ ] **Step 3: Implement the smallest controller contract**

No controlador, normalizar o filtro público em grupos de tipos:

```php
private static function itemTypes(string $type): array {
    return match ($type) {
        'document' => ['pdf', 'document'],
        '' => ['video', 'audio', 'pdf', 'document', 'other'],
        default => [$type],
    };
}
```

Usar `item_type IN (?, ...)` com parâmetros correspondentes e, depois de calcular `children`, retornar `items = []` quando houver filhos. Manter a ordenação atual por `catalog_path COLLATE NOCASE, name COLLATE NOCASE` e tornar `children` a única lista exibida nesse estágio.

- [ ] **Step 4: Run the API test to verify it passes**

Run: `php backend/tests/study_library_api_test.php`

Expected: PASS e asserções confirmam módulos antes de materiais, filtros exclusivos e isolamento por usuário.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/StudyLibraryController.php backend/tests/study_library_api_test.php
git commit -m "feat: filtrar catálogo por formato e nível"
```

### Task 2: Página remota configurável por aba

**Files:**
- Modify: `src/pages/StudyLibraryPage.js`
- Modify: `src/main.js`
- Modify: `src/tests/StudyLibraryPage.test.js`

**Interfaces:**
- Consumes: `new StudyLibraryPage({ api, contentMode })`, onde `contentMode` é `all`, `video`, `audio` ou `document`.
- Produces: a consulta `/study-library` com o parâmetro `type` compatível e uma página com título e cópia da aba selecionada.

- [ ] **Step 1: Write the failing page tests**

Adicionar testes que instanciam as configurações e verificam a URL requisitada e o título:

```js
const page = new StudyLibraryPage({ api, contentMode: 'document' });
page.render();
await vi.waitFor(() => expect(api.get).toHaveBeenCalledWith(
  expect.stringContaining('type=document')
));
expect(page.element.querySelector('h1').textContent).toBe('Documentos');
```

Adicionar um teste de lista vazia que exige a mensagem `Nenhum documento encontrado neste caminho.`.

- [ ] **Step 2: Run the focused frontend test to verify it fails**

Run: `npm test -- StudyLibraryPage.test.js`

Expected: FAIL porque a página não aceita `contentMode` nem configura a URL/título.

- [ ] **Step 3: Implement route configuration without duplicar a página**

Adicionar um mapa interno:

```js
const CONTENT_MODES = {
  all: { title: 'Biblioteca de estudos', type: '', empty: 'Nenhum material encontrado neste caminho.' },
  video: { title: 'Videoaulas', type: 'video', empty: 'Nenhuma videoaula encontrada neste caminho.' },
  audio: { title: 'Áudios', type: 'audio', empty: 'Nenhum áudio encontrado neste caminho.' },
  document: { title: 'Documentos', type: 'document', empty: 'Nenhum documento encontrado neste caminho.' }
};
```

Fazer `load()` sempre enviar o tipo do modo, retirar os atalhos de tipo que permitiam misturar formatos e permitir apenas busca dentro da aba. Registrar em `main.js` as rotas `video`, `audio` e `documents` como fábricas de `StudyLibraryPage`; manter `study-library` como `all`.

- [ ] **Step 4: Run the focused frontend test to verify it passes**

Run: `npm test -- StudyLibraryPage.test.js`

Expected: PASS com URLs, títulos e mensagem vazia corretos.

- [ ] **Step 5: Commit**

```bash
git add src/pages/StudyLibraryPage.js src/main.js src/tests/StudyLibraryPage.test.js
git commit -m "feat: separar catálogo remoto por aba de conteúdo"
```

### Task 3: Sidebar sem Biblioteca local

**Files:**
- Modify: `src/components/Sidebar.js`
- Modify: `src/tests/AppShell.test.js`
- Modify: `src/tests/MediaPages.test.js`

**Interfaces:**
- Consumes: rotas `study-library`, `video`, `audio` e `documents`.
- Produces: navegação sem o item ou rota `library`; Videoaulas e Áudios apontam para o catálogo remoto configurado.

- [ ] **Step 1: Write the failing navigation tests**

Atualizar a expectativa de rotas e incluir:

```js
expect(routes).not.toContain('library');
expect(routes).toContain('documents');
expect(sidebar.textContent).not.toContain('Biblioteca local');
expect(sidebar.textContent).toContain('Documentos');
```

Substituir a expectativa de `LibraryPage` nas páginas de mídia por `StudyLibraryPage` ou por uma asserção de rota, sem remover testes de player que não dependem da seleção local.

- [ ] **Step 2: Run the affected frontend tests to verify they fail**

Run: `npm test -- AppShell.test.js MediaPages.test.js`

Expected: FAIL porque a sidebar e `main.js` ainda registram `library` e não possuem `documents`.

- [ ] **Step 3: Implement the menu and routing change**

Na sidebar, manter apenas `Videoaulas`, `Áudios`, `Biblioteca de estudos`, `Documentos` e `Flashcards` na seção Conteúdo. Em `main.js`, não criar `LibraryPage` nem `LocalLibraryService` para o shell e não registrar a rota `library`.

- [ ] **Step 4: Run the affected frontend tests to verify they pass**

Run: `npm test -- AppShell.test.js MediaPages.test.js`

Expected: PASS; nenhum teste de fluxo principal chama `showDirectoryPicker`.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.js src/main.js src/tests/AppShell.test.js src/tests/MediaPages.test.js
git commit -m "feat: remover biblioteca local da navegação"
```

### Task 4: Galeria compacta e grade hierárquica

**Files:**
- Modify: `src/pages/StudyLibraryPage.js`
- Modify: `src/assets/styles/components/study-library.css`
- Modify: `src/tests/StudyLibraryPage.test.js`

**Interfaces:**
- Consumes: `institution_sections` na raiz e `children` nos caminhos internos.
- Produces: trilhos horizontais compactos com setas e grades de cards de módulos/formações; não renderiza botão `Ver todos`.

- [ ] **Step 1: Write the failing interaction and structure tests**

Criar dados com duas instituições e trilhos diferentes. Verificar:

```js
expect(element.querySelector('.institution-gallery-all')).toBeNull();
expect(element.querySelectorAll('.institution-gallery-scroll')).toHaveLength(4);
expect(element.querySelectorAll('.study-library-folder')).toHaveLength(2);
```

Disparar clique na seta da primeira galeria com `scrollBy = vi.fn()` e verificar que somente o primeiro `.institution-gallery-rail` recebeu a chamada.

- [ ] **Step 2: Run the focused frontend test to verify it fails**

Run: `npm test -- StudyLibraryPage.test.js`

Expected: FAIL porque `Ver todos` ainda existe e a folha atual usa cards grandes e pastas flexíveis.

- [ ] **Step 3: Implement compactação e hierarquia visual**

Remover o botão `Ver todos`. Manter setas no cabeçalho da galeria e conservar o comportamento de `scrollBy` no trilho mais próximo. Trocar `.study-library-children` para uma grade responsiva e dar aos cards de filhos a mesma hierarquia tipográfica dos cards institucionais. Ajustar o trilho para `grid-auto-columns: minmax(12rem, 15.5rem)` e a capa para `height: clamp(13rem, 22vw, 19rem)`; preservar rolagem por toque e foco visível.

- [ ] **Step 4: Run the focused frontend test to verify it passes**

Run: `npm test -- StudyLibraryPage.test.js`

Expected: PASS com setas por galeria, sem botão alternativo e com cards filhos navegáveis.

- [ ] **Step 5: Run the complete verification**

Run: `npm test && npm run build && php backend/tests/study_catalog_test.php && php backend/tests/study_library_api_test.php`

Expected: todos os testes passam e o build gera os assets sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/pages/StudyLibraryPage.js src/assets/styles/components/study-library.css src/tests/StudyLibraryPage.test.js
git commit -m "feat: organizar catálogo em trilhos e módulos"
```

