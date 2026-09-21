<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

function expectLibraryApi(bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$path = tempnam(sys_get_temp_dir(), 'bsenem-study-library-api-');
if ($path === false) {
    throw new RuntimeException('Unable to create isolated test database.');
}

putenv('APP_ENV=test');
putenv("APP_DB_PATH={$path}");

try {
    Database::resetForTests();
    $pdo = Database::getInstance()->getConnection();
    $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')->execute(['Library API user', 'library-api@example.test', str_repeat('x', 60)]);
    $userId = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO study_library_sources (user_id, provider, root_drive_id, root_url, title) VALUES (?, ?, ?, ?, ?)')->execute([
        $userId, 'google_drive', 'root', 'https://drive.google.com/drive/folders/root', 'Aulas',
    ]);
    $sourceId = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO study_library_items (user_id, source_id, drive_id, direct_url, name, catalog_path, item_type) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([
        $userId,
        $sourceId,
        'private-library-item',
        'https://drive.google.com/file/d/private-library-item/view',
        'Aula de Nutrição.pdf',
        'Instituições / Faculdade Unifatécie / Nutrição',
        'pdf',
    ]);
    $token = Auth::createSession($userId);

    putenv('TEST_METHOD=GET');
    putenv('TEST_URI=/api/study-library');
    putenv("TEST_COOKIE=bsenem_session={$token}");
    $process = proc_open(
        [PHP_BINARY, __DIR__ . '/route_request.php'],
        [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes
    );
    if (!is_resource($process)) {
        throw new RuntimeException('Unable to invoke the API route.');
    }
    $output = stream_get_contents($pipes[1]);
    $error = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $status = proc_close($process);
    $response = json_decode($output, true);

    expectLibraryApi($status === 0, "Library endpoint failed: {$error}");
    expectLibraryApi(($response['success'] ?? false) === true, 'Library endpoint responds successfully for an authenticated user');
    expectLibraryApi(($response['data']['children'][0]['label'] ?? null) === 'Instituições', 'Library endpoint exposes catalog navigation');
    expectLibraryApi(($response['data']['items'] ?? null) === [], 'Library endpoint keeps terminal materials out of a path that has children');
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

echo "Study library API tests passed" . PHP_EOL;
