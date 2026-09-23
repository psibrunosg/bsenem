# Evidência — Simulados: prática orientada e mapa de domínio (Task 6)

- Data da verificação: 2026-09-23
- Branch: `simulados-pratica-dominio`
- Base da verificação: `9938d00` + alterações da Task 6 (commit `test: verify simulator practice workflow`)
- Ambiente: somente local. Banco SQLite descartável no diretório temporário da sessão, dois usuários sintéticos (`novo@example.test`, `historico@example.test`) e 27 questões ENEM sintéticas com `status = 'valid'` (15 de Matemática, 12 de Linguagens). Sem URL de produção, cookie real ou dado pessoal.

## Arquivos rastreados alterados

- `src/components/ExamPlayer.js`
- `src/components/ResultsScreen.js`
- `src/components/QuestionCard.js`
- `src/pages/ExamsPage.js`
- `src/services/SimulatorApiService.js`
- `src/utils/icons.js`
- `src/assets/styles/components/exam.css`
- `src/assets/styles/reset.css`
- `src/tests/ExamPlayer.test.js`
- `src/tests/ResultsScreen.test.js`
- `src/tests/ExamsPage.test.js`
- `src/tests/htmlSafety.test.js`
- `backend/tests/private_beta_test.php`

## Comandos

| Comando | Exit | Resultado |
| --- | --- | --- |
| `npm test` | 0 | PASS — 247 testes |
| `npm run build` | 0 | PASS |
| `npm run lint:php` | 0 | PASS |
| `npm run test:backend` | 0 | PASS |
| `php backend/tests/private_beta_test.php` | 0 | PASS |
| `php backend/tests/published_question_repository_test.php` | 0 | PASS |
| `php backend/tests/simulator_session_repository_test.php` | 0 | PASS |
| `php backend/tests/simulator_recommendation_test.php` | 0 | PASS |
| `php backend/tests/simulator_api_test.php` | 0 | PASS |
| `git diff --check` | 0 | PASS |

## Percurso no navegador (Playwright headless, API PHP e Vite locais)

Executado em 1280×800 (`novo@example.test`) e 390×844 (`historico@example.test`).

| Verificação | 1280 | 390 |
| --- | --- | --- |
| Sem histórico: seletor de matéria, sem porcentagem inventada | PASS | PASS |
| Menos de 5 respostas: "Dados insuficientes" em texto, sem % | — | PASS |
| Sem rolagem horizontal na home e no player | PASS | PASS |
| Tecla B marca a alternativa; F marca a questão para revisar | PASS | PASS |
| Ícones do cartão aparecem depois de navegar entre questões | PASS | PASS |
| "Salvar e sair" persiste o tempo (restante 24:57) | PASS | PASS |
| Após recarregar: retomada com "2 de 10", posição, resposta e marcação | PASS | PASS |
| Resultado confirmado pelo servidor ("2 de 10 corretas", tempo 00:03), sem emoji | PASS | PASS |
| Revisão somente leitura, com gabarito destacado | PASS | PASS |
| Voltar recarrega a home: recomendação "Começar prática" e mapa atualizado | PASS | PASS |
| Sessão concluída deixa de aparecer como retomável | PASS | PASS |
| Mapa empilhado e com rótulos em tela estreita | — | PASS |
| Nenhum erro de console após o login | PASS | PASS |
| Outra conta: GET e PATCH da sessão alheia respondem 404/404 | PASS | |

## Falhas observadas e corrigidas antes da conclusão

- FAIL `private_beta_test.php`: esperava 7 migrações, e existem 8 desde `008_simulator_session_draft_fields.sql`. Expectativa atualizada para 8, agora PASS.
- FAIL rolagem horizontal no player (+4 px): o `::after` de `.exam-dot.flagged` não tinha ancestral posicionado. Adicionado `position: relative` e trocado o emoji por um marcador com token de cor, agora PASS.
- FAIL ícones do cartão (bandeira, ajuda, ✓/✗ da revisão) não renderizavam após trocar de questão, porque `lucide.createIcons` era chamado com o elemento ainda fora do documento. Criado `renderIcons(root)`, chamado depois de anexar o elemento, agora PASS.
- FAIL tempo perdido ao recarregar ou fechar a aba entre salvamentos. Adicionado salvamento com `keepalive` em `pagehide` e na aba oculta. "Salvar e sair" e o resultado mostram tempo persistido, agora PASS.
- FAIL mapa de domínio em 390 px com células coladas e sem rótulos: especificidade de `display:block` e cabeçalho oculto. Seletor ajustado e `data-label` por célula, agora PASS.

Nada foi publicado, implantado ou migrado fora do ambiente local.
