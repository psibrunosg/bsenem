"""Gera simulados .bsestudos.exam.json a partir da extração oficial do ENEM.

Fonte: docs/sources/enem/extracted-questions-2009-2025.json (2009-2025), onde
cada questão já vem com status 'valid' ou 'pending' e gabarito oficial pareado.
Só entram questões 'valid' com gabarito A-E — questões pendentes e anuladas
ficam de fora.

Os arquivos são escritos em content/enem/, ao lado de content/enem/assets/,
porque o app resolve as imagens a partir do diretório do próprio simulado e
recusa caminhos com "..". Um simulado cuja imagem não exista em disco é
rejeitado inteiro pelo LocalLibraryService, então cada asset é conferido aqui.

    python scripts/enem/generate-simulados.py --all --seed 42
    python scripts/enem/generate-simulados.py --preset matematica --count 20
"""

import argparse
import json
import os
import random
import sys
import uuid
from typing import Any, Dict, List, Optional

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE_PATH = os.path.join(ROOT_DIR, "docs/sources/enem/extracted-questions-2009-2025.json")
OUTPUT_DIR = os.path.join(ROOT_DIR, "content/enem")

LETTER_TO_INDEX = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}
SUPPORTED_IMAGES = {".png", ".webp", ".jpg", ".jpeg"}

# A extração grava o nome oficial completo da área.
AREA_SLUGS = {
    "Linguagens, Códigos e suas Tecnologias": "linguagens",
    "Ciências Humanas e suas Tecnologias": "ciencias-humanas",
    "Ciências da Natureza e suas Tecnologias": "ciencias-natureza",
    "Matemática e suas Tecnologias": "matematica",
}
AREA_NAMES = {
    "linguagens": "Linguagens e Códigos",
    "ciencias-humanas": "Ciências Humanas",
    "ciencias-natureza": "Ciências da Natureza",
    "matematica": "Matemática",
}

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
    "geral": {"areas": list(AREA_NAMES), "count": 45},
}


def assets_are_present(images: List[str]) -> bool:
    for relative in images:
        if os.path.splitext(relative)[1].lower() not in SUPPORTED_IMAGES:
            return False
        if not os.path.isfile(os.path.join(OUTPUT_DIR, relative)):
            return False
    return True


def load_pool(include_images: bool = True) -> Dict[str, List[Dict[str, Any]]]:
    """Agrupa por slug de área as questões que podem virar simulado."""
    with open(SOURCE_PATH, encoding="utf-8") as f:
        data = json.load(f)

    pool: Dict[str, List[Dict[str, Any]]] = {slug: [] for slug in AREA_NAMES}
    for q in data["questions"]:
        if q.get("status") != "valid":
            continue
        if q.get("correct_option") not in LETTER_TO_INDEX:  # descarta ANULADA e vazio
            continue
        slug = AREA_SLUGS.get(q.get("area"))
        if slug is None:
            continue
        images = q.get("images") or []
        if images and not include_images:
            continue
        if images and not assets_are_present(images):
            continue
        pool[slug].append(q)
    return pool


def to_player_question(q: Dict[str, Any]) -> Dict[str, Any]:
    slug = AREA_SLUGS[q["area"]]
    explanation = f"Origem: ENEM {q['year']} • {AREA_NAMES[slug]} • Questão #{q['question_number']}"
    if q.get("foreign_language_option"):
        explanation += f" ({q['foreign_language_option'].capitalize()})"

    question = {
        "id": f"enem-{q['year']}-d{q['day']}-q{q['question_number']:03d}",
        "statement": q["statement"].strip(),
        "options": [q["option_a"], q["option_b"], q["option_c"], q["option_d"], q["option_e"]],
        "correctOption": LETTER_TO_INDEX[q["correct_option"]],
        "explanation": explanation,
    }
    if q.get("images"):
        question["images"] = list(q["images"])
    return question


def build_simulado(
    preset_name: str,
    count: Optional[int] = None,
    title: Optional[str] = None,
    include_images: bool = True,
    seed: Optional[int] = None,
    pool: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> Dict[str, Any]:
    preset = PRESETS[preset_name]
    areas: List[str] = preset["areas"]
    count = count or preset["count"]
    pool = pool if pool is not None else load_pool(include_images)
    rng = random.Random(seed)

    selected: List[Dict[str, Any]] = []
    per_area = max(1, count // len(areas))
    for idx, slug in enumerate(areas):
        available = pool.get(slug, [])
        if not available:
            continue
        want = count - per_area * (len(areas) - 1) if idx == len(areas) - 1 else per_area
        selected.extend(rng.sample(available, min(want, len(available))))

    if not selected:
        raise ValueError(f"Nenhuma questão aproveitável para o preset '{preset_name}'")

    rng.shuffle(selected)
    selected = selected[:count]

    subject = preset.get("subject") or AREA_NAMES.get(areas[0], "Geral (Todas as Áreas)")
    if preset_name == "geral":
        subject = "Geral (Todas as Áreas)"

    return {
        "schema": "bsestudos.exam.v1",
        "id": f"simulado-{preset_name}-{uuid.uuid4().hex[:8]}",
        "title": title or preset.get("title") or f"Simulado — {subject} ({len(selected)} Questões)",
        "durationMinutes": preset.get("duration") or max(10, len(selected) * 3),
        "subject": subject,
        "questions": [to_player_question(q) for q in selected],
    }


def write_simulado(simulado: Dict[str, Any], preset_name: str) -> str:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, f"simulado-{preset_name}-{len(simulado['questions'])}q.bsestudos.exam.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(simulado, f, ensure_ascii=False, indent=2)
    with_images = sum(1 for q in simulado["questions"] if q.get("images"))
    print(f"[ok] {preset_name}: {len(simulado['questions'])} questoes "
          f"({with_images} com imagem), {simulado['durationMinutes']} min -> {os.path.relpath(path, ROOT_DIR)}")
    return path


def main():
    parser = argparse.ArgumentParser(description="Gera simulados do ENEM a partir da extração oficial")
    parser.add_argument("--preset", choices=list(PRESETS), help="Composição a gerar")
    parser.add_argument("--all", action="store_true", help="Gera todos os presets")
    parser.add_argument("--count", type=int, default=None, help="Sobrescreve o nº de questões")
    parser.add_argument("--title", type=str, default=None, help="Título personalizado")
    parser.add_argument("--no-images", action="store_true", help="Só questões sem imagem")
    parser.add_argument("--seed", type=int, default=None, help="Semente para sorteio reproduzível")
    args = parser.parse_args()

    if not args.all and not args.preset:
        parser.error("informe --preset ou --all")

    pool = load_pool(include_images=not args.no_images)
    total = sum(len(v) for v in pool.values())
    print(f"Pool: {total} questões aproveitáveis "
          + ", ".join(f"{slug} {len(qs)}" for slug, qs in pool.items()))

    for preset_name in (list(PRESETS) if args.all else [args.preset]):
        simulado = build_simulado(
            preset_name,
            count=args.count,
            title=None if args.all else args.title,
            seed=args.seed,
            pool=pool,
        )
        write_simulado(simulado, preset_name)


if __name__ == "__main__":
    main()
