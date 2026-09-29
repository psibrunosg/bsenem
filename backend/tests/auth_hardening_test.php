<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/LoginThrottle.php';

function expectHardening(bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$path = tempnam(sys_get_temp_dir(), 'bsenem-auth-hardening-');
if ($path === false) throw new RuntimeException('Unable to create test database.');

putenv('APP_ENV=test');
putenv("APP_DB_PATH={$path}");

try {
    Database::resetForTests();
    $pdo = Database::getInstance()->getConnection();

    expectHardening(LoginThrottle::retryAfterSeconds() === 900, 'Throttle window must be 15 minutes.');

    $email = 'Throttle@Test.Example';
    $ip = '192.0.2.55';
    for ($attempt = 0; $attempt < 5; $attempt++) {
        expectHardening(LoginThrottle::isAllowed($email, $ip), 'First five account attempts must be allowed.');
        LoginThrottle::recordFailure($email, $ip);
    }
    expectHardening(!LoginThrottle::isAllowed($email, $ip), 'Sixth account attempt must be blocked.');

    $rows = $pdo->query("SELECT scope, key_hash FROM login_attempts")->fetchAll(PDO::FETCH_ASSOC);
    expectHardening(count($rows) === 10, 'Each failure must store account and IP scopes.');
    foreach ($rows as $row) {
        expectHardening(!str_contains($row['key_hash'], 'throttle@test.example'), 'Email must not be stored in clear text.');
        expectHardening(!str_contains($row['key_hash'], $ip), 'IP must not be stored in clear text.');
        expectHardening((bool) preg_match('/^[a-f0-9]{64}$/', $row['key_hash']), 'Throttle keys must be SHA-256 hashes.');
    }

    $sharedIp = '198.51.100.77';
    for ($attempt = 0; $attempt < 20; $attempt++) {
        $otherEmail = "ip-limit-{$attempt}@example.test";
        expectHardening(LoginThrottle::isAllowed($otherEmail, $sharedIp), 'First twenty IP attempts must be allowed.');
        LoginThrottle::recordFailure($otherEmail, $sharedIp);
    }
    expectHardening(!LoginThrottle::isAllowed('another@example.test', $sharedIp), 'Twenty-first IP attempt must be blocked.');

    echo "Auth hardening tests passed" . PHP_EOL;
} finally {
    unset($pdo);
    Database::resetForTests();
    gc_collect_cycles();
    foreach ([$path, "{$path}-wal", "{$path}-shm"] as $databaseFile) {
        if (is_file($databaseFile)) @unlink($databaseFile);
    }
}
