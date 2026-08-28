<?php
// backend/controllers/ExamController.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class ExamController {
    public static function attempt() {
         = Auth::requireAuth();
         = json_decode(file_get_contents('php://input'), true);
        
        if (! || !isset(['exam_id']) || !isset(['score'])) {
            Response::error('Exam ID and score are required');
        }
        
         = Database::getInstance();
        
        // Save the attempt
         = ->insert('exam_attempts', [
            'user_id' => ,
            'exam_id' => ['exam_id'],
            'score' => ['score'],
            'answers' => json_encode(['answers'] ?? []),
            'time_spent' => ['time_spent'] ?? 0,
            'completed_at' => date('Y-m-d H:i:s')
        ]);
        
        // Also log this as a study session
         = max(10, round(['score'] / 10)); // max 10 XP per exam for score 100
        ->insert('study_sessions', [
            'user_id' => ,
            'type' => 'exam',
            'resource_id' => ['exam_id'],
            'duration' => ['time_spent'] ?? 0,
            'xp_earned' => 
        ]);
        
        // Update total xp
        ->query("UPDATE users SET xp = xp + ? WHERE id = ?", [, ]);
        
        Response::success([
            'attempt_id' => ,
            'xp_earned' => 
        ], 'Exam attempt saved');
    }
}
