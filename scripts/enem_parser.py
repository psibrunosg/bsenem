import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple
import pymupdf
from scripts.db import insert_question

LETTER_TO_INDEX = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}

def get_question_area(year: int, day: int, number: int) -> str:
    if year >= 2017:
        if day == 1:
            return "linguagens" if number <= 45 else "ciencias-humanas"
        else:
            return "ciencias-natureza" if number <= 135 else "matematica"
    else:
        if day == 1:
            return "ciencias-humanas" if number <= 45 else "ciencias-natureza"
        else:
            return "linguagens" if number <= 135 else "matematica"

def parse_gabarito(pdf_path: str) -> Dict[Any, str]:
    if not os.path.exists(pdf_path):
        return {}
        
    doc = pymupdf.open(pdf_path)
    text = "\n".join(page.get_text() for page in doc)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    
    gabarito: Dict[Any, str] = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.isdigit():
            num = int(line)
            if 1 <= num <= 180:
                val1 = lines[i+1] if i+1 < len(lines) else ""
                val2 = lines[i+2] if i+2 < len(lines) else ""
                
                # Check for Inglês / Espanhol in questions 1 to 5
                if num <= 5 and val1 in ["A", "B", "C", "D", "E", "*"] and val2 in ["A", "B", "C", "D", "E", "*"]:
                    gabarito[f"{num}-ingles"] = val1
                    gabarito[f"{num}-espanhol"] = val2
                    i += 3
                    continue
                elif val1 in ["A", "B", "C", "D", "E", "*"] or "anulado" in val1.lower():
                    gabarito[num] = val1
                    i += 2
                    continue
        i += 1
        
    # Fallback regex if table parsing missed items
    if len(gabarito) < 40:
        matches = re.findall(r"(?:QUEST[AÃ]O\s+)?(\d{1,3})\s+([A-E\*])\b", text, re.IGNORECASE)
        for num_str, letter in matches:
            num = int(num_str)
            if 1 <= num <= 180 and num not in gabarito:
                gabarito[num] = letter.upper()
                
    return gabarito

def split_statement_and_options(raw_text: str) -> Tuple[str, List[str]]:
    # Regex to identify start of alternatives: A, B, C, D, E at beginning of line or preceded by newline
    # Often formatted as: A\t text or A\n text or A text
    lines = raw_text.splitlines()
    
    # Try finding alternative lines
    alt_indices: List[Tuple[str, int]] = []
    current_expected = "A"
    
    for idx, line in enumerate(lines):
        stripped = line.strip()
        # Look for leading A, B, C, D, E
        m = re.match(r"^([A-E])(?:\s+|\t+|$)(.*)", stripped)
        if m and m.group(1) == current_expected:
            alt_indices.append((current_expected, idx))
            if current_expected == "A":
                current_expected = "B"
            elif current_expected == "B":
                current_expected = "C"
            elif current_expected == "C":
                current_expected = "D"
            elif current_expected == "D":
                current_expected = "E"
            elif current_expected == "E":
                break
                
    if len(alt_indices) == 5:
        statement = "\n".join(lines[:alt_indices[0][1]]).strip()
        options = []
        for i in range(5):
            start_line = alt_indices[i][1]
            end_line = alt_indices[i+1][1] if i < 4 else len(lines)
            chunk = "\n".join(lines[start_line:end_line]).strip()
            # Clean leading letter: "A\t", "A ", "A\n", "A\t A\t"
            cleaned = re.sub(r"^[A-E](?:\s+|[\t\n]+)+", "", chunk).strip()
            cleaned = re.sub(r"^[A-E](?:\s+|[\t\n]+)+", "", cleaned).strip()
            options.append(cleaned)
        return statement, options
        
    # Fallback pattern via regex on full text
    alt_pattern = re.compile(r"(?:^|\n)\s*([A-E])(?:\s+|\t+)(.*?)(?=(?:\n\s*[A-E](?:\s+|\t+)|\Z))", re.DOTALL)
    matches = alt_pattern.findall(raw_text)
    if len(matches) >= 5:
        # Take the last 5 if more than 5
        matches_5 = matches[-5:]
        first_match_start = raw_text.find(matches_5[0][1])
        statement = raw_text[:first_match_start].strip()
        statement = re.sub(r"\n\s*[A-E]\s*$", "", statement).strip()
        options = []
        for letter, content in matches_5:
            cleaned = re.sub(r"^[A-E]\s+", "", content.strip()).strip()
            options.append(cleaned)
        return statement, options

    # If alternatives couldn't be cleanly parsed, fallback to 5 dummy/empty options with statement
    return raw_text.strip(), ["Opção A", "Opção B", "Opção C", "Opção D", "Opção E"]

def extract_questions_from_pdf(
    pdf_path: str,
    gabarito: Dict[Any, str],
    year: int,
    day: int,
    output_images_dir: str
) -> List[Dict[str, Any]]:
    if not os.path.exists(pdf_path):
        return []

    doc = pymupdf.open(pdf_path)
    os.makedirs(output_images_dir, exist_ok=True)
    
    questions_data: List[Dict[str, Any]] = []
    
    # State tracking
    current_q_num: Optional[int] = None
    current_lang: Optional[str] = None
    current_blocks: List[str] = []
    current_images: List[str] = []
    
    def finalize_question():
        nonlocal current_q_num, current_lang, current_blocks, current_images
        if current_q_num is None:
            return
            
        full_text = "\n\n".join(current_blocks).strip()
        if not full_text:
            return
            
        statement, options = split_statement_and_options(full_text)
        if not statement:
            statement = f"Questão {current_q_num:02d} — ENEM {year}"
            
        # Get answer from gabarito
        ans_key = f"{current_q_num}-{current_lang}" if current_lang and f"{current_q_num}-{current_lang}" in gabarito else current_q_num
        ans_letter = gabarito.get(ans_key, "A")
        correct_opt = LETTER_TO_INDEX.get(ans_letter, 0)
        
        q_id = f"enem-{year}-d{day}-q{current_q_num:03d}"
        if current_lang:
            q_id += f"-{current_lang}"
            
        area = get_question_area(year, day, current_q_num)
        
        # Ensure exactly 5 non-empty options
        while len(options) < 5:
            options.append(f"Opção {chr(65 + len(options))}")
        options = options[:5]
        for idx in range(5):
            if not options[idx].strip():
                options[idx] = f"Opção {chr(65 + idx)}"
                
        questions_data.append({
            "id": q_id,
            "year": year,
            "day": day,
            "original_number": current_q_num,
            "area": area,
            "statement": statement,
            "images": list(current_images),
            "options": options,
            "correct_option": correct_opt,
            "language": current_lang
        })
        
        current_blocks = []
        current_images = []

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        col_mid = page.rect.width / 2
        
        # Detect language section in header (for questions 1 to 5)
        page_text = page.get_text()
        if "opção espanhol" in page_text.lower() or "opcao espanhol" in page_text.lower():
            current_lang = "espanhol"
        elif "opção inglês" in page_text.lower() or "opcao ingles" in page_text.lower():
            current_lang = "ingles"
        elif current_q_num and current_q_num > 5:
            current_lang = None
            
        # Extract images and their rects on this page
        page_images = []
        for img_info in page.get_images():
            xref = img_info[0]
            rects = page.get_image_rects(xref)
            if rects:
                page_images.append((xref, rects[0]))
                
        # Sort text blocks into Column 1 and Column 2
        raw_blocks = [b for b in page.get_text("blocks") if b[6] == 0 and 45 <= b[1] <= 750]
        col1 = sorted([b for b in raw_blocks if b[0] < col_mid], key=lambda b: b[1])
        col2 = sorted([b for b in raw_blocks if b[0] >= col_mid], key=lambda b: b[1])
        
        columns = [
            (col1, 0, col_mid),
            (col2, col_mid, page.rect.width)
        ]
        
        for col_blocks, col_x0, col_x1 in columns:
            for b in col_blocks:
                b_text = b[4].strip()
                # Check for question header e.g. "QUESTÃO 04" or "QUESTÃO 125"
                q_match = re.search(r"QUEST[AÃ]O\s+(\d{1,3})", b_text, re.IGNORECASE)
                if q_match:
                    num = int(q_match.group(1))
                    if 1 <= num <= 180:
                        finalize_question()
                        current_q_num = num
                        # Strip header from block text
                        clean_block = re.sub(r"QUEST[AÃ]O\s+\d{1,3}\s*", "", b_text, flags=re.IGNORECASE).strip()
                        if clean_block:
                            current_blocks.append(clean_block)
                        continue
                        
                if current_q_num is not None and b_text:
                    current_blocks.append(b_text)
                    
            # Check for images in this column
            if current_q_num is not None:
                for xref, rect in page_images:
                    if col_x0 <= rect.x0 <= col_x1:
                        # Extract and save image
                        img_filename = f"enem_{year}_q{current_q_num:03d}_img{len(current_images)+1}.png"
                        if current_lang:
                            img_filename = f"enem_{year}_q{current_q_num:03d}_{current_lang}_img{len(current_images)+1}.png"
                        img_path = os.path.join(output_images_dir, img_filename)
                        
                        if not os.path.exists(img_path):
                            try:
                                pix = pymupdf.Pixmap(doc, xref)
                                if pix.width < 30 or pix.height < 30:
                                    continue
                                if pix.n >= 5:
                                    pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                                pix.save(img_path)
                            except Exception:
                                continue
                                
                        rel_path = f"data/enem/images/{img_filename}"
                        if rel_path not in current_images:
                            current_images.append(rel_path)

    finalize_question()
    return questions_data

def process_year(year: int, base_pdf_dir: str = "data/enem/pdfs", images_dir: str = "data/enem/images", conn = None) -> int:
    year_dir = os.path.join(base_pdf_dir, str(year))
    d1_prova = os.path.join(year_dir, "d1_prova.pdf")
    d1_gabarito = os.path.join(year_dir, "d1_gabarito.pdf")
    d2_prova = os.path.join(year_dir, "d2_prova.pdf")
    d2_gabarito = os.path.join(year_dir, "d2_gabarito.pdf")
    
    total_saved = 0
    
    # Process Day 1
    if os.path.exists(d1_prova) and os.path.exists(d1_gabarito):
        gb1 = parse_gabarito(d1_gabarito)
        q1 = extract_questions_from_pdf(d1_prova, gb1, year, 1, images_dir)
        print(f"[{year}] Dia 1: {len(q1)} questões extraídas")
        if conn:
            for q in q1:
                insert_question(conn, q)
                total_saved += 1
                
    # Process Day 2
    if os.path.exists(d2_prova) and os.path.exists(d2_gabarito):
        gb2 = parse_gabarito(d2_gabarito)
        q2 = extract_questions_from_pdf(d2_prova, gb2, year, 2, images_dir)
        print(f"[{year}] Dia 2: {len(q2)} questões extraídas")
        if conn:
            for q in q2:
                insert_question(conn, q)
                total_saved += 1
                
    return total_saved
