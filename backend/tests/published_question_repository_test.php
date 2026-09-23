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

function insertPublishedQuestion(PDO $pdo, array $question): string {
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

    return 'inep:' . $pdo->lastInsertId();
}

function createLegacySimulatorSchema(PDO $pdo): void {
    $pdo->exec(
        "CREATE TABLE simulator_sessions (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            kind TEXT NOT NULL,
            status TEXT NOT NULL,
            subject TEXT,
            topic TEXT,
            question_limit INTEGER NOT NULL,
            current_position INTEGER NOT NULL DEFAULT 0,
            elapsed_seconds INTEGER NOT NULL DEFAULT 0,
            result_json TEXT,
            started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    );
    $pdo->exec(
        "CREATE TABLE simulator_session_questions (
            session_id TEXT NOT NULL,
            question_id INTEGER NOT NULL,
            position INTEGER NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (session_id, question_id)
        )"
    );
    $pdo->exec(
        "CREATE TABLE simulator_session_answers (
            session_id TEXT NOT NULL,
            question_id INTEGER NOT NULL,
            selected_option TEXT,
            is_correct INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (session_id, question_id)
        )"
    );
    $pdo->exec("INSERT INTO simulator_sessions (id, user_id, kind, status, question_limit) VALUES ('legacy-session', 1, 'practice', 'active', 1)");
    $pdo->exec("INSERT INTO simulator_session_questions (session_id, question_id, position) VALUES ('legacy-session', 42, 0)");
    $pdo->exec("INSERT INTO simulator_session_answers (session_id, question_id, selected_option) VALUES ('legacy-session', 42, 'B')");
}

$path = tempnam(sys_get_temp_dir(), 'bsenem-published-question-test-');
if ($path === false) {
    throw new RuntimeException('Unable to create isolated test database.');
}
$legacyPath = null;

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

    $preferredQuestionId = insertPublishedQuestion($pdo, [
        'question_number' => 5,
        'area' => 'Matemática',
        'statement' => 'Questão preferida para revisão.',
        'correct_option' => 'C',
        'status' => 'valid',
    ]);
    $preferred = PublishedQuestionRepository::select($pdo, ['Matemática'], null, 2, [], [$preferredQuestionId]);
    expectPublishedSame(
        [$preferredQuestionId, $validQuestionId],
        array_column($preferred, 'id'),
        'Preferred IDs are selected before chronological order'
    );

    expectPublishedSame(
        3,
        PublishedQuestionRepository::availableCount($pdo, ['Matemática'], null),
        'Available count reflects eligible supply regardless of the requested count'
    );
    expectPublishedSame(
        1,
        PublishedQuestionRepository::availableCount($pdo, ['Matemática'], 'Funções'),
        'Available count narrows by topic'
    );

    $subjects = PublishedQuestionRepository::subjects($pdo);
    expectPublishedSame([['key' => 'Matemática', 'label' => 'Matemática', 'available' => 3]], $subjects, 'Subjects list only eligible public questions');

    expectPublishedThrows(
        fn() => PublishedQuestionRepository::select($pdo, [], null, 10),
        'Empty subject lists are rejected before selection'
    );
    expectPublishedThrows(
        fn() => PublishedQuestionRepository::select($pdo, ['Matemática'], null, 0),
        'Counts below one are rejected before selection'
    );
    expectPublishedThrows(
        fn() => PublishedQuestionRepository::select($pdo, ['Matemática'], null, 201),
        'Counts above two hundred are rejected before selection'
    );
    expectPublishedThrows(
        fn() => PublishedQuestionRepository::select($pdo, ['Matemática'], null, 10, [1]),
        'Unprefixed question IDs are rejected'
    );

    $pdo->prepare(
        'INSERT INTO simulator_question_bank (id, provider, category, subject, statement, options_json, correct_option)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute(['concursos:q-1', 'Concursos Sul', 'concursos', 'Psicologia', 'Questão de concurso.', '["a","b","c","d","e"]', 3]);
    $concursos = PublishedQuestionRepository::select($pdo, ['Psicologia'], null, 5);
    expectPublishedSame(['concursos:q-1'], array_column($concursos, 'id'), 'Concursos questions are published through the unified view');
    expectPublishedSame('d', $concursos[0]['options']['D'], 'Concursos options are mapped to A–E');
    expectPublishedSame('D', $pdo->query("SELECT correct_option FROM simulator_questions WHERE id = 'concursos:q-1'")->fetchColumn(), 'Concursos answer index maps to its letter');

    expectPublishedSame(1, (int) $pdo->query("SELECT COUNT(*) FROM schema_migrations WHERE version = '007_simulator_sessions.sql'")->fetchColumn(), 'Migration 007 is applied once');
    Database::resetForTests();
    $pdo = Database::getInstance()->getConnection();
    expectPublishedSame(1, (int) $pdo->query("SELECT COUNT(*) FROM schema_migrations WHERE version = '007_simulator_sessions.sql'")->fetchColumn(), 'Migration 007 remains applied once after reinitialization');

    $legacyPath = tempnam(sys_get_temp_dir(), 'bsenem-legacy-simulator-schema-test-');
    if ($legacyPath === false) {
        throw new RuntimeException('Unable to create legacy simulator test database.');
    }
    $legacyPdo = new PDO("sqlite:{$legacyPath}");
    $legacyPdo->exec('CREATE TABLE schema_migrations (version TEXT PRIMARY KEY)');
    $legacyPdo->exec("INSERT INTO schema_migrations (version) VALUES ('007_simulator_sessions.sql')");
    createLegacySimulatorSchema($legacyPdo);
    unset($legacyPdo);

    putenv("APP_DB_PATH={$legacyPath}");
    Database::resetForTests();
    $legacyPdo = Database::getInstance()->getConnection();
    $flaggedColumn = $legacyPdo->query("SELECT name FROM pragma_table_info('simulator_session_answers') WHERE name = 'flagged'")->fetchColumn();
    expectPublishedSame('flagged', $flaggedColumn, 'Migration 008 adds flags to a schema that already recorded migration 007');
    expectPublishedSame(1, (int) $legacyPdo->query("SELECT COUNT(*) FROM schema_migrations WHERE version = '008_simulator_session_draft_fields.sql'")->fetchColumn(), 'Migration 008 is recorded after updating a legacy schema');
    expectPublishedSame('inep:42', $legacyPdo->query("SELECT question_id FROM simulator_session_questions WHERE session_id = 'legacy-session'")->fetchColumn(), 'Migration 009 prefixes legacy composition IDs');
    expectPublishedSame('B', $legacyPdo->query("SELECT selected_option FROM simulator_session_answers WHERE question_id = 'inep:42'")->fetchColumn(), 'Migration 009 keeps legacy answers');
} finally {
    unset($pdo);
    unset($legacyPdo);
    Database::resetForTests();
    gc_collect_cycles();

    $databaseFiles = [$path, "{$path}-wal", "{$path}-shm"];
    if ($legacyPath !== null) {
        $databaseFiles = [...$databaseFiles, $legacyPath, "{$legacyPath}-wal", "{$legacyPath}-shm"];
    }
    foreach ($databaseFiles as $databaseFile) {
        if (is_file($databaseFile)) {
            unlink($databaseFile);
        }
    }
}

echo "Published question repository tests passed" . PHP_EOL;
