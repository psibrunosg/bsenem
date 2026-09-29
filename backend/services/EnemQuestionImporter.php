<?php

declare(strict_types=1);

/**
 * Idempotent import of the audited ENEM extraction (2009-2025) into enem_questions
 * and enem_question_assets. Shared by the CLI script and the simulator content importer.
 */
final class EnemQuestionImporter {
    public const DEFAULT_JSON = __DIR__ . '/../../docs/sources/enem/extracted-questions-2009-2025.json';
    public const DEFAULT_CONTENT_ROOT = __DIR__ . '/../../content/enem';
    public const DEFAULT_RECOVERY_JSON = __DIR__ . '/../../content/enem/recovery-overrides.json';

    /** @return array{questions: int, valid: int, pending: int, assets: int} */
    public static function import(PDO $pdo, string $jsonPath = self::DEFAULT_JSON, string $contentRoot = self::DEFAULT_CONTENT_ROOT): array {
        $raw = is_file($jsonPath) ? file_get_contents($jsonPath) : false;
        if ($raw === false) {
            throw new RuntimeException("Arquivo de questões ENEM não encontrado: {$jsonPath}");
        }
        $data = json_decode($raw, true);
        if (!is_array($data) || !isset($data['questions']) || !is_array($data['questions'])) {
            throw new RuntimeException("Estrutura inválida em {$jsonPath}");
        }

        $insertQuestionStmt = $pdo->prepare('
            INSERT INTO enem_questions (
                year, day, question_number, area, statement,
                option_a, option_b, option_c, option_d, option_e,
                correct_option, status, pending_reason,
                source_pdf, source_page, source_pages,
                content_hash, inep_url, mirror_url,
                images, foreign_language_option, extra_data,
                updated_at
            ) VALUES (
                :year, :day, :question_number, :area, :statement,
                :option_a, :option_b, :option_c, :option_d, :option_e,
                :correct_option, :status, :pending_reason,
                :source_pdf, :source_page, :source_pages,
                :content_hash, :inep_url, :mirror_url,
                :images, :foreign_language_option, :extra_data,
                CURRENT_TIMESTAMP
            )
            ON CONFLICT(year, day, question_number) DO UPDATE SET
                area = excluded.area,
                statement = excluded.statement,
                option_a = excluded.option_a,
                option_b = excluded.option_b,
                option_c = excluded.option_c,
                option_d = excluded.option_d,
                option_e = excluded.option_e,
                correct_option = excluded.correct_option,
                status = excluded.status,
                pending_reason = excluded.pending_reason,
                source_pdf = excluded.source_pdf,
                source_page = excluded.source_page,
                source_pages = excluded.source_pages,
                content_hash = excluded.content_hash,
                inep_url = excluded.inep_url,
                mirror_url = excluded.mirror_url,
                images = excluded.images,
                foreign_language_option = excluded.foreign_language_option,
                extra_data = excluded.extra_data,
                updated_at = CURRENT_TIMESTAMP
        ');

        $selectQuestionIdStmt = $pdo->prepare('
            SELECT id FROM enem_questions WHERE year = ? AND day = ? AND question_number = ?
        ');

        $insertAssetStmt = $pdo->prepare('
            INSERT INTO enem_question_assets (
                question_id, relative_path, source_pdf, source_page,
                image_index, sha256, mime_type, width, height, bytes
            ) VALUES (
                :question_id, :relative_path, :source_pdf, :source_page,
                :image_index, :sha256, :mime_type, :width, :height, :bytes
            )
            ON CONFLICT(relative_path) DO UPDATE SET
                question_id = excluded.question_id,
                source_pdf = excluded.source_pdf,
                source_page = excluded.source_page,
                image_index = excluded.image_index,
                sha256 = excluded.sha256,
                mime_type = excluded.mime_type,
                width = excluded.width,
                height = excluded.height,
                bytes = excluded.bytes
        ');

        $recoveries = self::loadApprovedRecoveries(self::DEFAULT_RECOVERY_JSON);

        $importedQuestions = 0;
        $importedAssets = 0;
        $validCount = 0;
        $pendingCount = 0;

        $ownsTransaction = !$pdo->inTransaction();
        if ($ownsTransaction) {
            $pdo->beginTransaction();
        }
        try {
        foreach ($data['questions'] as $q) {
            $q = self::applyRecovery($q, $recoveries, $contentRoot);
            $insertQuestionStmt->execute([
                ':year' => (int) $q['year'],
                ':day' => (int) $q['day'],
                ':question_number' => (int) $q['question_number'],
                ':area' => (string) $q['area'],
                ':statement' => (string) $q['statement'],
                ':option_a' => (string) $q['option_a'],
                ':option_b' => (string) $q['option_b'],
                ':option_c' => (string) $q['option_c'],
                ':option_d' => (string) $q['option_d'],
                ':option_e' => (string) $q['option_e'],
                ':correct_option' => $q['correct_option'] !== null ? (string) $q['correct_option'] : null,
                ':status' => (string) $q['status'],
                ':pending_reason' => $q['pending_reason'] !== null ? (string) $q['pending_reason'] : null,
                ':source_pdf' => (string) $q['source_pdf'],
                ':source_page' => (int) $q['source_page'],
                ':source_pages' => is_array($q['source_pages']) ? json_encode($q['source_pages']) : (string) $q['source_pages'],
                ':content_hash' => (string) $q['content_hash'],
                ':inep_url' => (string) $q['inep_url'],
                ':mirror_url' => (string) $q['mirror_url'],
                ':images' => is_array($q['images']) ? json_encode($q['images']) : '[]',
                ':foreign_language_option' => $q['foreign_language_option'] !== null ? (string) $q['foreign_language_option'] : null,
                ':extra_data' => !empty($q['extra_data']) ? json_encode($q['extra_data'], JSON_UNESCAPED_UNICODE) : null
            ]);

            $selectQuestionIdStmt->execute([(int) $q['year'], (int) $q['day'], (int) $q['question_number']]);
            $questionId = (int) $selectQuestionIdStmt->fetchColumn();

            if ($q['status'] === 'valid') {
                $validCount++;
            } else {
                $pendingCount++;
            }
            $importedQuestions++;

            // Processa assets vinculados
            if (!empty($q['images']) && is_array($q['images'])) {
                foreach ($q['images'] as $idx => $relPath) {
                    $absAssetPath = $contentRoot . '/' . $relPath;
                    if (file_exists($absAssetPath)) {
                        $imgData = file_get_contents($absAssetPath);
                        $sha256 = hash('sha256', $imgData);
                        $bytes = strlen($imgData);
                        $size = @getimagesize($absAssetPath);
                        $width = $size ? $size[0] : null;
                        $height = $size ? $size[1] : null;
                        $mime = $size ? $size['mime'] : 'image/png';

                        $insertAssetStmt->execute([
                            ':question_id' => $questionId,
                            ':relative_path' => $relPath,
                            ':source_pdf' => (string) $q['source_pdf'],
                            ':source_page' => (int) $q['source_page'],
                            ':image_index' => (int) $idx,
                            ':sha256' => $sha256,
                            ':mime_type' => $mime,
                            ':width' => $width,
                            ':height' => $height,
                            ':bytes' => $bytes
                        ]);
                        $importedAssets++;
                    }
                }
            }
        }
            if ($ownsTransaction) {
                $pdo->commit();
            }
        } catch (Throwable $error) {
            if ($ownsTransaction && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }

        return ['questions' => $importedQuestions, 'valid' => $validCount, 'pending' => $pendingCount, 'assets' => $importedAssets];
    }

    /** @return array<string, array<string, mixed>> */
    private static function loadApprovedRecoveries(string $path): array {
        if (!is_file($path)) return [];
        $raw = file_get_contents($path);
        $data = $raw === false ? null : json_decode($raw, true);
        if (!is_array($data) || !is_array($data['recoveries'] ?? null)) {
            throw new RuntimeException("Estrutura inválida em {$path}");
        }
        $result = [];
        foreach ($data['recoveries'] as $recovery) {
            if (!is_array($recovery) || ($recovery['review_status'] ?? null) !== 'approved' || !is_array($recovery['fields'] ?? null)) continue;
            $key = self::recoveryKey((int) ($recovery['year'] ?? 0), (int) ($recovery['day'] ?? 0), (int) ($recovery['question_number'] ?? 0));
            $result[$key] = $recovery;
        }
        return $result;
    }

    /** @param array<string, mixed> $question @param array<string, array<string, mixed>> $recoveries @return array<string, mixed> */
    private static function applyRecovery(array $question, array $recoveries, string $contentRoot): array {
        $key = self::recoveryKey((int) $question['year'], (int) $question['day'], (int) $question['question_number']);
        $recovery = $recoveries[$key] ?? null;
        if ($recovery === null) return $question;
        if (($recovery['source_pdf'] ?? null) !== ($question['source_pdf'] ?? null)) {
            throw new RuntimeException("Recovery source mismatch for {$key}");
        }
        $allowed = ['statement', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'correct_option', 'images'];
        foreach ($recovery['fields'] as $field => $value) {
            if (!in_array($field, $allowed, true)) continue;
            $question[$field] = $value;
        }
        if (!is_array($question['images'] ?? null)) throw new RuntimeException("Invalid recovery images for {$key}");
        foreach ($question['images'] as $image) {
            if (!is_string($image) || !preg_match('#^assets/[A-Za-z0-9._/-]+$#', $image) || str_contains($image, '..') || !is_file($contentRoot . '/' . $image)) {
                throw new RuntimeException("Missing or unsafe recovery asset for {$key}");
            }
        }
        if (($question['correct_option'] ?? null) !== null && !preg_match('/^[A-E]$/', (string) $question['correct_option'])) {
            throw new RuntimeException("Invalid recovery answer for {$key}");
        }
        $extra = is_array($question['extra_data'] ?? null) ? $question['extra_data'] : [];
        $extra['recovery_overlay'] = ['reviewed_at' => $recovery['reviewed_at'] ?? null, 'evidence' => $recovery['evidence'] ?? null];
        $question['extra_data'] = $extra;
        return $question;
    }

    private static function recoveryKey(int $year, int $day, int $number): string {
        return sprintf('%04d-%d-%03d', $year, $day, $number);
    }
}
