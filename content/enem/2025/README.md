# Conteúdo ENEM 2025 - estado do pacote

Fontes oficiais: `docs/sources/enem/2025/aplicacao-regular/manifest.json`.

Proveniência: provas obtidas por GPT-5.6 Luna; transcrição e flashcards preparados por GPT-5.6 Terra; GPT-6 Astra atua somente como orquestrador.

## Estado atual

- Acervo preservado: 185 variantes oficiais - Dia 1 tem 95 (85 comuns, 5 Inglês e 5 Espanhol); Dia 2 tem 90. PDFs, gabaritos e páginas PNG completas são a fonte de verdade.
- Dia 1: `originais/dia-1/enem-2025-dia-1-caderno-1-azul.manifest.json` aponta cada uma das 95 variantes à página oficial e ao contexto adjacente. A extração textual mecânica é apenas apoio.
- Dia 1: os dois lotes adaptados e a transcrição parcial foram movidos de forma reversível para `drafts/` e não são reconhecidos pelo player.
- Dia 2: `originais/enem-2025-dia-2-caderno-5-amarelo.manifest.json` preserva 90 itens com acervo visual completo. As 3 questões anuladas estão registradas e excluídas de pontuação. A transcrição mecânica é apoio e permanece sujeita a revisão editorial.
- `enem-2025-dia-1-lote-01-flashcards.json` e `enem-2025-dia-2-flashcards.json` são flashcards autorais legados, em rascunho e pendentes de revisão. São separados das provas e não constituem transcrição oficial, gabarito oficial ou revisão humana.

## Imagens

Quando uma questão depender de imagem, extrair a figura da prova por recorte/screenshot do PDF ou usar o link indicado no enunciado. Preservar o asset, página/questão e URL no manifesto. A conversão atual descarta `question.image`; as páginas ficam preservadas, mas não devem ser publicadas até que o player resolva o caminho relativo na pasta local e o repasse ao `QuestionCard`. O plano concreto está em `docs/superpowers/plans/2026-09-14-enem-local-image-support.md`.

Este README registra cobertura completa do acervo visual de 185 variantes. Revisão editorial integral do texto e integração/publicação no player permanecem pendentes.
