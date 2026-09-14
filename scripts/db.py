import json
import os
import sqlite3
from typing import Any, Dict, List, Optional

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS enem_questions (
    id TEXT PRIMARY KEY,
    year INTEGER NOT NULL,
    day INTEGER NOT NULL,
    original_number INTEGER NOT NULL,
    area TEXT NOT NULL,
    statement TEXT NOT NULL,
    images TEXT NOT NULL DEFAULT '[]',
    options TEXT NOT NULL,
    correct_option INTEGER NOT NULL,
    language TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enem_area_year ON enem_questions(area, year);
CREATE INDEX IF NOT EXISTS idx_enem_year_number ON enem_questions(year, original_number);
"""

def init_db(db_path: str = "data/enem/enem.db") -> sqlite3.Connection:
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    with conn:
        conn.executescript(SCHEMA_SQL)
    return conn

def insert_question(conn: sqlite3.Connection, q: Dict[str, Any]) -> bool:
    images_json = json.dumps(q.get("images", []), ensure_ascii=False) if isinstance(q.get("images"), list) else q.get("images", "[]")
    options_json = json.dumps(q.get("options", []), ensure_ascii=False) if isinstance(q.get("options"), list) else q.get("options", "[]")
    
    sql = """
    INSERT INTO enem_questions (
        id, year, day, original_number, area, statement, images, options, correct_option, language
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        year=excluded.year,
        day=excluded.day,
        original_number=excluded.original_number,
        area=excluded.area,
        statement=excluded.statement,
        images=excluded.images,
        options=excluded.options,
        correct_option=excluded.correct_option,
        language=excluded.language;
    """
    with conn:
        conn.execute(sql, (
            q["id"],
            int(q["year"]),
            int(q["day"]),
            int(q["original_number"]),
            q["area"],
            q["statement"],
            images_json,
            options_json,
            int(q["correct_option"]),
            q.get("language")
        ))
    return True

def batch_insert_questions(conn: sqlite3.Connection, questions: List[Dict[str, Any]]) -> int:
    inserted = 0
    with conn:
        for q in questions:
            if insert_question(conn, q):
                inserted += 1
    return inserted

def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    item = dict(row)
    try:
        item["images"] = json.loads(item["images"])
    except Exception:
        item["images"] = []
    try:
        item["options"] = json.loads(item["options"])
    except Exception:
        item["options"] = []
    return item

def get_questions_by_area(
    conn: sqlite3.Connection,
    area: Optional[str] = None,
    limit: Optional[int] = None,
    shuffle: bool = True
) -> List[Dict[str, Any]]:
    query = "SELECT * FROM enem_questions"
    params: List[Any] = []
    
    if area and area.lower() != "geral":
        query += " WHERE area = ?"
        params.append(area.lower())
        
    if shuffle:
        query += " ORDER BY RANDOM()"
    else:
        query += " ORDER BY year ASC, original_number ASC"
        
    if limit is not None and limit > 0:
        query += " LIMIT ?"
        params.append(limit)
        
    cursor = conn.execute(query, params)
    return [row_to_dict(r) for r in cursor.fetchall()]

def get_question_stats(conn: sqlite3.Connection) -> Dict[str, Any]:
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM enem_questions")
    total = cursor.fetchone()[0]
    
    cursor.execute("SELECT area, COUNT(*) FROM enem_questions GROUP BY area")
    by_area = {row[0]: row[1] for row in cursor.fetchall()}
    
    cursor.execute("SELECT year, COUNT(*) FROM enem_questions GROUP BY year ORDER BY year ASC")
    by_year = {row[0]: row[1] for row in cursor.fetchall()}
    
    return {
        "total": total,
        "by_area": by_area,
        "by_year": by_year
    }
