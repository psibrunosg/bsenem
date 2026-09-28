<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/ConsoleInput.php';

$email = strtolower(trim((string) ($argv[1] ?? '')));
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    fwrite(STDERR, "Usage: php backend/cli/reset-password.php user@example.com" . PHP_EOL);
    exit(2);
}

try {
    $db = Database::getInstance();
    $user = $db->fetch('SELECT id, email FROM users WHERE email = ?', [$email]);
    if (!$user) {
        throw new RuntimeException('User not found.');
    }

    $password = ConsoleInput::readPassword('New password: ');
    if (mb_strlen($password) < 8) {
        throw new RuntimeException('Password must contain at least 8 characters.');
    }

    $confirm = ConsoleInput::readPassword('Confirm password: ');
    if (!hash_equals($password, $confirm)) {
        throw new RuntimeException('Passwords do not match.');
    }

    $db->query(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [Auth::hashPassword($password), (int) $user['id']]
    );
    $db->query('DELETE FROM auth_sessions WHERE user_id = ?', [(int) $user['id']]);
    $db->query(
        'UPDATE access_keys SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
        [(int) $user['id']]
    );

    echo "Password updated. Existing sessions and access keys were revoked." . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
