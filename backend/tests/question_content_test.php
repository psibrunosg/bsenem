<?php

declare(strict_types=1);

require_once __DIR__ . '/../utils/QuestionContent.php';

function expectContentSame(mixed $expected, mixed $actual, string $message): void {
    if ($expected !== $actual) {
        throw new RuntimeException($message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}

expectContentSame(
    'Texto útil',
    QuestionContent::statement('ENEM2024ENEM2024ENEM2024 Texto útil'),
    'Concatenated ENEM watermarks are removed from the student-facing statement'
);

expectContentSame(
    'Alternativa limpa',
    QuestionContent::option('ENEM 2022 ENEM 2022 ENEM 2022 A	 Alternativa limpa', 'A'),
    'Watermarks and embedded option labels are removed from student-facing options'
);

expectContentSame(
    'Conteúdo B legítimo',
    QuestionContent::option('Conteúdo B legítimo', 'B'),
    'Option cleanup does not alter unrelated text'
);

expectContentSame(
    true,
    QuestionContent::hasRepeatedWatermark('ENEM2024ENEM2024ENEM2024'),
    'Repeated watermark detector handles concatenated tokens'
);

expectContentSame(
    true,
    QuestionContent::hasEmbeddedOptionLabel("C\t Texto", 'C'),
    'Embedded option label detector recognizes the matching label'
);

echo "Question content tests passed" . PHP_EOL;
