<?php

declare(strict_types=1);

$backendDirectory = realpath(__DIR__ . '/..');

if ($backendDirectory === false) {
    exit(1);
}

$iterator = new RecursiveIteratorIterator(
    new RecursiveCallbackFilterIterator(
        new RecursiveDirectoryIterator($backendDirectory, FilesystemIterator::SKIP_DOTS),
        static function (SplFileInfo $file): bool {
            return $file->isDir()
                ? $file->getFilename() !== 'database'
                : $file->getExtension() === 'php';
        }
    )
);

$hasFailure = false;

foreach ($iterator as $file) {
    if (!$file->isFile()) {
        continue;
    }

    $relativePath = 'backend/' . substr($file->getPathname(), strlen($backendDirectory) + 1);
    $output = [];
    $status = 0;

    exec(
        sprintf('"%s" -l %s 2>&1', PHP_BINARY, escapeshellarg($file->getPathname())),
        $output,
        $status
    );

    echo str_replace(DIRECTORY_SEPARATOR, '/', $relativePath) . PHP_EOL;
    $hasFailure = $hasFailure || $status !== 0;
}

exit($hasFailure ? 1 : 0);
