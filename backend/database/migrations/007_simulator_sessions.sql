ALTER TABLE enem_questions ADD COLUMN topic TEXT;

CREATE INDEX IF NOT EXISTS idx_enem_questions_publication
    ON enem_questions(status, area, topic, year, day, question_number);

CREATE TABLE IF NOT EXISTS simulator_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('catalog', 'custom', 'practice')),
    status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'abandoned')),
    subject TEXT,
    topic TEXT,
    question_limit INTEGER NOT NULL CHECK(question_limit > 0),
    current_position INTEGER NOT NULL DEFAULT 0 CHECK(current_position >= 0),
    elapsed_seconds INTEGER NOT NULL DEFAULT 0 CHECK(elapsed_seconds >= 0),
    result_json TEXT,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS simulator_session_questions (
    session_id TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    position INTEGER NOT NULL CHECK(position >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, question_id),
    UNIQUE (session_id, position),
    FOREIGN KEY (session_id) REFERENCES simulator_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES enem_questions(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS simulator_session_answers (
    session_id TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    selected_option TEXT CHECK(selected_option IN ('A', 'B', 'C', 'D', 'E') OR selected_option IS NULL),
    is_correct INTEGER NOT NULL DEFAULT 0 CHECK(is_correct IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, question_id),
    FOREIGN KEY (session_id, question_id)
        REFERENCES simulator_session_questions(session_id, question_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_simulator_sessions_user_status
    ON simulator_sessions(user_id, status, updated_at);
