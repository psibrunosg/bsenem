import os
import re
import time
from typing import Dict, List, Optional, Tuple
import requests
from bs4 import BeautifulSoup

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def get_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    return session

def is_regular_exam(href: str, text: str) -> bool:
    bad_terms = ["ppl", "reaplicacao", "reaplica", "ampliada", "superampliada", "braile", "ledor", "libras", "digital"]
    filename = href.split("/")[-1].lower()
    txt = text.lower()
    return not any(term in filename or term in txt for term in bad_terms)

def is_gabarito(href: str, text: str) -> bool:
    filename = href.split("/")[-1].lower()
    txt = text.lower()
    return "gabarito" in txt or "_gb" in filename or "gabarito" in filename or "gb_" in filename

def select_year_pdfs(year: int, links: List[Tuple[str, str]]) -> Dict[str, Optional[str]]:
    regular_links = [(txt, href) for txt, href in links if is_regular_exam(href, txt)]
    if not regular_links:
        regular_links = links  # fallback
        
    result: Dict[str, Optional[str]] = {
        "d1_prova": None,
        "d1_gabarito": None,
        "d2_prova": None,
        "d2_gabarito": None
    }
    
    # Separate into provas and gabaritos
    provas = [(txt, href) for txt, href in regular_links if not is_gabarito(href, txt)]
    gabaritos = [(txt, href) for txt, href in regular_links if is_gabarito(href, txt)]
    
    # 1. Dia 1 Prova
    # Prefer CD1 / azul / dia 1
    for txt, href in provas:
        fn = href.split("/")[-1].lower()
        t = txt.lower()
        if ("cd1" in fn or "caderno1" in fn or "azul" in fn or "caderno_01" in fn) and ("d1" in fn or "dia1" in fn or "dia 1" in t or "primeiro dia" in t):
            result["d1_prova"] = href
            break
    if not result["d1_prova"]:
        for txt, href in provas:
            fn = href.split("/")[-1].lower()
            t = txt.lower()
            if "d1" in fn or "dia1" in fn or "dia 1" in t or "dia_1" in fn:
                result["d1_prova"] = href
                break

    # 2. Dia 1 Gabarito
    for txt, href in gabaritos:
        fn = href.split("/")[-1].lower()
        t = txt.lower()
        if ("cd1" in fn or "caderno1" in fn or "azul" in fn or "caderno_01" in fn) and ("d1" in fn or "dia1" in fn or "dia 1" in t or "primeiro dia" in t):
            result["d1_gabarito"] = href
            break
    if not result["d1_gabarito"]:
        for txt, href in gabaritos:
            fn = href.split("/")[-1].lower()
            t = txt.lower()
            if "d1" in fn or "dia1" in fn or "dia 1" in t or "dia_1" in fn:
                result["d1_gabarito"] = href
                break

    # 3. Dia 2 Prova
    # Prefer CD5 / amarelo / cinza / dia 2
    for txt, href in provas:
        fn = href.split("/")[-1].lower()
        t = txt.lower()
        if ("cd5" in fn or "caderno5" in fn or "amarelo" in fn or "cinza" in fn or "caderno_05" in fn) and ("d2" in fn or "dia2" in fn or "dia 2" in t or "segundo dia" in t):
            result["d2_prova"] = href
            break
    if not result["d2_prova"]:
        for txt, href in provas:
            fn = href.split("/")[-1].lower()
            t = txt.lower()
            if "d2" in fn or "dia2" in fn or "dia 2" in t or "dia_2" in fn:
                result["d2_prova"] = href
                break

    # 4. Dia 2 Gabarito
    for txt, href in gabaritos:
        fn = href.split("/")[-1].lower()
        t = txt.lower()
        if ("cd5" in fn or "caderno5" in fn or "amarelo" in fn or "cinza" in fn or "caderno_05" in fn) and ("d2" in fn or "dia2" in fn or "dia 2" in t or "segundo dia" in t):
            result["d2_gabarito"] = href
            break
    if not result["d2_gabarito"]:
        for txt, href in gabaritos:
            fn = href.split("/")[-1].lower()
            t = txt.lower()
            if "d2" in fn or "dia2" in fn or "dia 2" in t or "dia_2" in fn:
                result["d2_gabarito"] = href
                break

    return result

def fetch_year_links(year: int, session: Optional[requests.Session] = None) -> List[Tuple[str, str]]:
    if session is None:
        session = get_session()
    url = f"https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos/{year}"
    
    for attempt in range(3):
        try:
            resp = session.get(url, timeout=30)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                links: List[Tuple[str, str]] = []
                for a in soup.find_all("a", href=True):
                    href = a["href"].strip()
                    if ".pdf" in href.lower():
                        text = " ".join(a.get_text().split())
                        links.append((text, href))
                return links
        except Exception as e:
            if attempt == 2:
                print(f"Erro ao buscar links do ano {year}: {e}")
            time.sleep(2)
    return []

def download_file(url: str, dest_path: str, session: Optional[requests.Session] = None) -> bool:
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1000:
        return True
        
    os.makedirs(os.path.dirname(os.path.abspath(dest_path)), exist_ok=True)
    if session is None:
        session = get_session()
        
    temp_path = dest_path + ".tmp"
    for attempt in range(3):
        try:
            with session.get(url, stream=True, timeout=60) as resp:
                resp.raise_for_status()
                with open(temp_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=65536):
                        if chunk:
                            f.write(chunk)
            if os.path.exists(temp_path) and os.path.getsize(temp_path) > 1000:
                if os.path.exists(dest_path):
                    os.remove(dest_path)
                os.rename(temp_path, dest_path)
                return True
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            if attempt == 2:
                print(f"Falha ao baixar {url}: {e}")
            time.sleep(3)
    return False

def download_year(year: int, base_dir: str = "data/enem/pdfs", session: Optional[requests.Session] = None) -> Dict[str, str]:
    year_dir = os.path.join(base_dir, str(year))
    os.makedirs(year_dir, exist_ok=True)
    
    links = fetch_year_links(year, session=session)
    selected = select_year_pdfs(year, links)
    
    downloaded: Dict[str, str] = {}
    for key, url in selected.items():
        if not url:
            print(f"Aviso: {key} não encontrado para o ano {year}")
            continue
        dest_filename = f"{key}.pdf"
        dest_path = os.path.join(year_dir, dest_filename)
        print(f"Baixando [{year}] {key}: {url} -> {dest_path}")
        if download_file(url, dest_path, session=session):
            downloaded[key] = dest_path
        else:
            print(f"Erro no download de {key} ({year})")
            
    return downloaded
