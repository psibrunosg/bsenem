<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

if ($argc !== 2 || filter_var($argv[1], FILTER_VALIDATE_EMAIL) === false) {
    fwrite(STDERR, "Usage: php backend/cli/provision-user.php user@example.com" . PHP_EOL);
    exit(2);
}

$email = strtolower($argv[1]);

function prompt(string $label): string {
    fwrite(STDOUT, $label);
    $value = fgets(STDIN);

    if ($value === false) {
        throw new RuntimeException('Interactive input is required.');
    }

    return trim($value);
}

try {
    $name = prompt('Name: ');
    $password = prompt('Password: ');

    if ($name === '') {
        throw new RuntimeException('Name is required.');
    }

    if (mb_strlen($password) < 12) {
        throw new RuntimeException('Password must contain at least 12 characters.');
    }

    $db = Database::getInstance();
    if ($db->fetch('SELECT id FROM users WHERE email = ?', [$email])) {
        throw new RuntimeException('A user with this email already exists.');
    }

    $algorithm = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT;
    $passwordHash = password_hash($password, $algorithm);
    if ($passwordHash === false) {
        throw new RuntimeException('Unable to create password hash.');
    }

    $userId = $db->insert('users', [
        'name' => $name,
        'email' => $email,
        'password_hash' => $passwordHash,
    ]);

    echo "Provisioned user {$userId}." . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
