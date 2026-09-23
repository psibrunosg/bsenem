<?php

declare(strict_types=1);

require_once __DIR__ . '/../utils/SimulatorRecommendation.php';

function expectRecommendationSame(mixed $expected, mixed $actual, string $message): void {
    if ($expected !== $actual) {
        throw new RuntimeException($message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}

/** @return array{subject: string, topic: ?string, is_correct: bool, answered_at: string} */
function recommendationResponse(string $subject, ?string $topic, bool $isCorrect, string $answeredAt): array {
    return [
        'subject' => $subject,
        'topic' => $topic,
        'is_correct' => $isCorrect,
        'answered_at' => $answeredAt,
    ];
}

$now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
$at = static fn(int $daysAgo): string => $now->modify("-{$daysAgo} days")->format(DATE_ATOM);

$overview = SimulatorRecommendation::overview([
    recommendationResponse('Matemática', null, false, $at(1)),
    recommendationResponse('Matemática', null, false, $at(2)),
    recommendationResponse('Matemática', null, true, $at(3)),
    recommendationResponse('Matemática', null, false, $at(4)),
    recommendationResponse('Matemática', null, false, $at(5)),
    recommendationResponse('Linguagens', null, true, $at(1)),
], [['id' => 'draft-1', 'subject' => 'Matemática']]);
expectRecommendationSame('attention', $overview['mastery'][0]['status'], 'Five answers below 60% need attention');
expectRecommendationSame(
    ['subject', 'answered_count', 'accuracy', 'status', 'action'],
    array_keys($overview['mastery'][0]),
    'Mastery rows expose only the overview contract'
);
expectRecommendationSame('Matemática', $overview['recommendation']['subject'], 'Lowest sufficient subject is chosen');
expectRecommendationSame(null, $overview['recommendation']['topic'], 'No taxonomy means no invented topic');
expectRecommendationSame([['id' => 'draft-1', 'subject' => 'Matemática']], $overview['active_sessions'], 'Active drafts stay visible');

$sixty = SimulatorRecommendation::overview([
    recommendationResponse('Ciências', null, true, $at(1)),
    recommendationResponse('Ciências', null, true, $at(2)),
    recommendationResponse('Ciências', null, true, $at(3)),
    recommendationResponse('Ciências', null, false, $at(4)),
    recommendationResponse('Ciências', null, false, $at(5)),
], []);
expectRecommendationSame('evolving', $sixty['mastery'][0]['status'], 'Exactly 60% is evolving');
expectRecommendationSame(60.0, $sixty['mastery'][0]['accuracy'], 'Sufficient history exposes its measured accuracy');

$seventyFive = SimulatorRecommendation::overview([
    recommendationResponse('Humanas', null, true, $at(1)),
    recommendationResponse('Humanas', null, true, $at(2)),
    recommendationResponse('Humanas', null, true, $at(3)),
    recommendationResponse('Humanas', null, false, $at(4)),
], []);
expectRecommendationSame('insufficient', $seventyFive['mastery'][0]['status'], 'Four answers stay insufficient');
expectRecommendationSame(null, $seventyFive['mastery'][0]['accuracy'], 'Insufficient history does not fabricate a percentage');

$strong = SimulatorRecommendation::overview([
    recommendationResponse('Linguagens', null, true, $at(1)),
    recommendationResponse('Linguagens', null, true, $at(2)),
    recommendationResponse('Linguagens', null, true, $at(3)),
    recommendationResponse('Linguagens', null, false, $at(4)),
    recommendationResponse('Linguagens', null, true, $at(5)),
    recommendationResponse('Linguagens', null, true, $at(6)),
    recommendationResponse('Linguagens', null, true, $at(7)),
    recommendationResponse('Linguagens', null, true, $at(8)),
], []);
expectRecommendationSame('strong', $strong['mastery'][0]['status'], 'Exactly 75% is strong');

$topic = SimulatorRecommendation::overview([
    recommendationResponse('Matemática', 'Geometria', false, $at(1)),
    recommendationResponse('Matemática', 'Geometria', false, $at(2)),
    recommendationResponse('Matemática', 'Geometria', true, $at(3)),
    recommendationResponse('Matemática', 'Geometria', false, $at(4)),
    recommendationResponse('Matemática', 'Geometria', false, $at(5)),
], []);
expectRecommendationSame('Geometria', $topic['recommendation']['topic'], 'A qualifying exact topic is recommended');

$windowResponses = [];
for ($daysAgo = 0; $daysAgo < 30; $daysAgo++) {
    $windowResponses[] = recommendationResponse('Física', null, true, $at($daysAgo));
}
$windowResponses[] = recommendationResponse('Física', null, false, $at(30));
$windowResponses[] = recommendationResponse('Física', null, false, $at(91));
$window = SimulatorRecommendation::overview($windowResponses, []);
expectRecommendationSame(30, $window['mastery'][0]['answered_count'], 'Only the newest 30 answers are counted');
expectRecommendationSame(100.0, $window['mastery'][0]['accuracy'], 'The 31st oldest answer is ignored before aggregation');

$oldResponse = SimulatorRecommendation::overview([
    recommendationResponse('Biologia', null, true, $at(1)),
    recommendationResponse('Biologia', null, true, $at(2)),
    recommendationResponse('Biologia', null, true, $at(3)),
    recommendationResponse('Biologia', null, true, $at(4)),
    recommendationResponse('Biologia', null, true, $at(5)),
    recommendationResponse('Biologia', null, false, $at(91)),
], []);
expectRecommendationSame(5, $oldResponse['mastery'][0]['answered_count'], 'An answer older than 90 days is ignored');
expectRecommendationSame(100.0, $oldResponse['mastery'][0]['accuracy'], 'Expired answers do not change mastery');

$tie = SimulatorRecommendation::overview([
    recommendationResponse('Biologia', null, true, $at(2)),
    recommendationResponse('Biologia', null, true, $at(3)),
    recommendationResponse('Biologia', null, true, $at(4)),
    recommendationResponse('Biologia', null, false, $at(5)),
    recommendationResponse('Biologia', null, false, $at(6)),
    recommendationResponse('Física', null, true, $at(2)),
    recommendationResponse('Física', null, true, $at(3)),
    recommendationResponse('Física', null, true, $at(4)),
    recommendationResponse('Física', null, false, $at(1)),
    recommendationResponse('Física', null, false, $at(6)),
], []);
expectRecommendationSame('Física', $tie['recommendation']['subject'], 'A more recent error breaks equal-accuracy ties');

$empty = SimulatorRecommendation::overview([], []);
expectRecommendationSame([], $empty['mastery'], 'No answers produce no mastery rows');
expectRecommendationSame(null, $empty['recommendation'], 'No answers produce no recommendation');

echo "Simulator recommendation tests passed" . PHP_EOL;
