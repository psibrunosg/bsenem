-- Sessions play questions from two sources through one view:
-- ENEM questions ('inep:<enem_questions.id>') and concursos from the
-- permanent question bank ('concursos:<id>'). Question IDs become text.

CREATE TABLE simulator_session_answers_legacy AS SELECT * FROM simulator_session_answers;
DROP TABLE simulator_session_answers;

CREATE TABLE simulator_session_questions_next (
    session_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    position INTEGER NOT NULL CHECK(position >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, question_id),
    UNIQUE (session_id, position),
    FOREIGN KEY (session_id) REFERENCES simulator_sessions(id) ON DELETE CASCADE
);
INSERT INTO simulator_session_questions_next (session_id, question_id, position, created_at)
    SELECT session_id, 'inep:' || question_id, position, created_at FROM simulator_session_questions;
DROP TABLE simulator_session_questions;
ALTER TABLE simulator_session_questions_next RENAME TO simulator_session_questions;

CREATE TABLE simulator_session_answers (
    session_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    selected_option TEXT CHECK(selected_option IN ('A', 'B', 'C', 'D', 'E') OR selected_option IS NULL),
    is_correct INTEGER NOT NULL DEFAULT 0 CHECK(is_correct IN (0, 1)),
    flagged INTEGER NOT NULL DEFAULT 0 CHECK(flagged IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, question_id),
    FOREIGN KEY (session_id, question_id)
        REFERENCES simulator_session_questions(session_id, question_id)
        ON DELETE CASCADE
);
INSERT INTO simulator_session_answers (session_id, question_id, selected_option, is_correct, flagged, created_at, updated_at)
    SELECT session_id, 'inep:' || question_id, selected_option, is_correct, flagged, created_at, updated_at
    FROM simulator_session_answers_legacy;
DROP TABLE simulator_session_answers_legacy;

-- Published catalogs are played as sessions. The previous generated
-- simulators and client-scored attempts are kept untouched as history
-- (generated_simulators*, catalog_simulator_attempts); nothing writes to them now.

-- Catalog entries reference the unified question IDs. ENEM exams now point to
-- enem_questions, so the catalog composition is rebuilt by the importer.
-- Catalog rows and bank ENEM copies stay: legacy attempts and generated
-- simulators still reference them.
DROP TABLE IF EXISTS simulator_catalog_questions;
CREATE TABLE simulator_catalog_questions (
    catalog_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (catalog_id, question_id),
    UNIQUE (catalog_id, position),
    FOREIGN KEY (catalog_id) REFERENCES simulator_catalogs(id) ON DELETE CASCADE
);

CREATE VIEW IF NOT EXISTS simulator_questions AS
    SELECT 'inep:' || id AS id,
           'enem' AS category,
           area AS subject,
           topic,
           statement,
           option_a, option_b, option_c, option_d, option_e,
           correct_option,
           images,
           CASE WHEN status = 'valid' AND correct_option IN ('A', 'B', 'C', 'D', 'E') THEN 1 ELSE 0 END AS published,
           printf('%04d-%d-%03d', year, day, question_number) AS sort_key
    FROM enem_questions
    UNION ALL
    SELECT id,
           category,
           subject,
           NULL,
           statement,
           json_extract(options_json, '$[0]'), json_extract(options_json, '$[1]'), json_extract(options_json, '$[2]'),
           json_extract(options_json, '$[3]'), json_extract(options_json, '$[4]'),
           substr('ABCDE', correct_option + 1, 1),
           '[]',
           1,
           id
    FROM simulator_question_bank
    WHERE category = 'concursos';

CREATE INDEX IF NOT EXISTS idx_simulator_question_bank_category_subject
    ON simulator_question_bank(category, subject);
