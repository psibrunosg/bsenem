from scripts.question_cleaner import clean_question, is_usable, validation_errors


def base_question(**overrides):
    q = {
        "id": "enem-2023-d1-q010",
        "year": 2023,
        "area": "linguagens",
        "original_number": 10,
        "statement": "Enunciado com tamanho suficiente para passar na validação mínima de caracteres do validador.",
        "options": ["Primeira", "Segunda", "Terceira", "Quarta", "Quinta"],
        "images": [],
        "correct_option": 1,
    }
    q.update(overrides)
    return q


def test_recupera_enunciado_que_vazou_para_a_alternativa_a():
    q = base_question(
        statement="Questão 10 — ENEM 2023",
        options=[
            "resto do texto que pertence ao enunciado.\n\nNesse poema, a expressão citada ressalta o(a)\nA\t\nA\t medo da morte.",
            "ideia de conexão.",
            "conceito de solidão.",
            "risco de devastação.",
            "necessidade de empatia.",
        ],
    )
    cleaned = clean_question(q)

    assert cleaned["options"][0] == "medo da morte."
    assert "ressalta o(a)" in cleaned["statement"]
    assert not cleaned["statement"].endswith("A")
    assert is_usable(cleaned)


def test_remove_rodape_de_caderno_da_ultima_alternativa():
    q = base_question(options=["Primeira", "Segunda", "Terceira", "Quarta",
                               "necessidade de empatia.\n\n2\n–LC • 1º DIA • CADERNO 1 • AZUL–"])
    assert clean_question(q)["options"][4] == "necessidade de empatia."


def test_questao_intacta_nao_e_alterada():
    q = base_question()
    cleaned = clean_question(q)
    assert cleaned["options"] == q["options"]
    assert cleaned["statement"] == q["statement"]


def test_rejeita_alternativas_placeholder():
    q = base_question(options=["Opção A", "Opção B", "Opção C", "Opção D", "Opção E"])
    assert "options-placeholder" in validation_errors(clean_question(q))


def test_rejeita_gabarito_nao_confirmado():
    assert "correct-option" in validation_errors(base_question(correct_option=-1))


def test_rejeita_enunciado_placeholder_e_alternativas_repetidas():
    assert "statement-placeholder" in validation_errors(base_question(statement="Questão 06 — ENEM 2023"))
    assert "options-duplicated" in validation_errors(
        base_question(options=["Igual", "Igual", "Terceira", "Quarta", "Quinta"])
    )
