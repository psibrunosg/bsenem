<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function expectProvision(bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function runProvision(string $root, string $dbPath, string $email, string $password): array {
    $command = [PHP_BINARY, 'backend/cli/provision-user.php', $email];
    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];
    $environment = array_merge($_ENV, [
        'APP_ENV' => 'test',
        'APP_DB_PATH' => $dbPath,
    ]);
    $process = proc_open($command, $descriptors, $pipes, $root, $environment);
    if (!is_resource($process)) {
        throw new RuntimeException('Unable to start provision-user.php.');
    }

    fwrite($pipes[0], "Provision Test\n{$password}\n");
    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    return [proc_close($process), (string) $stdout, (string) $stderr];
}

$root = dirname(__DIR__, 2);
$dbPath = tempnam(sys_get_temp_dir(), 'bsenem-provision-test-');
if ($dbPath === false) throw new RuntimeException('Unable to create test database.');

try {
    [$code7, $out7, $err7] = runProvision($root, $dbPath, 'seven@example.test', '1234567');
    expectProvision($code7 === 1, 'Seven-character password must be rejected.');
    expectProvision(str_contains($err7, 'at least 8 characters'), 'Seven-character rejection must explain minimum length.');

    [$code8, $out8, $err8] = runProvision($root, $dbPath, 'eight@example.test', '12345678');
    expectProvision($code8 === 0, 'Eight-character password must be accepted.');
    expectProvision(str_contains($out8, 'Provisioned user'), 'Successful provisioning must confirm creation.');

    putenv('APP_ENV=test');
    putenv("APP_DB_PATH={$dbPath}");
    Database::resetForTests();
    $pdo = Database::getInstance()->getConnection();
    $count = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE email = 'eight@example.test'")->fetchColumn();
    expectProvision($count === 1, 'Accepted eight-character password must create the user.');

    $consoleInput = file_get_contents($root . '/backend/utils/ConsoleInput.php');
    expectProvision(str_contains((string) $consoleInput, '-AsSecureString'), 'Windows interactive password input must use SecureString.');
    expectProvision(str_contains((string) $consoleInput, 'stty -echo'), 'Unix interactive password input must disable terminal echo.');

    echo "Provision user tests passed" . PHP_EOL;
} finally {
    unset($pdo);
    Database::resetForTests();
    gc_collect_cycles();
    foreach ([$dbPath, "{$dbPath}-wal", "{$dbPath}-shm"] as $file) {
        if (is_file($file)) @unlink($file);
    }
}
