# QA e autenticação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os achados reproduzidos no QA, priorizando proteção do login, sessão confiável e ausência de XSS, e concluir as rotas visíveis do menu do usuário.

**Architecture:** O PHP continuará com sessão opaca em cookie e SQLite, adicionando limitação persistente de tentativas e validação same-origin para mutações. O frontend normalizará o contrato do usuário, distinguirá falha de autenticação de falha operacional e renderizará dados externos como texto. Perfil, preferências e ajuda serão componentes reais registrados no shell.

**Tech Stack:** PHP 8.2, SQLite, JavaScript ES modules, Vitest/jsdom, Vite, Nginx.

**Spec:** `docs/superpowers/specs/2026-08-31-private-beta-auth-real-data-design.md`

## Global Constraints

- Cadastro público e recuperação automática de senha continuam desativados.
- A senha nunca é registrada, devolvida pela API ou incorporada a fixtures.
- As mutações aceitam apenas origem correspondente ao host da aplicação.
- Resposta `401` significa sessão anônima; falhas de rede e `5xx` mostram estado recuperável e não fingem logout.
- Dados do usuário e de busca devem ser inseridos como texto ou escapados antes de qualquer `innerHTML`.
- Nenhuma mudança toca a VPS, publica release ou altera o diretório `data/`.

## Review Focus

- Sexta tentativa inválida de login dentro da janela recebe `429`, mas sucesso posterior limpa o bloqueio do identificador.
- Requisição de mutação com `Origin` divergente recebe `403`; same-origin continua funcional.
- Falha `500` em `/auth/me` mostra opção de tentar novamente e não monta o login.
- Perfil com nome contendo marcação não cria elementos HTML na Sidebar ou Header.
- Logout que falha preserva o shell e comunica o erro; logout bem-sucedido retorna ao login.

---

### Task 1: Endurecer login, CORS e CSRF

**Files:**
- Create: `backend/database/migrations/005_login_attempts.sql`
- Create: `backend/middleware/csrf.php`
- Create: `backend/utils/LoginThrottle.php`
- Modify: `backend/api/index.php`, `backend/controllers/AuthController.php`, `backend/config/cors.php`
- Modify: `backend/tests/route_request.php`, `backend/tests/private_beta_test.php`

**Interfaces:**
- Produces: `LoginThrottle::assertAllowed(string $key): void`, `recordFailure(string $key): void`, `clear(string $key): void`, `Csrf::enforce(): void`.

- [ ] Add backend tests that issue real route requests and assert five invalid logins remain `401`, the sixth is `429`, valid login clears failures, cross-origin mutation is `403`, and same-origin mutation is routed normally.
- [ ] Run `php backend/tests/private_beta_test.php` and observe the new assertions fail for missing throttling/CSRF.
- [ ] Add the migration, throttle utility and CSRF middleware; load environment before CORS and apply CSRF after preflight handling.
- [ ] Run `php backend/tests/private_beta_test.php` and `php backend/tests/lint_test.php` until both pass.

### Task 2: Tornar contrato de sessão e usuário consistente

**Files:**
- Modify: `backend/controllers/AuthController.php`, `backend/api/index.php`
- Modify: `src/bootstrapAuth.js`, `src/utils/api.js`, `src/components/AppShell.js`, `src/components/Sidebar.js`
- Modify: `src/tests/privateBetaBootstrap.test.js`, `src/tests/AppShell.test.js`, `src/tests/Sidebar.test.js`

**Interfaces:**
- Produces: perfil com `best_streak` e `xp_max`; bootstrap com estados `authenticated`, `anonymous`, `unavailable`; logout só desmonta após resposta bem-sucedida.

- [ ] Add tests for `xp_max`, unavailable bootstrap with retry, and failed/successful logout behavior.
- [ ] Run the focused Vitest files and confirm each new test fails against current behavior.
- [ ] Normalize both login and `/me` through one backend profile serializer, calculate the next-level XP floor, add retry UI, and make logout failure visible without destroying state.
- [ ] Run focused tests, then `npm test`.

### Task 3: Neutralizar conteúdo dinâmico em HTML

**Files:**
- Create: `src/utils/html.js`, `src/tests/htmlSafety.test.js`
- Modify: `src/components/Sidebar.js`, `src/components/Header.js`, `src/components/AppShell.js`

**Interfaces:**
- Produces: `escapeHtml(value): string` and safe highlighted search output.

- [ ] Add tests using `<img onerror>` in user names, route errors and search results; assert no injected element exists and text remains visible.
- [ ] Run `npm test -- src/tests/htmlSafety.test.js` and observe injection in current components.
- [ ] Escape every dynamic value used by these components before template insertion; keep static icon markup unchanged.
- [ ] Run the focused test and full frontend suite.

### Task 4: Implementar Perfil, Preferências e Ajuda

**Files:**
- Create: `src/pages/ProfilePage.js`, `src/pages/SettingsPage.js`, `src/pages/HelpPage.js`
- Create: `src/tests/UserPages.test.js`
- Modify: `src/main.js`, `src/components/AppShell.js`, `src/components/Header.js`, `src/assets/styles/pages.css`
- Modify: `backend/api/index.php`, `backend/controllers/AuthController.php`, `backend/tests/private_beta_test.php`

**Interfaces:**
- Consumes: `PUT /api/auth/profile {name}`.
- Produces: routes `profile`, `settings`, `help`; profile updates the shell user; preferences persist theme locally; help documents beta privada and keyboard shortcuts.

- [ ] Add frontend tests for all three pages and a backend route test that updates only the authenticated user's name.
- [ ] Run focused tests and observe missing pages/routes fail.
- [ ] Register the profile endpoint and pages, wire header settings/notifications actions, and add scoped responsive styles.
- [ ] Run frontend/backend focused tests and the full suites.

### Task 5: Consolidar configuração e validar o produto

**Files:**
- Modify: `deploy/nginx.conf`, `deploy/estudos.bssaude.com.br.conf`, `docs/DEPLOY_VPS.md`, `docs/ESTRUTURA.md`
- Delete: `bsenem.conf`

**Interfaces:**
- Produces: uma única configuração externa documentada e headers de segurança emitidos apenas no proxy TLS.

- [ ] Remove the undocumented legacy virtual host and document the canonical outer and inner Nginx files.
- [ ] Add CSP/frame/content/referrer headers to the TLS proxy without duplicating them in the container.
- [ ] Run `nginx -t` when available; otherwise perform an explicit syntax/static review and report that live Nginx validation remains deployment-side.
- [ ] Run `npm test`, `npm run test:backend`, `php backend/tests/private_beta_test.php`, `npm run lint:php`, `npm run build`, and `git diff --check`.

