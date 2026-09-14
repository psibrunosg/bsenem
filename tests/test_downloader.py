import os
import tempfile
import pytest
from scripts.enem_downloader import select_year_pdfs, download_file

def test_select_year_pdfs_2024():
    sample_links = [
        ("Prova", "https://download.inep.gov.br/enem/provas_e_gabaritos/2024_PV_impresso_D1_CD1.pdf"),
        ("Gabarito", "https://download.inep.gov.br/enem/provas_e_gabaritos/2024_GB_impresso_D1_CD1.pdf"),
        ("Prova", "https://download.inep.gov.br/enem/provas_e_gabaritos/2024_PV_impresso_D2_CD5.pdf"),
        ("Gabarito", "https://download.inep.gov.br/enem/provas_e_gabaritos/2024_GB_impresso_D2_CD5.pdf"),
        ("Prova", "https://download.inep.gov.br/enem/provas_e_gabaritos/2024_PV_impresso_D1_CD2.pdf"),
    ]
    selected = select_year_pdfs(2024, sample_links)
    assert selected["d1_prova"] == "https://download.inep.gov.br/enem/provas_e_gabaritos/2024_PV_impresso_D1_CD1.pdf"
    assert selected["d1_gabarito"] == "https://download.inep.gov.br/enem/provas_e_gabaritos/2024_GB_impresso_D1_CD1.pdf"
    assert selected["d2_prova"] == "https://download.inep.gov.br/enem/provas_e_gabaritos/2024_PV_impresso_D2_CD5.pdf"
    assert selected["d2_gabarito"] == "https://download.inep.gov.br/enem/provas_e_gabaritos/2024_GB_impresso_D2_CD5.pdf"

def test_select_year_pdfs_2009():
    sample_links = [
        ("Prova", "https://download.inep.gov.br/enem/provas_e_gabaritos/dia1_caderno1_azul.pdf"),
        ("Gabarito", "https://download.inep.gov.br/enem/provas_e_gabaritos/gabarito_dia1.pdf"),
        ("Prova", "https://download.inep.gov.br/enem/provas_e_gabaritos/dia2_caderno5_amarelo.pdf"),
        ("Gabarito", "https://download.inep.gov.br/enem/provas_e_gabaritos/gabarito_dia2.pdf"),
    ]
    selected = select_year_pdfs(2009, sample_links)
    assert "dia1_caderno1_azul.pdf" in selected["d1_prova"]
    assert "gabarito_dia1.pdf" in selected["d1_gabarito"]
    assert "dia2_caderno5_amarelo.pdf" in selected["d2_prova"]
    assert "gabarito_dia2.pdf" in selected["d2_gabarito"]

def test_download_idempotency():
    with tempfile.TemporaryDirectory() as tmpdir:
        dest = os.path.join(tmpdir, "test.pdf")
        with open(dest, "wb") as f:
            f.write(b"%PDF-1.4 test" + b"0" * 2000)
        
        # When file already exists and > 1000 bytes, download_file should return True without re-fetching
        result = download_file("http://invalid.fake.url/test.pdf", dest)
        assert result is True
