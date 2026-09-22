<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/PublishedQuestionRepository.php';
require_once __DIR__ . '/../utils/SimulatorRecommendation.php';
require_once __DIR__ . '/../utils/SimulatorSessionRepository.php';

final class SimulatorController {
    public static function catalog(): void {
        Auth::requireAuth();
        Response::success(['subjects' => PublishedQuestionRepository::subjects(self::pdo())]);
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
        $count = self::count($data['count'] ?? null);
        $pdo = self::pdo();
        $catalog = PublishedQuestionRepository::subjects($pdo);
        $availableSubjects = array_column($catalog, 'key');
        $subjects = self::subjects($data['subjects'] ?? null, $availableSubjects, $kind === 'practice');
        $topic = self::topic($data['topic'] ?? null);

        if ($kind === 'practice') {
            $overview = SimulatorRecommendation::overview(
                (new SimulatorSessionRepository())->recentResponses($pdo, $userId),
                []
            );
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

        $questions = PublishedQuestionRepository::select($pdo, $subjects, $topic, $count);
        if (count($questions) !== $count) {
            Response::error('Não há questões publicadas suficientes para esta seleção.', 409);
        }

        try {
            $session = (new SimulatorSessionRepository())->create(
                $pdo,
                $userId,
                $kind,
                count($subjects) === 1 ? $subjects[0] : null,
                $topic,
                $kind === 'practice' ? 1500 : max(1, $count * 150),
                array_column($questions, 'id')
            );
        } catch (InvalidArgumentException) {
            Response::error('Dados da sessão inválidos.');
        }

        Response::json(['success' => true, 'data' => ['session' => self::sessionDto($pdo, $session)]], 201);
    }

    public static function show(string $id): void {
        $userId = Auth::requireAuth();
        $session = (new SimulatorSessionRepository())->find(self::pdo(), $userId, $id);
        if ($session === null) {
            Response::notFound('Sessão não encontrada.');
        }

        Response::success(['session' => self::sessionDto(self::pdo(), $session)]);
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
        if (!is_array($value) || count($value) < 1 || count($value) > 4) {
            Response::error('Escolha entre uma e quatro matérias.');
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
        if (!is_int($value) || $value < 1 || $value > 90) {
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
            'SELECT questions.id, questions.area, questions.topic, questions.statement,
                    questions.option_a, questions.option_b, questions.option_c, questions.option_d, questions.option_e,
                    questions.images, questions.correct_option, composition.position
             FROM simulator_session_questions AS composition
             JOIN enem_questions AS questions ON questions.id = composition.question_id
             WHERE composition.session_id = ?
             ORDER BY composition.position ASC'
        );
        $statement->execute([$sessionId]);

        return array_map(static function (array $row) use ($includeCorrectOption): array {
            $images = json_decode((string) $row['images'], true);
            $question = [
                'id' => (int) $row['id'], 'position' => (int) $row['position'], 'subject' => (string) $row['area'],
                'topic' => $row['topic'], 'statement' => (string) $row['statement'],
                'options' => ['A' => $row['option_a'], 'B' => $row['option_b'], 'C' => $row['option_c'], 'D' => $row['option_d'], 'E' => $row['option_e']],
                'images' => is_array($images) ? $images : [],
            ];
            if ($includeCorrectOption) {
                $question['correct_option'] = (string) $row['correct_option'];
            }
            return $question;
        }, $statement->fetchAll());
    }
}
