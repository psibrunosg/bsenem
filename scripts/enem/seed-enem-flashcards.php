<?php

declare(strict_types=1);

require_once __DIR__ . '/../../backend/config/database.php';

$db = Database::getInstance();
$pdo = $db->getConnection();

$subjectsConfig = [
    'portugues'            => ['name' => 'Português, Literatura e Redação',       'color' => '#ec4899', 'icon' => 'book-open',     'order' => 1],
    'fisica'               => ['name' => 'Física',                                'color' => '#3b82f6', 'icon' => 'zap',           'order' => 2],
    'quimica'              => ['name' => 'Química',                               'color' => '#10b981', 'icon' => 'flask-conical', 'order' => 3],
    'biologia'             => ['name' => 'Biologia',                              'color' => '#22c55e', 'icon' => 'dna',           'order' => 4],
    'matematica'           => ['name' => 'Matemática',                            'color' => '#f59e0b', 'icon' => 'calculator',    'order' => 5],
    'historia'             => ['name' => 'História Geral e do Brasil',            'color' => '#ef4444', 'icon' => 'landmark',      'order' => 6],
    'geografia'            => ['name' => 'Geografia e Geopolítica',               'color' => '#06b6d4', 'icon' => 'globe',         'order' => 7],
    'filosofia-sociologia' => ['name' => 'Filosofia e Sociologia',                'color' => '#8b5cf6', 'icon' => 'scale',         'order' => 8],
    'linguagens-extras'    => ['name' => 'Inglês, Espanhol, Artes e Ed. Física',  'color' => '#6366f1', 'icon' => 'palette',       'order' => 9],
];

$subjectIds = [];
foreach ($subjectsConfig as $slug => $cfg) {
    $existing = $db->fetch('SELECT id FROM subjects WHERE name = ?', [$cfg['name']]);
    if ($existing) {
        $subjectIds[$slug] = (int)$existing['id'];
    } else {
        $subjectIds[$slug] = (int)$db->insert('subjects', [
            'name'       => $cfg['name'],
            'color'      => $cfg['color'],
            'icon'       => $cfg['icon'],
            'sort_order' => $cfg['order'],
        ]);
    }
}

$users = $db->fetchAll('SELECT id FROM users');
if (empty($users)) {
    $defaultUserId = (int)$db->insert('users', [
        'name'          => 'Estudante ENEM',
        'email'         => 'estudante@bsenem.local',
        'password_hash' => password_hash('enem2026', PASSWORD_DEFAULT),
    ]);
    $users = [['id' => $defaultUserId]];
}

$inserted = 0;
foreach ($subjectsConfig as $slug => $cfg) {
    $jsonFile = __DIR__ . "/../../content/enem/{$slug}-enem-completo-flashcards.json";
    if (!is_file($jsonFile)) {
        continue;
    }
    $cards = json_decode((string)file_get_contents($jsonFile), true);
    if (!is_array($cards)) {
        continue;
    }
    foreach ($users as $user) {
        $userId = (int)$user['id'];
        foreach ($cards as $card) {
            $exists = $db->fetch(
                'SELECT id FROM flashcards WHERE user_id = ? AND front = ?',
                [$userId, $card['front']]
            );
            if ($exists) {
                continue;
            }
            $db->insert('flashcards', [
                'user_id'    => $userId,
                'subject_id' => $subjectIds[$slug],
                'front'      => $card['front'],
                'back'       => $card['back'],
                'tags'       => json_encode($card['tags'] ?? [$slug, 'enem'], JSON_UNESCAPED_UNICODE),
            ]);
            $inserted++;
        }
    }
}

$totalCards = (int)$pdo->query('SELECT COUNT(*) FROM flashcards')->fetchColumn();
echo "Seed concluído: {$inserted} novos flashcards inseridos. Total no banco: {$totalCards}.\n";
