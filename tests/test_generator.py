import os
import tempfile
import pytest
from scripts.db import init_db, insert_question
from scripts.generate_simulado import build_simulado


def mock_question(i, images=None):
    return {
        "id": f"enem-2022-q{i}",
        "year": 2022 if i <= 5 else 2023,
        "day": 2,
        "original_number": 90 + i,
        "area": "ciencias-natureza",
        "statement": f"Enunciado da questão teste {i} com texto suficiente para passar na validação de tamanho mínimo.",
        "images": images if images is not None else [],
        "options": [f"Alternativa A {i}", f"Alternativa B {i}", f"Alternativa C {i}", f"Alternativa D {i}", f"Alternativa E {i}"],
        "correct_option": (i % 5),
        "language": None
    }


def seeded_db(tmpdir, images=None):
    conn = init_db(os.path.join(tmpdir, "test_gen.db"))
    for i in range(1, 11):
        insert_question(conn, mock_question(i, images))
    return conn


def test_build_simulado():
    with tempfile.TemporaryDirectory() as tmpdir:
        conn = seeded_db(tmpdir)
        try:
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
        finally:
            conn.close()


def test_questoes_com_imagem_ficam_de_fora_por_padrao():
    with tempfile.TemporaryDirectory() as tmpdir:
        conn = seeded_db(tmpdir, images=["data/enem/images/test_img.png"])
        try:
            with pytest.raises(ValueError):
                build_simulado(conn, area="ciencias-natureza", count=5)

            simulado = build_simulado(conn, area="ciencias-natureza", count=5, include_images=True)
            assert len(simulado["questions"]) == 5
            assert all(q["image"] for q in simulado["questions"])
        finally:
            conn.close()


def test_questao_sem_gabarito_confirmado_nao_entra():
    with tempfile.TemporaryDirectory() as tmpdir:
        conn = init_db(os.path.join(tmpdir, "test_gen.db"))
        try:
            sem_gabarito = mock_question(1)
            sem_gabarito["correct_option"] = -1
            insert_question(conn, sem_gabarito)
            for i in range(2, 5):
                insert_question(conn, mock_question(i))

            simulado = build_simulado(conn, area="ciencias-natureza", count=10)
            assert len(simulado["questions"]) == 3
            assert sem_gabarito["id"] not in [q["id"] for q in simulado["questions"]]
        finally:
            conn.close()


def test_preset_dia1_mistura_linguagens_e_humanas():
    with tempfile.TemporaryDirectory() as tmpdir:
        conn = init_db(os.path.join(tmpdir, "test_gen.db"))
        try:
            for i in range(1, 11):
                q = mock_question(i)
                q["id"] = f"lc-{i}"
                q["area"] = "linguagens"
                insert_question(conn, q)
                q = mock_question(i)
                q["id"] = f"ch-{i}"
                q["area"] = "ciencias-humanas"
                insert_question(conn, q)

            simulado = build_simulado(conn, area="dia1", count=10, seed=1)
            assert len(simulado["questions"]) == 10
            assert simulado["durationMinutes"] == 330
            ids = [q["id"] for q in simulado["questions"]]
            assert any(i.startswith("lc-") for i in ids)
            assert any(i.startswith("ch-") for i in ids)
        finally:
            conn.close()
