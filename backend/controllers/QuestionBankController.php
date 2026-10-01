<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/QuestionBank.php';

final class QuestionBankController {
    public static function facets(): void {
        Auth::requireAuth();
        parse_str((string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_QUERY), $query);
        self::respond(fn(QuestionBank $bank): array => $bank->facets($query['track'] ?? null, $query['subject'] ?? null, $query['specialty'] ?? null));
    }

    public static function createSession(): void {
        $userId = Auth::requireAuth();
        self::respond(fn(QuestionBank $bank): array => $bank->createSession($userId, self::body()));
    }

    public static function submitSession(string $sessionId): void {
        $userId = Auth::requireAuth();
        self::respond(fn(QuestionBank $bank): array => $bank->submitSession($userId, $sessionId, self::body()));
    }

    public static function errors(): void {
        $userId = Auth::requireAuth();
        self::respond(fn(QuestionBank $bank): array => $bank->errors($userId));
    }

    public static function history(): void {
        $userId = Auth::requireAuth();
        self::respond(fn(QuestionBank $bank): array => $bank->history($userId));
    }

    private static function body(): array {
        $raw = file_get_contents('php://input');
        if ($raw === '' && PHP_SAPI === 'cli') $raw = file_get_contents('php://stdin');
        $body = json_decode($raw, true);
        if (!is_array($body)) Response::error('Corpo da solicitação inválido.');
        return $body;
    }

    private static function respond(callable $operation): void {
        try {
            Response::success($operation(new QuestionBank(Database::getInstance()->getConnection())));
        } catch (OutOfBoundsException $error) {
            Response::notFound($error->getMessage());
        } catch (InvalidArgumentException $error) {
            Response::error($error->getMessage(), 422);
        } catch (RuntimeException $error) {
            Response::error($error->getMessage(), 410);
        }
    }
}
