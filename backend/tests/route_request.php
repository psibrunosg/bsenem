<?php

declare(strict_types=1);

$_SERVER['REQUEST_METHOD'] = getenv('TEST_METHOD') ?: 'GET';
$_SERVER['REQUEST_URI'] = getenv('TEST_URI') ?: '/';
$_SERVER['HTTP_HOST'] = getenv('TEST_HOST') ?: 'localhost';
$_SERVER['HTTP_ORIGIN'] = getenv('TEST_ORIGIN') ?: 'http://localhost';
$_SERVER['HTTP_X_FORWARDED_PROTO'] = getenv('TEST_SCHEME') ?: 'http';
$_SERVER['HTTP_X_FORWARDED_HOST'] = getenv('TEST_FORWARDED_HOST') ?: '';
$_SERVER['REMOTE_ADDR'] = getenv('TEST_REMOTE_ADDR') ?: '127.0.0.1';
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
