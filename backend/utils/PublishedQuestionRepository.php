<?php

declare(strict_types=1);

final class PublishedQuestionRepository {
    /**
     * @return list<array{key: string, label: string, available: int}>
     */
    public static function subjects(PDO $pdo): array {
        $statement = $pdo->prepare(
            "SELECT area, COUNT(*) AS available
             FROM enem_questions
             WHERE status = 'valid' AND correct_option IN ('A', 'B', 'C', 'D', 'E')
             GROUP BY area
             ORDER BY area ASC"
        );
        $statement->execute();

        return array_map(
            static fn(array $row): array => [
                'key' => $row['area'],
                'label' => $row['area'],
                'available' => (int) $row['available'],
            ],
            $statement->fetchAll()
        );
    }

    /**
     * @param list<string> $subjects
     */
    public static function availableCount(PDO $pdo, array $subjects, ?string $topic): int {
        $subjects = self::validatedSubjects($subjects);

        $conditions = [
            "status = 'valid'",
            "correct_option IN ('A', 'B', 'C', 'D', 'E')",
            'area IN (' . implode(', ', array_fill(0, count($subjects), '?')) . ')',
        ];
        $parameters = $subjects;

        if ($topic !== null) {
            $conditions[] = 'topic = ?';
            $parameters[] = $topic;
        }

        $statement = $pdo->prepare(
            'SELECT COUNT(*) FROM enem_questions WHERE ' . implode(' AND ', $conditions)
        );
        $statement->execute($parameters);

        return (int) $statement->fetchColumn();
    }

    /**
     * @param list<string> $subjects
     * @param list<int> $excludeIds
     * @param list<int> $preferredIds Selected first, before the chronological order, when eligible.
     * @return list<array{id: int, subject: string, topic: ?string, statement: string, options: array<string, string>, images: array, explanation: ?string}>
     */
    public static function select(PDO $pdo, array $subjects, ?string $topic, int $count, array $excludeIds = [], array $preferredIds = []): array {
        $subjects = self::validatedSubjects($subjects);

        if ($count < 1 || $count > 90) {
            throw new InvalidArgumentException('Question count must be between 1 and 90.');
        }

        $conditions = [
            "status = 'valid'",
            "correct_option IN ('A', 'B', 'C', 'D', 'E')",
            'area IN (' . implode(', ', array_fill(0, count($subjects), '?')) . ')',
        ];
        $parameters = $subjects;

        if ($topic !== null) {
            $conditions[] = 'topic = ?';
            $parameters[] = $topic;
        }

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

        $sql = "SELECT id, area, topic, statement, option_a, option_b, option_c, option_d, option_e, images, {$priorityColumn}
                FROM enem_questions
                WHERE " . implode(' AND ', $conditions) . '
                ORDER BY priority ASC, year ASC, day ASC, question_number ASC, id ASC
                LIMIT ?';

        $statement = $pdo->prepare($sql);
        $statement->execute([...$priorityParameters, ...$parameters, $count]);

        return array_map(static function (array $row): array {
            $images = json_decode($row['images'], true);

            return [
                'id' => (int) $row['id'],
                'subject' => $row['area'],
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

    /** @return list<int> */
    private static function validatedIdList(array $ids): array {
        $normalized = [];
        foreach ($ids as $id) {
            if (filter_var($id, FILTER_VALIDATE_INT) === false || (int) $id < 1) {
                throw new InvalidArgumentException('Question IDs must be positive integers.');
            }

            $normalized[(int) $id] = (int) $id;
        }

        return array_values($normalized);
    }
}
