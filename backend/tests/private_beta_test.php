<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

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

function expectStatus(array $response, int $expectedStatus, string $message): void {
    expectSame($expectedStatus, $response['status'], $message . ' (' . trim($response['error'] ?? '') . ')');
}

function request(string $projectRoot, string $databasePath, string $uri, string $method, ?string $cookie = null): array {
    $environment = array_merge($_ENV, [
        'APP_ENV' => 'test',
        'APP_DB_PATH' => $databasePath,
        'TEST_METHOD' => $method,
        'TEST_URI' => $uri,
        'TEST_COOKIE' => $cookie ?? '',
    ]);
    $process = proc_open(
        [PHP_BINARY, 'backend/tests/route_request.php'],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes,
        $projectRoot,
        $environment
    );

    if (!is_resource($process)) {
        throw new RuntimeException('Unable to invoke test route.');
    }

    fwrite($pipes[0], '{}');
    fclose($pipes[0]);
    $body = stream_get_contents($pipes[1]);
    $errorOutput = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    proc_close($process);

    preg_match('/__STATUS__(\d{3})/', $errorOutput, $match);
    return [
        'status' => isset($match[1]) ? (int) $match[1] : 0,
        'body' => $body,
        'error' => $errorOutput,
    ];
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

    $firstUserId = (int) $pdo->prepare(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
    )->execute(['First user', 'first@example.test', str_repeat('x', 60)]);
    $firstUserId = (int) $pdo->lastInsertId();
    $secondUserId = (int) $pdo->prepare(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
    )->execute(['Second user', 'second@example.test', str_repeat('y', 60)]);
    $secondUserId = (int) $pdo->lastInsertId();

    $token = Auth::createSession($firstUserId);
    expectSame($firstUserId, Auth::findUserIdByToken($token), 'Stored session resolves its user');
    expectSame(null, Auth::findUserIdByToken($token . 'x'), 'Changed session token is rejected');
    Auth::revokeToken($token);
    expectSame(null, Auth::findUserIdByToken($token), 'Revoked session token is rejected');

    $secondToken = Auth::createSession($secondUserId);
    $cardId = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO flashcards (user_id, front, back) VALUES (?, ?, ?)')->execute([$firstUserId, 'Private front', 'Private back']);
    $cardId = (int) $pdo->lastInsertId();
    $projectRoot = realpath(__DIR__ . '/../..');
    if ($projectRoot === false) {
        throw new RuntimeException('Project root is unavailable.');
    }

    $cookie = "bsenem_session={$secondToken}";
    expectStatus(request($projectRoot, $path, "/api/flashcards/{$cardId}", 'GET', $cookie), 404, 'Other users cannot view a flashcard');
    expectStatus(request($projectRoot, $path, "/api/flashcards/{$cardId}", 'PUT', $cookie), 404, 'Other users cannot update a flashcard');
    expectStatus(request($projectRoot, $path, "/api/flashcards/{$cardId}", 'DELETE', $cookie), 404, 'Other users cannot delete a flashcard');
    expectSame('Private front', $pdo->query("SELECT front FROM flashcards WHERE id = {$cardId}")->fetchColumn(), 'Other user cannot alter a flashcard');

    $userCount = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    expectStatus(request($projectRoot, $path, '/api/auth/register', 'POST'), 403, 'Public registration is disabled');
    expectStatus(request($projectRoot, $path, '/api/auth/forgot-password', 'POST'), 403, 'Password reset request is disabled');
    expectStatus(request($projectRoot, $path, '/api/auth/reset-password', 'POST'), 403, 'Password reset is disabled');
    expectSame($userCount, (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn(), 'Disabled public auth routes do not create users');

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
