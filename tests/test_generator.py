import os
import tempfile
import pytest
from scripts.db import init_db, insert_question
from scripts.generate_simulado import build_simulado

def test_build_simulado():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test_gen.db")
        conn = init_db(db_path)
        
        # Insert 10 mock questions across 2 years
        for i in range(1, 11):
            q = {
                "id": f"enem-2022-q{i}",
                "year": 2022 if i <= 5 else 2023,
                "day": 2,
                "original_number": 90 + i,
                "area": "ciencias-natureza",
                "statement": f"Enunciado da questão teste {i}",
                "images": [f"data/enem/images/test_img_{i}.png"],
                "options": [f"Opção A {i}", f"Opção B {i}", f"Opção C {i}", f"Opção D {i}", f"Opção E {i}"],
                "correct_option": (i % 5),
                "language": None
            }
            insert_question(conn, q)
            
        simulado = build_simulado(conn, area="ciencias-natureza", count=5, title="Meu Simulado")
        assert simulado["schema"] == "bsestudos.exam.v1"
        assert simulado["title"] == "Meu Simulado"
        assert simulado["durationMinutes"] == 15
        assert len(simulado["questions"]) == 5
        
        for q in simulado["questions"]:
            assert "id" in q
            assert len(q["options"]) == 5
            assert 0 <= q["correctOption"] <= 4
            assert "ENEM" in q["explanation"]
            assert q["image"] is not None
            
        conn.close()
