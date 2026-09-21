<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/LoginThrottle.php';
require_once __DIR__ . '/../utils/request.php';

class AuthController {
    public static function register(): void {
        Response::error('Acesso disponível somente para usuários aprovados.', 403);
    }

    public static function login(): void {
        $data = readJsonRequestBody();
        if (!is_array($data) || empty($data['email']) || empty($data['password'])) {
            Response::error('Email and password are required');
        }

        $email = trim(strtolower((string) $data['email']));
        $clientIp = LoginThrottle::clientIp();
        if (!LoginThrottle::isAllowed($email, $clientIp)) {
            header('Retry-After: ' . LoginThrottle::retryAfterSeconds());
            Response::error('Muitas tentativas. Aguarde alguns minutos e tente novamente.', 429);
        }

        $user = Database::getInstance()->fetch('SELECT * FROM users WHERE email = ?', [$email]);

        if (!$user || !Auth::verifyPassword((string) $data['password'], $user['password_hash'])) {
            LoginThrottle::recordFailure($email, $clientIp);
            Response::error('Invalid email or password', 401);
        }

        LoginThrottle::clearAccount($email);

        $token = Auth::createSession((int) $user['id']);
        Auth::setSessionCookie($token);

        Response::success(['user' => self::profile($user)], 'Login successful');
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

        Response::success(['user' => self::profile($user)]);
    }

    public static function forgotPassword(): void {
        Response::error('Acesso disponível somente para usuários aprovados.', 403);
    }

    public static function resetPassword(): void {
        Response::error('Acesso disponível somente para usuários aprovados.', 403);
    }

    public static function updateProfile(): void {
        $userId = Auth::requireAuth();
        $data = readJsonRequestBody();

        if (!is_array($data)) {
            Response::error('No data provided');
        }

        $name = isset($data['name']) ? trim((string) $data['name']) : '';
        if ($name === '' || mb_strlen($name) > 80) {
            Response::error('O nome deve ter entre 1 e 80 caracteres.');
        }

        Database::getInstance()->update('users', ['name' => $name], 'id = ?', [$userId]);
        $user = Database::getInstance()->fetch(
            'SELECT id, name, email, level, xp, streak, best_streak, created_at FROM users WHERE id = ?',
            [$userId]
        );
        Response::success(['user' => self::profile($user)], 'Perfil atualizado.');
    }

    private static function profile(array $user): array {
        $profile = [
            'id' => (int) $user['id'],
            'name' => (string) $user['name'],
            'email' => (string) $user['email'],
            'level' => (int) ($user['level'] ?? 1),
            'xp' => (int) ($user['xp'] ?? 0),
            'xp_max' => 1000,
            'streak' => (int) ($user['streak'] ?? 0),
            'best_streak' => (int) ($user['best_streak'] ?? 0),
        ];

        if (isset($user['created_at'])) {
            $profile['created_at'] = $user['created_at'];
        }

        return $profile;
    }
}
