<?php

class FlashcardReviewActivity {
    public static function record($db, int $userId, ?int $subjectId, int $cardId, int $xpEarned): void {
        $db->insert('study_sessions', [
            'user_id' => $userId,
            'subject_id' => $subjectId,
            'type' => 'flashcards',
            'resource_id' => $cardId,
            'duration' => 0,
            'xp_earned' => $xpEarned
        ]);

        $today = date('Y-m-d');
        $existing = $db->fetch('SELECT id FROM activity_log WHERE user_id = ? AND date = ?', [$userId, $today]);
        if ($existing) {
            $db->query(
                'UPDATE activity_log SET cards_reviewed = cards_reviewed + 1, xp_earned = xp_earned + ? WHERE user_id = ? AND date = ?',
                [$xpEarned, $userId, $today]
            );
            return;
        }
        $db->insert('activity_log', [
            'user_id' => $userId,
            'date' => $today,
            'study_minutes' => 0,
            'cards_reviewed' => 1,
            'xp_earned' => $xpEarned
        ]);
    }
}
