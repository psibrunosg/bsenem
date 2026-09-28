CREATE TABLE simulator_catalog_replacements (
    catalog_id TEXT NOT NULL,
    position INTEGER NOT NULL CHECK(position > 0),
    original_question_id TEXT NOT NULL,
    replacement_question_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (catalog_id, position),
    FOREIGN KEY (catalog_id) REFERENCES simulator_catalogs(id) ON DELETE CASCADE
);

CREATE INDEX idx_simulator_catalog_replacements_original
    ON simulator_catalog_replacements(original_question_id);
