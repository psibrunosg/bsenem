# Simulados ENEM — banco de questões e geração

Estado em 19/09/2026.

## O que existe

| Camada | Arquivo | Papel |
|---|---|---|
| Download | `scripts/enem_downloader.py` | Baixa provas e gabaritos do INEP (2009–2024) |
| Extração | `scripts/enem_parser.py` | Lê os PDFs (2 colunas) e grava o texto **cru** no SQLite |
| Limpeza | `scripts/question_cleaner.py` | Repara e valida a questão na hora de usar (funções puras) |
| Geração | `scripts/generate_simulado.py` | Sorteia e escreve os `.bsestudos.exam.json` |
| Banco | `data/enem/enem.db` | 2 927 questões cruas |
| Saída | `data/enem/simulados/` | Simulados prontos para a biblioteca local do app |

O banco continua sendo a **fonte crua**: a limpeza acontece na geração, então rodar o
parser de novo não desfaz nada.

## Simulados gerados

| Arquivo | Questões | Duração |
|---|---|---|
| `simulado_linguagens_45q` | 45 | 135 min |
| `simulado_ciencias-humanas_45q` | 45 | 135 min |
| `simulado_ciencias-natureza_45q` | 45 | 135 min |
| `simulado_matematica_45q` | 45 | 135 min |
| `simulado_dia1_90q` | 90 (LC + CH) | 330 min |
| `simulado_dia2_90q` | 90 (CN + MT) | 300 min |
| `simulado_geral_45q` | 45 (misto) | 135 min |

Todos passam em `validateLocalExam` (`src/services/examSchema.js`).

Regerar tudo:

```bash
python scripts/generate_simulado.py --all --seed 42
```

Um simulado avulso:

```bash
python scripts/generate_simulado.py --area matematica --count 20
```

## Qualidade do banco

De 2 927 questões extraídas:

- **2 420 válidas** depois da limpeza (82,7 %)
- **2 087 entram nos simulados** — as 333 restantes dependem de imagem e o
  `ExamPlayer` ainda não renderiza imagem nenhuma
- 507 descartadas: alternativas não detectadas (261), alternativa longa demais
  porque o enunciado vazou de outra forma (196), gabarito não confirmado (177),
  enunciado placeholder (45), alternativas repetidas (33)

Distribuição das respostas no banco: A 538 · B 552 · C 574 · D 581 · E 505 —
uniforme, que é o sinal de que o casamento prova × gabarito está certo.

Pool aproveitável por área: CH 534 · CN 528 · LC 519 · MT 506.

## Defeitos de extração corrigidos nesta rodada

1. **Enunciado vazando para a alternativa A.** O layout de duas colunas fazia o
   fim do enunciado ser capturado dentro da alternativa A, com um marcador `A`
   duplicado no meio. `question_cleaner` corta no último marcador e devolve o
   trecho ao enunciado. Recuperou ~480 questões.
2. **Rodapé de caderno grudado na alternativa E** (`•LC – 1º DIA – CADERNO 1 – AZUL•`).
3. **Gabarito "chutado".** O parser usava `"A"` como padrão quando não achava a
   resposta — 265 questões tinham resposta errada em silêncio (2010 inteiro,
   2018 dia 2 inteiro). Agora grava `correct_option = -1` e a questão é
   rejeitada na validação.
4. **Numeração do 2º dia de 2018.** O caderno numera as questões de 1 a 90, mas o
   gabarito usa 91 a 180. Sem o deslocamento, as 93 questões do dia 2 de 2018
   ficavam todas com resposta "A" e todas classificadas como Ciências da
   Natureza (Matemática não recebia nenhuma). Corrigido em `_renumber_day2`.

## Pendências conhecidas

- **ENEM 2010 inutilizável**: o parser não detecta as alternativas nesse layout
  (182 de 183 questões descartadas) e o gabarito também não é lido.
- **196 questões com alternativa longa demais**: vazamento de enunciado por um
  caminho diferente do marcador `A` duplicado.
- **Imagens**: 106 questões válidas têm imagem extraída e ficam de fora até o
  `ExamPlayer` renderizar imagens. Para incluí-las mesmo assim:
  `--include-images`.
