<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/EnemFlashcardImporter.php';

$email = strtolower(trim((string) ($argv[1] ?? '')));
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    fwrite(STDERR, "Usage: php backend/cli/import-enem-flashcards.php user@example.com" . PHP_EOL);
    exit(2);
}

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();
    $statement = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $statement->execute([$email]);
    $userId = (int) $statement->fetchColumn();
    if ($userId === 0) {
        throw new RuntimeException("No account found for {$email}.");
    }

    $summary = EnemFlashcardImporter::import($pdo, $userId, __DIR__ . '/../../content/enem');
    echo json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
