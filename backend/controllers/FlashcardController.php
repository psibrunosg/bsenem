<?php
// backend/controllers/FlashcardController.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class FlashcardController {
    public static function index() {
        $userId = Auth::requireAuth();
        $db = Database::getInstance();
        
        $subject = $_GET['subject'] ?? null;
        $tag = $_GET['tag'] ?? null;
        $dueOnly = isset($_GET['due']) && $_GET['due'] === '1';
        $page = max(1, (int)($_GET['page'] ?? 1));
        $perPage = min(100, max(1, (int)($_GET['per_page'] ?? 20)));
        $offset = ($page - 1) * $perPage;
        
        $where = 'user_id = ?';
        $params = [$userId];
        
        if ($subject) {
            $where .= ' AND subject_id = ?';
            $params[] = $subject;
        }
        
        if ($tag) {
            $where .= ' AND tags LIKE ?';
            $params[] = "%\"{$tag}\"%";
        }
        
        if ($dueOnly) {
            $where .= ' AND due_date <= datetime("now")';
        }
        
        $total = $db->fetch("SELECT COUNT(*) as count FROM flashcards WHERE {$where}", $params)['count'];
        
        $params[] = $perPage;
        $params[] = $offset;
        
        $cards = $db->fetchAll(
            "SELECT * FROM flashcards WHERE {$where} ORDER BY due_date ASC LIMIT ? OFFSET ?",
            $params
        );
        
        // Parse JSON fields
        $cards = array_map(function($card) {
            $card['tags'] = json_decode($card['tags'], true) ?? [];
            return $card;
        }, $cards);
        
        Response::paginated($cards, $total, $page, $perPage);
    }
    
    public static function show($id) {
        $userId = Auth::requireAuth();
        $db = Database::getInstance();
        
        $card = $db->fetch("SELECT * FROM flashcards WHERE id = ? AND user_id = ?", [$id, $userId]);
        
        if (!$card) {
            Response::notFound('Flashcard not found');
        }
        
        $card['tags'] = json_decode($card['tags'], true) ?? [];
        Response::success($card);
    }
    
    public static function store() {
        $userId = Auth::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || empty($data['front']) || empty($data['back'])) {
            Response::error('Front and back are required');
        }
        
        $db = Database::getInstance();
        
        $cardId = $db->insert('flashcards', [
            'user_id' => $userId,
            'subject_id' => $data['subject_id'] ?? null,
            'front' => $data['front'],
            'back' => $data['back'],
            'tags' => json_encode($data['tags'] ?? []),
            'media_url' => $data['media_url'] ?? null,
            'due_date' => date('Y-m-d H:i:s')
        ]);
        
        $card = $db->fetch("SELECT * FROM flashcards WHERE id = ?", [$cardId]);
        $card['tags'] = json_decode($card['tags'], true) ?? [];
        
        Response::success($card, 'Flashcard created');
    }
    
    public static function update($id) {
        $userId = Auth::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true);
        
        $db = Database::getInstance();
        $card = $db->fetch("SELECT * FROM flashcards WHERE id = ? AND user_id = ?", [$id, $userId]);
        
        if (!$card) {
            Response::notFound('Flashcard not found');
        }
        
        $updates = [];
        if (isset($data['front'])) $updates['front'] = $data['front'];
        if (isset($data['back'])) $updates['back'] = $data['back'];
        if (isset($data['subject_id'])) $updates['subject_id'] = $data['subject_id'];
        if (isset($data['tags'])) $updates['tags'] = json_encode($data['tags']);
        if (isset($data['media_url'])) $updates['media_url'] = $data['media_url'];
        
        if (!empty($updates)) {
            $db->update('flashcards', $updates, 'id = ? AND user_id = ?', [$id, $userId]);
        }
        
        $card = $db->fetch("SELECT * FROM flashcards WHERE id = ?", [$id]);
        $card['tags'] = json_decode($card['tags'], true) ?? [];
        
        Response::success($card, 'Flashcard updated');
    }
    
    public static function destroy($id) {
        $userId = Auth::requireAuth();
        $db = Database::getInstance();
        
        $deleted = $db->delete('flashcards', 'id = ? AND user_id = ?', [$id, $userId]);
        
        if (!$deleted) {
            Response::notFound('Flashcard not found');
        }
        
        Response::success(null, 'Flashcard deleted');
    }
    
    public static function review($id) {
        $userId = Auth::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['quality']) || !in_array($data['quality'], [0, 1, 2, 3])) {
            Response::error('Quality must be 0, 1, 2, or 3');
        }
        
        $db = Database::getInstance();
        $card = $db->fetch("SELECT * FROM flashcards WHERE id = ? AND user_id = ?", [$id, $userId]);
        
        if (!$card) {
            Response::notFound('Flashcard not found');
        }
        
        $quality = $data['quality'];
        $now = date('Y-m-d H:i:s');
        
        // Update stats
        $totalReviews = $card['total_reviews'] + 1;
        $correctReviews = $card['correct_reviews'] + ($quality >= 1 ? 1 : 0);
        
        // SM-2 algorithm
        $interval = $card['interval'];
        $repetitions = $card['repetitions'];
        $easeFactor = $card['ease_factor'];
        
        if ($quality < 1) {
            // Failed - reset
            $repetitions = 0;
            $interval = 1;
        } else {
            // Passed
            if ($repetitions === 0) {
                $interval = 1;
            } else if ($repetitions === 1) {
                $interval = 6;
            } else {
                $interval = round($interval * $easeFactor);
            }
            $repetitions++;
        }
        
        // Update ease factor
        $easeFactor = max(1.3, 
            $easeFactor + (0.1 - (3 - $quality) * (0.08 + (3 - $quality) * 0.02))
        );
        
        // Adjust interval based on quality
        if ($quality === 1) {
            $interval = max(1, round($interval * 0.8));
        } else if ($quality === 3) {
            $interval = round($interval * 1.3);
        }
        
        // Calculate due date
        $dueDate = date('Y-m-d H:i:s', strtotime("+{$interval} days"));
        
        // Calculate XP
        $xpEarned = match($quality) {
            0 => 0,
            1 => 5,
            2 => 10,
            3 => 15
        };
        
        // Update card
        $db->update('flashcards', [
            'interval' => $interval,
            'repetitions' => $repetitions,
            'ease_factor' => $easeFactor,
            'due_date' => $dueDate,
            'last_review' => $now,
            'total_reviews' => $totalReviews,
            'correct_reviews' => $correctReviews,
            'streak' => $quality >= 1 ? $card['streak'] + 1 : 0,
            'updated_at' => $now
        ], 'id = ?', [$id]);
        
        // Update user XP
        $db->query("UPDATE users SET xp = xp + ? WHERE id = ?", [$xpEarned, $userId]);
        
        // Log study session
        $db->insert('study_sessions', [
            'user_id' => $userId,
            'type' => 'flashcards',
            'resource_id' => $id,
            'duration' => 0,
            'xp_earned' => $xpEarned
        ]);
        
        Response::success([
            'card' => $db->fetch("SELECT * FROM flashcards WHERE id = ?", [$id]),
            'xp_earned' => $xpEarned
        ], 'Review recorded');
    }
    
    public static function dueCount() {
        $userId = Auth::requireAuth();
        $db = Database::getInstance();
        
        $count = $db->fetch(
            "SELECT COUNT(*) as count FROM flashcards WHERE user_id = ? AND due_date <= datetime('now')",
            [$userId]
        )['count'];
        
        Response::success(['count' => $count]);
    }
}
