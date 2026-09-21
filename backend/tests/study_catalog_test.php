<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/StudyCatalogImporter.php';

function expectCatalog(bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$path = tempnam(sys_get_temp_dir(), 'bsenem-study-catalog-test-');
if ($path === false) {
    throw new RuntimeException('Unable to create isolated test database.');
}

putenv('APP_ENV=test');
putenv("APP_DB_PATH={$path}");

try {
    Database::resetForTests();
    $pdo = Database::getInstance()->getConnection();
    $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')->execute([
        'Library test user',
        'library@example.test',
        str_repeat('x', 60),
    ]);
    $userId = (int) $pdo->lastInsertId();

    $summary = StudyCatalogImporter::import($pdo, $userId, [
        'source' => [
            'provider' => 'google_drive',
            'root_drive_id' => 'root-folder-id',
            'root_url' => 'https://drive.google.com/drive/folders/root-folder-id',
            'title' => 'Aulas',
        ],
        'items' => [[
            'drive_id' => 'lesson-file-id',
            'direct_url' => 'https://drive.google.com/file/d/lesson-file-id/view',
            'name' => 'Aula 01.pdf',
            'mime_type' => 'application/pdf',
            'modified_at' => '2026-09-21T12:00:00Z',
            'path' => ['Instituições', 'Faculdade Unifatécie', 'Nutrição'],
        ]],
    ]);

    expectCatalog($summary['created'] === 1 && $summary['updated'] === 0, 'First import creates the library item');

    $item = $pdo->query('SELECT direct_url, item_type, catalog_path FROM study_library_items')->fetch();
    expectCatalog($item['direct_url'] === 'https://drive.google.com/file/d/lesson-file-id/view', 'Item stores its own direct Drive URL');
    expectCatalog($item['item_type'] === 'pdf', 'Item type is inferred from MIME type');
    expectCatalog($item['catalog_path'] === 'Instituições / Faculdade Unifatécie / Nutrição', 'Item stores its catalog path');

    $summary = StudyCatalogImporter::import($pdo, $userId, [
        'source' => [
            'provider' => 'google_drive',
            'root_drive_id' => 'root-folder-id',
            'root_url' => 'https://drive.google.com/drive/folders/root-folder-id',
            'title' => 'Aulas',
        ],
        'items' => [[
            'drive_id' => 'lesson-file-id',
            'direct_url' => 'https://drive.google.com/open?id=lesson-file-id',
            'name' => 'Aula 01 atualizada.pdf',
            'mime_type' => 'application/pdf',
            'path' => ['Instituições', 'Faculdade Unifatécie', 'Nutrição'],
        ]],
    ]);

    expectCatalog($summary['created'] === 0 && $summary['updated'] === 1, 'Repeated Drive IDs update rather than duplicate items');
    expectCatalog((int) $pdo->query('SELECT COUNT(*) FROM study_library_items')->fetchColumn() === 1, 'A Drive item has one catalog record per user');
    expectCatalog($pdo->query('SELECT direct_url FROM study_library_items')->fetchColumn() === 'https://drive.google.com/open?id=lesson-file-id', 'Direct URL is refreshed on reimport');

    $summary = StudyCatalogImporter::import($pdo, $userId, [
        'source' => [
            'provider' => 'google_drive',
            'root_drive_id' => 'root-folder-id',
            'root_url' => 'https://drive.google.com/drive/folders/root-folder-id',
            'title' => 'Aulas',
        ],
        'items' => [[
            'drive_id' => 'google-doc-id',
            'direct_url' => 'https://docs.google.com/document/d/google-doc-id/edit',
            'name' => 'Roteiro da aula',
            'mime_type' => 'application/vnd.google-apps.document',
            'path' => ['Instituições', 'Cognitivo'],
        ]],
    ]);
    expectCatalog($summary['created'] === 1, 'Google Docs URLs are accepted as direct item URLs');

    $summary = StudyCatalogImporter::import($pdo, $userId, [
        'source' => [
            'provider' => 'google_drive',
            'root_drive_id' => 'root-folder-id',
            'root_url' => 'https://drive.google.com/drive/folders/root-folder-id',
            'title' => 'Aulas',
        ],
        'items' => [[
            'drive_id' => 'transcript-file-id',
            'direct_url' => 'https://drive.google.com/file/d/transcript-file-id/view',
            'name' => 'Aula 01.txt',
            'mime_type' => 'text/plain',
            'path' => ['Instituições', 'Cognitivo', 'Aula 01', 'transcrição'],
        ]],
    ]);
    expectCatalog($summary['skipped'] === 1, 'Transcript folders are excluded from future imports');
    expectCatalog((int) $pdo->query('SELECT COUNT(*) FROM study_library_items')->fetchColumn() === 2, 'Excluded items are never persisted');
} finally {
    unset($pdo);
    Database::resetForTests();
    gc_collect_cycles();
    foreach ([$path, "{$path}-wal", "{$path}-shm"] as $databaseFile) {
        if (is_file($databaseFile)) {
            unlink($databaseFile);
        }
    }
}

echo "Study catalog tests passed" . PHP_EOL;
