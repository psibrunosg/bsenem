<?php
// backend/api/index.php

require_once __DIR__ . '/../utils/env.php';
loadEnv();
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/csrf.php';
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/FlashcardController.php';
require_once __DIR__ . '/../controllers/NoteController.php';
require_once __DIR__ . '/../controllers/ProgressController.php';
require_once __DIR__ . '/../controllers/ExamController.php';
require_once __DIR__ . '/../controllers/StudyLibraryController.php';
require_once __DIR__ . '/../controllers/SimulatorController.php';
require_once __DIR__ . '/../controllers/QuestionBankController.php';

initializeDatabase();
Csrf::enforce();

$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];

// Strip query string
$uri = strtok($uri, '?');

// Remove trailing slash
$uri = rtrim($uri, '/');

// Remove /api prefix if present
$uri = preg_replace('#^/api#', '', $uri);

// Split into segments
$segments = array_values(array_filter(explode('/', $uri), static fn(string $segment): bool => $segment !== ''));

function getSegment($index) {
    global $segments;
    return $segments[$index] ?? null;
}

// Route matching
$resource = getSegment(0);
$id = getSegment(1);
$sub = getSegment(2);
$action = getSegment(3);

match(true) {
    // Simulator routes
    $resource === 'simulators' && $id === 'catalog' && !$sub && $method === 'GET'
        => SimulatorController::catalog(),
    $resource === 'simulators' && $id === 'overview' && !$sub && $method === 'GET'
        => SimulatorController::overview(),
    $resource === 'simulators' && $id === 'sessions' && !$sub && $method === 'GET'
        => SimulatorController::sessions(),
    $resource === 'simulators' && $id === 'sessions' && !$sub && $method === 'POST'
        => SimulatorController::create(),
    $resource === 'simulators' && $id === 'sessions' && is_string($sub) && !$action && $method === 'GET'
        => SimulatorController::show($sub),
    $resource === 'simulators' && $id === 'sessions' && is_string($sub) && $action === 'progress' && !getSegment(4) && $method === 'PATCH'
        => SimulatorController::progress($sub),
    $resource === 'simulators' && $id === 'sessions' && is_string($sub) && $action === 'complete' && !getSegment(4) && $method === 'POST'
        => SimulatorController::complete($sub),
    $resource === 'simulators' && $id === 'questions' && is_string($sub) && $action === 'images' && ctype_digit((string) getSegment(4)) && $method === 'GET'
        => SimulatorController::questionImage(rawurldecode($sub), (int) getSegment(4)),
    $resource === 'simulators' && $id === 'questions' && is_string($sub) && $action === 'reference-images' && ctype_digit((string) getSegment(4)) && $method === 'GET'
        => SimulatorController::questionReferenceImage(rawurldecode($sub), (int) getSegment(4)),

    $resource === 'notes' && ctype_digit((string)$id) && $sub === 'flashcards' && $method === 'POST'
        => NoteController::generateFlashcards((int)$id),

    // Auth routes
    $resource === 'auth' && $id === 'forgot-password' && $method === 'POST'
        => AuthController::forgotPassword(),

    $resource === 'auth' && $id === 'reset-password' && $method === 'POST'
        => AuthController::resetPassword(),

    // Auth routes
    $resource === 'auth' && $id === 'register' && $method === 'POST'
        => AuthController::register(),

    $resource === 'auth' && $id === 'login' && $method === 'POST'
        => AuthController::login(),

    $resource === 'auth' && $id === 'access-key-login' && $method === 'POST'
        => AuthController::loginWithAccessKey(),

    $resource === 'auth' && $id === 'access-keys' && !$sub && $method === 'GET'
        => AuthController::listAccessKeys(),

    $resource === 'auth' && $id === 'access-keys' && !$sub && $method === 'POST'
        => AuthController::createAccessKey(),

    $resource === 'auth' && $id === 'access-keys' && ctype_digit((string)$sub) && $method === 'DELETE'
        => AuthController::revokeAccessKey((int)$sub),

    $resource === 'auth' && $id === 'logout' && $method === 'POST'
        => AuthController::logout(),

    $resource === 'auth' && $id === 'me' && $method === 'GET'
        => AuthController::me(),

    $resource === 'auth' && $id === 'profile' && $method === 'PUT'
        => AuthController::updateProfile(),

    // Imported study library routes
    $resource === 'study-library' && !$id && $method === 'GET'
        => StudyLibraryController::index(),

    // Flashcard routes
    $resource === 'flashcards' && $id === 'due' && $sub === 'count' && $method === 'GET'
        => FlashcardController::dueCount(),

    $resource === 'flashcards' && !$id && $method === 'GET'
        => FlashcardController::index(),

    $resource === 'flashcards' && !$id && $method === 'POST'
        => FlashcardController::store(),

    $resource === 'flashcards' && ctype_digit((string)$id) && $sub === 'review' && $method === 'POST'
        => FlashcardController::review((int)$id),

    $resource === 'flashcards' && ctype_digit((string)$id) && $method === 'GET'
        => FlashcardController::show((int)$id),

    $resource === 'flashcards' && ctype_digit((string)$id) && $method === 'PUT'
        => FlashcardController::update((int)$id),

    $resource === 'flashcards' && ctype_digit((string)$id) && $method === 'DELETE'
        => FlashcardController::destroy((int)$id),

    // Note routes
    $resource === 'notes' && $id === 'search' && $method === 'GET'
        => NoteController::search(),

    $resource === 'notes' && !$id && $method === 'GET'
        => NoteController::index(),

    $resource === 'notes' && !$id && $method === 'POST'
        => NoteController::store(),

    $resource === 'notes' && ctype_digit((string)$id) && $method === 'GET'
        => NoteController::show((int)$id),

    $resource === 'notes' && ctype_digit((string)$id) && $method === 'PUT'
        => NoteController::update((int)$id),

    $resource === 'notes' && ctype_digit((string)$id) && $method === 'DELETE'
        => NoteController::destroy((int)$id),

    // Progress routes
    $resource === 'progress' && $id === 'dashboard' && $method === 'GET'
        => ProgressController::dashboard(),

    $resource === 'progress' && $id === 'heatmap' && $method === 'GET'
        => ProgressController::heatmap(),

    $resource === 'progress' && $id === 'study' && $method === 'POST'
        => ProgressController::recordStudy(),

    // Exam routes
    $resource === 'exams' && $id === 'attempt' && $method === 'POST'
        => ExamController::attempt(),
    $resource === 'exams' && $id === 'local-attempt' && $method === 'POST'
        => ExamController::localAttempt(),

    // Question bank routes
    $resource === 'question-bank' && $id === 'facets' && $method === 'GET'
        => QuestionBankController::facets(),

    $resource === 'question-bank' && $id === 'sessions' && !$sub && $method === 'POST'
        => QuestionBankController::createSession(),

    $resource === 'question-bank' && $id === 'sessions' && is_string($sub) && $action === 'submit' && $method === 'POST'
        => QuestionBankController::submitSession($sub),

    $resource === 'question-bank' && $id === 'errors' && $method === 'GET'
        => QuestionBankController::errors(),

    $resource === 'question-bank' && $id === 'history' && $method === 'GET'
        => QuestionBankController::history(),

    // Fallback
    default => Response::notFound('Endpoint not found')
};



