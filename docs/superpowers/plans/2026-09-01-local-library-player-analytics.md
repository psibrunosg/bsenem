# Local Library, Full Player and Real Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved automatic course library, a single full lesson player with paired video/audio, and dashboard analytics generated only from real local or account data.

**Architecture:** Keep file access and local-media analytics in the browser. A pure course-catalog adapter turns the existing file scan into `course → module → lesson` data without changing files on disk. A shared `LessonPlayer` owns format switching and playback state; a small analytics store consumes non-overlapping played ranges. The PHP API owns account events, daily rollups, and server-side recent activity through an idempotent event ledger.

**Tech Stack:** Vanilla ES modules, Vite, Vitest + jsdom, File System Access API, IndexedDB key-value store, PHP 8, SQLite migrations, PDO.

**Spec:** `docs/superpowers/specs/2026-09-01-local-course-library-and-player-design.md`

## Global Constraints

- Work directly on `main`; the user explicitly declined a worktree. Preserve unrelated `.superpowers/` files.
- Do not upload, hash, or persist file content or local absolute paths. Local analytics may keep course/module display labels, opaque lesson IDs, and played intervals only in IndexedDB.
- Type directories are recognized case-insensitively and accent-insensitively: video(s), vídeo(s), audio(s), áudio(s), pdf(s).
- Strip a technical prefix only when descriptive text remains. A code-only source name displays `Material complementar`, never the code.
- Pair video and audio only when their raw filename stem and module path match exactly after Unicode case folding; do not guess a pairing.
- No mock fallback data is permitted in dashboard cards, activity, or performance. Empty and error states must be explicit.
- Backend mutating tests must set `APP_ENV=test`, use a new explicit temporary `APP_DB_PATH`, and delete that temporary database plus WAL/SHM files in `finally`.
- Do not add third-party packages. Do not perform Git publication, VPS migration, or deployment before the release gate verifies authentication, backup, rollback, and health-check contracts.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/services/courseCatalog.js` | Pure folder normalization, hierarchy, lessons, type filters, and safe title helpers. |
| `src/services/LocalLibraryService.js` | Scans handles, retains raw metadata/handles, and exposes the derived catalog. |
| `src/services/LocalLearningAnalyticsService.js` | Isolated IndexedDB aggregation of merged local playback ranges. |
| `src/components/CourseTree.js` | Accessible expandable course/module/submodule navigation. |
| `src/components/LessonCard.js` | Escaped, styled lesson or PDF card with availability and duration metadata. |
| `src/components/LessonPlayer.js` | One complete native-media player, queue, format toggle, and playback callbacks. |
| `src/pages/LibraryPage.js` | Library controls plus catalog tree/cards/filters and PDF opening. |
| `src/pages/VideoPage.js`, `src/pages/AudioPage.js` | Thin entry pages for a shared pending lesson and preferred initial format. |
| `src/components/AppShell.js` | Removes the global mini-player and passes a pending lesson to the routed full player. |
| `src/pages/DashboardPage.js`, `src/components/StatsDashboard.js` | Loads real account/local summaries and renders loading, empty, partial-failure, and ready states. |
| `backend/controllers/ActivityRecorder.php` | Transactional idempotent account event recorder and daily rollup helper. |
| `backend/controllers/ProgressController.php` | Validates study events and returns real dashboard aggregates. |
| `backend/controllers/FlashcardController.php`, `backend/controllers/ExamController.php` | Send completed account actions through the shared recorder. |
| `backend/database/migrations/002_activity_events.sql` | Adds a unique ledger used to make retries safe. |

---

### Task 1: Derive an automatic course catalog from scanned files

**Files:**
- Create: `src/services/courseCatalog.js`
- Modify: `src/services/LocalLibraryService.js`
- Test: `src/tests/courseCatalog.test.js`, `src/tests/LocalLibraryService.test.js`

**Interfaces:**
- Produces `buildCourseCatalog(items): CourseCatalog` where `CourseCatalog` is `{ courses: CourseNode[], lessons: Map<string, Lesson>, itemToLessonId: Map<string, string> }`.
- `CourseNode` is `{ id, title, modules: ModuleNode[] }`; `ModuleNode` is `{ id, title, children: ModuleNode[], lessons: Lesson[], materials: LibraryItem[] }`.
- `Lesson` is `{ id, title, courseId, moduleId, video: LibraryItem|null, audio: LibraryItem|null, transcript: LibraryItem['transcript']|null }`.
- `LocalLibraryService.refresh()` returns `{ items, diagnostics, catalog }` and caches the catalog in memory only; file handles remain private to the service.

- [ ] **Step 1: Write the failing pure-catalog tests**

```js
import { buildCourseCatalog, displayTitle } from '../services/courseCatalog.js';

it('collapses typed directories and pairs same-stem media in one module', () => {
  const catalog = buildCourseCatalog([
    item('v1', ['INPBE', '01 - Fundamentos', 'Vídeos'], '01-Introdução', 'video'),
    item('a1', ['INPBE', '01 - Fundamentos', 'Áudios'], '01-Introdução', 'audio'),
    item('p1', ['INPBE', '01 - Fundamentos', 'PDFs'], 'C4-A3-MC4 - Leitura', 'pdf')
  ]);
  expect(catalog.courses[0].title).toBe('INPBE');
  expect(catalog.courses[0].modules[0].title).toBe('Fundamentos');
  expect(catalog.courses[0].modules[0].lessons[0]).toMatchObject({ title: 'Introdução', video: { id: 'v1' }, audio: { id: 'a1' } });
  expect(catalog.courses[0].modules[0].materials[0].title).toBe('Leitura');
});

it('does not expose a code-only stem and does not pair across modules', () => {
  expect(displayTitle('C4-A3-MC4')).toBe('Material complementar');
  const catalog = buildCourseCatalog([
    item('video-one', ['Curso', 'Módulo um', 'Vídeos'], 'Aula comum', 'video'),
    item('audio-two', ['Curso', 'Módulo dois', 'Áudios'], 'Aula comum', 'audio')
  ]);
  expect(catalog.lessons.size).toBe(2);
});
```

- [ ] **Step 2: Run the new test before implementation**

Run: `npm test -- courseCatalog.test.js`

Expected: FAIL because `courseCatalog.js` does not exist.

- [ ] **Step 3: Implement `courseCatalog.js` with no DOM or IndexedDB dependency**

```js
export function displayTitle(raw, fallback = 'Material complementar') {
  const remainder = String(raw).replace(/^(?:(?:c\d+(?:-a\d+)?(?:-mc\d+)?)|\d+)[_\s.-]*/i, '').trim();
  return hasAlphabeticText(remainder) ? titleCase(remainder.replace(/[_-]+/g, ' ')) : fallback;
}

export function buildCourseCatalog(items) {
  // classify typed path segments, retain raw stem for the pair key,
  // build stable IDs from escaped path segments, and return a deterministic tree
}
```

Implement `normalizeFolder`, `isTypeFolder`, `displayTitle`, `modulePathFor`, and `buildCourseCatalog`. `modulePathFor` removes only typed directory segments. If the selected root has a typed directory directly, create the synthetic module title `Conteúdos do curso`; otherwise retain each non-type folder as course/module/submodule. Sort siblings with `Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })` using original source names so display labels never control ordering.

- [ ] **Step 4: Preserve raw scan facts and expose catalog in `LocalLibraryService`**

Add immutable `pathSegments`, `rawTitle`, and `typeFolder` facts to each accepted `LibraryItem`; retain the current `title`, `relativePath`, sidecar behavior, and file-handle map. After scan, call `buildCourseCatalog(items)`, set `this.catalog`, and include `catalog` in refresh/connect/restore results. Do not write `catalog` to IndexedDB because it is recomputable and contains no new authority.

- [ ] **Step 5: Run targeted catalog and scanner tests**

Run: `npm test -- courseCatalog.test.js LocalLibraryService.test.js`

Expected: PASS, including existing captions, permission, reset, unsupported file, and exam tests.

- [ ] **Step 6: Commit the self-contained catalog task**

```bash
git add src/services/courseCatalog.js src/services/LocalLibraryService.js src/tests/courseCatalog.test.js src/tests/LocalLibraryService.test.js
git commit -m "feat: derive courses and lessons from local folders"
```

### Task 2: Replace the raw library grid with tree navigation and styled cards

**Files:**
- Create: `src/components/CourseTree.js`, `src/components/LessonCard.js`, `src/assets/styles/components/course-library.css`
- Modify: `src/pages/LibraryPage.js`, `src/assets/styles/main.css`, `src/tests/LibraryPage.test.js`
- Test: `src/tests/LibraryPage.test.js`

**Interfaces:**
- `new CourseTree({ courses, selectedNodeId, onSelect }).render()` emits buttons with `aria-expanded` and `data-node-id`.
- `renderLessonCard({ lesson, onOpenId })` emits one escaped lesson button; `renderMaterialCard({ item, onOpenId })` emits one escaped PDF button.
- `LibraryPage` keeps `{ selectedNodeId, typeFilter }` and calls `app.openLocalResource(item)` with the selected lesson's available item.

- [ ] **Step 1: Add a failing page test for hierarchy and a single paired card**

```js
it('renders module navigation and one card for paired video and audio', async () => {
  const page = new LibraryPage({ library: libraryWithCatalog(catalogWithPairedLesson()), app });
  const element = await page.render();
  expect(element.querySelector('[data-node-id="module-1"]')).not.toBeNull();
  expect(element.querySelectorAll('[data-lesson-id="lesson-1"]')).toHaveLength(1);
  expect(element.textContent).not.toContain('C4-A3-MC4');
});
```

- [ ] **Step 2: Run the page test before component work**

Run: `npm test -- LibraryPage.test.js`

Expected: FAIL because the current page has only `library-groups` and raw `library-item` buttons.

- [ ] **Step 3: Implement tree/card components and replace `LibraryPage.groups()`**

Use `textContent` for dynamic labels when constructing elements, or the existing `escape()` helper for all interpolated attributes and text. The page must render:

```text
controls
├─ course tree
└─ selected module header + Todos / Vídeos / Áudios / PDFs filters
   ├─ paired lesson cards
   └─ PDF material cards
```

Keep connect, refresh, change-folder, permission-revoked, empty, scanning, reset confirmation, and PDF viewer flows. The empty filter message must name the selected type and leave other filters available. Keyboard Enter/Space selects a tree node or card; collapse state uses `aria-expanded`.

- [ ] **Step 4: Add responsive visual styles without changing global theme tokens**

Import `course-library.css` from `main.css`. Use CSS grid for a fixed-width tree on desktop and a stacked tree above content below `900px`; cards use an aspect-ratio cover, semantic type badge, visible focus ring, and no emoji. Video cards receive a visual cover placeholder until Task 3 can attach a frame. Audio cards use a CSS waveform; PDF cards use a document treatment. Ensure long normalized titles wrap and raw codes are never introduced by CSS pseudo-content.

- [ ] **Step 5: Run focused and full frontend tests**

Run: `npm test -- LibraryPage.test.js LocalLibraryService.test.js && npm test`

Expected: all existing tests plus hierarchy/filter/card coverage pass.

- [ ] **Step 6: Commit the library presentation task**

```bash
git add src/components/CourseTree.js src/components/LessonCard.js src/assets/styles/components/course-library.css src/assets/styles/main.css src/pages/LibraryPage.js src/tests/LibraryPage.test.js
git commit -m "feat: organize local materials by course and module"
```

### Task 3: Introduce one full player and remove the global mini-player

**Files:**
- Create: `src/components/LessonPlayer.js`, `src/assets/styles/components/lesson-player.css`
- Modify: `src/components/AppShell.js`, `src/pages/VideoPage.js`, `src/pages/AudioPage.js`, `src/assets/styles/main.css`, `src/tests/MediaPages.test.js`, `src/tests/AppShell.test.js`
- Test: `src/tests/MediaPages.test.js`, `src/tests/AppShell.test.js`

**Interfaces:**
- `new LessonPlayer({ lesson, initialMode, library, onPlayback }).render()` returns the full player and module queue.
- `LessonPlayer.switchMode(mode)` accepts `'video'` or `'audio'`, retains `{ currentTime, volume, muted, playbackRate, intendedPlaying }`, and rejects unavailable formats without changing state.
- `AppShell.openLocalResource(item)` resolves `library.catalog.itemToLessonId`, stores `{ lesson, initialMode }`, and routes to video or audio. `consumeLocalLesson()` consumes that one object.

- [ ] **Step 1: Write failing player and shell tests**

```js
it('switches a paired lesson without losing time, volume, mute, rate, or intended play state', async () => {
  const player = await renderPlayer(pairedLesson());
  player.media.currentTime = 42;
  player.media.volume = 0.4;
  player.media.muted = true;
  player.media.playbackRate = 1.5;
  await player.switchMode('audio');
  expect(player.mode).toBe('audio');
  expect(player.media.currentTime).toBe(42);
  expect(player.media.volume).toBe(0.4);
});

it('does not render the global mini-player container', () => {
  expect(new AppShell({ user }).render().querySelector('.mini-player-container')).toBeNull();
});
```

- [ ] **Step 2: Run the player/shell tests before implementation**

Run: `npm test -- MediaPages.test.js AppShell.test.js`

Expected: FAIL because no `LessonPlayer` or lesson bridge exists and the mini-player container still renders.

- [ ] **Step 3: Implement a shared `LessonPlayer` around native media**

The component creates exactly one `<video>` for video mode or `<audio>` for audio mode. Open the selected item through `LocalMediaSession.open()`, close the prior session before replacing it, and clamp carried time to finite duration after `loadedmetadata`. Render only formats that actually exist. Its controls must call the media element directly for seek, play/pause, previous/next queue item, `volume`, `muted`, and `playbackRate`; synchronize slider and mute UI on `volumechange`, `timeupdate`, and `ratechange`.

`switchMode()` must capture state before closing the old object URL, then apply it after new metadata. It may call `play()` only if `intendedPlaying` was true, catching a browser rejection and leaving a visible paused state. It must call `onPlayback({ lesson, mode, previousTime, currentTime, playing })` only with real media time.

- [ ] **Step 4: Route both entry pages to the shared player and remove mini-player lifecycle**

`VideoPage` and `AudioPage` consume the same pending lesson and pass their format as `initialMode`; neither creates `VideoPlayer` or `AudioPlayer` for local lessons. `AppShell` removes the `MiniPlayer` import, construction, container, handlers, public mini-player API, and destruction call. Keep unrelated player components untouched so no undeclared feature is removed. If a resource cannot resolve to a lesson, show the existing actionable local-media error instead of a blank player.

- [ ] **Step 5: Style the complete player and one queue**

Import `lesson-player.css`. On wide screens use player + queue columns; below `900px` place the one queue after the player. The queue uses buttons with `aria-current="true"` for the active lesson and has no copied controls in a bottom bar. Volume gets a labelled range input and mute button. The format toggle is absent for a one-format lesson.

- [ ] **Step 6: Run player, page, shell, and full frontend tests**

Run: `npm test -- MediaPages.test.js AppShell.test.js && npm test`

Expected: paired switching, unavailable format, volume/mute, one queue, and no mini-player assertions pass along with all old tests.

- [ ] **Step 7: Commit the player task**

```bash
git add src/components/LessonPlayer.js src/assets/styles/components/lesson-player.css src/assets/styles/main.css src/components/AppShell.js src/pages/VideoPage.js src/pages/AudioPage.js src/tests/MediaPages.test.js src/tests/AppShell.test.js
git commit -m "feat: use one full player for local lessons"
```

### Task 4: Persist real local playback analytics without duplicate time

**Files:**
- Create: `src/services/LocalLearningAnalyticsService.js`
- Modify: `src/components/LessonPlayer.js`, `src/pages/DashboardPage.js`
- Test: `src/tests/LocalLearningAnalyticsService.test.js`, `src/tests/MediaPages.test.js`

**Interfaces:**
- `new LocalLearningAnalyticsService({ idb, userId, libraryId, clock })` scopes records to `local-learning:<userId>:<libraryId>`.
- `recordRange({ lessonId, courseTitle, moduleTitle, fromSeconds, toSeconds, recordedAt })` merges intervals and returns a snapshot.
- `getSummary(now)` returns `{ totalMinutes, todayMinutes, performance, recent }`, where local `performance` rows are `{ id, label, kind: 'course'|'module', studyMinutes, lessonsCompleted }`.

- [ ] **Step 1: Write failing deduplication and isolation tests**

```js
it('merges overlapping watched ranges instead of double-counting seek/replay', async () => {
  await service.recordRange(range('lesson-a', 0, 80));
  await service.recordRange(range('lesson-a', 40, 120));
  expect((await service.getSummary(day)).totalMinutes).toBe(2);
});

it('does not read another profile or library key', async () => {
  await serviceFor('u1', 'library-a').recordRange(range('lesson-a', 0, 60));
  expect((await serviceFor('u2', 'library-a').getSummary(day)).totalMinutes).toBe(0);
});
```

- [ ] **Step 2: Run the analytics test before implementation**

Run: `npm test -- LocalLearningAnalyticsService.test.js`

Expected: FAIL because the service is absent.

- [ ] **Step 3: Implement interval-union storage and player checkpoints**

Store only rounded played intervals and the displayed course/module labels. Merge intervals by lesson, calculate time from their union, and cap a single recorded segment at a finite duration supplied by the player. `LessonPlayer` records only forward elapsed ranges after a minimum of 15 seconds, flushes on pause, `ended`, lesson change, and destroy, and resets its pending range after every flush. Format switching carries the pending range and does not create a second event for overlap.

- [ ] **Step 4: Merge the local summary into dashboard loading without hiding API results**

Construct the service only when both authenticated user ID and `library.libraryId()` exist. If no library is connected, return a distinct local-unavailable summary, not an error. `DashboardPage.loadActivityData()` uses `Promise.allSettled` so account API failure leaves valid local summary visible and local failure leaves valid account summary visible.

- [ ] **Step 5: Run analytics and player regression tests**

Run: `npm test -- LocalLearningAnalyticsService.test.js MediaPages.test.js && npm test`

Expected: overlap, profile/library isolation, format switch, pause flush, and no-library behavior pass.

- [ ] **Step 6: Commit local analytics**

```bash
git add src/services/LocalLearningAnalyticsService.js src/components/LessonPlayer.js src/pages/DashboardPage.js src/tests/LocalLearningAnalyticsService.test.js src/tests/MediaPages.test.js
git commit -m "feat: record local lesson analytics privately"
```

### Task 5: Make server-side account activity idempotent and analyzable

**Files:**
- Create: `backend/database/migrations/002_activity_events.sql`, `backend/controllers/ActivityRecorder.php`
- Modify: `backend/controllers/ProgressController.php`, `backend/controllers/FlashcardController.php`, `backend/controllers/ExamController.php`
- Test: `backend/tests/progress_test.php`, `backend/tests/lint_test.php`

**Interfaces:**
- `ActivityRecorder::record(PDO $pdo, int $userId, array $event): bool` accepts exactly `event_key`, `type`, `duration_seconds`, `subject_id`, `resource_id`, `cards_reviewed`, `exams_completed`, and `xp_earned`.
- It returns `true` only for the first event key for that user; a duplicate returns `false` without changing XP, `study_sessions`, or `activity_log`.
- `ProgressController::recordStudy()` accepts a client-generated `event_id` and validates UUID-shaped input before forwarding a server-scoped event key.

- [ ] **Step 1: Write a disposable-database failing test**

```php
$first = ActivityRecorder::record($pdo, $userId, event('study-1', 'pomodoro', 1500, 0, 0, 25));
$again = ActivityRecorder::record($pdo, $userId, event('study-1', 'pomodoro', 1500, 0, 0, 25));
$daily = $pdo->query('SELECT study_minutes, xp_earned FROM activity_log')->fetch();
expectTrue($first === true && $again === false, 'Repeated event key is idempotent');
expectTrue((int) $daily['study_minutes'] === 25 && (int) $daily['xp_earned'] === 25, 'Daily rollup changes once');
```

- [ ] **Step 2: Run the backend test before implementation**

Run: `php backend/tests/progress_test.php`

Expected: FAIL because no migration or `ActivityRecorder` exists.

- [ ] **Step 3: Add the ledger migration and transactional recorder**

`002_activity_events.sql` creates `activity_events` with `user_id`, `event_key`, type, nullable subject/resource IDs, deltas, `occurred_at`, and `UNIQUE(user_id, event_key)`, plus indexes for `(user_id, occurred_at)` and `(user_id, subject_id)`. `ActivityRecorder` begins a transaction, inserts the ledger row, immediately returns false for a unique conflict, then writes one `study_sessions` row and uses SQLite `INSERT ... ON CONFLICT(user_id, date) DO UPDATE` to increment `activity_log`. It increments account XP once in the same transaction. Roll back every other failure.

- [ ] **Step 4: Route flashcards, exams, and generic study through the recorder**

After a successful flashcard state update, use key `flashcard:<card-id>:<total-reviews>` and record one reviewed card. After an exam attempt insert, use `exam:<attempt-id>` and record the actual `time_spent` and completed exam. Generic study validates `event_id`, type, non-negative duration, and nullable integer `subject_id`; its key is `study:<event-id>`. Remove direct duplicate inserts/XP updates from these controllers. Preserve authentication checks and return the original resource response plus whether activity was newly recorded.

- [ ] **Step 5: Extend `ProgressController::dashboard()` with only factual aggregates**

Return current totals, daily rollup, weekly daily records, subject rows based on joined account events/subjects, and recent real events. Exclude records with no meaningful measure. Do not fabricate category rows. Keep existing response keys until `DashboardPage` consumes their replacements, then test both legacy summary keys and the new explicit collections.

- [ ] **Step 6: Run backend test, auth regression, and lint**

Run: `php backend/tests/progress_test.php && npm run test:backend && npm run lint:php`

Expected: migration is repeat-safe, duplicate events are harmless, account scopes do not leak, dashboard aggregates are factual, auth tests pass, and every PHP file lints.

- [ ] **Step 7: Commit backend analytics**

```bash
git add backend/database/migrations/002_activity_events.sql backend/controllers/ActivityRecorder.php backend/controllers/ProgressController.php backend/controllers/FlashcardController.php backend/controllers/ExamController.php backend/tests/progress_test.php
git commit -m "feat: record account study activity idempotently"
```

### Task 6: Render real dashboard data and explicit data states

**Files:**
- Modify: `src/pages/DashboardPage.js`, `src/components/StatsDashboard.js`, `src/assets/styles/components/dashboard.css`, `src/components/AppShell.js`
- Test: `src/tests/DashboardPage.test.js`, `src/tests/AppShell.test.js`

**Interfaces:**
- `StatsDashboard` receives `{ account, local, status }`, not default fixture values.
- `DashboardPage.loadActivityData()` resolves `{ account: { status, data }, local: { status, data } }` and always calls `this.stats.updateStats(this.getDashboardViewModel())` after settled results.
- `getDashboardViewModel()` exposes `{ totals, weeklyDays, performance, activity, states }`, where every row includes a source and metric label.

- [ ] **Step 1: Write failing tests for asynchronous update, empty state, and partial failure**

```js
it('replaces loading values with dashboard API data after render', async () => {
  api.get.mockResolvedValueOnce({ success: true, data: heatmap }).mockResolvedValueOnce({ success: true, data: dashboard });
  const page = new DashboardPage({ app, user, library });
  await page.render();
  await flushPromises();
  expect(page.element.textContent).toContain('42min');
  expect(page.element.textContent).not.toContain('Matemática');
});

it('shows a local-unavailable note while retaining real account activity after local failure', async () => {
  api.get.mockResolvedValueOnce({ success: true, data: heatmap }).mockResolvedValueOnce({ success: true, data: dashboard });
  const page = new DashboardPage({ app, user, library: libraryWithoutConnection() });
  await page.render();
  await flushPromises();
  expect(page.element.textContent).toContain('Dados da biblioteca estarão disponíveis após conectar uma pasta');
  expect(page.element.textContent).toContain('Revisou 3 cards');
});
```

- [ ] **Step 2: Run the dashboard test before implementation**

Run: `npm test -- DashboardPage.test.js`

Expected: FAIL because `StatsDashboard` hard-codes matter/activity arrays and the page does not update stats after loading.

- [ ] **Step 3: Replace fixtures with a normalized view model**

Delete hard-coded `subjects` and `activities` arrays. Render a skeleton while both sources load; after settlement, render factual totals. `Meta semanal` reads actual week dates and marks only dates with measured activity. Performance rows retain their measure (`Minutos estudados`, `Precisão`, or `Aulas concluídas`) and their source. Recent rows use server event timestamps or local record timestamps and escape all labels. When no rows exist, render one empty-state message; never render an invented row or percentage.

- [ ] **Step 4: Maintain consistency for XP and streak**

Refresh the dashboard's account summary after a newly recorded pomodoro and update `AppShell.setUser()` only with server-returned XP. Do not update a streak optimistically; derive it from backend dashboard data after server event acceptance. Remove any remaining mini-player public methods from the shell tests and verify the full player route remains the only media control surface.

- [ ] **Step 5: Run targeted and complete checks**

Run: `npm test -- DashboardPage.test.js AppShell.test.js && npm test && npm run build`

Expected: loading/ready/empty/partial-failure dashboard states, factual rows, no mini-player, full suite, and production build pass.

- [ ] **Step 6: Commit dashboard rendering**

```bash
git add src/pages/DashboardPage.js src/components/StatsDashboard.js src/assets/styles/components/dashboard.css src/components/AppShell.js src/tests/DashboardPage.test.js src/tests/AppShell.test.js
git commit -m "fix: render factual dashboard analytics"
```

### Task 7: Review, migration gate, and release evidence

**Files:**
- Create: `docs/evidence/roadmap-autopilot/2026-09-01-local-library-player-analytics/implementer-handoff.json`, `docs/evidence/roadmap-autopilot/2026-09-01-local-library-player-analytics/reviewer-handoff.json`, `docs/evidence/roadmap-autopilot/2026-09-01-local-library-player-analytics/retest-handoff.json`
- Modify: `docs/evidence/roadmap-autopilot/2026-09-01-local-library-player-analytics/checkpoint.json`
- Test: full frontend/backend/lint/build and browser verification after deployment

**Interfaces:**
- Each handoff validates against `C:\Users\ACPO Empreendimentos\Documents\Github\roadmap-autopilot\schemas\handoff.schema.json` and contains sanitized file paths, command exits, tests, findings, risks, and next step.
- The checkpoint validates against the matching checkpoint schema and advances only after accepted evidence.

- [ ] **Step 1: Produce an implementer handoff from actual commands**

Record only command names, exit codes, changed paths, sanitized findings, and artifact hashes. Never include local user information, file names from a personal library, database contents, environment values, credentials, tokens, or raw production logs.

- [ ] **Step 2: Run an independent read-only review**

Review the final diff against every acceptance condition in the selected spec. Rerun the relevant frontend tests, backend progress/auth tests, PHP lint, `git diff --check`, and production build. Reject scope expansion, raw filename exposure, duplicate player rendering, missing idempotency, or data fixtures.

- [ ] **Step 3: Run release preflight before any external action**

Read `roadmap-autopilot/references/security-release.md`. Verify repository remote/authentication, SSH least privilege, database backup and restore/rollback command, versioned release directory, migration command, health-check command, and names/locations of required environment variables without reading their values. If any proof is absent, mark the run `BLOCKED` and ask one precise question; do not push, migrate, or deploy.

- [ ] **Step 4: Publish and migrate only after all gates pass**

After frontier acceptance and explicit gate evidence, commit approved work, push the recorded SHA, build the same SHA, deploy a versioned release, run the SQLite migration once, recreate only the documented frontend service, and verify the public health/auth/library shell without using or exposing user credentials. Preserve the prior release pointer for rollback.

- [ ] **Step 5: Perform independent production retest and close checkpoint**

Verify the deployed SHA serves the new assets, library cards do not show raw technical prefixes, the full player has no mini-player bar, dashboard empty states contain no fixtures, and API activity tests remain passing. Record PASS/FAIL evidence and only then mark the roadmap completed.

## Plan Self-Review

### Spec coverage

- Folder contract, title normalization, type filters, cards, and library states: Tasks 1–2.
- Single player, one queue, volume, format switching, and responsive behavior: Task 3.
- Private local analytics, range deduplication, local-unavailable behavior: Task 4.
- Real account activity, idempotency, daily summaries, factual dashboard API: Task 5.
- Dashboard loading, factual performance/activity, empty and partial-failure states: Task 6.
- Tests, review, migration safety, publication, deployment, and retest: Task 7.

### Placeholder scan

Searched for `TODO`, `TBD`, `implement later`, `appropriate error`, and `similar to Task`; none appear as implementation instructions.

### Type consistency

`CourseCatalog`, `Lesson`, `LocalLearningAnalyticsService`, `LessonPlayer`, and `ActivityRecorder` signatures are declared before later tasks consume them. Server-only event IDs are never used by local analytics, and file handles never cross into persisted analytics data.
