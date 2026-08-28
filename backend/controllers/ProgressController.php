<?php
// backend/controllers/ProgressController.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class ProgressController {
    public static function dashboard() {
        $userId = Auth::requireAuth();
        $db = Database::getInstance();

        $user = $db->fetch(
            "SELECT id, name, email, level, xp, streak, best_streak FROM users WHERE id = ?",
            [$userId]
        );

        if (!$user) {
            Response::notFound('User not found');
        }

        $today = date('Y-m-d');

        $todayActivity = $db->fetch(
            "SELECT study_minutes, xp_earned, cards_reviewed, exams_completed 
             FROM activity_log WHERE user_id = ? AND date = ?",
            [$userId, $today]
        ) ?? [
            'study_minutes' => 0,
            'xp_earned' => 0,
            'cards_reviewed' => 0,
            'exams_completed' => 0
        ];

        $weekStart = date('Y-m-d', strtotime('monday this week'));
        $weekStats = $db->fetch(
            "SELECT 
                COALESCE(SUM(study_minutes), 0) as total_minutes,
                COALESCE(SUM(xp_earned), 0) as total_xp,
                COALESCE(SUM(cards_reviewed), 0) as total_cards,
                COALESCE(SUM(exams_completed), 0) as total_exams
             FROM activity_log WHERE user_id = ? AND date >= ?",
            [$userId, $weekStart]
        );

        $flashcardStats = $db->fetch(
            "SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN due_date <= datetime('now') THEN 1 ELSE 0 END) as due_now,
                COALESCE(SUM(total_reviews), 0) as total_reviews,
                COALESCE(SUM(correct_reviews), 0) as correct_reviews
             FROM flashcards WHERE user_id = ?",
            [$userId]
        );

        $examStats = $db->fetch(
            "SELECT 
                (SELECT COUNT(*) FROM exams WHERE user_id = ?) as total_exams,
                (SELECT COUNT(*) FROM exam_attempts WHERE user_id = ?) as total_attempts,
                (SELECT COALESCE(AVG(score), 0) FROM exam_attempts WHERE user_id = ? AND completed_at IS NOT NULL) as avg_score
             ",
            [$userId, $userId, $userId]
        );

        $recentSessions = $db->fetchAll(
            "SELECT ss.*, s.name as subject_name 
             FROM study_sessions ss 
             LEFT JOIN subjects s ON ss.subject_id = s.id 
             WHERE ss.user_id = ? 
             ORDER BY ss.started_at DESC 
             LIMIT 10",
            [$userId]
        );

        $achievements = $db->fetchAll(
            "SELECT a.*, ua.unlocked_at 
             FROM user_achievements ua 
             JOIN achievements a ON ua.achievement_id = a.id 
             WHERE ua.user_id = ? 
             ORDER BY ua.unlocked_at DESC",
            [$userId]
        );

        $totalStudyMinutes = $db->fetch(
            "SELECT COALESCE(SUM(study_minutes), 0) as total 
             FROM activity_log WHERE user_id = ?",
            [$userId]
        )['total'];

        Response::success([
            'user' => $user,
            'today' => $todayActivity,
            'week' => $weekStats,
            'flashcards' => $flashcardStats,
            'exams' => $examStats,
            'recent_sessions' => $recentSessions,
            'achievements' => $achievements,
            'total_study_minutes' => $totalStudyMinutes
        ]);
    }

    public static function heatmap() {
        $userId = Auth::requireAuth();
        $db = Database::getInstance();

        $year = (int)($_GET['year'] ?? date('Y'));

        $rows = $db->fetchAll(
            "SELECT date, study_minutes FROM activity_log WHERE user_id = ? AND strftime('%Y', date) = ?",
            [$userId, (string)$year]
        );

        $heatmap = [];
        foreach ($rows as $row) {
            $heatmap[$row['date']] = (int)$row['study_minutes'];
        }

        Response::success($heatmap);
    }

    public static function recordStudy() {
        $userId = Auth::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data || empty($data['type']) || !isset($data['duration'])) {
            Response::error('Type and duration are required');
        }

        $validTypes = ['video', 'audio', 'flashcards', 'notes', 'exam', 'pomodoro'];
        if (!in_array($data['type'], $validTypes)) {
            Response::error('Invalid study type');
        }

        $duration = max(0, (int)$data['duration']);
        $type = $data['type'];
        $subjectId = $data['subject_id'] ?? null;

        $xpEarned = match($type) {
            'video' => max(1, intdiv($duration, 60)),
            'audio' => max(1, intdiv($duration, 60)),
            'flashcards' => max(1, intdiv($duration, 30)),
            'notes' => max(1, intdiv($duration, 60)),
            'exam' => 20,
            default => 0
        };

        $db = Database::getInstance();

        $sessionId = $db->insert('study_sessions', [
            'user_id' => $userId,
            'subject_id' => $subjectId,
            'type' => $type,
            'duration' => $duration,
            'xp_earned' => $xpEarned
        ]);

        $today = date('Y-m-d');

        $existing = $db->fetch(
            "SELECT id FROM activity_log WHERE user_id = ? AND date = ?",
            [$userId, $today]
        );

        $minutesDelta = intdiv($duration, 60);

        if ($existing) {
            $db->query(
                "UPDATE activity_log SET study_minutes = study_minutes + ?, xp_earned = xp_earned + ? WHERE user_id = ? AND date = ?",
                [$minutesDelta, $xpEarned, $userId, $today]
            );
        } else {
            $db->insert('activity_log', [
                'user_id' => $userId,
                'date' => $today,
                'study_minutes' => $minutesDelta,
                'xp_earned' => $xpEarned
            ]);
        }

        $db->query("UPDATE users SET xp = xp + ? WHERE id = ?", [$xpEarned, $userId]);

        Response::success([
            'session_id' => $sessionId,
            'xp_earned' => $xpEarned
        ], 'Study session recorded');
    }
}

