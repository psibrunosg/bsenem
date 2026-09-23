<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/SimulatorCatalogImporter.php';

/**
 * Upgrading a database that already ran the permanent-simulators release
 * (migrations up to 007_permanent_simulators.sql) keeps its history.
 */
function expectUpgrade(bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$path = tempnam(sys_get_temp_dir(), 'bsenem-simulator-upgrade-');
if ($path === false) {
    throw new RuntimeException('Unable to create isolated test database.');
}

try {
    $legacy = new PDO("sqlite:{$path}", null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $legacy->exec('PRAGMA foreign_keys=ON');
    $legacy->exec('CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    $migrations = glob(__DIR__ . '/../database/migrations/*.sql') ?: [];
    sort($migrations, SORT_STRING);
    foreach ($migrations as $migration) {
        $version = basename($migration);
        if (strcmp($version, '007_permanent_simulators.sql') > 0) {
            break;
        }
        $legacy->exec((string) file_get_contents($migration));
        $legacy->prepare('INSERT INTO schema_migrations (version) VALUES (?)')->execute([$version]);
    }

    $legacy->exec("INSERT INTO users (name, email, password_hash) VALUES ('Aluno', 'aluno@example.test', 'x')");
    $legacy->exec("INSERT INTO simulator_question_bank (id, provider, category, subject, statement, options_json, correct_option)
                   VALUES ('enem:enem-2015-d1-q023', 'INEP', 'enem', 'Ciências Humanas', 'Enunciado', '[\"a\",\"b\",\"c\",\"d\",\"e\"]', 1)");
    $legacy->exec("INSERT INTO simulator_catalogs (id, title, category, subject) VALUES ('enem:legado', 'Prova legada', 'enem', 'Ciências Humanas')");
    $legacy->exec("INSERT INTO simulator_catalog_questions (catalog_id, question_id, position) VALUES ('enem:legado', 'enem:enem-2015-d1-q023', 1)");
    $legacy->exec("INSERT INTO catalog_simulator_attempts (catalog_id, user_id, score, total_questions) VALUES ('enem:legado', 1, 80, 1)");
    $legacy->exec("INSERT INTO simulator_catalogs (id, title, category, subject) VALUES ('concursos:psicologia', 'Concursos — Psicologia', 'concursos', 'Psicologia')");
    $legacy->exec("INSERT INTO catalog_simulator_attempts (catalog_id, user_id, score, total_questions) VALUES ('concursos:psicologia', 1, 60, 847)");
    $legacy->exec("INSERT INTO generated_simulators (id, user_id, title, subjects_json, question_count) VALUES ('custom-1', 1, 'Personalizado', '[]', 1)");
    $legacy->exec("INSERT INTO generated_simulator_questions (simulator_id, question_id, position) VALUES ('custom-1', 'enem:enem-2015-d1-q023', 1)");
    $legacy->exec("INSERT INTO generated_simulator_attempts (simulator_id, user_id, score, total_questions) VALUES ('custom-1', 1, 50, 1)");
    unset($legacy);

    putenv('APP_ENV=test');
    putenv("APP_DB_PATH={$path}");
    Database::resetForTests();
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    $applied = $pdo->query("SELECT COUNT(*) FROM schema_migrations WHERE version IN ('007_simulator_sessions.sql', '008_simulator_session_draft_fields.sql', '009_unified_simulator_questions.sql')")->fetchColumn();
    expectUpgrade((int) $applied === 3, 'Session migrations run on top of the permanent-simulators release.');
    expectUpgrade((int) $pdo->query('SELECT COUNT(*) FROM catalog_simulator_attempts')->fetchColumn() === 2, 'Catalog attempts survive the upgrade.');
    expectUpgrade((int) $pdo->query('SELECT COUNT(*) FROM generated_simulator_attempts')->fetchColumn() === 1, 'Generated simulator attempts survive the upgrade.');
    expectUpgrade((int) $pdo->query('SELECT COUNT(*) FROM generated_simulator_questions')->fetchColumn() === 1, 'Generated simulator compositions survive the upgrade.');

    SimulatorCatalogImporter::ensureImported($db);
    expectUpgrade((int) $pdo->query('SELECT COUNT(*) FROM catalog_simulator_attempts')->fetchColumn() === 2, 'Catalog attempts survive the content import.');
    expectUpgrade((int) $pdo->query("SELECT COUNT(*) FROM simulator_catalog_questions WHERE catalog_id LIKE 'enem:simulado-%' AND question_id LIKE 'inep:%'")->fetchColumn() >= 315, 'ENEM catalogs are rebuilt on the unified question IDs.');
    expectUpgrade((int) $pdo->query("SELECT COUNT(*) FROM simulator_catalog_questions WHERE catalog_id = 'enem:legado'")->fetchColumn() === 0, 'Catalogs that are no longer published stay hidden without losing their row.');
    expectUpgrade((int) $pdo->query("SELECT published FROM simulator_catalogs WHERE id = 'concursos:psicologia'")->fetchColumn() === 0, 'The single-track concursos catalog is replaced by cadernos.');
    expectUpgrade((int) $pdo->query("SELECT COUNT(*) FROM simulator_catalogs WHERE id LIKE 'concursos:psicologia:caderno-%' AND published = 1")->fetchColumn() > 1, 'Psychology is published as several cadernos.');
    expectUpgrade((int) $pdo->query("SELECT COUNT(*) FROM simulator_questions WHERE id LIKE 'enem:%'")->fetchColumn() === 0, 'Legacy ENEM bank copies are not served as questions.');
} finally {
    unset($pdo, $db);
    Database::resetForTests();
    gc_collect_cycles();
    foreach ([$path, "{$path}-wal", "{$path}-shm"] as $databaseFile) {
        if (is_file($databaseFile)) {
            @unlink($databaseFile);
        }
    }
}

echo "Simulator upgrade tests passed" . PHP_EOL;
