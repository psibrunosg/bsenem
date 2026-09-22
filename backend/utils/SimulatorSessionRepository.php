<?php

declare(strict_types=1);

final class SimulatorSessionRepository {
    /**
     * @param list<int> $questionIds
     * @return array<string, mixed>
     */
    public function create(PDO $pdo, int $userId, string $kind, ?string $subject, ?string $topic, int $limitSeconds, array $questionIds): array {
        $questionIds = $this->validatedQuestionIds($questionIds);

        if (!in_array($kind, ['catalog', 'custom', 'practice'], true)) {
            throw new InvalidArgumentException('Unknown simulator session kind.');
        }
        if ($userId < 1 || $limitSeconds < 1) {
            throw new InvalidArgumentException('User ID and time limit must be positive.');
        }

        $id = bin2hex(random_bytes(16));
        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO simulator_sessions (id, user_id, kind, status, subject, topic, question_limit)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([$id, $userId, $kind, 'active', $subject, $topic, count($questionIds)]);

            $composition = $pdo->prepare(
                'INSERT INTO simulator_session_questions (session_id, question_id, position) VALUES (?, ?, ?)'
            );
            foreach ($questionIds as $position => $questionId) {
                $composition->execute([$id, $questionId, $position]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }

        $session = $this->find($pdo, $userId, $id);
        if ($session === null) {
            throw new RuntimeException('Created simulator session could not be loaded.');
        }

        return $session;
    }

    /** @return array<string, mixed>|null */
    public function find(PDO $pdo, int $userId, string $id): ?array {
        $session = $this->ownedSession($pdo, $userId, $id);
        if ($session === null) {
            return null;
        }

        $questionStatement = $pdo->prepare(
            'SELECT question_id, position
             FROM simulator_session_questions
             WHERE session_id = ?
             ORDER BY position ASC'
        );
        $questionStatement->execute([$id]);
        $answerStatement = $pdo->prepare(
            'SELECT answers.question_id, answers.selected_option, answers.is_correct
             FROM simulator_session_answers AS answers
             JOIN simulator_session_questions AS composition
               ON composition.session_id = answers.session_id
              AND composition.question_id = answers.question_id
             WHERE answers.session_id = ?
             ORDER BY composition.position ASC'
        );
        $answerStatement->execute([$id]);

        $session['id'] = (string) $session['id'];
        $session['user_id'] = (int) $session['user_id'];
        $session['question_limit'] = (int) $session['question_limit'];
        $session['current_position'] = (int) $session['current_position'];
        $session['elapsed_seconds'] = (int) $session['elapsed_seconds'];
        $session['questions'] = array_map(static fn(array $row): array => [
            'question_id' => (int) $row['question_id'],
            'position' => (int) $row['position'],
        ], $questionStatement->fetchAll());
        $session['answers'] = array_map(static fn(array $row): array => [
            'question_id' => (int) $row['question_id'],
            'selected_option' => $row['selected_option'],
            'is_correct' => (bool) $row['is_correct'],
        ], $answerStatement->fetchAll());
        $session['result'] = $session['result_json'] === null ? null : json_decode($session['result_json'], true, 512, JSON_THROW_ON_ERROR);
        unset($session['result_json']);

        return $session;
    }

    /**
     * @param list<array{question_id: int, selected_option: ?string, flagged?: bool}> $answers
     * @return array<string, mixed>|null
     */
    public function saveProgress(PDO $pdo, int $userId, string $id, int $position, int $elapsedSeconds, array $answers): ?array {
        if ($position < 0 || $elapsedSeconds < 0) {
            throw new InvalidArgumentException('Position and elapsed time cannot be negative.');
        }

        $pdo->beginTransaction();
        try {
            $session = $this->ownedSession($pdo, $userId, $id);
            if ($session === null || $session['status'] !== 'active') {
                $pdo->rollBack();
                return null;
            }

            $questionIds = $this->sessionQuestionIds($pdo, $id);
            if ($position >= count($questionIds)) {
                throw new InvalidArgumentException('Position is outside the session composition.');
            }
            $answers = $this->validatedAnswers($answers, $questionIds);

            $pdo->prepare(
                'UPDATE simulator_sessions
                 SET current_position = ?, elapsed_seconds = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND user_id = ? AND status = ?'
            )->execute([$position, $elapsedSeconds, $id, $userId, 'active']);

            $upsert = $pdo->prepare(
                'INSERT INTO simulator_session_answers (session_id, question_id, selected_option)
                 VALUES (?, ?, ?)
                 ON CONFLICT(session_id, question_id) DO UPDATE SET
                    selected_option = excluded.selected_option,
                    updated_at = CURRENT_TIMESTAMP'
            );
            foreach ($answers as $answer) {
                $upsert->execute([$id, $answer['question_id'], $answer['selected_option']]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }

        return $this->find($pdo, $userId, $id);
    }

    /** @return array{result: array{correct: int, incorrect: int, unanswered: int, score: float}}|null */
    public function complete(PDO $pdo, int $userId, string $id): ?array {
        $pdo->beginTransaction();
        try {
            $session = $this->ownedSession($pdo, $userId, $id);
            if ($session === null) {
                $pdo->rollBack();
                return null;
            }
            if ($session['status'] === 'completed') {
                $result = json_decode((string) $session['result_json'], true, 512, JSON_THROW_ON_ERROR);
                $pdo->rollBack();
                return ['result' => $result];
            }

            $pdo->prepare(
                'UPDATE simulator_session_answers
                 SET is_correct = CASE WHEN selected_option = (
                    SELECT correct_option FROM enem_questions WHERE id = simulator_session_answers.question_id
                 ) THEN 1 ELSE 0 END,
                 updated_at = CURRENT_TIMESTAMP
                 WHERE session_id = ?'
            )->execute([$id]);

            $summary = $pdo->prepare(
                'SELECT
                    COUNT(composition.question_id) AS total,
                    SUM(CASE WHEN answers.selected_option IS NOT NULL AND answers.is_correct = 1 THEN 1 ELSE 0 END) AS correct,
                    SUM(CASE WHEN answers.selected_option IS NOT NULL AND answers.is_correct = 0 THEN 1 ELSE 0 END) AS incorrect
                 FROM simulator_session_questions AS composition
                 LEFT JOIN simulator_session_answers AS answers
                   ON answers.session_id = composition.session_id
                  AND answers.question_id = composition.question_id
                 WHERE composition.session_id = ?'
            );
            $summary->execute([$id]);
            $counts = $summary->fetch();
            $total = (int) $counts['total'];
            $correct = (int) $counts['correct'];
            $incorrect = (int) $counts['incorrect'];
            $result = [
                'correct' => $correct,
                'incorrect' => $incorrect,
                'unanswered' => $total - $correct - $incorrect,
                'score' => $total === 0 ? 0.0 : round(($correct / $total) * 100, 2),
            ];
            $resultJson = json_encode($result, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION);

            $completed = $pdo->prepare(
                'UPDATE simulator_sessions
                 SET status = ?, result_json = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND user_id = ? AND status = ?'
            );
            $completed->execute(['completed', $resultJson, $id, $userId, 'active']);
            if ($completed->rowCount() !== 1) {
                throw new RuntimeException('Simulator session completion was not applied.');
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }

        return ['result' => $result];
    }

    /** @return array<string, mixed>|null */
    private function ownedSession(PDO $pdo, int $userId, string $id): ?array {
        $statement = $pdo->prepare('SELECT * FROM simulator_sessions WHERE id = ? AND user_id = ?');
        $statement->execute([$id, $userId]);
        $session = $statement->fetch();

        return $session === false ? null : $session;
    }

    /** @return list<int> */
    private function sessionQuestionIds(PDO $pdo, string $id): array {
        $statement = $pdo->prepare(
            'SELECT question_id FROM simulator_session_questions WHERE session_id = ? ORDER BY position ASC'
        );
        $statement->execute([$id]);

        return array_map(static fn(array $row): int => (int) $row['question_id'], $statement->fetchAll());
    }

    /** @param list<int> $questionIds @return list<int> */
    private function validatedQuestionIds(array $questionIds): array {
        if ($questionIds === []) {
            throw new InvalidArgumentException('A session needs at least one question.');
        }

        $normalized = [];
        foreach ($questionIds as $questionId) {
            if (filter_var($questionId, FILTER_VALIDATE_INT) === false || (int) $questionId < 1) {
                throw new InvalidArgumentException('Question IDs must be positive integers.');
            }
            if (isset($normalized[(int) $questionId])) {
                throw new InvalidArgumentException('Question IDs cannot be duplicated.');
            }
            $normalized[(int) $questionId] = (int) $questionId;
        }

        return array_values($normalized);
    }

    /**
     * @param list<array{question_id: int, selected_option: ?string, flagged?: bool}> $answers
     * @param list<int> $questionIds
     * @return list<array{question_id: int, selected_option: ?string}>
     */
    private function validatedAnswers(array $answers, array $questionIds): array {
        $allowedIds = array_fill_keys($questionIds, true);
        $normalized = [];
        foreach ($answers as $answer) {
            if (!is_array($answer) || !array_key_exists('question_id', $answer)) {
                throw new InvalidArgumentException('Each answer needs a question ID.');
            }
            $questionId = $answer['question_id'];
            $selectedOption = $answer['selected_option'] ?? null;
            if (filter_var($questionId, FILTER_VALIDATE_INT) === false || !isset($allowedIds[(int) $questionId])) {
                throw new InvalidArgumentException('Answers must belong to the session composition.');
            }
            if ($selectedOption !== null && (!is_string($selectedOption) || !in_array($selectedOption, ['A', 'B', 'C', 'D', 'E'], true))) {
                throw new InvalidArgumentException('Selected options must be A through E or null.');
            }
            $normalized[(int) $questionId] = [
                'question_id' => (int) $questionId,
                'selected_option' => $selectedOption,
            ];
        }

        return array_values($normalized);
    }
}
