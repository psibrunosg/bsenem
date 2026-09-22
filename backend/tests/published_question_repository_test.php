<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/PublishedQuestionRepository.php';

function expectPublishedSame(mixed $expected, mixed $actual, string $message): void {
    if ($expected !== $actual) {
        throw new RuntimeException($message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}

function expectPublishedThrows(callable $callback, string $message): void {
    try {
        $callback();
    } catch (InvalidArgumentException) {
        return;
    }

    throw new RuntimeException($message);
}

function insertPublishedQuestion(PDO $pdo, array $question): int {
    $pdo->prepare(
        'INSERT INTO enem_questions (
            year, day, question_number, area, topic, statement,
            option_a, option_b, option_c, option_d, option_e,
            correct_option, status, source_pdf, source_page, source_pages,
            content_hash, inep_url, mirror_url, images
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $question['year'] ?? 2024,
        $question['day'] ?? 1,
        $question['question_number'],
        $question['area'],
        $question['topic'] ?? null,
        $question['statement'],
        'Alternativa A',
        'Alternativa B',
        'Alternativa C',
        'Alternativa D',
        'Alternativa E',
        $question['correct_option'] ?? null,
        $question['status'],
        'enem-2024.pdf',
        1,
        '[1]',
        hash('sha256', $question['statement']),
        'https://www.gov.br/inep/enem',
        'https://example.test/enem',
        '["figura.png"]',
    ]);

    return (int) $pdo->lastInsertId();
}

$path = tempnam(sys_get_temp_dir(), 'bsenem-published-question-test-');
if ($path === false) {
    throw new RuntimeException('Unable to create isolated test database.');
}

putenv('APP_ENV=test');
putenv("APP_DB_PATH={$path}");

try {
    Database::resetForTests();
    $pdo = Database::getInstance()->getConnection();

    $validQuestionId = insertPublishedQuestion($pdo, [
        'question_number' => 1,
        'area' => 'Matemática',
        'topic' => null,
        'statement' => 'Qual é o resultado de 2 + 2?',
        'correct_option' => 'A',
        'status' => 'valid',
    ]);
    insertPublishedQuestion($pdo, [
        'question_number' => 2,
        'area' => 'Matemática',
        'statement' => 'Questão pendente sem gabarito.',
        'status' => 'pending',
    ]);
    insertPublishedQuestion($pdo, [
        'question_number' => 3,
        'area' => 'Matemática',
        'statement' => 'Questão válida sem alternativa correta.',
        'status' => 'valid',
    ]);
    $topicQuestionId = insertPublishedQuestion($pdo, [
        'question_number' => 4,
        'area' => 'Matemática',
        'topic' => 'Funções',
        'statement' => 'Questão de funções.',
        'correct_option' => 'B',
        'status' => 'valid',
    ]);

    $questions = PublishedQuestionRepository::select($pdo, ['Matemática'], null, 10);
    expectPublishedSame(2, count($questions), 'Only valid questions with an A-E answer are published');
    expectPublishedSame($validQuestionId, $questions[0]['id'], 'Selection is deterministic by question metadata');
    expectPublishedSame('Matemática', $questions[0]['subject'], 'The ENEM area maps to the public subject');
    expectPublishedSame(null, $questions[0]['topic'], 'A missing topic remains null instead of being inferred');
    expectPublishedSame([
        'A' => 'Alternativa A', 'B' => 'Alternativa B', 'C' => 'Alternativa C',
        'D' => 'Alternativa D', 'E' => 'Alternativa E',
    ], $questions[0]['options'], 'Question options are mapped into the public DTO');
    expectPublishedSame(['figura.png'], $questions[0]['images'], 'Question images are decoded from stored JSON');

    $topicQuestions = PublishedQuestionRepository::select($pdo, ['Matemática'], 'Funções', 10);
    expectPublishedSame([$topicQuestionId], array_column($topicQuestions, 'id'), 'Topic filtering is exact');

    $excluded = PublishedQuestionRepository::select($pdo, ['Matemática'], null, 10, [$validQuestionId]);
    expectPublishedSame([$topicQuestionId], array_column($excluded, 'id'), 'Excluded question IDs are not selected');

    $subjects = PublishedQuestionRepository::subjects($pdo);
    expectPublishedSame([['key' => 'Matemática', 'label' => 'Matemática', 'available' => 2]], $subjects, 'Subjects list only eligible public questions');

    expectPublishedThrows(
        fn() => PublishedQuestionRepository::select($pdo, [], null, 10),
        'Empty subject lists are rejected before selection'
    );
    expectPublishedThrows(
        fn() => PublishedQuestionRepository::select($pdo, ['Matemática'], null, 0),
        'Counts below one are rejected before selection'
    );
    expectPublishedThrows(
        fn() => PublishedQuestionRepository::select($pdo, ['Matemática'], null, 91),
        'Counts above ninety are rejected before selection'
    );

    expectPublishedSame(1, (int) $pdo->query("SELECT COUNT(*) FROM schema_migrations WHERE version = '007_simulator_sessions.sql'")->fetchColumn(), 'Migration 007 is applied once');
    Database::resetForTests();
    $pdo = Database::getInstance()->getConnection();
    expectPublishedSame(1, (int) $pdo->query("SELECT COUNT(*) FROM schema_migrations WHERE version = '007_simulator_sessions.sql'")->fetchColumn(), 'Migration 007 remains applied once after reinitialization');
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

echo "Published question repository tests passed" . PHP_EOL;
