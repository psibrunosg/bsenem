<?php
// backend/controllers/AuthController.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/Turnstile.php';
require_once __DIR__ . '/../utils/Resend.php';

class AuthController {
    public static function register() {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || empty($data['name']) || empty($data['email']) || empty($data['password'])) {
            Response::error('Name, email and password are required');
        }
        
        $name = trim($data['name']);
        $email = trim(strtolower($data['email']));
        $password = $data['password'];
        
        // Validate email
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email format');
        }
        
        // Validate password
        if (strlen($password) < 6) {
            Response::error('Password must be at least 6 characters');
        }
        
        $db = Database::getInstance();
        
        // Check if email exists
        $existing = $db->fetch("SELECT id FROM users WHERE email = ?", [$email]);
        if ($existing) {
            Response::error('Email already registered');
        }
        
        // Create user
        $passwordHash = Auth::hashPassword($password);
        $userId = $db->insert('users', [
            'name' => $name,
            'email' => $email,
            'password_hash' => $passwordHash
        ]);
        
        // Generate token
        $token = Auth::generateToken($userId);
        
        Response::success([
            'token' => $token,
            'user' => [
                'id' => $userId,
                'name' => $name,
                'email' => $email,
                'level' => 1,
                'xp' => 0,
                'streak' => 0
            ]
        ], 'Registration successful');
    }
    
    public static function login() {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || empty($data['email']) || empty($data['password'])) {
            Response::error('Email and password are required');
        }
        
        $email = trim(strtolower($data['email']));
        $password = $data['password'];
        
        $db = Database::getInstance();
        $user = $db->fetch("SELECT * FROM users WHERE email = ?", [$email]);
        
        if (!$user || !Auth::verifyPassword($password, $user['password_hash'])) {
            Response::error('Invalid email or password', 401);
        }
        
        $token = Auth::generateToken($user['id']);
        
        Response::success([
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'level' => $user['level'],
                'xp' => $user['xp'],
                'streak' => $user['streak']
            ]
        ], 'Login successful');
    }
    
    public static function me() {
        $userId = Auth::requireAuth();
        
        $db = Database::getInstance();
        $user = $db->fetch("SELECT id, name, email, level, xp, streak, best_streak, created_at FROM users WHERE id = ?", [$userId]);
        
        if (!$user) {
            Response::notFound('User not found');
        }
        
        Response::success(['user' => $user]);
    }
    
        public static function forgotPassword() {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!Turnstile::verify($data['turnstileToken'] ?? '')) {
            Response::error('Verificação de segurança falhou.');
        }

        $email = trim(strtolower($data['email'] ?? ''));
        if (empty($email)) Response::error('Email is required');

        $db = Database::getInstance();
        $user = $db->fetch("SELECT id, name FROM users WHERE email = ?", [$email]);
        
        if ($user) {
            $token = bin2hex(random_bytes(32));
            $expires = date('Y-m-d H:i:s', time() + 3600); // 1 hora
            $db->query("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?", [$token, $expires, $user['id']]);
            
            // Send email via Resend
            $html = "<h2>Recuperação de Senha</h2><p>Olá " . $user['name'] . ",</p><p>Use o token abaixo para redefinir sua senha:</p><p><b>" . $token . "</b></p><p>Este token expira em 1 hora.</p>";
            Resend::sendEmail($email, 'BSenem - Recuperação de Senha', $html);
        }

        // Always return success to prevent email enumeration
        Response::success(['message' => 'Se o e-mail existir, as instruções foram enviadas.']);
    }

    public static function resetPassword() {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!Turnstile::verify($data['turnstileToken'] ?? '')) {
            Response::error('Verificação de segurança falhou.');
        }

        $token = $data['token'] ?? '';
        $newPassword = $data['password'] ?? '';

        if (empty($token) || strlen($newPassword) < 6) {
            Response::error('Token inválido ou senha muito curta.');
        }

        $db = Database::getInstance();
        $user = $db->fetch("SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > ?", [$token, date('Y-m-d H:i:s')]);

        if (!$user) {
            Response::error('Token inválido ou expirado.');
        }

        $passwordHash = Auth::hashPassword($newPassword);
        $db->query("UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?", [$passwordHash, $user['id']]);

        Response::success(['message' => 'Senha alterada com sucesso!']);
    }

    public static function updateProfile() {
        $userId = Auth::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data) {
            Response::error('No data provided');
        }
        
        $db = Database::getInstance();
        $updates = [];
        
        if (isset($data['name'])) {
            $updates['name'] = trim($data['name']);
        }
        
        if (empty($updates)) {
            Response::error('No valid fields to update');
        }
        
        $db->update('users', $updates, 'id = ?', [$userId]);
        
        Response::success(null, 'Profile updated');
    }
}

