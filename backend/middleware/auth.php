<?php
// backend/middleware/auth.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';

class Auth {
    public static function generateToken($userId) {
        $payload = [
            'user_id' => $userId,
            'iat' => time(),
            'exp' => time() + (7 * 24 * 60 * 60) // 7 days
        ];
        
        $payloadEncoded = self::base64UrlEncode(json_encode($payload, JSON_THROW_ON_ERROR));
        $signature = hash_hmac('sha256', $payloadEncoded, self::secret(), true);

        return $payloadEncoded . '.' . self::base64UrlEncode($signature);
    }
    
    public static function verifyToken($token) {
        if (!$token) return null;
        
        $parts = explode('.', $token);
        if (count($parts) !== 2) return null;
        
        [$payloadEncoded, $signature] = $parts;
        // Verify signature
        $expectedSignature = self::base64UrlEncode(
            hash_hmac('sha256', $payloadEncoded, self::secret(), true)
        );
        
        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $decodedPayload = self::base64UrlDecode($payloadEncoded);
        if ($decodedPayload === false) return null;

        $payload = json_decode($decodedPayload, true);
        if (!is_array($payload) || !isset($payload['user_id'], $payload['exp'])) return null;

        // Check expiration
        if ($payload['exp'] < time()) {
            return null;
        }
        
        return $payload['user_id'] ?? null;
    }
    
    public static function requireAuth() {
        $userId = self::getUserId();
        if (!$userId) {
            Response::unauthorized('Authentication required');
        }
        return $userId;
    }
    
    public static function getUserId() {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        
        if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
            return self::verifyToken($matches[1]);
        }
        
        return null;
    }
    
    public static function hashPassword($password) {
        return password_hash($password, PASSWORD_BCRYPT);
    }
    
    public static function verifyPassword($password, $hash) {
        return password_verify($password, $hash);
    }

    private static function secret() {
        $secret = getenv('APP_TOKEN_SECRET');
        if (!is_string($secret) || strlen($secret) < 32) {
            throw new RuntimeException('Authentication is not configured');
        }

        return $secret;
    }
    
    private static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    private static function base64UrlDecode($data) {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
