import argparse
import json
import os
import random
import sys
import uuid
from typing import Any, Dict, List, Optional

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.db import init_db, get_questions_by_area
from scripts.question_cleaner import clean_question, validation_errors

AREA_NAMES = {
    "linguagens": "Linguagens e Códigos",
    "ciencias-humanas": "Ciências Humanas",
    "ciencias-natureza": "Ciências da Natureza",
    "matematica": "Matemática",
    "geral": "Geral (Misto)"
}

AREAS = ["linguagens", "ciencias-humanas", "ciencias-natureza", "matematica"]

# Composições prontas: preset -> áreas, nº de questões e metadados do simulado
PRESETS: Dict[str, Dict[str, Any]] = {
    "linguagens": {"areas": ["linguagens"], "count": 45},
    "ciencias-humanas": {"areas": ["ciencias-humanas"], "count": 45},
    "ciencias-natureza": {"areas": ["ciencias-natureza"], "count": 45},
    "matematica": {"areas": ["matematica"], "count": 45},
    "dia1": {
        "areas": ["linguagens", "ciencias-humanas"],
        "count": 90,
        "title": "Simulado ENEM — 1º Dia (Linguagens e Ciências Humanas)",
        "duration": 330,
        "subject": "Linguagens e Códigos • Ciências Humanas",
    },
    "dia2": {
        "areas": ["ciencias-natureza", "matematica"],
        "count": 90,
        "title": "Simulado ENEM — 2º Dia (Ciências da Natureza e Matemática)",
        "duration": 300,
        "subject": "Ciências da Natureza • Matemática",
    },
    "geral": {"areas": AREAS, "count": 45},
}


def normalize_area_param(area: Optional[str]) -> Optional[str]:
    if not area:
        return None
    a = area.lower().strip()
    if a in ["geral", "todas", "all", "none"]:
        return None
    if a in PRESETS:
        return a
    if "human" in a:
        return "ciencias-humanas"
    if "natur" in a:
        return "ciencias-natureza"
    if "matem" in a or a == "mat":
        return "matematica"
    if "ling" in a or "port" in a:
        return "linguagens"
    return a


def load_clean_questions(
    conn,
    area: Optional[str] = None,
    include_images: bool = False
) -> List[Dict[str, Any]]:
    """Carrega as questões da área já limpas, descartando as inaproveitáveis."""
    usable: List[Dict[str, Any]] = []
    for q in get_questions_by_area(conn, area=area, limit=None, shuffle=False):
        cleaned = clean_question(q)
        if validation_errors(cleaned):
            continue
        if cleaned.get("images") and not include_images:
            # O ExamPlayer ainda não renderiza imagens: a questão ficaria sem contexto.
            continue
        usable.append(cleaned)
    return usable


def to_player_question(q: Dict[str, Any]) -> Dict[str, Any]:
    imgs = q.get("images", [])
    orig_area_name = AREA_NAMES.get(q["area"], q["area"].title())
    explanation = f"Origem: ENEM {q['year']} • {orig_area_name} • Questão #{q['original_number']}"
    if q.get("language"):
        explanation += f" ({q['language'].capitalize()})"

    question = {
        "id": q["id"],
        "statement": q["statement"],
        "options": q["options"],
        "correctOption": q["correct_option"],
        "explanation": explanation,
    }
    if imgs:
        question["image"] = imgs[0]
        question["images"] = imgs
    return question


def build_simulado(
    conn,
    area: Optional[str] = None,
    count: int = 45,
    title: Optional[str] = None,
    include_images: bool = False,
    seed: Optional[int] = None
) -> Dict[str, Any]:
    norm_area = normalize_area_param(area)
    preset = PRESETS.get(norm_area or "geral", {})
    areas: List[str] = preset.get("areas") or ([norm_area] if norm_area else AREAS)
    rng = random.Random(seed)

    selected: List[Dict[str, Any]] = []
    per_area = max(1, count // len(areas))
    for idx, a in enumerate(areas):
        pool = load_clean_questions(conn, area=a, include_images=include_images)
        if not pool:
            continue
        # A última área absorve o resto da divisão
        want = count - per_area * (len(areas) - 1) if idx == len(areas) - 1 else per_area
        selected.extend(rng.sample(pool, min(want, len(pool))))

    if not selected:
        raise ValueError(f"Nenhuma questão aproveitável encontrada para a área '{area}'")

    rng.shuffle(selected)
    selected = selected[:count]

    area_display = preset.get("subject") or (
        AREA_NAMES.get(norm_area, "Geral") if norm_area else "Geral (Todas as Áreas)"
    )
    exam_id = f"simulado-{norm_area or 'geral'}-{uuid.uuid4().hex[:8]}"
    title = title or preset.get("title") or f"Simulado — {area_display} ({len(selected)} Questões)"
    duration = preset.get("duration") or max(10, len(selected) * 3)  # 3 minutos por questão

    return {
        "schema": "bsestudos.exam.v1",
        "id": exam_id,
        "title": title,
        "durationMinutes": duration,
        "subject": area_display,
        "questions": [to_player_question(q) for q in selected],
    }


def write_simulado(simulado: Dict[str, Any], out_path: str) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(simulado, f, ensure_ascii=False, indent=2)
    print(f"[ok] {simulado['title']} - {len(simulado['questions'])} questoes, "
          f"{simulado['durationMinutes']} min -> {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Gerador de simulados do ENEM a partir das questões extraídas")
    parser.add_argument("--area", type=str, default=None,
                        help="Área ou preset (linguagens, ciencias-humanas, ciencias-natureza, matematica, dia1, dia2, geral)")
    parser.add_argument("--count", type=int, default=45, help="Quantidade de questões")
    parser.add_argument("--title", type=str, default=None, help="Título personalizado")
    parser.add_argument("--db", type=str, default="data/enem/enem.db", help="Caminho do banco SQLite")
    parser.add_argument("--out", type=str, default=None, help="Arquivo .bsestudos.exam.json de saída")
    parser.add_argument("--out-dir", type=str, default="data/enem/simulados", help="Pasta de saída")
    parser.add_argument("--include-images", action="store_true",
                        help="Inclui questões que dependem de imagem (o player ainda não as exibe)")
    parser.add_argument("--seed", type=int, default=None, help="Semente para sorteio reproduzível")
    parser.add_argument("--all", action="store_true", help="Gera o conjunto padrão de simulados")

    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"Erro: Banco de dados não encontrado em {args.db}")
        sys.exit(1)

    conn = init_db(args.db)
    try:
        targets = list(PRESETS.keys()) if args.all else [args.area]
        for target in targets:
            preset = PRESETS.get(normalize_area_param(target) or "geral", {})
            count = preset.get("count", args.count) if args.all else args.count
            simulado = build_simulado(
                conn, area=target, count=count,
                title=None if args.all else args.title,
                include_images=args.include_images, seed=args.seed
            )
            out_path = args.out if (args.out and not args.all) else os.path.join(
                args.out_dir,
                f"simulado_{normalize_area_param(target) or 'geral'}_{len(simulado['questions'])}q.bsestudos.exam.json"
            )
            write_simulado(simulado, out_path)
    except Exception as e:
        print(f"Erro ao gerar simulado: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
