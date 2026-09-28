ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'
    CHECK(role IN ('student', 'admin'));

CREATE TABLE simulator_reference_groups (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    images TEXT NOT NULL DEFAULT '[]',
    source_pdf TEXT,
    source_pages TEXT NOT NULL DEFAULT '[]',
    review_status TEXT NOT NULL DEFAULT 'reviewed'
      CHECK(review_status IN ('draft', 'reviewed')),
    created_by INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE simulator_reference_group_questions (
    group_id TEXT NOT NULL,
    question_id TEXT NOT NULL UNIQUE,
    position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
    PRIMARY KEY (group_id, question_id),
    FOREIGN KEY (group_id) REFERENCES simulator_reference_groups(id) ON DELETE CASCADE
);

CREATE INDEX idx_simulator_reference_group_questions_group
    ON simulator_reference_group_questions(group_id, position);
