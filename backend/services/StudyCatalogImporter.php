<?php

declare(strict_types=1);

final class StudyCatalogImporter {
    /**
     * Imports a one-time Drive inventory. File bytes are intentionally never read or stored.
     *
     * @param array{source: array<string, mixed>, items: list<array<string, mixed>>} $manifest
     * @return array{source_id: int, run_id: int, created: int, updated: int, skipped: int}
     */
    public static function import(PDO $pdo, int $userId, array $manifest): array {
        $source = self::source($manifest['source'] ?? []);
        $items = $manifest['items'] ?? null;

        if (!is_array($items)) {
            throw new InvalidArgumentException('Manifest items must be an array.');
        }

        $sourceId = self::upsertSource($pdo, $userId, $source);
        $runId = self::startRun($pdo, $sourceId);
        $created = 0;
        $updated = 0;
        $skipped = 0;

        try {
            $pdo->beginTransaction();

            foreach ($items as $item) {
                if (!is_array($item)) {
                    throw new InvalidArgumentException('Each library item must be an object.');
                }

                $record = self::item($item);
                if (self::isExcluded($record['catalog_path'])) {
                    $skipped++;
                    continue;
                }
                $exists = $pdo->prepare(
                    'SELECT 1 FROM study_library_items WHERE user_id = ? AND source_id = ? AND drive_id = ?'
                );
                $exists->execute([$userId, $sourceId, $record['drive_id']]);

                $statement = $pdo->prepare(
                    'INSERT INTO study_library_items (
                        user_id, source_id, last_import_run_id, drive_id, direct_url, name,
                        catalog_path, item_type, mime_type, modified_at, is_available, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
                    ON CONFLICT(user_id, source_id, drive_id) DO UPDATE SET
                        last_import_run_id = excluded.last_import_run_id,
                        direct_url = excluded.direct_url,
                        name = excluded.name,
                        catalog_path = excluded.catalog_path,
                        item_type = excluded.item_type,
                        mime_type = excluded.mime_type,
                        modified_at = excluded.modified_at,
                        is_available = 1,
                        updated_at = CURRENT_TIMESTAMP'
                );
                $statement->execute([
                    $userId,
                    $sourceId,
                    $runId,
                    $record['drive_id'],
                    $record['direct_url'],
                    $record['name'],
                    $record['catalog_path'],
                    $record['item_type'],
                    $record['mime_type'],
                    $record['modified_at'],
                ]);

                if ($exists->fetchColumn()) {
                    $updated++;
                } else {
                    $created++;
                }
            }

            $pdo->commit();
            $finish = $pdo->prepare(
                "UPDATE study_library_import_runs
                 SET status = 'completed', item_count = ?, created_count = ?, updated_count = ?, finished_at = CURRENT_TIMESTAMP
                 WHERE id = ?"
            );
            $finish->execute([count($items), $created, $updated, $runId]);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            $failed = $pdo->prepare(
                "UPDATE study_library_import_runs
                 SET status = 'failed', failure_message = ?, finished_at = CURRENT_TIMESTAMP
                 WHERE id = ?"
            );
            $failed->execute([mb_substr($error->getMessage(), 0, 500), $runId]);
            throw $error;
        }

        return ['source_id' => $sourceId, 'run_id' => $runId, 'created' => $created, 'updated' => $updated, 'skipped' => $skipped];
    }

    /** @param array<string, mixed> $source */
    private static function source(array $source): array {
        $provider = self::required($source, 'provider');
        $rootDriveId = self::required($source, 'root_drive_id');
        $rootUrl = self::url(self::required($source, 'root_url'), 'Source root URL');
        $title = self::required($source, 'title');

        if ($provider !== 'google_drive') {
            throw new InvalidArgumentException('Only google_drive sources are supported.');
        }

        return compact('provider', 'rootDriveId', 'rootUrl', 'title');
    }

    /** @param array<string, mixed> $item */
    private static function item(array $item): array {
        $driveId = self::required($item, 'drive_id');
        $directUrl = self::url(self::required($item, 'direct_url'), 'Item direct URL');
        $name = self::required($item, 'name');
        $mimeType = isset($item['mime_type']) ? trim((string) $item['mime_type']) : null;
        $modifiedAt = isset($item['modified_at']) ? trim((string) $item['modified_at']) : null;
        $path = $item['path'] ?? [];

        if (!is_array($path)) {
            throw new InvalidArgumentException('Item path must be an array.');
        }

        $parts = array_values(array_filter(array_map(
            static fn ($part): string => trim((string) $part),
            $path
        ), static fn (string $part): bool => $part !== ''));
        $catalogPath = implode(' / ', $parts);

        return [
            'drive_id' => $driveId,
            'direct_url' => $directUrl,
            'name' => $name,
            'catalog_path' => $catalogPath,
            'item_type' => self::type($mimeType, $name),
            'mime_type' => $mimeType === '' ? null : $mimeType,
            'modified_at' => $modifiedAt === '' ? null : $modifiedAt,
        ];
    }

    /** @param array<string, string> $source */
    private static function upsertSource(PDO $pdo, int $userId, array $source): int {
        $statement = $pdo->prepare(
            'INSERT INTO study_library_sources (user_id, provider, root_drive_id, root_url, title, updated_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(user_id, provider, root_drive_id) DO UPDATE SET
                root_url = excluded.root_url,
                title = excluded.title,
                updated_at = CURRENT_TIMESTAMP'
        );
        $statement->execute([$userId, $source['provider'], $source['rootDriveId'], $source['rootUrl'], $source['title']]);

        $id = $pdo->prepare(
            'SELECT id FROM study_library_sources WHERE user_id = ? AND provider = ? AND root_drive_id = ?'
        );
        $id->execute([$userId, $source['provider'], $source['rootDriveId']]);

        return (int) $id->fetchColumn();
    }

    private static function startRun(PDO $pdo, int $sourceId): int {
        $statement = $pdo->prepare("INSERT INTO study_library_import_runs (source_id, status) VALUES (?, 'running')");
        $statement->execute([$sourceId]);
        return (int) $pdo->lastInsertId();
    }

    /** @param array<string, mixed> $data */
    private static function required(array $data, string $key): string {
        $value = trim((string) ($data[$key] ?? ''));
        if ($value === '') {
            throw new InvalidArgumentException("{$key} is required.");
        }

        return $value;
    }

    private static function url(string $value, string $label): string {
        $isGoogleDriveUrl = str_starts_with($value, 'https://drive.google.com/')
            || str_starts_with($value, 'https://docs.google.com/');
        if (filter_var($value, FILTER_VALIDATE_URL) === false || !$isGoogleDriveUrl) {
            throw new InvalidArgumentException("{$label} must be a direct Google Drive or Google Docs URL.");
        }

        return $value;
    }

    private static function type(?string $mimeType, string $name): string {
        $value = strtolower(($mimeType ?? '') . ' ' . $name);
        if (str_contains($value, 'pdf')) {
            return 'pdf';
        }
        if (preg_match('/video|\\.(mp4|mkv|mov|avi|webm)\\b/', $value) === 1) {
            return 'video';
        }
        if (preg_match('/audio|\\.(mp3|wav|m4a|ogg)\\b/', $value) === 1) {
            return 'audio';
        }
        if (preg_match('/document|text|word|presentation|spreadsheet|\\.(docx|pptx|xlsx|txt)\\b/', $value) === 1) {
            return 'document';
        }
        return 'other';
    }

    private static function isExcluded(string $catalogPath): bool {
        $segments = array_values(array_filter(explode(' / ', mb_strtolower($catalogPath)), static fn (string $part): bool => $part !== ''));
        if (($segments[0] ?? '') === 'outros estudos') {
            return true;
        }

        return in_array($segments[count($segments) - 1] ?? '', ['mp3', 'transcrição'], true);
    }
}
