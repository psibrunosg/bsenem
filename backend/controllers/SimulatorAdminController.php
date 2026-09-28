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
    public static function questions(): void {
        Auth::requireAdmin();
        $pdo = Database::getInstance()->getConnection();

        $page = max(1, (int) ($_GET['page'] ?? 1));
        $perPage = max(10, min(50, (int) ($_GET['per_page'] ?? 20)));
        $source = in_array($_GET['source'] ?? 'all', ['all', 'enem', 'concursos'], true) ? (string) ($_GET['source'] ?? 'all') : 'all';
        $status = in_array($_GET['status'] ?? 'all', ['all', 'valid', 'pending'], true) ? (string) ($_GET['status'] ?? 'all') : 'all';
        $reference = in_array($_GET['reference'] ?? 'all', ['all', 'linked', 'unlinked'], true) ? (string) ($_GET['reference'] ?? 'all') : 'all';
        $subject = trim((string) ($_GET['subject'] ?? ''));
        $search = trim((string) ($_GET['q'] ?? ''));
        $year = trim((string) ($_GET['year'] ?? ''));

        $base = "WITH audit AS (
            SELECT 'inep:' || q.id AS id, 'enem' AS source, q.status, q.year, q.day, q.question_number,
                   q.area AS subject, q.topic, q.statement,
                   q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
                   q.correct_option, q.images, q.source_pdf, q.source_pages, q.source_page,
                   q.pending_reason, q.inep_url, q.mirror_url, NULL AS provider, NULL AS source_json
            FROM enem_questions q
            UNION ALL
            SELECT b.id, 'concursos', 'valid',
                   CAST(json_extract(b.source_json, '$.year') AS INTEGER), NULL, NULL,
                   b.subject, NULL, b.statement,
                   json_extract(b.options_json, '$[0]'), json_extract(b.options_json, '$[1]'),
                   json_extract(b.options_json, '$[2]'), json_extract(b.options_json, '$[3]'),
                   json_extract(b.options_json, '$[4]'),
                   substr('ABCDE', b.correct_option + 1, 1), '[]', NULL, '[]', NULL,
                   NULL, NULL, NULL, b.provider, b.source_json
            FROM simulator_question_bank b WHERE b.category = 'concursos'
        )";

        $where = ['1 = 1'];
        $params = [];
        if ($source !== 'all') { $where[] = 'a.source = ?'; $params[] = $source; }
        if ($status !== 'all') { $where[] = 'a.status = ?'; $params[] = $status; }
        if ($subject !== '') { $where[] = 'a.subject = ?'; $params[] = $subject; }
        if ($year !== '' && ctype_digit($year)) { $where[] = 'a.year = ?'; $params[] = (int) $year; }
        if ($search !== '') {
            $where[] = '(a.statement LIKE ? OR a.id LIKE ?)';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
        }
        if ($reference === 'linked') $where[] = 'rgq.question_id IS NOT NULL';
        if ($reference === 'unlinked') $where[] = 'rgq.question_id IS NULL';
        $whereSql = implode(' AND ', $where);

        $count = $pdo->prepare($base . " SELECT COUNT(*) FROM audit a
            LEFT JOIN simulator_reference_group_questions rgq ON rgq.question_id = a.id
            WHERE {$whereSql}");
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        $sql = $base . " SELECT a.*, rg.id AS reference_id, rg.title AS reference_title
            FROM audit a
            LEFT JOIN simulator_reference_group_questions rgq ON rgq.question_id = a.id
            LEFT JOIN simulator_reference_groups rg ON rg.id = rgq.group_id
            WHERE {$whereSql}
            ORDER BY COALESCE(a.year, 9999) DESC, a.source ASC, COALESCE(a.day, 0), COALESCE(a.question_number, 0), a.id
            LIMIT ? OFFSET ?";
        $statement = $pdo->prepare($sql);
        $statement->execute([...$params, $perPage, ($page - 1) * $perPage]);

        Response::success([
            'items' => array_map([self::class, 'auditQuestion'], $statement->fetchAll()),
            'pagination' => ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'pages' => max(1, (int) ceil($total / $perPage))],
            'filters' => [
                'subjects' => self::auditSubjects($pdo),
                'years' => self::auditYears($pdo),
            ],
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

    private static function auditQuestion(array $row): array {
        $images = json_decode((string) ($row['images'] ?? '[]'), true);
        $pages = json_decode((string) ($row['source_pages'] ?? '[]'), true);
        $source = json_decode((string) ($row['source_json'] ?? '{}'), true);
        return [
            'id' => (string) $row['id'],
            'source' => (string) $row['source'],
            'status' => (string) $row['status'],
            'year' => $row['year'] === null ? null : (int) $row['year'],
            'day' => $row['day'] === null ? null : (int) $row['day'],
            'question_number' => $row['question_number'] === null ? null : (int) $row['question_number'],
            'subject' => (string) $row['subject'],
            'topic' => $row['topic'] === null ? null : (string) $row['topic'],
            'statement' => (string) $row['statement'],
            'options' => [
                'A' => (string) ($row['option_a'] ?? ''),
                'B' => (string) ($row['option_b'] ?? ''),
                'C' => (string) ($row['option_c'] ?? ''),
                'D' => (string) ($row['option_d'] ?? ''),
                'E' => (string) ($row['option_e'] ?? ''),
            ],
            'correct_option' => $row['correct_option'] === null ? null : (string) $row['correct_option'],
            'images' => is_array($images) ? $images : [],
            'source_pdf' => $row['source_pdf'] === null ? null : (string) $row['source_pdf'],
            'source_page' => $row['source_page'] === null ? null : (int) $row['source_page'],
            'source_pages' => is_array($pages) ? $pages : [],
            'pending_reason' => $row['pending_reason'] === null ? null : (string) $row['pending_reason'],
            'inep_url' => $row['inep_url'] === null ? null : (string) $row['inep_url'],
            'mirror_url' => $row['mirror_url'] === null ? null : (string) $row['mirror_url'],
            'provider' => $row['provider'] === null ? null : (string) $row['provider'],
            'source_meta' => is_array($source) ? $source : [],
            'reference' => $row['reference_id'] === null ? null : [
                'id' => (string) $row['reference_id'],
                'title' => (string) $row['reference_title'],
            ],
        ];
    }

    private static function auditSubjects(PDO $pdo): array {
        $rows = $pdo->query(
            "SELECT subject FROM (
                SELECT area AS subject FROM enem_questions
                UNION SELECT subject FROM simulator_question_bank WHERE category = 'concursos'
             ) WHERE subject IS NOT NULL AND subject <> '' ORDER BY subject"
        )->fetchAll();
        return array_values(array_map('strval', array_column($rows, 'subject')));
    }

    private static function auditYears(PDO $pdo): array {
        $rows = $pdo->query(
            "SELECT DISTINCT year FROM (
                SELECT year FROM enem_questions
                UNION ALL
                SELECT CAST(json_extract(source_json, '$.year') AS INTEGER) FROM simulator_question_bank WHERE category = 'concursos'
             ) WHERE year IS NOT NULL ORDER BY year DESC"
        )->fetchAll();
        return array_values(array_map('intval', array_column($rows, 'year')));
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
