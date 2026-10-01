<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function expectImport(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

$root = realpath(__DIR__ . '/../..');
$path = tempnam(sys_get_temp_dir(), 'bsenem-question-bank-import-');
if ($root === false || $path === false) throw new RuntimeException('Unable to create import test database.');

$environment = array_merge($_ENV, [
    'APP_ENV' => 'test',
    'APP_DB_PATH' => $path,
]);
putenv('APP_ENV=test');
putenv("APP_DB_PATH={$path}");

try {
    $process = proc_open(
        [PHP_BINARY, 'scripts/concursos/import-concursos-database.php'],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes,
        $root,
        $environment
    );
    if (!is_resource($process)) throw new RuntimeException('Unable to run question bank importer.');
    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exit = proc_close($process);

    expectImport($exit === 0, "Importer must not publish unreviewed specific questions or abort the full import.
{$stderr}");

    putenv('APP_ENV=test');
    putenv("APP_DB_PATH={$path}");
    Database::resetForTests();
    $pdo = Database::getInstance()->getConnection();

    expectImport((int) $pdo->query('SELECT COUNT(*) FROM concurso_questions')->fetchColumn() > 0, 'Importer must load reviewed concurso content.');
    $unreviewed = (int) $pdo->query(
        "SELECT COUNT(*) FROM concurso_questions q
         LEFT JOIN concurso_question_topics t ON t.question_id = q.id
         WHERE q.subject_slug = 'conhecimentos-especificos' AND t.question_id IS NULL"
    )->fetchColumn();
    expectImport($unreviewed === 0, 'Specific questions without an approved editorial assignment must not be published.');

    echo "Question bank import tests passed
";
} finally {
    Database::resetForTests();
    gc_collect_cycles();
    foreach ([$path, "{$path}-wal", "{$path}-shm"] as $file) {
        if (is_file($file)) @unlink($file);
    }
}
