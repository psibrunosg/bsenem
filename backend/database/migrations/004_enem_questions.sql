CREATE TABLE IF NOT EXISTS enem_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    day INTEGER NOT NULL,
    question_number INTEGER NOT NULL,
    area TEXT NOT NULL,
    statement TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    option_e TEXT NOT NULL,
    correct_option TEXT CHECK(correct_option IN ('A', 'B', 'C', 'D', 'E', 'ANULADA') OR correct_option IS NULL),
    status TEXT NOT NULL CHECK(status IN ('valid', 'pending')),
    pending_reason TEXT,
    source_pdf TEXT NOT NULL,
    source_page INTEGER NOT NULL,
    source_pages TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    inep_url TEXT NOT NULL,
    mirror_url TEXT NOT NULL,
    images TEXT NOT NULL DEFAULT '[]',
    foreign_language_option TEXT,
    extra_data TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, day, question_number)
);

CREATE TABLE IF NOT EXISTS enem_question_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    relative_path TEXT NOT NULL UNIQUE,
    source_pdf TEXT NOT NULL,
    source_page INTEGER NOT NULL,
    image_index INTEGER NOT NULL DEFAULT 0,
    sha256 TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    bytes INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES enem_questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enem_questions_year_day ON enem_questions(year, day);
CREATE INDEX IF NOT EXISTS idx_enem_questions_area ON enem_questions(area);
CREATE INDEX IF NOT EXISTS idx_enem_questions_status ON enem_questions(status);
CREATE INDEX IF NOT EXISTS idx_enem_assets_question_id ON enem_question_assets(question_id);
