import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.db import init_db, get_question_stats
from scripts.enem_downloader import download_year
from scripts.enem_parser import process_year
from scripts.generate_simulado import PRESETS, build_simulado, write_simulado

def run_pipeline(start_year: int = 2009, end_year: int = 2024):
    print("=" * 60)
    print(f"Iniciando Pipeline ENEM ({start_year} - {end_year})")
    print("=" * 60)
    
    db_path = "data/enem/enem.db"
    base_pdf_dir = "data/enem/pdfs"
    images_dir = "data/enem/images"
    simulados_dir = "data/enem/simulados"
    
    os.makedirs(base_pdf_dir, exist_ok=True)
    os.makedirs(images_dir, exist_ok=True)
    os.makedirs(simulados_dir, exist_ok=True)
    
    conn = init_db(db_path)
    total_extracted_all = 0
    
    for year in range(start_year, end_year + 1):
        print(f"\n>>> Processando Edição: ENEM {year} <<<")
        start_time = time.time()
        
        # 1. Download
        try:
            downloaded = download_year(year, base_dir=base_pdf_dir)
            print(f"[{year}] Arquivos prontos: {len(downloaded)}/4")
        except Exception as e:
            print(f"[{year}] Erro no download: {e}")
            continue
            
        # 2. Parser & Extração
        try:
            saved = process_year(year, base_pdf_dir=base_pdf_dir, images_dir=images_dir, conn=conn)
            total_extracted_all += saved
            elapsed = time.time() - start_time
            print(f"[{year}] Concluído: {saved} questões salvas no banco ({elapsed:.1f}s)")
        except Exception as e:
            print(f"[{year}] Erro na extração: {e}")
            
    print("\n" + "=" * 60)
    print("RELATÓRIO FINAL DO BANCO DE QUESTÕES")
    print("=" * 60)
    stats = get_question_stats(conn)
    print(f"Total de questões cadastradas: {stats['total']}")
    print("\nDistribuição por Área de Conhecimento:")
    for area, count in stats["by_area"].items():
        print(f"  - {area}: {count} questões")
    print("\nDistribuição por Edição (Ano):")
    for yr, count in stats["by_year"].items():
        print(f"  - {yr}: {count} questões")
        
    # 3. Gerar simulados demonstrativos por área temática
    print("\n" + "=" * 60)
    print("GERANDO SIMULADOS POR ÁREA TEMÁTICA")
    print("=" * 60)
    for preset, config in PRESETS.items():
        try:
            sim = build_simulado(conn, area=preset, count=config["count"])
            fpath = os.path.join(simulados_dir, f"simulado_{preset}_{len(sim['questions'])}q.bsestudos.exam.json")
            write_simulado(sim, fpath)
        except Exception as e:
            print(f"Aviso ao gerar simulado para {preset}: {e}")
            
    conn.close()
    print("\nPipeline finalizado com sucesso!")

if __name__ == "__main__":
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 2009
    end = int(sys.argv[2]) if len(sys.argv) > 2 else 2024
    run_pipeline(start, end)
