import os
import pytest
from scripts.enem_parser import parse_gabarito, get_question_area, split_statement_and_options

def test_get_question_area():
    # 2023 (post-2017)
    assert get_question_area(2023, 1, 10) == "linguagens"
    assert get_question_area(2023, 1, 50) == "ciencias-humanas"
    assert get_question_area(2023, 2, 100) == "ciencias-natureza"
    assert get_question_area(2023, 2, 150) == "matematica"
    
    # 2015 (pre-2017)
    assert get_question_area(2015, 1, 10) == "ciencias-humanas"
    assert get_question_area(2015, 1, 50) == "ciencias-natureza"
    assert get_question_area(2015, 2, 100) == "linguagens"
    assert get_question_area(2015, 2, 150) == "matematica"

def test_parse_gabarito_2023():
    d1_gb_path = "data/enem/pdfs/2023/d1_gabarito.pdf"
    if os.path.exists(d1_gb_path):
        gb = parse_gabarito(d1_gb_path)
        assert len(gb) == 95
        assert gb["1-ingles"] == "B"
        assert gb["1-espanhol"] == "A"
        assert gb[46] == "C"

def test_split_statement_and_options():
    text = (
        "Nesse poema de Tato Laviera, o eu lírico destaca uma\n"
        "A convergência linguístico-cultural.\n"
        "B característica histórico-cultural.\n"
        "C tendência estilístico-literária.\n"
        "D discriminação cultural.\n"
        "E censura musical."
    )
    statement, options = split_statement_and_options(text)
    assert "Tato Laviera" in statement
    assert len(options) == 5
    assert options[0] == "convergência linguístico-cultural."
    assert options[4] == "censura musical."
