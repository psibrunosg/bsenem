<?php

declare(strict_types=1);

function readJsonRequestBody(): ?array {
    $stream = PHP_SAPI === 'cli' ? 'php://stdin' : 'php://input';
    $rawBody = file_get_contents($stream);
    if ($rawBody === false || trim($rawBody) === '') {
        return null;
    }

    $decoded = json_decode($rawBody, true);
    return is_array($decoded) ? $decoded : null;
}
