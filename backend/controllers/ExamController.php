<?php
// backend/controllers/ExamController.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class ExamController {
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
