CREATE TABLE IF NOT EXISTS local_exam_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    library_id TEXT NOT NULL,
    local_exam_id TEXT NOT NULL,
    exam_title TEXT NOT NULL,
    score INTEGER NOT NULL CHECK(score >= 0 AND score <= 100),
    total_questions INTEGER NOT NULL CHECK(total_questions >= 0),
    time_spent INTEGER NOT NULL DEFAULT 0 CHECK(time_spent >= 0),
    answers TEXT NOT NULL,
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_local_exam_attempts_user_completed
    ON local_exam_attempts(user_id, completed_at DESC);
