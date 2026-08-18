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
}
