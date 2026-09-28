<?php

declare(strict_types=1);

final class EnemQualityGateImporter {
    public const DEFAULT_JSON = __DIR__ . '/../../content/enem/quality-quarantine.json';
    private const STATE_KEY = 'enem_quality_quarantine_sha256';

    /** @return array{quarantined:int, changed:bool} */
    public static function import(PDO $pdo, string $jsonPath = self::DEFAULT_JSON): array {
        $raw = is_file($jsonPath) ? file_get_contents($jsonPath) : false;
        if ($raw === false) {
            return ['quarantined' => 0, 'changed' => false];
        }

        $data = json_decode($raw, true);
        if (!is_array($data) || !is_array($data['issues'] ?? null)) {
            throw new RuntimeException("Estrutura inválida em {$jsonPath}");
        }

        $hash = hash('sha256', $raw);
        $state = $pdo->prepare('SELECT value FROM simulator_content_state WHERE key = ?');
        $state->execute([self::STATE_KEY]);
        if ($state->fetchColumn() === $hash) {
            return ['quarantined' => count($data['issues']), 'changed' => false];
        }

        $select = $pdo->prepare(
            "SELECT q.id,
                    EXISTS(
                        SELECT 1 FROM simulator_reference_group_questions r
                        WHERE r.question_id = 'inep:' || q.id
                    ) AS has_reference
             FROM enem_questions q
             WHERE q.year = ? AND q.day = ? AND q.question_number = ?"
        );
        $quarantine = $pdo->prepare(
            "UPDATE enem_questions
             SET quality_status = 'quarantined', quality_reason = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?"
        );
        $saveState = $pdo->prepare(
            "INSERT INTO simulator_content_state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
        );

        $ownsTransaction = !$pdo->inTransaction();
        if ($ownsTransaction) $pdo->beginTransaction();

        try {
            $pdo->exec(
                "UPDATE enem_questions
                 SET quality_status = 'approved', quality_reason = NULL
                 WHERE quality_status <> 'approved' OR quality_reason IS NOT NULL"
            );

            $count = 0;
            foreach ($data['issues'] as $issue) {
                if (!is_array($issue) || !is_array($issue['reasons'] ?? null)) continue;
                $select->execute([
                    (int) ($issue['year'] ?? 0),
                    (int) ($issue['day'] ?? 0),
                    (int) ($issue['question_number'] ?? 0),
                ]);
                $question = $select->fetch();
                if (!$question) {
                    throw new RuntimeException('Questão da quarentena não encontrada no banco ENEM.');
                }

                $reasons = array_values(array_unique(array_filter(
                    $issue['reasons'],
                    static fn(mixed $reason): bool => is_string($reason) && $reason !== ''
                )));
                if ($reasons === []) continue;

                $referenceResolvable = ['missing_context_or_visual', 'possible_missing_reference', 'possible_missing_visual'];
                $unresolvedReasons = array_values(array_diff($reasons, $referenceResolvable));
                if ((int) ($question['has_reference'] ?? 0) === 1 && $unresolvedReasons === []) {
                    continue;
                }

                $quarantine->execute([implode('; ', $reasons), (int) $question['id']]);
                $count++;
            }

            $saveState->execute([self::STATE_KEY, $hash]);
            if ($ownsTransaction) $pdo->commit();
        } catch (Throwable $error) {
            if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }

        return ['quarantined' => $count, 'changed' => true];
    }
}
