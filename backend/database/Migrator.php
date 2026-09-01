<?php

declare(strict_types=1);

final class Migrator {
    public static function migrate(PDO $pdo): void {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )'
        );

        $files = glob(__DIR__ . '/migrations/*.sql');
        if ($files === false) {
            throw new RuntimeException('Unable to read database migrations.');
        }

        sort($files, SORT_STRING);

        foreach ($files as $file) {
            $version = basename($file);
            $seen = $pdo->prepare('SELECT 1 FROM schema_migrations WHERE version = ?');
            $seen->execute([$version]);

            if ($seen->fetchColumn()) {
                continue;
            }

            $sql = file_get_contents($file);
            if ($sql === false) {
                throw new RuntimeException("Unable to read migration {$version}.");
            }

            $pdo->beginTransaction();

            try {
                $pdo->exec($sql);
                $pdo->prepare('INSERT INTO schema_migrations (version) VALUES (?)')->execute([$version]);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }

                throw $error;
            }
        }
    }
}
