#!/usr/bin/env python3
import json
import re
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[2]
QUESTIONS = ROOT / "docs/sources/enem/extracted-questions-2009-2025.json"
QUARANTINE = ROOT / "content/enem/quality-quarantine.json"
MAPPINGS = ROOT / "content/enem/corrupted-text-mappings.json"
REPORT = ROOT / "content/enem/corrupted-text-recovery-report.json"

CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
FIELDS = ["statement", "option_a", "option_b", "option_c", "option_d", "option_e"]


def key_of(row):
    return (int(row["year"]), int(row["day"]), int(row["question_number"]))


def approved_mappings():
    if not MAPPINGS.is_file():
        return {}
    data = json.loads(MAPPINGS.read_text(encoding="utf-8"))
    result = {}
    for item in data.get("mappings", []):
        if item.get("review_status") != "approved" or item.get("deterministic") is not True:
            continue
        key = (int(item["year"]), int(item["day"]), int(item["question_number"]))
        replacements = item.get("replacements")
        if isinstance(replacements, dict) and replacements:
            result[key] = item
    return result


def page_span_diagnostics(pdf_path, pages):
    diagnostics = []
    if not pdf_path.is_file():
        return [{"error": "pdf_not_found", "path": str(pdf_path)}]
    doc = fitz.open(pdf_path)
    try:
        for page_number in pages:
            index = int(page_number) - 1
            if index < 0 or index >= len(doc):
                diagnostics.append({"page": page_number, "error": "page_out_of_range"})
                continue
            page = doc[index]
            payload = page.get_text("dict")
            for block in payload.get("blocks", []):
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = str(span.get("text", ""))
                        if CONTROL.search(text):
                            diagnostics.append({
                                "page": int(page_number),
                                "font": span.get("font"),
                                "size": span.get("size"),
                                "bbox": span.get("bbox"),
                                "raw_text": text,
                            })
    finally:
        doc.close()
    return diagnostics


def apply_mapping(question, mapping):
    updated = dict(question)
    changes = []
    replacements = mapping.get("replacements", {})
    for field in FIELDS:
        before = str(updated.get(field) or "")
        after = before
        for old, new in replacements.items():
            after = after.replace(old, new)
        if after != before:
            updated[field] = after
            changes.append({"field": field, "before": before, "after": after})
    return updated, changes


def main():
    questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))["questions"]
    by_key = {key_of(q): q for q in questions}
    quarantine = json.loads(QUARANTINE.read_text(encoding="utf-8"))
    mappings = approved_mappings()
    targets = [
        issue for issue in quarantine.get("issues", [])
        if "corrupted_pdf_text" in issue.get("reasons", [])
    ]

    entries = []
    recovered = 0
    for issue in targets:
        key = key_of(issue)
        question = by_key.get(key)
        if question is None:
            entries.append({"key": key, "decision": "blocked_missing_question"})
            continue

        mapping = mappings.get(key)
        recovered_question, changes = apply_mapping(question, mapping) if mapping else (question, [])
        remaining_corruption = any(CONTROL.search(str(recovered_question.get(field) or "")) for field in FIELDS)
        source_pdf = ROOT / "content/enem/official-pdfs" / str(question["source_pdf"])
        spans = page_span_diagnostics(source_pdf, question.get("source_pages") or [question.get("source_page")])

        decision = "blocked_no_deterministic_mapping"
        if mapping and changes and not remaining_corruption:
            decision = "candidate_requires_visual_validation"
            recovered += 1
        elif mapping and remaining_corruption:
            decision = "blocked_mapping_incomplete"

        entries.append({
            "year": key[0],
            "day": key[1],
            "question_number": key[2],
            "source_pdf": question.get("source_pdf"),
            "source_pages": question.get("source_pages"),
            "decision": decision,
            "before": {field: question.get(field) for field in FIELDS},
            "after": {field: recovered_question.get(field) for field in FIELDS},
            "changes": changes,
            "affected_spans": spans,
            "mapping_id": mapping.get("id") if mapping else None,
        })

    report = {
        "schema": "bsestudos.enem-corrupted-text-recovery.v1",
        "policy": {
            "raw_source_immutable": True,
            "automatic_guessing": False,
            "mapping_requires": ["deterministic=true", "review_status=approved"],
            "release_requires_visual_validation": True,
        },
        "summary": {
            "corrupted_questions": len(targets),
            "mapped_candidates": recovered,
            "still_blocked": len(targets) - recovered,
        },
        "entries": entries,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
