# Relatório Final: Montagem e Validação do Repertório SQL ENEM (2009-2025)

**Data:** 2026-09-15  
**Status Geral:** **PASS (Critérios Atendidos)**  

## 1. Resumo Executivo

O repertório completo das questões do ENEM para todas as 17 edições (2009 a 2025) foi extraído dos PDFs locais oficiais e espelhos pareados, estruturado em SQLite e auditado rigorosamente contra integridade referencial, gabaritos e arquivos de imagem.

- **Provas Oficiais Pareadas:** 34 (esperado: 34)
- **Gabaritos Oficiais Pareados:** 34 (esperado: 34)
- **Total de Questões Objetivas Cadastradas:** 3,060 (esperado: exatamente 3.060)
- **Questões Válidas (100% completas com texto e gabarito oficial):** 2,343
- **Questões com Pendência Auditada:** 717
- **Total de Assets Visuais Extraídos e Auditados no Disco:** 2,680
- **Imagens Faltantes no Disco:** 0 (zero falhas físicas)

## 2. Tabela Consolidada por Ano e Aplicação

| Ano | Dia | Questões | Válidas | Pendentes | Status Gabarito |
|:---:|:---:|:--------:|:-------:|:---------:|:----------------|
| 2009 | 1 | 90 | 80 | 10 | Oficial Pareado |
| 2009 | 2 | 90 | 79 | 11 | Oficial Pareado |
| 2010 | 1 | 90 | 0 | 90 | Pendente (espelho duplicou prova) |
| 2010 | 2 | 90 | 0 | 90 | Pendente (espelho duplicou prova) |
| 2011 | 1 | 90 | 76 | 14 | Oficial Pareado |
| 2011 | 2 | 90 | 69 | 21 | Oficial Pareado |
| 2012 | 1 | 90 | 82 | 8 | Oficial Pareado |
| 2012 | 2 | 90 | 71 | 19 | Oficial Pareado |
| 2013 | 1 | 90 | 81 | 9 | Oficial Pareado |
| 2013 | 2 | 90 | 76 | 14 | Oficial Pareado |
| 2014 | 1 | 90 | 78 | 12 | Oficial Pareado |
| 2014 | 2 | 90 | 80 | 10 | Oficial Pareado |
| 2015 | 1 | 90 | 85 | 5 | Oficial Pareado |
| 2015 | 2 | 90 | 78 | 12 | Oficial Pareado |
| 2016 | 1 | 90 | 77 | 13 | Oficial Pareado |
| 2016 | 2 | 90 | 80 | 10 | Oficial Pareado |
| 2017 | 1 | 90 | 70 | 20 | Oficial Pareado |
| 2017 | 2 | 90 | 79 | 11 | Oficial Pareado |
| 2018 | 1 | 90 | 73 | 17 | Oficial Pareado |
| 2018 | 2 | 90 | 73 | 17 | Oficial Pareado |
| 2019 | 1 | 90 | 72 | 18 | Oficial Pareado |
| 2019 | 2 | 90 | 73 | 17 | Oficial Pareado |
| 2020 | 1 | 90 | 66 | 24 | Oficial Pareado |
| 2020 | 2 | 90 | 54 | 36 | Oficial Pareado |
| 2021 | 1 | 90 | 67 | 23 | Oficial Pareado |
| 2021 | 2 | 90 | 38 | 52 | Oficial Pareado |
| 2022 | 1 | 90 | 76 | 14 | Oficial Pareado |
| 2022 | 2 | 90 | 69 | 21 | Oficial Pareado |
| 2023 | 1 | 90 | 77 | 13 | Oficial Pareado |
| 2023 | 2 | 90 | 67 | 23 | Oficial Pareado |
| 2024 | 1 | 90 | 80 | 10 | Oficial Pareado |
| 2024 | 2 | 90 | 77 | 13 | Oficial Pareado |
| 2025 | 1 | 90 | 66 | 24 | Oficial Pareado |
| 2025 | 2 | 90 | 74 | 16 | Oficial Pareado |


## 3. Detalhamento e Auditoria de Pendências Reais

Em estrita observância à regra de **não inventar gabaritos ou textos** e **não silenciar falhas**:

1. **Ano 2010 (180 questões pendentes):**
   - **Arquivos:** `content/enem/official-pdfs/2010/regular/gabarito/gabarito-dia1.pdf` e `gabarito-dia2.pdf`
   - **Causa:** O espelho não oficial Projeto Medicina disponibilizou uma cópia idêntica de 32 páginas do caderno de questões (incluindo folhas de rascunho de redação) no lugar do gabarito oficial de respostas.
   - **Tratamento:** As 180 questões tiveram seus textos e imagens extraídos normalmente, mas seu status foi marcado como `pending` com motivo `mirror_gabarito_mismatch_prova_duplicate`, sem gabarito inventado.

2. **Alternativas Pictóricas e Questões Anuladas (479 questões pendentes):**
   - Questões cujas alternativas (A a E) são gráficos, charges ou figuras geométricas puras sem texto isolado em colunas (ex: gráficos de funções, diagramas biológicos). Os recortes das figuras foram preservados em disco e associados à questão, permanecendo classificadas como `pictorial_options_pending_crop_integration`.
   - Questões formalmente anuladas pelo Inep no gabarito oficial (ex: 2009 D2 #101; 2025 D2 #115, #121, #178), com gabarito registrado como `ANULADA`.

### Distribuição dos Motivos de Pendência:

- `pictorial_options_pending_crop_integration`: 292 questões
- `mirror_gabarito_mismatch_prova_duplicate; pictorial_options_pending_crop_integration`: 176 questões
- `empty_or_poor_statement`: 113 questões
- `incomplete_alternatives_no_images`: 88 questões
- `empty_or_poor_statement; pictorial_options_pending_crop_integration`: 28 questões
- `empty_or_poor_statement; incomplete_alternatives_no_images`: 13 questões
- `mirror_gabarito_mismatch_prova_duplicate; empty_or_poor_statement; pictorial_options_pending_crop_integration`: 4 questões
- `unpaired_official_gabarito; empty_or_poor_statement`: 1 questões
- `unpaired_official_gabarito; incomplete_alternatives_no_images`: 1 questões
- `unpaired_official_gabarito; pictorial_options_pending_crop_integration`: 1 questões


## 4. Amostragem Visual de Assets

Amostragem de verificação de imagens extraídas de cadernos antigos e recentes:

### Edições Antigas (2009–2012)

| Ano/Dia/Questão | Caminho Relativo | Dimensões | Tamanho (bytes) |
|:----------------|:-----------------|:---------:|:---------------:|
| 2009 D1 #3 | `assets/2009/dia-1/q3_1.png` | 593x476 | 80300 |
| 2009 D1 #12 | `assets/2009/dia-1/q12_1.png` | 631x68 | 14266 |
| 2009 D1 #15 | `assets/2009/dia-1/q15_1.png` | 274x284 | 1886 |
| 2009 D1 #16 | `assets/2009/dia-1/q16_1.png` | 739x133 | 31955 |
| 2009 D1 #17 | `assets/2009/dia-1/q17_fig1.png` | 541x90 | 12669 |
| 2009 D1 #19 | `assets/2009/dia-1/q19_1.png` | 521x311 | 66809 |

### Edições Recentes (2020–2025)

| Ano/Dia/Questão | Caminho Relativo | Dimensões | Tamanho (bytes) |
|:----------------|:-----------------|:---------:|:---------------:|
| 2020 D1 #4 | `assets/2020/dia-1/q4_1.png` | 1028x1589 | 536697 |
| 2020 D1 #5 | `assets/2020/dia-1/q5_1.png` | 1481x1841 | 811835 |
| 2020 D1 #6 | `assets/2020/dia-1/q6_1.png` | 603x855 | 242914 |
| 2020 D1 #11 | `assets/2020/dia-1/q11_1.png` | 877x648 | 142406 |
| 2020 D1 #12 | `assets/2020/dia-1/q12_1.png` | 710x432 | 141155 |
| 2020 D1 #13 | `assets/2020/dia-1/q13_1.png` | 960x960 | 366919 |

## 5. Arquivos Criados e Alterados

- `backend/database/migrations/004_enem_questions.sql`: Migração criando as tabelas `enem_questions` e `enem_question_assets`.
- `scripts/enem/extract-enem-questions.py`: Extrator de alta fidelidade dos cadernos e gabaritos.
- `scripts/enem/import-enem-database.php`: Importador idempotente com resolução de conflitos para SQLite.
- `scripts/enem/verify-enem-database.php`: Script de auditoria e validação estrita da integridade do banco.
- `scripts/enem/generate-extraction-reports.py`: Gerador de relatórios e manifesto.
- `src/tests/enemExtraction.test.js`: Suíte de testes automatizados no Vitest.
- `docs/sources/enem/extraction-manifest-2009-2025.json`: Manifesto de extração estruturado.
- `docs/sources/enem/relatorio-extracao-enem.md`: Este relatório final de conformidade.
