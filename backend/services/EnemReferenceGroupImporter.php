<?php

declare(strict_types=1);

final class EnemReferenceGroupImporter {
    public const DEFAULT_JSON = __DIR__ . '/../../content/enem/reference-groups.json';

    /** @return array{groups:int, links:int} */
    public static function import(PDO $pdo, string $jsonPath = self::DEFAULT_JSON): array {
        $raw = is_file($jsonPath) ? file_get_contents($jsonPath) : false;
        if ($raw === false) {
            return ['groups' => 0, 'links' => 0];
        }

        $data = json_decode($raw, true);
        if (!is_array($data) || !is_array($data['groups'] ?? null)) {
            throw new RuntimeException("Estrutura inválida em {$jsonPath}");
        }

        $selectQuestion = $pdo->prepare(
            'SELECT id FROM enem_questions WHERE year = ? AND day = ? AND question_number = ?'
        );
        $upsertGroup = $pdo->prepare(
            "INSERT INTO simulator_reference_groups (
                id, title, body, images, source_pdf, source_pages,
                review_status, origin, confidence, created_by, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, 'reviewed', 'official_import', ?, NULL, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                body = excluded.body,
                images = excluded.images,
                source_pdf = excluded.source_pdf,
                source_pages = excluded.source_pages,
                review_status = 'reviewed',
                origin = 'official_import',
                confidence = excluded.confidence,
                updated_at = CURRENT_TIMESTAMP"
        );
        $deleteLinks = $pdo->prepare('DELETE FROM simulator_reference_group_questions WHERE group_id = ?');
        $insertLink = $pdo->prepare(
            'INSERT OR IGNORE INTO simulator_reference_group_questions (group_id, question_id, position) VALUES (?, ?, ?)'
        );

        $groups = 0;
        $links = 0;
        $ownsTransaction = !$pdo->inTransaction();
        if ($ownsTransaction) $pdo->beginTransaction();

        try {
            foreach ($data['groups'] as $group) {
                if (!is_array($group)) continue;
                $id = trim((string) ($group['id'] ?? ''));
                $title = trim((string) ($group['title'] ?? ''));
                $questionNumbers = $group['question_numbers'] ?? null;
                if ($id === '' || $title === '' || !is_array($questionNumbers) || $questionNumbers === []) {
                    continue;
                }

                $images = array_values(array_filter(
                    is_array($group['images'] ?? null) ? $group['images'] : [],
                    static fn(mixed $value): bool => is_string($value) && $value !== ''
                ));
                $pages = array_values(array_map('intval', is_array($group['source_pages'] ?? null) ? $group['source_pages'] : []));

                $upsertGroup->execute([
                    $id,
                    $title,
                    (string) ($group['body'] ?? ''),
                    json_encode($images, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    (string) ($group['source_pdf'] ?? ''),
                    json_encode($pages),
                    (string) ($group['confidence'] ?? 'explicit_official_label'),
                ]);
                $deleteLinks->execute([$id]);

                foreach (array_values($questionNumbers) as $position => $number) {
                    $selectQuestion->execute([(int) $group['year'], (int) $group['day'], (int) $number]);
                    $questionId = $selectQuestion->fetchColumn();
                    if ($questionId === false) {
                        throw new RuntimeException("Questão ENEM não encontrada para referência {$id}: {$number}");
                    }
                    $insertLink->execute([$id, 'inep:' . (int) $questionId, $position]);
                    $links += $insertLink->rowCount();
                }
                $groups++;
            }

            if ($ownsTransaction) $pdo->commit();
        } catch (Throwable $error) {
            if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }

        return ['groups' => $groups, 'links' => $links];
    }
}
