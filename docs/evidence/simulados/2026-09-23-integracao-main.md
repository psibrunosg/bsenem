# Evidência: integração dos simulados do main com prática e domínio

- Data: 2026-09-23
- Branch: `simulados-integracao` (base `9c8e361` + merge de `origin/main` `707dd73`)
- Plano: `docs/superpowers/plans/2026-09-23-integracao-simulados-main.md`
- Ambiente: somente local. SQLite descartável com dois usuários sintéticos, e o conteúdo é importado dos arquivos versionados no primeiro uso. Sem produção, cookie real ou dado pessoal.

## Comandos

| Comando | Exit | Resultado |
| --- | --- | --- |
| `npm test` | 0 | PASS: 250 testes |
| `npm run build` | 0 | PASS |
| `php backend/tests/*_test.php` (10 arquivos, incluindo lint, auth, private beta, catálogo, publicação, sessões, recomendação, API, study catalog/library) | 0 | PASS |
| `git diff --check` | 0 | PASS |

## Importação real (banco novo)

- `enem_questions`: 3060 questões; banco de concursos: 2795 questões; 10 catálogos (7 ENEM, 3 concursos).
- As 7 provas ENEM do main resolvem 405/405 questões em `enem_questions` (0 ausentes, 0 inválidas).
- Duração da importação: cerca de 2 s.

## Percurso no navegador (Playwright headless), 1280×800 e 390×844

| Verificação | 1280 | 390 |
| --- | --- | --- |
| Catálogo agrupado em ENEM e Concursos, com 7 provas ENEM | PASS | PASS |
| Montagem oferece áreas ENEM e matérias de concursos | PASS | PASS |
| Prova ENEM completa abre com 45 questões e 135 min | PASS | PASS |
| "Salvar e sair" e retomada da prova ENEM na posição salva | PASS | PASS |
| Catálogo de concursos abre no mesmo player de sessão | PASS | PASS |
| Montagem com 2 matérias e 4 questões mistura só as matérias escolhidas | PASS | PASS |
| Resultado confirmado pelo servidor ("1 de 4 corretas") | PASS | PASS |
| Mapa atualizado após concluir | PASS | PASS |
| Sem rolagem horizontal (home, player, após concluir) | PASS | PASS |
| Outra conta recebe 404 na sessão alheia | PASS | PASS |
| Sem erros de console após o login | PASS | PASS |

## Falhas observadas e corrigidas

- FAIL: montagem com Matemática + Psicologia trazia só Matemática. Adicionada seleção intercalada por matéria e teste de API; agora PASS.
