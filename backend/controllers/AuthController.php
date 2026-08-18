<?php
// backend/controllers/AuthController.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';

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
