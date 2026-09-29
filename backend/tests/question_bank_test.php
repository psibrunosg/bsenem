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
    if (!$condition) throw new RuntimeException($message);
}

function requestQuestionBank(string $projectRoot, string $databasePath, string $uri, string $method, array $body = [], ?string $cookie = null, bool $decodeJson = true): array {
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
    if (!is_resource($process)) throw new RuntimeException('Unable to invoke test route.');

    fwrite($pipes[0], json_encode($body, JSON_THROW_ON_ERROR));
    fclose($pipes[0]);
    $responseBody = stream_get_contents($pipes[1]);
    $errorOutput = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    proc_close($process);
    preg_match('/__STATUS__(\d{3})/', $errorOutput, $match);

    return [
        'status' => isset($match[1]) ? (int) $match[1] : 0,
        'body' => $decodeJson ? json_decode($responseBody, true, flags: JSON_THROW_ON_ERROR) : $responseBody,
        'error' => $errorOutput,
    ];
}

$projectRoot = realpath(__DIR__ . '/../..');
$path = tempnam(sys_get_temp_dir(), 'bsenem-question-bank-test-');
if ($projectRoot === false || $path === false) throw new RuntimeException('Unable to create isolated test context.');

try {
    putenv('APP_ENV=test');
    putenv("APP_DB_PATH={$path}");
    Database::resetForTests();
    initializeDatabase();
    $pdo = Database::getInstance()->getConnection();
    expectSame(
        1,
        (int) $pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'question_bank_sessions'")->fetchColumn(),
        'Question bank session storage is migrated'
    );

    $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
        ->execute(['Question bank user', 'question-bank@example.test', str_repeat('x', 60)]);
    $userId = (int) $pdo->lastInsertId();
    $token = Auth::createSession($userId);

    $enemStatement = $pdo->prepare(
        'INSERT INTO enem_questions (year, day, question_number, area, statement, option_a, option_b, option_c, option_d, option_e, correct_option, status, pending_reason, source_pdf, source_page, source_pages, content_hash, inep_url, mirror_url, images, foreign_language_option, extra_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for ($number = 1; $number <= 10; $number++) {
        $enemStatement->execute([
            2025, 2, $number, 'Matemática e suas Tecnologias', "Questão ENEM {$number}", 'A', 'B', 'C', 'D', 'E', 'A', 'valid', null,
            '2025/prova.pdf', 1, '[1]', "hash-{$number}", 'https://inep.example.test', 'https://mirror.example.test', '["assets/2020/dia-2/q103_recovered_table.png"]', null, null,
        ]);
    }
    $enemStatement->execute([
        2025, 2, 11, 'Matemática e suas Tecnologias', 'Questão ENEM quarantinada', 'A', 'B', 'C', 'D', 'E', 'A', 'valid', null,
        '2025/prova.pdf', 1, '[1]', 'hash-11', 'https://inep.example.test', 'https://mirror.example.test', '["assets/2020/dia-2/q103_recovered_table.png"]', null, null,
    ]);
    $pdo->exec("UPDATE enem_questions SET quality_status = 'quarantined' WHERE question_number = 11");

    $response = requestQuestionBank($projectRoot, $path, '/api/question-bank/facets', 'GET');
    expectSame(401, $response['status'], 'Question bank facets require an authenticated session');

    $cookie = "bsenem_session={$token}";
    $facets = requestQuestionBank($projectRoot, $path, '/api/question-bank/facets?track=enem', 'GET', [], $cookie);
    expectSame(200, $facets['status'], 'Authenticated user can load ENEM facets');
    expectSame('matematica', $facets['body']['data']['subjects'][0]['slug'] ?? null, 'ENEM area is exposed as a subject facet');
    expectSame(10, $facets['body']['data']['subjects'][0]['count'] ?? null, 'Facet count includes only answerable questions');

    $session = requestQuestionBank($projectRoot, $path, '/api/question-bank/sessions', 'POST', [
        'track' => 'enem', 'subject' => 'matematica', 'questionCount' => 10,
    ], $cookie);
    expectSame(200, $session['status'], 'Authenticated user can create a question bank session');
    $sessionData = $session['body']['data'] ?? [];
    expectSame(10, count($sessionData['questions'] ?? []), 'Session returns the requested number of unique questions');
    expectTrue(!array_key_exists('correctOption', $sessionData['questions'][0] ?? []), 'Session payload does not leak the official answer');
    expectTrue(!in_array('Questão ENEM quarantinada', array_column($sessionData['questions'] ?? [], 'text'), true), 'Quarantined ENEM questions never enter a student session');
    foreach ($sessionData['questions'] ?? [] as $question) {
        expectTrue(str_starts_with((string) ($question['images'][0] ?? ''), '/api/simulators/questions/inep%3A'), 'Question bank images reuse the authenticated simulator image route');
    }
    $imageUrl = $sessionData['questions'][0]['images'][0] ?? '';
    expectSame(401, requestQuestionBank($projectRoot, $path, $imageUrl, 'GET', [], null, false)['status'], 'Question bank image route requires authentication');
    expectSame(200, requestQuestionBank($projectRoot, $path, $imageUrl, 'GET', [], $cookie, false)['status'], 'Authenticated question bank image route serves the official asset');

    $answers = array_map(
        static fn(array $question, int $index): array => ['questionId' => $question['id'], 'selectedOption' => $index === 0 ? 1 : 0, 'flagged' => $index === 0],
        $sessionData['questions'],
        array_keys($sessionData['questions'])
    );
    $submitted = requestQuestionBank(
        $projectRoot,
        $path,
        '/api/question-bank/sessions/' . rawurlencode((string) ($sessionData['sessionId'] ?? 'missing')) . '/submit',
        'POST',
        ['answers' => $answers],
        $cookie
    );
    expectSame(200, $submitted['status'], 'Session submission is corrected by the server');
    expectSame(9, $submitted['body']['data']['correct'] ?? null, 'Server calculates official-answer score');

    $errors = requestQuestionBank($projectRoot, $path, '/api/question-bank/errors', 'GET', [], $cookie);
    expectSame(200, $errors['status'], 'Authenticated user can access the server error notebook');
    expectSame(1, count($errors['body']['data'] ?? []), 'Error notebook contains only incorrect responses');
    echo "Question bank API contract test passed" . PHP_EOL;
} finally {
    unset($enemStatement, $pdo);
    Database::resetForTests();
    gc_collect_cycles();
    foreach ([$path, "{$path}-wal", "{$path}-shm"] as $databaseFile) {
        if (is_file($databaseFile)) unlink($databaseFile);
    }
}
