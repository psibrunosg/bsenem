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
        if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) return null;
        $row = Database::getInstance()->fetch(
            'SELECT user_id FROM auth_sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP',
            [hash('sha256', $token)]
        );
        return isset($row['user_id']) ? (int) $row['user_id'] : null;
    }

    public static function createAccessKey(int $userId, string $name, ?int $days = 90): string {
        $secret = 'bse_' . bin2hex(random_bytes(32));
        $expiresAt = $days === null ? null : date('Y-m-d H:i:s', time() + max(1, min(365, $days)) * 86400);
        Database::getInstance()->query(
            'INSERT INTO access_keys (user_id, name, token_hash, expires_at) VALUES (?, ?, ?, ?)',
            [$userId, $name, hash('sha256', $secret), $expiresAt]
        );
        return $secret;
    }

    public static function findUserIdByAccessKey(?string $secret): ?int {
        if (!is_string($secret) || !preg_match('/^bse_[a-f0-9]{64}$/D', $secret)) return null;
        $db = Database::getInstance();
        $row = $db->fetch(
            'SELECT id, user_id FROM access_keys WHERE token_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)',
            [hash('sha256', $secret)]
        );
        if (!$row) return null;
        $db->query('UPDATE access_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [(int) $row['id']]);
        return (int) $row['user_id'];
    }

    public static function listAccessKeys(int $userId): array {
        return Database::getInstance()->fetchAll(
            'SELECT id, name, expires_at, last_used_at, created_at FROM access_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC',
            [$userId]
        );
    }

    public static function revokeAccessKey(int $userId, int $keyId): void {
        Database::getInstance()->query(
            'UPDATE access_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND revoked_at IS NULL',
            [$keyId, $userId]
        );
    }

    public static function revokeToken(?string $token): void {
        if (!is_string($token) || $token === '') return;
        Database::getInstance()->query('DELETE FROM auth_sessions WHERE token_hash = ?', [hash('sha256', $token)]);
    }

    public static function revokeCurrentSession(): void { self::revokeToken($_COOKIE[self::SESSION_COOKIE] ?? null); }

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
        if ($userId === null) Response::unauthorized('Authentication required');
        return $userId;
    }

    public static function getUserId(): ?int { return self::findUserIdByToken($_COOKIE[self::SESSION_COOKIE] ?? null); }

    public static function hashPassword(string $password): string {
        $algorithm = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT;
        $hash = password_hash($password, $algorithm);
        if ($hash === false) throw new RuntimeException('Unable to hash password.');
        return $hash;
    }

    public static function verifyPassword(string $password, string $hash): bool { return password_verify($password, $hash); }
}
