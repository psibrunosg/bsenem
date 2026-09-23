<?php

declare(strict_types=1);

require_once __DIR__ . '/EnemQuestionImporter.php';

/**
 * Seeds simulator content from versioned repository files on first use:
 * ENEM questions (enem_questions), concursos (simulator_question_bank) and the
 * published catalogs. ENEM catalogs reference 'inep:<enem_questions.id>'.
 * Set APP_CONTENT_IMPORT=off to keep a database with only synthetic content.
 */
final class SimulatorCatalogImporter {
    public static function ensureImported(Database $db): void {
        if (getenv('APP_CONTENT_IMPORT') === 'off') {
            return;
        }

        $pdo = $db->getConnection();
        $hasEnem = (int) $pdo->query('SELECT COUNT(*) FROM enem_questions')->fetchColumn() > 0;
        $hasCatalogs = (int) $pdo->query('SELECT COUNT(*) FROM simulator_catalog_questions')->fetchColumn() > 0;
        if ($hasEnem && $hasCatalogs) {
            return;
        }

        $pdo->beginTransaction();
        try {
            if (!$hasEnem) {
                EnemQuestionImporter::import($pdo);
            }
            if (!$hasCatalogs) {
                self::importEnem($pdo);
                self::importConcursos($pdo);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }
    }

    /** Publishes each ENEM exam only when every question maps to a published enem_questions row. */
    private static function importEnem(PDO $pdo): void {
        $files = glob(dirname(__DIR__, 2) . '/content/enem/*.bsestudos.exam.json') ?: [];
        sort($files, SORT_STRING);
        $lookup = $pdo->prepare(
            "SELECT id FROM enem_questions
             WHERE year = ? AND day = ? AND question_number = ?
               AND status = 'valid' AND correct_option IN ('A', 'B', 'C', 'D', 'E')"
        );
        foreach ($files as $file) {
            $exam = self::readJson($file);
            if (!is_array($exam) || !is_array($exam['questions'] ?? null) || $exam['questions'] === []) {
                continue;
            }
            $questionIds = [];
            foreach ($exam['questions'] as $question) {
                if (!preg_match('/^enem-(\d{4})-d(\d)-q(\d{1,3})$/', (string) ($question['id'] ?? ''), $match)) {
                    continue 2;
                }
                $lookup->execute([(int) $match[1], (int) $match[2], (int) $match[3]]);
                $enemId = $lookup->fetchColumn();
                if ($enemId === false) {
                    continue 2;
                }
                $questionIds[] = 'inep:' . $enemId;
            }

            $catalogId = 'enem:' . (string) ($exam['id'] ?? basename($file));
            self::upsertCatalog($pdo, [
                    $catalogId,
                    trim((string) ($exam['title'] ?? 'Simulado ENEM')),
                    'enem',
                    trim((string) ($exam['subject'] ?? 'ENEM')),
                    max(0, (int) ($exam['durationMinutes'] ?? 0)) ?: null,
            ]);
            $join = $pdo->prepare('INSERT OR IGNORE INTO simulator_catalog_questions (catalog_id, question_id, position) VALUES (?, ?, ?)');
            foreach (array_values(array_unique($questionIds)) as $position => $questionId) {
                $join->execute([$catalogId, $questionId, $position + 1]);
            }
        }
    }

    private static function importConcursos(PDO $pdo): void {
        $questions = self::readJson(dirname(__DIR__, 2) . '/docs/sources/concursos/extracted-questions-sul.json');
        if (!is_array($questions)) {
            return;
        }
        $catalogs = [];
        foreach ($questions as $position => $question) {
            if (!is_array($question) || !is_array($question['alternativas'] ?? null)) {
                continue;
            }
            $options = array_values($question['alternativas']);
            $answer = strtoupper(trim((string) ($question['gabarito_oficial'] ?? '')));
            $correct = array_search($answer, ['A', 'B', 'C', 'D', 'E'], true);
            if (count($options) !== 5 || $correct === false || trim((string) ($question['enunciado'] ?? '')) === '') {
                continue;
            }
            $track = self::concursoTrack((string) ($question['cargo_alvo'] ?? ''), (string) ($question['disciplina'] ?? ''));
            $questionId = 'concursos:' . (string) ($question['id'] ?? $position);
            self::insertQuestion($pdo, $questionId, 'Concursos Sul', 'concursos', $track, (string) $question['enunciado'], $options, $correct, '', [
                'state' => $question['estado'] ?? null,
                'year' => $question['ano'] ?? null,
                'organization' => $question['orgao'] ?? null,
                'board' => $question['banca'] ?? null,
                'discipline' => $question['disciplina'] ?? null,
                'target_role' => $question['cargo_alvo'] ?? null,
            ]);
            $catalogId = 'concursos:' . self::slug($track);
            if (!isset($catalogs[$catalogId])) {
                self::upsertCatalog($pdo, [$catalogId, 'Concursos — ' . $track, 'concursos', $track, null]);
                $catalogs[$catalogId] = 0;
            }
            $catalogs[$catalogId] = ($catalogs[$catalogId] ?? 0) + 1;
            $pdo->prepare('INSERT OR IGNORE INTO simulator_catalog_questions (catalog_id, question_id, position) VALUES (?, ?, ?)')
                ->execute([$catalogId, $questionId, $catalogs[$catalogId]]);
        }
    }

    /**
     * Catalog rows are updated in place, never deleted: legacy attempts reference them.
     * @param array{0: string, 1: string, 2: string, 3: string, 4: ?int} $catalog
     */
    private static function upsertCatalog(PDO $pdo, array $catalog): void {
        $pdo->prepare(
            'INSERT INTO simulator_catalogs (id, title, category, subject, duration_minutes, published) VALUES (?, ?, ?, ?, ?, 1)
             ON CONFLICT(id) DO UPDATE SET title = excluded.title, category = excluded.category,
                subject = excluded.subject, duration_minutes = excluded.duration_minutes, published = 1'
        )->execute($catalog);
    }

    private static function insertQuestion(PDO $pdo, string $id, string $provider, string $category, string $subject, string $statement, array $options, int $correct, string $explanation, array $source): void {
        if (trim($statement) === '' || count($options) !== 5 || $correct < 0 || $correct > 4) {
            return;
        }
        $pdo->prepare('INSERT OR IGNORE INTO simulator_question_bank (id, provider, category, subject, statement, options_json, correct_option, explanation, source_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$id, $provider, $category, $subject, $statement, json_encode(array_values($options), JSON_UNESCAPED_UNICODE), $correct, $explanation, json_encode($source, JSON_UNESCAPED_UNICODE)]);
    }

    private static function concursoTrack(string $role, string $discipline): string {
        $normalized = self::lower($role);
        if (str_contains($normalized, 'psic')) return 'Psicologia';
        if (str_contains($normalized, 'nutri')) return 'Nutrição';
        if (str_contains($normalized, 'educa') && str_contains($normalized, 'fís')) return 'Educação Física';
        return trim($discipline) !== '' ? trim($discipline) : 'Conhecimentos gerais';
    }

    private static function slug(string $value): string {
        $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
        return trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower($value)), '-');
    }

    private static function lower(string $value): string {
        return function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
    }

    private static function readJson(string $path): mixed {
        $json = is_file($path) ? file_get_contents($path) : false;
        return is_string($json) ? json_decode($json, true) : null;
    }
}
