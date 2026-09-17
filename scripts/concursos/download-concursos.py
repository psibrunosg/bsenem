#!/usr/bin/env python3
"""
scripts/concursos/download-concursos.py

Lê docs/sources/concursos/manifest-concursos-sul.json e baixa os cadernos de prova
e gabaritos oficiais utilizando Scrapling (StealthyFetcher com solve_cloudflare=True
e Fetcher com impersonate='chrome').

Suporta filtros por UF, Cargo e modo balanceado (round-robin entre RS, SC e PR).
"""

import os
import sys
import json
import time
import argparse
from scrapling.fetchers import StealthyFetcher, Fetcher

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
MANIFEST_PATH = os.path.join(ROOT_DIR, 'docs/sources/concursos/manifest-concursos-sul.json')
PDF_ROOT = os.path.join(ROOT_DIR, 'content/concursos/raw-pdfs')

def get_candidates(manifest, uf_filter=None, cargo_filter=None, balanced=True):
    pending = [i for i in manifest if i.get("status_download") != "downloaded"]
    
    if uf_filter:
        pending = [i for i in pending if i["uf"] == uf_filter]
    if cargo_filter:
        pending = [i for i in pending if i["cargo_base"] == cargo_filter]
        
    if not balanced:
        return pending

    # Agrupa por (uf, cargo_base) para fazer rodízio equilibrado
    groups = {}
    for item in pending:
        key = (item["uf"], item["cargo_base"])
        if key not in groups:
            groups[key] = []
        groups[key].append(item)

    interleaved = []
    max_len = max((len(v) for v in groups.values()), default=0)
    for idx in range(max_len):
        for key in sorted(groups.keys()):
            if idx < len(groups[key]):
                interleaved.append(groups[key][idx])
                
    return interleaved

def download_batch(limit=10, uf_filter=None, cargo_filter=None, balanced=True):
    if not os.path.exists(MANIFEST_PATH):
        print(f"Erro: manifesto não encontrado em {MANIFEST_PATH}")
        return

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    os.makedirs(PDF_ROOT, exist_ok=True)
    candidates = get_candidates(manifest, uf_filter, cargo_filter, balanced)

    print(f"Iniciando download de lote com Scrapling (limite: {limit}, candidatos pendentes: {len(candidates)})...")

    count = 0
    for item in candidates:
        if count >= limit:
            break

        pci_url = item["pci_url"]
        uf = item["uf"]
        ano = item["ano"]
        slug = item["slug"]
        cargo = item["cargo_base"]
        orgao = item["orgao"]

        print(f"\n[{count+1}/{limit}] Processando: {cargo} - {orgao} ({uf}, {ano})")
        print(f"  URL: {pci_url}")

        target_dir = os.path.join(PDF_ROOT, uf, str(ano), slug)
        os.makedirs(target_dir, exist_ok=True)

        try:
            # Resolve Cloudflare Turnstile com Scrapling
            page = StealthyFetcher.fetch(pci_url, headless=True, solve_cloudflare=True, wait=4)
            if page.status != 200:
                print(f"  Falha HTTP {page.status}")
                continue

            pdf_links = page.css(".prova-pdf-link")
            prova_url = None
            gabarito_url = None

            for el in pdf_links:
                action = el.attrib.get("data-acao", "")
                arquivo = el.attrib.get("data-arquivo", "")
                href = el.attrib.get("href", "")

                if action in ["ver", "baixar"] and href.startswith("http"):
                    if "gabarito" in arquivo.lower():
                        gabarito_url = href
                    elif not prova_url:
                        prova_url = href

            if not prova_url:
                print("  Aviso: link da prova não liberado após o captcha.")
                continue

            # Baixa Prova
            prova_dest = os.path.join(target_dir, "prova.pdf")
            r_prova = Fetcher.get(prova_url, impersonate="chrome")
            with open(prova_dest, "wb") as f:
                f.write(r_prova.body)
            print(f"  -> Prova baixada: {os.path.getsize(prova_dest)} bytes")

            # Baixa Gabarito (se houver)
            gabarito_dest = None
            if gabarito_url:
                gabarito_dest = os.path.join(target_dir, "gabarito.pdf")
                r_gab = Fetcher.get(gabarito_url, impersonate="chrome")
                with open(gabarito_dest, "wb") as f:
                    f.write(r_gab.body)
                print(f"  -> Gabarito baixado: {os.path.getsize(gabarito_dest)} bytes")

            item["status_download"] = "downloaded"
            item["prova_pdf"] = os.path.relpath(prova_dest, ROOT_DIR)
            item["gabarito_pdf"] = os.path.relpath(gabarito_dest, ROOT_DIR) if gabarito_dest else None
            count += 1

            # Salva progresso incremental recarregando o manifesto atual
            try:
                with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                    latest_manifest = json.load(f)
                for entry in latest_manifest:
                    if entry["pci_url"] == item["pci_url"]:
                        entry["status_download"] = "downloaded"
                        entry["prova_pdf"] = item["prova_pdf"]
                        entry["gabarito_pdf"] = item["gabarito_pdf"]
                        break
                with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
                    json.dump(latest_manifest, f, ensure_ascii=False, indent=2)
            except Exception as save_err:
                print(f"  Aviso ao salvar manifesto: {save_err}")

            time.sleep(2)  # Intervalo de segurança

        except Exception as e:
            print(f"  Erro no download: {e}")
            item["status_download"] = f"error: {str(e)[:50]}"

    print(f"\nLote finalizado! {count} novas provas baixadas.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Baixador de provas de concursos usando Scrapling")
    parser.add_argument("--limit", type=int, default=10, help="Quantidade máxima de provas para baixar")
    parser.add_argument("--uf", type=str, choices=["RS", "SC", "PR"], help="Filtrar por UF")
    parser.add_argument("--cargo", type=str, help="Filtrar por cargo base (Psicólogo, Nutricionista, Educador Físico)")
    parser.add_argument("--no-balanced", action="store_true", help="Desativar alternância equilibrada entre estados e cargos")

    args = parser.parse_args()
    download_batch(limit=args.limit, uf_filter=args.uf, cargo_filter=args.cargo, balanced=not args.no_balanced)
