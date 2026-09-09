<?php
// backend/controllers/ExamController.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/LocalExamAttempts.php';

class ExamController {
    public static function localAttempt() {
        $userId = Auth::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)
            || !is_string($data['library_id'] ?? null) || trim($data['library_id']) === ''
            || !is_string($data['local_exam_id'] ?? null) || trim($data['local_exam_id']) === ''
            || !is_string($data['exam_title'] ?? null) || trim($data['exam_title']) === ''
            || !isset($data['score'], $data['total_questions']) || !is_array($data['answers'] ?? null)) {
            Response::error('Local exam attempt data is incomplete');
        }
        $score = (int) $data['score'];
        $totalQuestions = (int) $data['total_questions'];
        $timeSpent = max(0, (int) ($data['time_spent'] ?? 0));
        if ($score < 0 || $score > 100 || $totalQuestions < 0) Response::error('Local exam attempt data is invalid');
        $attemptId = LocalExamAttempts::record(Database::getInstance(), $userId, [
            'library_id' => trim($data['library_id']),
            'local_exam_id' => trim($data['local_exam_id']),
            'exam_title' => trim($data['exam_title']),
            'score' => $score,
            'total_questions' => $totalQuestions,
            'time_spent' => $timeSpent,
            'answers' => $data['answers']
        ]);
        Response::success(['id' => $attemptId], 'Local exam attempt saved');
    }

    public static function attempt() {
        $userId = Auth::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['exam_id']) || !isset($data['score'])) {
            Response::error('Exam ID and score are required');
        }
        
        $db = Database::getInstance();
        
        // Save the attempt
        $attemptId = $db->insert('exam_attempts', [
            'user_id' => $userId,
            'exam_id' => $data['exam_id'],
            'score' => $data['score'],
            'total_questions' => $data['total_questions'] ?? 0,
            'time_spent' => $data['time_spent'] ?? 0
        ]);
        
        // Save answers if provided
        if (isset($data['answers']) && is_array($data['answers'])) {
            foreach ($data['answers'] as $ans) {
                $db->insert('exam_answers', [
                    'attempt_id' => $attemptId,
                    'question_id' => $ans['question_id'],
                    'selected_option' => $ans['selected_option'],
                    'is_correct' => $ans['is_correct'] ?? false
                ]);
            }
        }
        
        Response::success(['attempt_id' => $attemptId], 'Exam attempt saved');
    }
    
    public static function stats() {
        $userId = Auth::requireAuth();
        $db = Database::getInstance();
        
        $stats = $db->fetchAll("
            SELECT exam_id, MAX(score) as best_score, AVG(score) as avg_score, COUNT(*) as attempts
            FROM exam_attempts 
            WHERE user_id = ?
            GROUP BY exam_id
        ", [$userId]);
        
        Response::success($stats);
    }
}
