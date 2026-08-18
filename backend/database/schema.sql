-- BS Estudos Database Schema
-- SQLite version

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'book',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Resources (videos, audios, documents)
CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER,
    type TEXT NOT NULL CHECK(type IN ('video', 'audio', 'document', 'pdf')),
    title TEXT NOT NULL,
    description TEXT,
    url TEXT,
    file_path TEXT,
    duration INTEGER, -- seconds
    progress REAL DEFAULT 0, -- 0-1
    completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- Flashcards
CREATE TABLE IF NOT EXISTS flashcards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    tags TEXT DEFAULT '[]', -- JSON array
    media_url TEXT,
    
    -- SM-2 fields
    ease_factor REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 0,
    repetitions INTEGER DEFAULT 0,
    due_date DATETIME,
    last_review DATETIME,
    
    -- Stats
    total_reviews INTEGER DEFAULT 0,
    correct_reviews INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- Notes
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER,
    title TEXT NOT NULL,
    content TEXT, -- Markdown
    tags TEXT DEFAULT '[]', -- JSON array
    is_pinned BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- Exams
CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    time_limit INTEGER, -- minutes
    question_count INTEGER DEFAULT 10,
    passing_score REAL DEFAULT 70,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- Questions
CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    type TEXT DEFAULT 'multiple_choice' CHECK(type IN ('multiple_choice', 'true_false', 'essay')),
    options TEXT, -- JSON array of options
    correct_answer TEXT,
    explanation TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

-- Exam attempts
CREATE TABLE IF NOT EXISTS exam_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    exam_id INTEGER NOT NULL,
    score REAL,
    answers TEXT, -- JSON object {questionId: selectedAnswer}
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    time_spent INTEGER, -- seconds
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

-- Study sessions (for tracking study time)
CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER,
    type TEXT NOT NULL CHECK(type IN ('video', 'audio', 'flashcards', 'notes', 'exam')),
    resource_id INTEGER,
    duration INTEGER NOT NULL, -- seconds
    xp_earned INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- Activity log (for heatmap)
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    study_minutes INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    cards_reviewed INTEGER DEFAULT 0,
    exams_completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    requirement_type TEXT, -- 'streak', 'xp', 'cards', 'exams'
    requirement_value INTEGER,
    xp_reward INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
    UNIQUE(user_id, achievement_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_resources_user ON resources(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user ON flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_due ON flashcards(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user ON exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_date ON activity_log(user_id, date);

-- Seed data
INSERT OR IGNORE INTO subjects (name, color, icon, sort_order) VALUES
    ('Matemática', '#3b82f6', 'calculator', 1),
    ('Português', '#10b981', 'book-open', 2),
    ('História', '#f59e0b', 'landmark', 3),
    ('Geografia', '#8b5cf6', 'globe', 4),
    ('Biologia', '#ec4899', 'dna', 5),
    ('Química', '#ef4444', 'flask-conical', 6),
    ('Física', '#06b6d4', 'atom', 7),
    ('Inglês', '#84cc16', 'languages', 8);

INSERT OR IGNORE INTO achievements (name, description, icon, requirement_type, requirement_value, xp_reward) VALUES
    ('Primeiro Estudo', 'Complete sua primeira sessão de estudo', 'play-circle', 'sessions', 1, 50),
    ('Sequência de 3', 'Mantenha uma sequência de 3 dias', 'flame', 'streak', 3, 100),
    ('Sequência de 7', 'Mantenha uma sequência de 7 dias', 'flame', 'streak', 7, 250),
    ('Sequência de 30', 'Mantenha uma sequência de 30 dias', 'flame', 'streak', 30, 1000),
    ('100 Cards', 'Revise 100 flashcards', 'layers', 'cards', 100, 200),
    ('500 Cards', 'Revise 500 flashcards', 'layers', 'cards', 500, 500),
    ('10 Simulados', 'Complete 10 simulados', 'clipboard-check', 'exams', 10, 300),
    ('Nível 5', 'Alcance o nível 5', 'award', 'level', 5, 150),
    ('Nível 10', 'Alcance o nível 10', 'award', 'level', 10, 500),
    ('1000 XP', 'Ganhe 1000 XP total', 'zap', 'xp', 1000, 200);
