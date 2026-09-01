<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function expectSame(mixed $expected, mixed $actual, string $message): void {
    if ($expected !== $actual) {
        throw new RuntimeException($message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}

function expectTrue(bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$path = tempnam(sys_get_temp_dir(), 'bsenem-test-');

if ($path === false) {
    throw new RuntimeException('Unable to create an isolated test database.');
}

putenv('APP_ENV=test');
putenv("APP_DB_PATH={$path}");

try {
    Database::resetForTests();
    initializeDatabase();

    $pdo = Database::getInstance()->getConnection();
    expectSame(0, (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn(), 'New databases have no users');
    expectSame(0, (int) $pdo->query('SELECT COUNT(*) FROM flashcards')->fetchColumn(), 'New databases have no flashcards');
    expectSame(2, (int) $pdo->query('SELECT COUNT(*) FROM schema_migrations')->fetchColumn(), 'Both migrations run once');
    expectTrue(
        (bool) $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'auth_sessions'")->fetchColumn(),
        'Session table exists'
    );

    initializeDatabase();
    expectSame(2, (int) $pdo->query('SELECT COUNT(*) FROM schema_migrations')->fetchColumn(), 'Migrations are idempotent');

    echo "Private beta database tests passed" . PHP_EOL;
} finally {
    unset($pdo);
    Database::resetForTests();
    gc_collect_cycles();

    foreach ([$path, "{$path}-wal", "{$path}-shm"] as $databaseFile) {
        if (is_file($databaseFile)) {
            unlink($databaseFile);
        }
    }
}
