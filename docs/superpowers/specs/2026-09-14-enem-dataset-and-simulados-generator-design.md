# ENEM Dataset & Gerador Dinâmico de Simulados — Design Técnico

- **Data:** 2026-09-14
- **Status:** Aprovado em brainstorming; aguardando revisão da especificação escrita
- **Escopo:** Provas regulares do ENEM de 2009 a 2024, extração completa de textos e imagens sem APIs externas, armazenamento em SQLite local (`data/enem/enem.db`) e gerador de simulados por temática com sorteio entre anos no padrão `bsestudos.exam.v1`.

---

## 1. Contexto e Objetivos

O projeto **BS Estudos** possui um módulo de simulados baseado no componente `ExamPlayer` e no contrato de dados `bsestudos.exam.v1`. Para que a plataforma ofereça simulados autênticos e variados para preparação pré-vestibular, é necessário:

1. **Baixar diretamente da fonte oficial (INEP)** todos os cadernos de provas e gabaritos oficiais das edições modernas do ENEM (de 2009 a 2024), sem recorrer a APIs ou serviços externos de terceiros.
2. **Analisar prova por prova localmente**, extraindo de forma automatizada cada questão com seu enunciado, opções (A a E), resposta correta oficial e as figuras, gráficos, charges ou tabelas vinculadas.
3. **Persistir o acervo completo em um banco de dados relacional leve (SQLite)** estruturado em `data/enem/enem.db`.
4. **Disponibilizar um gerador de simulados por temática (área do conhecimento)** que sorteie questões aleatoriamente entre os diferentes anos (2009 a 2024), garantindo simulados dinâmicos, sem limite de repetição e com alta fidelidade visual.

---

## 2. Decisões de Arquitetura

1. **Processamento Local Autônomo:** O pipeline roda inteiramente em Python local com a biblioteca `pymupdf` (PyMuPDF), sem depender de serviços externos ou APIs proprietárias.
2. **Download Direto do INEP:** O download é feito diretamente dos endpoints oficiais de arquivo do INEP (`download.inep.gov.br`), garantindo autenticidade e versões oficiais de provas e gabaritos.
3. **Imagens Nativas em Alta Resolução:** Imagens embutidas nas questões são extraídas na resolução nativa do PDF (ou renderizadas com alta densidade em caso de composições vetoriais) e salvas em pasta dedicada `data/enem/images/` com nomenclatura determinística `enem_{ano}_q{numero}_img{idx}.png`.
4. **Armazenamento Híbrido:**
   - O acervo bruto de todas as questões fica indexado em `data/enem/enem.db` (SQLite) com tags de ano, área, disciplina e caminhos de imagens.
   - Os simulados gerados são salvos como arquivos `.bsestudos.exam.json` em `data/enem/simulados/`, prontos para consumo imediato pela biblioteca local de estudos e pelo `ExamPlayer`.
5. **Divisão por Áreas do Conhecimento:**
   - **Linguagens, Códigos e suas Tecnologias**
   - **Ciências Humanas e suas Tecnologias**
   - **Ciências da Natureza e suas Tecnologias**
   - **Matemática e suas Tecnologias**
   - **Geral (Simulado Misto)**
   O sorteio respeita o histórico de divisão de cadernos do ENEM (transição da ordem das matérias entre os dias 1 e 2 a partir de 2017).

---

## 3. Estrutura de Diretórios e Banco de Dados

### 3.1. Estrutura em Disco

```text
data/
└── enem/
    ├── pdfs/
    │   ├── 2009/
    │   │   ├── prova_d1.pdf
    │   │   ├── gabarito_d1.pdf
    │   │   ├── prova_d2.pdf
    │   │   └── gabarito_d2.pdf
    │   └── ... (2010 a 2024)
    ├── images/
    │   ├── enem_2023_q015_img1.png
    │   ├── enem_2023_q100_img1.png
    │   └── ...
    ├── enem.db
    └── simulados/
        ├── simulado_ciencias_natureza_rand_45.bsestudos.exam.json
        └── ...
```

### 3.2. Esquema do Banco SQLite (`enem.db`)

```sql
CREATE TABLE IF NOT EXISTS enem_questions (
    id TEXT PRIMARY KEY,               -- Ex: "enem-2023-q100"
    year INTEGER NOT NULL,             -- Ex: 2023
    day INTEGER NOT NULL,              -- 1 ou 2
    original_number INTEGER NOT NULL,  -- 1 a 180
    area TEXT NOT NULL,                -- 'linguagens', 'ciencias-humanas', 'ciencias-natureza', 'matematica'
    statement TEXT NOT NULL,           -- Enunciado textual completo
    images TEXT NOT NULL DEFAULT '[]', -- JSON Array de caminhos relativos
    options TEXT NOT NULL,             -- JSON Array de 5 opções: ["A", "B", "C", "D", "E"]
    correct_option INTEGER NOT NULL,   -- 0 a 4
    language TEXT,                     -- 'ingles', 'espanhol' ou NULL
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enem_area_year ON enem_questions(area, year);
CREATE INDEX IF NOT EXISTS idx_enem_year_number ON enem_questions(year, original_number);
```

---

## 4. Componentes do Sistema

### 4.1. Módulo de Download (`scripts/enem_downloader.py`)
- Mapeia as URLs de download dos cadernos oficiais e gabaritos no portal do INEP de 2009 a 2024.
- Faz o download idempotente: caso o arquivo já exista e tenha tamanho válido, pula o download.
- Emite logs com barra de progresso para acompanhar cada ano.

### 4.2. Módulo de Extração e Parser (`scripts/enem_parser.py`)
- Utiliza `pymupdf` para abrir os PDFs e extrair:
  - Blocos de texto de enunciados e opções (detectando cabeçalhos de questão por regex: `(?:QUESTÃO|Questão)\s*(\d+)`).
  - Imagens, figuras e esquemas contidos no retângulo de cada questão, exportando para PNG em `data/enem/images/`.
  - Leitura dos PDFs de gabarito para extração tabular da relação (questão -> alternativa correta de 0 a 4).
- Insere as questões validadas em `data/enem/enem.db`.

### 4.3. Gerador de Simulados Sorteados (`scripts/generate_simulado.py` e API)
- Aceita filtros:
  - `--area`: `linguagens`, `ciencias-humanas`, `ciencias-natureza`, `matematica` ou `geral`
  - `--count`: Quantidade de questões desejada (ex: 15, 30, 45, 90)
  - `--output`: Nome do arquivo de saída `.bsestudos.exam.json`
- Realiza sorteio com `ORDER BY RANDOM()` garantindo variedade de anos entre 2009 e 2024.
- Gera o formato exato `bsestudos.exam.v1` validado por `src/services/examSchema.js`.

### 4.4. Integração no Frontend (`src/pages/ExamsPage.js` e `src/components/QuestionCard.js`)
- Adiciona na interface de Simulados um painel para geração instantânea de simulados por temática.
- Atualiza o adaptador `toExamPlayerQuestion` para repassar `image` para `QuestionCard` permitindo renderização imediata das figuras.

---

## 5. Plano de Verificação e Testes

1. **Testes Unitários de Schema:**
   - Executar `npm test` verificando que qualquer simulado produzido pelo gerador passa com `valid: true` em `validateLocalExam()`.
   - Adicionar teste unitário cobrindo o mapeamento de imagens em `toExamPlayerQuestion()`.
2. **Validação do Acervo:**
   - Script de teste de integridade que confirma se 100% das questões no banco possuem enunciado, 5 alternativas, gabarito válido e imagens acessíveis no disco.
3. **Validação Funcional:**
   - Gerar simulados para cada uma das 4 áreas temáticas.
   - Abrir no navegador e realizar um simulado interativo comprovando carregamento de perguntas, imagens, respostas e pontuação final.
