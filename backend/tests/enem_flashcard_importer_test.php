<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/EnemFlashcardImporter.php';

function expectSame(mixed $expected, mixed $actual, string $message): void {
    if ($expected !== $actual) {
        throw new RuntimeException($message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}

$path = tempnam(sys_get_temp_dir(), 'bsenem-flashcards-');
if ($path === false) throw new RuntimeException('Unable to create test database.');

putenv('APP_ENV=test');
putenv("APP_DB_PATH={$path}");

try {
    Database::resetForTests();
    initializeDatabase();
    $pdo = Database::getInstance()->getConnection();
    $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')->execute([
        'Flashcard importer', 'flashcards@example.test', str_repeat('x', 60)
    ]);
    $userId = (int) $pdo->lastInsertId();

    $contentDir = realpath(__DIR__ . '/../../content/enem');
    if ($contentDir === false) throw new RuntimeException('Content directory missing.');

    $first = EnemFlashcardImporter::import($pdo, $userId, $contentDir);
    expectSame(206, $first['inserted'], 'All canonical ENEM flashcards are imported');
    expectSame(0, $first['skipped'], 'First import does not skip canonical cards');
    expectSame(9, $first['files'], 'Nine canonical deck files are imported');
    expectSame(13, $first['subjects'], 'Cards are mapped to thirteen subjects');

    expectSame(206, (int) $pdo->query('SELECT COUNT(*) FROM flashcards')->fetchColumn(), 'Database contains canonical cards');
    expectSame(13, (int) $pdo->query('SELECT COUNT(*) FROM subjects')->fetchColumn(), 'Database contains subject records');

    $due = (int) $pdo->query("SELECT COUNT(*) FROM flashcards WHERE due_date <= CURRENT_TIMESTAMP")->fetchColumn();
    expectSame(206, $due, 'Imported cards are immediately due for review');

    $second = EnemFlashcardImporter::import($pdo, $userId, $contentDir);
    expectSame(0, $second['inserted'], 'Repeated import is idempotent');
    expectSame(206, $second['skipped'], 'Repeated import skips every existing card');
    expectSame(206, (int) $pdo->query('SELECT COUNT(*) FROM flashcards')->fetchColumn(), 'Repeated import creates no duplicates');

    echo "ENEM flashcard importer tests passed" . PHP_EOL;
} finally {
    Database::resetForTests();
    gc_collect_cycles();
    foreach ([$path, "{$path}-wal", "{$path}-shm"] as $file) {
        if (is_file($file)) @unlink($file);
    }
}
