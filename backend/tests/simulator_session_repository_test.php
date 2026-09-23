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

function insertSessionQuestion(PDO $pdo, int $number, string $correctOption): string {
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

    return 'inep:' . $pdo->lastInsertId();
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
    expectSessionSame(1500, $session['time_limit_seconds'], 'New session restores its configured time limit');
    expectSessionSame([$q1, $q2], array_column($session['questions'], 'question_id'), 'Composition preserves question order');

    $repo->saveProgress($pdo, $firstUserId, $session['id'], 1, 94, [
        ['question_id' => $q1, 'selected_option' => 'B', 'flagged' => true],
    ]);
    $draft = $repo->find($pdo, $firstUserId, $session['id']);
    expectSessionSame('B', $draft['answers'][0]['selected_option'], 'Draft restores');
    expectSessionSame(true, $draft['answers'][0]['flagged'], 'Draft flag restores');
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

    $insertHistory = $pdo->prepare(
        'INSERT INTO simulator_sessions (
            id, user_id, kind, status, subject, topic, question_limit, time_limit_seconds, completed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $insertComposition = $pdo->prepare(
        'INSERT INTO simulator_session_questions (session_id, question_id, position) VALUES (?, ?, ?)'
    );
    $insertAnswer = $pdo->prepare(
        'INSERT INTO simulator_session_answers (session_id, question_id, selected_option, is_correct, flagged)
         VALUES (?, ?, ?, ?, ?)'
    );
    for ($daysAgo = 1; $daysAgo <= 31; $daysAgo++) {
        $id = sprintf('history-%02d', $daysAgo);
        $completedAt = gmdate('Y-m-d H:i:s', time() - ($daysAgo * 86400));
        $insertHistory->execute([$id, $firstUserId, 'practice', 'completed', 'Matemática', null, 1, 1500, $completedAt]);
        $insertComposition->execute([$id, $q1, 0]);
        $insertAnswer->execute([$id, $q1, 'B', $daysAgo === 31 ? 0 : 1, 0]);
    }
    $insertHistory->execute(['history-old', $firstUserId, 'practice', 'completed', 'Matemática', null, 1, 1500, gmdate('Y-m-d H:i:s', time() - (91 * 86400))]);
    $insertComposition->execute(['history-old', $q1, 0]);
    $insertAnswer->execute(['history-old', $q1, 'B', 0, 0]);
    $insertHistory->execute(['history-active', $firstUserId, 'practice', 'active', 'Matemática', null, 1, 1500, null]);
    $insertComposition->execute(['history-active', $q1, 0]);
    $insertAnswer->execute(['history-active', $q1, 'B', 0, 0]);

    $recentResponses = $repo->recentResponses($pdo, $firstUserId);
    expectSessionSame(30, count($recentResponses), 'Recent history is capped before aggregation');
    expectSessionSame([], array_values(array_filter($recentResponses, static fn(array $response): bool => !$response['is_correct'])), 'Old and active answers do not enter recent history');

    $q3 = insertSessionQuestion($pdo, 3, 'A');
    $q4 = insertSessionQuestion($pdo, 4, 'A');
    $q5 = insertSessionQuestion($pdo, 5, 'A');
    $insertHistory->execute(['wrong-recent', $firstUserId, 'practice', 'completed', 'Matemática', null, 1, 1500, gmdate('Y-m-d H:i:s', time() - 86400)]);
    $insertComposition->execute(['wrong-recent', $q3, 0]);
    $insertAnswer->execute(['wrong-recent', $q3, 'B', 0, 0]);
    $insertHistory->execute(['correct-recent', $firstUserId, 'practice', 'completed', 'Matemática', null, 1, 1500, gmdate('Y-m-d H:i:s', time() - 86400)]);
    $insertComposition->execute(['correct-recent', $q4, 0]);
    $insertAnswer->execute(['correct-recent', $q4, 'A', 1, 0]);

    $wrongIds = $repo->wrongQuestionIds($pdo, $firstUserId, ['Matemática'], null);
    expectSessionSame(true, in_array($q3, $wrongIds, true), 'Wrong question ids include a recently missed question still eligible for review');
    expectSessionSame(false, in_array($q4, $wrongIds, true), 'Wrong question ids exclude a correctly answered question');
    expectSessionSame(false, in_array($q5, $wrongIds, true), 'Wrong question ids exclude a question the user never answered');

    $recentlyUsedIds = $repo->recentlyUsedQuestionIds($pdo, $firstUserId, ['Matemática'], null);
    expectSessionSame(true, in_array($q3, $recentlyUsedIds, true), 'Recently used ids include a question served in a recent session, even when missed');
    expectSessionSame(true, in_array($q4, $recentlyUsedIds, true), 'Recently used ids include a question served in a recent session, even when answered correctly');
    expectSessionSame(false, in_array($q5, $recentlyUsedIds, true), 'Recently used ids exclude a question never served to the user');
} finally {
    unset($insertHistory, $insertComposition, $insertAnswer, $recentResponses, $repo);
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
