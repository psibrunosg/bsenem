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
        if ($origin === '' || $expected === '' || !hash_equals($expected, $origin)) {
            Response::forbidden('Origem da requisição não permitida.');
        }
    }

    private static function expectedOrigin(): string {
        $forwardedProto = explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0];
        $scheme = strtolower(trim($forwardedProto));
        if (!in_array($scheme, ['http', 'https'], true)) {
            $scheme = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http';
        }

        $forwardedHost = explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_HOST'] ?? ''))[0];
        $host = trim($forwardedHost) ?: trim((string) ($_SERVER['HTTP_HOST'] ?? ''));
        return $host === '' ? '' : self::normalizeOrigin("{$scheme}://{$host}");
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
