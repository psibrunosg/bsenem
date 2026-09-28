<?php

declare(strict_types=1);

final class EnemFlashcardImporter {
    /** @return array{inserted:int,skipped:int,subjects:int,files:int} */
    public static function import(PDO $pdo, int $userId, string $contentDir): array {
        $files = glob(rtrim($contentDir, '/\\') . DIRECTORY_SEPARATOR . '*-enem-completo-flashcards.json') ?: [];
        sort($files, SORT_STRING);

        $subjectNames = [
            'biologia' => 'Biologia',
            'fisica' => 'Física',
            'quimica' => 'Química',
            'matematica' => 'Matemática',
            'portugues' => 'Português',
            'historia' => 'História',
            'geografia' => 'Geografia',
            'filosofia' => 'Filosofia',
            'sociologia' => 'Sociologia',
            'ingles' => 'Inglês',
            'espanhol' => 'Espanhol',
            'artes' => 'Artes',
            'educacao-fisica' => 'Educação Física',
        ];

        $subjectCache = [];
        $inserted = 0;
        $skipped = 0;

        $findSubject = $pdo->prepare('SELECT id FROM subjects WHERE lower(name) = lower(?) LIMIT 1');
        $insertSubject = $pdo->prepare('INSERT INTO subjects (name, color, icon, sort_order) VALUES (?, ?, ?, ?)');
        $exists = $pdo->prepare('SELECT id FROM flashcards WHERE user_id = ? AND front = ? AND back = ? LIMIT 1');
        $insert = $pdo->prepare(
            'INSERT INTO flashcards (user_id, subject_id, front, back, tags, due_date) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
        );

        $pdo->beginTransaction();
        try {
            foreach ($files as $file) {
                $raw = file_get_contents($file);
                $cards = is_string($raw) ? json_decode($raw, true) : null;
                if (!is_array($cards)) {
                    throw new RuntimeException('Invalid flashcard JSON: ' . basename($file));
                }

                foreach ($cards as $card) {
                    $front = trim((string) ($card['front'] ?? ''));
                    $back = trim((string) ($card['back'] ?? ''));
                    $tags = is_array($card['tags'] ?? null)
                        ? array_values(array_unique(array_filter(array_map('strval', $card['tags']))))
                        : [];
                    if ($front === '' || $back === '') {
                        $skipped++;
                        continue;
                    }

                    $exists->execute([$userId, $front, $back]);
                    if ($exists->fetchColumn()) {
                        $skipped++;
                        continue;
                    }

                    $slug = strtolower(trim((string) ($tags[0] ?? '')));
                    $subjectName = $subjectNames[$slug] ?? ($slug !== '' ? ucwords(str_replace('-', ' ', $slug)) : 'ENEM');
                    if (!isset($subjectCache[$subjectName])) {
                        $findSubject->execute([$subjectName]);
                        $subjectId = (int) $findSubject->fetchColumn();
                        if ($subjectId === 0) {
                            $sortOrder = count($subjectCache) + 1;
                            $insertSubject->execute([$subjectName, '#ff6b1a', 'book-open', $sortOrder]);
                            $subjectId = (int) $pdo->lastInsertId();
                        }
                        $subjectCache[$subjectName] = $subjectId;
                    }

                    if (!in_array('enem', $tags, true)) {
                        $tags[] = 'enem';
                    }
                    $insert->execute([
                        $userId,
                        $subjectCache[$subjectName],
                        $front,
                        $back,
                        json_encode($tags, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    ]);
                    $inserted++;
                }
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }

        return [
            'inserted' => $inserted,
            'skipped' => $skipped,
            'subjects' => count($subjectCache),
            'files' => count($files),
        ];
    }
}
