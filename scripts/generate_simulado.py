import argparse
import json
import os
import random
import sys
import uuid
from typing import Any, Dict, Optional

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.db import init_db, get_questions_by_area

AREA_NAMES = {
    "linguagens": "Linguagens e Códigos",
    "ciencias-humanas": "Ciências Humanas",
    "ciencias-natureza": "Ciências da Natureza",
    "matematica": "Matemática",
    "geral": "Geral (Misto)"
}

def normalize_area_param(area: Optional[str]) -> Optional[str]:
    if not area:
        return None
    a = area.lower().strip()
    if a in ["geral", "todas", "all", "none"]:
        return None
    if "human" in a:
        return "ciencias-humanas"
    if "natur" in a:
        return "ciencias-natureza"
    if "matem" in a or "mat" == a:
        return "matematica"
    if "ling" in a or "port" in a:
        return "linguagens"
    return a

def build_simulado(
    conn,
    area: Optional[str] = None,
    count: int = 45,
    title: Optional[str] = None
) -> Dict[str, Any]:
    norm_area = normalize_area_param(area)
    questions = get_questions_by_area(conn, area=norm_area, limit=count, shuffle=True)
    
    if not questions:
        raise ValueError(f"Nenhuma questão encontrada para a área '{area}'")
        
    area_display = AREA_NAMES.get(norm_area, "Geral") if norm_area else "Geral (Todas as Áreas)"
    exam_id = f"simulado-{norm_area or 'geral'}-{uuid.uuid4().hex[:8]}"
    
    if not title:
        title = f"Simulado — {area_display} ({len(questions)} Questões)"
        
    duration = max(10, len(questions) * 3) # 3 minutos por questão
    
    player_questions = []
    for q in questions:
        imgs = q.get("images", [])
        first_img = imgs[0] if imgs else None
        
        orig_area_name = AREA_NAMES.get(q["area"], q["area"].title())
        explanation = f"Origem: ENEM {q['year']} • {orig_area_name} • Questão #{q['original_number']}"
        if q.get("language"):
            explanation += f" ({q['language'].capitalize()})"
            
        player_questions.append({
            "id": q["id"],
            "statement": q["statement"],
            "options": q["options"],
            "correctOption": q["correct_option"],
            "image": first_img,
            "images": imgs,
            "explanation": explanation
        })
        
    return {
        "schema": "bsestudos.exam.v1",
        "id": exam_id,
        "title": title,
        "durationMinutes": duration,
        "subject": area_display,
        "questions": player_questions
    }

def main():
    parser = argparse.ArgumentParser(description="Gerador dinâmico de simulados do ENEM por temática")
    parser.add_argument("--area", type=str, default=None, help="Área (linguagens, humanas, natureza, matematica, geral)")
    parser.add_argument("--count", type=int, default=45, help="Quantidade de questões")
    parser.add_argument("--title", type=str, default=None, help="Título personalizado")
    parser.add_argument("--db", type=str, default="data/enem/enem.db", help="Caminho do banco SQLite")
    parser.add_argument("--out", type=str, default=None, help="Caminho do arquivo .bsestudos.exam.json de saída")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.db):
        print(f"Erro: Banco de dados não encontrado em {args.db}")
        sys.exit(1)
        
    conn = init_db(args.db)
    try:
        simulado = build_simulado(conn, area=args.area, count=args.count, title=args.title)
        
        out_path = args.out
        if not out_path:
            os.makedirs("data/enem/simulados", exist_ok=True)
            norm_a = normalize_area_param(args.area) or "geral"
            out_path = os.path.join("data/enem/simulados", f"simulado_{norm_a}_{len(simulado['questions'])}q.bsestudos.exam.json")
            
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(simulado, f, ensure_ascii=False, indent=2)
            
        print(f"Simulado gerado com sucesso!")
        print(f"Título: {simulado['title']}")
        print(f"Questões: {len(simulado['questions'])}")
        print(f"Duração: {simulado['durationMinutes']} minutos")
        print(f"Arquivo: {out_path}")
    except Exception as e:
        print(f"Erro ao gerar simulado: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
