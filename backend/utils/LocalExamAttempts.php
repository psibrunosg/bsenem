<?php

class LocalExamAttempts {
    public static function record($db, int $userId, array $attempt): int {
        return $db->insert('local_exam_attempts', [
            'user_id' => $userId,
            'library_id' => $attempt['library_id'],
            'local_exam_id' => $attempt['local_exam_id'],
            'exam_title' => $attempt['exam_title'],
            'score' => $attempt['score'],
            'total_questions' => $attempt['total_questions'],
            'time_spent' => $attempt['time_spent'],
            'answers' => json_encode($attempt['answers'], JSON_THROW_ON_ERROR)
        ]);
    }
}
