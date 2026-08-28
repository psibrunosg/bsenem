<?php
// backend/api/index.php

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../utils/env.php';
loadEnv();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/response.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/FlashcardController.php';
require_once __DIR__ . '/../controllers/NoteController.php';
require_once __DIR__ . '/../controllers/ProgressController.php';
require_once __DIR__ . '/../controllers/ExamController.php';

initializeDatabase();

$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];

// Strip query string
$uri = strtok($uri, '?');

// Remove trailing slash
$uri = rtrim($uri, '/');

// Remove /api prefix if present
$uri = preg_replace('#^/api#', '', $uri);

// Split into segments
$segments = array_values(array_filter(explode('/', $uri)));

function getSegment($index) {
    global $segments;
    return $segments[$index] ?? null;
}

// Route matching
$resource = getSegment(0);
$id = getSegment(1);
$sub = getSegment(2);

match(true) {
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

    $resource === 'auth' && $id === 'me' && $method === 'GET'
        => AuthController::me(),

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

    // Fallback
    default => Response::notFound('Endpoint not found')
};



