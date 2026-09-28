<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/PublishedQuestionRepository.php';

final class SimulatorAdminController {
    public static function overview(): void {
        Auth::requireAdmin();
        $pdo = Database::getInstance()->getConnection();

        $stats = [
            'published_questions' => self::count($pdo, "SELECT COUNT(*) FROM simulator_questions WHERE published = 1"),
            'valid_enem' => self::count($pdo, "SELECT COUNT(*) FROM enem_questions WHERE status = 'valid'"),
            'pending_enem' => self::count($pdo, "SELECT COUNT(*) FROM enem_questions WHERE status = 'pending'"),
            'published_catalogs' => self::count($pdo, "SELECT COUNT(*) FROM simulator_catalogs WHERE published = 1"),
            'reference_groups' => self::count($pdo, 'SELECT COUNT(*) FROM simulator_reference_groups'),
        ];

        Response::success([
            'stats' => $stats,
            'reference_groups' => self::referenceGroups($pdo),
            'reference_candidates' => self::referenceCandidates($pdo),
        ]);
    }
    public static function createReferenceGroup(): void {
        $userId = Auth::requireAdmin();
        $data = self::body();
        $title = trim((string) ($data['title'] ?? ''));
        $body = trim((string) ($data['body'] ?? ''));
        $questionIds = $data['question_ids'] ?? null;

        if ($title === '' || mb_strlen($title) > 180) Response::error('Título de referência inválido.');
        if ($body === '' || mb_strlen($body) > 20000) Response::error('Texto-base inválido.');
        if (!is_array($questionIds) || count($questionIds) < 1 || count($questionIds) > 30) {
            Response::error('Selecione entre 1 e 30 questões.');
        }

        $questionIds = array_values(array_unique($questionIds));
        foreach ($questionIds as $id) {
            if (!PublishedQuestionRepository::isQuestionId($id)) Response::error('Questão inválida.');
        }

        $pdo = Database::getInstance()->getConnection();
        self::assertPublishedQuestions($pdo, $questionIds);
        $id = bin2hex(random_bytes(16));
        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO simulator_reference_groups (id, title, body, created_by) VALUES (?, ?, ?, ?)'
            )->execute([$id, $title, $body, $userId]);
            $insert = $pdo->prepare(
                'INSERT INTO simulator_reference_group_questions (group_id, question_id, position) VALUES (?, ?, ?)'
            );
            foreach ($questionIds as $position => $questionId) {
                $insert->execute([$id, $questionId, $position]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ($error instanceof PDOException && str_contains($error->getMessage(), 'UNIQUE')) {
                Response::error('Uma das questões já pertence a outro texto-base.', 409);
            }
            throw $error;
        }

        Response::json(['success' => true, 'data' => ['id' => $id]], 201);
    }

    private static function referenceGroups(PDO $pdo): array {
        $rows = $pdo->query(
            "SELECT g.id, g.title, g.review_status, g.updated_at, COUNT(m.question_id) AS question_count
             FROM simulator_reference_groups g
             LEFT JOIN simulator_reference_group_questions m ON m.group_id = g.id
             GROUP BY g.id ORDER BY g.updated_at DESC LIMIT 100"
        )->fetchAll();
        return array_map(static fn(array $row): array => [
            'id' => (string) $row['id'],
            'title' => (string) $row['title'],
            'review_status' => (string) $row['review_status'],
            'question_count' => (int) $row['question_count'],
            'updated_at' => (string) $row['updated_at'],
        ], $rows);
    }
    private static function referenceCandidates(PDO $pdo): array {
        $statement = $pdo->query(
            "SELECT q.id, q.subject, q.topic, q.statement
             FROM simulator_questions q
             LEFT JOIN simulator_reference_group_questions m ON m.question_id = q.id
             WHERE q.published = 1 AND m.question_id IS NULL
               AND (
                    lower(q.statement) LIKE '%de acordo com o texto%'
                 OR lower(q.statement) LIKE '%com base no texto%'
                 OR lower(q.statement) LIKE '%segundo o texto%'
                 OR lower(q.statement) LIKE '%no texto acima%'
                 OR lower(q.statement) LIKE '%fragmento acima%'
               )
             ORDER BY q.sort_key ASC, q.id ASC
             LIMIT 100"
        );
        return array_map(static fn(array $row): array => [
            'id' => (string) $row['id'],
            'subject' => (string) $row['subject'],
            'topic' => $row['topic'] === null ? null : (string) $row['topic'],
            'statement_preview' => mb_substr(trim((string) $row['statement']), 0, 260),
        ], $statement->fetchAll());
    }

    private static function assertPublishedQuestions(PDO $pdo, array $questionIds): void {
        $placeholders = implode(',', array_fill(0, count($questionIds), '?'));
        $statement = $pdo->prepare(
            "SELECT id FROM simulator_questions WHERE published = 1 AND id IN ({$placeholders})"
        );
        $statement->execute($questionIds);
        $found = array_map('strval', array_column($statement->fetchAll(), 'id'));
        if (count($found) !== count($questionIds)) Response::error('Há questões indisponíveis na seleção.', 409);
    }
    private static function count(PDO $pdo, string $sql): int {
        return (int) $pdo->query($sql)->fetchColumn();
    }

    private static function body(): array {
        $raw = (string) file_get_contents('php://input');
        if ($raw === '' && PHP_SAPI === 'cli') $raw = (string) file_get_contents('php://stdin');
        try {
            $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            Response::error('Corpo da solicitação inválido.');
        }
        if (!is_array($data)) Response::error('Corpo da solicitação inválido.');
        return $data;
    }
}
