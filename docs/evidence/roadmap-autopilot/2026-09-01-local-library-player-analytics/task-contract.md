# Roadmap Autopilot Task Contract

- **Run:** `2026-09-01-local-library-player-analytics`
- **Task:** `library-player-analytics`
- **State:** `BASELINE`
- **Selected roadmap:** `docs/superpowers/specs/2026-09-01-local-course-library-and-player-design.md`
- **Base SHA:** `1f9b367dbb097a124f62e76eb33fccdcaad32238`
- **Branch / worktree:** `main` / `C:\Users\ACPO Empreendimentos\Documents\Github\bsenem`

## Authority

The user explicitly invoked `/roadmap-autopilot start` and selected candidate `1`: the local course library, full single player, and real dashboard analytics specification. This contract does not authorize product work outside that specification.

## Allowed implementation paths

- `src/services/LocalLibraryService.js`
- `src/services/courseCatalog.js`
- `src/services/LocalLearningAnalyticsService.js`
- `src/components/CourseTree.js`
- `src/components/LessonCard.js`
- `src/components/LessonPlayer.js`
- `src/components/StatsDashboard.js`
- `src/components/AppShell.js`
- `src/pages/LibraryPage.js`
- `src/pages/VideoPage.js`
- `src/pages/AudioPage.js`
- `src/pages/DashboardPage.js`
- `src/assets/styles/main.css`
- `src/assets/styles/components/course-library.css`
- `src/assets/styles/components/lesson-player.css`
- `src/assets/styles/components/dashboard.css`
- `src/tests/courseCatalog.test.js`
- `src/tests/LocalLearningAnalyticsService.test.js`
- `src/tests/LibraryPage.test.js`
- `src/tests/MediaPages.test.js`
- `src/tests/DashboardPage.test.js`
- `backend/database/migrations/002_activity_events.sql`
- `backend/controllers/ActivityRecorder.php`
- `backend/controllers/ProgressController.php`
- `backend/controllers/FlashcardController.php`
- `backend/controllers/ExamController.php`
- `backend/tests/progress_test.php`
- `docs/superpowers/plans/2026-09-01-local-library-player-analytics.md`
- `docs/evidence/roadmap-autopilot/2026-09-01-local-library-player-analytics/`

Any additional file, package, API route, data collection, external service, product flow, or deployment change requires a new explicit decision.

## Acceptance conditions

1. The selected local folder produces a course/module/submodule tree while type folders remain implementation detail.
2. Cards use safe automatic titles and group same-name video/audio files into one lesson.
3. A lesson screen has one full player and one module queue; no global mini-player is rendered.
4. Video/audio switching preserves current time, volume, mute, rate, and intended play state without double-counting local study time.
5. Local study analytics remain local and are isolated by authenticated user and selected library identity.
6. Dashboard cards, subject/module performance, weekly activity, and recent activity contain no fixture values and distinguish empty, local-unavailable, and API-failure states.
7. Server activity events are idempotent, update the daily summary transactionally, and receive coverage in a disposable test database.
8. Existing tests, new tests, PHP lint, production build, independent review, migration safety proof, and production deployment/health checks pass before release.

## Baseline evidence

| Command | Exit | Result |
| --- | ---: | --- |
| `npm test` | 0 | 14 files and 57 tests passed |
| `npm run test:backend` | 0 | authentication test passed |
| `npm run lint:php` | 0 | all backend PHP files linted |
| `npm run build` outside sandbox | 0 | Vite production build passed |

The sandboxed build cannot traverse the local configuration path and fails before compiling; the approved outside-sandbox baseline is the authoritative build result.

## Active gates

- TDD: a failing regression or behavior test must precede every implementation task.
- Data safety: PHP tests must use `APP_ENV=test` and an explicit disposable `APP_DB_PATH`; production data is never reset by tests.
- Review: a read-only reviewer must inspect each task diff and rerun its acceptance commands before the frontier gate.
- Migration/release: before any VPS migration or deploy, verify SSH least privilege, database backup and rollback path, release layout, health-check command, and required environment-variable names without reading or exposing values.
- Publication: before any push, verify remote repository identity and GitHub authentication; no publication occurs before frontier acceptance.

## Current blocker and next step

No technical blocker exists. The detailed implementation plan is being written. The next permitted action after its approval is test-first implementation in the allowed paths.
