<?php

declare(strict_types=1);

$_SERVER['REQUEST_METHOD'] = getenv('TEST_METHOD') ?: 'GET';
$_SERVER['REQUEST_URI'] = getenv('TEST_URI') ?: '/';
$_COOKIE = [];

$cookie = getenv('TEST_COOKIE') ?: '';
if ($cookie !== '') {
    foreach (explode(';', $cookie) as $pair) {
        [$name, $value] = array_pad(explode('=', trim($pair), 2), 2, '');
        $_COOKIE[$name] = $value;
    }
}

register_shutdown_function(static function (): void {
    fwrite(STDERR, '__STATUS__' . http_response_code() . PHP_EOL);
});

require __DIR__ . '/../api/index.php';
