#!/usr/bin/env python3
"""
scripts/concursos/discover-concursos.py

Varre o PCI Concursos utilizando Scrapling para descobrir todas as provas
dos últimos 5 anos (2021-2026) nos estados do RS, SC e PR para os cargos:
- Psicólogo
- Nutricionista
- Educador Físico / Professor de Educação Física

Salva o resultado em docs/sources/concursos/manifest-concursos-sul.json
"""

import os
import re
import json
import time
from scrapling.fetchers import Fetcher

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUTPUT_DIR = os.path.join(ROOT_DIR, 'docs/sources/concursos')
MANIFEST_PATH = os.path.join(OUTPUT_DIR, 'manifest-concursos-sul.json')

TARGET_YEARS = {2021, 2022, 2023, 2024, 2025, 2026}

SEARCH_TASKS = [
    # Psicólogo
    {"cargo_base": "Psicólogo", "uf": "RS", "query": "psicologo RS"},
    {"cargo_base": "Psicólogo", "uf": "SC", "query": "psicologo SC"},
    {"cargo_base": "Psicólogo", "uf": "PR", "query": "psicologo PR"},
    # Nutricionista
    {"cargo_base": "Nutricionista", "uf": "RS", "query": "nutricionista RS"},
    {"cargo_base": "Nutricionista", "uf": "SC", "query": "nutricionista SC"},
    {"cargo_base": "Nutricionista", "uf": "PR", "query": "nutricionista PR"},
    # Educador Físico / Educação Física
    {"cargo_base": "Educador Físico", "uf": "RS", "query": "educacao fisica RS"},
    {"cargo_base": "Educador Físico", "uf": "SC", "query": "educacao fisica SC"},
    {"cargo_base": "Educador Físico", "uf": "PR", "query": "educacao fisica PR"},
]

def clean_text(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def discover_exams():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    discovered = []
    seen_urls = set()

    print("Iniciando descoberta de provas no PCI Concursos com Scrapling...")

    for task in SEARCH_TASKS:
        query = task["query"]
        cargo_base = task["cargo_base"]
        uf = task["uf"]

        print(f"\n[Busca] '{query}' ({cargo_base} - {uf})...")
        try:
            resp = Fetcher.post(
                "https://www.pciconcursos.com.br/provas/",
                data={"prova": query, "botao": "Pesquisar"},
                impersonate="chrome"
            )
            if resp.status != 200:
                print(f"  Aviso: status {resp.status} para query '{query}'")
                continue

            rows = resp.css("#lista_provas tbody tr")
            print(f"  Encontradas {len(rows)} linhas na tabela.")

            for r in rows:
                prova_link = r.css(".ca a, .ea a")
                ano_elem = r.css(".cb, .eb")
                orgao_elem = r.css(".cc a, .ec a")
                banca_elem = r.css(".cd a, .ed a")

                href = prova_link[0].attrib.get("href", "") if prova_link else ""
                if not href or href in seen_urls:
                    continue

                ano_str = ano_elem[0].text.strip() if ano_elem else ""
                try:
                    ano = int(ano_str)
                except ValueError:
                    continue

                if ano not in TARGET_YEARS:
                    continue

                title = clean_text(prova_link[0].attrib.get("title", "") or prova_link[0].text)
                orgao = clean_text(orgao_elem[0].text if orgao_elem else "")
                banca = clean_text(banca_elem[0].text if banca_elem else "")

                slug = re.sub(r'[^a-zA-Z0-9_\-]+', '_', href.split('/')[-1]).lower().strip('_')

                item = {
                    "slug": slug,
                    "cargo_base": cargo_base,
                    "titulo_prova": title,
                    "uf": uf,
                    "ano": ano,
                    "orgao": orgao,
                    "banca": banca,
                    "pci_url": href,
                    "status_download": "pending",
                    "prova_pdf": None,
                    "gabarito_pdf": None
                }
                discovered.append(item)
                seen_urls.add(href)
                print(f"    + [{ano}] {title} | {orgao} ({banca})")

            time.sleep(1)
        except Exception as e:
            print(f"  Erro ao buscar '{query}': {e}")

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(discovered, f, ensure_ascii=False, indent=2)

    print(f"\nDescoberta concluída! Total de {len(discovered)} provas qualificadas dos últimos 5 anos.")
    print(f"Manifesto salvo em: {MANIFEST_PATH}")
    return discovered

if __name__ == "__main__":
    discover_exams()
