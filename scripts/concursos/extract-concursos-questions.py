#!/usr/bin/env python3
"""
scripts/concursos/extract-concursos-questions.py

Extrai detalhadamente todas as questões válidas das provas de concursos:
- Língua Portuguesa
- Raciocínio Lógico e Matemático (RLM)
- Noções de Informática
- Conhecimentos Pedagógicos / Didática
- Políticas Públicas de Saúde / SUS
- Conhecimentos Gerais e Atualidades (não municipais)
- Direito Constitucional e Administrativo geral
- Conhecimentos Específicos (Psicólogo, Nutricionista, Educador Físico)

FILTRO MUNICIPAL ATIVO:
Ignora automaticamente questões e seções voltadas exclusivamente à Legislação Municipal
(Lei Orgânica Municipal, Regime Jurídico Único dos Servidores Municipais, História local).

Pareia cada questão com o gabarito oficial e salva em docs/sources/concursos/extracted-questions-sul.json.
"""

import os
import sys
import json
import re
import fitz  # PyMuPDF

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
MANIFEST_PATH = os.path.join(ROOT_DIR, 'docs/sources/concursos/manifest-concursos-sul.json')
OUTPUT_PATH = os.path.join(ROOT_DIR, 'docs/sources/concursos/extracted-questions-sul.json')

# Padrões de início de seções disciplinares
SECTION_PATTERNS = [
    ('Língua Portuguesa', re.compile(r'(?:^|\n)\s*(?:--\s*)?(?:L[ÍI]NGUA\s+PORTUGUESA|PORTUGU[ÊE]S|úueua\s+PoRTUGUESA|úucua\s+PoRTUGUESA|úrueue\s+PoRTUGUEsA)(?:\s*--)?\s*(?:\n|$)', re.I)),
    ('Raciocínio Lógico e Matemático', re.compile(r'(?:^|\n)\s*(?:--\s*)?(?:RACIOC[ÍI]NIO\s+L[ÓO]GICO(?:\s+E\s+MATEM[ÁA]TICO)?|MATEM[ÁA]TICA(?:\s+E\s+RACIOC[ÍI]NIO\s+L[ÓO]GICO)?)(?:\s*--)?\s*(?:\n|$)', re.I)),
    ('Noções de Informática', re.compile(r'(?:^|\n)\s*(?:--\s*)?(?:NO[ÇC][ÕO]ES\s+DE\s+INFORM[ÁA]TICA|INFORM[ÁA]TICA(?:\s+B[ÁA]SICA)?)(?:\s*--)?\s*(?:\n|$)', re.I)),
    ('Legislação Municipal', re.compile(r'(?:^|\n)\s*(?:--\s*)?(?:LEGISLA[ÇC][ÃA]O\s+MUNICIPAL|REGIME\s+JUR[ÍI]DICO\s+MUNICIPAL|LEI\s+ORG[ÂA]NICA|HIST[ÓO]RIA\s+(?:E\s+GEOGRAFIA\s+)?DO\s+MUNIC[ÍI]PIO)(?:\s*--)?\s*(?:\n|$)', re.I)),
    ('Legislação e Direito', re.compile(r'(?:^|\n)\s*(?:--\s*)?(?:LEGISLA[ÇC][ÃA]O(?:\s+E\s+DIREITO\s+ADMINISTRATIVO|\s+APLICADA|\s+B[ÁA]SICA)?|DIREITO\s+ADMINISTRATIVO|DIREITO\s+CONSTITUCIONAL|ADMINISTRA[ÇC][ÃA]O\s+P[ÚU]BLICA)(?:\s*--)?\s*(?:\n|$)', re.I)),
    ('Conhecimentos Pedagógicos', re.compile(r'(?:^|\n)\s*(?:--\s*)?(?:CONHECIMENTOS\s+PEDAG[ÓO]GICOS|DID[ÁA]TICA|FUNDAMENTOS\s+DA\s+EDUCA[ÇC][ÃA]O)(?:\s*--)?\s*(?:\n|$)', re.I)),
    ('Políticas de Saúde / SUS', re.compile(r'(?:^|\n)\s*(?:--\s*)?(?:SA[ÚU]DE\s+P[ÚU]BLICA|SISTEMA\s+[ÚU]NICO\s+DE\s+SA[ÚU]DE|POL[ÍI]TICAS\s+DE\s+SA[ÚU]DE|LEGISLA[ÇC][ÃA]O\s+DO\s+SUS)(?:\s*--)?\s*(?:\n|$)', re.I)),
    ('Conhecimentos Gerais e Atualidades', re.compile(r'(?:^|\n)\s*(?:--\s*)?(?:CONHECIMENTOS\s+GERAIS(?:\s+E\s+ATUALIDADES)?|ATUALIDADES)(?:\s*--)?\s*(?:\n|$)', re.I)),
    ('Conhecimentos Específicos', re.compile(r'(?:^|\n)\s*(?:--\s*)?(?:CON[H\s]*E[C\w]{1,4}MENTOS?\s+ESPE[C\w]{1,4}FICOS?|CON\s*HECIMENTOS?\s+ESPEC[ÍI]FICOS?|PROVA\s+ESPEC[ÍI]FICA|PARTE\s+ESPEC[ÍI]FICA)(?:\s*--)?\s*(?:\n|$)', re.I)),
]

# Conteúdos estritamente municipais a serem descartados
MUNICIPAL_CONTENT_REGEX = re.compile(
    r'(\bLEI\s+ORG[ÂA]NICA\b'
    r'|\bREGIME\s+JUR[ÍI]DICO\b.*?\bMUNICIP'
    r'|\bESTATUTO\b.*?\bMUNICIP'
    r'|\bLEGISLA[ÇC][ÃA]O\s+MUNICIPAL\b'
    r'|\bPLANO\s+DIRETOR\b'
    r'|\bC[ÂA]MARA\s+MUNICIPAL\b'
    r'|\bMUNIC[ÍI]PIO\s+DE\b'
    r'|\bEMANCIPA[ÇC][ÃA]O\s+POL[ÍI]TICO[- ]ADMINISTRATIVA\b'
    r'|\bHIST[ÓO]RIA\s+DO\s+MUNIC[ÍI]PIO\b)',
    re.IGNORECASE
)

QUESTION_SPLIT_REGEX = re.compile(
    r'\n(?=(?:QUEST[ÃA]O\s+\d+|\b\d{1,2}\s*[-–—.:)]|\b\d{2}\b\s*\n))',
    re.IGNORECASE
)

def clean_text(t):
    if not t:
        return ""
    t = t.replace('\x00', '')
    t = re.sub(r'pcimarkpci[^\n]+', '', t)
    t = re.sub(r'www\.pciconcursos\.com\.br', '', t)
    t = re.sub(r'[\r\n]+', '\n', t)
    return t.strip()

def parse_gabarito_file(gab_path, cargo_keyword=""):
    if not gab_path or not os.path.exists(gab_path):
        return {}

    answers = {}
    try:
        doc = fitz.open(gab_path)
        full_text = ""
        target_page_text = ""

        for p in doc:
            p_text = p.get_text()
            full_text += p_text + "\n"
            if cargo_keyword and cargo_keyword.lower() in p_text.lower():
                target_page_text += p_text + "\n"

        text_to_parse = target_page_text if target_page_text else full_text

        # 1. Padrão "31 - A" ou "31. B" ou "31: C" ou "31 A"
        for m in re.finditer(r'(?:QUEST[ÃA]O\s+)?(\d+)\s*[-–—.:\t\s]\s*([A-E]|\*|X|ANULADA)\b', text_to_parse, re.IGNORECASE):
            q_num = int(m.group(1))
            val = m.group(2).upper()
            answers[q_num] = "ANULADA" if val in ["*", "X", "ANULADA"] else val

        # 2. Padrão tabela vertical/colunas (ex: FGV / Cebraspe / FEPESE)
        if len(answers) < 10:
            words = []
            for p in doc:
                words.extend(p.get_text("words"))
            for i, w in enumerate(words):
                if w[4].isdigit() and 1 <= int(w[4]) <= 120:
                    q_num = int(w[4])
                    if q_num not in answers:
                        for w2 in words:
                            if w2[4] in ["A", "B", "C", "D", "E", "*", "X"] and abs(w2[0] - w[0]) < 15 and 6 < (w2[1] - w[1]) < 45:
                                answers[q_num] = "ANULADA" if w2[4] in ["*", "X"] else w2[4]
                                break

    except Exception as e:
        print(f"  Erro ao processar gabarito {gab_path}: {e}")

    return answers

def extract_all_questions_from_prova(prova_path, gab_path, metadata):
    if not os.path.exists(prova_path):
        return [], 0

    questions = []
    skipped_municipal = 0

    try:
        doc = fitz.open(prova_path)
        full_text = ""
        for p in doc:
            full_text += p.get_text() + "\n"

        # Encontra todas as marcações de seções
        all_matches = []
        for sec_name, pat in SECTION_PATTERNS:
            for m in pat.finditer(full_text):
                all_matches.append((m.start(), m.end(), sec_name))

        all_matches.sort(key=lambda x: x[0])

        # Se nenhuma seção foi reconhecida, assume Conhecimentos Específicos como fallback
        if not all_matches:
            all_matches = [(0, 0, "Conhecimentos Específicos")]

        # Filtra ocorrências da capa (que não têm questões antes do próximo match)
        filtered_sections = []
        for i, (start, end, name) in enumerate(all_matches):
            next_pos = all_matches[i+1][0] if i+1 < len(all_matches) else len(full_text)
            sec_chunk = full_text[end:next_pos]
            blocks = QUESTION_SPLIT_REGEX.split(sec_chunk)
            if len(blocks) > 1 or i == len(all_matches) - 1:
                filtered_sections.append((start, end, name, sec_chunk))

        answers_dict = parse_gabarito_file(gab_path, metadata.get("cargo_base", ""))
        seen_q_nums = set()

        for start, end, sec_name, chunk in filtered_sections:
            # Seção inteira de legislação municipal é descartada
            if sec_name == 'Legislação Municipal':
                blocks_count = len(QUESTION_SPLIT_REGEX.split(chunk)) - 1
                skipped_municipal += max(0, blocks_count)
                continue

            blocks = QUESTION_SPLIT_REGEX.split(chunk)

            for b in blocks:
                b_clean = clean_text(b)
                m_num = re.match(r'^(?:QUEST[ÃA]O\s+)?(\d+)\s*[-–—.:)]?\s*\n*(.*)', b_clean, re.DOTALL | re.IGNORECASE)
                if not m_num:
                    continue

                q_num = int(m_num.group(1))
                if q_num in seen_q_nums:
                    continue

                # FILTRO MUNICIPAL: verifica se a questão é de legislação do município
                if MUNICIPAL_CONTENT_REGEX.search(b_clean):
                    skipped_municipal += 1
                    continue

                body = m_num.group(2).strip()

                # Extrai alternativas:
                # 1. Padrão A) ... E) ou (A) ... (E) ou a. ... e.
                alt_pattern = r'\n(?:\()?([A-Ea-e])(?:\)|\.-|\.\s*(?:SQUARE|Check-square)?)\s*'
                alt_matches = list(re.finditer(alt_pattern, body))

                if len(alt_matches) < 4:
                    # 2. Padrão de início de linha com ponto
                    alt_pattern_fallback = r'(?:^|\n)\s*([A-Ea-e])\.\s*(?:SQUARE|Check-square)?\s*'
                    alt_matches = list(re.finditer(alt_pattern_fallback, body))

                if len(alt_matches) < 4:
                    # 3. Padrão Cebraspe (A Dança... B Luta...)
                    alt_pattern_cebraspe = r'\n\s*([A-E])\s+(?=[A-Za-zÀ-ÿ0-9"“\'‘])'
                    alt_matches = list(re.finditer(alt_pattern_cebraspe, body))

                if len(alt_matches) >= 4:
                    enunciado = body[:alt_matches[0].start()].strip()
                    alternativas = {}
                    for idx in range(len(alt_matches)):
                        letter = alt_matches[idx].group(1).upper()
                        start_alt = alt_matches[idx].end()
                        end_alt = alt_matches[idx+1].start() if idx + 1 < len(alt_matches) else len(body)
                        alt_text = body[start_alt:end_alt].strip()
                        alt_text = re.sub(r'^(?:SQUARE|Check-square)\s*', '', alt_text).strip()
                        alternativas[letter] = alt_text

                    seen_q_nums.add(q_num)
                    q_id = f"CONC-{metadata['uf']}-{metadata['slug']}-Q{q_num}"
                    questions.append({
                        "id": q_id,
                        "estado": metadata.get("uf"),
                        "ano": metadata.get("ano"),
                        "orgao": metadata.get("orgao"),
                        "banca": metadata.get("banca"),
                        "cargo_alvo": metadata.get("cargo_base"),
                        "titulo_prova": metadata.get("titulo_prova"),
                        "disciplina": sec_name,
                        "numero_questao": q_num,
                        "enunciado": enunciado,
                        "alternativas": alternativas,
                        "gabarito_oficial": answers_dict.get(q_num, "N/A")
                    })

    except Exception as e:
        print(f"  Erro na extração de {prova_path}: {e}")

    return questions, skipped_municipal

def run_full_extraction():
    if not os.path.exists(MANIFEST_PATH):
        print(f"Erro: manifesto não encontrado em {MANIFEST_PATH}")
        return

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    all_questions = []
    processed_exams = 0
    total_skipped_mun = 0
    stats_by_discipline = {}

    print("Iniciando extração abrangente multi-disciplinar (com filtro municipal)...")

    for item in manifest:
        if item.get("status_download") != "downloaded" or not item.get("prova_pdf"):
            continue

        prova_full_path = os.path.join(ROOT_DIR, item["prova_pdf"])
        gab_full_path = os.path.join(ROOT_DIR, item["gabarito_pdf"]) if item.get("gabarito_pdf") else None

        print(f"\nProcessando: {item['cargo_base']} - {item['orgao']} ({item['uf']} / {item['ano']} - {item['banca']})")
        q_list, mun_skipped = extract_all_questions_from_prova(prova_full_path, gab_full_path, item)
        print(f"  -> {len(q_list)} questões extraídas ({mun_skipped} descartadas por serem legislação municipal)")

        for q in q_list:
            d = q["disciplina"]
            stats_by_discipline[d] = stats_by_discipline.get(d, 0) + 1

        all_questions.extend(q_list)
        total_skipped_mun += mun_skipped
        processed_exams += 1

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"\n==========================================")
    print(f"Extração Multi-Disciplinar Concluída!")
    print(f"Total de provas processadas: {processed_exams}")
    print(f"Total de questões extraídas: {len(all_questions)}")
    print(f"Total de questões municipais descartadas pelo filtro: {total_skipped_mun}")
    print(f"\nDistribuição por Disciplina:")
    for disc, count in sorted(stats_by_discipline.items(), key=lambda x: -x[1]):
        print(f"  • {disc}: {count} questões")
    print(f"Arquivo final salvo em: {OUTPUT_PATH}")

if __name__ == "__main__":
    run_full_extraction()
