# ENEM Dataset & Gerador Dinâmico de Simulados — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o pipeline autônomo para baixar todas as provas e gabaritos oficiais do ENEM (2009 a 2024) direto do INEP, extrair cada questão e imagem associada via PyMuPDF, persistir no banco SQLite local (`data/enem/enem.db`) e fornecer um gerador de simulados dinâmicos por temática no padrão `bsestudos.exam.v1`.

**Architecture:** Pipeline modular em Python usando `pymupdf` para extração gráfica/textual e SQLite para indexação relacional. Um gerador consulta o banco com `ORDER BY RANDOM()` filtrando por área de conhecimento e compila simulados compatíveis com o `ExamPlayer` do frontend.

**Tech Stack:** Python 3.11, PyMuPDF (fitz), SQLite3, JavaScript ES Modules, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-enem-dataset-and-simulados-generator-design.md`

## Global Constraints

- Provas de 2009 a 2024, cadernos regulares (Dia 1 e Dia 2).
- Zero dependência de APIs externas de terceiros; downloads diretos do portal oficial do INEP (`download.inep.gov.br`).
- Imagens extraídas salvas em `data/enem/images/` com links relativos preservados.
- Simulados gerados devem validar 100% no esquema `bsestudos.exam.v1` via `src/services/examSchema.js`.

---

### Task 1: Banco de Dados SQLite & Camada de Acesso (`scripts/db.py`)

**Files:**
- Create: `scripts/db.py`
- Test: `tests/test_db.py`

**Interfaces:**
- Produces:
  - `init_db(db_path: str) -> sqlite3.Connection`
  - `insert_question(conn, question_dict: dict) -> bool`
  - `get_questions_by_area(conn, area: str, limit: int, shuffle: bool = True) -> list[dict]`
  - `get_question_stats(conn) -> dict`

- [ ] **Step 1: Escrever teste automatizado para o banco de dados**

Criar `tests/test_db.py`:
```python
import os
import tempfile
import pytest
from scripts.db import init_db, insert_question, get_questions_by_area, get_question_stats

def test_init_and_insert_question():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test_enem.db")
        conn = init_db(db_path)
        
        q = {
            "id": "enem-2023-q100",
            "year": 2023,
            "day": 2,
            "original_number": 100,
            "area": "ciencias-natureza",
            "statement": "Um professor lança uma esfera...",
            "images": ["data/enem/images/enem_2023_q100_img1.png"],
            "options": ["A", "B", "C", "D", "E"],
            "correct_option": 2,
            "language": None
        }
        assert insert_question(conn, q) is True
        
        stats = get_question_stats(conn)
        assert stats["total"] == 1
        assert stats["by_area"]["ciencias-natureza"] == 1
        
        questions = get_questions_by_area(conn, area="ciencias-natureza", limit=10)
        assert len(questions) == 1
        assert questions[0]["id"] == "enem-2023-q100"
        assert questions[0]["options"] == ["A", "B", "C", "D", "E"]
        assert questions[0]["images"] == ["data/enem/images/enem_2023_q100_img1.png"]
        conn.close()
```

- [ ] **Step 2: Executar teste e verificar falha**
Run: `python -m pytest tests/test_db.py -v`
Expected: FAIL (módulo scripts.db não existe).

- [ ] **Step 3: Implementar `scripts/db.py`**
Criar `scripts/db.py` com criação da tabela `enem_questions`, serialização JSON para campos de lista (`options`, `images`) e consultas de sorteio com `ORDER BY RANDOM()`.

- [ ] **Step 4: Executar teste e verificar aprovação**
Run: `python -m pytest tests/test_db.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add scripts/db.py tests/test_db.py
git commit -m "feat: add SQLite schema and access layer for ENEM questions"
```

---

### Task 2: Downloader Oficial de Provas e Gabaritos do INEP (`scripts/enem_downloader.py`)

**Files:**
- Create: `scripts/enem_downloader.py`
- Test: `tests/test_downloader.py`

**Interfaces:**
- Produces:
  - `get_exam_urls(year: int) -> dict` (retorna URLs de cadernos D1, D2 e gabaritos GB1, GB2)
  - `download_file(url: str, dest_path: str) -> bool`
  - `download_year(year: int, base_dir: str) -> dict`

- [ ] **Step 1: Escrever teste para mapeamento de URLs e download idempotente**

Criar `tests/test_downloader.py` testando a resolução das URLs para os anos de 2009 a 2024 e o comportamento de cache local se o arquivo já existir.

- [ ] **Step 2: Executar teste e verificar falha**
Run: `python -m pytest tests/test_downloader.py -v`
Expected: FAIL.

- [ ] **Step 3: Implementar `scripts/enem_downloader.py`**
Implementar o catálogo de URLs do portal do INEP de 2009 a 2024, rotina com headers HTTP de navegador, detecção de redirect, retry e verificação de arquivos.

- [ ] **Step 4: Executar teste e verificar aprovação**
Run: `python -m pytest tests/test_downloader.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add scripts/enem_downloader.py tests/test_downloader.py
git commit -m "feat: implement INEP official exam and answer key downloader"
```

---

### Task 3: Parser de Provas, Gabaritos e Extrator de Imagens (`scripts/enem_parser.py`)

**Files:**
- Create: `scripts/enem_parser.py`
- Test: `tests/test_parser.py`

**Interfaces:**
- Produces:
  - `parse_gabarito_pdf(pdf_path: str) -> dict[int, str]` (ex: `{1: 'A', 2: 'C', ...}`)
  - `extract_questions_from_pdf(pdf_path: str, gabarito: dict, year: int, day: int, output_images_dir: str) -> list[dict]`
  - `process_year(year: int, pdf_dir: str, images_dir: str, conn) -> int`

- [ ] **Step 1: Escrever teste para o parser de gabarito e extração de questões**
Criar `tests/test_parser.py` testando parsing de texto de gabarito tabular e parsing de blocos de questão.

- [ ] **Step 2: Executar teste e verificar falha**
Run: `python -m pytest tests/test_parser.py -v`
Expected: FAIL.

- [ ] **Step 3: Implementar `scripts/enem_parser.py`**
Implementar com PyMuPDF (`pymupdf`):
- Leitura de gabaritos com regex para tabelas de respostas.
- Leitura de cadernos de prova com detecção de delimitadores `QUESTÃO \d+`.
- Identificação de bounding box de imagens da página correspondente ao bloco da questão e exportação em PNG.
- Separação de texto de apoio, alternativas A, B, C, D, E.
- Mapeamento das 4 áreas (Linguagens, Humanas, Natureza, Matemática).

- [ ] **Step 4: Executar teste e verificar aprovação**
Run: `python -m pytest tests/test_parser.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add scripts/enem_parser.py tests/test_parser.py
git commit -m "feat: implement exam and answer key parser with image extraction"
```

---

### Task 4: Gerador de Simulados Sorteados (`scripts/generate_simulado.py`)

**Files:**
- Create: `scripts/generate_simulado.py`
- Test: `tests/test_generator.py`

**Interfaces:**
- Produces:
  - `build_simulado(conn, area: str, count: int, title: str = None) -> dict`
  - CLI execution: `python scripts/generate_simulado.py --area natureza --count 45 --out data/enem/simulados/simulado_natureza.bsestudos.exam.json`

- [ ] **Step 1: Escrever teste para validação do simulado gerado**
Criar `tests/test_generator.py` garantindo que o dicionário gerado possui `schema: "bsestudos.exam.v1"`, `id`, `title`, `durationMinutes`, lista de `questions` com 5 alternativas e resposta correta entre 0 e 4.

- [ ] **Step 2: Executar teste e verificar falha**
Run: `python -m pytest tests/test_generator.py -v`
Expected: FAIL.

- [ ] **Step 3: Implementar `scripts/generate_simulado.py`**
Implementar o sorteio aleatório misturando anos, cálculo de tempo estimado (3 min por questão), montagem do formato `bsestudos.exam.v1` e suporte a CLI.

- [ ] **Step 4: Executar teste e verificar aprovação**
Run: `python -m pytest tests/test_generator.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add scripts/generate_simulado.py tests/test_generator.py
git commit -m "feat: add randomized simulados generator by knowledge area"
```

---

### Task 5: Integração no Frontend (`examSchema.js` e `QuestionCard.js`)

**Files:**
- Modify: `src/services/examSchema.js:22-26`
- Modify: `src/tests/examSchema.test.js`

**Interfaces:**
- `toExamPlayerQuestion(question)` passa a mapear `image` caso exista no objeto de questão:
```javascript
export function toExamPlayerQuestion(question) {
  const playerQuestion = { id: question.id, text: question.statement, answers: question.options, correctAnswer: question.correctOption };
  if (question.explanation !== undefined) playerQuestion.explanation = question.explanation;
  if (question.image !== undefined) playerQuestion.image = question.image;
  return playerQuestion;
}
```

- [ ] **Step 1: Atualizar teste de unidade em `src/tests/examSchema.test.js`**
Adicionar teste cobrindo a propagação de `image` para o `playerQuestion`.

- [ ] **Step 2: Executar teste e verificar falha**
Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Atualizar `toExamPlayerQuestion` em `src/services/examSchema.js`**
Adicionar `if (question.image !== undefined) playerQuestion.image = question.image;`.

- [ ] **Step 4: Executar testes e verificar aprovação**
Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/services/examSchema.js src/tests/examSchema.test.js
git commit -m "feat: propagate question images in examSchema toExamPlayerQuestion"
```

---

### Task 6: Execução em Lote Completa (Download, Extração 2009-2024 e Povoamento do Banco)**

**Files:**
- Create: `scripts/run_pipeline.py`
- Populate: `data/enem/pdfs/`, `data/enem/images/`, `data/enem/enem.db`
- Generate: `data/enem/simulados/*.bsestudos.exam.json`

- [ ] **Step 1: Criar script orquestrador `scripts/run_pipeline.py`**
Script que itera de 2009 a 2024, executa download, parser e persistência no banco SQLite com logs detalhados de progresso.

- [ ] **Step 2: Executar pipeline em lote**
Run: `python scripts/run_pipeline.py`
Expected: Download dos cadernos e gabaritos, extração de imagens em `data/enem/images/` e inserção das questões em `data/enem/enem.db`.

- [ ] **Step 3: Validar integridade do banco e imagens**
Run: `python -c "from scripts.db import *; conn = init_db('data/enem/enem.db'); print(get_question_stats(conn))"`
Expected: Estatísticas de questões exibidas com sucesso por área e ano.

- [ ] **Step 4: Gerar simulados de exemplo por área temática**
Gerar 4 simulados sorteados (Linguagens, Humanas, Natureza, Matemática) em `data/enem/simulados/`.

- [ ] **Step 5: Commit dos scripts e dados estruturados**
```bash
git add scripts/run_pipeline.py
git commit -m "feat: complete batch extraction pipeline for ENEM 2009-2024"
```
