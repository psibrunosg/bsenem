<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/ConsoleInput.php';

function expectTrue($condition, $message) {
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$passwordInput = fopen('php://memory', 'r+');
$passwordOutput = fopen('php://memory', 'r+');
fwrite($passwordInput, "eight888\n");
rewind($passwordInput);
$readPassword = ConsoleInput::readPassword(
    'Password: ',
    $passwordInput,
    $passwordOutput,
    false
);
rewind($passwordOutput);
expectTrue($readPassword === 'eight888', 'Password input accepts redirected input');
expectTrue(stream_get_contents($passwordOutput) === 'Password: ', 'Password prompt does not repeat the password');
fclose($passwordInput);
fclose($passwordOutput);

$path = tempnam(sys_get_temp_dir(), 'bsenem-auth-test-');
if ($path === false) {
    throw new RuntimeException('Unable to create isolated test database.');
}

putenv('APP_ENV=test');
putenv("APP_DB_PATH={$path}");

try {
    Database::resetForTests();
    $pdo = Database::getInstance()->getConnection();
    $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')->execute([
        'Auth test user',
        'auth@example.test',
        str_repeat('x', 60),
    ]);

    $userId = (int) $pdo->lastInsertId();
    $token = Auth::createSession($userId);
    expectTrue(strlen($token) === 64, 'Session token is opaque');
    expectTrue(Auth::findUserIdByToken($token) === $userId, 'Stored session resolves user');
    expectTrue(Auth::findUserIdByToken($token . 'x') === null, 'Changed session is rejected');
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

echo "Auth tests passed" . PHP_EOL;
