<?php
class Resend {
    public static function sendEmail($to, $subject, $html) {
        $apiKey = getenv('RESEND_API_KEY') ?: ($_ENV['RESEND_API_KEY'] ?? '');
        $from = getenv('MAIL_FROM') ?: ($_ENV['MAIL_FROM'] ?? 'BSenem <onboarding@resend.dev>');
        
        if (empty($apiKey)) {
            // Em dev sem chave, apenas loga
            error_log("RESEND MOCK: Email to $to | Subject: $subject");
            return true;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.resend.com/emails');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'from' => $from,
            'to' => $to,
            'subject' => $subject,
            'html' => $html
        ]));
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        return $httpCode >= 200 && $httpCode < 300;
    }
}
