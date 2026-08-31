# Beta privada: autenticação e dados reais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar uma beta privada em que somente usuários provisionados manualmente possam entrar e toda tela mostre dados persistidos ou estado vazio, sem conteúdo demonstrativo.

**Architecture:** A fonte atualmente publicada na worktree será reconciliada com a branch de entrega antes de qualquer mudança funcional. O PHP usará migrações SQLite idempotentes e sessões opacas, revogáveis e persistidas, entregues em cookie seguro. O frontend fará bootstrap de sessão antes do `AppShell`, consumirá APIs reais e manterá somente a Biblioteca de mídia no IndexedDB, com namespace por usuário.

**Tech Stack:** Vite 5, JavaScript ES modules, Vitest + jsdom + Playwright, PHP 8.2, SQLite, Nginx/Docker Compose na VPS.

**Spec:** `docs/superpowers/specs/2026-08-31-private-beta-auth-real-data-design.md`

## Global Constraints

- Não gravar, repetir, testar, commitar ou passar em argumento de processo qualquer senha, token, chave ou arquivo SQLite de produção.
- Cadastro, convite, autoaprovação, painel administrativo, reset de senha por e-mail e upload de mídia estão fora de escopo.
- Nenhum endpoint protegido aceita `user_id` do navegador; a identidade vem exclusivamente de `Auth::requireAuth()`.
- Todos os testes mutáveis usam `APP_DB_PATH` apontando para arquivo temporário; nunca para `backend/database/bsenem.db` nem para a VPS.
- A Biblioteca local guarda handles e catálogo somente no navegador, em chave derivada de `user.id`; nenhum caminho do computador segue para a API.
- Não apagar banco da VPS sem cópia datada verificada, contagem exibida e confirmação explícita no comando de limpeza.
- Executar `npm test`, `npm run test:backend`, `npm run lint:php`, `npm run build` e o teste Playwright descrito no Task 6 antes de publicar.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `package.json`, `package-lock.json`, `vite.config.js` | Toolchain reproduzível que já foi usada para o release atual. |
| `backend/config/database.php` | Abre SQLite a partir de `APP_DB_PATH` e aplica migrações uma única vez. |
| `backend/database/Migrator.php` | Executa arquivos SQL ordenados em transação e registra versão em `schema_migrations`. |
| `backend/database/migrations/001_initial_schema.sql` | Estrutura canônica sem inserts de demonstração. |
| `backend/database/migrations/002_private_beta_sessions.sql` | Tabela e índice de sessões opacas. |
| `backend/middleware/auth.php` | Cria, lê e revoga sessão por cookie; mantém guardas de autorização. |
| `backend/controllers/AuthController.php` | Login, sessão atual, logout e bloqueio explícito das rotas públicas desativadas. |
| `backend/api/index.php` | Mapeia somente os endpoints autorizados e logout. |
| `backend/cli/provision-user.php` | Cria usuário manual por terminal, sem senha em argumentos. |
| `backend/cli/clear-demo-data.php` | Mostra contagens e só remove dados de teste com confirmação literal. |
| `backend/tests/private_beta_test.php` | Teste PHP com banco temporário para migrações, senha, sessões e isolamento. |
| `src/utils/api.js` | Cliente same-origin baseado em cookies, sem token no navegador. |
| `src/bootstrapAuth.js` | Decide entre LoginPage e AppShell a partir de `/auth/me`. |
| `src/main.js` | Monta bootstrap, rotas privadas e Biblioteca local sem usuário ou matérias fictícias. |
| `src/pages/LoginPage.js` | Interface de login privado, sem cadastro/reset/Turnstile simulado. |
| `src/components/AppShell.js`, `Header.js`, `Sidebar.js` | Perfil obrigatório, logout e busca sem resultados inventados. |
| `src/pages/DashboardPage.js`, `FlashcardsPage.js`, `ExamsPage.js`, `VideoPage.js`, `AudioPage.js` | Dados reais/estado vazio; mídia apenas da Biblioteca local. |
| `src/services/LocalLibraryService.js`, `src/utils/idb.js` | Catálogo IndexedDB separado por conta autenticada. |
| `src/tests/privateBeta*.test.js`, `e2e/private-beta.spec.js` | Regressões de frontend e fluxo no navegador. |

## Task 1: Reconciliar a fonte publicada e travar o ponto de partida

**Files:**
- Modify: `package.json`, `package-lock.json`, `vite.config.js`
- Modify: `src/main.js`, `src/components/AppShell.js`, `src/pages/LibraryPage.js`, `src/services/LocalLibraryService.js`, `src/services/localMediaSession.js`, `src/utils/idb.js`
- Create/Modify: os testes de Biblioteca já presentes em `src/tests/`
- Delete from delivery branch: nenhuma mudança não relacionada; não levar `.superpowers/` da worktree.

**Interfaces:**
- Consumes: commits `5b566b4`, `bf19f18`, `149d255`, `0227cbe`, `0f3f63b`, `fec79ba`, `fc4a3c1`, `abc81be` e `a2364fe` da worktree `codex/local-study-library`.
- Produces: uma única branch de entrega que possui `package.json`, lockfile, testes Vite e o mesmo comportamento da Biblioteca que está em produção.

- [ ] **Step 1: Registrar o baseline antes de alterar código**

Run:

```powershell
git status --short --branch
git log --oneline -8
git worktree list
git -C .worktrees/local-study-library status --short --branch
```

Expected: `main` não possui alterações pendentes; apenas `.superpowers/` pode estar não rastreado na worktree e não será incluído.

- [ ] **Step 2: Trazer somente os commits publicados para a branch de entrega**

Run:

```powershell
git cherry-pick 5b566b4 bf19f18 149d255 0227cbe 0f3f63b fec79ba fc4a3c1 abc81be a2364fe
git status --short
```

Expected: `package.json` e `package-lock.json` existem na raiz, `src/pages/LibraryPage.js` existe e `.superpowers/` não aparece como arquivo rastreado. Se houver conflito, parar, preservar ambos os lados e resolver apenas a linha em conflito antes de continuar; não usar `reset --hard`.

- [ ] **Step 3: Rodar o teste que protege a Biblioteca antes do trabalho de autenticação**

Run:

```powershell
npm test -- src/tests/LocalLibraryService.test.js src/tests/LibraryPage.test.js src/tests/localMediaSession.test.js src/tests/AppShell.test.js
npm run build
```

Expected: todos os testes passam e Vite produz `dist/`.

- [ ] **Step 4: Commit do baseline reproduzível**

Run:

```powershell
git add package.json package-lock.json vite.config.js src backend deploy
git commit -m "build: reconcile published local library source"
```

Expected: commit contém somente arquivos que já compõem o release publicado e nenhuma credencial, banco, `dist/` ou `.superpowers/`.

## Task 2: Criar migrações seguras, banco temporário e ferramentas manuais

**Files:**
- Create: `backend/database/Migrator.php`
- Create: `backend/database/migrations/001_initial_schema.sql`
- Create: `backend/database/migrations/002_private_beta_sessions.sql`
- Create: `backend/cli/provision-user.php`
- Create: `backend/cli/clear-demo-data.php`
- Modify: `backend/config/database.php`, `backend/database/schema.sql`, `.env.example`, `backend/tests/private_beta_test.php`

**Interfaces:**
- Consumes: `APP_DB_PATH` opcional e `APP_ENV` (`production` ou `test`).
- Produces: `Database::getInstance(): Database`, `Migrator::migrate(PDO $pdo): void`, um banco com `schema_migrations` e `auth_sessions`, e CLIs que nunca recebem senha por argumento.

- [ ] **Step 1: Escrever os testes que isolam o banco e bloqueiam seed**

Create `backend/tests/private_beta_test.php` com helper temporário e asserções abaixo:

```php
$path = tempnam(sys_get_temp_dir(), 'bsenem-test-');
putenv('APP_ENV=test');
putenv("APP_DB_PATH={$path}");
Database::resetForTests();
initializeDatabase();
$pdo = Database::getInstance()->getConnection();

expectSame(0, (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn());
expectSame(0, (int) $pdo->query('SELECT COUNT(*) FROM flashcards')->fetchColumn());
expectSame(2, (int) $pdo->query('SELECT COUNT(*) FROM schema_migrations')->fetchColumn());
expectTrue((bool) $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='auth_sessions'")->fetchColumn());
```

Add a second `initializeDatabase()` call and assert that the migration count stays `2`; then remove `$path` in `finally`.

- [ ] **Step 2: Executar o novo teste e confirmar que ele falha no código atual**

Run:

```powershell
php backend/tests/private_beta_test.php
```

Expected: FAIL porque `APP_DB_PATH`, `resetForTests`, `schema_migrations` e `auth_sessions` ainda não existem.

- [ ] **Step 3: Implementar o executor de migrações**

Create `backend/database/Migrator.php`:

```php
final class Migrator {
    public static function migrate(PDO $pdo): void {
        $pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
        foreach (glob(__DIR__ . '/migrations/*.sql') as $file) {
            $version = basename($file);
            $seen = $pdo->prepare('SELECT 1 FROM schema_migrations WHERE version = ?');
            $seen->execute([$version]);
            if ($seen->fetchColumn()) continue;
            $pdo->beginTransaction();
            try {
                $pdo->exec(file_get_contents($file));
                $pdo->prepare('INSERT INTO schema_migrations (version) VALUES (?)')->execute([$version]);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
        }
    }
}
```

Move apenas DDL atual, corrigido, para `001_initial_schema.sql`; não incluir `INSERT`, `reset_token` em tabelas de conteúdo, `total_questions` ausente de `exam_attempts` ou `exam_answers` ausente do schema. Criar `002_private_beta_sessions.sql` com:

```sql
CREATE TABLE auth_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_auth_sessions_user_expires ON auth_sessions(user_id, expires_at);
```

Update `Database` para usar `getenv('APP_DB_PATH') ?: __DIR__ . '/../database/bsenem.db'`, habilitar foreign keys, chamar `Migrator::migrate()`, e fornecer `resetForTests()` que só funciona quando `APP_ENV === 'test'`.

- [ ] **Step 4: Implementar provisionamento e limpeza com confirmação**

`provision-user.php` deve exigir exatamente um argumento não secreto (`email`), obter nome e senha via `STDIN`, validar e-mail e senha de 12+ caracteres, usar `PASSWORD_ARGON2ID` quando definido e recusar duplicidade. O formato de chamada será:

```powershell
php backend/cli/provision-user.php usuario@dominio.com
```

`clear-demo-data.php` deve mostrar `COUNT(*)` de cada tabela de conteúdo e de `users`, recusar qualquer chamada sem `--confirm=DELETE_DEMO_DATA`, e dentro de uma transação apagar, nesta ordem, `auth_sessions`, `exam_attempts`, `questions`, `exams`, `flashcards`, `notes`, `study_sessions`, `activity_log`, `user_achievements`, `resources`, `users`, `achievements`, `subjects`. Não deve tocar no banco se a confirmação divergir.

`schema.sql` deixa de ser executável pela aplicação; substituí-lo por comentário que aponta para as migrações. `.env.example` documenta somente `APP_DB_PATH=` sem valores de produção.

- [ ] **Step 5: Executar os testes de banco e lint**

Run:

```powershell
php backend/tests/private_beta_test.php
php backend/tests/lint_test.php
```

Expected: PASS; reexecutar migrações não cria duplicatas, e banco novo começa sem usuários/conteúdo.

- [ ] **Step 6: Commit da fundação de dados**

Run:

```powershell
git add backend/config/database.php backend/database backend/cli .env.example backend/tests
git commit -m "feat: add private beta database migrations"
```

## Task 3: Substituir tokens persistentes por sessões revogáveis

**Files:**
- Modify: `backend/middleware/auth.php`, `backend/controllers/AuthController.php`, `backend/api/index.php`, `backend/config/cors.php`
- Modify: `backend/tests/auth_test.php`, `backend/tests/private_beta_test.php`

**Interfaces:**
- Consumes: `auth_sessions(user_id, token_hash, expires_at)` e cookie `bsenem_session`.
- Produces: `Auth::createSession(int $userId): string`, `Auth::getUserId(): ?int`, `Auth::revokeCurrentSession(): void`, `Auth::setSessionCookie(string $token): void`, `Auth::clearSessionCookie(): void`.

- [ ] **Step 1: Acrescentar testes de sessão e das rotas privadas**

Extend `private_beta_test.php` com casos diretos que verificam:

```php
$token = Auth::createSession($firstUserId);
expectSame($firstUserId, Auth::findUserIdByToken($token));
expectSame(null, Auth::findUserIdByToken($token . 'x'));
Auth::revokeToken($token);
expectSame(null, Auth::findUserIdByToken($token));
```

Inserir cartão do usuário A e chamar os métodos `show`, `update` e `destroy` do controlador como usuário B; cada um deve resultar em `404`, sem modificar o cartão A. Testar também `AuthController::register()`, `forgotPassword()` e `resetPassword()` por rota HTTP no servidor temporário: todos retornam `403` e nenhum usuário, token de reset ou chamada a `Resend` é criado.

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run:

```powershell
php backend/tests/private_beta_test.php
```

Expected: FAIL porque o código atual cria JWT-like token, lê `Authorization` e ainda permite registro/reset.

- [ ] **Step 3: Implementar sessão opaca e cookie**

Em `auth.php`, gerar `bin2hex(random_bytes(32))`, gravar somente `hash('sha256', $token)`, e usar query com expiração:

```php
SELECT user_id FROM auth_sessions
WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP
```

Ler `$_COOKIE['bsenem_session']`; não ler `Authorization`. Para login, usar `password_verify()` e chamar:

```php
setcookie('bsenem_session', $token, [
  'expires' => time() + 604800,
  'path' => '/',
  'secure' => APP_ENV === 'production',
  'httponly' => true,
  'samesite' => 'Lax',
]);
```

Logout apaga a hash da sessão corrente e envia cookie expirado com os mesmos atributos. `register`, `forgotPassword` e `resetPassword` respondem `Response::error('Acesso disponível somente para usuários aprovados.', 403)`. Remover inclusões e usos de `Turnstile.php` e `Resend.php` do fluxo de autenticação; os arquivos podem permanecer sem serem chamados por nenhum endpoint.

Adicionar no roteador `POST /auth/logout` e manter `GET /auth/me`. No CORS, permitir apenas a origem configurada do próprio domínio, `GET, POST, PUT, DELETE, OPTIONS`, `Content-Type` e `credentials`; não usar `*` com credenciais.

- [ ] **Step 4: Atualizar teste de autenticação existente**

Replace em `backend/tests/auth_test.php` o teste do segredo JWT por teste de token opaco:

```php
$token = Auth::createSession(7);
expectTrue(strlen($token) === 64, 'Session token is opaque');
expectTrue(Auth::findUserIdByToken($token) === 7, 'Stored session resolves user');
expectTrue(Auth::findUserIdByToken($token . 'x') === null, 'Changed session is rejected');
```

- [ ] **Step 5: Verificar backend completo**

Run:

```powershell
php backend/tests/auth_test.php
php backend/tests/private_beta_test.php
php backend/tests/lint_test.php
```

Expected: PASS; não há rota que crie usuário sem a CLI.

- [ ] **Step 6: Commit da autenticação**

Run:

```powershell
git add backend/middleware/auth.php backend/controllers/AuthController.php backend/api/index.php backend/config/cors.php backend/tests
git commit -m "feat: enforce private beta sessions"
```

## Task 4: Fazer o frontend iniciar com sessão real e remover o cadastro público

**Files:**
- Create: `src/bootstrapAuth.js`, `src/tests/privateBetaBootstrap.test.js`, `src/tests/LoginPage.test.js`
- Modify: `src/main.js`, `src/utils/api.js`, `src/pages/LoginPage.js`, `src/components/AppShell.js`, `src/components/Header.js`, `src/components/Sidebar.js`, `src/tests/AppShell.test.js`

**Interfaces:**
- Consumes: `api.get('/auth/me') -> { success, data: { user } }`, `api.post('/auth/login', { email, password })`, `api.post('/auth/logout')`.
- Produces: `bootstrapAuth({ mount, createShell, createLogin }): Promise<{ state: 'authenticated' | 'anonymous' }>` e `api.request()` sempre com `credentials: 'same-origin'`.

- [ ] **Step 1: Escrever testes de bootstrap e login antes da implementação**

Create `privateBetaBootstrap.test.js` with:

```js
it('mounts LoginPage when /auth/me returns 401', async () => {
  api.get = vi.fn().mockResolvedValue({ success: false, status: 401 });
  await bootstrapAuth(deps);
  expect(deps.createLogin).toHaveBeenCalledOnce();
  expect(deps.createShell).not.toHaveBeenCalled();
});

it('mounts AppShell only with the returned user', async () => {
  api.get = vi.fn().mockResolvedValue({ success: true, data: { user: { id: 9, name: 'Teste', email: 'teste@exemplo.com', level: 1, xp: 0, streak: 0 } } });
  await bootstrapAuth(deps);
  expect(deps.createShell).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: 9 }) }));
});
```

In `LoginPage.test.js`, assert that the rendered DOM contains e-mail, senha, entrar and the controlled-access copy, and does not contain `Registre-se`, `Esqueci minha senha`, `turnstile` or a script whose URL contains `challenges.cloudflare.com`.

- [ ] **Step 2: Run the frontend tests and confirm failure**

Run:

```powershell
npm test -- src/tests/privateBetaBootstrap.test.js src/tests/LoginPage.test.js src/tests/AppShell.test.js
```

Expected: FAIL because `main.js` currently instantiates a fake user and `LoginPage` exposes four modes.

- [ ] **Step 3: Implement client and bootstrap**

Implement `api.request()` as:

```js
const response = await fetch(endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`, {
  ...options,
  credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json', ...options.headers },
});
const payload = await response.json().catch(() => ({}));
return { ...payload, status: response.status };
```

Delete all use of `localStorage.token` and `Authorization`. `bootstrapAuth` mounts a lone `LoginPage` for `401` or unauthenticated result; login success destroys it and remounts a freshly constructed shell. `main.js` must supply no hardcoded user or subjects. It registers the actual routes only inside the authenticated factory and calls `libraryService.setUser(user.id)` before a Library route can query IndexedDB.

Reduce `LoginPage` to mode `login`; retain neutral invalid-login error text, submit disable/re-enable behavior and no script injection. Make `AppShell` require `options.user.id`; remove fallback `Estudante`, fake search results and `window.bsApp` debug exposure. Its logout action awaits the API, calls `destroy()` on route/components, clears the app mount and invokes bootstrap's anonymous callback. `Header` and `Sidebar` accept the real profile rather than manufacturing one.

- [ ] **Step 4: Execute focused frontend tests**

Run:

```powershell
npm test -- src/tests/privateBetaBootstrap.test.js src/tests/LoginPage.test.js src/tests/AppShell.test.js
```

Expected: PASS; anonymous visitors never receive an AppShell and no user placeholder is rendered.

- [ ] **Step 5: Commit the private entry flow**

Run:

```powershell
git add src/main.js src/bootstrapAuth.js src/utils/api.js src/pages/LoginPage.js src/components/AppShell.js src/components/Header.js src/components/Sidebar.js src/tests
git commit -m "feat: bootstrap private authenticated sessions"
```

## Task 5: Trocar todas as telas demonstrativas por dados reais ou estado vazio

**Files:**
- Modify: `src/pages/DashboardPage.js`, `src/pages/FlashcardsPage.js`, `src/pages/ExamsPage.js`, `src/pages/VideoPage.js`, `src/pages/AudioPage.js`
- Modify: `src/components/AppShell.js`, `src/services/LocalLibraryService.js`, `src/utils/idb.js`
- Create: `src/tests/privateBetaPages.test.js`, `src/tests/LocalLibraryUserScope.test.js`
- Modify: `backend/controllers/ProgressController.php`, `backend/controllers/ExamController.php`, `backend/api/index.php`, `backend/tests/private_beta_test.php`

**Interfaces:**
- Consumes: `/progress/dashboard`, `/progress/heatmap`, `/flashcards`, and user-scoped IndexedDB catalog.
- Produces: páginas que não possuem arrays de exemplo, `Math.random()` de estatística, `localStorage` de resultados, mídia externa ou perguntas geradas no navegador.

- [ ] **Step 1: Escrever testes de estado vazio e isolamento local**

Create `privateBetaPages.test.js` with these cases:

```js
it('renders dashboard zeros from an empty API response without random statistics', async () => {
  api.get = vi.fn().mockResolvedValue({ success: true, data: emptyDashboard });
  const page = new DashboardPage({ user: emptyUser });
  await page.render();
  expect(page.element.textContent).toContain('0');
  expect(page.element.textContent).not.toMatch(/João Silva|Estudante/);
});

it('renders no flashcards and no exams when their real collections are empty', async () => {
  expect((await new FlashcardsPage({ subjects: [] }).render()).textContent).toContain('Nenhum flashcard');
  expect(new ExamsPage({ subjects: [] }).render().textContent).toContain('Nenhum simulado disponível');
});
```

Create `LocalLibraryUserScope.test.js`: set a catalog as user `1`, switch to user `2`, assert list is empty, switch back to `1`, assert original catalog remains. Assert `JSON.stringify(catalog)` has no absolute drive path and API mocks are never called.

- [ ] **Step 2: Execute the page tests and confirm failure**

Run:

```powershell
npm test -- src/tests/privateBetaPages.test.js src/tests/LocalLibraryUserScope.test.js
```

Expected: FAIL because dashboard calls `Math.random`, flashcards call `initSampleCards`, exams construct questions, and the local catalog has no account scope.

- [ ] **Step 3: Implement real data rendering**

`DashboardPage` awaits both progress endpoints before rendering/updating cards. Map `dashboardData.flashcards.total_reviews`, `dashboardData.flashcards.correct_reviews`, `dashboardData.total_study_minutes`, `dashboardData.today`, and heatmap values directly; accuracy is `0` if `total_reviews === 0`, otherwise rounded `correct_reviews / total_reviews * 100`. Delete `recordActivity`, `bsenem_activity` and all random values.

`FlashcardsPage` stops importing `srsEngine` for persisted study data. Load `GET /flashcards?per_page=100`, map response items to the existing manager/review components, call `POST /flashcards`, `PUT /flashcards/:id`, `DELETE /flashcards/:id` and `POST /flashcards/:id/review` for mutations, then refetch. Render `Nenhum flashcard ainda. Crie o primeiro para começar.` when collection is empty.

`ExamsPage` initializes `this.exams = []` and `this.results = []`; remove `generateSampleQuestions`, `loadResults`, `saveResults`, retry/review paths that rely on client-created questions, and all `localStorage` exam keys. It renders its existing empty markup. Do not expose a start button unless an exam came from a future real endpoint.

`VideoPage` and `AudioPage` consume only `app.consumeLocalResource('video'|'audio')`; without a selected local resource, render an empty-state link/button that navigates to `library`. Delete every external `src` URL and demo playlist item.

`LocalLibraryService.setUser(userId)` must select database name/key `bsenem-local-library-v2:${userId}` and reject `undefined`, `null`, empty string or nonpositive identifiers. `clear()` and all catalog reads/writes use that scoped key.

`AppShell.handleSearch()` searches the active local catalog and real loaded data only, returning `[]` when neither yields a match. Remove mock search titles. Ensure `ProgressController::recordStudy()` validates `subject_id` belongs to an existing `subjects` row before insertion; no controller inserts seed subjects or achievements. Do not add an exams list endpoint in this plan because no real exam authoring source exists.

- [ ] **Step 4: Prove database cleanup is explicit and reversible**

Extend `private_beta_test.php` to seed records only into its temporary database, run `clear-demo-data.php` first without `--confirm=DELETE_DEMO_DATA` and assert no count changed; run it with the literal confirmation and assert all listed content/user tables contain zero rows. The test must never mention a production path.

- [ ] **Step 5: Run focused and full validation**

Run:

```powershell
npm test -- src/tests/privateBetaPages.test.js src/tests/LocalLibraryUserScope.test.js src/tests/LocalLibraryService.test.js src/tests/LibraryPage.test.js src/tests/MediaPages.test.js
php backend/tests/private_beta_test.php
```

Expected: PASS; neither source nor rendered output contains fake identities, sample questions, external media hosts, `bsenem_exam_results`, `bsenem_activity`, mock search objects or automatic flashcard seeding.

- [ ] **Step 6: Commit real-data pages**

Run:

```powershell
git add src/pages src/components/AppShell.js src/services/LocalLibraryService.js src/utils/idb.js backend/controllers/ProgressController.php backend/controllers/ExamController.php backend/api/index.php backend/tests src/tests
git commit -m "feat: replace demo study data with real states"
```

## Task 6: Verificar, publicar com rollback e provisionar a conta controlada

**Files:**
- Create: `e2e/private-beta.spec.js`
- Modify: `package.json`, `README.md`, `deploy/docker-compose.yml`, `deploy/nginx.conf`
- Do not commit: arquivos de banco, backups, credenciais, arquivos `.env` de produção, artefatos `dist/` ou logs de deploy.

**Interfaces:**
- Consumes: release compilado, volume SQLite da VPS e CLI de provisionamento.
- Produces: evidência reproduzível de beta privada em `https://estudos.bssaude.com.br` e symlink de rollback preservado.

- [ ] **Step 1: Escrever cenário Playwright privado**

Create `e2e/private-beta.spec.js` with the flow below; credentials come from environment injected only at test execution and are never printed:

```js
test('private beta rejects public registration and revokes logout', async ({ page }) => {
  await page.goto(process.env.E2E_BASE_URL);
  await expect(page.getByRole('heading', { name: 'BS Estudos' })).toBeVisible();
  await expect(page.getByText('Registre-se')).toHaveCount(0);
  await page.getByLabel('E-mail').fill(process.env.E2E_EMAIL);
  await page.getByLabel('Senha').fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: /sair/i }).click();
  await expect(page.getByRole('heading', { name: 'BS Estudos' })).toBeVisible();
});
```

Add a direct API request using Playwright `request` to `POST /api/auth/register` and assert status `403`; do not send a password in source or report output.

- [ ] **Step 2: Execute all local quality gates**

Run:

```powershell
npm test
npm run test:backend
npm run lint:php
npm run build
npx playwright test e2e/private-beta.spec.js --list
```

Expected: all tests pass; `--list` finds the private-beta test without exposing environment values. Run the live browser test only after provision in Step 5.

- [ ] **Step 3: Create the release archive and inspect it**

Run:

```powershell
tar -czf "$env:TEMP\bsenem-private-beta.tar.gz" -C dist .
tar -tzf "$env:TEMP\bsenem-private-beta.tar.gz"
```

Expected: archive contains static frontend only; it does not contain `.env`, `bsenem.db`, source passwords or files from the local study folder.

- [ ] **Step 4: Backup and migrate VPS database before data deletion**

On the VPS, first resolve the real API container volume and database path with read-only `docker compose ps`, `docker inspect` and `ls -l`. Copy the exact SQLite file to a timestamped backup outside the release directory, run `sqlite3 <backup> 'PRAGMA integrity_check;'`, record row counts, then run the migration command once. Do not proceed if the integrity check is not `ok` or if the database path cannot be resolved.

Only after that, run inside the API container:

```sh
php /var/www/bsenem/backend/cli/clear-demo-data.php --confirm=DELETE_DEMO_DATA
```

Expected: script reports zero or more deleted demo rows and exits zero. Keep the backup path and current release symlink available for rollback; never transmit either in Git.

- [ ] **Step 5: Provision the authorized account without recording its password**

Open an interactive terminal in the API container and run the CLI with the approved e-mail only. Enter the name and user-provided password only when prompted; disable terminal echo for the password input if the CLI requires it. Verify with `GET /api/auth/me` after browser login, never by printing database hashes or tokens.

- [ ] **Step 6: Switch release and perform production acceptance test**

Upload the archive into a new immutable release directory, extract it, assert `index.html` exists, change the `current` symlink to the new release using a relative target, restart only the frontend container, then test:

```sh
curl -fsSI https://estudos.bssaude.com.br
curl -sS -o /dev/null -w '%{http_code}' https://estudos.bssaude.com.br/api/auth/me
```

Expected: first command is `200`; second is `401` without a cookie. Run Playwright against the live URL with short-lived environment variables for the authorized account. Verify login, dashboard zeros, local library selection, logout and registration `403`.

- [ ] **Step 7: Roll back on any failed check, otherwise commit deploy documentation**

If deployment validation fails, point `current` back to the prior relative release and restart frontend; if database migration/cleanup caused the failure, stop API writes and restore the verified SQLite backup before retesting the old release. If every check passes:

```powershell
git add package.json README.md deploy/nginx.conf deploy/docker-compose.yml e2e/private-beta.spec.js
git commit -m "test: verify private beta release flow"
git status --short --branch
```

Expected: branch clean except intentionally ignored build artifacts; no secret, DB file or backup is staged.

## Plan self-review

- **Spec coverage:** Task 1 reconciles the published source; Task 2 removes automatic seed execution and creates controlled data tooling; Task 3 supplies revocable private sessions; Task 4 gates the app at login; Task 5 eliminates every audited demo surface and scopes local media; Task 6 verifies and deploys with backup and rollback.
- **Placeholder scan:** no task refers to an unspecified future implementation or vague error handling; endpoints, table names, cookie attributes, confirmation literal and validation commands are explicit.
- **Interface consistency:** backend emits cookie sessions used by `api.js` through `credentials: 'same-origin'`; bootstrap consumes `/auth/me`; `AppShell` receives only that real profile; `LocalLibraryService.setUser(user.id)` isolates the local catalog.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-31-private-beta-auth-real-data.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, with checkpoints for review.

Which approach?
