<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/response.php';

final class Csrf {
    public static function enforce(): void {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }

        $origin = self::normalizeOrigin((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
        $expected = self::expectedOrigin();
        if ($origin === '' || $expected === '' || !self::originsMatch($expected, $origin)) {
            Response::forbidden('Origem da requisição não permitida.');
        }
    }

    private static function expectedOrigin(): string {
        $configuredOrigin = self::normalizeOrigin((string) (getenv('APP_ALLOWED_ORIGIN') ?: getenv('APP_URL') ?: ''));
        if ($configuredOrigin !== '') {
            return $configuredOrigin;
        }

        $forwardedProto = explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0];
        $scheme = strtolower(trim($forwardedProto));
        if (!in_array($scheme, ['http', 'https'], true)) {
            $scheme = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http';
        }

        $forwardedHost = explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_HOST'] ?? ''))[0];
        $host = trim($forwardedHost) ?: trim((string) ($_SERVER['HTTP_HOST'] ?? ''));
        return $host === '' ? '' : self::normalizeOrigin("{$scheme}://{$host}");
    }

    private static function originsMatch(string $expected, string $origin): bool {
        if (hash_equals($expected, $origin)) {
            return true;
        }

        $expectedParts = parse_url($expected);
        $originParts = parse_url($origin);
        if (!is_array($expectedParts) || !is_array($originParts)) {
            return false;
        }

        return ($expectedParts['scheme'] ?? '') === 'http'
            && ($originParts['scheme'] ?? '') === 'https'
            && strtolower((string) ($expectedParts['host'] ?? '')) === strtolower((string) ($originParts['host'] ?? ''))
            && (int) ($expectedParts['port'] ?? 0) === (int) ($originParts['port'] ?? 0);
    }

    private static function normalizeOrigin(string $origin): string {
        $parts = parse_url(trim($origin));
        if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
            return '';
        }

        $scheme = strtolower((string) $parts['scheme']);
        $host = strtolower((string) $parts['host']);
        if (!in_array($scheme, ['http', 'https'], true)) {
            return '';
        }

        $port = isset($parts['port']) ? ':' . (int) $parts['port'] : '';
        return "{$scheme}://{$host}{$port}";
    }
}
