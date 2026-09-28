<?php

declare(strict_types=1);

require_once __DIR__ . '/../utils/QuestionAssets.php';

function expectAssetSame(mixed $expected, mixed $actual, string $message): void {
    if ($expected !== $actual) {
        throw new RuntimeException($message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}

expectAssetSame(
    ['/question-assets/enem/assets/2025/dia-1/q1_1.png'],
    QuestionAssets::publicUrls('["assets/2025/dia-1/q1_1.png"]'),
    'Question assets get a stable public URL'
);
expectAssetSame(
    ['/question-assets/enem/reference-assets/2009/dia-2/q97-98.png'],
    QuestionAssets::publicUrls(['reference-assets/2009/dia-2/q97-98.png']),
    'Reference assets use the same protected public namespace'
);
expectAssetSame(
    [],
    QuestionAssets::publicUrls(['../database/bsenem.db', 'assets/../../secret.png', 'javascript:alert(1)']),
    'Traversal and unsafe schemes are rejected'
);
expectAssetSame(
    ['https://example.test/image.png', '/already-public/image.png'],
    QuestionAssets::publicUrls(['https://example.test/image.png', '/already-public/image.png']),
    'Explicit public URLs stay intact'
);

echo "Question asset tests passed" . PHP_EOL;
