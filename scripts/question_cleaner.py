"""Limpeza e validação das questões extraídas dos PDFs do ENEM.

O parser (scripts/enem_parser.py) grava o texto cru do PDF. O layout de duas
colunas faz com que o fim do enunciado vaze para dentro da alternativa A e que
rodapés de página grudem na alternativa E. Este módulo repara esses casos e
diz quais questões estão boas o bastante para entrar num simulado.

As funções são puras: o banco continua sendo a fonte crua e a limpeza acontece
na geração do simulado (idempotente, mesmo se o parser rodar de novo).
"""

import re
from typing import Any, Dict, List, Tuple

PLACEHOLDER_STATEMENT = re.compile(r"^Quest[ãa]o\s*\d+\s*[—\-–]\s*ENEM\s*\d{4}\s*$", re.IGNORECASE)
PLACEHOLDER_OPTION = re.compile(r"^Op[çc][ãa]o\s*[A-E]$", re.IGNORECASE)

# Linha que marca o início real da alternativa: "A", "A\t", "A texto"
_MARKER = re.compile(r"^([A-E])[\t ]*(.*)$")

# Rodapés de caderno: "•LC – 1º DIA – CADERNO 1 – AZUL•",
# "MT - 2º dia | Caderno 5 - AMARELO - 1ª Aplicação"
FOOTER = re.compile(
    r"\n\s*\d{1,3}\s*\n\s*\W{0,3}\s*(?:LC|CH|CN|MT)\s*\W{1,3}\s*\d\s*[º°o]?\s*dia.{0,80}$"
    r"|\n\s*\d{1,3}\s*\n\s*\W{0,3}\s*\d\s*[º°o]?\s*dia\s*\W{1,3}.{0,60}$"
    r"|\n\s*\W{0,3}\s*(?:LC|CH|CN|MT)\s*\W{1,3}\s*\d\s*[º°o]?\s*dia\s*\|.{0,80}$",
    re.IGNORECASE | re.DOTALL,
)

# Sequências de números de linha/página soltos ("27\n\n28\n\n29\n\n30") no fim do texto
TRAILING_NUMBERS = re.compile(r"(?:\n\s*\d{1,3}\s*){3,}$")

# Marcadores de alternativa soltos que sobram no fim do enunciado
TRAILING_MARKERS = re.compile(r"(?:\n\s*[A-E]\s*)+$")


def _split_leaked_option_a(option_a: str) -> Tuple[str, str]:
    """Devolve (trecho do enunciado que vazou, alternativa A real)."""
    lines = option_a.splitlines()
    last = None
    for idx, line in enumerate(lines):
        m = _MARKER.match(line.strip())
        if m and m.group(1) == "A":
            last = idx
    if last is None or last == 0:
        return "", option_a
    leaked = "\n".join(lines[:last]).strip()
    rest = "\n".join(lines[last:]).strip()
    for _ in range(2):
        rest = re.sub(r"^A[\t ]*\n?", "", rest).strip()
    return leaked, rest


def _strip_footer(text: str) -> str:
    cleaned = FOOTER.sub("", text).strip()
    cleaned = TRAILING_NUMBERS.sub("", cleaned).strip()
    return cleaned


def _normalize(text: str) -> str:
    text = text.replace("\r\n", "\n").replace(" ", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = TRAILING_MARKERS.sub("", text)
    return text.strip()


def clean_question(q: Dict[str, Any]) -> Dict[str, Any]:
    """Devolve uma cópia da questão com enunciado e alternativas reparados."""
    out = dict(q)
    options: List[str] = list(q.get("options") or [])
    statement = q.get("statement") or ""

    if options:
        leaked, real_a = _split_leaked_option_a(options[0])
        if leaked and real_a:
            if PLACEHOLDER_STATEMENT.match(statement.strip()):
                statement = leaked
            else:
                statement = f"{statement}\n\n{leaked}"
            options[0] = real_a

        options[-1] = _strip_footer(options[-1])
        options = [_strip_footer(_normalize(o)) for o in options]

    out["statement"] = _normalize(statement)
    out["options"] = options
    return out


def validation_errors(q: Dict[str, Any]) -> List[str]:
    """Motivos pelos quais a questão não pode entrar num simulado (vazio = ok)."""
    errors: List[str] = []
    statement = (q.get("statement") or "").strip()
    options: List[str] = [(o or "").strip() for o in (q.get("options") or [])]

    if len(options) != 5:
        errors.append("options-count")
    if any(not o for o in options):
        errors.append("options-empty")
    if any(PLACEHOLDER_OPTION.match(o) for o in options):
        errors.append("options-placeholder")
    if len(set(options)) != len(options):
        errors.append("options-duplicated")
    if not statement or PLACEHOLDER_STATEMENT.match(statement):
        errors.append("statement-placeholder")
    elif len(statement) < 80 and not q.get("images"):
        errors.append("statement-too-short")
    if any(len(o) > 400 for o in options):
        errors.append("option-too-long")
    correct = q.get("correct_option", q.get("correctOption"))
    if not isinstance(correct, int) or not 0 <= correct <= 4:
        errors.append("correct-option")
    return errors


def is_usable(q: Dict[str, Any]) -> bool:
    return not validation_errors(q)
