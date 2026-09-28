<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/LoginThrottle.php';
require_once __DIR__ . '/../utils/Resend.php';
require_once __DIR__ . '/../utils/request.php';

class AuthController {
    private const RESET_TTL_SECONDS = 1800;

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
        if (!$user || !Auth::verifyPassword((string) $data['password'], (string) $user['password_hash'])) {
            LoginThrottle::recordFailure($email, $clientIp);
            Response::error('Invalid email or password', 401);
        }

        LoginThrottle::clearAccount($email);
        self::startSession((int) $user['id']);
        Response::success(['user' => self::profile($user)], 'Login successful');
    }

    public static function loginWithAccessKey(): void {
        $data = readJsonRequestBody();
        $secret = is_array($data) ? trim((string) ($data['access_key'] ?? '')) : '';
        $userId = Auth::findUserIdByAccessKey($secret);
        if ($userId === null) {
            Response::error('Chave de acesso inválida ou expirada.', 401);
        }

        $user = Database::getInstance()->fetch('SELECT * FROM users WHERE id = ?', [$userId]);
        if (!$user) {
            Response::error('Chave de acesso inválida ou expirada.', 401);
        }

        self::startSession($userId);
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
            'SELECT id, name, email, role, level, xp, streak, best_streak, created_at FROM users WHERE id = ?',
            [$userId]
        );
        if (!$user) Response::notFound('User not found');
        Response::success(['user' => self::profile($user)]);
    }

    public static function forgotPassword(): void {
        $data = readJsonRequestBody();
        $email = is_array($data) ? trim(strtolower((string) ($data['email'] ?? ''))) : '';
        $message = 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir a senha.';

        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            Response::success(null, $message);
        }

        $user = Database::getInstance()->fetch('SELECT id, name, email FROM users WHERE email = ?', [$email]);
        if (!$user) Response::success(null, $message);

        $token = bin2hex(random_bytes(32));
        $db = Database::getInstance();
        $db->query('DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL', [(int) $user['id']]);
        $db->query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [(int) $user['id'], hash('sha256', $token), date('Y-m-d H:i:s', time() + self::RESET_TTL_SECONDS)]
        );

        $appUrl = rtrim((string) (getenv('APP_URL') ?: 'http://localhost:5173'), '/');
        $resetUrl = $appUrl . '/?reset_token=' . rawurlencode($token);
        $safeName = htmlspecialchars((string) $user['name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $safeUrl = htmlspecialchars($resetUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        Resend::sendEmail(
            (string) $user['email'],
            'Redefinição de senha - BS Estudos',
            "<p>Olá, {$safeName}.</p><p>Recebemos um pedido para redefinir sua senha.</p><p><a href=\"{$safeUrl}\">Criar nova senha</a></p><p>O link expira em 30 minutos. Se você não solicitou, ignore este e-mail.</p>"
        );

        Response::success(null, $message);
    }

    public static function resetPassword(): void {
        $data = readJsonRequestBody();
        $token = is_array($data) ? trim((string) ($data['token'] ?? '')) : '';
        $password = is_array($data) ? (string) ($data['password'] ?? '') : '';

        if (!preg_match('/^[a-f0-9]{64}$/D', $token) || mb_strlen($password) < 8) {
            Response::error('Token inválido ou senha com menos de 8 caracteres.');
        }

        $db = Database::getInstance();
        $reset = $db->fetch(
            'SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP',
            [hash('sha256', $token)]
        );
        if (!$reset) Response::error('Link de redefinição inválido ou expirado.', 400);

        $pdo = $db->getConnection();
        $pdo->beginTransaction();
        try {
            $db->query('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
                Auth::hashPassword($password), (int) $reset['user_id']
            ]);
            $db->query('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [(int) $reset['id']]);
            $db->query('DELETE FROM auth_sessions WHERE user_id = ?', [(int) $reset['user_id']]);
            $db->query('UPDATE access_keys SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL', [(int) $reset['user_id']]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }

        Auth::clearSessionCookie();
        Response::success(null, 'Senha redefinida. Entre novamente com sua nova senha.');
    }

    public static function listAccessKeys(): void {
        $userId = Auth::requireAuth();
        Response::success(['access_keys' => Auth::listAccessKeys($userId)]);
    }

    public static function createAccessKey(): void {
        $userId = Auth::requireAuth();
        $data = readJsonRequestBody();
        $name = is_array($data) ? trim((string) ($data['name'] ?? '')) : '';
        $password = is_array($data) ? (string) ($data['password'] ?? '') : '';
        $days = is_array($data) && isset($data['expires_in_days']) ? (int) $data['expires_in_days'] : 90;

        if ($name === '' || mb_strlen($name) > 80) Response::error('Informe um nome para a chave.');
        $user = Database::getInstance()->fetch('SELECT password_hash FROM users WHERE id = ?', [$userId]);
        if (!$user || !Auth::verifyPassword($password, (string) $user['password_hash'])) {
            Response::error('Confirme sua senha atual para criar uma chave.', 401);
        }

        $secret = Auth::createAccessKey($userId, $name, $days);
        Response::success([
            'access_key' => $secret,
            'name' => $name,
            'expires_in_days' => max(1, min(365, $days)),
        ], 'Guarde esta chave agora. Ela não será exibida novamente.');
    }

    public static function revokeAccessKey(int $keyId): void {
        $userId = Auth::requireAuth();
        Auth::revokeAccessKey($userId, $keyId);
        Response::success(null, 'Chave revogada.');
    }

    public static function updateProfile(): void {
        $userId = Auth::requireAuth();
        $data = readJsonRequestBody();
        if (!is_array($data)) Response::error('No data provided');

        $name = isset($data['name']) ? trim((string) $data['name']) : '';
        if ($name === '' || mb_strlen($name) > 80) Response::error('O nome deve ter entre 1 e 80 caracteres.');

        Database::getInstance()->update('users', ['name' => $name], 'id = ?', [$userId]);
        $user = Database::getInstance()->fetch(
            'SELECT id, name, email, role, level, xp, streak, best_streak, created_at FROM users WHERE id = ?',
            [$userId]
        );
        Response::success(['user' => self::profile($user)], 'Perfil atualizado.');
    }

    private static function startSession(int $userId): void {
        $token = Auth::createSession($userId);
        Auth::setSessionCookie($token);
    }

    private static function profile(array $user): array {
        $profile = [
            'id' => (int) $user['id'], 'name' => (string) $user['name'], 'email' => (string) $user['email'],
            'role' => (string) ($user['role'] ?? 'student'),
            'level' => (int) ($user['level'] ?? 1), 'xp' => (int) ($user['xp'] ?? 0), 'xp_max' => 1000,
            'streak' => (int) ($user['streak'] ?? 0), 'best_streak' => (int) ($user['best_streak'] ?? 0),
        ];
        if (isset($user['created_at'])) $profile['created_at'] = $user['created_at'];
        return $profile;
    }
}
