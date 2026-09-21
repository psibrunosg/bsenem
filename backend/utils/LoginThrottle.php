<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

final class LoginThrottle {
    private const WINDOW_SECONDS = 900;
    private const ACCOUNT_LIMIT = 5;
    private const IP_LIMIT = 20;

    public static function isAllowed(string $email, string $ipAddress): bool {
        self::pruneExpired();

        return self::count('account', self::hashKey($email)) < self::ACCOUNT_LIMIT
            && self::count('ip', self::hashKey($ipAddress)) < self::IP_LIMIT;
    }

    public static function recordFailure(string $email, string $ipAddress): void {
        $database = Database::getInstance();
        $database->query(
            'INSERT INTO login_attempts (scope, key_hash) VALUES (?, ?), (?, ?)',
            ['account', self::hashKey($email), 'ip', self::hashKey($ipAddress)]
        );
    }

    public static function clearAccount(string $email): void {
        Database::getInstance()->query(
            'DELETE FROM login_attempts WHERE scope = ? AND key_hash = ?',
            ['account', self::hashKey($email)]
        );
    }

    public static function retryAfterSeconds(): int {
        return self::WINDOW_SECONDS;
    }

    public static function clientIp(): string {
        $candidate = trim((string) ($_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown'));
        return filter_var($candidate, FILTER_VALIDATE_IP) !== false ? $candidate : 'unknown';
    }

    private static function count(string $scope, string $keyHash): int {
        $row = Database::getInstance()->fetch(
            "SELECT COUNT(*) AS total FROM login_attempts
             WHERE scope = ? AND key_hash = ? AND attempted_at >= datetime('now', ?)",
            [$scope, $keyHash, '-' . self::WINDOW_SECONDS . ' seconds']
        );

        return (int) ($row['total'] ?? 0);
    }

    private static function pruneExpired(): void {
        Database::getInstance()->query(
            "DELETE FROM login_attempts WHERE attempted_at < datetime('now', ?)",
            ['-' . self::WINDOW_SECONDS . ' seconds']
        );
    }

    private static function hashKey(string $value): string {
        return hash('sha256', strtolower(trim($value)));
    }
}
