<?php

declare(strict_types=1);

/**
 * Published questions come from the simulator_questions view: valid ENEM items
 * ('inep:<id>') and concursos from the permanent bank ('concursos:<id>').
 */
final class PublishedQuestionRepository {
    public const MAX_QUESTIONS = 200;

    /**
     * @return list<array{key: string, label: string, available: int}>
     */
    public static function subjects(PDO $pdo): array {
        $statement = $pdo->prepare(
            'SELECT subject, COUNT(*) AS available
             FROM simulator_questions
             WHERE published = 1
             GROUP BY subject
             ORDER BY subject ASC'
        );
        $statement->execute();

        return array_map(
            static fn(array $row): array => [
                'key' => $row['subject'],
                'label' => $row['subject'],
                'available' => (int) $row['available'],
            ],
            $statement->fetchAll()
        );
    }

    /**
     * @param list<string> $subjects
     */
    public static function availableCount(PDO $pdo, array $subjects, ?string $topic): int {
        [$conditions, $parameters] = self::scope($subjects, $topic);

        $statement = $pdo->prepare(
            'SELECT COUNT(*) FROM simulator_questions WHERE ' . implode(' AND ', $conditions)
        );
        $statement->execute($parameters);

        return (int) $statement->fetchColumn();
    }

    /**
     * @param list<string> $subjects
     * @param list<string> $excludeIds
     * @param list<string> $preferredIds Selected first, before the source order, when eligible.
     * @return list<array{id: string, subject: string, topic: ?string, statement: string, options: array<string, string>, images: array, explanation: ?string}>
     */
    public static function select(PDO $pdo, array $subjects, ?string $topic, int $count, array $excludeIds = [], array $preferredIds = []): array {
        if ($count < 1 || $count > self::MAX_QUESTIONS) {
            throw new InvalidArgumentException('Question count must be between 1 and ' . self::MAX_QUESTIONS . '.');
        }
        [$conditions, $parameters] = self::scope($subjects, $topic);

        $excludeIds = self::validatedIdList($excludeIds);
        if ($excludeIds !== []) {
            $conditions[] = 'id NOT IN (' . implode(', ', array_fill(0, count($excludeIds), '?')) . ')';
            array_push($parameters, ...$excludeIds);
        }

        $preferredIds = self::validatedIdList($preferredIds);
        $priorityColumn = '1 AS priority';
        $priorityParameters = [];
        if ($preferredIds !== []) {
            $priorityColumn = 'CASE WHEN id IN (' . implode(', ', array_fill(0, count($preferredIds), '?')) . ') THEN 0 ELSE 1 END AS priority';
            $priorityParameters = $preferredIds;
        }

        $sql = "SELECT id, subject, topic, statement, option_a, option_b, option_c, option_d, option_e, images, {$priorityColumn}
                FROM simulator_questions
                WHERE " . implode(' AND ', $conditions) . '
                ORDER BY priority ASC, sort_key ASC, id ASC
                LIMIT ?';

        $statement = $pdo->prepare($sql);
        $statement->execute([...$priorityParameters, ...$parameters, $count]);

        return array_map(static function (array $row): array {
            $images = json_decode((string) $row['images'], true);

            return [
                'id' => (string) $row['id'],
                'subject' => $row['subject'],
                'topic' => $row['topic'],
                'statement' => $row['statement'],
                'options' => [
                    'A' => $row['option_a'],
                    'B' => $row['option_b'],
                    'C' => $row['option_c'],
                    'D' => $row['option_d'],
                    'E' => $row['option_e'],
                ],
                'images' => is_array($images) ? $images : [],
                'explanation' => null,
            ];
        }, $statement->fetchAll());
    }

    /**
     * @param list<string> $subjects
     * @return array{0: list<string>, 1: list<string>}
     */
    private static function scope(array $subjects, ?string $topic): array {
        $subjects = self::validatedSubjects($subjects);
        $conditions = [
            'published = 1',
            'subject IN (' . implode(', ', array_fill(0, count($subjects), '?')) . ')',
        ];
        $parameters = $subjects;

        if ($topic !== null) {
            $conditions[] = 'topic = ?';
            $parameters[] = $topic;
        }

        return [$conditions, $parameters];
    }

    /** @return list<string> */
    private static function validatedSubjects(array $subjects): array {
        $normalized = [];
        foreach ($subjects as $subject) {
            if (!is_string($subject) || $subject === '') {
                throw new InvalidArgumentException('At least one non-empty subject is required.');
            }

            $normalized[$subject] = $subject;
        }

        if ($normalized === []) {
            throw new InvalidArgumentException('At least one non-empty subject is required.');
        }

        return array_values($normalized);
    }

    /** @return list<string> */
    private static function validatedIdList(array $ids): array {
        $normalized = [];
        foreach ($ids as $id) {
            if (!self::isQuestionId($id)) {
                throw new InvalidArgumentException('Question IDs must be source-prefixed strings.');
            }

            $normalized[$id] = $id;
        }

        return array_values($normalized);
    }

    public static function isQuestionId(mixed $id): bool {
        return is_string($id) && preg_match('/^(inep|concursos):\S{1,200}$/', $id) === 1;
    }
}
