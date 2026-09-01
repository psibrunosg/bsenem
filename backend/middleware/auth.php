<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';

class Auth {
    private const SESSION_COOKIE = 'bsenem_session';
    private const SESSION_LIFETIME = 604800;

    public static function createSession(int $userId): string {
        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', time() + self::SESSION_LIFETIME);

        Database::getInstance()->query(
            'INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [$userId, hash('sha256', $token), $expiresAt]
        );

        return $token;
    }

    public static function findUserIdByToken(?string $token): ?int {
        if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) {
            return null;
        }

        $userId = Database::getInstance()->fetch(
            'SELECT user_id FROM auth_sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP',
            [hash('sha256', $token)]
        )['user_id'] ?? null;

        return $userId === null ? null : (int) $userId;
    }

    public static function revokeToken(?string $token): void {
        if (!is_string($token) || $token === '') {
            return;
        }

        Database::getInstance()->query(
            'DELETE FROM auth_sessions WHERE token_hash = ?',
            [hash('sha256', $token)]
        );
    }

    public static function revokeCurrentSession(): void {
        self::revokeToken($_COOKIE[self::SESSION_COOKIE] ?? null);
    }

    public static function setSessionCookie(string $token): void {
        setcookie(self::SESSION_COOKIE, $token, [
            'expires' => time() + self::SESSION_LIFETIME,
            'path' => '/',
            'secure' => getenv('APP_ENV') === 'production',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    public static function clearSessionCookie(): void {
        setcookie(self::SESSION_COOKIE, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => getenv('APP_ENV') === 'production',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    public static function requireAuth(): int {
        $userId = self::getUserId();
        if ($userId === null) {
            Response::unauthorized('Authentication required');
        }

        return $userId;
    }

    public static function getUserId(): ?int {
        return self::findUserIdByToken($_COOKIE[self::SESSION_COOKIE] ?? null);
    }

    public static function hashPassword(string $password): string {
        $algorithm = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT;
        $hash = password_hash($password, $algorithm);
        if ($hash === false) {
            throw new RuntimeException('Unable to hash password.');
        }

        return $hash;
    }

    public static function verifyPassword(string $password, string $hash): bool {
        return password_verify($password, $hash);
    }
}
