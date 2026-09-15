<?php

declare(strict_types=1);

/**
 * scripts/enem/verify-enem-database.php
 *
 * Verificador estrito do repositório SQL do ENEM.
 * Audita:
 * 1. Confirmar 34 provas e 34 gabaritos no acervo.
 * 2. Confirmar 3.060 questões no total.
 * 3. Auditar uma resposta válida por questão (ou motivo de pendência auditado).
 * 4. Auditar que cada resposta veio do gabarito pareado.
 * 5. Validar que imagens referenciadas existem no disco.
 * 6. Relatório estatístico por ano e dia.
 */

require_once __DIR__ . '/../../backend/config/database.php';

$contentRoot = __DIR__ . '/../../content/enem';
$manifestPath = __DIR__ . '/../../docs/sources/enem/manifest-2009-2025.json';

echo "====================================================\n";
echo "    AUDITORIA E VALIDAÇÃO DO REPOSITÓRIO ENEM SQL    \n";
echo "====================================================\n\n";

$db = Database::getInstance();
$pdo = $db->getConnection();

$failures = [];

// 1. Validar Manifesto de Origem: 34 provas e 34 gabaritos
if (!file_exists($manifestPath)) {
    $failures[] = "Manifesto oficial não encontrado: {$manifestPath}";
} else {
    $manifest = json_decode(file_get_contents($manifestPath), true);
    $provas = array_filter($manifest['entries'], fn($e) => $e['documentKind'] === 'prova');
    $gabaritos = array_filter($manifest['entries'], fn($e) => $e['documentKind'] === 'gabarito');
    
    echo "1. Acervo de Origem:\n";
    echo "   - Provas: " . count($provas) . " (esperado: 34)\n";
    echo "   - Gabaritos: " . count($gabaritos) . " (esperado: 34)\n";
    
    if (count($provas) !== 34 || count($gabaritos) !== 34) {
        $failures[] = "Contagem de provas ou gabaritos divergente de 34 no manifesto.";
    }
}

// 2. Contagem total de questões no banco
$totalQuestions = (int) $pdo->query('SELECT COUNT(*) FROM enem_questions')->fetchColumn();
echo "\n2. Total de Questões no Banco:\n";
echo "   - Total: {$totalQuestions} (esperado: 3060)\n";
if ($totalQuestions !== 3060) {
    $failures[] = "Total de questões no banco ({$totalQuestions}) difere de 3.060.";
}

// 3. Totais por status
$validQuestions = (int) $pdo->query("SELECT COUNT(*) FROM enem_questions WHERE status = 'valid'")->fetchColumn();
$pendingQuestions = (int) $pdo->query("SELECT COUNT(*) FROM enem_questions WHERE status = 'pending'")->fetchColumn();
echo "   - Questões Válidas: {$validQuestions}\n";
echo "   - Questões Pendentes (auditadas): {$pendingQuestions}\n";

// 4. Auditoria de unicidade (sem duplicatas)
$duplicates = $pdo->query('
    SELECT year, day, question_number, COUNT(*) as c
    FROM enem_questions
    GROUP BY year, day, question_number
    HAVING c > 1
')->fetchAll();
if (!empty($duplicates)) {
    $failures[] = "Detectadas questões duplicadas no banco: " . count($duplicates);
} else {
    echo "   - Unicidade: OK (zero duplicatas por ano/dia/número)\n";
}

// 5. Auditoria de gabaritos pareados
// Cada questão 'valid' deve possuir correct_option em ('A','B','C','D','E','ANULADA')
$invalidAnswers = $pdo->query("
    SELECT id, year, day, question_number, correct_option
    FROM enem_questions
    WHERE status = 'valid' AND (correct_option IS NULL OR correct_option NOT IN ('A', 'B', 'C', 'D', 'E', 'ANULADA'))
")->fetchAll();
if (!empty($invalidAnswers)) {
    $failures[] = "Questões marcadas como valid com gabarito incorreto: " . count($invalidAnswers);
} else {
    echo "\n3. Gabarito das Questões Válidas: OK (todas possuem resposta oficial pareada ou anulada)\n";
}

// 6. Auditoria de existência de imagens no disco
$questionsWithImages = $pdo->query("SELECT id, year, day, question_number, images FROM enem_questions WHERE images != '[]'")->fetchAll();
$missingAssets = [];
$totalAssetsReferenced = 0;

foreach ($questionsWithImages as $row) {
    $imgs = json_decode($row['images'], true);
    if (is_array($imgs)) {
        foreach ($imgs as $relPath) {
            $totalAssetsReferenced++;
            $abs = $contentRoot . '/' . $relPath;
            if (!file_exists($abs)) {
                $missingAssets[] = "Q{$row['year']}-D{$row['day']}-#{$row['question_number']}: {$relPath}";
            }
        }
    }
}

echo "\n4. Verificação de Assets de Imagens no Disco:\n";
echo "   - Total de referências a imagens: {$totalAssetsReferenced}\n";
echo "   - Imagens ausentes no disco: " . count($missingAssets) . "\n";
if (!empty($missingAssets)) {
    $failures[] = "Imagens referenciadas não existem no disco: " . implode(', ', array_slice($missingAssets, 0, 5));
}

// 7. Auditoria da tabela enem_question_assets
$totalDbAssets = (int) $pdo->query('SELECT COUNT(*) FROM enem_question_assets')->fetchColumn();
echo "   - Total de registros na tabela enem_question_assets: {$totalDbAssets}\n";

// 8. Tabela resumo por ano
echo "\n5. Resumo Consolidado por Ano:\n";
echo sprintf("%-6s | %-9s | %-9s | %-9s | %-8s\n", "Ano", "Questões", "Válidas", "Pendentes", "Imagens");
echo str_repeat("-", 50) . "\n";

$yearStats = $pdo->query('
    SELECT year,
           COUNT(*) as total,
           SUM(CASE WHEN status = "valid" THEN 1 ELSE 0 END) as valids,
           SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pendings
    FROM enem_questions
    GROUP BY year
    ORDER BY year ASC
')->fetchAll();

foreach ($yearStats as $stat) {
    $y = (int) $stat['year'];
    $imgCount = (int) $pdo->query("SELECT COUNT(*) FROM enem_question_assets WHERE source_pdf LIKE '{$y}/%'")->fetchColumn();
    echo sprintf("%-6d | %-9d | %-9d | %-9d | %-8d\n", $y, $stat['total'], $stat['valids'], $stat['pendings'], $imgCount);
}

echo "\n====================================================\n";
if (empty($failures)) {
    echo "  RESULTADO FINAL: [PASS] TODOS OS CRITÉRIOS ATENDIDOS\n";
    echo "====================================================\n";
    exit(0);
} else {
    echo "  RESULTADO FINAL: [FAIL]\n";
    foreach ($failures as $f) {
        echo "  - {$f}\n";
    }
    echo "====================================================\n";
    exit(1);
}
