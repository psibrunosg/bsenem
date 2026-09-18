<?php

declare(strict_types=1);

require_once __DIR__ . '/../../backend/config/database.php';

const SUBJECT_SLUGS = [
    'Conhecimentos Específicos' => 'conhecimentos-especificos',
    'Conhecimentos Gerais e Atualidades' => 'conhecimentos-gerais-atualidades',
    'Conhecimentos Pedagógicos' => 'conhecimentos-pedagogicos',
    'Legislação e Direito' => 'legislacao-direito',
    'Língua Portuguesa' => 'lingua-portuguesa',
    'Noções de Informática' => 'nocoes-informatica',
    'Políticas de Saúde / SUS' => 'politicas-saude-sus',
    'Raciocínio Lógico e Matemático' => 'raciocinio-logico-matematico',
];

const SPECIALTIES = ['Psicólogo' => 'psicologia', 'Nutricionista' => 'nutricao', 'Educador Físico' => 'educacao-fisica'];

function readJson(string $path): array {
    $raw = file_get_contents($path);
    if ($raw === false) throw new RuntimeException("Unable to read {$path}.");
    $decoded = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
    if (!is_array($decoded)) throw new RuntimeException("Invalid JSON at {$path}.");
    return $decoded;
}

function requireString(array $record, string $key): string {
    $value = $record[$key] ?? null;
    if (!is_string($value) || trim($value) === '') throw new RuntimeException("Missing {$key} in imported data.");
    return trim($value);
}

$root = realpath(__DIR__ . '/../..');
if ($root === false) throw new RuntimeException('Project root unavailable.');
$questions = readJson($root . '/docs/sources/concursos/extracted-questions-sul.json');
$taxonomy = readJson($root . '/docs/sources/concursos/taxonomy-v1.json');
$assignmentDocument = readJson($root . '/docs/sources/concursos/topic-assignments-v1.json');
$version = requireString($taxonomy, 'version');
if (($assignmentDocument['taxonomy_version'] ?? null) !== $version) throw new RuntimeException('Assignment taxonomy version does not match taxonomy.');

$validTopics = [];
foreach (($taxonomy['specialties'] ?? []) as $specialty => $definition) {
    foreach (($definition['topics'] ?? []) as $position => $topic) {
        if (!is_array($topic) || !is_string($topic[0] ?? null) || !is_string($topic[1] ?? null)) throw new RuntimeException('Invalid taxonomy topic.');
        $validTopics[$specialty][$topic[0]] = true;
    }
}

$assignments = [];
foreach (($assignmentDocument['assignments'] ?? []) as $assignment) {
    $questionId = requireString($assignment, 'question_id');
    $specialty = requireString($assignment, 'specialty_slug');
    $topic = requireString($assignment, 'topic_slug');
    if (isset($assignments[$questionId]) || !isset($validTopics[$specialty][$topic]) || ($assignment['taxonomy_version'] ?? null) !== $version || ($assignment['review_status'] ?? null) !== 'approved') {
        throw new RuntimeException("Invalid or duplicate editorial assignment for {$questionId}.");
    }
    $assignments[$questionId] = $assignment;
}

initializeDatabase();
$pdo = Database::getInstance()->getConnection();
$pdo->beginTransaction();
try {
    $insertTopic = $pdo->prepare('INSERT INTO question_bank_topics (specialty_slug, slug, label, position, taxonomy_version) VALUES (?, ?, ?, ?, ?) ON CONFLICT(specialty_slug, slug) DO UPDATE SET label = excluded.label, position = excluded.position, taxonomy_version = excluded.taxonomy_version');
    foreach (($taxonomy['specialties'] ?? []) as $specialty => $definition) {
        foreach (($definition['topics'] ?? []) as $index => $topic) $insertTopic->execute([$specialty, $topic[0], $topic[1], $index + 1, $version]);
    }

    $insertQuestion = $pdo->prepare('INSERT INTO concurso_questions (id, state, year, organization, board, target_role, subject_slug, subject_label, question_number, statement, option_a, option_b, option_c, option_d, option_e, correct_option, source_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state, year = excluded.year, organization = excluded.organization, board = excluded.board, target_role = excluded.target_role, subject_slug = excluded.subject_slug, subject_label = excluded.subject_label, question_number = excluded.question_number, statement = excluded.statement, option_a = excluded.option_a, option_b = excluded.option_b, option_c = excluded.option_c, option_d = excluded.option_d, option_e = excluded.option_e, correct_option = excluded.correct_option, source_label = excluded.source_label');
    $insertAssignment = $pdo->prepare('INSERT INTO concurso_question_topics (question_id, specialty_slug, topic_slug, taxonomy_version, review_status, reviewed_by, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(question_id) DO UPDATE SET specialty_slug = excluded.specialty_slug, topic_slug = excluded.topic_slug, taxonomy_version = excluded.taxonomy_version, review_status = excluded.review_status, reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at');

    $requiredAssignments = [];
    $imported = 0;
    $skippedIncomplete = 0;
    foreach ($questions as $question) {
        $answer = $question['gabarito_oficial'] ?? null;
        if (!is_string($answer) || !preg_match('/^[A-E]$/', $answer)) continue;
        $subjectLabel = requireString($question, 'disciplina');
        $subjectSlug = SUBJECT_SLUGS[$subjectLabel] ?? null;
        if ($subjectSlug === null) throw new RuntimeException("Unknown concurso subject {$subjectLabel}.");
        $alternatives = $question['alternativas'] ?? [];
        if (array_filter(['A', 'B', 'C', 'D', 'E'], static fn(string $letter): bool => !is_string($alternatives[$letter] ?? null) || trim($alternatives[$letter]) === '')) {
            $skippedIncomplete++;
            continue;
        }
        $questionId = requireString($question, 'id');
        $role = requireString($question, 'cargo_alvo');
        $insertQuestion->execute([$questionId, requireString($question, 'estado'), (int) ($question['ano'] ?? 0), requireString($question, 'orgao'), requireString($question, 'banca'), $role, $subjectSlug, $subjectLabel, (int) ($question['numero_questao'] ?? 0), requireString($question, 'enunciado'), trim($alternatives['A']), trim($alternatives['B']), trim($alternatives['C']), trim($alternatives['D']), trim($alternatives['E']), $answer, implode(' · ', [requireString($question, 'orgao'), requireString($question, 'banca'), (string) $question['ano'], $role])]);
        if ($subjectSlug === 'conhecimentos-especificos') {
            $specialty = SPECIALTIES[$role] ?? null;
            $assignment = $assignments[$questionId] ?? null;
            if ($specialty === null || !is_array($assignment) || $assignment['specialty_slug'] !== $specialty) throw new RuntimeException("Missing approved editorial assignment for {$questionId}.");
            $requiredAssignments[$questionId] = true;
            $insertAssignment->execute([$questionId, $specialty, $assignment['topic_slug'], $version, 'approved', requireString($assignment, 'reviewed_by'), requireString($assignment, 'reviewed_at')]);
        }
        $imported++;
    }
    if (count($requiredAssignments) !== count($assignments) || array_diff_key($assignments, $requiredAssignments)) throw new RuntimeException('Assignments do not exactly cover answerable specific questions.');
    $pdo->commit();
    echo "Imported {$imported} complete concurso questions and " . count($assignments) . " approved topic assignments; skipped {$skippedIncomplete} answerable records with incomplete alternatives.\n";
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $error;
}
