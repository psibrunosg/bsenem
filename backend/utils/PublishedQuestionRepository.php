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
     * @param list<int> $excludeIds
     * @return list<array{id: int, subject: string, topic: ?string, statement: string, options: array<string, string>, images: array, explanation: ?string}>
     */
    public static function select(PDO $pdo, array $subjects, ?string $topic, int $count, array $excludeIds = []): array {
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

        $excludeIds = self::validatedExcludeIds($excludeIds);
        if ($excludeIds !== []) {
            $conditions[] = 'id NOT IN (' . implode(', ', array_fill(0, count($excludeIds), '?')) . ')';
            array_push($parameters, ...$excludeIds);
        }

        $sql = 'SELECT id, area, topic, statement, option_a, option_b, option_c, option_d, option_e, images
                FROM enem_questions
                WHERE ' . implode(' AND ', $conditions) . '
                ORDER BY year ASC, day ASC, question_number ASC, id ASC
                LIMIT ?';
        $parameters[] = $count;

        $statement = $pdo->prepare($sql);
        $statement->execute($parameters);

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
    private static function validatedExcludeIds(array $excludeIds): array {
        $normalized = [];
        foreach ($excludeIds as $excludeId) {
            if (filter_var($excludeId, FILTER_VALIDATE_INT) === false || (int) $excludeId < 1) {
                throw new InvalidArgumentException('Excluded question IDs must be positive integers.');
            }

            $normalized[(int) $excludeId] = (int) $excludeId;
        }

        return array_values($normalized);
    }
}
