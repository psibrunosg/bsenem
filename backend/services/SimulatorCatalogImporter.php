<?php

declare(strict_types=1);

final class SimulatorCatalogImporter {
    public static function ensureImported(Database $db): void {
        $existing = $db->fetch('SELECT COUNT(*) AS total FROM simulator_question_bank');
        if ((int) ($existing['total'] ?? 0) > 0) {
            return;
        }

        $pdo = $db->getConnection();
        $pdo->beginTransaction();
        try {
            self::importEnem($pdo);
            self::importConcursos($pdo);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }
    }

    private static function importEnem(PDO $pdo): void {
        $files = glob(dirname(__DIR__, 2) . '/content/enem/*.bsestudos.exam.json') ?: [];
        sort($files, SORT_STRING);
        foreach ($files as $file) {
            $exam = self::readJson($file);
            if (!is_array($exam) || !is_array($exam['questions'] ?? null)) {
                continue;
            }
            $catalogId = 'enem:' . (string) ($exam['id'] ?? basename($file));
            $subject = trim((string) ($exam['subject'] ?? 'ENEM'));
            $title = trim((string) ($exam['title'] ?? 'Simulado ENEM'));
            $duration = max(0, (int) ($exam['durationMinutes'] ?? 0));
            $pdo->prepare('INSERT INTO simulator_catalogs (id, title, category, subject, duration_minutes) VALUES (?, ?, ?, ?, ?)')
                ->execute([$catalogId, $title, 'enem', $subject, $duration ?: null]);
            foreach ($exam['questions'] as $position => $question) {
                if (!is_array($question) || !is_array($question['options'] ?? null) || count($question['options']) !== 5) {
                    continue;
                }
                $questionId = 'enem:' . (string) ($question['id'] ?? $catalogId . ':' . $position);
                self::insertQuestion($pdo, $questionId, 'INEP', 'enem', $subject, (string) ($question['statement'] ?? ''), $question['options'], (int) ($question['correctOption'] ?? -1), (string) ($question['explanation'] ?? ''), ['catalog_id' => $catalogId]);
                $pdo->prepare('INSERT OR IGNORE INTO simulator_catalog_questions (catalog_id, question_id, position) VALUES (?, ?, ?)')
                    ->execute([$catalogId, $questionId, $position + 1]);
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
                $pdo->prepare('INSERT INTO simulator_catalogs (id, title, category, subject, duration_minutes) VALUES (?, ?, ?, ?, ?)')
                    ->execute([$catalogId, 'Concursos — ' . $track, 'concursos', $track, null]);
                $catalogs[$catalogId] = true;
            }
            $pdo->prepare('INSERT OR IGNORE INTO simulator_catalog_questions (catalog_id, question_id, position) VALUES (?, ?, ?)')
                ->execute([$catalogId, $questionId, $position + 1]);
        }
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
