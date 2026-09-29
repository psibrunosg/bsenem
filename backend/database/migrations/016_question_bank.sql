CREATE TABLE IF NOT EXISTS concurso_questions (
    id TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    year INTEGER NOT NULL,
    organization TEXT NOT NULL,
    board TEXT NOT NULL,
    target_role TEXT NOT NULL,
    subject_slug TEXT NOT NULL,
    subject_label TEXT NOT NULL,
    question_number INTEGER NOT NULL,
    statement TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    option_e TEXT NOT NULL,
    correct_option TEXT NOT NULL CHECK(correct_option IN ('A', 'B', 'C', 'D', 'E')),
    source_label TEXT NOT NULL,
    UNIQUE(id)
);

CREATE INDEX IF NOT EXISTS idx_concurso_questions_subject ON concurso_questions(subject_slug);
CREATE INDEX IF NOT EXISTS idx_concurso_questions_role ON concurso_questions(target_role);

CREATE TABLE IF NOT EXISTS question_bank_topics (
    specialty_slug TEXT NOT NULL,
    slug TEXT NOT NULL,
    label TEXT NOT NULL,
    position INTEGER NOT NULL CHECK(position > 0),
    taxonomy_version TEXT NOT NULL,
    PRIMARY KEY (specialty_slug, slug)
);

CREATE TABLE IF NOT EXISTS concurso_question_topics (
    question_id TEXT PRIMARY KEY,
    specialty_slug TEXT NOT NULL,
    topic_slug TEXT NOT NULL,
    taxonomy_version TEXT NOT NULL,
    review_status TEXT NOT NULL CHECK(review_status = 'approved'),
    reviewed_by TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    FOREIGN KEY (question_id) REFERENCES concurso_questions(id) ON DELETE CASCADE,
    FOREIGN KEY (specialty_slug, topic_slug) REFERENCES question_bank_topics(specialty_slug, slug)
);

CREATE INDEX IF NOT EXISTS idx_concurso_question_topics_facet ON concurso_question_topics(specialty_slug, topic_slug);

CREATE TABLE IF NOT EXISTS question_bank_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    filters_json TEXT NOT NULL,
    question_count INTEGER NOT NULL CHECK(question_count IN (10, 25, 50, 75, 100)),
    status TEXT NOT NULL CHECK(status IN ('active', 'completed')) DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    completed_at DATETIME,
    result_json TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_question_bank_sessions_user ON question_bank_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS question_bank_session_items (
    session_id TEXT NOT NULL,
    position INTEGER NOT NULL CHECK(position >= 0),
    question_key TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    PRIMARY KEY (session_id, position),
    UNIQUE (session_id, question_key),
    FOREIGN KEY (session_id) REFERENCES question_bank_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS question_bank_session_answers (
    session_id TEXT NOT NULL,
    question_key TEXT NOT NULL,
    selected_option INTEGER CHECK(selected_option BETWEEN 0 AND 4),
    flagged INTEGER NOT NULL DEFAULT 0 CHECK(flagged IN (0, 1)),
    is_correct INTEGER NOT NULL CHECK(is_correct IN (0, 1)),
    PRIMARY KEY (session_id, question_key),
    FOREIGN KEY (session_id, question_key) REFERENCES question_bank_session_items(session_id, question_key) ON DELETE CASCADE
);
