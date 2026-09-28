#!/usr/bin/env python3
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QUESTIONS = ROOT / "docs" / "sources" / "enem" / "extracted-questions-2009-2025.json"
REFERENCES = ROOT / "content" / "enem" / "reference-groups.json"
OUTPUT = ROOT / "content" / "enem" / "quality-quarantine.json"

CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
REFERENCE = re.compile(
    r"(?:de acordo com o texto|com base no texto|segundo o texto|"
    r"no texto acima|texto anterior|fragmento acima)",
    re.I,
)
VISUAL = re.compile(
    r"(?:gráfico|figura|imagem|tirinha|charge|mapa)\s+(?:a seguir|acima)",
    re.I,
)
WATERMARK = re.compile(r"(?:(?:ENEM\s*20\d{2})[\s\r\n]*){3,}", re.I)

# Audited against the official PDF page layout. These records captured the
# preceding question tail because two-column reading order crossed question
# boundaries. They must be re-extracted, not "fixed" with a reference alone.
MISALIGNED_QUESTION_NUMBERS = {
    (2020, 2, 161),
    (2021, 2, 120),
    (2021, 2, 129),
    (2021, 2, 137),
}


def embedded_option_labels(question):
    count = 0
    for index, letter in enumerate("abcde"):
        value = (question.get(f"option_{letter}") or "").lstrip()
        expected = chr(65 + index)
        if re.match(rf"^{expected}(?:[\s\t.):-]+)", value):
            count += 1
    return count >= 3


def issue_row(question, reasons):
    return {
        "year": question["year"],
        "day": question["day"],
        "question_number": question["question_number"],
        "reasons": sorted(set(reasons)),
        "source_pdf": question["source_pdf"],
        "source_pages": question["source_pages"],
    }


def main():
    questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))["questions"]
    groups = json.loads(REFERENCES.read_text(encoding="utf-8"))["groups"]
    linked = {
        (group["year"], group["day"], number)
        for group in groups
        for number in group["question_numbers"]
    }

    issues = []
    warnings = []
    counts = Counter()
    warning_counts = Counter()

    for question in questions:
        if question.get("status") != "valid":
            continue

        key = (question["year"], question["day"], question["question_number"])
        statement = (question.get("statement") or "").strip()
        images = question.get("images") or []
        fields = [statement] + [(question.get(f"option_{letter}") or "") for letter in "abcde"]
        reasons = []
        presentation = []

        if any(CONTROL.search(value) for value in fields):
            reasons.append("corrupted_pdf_text")

        if key in MISALIGNED_QUESTION_NUMBERS:
            reasons.append("question_number_misalignment")

        if key not in linked and not images and len(statement) < 80:
            reasons.append("missing_context_or_visual")

        if key not in linked and not images and len(statement) < 250 and REFERENCE.search(statement):
            reasons.append("possible_missing_reference")

        if key not in linked and not images and VISUAL.search(statement):
            reasons.append("possible_missing_visual")

        if any(WATERMARK.search(value) for value in fields):
            presentation.append("repeated_watermark")

        if embedded_option_labels(question):
            presentation.append("embedded_option_labels")

        reasons = sorted(set(reasons))
        presentation = sorted(set(presentation))
        if reasons:
            for reason in reasons:
                counts[reason] += 1
            issues.append(issue_row(question, reasons))

        if presentation:
            for reason in presentation:
                warning_counts[reason] += 1
            warnings.append(issue_row(question, presentation))

    output = {
        "schema": "bsestudos.enem-quality-quarantine.v1",
        "policy": {
            "scope": "valid ENEM questions only",
            "blocking_effect": "exclude from simulator publication without mutating official content",
            "presentation_effect": "keep raw source immutable and clean deterministic extraction noise only in student-facing DTOs",
            "automatic_release": "regenerate after extraction/reference fixes and review",
        },
        "summary": {
            "quarantined": len(issues),
            "reasons": dict(sorted(counts.items())),
            "presentation_warnings": len(warnings),
            "presentation_warning_reasons": dict(sorted(warning_counts.items())),
        },
        "issues": issues,
        "presentation_warnings": warnings,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(output["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
