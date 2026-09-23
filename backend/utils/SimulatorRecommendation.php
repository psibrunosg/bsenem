<?php

declare(strict_types=1);

final class SimulatorRecommendation {
    private const MINIMUM_ANSWERS = 5;
    private const MAXIMUM_ANSWERS = 30;
    private const WINDOW_DAYS = 90;

    /**
     * @param list<array{subject: string, topic?: ?string, is_correct: bool|int, answered_at: string}> $responses
     * @param list<array<string, mixed>> $active
     * @return array{recommendation: ?array<string, mixed>, mastery: list<array<string, mixed>>, active_sessions: list<array<string, mixed>>}
     */
    public static function overview(array $responses, array $active): array {
        $recentResponses = self::recentResponses($responses);
        $subjects = self::groupBy($recentResponses, static fn(array $response): string => $response['subject']);
        $mastery = [];

        foreach ($subjects as $subject => $subjectResponses) {
            $mastery[] = self::masteryRow($subject, $subjectResponses);
        }

        usort($mastery, [self::class, 'compareGroups']);
        $mastery = array_map(static function (array $row): array {
            unset($row['latest_error_at']);
            return $row;
        }, $mastery);

        return [
            'recommendation' => self::recommendation($subjects),
            'mastery' => $mastery,
            'active_sessions' => array_values($active),
        ];
    }

    /**
     * @param list<array{subject: string, topic?: ?string, is_correct: bool|int, answered_at: string}> $responses
     * @return list<array{subject: string, topic?: ?string, is_correct: bool|int, answered_at: string}>
     */
    private static function recentResponses(array $responses): array {
        $cutoff = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify('-' . self::WINDOW_DAYS . ' days');
        $recent = array_values(array_filter($responses, static function (array $response) use ($cutoff): bool {
            return new DateTimeImmutable($response['answered_at']) >= $cutoff;
        }));

        usort($recent, static function (array $left, array $right): int {
            return strcmp($right['answered_at'], $left['answered_at']);
        });

        return array_slice($recent, 0, self::MAXIMUM_ANSWERS);
    }

    /**
     * @param list<array{subject: string, topic?: ?string, is_correct: bool|int, answered_at: string}> $responses
     * @return array<string, list<array{subject: string, topic?: ?string, is_correct: bool|int, answered_at: string}>>
     */
    private static function groupBy(array $responses, callable $key): array {
        $groups = [];
        foreach ($responses as $response) {
            $groupKey = $key($response);
            $groups[$groupKey] ??= [];
            $groups[$groupKey][] = $response;
        }

        return $groups;
    }

    /**
     * @param list<array{subject: string, topic?: ?string, is_correct: bool|int, answered_at: string}> $responses
     * @return array{subject: string, answered_count: int, accuracy: ?float, status: string, action: string, latest_error_at: ?string}
     */
    private static function masteryRow(string $subject, array $responses): array {
        $count = count($responses);
        $correct = count(array_filter($responses, static fn(array $response): bool => (bool) $response['is_correct']));
        $accuracy = $count < self::MINIMUM_ANSWERS ? null : round(($correct / $count) * 100, 2);

        return [
            'subject' => $subject,
            'answered_count' => $count,
            'accuracy' => $accuracy,
            'status' => self::status($accuracy),
            'action' => $accuracy === null ? 'choose_subject' : 'practice',
            'latest_error_at' => self::latestErrorAt($responses),
        ];
    }

    private static function status(?float $accuracy): string {
        if ($accuracy === null) {
            return 'insufficient';
        }
        if ($accuracy < 60.0) {
            return 'attention';
        }
        if ($accuracy < 75.0) {
            return 'evolving';
        }

        return 'strong';
    }

    /**
     * @param array<string, list<array{subject: string, topic?: ?string, is_correct: bool|int, answered_at: string}>> $subjects
     * @return array<string, mixed>|null
     */
    private static function recommendation(array $subjects): ?array {
        $candidates = [];
        foreach ($subjects as $subject => $responses) {
            $row = self::masteryRow($subject, $responses);
            if ($row['accuracy'] !== null) {
                $candidates[] = ['row' => $row, 'responses' => $responses];
            }
        }
        if ($candidates === []) {
            return null;
        }

        usort($candidates, static fn(array $left, array $right): int => self::compareGroups($left['row'], $right['row']));
        $candidate = $candidates[0];
        $topic = self::weakestTopic($candidate['responses']);

        return [
            'subject' => $candidate['row']['subject'],
            'topic' => $topic['topic'] ?? null,
            'answered_count' => $topic['answered_count'] ?? $candidate['row']['answered_count'],
            'accuracy' => $topic['accuracy'] ?? $candidate['row']['accuracy'],
            'status' => $topic['status'] ?? $candidate['row']['status'],
            'action' => 'practice',
        ];
    }

    /**
     * @param list<array{subject: string, topic?: ?string, is_correct: bool|int, answered_at: string}> $responses
     * @return array{topic: string, answered_count: int, accuracy: float, status: string, latest_error_at: ?string}|null
     */
    private static function weakestTopic(array $responses): ?array {
        $topics = self::groupBy(array_values(array_filter($responses, static function (array $response): bool {
            return isset($response['topic']) && $response['topic'] !== null && $response['topic'] !== '';
        })), static fn(array $response): string => $response['topic']);
        $candidates = [];
        foreach ($topics as $topic => $topicResponses) {
            $row = self::masteryRow('', $topicResponses);
            if ($row['accuracy'] !== null) {
                $candidates[] = [
                    'topic' => $topic,
                    'answered_count' => $row['answered_count'],
                    'accuracy' => $row['accuracy'],
                    'status' => $row['status'],
                    'latest_error_at' => $row['latest_error_at'],
                ];
            }
        }
        if ($candidates === []) {
            return null;
        }

        usort($candidates, [self::class, 'compareGroups']);

        return $candidates[0];
    }

    /** @param list<array{is_correct: bool|int, answered_at: string}> $responses */
    private static function latestErrorAt(array $responses): ?string {
        $errors = array_filter($responses, static fn(array $response): bool => !(bool) $response['is_correct']);
        if ($errors === []) {
            return null;
        }

        return max(array_column($errors, 'answered_at'));
    }

    /** @param array<string, mixed> $left @param array<string, mixed> $right */
    private static function compareGroups(array $left, array $right): int {
        $accuracy = ($left['accuracy'] ?? 101.0) <=> ($right['accuracy'] ?? 101.0);
        if ($accuracy !== 0) {
            return $accuracy;
        }

        $leftError = $left['latest_error_at'] ?? '';
        $rightError = $right['latest_error_at'] ?? '';
        $recency = strcmp($rightError, $leftError);
        if ($recency !== 0) {
            return $recency;
        }

        return strnatcasecmp((string) ($left['subject'] ?? $left['topic']), (string) ($right['subject'] ?? $right['topic']));
    }
}
