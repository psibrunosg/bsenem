<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../services/SimulatorCatalogImporter.php';
require_once __DIR__ . '/../utils/request.php';

final class SimulatorController {
    public static function catalog(): void {
        Auth::requireAuth();
        $db = Database::getInstance();
        SimulatorCatalogImporter::ensureImported($db);
        $catalogs = $db->fetchAll(
            'SELECT c.id, c.title, c.category, c.subject, c.duration_minutes, COUNT(q.question_id) AS question_count
             FROM simulator_catalogs c
             LEFT JOIN simulator_catalog_questions q ON q.catalog_id = c.id
             WHERE c.published = 1
             GROUP BY c.id
             HAVING question_count > 0
             ORDER BY CASE c.category WHEN "enem" THEN 0 ELSE 1 END, c.title'
        );
        $subjects = $db->fetchAll(
            'SELECT category, subject, COUNT(*) AS question_count
             FROM simulator_question_bank
             GROUP BY category, subject
             ORDER BY category, subject'
        );
        Response::success(['catalogs' => $catalogs, 'subjects' => $subjects]);
    }

    public static function published(string $catalogId): void {
        Auth::requireAuth();
        $db = Database::getInstance();
        SimulatorCatalogImporter::ensureImported($db);
        $catalog = $db->fetch('SELECT id, title, category, subject, duration_minutes FROM simulator_catalogs WHERE id = ? AND published = 1', [$catalogId]);
        if (!$catalog) {
            Response::notFound('Simulado não encontrado');
        }
        $questions = self::questions(
            $db,
            'SELECT q.* FROM simulator_catalog_questions c JOIN simulator_question_bank q ON q.id = c.question_id WHERE c.catalog_id = ? ORDER BY c.position',
            [$catalogId]
        );
        Response::success(['exam' => self::exam($catalog, $questions)]);
    }

    public static function generate(): void {
        $userId = Auth::requireAuth();
        $data = self::body();
        $subjects = array_values(array_unique(array_filter($data['subjects'] ?? [], static fn($subject) => is_string($subject) && trim($subject) !== '')));
        $subjects = array_map(static fn($subject) => trim($subject), $subjects);
        $count = (int) ($data['question_count'] ?? 0);
        if ($subjects === [] || count($subjects) > 8 || $count < 1 || $count > 200) {
            Response::error('Escolha de 1 a 8 matérias e de 1 a 200 questões');
        }

        $db = Database::getInstance();
        SimulatorCatalogImporter::ensureImported($db);
        $marks = implode(', ', array_fill(0, count($subjects), '?'));
        $available = (int) (($db->fetch("SELECT COUNT(*) AS total FROM simulator_question_bank WHERE subject IN ({$marks})", $subjects)['total'] ?? 0));
        if ($available < $count) {
            Response::error("Há somente {$available} questões validadas para as matérias escolhidas");
        }
        $rows = $db->fetchAll("SELECT * FROM simulator_question_bank WHERE subject IN ({$marks}) ORDER BY RANDOM() LIMIT {$count}", $subjects);
        if (count($rows) !== $count) {
            Response::error('Não foi possível montar o simulado com questões distintas');
        }

        $id = 'custom-' . bin2hex(random_bytes(12));
        $title = 'Simulado personalizado — ' . implode(' + ', $subjects) . " ({$count} questões)";
        $pdo = $db->getConnection();
        $pdo->beginTransaction();
        try {
            $pdo->prepare('INSERT INTO generated_simulators (id, user_id, title, subjects_json, question_count) VALUES (?, ?, ?, ?, ?)')
                ->execute([$id, $userId, $title, json_encode($subjects, JSON_UNESCAPED_UNICODE), $count]);
            $join = $pdo->prepare('INSERT INTO generated_simulator_questions (simulator_id, question_id, position) VALUES (?, ?, ?)');
            foreach ($rows as $position => $row) {
                $join->execute([$id, $row['id'], $position + 1]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        $exam = ['id' => $id, 'title' => $title, 'subject' => implode(' + ', $subjects), 'durationMinutes' => null, 'questions' => self::questionRows($rows)];
        Response::success(['exam' => $exam], 'Simulado personalizado criado');
    }

    public static function generated(string $simulatorId): void {
        $userId = Auth::requireAuth();
        $db = Database::getInstance();
        $simulator = $db->fetch('SELECT id, title, subjects_json, question_count, duration_minutes FROM generated_simulators WHERE id = ? AND user_id = ?', [$simulatorId, $userId]);
        if (!$simulator) Response::notFound('Simulado não encontrado');
        $questions = self::questions($db, 'SELECT q.* FROM generated_simulator_questions g JOIN simulator_question_bank q ON q.id = g.question_id WHERE g.simulator_id = ? ORDER BY g.position', [$simulatorId]);
        $exam = [
            'id' => $simulator['id'],
            'title' => $simulator['title'],
            'subject' => implode(' + ', json_decode((string) $simulator['subjects_json'], true) ?: []),
            'durationMinutes' => $simulator['duration_minutes'] ? (int) $simulator['duration_minutes'] : null,
            'questions' => $questions,
        ];
        Response::success(['exam' => $exam]);
    }

    public static function attempt(string $simulatorId): void {
        $userId = Auth::requireAuth();
        $data = self::body();
        $db = Database::getInstance();
        $simulator = $db->fetch('SELECT id FROM generated_simulators WHERE id = ? AND user_id = ?', [$simulatorId, $userId]);
        if (!$simulator) Response::notFound('Simulado não encontrado');
        $attemptId = self::saveAttempt($db, 'generated_simulator_attempts', 'simulator_id', $simulatorId, $userId, $data);
        Response::success(['id' => $attemptId], 'Resultado salvo');
    }

    public static function catalogAttempt(string $catalogId): void {
        $userId = Auth::requireAuth();
        $data = self::body();
        $db = Database::getInstance();
        SimulatorCatalogImporter::ensureImported($db);
        if (!$db->fetch('SELECT id FROM simulator_catalogs WHERE id = ? AND published = 1', [$catalogId])) {
            Response::notFound('Simulado não encontrado');
        }
        $attemptId = self::saveAttempt($db, 'catalog_simulator_attempts', 'catalog_id', $catalogId, $userId, $data);
        Response::success(['id' => $attemptId], 'Resultado salvo');
    }

    private static function questions(Database $db, string $sql, array $params): array {
        return self::questionRows($db->fetchAll($sql, $params));
    }

    private static function questionRows(array $rows): array {
        return array_map(static fn($row) => [
            'id' => $row['id'],
            'statement' => $row['statement'],
            'options' => json_decode((string) $row['options_json'], true) ?: [],
            'correctOption' => (int) $row['correct_option'],
            'explanation' => $row['explanation'] ?? '',
            'subject' => $row['subject'],
        ], $rows);
    }

    private static function exam(array $catalog, array $questions): array {
        return [
            'id' => $catalog['id'],
            'title' => $catalog['title'],
            'subject' => $catalog['subject'],
            'durationMinutes' => $catalog['duration_minutes'] ? (int) $catalog['duration_minutes'] : null,
            'questions' => $questions,
        ];
    }

    private static function body(): array {
        return readJsonRequestBody() ?? [];
    }

    private static function saveAttempt(Database $db, string $table, string $referenceColumn, string $referenceId, int $userId, array $data): string {
        $score = (float) ($data['score'] ?? -1);
        $total = (int) ($data['total_questions'] ?? 0);
        if ($score < 0 || $score > 100 || $total < 1 || !is_array($data['answers'] ?? null)) {
            Response::error('Resultado do simulado inválido');
        }
        return $db->insert($table, [
            $referenceColumn => $referenceId,
            'user_id' => $userId,
            'score' => $score,
            'total_questions' => $total,
            'answers_json' => json_encode($data['answers'], JSON_UNESCAPED_UNICODE),
            'time_spent' => max(0, (int) ($data['time_spent'] ?? 0)),
        ]);
    }
}
