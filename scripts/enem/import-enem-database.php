<?php

declare(strict_types=1);

/**
 * scripts/enem/import-enem-database.php
 *
 * Importador idempotente e auditável do repertório SQL do ENEM (2009-2025).
 * Lê o JSON de extração e insere/atualiza no banco SQLite oficial via Database/Migrator.
 */

require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/services/EnemQuestionImporter.php';

echo "=== Iniciando Importação Idempotente para SQLite ===
";

try {
    $stats = EnemQuestionImporter::import(Database::getInstance()->getConnection());
} catch (Throwable $e) {
    fwrite(STDERR, "Falha na importação: " . $e->getMessage() . "
");
    exit(1);
}

echo "=== Importação Concluída com Sucesso ===
";
echo "Total de Questões Gravadas: {$stats['questions']}
";
echo "Questões Válidas: {$stats['valid']}
";
echo "Questões Pendentes: {$stats['pending']}
";
echo "Total de Assets Registrados: {$stats['assets']}
";
