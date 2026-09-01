<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

$confirmation = $argv[1] ?? '';
$tables = [
    'auth_sessions',
    'exam_answers',
    'exam_attempts',
    'questions',
    'exams',
    'flashcards',
    'notes',
    'study_sessions',
    'activity_log',
    'user_achievements',
    'resources',
    'users',
    'achievements',
    'subjects',
];

try {
    $pdo = Database::getInstance()->getConnection();

    foreach ($tables as $table) {
        $count = (int) $pdo->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
        echo "{$table}: {$count}" . PHP_EOL;
    }

    if ($confirmation !== '--confirm=DELETE_DEMO_DATA') {
        fwrite(STDERR, 'No data was changed. Re-run with --confirm=DELETE_DEMO_DATA to continue.' . PHP_EOL);
        exit(1);
    }

    $pdo->beginTransaction();
    try {
        foreach ($tables as $table) {
            $pdo->exec("DELETE FROM {$table}");
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    echo 'Demo data cleared.' . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, 'Unable to clear demo data: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
