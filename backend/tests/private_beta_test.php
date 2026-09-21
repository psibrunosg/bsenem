<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/GeneratedFlashcards.php';
require_once __DIR__ . '/../utils/FlashcardReviewActivity.php';
require_once __DIR__ . '/../utils/LocalExamAttempts.php';

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
    expectSame(
        $expectedStatus,
        $response['status'],
        $message . ' (' . trim($response['error'] ?? '') . '; body: ' . trim($response['body'] ?? '') . ')'
    );
}

function request(
    string $projectRoot,
    string $databasePath,
    string $uri,
    string $method,
    ?string $cookie = null,
    array $body = [],
    string $origin = 'http://localhost',
    string $remoteAddress = '127.0.0.1',
    string $forwardedHost = ''
): array {
    $environment = array_merge($_ENV, [
        'APP_ENV' => 'test',
        'APP_DB_PATH' => $databasePath,
        'TEST_METHOD' => $method,
        'TEST_URI' => $uri,
        'TEST_COOKIE' => $cookie ?? '',
        'TEST_ORIGIN' => $origin,
        'TEST_REMOTE_ADDR' => $remoteAddress,
        'TEST_FORWARDED_HOST' => $forwardedHost,
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

    fwrite($pipes[0], json_encode($body, JSON_THROW_ON_ERROR));
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
    expectSame(5, (int) $pdo->query('SELECT COUNT(*) FROM schema_migrations')->fetchColumn(), 'All migrations run once');
    expectTrue(
        (bool) $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'auth_sessions'")->fetchColumn(),
        'Session table exists'
    );

    initializeDatabase();
    expectSame(5, (int) $pdo->query('SELECT COUNT(*) FROM schema_migrations')->fetchColumn(), 'Migrations are idempotent');

    $firstUserId = (int) $pdo->prepare(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
    )->execute(['First user', 'first@example.test', str_repeat('x', 60)]);
    $firstUserId = (int) $pdo->lastInsertId();
    $secondUserId = (int) $pdo->prepare(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
    )->execute(['Second user', 'second@example.test', str_repeat('y', 60)]);
    $secondUserId = (int) $pdo->lastInsertId();

    $generatedCount = GeneratedFlashcards::persist(Database::getInstance(), $firstUserId, null, [
        ['front' => 'Pergunta gerada', 'back' => 'Resposta gerada'],
        ['front' => '', 'back' => 'Ignorada']
    ]);
    expectSame(1, $generatedCount, 'Only complete generated cards are persisted');
    $generatedCard = Database::getInstance()->fetch('SELECT front, back, due_date FROM flashcards WHERE user_id = ? AND front = ?', [$firstUserId, 'Pergunta gerada']);
    expectSame('Resposta gerada', $generatedCard['back'], 'Generated card uses the current flashcard schema');
    expectTrue(!empty($generatedCard['due_date']), 'Generated card is due for review immediately');

    FlashcardReviewActivity::record(Database::getInstance(), $firstUserId, null, 99, 3);
    $reviewSession = Database::getInstance()->fetch('SELECT type, resource_id, xp_earned FROM study_sessions WHERE user_id = ? AND resource_id = ?', [$firstUserId, 99]);
    expectSame('flashcards', $reviewSession['type'], 'Flashcard review creates a factual study session');
    expectSame(3, (int) $reviewSession['xp_earned'], 'Flashcard review session keeps earned XP');
    $reviewActivity = Database::getInstance()->fetch('SELECT cards_reviewed, xp_earned FROM activity_log WHERE user_id = ?', [$firstUserId]);
    expectSame(1, (int) $reviewActivity['cards_reviewed'], 'Flashcard review increments the daily card total');
    expectSame(3, (int) $reviewActivity['xp_earned'], 'Flashcard review increments the daily XP total');

    $localAttemptId = LocalExamAttempts::record(Database::getInstance(), $firstUserId, [
        'library_id' => 'library-a', 'local_exam_id' => 'anatomia-01', 'exam_title' => 'Anatomia',
        'score' => 75, 'total_questions' => 4, 'time_spent' => 300, 'answers' => [['questionId' => 'q1', 'isCorrect' => true]]
    ]);
    $localAttempt = Database::getInstance()->fetch('SELECT local_exam_id, score, total_questions FROM local_exam_attempts WHERE id = ?', [$localAttemptId]);
    expectSame('anatomia-01', $localAttempt['local_exam_id'], 'Local attempts retain the source exam identifier');
    expectSame(75, (int) $localAttempt['score'], 'Local attempts retain the factual score');

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

    $profileResponse = request(
        $projectRoot,
        $path,
        '/api/auth/profile',
        'PUT',
        $cookie,
        ['name' => 'Second user updated']
    );
    expectStatus($profileResponse, 200, 'Authenticated users can update their own profile');
    $profilePayload = json_decode($profileResponse['body'], true, flags: JSON_THROW_ON_ERROR);
    expectSame('Second user updated', $profilePayload['data']['user']['name'] ?? null, 'Updated profile is returned');
    expectSame('Second user updated', $pdo->query("SELECT name FROM users WHERE id = {$secondUserId}")->fetchColumn(), 'Current user is updated');
    expectSame('First user', $pdo->query("SELECT name FROM users WHERE id = {$firstUserId}")->fetchColumn(), 'Other users remain unchanged');

    $userCount = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    expectStatus(request($projectRoot, $path, '/api/auth/register', 'POST'), 403, 'Public registration is disabled');
    expectStatus(request($projectRoot, $path, '/api/auth/forgot-password', 'POST'), 403, 'Password reset request is disabled');
    expectStatus(request($projectRoot, $path, '/api/auth/reset-password', 'POST'), 403, 'Password reset is disabled');
    expectSame($userCount, (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn(), 'Disabled public auth routes do not create users');

    $loginPassword = 'valid-password';
    $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')->execute([
        'Login test user',
        'login@example.test',
        Auth::hashPassword($loginPassword),
    ]);
    $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')->execute([
        'Login reset user',
        'login-reset@example.test',
        Auth::hashPassword($loginPassword),
    ]);

    $crossOrigin = request(
        $projectRoot,
        $path,
        '/api/auth/login',
        'POST',
        null,
        ['email' => 'login@example.test', 'password' => $loginPassword],
        'https://attacker.example'
    );
    expectStatus($crossOrigin, 403, 'Cross-origin mutations are rejected');

    expectStatus(
        request(
            $projectRoot,
            $path,
            '/api/auth/login',
            'POST',
            null,
            ['email' => 'login@example.test', 'password' => $loginPassword],
            'http://127.0.0.1:8765',
            '127.0.0.1',
            '127.0.0.1:8765'
        ),
        200,
        'Same-origin login through the development proxy uses the forwarded host'
    );

    for ($attempt = 1; $attempt <= 5; $attempt++) {
        expectStatus(
            request(
                $projectRoot,
                $path,
                '/api/auth/login',
                'POST',
                null,
                ['email' => 'login@example.test', 'password' => 'wrong-password'],
                'http://localhost',
                '192.0.2.10'
            ),
            401,
            "Invalid login attempt {$attempt} is rejected without leaking account state"
        );
    }
    expectStatus(
        request(
            $projectRoot,
            $path,
            '/api/auth/login',
            'POST',
            null,
            ['email' => 'login@example.test', 'password' => 'wrong-password'],
            'http://localhost',
            '192.0.2.10'
        ),
        429,
        'Sixth invalid login attempt is rate limited'
    );

    for ($attempt = 1; $attempt <= 4; $attempt++) {
        request(
            $projectRoot,
            $path,
            '/api/auth/login',
            'POST',
            null,
            ['email' => 'login-reset@example.test', 'password' => 'wrong-password'],
            'http://localhost',
            '192.0.2.11'
        );
    }
    $validLogin = request(
            $projectRoot,
            $path,
            '/api/auth/login',
            'POST',
            null,
            ['email' => 'login-reset@example.test', 'password' => $loginPassword],
            'http://localhost',
            '192.0.2.11'
        );
    expectStatus($validLogin, 200, 'Valid same-origin login succeeds before the limit');
    $validLoginPayload = json_decode($validLogin['body'], true, flags: JSON_THROW_ON_ERROR);
    expectSame(1000, $validLoginPayload['data']['user']['xp_max'] ?? null, 'Login profile includes a finite XP target');
    expectSame(0, $validLoginPayload['data']['user']['best_streak'] ?? null, 'Login profile includes best streak');
    expectStatus(
        request(
            $projectRoot,
            $path,
            '/api/auth/login',
            'POST',
            null,
            ['email' => 'login-reset@example.test', 'password' => 'wrong-password'],
            'http://localhost',
            '192.0.2.11'
        ),
        401,
        'Successful login clears prior failures'
    );

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
