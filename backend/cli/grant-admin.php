<?php

declare(strict_types=1);

require_once __DIR__ . '/../utils/env.php';
loadEnv();
require_once __DIR__ . '/../config/database.php';

$email = strtolower(trim((string) ($argv[1] ?? '')));
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    fwrite(STDERR, "Uso: php backend/cli/grant-admin.php email@exemplo.com\n");
    exit(2);
}

$db = Database::getInstance();
$user = $db->fetch('SELECT id, email, role FROM users WHERE email = ?', [$email]);
if (!$user) {
    fwrite(STDERR, "Usuário não encontrado.\n");
    exit(1);
}

$db->query("UPDATE users SET role = 'admin', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [(int) $user['id']]);
echo "Administrador habilitado para {$user['email']}.\n";
