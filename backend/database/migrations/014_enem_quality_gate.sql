ALTER TABLE enem_questions ADD COLUMN quality_status TEXT NOT NULL DEFAULT 'approved'
    CHECK(quality_status IN ('approved', 'quarantined'));

ALTER TABLE enem_questions ADD COLUMN quality_reason TEXT;

CREATE TABLE simulator_content_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_enem_questions_quality
    ON enem_questions(status, quality_status, area, year, day, question_number);

DROP VIEW IF EXISTS simulator_questions;

CREATE VIEW simulator_questions AS
    SELECT 'inep:' || id AS id,
           'enem' AS category,
           area AS subject,
           topic,
           statement,
           option_a, option_b, option_c, option_d, option_e,
           correct_option,
           images,
           CASE
             WHEN status = 'valid'
              AND quality_status = 'approved'
              AND correct_option IN ('A', 'B', 'C', 'D', 'E')
             THEN 1 ELSE 0
           END AS published,
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
