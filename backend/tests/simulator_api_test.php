<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

function expectSimulatorApiSame(mixed $expected, mixed $actual, string $message): void {
    if ($expected !== $actual) {
        throw new RuntimeException($message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}

function expectSimulatorApiTrue(bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function expectSimulatorApiStatus(array $response, int $expectedStatus, string $message): void {
    expectSimulatorApiSame(
        $expectedStatus,
        $response['status'],
        $message . ' (' . trim($response['error']) . '; body: ' . trim($response['body']) . ')'
    );
}

/** @param array<string, mixed> $body */
function simulatorApiRequest(string $root, string $path, string $uri, string $method, ?string $cookie = null, array $body = []): array {
    $environment = array_merge($_ENV, [
        'APP_ENV' => 'test',
        'APP_DB_PATH' => $path,
        'TEST_METHOD' => $method,
        'TEST_URI' => $uri,
        'TEST_COOKIE' => $cookie ?? '',
    ]);
    $process = proc_open(
        [PHP_BINARY, 'backend/tests/route_request.php'],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes,
        $root,
        $environment
    );
    if (!is_resource($process)) {
        throw new RuntimeException('Unable to invoke simulator API route.');
    }

    fwrite($pipes[0], json_encode($body, JSON_THROW_ON_ERROR));
    fclose($pipes[0]);
    $responseBody = stream_get_contents($pipes[1]);
    $error = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    proc_close($process);
    preg_match('/__STATUS__(\d{3})/', $error, $match);

    return [
        'status' => isset($match[1]) ? (int) $match[1] : 0,
        'body' => $responseBody,
        'error' => $error,
    ];
}

function insertSimulatorApiUser(PDO $pdo, string $email): int {
    $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')->execute([
        'Simulator API user', $email, str_repeat('x', 60),
    ]);

    return (int) $pdo->lastInsertId();
}

function insertSimulatorApiQuestion(PDO $pdo, int $number, string $subject, string $correctOption = 'A'): int {
    $pdo->prepare(
        'INSERT INTO enem_questions (
            year, day, question_number, area, statement,
            option_a, option_b, option_c, option_d, option_e,
            correct_option, status, source_pdf, source_page, source_pages,
            content_hash, inep_url, mirror_url, images
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        2024, 1, $number, $subject, "Questao {$number}",
        'A', 'B', 'C', 'D', 'E', $correctOption, 'valid', 'enem-2024.pdf', 1, '[1]',
        hash('sha256', "{$subject}-{$number}"), 'https://www.gov.br/inep/enem',
        'https://example.test/enem', '[]',
    ]);

    return (int) $pdo->lastInsertId();
}

$path = tempnam(sys_get_temp_dir(), 'bsenem-simulator-api-test-');
if ($path === false) {
    throw new RuntimeException('Unable to create isolated test database.');
}

putenv('APP_ENV=test');
putenv("APP_DB_PATH={$path}");

try {
    Database::resetForTests();
    $pdo = Database::getInstance()->getConnection();
    $firstUserId = insertSimulatorApiUser($pdo, 'first-simulator-api@example.test');
    $secondUserId = insertSimulatorApiUser($pdo, 'second-simulator-api@example.test');
    for ($number = 1; $number <= 10; $number++) {
        insertSimulatorApiQuestion($pdo, $number, 'Matemática', $number === 1 ? 'B' : 'A');
    }
    insertSimulatorApiQuestion($pdo, 11, 'História');

    $firstCookie = 'bsenem_session=' . Auth::createSession($firstUserId);
    $secondCookie = 'bsenem_session=' . Auth::createSession($secondUserId);
    $root = realpath(__DIR__ . '/../..');
    if ($root === false) {
        throw new RuntimeException('Project root is unavailable.');
    }

    expectSimulatorApiStatus(simulatorApiRequest($root, $path, '/api/simulators/catalog', 'GET'), 401, 'Catalog requires authentication');
    expectSimulatorApiStatus(simulatorApiRequest($root, $path, '/api/simulators/sessions', 'POST', $firstCookie, ['kind' => 'practice']), 400, 'Malformed practice is rejected');
    expectSimulatorApiStatus(simulatorApiRequest($root, $path, '/api/simulators/sessions', 'POST', $firstCookie, [
        'kind' => 'custom', 'subjects' => ['Unknown'], 'count' => 1,
    ]), 400, 'Unknown subject is rejected');
    $insufficientSupply = simulatorApiRequest($root, $path, '/api/simulators/sessions', 'POST', $firstCookie, [
        'kind' => 'custom', 'subjects' => ['Matemática'], 'count' => 11,
    ]);
    expectSimulatorApiStatus($insufficientSupply, 409, 'Count above available supply is rejected');
    $insufficientSupplyPayload = json_decode($insufficientSupply['body'], true, flags: JSON_THROW_ON_ERROR);
    expectSimulatorApiSame(
        10,
        $insufficientSupplyPayload['errors']['available'] ?? null,
        'Insufficient supply reports the real available count for the requested subject/topic combination'
    );

    $catalog = simulatorApiRequest($root, $path, '/api/simulators/catalog', 'GET', $firstCookie);
    expectSimulatorApiStatus($catalog, 200, 'Catalog is returned for its owner');
    $catalogPayload = json_decode($catalog['body'], true, flags: JSON_THROW_ON_ERROR);
    expectSimulatorApiTrue(
        in_array('Matemática', array_column($catalogPayload['data']['subjects'] ?? [], 'key'), true),
        'Catalog exposes eligible subjects'
    );

    $emptyOverview = simulatorApiRequest($root, $path, '/api/simulators/overview', 'GET', $firstCookie);
    expectSimulatorApiStatus($emptyOverview, 200, 'Overview without history is returned');
    $emptyOverviewPayload = json_decode($emptyOverview['body'], true, flags: JSON_THROW_ON_ERROR);
    expectSimulatorApiSame(null, $emptyOverviewPayload['data']['recommendation'], 'Overview without history has no invented recommendation');

    $created = simulatorApiRequest($root, $path, '/api/simulators/sessions', 'POST', $firstCookie, [
        'kind' => 'practice', 'subjects' => ['Matemática'], 'count' => 10,
    ]);
    expectSimulatorApiStatus($created, 201, 'Practice is created');
    $createdPayload = json_decode($created['body'], true, flags: JSON_THROW_ON_ERROR);
    $id = $createdPayload['data']['session']['id'];
    expectSimulatorApiSame('practice', $createdPayload['data']['session']['kind'], 'Practice kind is retained');
    expectSimulatorApiTrue(!array_key_exists('correct_option', $createdPayload['data']['session']['questions'][0]), 'Active questions hide correct answers');

    $active = simulatorApiRequest($root, $path, '/api/simulators/sessions?status=active', 'GET', $firstCookie);
    expectSimulatorApiStatus($active, 200, 'Active sessions are listed');
    $activePayload = json_decode($active['body'], true, flags: JSON_THROW_ON_ERROR);
    expectSimulatorApiSame($id, $activePayload['data']['sessions'][0]['id'] ?? null, 'Active list only includes the owner session');

    expectSimulatorApiStatus(simulatorApiRequest($root, $path, "/api/simulators/sessions/{$id}/progress", 'PATCH', $secondCookie, []), 404, 'Foreign session is hidden');
    expectSimulatorApiSame(0, (int) $pdo->query("SELECT current_position FROM simulator_sessions WHERE id = '{$id}'")->fetchColumn(), 'Foreign progress does not mutate the draft');

    expectSimulatorApiStatus(simulatorApiRequest($root, $path, "/api/simulators/sessions/{$id}/progress/qualquer-coisa", 'PATCH', $firstCookie, [
        'position' => 0, 'elapsed_seconds' => 999, 'answers' => [],
    ]), 404, 'PATCH with a trailing segment after progress does not match any route');
    expectSimulatorApiStatus(simulatorApiRequest($root, $path, "/api/simulators/sessions/{$id}/complete/qualquer-coisa", 'POST', $firstCookie), 404, 'POST with a trailing segment after complete does not match any route');
    expectSimulatorApiSame(0, (int) $pdo->query("SELECT current_position FROM simulator_sessions WHERE id = '{$id}'")->fetchColumn(), 'Trailing segment on progress does not mutate the draft');
    expectSimulatorApiSame('active', (string) $pdo->query("SELECT status FROM simulator_sessions WHERE id = '{$id}'")->fetchColumn(), 'Trailing segment on complete does not close the session');

    $progress = simulatorApiRequest($root, $path, "/api/simulators/sessions/{$id}/progress", 'PATCH', $firstCookie, [
        'position' => 0,
        'elapsed_seconds' => 42,
        'answers' => [['question_id' => $createdPayload['data']['session']['questions'][0]['id'], 'selected_option' => 'B', 'flagged' => true]],
    ]);
    expectSimulatorApiStatus($progress, 200, 'Owner progress is persisted');
    $progressPayload = json_decode($progress['body'], true, flags: JSON_THROW_ON_ERROR);
    expectSimulatorApiSame(true, $progressPayload['data']['session']['answers'][0]['flagged'] ?? null, 'Progress returns the persisted flag');
    expectSimulatorApiTrue(!array_key_exists('correct_option', $progressPayload['data']['session']['questions'][0]), 'Progress DTO still hides correct answers');

    $completed = simulatorApiRequest($root, $path, "/api/simulators/sessions/{$id}/complete", 'POST', $firstCookie);
    expectSimulatorApiStatus($completed, 200, 'Completion succeeds');
    $completedPayload = json_decode($completed['body'], true, flags: JSON_THROW_ON_ERROR);
    expectSimulatorApiSame(1, $completedPayload['data']['result']['correct'] ?? null, 'Completion calculates answers on the server');
    expectSimulatorApiSame('B', $completedPayload['data']['session']['questions'][0]['correct_option'] ?? null, 'Completed review exposes the necessary correct answer');
    $completedAgain = simulatorApiRequest($root, $path, "/api/simulators/sessions/{$id}/complete", 'POST', $firstCookie);
    expectSimulatorApiStatus($completedAgain, 200, 'Completion is idempotent');
    expectSimulatorApiSame(
        $completedPayload['data']['result'],
        json_decode($completedAgain['body'], true, flags: JSON_THROW_ON_ERROR)['data']['result'] ?? null,
        'Repeated completion returns the canonical result'
    );

    $insufficientOverview = simulatorApiRequest($root, $path, '/api/simulators/overview', 'GET', $firstCookie);
    expectSimulatorApiStatus($insufficientOverview, 200, 'Overview with insufficient history is returned');
    $insufficientPayload = json_decode($insufficientOverview['body'], true, flags: JSON_THROW_ON_ERROR);
    expectSimulatorApiSame('insufficient', $insufficientPayload['data']['mastery'][0]['status'] ?? null, 'One completed answer remains insufficient');
    expectSimulatorApiSame(null, $insufficientPayload['data']['mastery'][0]['accuracy'], 'Insufficient history has no fabricated percentage');

    $practiceSubject = 'Ciências';
    for ($number = 1; $number <= 6; $number++) {
        insertSimulatorApiQuestion($pdo, 100 + $number, $practiceSubject, 'A');
    }

    $setupSession = simulatorApiRequest($root, $path, '/api/simulators/sessions', 'POST', $firstCookie, [
        'kind' => 'custom', 'subjects' => [$practiceSubject], 'count' => 3,
    ]);
    expectSimulatorApiStatus($setupSession, 201, 'Setup session for practice composition history is created');
    $setupPayload = json_decode($setupSession['body'], true, flags: JSON_THROW_ON_ERROR);
    $setupSessionId = $setupPayload['data']['session']['id'];
    $setupQuestionIds = array_column($setupPayload['data']['session']['questions'], 'id');

    $setupProgress = simulatorApiRequest($root, $path, "/api/simulators/sessions/{$setupSessionId}/progress", 'PATCH', $firstCookie, [
        'position' => 2,
        'elapsed_seconds' => 10,
        'answers' => [
            ['question_id' => $setupQuestionIds[0], 'selected_option' => 'B', 'flagged' => false],
            ['question_id' => $setupQuestionIds[1], 'selected_option' => 'A', 'flagged' => false],
        ],
    ]);
    expectSimulatorApiStatus($setupProgress, 200, 'Setup answers are persisted');
    expectSimulatorApiStatus(simulatorApiRequest($root, $path, "/api/simulators/sessions/{$setupSessionId}/complete", 'POST', $firstCookie), 200, 'Setup session is completed');

    $practice = simulatorApiRequest($root, $path, '/api/simulators/sessions', 'POST', $firstCookie, [
        'kind' => 'practice', 'subjects' => [$practiceSubject], 'count' => 3,
    ]);
    expectSimulatorApiStatus($practice, 201, 'Practice composition is created from available supply');
    $practicePayload = json_decode($practice['body'], true, flags: JSON_THROW_ON_ERROR);
    $practiceQuestionIds = array_column($practicePayload['data']['session']['questions'], 'id');

    expectSimulatorApiTrue(
        in_array($setupQuestionIds[0], $practiceQuestionIds, true),
        'Practice composition prioritizes a recently missed, still-eligible question'
    );
    expectSimulatorApiTrue(
        !in_array($setupQuestionIds[1], $practiceQuestionIds, true),
        'Practice composition avoids a recently used, correctly answered question while enough alternate supply exists'
    );
    expectSimulatorApiTrue(
        !in_array($setupQuestionIds[2], $practiceQuestionIds, true),
        'Practice composition avoids a recently served but unanswered question while enough alternate supply exists'
    );
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

echo "Simulator API tests passed" . PHP_EOL;
