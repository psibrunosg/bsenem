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
    putenv('APP_CONTENT_IMPORT=off');
    SimulatorCatalogImporter::ensureImported($db);
    expectSimulator((int) ($db->fetch('SELECT COUNT(*) AS total FROM enem_questions')['total'] ?? 0) === 0, 'APP_CONTENT_IMPORT=off keeps the database empty.');
    putenv('APP_CONTENT_IMPORT');

    SimulatorCatalogImporter::ensureImported($db);
    $enemCount = (int) ($db->fetch('SELECT COUNT(*) AS total FROM enem_questions')['total'] ?? 0);
    $bankCount = (int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_question_bank')['total'] ?? 0);
    $catalogCount = (int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_catalogs')['total'] ?? 0);
    expectSimulator($enemCount > 3000, 'Importer loads the audited ENEM questions.');
    expectSimulator($bankCount > 2000, 'Importer keeps the validated concursos question bank.');
    expectSimulator((int) ($db->fetch("SELECT COUNT(*) AS total FROM simulator_question_bank WHERE category <> 'concursos'")['total'] ?? 0) === 0, 'ENEM questions are not duplicated into the concursos bank.');
    expectSimulator($catalogCount >= 10, 'Importer creates permanent ENEM and concursos catalogs.');
    expectSimulator((int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_question_bank WHERE subject = ?', ['Psicologia'])['total'] ?? 0) > 0, 'Concursos psychology questions are available as a custom-simulator subject.');
    expectSimulator((int) ($db->fetch("SELECT COUNT(*) AS total FROM simulator_catalog_questions WHERE catalog_id LIKE 'enem:%' AND question_id LIKE 'inep:%'")['total'] ?? 0) >= 315, 'ENEM catalogs reference the audited ENEM questions.');
    expectSimulator((int) ($db->fetch("SELECT COUNT(*) AS total FROM simulator_catalog_questions AS c LEFT JOIN simulator_questions AS q ON q.id = c.question_id AND q.published = 1 WHERE q.id IS NULL")['total'] ?? 0) === 0, 'Every catalog question is published.');
    expectSimulator((int) ($db->fetch('SELECT MAX(total) AS total FROM (SELECT COUNT(*) AS total FROM simulator_catalog_questions GROUP BY catalog_id)')['total'] ?? 0) <= 90, 'No published catalog exceeds 90 questions.');
    expectSimulator((int) ($db->fetch("SELECT COUNT(*) AS total FROM simulator_question_bank AS bank
        WHERE bank.category = 'concursos' AND (SELECT COUNT(*) FROM simulator_catalog_questions AS c
            JOIN simulator_catalogs AS catalogs ON catalogs.id = c.catalog_id AND catalogs.subject = bank.subject
            WHERE c.question_id = bank.id) <> 1")['total'] ?? 0) === 0, 'Each concursos question is in exactly one caderno of its track.');
    $caderno = $db->fetch("SELECT id, title, duration_minutes, (SELECT COUNT(*) FROM simulator_catalog_questions WHERE catalog_id = id) AS total
        FROM simulator_catalogs WHERE id = 'concursos:psicologia:caderno-01'");
    expectSimulator($caderno !== null && (int) $caderno['duration_minutes'] === 3 * (int) $caderno['total'], 'Cadernos last three minutes per question.');
    expectSimulator(str_contains((string) ($caderno['title'] ?? ''), 'Psicologia · Caderno 1 (' . (int) ($caderno['total'] ?? 0) . ' questões)'), 'Caderno titles name the track, number and size.');
    SimulatorCatalogImporter::ensureImported($db);
    expectSimulator((int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_question_bank')['total'] ?? 0) === $bankCount, 'Importer is idempotent.');
    expectSimulator((int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_catalogs')['total'] ?? 0) === $catalogCount, 'Catalog import is idempotent.');
    $compositionCount = (int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_catalog_questions')['total'] ?? 0);
    $db->getConnection()->exec('DELETE FROM simulator_catalog_questions');
    SimulatorCatalogImporter::ensureImported($db);
    expectSimulator((int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_catalog_questions')['total'] ?? 0) === $compositionCount, 'Rebuilding the composition reproduces the same cadernos.');
    expectSimulator((int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_catalogs')['total'] ?? 0) === $catalogCount, 'Rebuilding the composition keeps the catalog rows.');

    $replacementRow = $db->fetch("SELECT catalog_id, position, original_question_id, replacement_question_id, reason FROM simulator_catalog_replacements ORDER BY catalog_id, position LIMIT 1");
    expectSimulator($replacementRow !== null, 'Quarantined catalog questions are replaced and audited.');
    expectSimulator(($replacementRow['reason'] ?? null) === 'quality_quarantine', 'Catalog replacement records the quarantine reason.');
    expectSimulator($replacementRow['original_question_id'] !== $replacementRow['replacement_question_id'], 'Catalog replacement keeps original and replacement IDs distinct.');
    expectSimulator((int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_catalog_questions WHERE catalog_id = ? AND position = ? AND question_id = ?', [
        $replacementRow['catalog_id'], $replacementRow['position'], $replacementRow['replacement_question_id'],
    ])['total'] ?? 0) === 1, 'Catalog composition points to the audited replacement while original is quarantined.');

    $originalNumericId = (int) substr((string) $replacementRow['original_question_id'], strlen('inep:'));
    $db->query("UPDATE enem_questions SET quality_status = 'approved' WHERE id = ?", [$originalNumericId]);
    $repair = new ReflectionMethod(SimulatorCatalogImporter::class, 'repairQuarantinedCatalogQuestions');
    $repair->setAccessible(true);
    $repair->invoke(null, $db->getConnection());
    expectSimulator((int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_catalog_questions WHERE catalog_id = ? AND position = ? AND question_id = ?', [
        $replacementRow['catalog_id'], $replacementRow['position'], $replacementRow['original_question_id'],
    ])['total'] ?? 0) === 1, 'Approved original question is restored deterministically to its catalog position.');
    expectSimulator((int) ($db->fetch('SELECT COUNT(*) AS total FROM simulator_catalog_replacements WHERE catalog_id = ? AND position = ?', [
        $replacementRow['catalog_id'], $replacementRow['position'],
    ])['total'] ?? 0) === 0, 'Replacement audit row is removed after the original is restored.');
} finally {
    unset($db);
    Database::resetForTests();
    gc_collect_cycles();
    foreach ([$path, "{$path}-wal", "{$path}-shm"] as $databaseFile) if (is_file($databaseFile)) unlink($databaseFile);
}

echo "Simulator catalog tests passed" . PHP_EOL;
