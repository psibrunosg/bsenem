<?php
// backend/router.php
// Router for PHP built-in server

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Serve static files
if ($uri !== '/' && file_exists(__DIR__ . '/public' . $uri)) {
    return false;
}

// Route all requests to index.php
$_SERVER['REQUEST_URI'] = $uri;
require __DIR__ . '/public/index.php';
