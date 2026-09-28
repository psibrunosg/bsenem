# Evidência: deploy dos simulados na VPS

- Data: 2026-09-23
- Commit publicado: `f4589dd` (merge do PR #13), backend e frontend
- Host: `oraclevps2` (`estudos.bssaude.com.br`)

## Antes

- Clone em `b1ac23a` com 192 arquivos alterados por cópia manual; `current -> releases/707dd73`.
- Migrações aplicadas: 001, 002, 003, 006, 007_permanent_simulators.
- Dados: 1 usuário, 2 sessões de login, 4 anotações; tentativas de simulados vazias.

## Passos e resultados

| Passo | Resultado |
| --- | --- |
| Backup `backups/deploy-f4589dd-20260923T180831Z` (`VACUUM INTO`, tar da árvore, HEAD, current) | PASS: integridade `ok`, 1 usuário, 4 anotações |
| Parar `deploy-api-1` e `git checkout -f -B main origin/main` | FAIL na primeira tentativa: `backend/services` e `docs/sources` pertenciam ao root. Corrigido com `chown -R opc:opc` nessas pastas; o checkout seguinte deu PASS (HEAD `f4589dd`, 0 arquivos rastreados alterados) |
| Subir a API e rodar migrações | PASS: 001–009 aplicadas (inclui 004 e 005, que nunca tinham rodado) |
| Importar conteúdo | PASS: 3,08 s; 3060 questões ENEM; 10 catálogos visíveis; dados reais intactos; integridade `ok` |
| `bash scripts/deploy-vps.sh` | PASS: `current -> releases/f4589dd`, home HTTP 200 |
| Checagem pública | PASS: bundle contém "Simulados completos", "Monte seu simulado" e "Salvar e sair"; `/api/simulators/catalog` e `/overview` pedem login (401) |
| Fluxo autenticado com o código de produção sobre **cópia** do banco (usuário temporário só na cópia, apagada depois) | PASS: catálogo 200 (7 matérias, 10 catálogos); sessão de catálogo 201 (90 questões); montagem 201 mistura Psicologia e Matemática; progresso 200; conclusão 200 com nota do servidor; overview 200; `/simulators/generate` 404 |

API indisponível por cerca de 2 minutos durante a troca do código.
