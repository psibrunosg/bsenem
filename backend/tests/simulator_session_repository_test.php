<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/SimulatorSessionRepository.php';

function expectSessionSame(mixed $expected, mixed $actual, string $message): void {
    if ($expected !== $actual) {
        throw new RuntimeException($message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}

function expectSessionThrows(callable $callback, string $message): void {
    try {
        $callback();
    } catch (InvalidArgumentException) {
        return;
    }

    throw new RuntimeException($message);
}

function insertSessionUser(PDO $pdo, string $email): int {
    $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')->execute([
        'Simulator user', $email, str_repeat('x', 60),
    ]);

    return (int) $pdo->lastInsertId();
}

function insertSessionQuestion(PDO $pdo, int $number, string $correctOption): int {
    $pdo->prepare(
        'INSERT INTO enem_questions (
            year, day, question_number, area, statement,
            option_a, option_b, option_c, option_d, option_e,
            correct_option, status, source_pdf, source_page, source_pages,
            content_hash, inep_url, mirror_url, images
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)' 
    )->execute([
        2024, 1, $number, 'Matemática', "Questão {$number}",
        'A', 'B', 'C', 'D', 'E', $correctOption, 'valid', 'enem-2024.pdf', 1, '[1]',
        hash('sha256', "Questão {$number}"), 'https://www.gov.br/inep/enem',
        'https://example.test/enem', '[]',
    ]);

    return (int) $pdo->lastInsertId();
}

$path = tempnam(sys_get_temp_dir(), 'bsenem-simulator-session-test-');
if ($path === false) {
    throw new RuntimeException('Unable to create isolated test database.');
}

putenv('APP_ENV=test');
putenv("APP_DB_PATH={$path}");

try {
    Database::resetForTests();
    $pdo = Database::getInstance()->getConnection();
    $firstUserId = insertSessionUser($pdo, 'first-simulator@example.test');
    $secondUserId = insertSessionUser($pdo, 'second-simulator@example.test');
    $q1 = insertSessionQuestion($pdo, 1, 'B');
    $q2 = insertSessionQuestion($pdo, 2, 'A');
    $repo = new SimulatorSessionRepository();

    $session = $repo->create($pdo, $firstUserId, 'practice', 'Matemática', null, 1500, [$q1, $q2]);
    expectSessionSame('active', $session['status'], 'New sessions are active');
    expectSessionSame([$q1, $q2], array_column($session['questions'], 'question_id'), 'Composition preserves question order');

    $repo->saveProgress($pdo, $firstUserId, $session['id'], 1, 94, [
        ['question_id' => $q1, 'selected_option' => 'B', 'flagged' => true],
    ]);
    $draft = $repo->find($pdo, $firstUserId, $session['id']);
    expectSessionSame('B', $draft['answers'][0]['selected_option'], 'Draft restores');
    expectSessionSame(1, $draft['current_position'], 'Draft position restores');
    expectSessionSame(94, $draft['elapsed_seconds'], 'Draft elapsed time restores');

    expectSessionSame(null, $repo->find($pdo, $secondUserId, $session['id']), 'Second user cannot look up another user session');
    expectSessionSame(null, $repo->saveProgress($pdo, $secondUserId, $session['id'], 0, 0, []), 'Second user cannot alter another user draft');
    expectSessionSame(1, $repo->find($pdo, $firstUserId, $session['id'])['current_position'], 'Foreign draft mutation does not persist');

    expectSessionThrows(
        fn() => $repo->create($pdo, $firstUserId, 'practice', 'Matemática', null, 1500, [$q1, $q1]),
        'Duplicate question IDs are rejected before session creation'
    );
    expectSessionThrows(
        fn() => $repo->saveProgress($pdo, $firstUserId, $session['id'], 1, 95, [['question_id' => $q1, 'selected_option' => 'Z']]),
        'Invalid answer options are rejected'
    );
    expectSessionThrows(
        fn() => $repo->saveProgress($pdo, $firstUserId, $session['id'], 2, 95, []),
        'Positions outside the composition are rejected'
    );

    $first = $repo->complete($pdo, $firstUserId, $session['id']);
    expectSessionSame(['correct' => 1, 'incorrect' => 0, 'unanswered' => 1, 'score' => 50.0], $first['result'], 'Completion calculates server-side result');
    $second = $repo->complete($pdo, $firstUserId, $session['id']);
    expectSessionSame($first['result'], $second['result'], 'Completion is idempotent');
    expectSessionSame(null, $repo->saveProgress($pdo, $firstUserId, $session['id'], 0, 1, []), 'Completed sessions cannot be mutated');
    expectSessionSame($first['result'], $repo->find($pdo, $firstUserId, $session['id'])['result'], 'Completion persists canonical result');
    expectSessionSame(null, $repo->complete($pdo, $secondUserId, $session['id']), 'Second user cannot complete another user session');
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

echo "Simulator session repository tests passed" . PHP_EOL;
