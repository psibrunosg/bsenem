<?php
// backend/controllers/NoteController.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';

class NoteController {
    public static function index() {
        $userId = Auth::requireAuth();
        $db = Database::getInstance();
        
        $subject = $_GET['subject'] ?? null;
        $search = $_GET['search'] ?? null;
        $pinned = isset($_GET['pinned']) && $_GET['pinned'] === '1';
        $page = max(1, (int)($_GET['page'] ?? 1));
        $perPage = min(100, max(1, (int)($_GET['per_page'] ?? 20)));
        $offset = ($page - 1) * $perPage;
        
        $where = 'user_id = ?';
        $params = [$userId];
        
        if ($subject) {
            $where .= ' AND subject_id = ?';
            $params[] = $subject;
        }
        
        if ($search) {
            $where .= ' AND (title LIKE ? OR content LIKE ?)';
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
        }
        
        if ($pinned) {
            $where .= ' AND is_pinned = 1';
        }
        
        $total = $db->fetch("SELECT COUNT(*) as count FROM notes WHERE {$where}", $params)['count'];
        
        $params[] = $perPage;
        $params[] = $offset;
        
        $notes = $db->fetchAll(
            "SELECT * FROM notes WHERE {$where} ORDER BY is_pinned DESC, updated_at DESC LIMIT ? OFFSET ?",
            $params
        );
        
        // Parse JSON fields
        $notes = array_map(function($note) {
            $note['tags'] = json_decode($note['tags'], true) ?? [];
            return $note;
        }, $notes);
        
        Response::paginated($notes, $total, $page, $perPage);
    }
    
    public static function show($id) {
        $userId = Auth::requireAuth();
        $db = Database::getInstance();
        
        $note = $db->fetch("SELECT * FROM notes WHERE id = ? AND user_id = ?", [$id, $userId]);
        
        if (!$note) {
            Response::notFound('Note not found');
        }
        
        $note['tags'] = json_decode($note['tags'], true) ?? [];
        Response::success($note);
    }
    
    public static function store() {
        $userId = Auth::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || empty($data['title'])) {
            Response::error('Title is required');
        }
        
        $db = Database::getInstance();
        
        $noteId = $db->insert('notes', [
            'user_id' => $userId,
            'subject_id' => $data['subject_id'] ?? null,
            'title' => $data['title'],
            'content' => $data['content'] ?? '',
            'tags' => json_encode($data['tags'] ?? []),
            'is_pinned' => $data['is_pinned'] ?? false
        ]);
        
        $note = $db->fetch("SELECT * FROM notes WHERE id = ?", [$noteId]);
        $note['tags'] = json_decode($note['tags'], true) ?? [];
        
        Response::success($note, 'Note created');
    }
    
    public static function update($id) {
        $userId = Auth::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true);
        
        $db = Database::getInstance();
        $note = $db->fetch("SELECT * FROM notes WHERE id = ? AND user_id = ?", [$id, $userId]);
        
        if (!$note) {
            Response::notFound('Note not found');
        }
        
        $updates = [];
        if (isset($data['title'])) $updates['title'] = $data['title'];
        if (isset($data['content'])) $updates['content'] = $data['content'];
        if (isset($data['subject_id'])) $updates['subject_id'] = $data['subject_id'];
        if (isset($data['tags'])) $updates['tags'] = json_encode($data['tags']);
        if (isset($data['is_pinned'])) $updates['is_pinned'] = $data['is_pinned'];
        
        if (!empty($updates)) {
            $updates['updated_at'] = date('Y-m-d H:i:s');
            $db->update('notes', $updates, 'id = ? AND user_id = ?', [$id, $userId]);
        }
        
        $note = $db->fetch("SELECT * FROM notes WHERE id = ?", [$id]);
        $note['tags'] = json_decode($note['tags'], true) ?? [];
        
        Response::success($note, 'Note updated');
    }
    
    public static function destroy($id) {
        $userId = Auth::requireAuth();
        $db = Database::getInstance();
        
        $deleted = $db->delete('notes', 'id = ? AND user_id = ?', [$id, $userId]);
        
        if (!$deleted) {
            Response::notFound('Note not found');
        }
        
        Response::success(null, 'Note deleted');
    }
    
    public static function search() {
        $userId = Auth::requireAuth();
        $db = Database::getInstance();
        
        $query = $_GET['q'] ?? '';
        
        if (strlen($query) < 2) {
            Response::error('Search query must be at least 2 characters');
        }
        
        $notes = $db->fetchAll(
            "SELECT id, title, substr(content, 1, 200) as excerpt, tags, updated_at 
             FROM notes 
             WHERE user_id = ? AND (title LIKE ? OR content LIKE ?) 
             ORDER BY updated_at DESC 
             LIMIT 20",
            [$userId, "%{$query}%", "%{$query}%"]
        );
        
        $notes = array_map(function($note) {
            $note['tags'] = json_decode($note['tags'], true) ?? [];
            return $note;
        }, $notes);
        
        Response::success($notes);
    }
    
    public static function generateFlashcards($id) {
        $userId = Auth::requireAuth();
        $db = Database::getInstance();
        
        $note = $db->fetch("SELECT content, subject_id FROM notes WHERE id = ? AND user_id = ?", [$id, $userId]);
        if (!$note) Response::notFound('Note not found');

        $apiKey = getenv('GEMINI_API_KEY') ?: ($_ENV['GEMINI_API_KEY'] ?? '');
        if (empty($apiKey)) {
            Response::error('Chave da API do Gemini nao configurada no .env');
        }

        $prompt = "Crie ate 5 flashcards diretos e curtos (frente e verso) com base no seguinte texto. Retorne APENAS um JSON no formato: [{\"front\": \"pergunta\", \"back\": \"resposta\"}]. Texto: \n" . strip_tags($note['content']);
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . $apiKey);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'contents' => [['parts' => [['text' => $prompt]]]]
        ]));
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $data = json_decode($response, true);
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
        
        preg_match('/\[.*\]/s', $text, $matches);
        $cards = json_decode($matches[0] ?? '[]', true);
        
        if (empty($cards)) {
            Response::error('Nao foi possivel gerar os flashcards. Tente novamente.');
        }

        $created = 0;
        foreach ($cards as $card) {
            if (!empty($card['front']) && !empty($card['back'])) {
                $db->insert('flashcards', [
                    'user_id' => $userId,
                    'subject_id' => $note['subject_id'],
                    'front_content' => $card['front'],
                    'back_content' => $card['back'],
                    'difficulty' => 1,
                    'next_review' => date('Y-m-d H:i:s')
                ]);
                $created++;
            }
        }

        Response::success(['message' => "$created flashcards gerados com IA!"]);
    }
}
