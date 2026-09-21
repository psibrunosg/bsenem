CREATE TABLE IF NOT EXISTS study_library_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL CHECK(provider IN ('google_drive')),
    root_drive_id TEXT NOT NULL,
    root_url TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider, root_drive_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_library_import_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
    item_count INTEGER NOT NULL DEFAULT 0,
    created_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    failure_message TEXT,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    FOREIGN KEY (source_id) REFERENCES study_library_sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_library_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    last_import_run_id INTEGER,
    drive_id TEXT NOT NULL,
    direct_url TEXT NOT NULL,
    name TEXT NOT NULL,
    catalog_path TEXT NOT NULL DEFAULT '',
    item_type TEXT NOT NULL CHECK(item_type IN ('video', 'pdf', 'audio', 'document', 'other')),
    mime_type TEXT,
    modified_at TEXT,
    is_available BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, source_id, drive_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES study_library_sources(id) ON DELETE CASCADE,
    FOREIGN KEY (last_import_run_id) REFERENCES study_library_import_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_study_library_items_user_path
    ON study_library_items(user_id, catalog_path);

CREATE INDEX IF NOT EXISTS idx_study_library_items_source_drive
    ON study_library_items(source_id, drive_id);
