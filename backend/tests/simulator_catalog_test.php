<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/SimulatorCatalogImporter.php';

function expectSimulator(bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$path = tempnam(sys_get_temp_dir(), 'bsenem-simulators-');
if ($path === false) throw new RuntimeException('Unable to create isolated test database.');
putenv('APP_ENV=test');
putenv("APP_DB_PATH={$path}");

try {
    Database::resetForTests();
    $db = Database::getInstance();
    SimulatorCatalogImporter::ensureImported($db);
    $firstCount = (int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_question_bank')['total'] ?? 0);
    $catalogCount = (int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_catalogs')['total'] ?? 0);
    expectSimulator($firstCount > 3000, 'Importer keeps the validated ENEM and concursos question bank.');
    expectSimulator($catalogCount >= 10, 'Importer creates permanent ENEM and concursos catalogs.');
    expectSimulator((int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_question_bank WHERE subject = ?', ['Psicologia'])['total'] ?? 0) > 0, 'Concursos psychology questions are available as a custom-simulator subject.');
    expectSimulator((int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_catalog_questions WHERE catalog_id LIKE ?', ['enem:%'])['total'] ?? 0) >= 315, 'ENEM published catalogs retain their questions.');
    SimulatorCatalogImporter::ensureImported($db);
    expectSimulator((int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_question_bank')['total'] ?? 0) === $firstCount, 'Importer is idempotent.');
} finally {
    unset($db);
    Database::resetForTests();
    gc_collect_cycles();
    foreach ([$path, "{$path}-wal", "{$path}-shm"] as $databaseFile) if (is_file($databaseFile)) unlink($databaseFile);
}

echo "Simulator catalog tests passed" . PHP_EOL;
