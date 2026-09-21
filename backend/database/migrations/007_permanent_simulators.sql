CREATE TABLE IF NOT EXISTS simulator_question_bank (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('enem', 'concursos')),
    subject TEXT NOT NULL,
    statement TEXT NOT NULL,
    options_json TEXT NOT NULL,
    correct_option INTEGER NOT NULL CHECK(correct_option BETWEEN 0 AND 4),
    explanation TEXT,
    source_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS simulator_catalogs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('enem', 'concursos')),
    subject TEXT NOT NULL,
    duration_minutes INTEGER,
    published INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS simulator_catalog_questions (
    catalog_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (catalog_id, question_id),
    FOREIGN KEY (catalog_id) REFERENCES simulator_catalogs(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES simulator_question_bank(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS generated_simulators (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    subjects_json TEXT NOT NULL,
    question_count INTEGER NOT NULL,
    duration_minutes INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS generated_simulator_questions (
    simulator_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (simulator_id, question_id),
    FOREIGN KEY (simulator_id) REFERENCES generated_simulators(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES simulator_question_bank(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS generated_simulator_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    simulator_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    score REAL NOT NULL,
    total_questions INTEGER NOT NULL,
    answers_json TEXT NOT NULL DEFAULT '[]',
    time_spent INTEGER NOT NULL DEFAULT 0,
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (simulator_id) REFERENCES generated_simulators(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS catalog_simulator_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    catalog_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    score REAL NOT NULL,
    total_questions INTEGER NOT NULL,
    answers_json TEXT NOT NULL DEFAULT '[]',
    time_spent INTEGER NOT NULL DEFAULT 0,
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (catalog_id) REFERENCES simulator_catalogs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_simulator_question_bank_subject ON simulator_question_bank(subject);
CREATE INDEX IF NOT EXISTS idx_generated_simulators_user ON generated_simulators(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_simulator_attempts_user ON catalog_simulator_attempts(user_id, completed_at DESC);
