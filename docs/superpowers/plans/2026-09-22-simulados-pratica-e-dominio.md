# Simulados: prática orientada e mapa de domínio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Entregar simulados autenticados e persistentes com prática curta, mapa de domínio explicável e retomada confiável, sem depender da Biblioteca local.

**Architecture:** O acervo ENEM em enem_questions é a fonte inicial de questões publicadas. O servidor cria composições imutáveis, persiste rascunhos idempotentes e calcula overview, recomendação e resultado no escopo do usuário autenticado. O cliente consome view models remotos: a home prioriza a prática curta, o player salva progresso e a tela de resultado apresenta cálculo confirmado pelo servidor.

**Tech Stack:** PHP 8.2, SQLite/PDO e migrações; JavaScript ES modules; Vite; Vitest + jsdom; CSS existente, sem dependências novas.

**Spec:** docs/superpowers/specs/2026-09-22-simulados-pratica-e-dominio-design.md e docs/superpowers/specs/2026-09-21-permanent-custom-simulators-design.md

## Global Constraints

- Trabalhar em worktree limpo; data/ não rastreado do checkout atual nunca entra em git add, testes de migração ou commits.
- Simulados não usa showDirectoryPicker, LocalLibraryService, JSON local ou caminhos de arquivo como fonte de questões, métricas ou rascunhos.
- Só enem_questions.status = 'valid' com gabarito A–E podem entrar em uma sessão.
- area é a matéria disponível no acervo inicial. topic é opcional: sua ausência obriga API e UI a operar por matéria, sem inferência do enunciado.
- Todo endpoint usa Auth::requireAuth(); user_id recebido do cliente é ignorado e sessão alheia responde 404.
- Sessão concluída é imutável. complete é idempotente; respostas, marcações, posição e tempo mudam somente quando status = active.
- O mapa usa no máximo as últimas 30 respostas concluídas em 90 dias; só classifica com cinco ou mais respostas na matéria/tópico.
- Sem IA, telemetria externa, previsão de nota, ranking, dependências novas, conteúdo local ou fallback com dados inventados.
- Testes PHP mutáveis definem APP_ENV=test, criam APP_DB_PATH novo e removem DB, WAL e SHM no finally.
- Não publicar, implantar, migrar VPS nem acessar dados reais.

## Review Focus

- Questão pendente, anulada ou sem A–E não entra em composição, mesmo quando o cliente cita seu ID; testar Task 1.
- Menos de cinco respostas não vira porcentagem/recomendação; testar Task 3.
- Repetir complete devolve o mesmo resultado, sem duplicar dados; testar Task 4.
- PATCH progress por outra conta retorna 404 e deixa o rascunho intacto; testar Task 4.
- Falha ao atualizar overview não apaga dados já visíveis ou os troca por zero; testar Task 5.

## File Structure

| File | Responsibility |
| --- | --- |
| backend/database/migrations/007_simulator_sessions.sql | Tópico opcional no acervo; sessão, composição, respostas e índices. |
| backend/utils/PublishedQuestionRepository.php | Matérias disponíveis e seleção de questões válidas/distintas. |
| backend/utils/SimulatorSessionRepository.php | Criação, consulta, rascunho e conclusão no escopo do usuário. |
| backend/utils/SimulatorRecommendation.php | Regras puras de mapa/recomendação/fallback. |
| backend/controllers/SimulatorController.php | Validação e serialização da API autenticada. |
| backend/tests/*simulator*_test.php | Migração, regras, ciclo de vida, API e autorização com SQLite descartável. |
| src/services/SimulatorApiService.js | Cliente de catálogo, overview, sessão, progresso e conclusão. |
| src/services/simulatorViewModel.js | Decisões puras de home, mensagens e estados. |
| src/pages/ExamsPage.js | Home remota, abertura de sessão e coordenação do player. |
| src/components/ExamPlayer.js | Restauração/salvamento de rascunho; não calcula resultado. |
| src/components/ResultsScreen.js | Resultado confirmado, revisão e CTAs. |
| src/assets/styles/components/exam.css | Direção visual aprovada, estados e breakpoints. |

---

### Task 1: Publicar somente questões ENEM elegíveis

**Files:**
- Create: backend/database/migrations/007_simulator_sessions.sql, backend/utils/PublishedQuestionRepository.php, backend/tests/published_question_repository_test.php
- Modify: backend/tests/private_beta_test.php

**Interfaces:**
- Produces PublishedQuestionRepository::subjects(PDO $pdo): list of {key,label,available}.
- Produces select(PDO $pdo, array $subjects, ?string $topic, int $count, array $excludeIds=[]): list of question DTO rows.

- [ ] **Step 1: Write the failing migration/repository test**

    $valid = insertQuestion($pdo, ['area' => 'Matemática', 'status' => 'valid', 'correct_option' => 'A']);
    insertQuestion($pdo, ['area' => 'Matemática', 'status' => 'pending', 'correct_option' => null]);
    $rows = PublishedQuestionRepository::select($pdo, ['Matemática'], null, 10);
    expectSame([$valid], array_column($rows, 'id'), 'Only published answerable questions are selectable');
    expectSame('Matemática', $rows[0]['subject'], 'Area is the initial subject label');

Assert topic accepts NULL, the seventh migration runs once, and an ID in excludeIds is never selected.

- [ ] **Step 2: Run the test to verify it fails**

Run: php backend/tests/published_question_repository_test.php

Expected: FAIL because migration and repository do not exist.

- [ ] **Step 3: Implement the migration and prepared read queries**

    ALTER TABLE enem_questions ADD COLUMN topic TEXT;
    CREATE INDEX idx_enem_questions_published_subject_topic
      ON enem_questions(status, area, topic, year, day, question_number);

Create simulator_sessions with UUID text primary key, user, kind in catalog/custom/practice, status in active/completed/abandoned, subject/topic, positive time limit, position, elapsed seconds and timestamps. Create simulator_session_questions(session_id, question_id, position) with unique position and simulator_session_answers(session_id, question_id, selected_option A–E/null, flagged). In the repository query valid questions with A–E, selected areas, optional exact topic and exclusions; reject empty subjects and counts outside 1–90 before SQL.

- [ ] **Step 4: Run migration and auth regressions**

Run: php backend/tests/published_question_repository_test.php && npm run test:backend

Expected: PASS; idempotent migration, no pending item in a pool and existing auth tests still initialize the database.

- [ ] **Step 5: Commit**

    git add backend/database/migrations/007_simulator_sessions.sql backend/utils/PublishedQuestionRepository.php backend/tests/published_question_repository_test.php backend/tests/private_beta_test.php
    git commit -m "feat: publish ENEM questions for simulators"

### Task 2: Persist immutable sessions and rascunhos

**Files:**
- Create: backend/utils/SimulatorSessionRepository.php, backend/tests/simulator_session_repository_test.php

**Interfaces:**
- Produces create(PDO $pdo, int $userId, string $kind, ?string $subject, ?string $topic, int $limitSeconds, array $questionIds): array.
- Produces find(PDO $pdo, int $userId, string $id), saveProgress(...), and complete(...).

- [ ] **Step 1: Write failing lifecycle tests**

    $session = $repo->create($pdo, $firstUserId, 'practice', 'Matemática', null, 1500, [$q1, $q2]);
    $repo->saveProgress($pdo, $firstUserId, $session['id'], 1, 94, [
      ['question_id' => $q1, 'selected_option' => 'B', 'flagged' => true]
    ]);
    expectSame('B', $repo->find($pdo, $firstUserId, $session['id'])['answers'][0]['selected_option'], 'Draft restores');
    $first = $repo->complete($pdo, $firstUserId, $session['id']);
    $second = $repo->complete($pdo, $firstUserId, $session['id']);
    expectSame($first['result'], $second['result'], 'Completion is idempotent');

Cover duplicate question IDs, invalid answer option, position outside composition, mutation after completion and second-user lookup.

- [ ] **Step 2: Run the test to verify it fails**

Run: php backend/tests/simulator_session_repository_test.php

Expected: FAIL because the session repository does not exist.

- [ ] **Step 3: Implement transactional ownership and completion**

Generate IDs with bin2hex(random_bytes(16)). In one transaction insert session then ordered composition. Before progress/completion, select by both ID and user. Upsert only answers whose question belongs to the composition; update position/elapsed/timestamp atomically. Completion joins selected answers to enem_questions.correct_option, calculates correct/incorrect/unanswered/score on the server, marks completed once and returns stored outcome on retry. Return null for missing or foreign records so controller behavior is indistinguishable.

- [ ] **Step 4: Run targeted tests and PHP lint**

Run: php backend/tests/simulator_session_repository_test.php && npm run lint:php

Expected: PASS, including no cross-account draft change and no second result.

- [ ] **Step 5: Commit**

    git add backend/utils/SimulatorSessionRepository.php backend/tests/simulator_session_repository_test.php
    git commit -m "feat: persist resumable simulator sessions"

### Task 3: Derivar mapa e prática sem falsa precisão

**Files:**
- Create: backend/utils/SimulatorRecommendation.php, backend/tests/simulator_recommendation_test.php
- Modify: backend/utils/SimulatorSessionRepository.php

**Interfaces:**
- Produces SimulatorRecommendation::overview(array $responses, array $active): {recommendation,mastery,active_sessions}.
- Each mastery row is {subject,answered_count,accuracy,status,action}; status is insufficient, attention, evolving or strong.

- [ ] **Step 1: Write failing pure-rule tests**

    $overview = SimulatorRecommendation::overview([
      response('Matemática', null, false), response('Matemática', null, false),
      response('Matemática', null, true), response('Matemática', null, false),
      response('Matemática', null, false), response('Linguagens', null, true)
    ], []);
    expectSame('attention', $overview['mastery'][0]['status'], 'Five answers below 60% need attention');
    expectSame('Matemática', $overview['recommendation']['subject'], 'Lowest sufficient subject is chosen');
    expectSame(null, $overview['recommendation']['topic'], 'No taxonomy means no invented topic');

Add exact 60% and 75% boundaries, four answers, qualifying topic with five answers, no answers, 31st oldest answer ignored and an answer older than 90 days ignored.

- [ ] **Step 2: Run the rule test to verify it fails**

Run: php backend/tests/simulator_recommendation_test.php

Expected: FAIL because the rule class does not exist.

- [ ] **Step 3: Implement bounded aggregation and fallback**

Add recentResponses(PDO $pdo, int $userId): array in the repository; select only completed sessions in 90 days, newest first, limit 30 before grouping. Map fewer than five to insufficient, below 60 to attention, 60–74 to evolving and 75+ to strong. Consider topic only when the exact non-null topic has five answers. Choose lower accuracy, then more recent error, then strnatcasecmp. Return null recommendation when every group is insufficient.

- [ ] **Step 4: Run rule and repository tests**

Run: php backend/tests/simulator_recommendation_test.php && php backend/tests/simulator_session_repository_test.php

Expected: PASS with stable window, thresholds and topic fallback.

- [ ] **Step 5: Commit**

    git add backend/utils/SimulatorRecommendation.php backend/utils/SimulatorSessionRepository.php backend/tests/simulator_recommendation_test.php
    git commit -m "feat: recommend simulator practice from answers"

### Task 4: Expor API autenticada de catálogo, sessão e overview

**Files:**
- Create: backend/controllers/SimulatorController.php, backend/tests/simulator_api_test.php
- Modify: backend/api/index.php

**Interfaces:**
- Consumes GET /api/simulators/catalog, GET /api/simulators/overview, GET /api/simulators/sessions?status=active.
- Consumes POST /api/simulators/sessions, GET /api/simulators/sessions/{id}, PATCH /api/simulators/sessions/{id}/progress, POST /api/simulators/sessions/{id}/complete.
- Active question DTOs omit gabarito; completed/review DTOs include only correct answers necessary for review.

- [ ] **Step 1: Write failing two-user API tests**

    $created = request($root, $path, '/api/simulators/sessions', 'POST', $firstCookie, [
      'kind' => 'practice', 'subjects' => ['Matemática'], 'count' => 10
    ]);
    expectStatus($created, 201, 'Practice is created');
    $id = json_decode($created['body'], true, flags: JSON_THROW_ON_ERROR)['data']['session']['id'];
    expectStatus(request($root, $path, "/api/simulators/sessions/$id/progress", 'PATCH', $secondCookie, []), 404, 'Foreign session is hidden');
    expectStatus(request($root, $path, "/api/simulators/sessions/$id/complete", 'POST', $firstCookie, []), 200, 'Completion succeeds');

Cover no auth, malformed payload, unknown subject, count greater than supply, no-history overview, insufficient overview, active list and no pre-completion correct option.

- [ ] **Step 2: Run API tests to verify they fail**

Run: php backend/tests/simulator_api_test.php

Expected: FAIL because /simulators is unregistered.

- [ ] **Step 3: Implement controller and routes**

Extend router parsing with action = getSegment(3) and register exact branches before fallback. Validate kind, one-to-four nonempty subject strings up to 120 chars, count 1–90 and normalized answer shape. A practice with no sufficient server recommendation requires exactly one explicit subject; otherwise server chooses subject/topic and composition. Return 201 only after committed creation, 400 malformed input, 409 unavailable supply/invalid transition and 404 missing/foreign session.

- [ ] **Step 4: Run API/auth/lint suite**

Run: php backend/tests/simulator_api_test.php && npm run test:backend && npm run lint:php

Expected: PASS; authorization, DTO secrecy and idempotence hold.

- [ ] **Step 5: Commit**

    git add backend/controllers/SimulatorController.php backend/api/index.php backend/tests/simulator_api_test.php
    git commit -m "feat: expose authenticated simulator API"

### Task 5: Criar cliente e substituir a home local pela direção aprovada

**Files:**
- Create: src/services/SimulatorApiService.js, src/services/simulatorViewModel.js, src/tests/SimulatorApiService.test.js, src/tests/simulatorViewModel.test.js, src/tests/ExamsPage.test.js
- Modify: src/utils/api.js, src/pages/ExamsPage.js, src/assets/styles/components/exam.css, src/assets/styles/main.css

**Interfaces:**
- SimulatorApiService exposes catalog, overview, createSession, session, saveProgress, complete and activeSessions.
- overviewViewModel(payload) returns exactly one hero: recommended practice, subject chooser or content-unavailable.
- ExamsPage receives apiClient,user, not library or attemptService.

- [ ] **Step 1: Write failing client and home tests**

    it('renders a subject choice, not a fabricated percentage, for insufficient history', async () => {
      api.get.mockResolvedValueOnce(ok({ recommendation: null, mastery: [{ subject: 'Matemática', answered_count: 3, status: 'insufficient' }] }));
      const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });
      page.render(); await flush();
      expect(page.element.textContent).toContain('Escolha uma matéria para começar');
      expect(page.element.textContent).not.toContain('0%');
    });

Also test recommendation hero/evidence, resume CTA, loading, content unavailable, failed refresh retaining old DOM, keyboard CTA and no local-library wording.

- [ ] **Step 2: Run focused frontend tests to verify they fail**

Run: npm test -- SimulatorApiService.test.js simulatorViewModel.test.js ExamsPage.test.js

Expected: FAIL because ExamsPage reads local library and api.patch is absent.

- [ ] **Step 3: Implement client, view model, page and responsive UI**

Add api.patch beside existing verbs. The service throws Error(payload.message || 'Não foi possível atualizar os simulados.') when success is false; it never returns mock data. Remove collectExams, LocalExamAttemptService, ensureAttemptService, library and local caderno state from ExamsPage. Render hero, compact map, resume row and secondary catalog using DOM APIs/textContent for server copy. At 640 px stack hero/map rows; retain textual status and focus indicator so color is not the sole signal.

- [ ] **Step 4: Run page/build checks**

Run: npm test -- SimulatorApiService.test.js simulatorViewModel.test.js ExamsPage.test.js && npm run build

Expected: PASS with honest empty/error/insufficient states and production build.

- [ ] **Step 5: Commit**

    git add src/utils/api.js src/services/SimulatorApiService.js src/services/simulatorViewModel.js src/pages/ExamsPage.js src/assets/styles/components/exam.css src/assets/styles/main.css src/tests/SimulatorApiService.test.js src/tests/simulatorViewModel.test.js src/tests/ExamsPage.test.js
    git commit -m "feat: prioritize simulator practice and mastery"

### Task 6: Adaptar player, resultado e concluir verificação local

**Files:**
- Modify: src/components/ExamPlayer.js, src/components/ResultsScreen.js, src/pages/ExamsPage.js, backend/tests/private_beta_test.php
- Create: src/tests/ExamPlayer.test.js, src/tests/ResultsScreen.test.js, docs/evidence/simulados/2026-09-22-pratica-e-dominio.md

**Interfaces:**
- new ExamPlayer({session,onProgressSaved,onComplete}) restores current position, elapsed time, answers and flags.
- onProgressSaved({position,elapsed_seconds,answers}) debounces 500 ms and flushes before completion/destroy.
- ResultsScreen({result,session}) never invokes /exams/attempt.

- [ ] **Step 1: Write failing player/result tests**

    it('restores a remote draft and saves after 500ms', async () => {
      const saved = vi.fn().mockResolvedValue(undefined);
      const player = new ExamPlayer({ session: remoteSession({ current_position: 1, answers: [{ question_id: 7, selected_option: 'C', flagged: true }] }), onProgressSaved: saved });
      player.render(); player.handleAnswer(7, 'B');
      await vi.advanceTimersByTimeAsync(500);
      expect(saved).toHaveBeenCalledWith(expect.objectContaining({ position: 1 }));
    });
    it('does not post a legacy attempt from results', () => {
      new ResultsScreen({ result: completedResult, session: completedSession }).render();
      expect(api.post).not.toHaveBeenCalledWith('/exams/attempt', expect.anything());
    });

Cover timer expiry, review read-only controls, retryable save failure, timer cleanup and complete retry.

- [ ] **Step 2: Run the tests to verify they fail**

Run: npm test -- ExamPlayer.test.js ResultsScreen.test.js

Expected: FAIL because player state is ephemeral and results post legacy attempts.

- [ ] **Step 3: Implement remote lifecycle and result presentation**

Map UI indices A–E at API boundary. Compute elapsed from persisted baseline plus in-tab time. On answer/flag/navigation schedule one save; before completion flush then let ExamsPage call complete(session.id). Correctness remains absent until completed payload opens review. Remove emoji and inline styles from ResultsScreen, display confirmed totals, and reload overview after completion.

- [ ] **Step 4: Run full verification and browser walkthrough**

Run: npm test && npm run build && npm run lint:php && npm run test:backend && php backend/tests/published_question_repository_test.php && php backend/tests/simulator_session_repository_test.php && php backend/tests/simulator_recommendation_test.php && php backend/tests/simulator_api_test.php && git diff --check

Use an explicit temporary APP_DB_PATH with two synthetic users and valid synthetic ENEM rows to verify desktop and 390 px: chooser sem histórico, recomendação, dados insuficientes, retomada após recarregar, resultado/revisão e teclas A–E/F. Do not use a production URL, real cookie or personal data.

- [ ] **Step 5: Record only observed evidence and commit**

    git add src/components/ExamPlayer.js src/components/ResultsScreen.js src/pages/ExamsPage.js src/assets/styles/components/exam.css src/tests/ExamPlayer.test.js src/tests/ResultsScreen.test.js backend/tests/private_beta_test.php docs/evidence/simulados/2026-09-22-pratica-e-dominio.md
    git commit -m "test: verify simulator practice workflow"

The evidence file contains only SHA, tracked paths, commands, exit codes and PASS/FAIL observations. A failed check is recorded as FAIL and repaired before claiming completion.

## Plan Self-Review

### Spec coverage

- Fonte autenticada, área/tópico opcional e sem Biblioteca local: Tasks 1, 4 and 5.
- Composição imutável, rascunho, retomada e conclusão idempotente: Tasks 2, 4 and 6.
- Janela, limiares e ausência de falsa precisão: Task 3 and Task 5.
- Home visual, estados, acessibilidade e responsividade: Task 5 and Task 6.
- Resultado confirmado e revisão: Task 6.
- Isolamento, testes e evidência somente local: Tasks 4 and 6.

### Placeholder scan

Searched for TODO, TBD, implement later, appropriate error, and similar to Task. None appear as implementation instructions.

### Type consistency

PublishedQuestionRepository returns stable integer IDs consumed only by SimulatorSessionRepository. The controller hides gabaritos until completion. SimulatorApiService mirrors controller paths; ExamPlayer emits exactly the progress shape accepted by the API.
