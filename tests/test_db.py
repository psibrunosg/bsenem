import os
import tempfile
import pytest
from scripts.db import init_db, insert_question, get_questions_by_area, get_question_stats

def test_init_and_insert_question():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test_enem.db")
        conn = init_db(db_path)
        
        q = {
            "id": "enem-2023-q100",
            "year": 2023,
            "day": 2,
            "original_number": 100,
            "area": "ciencias-natureza",
            "statement": "Um professor lança uma esfera...",
            "images": ["data/enem/images/enem_2023_q100_img1.png"],
            "options": ["A", "B", "C", "D", "E"],
            "correct_option": 2,
            "language": None
        }
        assert insert_question(conn, q) is True
        
        stats = get_question_stats(conn)
        assert stats["total"] == 1
        assert stats["by_area"]["ciencias-natureza"] == 1
        
        questions = get_questions_by_area(conn, area="ciencias-natureza", limit=10)
        assert len(questions) == 1
        assert questions[0]["id"] == "enem-2023-q100"
        assert questions[0]["options"] == ["A", "B", "C", "D", "E"]
        assert questions[0]["images"] == ["data/enem/images/enem_2023_q100_img1.png"]
        conn.close()
