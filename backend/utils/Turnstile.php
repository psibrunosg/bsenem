<?php
class Turnstile {
    public static function verify($token) {
        $secret = getenv('TURNSTILE_SECRET_KEY') ?: ($_ENV['TURNSTILE_SECRET_KEY'] ?? '');
        if (empty($secret)) {
            // Se nao houver chave configurada, passa direto (para desenv)
            return true;
        }
        
        if (empty($token)) return false;

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'secret' => $secret,
            'response' => $token
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        if ($response) {
            $data = json_decode($response, true);
            return isset($data['success']) && $data['success'] === true;
        }
        
        return false;
    }
}
