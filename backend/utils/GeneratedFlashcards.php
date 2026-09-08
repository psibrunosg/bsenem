<?php

class GeneratedFlashcards {
    public static function persist($db, int $userId, ?int $subjectId, array $cards): int {
        $created = 0;
        foreach ($cards as $card) {
            $front = trim((string)($card['front'] ?? ''));
            $back = trim((string)($card['back'] ?? ''));
            if ($front === '' || $back === '') {
                continue;
            }
            $db->insert('flashcards', [
                'user_id' => $userId,
                'subject_id' => $subjectId,
                'front' => $front,
                'back' => $back,
                'tags' => json_encode(['gerado-por-nota']),
                'due_date' => date('Y-m-d H:i:s')
            ]);
            $created++;
        }
        return $created;
    }
}
