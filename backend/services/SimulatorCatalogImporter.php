<?php

declare(strict_types=1);

require_once __DIR__ . '/EnemQuestionImporter.php';
require_once __DIR__ . '/EnemReferenceGroupImporter.php';
require_once __DIR__ . '/EnemQualityGateImporter.php';

/**
 * Seeds simulator content from versioned repository files on first use:
 * ENEM questions (enem_questions), concursos (simulator_question_bank) and the
 * published catalogs. ENEM catalogs reference 'inep:<enem_questions.id>'.
 * Set APP_CONTENT_IMPORT=off to keep a database with only synthetic content.
 */
final class SimulatorCatalogImporter {
    private const CADERNO_SIZE = 50;
    private const CADERNO_MINUTES_PER_QUESTION = 3;

    public static function ensureImported(Database $db): void {
        if (getenv('APP_CONTENT_IMPORT') === 'off') {
            return;
        }

        $pdo = $db->getConnection();
        $hasEnem = (int) $pdo->query('SELECT COUNT(*) FROM enem_questions')->fetchColumn() > 0;
        $hasCatalogs = (int) $pdo->query('SELECT COUNT(*) FROM simulator_catalog_questions')->fetchColumn() > 0;

        $pdo->beginTransaction();
        try {
            if (!$hasEnem) {
                EnemQuestionImporter::import($pdo);
            }
            EnemReferenceGroupImporter::import($pdo);
            $quality = EnemQualityGateImporter::import($pdo);

            if (!$hasCatalogs || $quality['changed']) {
                self::importEnem($pdo);
            }
            if (!$hasCatalogs) {
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

    /**
     * Imports the generic ENEM simulator catalogs. If a curated item is
     * quarantined, it is replaced deterministically by another approved
     * official ENEM question from the same area. The replacement is logged.
     */
    private static function importEnem(PDO $pdo): void {
        $files = glob(dirname(__DIR__, 2) . '/content/enem/*.bsestudos.exam.json') ?: [];
        sort($files, SORT_STRING);

        $lookup = $pdo->prepare(
            "SELECT id, area, year, status, quality_status, quality_reason, correct_option
             FROM enem_questions
             WHERE year = ? AND day = ? AND question_number = ?"
        );
        $candidate = $pdo->prepare(
            "SELECT id FROM enem_questions
             WHERE area = ? AND status = 'valid' AND quality_status = 'approved'
               AND correct_option IN ('A', 'B', 'C', 'D', 'E')
             ORDER BY CASE WHEN year = ? THEN 0 ELSE 1 END,
                      ABS(year - ?), year DESC, day ASC, question_number ASC, id ASC"
        );
        $deleteComposition = $pdo->prepare('DELETE FROM simulator_catalog_questions WHERE catalog_id = ?');
        $deleteReplacements = $pdo->prepare('DELETE FROM simulator_catalog_replacements WHERE catalog_id = ?');
        $join = $pdo->prepare(
            'INSERT INTO simulator_catalog_questions (catalog_id, question_id, position) VALUES (?, ?, ?)'
        );
        $replacement = $pdo->prepare(
            'INSERT INTO simulator_catalog_replacements
                (catalog_id, position, original_question_id, replacement_question_id, reason)
             VALUES (?, ?, ?, ?, ?)'
        );

        foreach ($files as $file) {
            $exam = self::readJson($file);
            if (!is_array($exam) || !is_array($exam['questions'] ?? null) || $exam['questions'] === []) {
                continue;
            }

            $catalogId = 'enem:' . (string) ($exam['id'] ?? basename($file));
            $questionIds = [];
            $replacementRows = [];
            $used = [];
            $validExam = true;

            foreach (array_values($exam['questions']) as $position => $question) {
                if (!preg_match('/^enem-(\d{4})-d(\d)-q(\d{1,3})$/', (string) ($question['id'] ?? ''), $match)) {
                    $validExam = false;
                    break;
                }

                $year = (int) $match[1];
                $lookup->execute([$year, (int) $match[2], (int) $match[3]]);
                $source = $lookup->fetch();
                if (!$source) {
                    $validExam = false;
                    break;
                }

                $originalId = 'inep:' . (int) $source['id'];
                $eligible = $source['status'] === 'valid'
                    && $source['quality_status'] === 'approved'
                    && in_array($source['correct_option'], ['A', 'B', 'C', 'D', 'E'], true);

                $selectedId = $originalId;
                if (!$eligible || isset($used[$selectedId])) {
                    $candidate->execute([(string) $source['area'], $year, $year]);
                    $replacementId = null;
                    foreach ($candidate->fetchAll(PDO::FETCH_COLUMN) as $candidateId) {
                        $candidateKey = 'inep:' . (int) $candidateId;
                        if (!isset($used[$candidateKey]) && $candidateKey !== $originalId) {
                            $replacementId = $candidateKey;
                            break;
                        }
                    }
                    if ($replacementId === null) {
                        $validExam = false;
                        break;
                    }

                    $selectedId = $replacementId;
                    $reason = trim((string) ($source['quality_reason'] ?? ''));
                    if ($reason === '') {
                        $reason = $source['status'] !== 'valid'
                            ? 'source_status:' . (string) $source['status']
                            : 'duplicate_or_unpublished_source';
                    }
                    $replacementRows[] = [$catalogId, $position + 1, $originalId, $selectedId, $reason];
                }

                $used[$selectedId] = true;
                $questionIds[] = $selectedId;
            }

            if (!$validExam || count($questionIds) !== count($exam['questions'])) {
                continue;
            }

            self::upsertCatalog($pdo, [
                $catalogId,
                trim((string) ($exam['title'] ?? 'Simulado ENEM')),
                'enem',
                trim((string) ($exam['subject'] ?? 'ENEM')),
                max(0, (int) ($exam['durationMinutes'] ?? 0)) ?: null,
            ]);

            $deleteComposition->execute([$catalogId]);
            $deleteReplacements->execute([$catalogId]);
            foreach ($questionIds as $position => $questionId) {
                $join->execute([$catalogId, $questionId, $position + 1]);
            }
            foreach ($replacementRows as $row) {
                $replacement->execute($row);
            }
        }
    }

    /**
     * Each concursos track is split into balanced cadernos of at most CADERNO_SIZE
     * questions, in a stable order (source exam, then question number).
     */
    private static function importConcursos(PDO $pdo): void {
        $questions = self::readJson(dirname(__DIR__, 2) . '/docs/sources/concursos/extracted-questions-sul.json');
        if (!is_array($questions)) {
            return;
        }
        $tracks = [];
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
            $sourceId = (string) ($question['id'] ?? $position);
            $questionId = 'concursos:' . $sourceId;
            self::insertQuestion($pdo, $questionId, 'Concursos Sul', 'concursos', $track, (string) $question['enunciado'], $options, $correct, '', [
                'state' => $question['estado'] ?? null,
                'year' => $question['ano'] ?? null,
                'organization' => $question['orgao'] ?? null,
                'board' => $question['banca'] ?? null,
                'discipline' => $question['disciplina'] ?? null,
                'target_role' => $question['cargo_alvo'] ?? null,
            ]);
            $tracks[$track][$questionId] = [(string) preg_replace('/-Q\d+$/', '', $sourceId), (int) ($question['numero_questao'] ?? 0), $sourceId];
        }

        $join = $pdo->prepare('INSERT OR IGNORE INTO simulator_catalog_questions (catalog_id, question_id, position) VALUES (?, ?, ?)');
        foreach ($tracks as $track => $sortKeys) {
            uasort($sortKeys, static fn(array $a, array $b): int => $a <=> $b);
            $questionIds = array_keys($sortKeys);
            $cadernoCount = (int) ceil(count($questionIds) / self::CADERNO_SIZE);
            $offset = 0;
            for ($caderno = 1; $caderno <= $cadernoCount; $caderno++) {
                $size = intdiv(count($questionIds) - $offset, $cadernoCount - $caderno + 1);
                $catalogId = sprintf('concursos:%s:caderno-%02d', self::slug($track), $caderno);
                self::upsertCatalog($pdo, [
                    $catalogId,
                    sprintf('Concursos — %s · Caderno %d (%d questões)', $track, $caderno, $size),
                    'concursos',
                    $track,
                    $size * self::CADERNO_MINUTES_PER_QUESTION,
                ]);
                foreach (array_slice($questionIds, $offset, $size) as $index => $questionId) {
                    $join->execute([$catalogId, $questionId, $index + 1]);
                }
                $offset += $size;
            }
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
