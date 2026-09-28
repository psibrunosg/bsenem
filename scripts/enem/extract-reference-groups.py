#!/usr/bin/env python3
import json
import re
import shutil
from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parents[2]
PDF_ROOT = ROOT / "content" / "enem" / "official-pdfs"
ASSET_ROOT = ROOT / "content" / "enem" / "reference-assets"
OUTPUT = ROOT / "content" / "enem" / "reference-groups.json"

LABEL = re.compile(
    r"(?i)(texto|textos|figura|imagem|gráfico|grafico|tabela|mapa|tirinha|charge)"
    r"\s+para\s+as?\s+quest(?:ões|oes|ão|ao)\s+(?:de\s+)?"
    r"([0-9]{1,3})\s*(?:a|e|até|,|–|-)\s*([0-9]{1,3})"
)
QUESTION = re.compile(r"(?i)quest(?:ão|ao)\s*([0-9]{1,3})")

def clean_text(value):
    value = re.sub(r"\s+", " ", value or "").strip()
    for start in (1, 46, 91, 136):
        marker = " ".join(str(number) for number in range(start, start + 45))
        value = value.replace(marker, " ")
    return re.sub(r"\s+", " ", value).strip()

def intersects_visual(page, rect, include_drawings=True):
    for info in page.get_images(full=True):
        for image_rect in page.get_image_rects(info[0]):
            overlap = image_rect & rect
            if not overlap.is_empty and overlap.width > 15 and overlap.height > 15:
                return True
    if include_drawings:
        for drawing in page.get_drawings():
            overlap = drawing["rect"] & rect
            if not overlap.is_empty and overlap.width > 15 and overlap.height > 15:
                return True
    return False

def find_groups(pdf, year, day):
    doc = fitz.open(pdf)
    groups = []
    for page_index, page in enumerate(doc):
        blocks = page.get_text("blocks")
        width = page.rect.width
        mid = width / 2
        page_text_lower = page.get_text("text").lower()
        for block in blocks:
            x0, y0, x1, y1, text, *_ = block
            match = LABEL.search(text)
            if not match:
                continue
            kind = match.group(1).lower()
            start = int(match.group(2))
            end = int(match.group(3))

            foreign_range = range(91, 96) if 2010 <= year <= 2016 and day == 2 else (
                range(1, 6) if year >= 2017 and day == 1 else range(0)
            )
            if start in foreign_range and "espanhol" in page_text_lower:
                # The canonical extraction publishes English as the primary
                # foreign-language variant; Spanish remains in extra_data.
                continue
            if end < start:
                start, end = end, start

            column = 0 if x0 < mid else 1
            xmin = 0 if column == 0 else mid - 15
            xmax = mid + 15 if column == 0 else width

            next_question_y = None
            for candidate in blocks:
                cx0, cy0, cx1, cy1, ctext, *_ = candidate
                if cy0 <= y0 or (0 if cx0 < mid else 1) != column:
                    continue
                qmatch = QUESTION.search(ctext)
                if qmatch and int(qmatch.group(1)) == start:
                    next_question_y = cy0
                    break
            cross_page = next_question_y is None
            if cross_page:
                # Some official booklets place the shared stimulus on a full page
                # and begin the first dependent question on the following page.
                next_question_y = page.rect.height - 50
                xmin, xmax = 25, page.rect.width - 25

            clip = fitz.Rect(xmin, y1, xmax, next_question_y)
            if clip.height < 8:
                continue

            body = clean_text(page.get_text("text", clip=clip))
            visual = intersects_visual(page, clip, include_drawings=not cross_page)
            images = []
            if visual:
                folder = ASSET_ROOT / str(year) / f"dia-{day}"
                folder.mkdir(parents=True, exist_ok=True)
                filename = f"q{start}-{end}.png"
                target = folder / filename
                page.get_pixmap(clip=clip, dpi=180, alpha=False).save(target)
                images.append(str(target.relative_to(ROOT / "content" / "enem")).replace("\\", "/"))

            groups.append({
                "id": f"enem:{year}:d{day}:q{start}-{end}",
                "year": year,
                "day": day,
                "question_numbers": list(range(start, end + 1)),
                "title": f"Material de referência para as questões {start} a {end}",
                "body": "" if visual else body,
                "images": images,
                "source_pdf": str(pdf.relative_to(PDF_ROOT)).replace("\\", "/"),
                "source_pages": [page_index + 1],
                "confidence": "explicit_official_label",
                "label": clean_text(match.group(0)),
            })
    return groups

def main():
    # Generated assets are a build product of this script. Recreate them from
    # the official PDFs so stale crops can never survive a changed extraction.
    if ASSET_ROOT.exists():
        shutil.rmtree(ASSET_ROOT)

    groups = []
    for pdf in sorted(PDF_ROOT.glob("*/regular/prova/*.pdf")):
        year = int(pdf.parts[-4])
        day = 1 if "dia1" in pdf.name.lower() else 2
        groups.extend(find_groups(pdf, year, day))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "schema": "bsestudos.enem-reference-groups.v1",
        "groups": groups,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Reference groups: {len(groups)}")
    print(f"Visual references: {sum(bool(g['images']) for g in groups)}")
    print(f"Text-only references: {sum(not g['images'] and bool(g['body']) for g in groups)}")
    for group in groups:
        print(group["id"], group["question_numbers"], "images=", len(group["images"]), "body=", len(group["body"]))

if __name__ == "__main__":
    main()
