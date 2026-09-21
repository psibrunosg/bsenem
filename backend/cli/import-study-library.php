<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/StudyCatalogImporter.php';

if ($argc !== 3 || filter_var($argv[1], FILTER_VALIDATE_EMAIL) === false || ($argv[2] !== '-' && !is_file($argv[2]))) {
    fwrite(STDERR, "Usage: php backend/cli/import-study-library.php user@example.com manifest.json|-" . PHP_EOL);
    exit(2);
}

$manifestJson = $argv[2] === '-' ? stream_get_contents(STDIN) : file_get_contents($argv[2]);
$manifest = is_string($manifestJson) ? json_decode($manifestJson, true) : null;
if (!is_array($manifest)) {
    fwrite(STDERR, "Manifest must be valid JSON." . PHP_EOL);
    exit(2);
}

try {
    $pdo = Database::getInstance()->getConnection();
    $email = strtolower($argv[1]);
    $user = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $user->execute([$email]);
    $userId = (int) $user->fetchColumn();
    if ($userId === 0) {
        throw new RuntimeException("No account found for {$email}.");
    }

    $summary = StudyCatalogImporter::import($pdo, $userId, $manifest);
    echo json_encode($summary, JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
