# Integração: simulados permanentes (main) + prática e domínio (branch)

**Branch/worktree:** `simulados-integracao` em `.worktrees/simulados-integracao`, criada a partir de `simulados-pratica-dominio` (`9c8e361`), com merge de `origin/main` (`707dd73`).

**Decisão do usuário (2026-09-23):** integrar as duas implementações sem perder funcionalidade e abrir o PR para `main`.

## Contexto

- **main (`707dd73`):** importa `content/enem/*.bsestudos.exam.json` (7 provas ENEM) e `docs/sources/concursos/extracted-questions-sul.json` (concursos) para `simulator_question_bank`, com catálogos em `simulator_catalogs`. Rotas `/simulators/catalog[/{id}[/attempt]]`, `/generate` e `/generated/{id}[/attempt]`. Envia o gabarito ao cliente, a nota é calculada no navegador e não há rascunho.
- **branch:** sessões persistentes (`simulator_sessions`, composição imutável, rascunho, conclusão idempotente, nota no servidor), prática recomendada e mapa, sobre `enem_questions` (ids inteiros).
- O backend da VPS está parado (`docs/DEPLOY_VPS.md`). Nenhuma das migrações de simulados rodou em produção.

## Modelo integrado

1. **Sessão é o único fluxo de jogo.** Os catálogos do main viram sessões `kind = 'catalog'` com `catalog_id`. O builder do main vira `kind = 'custom'` com até 8 matérias e 200 questões. As rotas antigas saem, junto com as tabelas `generated_*` e `catalog_simulator_attempts`.
2. **Uma fonte de questões para sessões:** a view `simulator_questions`, com id em texto:
   - `inep:<enem_questions.id>`: ENEM válido com gabarito A–E (área e tópico por questão);
   - `concursos:<id>`: `simulator_question_bank` da categoria concursos.
3. **Provas ENEM completas** apontam para `enem_questions`. O id `enem-AAAA-dD-qNNN` do JSON é mapeado para ano/dia/número, sem cópias no banco do main, e o mapa usa a área real de cada questão.
4. **Importação automática e idempotente** (`SimulatorCatalogImporter::ensureImported`):
   - `enem_questions`: vem de `docs/sources/enem/extracted-questions-2009-2025.json` quando a tabela está vazia, com a lógica extraída para `EnemQuestionImporter` e reusada pelo script CLI;
   - concursos e catálogos: como no main.
   - `APP_CONTENT_IMPORT=off` desliga a importação nos testes com dados sintéticos.
5. **Migração `009_unified_simulator_questions.sql`:** recria a composição e as respostas das sessões com `question_id TEXT` (convertendo o legado para `inep:<id>`), recria `simulator_catalog_questions` sem FK para o banco, limpa o conteúdo importado pelo main (será reimportado), remove as tabelas `generated_*`/`catalog_simulator_attempts` e cria a view.

## API resultante

- `GET /simulators/catalog` → `{ subjects: [{key,label,available}], catalogs: [{id,title,category,subject,question_count,duration_minutes}] }`
- `POST /simulators/sessions` → `kind: practice | custom | catalog` (`catalog_id` quando for catálogo)
- As demais rotas de sessão ficam como estão.

## Frontend

- Home: hero, mapa e retomada ficam como estão. "Praticar outra matéria" dá lugar a **Simulados completos** (ENEM e concursos) e **Monte seu simulado** (matérias + quantidade), e tudo abre no `ExamPlayer` de sessão.

## Verificação

- Testes PHP (sessões, API, publicação, recomendação, catálogo, private beta), `npm test`, `npm run build`, `git diff --check`.
- Percurso Playwright: catálogo ENEM completo, concursos, builder com várias matérias, prática, retomada e resultado.

## Status

- [x] Resolver conflitos do merge
- [x] Migração 009 + view
- [x] Importadores (ENEM + catálogos)
- [x] Repositórios e controller com ids em texto e `kind = 'catalog'`
- [x] Rotas antigas removidas
- [x] Frontend: catálogo + builder
- [x] Testes e percurso
- [x] Commit, push e PR

## Desvios e achados durante a execução

- Montagem com várias matérias passou a intercalar as matérias. A ordem por ano/número trazia só a primeira matéria, e agora há teste para isso.
- O CSS vindo do main usava tokens inexistentes (`--color-*`, `--font-size-sm`); foram trocados pelos tokens reais.
- O handler de cliques da home passou a agir só no modo home. Antes, o "Praticar de novo" do resultado também disparava o recarregamento da home.
- Pendência de produto, herdada do main: os catálogos de concursos reúnem de 825 a 1.123 questões cada (tempo total de até 46 h pela regra de 150 s por questão).
- **Correção antes do deploy:** a release `707dd73` já está publicada na VPS (`current -> releases/707dd73`), e o banco de produção pode ter tentativas nas tabelas do main. A 009 foi revisada para não apagar dados: preserva `generated_simulators*` e `catalog_simulator_attempts`, não remove catálogos nem as cópias ENEM do banco (a FK `RESTRICT` faria a migração falhar), e reconstrói só a composição dos catálogos. `backend/tests/simulator_upgrade_test.php` simula esse upgrade.
