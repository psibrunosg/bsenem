<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/SimulatorCatalogImporter.php';

function expectQuality(bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$path = tempnam(sys_get_temp_dir(), 'bsenem-quality-gate-test-');
if ($path === false) {
    throw new RuntimeException('Unable to create isolated test database.');
}

putenv('APP_ENV=test');
putenv("APP_DB_PATH={$path}");
putenv('APP_CONTENT_IMPORT=on');

try {
    Database::resetForTests();
    $db = Database::getInstance();
    SimulatorCatalogImporter::ensureImported($db);
    $pdo = $db->getConnection();

    $quarantined = (int) $pdo->query(
        "SELECT COUNT(*) FROM enem_questions WHERE quality_status = 'quarantined'"
    )->fetchColumn();
    expectQuality($quarantined === 247, 'Expected the audited 247 unresolved corrupted questions to remain quarantined.');

    $leaked = (int) $pdo->query(
        "SELECT COUNT(*)
         FROM simulator_catalog_questions c
         JOIN simulator_questions q ON q.id = c.question_id
         WHERE q.published <> 1"
    )->fetchColumn();
    expectQuality($leaked === 0, 'No quarantined/unpublished question may remain in a published catalog composition.');

    $targets = [
        [2020, 2, 103], [2020, 2, 105], [2020, 2, 107], [2020, 2, 161],
        [2021, 2, 120], [2021, 2, 129], [2021, 2, 137],
        [2022, 1, 17], [2022, 2, 103], [2023, 2, 151], [2023, 2, 180],
    ];
    $select = $pdo->prepare(
        'SELECT quality_status, statement, correct_option FROM enem_questions
         WHERE year = ? AND day = ? AND question_number = ?'
    );
    foreach ($targets as $target) {
        $select->execute($target);
        $row = $select->fetch();
        expectQuality($row !== false, 'Recovered question is missing from the imported bank.');
        expectQuality($row['quality_status'] === 'approved', 'Recovered question must be approved after audited recovery.');
        expectQuality(!preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/', (string) $row['statement']), 'Recovered statement cannot contain control-character corruption.');
    }

    $select->execute([2021, 2, 129]);
    $q129 = $select->fetch();
    expectQuality(($q129['correct_option'] ?? null) === 'A', '2021 D2 Q129 must keep the official answer A.');

    echo "ENEM quality gate tests passed" . PHP_EOL;
} finally {
    Database::resetForTests();
    gc_collect_cycles();
    foreach ([$path, "{$path}-wal", "{$path}-shm"] as $file) {
        if (is_file($file)) @unlink($file);
    }
}
