<?php

require_once __DIR__ . '/../middleware/auth.php';

function expectTrue($condition, $message) {
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

putenv('APP_TOKEN_SECRET=');

try {
    Auth::generateToken(7);
    expectTrue(false, 'Authentication must fail closed without APP_TOKEN_SECRET');
} catch (RuntimeException $exception) {
    expectTrue(true, 'Missing secret is rejected');
}

putenv('APP_TOKEN_SECRET=test-secret-0123456789-0123456789-0123456789');
$token = Auth::generateToken(7);
expectTrue(Auth::verifyToken($token) === 7, 'A generated token must verify for its user');
expectTrue(Auth::verifyToken($token . 'x') === null, 'A modified token must be rejected');

echo "Auth tests passed" . PHP_EOL;
