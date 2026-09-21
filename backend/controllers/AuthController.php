<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class AuthController {
    public static function register(): void {
        Response::error('Acesso disponível somente para usuários aprovados.', 403);
    }

    public static function login(): void {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data) || empty($data['email']) || empty($data['password'])) {
            Response::error('Email and password are required');
        }

        $email = trim(strtolower((string) $data['email']));
        $user = Database::getInstance()->fetch('SELECT * FROM users WHERE email = ?', [$email]);

        if (!$user || !Auth::verifyPassword((string) $data['password'], $user['password_hash'])) {
            Response::error('Invalid email or password', 401);
        }

        $token = Auth::createSession((int) $user['id']);
        Auth::setSessionCookie($token);

        Response::success([
            'user' => [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'level' => (int) $user['level'],
                'xp' => (int) $user['xp'],
                'streak' => (int) $user['streak'],
            ],
        ], 'Login successful');
    }

    public static function logout(): void {
        Auth::revokeCurrentSession();
        Auth::clearSessionCookie();
        Response::success(null, 'Logout successful');
    }

    public static function me(): void {
        $userId = Auth::requireAuth();
        $user = Database::getInstance()->fetch(
            'SELECT id, name, email, level, xp, streak, best_streak, created_at FROM users WHERE id = ?',
            [$userId]
        );

        if (!$user) {
            Response::notFound('User not found');
        }

        Response::success(['user' => $user]);
    }

    public static function forgotPassword(): void {
        Response::error('Acesso disponível somente para usuários aprovados.', 403);
    }

    public static function resetPassword(): void {
        Response::error('Acesso disponível somente para usuários aprovados.', 403);
    }

    public static function updateProfile(): void {
        $userId = Auth::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!is_array($data)) {
            Response::error('No data provided');
        }

        $name = isset($data['name']) ? trim((string) $data['name']) : '';
        if ($name === '') {
            Response::error('No valid fields to update');
        }

        Database::getInstance()->update('users', ['name' => $name], 'id = ?', [$userId]);
        Response::success(null, 'Profile updated');
    }
}
