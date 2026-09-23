ALTER TABLE simulator_session_answers
    ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0 CHECK(flagged IN (0, 1));

ALTER TABLE simulator_sessions
    ADD COLUMN time_limit_seconds INTEGER NOT NULL DEFAULT 0 CHECK(time_limit_seconds >= 0);
