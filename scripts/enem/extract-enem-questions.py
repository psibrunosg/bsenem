#!/usr/bin/env python3
"""
scripts/enem/extract-enem-questions.py

Extrai o repertório completo das questões do ENEM (2009-2025) a partir dos
34 cadernos de prova e 34 gabaritos locais em content/enem/official-pdfs/.

Requisitos:
- 17 anos (2009-2025), 2 dias por ano = 34 provas e 34 gabaritos.
- Total esperado: 3.060 questões objetivas (90 por prova).
- Preserva enunciado, alternativas (A-E), gabarito pareado, assets visuais e metadados.
- Trata questões de língua estrangeira (Inglês como primário, Espanhol preservado em extra_data).
- Trata questões anuladas e divergências conhecidas (espelho de 2010 com prova em vez de gabarito).
- Não inventa texto, alternativas ou gabarito.
"""

import os
import sys
import json
import re
import hashlib
import fitz  # PyMuPDF
from PIL import Image
import io

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
PDF_ROOT = os.path.join(ROOT_DIR, 'content/enem/official-pdfs')
ASSET_ROOT = os.path.join(ROOT_DIR, 'content/enem/assets')
MANIFEST_PATH = os.path.join(ROOT_DIR, 'docs/sources/enem/manifest-2009-2025.json')
OUTPUT_PATH = os.path.join(ROOT_DIR, 'docs/sources/enem/extracted-questions-2009-2025.json')


def compute_sha256(data):
    if isinstance(data, str):
        data = data.encode('utf-8')
    return hashlib.sha256(data).hexdigest()


def get_exam_area(year, day, question_number):
    """Retorna a área/disciplina oficial da questão conforme o ano e o dia."""
    if year == 2009:
        if day == 1:
            return "Ciências da Natureza e suas Tecnologias" if question_number <= 45 else "Ciências Humanas e suas Tecnologias"
        else:
            return "Linguagens, Códigos e suas Tecnologias" if question_number <= 135 else "Matemática e suas Tecnologias"
    elif 2010 <= year <= 2016:
        if day == 1:
            return "Ciências Humanas e suas Tecnologias" if question_number <= 45 else "Ciências da Natureza e suas Tecnologias"
        else:
            return "Linguagens, Códigos e suas Tecnologias" if question_number <= 135 else "Matemática e suas Tecnologias"
    else:  # 2017 a 2025
        if day == 1:
            return "Linguagens, Códigos e suas Tecnologias" if question_number <= 45 else "Ciências Humanas e suas Tecnologias"
        else:
            return "Ciências da Natureza e suas Tecnologias" if question_number <= 135 else "Matemática e suas Tecnologias"


def parse_gabarito(year, day, gab_relative_path):
    """
    Extrai as respostas do gabarito pareado.
    Retorna (answers_dict, status_string).
    answers_dict mapeia question_number -> 'A'-'E' ou 'ANULADA'
    ou para questões de língua estrangeira -> {'ingles': '...', 'espanhol': '...'}
    """
    abs_path = os.path.join(PDF_ROOT, gab_relative_path)
    if not os.path.exists(abs_path):
        return {}, "gabarito_file_missing"

    doc = fitz.open(abs_path)

    # Caso especial 2010: o espelho Projeto Medicina subiu a prova em vez do gabarito (32 páginas)
    if year == 2010 and len(doc) > 2:
        return {}, "mirror_gabarito_mismatch_prova_duplicate"

    # 2009: 2 páginas com 4 colunas de cadernos (Caderno 2 Amarelo no Dia 1, Caderno 5 Amarelo no Dia 2)
    if year == 2009:
        answers = {}
        target_q_col = (145, 190) if day == 1 else (30, 75)
        target_a_col = (215, 265) if day == 1 else (100, 145)

        for page in doc:
            words = page.get_text("words")
            for w in words:
                val = w[4].strip()
                if (val in ["A", "B", "C", "D", "E", "*"] or val.lower() == "anulado") and target_a_col[0] <= w[0] <= target_a_col[1]:
                    # Encontra o número da questão mais próximo na mesma linha Y
                    best_q = None
                    min_dy = 999
                    for qw in words:
                        if qw[4].isdigit() and target_q_col[0] <= qw[0] <= target_q_col[1]:
                            dy = abs(qw[1] - w[1])
                            if dy < min_dy:
                                min_dy = dy
                                best_q = int(qw[4])
                    if best_q is not None and min_dy < 8:
                        answers[best_q] = "ANULADA" if (val == "*" or val.lower() == "anulado") else val
        return answers, "ok"

    # 2011 a 2025: gabarito de 1 página com tabela
    text = "\n".join(page.get_text() for page in doc)
    # Substitui variações de 'Anulado'
    text = re.sub(r'\bAnulado\b', 'ANULADA', text, flags=re.IGNORECASE)
    text = re.sub(r'\bSem Gabarito\b', 'ANULADA', text, flags=re.IGNORECASE)
    text = re.sub(r'\b\*\b', 'ANULADA', text)

    tokens = text.split()
    answers = {}
    i = 0
    foreign_range = range(91, 96) if 2011 <= year <= 2016 and day == 2 else (range(1, 6) if year >= 2017 and day == 1 else range(0))

    while i < len(tokens):
        tok = tokens[i]
        if tok.isdigit():
            q_num = int(tok)
            if (day == 1 and 1 <= q_num <= 90) or (day == 2 and 91 <= q_num <= 180):
                if i + 1 < len(tokens):
                    nxt1 = tokens[i + 1]
                    if nxt1 in ["A", "B", "C", "D", "E", "ANULADA"]:
                        if q_num in foreign_range and i + 2 < len(tokens) and tokens[i + 2] in ["A", "B", "C", "D", "E", "ANULADA"]:
                            # Inglês e Espanhol
                            answers[q_num] = {
                                "ingles": nxt1,
                                "espanhol": tokens[i + 2]
                            }
                            i += 3
                            continue
                        else:
                            answers[q_num] = nxt1
                            i += 2
                            continue
        i += 1

    return answers, "ok"


def extract_caderno_questions(year, day, prova_entry, gab_answers, gab_status):
    """
    Extrai todas as questões do caderno de prova.
    """
    prova_path = os.path.join(PDF_ROOT, prova_entry['relativePath'])
    if not os.path.exists(prova_path):
        return [], [f"Arquivo de prova não encontrado: {prova_path}"]

    doc = fitz.open(prova_path)
    issues = []
    questions = []

    # Determina faixa de numeração esperada
    min_q = 1 if day == 1 else 91
    max_q = 90 if day == 1 else 180
    foreign_range = range(91, 96) if 2010 <= year <= 2016 and day == 2 else (range(1, 6) if year >= 2017 and day == 1 else range(0))

    # Pasta de assets para esta prova
    asset_dir = os.path.join(ASSET_ROOT, str(year), f"dia-{day}")
    os.makedirs(asset_dir, exist_ok=True)

    # 1. Mapear todas as ocorrências de QUESTÃO <N>
    # Cada item: (q_num, is_spanish, page_idx, col_idx, rect, block_idx)
    raw_headings = []
    
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        p_width = page.rect.width
        p_height = page.rect.height
        mid_x = p_width / 2.0

        # Identifica se a página está na seção de Espanhol
        page_text = page.get_text()
        # Se contiver 'opção espanhol' ou 'espanhol'
        blocks = page.get_text("blocks")

        for b_idx, b in enumerate(blocks):
            x0, y0, x1, y1, text, b_no, b_type = b
            # Ignora cabeçalhos e rodapés gerais se não for marcador de questão
            is_q = bool(re.search(r'(?:QUEST[ÃA]O|Quest[ãa]o)\s*(\d{1,3})', text))
            if not is_q and (y1 < 30 or y0 > p_height - 35):
                continue

            # Procura marcador QUESTÃO <N>
            m = re.search(r'(?:QUEST[ÃA]O|Quest[ãa]o)\s*(\d{1,3})', text)
            if m:
                q_num = int(m.group(1))
                if min_q <= q_num <= max_q:
                    col = 0 if x0 < mid_x else 1
                    # Verifica se é espanhol
                    raw_headings.append({
                        'q_num': q_num,
                        'page': page_idx,
                        'col': col,
                        'rect': fitz.Rect(x0, y0, x1, y1),
                        'block_idx': b_idx,
                        'text': text
                    })

    # Classifica língua estrangeira (primeira passada: inglês, segunda passada: espanhol)
    seen_counts = {}
    headings = []
    for h in raw_headings:
        qn = h['q_num']
        count = seen_counts.get(qn, 0) + 1
        seen_counts[qn] = count
        is_spanish = (qn in foreign_range and count > 1)
        h['is_spanish'] = is_spanish
        headings.append(h)

    # Agrupa por número de questão
    # Para 1..90 (ou 91..180):
    for qn in range(min_q, max_q + 1):
        q_headings = [h for h in headings if h['q_num'] == qn]
        if not q_headings:
            issues.append(f"Ano {year} Dia {day}: Questão {qn} não encontrada no PDF.")
            # Cria registro pending
            questions.append(create_missing_question(year, day, qn, prova_entry, gab_status))
            continue

        primary_h = [h for h in q_headings if not h['is_spanish']][0]
        spanish_h = [h for h in q_headings if h['is_spanish']]
        spanish_h = spanish_h[0] if spanish_h else None

        # Extrai conteúdo da questão primária (Inglês ou padrão)
        q_data = extract_single_question_content(doc, primary_h, headings, year, day, qn, asset_dir, prova_entry, gab_answers, is_spanish=False)

        # Se houver variante de Espanhol, extrai e coloca em extra_data
        if spanish_h:
            sp_data = extract_single_question_content(doc, spanish_h, headings, year, day, qn, asset_dir, prova_entry, gab_answers, is_spanish=True)
            q_data['extra_data'] = {'spanish': sp_data}

        # Validação final do item
        validate_and_finalize_question(q_data, gab_status, issues)
        questions.append(q_data)

    return questions, issues


def extract_single_question_content(doc, h, all_headings, year, day, qn, asset_dir, prova_entry, gab_answers, is_spanish=False):
    """
    Extrai enunciado, alternativas e imagens para um heading específico.
    """
    page_idx = h['page']
    page = doc[page_idx]
    p_width = page.rect.width
    p_height = page.rect.height
    mid_x = p_width / 2.0
    col = h['col']

    # Determina o final da questão: próximo heading na mesma coluna/página ou final da coluna
    next_h = None
    curr_idx = all_headings.index(h)
    if curr_idx + 1 < len(all_headings):
        next_h = all_headings[curr_idx + 1]

    # Coleta blocos de texto pertencentes a esta questão
    # Se a questão continuar na próxima página/coluna:
    # Verificamos blocos a partir de h['rect'].y0
    blocks_text = []
    question_pages = [page_idx + 1]
    
    # Delimitador inferior no mesmo layout (rodapé começa a ~22pt da borda inferior)
    y_bottom_limit = p_height - 22
    if next_h and next_h['page'] == page_idx and next_h['col'] == col:
        y_bottom_limit = next_h['rect'].y0

    # Limites X da coluna
    x_min = 0 if col == 0 else mid_x - 15
    x_max = mid_x + 15 if col == 0 else p_width

    q_rect = fitz.Rect(x_min, h['rect'].y0, x_max, y_bottom_limit)

    # Extrai blocos de texto contidos na região
    for b in page.get_text("blocks"):
        bx0, by0, bx1, by1, btext, bno, btype = b
        # Ignora cabeçalhos, rodapés e barras de código
        if by1 < 30 or by0 > p_height - 20:
            continue
        if re.search(r'\*\d+[A-Z0-9]+\*', btext) or ('ENEM20' in btext.replace(' ', '') and by1 < 65):
            continue
        # Verifica se está dentro da coluna e do intervalo vertical (antes do próximo heading)
        if (by0 >= h['rect'].y0 - 2 and by0 < y_bottom_limit - 1) and (bx0 >= x_min - 25 and bx1 <= x_max + 25):
            # Se for linha de rodapé na base
            if by0 > p_height - 25 and re.search(r'CADERNO|ENEM|P[AÁ]GINA', btext, re.IGNORECASE):
                continue
            blocks_text.append((by0, bx0, btext))

    # Ordena blocos por y
    blocks_text.sort(key=lambda x: (x[0], x[1]))
    full_raw_text = "\n".join(b[2] for b in blocks_text)

    # Remove o marcador inicial QUESTÃO <N>
    full_text = re.sub(r'^(?:[^\n]*\n)?(?:QUEST[ÃA]O|Quest[ãa]o)\s*\d{1,3}[\t\s]*\n?', '', full_raw_text, count=1).strip()

    # Separa alternativas A, B, C, D, E
    statement, options = parse_alternatives(full_text, page, q_rect, asset_dir, year, day, qn, is_spanish)

    # Extrai imagens da questão
    images = extract_question_images(page, q_rect, asset_dir, year, day, qn, is_spanish)

    # Determina gabarito
    gab_val = gab_answers.get(qn)
    if isinstance(gab_val, dict):
        correct_option = gab_val.get('espanhol' if is_spanish else 'ingles')
    else:
        correct_option = gab_val

    # Cria identificador e hash de rastreabilidade
    content_payload = f"{year}|{day}|{qn}|{statement}|{'|'.join(options)}|{is_spanish}"
    content_hash = compute_sha256(content_payload)

    area = get_exam_area(year, day, qn)

    lang_opt = "espanhol" if is_spanish else ("ingles" if (qn in range(1, 6) and year >= 2017) or (qn in range(91, 96) and 2010 <= year <= 2016) else None)

    return {
        'year': year,
        'day': day,
        'question_number': qn,
        'area': area,
        'statement': statement,
        'option_a': options[0],
        'option_b': options[1],
        'option_c': options[2],
        'option_d': options[3],
        'option_e': options[4],
        'correct_option': correct_option,
        'status': 'valid',
        'pending_reason': None,
        'source_pdf': prova_entry['relativePath'],
        'source_page': page_idx + 1,
        'source_pages': question_pages,
        'content_hash': content_hash,
        'inep_url': prova_entry['officialUrl'],
        'mirror_url': prova_entry.get('mirrorUrl', prova_entry.get('downloadedFromUrl', '')),
        'images': images,
        'foreign_language_option': lang_opt,
        'extra_data': None
    }


def parse_alternatives(text, page, q_rect, asset_dir, year, day, qn, is_spanish):
    """
    Separa o enunciado e as alternativas A, B, C, D e E com algoritmo de sequência estrita.
    """
    matches = list(re.finditer(r'(?:^|\n)\s*(?:[\(\[]?)([A-E])(?:[\)\]\.\-\t\s]+)', text))

    # Procuramos uma sequência de 5 matches com letras A -> B -> C -> D -> E
    for i in range(len(matches)):
        if matches[i].group(1) == 'A':
            seq = [matches[i]]
            expected = ['B', 'C', 'D', 'E']
            curr_idx = i + 1
            for exp in expected:
                found_next = None
                while curr_idx < len(matches):
                    if matches[curr_idx].group(1) == exp:
                        found_next = matches[curr_idx]
                        curr_idx += 1
                        break
                    elif matches[curr_idx].group(1) == 'A':
                        # Outro 'A' antes de completar a sequência -> o anterior era falso positivo
                        break
                    curr_idx += 1
                if found_next:
                    seq.append(found_next)
                else:
                    break

            if len(seq) == 5:
                statement = text[:seq[0].start()].strip()
                opts = []
                for k in range(4):
                    opts.append(text[seq[k].end():seq[k+1].start()].strip())
                last_opt = text[seq[4].end():].strip()
                last_opt = re.split(r'(?:quest[aã]o|quest\b)\s*\d{1,3}', last_opt, flags=re.IGNORECASE)[0].strip()
                opts.append(last_opt)
                return statement, opts

    # Se não encontrou sequência pura, retorna statement completo e vazios
    return text.strip(), ["", "", "", "", ""]


def extract_question_images(page, q_rect, asset_dir, year, day, qn, is_spanish):
    """
    Detecta e extrai imagens raster ou gráficos vetoriais presentes dentro da região da questão.
    Salva cada imagem como PNG em content/enem/assets/<ano>/dia-<dia>/...
    Retorna lista de caminhos relativos: assets/<ano>/dia-<dia>/q<num>_<idx>.png
    """
    images_saved = []
    prefix = f"q{qn}{'_es' if is_spanish else ''}"

    # 1. Imagens raster embutidas no PDF
    raster_imgs = page.get_images(full=True)
    img_idx = 1

    for img_info in raster_imgs:
        xref = img_info[0]
        # Bounding boxes onde a imagem aparece na página
        rects = page.get_image_rects(xref)
        for r in rects:
            # Verifica se está contida ou tem interseção significativa com q_rect
            intersect = r & q_rect
            if not intersect.is_empty and intersect.height > 15 and intersect.width > 15:
                # Ignora linhas verticais decorativas ou tarjas de página inteira
                if r.height > 600 or r.width < 10 or r.height < 10:
                    continue
                # Se a interseção for quase a imagem toda:
                base_img = page.parent.extract_image(xref)
                img_bytes = base_img["image"]
                ext = base_img["ext"]
                
                # Salva imagem oficial
                filename = f"{prefix}_{img_idx}.png"
                rel_path = f"assets/{year}/dia-{day}/{filename}"
                abs_path = os.path.join(asset_dir, filename)

                if not os.path.exists(abs_path):
                    # Converte para PNG uniforme
                    try:
                        im = Image.open(io.BytesIO(img_bytes))
                        im.save(abs_path, format="PNG", optimize=True)
                    except Exception:
                        with open(abs_path, "wb") as f:
                            f.write(img_bytes)

                if rel_path not in images_saved:
                    images_saved.append(rel_path)
                    img_idx += 1

    # 2. Desenhos / Vetores / Gráficos que não são imagens raster
    # Se não houver raster ou se houver desenhos vetoriais na região (ex: fórmulas, geometria, circuitos, tabelas)
    drawings = page.get_drawings()
    vector_rects = []
    for d in drawings:
        dr = d['rect']
        if (dr & q_rect).is_empty:
            continue
        # Ignora desenhos fora dos limites do documento ou que englobam a página inteira
        if dr.x0 < -5 or dr.y0 < -5 or dr.x1 > page.rect.width + 5 or dr.y1 > page.rect.height + 5:
            continue
        if dr.width > q_rect.width * 1.05 or dr.height > q_rect.height * 0.85:
            continue
        # Ignora barra horizontal preta decorativa de QUESTÃO <N>
        if dr.y0 <= q_rect.y0 + 15 and dr.height < 10:
            continue
        # Ignora linhas decorativas isoladas
        if dr.height < 3 and dr.width > 200:
            continue
        if dr.width < 3 and dr.height > 200:
            continue
        if dr.height >= 10 and dr.width >= 10:
            vector_rects.append(dr)

    # Se houver agrupamento significativo de desenhos vetoriais e poucas ou nenhuma imagem raster
    if vector_rects and len(images_saved) == 0:
        # Une as caixas de desenhos próximos para formar uma figura única
        combined_rect = vector_rects[0]
        for vr in vector_rects[1:]:
            combined_rect = combined_rect | vr

        # Garante margem de segurança de 4pt
        clip_rect = fitz.Rect(
            max(q_rect.x0, combined_rect.x0 - 4),
            max(q_rect.y0, combined_rect.y0 - 4),
            min(q_rect.x1, combined_rect.x1 + 4),
            min(q_rect.y1, combined_rect.y1 + 4)
        )

        if clip_rect.width > 25 and clip_rect.height > 25 and clip_rect.height < q_rect.height * 0.85:
            pix = page.get_pixmap(clip=clip_rect, dpi=200)
            filename = f"{prefix}_fig{img_idx}.png"
            rel_path = f"assets/{year}/dia-{day}/{filename}"
            abs_path = os.path.join(asset_dir, filename)
            pix.save(abs_path)
            if rel_path not in images_saved:
                images_saved.append(rel_path)

    return images_saved


def create_missing_question(year, day, qn, prova_entry, gab_status):
    area = get_exam_area(year, day, qn)
    return {
        'year': year,
        'day': day,
        'question_number': qn,
        'area': area,
        'statement': f"Questão {qn} (não localizada no caderno)",
        'option_a': "",
        'option_b': "",
        'option_c': "",
        'option_d': "",
        'option_e': "",
        'correct_option': None,
        'status': 'pending',
        'pending_reason': 'question_not_found_in_pdf',
        'source_pdf': prova_entry['relativePath'],
        'source_page': 1,
        'source_pages': [1],
        'content_hash': compute_sha256(f"{year}|{day}|{qn}|missing"),
        'inep_url': prova_entry['officialUrl'],
        'mirror_url': prova_entry.get('mirrorUrl', prova_entry.get('downloadedFromUrl', '')),
        'images': [],
        'foreign_language_option': None,
        'extra_data': None
    }


def validate_and_finalize_question(q_data, gab_status, issues):
    """
    Aplica as regras de auditoria e conformidade de qualidade.
    """
    reasons = []

    # 1. Validação de gabarito
    if gab_status == "mirror_gabarito_mismatch_prova_duplicate":
        reasons.append("mirror_gabarito_mismatch_prova_duplicate")
    elif not q_data['correct_option']:
        reasons.append("unpaired_official_gabarito")

    # 2. Validação de enunciado
    if not q_data['statement'] or len(q_data['statement'].strip()) < 5:
        reasons.append("empty_or_poor_statement")

    # 3. Validação de alternativas
    options = [q_data['option_a'], q_data['option_b'], q_data['option_c'], q_data['option_d'], q_data['option_e']]
    if any(not opt or len(opt.strip()) == 0 for opt in options):
        if q_data['images']:
            reasons.append("pictorial_options_pending_crop_integration")
        else:
            reasons.append("incomplete_alternatives_no_images")

    if reasons:
        q_data['status'] = 'pending'
        q_data['pending_reason'] = "; ".join(reasons)
    else:
        q_data['status'] = 'valid'
        q_data['pending_reason'] = None


def main():
    print("=== Iniciando Extração do Repertório ENEM 2009-2025 ===")
    
    with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    provas = {(e['year'], e['day']): e for e in manifest['entries'] if e['documentKind'] == 'prova'}
    gabaritos = {(e['year'], e['day']): e for e in manifest['entries'] if e['documentKind'] == 'gabarito'}

    all_questions = []
    all_issues = []
    stats_by_year = {}

    total_cadernos = len(provas)
    total_gabaritos = len(gabaritos)
    print(f"Total de cadernos mapeados: {total_cadernos}, gabaritos: {total_gabaritos}")

    for year in range(2009, 2026):
        stats_by_year[year] = {'questions': 0, 'valid': 0, 'pending': 0, 'images': 0}
        for day in [1, 2]:
            p_entry = provas.get((year, day))
            g_entry = gabaritos.get((year, day))

            if not p_entry or not g_entry:
                all_issues.append(f"Faltando par para ano {year}, dia {day}")
                continue

            # Extrai gabarito
            gab_answers, gab_status = parse_gabarito(year, day, g_entry['relativePath'])

            # Extrai questões do caderno
            questions, issues = extract_caderno_questions(year, day, p_entry, gab_answers, gab_status)

            all_issues.extend(issues)
            all_questions.extend(questions)

            valid_count = sum(1 for q in questions if q['status'] == 'valid')
            pending_count = sum(1 for q in questions if q['status'] == 'pending')
            img_count = sum(len(q['images']) for q in questions)

            stats_by_year[year]['questions'] += len(questions)
            stats_by_year[year]['valid'] += valid_count
            stats_by_year[year]['pending'] += pending_count
            stats_by_year[year]['images'] += img_count

            print(f"[{year} Dia {day}] Extraídas: {len(questions)} | Válidas: {valid_count} | Pendentes: {pending_count} | Imagens: {img_count} | Gabarito: {gab_status}")

    # Salva JSON intermediário consolidado
    output_data = {
        'schema': 'bsestudos.enem-extraction.v1',
        'generated_at': fitz.get_pdf_now(),
        'total_cadernos': total_cadernos,
        'total_gabaritos': total_gabaritos,
        'total_questions': len(all_questions),
        'stats_by_year': stats_by_year,
        'questions': all_questions,
        'issues': all_issues
    }

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"\nExtração concluída!")
    print(f"Total de questões: {len(all_questions)} (esperado: 3060)")
    print(f"Válidas: {sum(1 for q in all_questions if q['status'] == 'valid')}")
    print(f"Pendentes: {sum(1 for q in all_questions if q['status'] == 'pending')}")
    print(f"Arquivo gerado: {OUTPUT_PATH}")


if __name__ == '__main__':
    main()
