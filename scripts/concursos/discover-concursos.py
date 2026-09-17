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
    # Psicólogo e variações
    {"cargo_base": "Psicólogo", "uf": "RS", "query": "psicologo RS"},
    {"cargo_base": "Psicólogo", "uf": "SC", "query": "psicologo SC"},
    {"cargo_base": "Psicólogo", "uf": "PR", "query": "psicologo PR"},
    {"cargo_base": "Psicólogo", "uf": "RS", "query": "psicologia RS"},
    {"cargo_base": "Psicólogo", "uf": "SC", "query": "psicologia SC"},
    {"cargo_base": "Psicólogo", "uf": "PR", "query": "psicologia PR"},
    {"cargo_base": "Psicólogo", "uf": "RS", "query": "psicologo escolar RS"},
    {"cargo_base": "Psicólogo", "uf": "SC", "query": "psicologo escolar SC"},
    {"cargo_base": "Psicólogo", "uf": "PR", "query": "psicologo escolar PR"},
    {"cargo_base": "Psicólogo", "uf": "RS", "query": "psicologo clinico RS"},
    {"cargo_base": "Psicólogo", "uf": "SC", "query": "psicologo clinico SC"},
    {"cargo_base": "Psicólogo", "uf": "PR", "query": "psicologo clinico PR"},
    {"cargo_base": "Psicólogo", "uf": "RS", "query": "psicologo social RS"},
    {"cargo_base": "Psicólogo", "uf": "SC", "query": "psicologo social SC"},
    {"cargo_base": "Psicólogo", "uf": "PR", "query": "psicologo social PR"},
    
    # Nutricionista e variações
    {"cargo_base": "Nutricionista", "uf": "RS", "query": "nutricionista RS"},
    {"cargo_base": "Nutricionista", "uf": "SC", "query": "nutricionista SC"},
    {"cargo_base": "Nutricionista", "uf": "PR", "query": "nutricionista PR"},
    {"cargo_base": "Nutricionista", "uf": "RS", "query": "nutricao RS"},
    {"cargo_base": "Nutricionista", "uf": "SC", "query": "nutricao SC"},
    {"cargo_base": "Nutricionista", "uf": "PR", "query": "nutricao PR"},
    {"cargo_base": "Nutricionista", "uf": "RS", "query": "nutricionista clinico RS"},
    {"cargo_base": "Nutricionista", "uf": "SC", "query": "nutricionista clinico SC"},
    {"cargo_base": "Nutricionista", "uf": "PR", "query": "nutricionista clinico PR"},
    {"cargo_base": "Nutricionista", "uf": "RS", "query": "nutricionista escolar RS"},
    {"cargo_base": "Nutricionista", "uf": "SC", "query": "nutricionista escolar SC"},
    {"cargo_base": "Nutricionista", "uf": "PR", "query": "nutricionista escolar PR"},

    # Educador Físico / Educação Física e variações
    {"cargo_base": "Educador Físico", "uf": "RS", "query": "educacao fisica RS"},
    {"cargo_base": "Educador Físico", "uf": "SC", "query": "educacao fisica SC"},
    {"cargo_base": "Educador Físico", "uf": "PR", "query": "educacao fisica PR"},
    {"cargo_base": "Educador Físico", "uf": "RS", "query": "educador fisico RS"},
    {"cargo_base": "Educador Físico", "uf": "SC", "query": "educador fisico SC"},
    {"cargo_base": "Educador Físico", "uf": "PR", "query": "educador fisico PR"},
    {"cargo_base": "Educador Físico", "uf": "RS", "query": "professor educacao fisica RS"},
    {"cargo_base": "Educador Físico", "uf": "SC", "query": "professor educacao fisica SC"},
    {"cargo_base": "Educador Físico", "uf": "PR", "query": "professor educacao fisica PR"},
    {"cargo_base": "Educador Físico", "uf": "RS", "query": "instrutor educacao fisica RS"},
    {"cargo_base": "Educador Físico", "uf": "SC", "query": "instrutor educacao fisica SC"},
    {"cargo_base": "Educador Físico", "uf": "PR", "query": "instrutor educacao fisica PR"},
    {"cargo_base": "Educador Físico", "uf": "RS", "query": "bacharel educacao fisica RS"},
    {"cargo_base": "Educador Físico", "uf": "SC", "query": "bacharel educacao fisica SC"},
    {"cargo_base": "Educador Físico", "uf": "PR", "query": "bacharel educacao fisica PR"},
]

def clean_text(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def discover_exams():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Carrega manifesto existente para preservar downloads anteriores
    manifest = []
    seen_urls = set()
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        for item in manifest:
            seen_urls.add(item["pci_url"])
        print(f"Manifesto existente carregado com {len(manifest)} provas.")

    new_items_count = 0
    print(f"Iniciando descoberta de provas com variações de cargos no PCI Concursos...")

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
                manifest.append(item)
                seen_urls.add(href)
                new_items_count += 1
                print(f"    + NOVO [{ano}] {title} | {orgao} ({banca})")

            time.sleep(1)
        except Exception as e:
            print(f"  Erro ao buscar '{query}': {e}")

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"\nDescoberta concluída! {new_items_count} novas provas adicionadas ao acervo.")
    print(f"Total geral no manifesto: {len(manifest)} provas qualificadas dos últimos 5 anos (2021–2026).")
    print(f"Manifesto salvo em: {MANIFEST_PATH}")
    return manifest

if __name__ == "__main__":
    discover_exams()
