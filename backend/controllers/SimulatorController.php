<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../services/SimulatorCatalogImporter.php';
require_once __DIR__ . '/../utils/PublishedQuestionRepository.php';
require_once __DIR__ . '/../utils/QuestionContent.php';
require_once __DIR__ . '/../utils/SimulatorRecommendation.php';
require_once __DIR__ . '/../utils/SimulatorSessionRepository.php';

final class SimulatorController {
    public static function catalog(): void {
        Auth::requireAuth();
        SimulatorCatalogImporter::ensureImported(Database::getInstance());
        $pdo = self::pdo();
        Response::success([
            'subjects' => PublishedQuestionRepository::subjects($pdo),
            'catalogs' => self::publishedCatalogs($pdo),
        ]);
    }

    public static function overview(): void {
        $userId = Auth::requireAuth();
        $pdo = self::pdo();
        $repository = new SimulatorSessionRepository();
        Response::success(SimulatorRecommendation::overview(
            $repository->recentResponses($pdo, $userId),
            self::activeSessions($pdo, $userId)
        ));
    }

    public static function sessions(): void {
        $userId = Auth::requireAuth();
        $status = $_GET['status'] ?? null;
        if ($status !== null && $status !== 'active') {
            Response::error('Status de sessão inválido.');
        }

        Response::success(['sessions' => self::activeSessions(self::pdo(), $userId)]);
    }

    public static function create(): void {
        $userId = Auth::requireAuth();
        $data = self::body();
        $kind = $data['kind'] ?? null;
        if (!is_string($kind) || !in_array($kind, ['catalog', 'custom', 'practice'], true)) {
            Response::error('Tipo de simulado inválido.');
        }
        SimulatorCatalogImporter::ensureImported(Database::getInstance());
        $pdo = self::pdo();
        $sessionRepository = new SimulatorSessionRepository();
        if ($kind === 'catalog') {
            self::createFromCatalog($pdo, $sessionRepository, $userId, $data['catalog_id'] ?? null);
        }

        $count = self::count($data['count'] ?? null);
        $catalog = PublishedQuestionRepository::subjects($pdo);
        $availableSubjects = array_column($catalog, 'key');
        $subjects = self::subjects($data['subjects'] ?? null, $availableSubjects, $kind === 'practice');
        $topic = self::topic($data['topic'] ?? null);

        if ($kind === 'practice') {
            $overview = SimulatorRecommendation::overview($sessionRepository->recentResponses($pdo, $userId), []);
            $recommendation = $overview['recommendation'];
            if ($recommendation === null) {
                if (count($subjects) !== 1) {
                    Response::error('Escolha exatamente uma matéria para começar a prática.');
                }
                $topic = null;
            } else {
                $subjects = [$recommendation['subject']];
                $topic = $recommendation['topic'];
            }
        }

        $available = PublishedQuestionRepository::availableCount($pdo, $subjects, $topic);
        if ($available < $count) {
            Response::error('Não há questões publicadas suficientes para esta seleção.', 409, ['available' => $available]);
        }

        if ($kind === 'practice') {
            $wrongIds = $sessionRepository->wrongQuestionIds($pdo, $userId, $subjects, $topic);
            $recentIds = array_values(array_diff(
                $sessionRepository->recentlyUsedQuestionIds($pdo, $userId, $subjects, $topic),
                $wrongIds
            ));
            $questions = PublishedQuestionRepository::select($pdo, $subjects, $topic, $count, $recentIds, $wrongIds);
            if (count($questions) < $count) {
                $questions = PublishedQuestionRepository::select($pdo, $subjects, $topic, $count, [], $wrongIds);
            }
        } else {
            $questions = self::interleavedSelection($pdo, $subjects, $topic, $count);
        }

        self::respondCreated($pdo, $sessionRepository, $userId, $kind, count($subjects) === 1 ? $subjects[0] : null, $topic,
            $kind === 'practice' ? 1500 : max(1, $count * 150), array_column($questions, 'id'));
    }

    public static function show(string $id): void {
        $userId = Auth::requireAuth();
        $session = (new SimulatorSessionRepository())->find(self::pdo(), $userId, $id);
        if ($session === null) {
            Response::notFound('Sessão não encontrada.');
        }

        Response::success(['session' => self::sessionDto(self::pdo(), $session)]);
    }

    public static function questionImage(string $questionId, int $index): void {
        Auth::requireAuth();
        $statement = self::pdo()->prepare('SELECT images FROM simulator_questions WHERE id = ? AND published = 1');
        $statement->execute([$questionId]);
        $row = $statement->fetch();
        if (!$row) Response::notFound('Questão não encontrada.');

        $images = json_decode((string) $row['images'], true);
        $path = is_array($images) ? ($images[$index] ?? null) : null;
        if (!is_string($path) || !self::safeQuestionAssetPath($path)) Response::notFound('Imagem não encontrada.');

        self::serveQuestionAsset($path);
    }

    public static function questionReferenceImage(string $questionId, int $index): void {
        Auth::requireAuth();
        $statement = self::pdo()->prepare(
            "SELECT g.images
             FROM simulator_reference_group_questions m
             JOIN simulator_reference_groups g ON g.id = m.group_id
             WHERE m.question_id = ?"
        );
        $statement->execute([$questionId]);
        $row = $statement->fetch();
        if (!$row) Response::notFound('Material de referência não encontrado.');
        $images = json_decode((string) $row['images'], true);
        $path = is_array($images) ? ($images[$index] ?? null) : null;
        if (!is_string($path) || !self::safeReferenceAssetPath($path)) Response::notFound('Imagem não encontrada.');
        self::serveQuestionAsset($path);
    }

    public static function progress(string $id): void {
        $userId = Auth::requireAuth();
        $pdo = self::pdo();
        $repository = new SimulatorSessionRepository();
        $existing = $repository->find($pdo, $userId, $id);
        if ($existing === null) {
            Response::notFound('Sessão não encontrada.');
        }
        if ($existing['status'] !== 'active') {
            Response::error('A sessão já não aceita alterações.', 409);
        }

        $data = self::body();
        if (!array_key_exists('position', $data) || !array_key_exists('elapsed_seconds', $data) || !array_key_exists('answers', $data)
            || !is_int($data['position']) || !is_int($data['elapsed_seconds']) || !is_array($data['answers'])) {
            Response::error('Progresso de sessão inválido.');
        }
        try {
            $session = $repository->saveProgress($pdo, $userId, $id, $data['position'], $data['elapsed_seconds'], $data['answers']);
        } catch (InvalidArgumentException) {
            Response::error('Progresso de sessão inválido.');
        }
        if ($session === null) {
            Response::error('A sessão já não aceita alterações.', 409);
        }

        Response::success(['session' => self::sessionDto($pdo, $session)]);
    }

    public static function complete(string $id): void {
        $userId = Auth::requireAuth();
        $pdo = self::pdo();
        $repository = new SimulatorSessionRepository();
        $existing = $repository->find($pdo, $userId, $id);
        if ($existing === null) {
            Response::notFound('Sessão não encontrada.');
        }
        if (!in_array($existing['status'], ['active', 'completed'], true)) {
            Response::error('A sessão não pode ser concluída.', 409);
        }
        $completion = $repository->complete($pdo, $userId, $id);
        if ($completion === null) {
            Response::notFound('Sessão não encontrada.');
        }
        $session = $repository->find($pdo, $userId, $id);
        if ($session === null) {
            Response::notFound('Sessão não encontrada.');
        }

        Response::success(['session' => self::sessionDto($pdo, $session), 'result' => $completion['result']]);
    }

    /**
     * Takes questions from each chosen subject in turn, so a multi-subject simulator
     * mixes them instead of exhausting the first subject in source order.
     * @param list<string> $subjects
     * @return list<array<string, mixed>>
     */
    private static function interleavedSelection(PDO $pdo, array $subjects, ?string $topic, int $count): array {
        $pools = array_map(
            static fn(string $subject): array => PublishedQuestionRepository::select($pdo, [$subject], $topic, $count),
            $subjects
        );
        $questions = [];
        for ($round = 0; $round < $count && count($questions) < $count; $round++) {
            foreach ($pools as $pool) {
                if (isset($pool[$round]) && count($questions) < $count) {
                    $questions[] = $pool[$round];
                }
            }
        }

        return $questions;
    }

    /** A published catalog is played as an immutable session with its ordered questions. */
    private static function createFromCatalog(PDO $pdo, SimulatorSessionRepository $repository, int $userId, mixed $catalogId): never {
        if (!is_string($catalogId) || $catalogId === '' || strlen($catalogId) > 200) {
            Response::error('Simulado inválido.');
        }
        $catalog = self::publishedCatalogs($pdo, $catalogId)[0] ?? null;
        if ($catalog === null) {
            Response::notFound('Simulado não encontrado.');
        }
        $statement = $pdo->prepare('SELECT question_id FROM simulator_catalog_questions WHERE catalog_id = ? ORDER BY position ASC');
        $statement->execute([$catalogId]);
        $questionIds = array_map('strval', array_column($statement->fetchAll(), 'question_id'));
        $minutes = (int) ($catalog['duration_minutes'] ?? 0);

        self::respondCreated($pdo, $repository, $userId, 'catalog', $catalog['subject'], null,
            $minutes > 0 ? $minutes * 60 : count($questionIds) * 150, $questionIds);
    }

    /** @param list<string> $questionIds */
    private static function respondCreated(PDO $pdo, SimulatorSessionRepository $repository, int $userId, string $kind, ?string $subject, ?string $topic, int $limitSeconds, array $questionIds): never {
        try {
            $session = $repository->create($pdo, $userId, $kind, $subject, $topic, $limitSeconds, $questionIds);
        } catch (InvalidArgumentException) {
            Response::error('Dados da sessão inválidos.');
        }

        Response::json(['success' => true, 'data' => ['session' => self::sessionDto($pdo, $session)]], 201);
    }

    /**
     * Published catalogs whose questions are all currently published.
     * @return list<array{id: string, title: string, category: string, subject: string, question_count: int, duration_minutes: ?int}>
     */
    private static function publishedCatalogs(PDO $pdo, ?string $onlyId = null): array {
        $filter = $onlyId === null ? '' : 'AND catalogs.id = ?';
        $statement = $pdo->prepare(
            "SELECT catalogs.id, catalogs.title, catalogs.category, catalogs.subject, catalogs.duration_minutes,
                    COUNT(questions.id) AS question_count, COUNT(composition.question_id) AS composed_count
             FROM simulator_catalogs AS catalogs
             JOIN simulator_catalog_questions AS composition ON composition.catalog_id = catalogs.id
             LEFT JOIN simulator_questions AS questions ON questions.id = composition.question_id AND questions.published = 1
             WHERE catalogs.published = 1 {$filter}
             GROUP BY catalogs.id
             HAVING question_count > 0 AND question_count = composed_count
             ORDER BY CASE catalogs.category WHEN 'enem' THEN 0 ELSE 1 END,
                      CASE catalogs.category WHEN 'enem' THEN catalogs.title ELSE catalogs.id END"
        );
        $statement->execute($onlyId === null ? [] : [$onlyId]);

        return array_map(static fn(array $row): array => [
            'id' => (string) $row['id'], 'title' => (string) $row['title'], 'category' => (string) $row['category'],
            'subject' => (string) $row['subject'], 'question_count' => (int) $row['question_count'],
            'duration_minutes' => $row['duration_minutes'] === null ? null : (int) $row['duration_minutes'],
        ], $statement->fetchAll());
    }

    private static function safeQuestionAssetPath(string $path): bool {
        return self::safeAssetPath($path, 'assets/');
    }

    private static function safeReferenceAssetPath(string $path): bool {
        return self::safeAssetPath($path, 'reference-assets/');
    }

    private static function safeAssetPath(string $path, string $prefix): bool {
        return $path !== ''
            && !str_contains($path, '..')
            && !str_contains($path, '\\')
            && !str_starts_with($path, '/')
            && str_starts_with($path, $prefix)
            && preg_match('#^[A-Za-z0-9._/-]+$#', $path) === 1;
    }

    private static function serveQuestionAsset(string $path): never {
        $root = realpath(__DIR__ . '/../../content/enem');
        $file = realpath(__DIR__ . '/../../content/enem/' . $path);
        if ($root === false || $file === false || !str_starts_with($file, $root . DIRECTORY_SEPARATOR) || !is_file($file)) {
            Response::notFound('Imagem não encontrada.');
        }
        $mime = match (strtolower(pathinfo($file, PATHINFO_EXTENSION))) {
            'png' => 'image/png', 'jpg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'gif' => 'image/gif',
            default => null,
        };
        if ($mime === null) Response::notFound('Imagem não encontrada.');
        http_response_code(200);
        header('Content-Type: ' . $mime);
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, max-age=3600');
        readfile($file);
        exit;
    }

    private static function pdo(): PDO {
        return Database::getInstance()->getConnection();
    }

    /** @return array<string, mixed> */
    private static function body(): array {
        $raw = (string) file_get_contents('php://input');
        if ($raw === '' && PHP_SAPI === 'cli') {
            $raw = (string) file_get_contents('php://stdin');
        }
        try {
            $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            Response::error('Corpo da solicitação inválido.');
        }
        if (!is_array($data)) {
            Response::error('Corpo da solicitação inválido.');
        }

        return $data;
    }

    /** @return list<string> */
    private static function subjects(mixed $value, array $availableSubjects, bool $allowEmpty): array {
        if ($value === null && $allowEmpty) {
            return [];
        }
        if (!is_array($value) || count($value) < 1 || count($value) > 8) {
            Response::error('Escolha entre uma e oito matérias.');
        }
        $subjects = [];
        foreach ($value as $subject) {
            if (!is_string($subject) || trim($subject) === '' || mb_strlen(trim($subject)) > 120) {
                Response::error('Matéria inválida.');
            }
            $subject = trim($subject);
            if (!in_array($subject, $availableSubjects, true)) {
                Response::error('Matéria indisponível.');
            }
            $subjects[$subject] = $subject;
        }
        if (count($subjects) !== count($value)) {
            Response::error('Matérias não podem se repetir.');
        }

        return array_values($subjects);
    }

    private static function count(mixed $value): int {
        if (!is_int($value) || $value < 1 || $value > PublishedQuestionRepository::MAX_QUESTIONS) {
            Response::error('Quantidade de questões inválida.');
        }

        return $value;
    }

    private static function topic(mixed $value): ?string {
        if ($value === null) {
            return null;
        }
        if (!is_string($value) || trim($value) === '' || mb_strlen(trim($value)) > 120) {
            Response::error('Tópico inválido.');
        }

        return trim($value);
    }

    /** @return list<array<string, mixed>> */
    private static function activeSessions(PDO $pdo, int $userId): array {
        $statement = $pdo->prepare(
            "SELECT sessions.id, sessions.kind, sessions.status, sessions.subject, sessions.topic,
                    sessions.question_limit, sessions.time_limit_seconds, sessions.current_position,
                    sessions.elapsed_seconds, sessions.updated_at,
                    COUNT(answers.question_id) AS answered_count
             FROM simulator_sessions AS sessions
             LEFT JOIN simulator_session_answers AS answers
               ON answers.session_id = sessions.id AND answers.selected_option IS NOT NULL
             WHERE sessions.user_id = ? AND sessions.status = 'active'
             GROUP BY sessions.id
             ORDER BY sessions.updated_at DESC, sessions.id ASC"
        );
        $statement->execute([$userId]);

        return array_map(static fn(array $row): array => [
            'id' => (string) $row['id'], 'kind' => (string) $row['kind'], 'status' => (string) $row['status'],
            'subject' => $row['subject'], 'topic' => $row['topic'], 'question_limit' => (int) $row['question_limit'],
            'time_limit_seconds' => (int) $row['time_limit_seconds'], 'current_position' => (int) $row['current_position'],
            'elapsed_seconds' => (int) $row['elapsed_seconds'], 'answered_count' => (int) $row['answered_count'],
            'updated_at' => (string) $row['updated_at'],
        ], $statement->fetchAll());
    }

    /** @param array<string, mixed> $session @return array<string, mixed> */
    private static function sessionDto(PDO $pdo, array $session): array {
        $questionRows = self::questions($pdo, $session['id'], $session['status'] === 'completed');
        $answers = array_map(static function (array $answer) use ($session): array {
            $dto = [
                'question_id' => $answer['question_id'], 'selected_option' => $answer['selected_option'],
                'flagged' => $answer['flagged'],
            ];
            if ($session['status'] === 'completed') {
                $dto['is_correct'] = $answer['is_correct'];
            }
            return $dto;
        }, $session['answers']);

        return [
            'id' => $session['id'], 'kind' => $session['kind'], 'status' => $session['status'],
            'subject' => $session['subject'], 'topic' => $session['topic'], 'question_limit' => $session['question_limit'],
            'time_limit_seconds' => $session['time_limit_seconds'], 'current_position' => $session['current_position'],
            'elapsed_seconds' => $session['elapsed_seconds'], 'questions' => $questionRows, 'answers' => $answers,
            'result' => $session['result'],
        ];
    }

    /** @return list<array<string, mixed>> */
    private static function questions(PDO $pdo, string $sessionId, bool $includeCorrectOption): array {
        $statement = $pdo->prepare(
            'SELECT questions.id, questions.subject, questions.topic, questions.statement,
                    questions.option_a, questions.option_b, questions.option_c, questions.option_d, questions.option_e,
                    questions.images, questions.correct_option, composition.position,
                    reference_groups.id AS reference_id, reference_groups.title AS reference_title,
                    reference_groups.body AS reference_body, reference_groups.images AS reference_images
             FROM simulator_session_questions AS composition
             JOIN simulator_questions AS questions ON questions.id = composition.question_id
             LEFT JOIN simulator_reference_group_questions AS reference_members
               ON reference_members.question_id = questions.id
             LEFT JOIN simulator_reference_groups AS reference_groups
               ON reference_groups.id = reference_members.group_id
             WHERE composition.session_id = ?
             ORDER BY composition.position ASC'
        );
        $statement->execute([$sessionId]);

        return array_map(static function (array $row) use ($includeCorrectOption): array {
            $images = json_decode((string) $row['images'], true);
            $referenceImages = json_decode((string) ($row['reference_images'] ?? '[]'), true);
            $referenceImages = is_array($referenceImages) ? array_values($referenceImages) : [];
            $question = [
                'id' => (string) $row['id'], 'position' => (int) $row['position'], 'subject' => (string) $row['subject'],
                'topic' => $row['topic'], 'statement' => QuestionContent::statement($row['statement']),
                'options' => [
                    'A' => QuestionContent::option($row['option_a'], 'A'),
                    'B' => QuestionContent::option($row['option_b'], 'B'),
                    'C' => QuestionContent::option($row['option_c'], 'C'),
                    'D' => QuestionContent::option($row['option_d'], 'D'),
                    'E' => QuestionContent::option($row['option_e'], 'E'),
                ],
                'images' => is_array($images)
                    ? array_values(array_map(
                        static fn(mixed $_path, int $index): string => '/api/simulators/questions/' . rawurlencode((string) $row['id']) . '/images/' . $index,
                        $images,
                        array_keys($images)
                    ))
                    : [],
                'reference' => $row['reference_id'] === null ? null : [
                    'id' => (string) $row['reference_id'],
                    'title' => (string) $row['reference_title'],
                    'body' => (string) $row['reference_body'],
                    'images' => array_values(array_map(
                        static fn(mixed $_path, int $index): string => '/api/simulators/questions/' . rawurlencode((string) $row['id']) . '/reference-images/' . $index,
                        $referenceImages,
                        array_keys($referenceImages)
                    )),
                ],
            ];
            if ($includeCorrectOption) {
                $question['correct_option'] = (string) $row['correct_option'];
            }
            return $question;
        }, $statement->fetchAll());
    }
}
